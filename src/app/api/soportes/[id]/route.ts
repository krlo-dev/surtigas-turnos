import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { obtenerAlmacenamiento } from "@/lib/almacenamiento";
import { db } from "@/lib/db";

// Los soportes pueden tener datos de salud: solo los ve la administración o la persona que los subió.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await auth();
  if (!sesion?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id } = await params;
  const e = await db.excusa.findUnique({ where: { id }, select: { usuarioId: true, soporteUrl: true, soporteNombre: true } });
  if (!e?.soporteUrl) return NextResponse.json({ error: "Sin soporte" }, { status: 404 });
  if (sesion.user.rol !== "ADMIN" && sesion.user.id !== e.usuarioId) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  if (e.soporteUrl.startsWith("/")) return NextResponse.redirect(new URL(e.soporteUrl, req.url));
  const { cuerpo, tipo } = await obtenerAlmacenamiento(e.soporteUrl).leer(e.soporteUrl);
  return new NextResponse(cuerpo, {
    headers: {
      "Content-Type": tipo,
      "Content-Disposition": `inline; filename="${encodeURIComponent(e.soporteNombre ?? "soporte")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
