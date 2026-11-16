import type { EstadoExcusa, TipoExcusa } from "@prisma/client";
import { CalendarClock, FileText, Store, Thermometer, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function iniciales(nombre: string) {
  const p = nombre.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

/** Tinte pastel estable por nombre (HSL), con texto en el mismo tono oscuro. */
export function tinte(nombre: string) {
  let h = 0;
  for (const c of nombre) h = (h * 31 + c.charCodeAt(0)) % 360;
  const tonos = [25, 145, 265, 330, 45, 200, 95, 5];
  const tono = tonos[h % tonos.length];
  return { background: `hsl(${tono} 70% 93%)`, color: `hsl(${tono} 45% 32%)` };
}

export function Avatar({ nombre, tam = "", presencia }: { nombre: string; tam?: "" | "sm" | "md" | "xl"; presencia?: "lima" | "naranja" | null }) {
  return (
    <span className={`avatar ${tam}`} style={tinte(nombre)} aria-hidden>
      {iniciales(nombre)}
      {presencia && <span className="presencia" style={{ background: presencia === "naranja" ? "var(--orange)" : "var(--lime)" }} />}
    </span>
  );
}

export const ICONO_TIPO: Record<TipoExcusa, LucideIcon> = { INCAPACIDAD: Thermometer, PERMISO: CalendarClock, EXCUSA: FileText };
export const NOMBRE_TIPO: Record<TipoExcusa, string> = { INCAPACIDAD: "Incapacidad", PERMISO: "Permiso", EXCUSA: "Excusa" };

export function ChipTipo({ tipo, className = "" }: { tipo: TipoExcusa; className?: string }) {
  const I = ICONO_TIPO[tipo];
  return (
    <span className={`chip tipo-${tipo} ${className}`}>
      <I /> {NOMBRE_TIPO[tipo]}
    </span>
  );
}

export function Cinta({ tipo, etiqueta, codigo, pendiente }: { tipo: TipoExcusa | "CERRADO"; etiqueta?: string; codigo?: string; pendiente?: boolean }) {
  const I = tipo === "CERRADO" ? Store : ICONO_TIPO[tipo];
  return (
    <div className={`cinta ${tipo} ${pendiente ? "pendiente" : ""}`}>
      <I />
      <span>{etiqueta ?? (tipo === "CERRADO" ? "Cerrado" : NOMBRE_TIPO[tipo])}</span>
      {codigo && <span className="cod">{codigo}</span>}
    </div>
  );
}

const ESTADO_EXCUSA: Record<EstadoExcusa, { texto: string; punto: string }> = {
  PENDIENTE: { texto: "Pendiente", punto: "naranja" },
  APROBADA: { texto: "Aprobada", punto: "lima" },
  RECHAZADA: { texto: "Rechazada", punto: "rojo" },
};

export function EstadoExcusaPunto({ estado }: { estado: EstadoExcusa }) {
  const e = ESTADO_EXCUSA[estado];
  return <Estado punto={e.punto}>{e.texto}</Estado>;
}

export function Estado({ punto, children }: { punto: string; children: ReactNode }) {
  return (
    <span className="estado">
      <span className={`punto ${punto}`} />
      {children}
    </span>
  );
}

/** Variación coloreada por significado (no por signo). */
export function Delta({ valor, bueno, texto }: { valor: number; bueno: boolean | null; texto: string }) {
  const clase = bueno === null || valor === 0 ? "igual" : bueno ? "bien" : "mal";
  return (
    <span className={`delta ${clase}`}>
      {valor !== 0 && <span className={`tri ${valor > 0 ? "arriba" : "abajo"}`} />}
      {texto}
    </span>
  );
}

export function Kpi({ icono: I, label, valor, extra, delta }: { icono?: LucideIcon; label: string; valor: ReactNode; extra?: ReactNode; delta?: ReactNode }) {
  return (
    <div className="kpi">
      {I && (
        <span className="icono-circulo">
          <I />
        </span>
      )}
      <div style={{ minWidth: 0 }}>
        <div className="k-label">{label}</div>
        <div className="k-valor">
          {valor}
          {extra && <span className="k-extra">{extra}</span>}
          {delta}
        </div>
      </div>
    </div>
  );
}

export function BarraUso({ valor, color }: { valor: number; color: string }) {
  return (
    <div className="barra-uso">
      <span style={{ width: `${Math.max(2, Math.min(100, valor * 100))}%`, background: color }} />
    </div>
  );
}

export function colorUso(u: number) {
  if (u > 1) return "var(--red)";
  if (u > 0.9) return "var(--orange)";
  if (u < 0.6) return "var(--blue-200)";
  return "var(--lime-line)";
}

/** Uso = personas que pide la fila / personas en turno. */
export function estadoCarga(u: number): { texto: string; punto: string } {
  if (u > 1) return { texto: "Sobrecarga", punto: "rojo" };
  if (u > 0.9) return { texto: "Al límite", punto: "naranja" };
  if (u < 0.6) return { texto: "Con capacidad libre", punto: "azul" };
  return { texto: "Óptima", punto: "oliva" };
}

export function fmtKb(bytes: number | null | undefined) {
  if (!bytes) return "";
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.round(bytes / 1024)} KB`;
}
