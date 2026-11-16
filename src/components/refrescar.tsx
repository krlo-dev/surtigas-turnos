"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Polling del dashboard (ERS 7.2): vuelve a pedir los datos del servidor cada N segundos. */
export function Refrescar({ segundos = 60 }: { segundos?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, segundos * 1000);
    return () => clearInterval(id);
  }, [router, segundos]);
  return null;
}
