import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { BarraAdmin } from "@/components/shell/barra-admin";
import { SelectorUrl } from "@/components/selector-url";
import { fmtRangoSemana, hoyISO, lunesDe } from "@/lib/fechas";
import { vistaMalla } from "@/lib/servicios/vista-malla";
import { GrillaMalla } from "./grilla";
import { PestanasMalla } from "./pestanas";

export const metadata = { title: "Malla de turnos" };

export default async function PaginaMalla({ searchParams }: { searchParams: Promise<{ semana?: string; oficina?: string; nuevo?: string; confirmada?: string }> }) {
  const sp = await searchParams;
  const lunes = lunesDe(sp.semana && /^\d{4}-\d{2}-\d{2}$/.test(sp.semana) ? sp.semana : hoyISO());
  const v = await vistaMalla(lunes, sp.oficina);
  return (
    <main className="principal">
      <BarraAdmin />
      <PestanasMalla activa="vigente" />
      {sp.confirmada && <div className="aviso ok" style={{ marginBottom: 14 }}>Malla confirmada. Ya es la malla vigente de la semana {v?.semana}.</div>}
      {!v ? (
        <p className="muted">Crea una oficina para empezar.</p>
      ) : (
        <GrillaMalla
          v={v}
          abrirNuevo={sp.nuevo === "1"}
          cabecera={
            <>
              <SelectorUrl parametro="oficina" valor={v.oficina.id} opciones={v.oficinas.map((o) => ({ valor: o.id, texto: o.nombre }))} className="select-pill" etiqueta="Oficina" />
              <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
                <div className="navegador-semana">
                  <Link className="btn-flecha" href={`/admin/malla?semana=${v.anterior}&oficina=${v.oficina.id}`} aria-label="Semana anterior">
                    <ChevronLeft />
                  </Link>
                  {fmtRangoSemana(v.lunes)}
                  <Link className="btn-flecha" href={`/admin/malla?semana=${v.siguiente}&oficina=${v.oficina.id}`} aria-label="Semana siguiente">
                    <ChevronRight />
                  </Link>
                </div>
              </div>
            </>
          }
        />
      )}
    </main>
  );
}
