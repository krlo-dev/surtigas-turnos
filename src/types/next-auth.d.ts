import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    rol: "ADMIN" | "COLABORADOR";
    oficinaId: string | null;
    recordar?: boolean;
  }
  interface Session {
    user: {
      id: string;
      rol: "ADMIN" | "COLABORADOR";
      oficinaId: string | null;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    rol?: "ADMIN" | "COLABORADOR";
    oficinaId?: string | null;
    vence?: number | null;
  }
}
