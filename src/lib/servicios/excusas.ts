// Casos de uso del módulo de excusas y permisos (RF-07, RF-08, RF-09, RF-11, RF-12) y el recálculo (RF-06).

import type { Excusa, Prisma, TipoExcusa } from "@prisma/client";
import { obtenerAlmacenamiento, MAX_BYTES_SOPORTE, TIPOS_SOPORTE } from "../almacenamiento";
import { db } from "../db";
import { obtenerMotor } from "../engine";
import { aFecha, aISO, lunesDe, rangoDias, sumarDias } from "../fechas";
import { correoNuevaExcusa, correoResolucion } from "../notificaciones/plantillas";
import { obtenerNotificador } from "../notificaciones/servicio";
import { contextoSemana } from "./contexto";

export const codigoExcusa = (n: number) => `EX-${n}`;
export const numeroDeCodigo = (c: string) => Number(String(c).replace(/^EX-?/i, ""));

export const TIPO_LABEL: Record<TipoExcusa, string> = { EXCUSA: "Excusa", PERMISO: "Permiso", INCAPACIDAD: "Incapacidad" };

export interface DatosExcusa {
  usuarioId: string;
  tipo: TipoExcusa;
  desde: string;
  hasta: string;
  jornada: "TODO_EL_DIA" | "UNAS_HORAS";
  horaInicio?: number | null;
  horaFin?: number | null;
  motivo: string;
  archivo?: File | null;
  canal?: string;
}

/** Turnos de la persona que se cruzan con el rango de la ausencia. */
export async function turnosAfectados(usuarioId: string, desde: string, hasta: string, horaInicio?: number | null, horaFin?: number | null) {
  const turnos = await db.turno.findMany({
    where: { usuarioId, fecha: { gte: aFecha(desde), lte: aFecha(hasta) }, estado: { not: "LIBERADO" } },
    include: { oficina: { select: { nombre: true } } },
    orderBy: [{ fecha: "asc" }, { horaInicio: "asc" }],
  });
  if (horaInicio == null || horaFin == null) return turnos;
  return turnos.filter((t) => t.horaInicio < horaFin && horaInicio < t.horaFin);
}

export async function registrarExcusa(d: DatosExcusa) {
  if (d.hasta < d.desde) throw new Error("La fecha final no puede ser anterior a la inicial.");
  if (!d.motivo.trim()) throw new Error("Cuéntale a la administración qué pasó.");
  if (d.jornada === "UNAS_HORAS" && (d.horaInicio == null || d.horaFin == null || d.horaFin <= d.horaInicio)) throw new Error("Indica un rango de horas válido.");

  let soporte: { soporteUrl: string; soporteNombre: string; soporteBytes: number } | null = null;
  if (d.archivo && d.archivo.size > 0) {
    if (!TIPOS_SOPORTE.includes(d.archivo.type)) throw new Error("El soporte debe ser PDF, JPG, PNG o WEBP.");
    if (d.archivo.size > MAX_BYTES_SOPORTE) throw new Error("El soporte no puede pasar de 4 MB.");
    const url = await obtenerAlmacenamiento().guardar(d.archivo.name, d.archivo);
    soporte = { soporteUrl: url, soporteNombre: d.archivo.name, soporteBytes: d.archivo.size };
  }

  const usuario = await db.usuario.findUniqueOrThrow({ where: { id: d.usuarioId }, include: { oficina: true } });
  const excusa = await db.excusa.create({
    data: {
      usuarioId: d.usuarioId,
      tipo: d.tipo,
      fechaInicio: aFecha(d.desde),
      fechaFin: aFecha(d.hasta),
      jornada: d.jornada,
      horaInicio: d.jornada === "UNAS_HORAS" ? d.horaInicio : null,
      horaFin: d.jornada === "UNAS_HORAS" ? d.horaFin : null,
      motivo: d.motivo.trim(),
      canal: d.canal ?? "web",
      ...(soporte ?? {}),
      historial: { create: { estado: "PENDIENTE", evento: "registrada", autorId: d.usuarioId, nota: d.canal === "movil" ? "desde el celular" : "desde la web" } },
    },
  });

  // RF-11: aviso inmediato a la administración
  const turnos = await turnosAfectados(d.usuarioId, d.desde, d.hasta, excusa.horaInicio, excusa.horaFin);
  const admins = await db.usuario.findMany({ where: { rol: "ADMIN", activo: true } });
  let entregado = false;
  for (const a of admins) {
    const c = correoNuevaExcusa(a.nombre, usuario.nombre, usuario.oficina?.nombre ?? "", d.tipo, codigoExcusa(excusa.codigo), d.desde, d.hasta, excusa.motivo, turnos.length);
    const r = await obtenerNotificador().enviar({ tipo: "NUEVA_EXCUSA", para: { correo: a.correo, nombre: a.nombre, usuarioId: a.id }, asunto: c.asunto, html: c.html, texto: c.texto, referencia: codigoExcusa(excusa.codigo) });
    entregado ||= r.ok;
  }
  await db.historialExcusa.create({
    data: { excusaId: excusa.id, estado: "PENDIENTE", evento: "aviso_enviado", nota: entregado ? "entregado" : "no se pudo enviar el correo" },
  });
  return excusa;
}

export async function resolverExcusa(codigo: number, aprobar: boolean, comentario: string | null, adminId: string) {
  const excusa = await db.excusa.findUniqueOrThrow({ where: { codigo }, include: { usuario: true } });
  if (excusa.estado !== "PENDIENTE") throw new Error("Esta solicitud ya fue resuelta.");
  const admin = await db.usuario.findUniqueOrThrow({ where: { id: adminId } });
  const estado = aprobar ? "APROBADA" : "RECHAZADA";
  const actualizada = await db.excusa.update({
    where: { id: excusa.id },
    data: {
      estado,
      revisadoPorId: adminId,
      comentarioResolucion: comentario?.trim() || null,
      resueltoEn: new Date(),
      historial: { create: { estado, evento: aprobar ? "aprobada" : "rechazada", nota: comentario?.trim() || null, autorId: adminId } },
    },
  });

  // RF-12: aviso inmediato al colaborador
  const desde = aISO(excusa.fechaInicio);
  const hasta = aISO(excusa.fechaFin);
  const c = correoResolucion(excusa.usuario.nombre, excusa.tipo, codigoExcusa(excusa.codigo), desde, hasta, aprobar, comentario?.trim() || null, admin.nombre);
  await obtenerNotificador().enviar({ tipo: "RESOLUCION_EXCUSA", para: { correo: excusa.usuario.correo, nombre: excusa.usuario.nombre, usuarioId: excusa.usuarioId }, asunto: c.asunto, html: c.html, texto: c.texto, referencia: codigoExcusa(excusa.codigo) });

  // RF-06: al aprobar, se liberan los turnos y el motor recalcula la cobertura
  const corrida = aprobar ? await recalcularPorAusencia(actualizada, adminId) : null;
  return { excusa: actualizada, corridaId: corrida?.id ?? null };
}

export async function recalcularPorAusencia(excusa: Excusa, autorId: string | null) {
  const desde = aISO(excusa.fechaInicio);
  const afectados = await turnosAfectados(excusa.usuarioId, desde, aISO(excusa.fechaFin), excusa.horaInicio, excusa.horaFin);
  if (!afectados.length) return null;
  await db.turno.updateMany({ where: { id: { in: afectados.map((t) => t.id) } }, data: { estado: "LIBERADO", excusaId: excusa.id } });
  const resultado = await calcularCobertura(excusa, afectados);
  return db.corrida.create({
    data: { tipo: "RECALCULO", semanaInicio: aFecha(lunesDe(desde)), excusaId: excusa.id, autorId, parametros: {}, resultado: resultado as unknown as Prisma.InputJsonValue },
  });
}

/**
 * Vuelve a calcular un recálculo que todavía no se aplicó, con la malla como está ahora
 * (por ejemplo, después de liberar a alguien a mano para que pueda cubrir).
 */
export async function volverACalcularCobertura(corridaId: string) {
  const corrida = await db.corrida.findUniqueOrThrow({ where: { id: corridaId }, include: { excusa: true } });
  if (corrida.estado !== "BORRADOR" || !corrida.excusa) throw new Error("Este recálculo ya fue aplicado o descartado.");
  const liberados = await db.turno.findMany({ where: { excusaId: corrida.excusa.id, estado: "LIBERADO" }, orderBy: [{ fecha: "asc" }, { horaInicio: "asc" }] });
  if (!liberados.length) throw new Error("La ausencia ya no tiene turnos liberados.");
  const resultado = await calcularCobertura(corrida.excusa, liberados);
  await db.corrida.update({ where: { id: corridaId }, data: { resultado: resultado as unknown as Prisma.InputJsonValue } });
}

async function calcularCobertura(excusa: Excusa, afectados: { id: string; usuarioId: string; oficinaId: string; fecha: Date; horaInicio: number; horaFin: number }[]) {
  const usuario = await db.usuario.findUniqueOrThrow({ where: { id: excusa.usuarioId } });
  // El motor trabaja por semana: se arma el contexto de cada semana afectada.
  const semanas = [...new Set(afectados.map((t) => lunesDe(aISO(t.fecha))))];
  const coberturas = [];
  const impacto = [];
  const verificaciones = new Map<string, boolean>();
  let explicacion = "";
  for (const lunes of semanas) {
    const ctx = await contextoSemana(lunes);
    const liberados = afectados
      .filter((t) => lunesDe(aISO(t.fecha)) === lunes)
      .map((t) => ({ turnoId: t.id, usuarioId: t.usuarioId, nombre: usuario.nombre, oficinaId: t.oficinaId, fecha: aISO(t.fecha), inicio: t.horaInicio, fin: t.horaFin }));
    if (!liberados.length) continue;
    const r = obtenerMotor().cubrirAusencia({ liberados, turnosSemana: ctx.turnos, oficinas: ctx.oficinas, personas: ctx.personas, ausencias: ctx.ausencias, demanda: ctx.demanda, parametros: ctx.parametros });
    coberturas.push(...r.coberturas);
    impacto.push(...r.impacto);
    for (const v of r.verificaciones) verificaciones.set(v.texto, (verificaciones.get(v.texto) ?? true) && v.ok);
    explicacion ||= r.explicacion;
  }
  return { coberturas, impacto, verificaciones: [...verificaciones].map(([texto, ok]) => ({ texto, ok })), explicacion, persona: usuario.nombre };
}

export async function rangoTexto(e: Pick<Excusa, "fechaInicio" | "fechaFin">) {
  return { desde: aISO(e.fechaInicio), hasta: aISO(e.fechaFin), dias: rangoDias(aISO(e.fechaInicio), aISO(e.fechaFin)).length };
}

export { sumarDias };
