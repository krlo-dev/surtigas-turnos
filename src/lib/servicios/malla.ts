// Casos de uso de la malla de turnos: propuesta del motor (RF-04), ajustes manuales (RF-05),
// aplicación del recálculo (RF-06), apoyos entre oficinas (RF-14) y envío semanal (RF-10).

import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { MARCA_QUITAR, PREFIJO_COPIA, esPorQuitar } from "./por-quitar";
import { obtenerMotor } from "../engine";
import type { CoberturaPropuesta, ParametrosMotor, ResultadoPropuesta, SugerenciaApoyo } from "../engine/tipos";
import { aFecha, aISO, diasDeSemana, hoyISO, lunesDe, minutosAhora, semanaISO, sumarDias, diaSemana } from "../fechas";
import { correoCobertura, correoHorarioSemanal, type DiaHorario } from "../notificaciones/plantillas";
import { obtenerNotificador } from "../notificaciones/servicio";
import { TIPO_LABEL } from "./excusas";
import { contextoSemana, guardarParametros, leerParametros } from "./contexto";

// ------------------------------------------------------------------ RF-04
export async function generarPropuesta(lunes: string, autorId: string | null, parametros?: ParametrosMotor) {
  const par = parametros ?? (await leerParametros());
  if (parametros) await guardarParametros(parametros);
  const ctx = await contextoSemana(lunes);
  const fijos = ctx.turnos.filter((t) => t.tipo === "MANUAL");
  const resultado = obtenerMotor().proponerSemana({
    semanaInicio: lunes,
    oficinas: ctx.oficinas,
    personas: ctx.personas,
    ausencias: ctx.ausencias,
    turnosFijos: fijos,
    demanda: ctx.demanda,
    parametros: par,
  });
  await db.corrida.updateMany({ where: { tipo: "PROPUESTA", estado: "BORRADOR", semanaInicio: aFecha(lunes) }, data: { estado: "DESCARTADA" } });
  return db.corrida.create({
    data: {
      tipo: "PROPUESTA",
      semanaInicio: aFecha(lunes),
      autorId,
      parametros: par as unknown as Prisma.InputJsonValue,
      resultado: resultado as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function confirmarPropuesta(corridaId: string, alternativaId: "A" | "B") {
  const corrida = await db.corrida.findUniqueOrThrow({ where: { id: corridaId } });
  if (corrida.estado !== "BORRADOR") throw new Error("Esta propuesta ya no está vigente.");
  const r = corrida.resultado as unknown as ResultadoPropuesta;
  const alt = r.alternativas.find((a) => a.id === alternativaId);
  if (!alt) throw new Error("Alternativa no encontrada.");
  const lunes = aISO(corrida.semanaInicio);
  const domingo = sumarDias(lunes, 6);
  await db.$transaction([
    db.turno.deleteMany({ where: { fecha: { gte: aFecha(lunes), lte: aFecha(domingo) }, estado: { in: ["CONFIRMADO", "PROPUESTO"] } } }),
    db.turno.createMany({
      data: alt.turnos
        .filter((t) => t.tipo !== "MANUAL")
        .map((t) => ({
          usuarioId: t.usuarioId,
          oficinaId: t.oficinaId,
          fecha: aFecha(t.fecha),
          horaInicio: t.inicio,
          horaFin: t.fin,
          estado: "CONFIRMADO" as const,
          origen: t.tipo === "APOYO" ? ("APOYO" as const) : ("MOTOR" as const),
          virtual: t.virtual,
          nota: t.nota ?? null,
          publicado: true,
          corridaId: corrida.id,
        })),
    }),
    db.corrida.update({ where: { id: corrida.id }, data: { estado: "CONFIRMADA", resultado: { ...r, elegida: alternativaId } as unknown as Prisma.InputJsonValue } }),
  ]);
  return { lunes, turnos: alt.turnos.length };
}

// ------------------------------------------------------------------ RF-05: ajustes manuales
// Todo cambio a mano queda sin publicar y se puede deshacer hasta que el administrador publica:
// - turno nuevo: se borra;
// - turno publicado que se editó: vuelve a como estaba (se guarda una copia en Configuracion, clave "deshacer:<id>");
// - turno publicado que se quitó: queda "por quitar" y se restaura.

type CopiaTurno = { oficinaId: string; horaInicio: number; horaFin: number; estado: "CONFIRMADO" | "PROPUESTO" | "MANUAL"; origen: "MOTOR" | "MANUAL" | "COBERTURA" | "APOYO"; nota: string | null; virtual: boolean };
const claveCopia = (id: string) => `${PREFIJO_COPIA}${id}`;

async function leerCopia(id: string): Promise<CopiaTurno | null> {
  const c = await db.configuracion.findUnique({ where: { clave: claveCopia(id) } });
  return c ? (c.valor as unknown as CopiaTurno) : null;
}

export async function guardarTurnoManual(d: { id?: string; usuarioId: string; oficinaId: string; fecha: string; inicio: number; fin: number }) {
  if (d.fin <= d.inicio) throw new Error("La hora de salida debe ser posterior a la de entrada.");
  const choque = await db.turno.findFirst({
    where: { usuarioId: d.usuarioId, fecha: aFecha(d.fecha), estado: { not: "LIBERADO" }, id: d.id ? { not: d.id } : undefined, horaInicio: { lt: d.fin }, horaFin: { gt: d.inicio } },
  });
  if (choque) throw new Error("Esa persona ya tiene un turno que se cruza en ese horario.");
  const data = { usuarioId: d.usuarioId, oficinaId: d.oficinaId, fecha: aFecha(d.fecha), horaInicio: d.inicio, horaFin: d.fin, estado: "MANUAL" as const, origen: "MANUAL" as const, publicado: false };
  if (!d.id) return db.turno.create({ data });
  const antes = await db.turno.findUniqueOrThrow({ where: { id: d.id } });
  // primera edición de un turno publicado: se guarda cómo estaba para poder deshacer
  if (antes.publicado && antes.estado !== "LIBERADO" && !(await leerCopia(d.id))) {
    const copia: CopiaTurno = { oficinaId: antes.oficinaId, horaInicio: antes.horaInicio, horaFin: antes.horaFin, estado: antes.estado as CopiaTurno["estado"], origen: antes.origen, nota: antes.nota, virtual: antes.virtual };
    await db.configuracion.create({ data: { clave: claveCopia(d.id), valor: copia } });
  }
  return db.turno.update({ where: { id: d.id }, data });
}

/** Quita un turno. Si nunca se publicó, se borra y se devuelven sus datos para poder deshacer. */
export async function quitarTurno(id: string): Promise<{ pendiente: true } | { pendiente: false; borrado: { usuarioId: string; oficinaId: string; fecha: string; inicio: number; fin: number } }> {
  const t = await db.turno.findUniqueOrThrow({ where: { id } });
  const copia = await leerCopia(id);
  if (!t.publicado && !copia) {
    await db.turno.delete({ where: { id } });
    return { pendiente: false, borrado: { usuarioId: t.usuarioId, oficinaId: t.oficinaId, fecha: aISO(t.fecha), inicio: t.horaInicio, fin: t.horaFin } };
  }
  // si se había editado, lo que se quita es el turno publicado original
  const base = copia ?? { oficinaId: t.oficinaId, horaInicio: t.horaInicio, horaFin: t.horaFin, estado: t.estado, nota: t.nota, virtual: t.virtual, origen: t.origen };
  await db.turno.update({
    where: { id },
    data: { oficinaId: base.oficinaId, horaInicio: base.horaInicio, horaFin: base.horaFin, origen: base.origen, virtual: base.virtual, estado: "LIBERADO", publicado: false, nota: `${MARCA_QUITAR}${base.estado}|${base.nota ?? ""}` },
  });
  if (copia) await db.configuracion.delete({ where: { clave: claveCopia(id) } });
  return { pendiente: true };
}

/** Deshace cualquier cambio sin publicar de un turno. Devuelve false si no había nada que deshacer. */
export async function deshacerCambioTurno(id: string): Promise<boolean> {
  const t = await db.turno.findUnique({ where: { id } });
  if (!t || t.publicado) return false;
  if (esPorQuitar(t)) {
    const [estado, ...resto] = (t.nota ?? "").slice(MARCA_QUITAR.length).split("|");
    const nota = resto.join("|");
    const valido = ["CONFIRMADO", "PROPUESTO", "MANUAL"].includes(estado) ? (estado as CopiaTurno["estado"]) : "MANUAL";
    await db.turno.update({ where: { id }, data: { estado: valido, publicado: true, nota: nota || null } });
    return true;
  }
  const copia = await leerCopia(id);
  if (copia) {
    await db.turno.update({ where: { id }, data: { ...copia, publicado: true } });
    await db.configuracion.delete({ where: { clave: claveCopia(id) } });
    return true;
  }
  await db.turno.delete({ where: { id } }); // era un turno nuevo
  return true;
}

/** Vuelve a crear un turno nuevo que se quitó antes de publicarlo. */
export async function restaurarTurnoBorrado(d: { usuarioId: string; oficinaId: string; fecha: string; inicio: number; fin: number }) {
  return guardarTurnoManual(d);
}

/** Descarta todos los cambios sin publicar de una oficina en la semana. */
export async function descartarCambios(lunes: string, oficinaId: string) {
  const pendientes = await db.turno.findMany({ where: { oficinaId, fecha: { gte: aFecha(lunes), lte: aFecha(sumarDias(lunes, 6)) }, publicado: false }, select: { id: true } });
  let n = 0;
  for (const t of pendientes) if (await deshacerCambioTurno(t.id)) n++;
  return n;
}

export async function publicarCambios(lunes: string, oficinaId?: string) {
  const where = { fecha: { gte: aFecha(lunes), lte: aFecha(sumarDias(lunes, 6)) }, publicado: false, ...(oficinaId ? { oficinaId } : {}) };
  const pendientes = await db.turno.findMany({ where, select: { id: true, usuarioId: true, estado: true, publicado: true, nota: true } });
  const porQuitar = pendientes.filter(esPorQuitar).map((t) => t.id);
  if (porQuitar.length) await db.turno.deleteMany({ where: { id: { in: porQuitar } } });
  await db.turno.updateMany({ where, data: { publicado: true } });
  // al publicar, los cambios quedan firmes: ya no hay copia para deshacer
  if (pendientes.length) await db.configuracion.deleteMany({ where: { clave: { in: pendientes.map((t) => claveCopia(t.id)) } } });
  const personas = [...new Set(pendientes.map((p) => p.usuarioId))];
  for (const id of personas) await enviarHorarioA(id, lunes);
  return personas.length;
}

/** Copia los turnos de la semana anterior en los días libres de la semana (por oficina). */
export async function copiarSemanaAnterior(lunes: string, oficinaId: string) {
  const anterior = sumarDias(lunes, -7);
  const [previos, actuales] = await Promise.all([
    db.turno.findMany({ where: { oficinaId, fecha: { gte: aFecha(anterior), lte: aFecha(sumarDias(anterior, 6)) }, estado: { not: "LIBERADO" } } }),
    db.turno.findMany({ where: { fecha: { gte: aFecha(lunes), lte: aFecha(sumarDias(lunes, 6)) }, estado: { not: "LIBERADO" } }, select: { usuarioId: true, fecha: true } }),
  ]);
  const ocupado = new Set(actuales.map((t) => `${t.usuarioId}|${aISO(t.fecha)}`));
  const nuevos = previos
    .map((t) => ({ ...t, fecha: sumarDias(aISO(t.fecha), 7) }))
    .filter((t) => !ocupado.has(`${t.usuarioId}|${t.fecha}`));
  await db.turno.createMany({
    data: nuevos.map((t) => ({ usuarioId: t.usuarioId, oficinaId: t.oficinaId, fecha: aFecha(t.fecha), horaInicio: t.horaInicio, horaFin: t.horaFin, estado: "MANUAL" as const, origen: "MANUAL" as const, publicado: false })),
  });
  return nuevos.length;
}

// ------------------------------------------------------------------ RF-06: aplicar la cobertura del recálculo
export async function aplicarCobertura(corridaId: string, avisar: boolean) {
  const corrida = await db.corrida.findUniqueOrThrow({ where: { id: corridaId } });
  if (corrida.estado !== "BORRADOR") throw new Error("Este recálculo ya fue aplicado o descartado.");
  const r = corrida.resultado as unknown as { coberturas: CoberturaPropuesta[]; persona: string };
  const oficinas = new Map((await db.oficina.findMany()).map((o) => [o.id, o]));
  let aplicadas = 0;
  for (const c of r.coberturas) {
    const cand = c.candidato;
    if (!cand) continue;
    const l = c.liberado;
    if (cand.trasladaTurnoId) {
      const suyo = await db.turno.findUnique({ where: { id: cand.trasladaTurnoId } });
      if (suyo) {
        await db.turno.delete({ where: { id: suyo.id } });
        const restos = [];
        if (suyo.horaInicio < l.inicio) restos.push({ horaInicio: suyo.horaInicio, horaFin: l.inicio });
        if (suyo.horaFin > l.fin) restos.push({ horaInicio: l.fin, horaFin: suyo.horaFin });
        for (const x of restos)
          await db.turno.create({ data: { usuarioId: suyo.usuarioId, oficinaId: suyo.oficinaId, fecha: suyo.fecha, ...x, estado: suyo.estado, origen: suyo.origen, publicado: true } });
      }
    }
    const origen = oficinas.get(cand.oficinaOrigenId);
    const turno = await db.turno.create({
      data: {
        usuarioId: cand.usuarioId,
        oficinaId: l.oficinaId,
        fecha: aFecha(l.fecha),
        horaInicio: l.inicio,
        horaFin: l.fin,
        estado: "CONFIRMADO",
        origen: "COBERTURA",
        virtual: cand.modalidad === "VIRTUAL",
        cubreA: l.nombre,
        nota: cand.modalidad === "MISMA_OFICINA" ? null : `${cand.modalidad === "VIRTUAL" ? "Virtual desde" : "Desde"} ${origen?.nombre ?? ""}`,
        corridaId: corrida.id,
        excusaId: corrida.excusaId,
        publicado: true,
      },
    });
    if (cand.modalidad !== "MISMA_OFICINA") {
      await db.apoyo.create({
        data: {
          usuarioId: cand.usuarioId,
          desdeOficinaId: cand.oficinaOrigenId,
          haciaOficinaId: l.oficinaId,
          fecha: aFecha(l.fecha),
          horaInicio: l.inicio,
          horaFin: l.fin,
          modalidad: cand.modalidad === "VIRTUAL" ? "VIRTUAL" : "PRESENCIAL",
          estado: "APLICADO",
          razon: `Cubre a ${l.nombre}`,
          usoDesde: Math.round((cand.usoOrigen ?? 0) * 100),
          usoHacia: 0,
          turnoId: turno.id,
        },
      });
    }
    if (avisar) {
      const u = await db.usuario.findUnique({ where: { id: cand.usuarioId } });
      if (u) {
        const m = correoCobertura(u.nombre, l.fecha, l.inicio, l.fin, oficinas.get(l.oficinaId)?.nombre ?? "", l.nombre, cand.modalidad);
        await obtenerNotificador().enviar({ tipo: "COBERTURA", para: { correo: u.correo, nombre: u.nombre, usuarioId: u.id }, asunto: m.asunto, html: m.html, texto: m.texto });
      }
    }
    aplicadas++;
  }
  await db.corrida.update({ where: { id: corrida.id }, data: { estado: "CONFIRMADA" } });
  return aplicadas;
}

// ------------------------------------------------------------------ RF-14: apoyos entre oficinas
/**
 * Días que revisa la vista de apoyos. "Semana" mira lo que queda de esta semana; si ya no queda ningún día hábil
 * (domingo), pasa a la semana siguiente para que el administrador pueda planear los apoyos con tiempo.
 */
export function ventanaApoyos(vista: "hoy" | "semana", hoy = hoyISO()) {
  if (vista === "hoy") return { lunes: lunesDe(hoy), dias: [hoy], proxima: false };
  const lunes = lunesDe(hoy);
  const quedan = diasDeSemana(lunes).filter((d) => d >= hoy && diaSemana(d) !== 0);
  if (quedan.length) return { lunes, dias: quedan, proxima: false };
  const siguiente = sumarDias(lunes, 7);
  return { lunes: siguiente, dias: diasDeSemana(siguiente).filter((d) => diaSemana(d) !== 0), proxima: true };
}

export async function sugerenciasApoyo(vista: "hoy" | "semana"): Promise<SugerenciaApoyo[]> {
  const { lunes, dias } = ventanaApoyos(vista);
  const ctx = await contextoSemana(lunes);
  const sugerencias = obtenerMotor().sugerirApoyos({
    dias,
    desdeMinuto: vista === "hoy" ? minutosAhora() : undefined,
    turnos: ctx.turnos,
    oficinas: ctx.oficinas,
    personas: ctx.personas,
    ausencias: ctx.ausencias,
    demanda: ctx.demanda,
    parametros: ctx.parametros,
  });
  const descartadas = await db.apoyo.findMany({ where: { estado: "DESCARTADO", fecha: { in: dias.map(aFecha) } } });
  const claves = new Set(descartadas.map((d) => `${d.usuarioId}|${aISO(d.fecha)}|${d.haciaOficinaId}`));
  return sugerencias.filter((s) => !claves.has(`${s.usuarioId}|${s.fecha}|${s.haciaOficinaId}`));
}

export async function aplicarApoyo(s: SugerenciaApoyo, aplicar: boolean) {
  const base = {
    usuarioId: s.usuarioId,
    desdeOficinaId: s.desdeOficinaId,
    haciaOficinaId: s.haciaOficinaId,
    fecha: aFecha(s.fecha),
    horaInicio: s.inicio,
    horaFin: s.fin,
    modalidad: s.modalidad,
    razon: s.razon,
    usoDesde: Math.round(s.usoDesde * 100),
    usoHacia: Math.round(s.usoHacia * 100),
    esperaAntes: Math.round(s.esperaAntesSeg),
    esperaDespues: Math.round(s.esperaDespuesSeg),
  };
  if (!aplicar) return db.apoyo.create({ data: { ...base, estado: "DESCARTADO" } });
  const origen = await db.oficina.findUniqueOrThrow({ where: { id: s.desdeOficinaId } });
  if (s.turnoId) {
    const suyo = await db.turno.findUnique({ where: { id: s.turnoId } });
    if (suyo) {
      await db.turno.delete({ where: { id: suyo.id } });
      if (suyo.horaInicio < s.inicio) await db.turno.create({ data: { usuarioId: suyo.usuarioId, oficinaId: suyo.oficinaId, fecha: suyo.fecha, horaInicio: suyo.horaInicio, horaFin: s.inicio, estado: suyo.estado, origen: suyo.origen } });
      if (suyo.horaFin > s.fin) await db.turno.create({ data: { usuarioId: suyo.usuarioId, oficinaId: suyo.oficinaId, fecha: suyo.fecha, horaInicio: s.fin, horaFin: suyo.horaFin, estado: suyo.estado, origen: suyo.origen } });
    }
  }
  const turno = await db.turno.create({
    data: {
      usuarioId: s.usuarioId,
      oficinaId: s.haciaOficinaId,
      fecha: aFecha(s.fecha),
      horaInicio: s.inicio,
      horaFin: s.fin,
      estado: "CONFIRMADO",
      origen: "APOYO",
      virtual: s.modalidad === "VIRTUAL",
      nota: `${s.modalidad === "VIRTUAL" ? "Virtual desde" : "Desde"} ${origen.nombre}`,
    },
  });
  return db.apoyo.create({ data: { ...base, estado: "APLICADO", turnoId: turno.id } });
}

// ------------------------------------------------------------------ RF-10: horario semanal por correo
export async function horarioDePersona(usuarioId: string, lunes: string): Promise<DiaHorario[]> {
  const domingo = sumarDias(lunes, 6);
  const [turnos, excusas] = await Promise.all([
    db.turno.findMany({ where: { usuarioId, fecha: { gte: aFecha(lunes), lte: aFecha(domingo) }, estado: { not: "LIBERADO" } }, include: { oficina: true }, orderBy: { horaInicio: "asc" } }),
    db.excusa.findMany({ where: { usuarioId, estado: "APROBADA", fechaInicio: { lte: aFecha(domingo) }, fechaFin: { gte: aFecha(lunes) } } }),
  ]);
  return diasDeSemana(lunes).map((fecha) => {
    const ex = excusas.find((e) => aISO(e.fechaInicio) <= fecha && aISO(e.fechaFin) >= fecha && e.jornada === "TODO_EL_DIA");
    return {
      fecha,
      ausencia: ex ? `${TIPO_LABEL[ex.tipo]} aprobada` : undefined,
      turnos: turnos.filter((t) => aISO(t.fecha) === fecha).map((t) => ({ inicio: t.horaInicio, fin: t.horaFin, oficina: t.oficina.nombre })),
    };
  });
}

export async function enviarHorarioA(usuarioId: string, lunes: string) {
  const u = await db.usuario.findUniqueOrThrow({ where: { id: usuarioId }, include: { oficina: true } });
  const dias = await horarioDePersona(usuarioId, lunes);
  const semana = semanaISO(lunes);
  const c = correoHorarioSemanal(u.nombre, semana, lunes, u.oficina?.nombre ?? "", dias);
  return obtenerNotificador().enviar({ tipo: "HORARIO_SEMANAL", para: { correo: u.correo, nombre: u.nombre, usuarioId: u.id }, asunto: c.asunto, html: c.html, texto: c.texto, semana });
}

/** Envía a cada colaborador activo su horario de la semana que empieza en `lunes`. */
export async function enviarHorarioSemanal(lunes: string) {
  const personas = await db.usuario.findMany({ where: { rol: "COLABORADOR", activo: true }, orderBy: { nombre: "asc" } });
  let enviados = 0;
  let fallidos = 0;
  for (const p of personas) {
    const r = await enviarHorarioA(p.id, lunes);
    if (r.ok) enviados++;
    else fallidos++;
  }
  return { total: personas.length, enviados, fallidos, semana: semanaISO(lunes) };
}

/** Lunes de la semana que recibe el próximo envío (domingo 18:00 → semana siguiente). */
export function proximoEnvio(hoy = hoyISO()) {
  const lunesActual = lunesDe(hoy);
  const domingo = sumarDias(lunesActual, 6);
  return { domingo, lunesObjetivo: sumarDias(lunesActual, 7), semana: semanaISO(sumarDias(lunesActual, 7)) };
}
