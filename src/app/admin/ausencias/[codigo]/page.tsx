import { ArrowLeft, Building2, CalendarDays, Check, Eye, FileText } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, EstadoExcusaPunto, fmtKb, NOMBRE_TIPO, ChipTipo } from "@/components/ui";
import { db } from "@/lib/db";
import { aISO, DIAS_CORTOS, diaSemana, fmtDiaMes, fmtHace, fmtHoraDe, fmtRangoFechas, fmtRangoHoras, hoyISO, partes, rangoDias, sumarDias } from "@/lib/fechas";
import { numeroDeCodigo, turnosAfectados } from "@/lib/servicios/excusas";
import { resolver } from "../acciones";

export const metadata = { title: "Revisar ausencia" };

const EVENTO: Record<string, (nombre: string) => string> = {
  registrada: (n) => `${n} la registró`,
  aviso_enviado: () => "Te llegó el aviso por correo",
  aprobada: () => "La aprobaste",
  rechazada: () => "La rechazaste",
};

export default async function DetalleAusencia({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const n = numeroDeCodigo(decodeURIComponent(codigo));
  if (!Number.isFinite(n)) notFound();
  const e = await db.excusa.findUnique({
    where: { codigo: n },
    include: { usuario: { include: { oficina: true } }, historial: { orderBy: { creadoEn: "asc" }, include: { autor: true } } },
  });
  if (!e) notFound();
  const desde = aISO(e.fechaInicio);
  const hasta = aISO(e.fechaFin);
  const dias = rangoDias(desde, hasta).length;
  const turnos =
    e.estado === "APROBADA"
      ? await db.turno.findMany({ where: { excusaId: e.id, estado: "LIBERADO" }, orderBy: [{ fecha: "asc" }] })
      : await turnosAfectados(e.usuarioId, desde, hasta, e.horaInicio, e.horaFin);
  const seisMeses = sumarDias(hoyISO(), -183);
  const [ausenciasSeisMeses, recalculo] = await Promise.all([
    db.excusa.count({ where: { usuarioId: e.usuarioId, estado: "APROBADA", fechaInicio: { gte: new Date(seisMeses) } } }),
    e.estado === "APROBADA" ? db.corrida.findFirst({ where: { excusaId: e.id }, orderBy: { creadoEn: "desc" } }) : null,
  ]);
  const nombre = e.usuario.nombre;
  const primerNombre = nombre.split(" ")[0];
  const franjas = [...new Set(turnos.map((t) => (t.horaFin <= 13 * 60 ? "mañanas" : t.horaInicio >= 12 * 60 ? "tardes" : "jornadas")))];
  const pendiente = e.estado === "PENDIENTE";
  const textoTurnos = turnos.map((t) => `${DIAS_CORTOS[diaSemana(aISO(t.fecha))].toLowerCase()} ${partes(aISO(t.fecha)).dia}`).join(" y ");

  const formulario = (
    <form action={resolver.bind(null, `EX-${e.codigo}`, true)} style={{ marginTop: "auto" }}>
      <textarea name="comentario" className="textarea" placeholder={`Escríbele algo a ${primerNombre} (opcional)`} defaultValue={e.tipo === "INCAPACIDAD" ? `Recupérate pronto, ${primerNombre}. Ya quedó cubierto tu turno.` : ""} style={{ minHeight: 86 }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
        <button formAction={resolver.bind(null, `EX-${e.codigo}`, false)} className="btn btn-peligro btn-lg">
          Rechazar
        </button>
        <button className="btn btn-primario btn-lg">
          <Check /> Aprobar
        </button>
      </div>
    </form>
  );

  return (
    <>
      <main className="principal">
        <Link href="/admin/ausencias" className="volver">
          <ArrowLeft /> Ausencias por revisar
        </Link>
        <div className="encabezado" style={{ alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <h1 className="titulo-pagina">
              {NOMBRE_TIPO[e.tipo]} de {nombre}
            </h1>
            <EstadoExcusaPunto estado={e.estado} />
          </div>
          <span className="codigo ink2">EX-{e.codigo}</span>
        </div>

        <div className="kpis" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <div className="kpi">
            <span className="icono-circulo"><CalendarDays /></span>
            <div>
              <div className="k-label">Fechas</div>
              <div className="k-valor" style={{ fontSize: 20 }}>{fmtRangoFechas(desde, hasta)} <span className="k-extra">{dias} {dias === 1 ? "día" : "días"}{e.jornada === "UNAS_HORAS" && e.horaInicio != null ? ` · ${fmtRangoHoras(e.horaInicio, e.horaFin!)}` : ""}</span></div>
            </div>
          </div>
          <div className="kpi">
            <span className="icono-circulo"><CalendarDays /></span>
            <div>
              <div className="k-label">{e.estado === "APROBADA" ? "Turnos que liberó" : "Turnos que libera"}</div>
              <div className="k-valor" style={{ fontSize: 20 }}>{turnos.length} <span className="k-extra">{franjas.join(" y ")}</span></div>
            </div>
          </div>
          <div className="kpi">
            <span className="icono-circulo"><Building2 /></span>
            <div>
              <div className="k-label">Oficina</div>
              <div className="k-valor" style={{ fontSize: 20 }}>{e.usuario.oficina?.nombre.replace(/^Cartagena /, "")} <span className="k-extra">{e.usuario.oficina?.ciudad}</span></div>
            </div>
          </div>
        </div>

        <section className="seccion">
          <h2 className="titulo-seccion" style={{ marginBottom: 10 }}>Motivo</h2>
          <p className="ink2" style={{ fontSize: 13.5, maxWidth: 560 }}>“{e.motivo}”</p>
          {e.soporteNombre ? (
            <div className="adjunto" style={{ maxWidth: 420, marginTop: 14 }}>
              <span className="doc"><FileText /></span>
              <span style={{ flex: 1 }}>
                <span className="nombre" style={{ display: "block" }}>{e.soporteNombre}</span>
                <span className="peso">{fmtKb(e.soporteBytes)}</span>
              </span>
              <a href={`/api/soportes/${e.id}`} target="_blank" rel="noreferrer" className="btn btn-secundario btn-sm">
                <Eye /> Ver
              </a>
            </div>
          ) : (
            <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>Sin soporte adjunto.</p>
          )}
        </section>

        <section className="seccion">
          <h2 className="titulo-seccion" style={{ marginBottom: 12 }}>{pendiente ? "Turnos que se liberan" : "Turnos liberados"}</h2>
          {turnos.length ? (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {turnos.map((t) => (
                <div key={t.id} className="bloque liberado" style={{ cursor: "default", width: "auto", border: "1px solid var(--line)", minHeight: 0, padding: "8px 12px 8px 4px" }}>
                  <span className="barra-estado" />
                  <span>
                    <span className="hora" style={{ display: "block" }}>
                      {DIAS_CORTOS[diaSemana(aISO(t.fecha))]} {partes(aISO(t.fecha)).dia} · {fmtRangoHoras(t.horaInicio, t.horaFin)}
                    </span>
                    <span className="sub-linea">{pendiente ? "Se libera al aprobar" : "Liberado"}</span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No tiene turnos asignados en esas fechas.</p>
          )}
          <p className="ink2" style={{ marginTop: 14, fontSize: 12.5 }}>
            {pendiente ? (
              "Al aprobar, el motor recalcula y te propone quién cubre."
            ) : recalculo ? (
              <>
                El motor calculó la cobertura en la corrida #{recalculo.numero}.{" "}
                {recalculo.estado === "BORRADOR" && (
                  <Link href={`/admin/malla/recalculo?id=${recalculo.id}`} style={{ color: "var(--blue)" }}>
                    Revisar la cobertura
                  </Link>
                )}
              </>
            ) : null}
          </p>
        </section>

        {pendiente && (
          <section className="seccion solo-sin-panel" style={{ maxWidth: 520 }}>
            <p className="ink2" style={{ fontSize: 12.5, marginBottom: 10 }}>
              {turnos.length ? `Libera ${textoTurnos}. Al aprobar te proponemos quién cubre.` : ""}
            </p>
            {formulario}
          </section>
        )}
      </main>

      <aside className="panel">
        <div className="perfil">
          <Avatar nombre={nombre} tam="xl" presencia={pendiente ? "naranja" : null} />
          <div className="nombre">{nombre}</div>
          <div className="contexto">{e.usuario.correo}</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 12, fontSize: 12.5, fontWeight: 500 }}>
            <span>{e.usuario.horasSemana} h</span>
            <span>{ausenciasSeisMeses} {ausenciasSeisMeses === 1 ? "ausencia" : "ausencias"} en 6 meses</span>
          </div>
        </div>
        <div className="separador-titulo">Historial</div>
        <div className="timeline">
          {e.historial.map((h) => (
            <div key={h.id} className="paso hecho">
              <span className="marca"><Check /></span>
              <div>
                <div className="t">{EVENTO[h.evento]?.(primerNombre) ?? h.evento}</div>
                <div className="d">
                  {hoyISO(h.creadoEn) === hoyISO() ? "" : `${DIAS_CORTOS[diaSemana(hoyISO(h.creadoEn))]} ${fmtDiaMes(hoyISO(h.creadoEn))} · `}
                  {fmtHoraDe(h.creadoEn)}
                  {h.nota ? ` · ${h.nota}` : ""}
                </div>
              </div>
            </div>
          ))}
          {pendiente && (
            <div className="paso actual">
              <span className="marca">{e.historial.length + 1}</span>
              <div>
                <div className="t">Esperando tu respuesta</div>
                <div className="d">{fmtHace(e.creadoEn)}</div>
              </div>
            </div>
          )}
        </div>
        {pendiente ? (
          formulario
        ) : (
          <div style={{ marginTop: "auto" }}>
            {e.comentarioResolucion && (
              <div className="burbuja">
                <div className="rotulo">Tu comentario</div>
                {e.comentarioResolucion}
              </div>
            )}
            <div style={{ marginTop: 12 }}>
              <ChipTipo tipo={e.tipo} />
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
