import { ArrowLeft, MapPin, UserCheck, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { Avatar, Estado } from "@/components/ui";
import { db } from "@/lib/db";
import { horasTrabajadas } from "@/lib/engine/oficinas";
import { aISO, DIAS_LARGOS, diaSemana, fmtRangoHoras, partes, MESES_CORTOS } from "@/lib/fechas";
import { picoDeTurnos } from "@/lib/servicios/colaborador";

export const metadata = { title: "Detalle del turno" };

export default async function DetalleTurno({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await auth();
  const t = await db.turno.findUnique({ where: { id }, include: { oficina: true } });
  if (!t || t.usuarioId !== s?.user.id) notFound();
  const fecha = aISO(t.fecha);
  const [pico] = await picoDeTurnos([{ oficinaId: t.oficinaId, fecha, inicio: t.horaInicio, fin: t.horaFin }]);
  const companeros = await db.turno.findMany({
    where: { oficinaId: t.oficinaId, fecha: t.fecha, estado: { not: "LIBERADO" }, usuarioId: { not: t.usuarioId }, horaInicio: { lt: t.horaFin }, horaFin: { gt: t.horaInicio } },
    include: { usuario: true },
  });
  const nombres = companeros.map((c) => c.usuario.nombre.split(" ")[0]);
  const h = horasTrabajadas(t.horaInicio, t.horaFin);
  return (
    <main className="principal" style={{ maxWidth: 640 }}>
      <Link href="/colaborador" className="volver"><ArrowLeft /> Mi semana</Link>
      <h1 className="titulo-pagina" style={{ marginBottom: 16 }}>{DIAS_LARGOS[diaSemana(fecha)]} {partes(fecha).dia} {MESES_CORTOS[partes(fecha).mes]}</h1>
      <Estado punto={t.estado === "MANUAL" ? "oliva" : "azul"}>{t.estado === "MANUAL" ? "Ajustado por la administración" : t.origen === "COBERTURA" ? `Confirmado · cubres a ${t.cubreA?.split(" ")[0]}` : "Confirmado"}</Estado>
      <div className="display" style={{ fontSize: 34, margin: "10px 0 4px" }}>{fmtRangoHoras(t.horaInicio, t.horaFin)}</div>
      <p className="ink2">{Number.isInteger(h) ? h : h.toFixed(1)} horas · {t.oficina.nombre}{t.virtual ? " · atención virtual" : ""}</p>
      <div className="lista-filas" style={{ marginTop: 22 }}>
        <div className="fila">
          <span className="icono-circulo azul"><MapPin /></span>
          <div><div style={{ fontWeight: 500 }}>{t.oficina.nombre}</div><div className="ink2" style={{ fontSize: 12 }}>Atención al cliente · {t.oficina.ciudad}</div></div>
        </div>
        {pico && (
          <div className="fila">
            <span className="icono-circulo naranja"><Users /></span>
            <div><div style={{ fontWeight: 500 }}>Franja pico {String(pico.hora).padStart(2, "0")}:00 – {String(pico.hora + 1).padStart(2, "0")}:00</div><div className="ink2" style={{ fontSize: 12 }}>Se esperan {pico.llegadas} usuarios por hora</div></div>
          </div>
        )}
        <div className="fila">
          <span className="icono-circulo lima"><UserCheck /></span>
          <div>
            <div style={{ fontWeight: 500 }}>Contigo en el turno</div>
            {nombres.length ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                {companeros.slice(0, 3).map((c) => <Avatar key={c.id} nombre={c.usuario.nombre} tam="sm" />)}
                <span className="ink2" style={{ fontSize: 12.5 }}>{nombres.length > 1 ? `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}` : nombres[0]}</span>
              </div>
            ) : (
              <div className="ink2" style={{ fontSize: 12 }}>Atiendes solo en este horario</div>
            )}
          </div>
        </div>
      </div>
      <Link href={`/colaborador/reportar?fecha=${fecha}`} className="btn btn-peligro btn-lg btn-bloque" style={{ marginTop: 30 }}>No puedo ir este día</Link>
    </main>
  );
}
