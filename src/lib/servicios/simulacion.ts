// Mantiene vivo el prototipo con datos simulados: completa la demanda sintética hasta la hora actual
// y genera la malla de la semana en curso si todavía no existe. Se apaga al importar datos reales.

import { db } from "../db";
import { OFICINAS_SEED } from "../datos/catalogo";
import { generarHistorico } from "../datos/sintetico";
import { hashTexto } from "../engine/aleatorio";
import { aFecha, aISO, hoyISO, lunesDe, minutosAhora, rangoDias, sumarDias } from "../fechas";
import { confirmarPropuesta, generarPropuesta } from "./malla";

let ultimaRevision = 0;

export async function simulacionActiva() {
  const c = await db.configuracion.findUnique({ where: { clave: "simulacionActiva" } });
  return c ? c.valor !== false : true;
}

export async function asegurarSimulacionAlDia(forzar = false) {
  if (!forzar && Date.now() - ultimaRevision < 10 * 60_000) return;
  ultimaRevision = Date.now();
  try {
    if (!(await simulacionActiva())) return;
    const hoy = hoyISO();
    const minuto = minutosAhora();
    const oficinas = await db.oficina.findMany({ where: { activa: true } });
    for (const o of oficinas) {
      const seed = OFICINAS_SEED.find((s) => s.nombre === o.nombre);
      if (!seed) continue;
      const ultima = await db.demandaHora.aggregate({ where: { oficinaId: o.id, fuente: "sintetico" }, _max: { fecha: true } });
      if (!ultima._max.fecha) continue;
      const desde = aISO(ultima._max.fecha) >= hoy ? hoy : sumarDias(aISO(ultima._max.fecha), 1);
      for (const fecha of rangoDias(desde, hoy)) {
        const { filas, operacion } = generarHistorico({ ...seed, abreSabado: o.abreSabado }, [fecha], hashTexto(o.id + fecha), { fecha: hoy, minuto });
        await db.demandaHora.deleteMany({ where: { oficinaId: o.id, fecha: aFecha(fecha), fuente: "sintetico" } });
        await db.operacionHora.deleteMany({ where: { oficinaId: o.id, fecha: aFecha(fecha) } });
        if (filas.length) await db.demandaHora.createMany({ data: filas.map((f) => ({ ...f, oficinaId: o.id, fecha: aFecha(f.fecha), fuente: "sintetico" })) });
        if (operacion.length) await db.operacionHora.createMany({ data: operacion.map((x) => ({ ...x, oficinaId: o.id, fecha: aFecha(x.fecha) })) });
      }
    }
    const lunes = lunesDe(hoy);
    const turnos = await db.turno.count({ where: { fecha: { gte: aFecha(lunes), lte: aFecha(sumarDias(lunes, 6)) } } });
    if (turnos === 0) {
      const c = await generarPropuesta(lunes, null);
      const r = c.resultado as unknown as { elegida: "A" | "B" };
      await confirmarPropuesta(c.id, r.elegida);
    }
  } catch (e) {
    console.error("No se pudo actualizar la simulación", e);
  }
}
