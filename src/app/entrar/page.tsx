import { LockKeyhole } from "lucide-react";
import type { Metadata } from "next";
import { MarcoAcceso } from "@/components/acceso/marco";
import { FormularioEntrar } from "./formulario";

export const metadata: Metadata = { title: "Entrar" };

export default async function PaginaEntrar({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const { callbackUrl } = await searchParams;
  let desde = "/";
  try {
    if (callbackUrl) desde = new URL(callbackUrl, "http://x").pathname;
  } catch {}
  // En el prototipo, "ver como" llena la contraseña de demostración si está habilitada.
  const demo = process.env.DEMO_PASSWORD_PUBLICA === "false" ? null : process.env.SEED_PASSWORD || "Surtigas2026";
  return (
    <MarcoAcceso
      pie={
        <>
          <LockKeyhole size={14} /> Conexión cifrada
        </>
      }
    >
      <FormularioEntrar desde={desde} demoClave={demo} />
    </MarcoAcceso>
  );
}
