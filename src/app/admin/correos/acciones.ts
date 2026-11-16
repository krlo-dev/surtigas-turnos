"use server";

import { revalidatePath } from "next/cache";
import { sesionRequerida } from "@/auth";
import { db } from "@/lib/db";
import { hoyISO, lunesDe, semanaISO, sumarDias } from "@/lib/fechas";
import { enviarHorarioA, enviarHorarioSemanal } from "@/lib/servicios/malla";

export async function enviarAhora() {
  await sesionRequerida("ADMIN");
  const r = await enviarHorarioSemanal(lunesDe(hoyISO()));
  revalidatePath("/admin/correos");
  return { ok: `Horario de la semana ${r.semana} enviado a ${r.enviados} de ${r.total} personas${r.fallidos ? `; ${r.fallidos} fallaron` : ""}.` };
}

export async function reintentar(notificacionId: string) {
  await sesionRequerida("ADMIN");
  const n = await db.notificacion.findUnique({ where: { id: notificacionId } });
  if (!n?.destinatarioId || n.tipo !== "HORARIO_SEMANAL") return;
  // la semana ISO del envío original: se busca el lunes correspondiente cerca de la fecha de envío
  const base = lunesDe(hoyISO(n.fechaEnvio));
  const lunes = [base, sumarDias(base, 7), sumarDias(base, -7)].find((l) => semanaISO(l) === n.semana) ?? sumarDias(base, 7);
  await enviarHorarioA(n.destinatarioId, lunes);
  revalidatePath("/admin/correos");
}
