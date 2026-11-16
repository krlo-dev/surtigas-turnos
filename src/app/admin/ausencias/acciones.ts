"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sesionRequerida } from "@/auth";
import { numeroDeCodigo, resolverExcusa } from "@/lib/servicios/excusas";

export async function resolver(codigo: string, aprobar: boolean, form: FormData) {
  const u = await sesionRequerida("ADMIN");
  const comentario = String(form.get("comentario") ?? "");
  const { corridaId } = await resolverExcusa(numeroDeCodigo(codigo), aprobar, comentario, u.id);
  revalidatePath("/admin", "layout");
  if (corridaId) redirect(`/admin/malla/recalculo?id=${corridaId}`);
  redirect(`/admin/ausencias?resuelta=${codigo}`);
}
