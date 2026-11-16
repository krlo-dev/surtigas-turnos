import { CalendarClock, CircleCheck, Inbox, Info } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { BarraAdmin } from "@/components/shell/barra-admin";
import { Avatar, Estado } from "@/components/ui";
import { db } from "@/lib/db";
import { DIAS_CORTOS, diaSemana, fmtMomento, fmtRangoHoras, hoyISO, lunesDe, MESES_LARGOS, partes, semanaISO, sumarDias } from "@/lib/fechas";
import { horarioDePersona } from "@/lib/servicios/malla";
import { reintentar } from "./acciones";
import { BotonEnviarAhora } from "./boton-enviar";

export const metadata = { title: "Correos automáticos" };

const TIPO: Record<string, { texto: string; clase: string }> = {
  HORARIO_SEMANAL: { texto: "Horario", clase: "chip-azul" },
  NUEVA_EXCUSA: { texto: "Ausencia", clase: "" },
  RESOLUCION_EXCUSA: { texto: "Respuesta", clase: "chip-lima" },
  COBERTURA: { texto: "Cobertura", clase: "chip-azul" },
  RECUPERAR_CLAVE: { texto: "Acceso", clase: "" },
  INVITACION: { texto: "Invitación", clase: "" },
};

export default async function PaginaCorreos({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  const { filtro } = await searchParams;
  const soloError = filtro === "error";
  const hoy = hoyISO();
  const { anio, mes } = partes(hoy);
  const inicioMes = new Date(Date.UTC(anio, mes, 1, 5));
  const ultimoHorario = await db.notificacion.findFirst({ where: { tipo: "HORARIO_SEMANAL" }, orderBy: { fechaEnvio: "desc" } });
  const [envios, porEstado, nuevas, respuestas, muestra] = await Promise.all([
    db.notificacion.findMany({ where: soloError ? { estado: "ERROR" } : {}, include: { destinatario: true }, orderBy: { fechaEnvio: "desc" }, take: 15 }),
    ultimoHorario?.semana ? db.notificacion.groupBy({ by: ["estado"], where: { tipo: "HORARIO_SEMANAL", semana: ultimoHorario.semana }, _count: true }) : [],
    db.notificacion.count({ where: { tipo: "NUEVA_EXCUSA", fechaEnvio: { gte: inicioMes } } }),
    db.notificacion.count({ where: { tipo: "RESOLUCION_EXCUSA", fechaEnvio: { gte: inicioMes } } }),
    db.usuario.findFirst({ where: { rol: "COLABORADOR", activo: true, correo: "jorge.medina@surtigas.co" }, include: { oficina: true } }).then((u) => u ?? db.usuario.findFirst({ where: { rol: "COLABORADOR", activo: true }, include: { oficina: true } })),
  ]);
  const enviados = porEstado.find((p) => p.estado === "ENVIADO")?._count ?? 0;
  const fallaron = porEstado.find((p) => p.estado === "ERROR")?._count ?? 0;
  const lunes = lunesDe(hoy);
  const dias = muestra ? await horarioDePersona(muestra.id, lunes) : [];
  const fin = partes(sumarDias(lunes, 6));
  const ini = partes(lunes);
  const sinLlave = !process.env.RESEND_API_KEY;
  const redireccion = process.env.CORREO_REDIRECCION;

  return (
    <>
      <main className="principal">
        <BarraAdmin placeholder="Buscar envío" />
        <div className="encabezado">
          <div>
            <h1 className="titulo-pagina">Correos automáticos</h1>
            <p className="sub">Lo que el sistema envía solo, y a quién</p>
          </div>
          <BotonEnviarAhora />
        </div>
        {(sinLlave || redireccion) && (
          <div className="aviso info" style={{ marginTop: 16 }}>
            <Info />
            <span>{sinLlave ? "Falta RESEND_API_KEY: los correos se registran aquí pero no salen." : `Modo demostración: todos los correos llegan a ${redireccion}; aquí ves el destinatario real.`}</span>
          </div>
        )}

        <div className="kpis" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <div className="kpi">
            <span className="icono-circulo"><CalendarClock /></span>
            <div>
              <div className="k-label">Horario semanal · domingos 18:00</div>
              <div className="k-valor">{enviados}/{enviados + fallaron} {fallaron > 0 && <span className="k-extra texto-rojo">{fallaron} fallaron</span>}</div>
            </div>
          </div>
          <div className="kpi">
            <span className="icono-circulo"><Inbox /></span>
            <div>
              <div className="k-label">Nueva ausencia → administración</div>
              <div className="k-valor">{nuevas} <span className="k-extra">en {MESES_LARGOS[mes]}</span></div>
            </div>
          </div>
          <div className="kpi">
            <span className="icono-circulo"><CircleCheck /></span>
            <div>
              <div className="k-label">Respuesta → colaborador</div>
              <div className="k-valor">{respuestas} <span className="k-extra">en {MESES_LARGOS[mes]}</span></div>
            </div>
          </div>
        </div>

        <section className="seccion">
          <div className="encabezado" style={{ alignItems: "center", marginBottom: 10 }}>
            <h2 className="titulo-seccion">Últimos envíos</h2>
            <div className="segmentado">
              <Link href="/admin/correos" className={!soloError ? "activo" : ""}>Todos</Link>
              <Link href="/admin/correos?filtro=error" className={soloError ? "activo" : ""}>Con error</Link>
            </div>
          </div>
          <div className="tabla-scroll">
            <table className="tabla" style={{ minWidth: 700 }}>
              <thead>
                <tr><th>Tipo</th><th>Para</th><th>Asunto</th><th>Cuándo</th><th>Estado</th><th /></tr>
              </thead>
              <tbody>
                {envios.map((n) => {
                  const t = TIPO[n.tipo] ?? { texto: n.tipo, clase: "" };
                  const nombre = n.destinatario?.nombre ?? n.correoDestino;
                  return (
                    <tr key={n.id}>
                      <td><span className={`chip ${t.clase}`}>{t.texto}</span></td>
                      <td><span className="persona"><Avatar nombre={nombre} tam="sm" /><span className="nombre" style={{ fontWeight: 500 }}>{nombre}</span></span></td>
                      <td className="ink2">{n.asunto}</td>
                      <td className="muted" style={{ whiteSpace: "nowrap" }}>{fmtMomento(n.fechaEnvio)}</td>
                      <td>{n.estado === "ERROR" ? <Estado punto="rojo"><span title={n.error ?? ""}>{n.error?.split(":")[0] ?? "Error"}</span></Estado> : <Estado punto="lima">Entregado</Estado>}</td>
                      <td className="der">
                        {n.estado === "ERROR" && n.tipo === "HORARIO_SEMANAL" && (
                          <form action={reintentar.bind(null, n.id)}><button className="btn btn-secundario btn-sm">Reintentar</button></form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {envios.length === 0 && <p className="muted" style={{ marginTop: 14 }}>No hay envíos {soloError ? "con error" : "todavía"}.</p>}
        </section>
      </main>

      {muestra && (
        <aside className="panel" style={{ padding: "26px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "0 6px 14px" }}>
            <b style={{ fontWeight: 600 }}>Así le llega a {muestra.nombre.split(" ")[0]}</b>
            <span className="muted" style={{ fontSize: 11.5 }}>Vista previa</span>
          </div>
          <div style={{ background: "var(--soft)", borderRadius: 22, padding: 12 }}>
            <div style={{ background: "#fff", borderRadius: 16 }}>
              <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--line)", fontSize: 11.5 }}>
                <div><b style={{ fontWeight: 600 }}>De</b> Surtigas Turnos</div>
                <div><b style={{ fontWeight: 600 }}>Asunto</b> Tu horario · semana {semanaISO(lunes)}</div>
              </div>
              <div style={{ padding: "20px 16px" }}>
                <Image src="/logo-surtigas.svg" alt="Surtigas" width={78} height={35} />
                <h3 style={{ fontSize: 16, fontWeight: 600, margin: "16px 0 6px" }}>Hola, {muestra.nombre.split(" ")[0]}</h3>
                <p className="ink2" style={{ fontSize: 12, marginBottom: 12 }}>
                  Esta es tu semana del {ini.dia} al {fin.dia} de {MESES_LARGOS[fin.mes]} en {muestra.oficina?.nombre}.
                </p>
                {dias.filter((d) => d.turnos.length || d.ausencia).map((d) => (
                  <div key={d.fecha} style={{ display: "flex", gap: 20, padding: "9px 0", borderTop: "1px solid var(--line)", fontSize: 12 }}>
                    <b style={{ fontWeight: 600, width: 50 }}>{DIAS_CORTOS[diaSemana(d.fecha)]} {partes(d.fecha).dia}</b>
                    <span className={d.ausencia ? "" : "ink2"} style={d.ausencia ? { color: "var(--orange-ink)" } : {}}>{d.ausencia ?? d.turnos.map((t) => fmtRangoHoras(t.inicio, t.fin)).join(", ")}</span>
                  </div>
                ))}
                <span className="btn btn-primario btn-sm" style={{ marginTop: 14 }}>Ver mi semana</span>
              </div>
            </div>
          </div>
          <p className="ink2" style={{ fontSize: 12, padding: "14px 6px" }}>Si no puede ir, el correo le recuerda que lo reporte en la plataforma.</p>
        </aside>
      )}
    </>
  );
}
