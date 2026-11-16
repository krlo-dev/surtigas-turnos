import type { EstadoExcusa, Prisma } from "@prisma/client";
import { ChevronRight, Ellipsis, Mail } from "lucide-react";
import Link from "next/link";
import { BarraAdmin } from "@/components/shell/barra-admin";
import { Avatar, ChipTipo, EstadoExcusaPunto, NOMBRE_TIPO } from "@/components/ui";
import { db } from "@/lib/db";
import { aISO, fmtDiaMes, fmtHace, fmtNumero, fmtRangoFechas, diferenciaDias, hoyISO } from "@/lib/fechas";

export const metadata = { title: "Ausencias" };

const FILTROS: { clave: string; texto: string; estados: EstadoExcusa[] }[] = [
  { clave: "pendientes", texto: "Pendientes", estados: ["PENDIENTE"] },
  { clave: "aprobadas", texto: "Aprobadas", estados: ["APROBADA"] },
  { clave: "rechazadas", texto: "Rechazadas", estados: ["RECHAZADA"] },
  { clave: "todas", texto: "Todas", estados: ["PENDIENTE", "APROBADA", "RECHAZADA"] },
];

export default async function PaginaAusencias({ searchParams }: { searchParams: Promise<{ estado?: string; resuelta?: string }> }) {
  const sp = await searchParams;
  const filtro = FILTROS.find((f) => f.clave === sp.estado) ?? FILTROS[0];
  const where: Prisma.ExcusaWhereInput = { estado: { in: filtro.estados } };
  const [lista, pendientes, resueltas] = await Promise.all([
    db.excusa.findMany({ where, include: { usuario: { include: { oficina: true } } }, orderBy: filtro.clave === "pendientes" ? { codigo: "desc" } : { creadoEn: "desc" }, take: 80 }),
    db.excusa.findMany({ where: { estado: "PENDIENTE" }, select: { creadoEn: true } }),
    db.excusa.findMany({ where: { estado: { not: "PENDIENTE" }, resueltoEn: { not: null } }, select: { creadoEn: true, resueltoEn: true }, take: 200, orderBy: { resueltoEn: "desc" } }),
  ]);
  // En la lista de pendientes se muestran también las últimas resueltas, como en la bandeja de los mockups.
  const recientes = filtro.clave === "pendientes" ? await db.excusa.findMany({ where: { estado: { not: "PENDIENTE" } }, include: { usuario: { include: { oficina: true } } }, orderBy: { resueltoEn: "desc" }, take: 2 }) : [];
  const filas = [...lista, ...recientes];

  // Turnos que libera cada solicitud
  const turnos = filas.length
    ? await db.turno.findMany({
        where: { usuarioId: { in: [...new Set(filas.map((f) => f.usuarioId))] }, fecha: { gte: new Date(Math.min(...filas.map((f) => f.fechaInicio.getTime()))), lte: new Date(Math.max(...filas.map((f) => f.fechaFin.getTime()))) } },
        select: { usuarioId: true, fecha: true, estado: true, excusaId: true },
      })
    : [];
  const cuenta = (e: (typeof filas)[number]) =>
    e.estado === "APROBADA" ? turnos.filter((t) => t.excusaId === e.id).length : turnos.filter((t) => t.usuarioId === e.usuarioId && t.fecha >= e.fechaInicio && t.fecha <= e.fechaFin && t.estado !== "LIBERADO").length;

  const masAntigua = pendientes.length ? Math.min(...pendientes.map((p) => p.creadoEn.getTime())) : null;
  const diasAntigua = masAntigua ? diferenciaDias(hoyISO(new Date(masAntigua)), hoyISO()) : 0;
  const promHoras = resueltas.length ? resueltas.reduce((s, r) => s + (r.resueltoEn!.getTime() - r.creadoEn.getTime()), 0) / resueltas.length / 3_600_000 : null;

  return (
    <main className="principal">
      <BarraAdmin />
      <div className="encabezado">
        <div>
          <h1 className="titulo-pagina">Ausencias por revisar</h1>
          <p className="sub">
            <span className="resaltado">{pendientes.length} {pendientes.length === 1 ? "pendiente" : "pendientes"}</span>
            {masAntigua && ` · la más antigua lleva ${diasAntigua === 0 ? "menos de un día" : diasAntigua === 1 ? "1 día" : `${diasAntigua} días`}`}
            {promHoras !== null && ` · respondes en ${fmtNumero(promHoras)} h en promedio`}
          </p>
        </div>
        <div className="segmentado">
          {FILTROS.map((f) => (
            <Link key={f.clave} href={`/admin/ausencias?estado=${f.clave}`} className={f.clave === filtro.clave ? "activo" : ""}>
              {f.texto}
            </Link>
          ))}
        </div>
      </div>
      {sp.resuelta && <div className="aviso ok" style={{ marginTop: 16 }}>Listo. {sp.resuelta} quedó resuelta y la persona ya recibió el correo.</div>}

      <div className="tabla-scroll solo-escritorio" style={{ marginTop: 24 }}>
        <table className="tabla">
          <thead>
            <tr>
              <th>Solicitud</th>
              <th>Persona</th>
              <th>Tipo</th>
              <th>Fechas</th>
              <th>Turnos</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filas.map((e) => (
              <tr key={e.id}>
                <td className="codigo ink2">EX-{e.codigo}</td>
                <td>
                  <div className="persona">
                    <Avatar nombre={e.usuario.nombre} tam="sm" />
                    <div>
                      <div className="nombre">{e.usuario.nombre}</div>
                      <div className="linea">{e.usuario.oficina?.nombre}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <ChipTipo tipo={e.tipo} />
                </td>
                <td>
                  <div style={{ fontWeight: 500 }}>{fmtRangoFechas(aISO(e.fechaInicio), aISO(e.fechaFin))}</div>
                  <div className="muted" style={{ fontSize: 11.5 }}>{e.estado === "PENDIENTE" ? fmtHace(e.creadoEn) : fmtDiaMes(hoyISO(e.resueltoEn ?? e.creadoEn))}</div>
                </td>
                <td style={{ fontWeight: 500 }}>{cuenta(e)}</td>
                <td>
                  <EstadoExcusaPunto estado={e.estado} />
                </td>
                <td className="der">
                  {e.estado === "PENDIENTE" ? (
                    <Link href={`/admin/ausencias/EX-${e.codigo}`} className="btn btn-secundario btn-sm">
                      Revisar
                    </Link>
                  ) : (
                    <Link href={`/admin/ausencias/EX-${e.codigo}`} className="btn-icono sm" style={{ border: 0, marginLeft: "auto" }} aria-label="Ver detalle">
                      <Ellipsis />
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="solo-movil" style={{ marginTop: 18 }}>
        {filas.map((e) => (
          <Link key={e.id} href={`/admin/ausencias/EX-${e.codigo}`} className="fila">
            <Avatar nombre={e.usuario.nombre} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 500 }}>{e.usuario.nombre}</div>
              <div className="muted" style={{ fontSize: 12 }}>
                {NOMBRE_TIPO[e.tipo]} · {fmtRangoFechas(aISO(e.fechaInicio), aISO(e.fechaFin))} · EX-{e.codigo}
              </div>
            </div>
            <EstadoExcusaPunto estado={e.estado} />
            <ChevronRight size={16} color="var(--muted)" />
          </Link>
        ))}
      </div>

      {filas.length === 0 && <p className="muted" style={{ marginTop: 24 }}>No hay solicitudes en este estado.</p>}
      <p className="ink2" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 22, fontSize: 12.5 }}>
        <Mail size={15} /> Cuando apruebas o rechazas, la persona recibe un correo en el momento.
      </p>
    </main>
  );
}
