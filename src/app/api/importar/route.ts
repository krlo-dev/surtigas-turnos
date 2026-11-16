import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { aFecha } from "@/lib/fechas";

// Recibe el histórico de Digiturno ya agregado en el navegador (sin datos personales), por lotes.

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const inicio = z.object({
  paso: z.literal("inicio"),
  reemplazarSimulado: z.boolean().default(true),
  desde: fecha,
  hasta: fecha,
  mapeo: z.array(z.object({ codigo: z.number().int(), oficinaId: z.string().nullable(), nombre: z.string(), ciudad: z.string(), zona: z.string(), puestos: z.number().int().min(1) })),
});
const lote = z.object({
  paso: z.literal("lote"),
  demanda: z.array(z.object({ codigoOficina: z.number().int(), fecha, hora: z.number().int().min(0).max(23), fila: z.enum(["GENERAL", "PREFERENCIAL"]), servicio: z.string().max(80), llegadas: z.number().int(), atendidos: z.number().int(), abandonados: z.number().int(), cancelados: z.number().int(), sumaEsperaSeg: z.number().int(), sumaAtencionSeg: z.number().int(), atencionesConTiempo: z.number().int(), enObjetivo: z.number().int() })).max(5000),
  operacion: z.array(z.object({ codigoOficina: z.number().int(), fecha, hora: z.number().int(), operadores: z.number().int(), terminales: z.number().int() })).max(5000),
});
const fin = z.object({ paso: z.literal("fin"), archivo: z.string().max(200), registros: z.number().int(), desde: fecha, hasta: fecha, oficinas: z.number().int() });

export async function POST(req: Request) {
  const s = await auth();
  if (s?.user?.rol !== "ADMIN") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const cuerpo = await req.json();

  if (cuerpo.paso === "inicio") {
    const d = inicio.parse(cuerpo);
    if (d.reemplazarSimulado) {
      // con datos reales, el histórico sintético deja de usarse y la simulación diaria se apaga
      await db.demandaHora.deleteMany({ where: { fuente: "sintetico" } });
      await db.operacionHora.deleteMany({});
      await db.configuracion.upsert({ where: { clave: "simulacionActiva" }, create: { clave: "simulacionActiva", valor: false }, update: { valor: false } });
    }
    const ids: number[] = [];
    for (const m of d.mapeo) {
      if (m.oficinaId) {
        await db.oficina.updateMany({ where: { codigoDigiturno: m.codigo, NOT: { id: m.oficinaId } }, data: { codigoDigiturno: null } });
        await db.oficina.update({ where: { id: m.oficinaId }, data: { codigoDigiturno: m.codigo } });
      } else {
        const existente = await db.oficina.findUnique({ where: { codigoDigiturno: m.codigo } });
        if (!existente) await db.oficina.create({ data: { nombre: m.nombre, ciudad: m.ciudad || m.nombre, zona: m.zona || m.ciudad || "Sin zona", capacidad: m.puestos, codigoDigiturno: m.codigo } });
      }
      ids.push(m.codigo);
    }
    const oficinas = await db.oficina.findMany({ where: { codigoDigiturno: { in: ids } }, select: { id: true } });
    // el rango importado reemplaza lo que hubiera (sintético o de una importación anterior)
    const where = { oficinaId: { in: oficinas.map((o) => o.id) }, fecha: { gte: aFecha(d.desde), lte: aFecha(d.hasta) } };
    await db.demandaHora.deleteMany({ where });
    await db.operacionHora.deleteMany({ where });
    return NextResponse.json({ ok: true });
  }

  if (cuerpo.paso === "lote") {
    const d = lote.parse(cuerpo);
    const oficinas = await db.oficina.findMany({ where: { codigoDigiturno: { not: null } }, select: { id: true, codigoDigiturno: true } });
    const id = new Map(oficinas.map((o) => [o.codigoDigiturno!, o.id]));
    await db.demandaHora.createMany({
      data: d.demanda.filter((x) => id.has(x.codigoOficina)).map(({ codigoOficina, fecha: f, ...x }) => ({ ...x, oficinaId: id.get(codigoOficina)!, fecha: aFecha(f), fuente: "digiturno" })),
      skipDuplicates: true,
    });
    await db.operacionHora.createMany({
      data: d.operacion.filter((x) => id.has(x.codigoOficina)).map(({ codigoOficina, fecha: f, ...x }) => ({ ...x, oficinaId: id.get(codigoOficina)!, fecha: aFecha(f) })),
      skipDuplicates: true,
    });
    return NextResponse.json({ ok: true });
  }

  if (cuerpo.paso === "fin") {
    const d = fin.parse(cuerpo);
    await db.importacion.create({ data: { archivo: d.archivo, filas: d.registros, desde: aFecha(d.desde), hasta: aFecha(d.hasta), oficinas: d.oficinas, autorId: s.user.id } });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Paso desconocido" }, { status: 400 });
}
