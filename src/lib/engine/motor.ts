// Motor de asignación basado en teoría de colas (Erlang C) y simulación de eventos discretos.
// Implementa AssignmentEngine (ERS 4.4). Las estrategias de construcción de malla se pueden extender
// sin modificar el motor (principio abierto/cerrado).

import { DIAS_CORTOS, diaSemana, diasDeSemana, fmtHora, sumarDias } from "../fechas";
import { hashTexto } from "./aleatorio";
import { MAX_MINUTOS_PRESENCIAL, minutosEntre } from "./distancias";
import { esperaPromedio, nivelServicio } from "./erlang";
import {
  coberturaPorHora,
  horarioDelDia,
  horasDelDia,
  horasTrabajadas,
  lambdaDe,
  metricasDia,
  requeridasDelDia,
} from "./oficinas";
import { EstadoPlan } from "./plan";
import { simularReplicas } from "./simulacion";
import type {
  AlternativaMalla,
  AssignmentEngine,
  CandidatoCobertura,
  CoberturaPropuesta,
  DiaISO,
  EntradaApoyos,
  EntradaCobertura,
  EntradaMotor,
  FranjaCorta,
  FranjaResultado,
  KpisMalla,
  OficinaMotor,
  ParametrosMotor,
  PerfilDemanda,
  PersonaMotor,
  ResultadoCobertura,
  ResultadoPropuesta,
  SugerenciaApoyo,
  TurnoMotor,
} from "./tipos";

/** Una estrategia decide cuántas personas pide cada franja y qué plantillas de turno usa. */
export interface EstrategiaMalla {
  id: "A" | "B";
  nombre: string;
  descripcion: string;
  objetivo(par: ParametrosMotor): number;
}

export const ESTRATEGIA_COBERTURA: EstrategiaMalla = {
  id: "A",
  nombre: "Malla A",
  descripcion: "Cubre el nivel de servicio objetivo en cada franja",
  objetivo: (par) => par.servicioObjetivo,
};

export const ESTRATEGIA_MINIMO: EstrategiaMalla = {
  id: "B",
  nombre: "Malla B",
  descripcion: "Usa el mínimo de turnos aceptando más espera",
  objetivo: (par) => Math.max(0.5, par.servicioObjetivo - 0.08),
};

interface Plantilla {
  inicio: number;
  fin: number;
}

function plantillas(o: OficinaMotor, fecha: DiaISO, soloMediaJornada = false): Plantilla[] {
  const h = horarioDelDia(o, fecha);
  if (!h) return [];
  const dur = h.cierre - h.apertura;
  const out: Plantilla[] = [];
  if (dur <= 5) return [{ inicio: h.apertura * 60, fin: h.cierre * 60 }];
  if (dur >= 8 && !soloMediaJornada) out.push({ inicio: h.apertura * 60, fin: h.cierre * 60 });
  for (let s = h.apertura; s <= h.cierre - 4; s++) out.push({ inicio: s * 60, fin: (s + 5) * 60 });
  return out;
}

function horasCubiertas(p: Plantilla, horas: number[], deficit: number[]): number {
  let n = 0;
  for (const h of horas) if (deficit[h] > 0 && p.inicio <= h * 60 && p.fin >= (h + 1) * 60) n++;
  return n;
}

function ordenDias(semana: DiaISO[]): DiaISO[] {
  // el sábado primero: es media jornada y así no se queda sin gente por el tope semanal
  const sab = semana.filter((d) => diaSemana(d) === 6);
  return [...sab, ...semana.filter((d) => diaSemana(d) !== 6 && diaSemana(d) !== 0)];
}

function elegirPersona(
  candidatas: PersonaMotor[],
  plan: EstadoPlan,
  fecha: DiaISO,
  p: Plantilla,
): PersonaMotor | null {
  let mejor: PersonaMotor | null = null;
  let mejorRatio = Infinity;
  for (const c of candidatas) {
    if (!plan.puedeTomar(c, fecha, p.inicio, p.fin)) continue;
    const ratio = plan.horasDe(c.id) / Math.max(1, plan.topeHoras(c));
    if (ratio < mejorRatio - 1e-9 || (Math.abs(ratio - mejorRatio) < 1e-9 && mejor && c.nombre < mejor.nombre)) {
      mejor = c;
      mejorRatio = ratio;
    }
  }
  return mejor;
}

export class ColasSimulacionEngine implements AssignmentEngine {
  readonly nombre = "Erlang C + simulación de eventos discretos";

  constructor(private readonly estrategias: EstrategiaMalla[] = [ESTRATEGIA_COBERTURA, ESTRATEGIA_MINIMO]) {}

  // ---------------------------------------------------------------- RF-04: propuesta semanal
  proponerSemana(e: EntradaMotor): ResultadoPropuesta {
    const alternativas = this.estrategias.map((est) => this.construir(e, est));
    // Se elige la malla que cumple el objetivo en más franjas; a igualdad, la que usa menos horas.
    const objetivo = e.parametros.servicioObjetivo;
    const elegida = [...alternativas].sort(
      (a, b) =>
        Number(b.kpis.nivelServicio >= objetivo) - Number(a.kpis.nivelServicio >= objetivo) ||
        a.franjasCortas.length - b.franjasCortas.length ||
        a.kpis.horas - b.kpis.horas,
    )[0].id;
    return { semanaInicio: e.semanaInicio, alternativas, elegida, generadoEn: new Date().toISOString() };
  }

  private construir(e: EntradaMotor, est: EstrategiaMalla): AlternativaMalla {
    const par = e.parametros;
    const semana = diasDeSemana(e.semanaInicio);
    const fijos = par.respetarAjustesManuales ? e.turnosFijos : [];
    const plan = new EstadoPlan(e.personas, e.ausencias, par, fijos.map((t) => ({ ...t })));
    const objetivo = est.objetivo(par);
    const deficits: Record<string, Record<DiaISO, number[]>> = {};

    // Paso 1: cada oficina con su propio personal.
    for (const o of e.oficinas) {
      const perfil = e.demanda[o.id];
      const equipo = e.personas.filter((p) => p.oficinaId === o.id);
      deficits[o.id] = {};
      for (const fecha of ordenDias(semana)) {
        const horas = horasDelDia(o, fecha);
        if (!horas.length) continue;
        const req = requeridasDelDia(o, perfil, fecha, objetivo, par);
        const cov = coberturaPorHora(plan.turnos, o.id, fecha);
        const deficit = req.map((r, h) => r - cov[h]);
        const opciones = plantillas(o, fecha);
        for (let guarda = 0; guarda < 60; guarda++) {
          if (!horas.some((h) => deficit[h] > 0)) break;
          const ordenadas = opciones
            .map((p) => ({ p, cubre: horasCubiertas(p, horas, deficit) }))
            .filter((x) => x.cubre > 0)
            .sort(
              (a, b) =>
                b.cubre / horasTrabajadas(b.p.inicio, b.p.fin) - a.cubre / horasTrabajadas(a.p.inicio, a.p.fin) ||
                b.cubre - a.cubre ||
                a.p.inicio - b.p.inicio,
            );
          let asignado = false;
          for (const { p } of ordenadas) {
            const persona = elegirPersona(equipo, plan, fecha, p);
            if (!persona) continue;
            plan.agregar({ usuarioId: persona.id, oficinaId: o.id, fecha, inicio: p.inicio, fin: p.fin, tipo: "MOTOR", virtual: false });
            for (const h of horas) if (p.inicio <= h * 60 && p.fin >= (h + 1) * 60) deficit[h]--;
            asignado = true;
            break;
          }
          if (!asignado) break;
        }
        deficits[o.id][fecha] = deficit;
      }
    }

    // Paso 2: apoyos entre oficinas (presencial cercano o virtual) para lo que quedó corto.
    for (const o of e.oficinas) {
      for (const fecha of semana) {
        const deficit = deficits[o.id]?.[fecha];
        if (!deficit) continue;
        const horas = horasDelDia(o, fecha);
        for (let guarda = 0; guarda < 10 && horas.some((h) => deficit[h] > 0); guarda++) {
          const opciones = plantillas(o, fecha, true)
            .map((p) => ({ p, cubre: horasCubiertas(p, horas, deficit) }))
            .filter((x) => x.cubre > 0)
            .sort((a, b) => b.cubre - a.cubre || a.p.inicio - b.p.inicio);
          const donante = this.buscarDonante(e, plan, o, fecha, opciones.map((x) => x.p));
          if (!donante) break;
          const { persona, plantilla, modalidad, origen } = donante;
          plan.agregar({
            usuarioId: persona.id,
            oficinaId: o.id,
            fecha,
            inicio: plantilla.inicio,
            fin: plantilla.fin,
            tipo: "APOYO",
            virtual: modalidad === "VIRTUAL",
            nota: modalidad === "VIRTUAL" ? `Virtual desde ${origen.nombre}` : `Desde ${origen.nombre}`,
          });
          for (const h of horas) if (plantilla.inicio <= h * 60 && plantilla.fin >= (h + 1) * 60) deficit[h]--;
        }
      }
    }

    return this.evaluar(e, est, plan.turnos);
  }

  private buscarDonante(e: EntradaMotor, plan: EstadoPlan, destino: OficinaMotor, fecha: DiaISO, opciones: Plantilla[]) {
    const par = e.parametros;
    const candidatos: { persona: PersonaMotor; plantilla: Plantilla; modalidad: "PRESENCIAL" | "VIRTUAL"; origen: OficinaMotor; costo: number }[] = [];
    for (const origen of e.oficinas) {
      if (origen.id === destino.id) continue;
      const mismaCiudad = origen.ciudad === destino.ciudad;
      if (!mismaCiudad && !par.permitirApoyosEntreCiudades) continue;
      const min = minutosEntre(origen.ciudad, destino.ciudad);
      const presencial = min !== null && min <= MAX_MINUTOS_PRESENCIAL;
      const virtual = origen.atencionVirtual && destino.atencionVirtual;
      if (!presencial && !virtual) continue;
      for (const persona of e.personas.filter((p) => p.oficinaId === origen.id)) {
        for (const p of opciones) {
          if (!plan.puedeTomar(persona, fecha, p.inicio, p.fin)) continue;
          candidatos.push({
            persona,
            plantilla: p,
            modalidad: presencial ? "PRESENCIAL" : "VIRTUAL",
            origen,
            costo: (presencial ? (min ?? 0) : 200) + plan.horasDe(persona.id),
          });
          break;
        }
      }
    }
    candidatos.sort((a, b) => a.costo - b.costo);
    return candidatos[0] ?? null;
  }

  /** Evalúa una malla: Erlang C por franja y simulación de eventos discretos por día. */
  evaluar(e: EntradaMotor, est: EstrategiaMalla, turnos: TurnoMotor[]): AlternativaMalla {
    const par = e.parametros;
    const semana = diasDeSemana(e.semanaInicio);
    const franjas: AlternativaMalla["franjas"] = {};
    const franjasCortas: FranjaCorta[] = [];
    const kpisPorOficina: Record<string, KpisMalla> = {};
    const total = { llegadas: 0, atendidos: 0, aband: 0, enObj: 0, espera: 0 };

    for (const o of e.oficinas) {
      const perfil = e.demanda[o.id];
      const aht = perfil?.ahtSeg ?? 360;
      franjas[o.id] = {};
      const acc = { llegadas: 0, atendidos: 0, aband: 0, enObj: 0, espera: 0 };
      for (const fecha of semana) {
        const horas = horasDelDia(o, fecha);
        if (!horas.length) continue;
        const req = requeridasDelDia(o, perfil, fecha, par.servicioObjetivo, par);
        const cov = coberturaPorHora(turnos, o.id, fecha);
        franjas[o.id][fecha] = horas.map((h): FranjaResultado => {
          const l = lambdaDe(perfil, fecha, h);
          const w = esperaPromedio(cov[h], l, aht);
          if (cov[h] < req[h])
            franjasCortas.push({ oficinaId: o.id, fecha, hora: h, faltan: req[h] - cov[h], llegadas: l, asignadas: cov[h], esperaSeg: Number.isFinite(w) ? w : 3600 });
          return {
            hora: h,
            llegadas: Math.round(l * 10) / 10,
            requeridas: req[h],
            asignadas: cov[h],
            nivelServicio: nivelServicio(cov[h], l, aht, par.tiempoObjetivoSeg),
            esperaSeg: Number.isFinite(w) ? Math.round(w) : 3600,
          };
        });
        if (!perfil) continue;
        const hor = horarioDelDia(o, fecha)!;
        const sim = simularReplicas(
          {
            horaApertura: hor.apertura,
            horaCierre: hor.cierre,
            llegadasPorHora: perfil.lambda[diaSemana(fecha)],
            personasPorHora: cov,
            partePreferencial: perfil.partePreferencial,
            ahtGeneralSeg: perfil.ahtGeneralSeg,
            ahtPreferencialSeg: perfil.ahtPreferencialSeg,
            pacienciaSeg: perfil.pacienciaSeg,
            tObjetivoSeg: par.tiempoObjetivoSeg,
            prioridadPreferencial: par.prioridadPreferencial,
          },
          par.replicas,
          (par.semilla ^ hashTexto(o.id + fecha)) >>> 0,
        );
        acc.llegadas += sim.llegadas;
        acc.atendidos += sim.atendidos;
        acc.aband += sim.abandonados;
        acc.enObj += sim.enObjetivo;
        acc.espera += sim.esperaTotalSeg;
      }
      const delOficina = turnos.filter((t) => t.oficinaId === o.id);
      kpisPorOficina[o.id] = {
        nivelServicio: acc.atendidos ? acc.enObj / acc.atendidos : 1,
        esperaPromSeg: acc.atendidos ? acc.espera / acc.atendidos : 0,
        abandono: acc.llegadas ? acc.aband / acc.llegadas : 0,
        turnos: delOficina.length,
        personas: new Set(delOficina.map((t) => t.usuarioId)).size,
        horas: delOficina.reduce((s, t) => s + horasTrabajadas(t.inicio, t.fin), 0),
      };
      total.llegadas += acc.llegadas;
      total.atendidos += acc.atendidos;
      total.aband += acc.aband;
      total.enObj += acc.enObj;
      total.espera += acc.espera;
    }

    return {
      id: est.id,
      nombre: est.nombre,
      estrategia: est.descripcion,
      turnos,
      kpis: {
        nivelServicio: total.atendidos ? total.enObj / total.atendidos : 1,
        esperaPromSeg: total.atendidos ? total.espera / total.atendidos : 0,
        abandono: total.llegadas ? total.aband / total.llegadas : 0,
        turnos: turnos.length,
        personas: new Set(turnos.map((t) => t.usuarioId)).size,
        horas: turnos.reduce((s, t) => s + horasTrabajadas(t.inicio, t.fin), 0),
      },
      franjas,
      franjasCortas: franjasCortas.sort((a, b) => b.faltan - a.faltan || a.fecha.localeCompare(b.fecha) || a.hora - b.hora),
      kpisPorOficina,
    };
  }

  // ---------------------------------------------------------------- RF-06: recálculo por ausencia
  /**
   * Cubre un turno liberado por tramos cuando nadie puede tomarlo completo. En cada paso elige a quien cubre
   * el tramo más largo del hueco que queda: una persona sin turno ese día o alguien cuyo turno queda pegado al
   * hueco y puede alargarlo sin pasar de 8 h en el día. Respeta el tope semanal y el descanso de 12 h.
   */
  private cubrirPorPartes(e: EntradaCobertura, plan: EstadoPlan, lib: CoberturaPropuesta["liberado"]): CoberturaPropuesta[] {
    const par = e.parametros;
    const oficina = (id: string) => e.oficinas.find((o) => o.id === id);
    const destino = oficina(lib.oficinaId)!;
    const MIN_TRAMO = 60;
    const MAX_HORAS_DIA = 8;
    const huecos: [number, number][] = [[lib.inicio, lib.fin]];
    const resultado: CoberturaPropuesta[] = [];

    for (let vuelta = 0; vuelta < 12 && huecos.length; vuelta++) {
      type Tramo = { hueco: number; inicio: number; fin: number; persona: PersonaMotor; modalidad: CandidatoCobertura["modalidad"]; min: number | null; extiende: string | null; costo: number };
      let mejor: Tramo | null = null as Tramo | null;
      for (const persona of e.personas) {
        if (persona.id === lib.usuarioId) continue;
        const origen = oficina(persona.oficinaId);
        if (!origen) continue;
        const misma = persona.oficinaId === lib.oficinaId;
        const min = misma ? 0 : minutosEntre(origen.ciudad, destino.ciudad);
        const presencial = misma || (min !== null && min <= MAX_MINUTOS_PRESENCIAL && (origen.ciudad === destino.ciudad || par.permitirApoyosEntreCiudades));
        const virtual = !misma && origen.atencionVirtual && destino.atencionVirtual && (origen.ciudad === destino.ciudad || par.permitirApoyosEntreCiudades);
        if (!presencial && !virtual) continue;
        const modalidad: CandidatoCobertura["modalidad"] = misma ? "MISMA_OFICINA" : presencial ? "PRESENCIAL" : "VIRTUAL";
        const base = (misma ? 0 : modalidad === "PRESENCIAL" ? 100 + (min ?? 0) : 300) + plan.horasDe(persona.id);
        const suyos = plan.turnosDe(persona.id, lib.fecha);

        huecos.forEach(([a, b], i) => {
          const opciones: { inicio: number; fin: number; extiende: string | null }[] = [];
          if (suyos.length === 0) {
            for (let fin = b; fin - a >= MIN_TRAMO; fin -= 30) if (plan.puedeTomar(persona, lib.fecha, a, fin)) { opciones.push({ inicio: a, fin, extiende: null }); break; }
            for (let ini = a + 30; b - ini >= MIN_TRAMO; ini += 30) if (plan.puedeTomar(persona, lib.fecha, ini, b)) { opciones.push({ inicio: ini, fin: b, extiende: null }); break; }
          } else if (suyos.length === 1 && persona.oficinaId === lib.oficinaId) {
            // alargar el turno propio solo en la misma oficina (no tiene sentido viajar a mitad de jornada)
            const t = suyos[0];
            if (t.fin >= a && t.fin < b)
              for (let fin = b; fin - t.fin >= MIN_TRAMO; fin -= 30)
                if (horasTrabajadas(t.inicio, fin) <= MAX_HORAS_DIA && plan.puedeTomar(persona, lib.fecha, t.fin, fin, true)) { opciones.push({ inicio: t.fin, fin, extiende: `${fmtHora(t.inicio)} a ${fmtHora(t.fin)}` }); break; }
            if (t.inicio <= b && t.inicio > a)
              for (let ini = a; t.inicio - ini >= MIN_TRAMO; ini += 30)
                if (horasTrabajadas(ini, t.fin) <= MAX_HORAS_DIA && plan.puedeTomar(persona, lib.fecha, ini, t.inicio, true)) { opciones.push({ inicio: ini, fin: t.inicio, extiende: `${fmtHora(t.inicio)} a ${fmtHora(t.fin)}` }); break; }
          }
          for (const o of opciones) {
            const largo = o.fin - o.inicio;
            const costo = base + (o.extiende ? -5 : 0);
            const actual = mejor as Tramo | null;
            if (!actual || largo > actual.fin - actual.inicio || (largo === actual.fin - actual.inicio && costo < actual.costo))
              mejor = { hueco: i, inicio: o.inicio, fin: o.fin, persona, modalidad, min, extiende: o.extiende, costo };
          }
        });
      }
      const m = mejor as Tramo | null;
      if (!m) break;
      const horasAntes = plan.horasDe(m.persona.id);
      const horasDespues = horasAntes + horasTrabajadas(m.inicio, m.fin);
      plan.agregar({ usuarioId: m.persona.id, oficinaId: lib.oficinaId, fecha: lib.fecha, inicio: m.inicio, fin: m.fin, tipo: "COBERTURA", virtual: m.modalidad === "VIRTUAL", cubreA: lib.nombre });
      const origen = oficina(m.persona.oficinaId)!;
      const tramo = `${fmtHora(m.inicio)} a ${fmtHora(m.fin)}`;
      const razon = m.extiende
        ? `Alarga su turno de ${m.extiende} para cubrir de ${tramo} · pasa de ${fmtH(horasAntes)} a ${fmtH(horasDespues)} h`
        : m.modalidad === "MISMA_OFICINA"
          ? `Misma oficina, cubre de ${tramo} · pasa de ${fmtH(horasAntes)} a ${fmtH(horasDespues)} h`
          : m.modalidad === "PRESENCIAL"
            ? `Viene desde ${origen.nombre}${m.min ? ` (a ${m.min} min)` : ""}, cubre de ${tramo} · pasa de ${fmtH(horasAntes)} a ${fmtH(horasDespues)} h`
            : `Atención virtual desde ${origen.nombre}, cubre de ${tramo} · pasa de ${fmtH(horasAntes)} a ${fmtH(horasDespues)} h`;
      resultado.push({
        liberado: { ...lib, inicio: m.inicio, fin: m.fin },
        candidato: { usuarioId: m.persona.id, nombre: m.persona.nombre, oficinaOrigenId: m.persona.oficinaId, modalidad: m.modalidad, minutosViaje: m.min || undefined, horasAntes, horasDespues, razon },
      });
      const [a, b] = huecos[m.hueco];
      huecos.splice(m.hueco, 1, ...([[a, m.inicio], [m.fin, b]] as [number, number][]).filter(([x, y]) => y - x > 0));
    }
    for (const [a, b] of huecos) resultado.push({ liberado: { ...lib, inicio: a, fin: b }, candidato: null });
    return resultado.sort((x, y) => x.liberado.inicio - y.liberado.inicio);
  }

  cubrirAusencia(e: EntradaCobertura): ResultadoCobertura {
    const par = e.parametros;
    const idsLiberados = new Set(e.liberados.map((l) => l.turnoId));
    const base = e.turnosSemana.filter((t) => !t.id || !idsLiberados.has(t.id));
    const plan = new EstadoPlan(e.personas, e.ausencias, par, base.map((t) => ({ ...t })));
    const oficina = (id: string) => e.oficinas.find((o) => o.id === id)!;
    const coberturas: CoberturaPropuesta[] = [];
    const alternativasTexto: string[] = [];

    for (const lib of [...e.liberados].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.inicio - b.inicio)) {
      const destino = oficina(lib.oficinaId);
      const opciones: (CandidatoCobertura & { costo: number })[] = [];

      for (const persona of e.personas) {
        if (persona.id === lib.usuarioId) continue;
        const origen = oficina(persona.oficinaId);
        if (!origen) continue;
        const misma = persona.oficinaId === lib.oficinaId;
        const min = misma ? 0 : minutosEntre(origen.ciudad, destino.ciudad);
        const presencial = misma || (min !== null && min <= MAX_MINUTOS_PRESENCIAL && (origen.ciudad === destino.ciudad || par.permitirApoyosEntreCiudades));
        const virtual = !misma && origen.atencionVirtual && destino.atencionVirtual && (origen.ciudad === destino.ciudad || par.permitirApoyosEntreCiudades);
        if (!presencial && !virtual) continue;
        const modalidad = misma ? "MISMA_OFICINA" : presencial ? "PRESENCIAL" : "VIRTUAL";
        const horasAntes = plan.horasDe(persona.id);
        const usoOrigen = misma ? undefined : this.usoBloque(e, origen, lib.fecha, lib.inicio, lib.fin, plan.turnos);

        if (plan.puedeTomar(persona, lib.fecha, lib.inicio, lib.fin)) {
          const horasDespues = horasAntes + horasTrabajadas(lib.inicio, lib.fin);
          opciones.push({
            usuarioId: persona.id,
            nombre: persona.nombre,
            oficinaOrigenId: persona.oficinaId,
            modalidad,
            minutosViaje: misma ? undefined : (min ?? undefined),
            horasAntes,
            horasDespues,
            usoOrigen,
            razon: misma
              ? `Misma oficina · pasa de ${fmtH(horasAntes)} a ${fmtH(horasDespues)} h`
              : modalidad === "PRESENCIAL"
                ? `Viene desde ${origen.nombre}, ${min ? `a ${min} min` : "en la misma ciudad"} · pasa de ${fmtH(horasAntes)} a ${fmtH(horasDespues)} h`
                : `Atención virtual desde ${origen.nombre} · pasa de ${fmtH(horasAntes)} a ${fmtH(horasDespues)} h`,
            costo: (misma ? 0 : modalidad === "PRESENCIAL" ? 100 + (min ?? 0) : 300) + (usoOrigen ?? 0) * 100 + horasAntes,
          });
          continue;
        }
        // Traslado: una persona que ya trabaja ese bloque en una oficina con capacidad de sobra.
        if (misma) continue;
        const suyo = plan
          .turnosDe(persona.id, lib.fecha)
          .find((t) => t.oficinaId === persona.oficinaId && t.inicio <= lib.inicio && t.fin >= lib.fin && t.tipo === "MOTOR");
        if (!suyo) continue;
        if (!this.puedeCeder(e, origen, lib.fecha, lib.inicio, lib.fin, plan.turnos)) continue;
        opciones.push({
          usuarioId: persona.id,
          nombre: persona.nombre,
          oficinaOrigenId: persona.oficinaId,
          modalidad,
          trasladaTurnoId: suyo.id,
          minutosViaje: min ?? undefined,
          horasAntes,
          horasDespues: horasAntes,
          usoOrigen,
          razon:
            modalidad === "PRESENCIAL"
              ? `Viene desde ${origen.nombre}, ${min ? `a ${min} min` : "en la misma ciudad"} · mantiene sus ${fmtH(horasAntes)} h`
              : `Atención virtual desde ${origen.nombre} · mantiene sus ${fmtH(horasAntes)} h`,
          costo: (modalidad === "PRESENCIAL" ? 150 + (min ?? 0) : 320) + (usoOrigen ?? 0) * 100,
        });
      }

      opciones.sort((a, b) => a.costo - b.costo);
      const elegido = opciones[0] ?? null;
      if (elegido) {
        if (elegido.trasladaTurnoId) {
          const t = plan.turnos.find((x) => x.id === elegido.trasladaTurnoId);
          if (t) plan.quitar(t);
          if (t && t.inicio < lib.inicio) plan.agregar({ ...t, id: undefined, fin: lib.inicio });
          if (t && t.fin > lib.fin) plan.agregar({ ...t, id: undefined, inicio: lib.fin });
        }
        plan.agregar({
          usuarioId: elegido.usuarioId,
          oficinaId: lib.oficinaId,
          fecha: lib.fecha,
          inicio: lib.inicio,
          fin: lib.fin,
          tipo: "COBERTURA",
          virtual: elegido.modalidad === "VIRTUAL",
          cubreA: lib.nombre,
        });
        if (elegido.modalidad !== "MISMA_OFICINA") {
          const origen = oficina(elegido.oficinaOrigenId);
          const nombreCorto = elegido.nombre.split(" ")[0];
          const segunda = opciones.find((o) => o.modalidad !== elegido.modalidad && o.usuarioId !== elegido.usuarioId);
          let texto = `Se eligió a ${nombreCorto} porque ${origen.nombre} está al ${Math.round((elegido.usoOrigen ?? 0) * 100)}% de uso el ${DIAS_LARGOS_MIN[diaSemana(lib.fecha)]} ${lib.fin <= 13 * 60 ? "en la mañana" : lib.inicio >= 12 * 60 ? "en la tarde" : "en ese horario"}.`;
          if (segunda) {
            const o2 = oficina(segunda.oficinaOrigenId);
            texto += segunda.modalidad === "VIRTUAL" ? ` Otra opción es atención virtual desde ${o2.nombre}.` : ` Otra opción es ${segunda.nombre.split(" ")[0]} desde ${o2.nombre}.`;
          }
          alternativasTexto.push(texto);
        }
      }
      if (!elegido) {
        // Nadie puede tomar el bloque completo: se reparte por tramos (otra persona libre o alguien que alarga su turno).
        coberturas.push(...this.cubrirPorPartes(e, plan, lib));
        continue;
      }
      const { costo: _c, ...cand } = elegido;
      void _c;
      coberturas.push({ liberado: lib, candidato: cand as CandidatoCobertura });
    }

    // Impacto en el nivel de servicio de cada día afectado.
    const dias = new Map<string, { oficinaId: string; fecha: DiaISO }>();
    for (const l of e.liberados) dias.set(`${l.oficinaId}|${l.fecha}`, { oficinaId: l.oficinaId, fecha: l.fecha });
    const impacto = [...dias.values()].map(({ oficinaId, fecha }) => {
      const o = oficina(oficinaId);
      const perfil = e.demanda[oficinaId];
      const sin = metricasDia(o, perfil, fecha, coberturaPorHora(base, oficinaId, fecha), par);
      const con = metricasDia(o, perfil, fecha, coberturaPorHora(plan.turnos, oficinaId, fecha), par);
      return { fecha, oficinaId, servicioSin: sin.nivelServicio, esperaSin: sin.esperaSeg, servicioCon: con.nivelServicio, esperaCon: con.esperaSeg };
    });

    const v = plan.verificar();
    const manualesIntactos = e.turnosSemana
      .filter((t) => t.tipo === "MANUAL")
      .every((t) => plan.turnos.some((x) => x.id === t.id && x.inicio === t.inicio && x.fin === t.fin && x.oficinaId === t.oficinaId));
    return {
      coberturas,
      impacto,
      verificaciones: [
        { texto: `Nadie pasa de ${par.maxHorasSemana} h semanales`, ok: v.maxHoras },
        { texto: `${par.descansoMinHoras} h de descanso entre turnos`, ok: v.descanso },
        { texto: "Sin choques de horario", ok: v.sinChoques },
        { texto: "Ajustes manuales intactos", ok: manualesIntactos },
      ],
      explicacion: alternativasTexto[0] ?? (coberturas.every((c) => c.candidato?.modalidad === "MISMA_OFICINA")
        ? "Se eligió personal de la misma oficina con horas disponibles en la semana."
        : coberturas.some((c) => !c.candidato)
          ? "No hay nadie disponible para cubrir todos los turnos sin romper las reglas laborales. Ajusta a mano o revisa los apoyos entre oficinas."
          : ""),
    };
  }

  private usoBloque(e: { demanda: Record<string, PerfilDemanda>; parametros: ParametrosMotor }, o: OficinaMotor, fecha: DiaISO, inicio: number, fin: number, turnos: TurnoMotor[]) {
    const horas = horasDelDia(o, fecha).filter((h) => h * 60 >= inicio && (h + 1) * 60 <= fin);
    if (!horas.length) return 0;
    return metricasDia(o, e.demanda[o.id], fecha, coberturaPorHora(turnos, o.id, fecha), e.parametros, horas).uso;
  }

  /** ¿La oficina sigue cumpliendo el objetivo si pierde una persona en el bloque? */
  private puedeCeder(e: { demanda: Record<string, PerfilDemanda>; parametros: ParametrosMotor }, o: OficinaMotor, fecha: DiaISO, inicio: number, fin: number, turnos: TurnoMotor[]) {
    const perfil = e.demanda[o.id];
    const cov = coberturaPorHora(turnos, o.id, fecha);
    const horas = horasDelDia(o, fecha).filter((h) => h * 60 >= inicio && (h + 1) * 60 <= fin);
    if (!horas.length) return false;
    return horas.every((h) => {
      const c = cov[h] - 1;
      if (c < 1) return false;
      const l = lambdaDe(perfil, fecha, h);
      return nivelServicio(c, l, perfil?.ahtSeg ?? 360, e.parametros.tiempoObjetivoSeg) >= e.parametros.servicioObjetivo;
    });
  }

  // ---------------------------------------------------------------- RF-14: redistribución
  sugerirApoyos(e: EntradaApoyos): SugerenciaApoyo[] {
    const par = e.parametros;
    const out: SugerenciaApoyo[] = [];
    const usados = new Set<string>();
    const plan = new EstadoPlan(e.personas, e.ausencias, par, e.turnos.map((t) => ({ ...t })));

    for (const fecha of e.dias) {
      const hot: { o: OficinaMotor; horas: number[]; uso: number }[] = [];
      for (const o of e.oficinas) {
        const perfil = e.demanda[o.id];
        if (!perfil) continue;
        const cov = coberturaPorHora(plan.turnos, o.id, fecha);
        const horas = horasDelDia(o, fecha).filter((h) => e.desdeMinuto == null || (h + 1) * 60 > e.desdeMinuto);
        const calientes = horas.filter((h) => {
          const l = lambdaDe(perfil, fecha, h);
          const m = metricasDia(o, perfil, fecha, cov, par, [h]);
          return l > 0 && (m.uso > 0.95 || nivelServicio(cov[h], l, perfil.ahtSeg, par.tiempoObjetivoSeg) < par.servicioObjetivo);
        });
        if (!calientes.length) continue;
        // bloque contiguo más largo
        let mejor: number[] = [];
        let actual: number[] = [];
        for (const h of calientes) {
          if (actual.length && h !== actual[actual.length - 1] + 1) actual = [];
          actual.push(h);
          if (actual.length > mejor.length) mejor = [...actual];
        }
        const uso = metricasDia(o, perfil, fecha, cov, par, mejor).uso;
        hot.push({ o, horas: mejor, uso });
      }
      hot.sort((a, b) => b.uso - a.uso);

      for (const { o: destino, horas } of hot) {
        const inicio = horas[0] * 60;
        const fin = (horas[horas.length - 1] + 1) * 60;
        const perfilD = e.demanda[destino.id];
        const covD = coberturaPorHora(plan.turnos, destino.id, fecha);
        const usoHacia = metricasDia(destino, perfilD, fecha, covD, par, horas).uso;
        const esperaAntes = metricasDia(destino, perfilD, fecha, covD, par, horas).esperaSeg;
        const covMas = covD.map((c, h) => (horas.includes(h) ? c + 1 : c));
        const esperaDespues = metricasDia(destino, perfilD, fecha, covMas, par, horas).esperaSeg;

        let elegido: SugerenciaApoyo | null = null;
        let costoMin = Infinity;
        for (const origen of e.oficinas) {
          if (origen.id === destino.id) continue;
          if (origen.ciudad !== destino.ciudad && !par.permitirApoyosEntreCiudades) continue;
          const min = minutosEntre(origen.ciudad, destino.ciudad);
          const presencial = min !== null && min <= MAX_MINUTOS_PRESENCIAL;
          const virtual = origen.atencionVirtual && destino.atencionVirtual;
          if (!presencial && !virtual) continue;
          const usoDesde = this.usoBloque(e, origen, fecha, inicio, fin, plan.turnos);
          if (usoDesde >= 0.6) continue;
          for (const persona of e.personas.filter((p) => p.oficinaId === origen.id && !usados.has(`${p.id}|${fecha}`))) {
            const suyo = plan.turnosDe(persona.id, fecha).find((t) => t.oficinaId === origen.id && t.inicio < fin && inicio < t.fin);
            let bloqueIni = inicio;
            let bloqueFin = fin;
            if (suyo) {
              bloqueIni = Math.max(inicio, suyo.inicio);
              bloqueFin = Math.min(fin, suyo.fin);
              if (bloqueFin - bloqueIni < 60) continue;
              if (!this.puedeCeder(e, origen, fecha, bloqueIni, bloqueFin, plan.turnos)) continue;
            } else if (!plan.puedeTomar(persona, fecha, inicio, fin)) continue;
            // presencial requiere tiempo de traslado: solo bloques que empiecen después del viaje si es hoy
            const modalidad: "PRESENCIAL" | "VIRTUAL" = presencial ? "PRESENCIAL" : "VIRTUAL";
            const costo = usoDesde * 100 + (modalidad === "PRESENCIAL" ? (min ?? 0) : 90) - (bloqueFin - bloqueIni) / 30;
            if (costo < costoMin) {
              costoMin = costo;
              elegido = {
                usuarioId: persona.id,
                nombre: persona.nombre,
                turnoId: suyo?.id,
                fecha,
                inicio: bloqueIni,
                fin: bloqueFin,
                desdeOficinaId: origen.id,
                haciaOficinaId: destino.id,
                usoDesde,
                usoHacia,
                modalidad,
                minutosViaje: presencial ? (min ?? 0) : undefined,
                esperaAntesSeg: esperaAntes,
                esperaDespuesSeg: esperaDespues,
                razon:
                  modalidad === "VIRTUAL"
                    ? `Atiende turnos digitales de ${destino.nombre}`
                    : `Espera en ${destino.nombre.split(" ").slice(-1)[0]}: ${Math.round(esperaAntes / 60)} → ${Math.round(esperaDespues / 60)} min`,
              };
            }
          }
        }
        if (elegido) {
          out.push(elegido);
          usados.add(`${elegido.usuarioId}|${fecha}`);
          // reflejar el movimiento para las siguientes sugerencias
          plan.agregar({ usuarioId: elegido.usuarioId, oficinaId: destino.id, fecha, inicio: elegido.inicio, fin: elegido.fin, tipo: "APOYO", virtual: elegido.modalidad === "VIRTUAL" });
          const suyo = elegido.turnoId ? plan.turnos.find((t) => t.id === elegido!.turnoId) : undefined;
          if (suyo) plan.quitar(suyo);
        }
      }
    }
    return out.sort((a, b) => b.esperaAntesSeg - b.esperaDespuesSeg - (a.esperaAntesSeg - a.esperaDespuesSeg));
  }
}

const DIAS_LARGOS_MIN = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function fmtH(h: number) {
  return Number.isInteger(h) ? String(h) : h.toFixed(1).replace(".", ",");
}

export function describirFranja(fecha: DiaISO, hora: number) {
  return `${DIAS_CORTOS[diaSemana(fecha)]} ${hora}–${hora + 1} h`;
}

export function etiquetaHoras(inicio: number, fin: number) {
  return `${fmtHora(inicio)} – ${fmtHora(fin)}`;
}

export { sumarDias };
