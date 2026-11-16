"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sesionRequerida } from "@/auth";
import { horaAMinutos } from "@/lib/fechas";
import { registrarExcusa } from "@/lib/servicios/excusas";

export async function reportarAusencia(_prev: unknown, form: FormData) {
  const u = await sesionRequerida("COLABORADOR");
  const tipo = String(form.get("tipo") ?? "");
  if (!["EXCUSA", "PERMISO", "INCAPACIDAD"].includes(tipo)) return { error: "Elige qué pasó: excusa, permiso o incapacidad." };
  const desde = String(form.get("desde") ?? "");
  const hasta = String(form.get("hasta") ?? "") || desde;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde)) return { error: "Elige el día o los días de la ausencia." };
  const jornada = form.get("jornada") === "UNAS_HORAS" ? "UNAS_HORAS" : "TODO_EL_DIA";
  const archivo = form.get("soporte");
  let codigo: number;
  try {
    const e = await registrarExcusa({
      usuarioId: u.id,
      tipo: tipo as "EXCUSA" | "PERMISO" | "INCAPACIDAD",
      desde,
      hasta,
      jornada,
      horaInicio: jornada === "UNAS_HORAS" ? horaAMinutos(String(form.get("horaInicio") ?? "08:00")) : null,
      horaFin: jornada === "UNAS_HORAS" ? horaAMinutos(String(form.get("horaFin") ?? "12:00")) : null,
      motivo: String(form.get("motivo") ?? ""),
      archivo: archivo instanceof File && archivo.size > 0 ? archivo : null,
      canal: String(form.get("canal") ?? "web"),
    });
    codigo = e.codigo;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo enviar." };
  }
  revalidatePath("/colaborador", "layout");
  redirect(`/colaborador/solicitudes?enviada=EX-${codigo}`);
}
