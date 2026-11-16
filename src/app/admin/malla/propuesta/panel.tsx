"use client";

import { Check, RefreshCw } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import type { ParametrosMotor } from "@/lib/engine/tipos";
import { fmtDuracion, fmtNumero } from "@/lib/fechas";
import { recalcularPropuesta } from "../acciones";

type Alt = { id: "A" | "B"; nombre: string; estrategia: string; servicio: number; espera: number; turnos: number; cortas: number };

const INTERRUPTORES: { clave: keyof ParametrosMotor; texto: string }[] = [
  { clave: "prioridadPreferencial", texto: "Atender primero la fila preferencial" },
  { clave: "respetarPuestos", texto: "No pasar de los puestos de cada oficina" },
  { clave: "excluirAusencias", texto: "Excluir ausencias aprobadas" },
  { clave: "permitirApoyosEntreCiudades", texto: "Permitir apoyos entre ciudades" },
  { clave: "respetarAjustesManuales", texto: "Respetar ajustes manuales" },
];

export function PanelPropuesta({ corridaId, lunes, parametros, alternativas, elegida, recomendada }: { corridaId: string | null; lunes: string; parametros: ParametrosMotor; alternativas: Alt[]; elegida: "A" | "B"; recomendada?: "A" | "B" }) {
  const [par, setPar] = useState(parametros);
  const [editar, setEditar] = useState(!corridaId);
  const [pendiente, iniciar] = useTransition();
  const pathname = usePathname();
  const sp = useSearchParams();
  const base = alternativas.find((a) => a.id === recomendada) ?? alternativas[0];
  const enlace = (id: string) => {
    const p = new URLSearchParams(sp.toString());
    p.set("alt", id);
    return `${pathname}?${p.toString()}`;
  };
  const calcular = () => iniciar(() => recalcularPropuesta(lunes, par));

  return (
    <div>
      {alternativas.length > 0 && (
        <>
          <h2 className="titulo-seccion" style={{ marginBottom: 16 }}>Mallas comparadas</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {alternativas.map((a) => {
              const activa = a.id === elegida;
              const diff = base && a.id !== base.id ? (a.servicio - base.servicio) * 100 : 0;
              return (
                <Link key={a.id} href={enlace(a.id)} scroll={false} className="tarjeta-tipo" style={{ gap: 8, ...(activa ? { borderColor: "var(--blue)", boxShadow: "0 0 0 4px var(--blue-50)" } : {}) }}>
                  <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <b style={{ fontWeight: 600, fontSize: 13.5 }}>{a.nombre}</b>
                    {a.id === recomendada ? (
                      <span className="chip chip-azul" style={{ width: "auto", height: 26, fontWeight: 500, fontSize: 12 }}><Check /> {activa ? "Elegida" : "Recomendada"}</span>
                    ) : (
                      <span className={diff < 0 ? "texto-rojo" : "texto-oliva"} style={{ fontSize: 12 }}>{diff ? `${diff > 0 ? "+" : ""}${fmtNumero(diff)} pts` : ""}</span>
                    )}
                  </span>
                  <span className="ink2" style={{ fontSize: 12.5 }}>
                    {fmtNumero(a.servicio * 100)}% de servicio · espera {fmtDuracion(a.espera)} · {a.turnos} turnos
                  </span>
                  <span className="muted" style={{ fontSize: 11.5 }}>{a.estrategia} · {a.cortas} {a.cortas === 1 ? "franja corta" : "franjas cortas"}</span>
                </Link>
              );
            })}
          </div>
          <div style={{ height: 1, background: "var(--line)", margin: "24px 0 22px" }} />
        </>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
        <h3 className="titulo-item">Parámetros</h3>
        {corridaId && (
          <button onClick={() => setEditar(!editar)} style={{ background: "none", border: 0, color: "var(--blue)", fontWeight: 500, fontSize: 12.5 }}>
            {editar ? "Listo" : "Editar"}
          </button>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 12.5 }}>
        <Fila etiqueta="Servicio objetivo">
          {editar ? (
            <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input className="input sm" style={{ width: 62, height: 32 }} type="number" min={50} max={99} value={Math.round(par.servicioObjetivo * 100)} onChange={(e) => setPar({ ...par, servicioObjetivo: Number(e.target.value) / 100 })} />% en
              <input className="input sm" style={{ width: 54, height: 32 }} type="number" min={1} max={30} value={Math.round(par.tiempoObjetivoSeg / 60)} onChange={(e) => setPar({ ...par, tiempoObjetivoSeg: Number(e.target.value) * 60 })} /> min
            </span>
          ) : (
            `${Math.round(par.servicioObjetivo * 100)}% en ${Math.round(par.tiempoObjetivoSeg / 60)} min`
          )}
        </Fila>
        <Fila etiqueta="Tiempo de atención">Por oficina y servicio</Fila>
        <Fila etiqueta="Histórico">
          {editar ? (
            <span><input className="input sm" style={{ width: 54, height: 32 }} type="number" min={1} max={26} value={par.semanasHistorico} onChange={(e) => setPar({ ...par, semanasHistorico: Number(e.target.value) })} /> semanas</span>
          ) : (
            `${par.semanasHistorico} semanas`
          )}
        </Fila>
        <Fila etiqueta="Simulaciones">
          {editar ? (
            <span><input className="input sm" style={{ width: 62, height: 32 }} type="number" min={1} max={100} value={par.replicas} onChange={(e) => setPar({ ...par, replicas: Number(e.target.value) })} /> réplicas</span>
          ) : (
            `${par.replicas} réplicas`
          )}
        </Fila>
        <Fila etiqueta="Tope semanal">
          {editar ? (
            <span><input className="input sm" style={{ width: 54, height: 32 }} type="number" min={20} max={48} value={par.maxHorasSemana} onChange={(e) => setPar({ ...par, maxHorasSemana: Number(e.target.value) })} /> h</span>
          ) : (
            `${par.maxHorasSemana} h`
          )}
        </Fila>
        <Fila etiqueta="Semilla">
          {editar ? <input className="input sm" style={{ width: 110, height: 32 }} type="number" value={par.semilla} onChange={(e) => setPar({ ...par, semilla: Number(e.target.value) })} /> : <span className="codigo">{par.semilla}</span>}
        </Fila>
        {INTERRUPTORES.map((it) => (
          <label key={it.clave} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, color: "var(--ink-2)" }}>
            {it.texto}
            <input type="checkbox" className="toggle" checked={Boolean(par[it.clave])} onChange={(e) => setPar({ ...par, [it.clave]: e.target.checked })} />
          </label>
        ))}
      </div>
      <button className="btn btn-secundario btn-bloque" style={{ marginTop: 22 }} onClick={calcular} disabled={pendiente}>
        <RefreshCw className={pendiente ? "animate-spin" : ""} /> {pendiente ? "Calculando…" : corridaId ? "Volver a calcular" : "Calcular propuesta"}
      </button>
    </div>
  );
}

function Fila({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
      <span className="ink2">{etiqueta}</span>
      <b style={{ fontWeight: 500, color: "var(--ink)" }}>{children}</b>
    </div>
  );
}
