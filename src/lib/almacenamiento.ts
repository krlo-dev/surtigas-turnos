// Almacenamiento de soportes (PDF o imagen) de las ausencias.
// En Vercel usa Vercel Blob privado: los archivos no tienen URL pública y solo se leen desde el servidor,
// a través de /api/soportes/[id], que exige sesión. Sin Blob (desarrollo local) guarda en la carpeta .soportes/.

import { get, put } from "@vercel/blob";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const TIPOS_SOPORTE = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
export const MAX_BYTES_SOPORTE = 4 * 1024 * 1024;

export interface AlmacenamientoArchivos {
  guardar(nombre: string, archivo: File): Promise<string>;
  leer(url: string): Promise<{ cuerpo: ArrayBuffer; tipo: string }>;
}

/** Id del store conectado. Vercel lo crea como BLOB_STORE_ID, o <PREFIJO>_STORE_ID si se usó un prefijo. */
function storeId(): string | undefined {
  if (process.env.BLOB_STORE_ID) return process.env.BLOB_STORE_ID;
  const clave = Object.keys(process.env).find((k) => k.startsWith("BLOB") && k.endsWith("_STORE_ID"));
  return clave ? process.env[clave] : undefined;
}

const acceso = (): "public" | "private" => (process.env.BLOB_ACCESS === "public" ? "public" : "private");

class BlobAlmacenamiento implements AlmacenamientoArchivos {
  async guardar(nombre: string, archivo: File) {
    const r = await put(`soportes/${nombre}`, archivo, {
      access: acceso(),
      addRandomSuffix: true,
      contentType: archivo.type,
      storeId: storeId(),
    });
    return r.url;
  }
  async leer(url: string) {
    const r = await get(url, { access: url.includes(".public.blob.") ? "public" : "private", storeId: storeId() });
    if (!r || r.statusCode !== 200) throw new Error("No se pudo leer el soporte");
    return { cuerpo: await new Response(r.stream).arrayBuffer(), tipo: r.blob.contentType || "application/octet-stream" };
  }
}

const CARPETA = path.join(process.cwd(), ".soportes");

class LocalAlmacenamiento implements AlmacenamientoArchivos {
  async guardar(nombre: string, archivo: File) {
    await mkdir(CARPETA, { recursive: true });
    const seguro = `${Date.now()}-${nombre.replace(/[^\w.-]+/g, "_")}`;
    await writeFile(path.join(CARPETA, seguro), Buffer.from(await archivo.arrayBuffer()));
    return `local:${seguro}|${archivo.type}`;
  }
  async leer(url: string) {
    const [archivo, tipo] = url.replace(/^local:/, "").split("|");
    const buf = await readFile(path.join(CARPETA, path.basename(archivo)));
    return { cuerpo: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, tipo: tipo || "application/octet-stream" };
  }
}

export function obtenerAlmacenamiento(url?: string | null): AlmacenamientoArchivos {
  if (url?.startsWith("local:")) return new LocalAlmacenamiento();
  if (url) return new BlobAlmacenamiento();
  // En Vercel siempre Blob (el disco de las funciones es de solo lectura); en local, solo si hay credenciales.
  const hayBlob = Boolean(process.env.VERCEL || process.env.BLOB_READ_WRITE_TOKEN || storeId());
  return hayBlob ? new BlobAlmacenamiento() : new LocalAlmacenamiento();
}
