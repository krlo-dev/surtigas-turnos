"use client";

import { ArrowLeft, LockKeyhole, Mail, MailCheck } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { cambiarContrasena, pedirEnlace } from "@/app/acciones/acceso";

function fuerza(c: string) {
  let n = 0;
  if (c.length >= 8) n++;
  if (/[A-Z]/.test(c) && /[a-z]/.test(c)) n++;
  if (/\d/.test(c)) n++;
  if (/[^A-Za-z0-9]/.test(c) || c.length >= 12) n++;
  return n;
}

export function FormularioRecuperar({ token }: { token: string | null }) {
  const [pedido, pedir, pidiendo] = useActionState(pedirEnlace, undefined);
  const [cambio, cambiar, cambiando] = useActionState(cambiarContrasena, undefined);
  const [clave, setClave] = useState("");
  const f = fuerza(clave);
  return (
    <div>
      <Link href="/entrar" className="volver">
        <ArrowLeft /> Volver a entrar
      </Link>
      <h1 className="titulo-pagina" style={{ fontSize: 28 }}>Recupera tu acceso</h1>
      <p className="sub" style={{ marginBottom: 30 }}>Te enviamos un enlace para crear una contraseña nueva.</p>
      <form action={pedir}>
        <div className="campo" style={{ marginBottom: 16 }}>
          <label htmlFor="correo">Correo</label>
          <div className="control">
            <Mail />
            <input id="correo" name="correo" type="email" required className="input" defaultValue={pedido?.correo} placeholder="nombre@surtigas.co" />
          </div>
        </div>
        <button className="btn btn-primario btn-lg btn-bloque" disabled={pidiendo}>
          {pidiendo ? "Enviando…" : "Enviar enlace"}
        </button>
        {pedido?.ok && (
          <div className="aviso ok" style={{ marginTop: 16 }}>
            <MailCheck />
            <span>
              Listo. Revisa <b>{pedido.ok}</b>; el enlace vence en 30 minutos.
            </span>
          </div>
        )}
        {pedido?.error && <div className="aviso error" style={{ marginTop: 16 }}>{pedido.error}</div>}
      </form>

      <div style={{ height: 1, background: "var(--line)", margin: "30px 0 28px" }} />
      <form action={cambiar} style={{ opacity: token ? 1 : 0.55 }}>
        <h2 className="titulo-item" style={{ fontSize: 15, marginBottom: 14 }}>Nueva contraseña</h2>
        <input type="hidden" name="token" value={token ?? ""} />
        <div className="control">
          <LockKeyhole />
          <input name="contrasena" type="password" className="input" disabled={!token} value={clave} onChange={(e) => setClave(e.target.value)} placeholder={token ? "Mínimo 8 caracteres" : "Abre el enlace que te llegó al correo"} minLength={8} required />
        </div>
        <div className="medidor" style={{ margin: "12px 0 18px", gridTemplateColumns: "repeat(4,1fr) auto" }}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={i < f ? "on" : ""} />
          ))}
          <b style={{ fontSize: 11.5, fontWeight: 500, color: f >= 3 ? "var(--lime-ink)" : "var(--muted)", marginLeft: 6 }}>{clave ? (f >= 3 ? "Segura" : f === 2 ? "Aceptable" : "Débil") : ""}</b>
        </div>
        {cambio?.error && <div className="aviso error" style={{ marginBottom: 14 }}>{cambio.error}</div>}
        {cambio?.ok && <div className="aviso ok" style={{ marginBottom: 14 }}>{cambio.ok}</div>}
        <button className="btn btn-secundario btn-bloque" disabled={!token || cambiando || f < 2}>
          {cambiando ? "Guardando…" : "Guardar y entrar"}
        </button>
      </form>
    </div>
  );
}
