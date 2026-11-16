"use client";

import { CalendarClock, ChevronLeft, ChevronRight, FileText, Paperclip, Send, Thermometer, X } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { fmtKb } from "@/components/ui";
import { DIAS_CORTOS, DIAS_MIN, diaSemana, fmtRangoHoras, MESES_LARGOS, partes, sumarDias } from "@/lib/fechas";
import { reportarAusencia } from "../acciones";

type Tipo = "EXCUSA" | "PERMISO" | "INCAPACIDAD";
const TIPOS: { tipo: Tipo; titulo: string; texto: string; icono: typeof FileText }[] = [
  { tipo: "EXCUSA", titulo: "Excusa", texto: "Un imprevisto que no te dejó llegar", icono: FileText },
  { tipo: "PERMISO", titulo: "Permiso", texto: "Algo planeado, con anticipación", icono: CalendarClock },
  { tipo: "INCAPACIDAD", titulo: "Incapacidad", texto: "Médica, con soporte de la EPS", icono: Thermometer },
];

export function FormularioReporte({ hoy, inicial, admin, turnos }: { hoy: string; inicial: string | null; admin: string; turnos: { fecha: string; inicio: number; fin: number; oficina: string }[] }) {
  const [estado, accion, enviando] = useActionState(reportarAusencia, undefined);
  const [tipo, setTipo] = useState<Tipo | null>(null);
  const [desde, setDesde] = useState<string | null>(inicial);
  const [hasta, setHasta] = useState<string | null>(inicial);
  const [jornada, setJornada] = useState<"TODO_EL_DIA" | "UNAS_HORAS">("TODO_EL_DIA");
  const [mes, setMes] = useState(() => {
    const p = partes(inicial ?? hoy);
    return { anio: p.anio, mes: p.mes };
  });
  const [archivo, setArchivo] = useState<File | null>(null);
  const [movil, setMovil] = useState(false);
  const inputArchivo = useRef<HTMLInputElement>(null);
  useEffect(() => setMovil(window.matchMedia("(max-width: 860px)").matches), []);

  const afectados = useMemo(() => (desde ? turnos.filter((t) => t.fecha >= desde && t.fecha <= (hasta ?? desde)) : []), [desde, hasta, turnos]);
  const clicDia = (d: string) => {
    if (!desde || (desde && hasta && desde !== hasta) || d < desde) {
      setDesde(d);
      setHasta(d);
    } else if (desde === hasta) setHasta(d);
  };
  const primero = `${mes.anio}-${String(mes.mes + 1).padStart(2, "0")}-01`;
  const offset = (diaSemana(primero) + 6) % 7;
  const diasMes = new Date(Date.UTC(mes.anio, mes.mes + 1, 0)).getUTCDate();
  const celdas = [...Array(offset).fill(null), ...Array.from({ length: diasMes }, (_, i) => sumarDias(primero, i))];
  const cambiarMes = (d: number) => setMes(({ anio, mes: m }) => ({ anio: anio + Math.floor((m + d) / 12), mes: (m + d + 12) % 12 }));
  const tipoDe = tipo ?? "INCAPACIDAD";
  const tinte = { INCAPACIDAD: "#fbe2cd", PERMISO: "#d5e6f6", EXCUSA: "#e6e5e5" }[tipoDe];
  const textoRango = desde ? (hasta && hasta !== desde ? `${partes(desde).dia} y ${partes(hasta).dia} de ${MESES_LARGOS[partes(hasta).mes]}` : `${partes(desde).dia} de ${MESES_LARGOS[partes(desde).mes]}`) : "elige en el calendario";

  return (
    <form action={accion} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 280px", gap: 48, marginTop: 28 }} className="apilar-movil">
      <input type="hidden" name="tipo" value={tipo ?? ""} />
      <input type="hidden" name="desde" value={desde ?? ""} />
      <input type="hidden" name="hasta" value={hasta ?? ""} />
      <input type="hidden" name="jornada" value={jornada} />
      <input type="hidden" name="canal" value={movil ? "movil" : "web"} />
      <div style={{ minWidth: 0 }}>
        <div className="label" style={{ marginBottom: 10 }}>¿Qué pasó?</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {TIPOS.map((t) => (
            <button key={t.tipo} type="button" className={`tarjeta-tipo ${tipo === t.tipo ? "elegida" : ""}`} onClick={() => setTipo(t.tipo)}>
              <span className={`chip tipo-${t.tipo}`}><t.icono /> {t.titulo}</span>
              <p className="ocultar-movil">{t.texto}</p>
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, marginTop: 26 }} className="apilar-movil">
          <div>
            <div className="label solo-escritorio" style={{ marginBottom: 10 }}>Días · {textoRango}</div>
            <div className="tablero solo-escritorio" style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <button type="button" className="btn-flecha" onClick={() => cambiarMes(-1)} aria-label="Mes anterior"><ChevronLeft /></button>
                <b style={{ fontWeight: 600 }}>{MESES_LARGOS[mes.mes].replace(/^./, (c) => c.toUpperCase())} {mes.anio}</b>
                <button type="button" className="btn-flecha" onClick={() => cambiarMes(1)} aria-label="Mes siguiente"><ChevronRight /></button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, textAlign: "center" }}>
                {[1, 2, 3, 4, 5, 6, 0].map((d) => <span key={d} className="muted" style={{ fontSize: 11.5, padding: "4px 0" }}>{DIAS_MIN[d]}</span>)}
                {celdas.map((d, i) => {
                  if (!d) return <span key={i} />;
                  const dentro = desde && d >= desde && d <= (hasta ?? desde);
                  const pasado = d < sumarDias(hoy, -30);
                  return (
                    <button
                      key={d}
                      type="button"
                      disabled={pasado}
                      onClick={() => clicDia(d)}
                      style={{
                        height: 34,
                        borderRadius: 9,
                        border: d === hoy ? "1.5px solid var(--blue-200)" : "0",
                        background: dentro ? `repeating-linear-gradient(135deg, ${tinte} 0 6px, #fff 6px 11px)` : "transparent",
                        color: pasado ? "#C9CFD7" : dentro ? "var(--orange-ink)" : d < hoy ? "var(--muted)" : "var(--ink)",
                        fontWeight: dentro || d === hoy ? 600 : 400,
                        fontSize: 12.5,
                      }}
                    >
                      {partes(d).dia}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="solo-movil">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div className="campo">
                  <label>Desde</label>
                  <input type="date" className="input" value={desde ?? ""} onChange={(e) => { setDesde(e.target.value); if (!hasta || hasta < e.target.value) setHasta(e.target.value); }} />
                </div>
                <div className="campo">
                  <label>Hasta</label>
                  <input type="date" className="input" value={hasta ?? ""} min={desde ?? undefined} onChange={(e) => setHasta(e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="label" style={{ marginBottom: 10 }}>Jornada</div>
            <div className="segmentado bloque">
              <button type="button" className={jornada === "TODO_EL_DIA" ? "activo" : ""} onClick={() => setJornada("TODO_EL_DIA")}>Todo el día</button>
              <button type="button" className={jornada === "UNAS_HORAS" ? "activo" : ""} onClick={() => setJornada("UNAS_HORAS")}>Unas horas</button>
            </div>
            {jornada === "UNAS_HORAS" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
                <div className="campo"><label>Desde las</label><input name="horaInicio" type="time" className="input sm" defaultValue="08:00" /></div>
                <div className="campo"><label>Hasta las</label><input name="horaFin" type="time" className="input sm" defaultValue="12:00" /></div>
              </div>
            )}
            <div className="campo" style={{ marginTop: 22 }}>
              <label htmlFor="motivo">Cuéntale a {admin}</label>
              <textarea id="motivo" name="motivo" className="textarea" required placeholder="Qué pasó y, si aplica, el número de radicado o del soporte." />
            </div>
            <div className="campo" style={{ marginTop: 20 }}>
              <span className="label">Soporte</span>
              <input ref={inputArchivo} type="file" name="soporte" accept="application/pdf,image/jpeg,image/png,image/webp" hidden onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
              {archivo ? (
                <div className="adjunto">
                  <span className="doc"><FileText /></span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="nombre" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{archivo.name}</span>
                    <span className="peso">{fmtKb(archivo.size)} · {archivo.size > 4 * 1024 * 1024 ? "pasa de 4 MB" : "listo"}</span>
                  </span>
                  <button type="button" onClick={() => { setArchivo(null); if (inputArchivo.current) inputArchivo.current.value = ""; }} style={{ background: "none", border: 0, color: "var(--ink-2)" }} aria-label="Quitar soporte"><X size={16} /></button>
                </div>
              ) : (
                <button type="button" className="zona-subida" onClick={() => inputArchivo.current?.click()} style={{ background: "#fff" }}>
                  <Paperclip size={17} /> Adjunta un PDF o una foto (máx. 4 MB){tipo === "INCAPACIDAD" ? ". Para incapacidades es necesario." : ""}
                </button>
              )}
            </div>
          </div>
        </div>
        {afectados.length > 0 && (
          <p className="solo-movil" style={{ color: "var(--orange-ink)", fontSize: 12.5, marginTop: 16 }}>
            Se {afectados.length === 1 ? "libera 1 turno" : `liberan ${afectados.length} turnos`}: {afectados.map((t) => `${DIAS_CORTOS[diaSemana(t.fecha)].toLowerCase()} ${partes(t.fecha).dia}`).join(" y ")}.
          </p>
        )}
        {estado?.error && <div className="aviso error" style={{ marginTop: 18 }}>{estado.error}</div>}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 30 }}>
          <Link href="/colaborador" className="btn btn-quieto">Cancelar</Link>
          <button className="btn btn-primario btn-lg" disabled={enviando || !tipo || !desde || (tipo === "INCAPACIDAD" && !archivo)}>
            <Send /> {enviando ? "Enviando…" : `Enviar a ${admin}`}
          </button>
        </div>
      </div>

      <aside className="ocultar-movil">
        <h2 className="titulo-seccion" style={{ marginBottom: 14 }}>Turnos que se afectan</h2>
        {afectados.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {afectados.map((t, i) => (
              <div key={i} className="bloque" style={{ cursor: "default", minHeight: 0, padding: "2px 0" }}>
                <span className="barra-estado" />
                <span>
                  <span className="hora" style={{ display: "block" }}>{DIAS_CORTOS[diaSemana(t.fecha)]} {partes(t.fecha).dia} · {fmtRangoHoras(t.inicio, t.fin)}</span>
                  <span className="sub-linea">{t.oficina}</span>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted" style={{ fontSize: 12.5 }}>{desde ? "No tienes turnos asignados en esos días." : "Elige los días para ver qué turnos se liberan."}</p>
        )}
        <h2 className="titulo-seccion" style={{ margin: "32px 0 16px" }}>Qué pasa después</h2>
        <div className="timeline" style={{ padding: 0 }}>
          {[
            [`${admin} recibe el aviso`, "Por correo, al instante"],
            ["Lo revisa", "Suele tardar menos de 7 horas"],
            ["Te llega la respuesta", "Por correo y en Mis solicitudes"],
            ["Alguien cubre tu turno", "Si se aprueba"],
          ].map(([t, d], i) => (
            <div key={t} className={`paso ${i === 0 ? "actual" : ""}`}>
              <span className="marca">{i + 1}</span>
              <div><div className="t">{t}</div><div className="d">{d}</div></div>
            </div>
          ))}
        </div>
      </aside>
    </form>
  );
}
