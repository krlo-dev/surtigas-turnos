import { ArrowRight, Bus, Monitor } from "lucide-react";
import Link from "next/link";
import { BarraAdmin as BarraSuperiorAdmin } from "@/components/shell/barra-admin";
import { Avatar, BarraUso, colorUso } from "@/components/ui";
import { db } from "@/lib/db";
import { coberturaPorHora, horasDelDia, metricasDia } from "@/lib/engine/oficinas";
import { aFecha, aISO, DIAS_CORTOS, diaSemana, fmtRangoFechas, fmtRangoHoras, hoyISO, partes, sumarDias } from "@/lib/fechas";
import { contextoSemana } from "@/lib/servicios/contexto";
import { sugerenciasApoyo, ventanaApoyos } from "@/lib/servicios/malla";
import { decidirApoyo } from "./acciones";

export const metadata = { title: "Apoyos entre oficinas" };

export default async function PaginaApoyos({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const { vista: v } = await searchParams;
  const vista = v === "semana" ? "semana" : "hoy";
  const hoy = hoyISO();
  const { lunes, dias, proxima } = ventanaApoyos(vista);
  const [sugerencias, ctx, aplicados] = await Promise.all([
    sugerenciasApoyo(vista),
    contextoSemana(lunes),
    db.apoyo.findMany({ where: { estado: "APLICADO", fecha: { gte: aFecha(dias[0]), lte: aFecha(dias[dias.length - 1]) } }, include: { usuario: true, desdeOficina: true, haciaOficina: true }, orderBy: [{ fecha: "asc" }, { horaInicio: "asc" }] }),
  ]);
  const nombre = (id: string) => ctx.oficinas.find((o) => o.id === id)?.nombre ?? "";
  const diaTexto = (f: string) => (f === hoy ? "Hoy" : `${DIAS_CORTOS[diaSemana(f)]} ${partes(f).dia}`);

  // Uso de cada oficina: hoy, o promedio de los días que quedan de la semana (o de la próxima, si es domingo)
  const textoSemana = proxima ? `la próxima semana (${fmtRangoFechas(lunes, sumarDias(lunes, 6))})` : "lo que queda de la semana";
  const usos = ctx.oficinas.map((o) => {
    const vals = dias
      .filter((d) => horasDelDia(o, d).length)
      .map((d) => metricasDia(o, ctx.demanda[o.id], d, coberturaPorHora(ctx.turnos, o.id, d), ctx.parametros).uso);
    return { o, uso: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0, abierta: vals.length > 0 };
  });
  const zonas = [...new Set(ctx.oficinas.map((o) => o.zona))];
  const sobrecargadas = usos.filter((u) => u.abierta && u.uso > 1);

  return (
    <main className="principal">
      <BarraSuperiorAdmin />
      <div className="encabezado">
        <div>
          <h1 className="titulo-pagina">Apoyos entre oficinas</h1>
          <p className="sub">Mueve personas de donde sobra capacidad a donde se acumula la fila, en persona o de forma virtual.</p>
        </div>
        <div className="segmentado">
          <Link href="/admin/apoyos?vista=hoy" className={vista === "hoy" ? "activo" : ""}>Hoy</Link>
          <Link href="/admin/apoyos?vista=semana" className={vista === "semana" ? "activo" : ""}>Semana</Link>
        </div>
      </div>

      <section className="seccion">
        <h2 className="titulo-seccion" style={{ marginBottom: 6 }}>Sugerencias del motor{vista === "semana" && proxima ? ` · semana del ${fmtRangoFechas(lunes, sumarDias(lunes, 6))}` : ""}</h2>
        {sugerencias.length === 0 &&
          (sobrecargadas.length > 0 ? (
            <div className="aviso alerta" style={{ margin: "14px 0" }}>
              <span>
                <b>{sobrecargadas.length} {sobrecargadas.length === 1 ? "oficina está sobrecargada" : "oficinas están sobrecargadas"}</b>{" "}
                {vista === "hoy" ? "hoy" : `en ${textoSemana}`}, pero ninguna tiene gente de sobra para prestar (todas están por encima del 60% de uso).
                Mover a alguien solo pasaría la fila de una oficina a otra. Hace falta más personal en turno: revisa la propuesta del motor o agrega turnos a mano.
              </span>
            </div>
          ) : (
            <p className="muted" style={{ padding: "14px 0" }}>Ninguna oficina necesita apoyo {vista === "hoy" ? "en lo que queda del día" : `en ${textoSemana}`}.</p>
          ))}
        <div className="lista-filas" style={{ marginTop: 8 }}>
          {sugerencias.map((s) => (
            <div key={`${s.usuarioId}-${s.fecha}-${s.inicio}`} className="fila" style={{ padding: "18px 0", flexWrap: "wrap" }}>
              <div className="persona" style={{ flex: "1 1 200px" }}>
                <Avatar nombre={s.nombre} />
                <div>
                  <div className="nombre">{s.nombre}</div>
                  <div className="linea">{diaTexto(s.fecha)} · {fmtRangoHoras(s.inicio, s.fin)}</div>
                </div>
              </div>
              <div style={{ flex: "1 1 260px", display: "flex", alignItems: "center", gap: 14 }}>
                <div>
                  <div className="muted" style={{ fontSize: 12 }}>Desde</div>
                  <div style={{ fontWeight: 500 }}>{nombre(s.desdeOficinaId)} · <span className="ink2" style={{ fontWeight: 400 }}>{Math.round(s.usoDesde * 100)}%</span></div>
                </div>
                <ArrowRight size={16} color="var(--ink-2)" />
                <div>
                  <div className="muted" style={{ fontSize: 12 }}>Hacia</div>
                  <div style={{ fontWeight: 500 }}>{nombre(s.haciaOficinaId)} · <span className="texto-rojo" style={{ fontWeight: 400 }}>{Math.round(s.usoHacia * 100)}%</span></div>
                </div>
              </div>
              <div style={{ flex: "1 1 220px" }}>
                {s.modalidad === "PRESENCIAL" ? (
                  <span className="chip chip-azul"><Bus /> En persona{s.minutosViaje ? ` · ${s.minutosViaje} min` : ""}</span>
                ) : (
                  <span className="chip chip-lima"><Monitor /> Virtual</span>
                )}
                <div className="ink2" style={{ fontSize: 12.5, marginTop: 6 }}>{s.razon}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <form action={decidirApoyo.bind(null, s, false)}>
                  <button className="btn btn-quieto btn-sm">Descartar</button>
                </form>
                <form action={decidirApoyo.bind(null, s, true)}>
                  <button className="btn btn-primario btn-sm">Aplicar</button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </section>

      {aplicados.length > 0 && (
        <section className="seccion">
          <h2 className="titulo-seccion" style={{ marginBottom: 6 }}>Apoyos aplicados</h2>
          <div className="lista-filas">
            {aplicados.map((a) => (
              <div key={a.id} className="fila">
                <Avatar nombre={a.usuario.nombre} tam="sm" />
                <div style={{ flex: 1 }}>
                  <b style={{ fontWeight: 500 }}>{a.usuario.nombre}</b> <span className="ink2">· {diaTexto(aISO(a.fecha))} · {fmtRangoHoras(a.horaInicio, a.horaFin)} · {a.desdeOficina.nombre} → {a.haciaOficina.nombre}</span>
                </div>
                <span className={`chip ${a.modalidad === "VIRTUAL" ? "chip-lima" : "chip-azul"}`}>{a.modalidad === "VIRTUAL" ? "Virtual" : "En persona"}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="seccion" style={{ marginTop: 40 }}>
        <div className="encabezado" style={{ alignItems: "center", marginBottom: 18 }}>
          <h2 className="titulo-seccion">Uso de cada oficina {vista === "hoy" ? "hoy" : proxima ? `la próxima semana (${fmtRangoFechas(lunes, sumarDias(lunes, 6))})` : "esta semana"}</h2>
          <div className="leyenda" style={{ marginTop: 0 }}>
            <span className="item"><span className="muestra" style={{ background: "var(--red)" }} /> &gt; 100%</span>
            <span className="item"><span className="muestra" style={{ background: "var(--lime-line)" }} /> Óptima</span>
            <span className="item"><span className="muestra" style={{ background: "var(--blue-200)" }} /> &lt; 60% · puede prestar</span>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${zonas.length}, minmax(0,1fr))`, gap: 32 }} className="apilar-movil">
          {zonas.map((z) => (
            <div key={z}>
              <div style={{ fontWeight: 600, marginBottom: 12 }}>{z}</div>
              {usos
                .filter((u) => u.o.zona === z)
                .map((u) => (
                  <div key={u.o.id} style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6 }}>
                      <span className="ink2">{u.o.nombre}</span>
                      <b style={{ fontWeight: 500 }}>{u.abierta ? `${Math.round(u.uso * 100)}%` : "Cerrada"}</b>
                    </div>
                    <BarraUso valor={Math.min(1, u.uso)} color={colorUso(u.uso)} />
                  </div>
                ))}
            </div>
          ))}
        </div>
        <p className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>Uso = personas que pide la fila según Erlang C / personas en turno. 100% es justo lo necesario para el nivel de servicio objetivo.</p>
      </section>
    </main>
  );
}
