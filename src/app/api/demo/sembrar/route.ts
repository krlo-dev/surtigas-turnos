import { NextResponse } from "next/server";
import { sembrarDemo } from "@/lib/datos/sembrar";

// Carga los datos de demostración desde Vercel, sin correr nada en un computador.
// BORRA toda la base. Protegida con CRON_SECRET: /api/demo/sembrar?secreto=<CRON_SECRET>
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secreto = process.env.CRON_SECRET;
  const url = new URL(req.url);
  const enviado = url.searchParams.get("secreto") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secreto || enviado !== secreto) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const pasos: string[] = [];
  const inicio = Date.now();
  const r = await sembrarDemo((m) => pasos.push(m));
  return NextResponse.json({ ok: true, ...r, segundos: Math.round((Date.now() - inicio) / 1000), pasos });
}
