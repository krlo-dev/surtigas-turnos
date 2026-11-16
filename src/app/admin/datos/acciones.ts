"use server";

import { revalidatePath } from "next/cache";
import { sesionRequerida } from "@/auth";
import { db } from "@/lib/db";
import { asegurarSimulacionAlDia } from "@/lib/servicios/simulacion";

export async function cambiarSimulacion(activa: boolean) {
  await sesionRequerida("ADMIN");
  await db.configuracion.upsert({ where: { clave: "simulacionActiva" }, create: { clave: "simulacionActiva", valor: activa }, update: { valor: activa } });
  if (activa) await asegurarSimulacionAlDia(true);
  revalidatePath("/admin", "layout");
}
