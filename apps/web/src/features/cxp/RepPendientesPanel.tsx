import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useSort } from '@/components/tabla/useSort';
import {
  SortableTh,
  THEAD_STICKY,
  THEAD_TR,
} from '@/components/tabla/SortableTh';
import { misRepApi, type RepPendiente } from './rep-pendientes.api';

const pesos = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** dd/mm/aaaa en hora de México (regla 7b). El backend manda ISO en UTC. */
function fechaCorta(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const mx = new Date(d.getTime() - 6 * 60 * 60 * 1000);
  const dd = String(mx.getUTCDate()).padStart(2, '0');
  const mm = String(mx.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${mx.getUTCFullYear()}`;
}

/** Etiqueta y color según lo que le queda de plazo al proveedor. */
function estado(dias: number): { texto: string; clase: string } {
  if (dias < 0)
    return { texto: 'Vencido', clase: 'bg-red-100 text-red-800 ring-red-600/20' };
  if (dias === 0)
    return {
      texto: 'Vence hoy',
      clase: 'bg-orange-100 text-orange-800 ring-orange-600/20',
    };
  if (dias === 1)
    return {
      texto: 'Vence mañana',
      clase: 'bg-orange-100 text-orange-800 ring-orange-600/20',
    };
  return {
    texto: `${dias} días`,
    clase: 'bg-amber-100 text-amber-800 ring-amber-600/20',
  };
}

/**
 * Panel del landing con los Complementos de Pago (REP) pendientes DEL usuario en
 * sesión: los que solicitó y los que autorizó.
 *
 * Existe porque el correo solo se envía en días concretos del calendario y, si
 * alguien se pierde esa ventana, hoy no vuelve a enterarse hasta que el bloqueo
 * lo alcanza. Aquí lo ve **cada vez que entra**, incluidas las parcialidades ya
 * vencidas (que el correo ya no vuelve a mencionar).
 *
 * Si no hay pendientes no se renderiza nada: el landing queda como estaba.
 */
export function RepPendientesPanel() {
  const q = useQuery({
    queryKey: ['cxp', 'mis-rep'],
    queryFn: () => misRepApi.listar(),
    staleTime: 10 * 60 * 1000,
  });

  const filas = useMemo(() => q.data?.filas ?? [], [q.data]);

  const { ordenados, sortKey, dir, toggle } = useSort<RepPendiente>(
    filas,
    {
      proveedor: (f) => f.nombreProveedor,
      folio: (f) => f.folio,
      monto: (f) => f.monto,
      fecPago: (f) => f.fecPago,
      dias: (f) => f.diasBloqueoProveedor,
    },
    { key: 'dias', dir: 'asc' },
  );

  if (q.isLoading || q.isError || filas.length === 0) return null;

  const r = q.data!.resumen;
  const cfg = q.data!.config;
  const total = filas.reduce((s, f) => s + f.monto, 0);

  return (
    <section className="mx-auto mt-6 w-full max-w-5xl rounded-xl border bg-white p-5 shadow-sm">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-[#1f2a4d]">
            Complementos de pago (REP) pendientes
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            {r.comoSolicitante > 0 && `${r.comoSolicitante} que solicitaste`}
            {r.comoSolicitante > 0 && r.comoAutorizador > 0 && ' · '}
            {r.comoAutorizador > 0 && `${r.comoAutorizador} que autorizaste`}
            {r.vencidas > 0 && ` · ${r.vencidas} ya vencidos`}
          </p>
        </div>
        <Link
          to="/cxp/ppd"
          className="rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Subir complemento
        </Link>
      </header>

      {r.diasParaMiBloqueo != null && r.diasParaMiBloqueo <= 5 && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-600/20">
          {r.diasParaMiBloqueo < 0
            ? 'No puedes crear solicitudes de pago hasta subir los complementos pendientes.'
            : r.diasParaMiBloqueo === 0
              ? `Hoy (día ${cfg.diaBloqueoUsuario}) se bloquea tu acceso a solicitudes de pago si no los subes.`
              : `En ${r.diasParaMiBloqueo} día(s) se bloqueará tu acceso a crear solicitudes de pago.`}
        </p>
      )}

      <div className="max-h-72 overflow-auto rounded-lg border">
        <table className="min-w-full text-sm">
          <thead className={THEAD_STICKY}>
            <tr className={THEAD_TR}>
              <SortableTh campo="proveedor" sortKey={sortKey} dir={dir} onSort={toggle}>
                Proveedor
              </SortableTh>
              <SortableTh campo="folio" sortKey={sortKey} dir={dir} onSort={toggle}>
                Folio
              </SortableTh>
              <SortableTh
                campo="monto"
                sortKey={sortKey}
                dir={dir}
                onSort={toggle}
                align="right"
              >
                Monto
              </SortableTh>
              <SortableTh campo="fecPago" sortKey={sortKey} dir={dir} onSort={toggle}>
                Fecha de pago
              </SortableTh>
              <SortableTh campo="dias" sortKey={sortKey} dir={dir} onSort={toggle}>
                Plazo del proveedor
              </SortableTh>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {ordenados.map((f) => {
              const e = estado(f.diasBloqueoProveedor);
              return (
                <tr key={f.idCxp} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-700">{f.nombreProveedor}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-500">
                    {f.folio || '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-gray-700">
                    {pesos.format(f.monto)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                    {fechaCorta(f.fecPago)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${e.clase}`}
                    >
                      {e.texto}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 font-semibold text-[#1f2a4d]">
              <td className="px-3 py-2" colSpan={2}>
                {filas.length} pendiente(s)
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right">
                {pesos.format(total)}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
