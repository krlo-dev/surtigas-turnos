"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Select que cambia un parámetro de la URL (filtros de oficina, semana, etc.). */
export function SelectorUrl({ parametro, valor, opciones, className = "select-pill", etiqueta }: { parametro: string; valor: string; opciones: { valor: string; texto: string }[]; className?: string; etiqueta?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <select
      className={className}
      aria-label={etiqueta ?? parametro}
      value={valor}
      onChange={(e) => {
        const p = new URLSearchParams(params.toString());
        p.set(parametro, e.target.value);
        router.push(`${pathname}?${p.toString()}`, { scroll: false });
      }}
    >
      {opciones.map((o) => (
        <option key={o.valor} value={o.valor}>
          {o.texto}
        </option>
      ))}
    </select>
  );
}
