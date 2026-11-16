import { Building2 } from "lucide-react";
import Link from "next/link";
import { BarraAdmin } from "@/components/shell/barra-admin";
import { Avatar, ChipTipo, EstadoExcusaPunto } from "@/components/ui";
import { db } from "@/lib/db";
import { aISO, fmtRangoFechas } from "@/lib/fechas";

export const metadata = { title: "Buscar" };

export default async function Buscar({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = (await searchParams).q?.trim() ?? "";
  const codigo = Number(q.replace(/^EX-?/i, ""));
  const modo = "insensitive" as const;
  const [personas, oficinas, excusas] = q
    ? await Promise.all([
        db.usuario.findMany({ where: { OR: [{ nombre: { contains: q, mode: modo } }, { correo: { contains: q, mode: modo } }] }, include: { oficina: true }, take: 10 }),
        db.oficina.findMany({ where: { OR: [{ nombre: { contains: q, mode: modo } }, { ciudad: { contains: q, mode: modo } }] }, take: 10 }),
        db.excusa.findMany({ where: { OR: [...(Number.isFinite(codigo) && codigo > 0 ? [{ codigo }] : []), { motivo: { contains: q, mode: modo } }, { usuario: { nombre: { contains: q, mode: modo } } }] }, include: { usuario: true }, orderBy: { creadoEn: "desc" }, take: 10 }),
      ])
    : [[], [], []];
  return (
    <main className="principal">
      <BarraAdmin />
      <h1 className="titulo-pagina">Resultados para “{q}”</h1>
      {!personas.length && !oficinas.length && !excusas.length && <p className="sub">No encontramos personas, oficinas ni solicitudes con ese texto.</p>}
      {personas.length > 0 && (
        <section className="seccion">
          <h2 className="titulo-seccion">Personas</h2>
          <div className="lista-filas" style={{ marginTop: 8 }}>
            {personas.map((p) => (
              <Link key={p.id} href={`/admin/equipo?editar=${p.id}`} className="fila">
                <Avatar nombre={p.nombre} tam="sm" />
                <span style={{ flex: 1 }}><b style={{ fontWeight: 500 }}>{p.nombre}</b> <span className="ink2">· {p.oficina?.nombre ?? "Administración"} · {p.correo}</span></span>
              </Link>
            ))}
          </div>
        </section>
      )}
      {oficinas.length > 0 && (
        <section className="seccion">
          <h2 className="titulo-seccion">Oficinas</h2>
          <div className="lista-filas" style={{ marginTop: 8 }}>
            {oficinas.map((o) => (
              <Link key={o.id} href={`/admin/malla?oficina=${o.id}`} className="fila">
                <span className="icono-circulo azul sm"><Building2 /></span>
                <span style={{ flex: 1 }}><b style={{ fontWeight: 500 }}>{o.nombre}</b> <span className="ink2">· {o.ciudad} · {o.capacidad} puestos</span></span>
              </Link>
            ))}
          </div>
        </section>
      )}
      {excusas.length > 0 && (
        <section className="seccion">
          <h2 className="titulo-seccion">Solicitudes</h2>
          <div className="lista-filas" style={{ marginTop: 8 }}>
            {excusas.map((e) => (
              <Link key={e.id} href={`/admin/ausencias/EX-${e.codigo}`} className="fila">
                <span className="codigo ink2" style={{ width: 70 }}>EX-{e.codigo}</span>
                <ChipTipo tipo={e.tipo} />
                <span style={{ flex: 1 }}><b style={{ fontWeight: 500 }}>{e.usuario.nombre}</b> <span className="ink2">· {fmtRangoFechas(aISO(e.fechaInicio), aISO(e.fechaFin))}</span></span>
                <EstadoExcusaPunto estado={e.estado} />
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
