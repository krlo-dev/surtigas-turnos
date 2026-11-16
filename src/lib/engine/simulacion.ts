// Simulación de eventos discretos (DES) de un día de atención en una oficina.
// Modela llegadas Poisson por franja, dos filas (preferencial con prioridad y general), tiempos de
// atención exponenciales, abandono por impaciencia y un número de personas que cambia por hora.

import { crearRng, exponencial, type Rng } from "./aleatorio";

export interface EntradaSimulacion {
  horaApertura: number;
  horaCierre: number;
  llegadasPorHora: number[]; // índice = hora del día
  personasPorHora: number[]; // índice = hora del día
  partePreferencial: number;
  ahtGeneralSeg: number;
  ahtPreferencialSeg: number;
  pacienciaSeg: number;
  tObjetivoSeg: number;
  prioridadPreferencial: boolean;
}

export interface ResultadoSimulacion {
  llegadas: number;
  atendidos: number;
  abandonados: number;
  enObjetivo: number;
  esperaTotalSeg: number;
  nivelServicio: number;
  esperaPromSeg: number;
  abandono: number;
}

interface Cliente {
  llegada: number;
  limite: number;
  servicio: number;
}

class MinHeap {
  private datos: number[] = [];
  get tamano() {
    return this.datos.length;
  }
  tope() {
    return this.datos[0];
  }
  push(v: number) {
    const d = this.datos;
    d.push(v);
    let i = d.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (d[p] <= d[i]) break;
      [d[p], d[i]] = [d[i], d[p]];
      i = p;
    }
  }
  pop(): number | undefined {
    const d = this.datos;
    if (!d.length) return undefined;
    const top = d[0];
    const last = d.pop()!;
    if (d.length) {
      d[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < d.length && d[l] < d[m]) m = l;
        if (r < d.length && d[r] < d[m]) m = r;
        if (m === i) break;
        [d[m], d[i]] = [d[i], d[m]];
        i = m;
      }
    }
    return top;
  }
}

function generarLlegadas(e: EntradaSimulacion, rng: Rng): { t: number; pref: boolean; c: Cliente }[] {
  const out: { t: number; pref: boolean; c: Cliente }[] = [];
  for (let h = e.horaApertura; h < e.horaCierre; h++) {
    const lambda = e.llegadasPorHora[h] ?? 0;
    if (lambda <= 0) continue;
    let t = h * 3600;
    const finFranja = (h + 1) * 3600;
    for (;;) {
      t += exponencial(rng, 3600 / lambda);
      if (t >= finFranja) break;
      const pref = rng() < e.partePreferencial;
      const aht = pref ? e.ahtPreferencialSeg : e.ahtGeneralSeg;
      out.push({ t, pref, c: { llegada: t, limite: t + exponencial(rng, e.pacienciaSeg), servicio: exponencial(rng, aht) } });
    }
  }
  return out;
}

export function simularDia(e: EntradaSimulacion, rng: Rng): ResultadoSimulacion {
  const llegadas = generarLlegadas(e, rng);
  const filaPref: Cliente[] = [];
  const filaGen: Cliente[] = [];
  let iPref = 0;
  let iGen = 0;
  const salidas = new MinHeap();
  let ocupados = 0;
  let atendidos = 0;
  let abandonados = 0;
  let enObjetivo = 0;
  let esperaTotal = 0;
  const cierre = e.horaCierre * 3600;
  const ultimaFranja = Math.max(e.horaApertura, e.horaCierre - 1);

  const capacidad = (t: number) => {
    const h = Math.floor(t / 3600);
    if (h >= e.horaCierre) return e.personasPorHora[ultimaFranja] ?? 0; // se atiende a quien quedó adentro
    return e.personasPorHora[h] ?? 0;
  };

  const siguienteCliente = (t: number): Cliente | null => {
    const filas = e.prioridadPreferencial ? [filaPref, filaGen] : [];
    if (!e.prioridadPreferencial) {
      // sin prioridad: orden de llegada entre ambas filas
      const a = filaPref[iPref];
      const b = filaGen[iGen];
      if (a && (!b || a.llegada <= b.llegada)) return tomar(filaPref, "p", t);
      if (b) return tomar(filaGen, "g", t);
      return null;
    }
    for (const f of filas) {
      const c = tomar(f, f === filaPref ? "p" : "g", t);
      if (c) return c;
    }
    return null;
  };

  function tomar(fila: Cliente[], cual: "p" | "g", t: number): Cliente | null {
    let i = cual === "p" ? iPref : iGen;
    while (i < fila.length) {
      const c = fila[i++];
      if (c.limite < t) {
        abandonados++;
        continue;
      }
      if (cual === "p") iPref = i;
      else iGen = i;
      return c;
    }
    if (cual === "p") iPref = i;
    else iGen = i;
    return null;
  }

  const despachar = (t: number) => {
    while (ocupados < capacidad(t)) {
      const c = siguienteCliente(t);
      if (!c) break;
      const espera = t - c.llegada;
      esperaTotal += espera;
      if (espera <= e.tObjetivoSeg) enObjetivo++;
      atendidos++;
      ocupados++;
      salidas.push(t + c.servicio);
    }
  };

  let k = 0;
  let siguienteHora = e.horaApertura * 3600 + 3600;
  const limiteSeguridad = cierre + 6 * 3600;
  for (;;) {
    const tLlegada = k < llegadas.length ? llegadas[k].t : Number.POSITIVE_INFINITY;
    const tSalida = salidas.tamano ? salidas.tope() : Number.POSITIVE_INFINITY;
    const pendientes = filaPref.length - iPref + (filaGen.length - iGen);
    const tHora = siguienteHora <= cierre ? siguienteHora : Number.POSITIVE_INFINITY;
    const t = Math.min(tLlegada, tSalida, tHora);
    if (!Number.isFinite(t) || t > limiteSeguridad) {
      // quienes siguen en fila al final se cuentan como abandono
      abandonados += pendientes;
      break;
    }
    if (t === tSalida) {
      salidas.pop();
      ocupados--;
    } else if (t === tLlegada) {
      const l = llegadas[k++];
      (l.pref ? filaPref : filaGen).push(l.c);
    } else {
      siguienteHora += 3600;
    }
    despachar(t);
    if (k >= llegadas.length && salidas.tamano === 0 && filaPref.length - iPref + (filaGen.length - iGen) === 0) break;
    if (k >= llegadas.length && salidas.tamano === 0 && capacidad(t) === 0 && t >= cierre) {
      abandonados += filaPref.length - iPref + (filaGen.length - iGen);
      break;
    }
  }

  const total = llegadas.length;
  return {
    llegadas: total,
    atendidos,
    abandonados,
    enObjetivo,
    esperaTotalSeg: esperaTotal,
    nivelServicio: atendidos ? enObjetivo / atendidos : 1,
    esperaPromSeg: atendidos ? esperaTotal / atendidos : 0,
    abandono: total ? abandonados / total : 0,
  };
}

/** Promedia varias réplicas independientes del mismo día. */
export function simularReplicas(e: EntradaSimulacion, replicas: number, semilla: number): ResultadoSimulacion {
  const rng = crearRng(semilla);
  const acc = { llegadas: 0, atendidos: 0, abandonados: 0, enObjetivo: 0, esperaTotalSeg: 0 };
  for (let r = 0; r < replicas; r++) {
    const x = simularDia(e, rng);
    acc.llegadas += x.llegadas;
    acc.atendidos += x.atendidos;
    acc.abandonados += x.abandonados;
    acc.enObjetivo += x.enObjetivo;
    acc.esperaTotalSeg += x.esperaTotalSeg;
  }
  const n = Math.max(1, replicas);
  return {
    llegadas: acc.llegadas / n,
    atendidos: acc.atendidos / n,
    abandonados: acc.abandonados / n,
    enObjetivo: acc.enObjetivo / n,
    esperaTotalSeg: acc.esperaTotalSeg / n,
    nivelServicio: acc.atendidos ? acc.enObjetivo / acc.atendidos : 1,
    esperaPromSeg: acc.atendidos ? acc.esperaTotalSeg / acc.atendidos : 0,
    abandono: acc.llegadas ? acc.abandonados / acc.llegadas : 0,
  };
}
