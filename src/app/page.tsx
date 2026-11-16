import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function Inicio() {
  const s = await auth();
  if (!s?.user) redirect("/entrar");
  redirect(s.user.rol === "ADMIN" ? "/admin" : "/colaborador");
}
