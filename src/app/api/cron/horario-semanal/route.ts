import { NextResponse } from "next/server";
import { hoyISO, lunesDe, sumarDias } from "@/lib/fechas";
import { enviarHorarioSemanal } from "@/lib/servicios/malla";

// RF-10: Vercel Cron llama esta ruta los domingos a las 18:00 (hora de Colombia).
// Vercel envía "Authorization: Bearer <CRON_SECRET>"; cualquier otra llamada se rechaza (ERS 4.6).
export const maxDuration = 60;

export async function GET(req: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  // El domingo se envía la semana que empieza al día siguiente.
  const lunes = sumarDias(lunesDe(hoyISO()), 7);
  const r = await enviarHorarioSemanal(lunes);
  return NextResponse.json({ ok: true, ...r, lunes });
}
