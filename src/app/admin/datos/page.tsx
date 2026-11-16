import { Database, ShieldCheck } from "lucide-react";
import { BarraAdmin } from "@/components/shell/barra-admin";
import { Estado } from "@/components/ui";
import { db } from "@/lib/db";
import { aISO, fmtDiaMes, fmtMomento } from "@/lib/fechas";
import { simulacionActiva } from "@/lib/servicios/simulacion";
import { cambiarSimulacion } from "./acciones";
import { Importador } from "./importador";

export const metadata = { title: "Datos Digiturno" };

export default async function PaginaDatos() {
  const [porFuente, oficinas, importaciones, activa] = await Promise.all([
    db.demandaHora.groupBy({ by: ["fuente"], _sum: { llegadas: true }, _min: { fecha: true }, _max: { fecha: true }, _count: true }),
    db.oficina.findMany({ where: { activa: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, ciudad: true, zona: true, codigoDigiturno: true } }),
    db.importacion.findMany({ orderBy: { creadoEn: "desc" }, take: 5 }),
    simulacionActiva(),
  ]);
  return (
    <main className="principal">
      <BarraAdmin />
      <h1 className="titulo-pagina">Datos Digiturno</h1>
      <p className="sub">El motor estima la demanda por franja con este histórico. Cambiar la fuente no cambia el resto del sistema.</p>

      <div className="kpis" style={{ gridTemplateColumns: `repeat(${Math.max(1, porFuente.length)}, 1fr)` }}>
        {porFuente.map((f) => (
          <div key={f.fuente} className="kpi">
            <span className="icono-circulo"><Database /></span>
            <div>
              <div className="k-label">{f.fuente === "digiturno" ? "Histórico de Digiturno" : "Histórico simulado"}</div>
              <div className="k-valor">{(f._sum.llegadas ?? 0).toLocaleString("es-CO")} <span className="k-extra">turnos · {fmtDiaMes(aISO(f._min.fecha!))} a {fmtDiaMes(aISO(f._max.fecha!))}</span></div>
            </div>
          </div>
        ))}
        {porFuente.length === 0 && <div className="kpi">Todavía no hay histórico cargado.</div>}
      </div>

      <section className="seccion">
        <h2 className="titulo-seccion" style={{ marginBottom: 12 }}>Importar el export de Digiturno</h2>
        <Importador oficinas={oficinas} />
        <p className="ink2" style={{ display: "flex", gap: 8, marginTop: 14, fontSize: 12.5 }}>
          <ShieldCheck size={16} style={{ flex: "none" }} /> El archivo se procesa en tu navegador. A la base de datos solo llegan totales por oficina, día, hora, fila y servicio; nunca nombres de operadores ni datos de clientes.
        </p>
      </section>

      {importaciones.length > 0 && (
        <section className="seccion">
          <h2 className="titulo-seccion" style={{ marginBottom: 6 }}>Importaciones</h2>
          <div className="lista-filas">
            {importaciones.map((i) => (
              <div key={i.id} className="fila">
                <span style={{ flex: 1 }}><b style={{ fontWeight: 500 }}>{i.archivo}</b> <span className="ink2">· {i.filas.toLocaleString("es-CO")} turnos · {i.oficinas} oficinas · {fmtDiaMes(aISO(i.desde))} a {fmtDiaMes(aISO(i.hasta))}</span></span>
                <span className="muted">{fmtMomento(i.creadoEn)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="seccion">
        <h2 className="titulo-seccion" style={{ marginBottom: 8 }}>Simulación del prototipo</h2>
        <div className="fila" style={{ borderTop: "1px solid var(--line)" }}>
          <div style={{ flex: 1 }}>
            <Estado punto={activa ? "lima" : ""}>{activa ? "Activa" : "Apagada"}</Estado>
            <p className="ink2" style={{ fontSize: 12.5, marginTop: 4 }}>Mientras está activa, cada día se completa la demanda simulada hasta la hora actual y se arma la malla de la semana si falta.</p>
          </div>
          <form action={cambiarSimulacion.bind(null, !activa)}>
            <button className="btn btn-secundario btn-sm">{activa ? "Apagar" : "Encender"}</button>
          </form>
        </div>
      </section>
    </main>
  );
}
