"use client";

import { useState } from "react";

function curva(puntos: [number, number][]) {
  if (puntos.length < 2) return "";
  let d = `M${puntos[0][0]},${puntos[0][1]}`;
  for (let i = 0; i < puntos.length - 1; i++) {
    const p0 = puntos[i - 1] ?? puntos[i];
    const p1 = puntos[i];
    const p2 = puntos[i + 1];
    const p3 = puntos[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

function escala(max: number) {
  const pasos = [5, 10, 20, 25, 50, 100, 200];
  const paso = pasos.find((p) => max / p <= 5) ?? Math.ceil(max / 5);
  const tope = Math.max(paso, Math.ceil(max / paso) * paso);
  return { tope, marcas: Array.from({ length: tope / paso + 1 }, (_, i) => i * paso) };
}

/** Llegadas de usuarios por hora: hoy vs. promedio de 4 semanas (líneas suaves con tooltip oscuro). */
export function GraficoLlegadas({ datos, etiquetaHoy = "Hoy" }: { datos: { hora: number; hoy: number | null; prom: number }[]; etiquetaHoy?: string }) {
  const W = 760;
  const H = 230;
  const izq = 34;
  const der = 10;
  const arriba = 10;
  const abajo = 30;
  const max = Math.max(5, ...datos.map((d) => Math.max(d.hoy ?? 0, d.prom)));
  const { tope, marcas } = escala(max * 1.1);
  const x = (i: number) => izq + (i * (W - izq - der)) / Math.max(1, datos.length - 1);
  const y = (v: number) => arriba + (1 - v / tope) * (H - arriba - abajo);
  const ultimoHoy = datos.reduce((k, d, i) => (d.hoy !== null ? i : k), -1);
  const [sel, setSel] = useState<number>(Math.max(0, datos.findIndex((d) => d.hoy !== null && (d.hoy ?? 0) === Math.max(...datos.slice(0, ultimoHoy + 1).map((z) => z.hoy ?? 0))) ?? 0));
  const ptsHoy = datos.map((d, i) => [x(i), y(d.hoy ?? 0)] as [number, number]).slice(0, ultimoHoy + 1);
  const ptsProm = datos.map((d, i) => [x(i), y(d.prom)] as [number, number]);
  const area = ptsHoy.length > 1 ? `${curva(ptsHoy)} L${ptsHoy[ptsHoy.length - 1][0]},${y(0)} L${ptsHoy[0][0]},${y(0)} Z` : "";
  const d = datos[sel];
  return (
    <div style={{ position: "relative" }} onMouseLeave={() => undefined}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Llegadas de usuarios por hora" style={{ display: "block", overflow: "visible" }}>
        <defs>
          <linearGradient id="areaHoy" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#3981C0" stopOpacity="0.14" />
            <stop offset="1" stopColor="#3981C0" stopOpacity="0" />
          </linearGradient>
        </defs>
        {marcas.map((m) => (
          <g key={m}>
            <text x={0} y={y(m) + 4} fontSize="11" fill="#687180">
              {m}
            </text>
          </g>
        ))}
        {area && <path d={area} fill="url(#areaHoy)" />}
        <path d={curva(ptsProm)} fill="none" stroke="#7A9030" strokeWidth="2.2" />
        {ptsHoy.length > 1 && <path d={curva(ptsHoy)} fill="none" stroke="#3981C0" strokeWidth="2.2" />}
        {d && <line x1={x(sel)} x2={x(sel)} y1={arriba} y2={y(0)} stroke="#B8D4EC" strokeDasharray="3 4" />}
        {d && d.hoy !== null && <circle cx={x(sel)} cy={y(d.hoy)} r="5.5" fill="#3981C0" stroke="#fff" strokeWidth="2" />}
        {d && <circle cx={x(sel)} cy={y(d.prom)} r="5.5" fill="#7A9030" stroke="#fff" strokeWidth="2" />}
        {datos.map((p, i) => (
          <g key={p.hora}>
            {i === sel && <rect x={x(i) - 13} y={H - 22} width="26" height="20" rx="10" fill="#F4F5F7" />}
            <text x={x(i)} y={H - 8} fontSize="11" fill={i === sel ? "#16202B" : "#687180"} fontWeight={i === sel ? 600 : 400} textAnchor="middle">
              {String(p.hora).padStart(2, "0")}
            </text>
            <rect x={x(i) - (W - izq) / datos.length / 2} y={0} width={(W - izq) / datos.length} height={H} fill="transparent" onMouseEnter={() => setSel(i)} onClick={() => setSel(i)} />
          </g>
        ))}
      </svg>
      {d && (
        <div className="tooltip" style={{ left: `calc(${(x(sel) / W) * 100}% + 14px)`, top: `${(y(Math.max(d.hoy ?? 0, d.prom)) / H) * 100}%`, transform: x(sel) > W * 0.7 ? "translateX(calc(-100% - 28px))" : undefined }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            {etiquetaHoy} · {String(d.hora).padStart(2, "0")}:00
          </div>
          <div className="fila-tt" style={{ gap: 18 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <i style={{ background: "#3981C0" }} /> {etiquetaHoy}
            </span>
            <b>{d.hoy === null ? "–" : `${Math.round(d.hoy)} /h`}</b>
          </div>
          <div className="fila-tt" style={{ gap: 18, marginTop: 4 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <i style={{ background: "#AEC452" }} /> Prom. 4 sem.
            </span>
            <b>{Math.round(d.prom)} /h</b>
          </div>
        </div>
      )}
    </div>
  );
}

/** Personas por franja: requeridas vs. asignadas (naranja si faltan) y nivel de servicio. */
export function GraficoFranjas({ datos }: { datos: { hora: number; requeridas: number; asignadas: number; nivelServicio: number }[] }) {
  const W = 760;
  const H = 210;
  const izq = 26;
  const abajo = 28;
  const max = Math.max(2, ...datos.map((d) => Math.max(d.requeridas, d.asignadas)));
  const tope = Math.ceil((max + 1) / 2) * 2;
  const marcas = Array.from({ length: tope / 2 + 1 }, (_, i) => i * 2);
  const ancho = (W - izq) / Math.max(1, datos.length);
  const y = (v: number) => 8 + (1 - v / tope) * (H - 8 - abajo);
  const ySl = (v: number) => 8 + (1 - Math.min(1, v)) * (H - 8 - abajo) * 0.9 + 4;
  const [sel, setSel] = useState<number | null>(null);
  const linea = curva(datos.map((d, i) => [izq + i * ancho + ancho / 2, ySl(d.nivelServicio)]));
  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Personas requeridas y asignadas por franja" style={{ display: "block" }}>
        {marcas.map((m) => (
          <text key={m} x={0} y={y(m) + 4} fontSize="11" fill="#687180">
            {m}
          </text>
        ))}
        {datos.map((d, i) => {
          const x0 = izq + i * ancho + ancho / 2 - 30;
          const falta = d.asignadas < d.requeridas;
          return (
            <g key={d.hora} onMouseEnter={() => setSel(i)} onMouseLeave={() => setSel(null)}>
              <rect x={x0} y={y(d.requeridas)} width="26" height={Math.max(0, y(0) - y(d.requeridas))} rx="5" fill="#F4F5F7" stroke="#ECEEF2" />
              <rect x={x0 + 30} y={y(d.asignadas)} width="26" height={Math.max(0, y(0) - y(d.asignadas))} rx="5" fill={falta ? "#E8873A" : "#3981C0"} />
              <text x={izq + i * ancho + ancho / 2} y={H - 8} fontSize="11" fill="#687180" textAnchor="middle">
                {String(d.hora).padStart(2, "0")}
              </text>
              <rect x={izq + i * ancho} y={0} width={ancho} height={H} fill="transparent" />
            </g>
          );
        })}
        <path d={linea} fill="none" stroke="#7A9030" strokeWidth="2.2" />
      </svg>
      {sel !== null && datos[sel] && (
        <div className="tooltip" style={{ left: `${((izq + sel * ancho + ancho) / W) * 100}%`, top: 10 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{String(datos[sel].hora).padStart(2, "0")}:00 – {String(datos[sel].hora + 1).padStart(2, "0")}:00</div>
          <div>Requeridas {datos[sel].requeridas} · asignadas {datos[sel].asignadas}</div>
          <div>Nivel de servicio {Math.round(datos[sel].nivelServicio * 100)}%</div>
        </div>
      )}
    </div>
  );
}
