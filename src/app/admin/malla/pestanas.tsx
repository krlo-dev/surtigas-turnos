import { CalendarDays, RefreshCw, WandSparkles } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/db";

export async function PestanasMalla({ activa }: { activa: "vigente" | "propuesta" | "recalculo" }) {
  const recalculos = await db.corrida.count({ where: { tipo: "RECALCULO", estado: "BORRADOR" } });
  return (
    <nav className="rail">
      <Link href="/admin/malla" className={`tab ${activa === "vigente" ? "activo" : ""}`}>
        <CalendarDays /> Malla vigente
      </Link>
      <Link href="/admin/malla/propuesta" className={`tab ${activa === "propuesta" ? "activo" : ""}`}>
        <WandSparkles /> Propuesta del motor
      </Link>
      <Link href="/admin/malla/recalculo" className={`tab ${activa === "recalculo" ? "activo" : ""}`}>
        <RefreshCw /> Recálculo {recalculos > 0 && <span className="cuenta" style={{ color: activa === "recalculo" ? "var(--blue-ink)" : undefined }}>{recalculos}</span>}
      </Link>
    </nav>
  );
}
