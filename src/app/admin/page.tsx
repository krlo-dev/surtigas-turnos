import {
  ArrowRight,
  CalendarDays,
  CalendarX2,
  Check,
  ChevronRight,
  CircleArrowDown,
  Clock,
  EllipsisVertical,
  Flame,
  Gauge,
  Mail,
  Sparkles,
  Timer,
  UserX,
  Users,
} from "lucide-react";
import Link from "next/link";
import { auth } from "@/auth";
import { GraficoLlegadas } from "@/components/graficos";
import { Refrescar } from "@/components/refrescar";
import { SelectorUrl } from "@/components/selector-url";
import {
  Avatar,
  Delta,
  Estado,
  Kpi,
  estadoCarga,
  fmtKb,
} from "@/components/ui";
import {
  fmtDuracion,
  fmtFechaLarga,
  fmtFechaMedia,
  fmtMomento,
  fmtNumero,
  fmtRangoFechas,
  aISO,
  fmtHace,
  fmtRangoHoras,
  fmtDiaCorto,
} from "@/lib/fechas";
import { datosTablero } from "@/lib/servicios/tablero";

export const metadata = { title: "Inicio" };

const pct = (v: number) => `${Math.round(v * 100)}%`;
const pctDelta = (v: number) => `${v > 0 ? "+" : ""}${Math.round(v * 100)}%`;

export default async function InicioAdmin({
  searchParams,
}: {
  searchParams: Promise<{ oficina?: string }>;
}) {
  const { oficina } = await searchParams;
  const sesion = await auth();
  const d = await datosTablero(oficina);
  const nombre = (sesion?.user?.name ?? "").split(" ")[0];
  const k = d.kpis;
  const atencion = d.carga.filter(
    (c) => c.abierta && (c.uso > 0.85 || c.deficit.length),
  ).length;
  const oficinaNombre =
    d.oficinas.find((o) => o.id === d.oficinaGrafico)?.nombre ?? "";
  const resumen = d.decision
    ? "Casi todo cubierto."
    : "Todo cubierto por ahora.";

  return (
    <>
      <main className="principal">
        <Refrescar segundos={60} />
        <div className="encabezado">
          <div>
            <h1 className="saludo">Hola, {nombre}</h1>
            <p className="sub">
              {d.esHoy
                ? `Así va la operación hoy. ${resumen}`
                : `Mostrando el histórico de Digiturno del ${d.refTexto}. ${resumen}`}
            </p>
          </div>
          <div className="acciones solo-escritorio">
            <span style={{ fontWeight: 500 }}>{fmtFechaLarga(d.hoy)}</span>
            <Link
              href="/admin/malla"
              className="btn-icono"
              aria-label="Ver malla"
            >
              <CalendarDays />
            </Link>
          </div>
        </div>

        {/* KPIs: cinco cifras en escritorio, cuatro en móvil */}
        <div
          className="kpis cinco solo-escritorio"
          style={{ gridTemplateColumns: "repeat(5, 1fr)" }}
        >
          <Kpi
            label="En turno hoy"
            valor={`${k.enTurno}/${k.colaboradores}`}
            delta={
              <Delta
                valor={k.deltaTurno}
                bueno={k.deltaTurno >= 0}
                texto={`${k.deltaTurno > 0 ? "+" : ""}${k.deltaTurno}`}
              />
            }
          />
          <Kpi
            label="Ausencias"
            valor={k.ausencias}
            delta={
              <Delta
                valor={k.deltaAusencias}
                bueno={k.deltaAusencias <= 0}
                texto={`${k.deltaAusencias > 0 ? "+" : ""}${k.deltaAusencias}`}
              />
            }
          />
          <Kpi
            label="Servicio"
            valor={k.hayDatos ? pct(k.servicio) : "–"}
            delta={
              k.hayDatos ? (
                <Delta
                  valor={Math.round(k.deltaServicio * 100)}
                  bueno={k.deltaServicio >= 0}
                  texto={pctDelta(k.deltaServicio)}
                />
              ) : null
            }
          />
          <Kpi
            label="Espera prom."
            valor={k.hayDatos ? fmtDuracion(k.espera) : "–"}
            delta={
              k.hayDatos ? (
                <Delta
                  valor={Math.round(k.deltaEspera)}
                  bueno={k.deltaEspera <= 0}
                  texto={`${k.deltaEspera > 0 ? "+" : "-"}${fmtDuracion(Math.abs(k.deltaEspera))}`}
                />
              ) : null
            }
          />
          <Kpi
            label="Abandono"
            valor={k.hayDatos ? `${fmtNumero(k.abandono * 100)}%` : "–"}
            delta={
              k.hayDatos ? (
                <Delta
                  valor={Math.round(k.deltaAbandono * 1000)}
                  bueno={k.deltaAbandono <= 0}
                  texto={`${k.deltaAbandono > 0 ? "+" : ""}${fmtNumero(k.deltaAbandono * 100)}`}
                />
              ) : null
            }
          />
        </div>
        <div className="kpis solo-movil">
          <Kpi
            icono={Users}
            label="En turno"
            valor={`${k.enTurno}/${k.colaboradores}`}
          />
          <Kpi
            icono={Gauge}
            label="Servicio"
            valor={k.hayDatos ? pct(k.servicio) : "–"}
          />
          <Kpi
            icono={Timer}
            label="Espera"
            valor={k.hayDatos ? fmtDuracion(k.espera) : "–"}
          />
          <Kpi icono={CalendarX2} label="Ausencias" valor={k.ausencias} />
        </div>

        {/* La decisión del día */}
        {d.decision ? (
          <div className="decision">
            <span className="icono-circulo lima solo-escritorio">
              <Sparkles />
            </span>
            <div className="texto">
              <div className="frase">
                {d.decision.oficina} necesita{" "}
                <span className="resaltado">
                  {d.decision.faltan}{" "}
                  {d.decision.faltan === 1 ? "persona más" : "personas más"}
                </span>{" "}
                de {String(d.decision.desde).padStart(2, "0")}:00 a{" "}
                {String(d.decision.hasta).padStart(2, "0")}:00
              </div>
              <div className="razon">
                {d.decision.cobertura
                  ? `El motor ya tiene una cobertura lista: ${d.decision.cobertura}.`
                  : "No hay nadie libre cerca; revisa la malla o un apoyo virtual."}
              </div>
            </div>
            <Link
              href={
                d.decision.cobertura
                  ? "/admin/apoyos"
                  : `/admin/malla?oficina=${d.decision.oficinaId}`
              }
              className="btn btn-primario"
            >
              Ver propuesta <ArrowRight />
            </Link>
          </div>
        ) : (
          <div className="decision ok">
            <span className="icono-circulo lima solo-escritorio">
              <Check />
            </span>
            <div className="texto">
              <div className="frase">
                Las{" "}
                <span className="resaltado">
                  {d.carga.filter((c) => c.abierta).length} oficinas abiertas
                </span>{" "}
                tienen la gente que piden sus filas
              </div>
              <div className="razon">
                El motor no ve franjas cortas en lo que queda del día.
              </div>
            </div>
            <Link href="/admin/malla/propuesta" className="btn btn-secundario">
              Propuesta de la próxima semana <ArrowRight />
            </Link>
          </div>
        )}

        {/* Por revisar (móvil) */}
        <section className="solo-movil seccion">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 6,
            }}
          >
            <h2 className="titulo-seccion">Por revisar</h2>
            <Link href="/admin/ausencias" className="muted">
              Ver todas
            </Link>
          </div>
          {d.porRevisar.map((r) => (
            <Link
              key={r.id}
              href={`/admin/ausencias/EX-${r.codigo}`}
              className="fila"
            >
              <Avatar nombre={r.usuario.nombre} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>{r.usuario.nombre}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {r.tipo === "INCAPACIDAD"
                    ? "Incapacidad"
                    : r.tipo === "PERMISO"
                      ? "Permiso"
                      : "Excusa"}{" "}
                  · {fmtRangoFechas(aISO(r.fechaInicio), aISO(r.fechaFin))}
                </div>
              </div>
              <ChevronRight size={16} color="var(--muted)" />
            </Link>
          ))}
        </section>

        {/* Llegadas de usuarios */}
        <section className="seccion solo-escritorio" style={{ marginTop: 34 }}>
          <div
            className="encabezado"
            style={{ alignItems: "center", marginBottom: 14 }}
          >
            <h2 className="titulo-seccion">Llegadas de usuarios</h2>
            <SelectorUrl
              parametro="oficina"
              valor={d.oficinaGrafico ?? ""}
              opciones={d.oficinas.map((o) => ({
                valor: o.id,
                texto: `${o.nombre} · ${d.esHoy ? "hoy" : d.refTexto}`,
              }))}
              etiqueta="Oficina del gráfico"
            />
          </div>
          <GraficoLlegadas
            datos={d.grafico}
            etiquetaHoy={d.esHoy ? "Hoy" : d.refTexto}
          />
          <p className="caption muted" style={{ marginTop: 6 }}>
            Turnos de Digiturno por hora en {oficinaNombre}, comparados con el
            promedio de las últimas 4 semanas del mismo día.
          </p>
        </section>

        {/* Carga por oficina */}
        <section className="seccion">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              marginBottom: 8,
            }}
          >
            <h2 className="titulo-seccion">Carga por oficina</h2>
            <span
              className="muted ocultar-movil"
              style={{ borderLeft: "1px solid var(--line)", paddingLeft: 14 }}
            >
              {atencion} de {d.carga.length} requieren atención
            </span>
            <span style={{ flex: 1 }} />
            <Link href="/admin/oficinas" className="btn btn-secundario btn-sm">
              Ver las {d.carga.length} <ArrowRight />
            </Link>
          </div>
          <div className="lista-filas">
            {d.carga.slice(0, 3).map((c) => {
              const e = c.abierta
                ? estadoCarga(c.uso)
                : { texto: "Cerrada hoy", punto: "" };
              return (
                <div
                  key={c.oficina.id}
                  className="fila"
                  style={{ padding: "18px 0" }}
                >
                  <span
                    className={`icono-circulo ${c.uso > 0.9 ? "rojo" : c.uso > 0.85 ? "naranja" : "azul"}`}
                  >
                    {c.uso > 0.9 ? (
                      <Flame />
                    ) : c.uso > 0.85 ? (
                      <Gauge />
                    ) : (
                      <Users />
                    )}
                  </span>
                  <div style={{ flex: 1.4, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 13.5 }}>
                      {c.oficina.nombre}
                    </div>
                    <div className="muted" style={{ fontSize: 11.5 }}>
                      {c.oficina.ciudad} · {c.personasHoy} de {c.equipo}{" "}
                      personas
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <Estado punto={e.punto}>{e.texto}</Estado>
                  </div>
                  <div
                    className="ocultar-movil"
                    style={{
                      flex: 0.8,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontWeight: 500,
                    }}
                  >
                    <Clock size={16} color="var(--ink-2)" />{" "}
                    {Math.round(c.espera / 60)} min
                  </div>
                  <div
                    className="ocultar-movil"
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      color:
                        c.abandonados > 5 ? "var(--red-ink)" : "var(--ink-2)",
                    }}
                  >
                    <UserX size={16} />{" "}
                    {c.abandonados
                      ? `${c.abandonados} se ${c.abandonados === 1 ? "fue" : "fueron"}`
                      : "Nadie se fue"}
                  </div>
                  <Link
                    href={`/admin/malla?oficina=${c.oficina.id}`}
                    className="btn-icono sm"
                    style={{ border: 0 }}
                    aria-label={`Malla de ${c.oficina.nombre}`}
                  >
                    <EllipsisVertical style={{ transform: "rotate(90deg)" }} />
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <aside className="panel">
        {d.pendiente ? (
          <div className="perfil">
            <Avatar
              nombre={d.pendiente.usuario.nombre}
              tam="xl"
              presencia="naranja"
            />
            <div className="nombre">{d.pendiente.usuario.nombre}</div>
            <div className="contexto">
              {d.pendiente.usuario.oficina?.nombre} · espera tu respuesta
            </div>
            <div className="acciones-redondas">
              <Link
                href={`/admin/ausencias/EX-${d.pendiente.codigo}`}
                aria-label="Revisar"
              >
                <Check />
              </Link>
              <a
                href={`mailto:${d.pendiente.usuario.correo}`}
                aria-label="Escribir"
              >
                <Mail />
              </a>
              <Link href="/admin/equipo" aria-label="Ver equipo">
                <EllipsisVertical />
              </Link>
            </div>
          </div>
        ) : (
          <div className="perfil">
            <span
              className="icono-circulo lima"
              style={{ width: 78, height: 78, margin: "0 auto 14px" }}
            >
              <Check size={28} />
            </span>
            <div className="nombre">Sin ausencias por revisar</div>
            <div className="contexto">
              Te avisamos por correo apenas llegue una.
            </div>
          </div>
        )}
        <div className="separador-titulo">Actividad</div>
        <div className="actividad">
          {d.recientes.slice(0, 2).map((r, i) => (
            <div key={r.id} className="entrada">
              <Avatar
                nombre={r.usuario.nombre}
                tam="sm"
                presencia={i === 0 ? "lima" : null}
              />
              <div className="cuerpo">
                <div className="cabeza">
                  <span className="quien">{r.usuario.nombre}</span>
                  <span className="cuando">{fmtMomento(r.creadoEn)}</span>
                </div>
                <div className="que">
                  {r.tipo === "INCAPACIDAD"
                    ? "Reportó una incapacidad"
                    : r.tipo === "PERMISO"
                      ? `Pidió permiso para el ${fmtDiaCorto(aISO(r.fechaInicio)).toLowerCase()}`
                      : "Envió una excusa"}{" "}
                  ·{" "}
                  <Link href={`/admin/ausencias/EX-${r.codigo}`}>
                    EX-{r.codigo}
                  </Link>
                </div>
                {i === 0 && (
                  <>
                    <div className="burbuja">
                      <div className="rotulo">Motivo</div>
                      {r.motivo}
                    </div>
                    {r.soporteNombre && (
                      <a
                        className="adjunto"
                        href={`/api/soportes/${r.id}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ marginTop: 10 }}
                      >
                        <span className="doc">
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.7"
                          >
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <path d="M14 2v6h6M9 13h6M9 17h4" />
                          </svg>
                        </span>
                        <span style={{ flex: 1 }}>
                          <span className="nombre" style={{ display: "block" }}>
                            {r.soporteNombre}
                          </span>
                          <span className="peso">{fmtKb(r.soporteBytes)}</span>
                        </span>
                        <CircleArrowDown
                          size={20}
                          color="var(--blue)"
                          strokeWidth={1.6}
                        />
                      </a>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
          {d.apoyo && (
            <div className="entrada">
              <Avatar nombre={d.apoyo.usuario.nombre} tam="sm" />
              <div className="cuerpo">
                <div className="cabeza">
                  <span className="quien">{d.apoyo.usuario.nombre}</span>
                  <span className="cuando">{fmtHace(d.apoyo.creadoEn)}</span>
                </div>
                <div className="que">
                  Apoyará en{" "}
                  <Link href="/admin/apoyos">
                    {d.apoyo.haciaOficina.nombre}
                  </Link>{" "}
                  el{" "}
                  {fmtFechaMedia(aISO(d.apoyo.fecha))
                    .split(" ")
                    .slice(0, 2)
                    .join(" ")
                    .replace(/^(\w)/, (m) => m.toLowerCase())}
                  , {fmtRangoHoras(d.apoyo.horaInicio, d.apoyo.horaFin)}
                </div>
              </div>
            </div>
          )}
          {d.envio && (
            <div className="entrada">
              <span className="icono-circulo azul sm">
                <Mail />
              </span>
              <div className="cuerpo">
                <div className="cabeza">
                  <span className="quien">Horario semana {d.envio.semana}</span>
                  <span className="cuando">{fmtMomento(d.envio.fecha)}</span>
                </div>
                <div className="que">
                  Enviado a {d.envio.enviados} de {d.envio.total} personas
                  {d.envio.errores ? (
                    <>
                      {" "}
                      ·{" "}
                      <Link href="/admin/correos?filtro=error">
                        {d.envio.errores} con error
                      </Link>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </div>
        <Link
          href="/admin/ausencias?estado=todas"
          className="btn btn-secundario btn-bloque"
          style={{ marginTop: 18 }}
        >
          Ver todas las ausencias
        </Link>
      </aside>
    </>
  );
}
