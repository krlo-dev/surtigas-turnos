// Reglas de calendario de las oficinas y cálculos de cobertura por franja.

import { diaSemana } from "../fechas";
import { esperaPromedio, nivelServicio, ocupacion, personasRequeridas, personasRequeridasFraccion } from "./erlang";
import type { DiaISO, OficinaMotor, ParametrosMotor, PerfilDemanda, TurnoMotor } from "./tipos";

/** Horario de atención de una oficina en un día: [apertura, cierre) en horas, o null si cierra. */
export function horarioDelDia(o: OficinaMotor, fecha: DiaISO): { apertura: number; cierre: number } | null {
  const dow = diaSemana(fecha);
  if (dow === 0) return null;
  if (dow === 6) return o.abreSabado ? { apertura: o.horaApertura, cierre: o.horaCierreSabado } : null;
  return { apertura: o.horaApertura, cierre: o.horaCierre };
}

export function horasDelDia(o: OficinaMotor, fecha: DiaISO): number[] {
  const h = horarioDelDia(o, fecha);
  if (!h) return [];
  return Array.from({ length: h.cierre - h.apertura }, (_, i) => h.apertura + i);
}

/** Horas trabajadas de un turno: los turnos de 9 h o más incluyen 1 h de almuerzo. */
export function horasTrabajadas(inicio: number, fin: number): number {
  const h = (fin - inicio) / 60;
  return h >= 9 ? h - 1 : h;
}

/** ¿El turno cubre completa la franja [hora, hora+1)? */
export function cubreFranja(t: { inicio: number; fin: number }, hora: number): boolean {
  return t.inicio <= hora * 60 && t.fin >= (hora + 1) * 60;
}

export function coberturaPorHora(turnos: TurnoMotor[], oficinaId: string, fecha: DiaISO): number[] {
  const cov = new Array(24).fill(0);
  for (const t of turnos) {
    if (t.oficinaId !== oficinaId || t.fecha !== fecha) continue;
    for (let h = Math.floor(t.inicio / 60); h < Math.ceil(t.fin / 60); h++) if (cubreFranja(t, h)) cov[h]++;
  }
  return cov;
}

export function lambdaDe(p: PerfilDemanda | undefined, fecha: DiaISO, hora: number): number {
  if (!p) return 0;
  return p.lambda[diaSemana(fecha)]?.[hora] ?? 0;
}

/** Personas requeridas por franja según Erlang C, con tope de puestos. */
export function requeridasDelDia(
  o: OficinaMotor,
  p: PerfilDemanda | undefined,
  fecha: DiaISO,
  objetivo: number,
  par: ParametrosMotor,
): number[] {
  const req = new Array(24).fill(0);
  for (const h of horasDelDia(o, fecha)) {
    const l = lambdaDe(p, fecha, h);
    const tope = par.respetarPuestos ? o.capacidad : 60;
    // con la oficina abierta siempre debe haber al menos una persona
    req[h] = Math.max(1, personasRequeridas(l, p?.ahtSeg ?? 360, objetivo, par.tiempoObjetivoSeg, tope));
  }
  return req;
}

/** Métricas Erlang de un día con una cobertura dada (ponderadas por llegadas). */
export function metricasDia(
  o: OficinaMotor,
  p: PerfilDemanda | undefined,
  fecha: DiaISO,
  cov: number[],
  par: ParametrosMotor,
  horas?: number[],
) {
  const hs = horas ?? horasDelDia(o, fecha);
  let llegadas = 0;
  let sl = 0;
  let espera = 0;
  let requeridas = 0;
  let asignadas = 0;
  const aht = p?.ahtSeg ?? 360;
  for (const h of hs) {
    const l = lambdaDe(p, fecha, h);
    llegadas += l;
    const c = cov[h] ?? 0;
    sl += l * nivelServicio(c, l, aht, par.tiempoObjetivoSeg);
    const w = esperaPromedio(c, l, aht);
    espera += l * (Number.isFinite(w) ? Math.min(w, 3600) : 3600);
    requeridas += personasRequeridasFraccion(l, aht, par.servicioObjetivo, par.tiempoObjetivoSeg);
    asignadas += c;
  }
  return {
    llegadas,
    nivelServicio: llegadas ? sl / llegadas : 1,
    esperaSeg: llegadas ? espera / llegadas : 0,
    // uso = personas que pide la fila / personas en turno (1 = justo lo necesario)
    uso: asignadas ? Math.min(1.5, requeridas / asignadas) : llegadas ? 1.5 : 0,
  };
}

export function usoFranja(c: number, l: number, aht: number) {
  return ocupacion(c, l, aht);
}
