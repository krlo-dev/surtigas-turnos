import { OFICINAS_SEED, PERSONAS_SEED } from "../src/lib/datos/catalogo";
import { generarHistorico } from "../src/lib/datos/sintetico";
import { construirPerfil } from "../src/lib/datos/perfil";
import { ColasSimulacionEngine } from "../src/lib/engine/motor";
import { PARAMETROS_POR_DEFECTO, type OficinaMotor, type PersonaMotor } from "../src/lib/engine/tipos";
import { lunesDe, sumarDias, rangoDias, hoyISO, fmtDuracion } from "../src/lib/fechas";

const lunes = lunesDe(hoyISO());
const desde = sumarDias(lunes, -56);
const fechas = rangoDias(desde, sumarDias(lunes, -1));
const oficinas: OficinaMotor[] = OFICINAS_SEED.map(o => ({ id: o.clave, nombre: o.nombre, ciudad: o.ciudad, zona: o.zona, capacidad: o.capacidad, atencionVirtual: o.atencionVirtual, horaApertura: 8, horaCierre: 17, abreSabado: o.abreSabado, horaCierreSabado: 12 }));
const personas: PersonaMotor[] = PERSONAS_SEED.map((p, i) => ({ id: "p" + i, nombre: p.nombre, oficinaId: p.oficina, horasSemana: p.horasSemana }));
const demanda: Record<string, ReturnType<typeof construirPerfil>> = {};
let t0 = Date.now();
for (const o of OFICINAS_SEED) demanda[o.clave] = construirPerfil(o.clave, generarHistorico(o, fechas, 7).filas, 8);
console.log("perfiles", Date.now() - t0, "ms");
t0 = Date.now();
const motor = new ColasSimulacionEngine();
const r = motor.proponerSemana({ semanaInicio: lunes, oficinas, personas, ausencias: [], turnosFijos: [], demanda, parametros: PARAMETROS_POR_DEFECTO });
console.log("motor", Date.now() - t0, "ms elegida", r.elegida);
for (const a of r.alternativas) {
  console.log(a.id, (a.kpis.nivelServicio*100).toFixed(1)+"%", fmtDuracion(a.kpis.esperaPromSeg), "turnos", a.kpis.turnos, "personas", a.kpis.personas, "aband", (a.kpis.abandono*100).toFixed(1), "cortas", a.franjasCortas.length, "apoyos", a.turnos.filter(t=>t.tipo==="APOYO").length);
  for (const o of oficinas) { const k = a.kpisPorOficina[o.id]; console.log("   ", o.nombre.padEnd(22), (k.nivelServicio*100).toFixed(0)+"%", fmtDuracion(k.esperaPromSeg), k.turnos, k.horas+"h", "cortas", a.franjasCortas.filter(f=>f.oficinaId===o.id).length); }
}
