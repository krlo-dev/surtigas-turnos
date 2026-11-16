import { CalendarDays, CircleHelp, FilePlus2, ListChecks, LogOut, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { auth } from "@/auth";
import { cerrarSesion } from "@/app/acciones/sesion";
import { NavLateral, TabsMovil } from "@/components/shell/navegacion";
import { Avatar } from "@/components/ui";
import { db } from "@/lib/db";
import { asegurarSimulacionAlDia } from "@/lib/servicios/simulacion";

export const dynamic = "force-dynamic";

export default async function LayoutColaborador({ children }: { children: ReactNode }) {
  const sesion = await auth();
  if (!sesion?.user) redirect("/entrar");
  await asegurarSimulacionAlDia();
  const [pendientes, admin] = await Promise.all([
    db.excusa.count({ where: { usuarioId: sesion.user.id, estado: "PENDIENTE" } }),
    db.usuario.findFirst({ where: { rol: "ADMIN", activo: true }, orderBy: { creadoEn: "asc" } }),
  ]);
  const nombreAdmin = admin?.nombre.split(" ")[0] ?? "la administración";
  return (
    <div className="hoja">
      <aside className="lateral">
        <Link href="/colaborador" className="logo">
          <Image src="/logo-surtigas.svg" alt="Surtigas" width={92} height={41} priority />
        </Link>
        <NavLateral
          grupos={[
            [
              { href: "/colaborador", label: "Mi semana", icono: <CalendarDays />, exacto: true },
              { href: "/colaborador/reportar", label: "Reportar ausencia", icono: <FilePlus2 /> },
              { href: "/colaborador/solicitudes", label: "Mis solicitudes", icono: <ListChecks />, badge: pendientes },
            ],
          ]}
        />
        <div className="espaciador" />
        <div className="promo">
          <h4>¿No puedes ir?</h4>
          <p>Repórtalo aquí y {nombreAdmin} recibe el aviso al instante.</p>
          <Link href="/colaborador/reportar" className="btn-promo">Reportar ausencia</Link>
        </div>
        <Link href="/ayuda" className="nav-item">
          <CircleHelp />
          <span className="etiqueta">Ayuda e información</span>
        </Link>
        <form action={cerrarSesion}>
          <button type="submit" className="nav-item" style={{ width: "100%", background: "none", border: 0 }}>
            <LogOut />
            <span className="etiqueta" style={{ textAlign: "left" }}>Cerrar sesión</span>
          </button>
        </form>
        <div className="pie-lateral">Prototipo · datos simulados</div>
      </aside>

      <header className="barra-movil">
        <Image src="/logo-surtigas.svg" alt="Surtigas" width={78} height={35} />
        <span className="chip" style={{ height: 24, fontSize: 11 }}>Datos simulados</span>
        <span style={{ flex: 1 }} />
        <Link href="/colaborador/perfil" aria-label="Perfil">
          <Avatar nombre={sesion.user.name ?? "Colaborador"} tam="md" />
        </Link>
      </header>

      {children}

      <TabsMovil
        items={[
          { href: "/colaborador", label: "Semana", icono: <CalendarDays />, exacto: true },
          { href: "/colaborador/reportar", label: "Reportar", icono: <FilePlus2 /> },
          { href: "/colaborador/solicitudes", label: "Solicitudes", icono: <ListChecks /> },
          { href: "/colaborador/perfil", label: "Perfil", icono: <User /> },
        ]}
      />
    </div>
  );
}
