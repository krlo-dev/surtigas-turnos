// Generador de histórico sintético con la misma estructura que entrega Digiturno (agregado por hora).
// Sirve para operar el prototipo mientras se importan los datos reales.

import { crearRng, poisson, type Rng } from "../engine/aleatorio";
import { esperaPromedio, nivelServicio, personasRequeridas } from "../engine/erlang";
import { diaSemana } from "../fechas";
import { SERVICIOS_SEED, type OficinaSeed } from "./catalogo";
import type { FilaDemanda } from "./perfil";

const FORMA_SEMANA: Record<number, number> = { 8: 0.55, 9: 0.8, 10: 1, 11: 0.8, 12: 0.55, 13: 0.62, 14: 0.9, 15: 0.82, 16: 0.5 };
const FORMA_SABADO: Record<number, number> = { 8: 0.6, 9: 0.9, 10: 1, 11: 0.7 };
const FACTOR_DIA = [0, 1.15, 1.0, 0.95, 0.95, 1.05, 0.75];
export const PARTE_PREFERENCIAL = 0.14;

export function lambdaSintetico(o: OficinaSeed, fecha: string): number[] {
  const dow = diaSemana(fecha);
  const out = new Array(24).fill(0);
  if (dow === 0 || (dow === 6 && !o.abreSabado)) return out;
  const forma = dow === 6 ? FORMA_SABADO : FORMA_SEMANA;
  for (const [h, f] of Object.entries(forma)) out[Number(h)] = o.demandaPico * f * FACTOR_DIA[dow];
  return out;
}

function ahtOficina(o: OficinaSeed) {
  // pequeñas variaciones por oficina para que no todas tengan el mismo tiempo de atención
  const factor = 0.92 + ((o.clave.length * 7) % 17) / 100;
  return SERVICIOS_SEED.map((s) => ({ ...s, ahtGeneral: s.ahtGeneral * factor, ahtPreferencial: s.ahtPreferencial * factor }));
}

export interface ResultadoSintetico {
  filas: (FilaDemanda & { enObjetivo: number; cancelados: number })[];
  operacion: { fecha: string; hora: number; operadores: number; terminales: number }[];
}

/**
 * Genera llegadas, esperas y abandonos por hora. Las esperas se derivan de Erlang C con una dotación
 * cercana a la requerida (a veces una persona menos, como pasa con las ausencias), más ruido.
 */
export function generarHistorico(o: OficinaSeed, fechas: string[], semilla: number, hastaMinuto?: { fecha: string; minuto: number }): ResultadoSintetico {
  const rng: Rng = crearRng(semilla);
  const servicios = ahtOficina(o);
  const ahtMedio = servicios.reduce((s, x) => s + x.parte * ((1 - PARTE_PREFERENCIAL) * x.ahtGeneral + PARTE_PREFERENCIAL * x.ahtPreferencial), 0);
  const filas: ResultadoSintetico["filas"] = [];
  const operacion: ResultadoSintetico["operacion"] = [];

  for (const fecha of fechas) {
    const lam = lambdaSintetico(o, fecha);
    const ruidoDia = 0.88 + rng() * 0.24;
    for (let h = 0; h < 24; h++) {
      if (lam[h] <= 0) continue;
      if (hastaMinuto && fecha === hastaMinuto.fecha && (h + 1) * 60 > hastaMinuto.minuto) continue;
      const lambda = lam[h] * ruidoDia;
      let c = personasRequeridas(lambda, ahtMedio, 0.8, 300, o.capacidad);
      if (rng() < 0.18) c = Math.max(1, c - 1);
      const sl = nivelServicio(c, lambda, ahtMedio, 300);
      const w = esperaPromedio(c, lambda, ahtMedio);
      const espera = Math.min(2400, (Number.isFinite(w) ? w : 2400) * (0.75 + rng() * 0.5) + 25);
      const pAband = Math.min(0.25, espera / (espera + 2600));
      operacion.push({ fecha, hora: h, operadores: c, terminales: c });

      for (const s of servicios) {
        for (const fila of ["GENERAL", "PREFERENCIAL"] as const) {
          const parte = s.parte * (fila === "PREFERENCIAL" ? PARTE_PREFERENCIAL : 1 - PARTE_PREFERENCIAL);
          const llegadas = poisson(rng, lambda * parte);
          if (!llegadas) continue;
          let abandonados = 0;
          let cancelados = 0;
          for (let i = 0; i < llegadas; i++) {
            const u = rng();
            if (u < pAband) abandonados++;
            else if (u < pAband + 0.008) cancelados++;
          }
          const atendidos = llegadas - abandonados - cancelados;
          const aht = fila === "PREFERENCIAL" ? s.ahtPreferencial : s.ahtGeneral;
          const esperaFila = fila === "PREFERENCIAL" ? espera * 0.55 : espera;
          filas.push({
            fecha,
            hora: h,
            fila,
            servicio: s.servicio,
            llegadas,
            atendidos,
            abandonados,
            cancelados,
            sumaEsperaSeg: Math.round(atendidos * esperaFila),
            sumaAtencionSeg: Math.round(atendidos * aht * (0.9 + rng() * 0.2)),
            atencionesConTiempo: atendidos,
            enObjetivo: Math.min(atendidos, Math.round(atendidos * Math.min(1, sl * (0.95 + rng() * 0.08) + (fila === "PREFERENCIAL" ? 0.08 : 0)))),
          });
        }
      }
    }
  }
  return { filas, operacion };
}
