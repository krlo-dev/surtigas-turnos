import { CalendarDays, Check, Gauge, Receipt, Mail as MailIcon, MessageSquare, Plug, Timer, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { BarraAdmin } from "@/components/shell/barra-admin";
import { GraficoFranjas } from "@/components/graficos";
import { SelectorUrl } from "@/components/selector-url";
import { db } from "@/lib/db";
import type { ResultadoPropuesta } from "@/lib/engine/tipos";
import { esperaPromedio } from "@/lib/engine/erlang";
import { aFecha, DIAS_CORTOS, DIAS_LARGOS, diaSemana, diasDeSemana, fmtDuracion, fmtNumero, fmtRangoFechas, hoyISO, lunesDe, partes, semanaISO, sumarDias } from "@/lib/fechas";
import { leerParametros, perfilesDemanda } from "@/lib/servicios/contexto";
import { PestanasMalla } from "../pestanas";
import { PanelPropuesta } from "./panel";
import { confirmarMalla, descartarPropuesta } from "../acciones";

export const metadata = { title: "Propuesta del motor" };

const ICONO_SERVICIO: Record<string, typeof Gauge> = { PQR: MessageSquare, "Facturación y pagos": Receipt, "Radicación de cartas": MailIcon, "Conexiones nuevas": Plug };

export default async function PaginaPropuesta({ searchParams }: { searchParams: Promise<{ semana?: string; oficina?: string; dia?: string; alt?: string }> }) {
  const sp = await searchParams;
  const lunes = lunesDe(sp.semana && /^\d{4}-\d{2}-\d{2}$/.test(sp.semana) ? sp.semana : sumarDias(hoyISO(), 7));
  const [corrida, oficinas, parametros, personas] = await Promise.all([
    db.corrida.findFirst({ where: { tipo: "PROPUESTA", estado: "BORRADOR", semanaInicio: aFecha(lunes) }, orderBy: { numero: "desc" } }),
    db.oficina.findMany({ where: { activa: true }, orderBy: { nombre: "asc" } }),
    leerParametros(),
    db.usuario.count({ where: { rol: "COLABORADOR", activo: true } }),
  ]);
  const semana = semanaISO(lunes);

  if (!corrida) {
    return (
      <main className="principal">
        <BarraAdmin />
        <PestanasMalla activa="propuesta" />
        <div className="encabezado" style={{ marginTop: 10 }}>
          <div>
            <h1 className="titulo-pagina">Propuesta para la semana {semana}</h1>
            <p className="sub">
              {fmtRangoFechas(lunes, sumarDias(lunes, 6))} · {oficinas.length} oficinas · {personas} personas
            </p>
          </div>
        </div>
        <div className="decision" style={{ marginTop: 26 }}>
          <span className="icono-circulo lima">
            <CalendarDays />
          </span>
          <div className="texto">
            <div className="frase">Todavía no hay una propuesta del motor para esta semana</div>
            <div className="razon">Calcula la malla con el histórico de Digiturno, las ausencias aprobadas y los ajustes manuales vigentes.</div>
          </div>
        </div>
        <div style={{ maxWidth: 380, marginTop: 24 }}>
          <PanelPropuesta corridaId={null} lunes={lunes} parametros={parametros} alternativas={[]} elegida="A" />
        </div>
      </main>
    );
  }

  const r = corrida.resultado as unknown as ResultadoPropuesta;
  const altId = (sp.alt === "B" || sp.alt === "A" ? sp.alt : r.elegida) as "A" | "B";
  const alt = r.alternativas.find((a) => a.id === altId) ?? r.alternativas[0];
  const oficinaSel = oficinas.find((o) => o.id === sp.oficina) ?? oficinas.find((o) => alt.franjasCortas[0]?.oficinaId === o.id) ?? oficinas.find((o) => o.nombre === "Cartagena Centro") ?? oficinas[0];
  const diasAbiertos = diasDeSemana(lunes).filter((d) => alt.franjas[oficinaSel.id]?.[d]);
  const corta = alt.franjasCortas.find((f) => f.oficinaId === oficinaSel.id);
  const dia = sp.dia && diasAbiertos.includes(sp.dia) ? sp.dia : (corta?.fecha ?? diasAbiertos[0]);
  const franjas = alt.franjas[oficinaSel.id]?.[dia] ?? [];
  const perfil = (await perfilesDemanda([oficinaSel.id], parametros.semanasHistorico))[oficinaSel.id];
  const cortaDia = alt.franjasCortas.find((f) => f.oficinaId === oficinaSel.id && f.fecha === dia) ?? corta;
  const nombreOficina = (id: string) => oficinas.find((o) => o.id === id)?.nombre ?? "";
  const primeraCorta = alt.franjasCortas[0];

  return (
    <main className="principal">
      <BarraAdmin />
      <PestanasMalla activa="propuesta" />
      <div className="encabezado" style={{ marginTop: 10 }}>
        <div>
          <h1 className="titulo-pagina">Propuesta para la semana {semana}</h1>
          <p className="sub">
            {fmtRangoFechas(lunes, sumarDias(lunes, 6))} · {oficinas.length} oficinas · corrida <span className="codigo">#{corrida.numero}</span>
          </p>
        </div>
        <div className="acciones">
          <form action={descartarPropuesta.bind(null, corrida.id)}>
            <button className="btn btn-quieto">Descartar</button>
          </form>
          <form action={confirmarMalla.bind(null, corrida.id, altId)}>
            <button className="btn btn-primario">
              <Check /> Confirmar malla{altId !== r.elegida ? ` ${altId}` : ""}
            </button>
          </form>
        </div>
      </div>

      <div className="kpis" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="kpi">
          <span className="icono-circulo"><Gauge /></span>
          <div>
            <div className="k-label">Nivel de servicio</div>
            <div className="k-valor">{fmtNumero(alt.kpis.nivelServicio * 100)}% <span className="k-extra">meta {Math.round(parametros.servicioObjetivo * 100)}%</span></div>
          </div>
        </div>
        <div className="kpi">
          <span className="icono-circulo"><Timer /></span>
          <div>
            <div className="k-label">Espera promedio</div>
            <div className="k-valor">{fmtDuracion(alt.kpis.esperaPromSeg)} <span className="k-extra">meta {fmtDuracion(parametros.tiempoObjetivoSeg)}</span></div>
          </div>
        </div>
        <div className="kpi">
          <span className="icono-circulo"><CalendarDays /></span>
          <div>
            <div className="k-label">Turnos</div>
            <div className="k-valor">{alt.kpis.turnos} <span className="k-extra">{alt.kpis.personas} personas</span></div>
          </div>
        </div>
        <div className="kpi">
          <span className="icono-circulo"><TriangleAlert /></span>
          <div>
            <div className="k-label">Franjas cortas</div>
            <div className="k-valor">
              {alt.franjasCortas.length}{" "}
              {primeraCorta && (
                <span className="k-extra texto-rojo">
                  {DIAS_CORTOS[diaSemana(primeraCorta.fecha)]} {primeraCorta.hora}–{primeraCorta.hora + 1} h
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: 36, marginTop: 30 }} className="apilar-movil">
        <div style={{ minWidth: 0 }}>
          <div className="encabezado" style={{ alignItems: "center", marginBottom: 12 }}>
            <h2 className="titulo-seccion">
              Personas por franja · {DIAS_CORTOS[diaSemana(dia)]} {partes(dia).dia}
            </h2>
            <div style={{ display: "flex", gap: 8 }}>
              <SelectorUrl parametro="dia" valor={dia} opciones={diasAbiertos.map((d) => ({ valor: d, texto: `${DIAS_CORTOS[diaSemana(d)]} ${partes(d).dia}` }))} etiqueta="Día" />
              <SelectorUrl parametro="oficina" valor={oficinaSel.id} opciones={oficinas.map((o) => ({ valor: o.id, texto: o.nombre }))} etiqueta="Oficina" />
            </div>
          </div>
          <GraficoFranjas datos={franjas} />
          <div className="leyenda">
            <span className="item"><span className="muestra" style={{ background: "#F4F5F7", border: "1px solid #ECEEF2" }} /> Requeridas</span>
            <span className="item"><span className="muestra" style={{ background: "var(--blue)" }} /> Asignadas</span>
            <span className="item"><span className="muestra" style={{ background: "var(--orange)" }} /> Faltan</span>
            <span className="item"><span style={{ width: 14, height: 2, background: "var(--lime-line)", display: "inline-block" }} /> Nivel de servicio</span>
          </div>

          {cortaDia ? (
            <div className="decision alerta">
              <span className="icono-circulo" style={{ background: "#fff", color: "var(--orange-ink)" }}>
                <TriangleAlert />
              </span>
              <div className="texto">
                <div className="frase">
                  {DIAS_LARGOS[diaSemana(cortaDia.fecha)]} {String(cortaDia.hora).padStart(2, "0")}:00 – {String(cortaDia.hora + 1).padStart(2, "0")}:00 queda <span className="resaltado">corto por {cortaDia.faltan} {cortaDia.faltan === 1 ? "persona" : "personas"}</span>
                </div>
                <div className="razon">
                  Llegan {Math.round(cortaDia.llegadas)} usuarios por hora; con {cortaDia.asignadas} {cortaDia.asignadas === 1 ? "persona" : "personas"} la espera sube a {fmtDuracion(perfil ? Math.min(3600, esperaPromedio(cortaDia.asignadas, cortaDia.llegadas, perfil.ahtSeg)) : cortaDia.esperaSeg)}.
                </div>
              </div>
              <Link href={`/admin/malla?semana=${lunes}&oficina=${cortaDia.oficinaId}&nuevo=1`} className="btn btn-secundario btn-sm">
                Cubrir
              </Link>
            </div>
          ) : (
            <div className="decision ok">
              <span className="icono-circulo" style={{ background: "#fff", color: "var(--lime-ink)" }}>
                <Gauge />
              </span>
              <div className="texto">
                <div className="frase">{nombreOficina(oficinaSel.id)} queda cubierta en todas las franjas de la semana</div>
                <div className="razon">{alt.franjasCortas.length ? `Hay ${alt.franjasCortas.length} franjas cortas en otras oficinas.` : "Ninguna oficina queda corta con esta malla."}</div>
              </div>
            </div>
          )}

          {perfil && (
            <section className="seccion">
              <div className="encabezado" style={{ alignItems: "baseline" }}>
                <h2 className="titulo-seccion">Tiempo de atención · {oficinaSel.nombre}</h2>
                <span className="muted">
                  {perfil.diasConDatos !== undefined && perfil.diasConDatos < 6
                    ? `Histórico de Digiturno · ${perfil.diasConDatos} ${perfil.diasConDatos === 1 ? "día" : "días"} con datos, el resto de la semana es estimado`
                    : `Histórico de Digiturno · ${perfil.semanasHistorico} semanas`}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "16px 0 6px" }}>
                <div style={{ flex: 1, display: "flex", gap: 4 }}>
                  <span style={{ height: 6, borderRadius: 9, background: "var(--blue)", width: `${(1 - perfil.partePreferencial) * 100}%` }} />
                  <span style={{ height: 6, borderRadius: 9, background: "var(--lime-line)", width: `${perfil.partePreferencial * 100}%` }} />
                </div>
                <span className="leyenda" style={{ marginTop: 0 }}>
                  <span className="item"><span className="muestra" style={{ background: "var(--blue)" }} /> General {Math.round((1 - perfil.partePreferencial) * 100)}%</span>
                  <span className="item"><span className="muestra" style={{ background: "var(--lime-line)" }} /> Preferencial {Math.round(perfil.partePreferencial * 100)}%</span>
                </span>
              </div>
              <div className="tabla-scroll">
                <table className="tabla" style={{ marginTop: 8 }}>
                  <thead>
                    <tr>
                      <th>Servicio</th>
                      <th className="der">General</th>
                      <th className="der">Preferencial</th>
                      <th style={{ paddingLeft: 24 }}>Parte de los turnos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perfil.servicios.map((s) => {
                      const I = ICONO_SERVICIO[s.servicio] ?? MessageSquare;
                      return (
                        <tr key={s.servicio}>
                          <td>
                            <span style={{ display: "flex", alignItems: "center", gap: 12, fontWeight: 500 }}>
                              <span className="icono-circulo sm"><I /></span>
                              {s.servicio}
                            </span>
                          </td>
                          <td className="der" style={{ fontWeight: 600 }}>{fmtDuracion(s.ahtGeneralSeg)} min</td>
                          <td className="der" style={{ fontWeight: 600 }}>{fmtDuracion(s.ahtPreferencialSeg)} min</td>
                          <td style={{ paddingLeft: 24 }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <span className="barra-uso" style={{ flex: 1 }}><span style={{ width: `${s.parte * 100}%`, background: "var(--blue-200)" }} /></span>
                              <b style={{ fontWeight: 500, width: 34, textAlign: "right" }}>{Math.round(s.parte * 100)}%</b>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    <tr>
                      <td style={{ fontWeight: 600 }}>Promedio de la oficina</td>
                      <td className="der" style={{ fontWeight: 600 }}>{fmtDuracion(perfil.ahtGeneralSeg)} min</td>
                      <td className="der" style={{ fontWeight: 600 }}>{fmtDuracion(perfil.ahtPreferencialSeg)} min</td>
                      <td style={{ paddingLeft: 24 }} className="ink2">{Math.round(perfil.turnosPorSemana)} turnos por semana</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="ink2" style={{ fontSize: 12, marginTop: 14 }}>
                {parametros.prioridadPreferencial ? "La fila preferencial se atiende primero, así que el motor le reserva capacidad en cada franja. " : ""}
                {parametros.respetarPuestos ? `Nunca asigna más personas que los ${oficinaSel.capacidad} puestos de la oficina.` : ""}
              </p>
            </section>
          )}
        </div>

        <PanelPropuesta
          corridaId={corrida.id}
          lunes={lunes}
          parametros={(corrida.parametros as unknown as typeof parametros) ?? parametros}
          elegida={altId}
          recomendada={r.elegida}
          alternativas={r.alternativas.map((a) => ({ id: a.id, nombre: a.nombre, estrategia: a.estrategia, servicio: a.kpis.nivelServicio, espera: a.kpis.esperaPromSeg, turnos: a.kpis.turnos, cortas: a.franjasCortas.length }))}
        />
      </div>
      <p className="caption muted" style={{ marginTop: 24 }}>Calculada {hoyISO(corrida.creadoEn) === hoyISO() ? "hoy" : `el ${fmtRangoFechas(hoyISO(corrida.creadoEn), hoyISO(corrida.creadoEn))}`} con {r.alternativas.length} estrategias · Erlang C por franja y simulación de eventos discretos.</p>
    </main>
  );
}
