import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Clock, Ellipsis, FilePlus2, Hourglass, Mail, MapPin, Sun, Sunrise } from "lucide-react";
import Link from "next/link";
import { auth } from "@/auth";
import { Avatar, Cinta, Estado, NOMBRE_TIPO } from "@/components/ui";
import { db } from "@/lib/db";
import { horasTrabajadas } from "@/lib/engine/oficinas";
import { aISO, DIAS_CORTOS, diaSemana, fmtDiaMes, fmtFechaLarga, fmtFechaMedia, fmtMomento, fmtRangoFechas, fmtRangoHoras, hoyISO, lunesDe, partes, semanaISO, sumarDias } from "@/lib/fechas";
import { picoDeTurnos, proximosTurnos, semanaColaborador } from "@/lib/servicios/colaborador";

export const metadata = { title: "Mi semana" };

const fmtH = (h: number) => (Number.isInteger(h) ? String(h) : h.toFixed(1).replace(".", ","));

export default async function MiSemana({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const sp = await searchParams;
  const sesion = await auth();
  const uid = sesion!.user.id;
  const hoy = hoyISO();
  const lunes = lunesDe(sp.semana && /^\d{4}-\d{2}-\d{2}$/.test(sp.semana) ? sp.semana : hoy);
  const esActual = lunes === lunesDe(hoy);
  const [s, proximos, admin, pendientes, actividad] = await Promise.all([
    semanaColaborador(uid, lunes),
    proximosTurnos(uid, 4),
    db.usuario.findFirst({ where: { rol: "ADMIN", activo: true }, orderBy: { creadoEn: "asc" } }),
    db.excusa.count({ where: { usuarioId: uid, estado: "PENDIENTE" } }),
    db.excusa.findMany({ where: { usuarioId: uid }, orderBy: { creadoEn: "desc" }, take: 3, include: { revisadoPor: true } }),
  ]);
  const nombre = s.usuario.nombre.split(" ")[0];
  const nombreAdmin = admin?.nombre.split(" ")[0] ?? "Administración";
  const proximo = proximos[0];
  const picos = await picoDeTurnos(proximos.map((t) => ({ oficinaId: t.oficinaId, fecha: aISO(t.fecha), inicio: t.horaInicio, fin: t.horaFin })));
  const corto = (o: string) => o.replace(/^Cartagena /, "");
  const hoyDia = s.dias.find((d) => d.fecha === hoy);
  const turnoHoy = hoyDia?.turnos[0];
  const ultimoEnvio = await db.notificacion.findFirst({ where: { destinatarioId: uid, tipo: "HORARIO_SEMANAL" }, orderBy: { fechaEnvio: "desc" } });
  const pendiente = actividad.find((a) => a.estado === "PENDIENTE");
  const resuelta = actividad.find((a) => a.estado !== "PENDIENTE" && a.comentarioResolucion);

  const subtitulo = esActual
    ? s.horas
      ? `Tu semana ${semanaISO(lunes)} está confirmada.${s.envio ? " También te llegó al correo el domingo." : ""}`
      : "Todavía no tienes turnos esta semana."
    : `Semana ${semanaISO(lunes)} · ${fmtRangoFechas(lunes, sumarDias(lunes, 6))}`;

  return (
    <>
      <main className="principal">
        {/* ------------- escritorio ------------- */}
        <div className="solo-escritorio">
          <div className="encabezado">
            <div>
              <h1 className="saludo">Hola, {nombre}</h1>
              <p className="sub">{subtitulo}</p>
            </div>
            <div className="acciones">
              <span style={{ fontWeight: 500 }}>{fmtFechaLarga(hoy)}</span>
              <Link href="/colaborador" className="btn-icono" aria-label="Volver a esta semana"><CalendarDays /></Link>
            </div>
          </div>

          <div className="kpis" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <div className="kpi">
              <span className="icono-circulo"><Clock /></span>
              <div>
                <div className="k-label">Horas esta semana</div>
                <div className="k-valor">{fmtH(s.horas)} h <span className="k-extra">de {s.usuario.horasSemana} h</span></div>
              </div>
            </div>
            <div className="kpi">
              <span className="icono-circulo"><ArrowRight /></span>
              <div>
                <div className="k-label">Próximo turno</div>
                <div className="k-valor">{proximo ? `${aISO(proximo.fecha) === hoy ? "Hoy" : DIAS_CORTOS[diaSemana(aISO(proximo.fecha))]} ${String(Math.floor(proximo.horaInicio / 60)).padStart(2, "0")}:${String(proximo.horaInicio % 60).padStart(2, "0")}` : "–"} {proximo && <span className="k-extra">{corto(proximo.oficina.nombre)}</span>}</div>
              </div>
            </div>
            <div className="kpi">
              <span className="icono-circulo"><Hourglass /></span>
              <div>
                <div className="k-label">Solicitudes</div>
                <div className="k-valor">{pendientes} <span className="k-extra">en revisión</span></div>
              </div>
            </div>
          </div>

          <section className="seccion">
            <div className="encabezado" style={{ alignItems: "center", marginBottom: 16 }}>
              <h2 className="titulo-seccion">Mi semana</h2>
              <div className="navegador-semana" style={{ fontSize: 13 }}>
                <Link className="btn-flecha" href={`/colaborador?semana=${sumarDias(lunes, -7)}`} aria-label="Semana anterior"><ChevronLeft /></Link>
                {fmtRangoFechas(lunes, sumarDias(lunes, 6))}
                <Link className="btn-flecha" href={`/colaborador?semana=${sumarDias(lunes, 7)}`} aria-label="Semana siguiente"><ChevronRight /></Link>
              </div>
            </div>
            <div className="semana">
              {s.dias.map((d) => (
                <div key={d.fecha}>
                  <div className="dia">
                    {DIAS_CORTOS[diaSemana(d.fecha)]} <b className={d.fecha === hoy ? "banda" : ""}>{partes(d.fecha).dia}</b>
                  </div>
                  {d.ausencia ? (
                    <Cinta tipo={d.ausencia.tipo} codigo={d.ausencia.estado === "PENDIENTE" ? "En revisión" : "Aprobada"} pendiente={d.ausencia.estado === "PENDIENTE"} />
                  ) : d.cerrado ? (
                    <Cinta tipo="CERRADO" />
                  ) : (
                    d.turnos.map((t) => (
                      <Link key={t.id} href={`/colaborador/turno/${t.id}`} className={`bloque ${t.nota ? "movido" : ""}`} style={t.enCurso ? { background: "var(--blue-50)" } : {}}>
                        <span className="barra-estado" />
                        <span>
                          <span className="hora" style={{ display: "block" }}>{fmtRangoHoras(t.inicio, t.fin)}</span>
                          <span className="sub-linea">{t.enCurso ? "Hoy · en curso" : t.oficina}{t.virtual ? " · virtual" : ""}</span>
                        </span>
                      </Link>
                    ))
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="seccion">
            <div className="encabezado" style={{ alignItems: "center" }}>
              <h2 className="titulo-seccion">Próximos turnos</h2>
            </div>
            <div className="lista-filas" style={{ marginTop: 10 }}>
              {proximos.map((t, i) => {
                const f = aISO(t.fecha);
                const pico = picos[i];
                const h = horasTrabajadas(t.horaInicio, t.horaFin);
                return (
                  <div key={t.id} className="fila">
                    <span className={`icono-circulo ${t.horaInicio >= 12 * 60 ? "azul" : "lima"}`}>{t.horaInicio >= 12 * 60 ? <Sun /> : <Sunrise />}</span>
                    <div style={{ flex: 1.3 }}>
                      <div style={{ fontWeight: 600 }}>{f === hoy ? "Hoy" : `${DIAS_CORTOS[diaSemana(f)]} ${partes(f).dia}`} · {fmtRangoHoras(t.horaInicio, t.horaFin)}</div>
                      <div className="muted" style={{ fontSize: 11.5 }}>{t.oficina.nombre}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <Estado punto="azul">{pico && h > 4 ? `Franja pico ${pico.hora}–${pico.hora + 1} h` : h >= 8 ? "Jornada completa" : "Media jornada"}</Estado>
                    </div>
                    <div style={{ width: 70, display: "flex", alignItems: "center", gap: 8, fontWeight: 500 }}><Clock size={16} color="var(--ink-2)" /> {fmtH(h)} h</div>
                    <Link href={`/colaborador/turno/${t.id}`} className="btn-icono sm" style={{ border: 0 }} aria-label="Ver turno"><Ellipsis /></Link>
                  </div>
                );
              })}
              {!proximos.length && <p className="muted" style={{ padding: "14px 0" }}>No tienes turnos en las próximas dos semanas.</p>}
            </div>
          </section>
        </div>

        {/* ------------- móvil ------------- */}
        <div className="solo-movil">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h1 className="saludo">Hola, {nombre}</h1>
              <p className="ink2" style={{ fontSize: 12.5 }}>{fmtFechaMedia(hoy)}</p>
            </div>
            <Avatar nombre={s.usuario.nombre} tam="md" presencia="lima" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6, margin: "20px 0" }}>
            {s.dias.map((d) => {
              const esHoy = d.fecha === hoy;
              const color = d.ausencia ? "var(--orange)" : d.turnos.length ? (esHoy ? "var(--lime)" : "var(--blue)") : "transparent";
              return (
                <div key={d.fecha} style={{ border: esHoy ? 0 : "1px solid var(--line-2)", background: esHoy ? "var(--night)" : "#fff", color: esHoy ? "#fff" : "var(--ink)", borderRadius: 14, padding: "8px 0 6px", textAlign: "center" }}>
                  <div style={{ fontSize: 11, opacity: 0.8 }}>{DIAS_CORTOS[diaSemana(d.fecha)]}</div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{partes(d.fecha).dia}</div>
                  <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: 9, background: color }} />
                </div>
              );
            })}
          </div>
          {turnoHoy ? (
            <Link href={`/colaborador/turno/${turnoHoy.id}`} className="perfil" style={{ textAlign: "left", display: "block", padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="ink2">Turno de hoy</span>
                <Estado punto={turnoHoy.enCurso ? "lima" : s.ahora < turnoHoy.inicio ? "azul" : ""}>{turnoHoy.enCurso ? "En curso" : s.ahora < turnoHoy.inicio ? "Más tarde" : "Terminado"}</Estado>
              </div>
              <div className="display" style={{ margin: "8px 0 4px" }}>{fmtRangoHoras(turnoHoy.inicio, turnoHoy.fin)}</div>
              <div className="ink2" style={{ display: "flex", alignItems: "center", gap: 6 }}><MapPin size={15} /> {turnoHoy.oficina}</div>
              {turnoHoy.enCurso && (
                <>
                  <div className="barra-uso" style={{ marginTop: 16, background: "#fff" }}>
                    <span style={{ width: `${((s.ahora - turnoHoy.inicio) / (turnoHoy.fin - turnoHoy.inicio)) * 100}%`, background: "var(--blue)" }} />
                  </div>
                  <div className="ink2" style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginTop: 8 }}>
                    <span>Llevas {Math.floor((s.ahora - turnoHoy.inicio) / 60)} h {(s.ahora - turnoHoy.inicio) % 60} min</span>
                    <span>Faltan {Math.floor((turnoHoy.fin - s.ahora) / 60)} h {(turnoHoy.fin - s.ahora) % 60} min</span>
                  </div>
                </>
              )}
            </Link>
          ) : (
            <div className="perfil" style={{ textAlign: "left", padding: 18 }}>
              <span className="ink2">Hoy</span>
              <div className="titulo-seccion" style={{ marginTop: 6 }}>{hoyDia?.ausencia ? `${NOMBRE_TIPO[hoyDia.ausencia.tipo]} · ${hoyDia.ausencia.estado === "PENDIENTE" ? "en revisión" : "aprobada"}` : "No tienes turno hoy"}</div>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "26px 0 4px" }}>
            <h2 className="titulo-seccion">Esta semana</h2>
            <span className="ink2" style={{ fontSize: 12.5 }}>{fmtH(s.horas)} h de {s.usuario.horasSemana} h</span>
          </div>
          {s.dias
            .filter((d) => d.fecha > hoy && (d.turnos.length || d.ausencia))
            .map((d) => (
              <div key={d.fecha} className="fila" style={{ alignItems: "center" }}>
                <div style={{ width: 44 }}>
                  <div className="ink2" style={{ fontSize: 12 }}>{DIAS_CORTOS[diaSemana(d.fecha)]}</div>
                  <div style={{ fontWeight: 600, fontSize: 17 }}>{partes(d.fecha).dia}</div>
                </div>
                {d.ausencia ? (
                  <div className={`cinta ${d.ausencia.tipo}`} style={{ flex: 1, minHeight: 44, flexDirection: "row", gap: 8 }}>
                    {NOMBRE_TIPO[d.ausencia.tipo]} · {d.ausencia.estado === "PENDIENTE" ? "en revisión" : "aprobada"}
                  </div>
                ) : (
                  d.turnos.slice(0, 1).map((t) => (
                    <Link key={t.id} href={`/colaborador/turno/${t.id}`} className="bloque" style={{ flex: 1, minHeight: 0 }}>
                      <span className="barra-estado" />
                      <span style={{ flex: 1 }}>
                        <span className="hora" style={{ display: "block", fontSize: 12.5 }}>{fmtRangoHoras(t.inicio, t.fin)}</span>
                        <span className="sub-linea" style={{ fontSize: 11.5 }}>{horasTrabajadas(t.inicio, t.fin) >= 8 ? "Jornada completa" : "Media jornada"} · {corto(t.oficina)}</span>
                      </span>
                      <ChevronRight size={16} color="var(--muted)" style={{ alignSelf: "center" }} />
                    </Link>
                  ))
                )}
              </div>
            ))}
        </div>
      </main>

      <aside className="panel">
        {admin && (
          <div className="perfil">
            <Avatar nombre={admin.nombre} tam="xl" />
            <div className="nombre">{admin.nombre}</div>
            <div className="contexto">Tu administradora</div>
            <div className="acciones-redondas">
              <Link href="/colaborador/reportar" aria-label="Reportar ausencia"><FilePlus2 /></Link>
              <a href={`mailto:${admin.correo}`} aria-label="Escribir"><Mail /></a>
            </div>
          </div>
        )}
        <div className="separador-titulo">Actividad</div>
        <div className="actividad">
          {pendiente && (
            <div className="entrada">
              <span className="icono-circulo naranja sm"><Hourglass /></span>
              <div className="cuerpo">
                <div className="cabeza"><span className="quien">Tu {NOMBRE_TIPO[pendiente.tipo].toLowerCase()}</span><span className="cuando">{fmtMomento(pendiente.creadoEn)}</span></div>
                <div className="que">{nombreAdmin} ya recibió EX-{pendiente.codigo} y la está revisando</div>
              </div>
            </div>
          )}
          {ultimoEnvio && (
            <div className="entrada">
              <span className="icono-circulo azul sm"><Mail /></span>
              <div className="cuerpo">
                <div className="cabeza"><span className="quien">Horario enviado</span><span className="cuando">{fmtMomento(ultimoEnvio.fechaEnvio)}</span></div>
                <div className="que">Semana {ultimoEnvio.semana}, a tu correo</div>
                <Link href="/colaborador" className="adjunto" style={{ marginTop: 10 }}>
                  <span className="doc" style={{ color: "var(--blue)" }}><CalendarDays /></span>
                  <span style={{ flex: 1 }}>
                    <span className="nombre" style={{ display: "block" }}>Horario_S{ultimoEnvio.semana}</span>
                    <span className="peso">Ver en la app</span>
                  </span>
                </Link>
              </div>
            </div>
          )}
          {resuelta && (
            <div className="entrada">
              <Avatar nombre={resuelta.revisadoPor?.nombre ?? nombreAdmin} tam="sm" />
              <div className="cuerpo">
                <div className="cabeza"><span className="quien">{resuelta.revisadoPor?.nombre ?? nombreAdmin}</span><span className="cuando">{fmtDiaMes(hoyISO(resuelta.resueltoEn ?? resuelta.creadoEn))}</span></div>
                <div className="que">{resuelta.estado === "APROBADA" ? "Aprobó" : "Rechazó"} tu {NOMBRE_TIPO[resuelta.tipo].toLowerCase()} del {fmtDiaMes(aISO(resuelta.fechaInicio))}</div>
                <div className="burbuja">
                  <div className="rotulo">Comentario de la resolución</div>
                  {resuelta.comentarioResolucion}
                </div>
              </div>
            </div>
          )}
        </div>
        <Link href="/colaborador/solicitudes" className="btn btn-secundario btn-bloque" style={{ marginTop: 18 }}>Ver mis solicitudes</Link>
      </aside>
    </>
  );
}
