import { auth } from "@/auth";
import { cerrarSesion } from "@/app/acciones/sesion";
import { db } from "@/lib/db";
import { BarraSuperior } from "./navegacion";

export async function BarraAdmin({ placeholder }: { placeholder?: string }) {
  const [sesion, pendientes] = await Promise.all([
    auth(),
    db.excusa.findMany({ where: { estado: "PENDIENTE" }, include: { usuario: { select: { nombre: true } } }, orderBy: { creadoEn: "desc" }, take: 8 }),
  ]);
  return (
    <BarraSuperior
      nombre={sesion?.user?.name ?? "Administración"}
      placeholder={placeholder}
      cerrarSesion={cerrarSesion}
      pendientes={pendientes.map((p) => ({ codigo: `EX-${p.codigo}`, texto: `${p.usuario.nombre} · EX-${p.codigo}` }))}
    />
  );
}
