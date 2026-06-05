import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parametrosApi } from './parametros.api';
import { ApiRequestError } from '@/lib/api';

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const moneda = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

function montosIniciales(): Record<number, string> {
  const o: Record<number, string> = {};
  for (let m = 1; m <= 12; m++) o[m] = '0';
  return o;
}

/** Modal para ajustar el presupuesto mensual (siempre 12 meses, default 0). */
export function PresupuestoMensualModal({
  idCategoria,
  cuenta,
  seccion,
  idPresupuesto,
  onClose,
}: {
  idCategoria: string;
  cuenta: string;
  seccion?: string | null;
  idPresupuesto: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [montos, setMontos] = useState<Record<number, string>>(montosIniciales);
  const [error, setError] = useState<string | null>(null);

  // Solo lee los montos existentes (no crea nada). El modal siempre muestra 12.
  const { data: existentes = [] } = useQuery({
    queryKey: ['presupuesto-mensual', idCategoria, idPresupuesto],
    queryFn: () =>
      parametrosApi.obtenerPresupuestoMensual(idCategoria, idPresupuesto),
  });

  // Rellenar los meses que tengan registro.
  useEffect(() => {
    if (existentes.length) {
      setMontos((prev) => {
        const next = { ...prev };
        for (const m of existentes) next[m.mes] = String(m.monto ?? 0);
        return next;
      });
    }
  }, [existentes]);

  const guardar = useMutation({
    mutationFn: () => {
      const meses = Array.from({ length: 12 }, (_, i) => ({
        mes: i + 1,
        monto: Number(montos[i + 1] ?? 0) || 0,
      }));
      return parametrosApi.guardarPresupuestoMensual(
        idCategoria,
        idPresupuesto,
        meses,
      );
    },
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['cuentas'] });
      void queryClient.invalidateQueries({
        queryKey: ['presupuesto-mensual', idCategoria, idPresupuesto],
      });
      onClose();
    },
    onError: (e) =>
      setError(e instanceof ApiRequestError ? e.message : 'No se pudo guardar.'),
  });

  const total = Array.from({ length: 12 }, (_, i) => Number(montos[i + 1] ?? 0) || 0).reduce(
    (a, b) => a + b,
    0,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-800">
          Presupuesto mensual
        </h2>
        <p className="text-sm text-gray-500">
          {cuenta}
          {seccion ? ` · ${seccion}` : ''}
        </p>

        {error && (
          <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((mes) => (
            <label key={mes} className="text-xs text-gray-600">
              {MESES[mes - 1]}
              <input
                type="number"
                step="0.01"
                value={montos[mes] ?? '0'}
                onChange={(e) =>
                  setMontos((p) => ({ ...p, [mes]: e.target.value }))
                }
                className="mt-1 block w-full rounded-md border px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30"
              />
            </label>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between border-t pt-3">
          <span className="text-sm font-medium text-gray-700">
            Total anual: {moneda(total)}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
            >
              Cerrar
            </button>
            <button
              onClick={() => guardar.mutate()}
              disabled={guardar.isPending}
              className="rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white hover:bg-[#172039] disabled:opacity-50"
            >
              {guardar.isPending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
