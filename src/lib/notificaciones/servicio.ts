// NotificationService (ERS 4.5): una sola abstracción para el envío programado y el transaccional.
// Las rutas dependen de esta interfaz; Resend es solo una implementación (principio de sustitución de Liskov).

import type { TipoNotificacion } from "@prisma/client";
import { Resend } from "resend";
import { db } from "../db";

export interface MensajeCorreo {
  tipo: TipoNotificacion;
  para: { correo: string; nombre: string; usuarioId?: string | null };
  asunto: string;
  html: string;
  texto: string;
  referencia?: string;
  semana?: number;
}

export interface ResultadoEnvio {
  ok: boolean;
  enviadoA: string;
  proveedorId?: string;
  error?: string;
}

export interface NotificationService {
  enviar(mensaje: MensajeCorreo): Promise<ResultadoEnvio>;
}

/** Redirección de demo: si CORREO_REDIRECCION está definido, todo llega a ese buzón. */
function destinoReal(correo: string) {
  return process.env.CORREO_REDIRECCION?.trim() || correo;
}

function avisoRedireccion(m: MensajeCorreo, enviadoA: string) {
  if (enviadoA === m.para.correo) return m.html;
  const aviso = `<div style="font-family:Arial,sans-serif;font-size:12px;color:#4B5563;background:#F4F5F7;border-radius:10px;padding:10px 14px;margin:0 0 16px">Prototipo · este correo iba para <b>${m.para.nombre}</b> (${m.para.correo}) y se redirigió a este buzón de demostración.</div>`;
  return aviso + m.html;
}

export class ResendNotificationService implements NotificationService {
  private cliente: Resend;
  constructor(apiKey: string, private remitente: string) {
    this.cliente = new Resend(apiKey);
  }
  async enviar(m: MensajeCorreo): Promise<ResultadoEnvio> {
    const enviadoA = destinoReal(m.para.correo);
    try {
      const { data, error } = await this.cliente.emails.send({
        from: this.remitente,
        to: enviadoA,
        subject: m.asunto,
        html: avisoRedireccion(m, enviadoA),
        text: m.texto,
      });
      if (error) return { ok: false, enviadoA, error: error.message };
      return { ok: true, enviadoA, proveedorId: data?.id };
    } catch (e) {
      return { ok: false, enviadoA, error: e instanceof Error ? e.message : "Error desconocido" };
    }
  }
}

/** Implementación para desarrollo sin llave de Resend: escribe el correo en la consola. */
export class ConsolaNotificationService implements NotificationService {
  async enviar(m: MensajeCorreo): Promise<ResultadoEnvio> {
    const enviadoA = destinoReal(m.para.correo);
    console.info(`[correo] ${m.tipo} → ${enviadoA} · ${m.asunto}\n${m.texto}`);
    return { ok: true, enviadoA, proveedorId: "consola" };
  }
}

/** Decorador que deja registro de cada envío en la tabla Notificacion (bitácora de la pantalla Correos). */
export class NotificadorRegistrado implements NotificationService {
  constructor(private interno: NotificationService) {}
  async enviar(m: MensajeCorreo): Promise<ResultadoEnvio> {
    const r = await this.interno.enviar(m);
    await db.notificacion.create({
      data: {
        tipo: m.tipo,
        destinatarioId: m.para.usuarioId ?? null,
        correoDestino: m.para.correo,
        enviadoA: r.enviadoA,
        asunto: m.asunto,
        estado: r.ok ? "ENVIADO" : "ERROR",
        error: r.error ?? null,
        proveedorId: r.proveedorId ?? null,
        referencia: m.referencia ?? null,
        semana: m.semana ?? null,
      },
    });
    return r;
  }
}

let instancia: NotificationService | null = null;

export function obtenerNotificador(): NotificationService {
  if (instancia) return instancia;
  const key = process.env.RESEND_API_KEY?.trim();
  const remitente = process.env.CORREO_REMITENTE?.trim() || "Surtigas Turnos <onboarding@resend.dev>";
  instancia = new NotificadorRegistrado(key ? new ResendNotificationService(key, remitente) : new ConsolaNotificationService());
  return instancia;
}
