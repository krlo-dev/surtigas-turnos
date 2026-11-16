import type { NextAuthConfig } from "next-auth";

// Configuración compatible con el middleware (sin Prisma ni bcrypt). El control de acceso por rol
// se aplica aquí, antes de que la petición llegue a cualquier página (ERS 4.6).

const RUTAS_PUBLICAS = ["/entrar", "/recuperar", "/api/auth", "/api/cron"];
const DOCE_HORAS = 12 * 60 * 60 * 1000;

export const authConfig = {
  pages: { signIn: "/entrar" },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  trustHost: true,
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      if (RUTAS_PUBLICAS.some((r) => pathname === r || pathname.startsWith(`${r}/`))) return true;
      const usuario = auth?.user;
      if (!usuario) return false; // Auth.js redirige a /entrar
      const rol = usuario.rol;
      if (pathname === "/") return Response.redirect(new URL(rol === "ADMIN" ? "/admin" : "/colaborador", request.nextUrl));
      if (pathname.startsWith("/admin") && rol !== "ADMIN") return Response.redirect(new URL("/acceso-denegado", request.nextUrl));
      if (pathname.startsWith("/colaborador") && rol !== "COLABORADOR") return Response.redirect(new URL("/admin", request.nextUrl));
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.rol = user.rol;
        token.oficinaId = user.oficinaId ?? null;
        token.vence = user.recordar ? null : Date.now() + DOCE_HORAS;
      }
      // "Mantener sesión" desmarcado: la sesión dura 12 horas
      if (typeof token.vence === "number" && Date.now() > token.vence) return null;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      session.user.rol = token.rol as "ADMIN" | "COLABORADOR";
      session.user.oficinaId = (token.oficinaId as string | null) ?? null;
      return session;
    },
  },
} satisfies NextAuthConfig;
