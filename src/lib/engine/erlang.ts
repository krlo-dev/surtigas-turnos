// Teoría de colas M/M/c (Erlang C).
// lambda: llegadas por hora · aht: tiempo medio de atención en segundos · c: personas atendiendo.

/** Probabilidad de que un usuario tenga que esperar (fórmula de Erlang C). a = carga ofrecida en erlangs. */
export function erlangC(c: number, a: number): number {
  if (a <= 0) return 0;
  if (c <= 0 || a >= c) return 1;
  // Erlang B iterativo (numéricamente estable) y conversión a Erlang C.
  let b = 1;
  for (let k = 1; k <= c; k++) b = (a * b) / (k + a * b);
  const rho = a / c;
  return b / (1 - rho + rho * b);
}

export function cargaOfrecida(lambdaHora: number, ahtSeg: number): number {
  return (lambdaHora * ahtSeg) / 3600;
}

/** Proporción de usuarios atendidos antes de tObjetivo segundos. */
export function nivelServicio(c: number, lambdaHora: number, ahtSeg: number, tObjetivoSeg: number): number {
  if (lambdaHora <= 0) return 1;
  if (c <= 0) return 0;
  const a = cargaOfrecida(lambdaHora, ahtSeg);
  if (a >= c) return 0;
  const pc = erlangC(c, a);
  return Math.max(0, Math.min(1, 1 - pc * Math.exp(-(c - a) * (tObjetivoSeg / ahtSeg))));
}

/** Espera promedio en cola (segundos). Infinity si el sistema es inestable. */
export function esperaPromedio(c: number, lambdaHora: number, ahtSeg: number): number {
  if (lambdaHora <= 0) return 0;
  if (c <= 0) return Number.POSITIVE_INFINITY;
  const a = cargaOfrecida(lambdaHora, ahtSeg);
  if (a >= c) return Number.POSITIVE_INFINITY;
  return (erlangC(c, a) * ahtSeg) / (c - a);
}

/** Ocupación de las personas (0..1). */
export function ocupacion(c: number, lambdaHora: number, ahtSeg: number): number {
  if (lambdaHora <= 0) return 0;
  if (c <= 0) return 1;
  return Math.min(1, cargaOfrecida(lambdaHora, ahtSeg) / c);
}

/** Mínimo de personas para cumplir el nivel de servicio objetivo, con un tope opcional (puestos). */
export function personasRequeridas(
  lambdaHora: number,
  ahtSeg: number,
  objetivo: number,
  tObjetivoSeg: number,
  tope = 60,
): number {
  if (lambdaHora <= 0.05) return 0;
  const a = cargaOfrecida(lambdaHora, ahtSeg);
  let c = Math.max(1, Math.ceil(a));
  while (c < tope && nivelServicio(c, lambdaHora, ahtSeg, tObjetivoSeg) < objetivo) c++;
  return Math.min(c, tope);
}

/**
 * Personas requeridas en forma continua (interpolando el nivel de servicio entre c-1 y c).
 * Sirve para medir el "uso" de una oficina: requeridas / asignadas.
 */
export function personasRequeridasFraccion(lambdaHora: number, ahtSeg: number, objetivo: number, tObjetivoSeg: number): number {
  if (lambdaHora <= 0.05) return 0;
  const c = personasRequeridas(lambdaHora, ahtSeg, objetivo, tObjetivoSeg, 80);
  const slMenos = c > 1 ? nivelServicio(c - 1, lambdaHora, ahtSeg, tObjetivoSeg) : 0;
  const sl = nivelServicio(c, lambdaHora, ahtSeg, tObjetivoSeg);
  const f = sl > slMenos ? (objetivo - slMenos) / (sl - slMenos) : 1;
  return Math.max(0, c - 1 + Math.min(1, Math.max(0, f)));
}
