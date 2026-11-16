"use client";

import { Bell, Building2, CalendarDays, ChevronDown, CircleHelp, Inbox, ListChecks, LogOut, Plus, Search, UserPlus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Avatar } from "../ui";

type Item = { href: string; label: string; icono: ReactNode; badge?: number; mas?: string; exacto?: boolean };

function activo(pathname: string, it: Item) {
  return it.exacto ? pathname === it.href : pathname === it.href || pathname.startsWith(`${it.href}/`);
}

export function NavLateral({ grupos }: { grupos: Item[][] }) {
  const pathname = usePathname();
  return (
    <nav>
      {grupos.map((g, i) => (
        <div key={i}>
          {i > 0 && <div className="nav-sep" />}
          {g.map((it) => (
            <Link key={it.href} href={it.href} className={`nav-item ${activo(pathname, it) ? "activo" : ""}`}>
              {it.icono}
              <span className="etiqueta">
                <span>{it.label}</span>
              </span>
              {it.badge ? <span className="nav-badge">{it.badge}</span> : null}
              {it.mas ? (
                <span
                  className="nav-mas"
                  role="link"
                  aria-label={`Nuevo en ${it.label}`}
                  onClick={(e) => {
                    e.preventDefault();
                    window.location.href = it.mas!;
                  }}
                >
                  <Plus />
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}

export function TabsMovil({ items }: { items: { href: string; label: string; icono: ReactNode; exacto?: boolean }[] }) {
  const pathname = usePathname();
  return (
    <nav className="tabs-movil">
      {items.map((it) => (
        <Link key={it.href} href={it.href} className={activo(pathname, it) ? "activo" : ""}>
          {it.icono}
          <span>{it.label}</span>
        </Link>
      ))}
    </nav>
  );
}

function useFuera(abierto: boolean, cerrar: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const f = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cerrar();
    };
    document.addEventListener("mousedown", f);
    return () => document.removeEventListener("mousedown", f);
  }, [abierto, cerrar]);
  return ref;
}

export function BarraSuperior({
  nombre,
  pendientes,
  placeholder = "Buscar persona, oficina o solicitud",
  cerrarSesion,
}: {
  nombre: string;
  pendientes: { codigo: string; texto: string }[];
  placeholder?: string;
  cerrarSesion: () => Promise<void>;
}) {
  const router = useRouter();
  const [menu, setMenu] = useState<"" | "crear" | "avisos" | "usuario">("");
  const cerrar = () => setMenu("");
  const ref = useFuera(menu !== "", cerrar);
  return (
    <div className="barra" ref={ref}>
      <form
        className="buscador"
        onSubmit={(e) => {
          e.preventDefault();
          const q = new FormData(e.currentTarget).get("q");
          router.push(`/admin/buscar?q=${encodeURIComponent(String(q ?? ""))}`);
        }}
      >
        <Search />
        <input name="q" placeholder={placeholder} aria-label="Buscar" />
      </form>
      <div className="flex-1" />
      <div style={{ position: "relative" }}>
        <button className="btn-icono azul" aria-label="Crear" onClick={() => setMenu(menu === "crear" ? "" : "crear")}>
          <Plus />
        </button>
        {menu === "crear" && (
          <div className="popover" style={{ right: 0, top: 48 }}>
            <Link href="/admin/malla?nuevo=1" onClick={cerrar}>
              <CalendarDays /> Nuevo turno
            </Link>
            <Link href="/admin/equipo?agregar=1" onClick={cerrar}>
              <UserPlus /> Agregar persona
            </Link>
            <Link href="/admin/oficinas?nueva=1" onClick={cerrar}>
              <Building2 /> Nueva oficina
            </Link>
            <Link href="/admin/malla/propuesta" onClick={cerrar}>
              <ListChecks /> Propuesta del motor
            </Link>
          </div>
        )}
      </div>
      <div style={{ position: "relative" }}>
        <button className="btn-icono" aria-label="Avisos" onClick={() => setMenu(menu === "avisos" ? "" : "avisos")}>
          <Bell />
          {pendientes.length > 0 && <span className="ping" />}
        </button>
        {menu === "avisos" && (
          <div className="popover" style={{ right: 0, top: 48, width: 300 }}>
            {pendientes.length === 0 && <div style={{ padding: 10, color: "var(--muted)", fontSize: 12.5 }}>Nada pendiente por ahora.</div>}
            {pendientes.slice(0, 6).map((p) => (
              <Link key={p.codigo} href={`/admin/ausencias/${p.codigo}`} onClick={cerrar}>
                <Inbox /> <span style={{ flex: 1 }}>{p.texto}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
      <div style={{ position: "relative" }}>
        <button className="chip-usuario" onClick={() => setMenu(menu === "usuario" ? "" : "usuario")}>
          <Avatar nombre={nombre} tam="sm" /> {nombre} <ChevronDown />
        </button>
        {menu === "usuario" && (
          <div className="popover" style={{ right: 0, top: 50 }}>
            <Link href="/ayuda" onClick={cerrar}>
              <CircleHelp /> Ayuda e información
            </Link>
            <form action={cerrarSesion}>
              <button type="submit">
                <LogOut /> Cerrar sesión
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
