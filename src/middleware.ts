import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Middleware de Next.js: valida la sesión y el rol antes de cada ruta protegida (RF-02).
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo-surtigas.svg|login-arte.jpg|.*\\.(?:png|jpg|svg|webp|ico)$).*)"],
};
