import { describe, expect, it } from "vitest";
import { OFICINAS_SEED, PERSONAS_SEED } from "../src/lib/datos/catalogo";
import { construirPerfil } from "../src/lib/datos/perfil";
import { generarHistorico } from "../src/lib/datos/sintetico";
import { erlangC, nivelServicio, personasRequeridas } from "../src/lib/engine/erlang";
import { ColasSimulacionEngine } from "../src/lib/engine/motor";
import { horasTrabajadas } from "../src/lib/engine/oficinas";
import { simularReplicas } from "../src/lib/engine/simulacion";
import { PARAMETROS_POR_DEFECTO, type OficinaMotor, type PersonaMotor, type PerfilDemanda } from "../src/lib/engine/tipos";
import { lunesDe, rangoDias, sumarDias } from "../src/lib/fechas";

const LUNES = lunesDe("2026-11-12");
const fechas = rangoDias(sumarDias(LUNES, -56), sumarDias(LUNES, -1));
const oficinas: OficinaMotor[] = OFICINAS_SEED.map((o) => ({
  id: o.clave, nombre: o.nombre, ciudad: o.ciudad, zona: o.zona, capacidad: o.capacidad,
  atencionVirtual: o.atencionVirtual, horaApertura: 8, horaCierre: 17, abreSabado: o.abreSabado, horaCierreSabado: 12,
}));
const personas: PersonaMotor[] = PERSONAS_SEED.map((p, i) => ({ id: `p${i}`, nombre: p.nombre, oficinaId: p.oficina, horasSemana: p.horasSemana }));
const demanda: Record<string, PerfilDemanda> = {};
for (const o of OFICINAS_SEED) demanda[o.clave] = construirPerfil(o.clave, generarHistorico(o, fechas, 7).filas, 8);
const par = { ...PARAMETROS_POR_DEFECTO, replicas: 5 };
const motor = new ColasSimulacionEngine();

describe("Erlang C", () => {
  it("coincide con el valor analítico de M/M/2 con carga 1", () => {
    expect(erlangC(2, 1)).toBeCloseTo(1 / 3, 6);
  });
  it("el nivel de servicio crece con más personas", () => {
    expect(nivelServicio(4, 30, 360, 300)).toBeGreaterThan(nivelServicio(3, 30, 360, 300));
  });
  it("las personas requeridas cumplen el objetivo", () => {
    const c = personasRequeridas(30, 360, 0.8, 300);
    expect(nivelServicio(c, 30, 360, 300)).toBeGreaterThanOrEqual(0.8);
    expect(nivelServicio(c - 1, 30, 360, 300)).toBeLessThan(0.8);
  });
});

describe("Simulación de eventos discretos", () => {
  it("no hay abandonos con paciencia infinita y todos son atendidos", () => {
    const lam = new Array(24).fill(0);
    const per = new Array(24).fill(0);
    for (let h = 8; h < 17; h++) { lam[h] = 20; per[h] = 4; }
    const r = simularReplicas({ horaApertura: 8, horaCierre: 17, llegadasPorHora: lam, personasPorHora: per, partePreferencial: 0.14, ahtGeneralSeg: 360, ahtPreferencialSeg: 400, pacienciaSeg: 1e9, tObjetivoSeg: 300, prioridadPreferencial: true }, 10, 1);
    expect(r.abandonados).toBe(0);
    expect(r.atendidos).toBeCloseTo(r.llegadas, 6);
    expect(r.llegadas).toBeGreaterThan(150);
  });
});

describe("Motor de asignación", () => {
  const jorge = personas[0];
  const ausencias = [{ usuarioId: jorge.id, desde: sumarDias(LUNES, 3), hasta: sumarDias(LUNES, 4) }];
  const fijo = { usuarioId: personas[1].id, oficinaId: "ctg-centro", fecha: sumarDias(LUNES, 5), inicio: 8 * 60, fin: 12 * 60, tipo: "MANUAL" as const, virtual: false, id: "manual-1" };
  const r = motor.proponerSemana({ semanaInicio: LUNES, oficinas, personas, ausencias, turnosFijos: [fijo], demanda, parametros: par });
  const elegida = r.alternativas.find((a) => a.id === r.elegida)!;

  it("propone dos mallas y elige una", () => {
    expect(r.alternativas).toHaveLength(2);
    expect(elegida.turnos.length).toBeGreaterThan(100);
  });
  it("respeta el tope legal de horas", () => {
    const horas = new Map<string, number>();
    for (const t of elegida.turnos) horas.set(t.usuarioId, (horas.get(t.usuarioId) ?? 0) + horasTrabajadas(t.inicio, t.fin));
    for (const [id, h] of horas) {
      const p = personas.find((x) => x.id === id)!;
      expect(h).toBeLessThanOrEqual(Math.min(p.horasSemana, par.maxHorasSemana));
    }
  });
  it("no asigna turnos en días de ausencia", () => {
    expect(elegida.turnos.some((t) => t.usuarioId === jorge.id && t.fecha >= ausencias[0].desde && t.fecha <= ausencias[0].hasta)).toBe(false);
  });
  it("conserva los ajustes manuales", () => {
    expect(elegida.turnos.some((t) => t.id === "manual-1" && t.inicio === fijo.inicio && t.fin === fijo.fin)).toBe(true);
  });
  it("una persona tiene como máximo un turno por día", () => {
    const vistos = new Set<string>();
    for (const t of elegida.turnos) {
      const k = `${t.usuarioId}|${t.fecha}`;
      expect(vistos.has(k)).toBe(false);
      vistos.add(k);
    }
  });

  it("recalcula la cobertura de una ausencia (RF-06)", () => {
    const sinAusencia = motor.proponerSemana({ semanaInicio: LUNES, oficinas, personas, ausencias: [], turnosFijos: [], demanda, parametros: par });
    const turnos = sinAusencia.alternativas[0].turnos.map((t, i) => ({ ...t, id: `t${i}` }));
    const deJorge = turnos.filter((t) => t.usuarioId === jorge.id && (t.fecha === ausencias[0].desde || t.fecha === ausencias[0].hasta));
    expect(deJorge.length).toBeGreaterThan(0);
    const res = motor.cubrirAusencia({
      liberados: deJorge.map((t) => ({ turnoId: t.id, usuarioId: jorge.id, nombre: jorge.nombre, oficinaId: t.oficinaId, fecha: t.fecha, inicio: t.inicio, fin: t.fin })),
      turnosSemana: turnos, oficinas, personas, ausencias, demanda, parametros: par,
    });
    expect(res.coberturas).toHaveLength(deJorge.length);
    expect(res.coberturas.every((c) => c.candidato && c.candidato.usuarioId !== jorge.id)).toBe(true);
    expect(res.verificaciones.every((v) => v.ok)).toBe(true);
    expect(res.impacto[0].servicioCon).toBeGreaterThanOrEqual(res.impacto[0].servicioSin);
  });
});

import { readFileSync } from "node:fs";
import { agregarTexto, leerFechaHora } from "../src/lib/datos/digiturno";

describe("Importador de Digiturno", () => {
  it("lee fechas en formato colombiano con a. m. / p. m.", () => {
    expect(leerFechaHora("4/05/2026 8:09:38 a. m.")).toEqual({ fecha: "2026-05-04", hora: 8 });
    expect(leerFechaHora("4/05/2026 2:15:00 p. m.")).toEqual({ fecha: "2026-05-04", hora: 14 });
    expect(leerFechaHora("4/05/2026 12:05:00 p. m.")).toEqual({ fecha: "2026-05-04", hora: 12 });
  });
  it("agrega el export sin guardar datos personales", () => {
    const r = agregarTexto(readFileSync(new URL("./fixtures/digiturno_muestra.csv", import.meta.url), "utf8"));
    expect(r.faltantes).toEqual([]);
    expect(r.registros).toBe(4);
    expect(r.oficinas.map((o) => o.codigo).sort((a, b) => a - b)).toEqual([2, 8, 10]);
    const monteria = r.oficinas.find((o) => o.codigo === 10)!;
    expect(monteria.departamento).toBe("Córdoba");
    const aband = r.demanda.find((d) => d.codigoOficina === 10 && d.fila === "GENERAL")!;
    expect(aband.abandonados).toBe(1);
    expect(r.demanda.find((d) => d.fila === "PREFERENCIAL")!.servicio).toBe("Radicación de cartas");
    // los nombres de operadores solo viajan en la lista opcional para crear el equipo
    expect(r.operadores.map((o) => o.nombre)).toEqual(["Operador Ficticio 1", "Operador Ficticio 2", "Operador Ficticio 3"]);
    expect(r.operadores.find((o) => o.id === "operador2")!.codigoOficina).toBe(10);
    const { operadores: _ops, ...agregados } = r;
    void _ops;
    expect(JSON.stringify(agregados)).not.toMatch(/Operador Ficticio|operador1/);
  });
});
