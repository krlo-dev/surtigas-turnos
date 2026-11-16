import bcrypt from "bcryptjs";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { db } from "./lib/db";

const esquema = z.object({
  correo: z.string().trim().toLowerCase().email(),
  contrasena: z.string().min(1),
  recordar: z.string().optional(),
});

class CredencialesInvalidas extends CredentialsSignin {
  code = "credenciales";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { correo: {}, contrasena: {}, recordar: {} },
      async authorize(datos) {
        const r = esquema.safeParse(datos);
        if (!r.success) throw new CredencialesInvalidas();
        const usuario = await db.usuario.findUnique({ where: { correo: r.data.correo } });
        if (!usuario || !usuario.activo) throw new CredencialesInvalidas();
        const ok = await bcrypt.compare(r.data.contrasena, usuario.passwordHash);
        if (!ok) throw new CredencialesInvalidas();
        return {
          id: usuario.id,
          name: usuario.nombre,
          email: usuario.correo,
          rol: usuario.rol,
          oficinaId: usuario.oficinaId,
          recordar: r.data.recordar === "on" || r.data.recordar === "true",
        };
      },
    }),
  ],
});

/** Sesión obligatoria para server actions y páginas. */
export async function sesionRequerida(rol?: "ADMIN" | "COLABORADOR") {
  const s = await auth();
  if (!s?.user?.id) throw new Error("No autenticado");
  if (rol && s.user.rol !== rol) throw new Error("No autorizado");
  return s.user;
}
