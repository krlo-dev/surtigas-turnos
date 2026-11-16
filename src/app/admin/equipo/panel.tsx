"use client";

import type { Usuario } from "@prisma/client";
import { UserPlus } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { guardarPersona } from "./acciones";

export function PanelPersona({ persona, oficinas }: { persona: Usuario | null; oficinas: { id: string; nombre: string }[] }) {
  const [estado, accion, pendiente] = useActionState(guardarPersona.bind(null, persona?.id ?? null), undefined);
  const [rol, setRol] = useState<"COLABORADOR" | "ADMIN">(persona?.rol ?? "COLABORADOR");
  return (
    <form action={accion} key={persona?.id ?? "nueva"}>
      <div className="perfil" style={{ textAlign: "left", padding: "20px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h2 className="titulo-seccion" style={{ fontSize: 16 }}>{persona ? "Editar persona" : "Agregar persona"}</h2>
          {persona ? (
            <Link href="/admin/equipo" className="btn btn-quieto btn-sm">Cancelar</Link>
          ) : (
            <span className="btn-icono redondo sm" style={{ border: 0 }}><UserPlus /></span>
          )}
        </div>
        <div className="campo" style={{ marginBottom: 14 }}>
          <label htmlFor="nombre">Nombre</label>
          <input id="nombre" name="nombre" className="input sm" defaultValue={persona?.nombre} placeholder="Nombre y apellido" required />
        </div>
        <div className="campo" style={{ marginBottom: 14 }}>
          <label htmlFor="correo">Correo</label>
          <input id="correo" name="correo" type="email" className="input sm" defaultValue={persona?.correo} placeholder="nombre@surtigas.co" required />
        </div>
        <div className="campo" style={{ marginBottom: 14 }}>
          <span className="label">Rol</span>
          <input type="hidden" name="rol" value={rol} />
          <div className="segmentado bloque" style={{ background: "#fff", border: "1px solid var(--line-2)" }}>
            <button type="button" className={rol === "COLABORADOR" ? "activo" : ""} onClick={() => setRol("COLABORADOR")} style={rol === "COLABORADOR" ? { background: "var(--blue-50)", color: "var(--blue-ink)", boxShadow: "none" } : {}}>Colaborador</button>
            <button type="button" className={rol === "ADMIN" ? "activo" : ""} onClick={() => setRol("ADMIN")} style={rol === "ADMIN" ? { background: "var(--blue-50)", color: "var(--blue-ink)", boxShadow: "none" } : {}}>Administración</button>
          </div>
        </div>
        {rol === "COLABORADOR" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: 10, marginBottom: 14 }}>
            <div className="campo">
              <label htmlFor="oficinaId">Oficina</label>
              <select id="oficinaId" name="oficinaId" className="select sm" defaultValue={persona?.oficinaId ?? oficinas[0]?.id}>
                {oficinas.map((o) => (
                  <option key={o.id} value={o.id}>{o.nombre}</option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="horasSemana">Horas</label>
              <input id="horasSemana" name="horasSemana" type="number" min={4} max={42} className="input sm" defaultValue={persona?.horasSemana ?? 40} />
            </div>
          </div>
        )}
        {rol === "ADMIN" && <input type="hidden" name="horasSemana" value="0" />}
        {persona ? (
          <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, color: "var(--ink-2)", marginBottom: 18 }}>
            Cuenta activa
            <input type="checkbox" name="activo" className="toggle" defaultChecked={persona.activo} />
          </label>
        ) : (
          <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, color: "var(--ink-2)", marginBottom: 18 }}>
            Enviar invitación
            <input type="checkbox" name="invitar" className="toggle" defaultChecked />
          </label>
        )}
        {estado?.error && <div className="aviso error" style={{ marginBottom: 12 }}>{estado.error}</div>}
        <button className="btn btn-primario btn-bloque" disabled={pendiente}>{pendiente ? "Guardando…" : persona ? "Guardar cambios" : "Crear acceso"}</button>
      </div>
      <p className="ink2" style={{ fontSize: 12, padding: "14px 6px" }}>Los colaboradores solo ven su semana y sus solicitudes. La administración ve la operación completa.</p>
    </form>
  );
}
