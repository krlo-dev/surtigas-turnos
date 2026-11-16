// Datos de la vista del colaborador: su semana, próximos turnos y solicitudes.

import type { EstadoExcusa, TipoExcusa } from "@prisma/client";
import { db } from "../db";
import { horarioDelDia, horasTrabajadas, lambdaDe } from "../engine/oficinas";
import { aFecha, aISO, diasDeSemana, hoyISO, minutosAhora, semanaISO, sumarDias } from "../fechas";
import { aOficinaMotor, leerParametros, perfilesDemanda } from "./contexto";

export interface DiaColaborador {
  fecha: string;
  turnos: { id: string; inicio: number; fin: number; oficina: string; oficinaId: string; enCurso: boolean; nota: string | null; virtual: boolean }[];
  ausencia: { tipo: TipoExcusa; estado: EstadoExcusa; codigo: number } | null;
  cerrado: boolean;
}

export async function semanaColaborador(usuarioId: string, lunes: string) {
  const domingo = sumarDias(lunes, 6);
  const hoy = hoyISO();
  const ahora = minutosAhora();
  const usuario = await db.usuario.findUniqueOrThrow({ where: { id: usuarioId }, include: { oficina: true } });
  const [turnos, excusas, envio] = await Promise.all([
    db.turno.findMany({ where: { usuarioId, fecha: { gte: aFecha(lunes), lte: aFecha(domingo) }, estado: { not: "LIBERADO" } }, include: { oficina: true }, orderBy: { horaInicio: "asc" } }),
    db.excusa.findMany({ where: { usuarioId, estado: { in: ["PENDIENTE", "APROBADA"] }, fechaInicio: { lte: aFecha(domingo) }, fechaFin: { gte: aFecha(lunes) } } }),
    db.notificacion.findFirst({ where: { destinatarioId: usuarioId, tipo: "HORARIO_SEMANAL", semana: semanaISO(lunes) }, orderBy: { fechaEnvio: "desc" } }),
  ]);
  const oficinaBase = usuario.oficina ? aOficinaMotor(usuario.oficina) : null;
  const dias: DiaColaborador[] = diasDeSemana(lunes).map((fecha) => {
    const ex = excusas.find((e) => aISO(e.fechaInicio) <= fecha && aISO(e.fechaFin) >= fecha && e.jornada === "TODO_EL_DIA");
    const delDia = turnos.filter((t) => aISO(t.fecha) === fecha);
    return {
      fecha,
      turnos: delDia.map((t) => ({ id: t.id, inicio: t.horaInicio, fin: t.horaFin, oficina: t.oficina.nombre, oficinaId: t.oficinaId, enCurso: fecha === hoy && ahora >= t.horaInicio && ahora < t.horaFin, nota: t.nota, virtual: t.virtual })),
      ausencia: ex ? { tipo: ex.tipo, estado: ex.estado, codigo: ex.codigo } : null,
      cerrado: !delDia.length && (!oficinaBase || !horarioDelDia(oficinaBase, fecha)),
    };
  });
  const horas = turnos.reduce((s, t) => s + horasTrabajadas(t.horaInicio, t.horaFin), 0);
  return { usuario, dias, horas, envio, hoy, ahora };
}

/** Franja pico dentro de un turno según el perfil de demanda de la oficina. */
export async function picoDeTurnos(turnos: { oficinaId: string; fecha: string; inicio: number; fin: number }[]) {
  const par = await leerParametros();
  const perfiles = await perfilesDemanda([...new Set(turnos.map((t) => t.oficinaId))], par.semanasHistorico);
  return turnos.map((t) => {
    const p = perfiles[t.oficinaId];
    let mejor = -1;
    let valor = 0;
    for (let h = Math.floor(t.inicio / 60); h < Math.ceil(t.fin / 60); h++) {
      const l = lambdaDe(p, t.fecha, h);
      if (l > valor) {
        valor = l;
        mejor = h;
      }
    }
    return mejor >= 0 ? { hora: mejor, llegadas: Math.round(valor) } : null;
  });
}

export async function proximosTurnos(usuarioId: string, limite = 4) {
  const hoy = hoyISO();
  const ahora = minutosAhora();
  const turnos = await db.turno.findMany({
    where: { usuarioId, fecha: { gte: aFecha(hoy), lte: aFecha(sumarDias(hoy, 13)) }, estado: { not: "LIBERADO" } },
    include: { oficina: true },
    orderBy: [{ fecha: "asc" }, { horaInicio: "asc" }],
  });
  return turnos.filter((t) => aISO(t.fecha) > hoy || t.horaFin > ahora).slice(0, limite);
}
