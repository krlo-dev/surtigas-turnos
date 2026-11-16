"use client";

import { Check, Copy, MapPin, Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { Avatar, Cinta, NOMBRE_TIPO } from "@/components/ui";
import { DIAS_CORTOS, diaSemana, fmtHora, fmtRangoHoras, partes } from "@/lib/fechas";
import type { vistaMalla } from "@/lib/servicios/vista-malla";
import { copiar, eliminarTurno, guardarTurno, publicar } from "./acciones";

type Vista = NonNullable<Awaited<ReturnType<typeof vistaMalla>>>;
type Sel = { personaId: string; nombre: string; fecha: string; turnoId?: string; inicio: number; fin: number; oficinaId: string };

export function GrillaMalla({ v, cabecera, abrirNuevo }: { v: Vista; cabecera: ReactNode; abrirNuevo: boolean }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const primera = v.filas[0];
  const diaInicial = v.dias.find((d) => d.esHoy && d.abierto) ?? v.dias.find((d) => d.abierto) ?? v.dias[0];
  const [sel, setSel] = useState<Sel | null>(
    abrirNuevo && primera ? { personaId: primera.persona.id, nombre: primera.persona.nombre, fecha: diaInicial.fecha, inicio: 8 * 60, fin: 13 * 60, oficinaId: v.oficina.id } : null,
  );
  const [entra, setEntra] = useState(sel ? fmtHora(sel.inicio) : "08:00");
  const [sale, setSale] = useState(sel ? fmtHora(sel.fin) : "13:00");
  const [oficina, setOficina] = useState(sel?.oficinaId ?? v.oficina.id);
  const [persona, setPersona] = useState(sel?.personaId ?? "");
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);

  const abrir = (s: Sel) => {
    setSel(s);
    setEntra(fmtHora(s.inicio));
    setSale(fmtHora(s.fin));
    setOficina(s.oficinaId);
    setPersona(s.personaId);
    setMsg(null);
  };
  const correr = (fn: () => Promise<{ ok?: string; error?: string } | undefined>, cerrar = false) =>
    iniciar(async () => {
      const r = await fn();
      setMsg(r ?? null);
      if (!r?.error && cerrar) setSel(null);
      router.refresh();
    });

  const etiquetaDia = (fecha: string) => `${DIAS_CORTOS[diaSemana(fecha)]} ${partes(fecha).dia}`;

  return (
    <>
      <div className="tablero">
        <div className="tablero-barra">
          {cabecera}
          <button className="btn btn-secundario btn-sm" disabled={pendiente} onClick={() => correr(() => copiar(v.lunes, v.oficina.id))}>
            <Copy /> Copiar
          </button>
          <button className="btn btn-primario btn-sm" disabled={pendiente || v.sinPublicar === 0} onClick={() => correr(() => publicar(v.lunes, v.oficina.id))}>
            <Check /> Publicar{v.sinPublicar ? ` (${v.sinPublicar})` : ""}
          </button>
        </div>
        {msg && <div className={`aviso ${msg.error ? "error" : "ok"}`} style={{ borderRadius: 0 }}>{msg.error ?? msg.ok}</div>}
        <div className="grilla-scroll">
          <div className="grilla">
            <div className="celda-cab">Semana {v.semana}</div>
            {v.dias.map((d) => (
              <div key={d.fecha} className="celda-cab">
                <span className={d.esHoy ? "banda" : ""}>{d.etiqueta}</span>
                {d.abierto && (
                  <button
                    className="editar"
                    style={{ background: "none", border: 0, display: "grid" }}
                    aria-label={`Nuevo turno el ${d.etiqueta}`}
                    onClick={() => primera && abrir({ personaId: primera.persona.id, nombre: primera.persona.nombre, fecha: d.fecha, inicio: 8 * 60, fin: 13 * 60, oficinaId: v.oficina.id })}
                  >
                    <Pencil />
                  </button>
                )}
              </div>
            ))}
            {v.filas.map((f) => (
              <Fila key={f.persona.id} f={f} v={v} sel={sel} abrir={abrir} />
            ))}
            <>
              <div className="celda-pie" style={{ color: "var(--ink-2)" }}>Horas</div>
              {v.pie.map((p, i) => (
                <div key={i} className="celda-pie" style={{ fontWeight: 600 }}>{p.horas === null ? "–" : `${fmtN(p.horas)} h`}</div>
              ))}
              <div className="celda-pie" style={{ color: "var(--ink-2)" }}>Cobertura</div>
              {v.pie.map((p, i) => (
                <div key={i} className="celda-pie" style={{ fontWeight: 500 }}>
                  {p.cobertura === null ? (
                    "–"
                  ) : (
                    <span className="estado">
                      <span className={`punto ${p.cobertura >= 0.85 ? "lima" : p.cobertura >= 0.7 ? "naranja" : "rojo"}`} />
                      {Math.round(p.cobertura * 100)}%
                    </span>
                  )}
                </div>
              ))}
            </>
          </div>
        </div>
        {sel && (
          <div className="editor-anclado">
            <div style={{ minWidth: 170 }}>
              <div className="titulo-item">{sel.turnoId ? "Editar turno" : "Nuevo turno"}</div>
              {sel.turnoId ? (
                <div className="ink2" style={{ fontSize: 12.5 }}>
                  {sel.nombre} · {etiquetaDia(sel.fecha)}
                </div>
              ) : (
                <select className="select-pill" value={persona} onChange={(e) => setPersona(e.target.value)} style={{ marginTop: 4 }} aria-label="Persona">
                  {v.personasOficina
                    .slice()
                    .sort((a, b) => Number(b.oficinaId === v.oficina.id) - Number(a.oficinaId === v.oficina.id) || a.nombre.localeCompare(b.nombre))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                </select>
              )}
            </div>
            <button className="btn-icono sm" onClick={() => setSel(null)} aria-label="Cerrar editor">
              <X />
            </button>
            {!sel.turnoId && (
              <div className="campo">
                <label>Día</label>
                <select className="select sm" value={sel.fecha} onChange={(e) => setSel({ ...sel, fecha: e.target.value })} style={{ width: 130 }}>
                  {v.dias.filter((d) => d.abierto).map((d) => (
                    <option key={d.fecha} value={d.fecha}>
                      {d.etiqueta}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="campo">
              <label htmlFor="entra">Entra</label>
              <input id="entra" type="time" step={1800} className="input sm" value={entra} onChange={(e) => setEntra(e.target.value)} style={{ width: 120 }} />
            </div>
            <div className="campo">
              <label htmlFor="sale">Sale</label>
              <input id="sale" type="time" step={1800} className="input sm" value={sale} onChange={(e) => setSale(e.target.value)} style={{ width: 120 }} />
            </div>
            <div className="campo" style={{ flex: 1, minWidth: 200 }}>
              <label htmlFor="ofi">Oficina</label>
              <div className="control">
                <MapPin />
                <select id="ofi" className="select sm" value={oficina} onChange={(e) => setOficina(e.target.value)} style={{ paddingLeft: 38 }}>
                  {v.oficinas.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p style={{ fontSize: 11.5, color: "var(--ink-2)", maxWidth: 170 }}>
              Quedará como <span className="resaltado">ajuste manual</span>: el motor no lo moverá al recalcular.
            </p>
            <button
              className="btn btn-primario"
              disabled={pendiente}
              onClick={() => correr(() => guardarTurno({ id: sel.turnoId, usuarioId: sel.turnoId ? sel.personaId : persona || sel.personaId, oficinaId: oficina, fecha: sel.fecha, entra, sale }), true)}
            >
              Guardar
            </button>
            {sel.turnoId && (
              <button className="btn btn-texto-peligro" disabled={pendiente} onClick={() => correr(() => eliminarTurno(sel.turnoId!), true)}>
                Quitar turno
              </button>
            )}
          </div>
        )}
      </div>
      <div className="leyenda" style={{ justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          <span className="item"><span className="barrita" /> Confirmado</span>
          <span className="item"><span className="barrita propuesto" /> Propuesto o movido</span>
          <span className="item"><span className="barrita manual" /> Ajuste manual</span>
          <span className="item"><span className="barrita choque" /> Choque</span>
          <span className="item"><span className="barrita liberado" /> <s>Liberado</s></span>
          {(["INCAPACIDAD", "PERMISO", "EXCUSA"] as const).map((t) => (
            <span key={t} className="item"><span className={`muestra ${t}`} /> {NOMBRE_TIPO[t]}</span>
          ))}
        </div>
        <span className="muted">
          {v.corrida ? `Corrida #${v.corrida}` : "Sin corrida del motor"} · {v.sinPublicar} {v.sinPublicar === 1 ? "cambio" : "cambios"} sin publicar
        </span>
      </div>
    </>
  );
}

function Fila({ f, v, sel, abrir }: { f: Vista["filas"][number]; v: Vista; sel: Sel | null; abrir: (s: Sel) => void }) {
  return (
    <>
      <div className="celda-persona">
        <Avatar nombre={f.persona.nombre} tam="md" />
        <div className="persona" style={{ display: "block" }}>
          <div className="nombre">{f.persona.nombre}</div>
          <div className="linea">{f.persona.linea}</div>
        </div>
      </div>
      {f.celdas.map((c, i) => {
        const fecha = v.dias[i].fecha;
        if (c.tipo === "ausencia")
          return (
            <div key={i} className="celda">
              <Cinta tipo={c.tipoExcusa} codigo={c.estado === "PENDIENTE" ? `${c.codigo} · en revisión` : c.codigo} pendiente={c.estado === "PENDIENTE"} />
            </div>
          );
        if (c.tipo === "cerrado")
          return (
            <div key={i} className="celda">
              <Cinta tipo="CERRADO" />
            </div>
          );
        if (c.tipo === "fuera")
          return (
            <div key={i} className="celda">
              <div className="fuera">{c.texto}</div>
            </div>
          );
        if (c.tipo === "vacia")
          return (
            <div
              key={i}
              className="celda vacia-clic"
              role="button"
              tabIndex={0}
              aria-label={`Agregar turno a ${f.persona.nombre}`}
              onClick={() => abrir({ personaId: f.persona.id, nombre: f.persona.nombre, fecha, inicio: 8 * 60, fin: 13 * 60, oficinaId: v.oficina.id })}
            />
          );
        return (
          <div key={i} className="celda" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {c.turnos.map((t) => (
              <button
                key={t.id}
                className={`bloque ${t.clase} ${sel?.turnoId === t.id ? "seleccionado" : ""}`}
                onClick={() => t.clase !== "liberado" && abrir({ personaId: f.persona.id, nombre: f.persona.nombre, fecha, turnoId: t.id, inicio: t.inicio, fin: t.fin, oficinaId: t.oficinaId })}
                title={`${fmtRangoHoras(t.inicio, t.fin)} · ${t.sub}`}
              >
                <span className="barra-estado" />
                <span>
                  <span className="hora" style={{ display: "block" }}>{fmtRangoHoras(t.inicio, t.fin)}</span>
                  <span className="sub-linea">{t.sub}</span>
                </span>
              </button>
            ))}
          </div>
        );
      })}
    </>
  );
}

function fmtN(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
}
