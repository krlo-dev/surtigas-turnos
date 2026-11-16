// Datos del panel de control (RF-13): disponibilidad, carga operativa y comportamiento de usuarios.

import { db } from "../db";
import { obtenerMotor } from "../engine";
import { personasRequeridas } from "../engine/erlang";
import { coberturaPorHora, horasDelDia, lambdaDe, metricasDia } from "../engine/oficinas";
import { aFecha, aISO, diaSemana, fmtDiaMes, hoyISO, lunesDe, minutosAhora, sumarDias } from "../fechas";
import { contextoSemana, fechaUltimaDemanda } from "./contexto";

interface Agregado {
  llegadas: number;
  atendidos: number;
  enObjetivo: number;
  espera: number;
  abandonados: number;
}
const vacio = (): Agregado => ({ llegadas: 0, atendidos: 0, enObjetivo: 0, espera: 0, abandonados: 0 });

function metricas(a: Agregado) {
  return {
    servicio: a.atendidos ? a.enObjetivo / a.atendidos : 0,
    espera: a.atendidos ? a.espera / a.atendidos : 0,
    abandono: a.llegadas ? a.abandonados / a.llegadas : 0,
  };
}

export async function datosTablero(oficinaGrafico?: string) {
  const hoy = hoyISO();
  const ahora = minutosAhora();
  const ultima = (await fechaUltimaDemanda()) ?? hoy;
  const ref = ultima >= hoy ? hoy : ultima; // día de referencia de los datos de Digiturno
  const esHoy = ref === hoy;
  const horaCorte = esHoy ? Math.floor(ahora / 60) : 24;
  const lunes = lunesDe(hoy);
  const ctx = await contextoSemana(lunes);
  const motor = obtenerMotor();

  // ---- disponibilidad de personal
  const semanaPasada = sumarDias(hoy, -7);
  const [turnosPasados, ausHoy, ausPasada, colaboradores] = await Promise.all([
    db.turno.findMany({ where: { fecha: aFecha(semanaPasada), estado: { not: "LIBERADO" } }, select: { usuarioId: true } }),
    db.excusa.count({ where: { estado: "APROBADA", fechaInicio: { lte: aFecha(hoy) }, fechaFin: { gte: aFecha(hoy) } } }),
    db.excusa.count({ where: { estado: "APROBADA", fechaInicio: { lte: aFecha(semanaPasada) }, fechaFin: { gte: aFecha(semanaPasada) } } }),
    db.usuario.count({ where: { rol: "COLABORADOR", activo: true } }),
  ]);
  const turnosHoy = ctx.turnos.filter((t) => t.fecha === hoy);
  const enTurno = new Set(turnosHoy.map((t) => t.usuarioId)).size;
  const enTurnoPasado = new Set(turnosPasados.map((t) => t.usuarioId)).size;

  // ---- comportamiento de usuarios (Digiturno) del día de referencia vs. promedio de 4 semanas
  const fechasComparar = [1, 2, 3, 4].map((k) => sumarDias(ref, -7 * k));
  const filas = await db.demandaHora.findMany({
    where: { fecha: { in: [ref, ...fechasComparar].map(aFecha) } },
    select: { oficinaId: true, fecha: true, hora: true, llegadas: true, atendidos: true, enObjetivo: true, sumaEsperaSeg: true, abandonados: true },
  });
  const total = vacio();
  const totalPrev = vacio();
  const porOficina = new Map<string, Agregado>();
  const llegadasHora = new Map<string, { hoy: number[]; prom: number[] }>();
  for (const f of filas) {
    const fecha = aISO(f.fecha);
    const deRef = fecha === ref;
    const g = llegadasHora.get(f.oficinaId) ?? { hoy: new Array(24).fill(0), prom: new Array(24).fill(0) };
    if (deRef) g.hoy[f.hora] += f.llegadas;
    else g.prom[f.hora] += f.llegadas / fechasComparar.length;
    llegadasHora.set(f.oficinaId, g);
    if (f.hora >= horaCorte) continue;
    const acc = deRef ? total : totalPrev;
    acc.llegadas += f.llegadas;
    acc.atendidos += f.atendidos;
    acc.enObjetivo += f.enObjetivo;
    acc.espera += f.sumaEsperaSeg;
    acc.abandonados += f.abandonados;
    if (deRef) {
      const o = porOficina.get(f.oficinaId) ?? vacio();
      o.llegadas += f.llegadas;
      o.atendidos += f.atendidos;
      o.enObjetivo += f.enObjetivo;
      o.espera += f.sumaEsperaSeg;
      o.abandonados += f.abandonados;
      porOficina.set(f.oficinaId, o);
    }
  }
  const m = metricas(total);
  const mp = metricas(totalPrev);

  // ---- carga operativa por oficina (Erlang C con la malla de hoy)
  const carga = ctx.oficinas
    .map((o) => {
      const perfil = ctx.demanda[o.id];
      const cov = coberturaPorHora(ctx.turnos, o.id, hoy);
      const horas = horasDelDia(o, hoy);
      const deficit: { hora: number; faltan: number }[] = [];
      for (const h of horas) {
        const l = lambdaDe(perfil, hoy, h);
        if (h * 60 + 59 < ahora) continue;
        const req = Math.max(1, personasRequeridas(l, perfil?.ahtSeg ?? 360, ctx.parametros.servicioObjetivo, ctx.parametros.tiempoObjetivoSeg, o.capacidad));
        if (req > cov[h]) deficit.push({ hora: h, faltan: req - cov[h] });
      }
      const uso = horas.length ? metricasDia(o, perfil, hoy, cov, ctx.parametros).uso : 0;
      const a = porOficina.get(o.id) ?? vacio();
      const personasHoy = new Set(turnosHoy.filter((t) => t.oficinaId === o.id).map((t) => t.usuarioId)).size;
      const equipo = ctx.personas.filter((p) => p.oficinaId === o.id).length;
      return { oficina: o, uso, abierta: horas.length > 0, deficit, espera: metricas(a).espera, abandonados: a.abandonados, personasHoy, equipo };
    })
    .sort((a, b) => b.uso - a.uso);

  // ---- la decisión del día: el bloque con más faltantes desde ahora
  let decision: null | { oficinaId: string; oficina: string; faltan: number; desde: number; hasta: number; cobertura: string | null } = null;
  for (const c of carga) {
    if (!c.deficit.length) continue;
    const max = Math.max(...c.deficit.map((d) => d.faltan));
    const horas = c.deficit.filter((d) => d.faltan === max).map((d) => d.hora);
    const ini = horas[0];
    let fin = ini + 1;
    while (horas.includes(fin)) fin++;
    if (!decision || max > decision.faltan) decision = { oficinaId: c.oficina.id, oficina: c.oficina.nombre, faltan: max, desde: ini, hasta: fin, cobertura: null };
  }
  if (decision) {
    const sug = motor
      .sugerirApoyos({ dias: [hoy], desdeMinuto: ahora, turnos: ctx.turnos, oficinas: ctx.oficinas, personas: ctx.personas, ausencias: ctx.ausencias, demanda: ctx.demanda, parametros: ctx.parametros })
      .filter((s) => s.haciaOficinaId === decision!.oficinaId);
    if (sug.length) {
      const nombres = sug.slice(0, 2).map((s) => {
        const desde = ctx.oficinas.find((o) => o.id === s.desdeOficinaId)?.nombre;
        return `${s.nombre}${s.modalidad === "VIRTUAL" ? ` (virtual desde ${desde})` : ` (desde ${desde})`}`;
      });
      decision.cobertura = nombres.join(" y ");
    }
  }

  // ---- gráfico de llegadas
  const oficinaSel = oficinaGrafico && ctx.oficinas.some((o) => o.id === oficinaGrafico) ? oficinaGrafico : (decision?.oficinaId ?? carga[0]?.oficina.id);
  const serie = llegadasHora.get(oficinaSel ?? "") ?? { hoy: new Array(24).fill(0), prom: new Array(24).fill(0) };
  const oficinaObj = ctx.oficinas.find((o) => o.id === oficinaSel);
  const horasGrafico = oficinaObj ? horasDelDia(oficinaObj, ref).length ? horasDelDia(oficinaObj, ref) : [8, 9, 10, 11, 12, 13, 14, 15, 16] : [8, 9, 10, 11, 12, 13, 14, 15, 16];
  const grafico = horasGrafico.map((h) => ({ hora: h, hoy: esHoy && h >= horaCorte ? null : serie.hoy[h], prom: Math.round(serie.prom[h] * 10) / 10 }));

  // ---- panel derecho
  const [pendiente, recientes, apoyos, ultimoEnvio, porRevisar] = await Promise.all([
    db.excusa.findFirst({ where: { estado: "PENDIENTE" }, orderBy: { creadoEn: "desc" }, include: { usuario: { include: { oficina: true } } } }),
    db.excusa.findMany({ orderBy: { creadoEn: "desc" }, take: 3, include: { usuario: true } }),
    db.apoyo.findMany({ where: { estado: "APLICADO" }, orderBy: { creadoEn: "desc" }, take: 1, include: { usuario: true, haciaOficina: true } }),
    db.notificacion.findFirst({ where: { tipo: "HORARIO_SEMANAL" }, orderBy: { fechaEnvio: "desc" } }),
    db.excusa.findMany({ where: { estado: "PENDIENTE" }, orderBy: { creadoEn: "desc" }, take: 5, include: { usuario: true } }),
  ]);
  let envio = null;
  if (ultimoEnvio?.semana) {
    const del = await db.notificacion.groupBy({ by: ["estado"], where: { tipo: "HORARIO_SEMANAL", semana: ultimoEnvio.semana }, _count: true });
    const enviados = del.find((d) => d.estado === "ENVIADO")?._count ?? 0;
    const errores = del.find((d) => d.estado === "ERROR")?._count ?? 0;
    envio = { semana: ultimoEnvio.semana, fecha: ultimoEnvio.fechaEnvio, enviados, total: enviados + errores, errores };
  }

  return {
    hoy,
    ref,
    esHoy,
    refTexto: fmtDiaMes(ref),
    diaSemana: diaSemana(hoy),
    kpis: {
      enTurno,
      colaboradores,
      deltaTurno: enTurno - enTurnoPasado,
      ausencias: ausHoy,
      deltaAusencias: ausHoy - ausPasada,
      servicio: m.servicio,
      deltaServicio: m.servicio - mp.servicio,
      espera: m.espera,
      deltaEspera: m.espera - mp.espera,
      abandono: m.abandono,
      deltaAbandono: m.abandono - mp.abandono,
      hayDatos: total.llegadas > 0,
    },
    decision,
    grafico,
    oficinaGrafico: oficinaSel,
    oficinas: ctx.oficinas.map((o) => ({ id: o.id, nombre: o.nombre })),
    carga,
    pendiente,
    recientes,
    porRevisar,
    apoyo: apoyos[0] ?? null,
    envio,
  };
}
