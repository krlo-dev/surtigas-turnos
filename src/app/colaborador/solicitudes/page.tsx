import { Check, CircleCheck, Plus, Thermometer } from "lucide-react";
import Link from "next/link";
import { auth } from "@/auth";
import { Avatar, ChipTipo, EstadoExcusaPunto, NOMBRE_TIPO } from "@/components/ui";
import { db } from "@/lib/db";
import { aISO, fmtHace, fmtHoraDe, fmtRangoFechas, hoyISO } from "@/lib/fechas";

export const metadata = { title: "Mis solicitudes" };

export default async function MisSolicitudes({ searchParams }: { searchParams: Promise<{ enviada?: string }> }) {
  const { enviada } = await searchParams;
  const s = await auth();
  const uid = s!.user.id;
  const [excusas, admin, turnos] = await Promise.all([
    db.excusa.findMany({ where: { usuarioId: uid }, orderBy: { creadoEn: "desc" }, include: { historial: true, revisadoPor: true } }),
    db.usuario.findFirst({ where: { rol: "ADMIN", activo: true }, orderBy: { creadoEn: "asc" } }),
    db.turno.findMany({ where: { usuarioId: uid }, select: { fecha: true, estado: true, excusaId: true } }),
  ]);
  const nombreAdmin = admin?.nombre.split(" ")[0] ?? "La administración";
  const cuenta = (e: (typeof excusas)[number]) =>
    e.estado === "APROBADA" ? turnos.filter((t) => t.excusaId === e.id).length : turnos.filter((t) => t.fecha >= e.fechaInicio && t.fecha <= e.fechaFin && t.estado !== "LIBERADO").length;
  const pendientes = excusas.filter((e) => e.estado === "PENDIENTE");
  const resueltas = excusas.filter((e) => e.estado !== "PENDIENTE");
  const recien = enviada ? excusas.find((e) => `EX-${e.codigo}` === enviada) : null;

  return (
    <main className="principal">
      {recien && (
        <section className="solo-movil" style={{ textAlign: "center", paddingTop: 30 }}>
          <span className="icono-circulo lima" style={{ width: 96, height: 96, margin: "0 auto", background: "var(--lime-50)" }}>
            <span style={{ width: 62, height: 62, borderRadius: 99, background: "var(--lime)", display: "grid", placeItems: "center", color: "#253009" }}><Check size={24} /></span>
          </span>
          <h1 className="titulo-pagina" style={{ marginTop: 22 }}>{nombreAdmin} ya <span className="resaltado">recibió tu aviso</span></h1>
          <p className="ink2" style={{ marginTop: 8 }}>Te contamos por correo apenas responda. Mientras tanto, puedes seguirla en Solicitudes.</p>
          <div className="lista-filas" style={{ marginTop: 26, textAlign: "left" }}>
            <div className="fila"><span className="ink2" style={{ flex: 1 }}>Número</span><b style={{ fontWeight: 600 }}>{enviada}</b></div>
            <div className="fila"><span className="ink2" style={{ flex: 1 }}>Tipo</span><ChipTipo tipo={recien.tipo} /></div>
            <div className="fila"><span className="ink2" style={{ flex: 1 }}>Días</span><b style={{ fontWeight: 600 }}>{fmtRangoFechas(aISO(recien.fechaInicio), aISO(recien.fechaFin))}</b></div>
            <div className="fila"><span className="ink2" style={{ flex: 1 }}>Estado</span><EstadoExcusaPunto estado={recien.estado} /></div>
          </div>
          <Link href="/colaborador/solicitudes" className="btn btn-primario btn-lg btn-bloque" style={{ marginTop: 26 }}>Ver mis solicitudes</Link>
          <Link href="/colaborador" className="btn btn-quieto btn-bloque" style={{ marginTop: 8 }}>Volver a mi semana</Link>
        </section>
      )}

      <div className={recien ? "solo-escritorio" : ""}>
        <div className="encabezado">
          <div>
            <h1 className="titulo-pagina">Mis solicitudes</h1>
            <p className="sub">Todo lo que has reportado y en qué va</p>
          </div>
          <Link href="/colaborador/reportar" className="btn btn-primario"><Plus /> Reportar ausencia</Link>
        </div>
        {recien && (
          <div className="aviso ok" style={{ marginTop: 22 }}>
            <CircleCheck />
            <span><b>Enviada.</b> {nombreAdmin} ya recibió tu {NOMBRE_TIPO[recien.tipo].toLowerCase()} y te avisamos por correo cuando responda.</span>
          </div>
        )}

        {pendientes.map((e) => {
          const aviso = e.historial.find((h) => h.evento === "aviso_enviado");
          return (
            <div key={e.id} className="tablero" style={{ padding: "22px 22px 24px", marginTop: 22 }}>
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
                <ChipTipo tipo={e.tipo} />
                <div style={{ flex: 1 }}>
                  <div><b style={{ fontWeight: 600 }}>{fmtRangoFechas(aISO(e.fechaInicio), aISO(e.fechaFin))}</b> <span className="codigo ink2" style={{ fontSize: 12 }}>· EX-{e.codigo}</span></div>
                  <div className="ink2" style={{ fontSize: 12 }}>{cuenta(e)} {cuenta(e) === 1 ? "turno" : "turnos"} · enviada {hoyISO(e.creadoEn) === hoyISO() ? `hoy ${fmtHoraDe(e.creadoEn)}` : fmtHace(e.creadoEn).toLowerCase()}{e.soporteNombre ? " · soporte adjunto" : ""}</div>
                </div>
                <EstadoExcusaPunto estado={e.estado} />
              </div>
              <div className="progreso">
                <div className="etapa hecho"><span className="marca"><Check /></span><div className="t">Enviada</div><div className="d">{hoyISO(e.creadoEn) === hoyISO() ? `Hoy ${fmtHoraDe(e.creadoEn)}` : fmtHace(e.creadoEn)}</div></div>
                <div className={`etapa ${aviso ? "hecho" : "actual"}`}><span className="marca">{aviso ? <Check /> : 2}</span><div className="t">Aviso a {nombreAdmin}</div><div className="d">{aviso ? (aviso.nota === "entregado" ? "Entregado" : "Con problemas") : "Enviando"}</div></div>
                <div className="etapa actual"><span className="marca">3</span><div className="t">En revisión</div><div className="d">Desde {fmtHace(e.creadoEn).toLowerCase()}</div></div>
                <div className="etapa"><span className="marca">4</span><div className="t">Respuesta</div><div className="d">Llega a tu correo</div></div>
              </div>
            </div>
          );
        })}

        <div className="lista-filas" style={{ marginTop: 22 }}>
          {resueltas.map((e) => (
            <div key={e.id} className="fila" style={{ flexWrap: "wrap", padding: "18px 0" }}>
              <ChipTipo tipo={e.tipo} className="chip-tipo" />
              <div style={{ flex: "1 1 220px" }}>
                <div><b style={{ fontWeight: 600 }}>{fmtRangoFechas(aISO(e.fechaInicio), aISO(e.fechaFin))}</b> <span className="codigo ink2" style={{ fontSize: 12 }}>· EX-{e.codigo}</span></div>
                <div className="ink2" style={{ fontSize: 12 }}>{e.motivo.length > 48 ? `${e.motivo.slice(0, 46)}…` : e.motivo} · {cuenta(e)} {cuenta(e) === 1 ? "turno" : "turnos"}</div>
              </div>
              <div style={{ flex: "2 1 260px", display: "flex", alignItems: "center", gap: 10 }}>
                {e.comentarioResolucion && (
                  <>
                    <Avatar nombre={e.revisadoPor?.nombre ?? nombreAdmin} tam="sm" />
                    <span className="ink2" style={{ fontSize: 12.5 }}>“{e.comentarioResolucion}”</span>
                  </>
                )}
              </div>
              <EstadoExcusaPunto estado={e.estado} />
            </div>
          ))}
        </div>
        {!excusas.length && (
          <div className="decision" style={{ marginTop: 22 }}>
            <span className="icono-circulo"><Thermometer /></span>
            <div className="texto"><div className="frase">Todavía no has reportado ausencias</div><div className="razon">Si un día no puedes ir, repórtalo y {nombreAdmin} recibe el aviso al instante.</div></div>
          </div>
        )}
      </div>
    </main>
  );
}
