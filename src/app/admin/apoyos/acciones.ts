"use server";

import { revalidatePath } from "next/cache";
import { sesionRequerida } from "@/auth";
import type { SugerenciaApoyo } from "@/lib/engine/tipos";
import { aplicarApoyo } from "@/lib/servicios/malla";

export async function decidirApoyo(s: SugerenciaApoyo, aplicar: boolean) {
  await sesionRequerida("ADMIN");
  await aplicarApoyo(s, aplicar);
  revalidatePath("/admin/apoyos");
  revalidatePath("/admin");
}
