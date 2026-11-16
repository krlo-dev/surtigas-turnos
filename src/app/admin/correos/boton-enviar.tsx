"use client";

import { Send } from "lucide-react";
import { useState, useTransition } from "react";
import { enviarAhora } from "./acciones";

export function BotonEnviarAhora() {
  const [pendiente, iniciar] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
      <button className="btn btn-secundario" disabled={pendiente} onClick={() => iniciar(async () => setMsg((await enviarAhora()).ok))}>
        <Send /> {pendiente ? "Enviando…" : "Enviar horario ahora"}
      </button>
      {msg && <span className="texto-oliva" style={{ fontSize: 12 }}>{msg}</span>}
    </div>
  );
}
