import { ArrowLeftRight, Bell, Building2, CalendarDays, CircleHelp, Database, House, Inbox, LogOut, Mail, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { auth } from "@/auth";
import { cerrarSesion } from "@/app/acciones/sesion";
import { NavLateral, TabsMovil } from "@/components/shell/navegacion";
import { Avatar } from "@/components/ui";
import { db } from "@/lib/db";
import { DIAS_LARGOS, partes } from "@/lib/fechas";
import { proximoEnvio } from "@/lib/servicios/malla";
import { asegurarSimulacionAlDia } from "@/lib/servicios/simulacion";

export const dynamic = "force-dynamic";

export default async function LayoutAdmin({ children }: { children: ReactNode }) {
  const sesion = await auth();
  if (!sesion?.user) redirect("/entrar");
  await asegurarSimulacionAlDia();
  const [pendientes, colaboradores] = await Promise.all([
    db.excusa.count({ where: { estado: "PENDIENTE" } }),
    db.usuario.count({ where: { rol: "COLABORADOR", activo: true } }),
  ]);
  const envio = proximoEnvio();

  return (
    <div className="hoja">
      <aside className="lateral">
        <Link href="/admin" className="logo">
          <Image src="/logo-surtigas.svg" alt="Surtigas" width={92} height={41} priority />
        </Link>
        <NavLateral
          grupos={[
            [
              { href: "/admin", label: "Inicio", icono: <House />, exacto: true },
              { href: "/admin/malla", label: "Malla de turnos", icono: <CalendarDays />, mas: "/admin/malla?nuevo=1" },
              { href: "/admin/ausencias", label: "Ausencias", icono: <Inbox />, badge: pendientes },
              { href: "/admin/apoyos", label: "Apoyos entre oficinas", icono: <ArrowLeftRight /> },
            ],
            [
              { href: "/admin/oficinas", label: "Oficinas", icono: <Building2 /> },
              { href: "/admin/equipo", label: "Equipo", icono: <Users />, mas: "/admin/equipo?agregar=1" },
              { href: "/admin/correos", label: "Correos", icono: <Mail /> },
              { href: "/admin/datos", label: "Datos Digiturno", icono: <Database /> },
            ],
          ]}
        />
        <div className="espaciador" />
        <div className="promo">
          <h4>Horario semana {envio.semana}</h4>
          <p>
            Sale el {DIAS_LARGOS[0].toLowerCase()} {partes(envio.domingo).dia} a las 18:00 para {colaboradores} personas.
          </p>
          <Link href="/admin/correos" className="btn-promo">
            Revisar envío
          </Link>
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
        <Link href="/admin/ausencias" className="btn-icono redondo sm" aria-label="Ausencias">
          <Bell />
          {pendientes > 0 && <span className="ping" style={{ top: 5, right: 6 }} />}
        </Link>
        <form action={cerrarSesion}>
          <button type="submit" style={{ background: "none", border: 0, padding: 0 }} aria-label="Cerrar sesión">
            <Avatar nombre={sesion.user.name ?? "Admin"} tam="md" />
          </button>
        </form>
      </header>

      {children}

      <TabsMovil
        items={[
          { href: "/admin", label: "Inicio", icono: <House />, exacto: true },
          { href: "/admin/malla", label: "Malla", icono: <CalendarDays /> },
          { href: "/admin/ausencias", label: "Ausencias", icono: <Inbox /> },
          { href: "/admin/equipo", label: "Equipo", icono: <Users /> },
        ]}
      />
    </div>
  );
}
