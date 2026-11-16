"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sesionRequerida } from "@/auth";
import type { ParametrosMotor } from "@/lib/engine/tipos";
import { horaAMinutos } from "@/lib/fechas";
import { aplicarCobertura, confirmarPropuesta, copiarSemanaAnterior, generarPropuesta, deshacerCambioTurno, descartarCambios, guardarTurnoManual, publicarCambios, quitarTurno, restaurarTurnoBorrado } from "@/lib/servicios/malla";
import { db } from "@/lib/db";
import { volverACalcularCobertura } from "@/lib/servicios/excusas";

export type Resultado = { ok?: string; error?: string } | undefined;

export async function guardarTurno(datos: { id?: string; usuarioId: string; oficinaId: string; fecha: string; entra: string; sale: string }): Promise<Resultado> {
  await sesionRequerida("ADMIN");
  try {
    await guardarTurnoManual({ id: datos.id, usuarioId: datos.usuarioId, oficinaId: datos.oficinaId, fecha: datos.fecha, inicio: horaAMinutos(datos.entra), fin: horaAMinutos(datos.sale) });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo guardar." };
  }
  revalidatePath("/admin/malla");
  return { ok: "Turno guardado como ajuste manual." };
}

export type Borrado = { usuarioId: string; oficinaId: string; fecha: string; inicio: number; fin: number };

export async function eliminarTurno(id: string): Promise<{ ok?: string; error?: string; borrado?: Borrado }> {
  await sesionRequerida("ADMIN");
  const r = await quitarTurno(id);
  revalidatePath("/admin/malla");
  return r.pendiente ? { ok: "Turno marcado para quitar. Se elimina cuando le des Publicar." } : { ok: "Turno quitado.", borrado: r.borrado };
}

export async function deshacerTurno(id: string): Promise<Resultado> {
  await sesionRequerida("ADMIN");
  const hecho = await deshacerCambioTurno(id);
  revalidatePath("/admin/malla");
  return { ok: hecho ? "Cambio deshecho." : "Ese turno no tenía cambios sin publicar." };
}

export async function restaurarBorrado(d: Borrado): Promise<Resultado> {
  await sesionRequerida("ADMIN");
  try {
    await restaurarTurnoBorrado(d);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo restaurar." };
  }
  revalidatePath("/admin/malla");
  return { ok: "Turno restaurado." };
}

export async function descartar(lunes: string, oficinaId: string): Promise<Resultado> {
  await sesionRequerida("ADMIN");
  const n = await descartarCambios(lunes, oficinaId);
  revalidatePath("/admin/malla");
  return { ok: n ? `Se descartaron ${n} ${n === 1 ? "cambio" : "cambios"}. La malla quedó como la última publicada.` : "No había cambios sin publicar." };
}

export async function publicar(lunes: string, oficinaId: string) {
  await sesionRequerida("ADMIN");
  const n = await publicarCambios(lunes, oficinaId);
  revalidatePath("/admin/malla");
  return { ok: n ? `Publicado. Le enviamos su semana actualizada a ${n} ${n === 1 ? "persona" : "personas"}.` : "No había cambios por publicar." };
}

export async function copiar(lunes: string, oficinaId: string) {
  await sesionRequerida("ADMIN");
  const n = await copiarSemanaAnterior(lunes, oficinaId);
  revalidatePath("/admin/malla");
  return { ok: n ? `Se copiaron ${n} turnos de la semana anterior como ajustes sin publicar.` : "No había turnos que copiar en días libres." };
}

export async function recalcularPropuesta(lunes: string, parametros: ParametrosMotor) {
  const u = await sesionRequerida("ADMIN");
  await generarPropuesta(lunes, u.id, parametros);
  revalidatePath("/admin/malla/propuesta");
}

export async function confirmarMalla(corridaId: string, alternativa: "A" | "B") {
  await sesionRequerida("ADMIN");
  const r = await confirmarPropuesta(corridaId, alternativa);
  revalidatePath("/admin/malla");
  redirect(`/admin/malla?semana=${r.lunes}&confirmada=1`);
}

export async function descartarPropuesta(corridaId: string) {
  await sesionRequerida("ADMIN");
  await db.corrida.update({ where: { id: corridaId }, data: { estado: "DESCARTADA" } });
  revalidatePath("/admin/malla/propuesta");
}

export async function aplicarRecalculo(corridaId: string, avisar: boolean) {
  await sesionRequerida("ADMIN");
  await aplicarCobertura(corridaId, avisar);
  revalidatePath("/admin");
  revalidatePath("/admin/malla");
  redirect("/admin/malla/recalculo?aplicado=1");
}

export async function descartarRecalculo(corridaId: string) {
  await sesionRequerida("ADMIN");
  await db.corrida.update({ where: { id: corridaId }, data: { estado: "DESCARTADA" } });
  redirect("/admin/malla");
}

export async function aplicarRecalculoForm(corridaId: string, form: FormData) {
  await aplicarRecalculo(corridaId, form.get("avisar") === "on");
}

export async function volverACalcularRecalculo(corridaId: string) {
  await sesionRequerida("ADMIN");
  await volverACalcularCobertura(corridaId);
  revalidatePath("/admin/malla/recalculo");
  redirect(`/admin/malla/recalculo?id=${corridaId}`);
}
