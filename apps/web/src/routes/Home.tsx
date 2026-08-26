import { useQuery } from '@tanstack/react-query';
import { Logo } from '@/components/Logo';
import { IconBarras } from '@/components/icons';
import { indicadoresApi } from '@/features/indicadores/indicadores.api';
import { RepPendientesPanel } from '@/features/cxp/RepPendientesPanel';

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

const pesos = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

/**
 * Landing. Dos tarjetas de indicadores conectadas a sus fuentes:
 *  - Tipo de cambio: USD/MXN (Banxico, vía backend).
 *  - INPC: último registro capturado en Parámetros.
 * Debajo, el panel de Complementos de Pago (REP) pendientes DEL usuario en sesión
 * (solo aparece si tiene): el correo se envía en días concretos del calendario, así
 * que quien se pierde esa ventana no volvía a enterarse hasta quedar bloqueado.
 */
export function Home() {
  const tc = useQuery({
    queryKey: ['indicadores', 'tipo-cambio'],
    queryFn: () => indicadoresApi.getTipoCambio(),
    staleTime: 30 * 60 * 1000, // Banxico publica una vez al día.
  });

  const inpc = useQuery({
    queryKey: ['indicadores', 'inpc'],
    queryFn: () => indicadoresApi.getInpc(),
    staleTime: 30 * 60 * 1000,
  });

  const valorTc = tc.isLoading
    ? '…'
    : tc.isError || tc.data == null
      ? '—'
      : pesos.format(tc.data.valor);

  const valorInpc = inpc.isLoading
    ? '…'
    : inpc.isError || inpc.data == null
      ? '—'
      : inpc.data.inpc.toLocaleString('es-MX', {
          minimumFractionDigits: 3,
          maximumFractionDigits: 3,
        });

  const periodoInpc =
    inpc.data != null
      ? `${MESES[inpc.data.mes - 1] ?? ''} ${inpc.data.anio}`
      : 'Último registro';

  return (
    <div className="flex min-h-[calc(100vh-7rem)] flex-col">
      {/* Indicadores */}
      <div className="flex flex-wrap justify-center gap-4">
        <article className="flex w-64 items-center justify-between rounded-xl border bg-white p-5 shadow-sm">
          <div>
            <p className="text-sm font-medium text-gray-500">Tipo de cambio</p>
            <p className="mt-1 text-3xl font-bold text-[#1f2a4d]">{valorTc}</p>
            <p className="text-xs text-gray-400">
              {tc.data?.fecha ? `USD / MXN · ${tc.data.fecha}` : 'USD / MXN'}
            </p>
          </div>
          <span className="select-none text-5xl font-bold text-gray-300">$</span>
        </article>

        <article className="flex w-64 items-center justify-between rounded-xl border bg-white p-5 shadow-sm">
          <div>
            <p className="text-sm font-medium text-gray-500">INPC</p>
            <p className="mt-1 text-3xl font-bold text-[#1f2a4d]">{valorInpc}</p>
            <p className="text-xs text-gray-400">{periodoInpc}</p>
          </div>
          <IconBarras className="h-10 w-10 text-gray-300" />
        </article>
      </div>

      {/* Complementos de pago (REP) pendientes del usuario en sesión.
          No se renderiza si no tiene ninguno. */}
      <RepPendientesPanel />

      {/* Logotipo centrado */}
      <div className="flex flex-1 items-center justify-center py-10">
        <Logo fondo="claro" />
      </div>
    </div>
  );
}
