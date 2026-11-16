"use client";

import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { entrar } from "@/app/acciones/acceso";

const DEMO = { admin: "marta.rios@surtigas.co", colaborador: "jorge.medina@surtigas.co" };

export function FormularioEntrar({ desde, demoClave }: { desde: string; demoClave: string | null }) {
  const [estado, accion, enviando] = useActionState(entrar, undefined);
  const [ver, setVer] = useState(false);
  const [correo, setCorreo] = useState(estado?.correo ?? "");
  const [clave, setClave] = useState("");
  const llenar = (c: string) => {
    setCorreo(c);
    if (demoClave) setClave(demoClave);
  };
  return (
    <form action={accion}>
      <h1 className="titulo-pagina" style={{ fontSize: 28 }}>Hola de nuevo</h1>
      <p className="sub" style={{ marginBottom: 30 }}>Entra con tu correo de Surtigas para ver tu semana o la operación de hoy.</p>
      <input type="hidden" name="desde" value={desde} />
      <div className="campo" style={{ marginBottom: 18 }}>
        <label htmlFor="correo">Correo</label>
        <div className="control">
          <Mail />
          <input id="correo" name="correo" type="email" className="input" autoComplete="username" required value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="nombre@surtigas.co" />
        </div>
      </div>
      <div className="campo" style={{ marginBottom: 14 }}>
        <label htmlFor="contrasena">Contraseña</label>
        <div className="control">
          <LockKeyhole />
          <input id="contrasena" name="contrasena" type={ver ? "text" : "password"} className="input" autoComplete="current-password" required value={clave} onChange={(e) => setClave(e.target.value)} style={{ paddingRight: 44 }} />
          <button type="button" onClick={() => setVer(!ver)} aria-label={ver ? "Ocultar contraseña" : "Ver contraseña"} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: 0, color: "var(--muted)", display: "grid" }}>
            {ver ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
        <label className="check">
          <input type="checkbox" name="recordar" defaultChecked /> Mantener sesión
        </label>
        <Link href="/recuperar" style={{ color: "var(--blue)", fontWeight: 500, fontSize: 12.5 }}>
          Olvidé mi contraseña
        </Link>
      </div>
      {estado?.error && (
        <div className="aviso error" style={{ marginBottom: 14 }}>
          {estado.error}
        </div>
      )}
      <button className="btn btn-primario btn-lg btn-bloque" disabled={enviando}>
        {enviando ? "Entrando…" : "Entrar"}
      </button>
      <p style={{ textAlign: "center", marginTop: 16, fontSize: 12, color: "var(--ink-2)" }}>
        Según tu rol entras al panel o a tu semana · ver como{" "}
        <button type="button" onClick={() => llenar(DEMO.colaborador)} style={{ background: "none", border: 0, padding: 0, color: "var(--blue)", fontWeight: 500 }}>
          colaborador
        </button>{" "}
        o{" "}
        <button type="button" onClick={() => llenar(DEMO.admin)} style={{ background: "none", border: 0, padding: 0, color: "var(--blue)", fontWeight: 500 }}>
          administradora
        </button>
      </p>
    </form>
  );
}
