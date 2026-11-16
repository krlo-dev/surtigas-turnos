// Un turno ya publicado no se borra al instante: queda "por quitar" (LIBERADO, sin publicar y con esta marca
// en la nota) hasta que el administrador publica. Así la persona recibe el aviso junto con el resto de cambios.
export const MARCA_QUITAR = "QUITAR:";

export function esPorQuitar(t: { estado: string; publicado: boolean; nota: string | null }) {
  return t.estado === "LIBERADO" && !t.publicado && (t.nota ?? "").startsWith(MARCA_QUITAR);
}

/** Prefijo de las copias (en Configuracion) que guardan cómo estaba un turno publicado antes de editarlo. */
export const PREFIJO_COPIA = "deshacer:";
