const moneda = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

interface Linea {
  label: string;
  valor: number;
  /** Resalta el balance en rojo si es negativo. */
  balance?: boolean;
}

/** Tarjeta de resumen del Dashboard (objetivo / cobranza / balance). */
export function TarjetaResumen({
  titulo,
  lineas,
}: {
  titulo: string;
  lineas: Linea[];
}) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-[#1f2a4d]">{titulo}</h3>
      <dl className="space-y-1.5">
        {lineas.map((l) => (
          <div key={l.label} className="flex items-baseline justify-between gap-4">
            <dt className="text-xs text-gray-500">{l.label}</dt>
            <dd
              className={`text-sm font-semibold tabular-nums ${
                l.balance && l.valor < 0 ? 'text-red-600' : 'text-gray-800'
              }`}
            >
              {moneda(l.valor)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
