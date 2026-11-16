// Tiempos aproximados de traslado por carretera entre ciudades con oficina (minutos).
// Se usan para decidir si un apoyo puede ser presencial; si no hay dato, solo se propone apoyo virtual.

const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/^el /, ""); // "El Carmen de Bolívar" y "Carmen de Bolivar" son la misma ciudad

const TABLA: [string, string, number][] = [
  ["cartagena", "turbaco", 25],
  ["cartagena", "arjona", 40],
  ["turbaco", "arjona", 20],
  ["cartagena", "carmen de bolivar", 110],
  ["magangue", "carmen de bolivar", 95],
  ["sincelejo", "corozal", 20],
  ["sincelejo", "tolu", 45],
  ["corozal", "tolu", 60],
  ["sincelejo", "carmen de bolivar", 60],
  ["sincelejo", "sahagun", 75],
  ["monteria", "cerete", 25],
  ["monteria", "lorica", 60],
  ["cerete", "lorica", 45],
  ["monteria", "sahagun", 80],
  ["sincelejo", "magangue", 100],
  ["monteria", "planeta rica", 55],
  ["sahagun", "planeta rica", 45],
  ["planeta rica", "caucasia", 110],
  ["magangue", "mompox", 120],
];

export const MAX_MINUTOS_PRESENCIAL = 60;

export function minutosEntre(ciudadA: string, ciudadB: string): number | null {
  const a = normalizar(ciudadA);
  const b = normalizar(ciudadB);
  if (a === b) return 0;
  for (const [x, y, m] of TABLA) if ((x === a && y === b) || (x === b && y === a)) return m;
  return null;
}
