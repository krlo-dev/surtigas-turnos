"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useFormStatus } from "react-dom";

export function AccionesRecalculo({ formId, habilitado, ajustarHref }: { formId: string; habilitado: boolean; ajustarHref: string }) {
  return (
    <div className="acciones nowrap">
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
