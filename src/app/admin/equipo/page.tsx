import { Pencil, ShieldCheck, User } from "lucide-react";
import Link from "next/link";
import { BarraAdmin } from "@/components/shell/barra-admin";
import { Avatar, Estado } from "@/components/ui";
import { db } from "@/lib/db";
import { aFecha, hoyISO } from "@/lib/fechas";
import { PanelPersona } from "./panel";

export const metadata = { title: "Equipo" };

const FILTROS = [
  { clave: "todos", texto: "Todos" },
  { clave: "colaboradores", texto: "Colaboradores" },
  { clave: "administracion", texto: "Administración" },
];

const fem = (n: string) => /a$/i.test(n.split(" ")[0]);

export default async function PaginaEquipo({ searchParams }: { searchParams: Promise<{ filtro?: string; editar?: string; listo?: string; q?: string }> }) {
  const sp = await searchParams;
  const filtro = FILTROS.find((f) => f.clave === sp.filtro)?.clave ?? "todos";
  const hoy = aFecha(hoyISO());
  const [personas, oficinas, excusas, turnosHoy] = await Promise.all([
    db.usuario.findMany({ include: { oficina: true }, orderBy: [{ rol: "asc" }, { activo: "desc" }, { oficina: { nombre: "asc" } }, { nombre: "asc" }] }),
    db.oficina.findMany({ where: { activa: true }, orderBy: { nombre: "asc" } }),
    db.excusa.findMany({ where: { OR: [{ estado: "PENDIENTE" }, { estado: "APROBADA", fechaInicio: { lte: hoy }, fechaFin: { gte: hoy } }] } }),
    db.turno.findMany({ where: { fecha: hoy, estado: { not: "LIBERADO" } }, include: { oficina: true } }),
  ]);
  const visibles = personas.filter((p) => (filtro === "todos" ? true : filtro === "colaboradores" ? p.rol === "COLABORADOR" : p.rol === "ADMIN")).filter((p) => !sp.q || p.nombre.toLowerCase().includes(sp.q.toLowerCase()));
  const editar = sp.editar ? personas.find((p) => p.id === sp.editar) ?? null : null;
  const colaboradores = personas.filter((p) => p.rol === "COLABORADOR" && p.activo).length;
  const admins = personas.filter((p) => p.rol === "ADMIN" && p.activo).length;

  const estado = (p: (typeof personas)[number]) => {
    if (!p.activo) return { punto: "", texto: "Inactiva" };
    const aprobada = excusas.find((e) => e.usuarioId === p.id && e.estado === "APROBADA");
    if (aprobada) return { punto: aprobada.tipo === "INCAPACIDAD" ? "rojo" : "naranja", texto: aprobada.tipo === "INCAPACIDAD" ? (fem(p.nombre) ? "Incapacitada" : "Incapacitado") : aprobada.tipo === "PERMISO" ? "De permiso hoy" : "Con excusa hoy" };
    if (excusas.some((e) => e.usuarioId === p.id && e.estado === "PENDIENTE")) return { punto: "naranja", texto: "Ausencia pendiente" };
    const fuera = turnosHoy.find((t) => t.usuarioId === p.id && t.oficinaId !== p.oficinaId && p.oficinaId);
    if (fuera) return { punto: "azul", texto: `Apoyando en ${fuera.oficina.nombre.replace(/^Cartagena /, "")}` };
    return { punto: "lima", texto: fem(p.nombre) ? "Activa" : "Activo" };
  };

  return (
    <>
      <main className="principal">
        <BarraAdmin placeholder="Buscar persona" />
        <div className="encabezado">
          <div>
            <h1 className="titulo-pagina">Equipo</h1>
            <p className="sub">{colaboradores} colaboradores y {admins} {admins === 1 ? "administradora" : "personas de administración"}</p>
          </div>
          <div className="segmentado">
            {FILTROS.map((f) => (
              <Link key={f.clave} href={`/admin/equipo?filtro=${f.clave}`} className={f.clave === filtro ? "activo" : ""}>{f.texto}</Link>
            ))}
          </div>
        </div>
        {sp.listo && <div className="aviso ok" style={{ marginTop: 16 }}>Listo, {sp.listo} quedó guardado.</div>}
        <div className="tabla-scroll" style={{ marginTop: 24 }}>
          <table className="tabla" style={{ minWidth: 720 }}>
            <thead>
              <tr>
                <th>Persona</th>
                <th>Rol</th>
                <th>Oficina base</th>
                <th className="der">Horas</th>
                <th style={{ paddingLeft: 20 }}>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibles.map((p) => {
                const e = estado(p);
                return (
                  <tr key={p.id} style={{ opacity: p.activo ? 1 : 0.55 }}>
                    <td>
                      <div className="persona">
                        <Avatar nombre={p.nombre} tam="sm" />
                        <div>
                          <div className="nombre">{p.nombre}</div>
                          <div className="linea">{p.correo}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {p.rol === "ADMIN" ? (
                        <span className="chip chip-azul" style={{ boxShadow: "inset 0 0 0 1px var(--blue-100)" }}><ShieldCheck /> {fem(p.nombre) ? "Administradora" : "Administrador"}</span>
                      ) : (
                        <span className="chip"><User /> Colaborador</span>
                      )}
                    </td>
                    <td className="ink2">{p.oficina?.nombre ?? "Administración"}</td>
                    <td className="der" style={{ fontWeight: 500 }}>{p.rol === "ADMIN" ? "–" : `${p.horasSemana} h`}</td>
                    <td style={{ paddingLeft: 20 }}><Estado punto={e.punto}>{e.texto}</Estado></td>
                    <td className="der">
                      <Link href={`/admin/equipo?editar=${p.id}`} className="btn-icono sm" style={{ border: 0, marginLeft: "auto" }} aria-label={`Editar ${p.nombre}`}><Pencil /></Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="solo-sin-panel seccion" style={{ maxWidth: 420 }}>
          <PanelPersona persona={editar} oficinas={oficinas.map((o) => ({ id: o.id, nombre: o.nombre }))} />
        </div>
      </main>
      <aside className="panel">
        <PanelPersona persona={editar} oficinas={oficinas.map((o) => ({ id: o.id, nombre: o.nombre }))} />
      </aside>
    </>
  );
}
