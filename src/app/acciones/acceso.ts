"use server";

import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { db } from "@/lib/db";
import { URL_APP, correoRecuperar } from "@/lib/notificaciones/plantillas";
import { obtenerNotificador } from "@/lib/notificaciones/servicio";

export type EstadoForm = { error?: string; ok?: string; correo?: string } | undefined;

export async function entrar(_prev: EstadoForm, form: FormData): Promise<EstadoForm> {
  const correo = String(form.get("correo") ?? "").trim().toLowerCase();
  const u = await db.usuario.findUnique({ where: { correo }, select: { rol: true } });
  const inicio = u?.rol === "ADMIN" ? "/admin" : "/colaborador";
  const desde = String(form.get("desde") || "/");
  const destino = desde === "/" || (u?.rol === "COLABORADOR" && desde.startsWith("/admin")) || (u?.rol === "ADMIN" && desde.startsWith("/colaborador")) ? inicio : desde;
  try {
    await signIn("credentials", {
      correo,
      contrasena: String(form.get("contrasena") ?? ""),
      recordar: form.get("recordar") === "on" ? "true" : "false",
      redirectTo: destino,
    });
  } catch (e) {
    if (e instanceof AuthError) return { error: "El correo o la contraseña no coinciden.", correo };
    throw e;
  }
}

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

function enmascarar(correo: string) {
  const [u, d] = correo.split("@");
  return `${u[0]}••••@${d}`;
}

export async function pedirEnlace(_prev: EstadoForm, form: FormData): Promise<EstadoForm> {
  const correo = String(form.get("correo") ?? "").trim().toLowerCase();
  if (!correo.includes("@")) return { error: "Escribe tu correo de Surtigas.", correo };
  const u = await db.usuario.findUnique({ where: { correo } });
  // Por seguridad la respuesta es la misma exista o no la cuenta.
  if (u?.activo) {
    const token = randomBytes(24).toString("base64url");
    await db.tokenRecuperacion.create({ data: { usuarioId: u.id, tokenHash: hashToken(token), expira: new Date(Date.now() + 30 * 60_000) } });
    const c = correoRecuperar(u.nombre, `${URL_APP()}/recuperar?token=${token}`);
    await obtenerNotificador().enviar({ tipo: "RECUPERAR_CLAVE", para: { correo: u.correo, nombre: u.nombre, usuarioId: u.id }, asunto: c.asunto, html: c.html, texto: c.texto });
  }
  return { ok: enmascarar(correo), correo };
}

export async function cambiarContrasena(_prev: EstadoForm, form: FormData): Promise<EstadoForm> {
  const token = String(form.get("token") ?? "");
  const clave = String(form.get("contrasena") ?? "");
  if (clave.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };
  const t = await db.tokenRecuperacion.findUnique({ where: { tokenHash: hashToken(token) }, include: { usuario: true } });
  if (!t || t.usado || t.expira < new Date()) return { error: "El enlace venció o ya se usó. Pide uno nuevo." };
  await db.$transaction([
    db.usuario.update({ where: { id: t.usuarioId }, data: { passwordHash: await bcrypt.hash(clave, 10) } }),
    db.tokenRecuperacion.update({ where: { id: t.id }, data: { usado: true } }),
  ]);
  try {
    await signIn("credentials", { correo: t.usuario.correo, contrasena: clave, recordar: "false", redirectTo: t.usuario.rol === "ADMIN" ? "/admin" : "/colaborador" });
  } catch (e) {
    if (e instanceof AuthError) return { ok: "Contraseña guardada. Ya puedes entrar." };
    throw e;
  }
}
