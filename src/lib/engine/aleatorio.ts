// Generador pseudoaleatorio con semilla (mulberry32) para que la simulación sea reproducible.

export type Rng = () => number;

export function crearRng(semilla: number): Rng {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Variable exponencial con media dada. */
export function exponencial(rng: Rng, media: number): number {
  return -Math.log(1 - rng()) * media;
}

/** Poisson por el método de Knuth (adecuado para medias pequeñas o moderadas). */
export function poisson(rng: Rng, media: number): number {
  if (media <= 0) return 0;
  if (media > 60) {
    // aproximación normal para medias grandes
    const u = Math.max(1e-12, rng());
    const v = rng();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return Math.max(0, Math.round(media + Math.sqrt(media) * z));
  }
  const l = Math.exp(-media);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > l);
  return k - 1;
}

/** Hash simple de texto a entero (para derivar semillas estables). */
export function hashTexto(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
