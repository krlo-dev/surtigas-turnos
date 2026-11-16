import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { aFecha, aISO, hoyISO, sumarDias } from "@/lib/fechas";
import { FormularioReporte } from "./formulario";

export const metadata = { title: "Reportar ausencia" };

export default async function Reportar({ searchParams }: { searchParams: Promise<{ fecha?: string }> }) {
  const { fecha } = await searchParams;
  const s = await auth();
  const hoy = hoyISO();
  const [turnos, admin] = await Promise.all([
    db.turno.findMany({ where: { usuarioId: s!.user.id, fecha: { gte: aFecha(sumarDias(hoy, -7)), lte: aFecha(sumarDias(hoy, 90)) }, estado: { not: "LIBERADO" } }, include: { oficina: true }, orderBy: [{ fecha: "asc" }, { horaInicio: "asc" }] }),
    db.usuario.findFirst({ where: { rol: "ADMIN", activo: true }, orderBy: { creadoEn: "asc" } }),
  ]);
  const nombreAdmin = admin?.nombre.split(" ")[0] ?? "La administración";
  return (
    <main className="principal">
      <Link href="/colaborador" className="volver"><ArrowLeft /> Mi semana</Link>
      <h1 className="titulo-pagina">Reportar una ausencia</h1>
      <p className="sub">{nombreAdmin} recibe el aviso en segundos y te responde por correo.</p>
      <FormularioReporte
        hoy={hoy}
        inicial={fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : null}
        admin={nombreAdmin}
        turnos={turnos.map((t) => ({ fecha: aISO(t.fecha), inicio: t.horaInicio, fin: t.horaFin, oficina: t.oficina.nombre }))}
      />
    </main>
  );
}
