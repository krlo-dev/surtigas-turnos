// Prepara la malla semanal de una oficina para la vista (RF-03).

import type { EstadoExcusa, TipoExcusa } from "@prisma/client";
import { db } from "../db";
import { coberturaPorHora, horarioDelDia, horasDelDia, horasTrabajadas, requeridasDelDia } from "../engine/oficinas";
import { aFecha, aISO, DIAS_CORTOS, diaSemana, diasDeSemana, hoyISO, partes, semanaISO, sumarDias } from "../fechas";
import { contextoSemana } from "./contexto";
import { esPorQuitar } from "./por-quitar";

export type ClaseBloque = "" | "propuesto" | "movido" | "manual" | "choque" | "liberado" | "quitar";

export interface BloqueVista {
  id: string;
  inicio: number;
  fin: number;
  clase: ClaseBloque;
  sub: string;
  oficinaId: string;
  publicado: boolean;
}

export type CeldaVista =
  | { tipo: "turnos"; turnos: BloqueVista[] }
  | { tipo: "ausencia"; tipoExcusa: TipoExcusa; codigo: string; estado: EstadoExcusa }
  | { tipo: "cerrado" }
  | { tipo: "fuera"; texto: string }
  | { tipo: "vacia" };

export interface FilaVista {
  persona: { id: string; nombre: string; linea: string; oficinaBaseId: string };
  celdas: CeldaVista[];
}

export async function vistaMalla(lunes: string, oficinaIdSel?: string) {
  const ctx = await contextoSemana(lunes);
  const oficinas = ctx.oficinas;
  const oficina = oficinas.find((o) => o.id === oficinaIdSel) ?? oficinas.find((o) => o.nombre === "Cartagena Centro") ?? oficinas[0];
  const dias = diasDeSemana(lunes);
  const domingo = dias[6];
  const hoy = hoyISO();

  const [turnos, excusas, usuarios, ultimaCorrida] = await Promise.all([
    db.turno.findMany({ where: { fecha: { gte: aFecha(lunes), lte: aFecha(domingo) } }, orderBy: { horaInicio: "asc" } }),
    db.excusa.findMany({ where: { estado: { in: ["PENDIENTE", "APROBADA"] }, fechaInicio: { lte: aFecha(domingo) }, fechaFin: { gte: aFecha(lunes) }, jornada: "TODO_EL_DIA" } }),
    db.usuario.findMany({ where: { rol: "COLABORADOR", activo: true }, include: { oficina: true }, orderBy: { nombre: "asc" } }),
    db.corrida.findFirst({ where: { tipo: "PROPUESTA", estado: "CONFIRMADA", semanaInicio: aFecha(lunes) }, orderBy: { numero: "desc" } }),
  ]);
  if (!oficina) return null;

  const nombreOficina = new Map(oficinas.map((o) => [o.id, o.nombre]));
  const deEstaOficina = usuarios.filter((u) => u.oficinaId === oficina.id);
  const visitantes = usuarios.filter((u) => u.oficinaId !== oficina.id && turnos.some((t) => t.usuarioId === u.id && t.oficinaId === oficina.id && t.estado !== "LIBERADO"));
  const personas = [...deEstaOficina, ...visitantes];

  const filas: FilaVista[] = personas.map((u) => {
    const suyos = turnos.filter((t) => t.usuarioId === u.id);
    const vivos = suyos.filter((t) => t.estado !== "LIBERADO");
    const horas = vivos.reduce((s, t) => s + horasTrabajadas(t.horaInicio, t.horaFin), 0);
    const esVisitante = u.oficinaId !== oficina.id;
    const linea = esVisitante
      ? `Base ${u.oficina?.nombre ?? ""} · apoyo`
      : u.horasSemana < 40
        ? `${fmtH(horas)} h · medio tiempo`
        : `${fmtH(horas)} h · ${vivos.length} ${vivos.length === 1 ? "turno" : "turnos"}`;

    const celdas: CeldaVista[] = dias.map((fecha) => {
      const abierto = horarioDelDia(oficina, fecha) !== null;
      const ex = excusas.find((e) => e.usuarioId === u.id && aISO(e.fechaInicio) <= fecha && aISO(e.fechaFin) >= fecha);
      if (ex) return { tipo: "ausencia", tipoExcusa: ex.tipo, codigo: `EX-${ex.codigo}`, estado: ex.estado };
      const delDia = suyos.filter((t) => aISO(t.fecha) === fecha);
      const aqui = delDia.filter((t) => t.oficinaId === oficina.id);
      const enOtra = delDia.filter((t) => t.oficinaId !== oficina.id && t.estado !== "LIBERADO");
      if (!abierto && !aqui.length) return { tipo: "cerrado" };
      if (!aqui.length && enOtra.length) return { tipo: "fuera", texto: `En ${nombreOficina.get(enOtra[0].oficinaId) ?? "otra oficina"}` };
      if (!aqui.length) return { tipo: "vacia" };
      return {
        tipo: "turnos",
        turnos: aqui.map((t): BloqueVista => {
          const choque = delDia.find((x) => x.id !== t.id && x.estado !== "LIBERADO" && t.estado !== "LIBERADO" && x.horaInicio < t.horaFin && t.horaInicio < x.horaFin);
          let clase: ClaseBloque = "";
          let sub = `${fmtH(horasTrabajadas(t.horaInicio, t.horaFin))} h`;
          if (esPorQuitar(t)) {
            clase = "quitar";
            sub = "Se quita al publicar";
          } else if (t.estado === "LIBERADO") {
            clase = "liberado";
            sub = "Liberado";
          } else if (choque) {
            clase = "choque";
            sub = `Choca con turno en ${nombreOficina.get(choque.oficinaId) ?? "otra oficina"}`;
          } else if (t.estado === "MANUAL") {
            clase = "manual";
            sub = t.publicado ? "Ajuste manual" : "Nuevo · manual";
          } else if (t.estado === "PROPUESTO") {
            clase = "propuesto";
            sub = "Propuesto";
          } else if (t.origen === "COBERTURA") {
            clase = "movido";
            sub = t.cubreA ? `Cubre a ${t.cubreA.split(" ")[0]}` : "Cobertura";
          } else if (t.origen === "APOYO") {
            clase = "movido";
            sub = t.nota ?? "Apoyo";
          }
          if (t.virtual && clase !== "liberado" && clase !== "quitar") sub += " · virtual";
          return { id: t.id, inicio: t.horaInicio, fin: t.horaFin, clase, sub, oficinaId: t.oficinaId, publicado: t.publicado };
        }),
      };
    });
    return { persona: { id: u.id, nombre: u.nombre, linea, oficinaBaseId: u.oficinaId ?? "" }, celdas };
  });

  // Pie: horas y cobertura por día (cobertura = parte de la necesidad Erlang que queda cubierta)
  const turnosMotor = ctx.turnos;
  const pie = dias.map((fecha) => {
    const horasDia = horasDelDia(oficina, fecha);
    if (!horasDia.length) return { horas: null as number | null, cobertura: null as number | null };
    const req = requeridasDelDia(oficina, ctx.demanda[oficina.id], fecha, ctx.parametros.servicioObjetivo, ctx.parametros);
    const cov = coberturaPorHora(turnosMotor, oficina.id, fecha);
    let necesita = 0;
    let cubre = 0;
    for (const h of horasDia) {
      necesita += req[h];
      cubre += Math.min(req[h], cov[h]);
    }
    const horas = turnos.filter((t) => t.oficinaId === oficina.id && aISO(t.fecha) === fecha && t.estado !== "LIBERADO").reduce((s, t) => s + horasTrabajadas(t.horaInicio, t.horaFin), 0);
    return { horas, cobertura: necesita ? cubre / necesita : 1 };
  });

  const sinPublicar = turnos.filter((t) => t.oficinaId === oficina.id && !t.publicado).length;
  return {
    oficina,
    oficinas: oficinas.map((o) => ({ id: o.id, nombre: o.nombre })),
    lunes,
    semana: semanaISO(lunes),
    dias: dias.map((fecha) => ({ fecha, etiqueta: `${partes(fecha).dia} ${DIAS_CORTOS[diaSemana(fecha)]}`, esHoy: fecha === hoy, abierto: horarioDelDia(oficina, fecha) !== null })),
    filas,
    pie,
    sinPublicar,
    corrida: ultimaCorrida?.numero ?? null,
    personasOficina: usuarios.map((u) => ({ id: u.id, nombre: u.nombre, oficinaId: u.oficinaId ?? "" })),
    anterior: sumarDias(lunes, -7),
    siguiente: sumarDias(lunes, 7),
  };
}

function fmtH(h: number) {
  return Number.isInteger(h) ? String(h) : h.toFixed(1).replace(".", ",");
}
