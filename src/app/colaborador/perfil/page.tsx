import { CircleHelp, LogOut, Mail } from "lucide-react";
import Link from "next/link";
import { auth } from "@/auth";
import { cerrarSesion } from "@/app/acciones/sesion";
import { Avatar } from "@/components/ui";
import { db } from "@/lib/db";

export const metadata = { title: "Perfil" };

export default async function Perfil() {
  const s = await auth();
  const [u, admin] = await Promise.all([
    db.usuario.findUniqueOrThrow({ where: { id: s!.user.id }, include: { oficina: true } }),
    db.usuario.findFirst({ where: { rol: "ADMIN", activo: true }, orderBy: { creadoEn: "asc" } }),
  ]);
  return (
    <main className="principal" style={{ maxWidth: 560 }}>
      <div className="perfil">
        <Avatar nombre={u.nombre} tam="xl" />
        <div className="nombre">{u.nombre}</div>
        <div className="contexto">{u.correo}</div>
        <div className="contexto">{u.oficina?.nombre} · {u.horasSemana} h por semana</div>
      </div>
      <div className="lista-filas" style={{ marginTop: 20 }}>
        {admin && (
          <a href={`mailto:${admin.correo}`} className="fila">
            <span className="icono-circulo azul sm"><Mail /></span>
            <span style={{ flex: 1 }}>Escribir a {admin.nombre} <span className="muted">· tu administradora</span></span>
          </a>
        )}
        <Link href="/ayuda" className="fila">
          <span className="icono-circulo sm"><CircleHelp /></span>
          <span style={{ flex: 1 }}>Ayuda e información</span>
        </Link>
        <form action={cerrarSesion} className="fila">
          <span className="icono-circulo rojo sm"><LogOut /></span>
          <button className="btn-texto-peligro" style={{ border: 0, background: "none", padding: 0, fontWeight: 500 }}>Cerrar sesión</button>
        </form>
      </div>
    </main>
  );
}
