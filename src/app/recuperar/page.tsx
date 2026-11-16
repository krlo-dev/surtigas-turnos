import type { Metadata } from "next";
import { MarcoAcceso } from "@/components/acceso/marco";
import { FormularioRecuperar } from "./formulario";

export const metadata: Metadata = { title: "Recuperar acceso" };

export default async function PaginaRecuperar({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <MarcoAcceso pie={<span>¿Sin acceso al correo? Escribe a la administración de turnos de tu zona.</span>}>
      <FormularioRecuperar token={token ?? null} />
    </MarcoAcceso>
  );
}
