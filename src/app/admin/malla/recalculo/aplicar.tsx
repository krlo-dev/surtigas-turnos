"use client";

import { Check, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useFormStatus } from "react-dom";

export function AccionesRecalculo({ formId, habilitado, ajustarHref, recalcularFormId }: { formId: string; habilitado: boolean; ajustarHref: string; recalcularFormId: string }) {
  return (
    <div className="acciones nowrap">
      <BotonRecalcular formId={recalcularFormId} />
      <Link href={ajustarHref} className="btn btn-quieto">
        Ajustar a mano
      </Link>
      <BotonEnviar formId={formId} habilitado={habilitado} />
    </div>
  );
}

function BotonEnviar({ formId, habilitado }: { formId: string; habilitado: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button form={formId} className="btn btn-primario" disabled={!habilitado || pending}>
      <Check /> {pending ? "Aplicando…" : "Aplicar cobertura"}
    </button>
  );
}

function BotonRecalcular({ formId }: { formId: string }) {
  const { pending } = useFormStatus();
  return (
    <button form={formId} className="btn btn-quieto" disabled={pending} title="Calcula de nuevo con la malla como está ahora">
      <RefreshCw className={pending ? "animate-spin" : ""} /> {pending ? "Calculando…" : "Volver a calcular"}
    </button>
  );
}
