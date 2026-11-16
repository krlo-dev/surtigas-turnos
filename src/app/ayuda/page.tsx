import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { auth } from "@/auth";

export const metadata = { title: "Ayuda e información" };

export default async function Ayuda() {
  const s = await auth();
  const admin = s?.user?.rol === "ADMIN";
  return (
    <div className="acceso" style={{ gridTemplateColumns: "1fr" }}>
      <div className="lado" style={{ maxWidth: 760, margin: "0 auto", width: "100%" }}>
        <Link href={admin ? "/admin" : "/colaborador"} className="volver"><ArrowLeft /> Volver</Link>
        <Image src="/logo-surtigas.svg" alt="Surtigas" width={100} height={45} style={{ marginBottom: 26 }} />
        <h1 className="titulo-pagina">Ayuda e información</h1>
        <p className="sub">Sistema de Gestión Inteligente de Turnos y Recursos · prototipo del reto “Más allá del turno” (TLR 6). Todos los datos que ves son simulados.</p>

        <section className="seccion">
          <h2 className="titulo-seccion">Si eres colaborador</h2>
          <ul className="ink2" style={{ marginTop: 10, paddingLeft: 18, listStyle: "disc", display: "grid", gap: 6 }}>
            <li>En <b>Mi semana</b> ves tus turnos confirmados. Cada domingo a las 18:00 también te llegan por correo.</li>
            <li>Si no puedes ir, usa <b>Reportar ausencia</b>: elige si es excusa, permiso o incapacidad, las fechas y adjunta el soporte. La administración recibe el aviso al instante.</li>
            <li>En <b>Mis solicitudes</b> sigues el estado de cada reporte. Te avisamos por correo cuando lo aprueben o rechacen.</li>
          </ul>
        </section>
        <section className="seccion">
          <h2 className="titulo-seccion">Si administras turnos</h2>
          <ul className="ink2" style={{ marginTop: 10, paddingLeft: 18, listStyle: "disc", display: "grid", gap: 6 }}>
            <li><b>Propuesta del motor</b>: con el histórico de Digiturno, el motor calcula cuántas personas pide cada franja para atender al 80% de los usuarios en menos de 5 minutos (teoría de colas, Erlang C) y prueba la malla con una simulación de un día de atención. Te muestra dos mallas y tú confirmas.</li>
            <li><b>Recálculo</b>: al aprobar una ausencia, sus turnos quedan libres y el motor propone quién los cubre, respetando el tope legal de horas semanales, 12 horas de descanso y tus ajustes manuales.</li>
            <li><b>Apoyos entre oficinas</b>: si una sede está sobrecargada y otra cercana tiene capacidad, el motor sugiere mover a alguien en persona o atender turnos digitales de forma virtual.</li>
            <li>Cualquier turno que edites a mano queda como <b>ajuste manual</b> y el motor no lo mueve.</li>
          </ul>
        </section>
        <section className="seccion">
          <h2 className="titulo-seccion">Sobre el prototipo</h2>
          <p className="ink2" style={{ marginTop: 10 }}>Construido con Next.js, Auth.js, Prisma sobre Neon (PostgreSQL), Resend y Vercel Cron, como lo especifica el ERS v1.0. Universidad de la Costa (CUC) · Retos CUC con Surtigas.</p>
        </section>
      </div>
    </div>
  );
}
