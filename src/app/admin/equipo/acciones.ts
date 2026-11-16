"use server";

import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { sesionRequerida } from "@/auth";
import { db } from "@/lib/db";
import { URL_APP, correoInvitacion } from "@/lib/notificaciones/plantillas";
import { obtenerNotificador } from "@/lib/notificaciones/servicio";

const esquema = z.object({
  nombre: z.string().trim().min(3, "Escribe el nombre completo."),
  correo: z.string().trim().toLowerCase().email("Escribe un correo válido."),
  rol: z.enum(["ADMIN", "COLABORADOR"]),
  oficinaId: z.string().optional(),
  horasSemana: z.coerce.number().int().min(0).max(48),
});

export async function guardarPersona(id: string | null, _prev: unknown, form: FormData) {
  const admin = await sesionRequerida("ADMIN");
  const r = esquema.safeParse(Object.fromEntries(form));
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Revisa los datos." };
  const d = r.data;
  if (d.rol === "COLABORADOR" && !d.oficinaId) return { error: "Elige la oficina base." };
  const data = { nombre: d.nombre, correo: d.correo, rol: d.rol, oficinaId: d.rol === "COLABORADOR" ? d.oficinaId! : null, horasSemana: d.rol === "COLABORADOR" ? d.horasSemana : 0 };
  try {
    if (id) {
      if (id === admin.id && form.get("activo") !== "on") return { error: "No puedes desactivar tu propia cuenta." };
      await db.usuario.update({ where: { id }, data: { ...data, activo: form.get("activo") === "on" } });
    } else {
      const u = await db.usuario.create({ data: { ...data, passwordHash: await bcrypt.hash(randomBytes(18).toString("base64url"), 10) } });
      if (form.get("invitar") === "on") {
        const token = randomBytes(24).toString("base64url");
        await db.tokenRecuperacion.create({ data: { usuarioId: u.id, tokenHash: createHash("sha256").update(token).digest("hex"), expira: new Date(Date.now() + 7 * 86_400_000) } });
        const c = correoInvitacion(u.nombre, u.correo, `${URL_APP()}/recuperar?token=${token}`);
        await obtenerNotificador().enviar({ tipo: "INVITACION", para: { correo: u.correo, nombre: u.nombre, usuarioId: u.id }, asunto: c.asunto, html: c.html, texto: c.texto });
      }
    }
  } catch {
    return { error: "Ya existe una persona con ese correo." };
  }
  revalidatePath("/admin/equipo");
  redirect(`/admin/equipo?listo=${encodeURIComponent(d.nombre)}`);
}
