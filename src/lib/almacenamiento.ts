// Almacenamiento de soportes (PDF o imagen) de las ausencias. En Vercel usa Vercel Blob;
// sin BLOB_READ_WRITE_TOKEN (desarrollo) guarda en la carpeta local .soportes/.

import { put } from "@vercel/blob";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const TIPOS_SOPORTE = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
export const MAX_BYTES_SOPORTE = 4 * 1024 * 1024;

export interface AlmacenamientoArchivos {
  guardar(nombre: string, archivo: File): Promise<string>;
  leer(url: string): Promise<{ cuerpo: ArrayBuffer; tipo: string }>;
}

class BlobAlmacenamiento implements AlmacenamientoArchivos {
  async guardar(nombre: string, archivo: File) {
    const r = await put(`soportes/${nombre}`, archivo, { access: "public", addRandomSuffix: true, contentType: archivo.type });
    return r.url;
  }
  async leer(url: string) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("No se pudo leer el soporte");
    return { cuerpo: await res.arrayBuffer(), tipo: res.headers.get("content-type") ?? "application/octet-stream" };
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
  return process.env.BLOB_READ_WRITE_TOKEN ? new BlobAlmacenamiento() : new LocalAlmacenamiento();
}
