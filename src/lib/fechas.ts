// Utilidades de fecha. Todas las fechas de calendario se manejan como "YYYY-MM-DD" en hora de Colombia
// (America/Bogota) y se guardan en la base como DATE (medianoche UTC del mismo día).

export const ZONA = "America/Bogota";

export const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
export const DIAS_LARGOS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
export const DIAS_MIN = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"];
export const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
export const MESES_LARGOS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** Fecha de hoy en Colombia como YYYY-MM-DD. */
export function hoyISO(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" }).format(ahora);
}

/** Minutos transcurridos desde la medianoche en Colombia. */
export function minutosAhora(ahora: Date = new Date()): number {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(ahora);
  const h = Number(p.find((x) => x.type === "hour")?.value ?? 0) % 24;
  const m = Number(p.find((x) => x.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

export function aFecha(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function aISO(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

export function sumarDias(iso: string, dias: number): string {
  const d = aFecha(iso);
  d.setUTCDate(d.getUTCDate() + dias);
  return aISO(d);
}

/** 0 = domingo ... 6 = sábado */
export function diaSemana(iso: string): number {
  return aFecha(iso).getUTCDay();
}

/** Lunes de la semana que contiene la fecha. */
export function lunesDe(iso: string): string {
  const dow = diaSemana(iso);
  const desplazamiento = dow === 0 ? -6 : 1 - dow;
  return sumarDias(iso, desplazamiento);
}

export function diasDeSemana(lunes: string): string[] {
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
}

export function rangoDias(desde: string, hasta: string): string[] {
  const out: string[] = [];
  for (let d = desde; d <= hasta; d = sumarDias(d, 1)) out.push(d);
  return out;
}

export function diferenciaDias(a: string, b: string): number {
  return Math.round((aFecha(b).getTime() - aFecha(a).getTime()) / 86_400_000);
}

/** Número de semana ISO 8601. */
export function semanaISO(iso: string): number {
  const d = aFecha(iso);
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dow);
  const inicioAnio = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - inicioAnio.getTime()) / 86_400_000 + 1) / 7);
}

export function partes(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { anio: y, mes: m - 1, dia: d };
}

export function fmtHora(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function fmtRangoHoras(inicio: number, fin: number): string {
  return `${fmtHora(inicio)} – ${fmtHora(fin)}`;
}

export function horaAMinutos(texto: string): number {
  const [h, m] = texto.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** "Martes 20 oct, 2026" */
export function fmtFechaLarga(iso: string): string {
  const { anio, mes, dia } = partes(iso);
  return `${DIAS_LARGOS[diaSemana(iso)]} ${dia} ${MESES_CORTOS[mes]}, ${anio}`;
}

/** "Martes 20 oct" */
export function fmtFechaMedia(iso: string): string {
  const { mes, dia } = partes(iso);
  return `${DIAS_LARGOS[diaSemana(iso)]} ${dia} ${MESES_CORTOS[mes]}`;
}

/** "20 oct" */
export function fmtDiaMes(iso: string): string {
  const { mes, dia } = partes(iso);
  return `${dia} ${MESES_CORTOS[mes]}`;
}

/** "Jue 22 oct" */
export function fmtDiaCorto(iso: string): string {
  return `${DIAS_CORTOS[diaSemana(iso)]} ${fmtDiaMes(iso)}`;
}

/** "22 – 23 oct", "30 oct – 2 nov" o "22 oct" */
export function fmtRangoFechas(desde: string, hasta: string): string {
  if (desde === hasta) return fmtDiaMes(desde);
  const a = partes(desde);
  const b = partes(hasta);
  if (a.mes === b.mes) return `${a.dia} – ${b.dia} ${MESES_CORTOS[b.mes]}`;
  return `${fmtDiaMes(desde)} – ${fmtDiaMes(hasta)}`;
}

/** "19 – 25 oct, 2026" */
export function fmtRangoSemana(lunes: string): string {
  const domingo = sumarDias(lunes, 6);
  return `${fmtRangoFechas(lunes, domingo)}, ${partes(domingo).anio}`;
}

/** Segundos a "m:ss" */
export function fmtDuracion(seg: number): string {
  if (!Number.isFinite(seg)) return "–";
  const s = Math.max(0, Math.round(seg));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function fmtPorcentaje(v: number, decimales = 0): string {
  return `${(v * 100).toFixed(decimales).replace(".", ",")}%`;
}

export function fmtNumero(v: number, decimales = 1): string {
  return v.toFixed(decimales).replace(".", ",");
}

/** "Hace 3 h", "Ayer", "Hace 2 días" */
export function fmtHace(fecha: Date, ahora: Date = new Date()): string {
  const min = Math.round((ahora.getTime() - fecha.getTime()) / 60_000);
  if (min < 1) return "Ahora";
  if (min < 60) return `Hace ${min} min`;
  const h = Math.round(min / 60);
  const dias = diferenciaDias(hoyISO(fecha), hoyISO(ahora));
  if (dias === 0) return `Hace ${h} h`;
  if (dias === 1) return "Ayer";
  if (dias < 7) return `Hace ${dias} días`;
  return fmtDiaMes(hoyISO(fecha));
}

/** "09:12" en hora de Colombia */
export function fmtHoraDe(fecha: Date): string {
  return new Intl.DateTimeFormat("es-CO", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hour12: false }).format(fecha);
}

/** "09:12", "Ayer", "Dom", "9 oct" según antigüedad (para feeds de actividad). */
export function fmtMomento(fecha: Date, ahora: Date = new Date()): string {
  const dias = diferenciaDias(hoyISO(fecha), hoyISO(ahora));
  if (dias === 0) return fmtHoraDe(fecha);
  if (dias === 1) return "Ayer";
  if (dias < 7) return DIAS_CORTOS[diaSemana(hoyISO(fecha))];
  return fmtDiaMes(hoyISO(fecha));
}
