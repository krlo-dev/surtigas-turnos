// Capa de infraestructura: traduce los datos de Prisma a los tipos del motor.
// Es la frontera entre la base de datos y el dominio (las rutas nunca pasan objetos Prisma al motor).

import type { Excusa, Oficina, Turno } from "@prisma/client";
import { construirPerfil, type FilaDemanda } from "../datos/perfil";
import { db } from "../db";
import {
  PARAMETROS_POR_DEFECTO,
  type AusenciaMotor,
  type OficinaMotor,
  type ParametrosMotor,
  type PerfilDemanda,
  type PersonaMotor,
  type TurnoMotor,
} from "../engine/tipos";
import { aFecha, aISO, hoyISO, sumarDias } from "../fechas";

export function aOficinaMotor(o: Oficina): OficinaMotor {
  return {
    id: o.id,
    nombre: o.nombre,
    ciudad: o.ciudad,
    zona: o.zona,
    capacidad: o.capacidad,
    atencionVirtual: o.atencionVirtual,
    horaApertura: o.horaApertura,
    horaCierre: o.horaCierre,
    abreSabado: o.abreSabado,
    horaCierreSabado: o.horaCierreSabado,
  };
}

export function aTurnoMotor(t: Turno): TurnoMotor {
  return {
    id: t.id,
    usuarioId: t.usuarioId,
    oficinaId: t.oficinaId,
    fecha: aISO(t.fecha),
    inicio: t.horaInicio,
    fin: t.horaFin,
    tipo: t.estado === "MANUAL" ? "MANUAL" : t.origen === "COBERTURA" ? "COBERTURA" : t.origen === "APOYO" ? "APOYO" : "MOTOR",
    virtual: t.virtual,
    nota: t.nota ?? undefined,
    cubreA: t.cubreA ?? undefined,
  };
}

export function aAusenciaMotor(e: Excusa): AusenciaMotor {
  return {
    usuarioId: e.usuarioId,
    desde: aISO(e.fechaInicio),
    hasta: aISO(e.fechaFin),
    inicio: e.jornada === "UNAS_HORAS" ? e.horaInicio : null,
    fin: e.jornada === "UNAS_HORAS" ? e.horaFin : null,
  };
}

export async function leerParametros(): Promise<ParametrosMotor> {
  const c = await db.configuracion.findUnique({ where: { clave: "parametrosMotor" } });
  return { ...PARAMETROS_POR_DEFECTO, ...((c?.valor as Partial<ParametrosMotor>) ?? {}) };
}

export async function guardarParametros(p: ParametrosMotor) {
  await db.configuracion.upsert({
    where: { clave: "parametrosMotor" },
    create: { clave: "parametrosMotor", valor: p as object },
    update: { valor: p as object },
  });
}

/** Última fecha con datos de demanda (hoy si el histórico está al día). */
export async function fechaUltimaDemanda(): Promise<string | null> {
  const r = await db.demandaHora.aggregate({ _max: { fecha: true } });
  return r._max.fecha ? aISO(r._max.fecha) : null;
}

/**
 * Perfil de demanda por oficina con las últimas N semanas completas de histórico (DemandProvider del ERS).
 * Si el histórico importado es antiguo, toma las N semanas que terminan en el último día con datos.
 */
export async function perfilesDemanda(oficinaIds: string[], semanas: number, hasta?: string): Promise<Record<string, PerfilDemanda>> {
  const hoy = hoyISO();
  // cada oficina usa sus últimas N semanas con datos (el histórico importado puede ser de otra época)
  const ultimas = await db.demandaHora.groupBy({ by: ["oficinaId"], where: { oficinaId: { in: oficinaIds } }, _max: { fecha: true } });
  const ventanas = ultimas
    .filter((u) => u._max.fecha)
    .map((u) => {
      const ultima = aISO(u._max.fecha!);
      const tope = hasta && hasta < ultima ? hasta : ultima;
      const fin = tope >= hoy ? sumarDias(hoy, -1) : tope; // el día en curso aún no está completo
      return { oficinaId: u.oficinaId, fecha: { gte: aFecha(sumarDias(fin, -7 * semanas + 1)), lte: aFecha(fin) } };
    });
  if (!ventanas.length) return {};
  const filas = await db.demandaHora.findMany({
    where: { OR: ventanas },
    select: { oficinaId: true, fecha: true, hora: true, fila: true, servicio: true, llegadas: true, atendidos: true, abandonados: true, sumaEsperaSeg: true, sumaAtencionSeg: true, atencionesConTiempo: true },
  });
  const porOficina = new Map<string, FilaDemanda[]>();
  for (const f of filas) {
    const lista = porOficina.get(f.oficinaId) ?? [];
    lista.push({ ...f, fecha: aISO(f.fecha) });
    porOficina.set(f.oficinaId, lista);
  }
  const out: Record<string, PerfilDemanda> = {};
  for (const id of oficinaIds) {
    const lista = porOficina.get(id);
    if (lista?.length) out[id] = construirPerfil(id, lista, semanas);
  }
  return out;
}

export interface ContextoSemana {
  oficinas: OficinaMotor[];
  personas: PersonaMotor[];
  ausencias: AusenciaMotor[];
  turnos: TurnoMotor[];
  turnosDb: (Turno & { usuario: { nombre: string } })[];
  demanda: Record<string, PerfilDemanda>;
  parametros: ParametrosMotor;
}

/** Carga todo lo que el motor necesita para una semana. */
export async function contextoSemana(lunes: string): Promise<ContextoSemana> {
  const domingo = sumarDias(lunes, 6);
  const [oficinasDb, personasDb, excusas, turnosDb, parametros] = await Promise.all([
    db.oficina.findMany({ where: { activa: true }, orderBy: { nombre: "asc" } }),
    db.usuario.findMany({ where: { rol: "COLABORADOR", activo: true, oficinaId: { not: null } } }),
    db.excusa.findMany({
      where: { estado: "APROBADA", fechaInicio: { lte: aFecha(sumarDias(domingo, 1)) }, fechaFin: { gte: aFecha(sumarDias(lunes, -1)) } },
    }),
    db.turno.findMany({
      where: { fecha: { gte: aFecha(lunes), lte: aFecha(domingo) }, estado: { not: "LIBERADO" } },
      include: { usuario: { select: { nombre: true } } },
    }),
    leerParametros(),
  ]);
  const oficinas = oficinasDb.map(aOficinaMotor);
  return {
    oficinas,
    personas: personasDb.map((p) => ({ id: p.id, nombre: p.nombre, oficinaId: p.oficinaId!, horasSemana: p.horasSemana })),
    ausencias: excusas.map(aAusenciaMotor),
    turnos: turnosDb.map(aTurnoMotor),
    turnosDb,
    demanda: await perfilesDemanda(oficinas.map((o) => o.id), parametros.semanasHistorico),
    parametros,
  };
}
