import {
  ArrowRight,
  CircleCheck,
  CircleX,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { BarraAdmin } from "@/components/shell/barra-admin";
import { Avatar } from "@/components/ui";
import { db } from "@/lib/db";
import type { CoberturaPropuesta, ImpactoDia } from "@/lib/engine/tipos";
import {
  DIAS_CORTOS,
  DIAS_LARGOS,
  diaSemana,
  fmtDuracion,
  fmtRangoHoras,
  hoyISO,
  lunesDe,
  partes,
  MESES_CORTOS,
  fmtMomento,
} from "@/lib/fechas";
import { NOMBRE_TIPO } from "@/components/ui";
import { PestanasMalla } from "../pestanas";
import { AccionesRecalculo } from "./aplicar";
import { aplicarRecalculoForm, volverACalcularRecalculo } from "../acciones";

export const metadata = { title: "Recálculo de cobertura" };

interface ResultadoRecalculo {
  coberturas: CoberturaPropuesta[];
  impacto: ImpactoDia[];
  verificaciones: { texto: string; ok: boolean }[];
  explicacion: string;
  persona: string;
}

export default async function PaginaRecalculo({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; aplicado?: string }>;
}) {
  const sp = await searchParams;
  const pendientes = await db.corrida.findMany({
    where: { tipo: "RECALCULO", estado: "BORRADOR" },
    orderBy: { creadoEn: "desc" },
    include: { excusa: true },
  });
  const corrida = pendientes.find((c) => c.id === sp.id) ?? pendientes[0];
  const oficinas = new Map((await db.oficina.findMany()).map((o) => [o.id, o]));

  if (!corrida) {
    const aplicados = await db.corrida.findMany({
      where: { tipo: "RECALCULO", estado: "CONFIRMADA" },
      orderBy: { creadoEn: "desc" },
      take: 5,
      include: { excusa: { include: { usuario: true } } },
    });
    return (
      <main className="principal">
        <BarraAdmin />
        <PestanasMalla activa="recalculo" />
        {sp.aplicado && (
          <div className="aviso ok" style={{ marginBottom: 14 }}>
            Cobertura aplicada. La malla vigente ya tiene los turnos nuevos.
          </div>
        )}
        <h1 className="titulo-pagina" style={{ marginTop: 10 }}>
          No hay recálculos por aplicar
        </h1>
        <p className="sub">
          Cuando apruebes una ausencia que libera turnos, el motor propone aquí
          quién los cubre.
        </p>
        {aplicados.length > 0 && (
          <section className="seccion">
            <h2 className="titulo-seccion" style={{ marginBottom: 8 }}>
              Aplicados recientemente
            </h2>
            <div className="lista-filas">
              {aplicados.map((a) => (
                <div key={a.id} className="fila">
                  <span className="icono-circulo lima sm">
                    <RefreshCw />
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500 }}>
                      Corrida #{a.numero} ·{" "}
                      {a.excusa
                        ? `ausencia de ${a.excusa.usuario.nombre}`
                        : "recálculo"}
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {a.excusa ? `EX-${a.excusa.codigo}` : ""} ·{" "}
                      {fmtMomento(a.creadoEn)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    );
  }

  const r = corrida.resultado as unknown as ResultadoRecalculo;
  const liberadosN = new Set(r.coberturas.map((c) => c.liberado.turnoId)).size;
  const nombreCorto = r.persona.split(" ")[0];
  const cubiertos = r.coberturas.filter((c) => c.candidato);
  const avisar = [
    ...new Set(cubiertos.map((c) => c.candidato!.nombre.split(" ")[0])),
  ];
  const impacto = [...r.impacto].sort(
    (a, b) => a.servicioSin - b.servicioSin,
  )[0];
  const primera = r.coberturas[0]?.liberado;

  return (
    <main className="principal">
      <BarraAdmin />
      <PestanasMalla activa="recalculo" />
      {pendientes.length > 1 && (
        <div className="segmentado" style={{ marginBottom: 14 }}>
          {pendientes.map((p) => (
            <Link
              key={p.id}
              href={`/admin/malla/recalculo?id=${p.id}`}
              className={p.id === corrida.id ? "activo" : ""}
            >
              #{p.numero} {p.excusa ? `· EX-${p.excusa.codigo}` : ""}
            </Link>
          ))}
        </div>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) 300px",
          gap: 40,
          marginTop: 10,
        }}
        className="apilar-movil"
      >
        <div style={{ minWidth: 0 }}>
          <form
            id="form-aplicar"
            action={aplicarRecalculoForm.bind(null, corrida.id)}
          />
          <form
            id="form-recalcular"
            action={volverACalcularRecalculo.bind(null, corrida.id)}
          />
          <div className="encabezado">
            <div>
              <h1 className="titulo-pagina">
                Cobertura para la ausencia de {nombreCorto}
              </h1>
              <p className="sub">
                Se aprobó{" "}
                <span className="codigo">EX-{corrida.excusa?.codigo}</span>
                {corrida.excusa
                  ? ` (${NOMBRE_TIPO[corrida.excusa.tipo].toLowerCase()})`
                  : ""}{" "}
                · el motor liberó {liberadosN}{" "}
                {liberadosN === 1 ? "turno" : "turnos"} y propone quién{" "}
                {liberadosN === 1 ? "lo cubre" : "los cubre"}
              </p>
            </div>
          </div>

          <div className="lista-filas" style={{ marginTop: 34 }}>
            {r.coberturas.map((c) => {
              const l = c.liberado;
              const { dia, mes } = partes(l.fecha);
              return (
                <div
                  key={`${l.turnoId}-${l.inicio}`}
                  className="fila"
                  style={{ padding: "20px 0", gap: 18 }}
                >
                  <div style={{ width: 110 }}>
                    <div style={{ fontWeight: 600 }}>
                      {DIAS_CORTOS[diaSemana(l.fecha)]} {dia}{" "}
                      {MESES_CORTOS[mes]}
                    </div>
                    <div className="ink2" style={{ fontSize: 12.5 }}>
                      {fmtRangoHoras(l.inicio, l.fin)}
                    </div>
                  </div>
                  <div
                    className="bloque liberado"
                    style={{
                      cursor: "default",
                      flex: 1,
                      minHeight: 0,
                      maxWidth: 200,
                    }}
                  >
                    <span className="barra-estado" />
                    <span>
                      <span
                        className="hora"
                        style={{ display: "block", fontSize: 11.5 }}
                      >
                        {l.nombre}
                      </span>
                      <span className="sub-linea">
                        {corrida.excusa
                          ? NOMBRE_TIPO[corrida.excusa.tipo]
                          : "Ausencia"}{" "}
                        · {oficinas.get(l.oficinaId)?.nombre}
                      </span>
                    </span>
                  </div>
                  <ArrowRight size={18} color="var(--ink-2)" />
                  {c.candidato ? (
                    <div
                      className="bloque movido"
                      style={{
                        cursor: "default",
                        flex: 2,
                        background: "var(--soft-2)",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 12px 8px 4px",
                      }}
                    >
                      <span
                        className="barra-estado"
                        style={{ alignSelf: "stretch" }}
                      />
                      <Avatar nombre={c.candidato.nombre} tam="sm" />
                      <span>
                        <span
                          className="hora"
                          style={{ display: "block", fontSize: 12 }}
                        >
                          {c.candidato.nombre}
                        </span>
                        <span
                          className="sub-linea"
                          style={{ color: "var(--ink-2)", fontWeight: 400 }}
                        >
                          {c.candidato.razon}
                        </span>
                      </span>
                    </div>
                  ) : (
                    <div className="aviso alerta" style={{ flex: 2 }}>
                      Nadie disponible para {fmtRangoHoras(l.inicio, l.fin)} sin romper las reglas. Libera a alguien en la malla y dale Volver a calcular, o ajusta a mano.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {r.explicacion && (
            <p
              className="ink2"
              style={{
                display: "flex",
                gap: 8,
                marginTop: 18,
                fontSize: 12.5,
                maxWidth: 520,
              }}
            >
              <Sparkles size={15} style={{ flex: "none", marginTop: 2 }} />{" "}
              {r.explicacion}
            </p>
          )}
          {avisar.length > 0 && (
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginTop: 26,
                fontSize: 13,
                color: "var(--ink-2)",
              }}
            >
              <input
                type="checkbox"
                className="toggle"
                name="avisar"
                form="form-aplicar"
                defaultChecked
              />
              Avisar por correo a{" "}
              {avisar.length > 1
                ? `${avisar.slice(0, -1).join(", ")} y a ${avisar[avisar.length - 1]}`
                : avisar[0]}{" "}
              al aplicar
            </label>
          )}
        </div>

        <aside>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: 34,
            }}
          >
            <AccionesRecalculo
              formId="form-aplicar"
              recalcularFormId="form-recalcular"
              habilitado={cubiertos.length > 0}
              ajustarHref={
                primera
                  ? `/admin/malla?semana=${lunesDe(primera.fecha)}&oficina=${primera.oficinaId}`
                  : "/admin/malla"
              }
            />
          </div>
          {impacto && (
            <div>
              <h2 className="titulo-seccion" style={{ marginBottom: 18 }}>
                Qué cambia el{" "}
                {DIAS_LARGOS[diaSemana(impacto.fecha)].toLowerCase()}
                {impacto.fecha === hoyISO() ? " (hoy)" : ""}
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <div>
                  <div className="ink2" style={{ fontSize: 12.5 }}>
                    Sin cobertura
                  </div>
                  <div
                    style={{
                      fontSize: 30,
                      fontWeight: 600,
                      color: "var(--red-ink)",
                      lineHeight: 1.3,
                    }}
                  >
                    {Math.round(impacto.servicioSin * 100)}%
                  </div>
                  <div className="ink2" style={{ fontSize: 12 }}>
                    espera {fmtDuracion(impacto.esperaSin)}
                  </div>
                </div>
                <ArrowRight size={18} color="var(--ink-2)" />
                <div>
                  <div className="ink2" style={{ fontSize: 12.5 }}>
                    Con cobertura
                  </div>
                  <div
                    style={{ fontSize: 30, fontWeight: 600, lineHeight: 1.3 }}
                  >
                    <span className="resaltado" style={{ padding: "0 6px" }}>
                      {Math.round(impacto.servicioCon * 100)}%
                    </span>
                  </div>
                  <div className="ink2" style={{ fontSize: 12 }}>
                    espera {fmtDuracion(impacto.esperaCon)}
                  </div>
                </div>
              </div>
              <p className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>
                Nivel de servicio estimado con Erlang C en{" "}
                {oficinas.get(impacto.oficinaId)?.nombre}.
              </p>
              <div
                style={{
                  height: 1,
                  background: "var(--line)",
                  margin: "22px 0 18px",
                }}
              />
              <div
                style={{ display: "flex", flexDirection: "column", gap: 14 }}
              >
                {r.verificaciones.map((v) => (
                  <div
                    key={v.texto}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                      fontSize: 12.5,
                      color: v.ok ? "var(--ink)" : "var(--red-ink)",
                    }}
                  >
                    {v.ok ? (
                      <CircleCheck size={16} color="var(--lime-line)" />
                    ) : (
                      <CircleX size={16} />
                    )}{" "}
                    {v.texto}
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
