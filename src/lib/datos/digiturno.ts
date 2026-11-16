// Lector del export de turnos de Digiturno (CSV separado por ; o tabulador).
// Agrega los registros por oficina, día, hora, fila y servicio. Los datos personales del export
// (operadores, clientes, cédulas, teléfonos, correos) se leen solo para contar y nunca se guardan.

export interface OficinaDetectada {
  codigo: number;
  nombre: string;
  ciudad: string;
  departamento: string;
  terminales: number;
  registros: number;
}

export interface AgregadoDemanda {
  codigoOficina: number;
  fecha: string;
  hora: number;
  fila: "GENERAL" | "PREFERENCIAL";
  servicio: string;
  llegadas: number;
  atendidos: number;
  abandonados: number;
  cancelados: number;
  sumaEsperaSeg: number;
  sumaAtencionSeg: number;
  atencionesConTiempo: number;
  enObjetivo: number;
}

export interface AgregadoOperacion {
  codigoOficina: number;
  fecha: string;
  hora: number;
  operadores: number;
  terminales: number;
}

export interface ResumenDigiturno {
  oficinas: OficinaDetectada[];
  demanda: AgregadoDemanda[];
  operacion: AgregadoOperacion[];
  desde: string | null;
  hasta: string | null;
  registros: number;
  descartados: number;
  servicios: string[];
}

const COLUMNAS_REQUERIDAS = ["IdOficina", "NombreOficina", "Estado", "TiempoInicioEspera", "TiempoEspera", "TiempoAtencion"];

const quitarTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** "4/05/2026 8:09:38 a. m." → { fecha: "2026-05-04", hora: 8 } (día/mes/año, formato colombiano). */
export function leerFechaHora(texto: string | undefined): { fecha: string; hora: number } | null {
  if (!texto) return null;
  const t = texto.trim();
  if (!t) return null;
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})/);
  if (iso) return { fecha: `${iso[1]}-${iso[2]}-${iso[3]}`, hora: Number(iso[4]) };
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap])?/i);
  if (!m) return null;
  let hora = Number(m[4]);
  const ampm = m[6]?.toLowerCase();
  if (ampm === "p" && hora < 12) hora += 12;
  if (ampm === "a" && hora === 12) hora = 0;
  return { fecha: `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`, hora };
}

export function normalizarServicio(s: string | undefined): string {
  const limpio = (s ?? "").replace(/^\*?sin asignar$/i, "").trim();
  if (!limpio) return "Otros";
  const llano = quitarTildes(limpio).toLowerCase().replace(/[´'`]/g, "");
  if (llano.startsWith("pqr")) return "PQR";
  if (llano.includes("radic")) return "Radicación de cartas";
  if (llano.includes("factur") || llano.includes("pago")) return "Facturación y pagos";
  if (llano.includes("conexi") || llano.includes("instal")) return "Conexiones nuevas";
  return limpio.charAt(0).toUpperCase() + limpio.slice(1).toLowerCase();
}

export function nombreOficinaLimpio(s: string): string {
  return s.replace(/^oficina\s+surtigas\s*-\s*/i, "").replace(/^sede\s+/i, "").trim() || s;
}

const num = (v: string | undefined) => {
  const n = Number((v ?? "").trim().replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/** Acumulador incremental: se le pasan filas (arrays de celdas) a medida que se leen. */
export class AgregadorDigiturno {
  private idx: Record<string, number> = {};
  private idxFecha2 = -1;
  private demanda = new Map<string, AgregadoDemanda>();
  private operacion = new Map<string, { operadores: Set<string>; terminales: Set<string> }>();
  private oficinas = new Map<number, OficinaDetectada & { _term: Set<string> }>();
  private servicios = new Set<string>();
  registros = 0;
  descartados = 0;
  private desde: string | null = null;
  private hasta: string | null = null;
  encabezadoListo = false;

  /** Registra el encabezado. Devuelve las columnas requeridas que faltan. */
  encabezado(celdas: string[]): string[] {
    celdas.forEach((c, i) => {
      const k = c.trim().replace(/^﻿/, "");
      if (k === "Fecha" && this.idx.Fecha !== undefined && this.idxFecha2 < 0) this.idxFecha2 = i;
      if (this.idx[k] === undefined) this.idx[k] = i;
    });
    this.encabezadoListo = true;
    return COLUMNAS_REQUERIDAS.filter((c) => this.idx[c] === undefined);
  }

  private v(celdas: string[], col: string) {
    const i = this.idx[col];
    return i === undefined ? undefined : celdas[i];
  }

  fila(celdas: string[]) {
    if (celdas.length < 5) return;
    this.registros++;
    const codigo = Math.trunc(num(this.v(celdas, "IdOficina")));
    const llegada =
      leerFechaHora(this.v(celdas, "TiempoInicioEspera")) ??
      leerFechaHora(this.idxFecha2 >= 0 ? celdas[this.idxFecha2] : undefined) ??
      leerFechaHora(this.v(celdas, "TiempoInicioLlamado"));
    if (!codigo || !llegada) {
      this.descartados++;
      return;
    }
    const estado = (this.v(celdas, "Estado") ?? "").trim().toUpperCase();
    const nivel2 = quitarTildes(this.v(celdas, "NombreElementoNodoNivel2") ?? "").toLowerCase();
    const cola = quitarTildes(this.v(celdas, "NombreCola") ?? "").toLowerCase();
    const fila: "GENERAL" | "PREFERENCIAL" = nivel2.includes("prefer") || cola.startsWith("(prefer") ? "PREFERENCIAL" : "GENERAL";
    const servicio = normalizarServicio(this.v(celdas, "NombreElementoNodoNivel3") ?? cola.replace(/^\([^)]*\)\s*/, ""));
    this.servicios.add(servicio);

    const abandono = estado.startsWith("ABA") || num(this.v(celdas, "Abandonados")) > 0;
    const cancelado = !abandono && (estado.startsWith("CAN") || num(this.v(celdas, "Cancelados")) > 0);
    const tAtencion = num(this.v(celdas, "TiempoAtencion"));
    const tEspera = num(this.v(celdas, "TiempoEspera"));
    const atendido = !abandono && !cancelado;

    const clave = `${codigo}|${llegada.fecha}|${llegada.hora}|${fila}|${servicio}`;
    const a =
      this.demanda.get(clave) ??
      { codigoOficina: codigo, fecha: llegada.fecha, hora: llegada.hora, fila, servicio, llegadas: 0, atendidos: 0, abandonados: 0, cancelados: 0, sumaEsperaSeg: 0, sumaAtencionSeg: 0, atencionesConTiempo: 0, enObjetivo: 0 };
    a.llegadas++;
    if (abandono) a.abandonados++;
    if (cancelado) a.cancelados++;
    if (atendido) {
      a.atendidos++;
      a.sumaEsperaSeg += Math.round(tEspera);
      if (tEspera <= 300) a.enObjetivo++;
      if (tAtencion > 0) {
        a.sumaAtencionSeg += Math.round(tAtencion);
        a.atencionesConTiempo++;
      }
    }
    this.demanda.set(clave, a);

    const op = `${codigo}|${llegada.fecha}|${llegada.hora}`;
    const o = this.operacion.get(op) ?? { operadores: new Set<string>(), terminales: new Set<string>() };
    const operador = this.v(celdas, "IdUsuario")?.trim();
    const terminal = this.v(celdas, "NombreTerminal")?.trim();
    if (operador && atendido) o.operadores.add(operador);
    if (terminal && atendido) o.terminales.add(terminal);
    this.operacion.set(op, o);

    const ofi =
      this.oficinas.get(codigo) ??
      {
        codigo,
        nombre: nombreOficinaLimpio(this.v(celdas, "NombreOficina") ?? `Oficina ${codigo}`),
        ciudad: (this.v(celdas, "NombreNivelGeografico3") ?? "").trim(),
        departamento: (this.v(celdas, "NombreNivelGeografico2") ?? "").trim(),
        terminales: 0,
        registros: 0,
        _term: new Set<string>(),
      };
    ofi.registros++;
    if (terminal) ofi._term.add(terminal);
    this.oficinas.set(codigo, ofi);

    if (!this.desde || llegada.fecha < this.desde) this.desde = llegada.fecha;
    if (!this.hasta || llegada.fecha > this.hasta) this.hasta = llegada.fecha;
  }

  resumen(): ResumenDigiturno {
    return {
      oficinas: [...this.oficinas.values()]
        .map(({ _term, ...o }) => ({ ...o, terminales: _term.size }))
        .sort((a, b) => b.registros - a.registros),
      demanda: [...this.demanda.values()],
      operacion: [...this.operacion.entries()].map(([k, v]) => {
        const [codigo, fecha, hora] = k.split("|");
        return { codigoOficina: Number(codigo), fecha, hora: Number(hora), operadores: v.operadores.size, terminales: v.terminales.size };
      }),
      desde: this.desde,
      hasta: this.hasta,
      registros: this.registros,
      descartados: this.descartados,
      servicios: [...this.servicios].sort(),
    };
  }
}

/** Utilidad para pruebas y para el script de línea de comandos: procesa un texto completo. */
export function agregarTexto(texto: string): ResumenDigiturno & { faltantes: string[] } {
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim());
  const sep = (lineas[0] ?? "").includes("\t") ? "\t" : ";";
  const ag = new AgregadorDigiturno();
  const faltantes = ag.encabezado((lineas[0] ?? "").split(sep));
  for (const l of lineas.slice(1)) ag.fila(l.split(sep));
  return { ...ag.resumen(), faltantes };
}
