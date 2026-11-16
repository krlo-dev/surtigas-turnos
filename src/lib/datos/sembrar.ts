// Datos de demostración del prototipo (TLR 6). Todo es simulado: oficinas, personas y demanda.
// Lo usan el script `npm run db:seed` y la ruta protegida /api/demo/sembrar.

import type { TipoExcusa } from "@prisma/client";
import bcrypt from "bcryptjs";
import { db } from "../db";
import { aFecha, diaSemana, hoyISO, lunesDe, minutosAhora, rangoDias, semanaISO, sumarDias } from "../fechas";
import { ADMIN_SEED, OFICINAS_SEED, PERSONAS_SEED, correoDe } from "./catalogo";
import { generarHistorico } from "./sintetico";

const CONTRASENA_DEMO = process.env.SEED_PASSWORD || "Surtigas2026";

function enFechaHora(fecha: string, hhmm: string) {
  // hora de Colombia (UTC-5, sin horario de verano)
  return new Date(`${fecha}T${hhmm}:00.000-05:00`);
}

/** n-ésimo día hábil (lunes a sábado) contado desde una fecha, sin incluirla. */
function habilDesde(fecha: string, n: number) {
  let d = fecha;
  let k = 0;
  while (k < n) {
    d = sumarDias(d, 1);
    if (diaSemana(d) !== 0) k++;
  }
  return d;
}
function habilAntes(fecha: string, n: number) {
  let d = fecha;
  let k = 0;
  while (k < n) {
    d = sumarDias(d, -1);
    if (diaSemana(d) !== 0) k++;
  }
  return d;
}

/** Borra la base y carga los datos de demostración. Devuelve un resumen. */
export async function sembrarDemo(registrar: (m: string) => void = () => {}) {
  const hoy = hoyISO();
  const lunes = lunesDe(hoy);
  const ahoraMin = minutosAhora();
  registrar(`Sembrando datos para la semana ${semanaISO(lunes)} (hoy ${hoy})…`);

  await db.$transaction([
    db.historialExcusa.deleteMany(),
    db.apoyo.deleteMany(),
    db.turno.deleteMany(),
    db.corrida.deleteMany(),
    db.excusa.deleteMany(),
    db.notificacion.deleteMany(),
    db.tokenRecuperacion.deleteMany(),
    db.demandaHora.deleteMany(),
    db.operacionHora.deleteMany(),
    db.importacion.deleteMany(),
    db.configuracion.deleteMany(),
    db.usuario.deleteMany(),
    db.oficina.deleteMany(),
  ]);

  // Oficinas
  const oficinaId = new Map<string, string>();
  for (const o of OFICINAS_SEED) {
    const r = await db.oficina.create({
      data: { nombre: o.nombre, ciudad: o.ciudad, zona: o.zona, capacidad: o.capacidad, atencionVirtual: o.atencionVirtual, abreSabado: o.abreSabado, codigoDigiturno: o.codigoDigiturno ?? null },
    });
    oficinaId.set(o.clave, r.id);
  }

  // Personas
  const hash = await bcrypt.hash(CONTRASENA_DEMO, 10);
  const admin = await db.usuario.create({ data: { nombre: ADMIN_SEED.nombre, correo: ADMIN_SEED.correo, passwordHash: hash, rol: "ADMIN", horasSemana: 0 } });
  const persona = new Map<string, { id: string; oficinaId: string; correo: string }>();
  for (const p of PERSONAS_SEED) {
    const r = await db.usuario.create({ data: { nombre: p.nombre, correo: correoDe(p.nombre), passwordHash: hash, rol: "COLABORADOR", oficinaId: oficinaId.get(p.oficina)!, horasSemana: p.horasSemana } });
    persona.set(p.nombre, { id: r.id, oficinaId: r.oficinaId!, correo: r.correo });
  }
  const P = (n: string) => persona.get(n)!;

  // Histórico sintético: 9 semanas completas + la semana en curso hasta la hora actual
  const desde = sumarDias(lunes, -63);
  const fechas = rangoDias(desde, hoy);
  let total = 0;
  for (const [i, o] of OFICINAS_SEED.entries()) {
    const { filas, operacion } = generarHistorico(o, fechas, 1000 + i * 17, { fecha: hoy, minuto: ahoraMin });
    const id = oficinaId.get(o.clave)!;
    for (let k = 0; k < filas.length; k += 4000) {
      await db.demandaHora.createMany({
        data: filas.slice(k, k + 4000).map((f) => ({ ...f, oficinaId: id, fecha: aFecha(f.fecha), fuente: "sintetico" })),
      });
    }
    await db.operacionHora.createMany({ data: operacion.map((x) => ({ ...x, oficinaId: id, fecha: aFecha(x.fecha) })) });
    total += filas.length;
  }
  registrar(`  ${total} filas de demanda agregada`);

  // Excusas históricas y pendientes (códigos como en los mockups)
  type Ex = { codigo: number; nombre: string; tipo: TipoExcusa; desde: string; hasta: string; motivo: string; estado: "PENDIENTE" | "APROBADA" | "RECHAZADA"; creada: Date; comentario?: string; soporte?: boolean; canal?: string };
  const t912 = ahoraMin > 9 * 60 + 12 ? enFechaHora(hoy, "09:12") : enFechaHora(sumarDias(hoy, -1), "09:12");
  const excusas: Ex[] = [
    { codigo: 1820, nombre: "Jorge Medina", tipo: "INCAPACIDAD", desde: sumarDias(lunes, -126 + 2), hasta: sumarDias(lunes, -126 + 4), motivo: "Soporte EPS", estado: "APROBADA", creada: enFechaHora(sumarDias(lunes, -127), "08:40"), comentario: "Recupérate pronto.", soporte: true },
    { codigo: 1974, nombre: "Jorge Medina", tipo: "EXCUSA", desde: sumarDias(lunes, -45), hasta: sumarDias(lunes, -45), motivo: "Problema de transporte", estado: "RECHAZADA", creada: enFechaHora(sumarDias(lunes, -45), "07:55"), comentario: "Falta el soporte. Repórtala de nuevo con el comprobante, por favor." },
    { codigo: 2012, nombre: "Jorge Medina", tipo: "PERMISO", desde: sumarDias(lunes, -25), hasta: sumarDias(lunes, -25), motivo: "Diligencia personal", estado: "APROBADA", creada: enFechaHora(sumarDias(lunes, -28), "16:20"), comentario: "Listo Jorge, quedó aprobado. Éxitos con la diligencia." },
    { codigo: 2035, nombre: "Andrés Julio", tipo: "EXCUSA", desde: habilAntes(hoy, 4), hasta: habilAntes(hoy, 4), motivo: "Se me varó la moto camino a la oficina.", estado: "RECHAZADA", creada: enFechaHora(habilAntes(hoy, 4), "07:30"), comentario: "Necesitamos un soporte del taller para aprobarla." },
    { codigo: 2036, nombre: "Daniela Pérez", tipo: "PERMISO", desde: habilAntes(hoy, 3), hasta: habilAntes(hoy, 3), motivo: "Cita médica de control.", estado: "APROBADA", creada: enFechaHora(habilAntes(hoy, 4), "15:02"), comentario: "Aprobado, que te vaya bien." },
    { codigo: 2037, nombre: "Carlos Rúa", tipo: "INCAPACIDAD", desde: lunes, hasta: sumarDias(lunes, 5), motivo: "Incapacidad por cirugía ambulatoria. Adjunto la orden médica.", estado: "PENDIENTE", creada: enFechaHora(habilAntes(hoy, 2), "10:05"), soporte: true },
    { codigo: 2038, nombre: "Sofía Meza", tipo: "PERMISO", desde: sumarDias(lunes, 7), hasta: sumarDias(lunes, 8), motivo: "Grado de mi hermana en Medellín.", estado: "PENDIENTE", creada: enFechaHora(habilAntes(hoy, 2), "11:40") },
    { codigo: 2039, nombre: "Luis Barrios", tipo: "EXCUSA", desde: habilAntes(hoy, 1), hasta: habilAntes(hoy, 1), motivo: "Llegué tarde por un cierre de la vía Turbaco–Cartagena.", estado: "PENDIENTE", creada: enFechaHora(habilAntes(hoy, 1), "13:15") },
    { codigo: 2040, nombre: "Ana Cárdenas", tipo: "PERMISO", desde: habilDesde(hoy, 2), hasta: habilDesde(hoy, 2), motivo: "Trámite en la notaría en la mañana.", estado: "PENDIENTE", creada: enFechaHora(sumarDias(hoy, -1), "17:48") },
    { codigo: 2041, nombre: "Jorge Medina", tipo: "INCAPACIDAD", desde: habilDesde(hoy, 1), hasta: habilDesde(hoy, 2), motivo: "Tengo incapacidad médica por una infección respiratoria. Adjunto el soporte de la EPS con el número de radicado.", estado: "PENDIENTE", creada: t912, soporte: true, canal: "movil" },
  ];
  for (const e of excusas) {
    const p = P(e.nombre);
    const resuelta = e.estado !== "PENDIENTE";
    const resueltoEn = resuelta ? new Date(e.creada.getTime() + 3 * 3600_000) : null;
    await db.excusa.create({
      data: {
        codigo: e.codigo,
        usuarioId: p.id,
        tipo: e.tipo,
        fechaInicio: aFecha(e.desde),
        fechaFin: aFecha(e.hasta),
        motivo: e.motivo,
        estado: e.estado,
        canal: e.canal ?? "web",
        creadoEn: e.creada,
        resueltoEn,
        revisadoPorId: resuelta ? admin.id : null,
        comentarioResolucion: e.comentario ?? null,
        ...(e.soporte ? { soporteUrl: "/demo/soporte-ejemplo.pdf", soporteNombre: e.tipo === "INCAPACIDAD" ? "incapacidad_EPS.pdf" : "soporte.pdf", soporteBytes: 245_760 } : {}),
        historial: {
          create: [
            { estado: "PENDIENTE", evento: "registrada", autorId: p.id, nota: e.canal === "movil" ? "desde el celular" : "desde la web", creadoEn: e.creada },
            { estado: "PENDIENTE", evento: "aviso_enviado", nota: "entregado", creadoEn: e.creada },
            ...(resuelta ? [{ estado: e.estado, evento: e.estado === "APROBADA" ? "aprobada" : "rechazada", autorId: admin.id, nota: e.comentario ?? null, creadoEn: resueltoEn! }] : []),
          ],
        },
      },
    });
    await db.notificacion.create({ data: { tipo: "NUEVA_EXCUSA", destinatarioId: admin.id, correoDestino: admin.correo, enviadoA: admin.correo, asunto: `${e.nombre} reportó ${e.tipo === "INCAPACIDAD" ? "una incapacidad" : e.tipo === "PERMISO" ? "un permiso" : "una excusa"}`, estado: "ENVIADO", referencia: `EX-${e.codigo}`, fechaEnvio: e.creada } });
    if (resuelta)
      await db.notificacion.create({ data: { tipo: "RESOLUCION_EXCUSA", destinatarioId: p.id, correoDestino: p.correo, enviadoA: p.correo, asunto: `Tu ${e.tipo.toLowerCase()} del ${e.desde.slice(8)} fue ${e.estado === "APROBADA" ? "aprobad" : "rechazad"}${e.tipo === "PERMISO" ? "o" : "a"}`, estado: "ENVIADO", referencia: `EX-${e.codigo}`, fechaEnvio: resueltoEn! } });
  }
  await db.$executeRawUnsafe(`SELECT setval('"Excusa_codigo_seq"', (SELECT MAX(codigo) FROM "Excusa"))`);

  // Mallas: semana anterior y semana actual con el motor; propuesta en borrador para la siguiente
  await db.$executeRawUnsafe(`SELECT setval('"Corrida_numero_seq"', 82)`);
  const { generarPropuesta, confirmarPropuesta } = await import("../servicios/malla");
  for (const semana of [sumarDias(lunes, -7), lunes]) {
    const c = await generarPropuesta(semana, admin.id);
    await confirmarPropuesta(c.id, "A");
  }
  await generarPropuesta(sumarDias(lunes, 7), admin.id);

  // Ajustes manuales de ejemplo en Cartagena Centro (uno ya publicado, uno sin publicar)
  const centro = oficinaId.get("ctg-centro")!;
  const ana = P("Ana Cárdenas");
  const martes = sumarDias(lunes, 1);
  const turnoAna = await db.turno.findFirst({ where: { usuarioId: ana.id, fecha: aFecha(martes) } });
  if (turnoAna) await db.turno.update({ where: { id: turnoAna.id }, data: { estado: "MANUAL", origen: "MANUAL", horaInicio: 10 * 60, horaFin: 15 * 60 } });
  const sabado = sumarDias(lunes, 5);
  const yaSab = await db.turno.findFirst({ where: { usuarioId: ana.id, fecha: aFecha(sabado) } });
  if (!yaSab) await db.turno.create({ data: { usuarioId: ana.id, oficinaId: centro, fecha: aFecha(sabado), horaInicio: 8 * 60, horaFin: 12 * 60, estado: "MANUAL", origen: "MANUAL", publicado: false } });
  else await db.turno.update({ where: { id: yaSab.id }, data: { estado: "MANUAL", origen: "MANUAL", publicado: false } });

  // Escenario del día: un permiso aprobado esta mañana en Cartagena Centro deja un recálculo por aplicar
  const { recalcularPorAusencia } = await import("../servicios/excusas");
  const valentina = P("Valentina Orozco");
  if (diaSemana(hoy) !== 0) {
    const creada = enFechaHora(hoy, "07:05");
    const ex = await db.excusa.create({
      data: {
        codigo: 2034,
        usuarioId: valentina.id,
        tipo: "PERMISO",
        fechaInicio: aFecha(hoy),
        fechaFin: aFecha(hoy),
        motivo: "Me llamaron del colegio de mi hijo, tengo que ir en la mañana.",
        estado: "APROBADA",
        revisadoPorId: admin.id,
        comentarioResolucion: "Tranquila, ya te cubrimos.",
        creadoEn: creada,
        resueltoEn: enFechaHora(hoy, "07:20"),
        historial: {
          create: [
            { estado: "PENDIENTE", evento: "registrada", autorId: valentina.id, nota: "desde el celular", creadoEn: creada },
            { estado: "PENDIENTE", evento: "aviso_enviado", nota: "entregado", creadoEn: creada },
            { estado: "APROBADA", evento: "aprobada", autorId: admin.id, nota: "Tranquila, ya te cubrimos.", creadoEn: enFechaHora(hoy, "07:20") },
          ],
        },
      },
    });
    await recalcularPorAusencia(ex, admin.id);
  }

  // Bitácora del último envío semanal (domingo anterior a las 18:00)
  const domingoAnterior = sumarDias(lunes, -1);
  const semanaAnterior = semanaISO(lunes);
  const fallan = new Map([["Kevin Arrieta", "Rebotó: el buzón no existe"], ["Camilo Herrera", "Buzón lleno"]]);
  for (const p of PERSONAS_SEED) {
    const x = P(p.nombre);
    const err = fallan.get(p.nombre);
    await db.notificacion.create({
      data: { tipo: "HORARIO_SEMANAL", destinatarioId: x.id, correoDestino: x.correo, enviadoA: x.correo, asunto: `Tu horario · semana ${semanaAnterior}`, estado: err ? "ERROR" : "ENVIADO", error: err ?? null, semana: semanaAnterior, fechaEnvio: enFechaHora(domingoAnterior, "18:00") },
    });
  }

  registrar(`Listo. Usuarios demo (contraseña "${CONTRASENA_DEMO}"): ${ADMIN_SEED.correo} (administradora) y ${P("Jorge Medina").correo} (colaborador).`);
  return { semana: semanaISO(lunes), filasDemanda: total, usuarios: PERSONAS_SEED.length + 1 };
}
