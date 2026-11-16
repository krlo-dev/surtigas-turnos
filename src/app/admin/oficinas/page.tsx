import { Building2, Ellipsis, Plus } from "lucide-react";
import Link from "next/link";
import { BarraAdmin } from "@/components/shell/barra-admin";
import { BarraUso, colorUso, Estado } from "@/components/ui";
import { db } from "@/lib/db";
import { coberturaPorHora, horasDelDia, metricasDia } from "@/lib/engine/oficinas";
import { aFecha, fmtDuracion, fmtNumero, hoyISO, lunesDe, sumarDias } from "@/lib/fechas";
import { contextoSemana, fechaUltimaDemanda } from "@/lib/servicios/contexto";
import { FormularioOficina } from "./formulario";

export const metadata = { title: "Oficinas" };

export default async function PaginaOficinas({ searchParams }: { searchParams: Promise<{ q?: string; nueva?: string; editar?: string }> }) {
  const sp = await searchParams;
  const hoy = hoyISO();
  const ctx = await contextoSemana(lunesDe(hoy));
  // con un histórico importado de otra época, la ventana termina en el último día con datos
  const ultima = (await fechaUltimaDemanda()) ?? hoy;
  const finVentana = ultima < hoy ? ultima : hoy;
  const [todas, personas, abandono] = await Promise.all([
    db.oficina.findMany({ orderBy: [{ activa: "desc" }, { zona: "asc" }, { capacidad: "desc" }] }),
    db.usuario.groupBy({ by: ["oficinaId"], where: { rol: "COLABORADOR", activo: true }, _count: true }),
    db.demandaHora.groupBy({ by: ["oficinaId"], where: { fecha: { gte: aFecha(sumarDias(finVentana, -7 * ctx.parametros.semanasHistorico + 1)), lte: aFecha(finVentana) } }, _sum: { llegadas: true, abandonados: true } }),
  ]);
  const q = (sp.q ?? "").toLowerCase();
  const oficinas = todas.filter((o) => !q || `${o.nombre} ${o.ciudad} ${o.zona}`.toLowerCase().includes(q));
  const zonas = new Set(todas.filter((o) => o.activa).map((o) => o.zona));
  const editar = sp.editar ? todas.find((o) => o.id === sp.editar) ?? null : null;

  return (
    <main className="principal">
      <BarraAdmin placeholder="Buscar oficina" />
      <div className="encabezado">
        <div>
          <h1 className="titulo-pagina">Oficinas</h1>
          <p className="sub">
            {todas.filter((o) => o.activa).length} sedes de atención en {zonas.size} zonas · los puestos son el tope de personas por franja
          </p>
        </div>
        <Link href="/admin/oficinas?nueva=1" className="btn btn-primario">
          <Plus /> Nueva oficina
        </Link>
      </div>
      <div className="tabla-scroll" style={{ marginTop: 24 }}>
        <table className="tabla" style={{ minWidth: 980 }}>
          <thead>
            <tr>
              <th>Oficina</th>
              <th>Zona</th>
              <th>Horario</th>
              <th className="der">Puestos</th>
              <th className="der">Personas</th>
              <th className="der">Atención prom.</th>
              <th className="der">Abandono</th>
              <th style={{ paddingLeft: 24 }}>Uso hoy</th>
              <th>Atención virtual</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {oficinas.map((o) => {
              const om = ctx.oficinas.find((x) => x.id === o.id);
              const perfil = ctx.demanda[o.id];
              const abierta = om ? horasDelDia(om, hoy).length > 0 : false;
              const uso = om && abierta ? metricasDia(om, perfil, hoy, coberturaPorHora(ctx.turnos, o.id, hoy), ctx.parametros).uso : 0;
              const a = abandono.find((x) => x.oficinaId === o.id);
              const tasa = a?._sum.llegadas ? (a._sum.abandonados ?? 0) / a._sum.llegadas : null;
              const n = personas.find((p) => p.oficinaId === o.id)?._count ?? 0;
              return (
                <tr key={o.id} style={{ opacity: o.activa ? 1 : 0.55 }}>
                  <td>
                    <span style={{ display: "flex", alignItems: "center", gap: 12, fontWeight: 500, fontSize: 13.5 }}>
                      <span className="icono-circulo azul sm"><Building2 /></span>
                      {o.nombre}
                    </span>
                  </td>
                  <td className="ink2">{o.zona}</td>
                  <td className="ink2" style={{ whiteSpace: "nowrap" }}>L-V {o.horaApertura}–{o.horaCierre}{o.abreSabado ? ` · S ${o.horaApertura}–${o.horaCierreSabado}` : ""}</td>
                  <td className="der" style={{ fontWeight: 500 }}>{o.capacidad}</td>
                  <td className="der ink2">{n}</td>
                  <td className="der" style={{ fontWeight: 600 }}>{perfil ? `${fmtDuracion(perfil.ahtSeg)} min` : "–"}</td>
                  <td className="der" style={{ color: tasa !== null && tasa > 0.05 ? "var(--red-ink)" : "var(--ink-2)" }}>{tasa === null ? "–" : `${fmtNumero(tasa * 100)}%`}</td>
                  <td style={{ paddingLeft: 24, minWidth: 170 }}>
                    {abierta ? (
                      <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ flex: 1 }}><BarraUso valor={Math.min(1, uso)} color={colorUso(uso)} /></span>
                        <b style={{ fontWeight: 500, width: 38, textAlign: "right" }}>{Math.round(uso * 100)}%</b>
                      </span>
                    ) : (
                      <span className="muted">Cerrada hoy</span>
                    )}
                  </td>
                  <td>
                    <Estado punto={o.atencionVirtual ? "lima" : ""}>{o.atencionVirtual ? "Sí" : "No"}</Estado>
                  </td>
                  <td className="der">
                    <Link href={`/admin/oficinas?editar=${o.id}`} className="btn-icono sm" style={{ border: 0, marginLeft: "auto" }} aria-label={`Editar ${o.nombre}`}>
                      <Ellipsis />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {(sp.nueva || editar) && <FormularioOficina oficina={editar} />}
    </main>
  );
}
