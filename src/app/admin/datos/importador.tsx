"use client";

import { FileUp, Upload } from "lucide-react";
import Papa from "papaparse";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AgregadorDigiturno, type ResumenDigiturno } from "@/lib/datos/digiturno";

type Oficina = { id: string; nombre: string; ciudad: string; zona: string; codigoDigiturno: number | null };
type Mapeo = { codigo: number; oficinaId: string | null; nombre: string; ciudad: string; zona: string; puestos: number };

const quitar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

async function detectarCodificacion(archivo: File) {
  const buf = await archivo.slice(0, 256 * 1024).arrayBuffer();
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buf);
    return "utf-8";
  } catch {
    return "windows-1252";
  }
}

export function Importador({ oficinas }: { oficinas: Oficina[] }) {
  const router = useRouter();
  const archivoRef = useRef<File | null>(null);
  const [estado, setEstado] = useState<"inicio" | "leyendo" | "revisar" | "subiendo" | "listo">("inicio");
  const [progreso, setProgreso] = useState(0);
  const [resumen, setResumen] = useState<ResumenDigiturno | null>(null);
  const [mapeo, setMapeo] = useState<Mapeo[]>([]);
  const [reemplazar, setReemplazar] = useState(true);
  const [crearEquipo, setCrearEquipo] = useState(true);
  const [creados, setCreados] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const leer = async (archivo: File) => {
    archivoRef.current = archivo;
    setError(null);
    setEstado("leyendo");
    setProgreso(0);
    const ag = new AgregadorDigiturno();
    const encoding = await detectarCodificacion(archivo);
    let faltantes: string[] = [];
    Papa.parse<string[]>(archivo, {
      encoding,
      skipEmptyLines: true,
      chunkSize: 1024 * 1024 * 2,
      chunk: (r, parser) => {
        for (const fila of r.data) {
          if (!ag.encabezadoListo) {
            faltantes = ag.encabezado(fila);
            if (faltantes.length) {
              parser.abort();
              return;
            }
            continue;
          }
          ag.fila(fila);
        }
        setProgreso(Math.min(99, Math.round(((r.meta.cursor ?? 0) / archivo.size) * 100)));
      },
      complete: () => {
        if (faltantes.length) {
          setError(`El archivo no tiene las columnas esperadas de Digiturno: ${faltantes.join(", ")}.`);
          setEstado("inicio");
          return;
        }
        const res = ag.resumen();
        if (!res.registros) {
          setError("No se encontraron turnos en el archivo.");
          setEstado("inicio");
          return;
        }
        setResumen(res);
        setMapeo(
          res.oficinas.map((o) => {
            const porCodigo = oficinas.find((x) => x.codigoDigiturno === o.codigo);
            const porNombre = oficinas.find((x) => quitar(x.nombre).includes(quitar(o.nombre)) || quitar(o.nombre).includes(quitar(x.nombre)) || quitar(x.ciudad) === quitar(o.ciudad));
            return { codigo: o.codigo, oficinaId: (porCodigo ?? porNombre)?.id ?? null, nombre: o.nombre, ciudad: o.ciudad, zona: o.departamento, puestos: Math.max(1, o.terminales) };
          }),
        );
        setEstado("revisar");
      },
      error: (e) => {
        setError(e.message);
        setEstado("inicio");
      },
    });
  };

  const enviar = async (cuerpo: object) => {
    const r = await fetch("/api/importar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `Error ${r.status}`);
    return r.json();
  };

  const importar = async () => {
    if (!resumen) return;
    setEstado("subiendo");
    setProgreso(0);
    try {
      await enviar({ paso: "inicio", desde: resumen.desde, hasta: resumen.hasta, mapeo, reemplazarSimulado: reemplazar });
      const L = 3000;
      const total = Math.max(resumen.demanda.length, resumen.operacion.length);
      for (let i = 0; i < total; i += L) {
        await enviar({ paso: "lote", demanda: resumen.demanda.slice(i, i + L), operacion: resumen.operacion.slice(i, i + L) });
        setProgreso(Math.round(((i + L) / total) * 100));
      }
      if (crearEquipo && resumen.operadores.length) {
        let n = 0;
        for (let i = 0; i < resumen.operadores.length; i += 100) {
          const r = await enviar({ paso: "equipo", operadores: resumen.operadores.slice(i, i + 100) });
          n += r.creados ?? 0;
        }
        setCreados(n);
      } else setCreados(null);
      await enviar({ paso: "fin", archivo: archivoRef.current?.name ?? "digiturno.csv", registros: resumen.registros, desde: resumen.desde, hasta: resumen.hasta, oficinas: resumen.oficinas.length });
      setEstado("listo");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo importar.");
      setEstado("revisar");
    }
  };

  return (
    <div>
      {(estado === "inicio" || estado === "listo") && (
        <label className="zona-subida" style={{ padding: 22 }}>
          <span className="icono-circulo azul"><FileUp /></span>
          <span style={{ flex: 1 }}>
            <b style={{ color: "var(--ink)", fontWeight: 600, display: "block" }}>
              {estado === "listo" ? `Importación terminada${creados ? `, con ${creados} ${creados === 1 ? "persona nueva" : "personas nuevas"} en Equipo` : ""}. ¿Otro archivo?` : "Elige el export de turnos de Digiturno"}
            </b>
            CSV separado por punto y coma o tabulador, con las columnas IdOficina, NombreOficina, Estado, TiempoInicioEspera, TiempoEspera, TiempoAtencion…
          </span>
          <input type="file" accept=".csv,.txt,.tsv" hidden onChange={(e) => e.target.files?.[0] && leer(e.target.files[0])} />
        </label>
      )}
      {(estado === "leyendo" || estado === "subiendo") && (
        <div style={{ padding: "18px 0" }}>
          <div style={{ fontWeight: 500, marginBottom: 8 }}>{estado === "leyendo" ? "Leyendo y agregando en tu navegador…" : "Guardando el histórico agregado…"} {progreso}%</div>
          <div className="barra-uso"><span style={{ width: `${progreso}%`, background: "var(--blue)" }} /></div>
        </div>
      )}
      {error && <div className="aviso error" style={{ marginTop: 12 }}>{error}</div>}
      {estado === "revisar" && resumen && (
        <div style={{ marginTop: 6 }}>
          <div className="aviso ok" style={{ marginBottom: 18 }}>
            <span>
              <b>{resumen.registros.toLocaleString("es-CO")} turnos</b> del {resumen.desde} al {resumen.hasta} en {resumen.oficinas.length} oficinas
              {resumen.descartados ? ` · ${resumen.descartados} registros sin fecha u oficina se omitieron` : ""}. Servicios: {resumen.servicios.join(", ")}. Se guardan conteos por hora; las cédulas, teléfonos y datos de clientes no salen de tu equipo.
            </span>
          </div>
          <h3 className="titulo-item" style={{ marginBottom: 8 }}>¿A qué oficina corresponde cada sede de Digiturno?</h3>
          <table className="tabla">
            <thead>
              <tr><th>En Digiturno</th><th>Registros</th><th>Terminales</th><th>Oficina en la app</th></tr>
            </thead>
            <tbody>
              {mapeo.map((m, i) => {
                const o = resumen.oficinas[i];
                return (
                  <tr key={m.codigo}>
                    <td><b style={{ fontWeight: 500 }}>{o.nombre}</b> <span className="muted">· Id {m.codigo} · {o.ciudad}</span></td>
                    <td className="ink2">{o.registros.toLocaleString("es-CO")}</td>
                    <td className="ink2">{o.terminales}</td>
                    <td>
                      <select className="select-pill" value={m.oficinaId ?? ""} onChange={(e) => setMapeo(mapeo.map((x, j) => (j === i ? { ...x, oficinaId: e.target.value || null } : x)))}>
                        <option value="">Crear oficina nueva “{o.nombre}”</option>
                        {oficinas.map((x) => (
                          <option key={x.id} value={x.id}>{x.nombre}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <label className="check" style={{ marginTop: 16 }}>
            <input type="checkbox" checked={reemplazar} onChange={(e) => setReemplazar(e.target.checked)} /> Reemplazar el histórico simulado y apagar la simulación diaria
          </label>
          {resumen.operadores.length > 0 && (
            <label className="check" style={{ marginTop: 10, alignItems: "flex-start" }}>
              <input type="checkbox" checked={crearEquipo} onChange={(e) => setCrearEquipo(e.target.checked)} style={{ marginTop: 3 }} />
              <span>
                Crear el equipo con los {resumen.operadores.length} operadores del archivo. Solo se guarda el nombre y la oficina donde más atendió; los que ya
                existan en Equipo se omiten.
              </span>
            </label>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button className="btn btn-quieto" onClick={() => setEstado("inicio")}>Cancelar</button>
            <button className="btn btn-primario" onClick={importar}><Upload /> Importar histórico</button>
          </div>
        </div>
      )}
    </div>
  );
}
