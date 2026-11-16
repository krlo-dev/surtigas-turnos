"use client";

import type { Oficina } from "@prisma/client";
import Link from "next/link";
import { useActionState } from "react";
import { guardarOficina } from "./acciones";

export function FormularioOficina({ oficina }: { oficina: Oficina | null }) {
  const [estado, accion, pendiente] = useActionState(guardarOficina.bind(null, oficina?.id ?? null), undefined);
  const o = oficina;
  return (
    <div className="modal-fondo">
      <form className="modal" action={accion}>
        <h2 className="titulo-seccion" style={{ marginBottom: 18 }}>{o ? `Editar ${o.nombre}` : "Nueva oficina"}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div className="campo" style={{ gridColumn: "span 2" }}>
            <label>Nombre</label>
            <input name="nombre" className="input" defaultValue={o?.nombre} required />
          </div>
          <div className="campo">
            <label>Ciudad</label>
            <input name="ciudad" className="input" defaultValue={o?.ciudad} required />
          </div>
          <div className="campo">
            <label>Zona</label>
            <input name="zona" className="input" defaultValue={o?.zona} required list="zonas" />
            <datalist id="zonas">
              <option value="Cartagena" />
              <option value="Bolívar" />
              <option value="Sucre" />
              <option value="Córdoba" />
            </datalist>
          </div>
          <div className="campo">
            <label>Puestos de atención</label>
            <input name="capacidad" type="number" min={1} className="input" defaultValue={o?.capacidad ?? 3} required />
          </div>
          <div className="campo">
            <label>Código en Digiturno</label>
            <input name="codigoDigiturno" type="number" className="input" defaultValue={o?.codigoDigiturno ?? ""} placeholder="IdOficina" />
          </div>
          <div className="campo">
            <label>Abre (L-V)</label>
            <input name="horaApertura" type="number" min={5} max={12} className="input" defaultValue={o?.horaApertura ?? 8} />
          </div>
          <div className="campo">
            <label>Cierra (L-V)</label>
            <input name="horaCierre" type="number" min={12} max={22} className="input" defaultValue={o?.horaCierre ?? 17} />
          </div>
          <label className="check" style={{ alignSelf: "end", height: 46 }}>
            <input type="checkbox" name="abreSabado" defaultChecked={o?.abreSabado ?? true} /> Abre los sábados
          </label>
          <div className="campo">
            <label>Cierra (sábado)</label>
            <input name="horaCierreSabado" type="number" min={9} max={18} className="input" defaultValue={o?.horaCierreSabado ?? 12} />
          </div>
          <label className="check">
            <input type="checkbox" name="atencionVirtual" defaultChecked={o?.atencionVirtual ?? false} /> Atención virtual
          </label>
          {o && (
            <label className="check">
              <input type="checkbox" name="activa" defaultChecked={o.activa} /> Oficina activa
            </label>
          )}
        </div>
        {estado?.error && <div className="aviso error" style={{ marginTop: 14 }}>{estado.error}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
          <Link href="/admin/oficinas" className="btn btn-quieto">Cancelar</Link>
          <button className="btn btn-primario" disabled={pendiente}>{pendiente ? "Guardando…" : "Guardar"}</button>
        </div>
      </form>
    </div>
  );
}
