// Construye el perfil de demanda que consume el motor a partir de filas agregadas del histórico.
// Esta función es la frontera con Digiturno: da igual si las filas vienen del export real o del generador sintético.

import { diaSemana } from "../fechas";
import type { PerfilDemanda, ServicioDemanda } from "../engine/tipos";

export interface FilaDemanda {
  fecha: string; // YYYY-MM-DD
  hora: number;
  fila: "GENERAL" | "PREFERENCIAL";
  servicio: string;
  llegadas: number;
  atendidos: number;
  abandonados: number;
  sumaEsperaSeg: number;
  sumaAtencionSeg: number;
  atencionesConTiempo: number;
}

export function construirPerfil(oficinaId: string, filas: FilaDemanda[], semanasHistorico: number): PerfilDemanda {
  const lambdaSum = Array.from({ length: 7 }, () => new Array(24).fill(0));
  const diasPorDow = Array.from({ length: 7 }, () => new Set<string>());
  let atGen = 0, nGen = 0, atPref = 0, nPref = 0, llegPref = 0, llegTot = 0, espera = 0, atendidos = 0, aband = 0;
  const porServicio = new Map<string, { llegadas: number; atG: number; nG: number; atP: number; nP: number }>();

  for (const f of filas) {
    const dow = diaSemana(f.fecha);
    lambdaSum[dow][f.hora] += f.llegadas;
    diasPorDow[dow].add(f.fecha);
    llegTot += f.llegadas;
    atendidos += f.atendidos;
    aband += f.abandonados;
    espera += f.sumaEsperaSeg;
    const s = porServicio.get(f.servicio) ?? { llegadas: 0, atG: 0, nG: 0, atP: 0, nP: 0 };
    s.llegadas += f.llegadas;
    if (f.fila === "PREFERENCIAL") {
      llegPref += f.llegadas;
      atPref += f.sumaAtencionSeg;
      nPref += f.atencionesConTiempo;
      s.atP += f.sumaAtencionSeg;
      s.nP += f.atencionesConTiempo;
    } else {
      atGen += f.sumaAtencionSeg;
      nGen += f.atencionesConTiempo;
      s.atG += f.sumaAtencionSeg;
      s.nG += f.atencionesConTiempo;
    }
    porServicio.set(f.servicio, s);
  }

  const lambda = lambdaSum.map((horas, dow) => {
    const n = Math.max(1, diasPorDow[dow].size);
    return horas.map((v) => v / n);
  });
  const ahtGeneralSeg = nGen ? atGen / nGen : 360;
  const ahtPreferencialSeg = nPref ? atPref / nPref : ahtGeneralSeg * 1.2;
  const partePreferencial = llegTot ? llegPref / llegTot : 0.14;
  const ahtSeg = (1 - partePreferencial) * ahtGeneralSeg + partePreferencial * ahtPreferencialSeg;

  // Paciencia estimada (modelo exponencial): abandonos / (espera total de quienes esperaron)
  const esperaProm = atendidos ? espera / atendidos : 0;
  const tasaAband = llegTot ? aband / llegTot : 0.04;
  const pacienciaSeg = tasaAband > 0.001 && esperaProm > 0 ? Math.min(7200, Math.max(600, esperaProm / tasaAband)) : 2400;

  const servicios: ServicioDemanda[] = [...porServicio.entries()]
    .map(([servicio, s]) => ({
      servicio,
      ahtGeneralSeg: s.nG ? s.atG / s.nG : ahtGeneralSeg,
      ahtPreferencialSeg: s.nP ? s.atP / s.nP : ahtPreferencialSeg,
      parte: llegTot ? s.llegadas / llegTot : 0,
    }))
    .sort((a, b) => b.parte - a.parte);

  const semanas = Math.max(1, Math.min(semanasHistorico, Math.ceil(new Set(filas.map((f) => f.fecha)).size / 6)));
  return {
    oficinaId,
    lambda,
    ahtSeg,
    ahtGeneralSeg,
    ahtPreferencialSeg,
    partePreferencial,
    pacienciaSeg,
    servicios,
    semanasHistorico: semanas,
    turnosPorSemana: llegTot / semanas,
  };
}
