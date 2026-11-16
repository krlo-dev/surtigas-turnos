import { NextResponse } from "next/server";
import { asegurarSimulacionAlDia } from "@/lib/servicios/simulacion";

// Tarea diaria del prototipo: mantiene al día la demanda simulada y la malla de la semana.
export const maxDuration = 60;

export async function GET(req: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  await asegurarSimulacionAlDia(true);
  return NextResponse.json({ ok: true });
}
