// Importa el export de Digiturno desde la línea de comandos (alternativa a la pantalla "Datos Digiturno").
// Uso: npm run importar -- ruta/al/archivo.csv
// Solo guarda totales por oficina, día, hora, fila y servicio. No guarda datos personales.

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { createReadStream, openSync, readSync, closeSync } from "node:fs";
import { createInterface } from "node:readline";
import { AgregadorDigiturno } from "../src/lib/datos/digiturno";
import { aFecha } from "../src/lib/fechas";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

function codificacion(ruta: string): BufferEncoding {
  const fd = openSync(ruta, "r");
  const buf = Buffer.alloc(256 * 1024);
  const n = readSync(fd, buf, 0, buf.length, 0);
  closeSync(fd);
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buf.subarray(0, n));
    return "utf8";
  } catch {
    return "latin1";
  }
}

async function main() {
  const ruta = process.argv[2];
  if (!ruta) throw new Error("Indica la ruta del CSV: npm run importar -- archivo.csv");
  const ag = new AgregadorDigiturno();
  let sep: string | null = null;
  const rl = createInterface({ input: createReadStream(ruta, { encoding: codificacion(ruta) }), crlfDelay: Infinity });
  for await (const linea of rl) {
    if (!linea.trim()) continue;
    if (!sep) {
      sep = linea.includes("\t") ? "\t" : ";";
      const faltan = ag.encabezado(linea.split(sep));
      if (faltan.length) throw new Error(`Faltan columnas de Digiturno: ${faltan.join(", ")}`);
      continue;
    }
    ag.fila(linea.split(sep));
    if (ag.registros % 50000 === 0) console.log(`  ${ag.registros} registros leídos…`);
  }
  const r = ag.resumen();
  if (!r.desde || !r.hasta) throw new Error("No se encontraron turnos.");
  console.log(`${r.registros} turnos del ${r.desde} al ${r.hasta} en ${r.oficinas.length} oficinas.`);

  const ids = new Map<number, string>();
  for (const o of r.oficinas) {
    const existente = await db.oficina.findUnique({ where: { codigoDigiturno: o.codigo } });
    const of = existente ?? (await db.oficina.create({ data: { nombre: o.nombre, ciudad: o.ciudad || o.nombre, zona: o.departamento || o.ciudad || "Sin zona", capacidad: Math.max(1, o.terminales), codigoDigiturno: o.codigo } }));
    ids.set(o.codigo, of.id);
    console.log(`  ${o.codigo} ${o.nombre} → ${of.nombre}${existente ? "" : " (nueva)"}`);
  }
  await db.demandaHora.deleteMany({ where: { fuente: "sintetico" } });
  await db.operacionHora.deleteMany({});
  const where = { oficinaId: { in: [...ids.values()] }, fecha: { gte: aFecha(r.desde), lte: aFecha(r.hasta) } };
  await db.demandaHora.deleteMany({ where });
  for (let i = 0; i < r.demanda.length; i += 5000)
    await db.demandaHora.createMany({ data: r.demanda.slice(i, i + 5000).map(({ codigoOficina, fecha, ...x }) => ({ ...x, oficinaId: ids.get(codigoOficina)!, fecha: aFecha(fecha), fuente: "digiturno" })) });
  for (let i = 0; i < r.operacion.length; i += 5000)
    await db.operacionHora.createMany({ data: r.operacion.slice(i, i + 5000).map(({ codigoOficina, fecha, ...x }) => ({ ...x, oficinaId: ids.get(codigoOficina)!, fecha: aFecha(fecha) })), skipDuplicates: true });
  await db.configuracion.upsert({ where: { clave: "simulacionActiva" }, create: { clave: "simulacionActiva", valor: false }, update: { valor: false } });
  await db.importacion.create({ data: { archivo: ruta.split(/[\\/]/).pop() ?? ruta, filas: r.registros, desde: aFecha(r.desde), hasta: aFecha(r.hasta), oficinas: r.oficinas.length } });
  console.log("Listo. La simulación diaria quedó apagada; el motor usará este histórico.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
