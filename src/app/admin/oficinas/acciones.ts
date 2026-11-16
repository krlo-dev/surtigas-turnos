"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { sesionRequerida } from "@/auth";
import { db } from "@/lib/db";

const esquema = z.object({
  nombre: z.string().trim().min(2, "Escribe el nombre de la oficina."),
  ciudad: z.string().trim().min(2, "Escribe la ciudad."),
  zona: z.string().trim().min(2, "Escribe la zona."),
  capacidad: z.coerce.number().int().min(1).max(40),
  horaApertura: z.coerce.number().int().min(5).max(12),
  horaCierre: z.coerce.number().int().min(12).max(22),
  horaCierreSabado: z.coerce.number().int().min(9).max(18),
  codigoDigiturno: z.union([z.literal(""), z.coerce.number().int().positive()]).optional(),
});

export async function guardarOficina(id: string | null, _prev: unknown, form: FormData) {
  await sesionRequerida("ADMIN");
  const r = esquema.safeParse(Object.fromEntries(form));
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Revisa los datos." };
  const d = r.data;
  const data = {
    nombre: d.nombre,
    ciudad: d.ciudad,
    zona: d.zona,
    capacidad: d.capacidad,
    horaApertura: d.horaApertura,
    horaCierre: d.horaCierre,
    horaCierreSabado: d.horaCierreSabado,
    abreSabado: form.get("abreSabado") === "on",
    atencionVirtual: form.get("atencionVirtual") === "on",
    activa: form.get("activa") !== null ? form.get("activa") === "on" : true,
    codigoDigiturno: d.codigoDigiturno === "" || d.codigoDigiturno === undefined ? null : d.codigoDigiturno,
  };
  try {
    if (id) await db.oficina.update({ where: { id }, data });
    else await db.oficina.create({ data });
  } catch {
    return { error: "Ya existe una oficina con ese código de Digiturno." };
  }
  revalidatePath("/admin/oficinas");
  redirect("/admin/oficinas");
}
