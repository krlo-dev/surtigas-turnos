import Image from "next/image";
import type { ReactNode } from "react";

export function MarcoAcceso({ children, pie }: { children: ReactNode; pie: ReactNode }) {
  return (
    <div className="acceso">
      <div className="lado">
        <div style={{ paddingLeft: 22 }}>
          <Image src="/logo-surtigas.svg" alt="Surtigas" width={108} height={48} priority />
        </div>
        <div className="formulario">{children}</div>
        <div style={{ fontSize: 11.5, color: "var(--ink-2)", display: "flex", alignItems: "center", gap: 8 }}>{pie}</div>
      </div>
      <div className="arte" role="img" aria-label="Gestión de turnos" />
    </div>
  );
}
