import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ppdApi,
  type FacturaPpd,
  type DetallePpd,
  type ParcialidadPpd,
} from './ppd.api';
import { ESTADOS_CXP } from './solicitudes.api';
import { useSort, type Accessors } from '@/components/tabla/useSort';
import { SortableTh, THEAD_STICKY, THEAD_TR } from '@/components/tabla/SortableTh';
import { NuevaFacturaPpd } from './NuevaFacturaPpd';
import { NuevaParcialPpd } from './NuevaParcialPpd';
import { SubirComplementoModal } from './SubirComplementoModal';
import { DispensarComplementoModal } from './DispensarComplementoModal';
import { useAuth } from '@/features/auth/useAuth';

const fmt = (n: number, mon = 'MXN') =>
  n.toLocaleString('es-MX', { style: 'currency', currency: mon });

const fechaCorta = (iso: string | null): string => {
  if (!iso) return '—';
  const p = iso.slice(0, 10).split('-');
  return p.length === 3 ? `${Number(p[2])}/${Number(p[1])}/${p[0]}` : iso;
};

const ESTADO = (idEstado: number | null) =>
  ESTADOS_CXP[idEstado ?? 0] ?? { etiqueta: '—', clase: 'bg-gray-100 text-gray-500' };

/**
 * CxP > Solicitudes de Pago PPD (clave 420). Estado de cuenta de las facturas
 * PPD: total, solicitado, pagado y disponible. Permite registrar una factura
 * nueva (con su primer pago) y dosificar pagos parciales sobre facturas
 * existentes, sin solicitar más del disponible. Cada parcialidad pasa por el
 * flujo normal de Aprobar y Pagar.
 */
export function PpdPage() {
  const { tienePermiso } = useAuth();
  const qc = useQueryClient();
  const puede = tienePermiso(420);

  const [busca, setBusca] = useState('');
  const [nuevaFactura, setNuevaFactura] = useState(false);
  const [parcialDe, setParcialDe] = useState<FacturaPpd | null>(null);
  const [detalleDe, setDetalleDe] = useState<FacturaPpd | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['cxp-ppd'],
    queryFn: () => ppdApi.listar(),
    staleTime: 30 * 1000,
  });

  const refrescar = () =>
    qc.invalidateQueries({ queryKey: ['cxp-ppd'], refetchType: 'all' });

  const filas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const lista = data ?? [];
    if (!q) return lista;
    return lista.filter((f) =>
      [f.nombreProveedor, f.nomCFDI, f.folio, f.concepto]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q)),
    );
  }, [data, busca]);

  const accessors: Accessors<FacturaPpd> = {
    proveedor: (f) => f.nombreProveedor ?? f.nomCFDI,
    fecha: (f) => f.fecInicio,
    total: (f) => f.total ?? 0,
    solicitado: (f) => f.solicitado,
    pagado: (f) => f.pagado,
    disponible: (f) => f.disponible,
    avance: (f) => f.avance,
    parcialidades: (f) => f.numParcialidades,
  };
  const { ordenados, sortKey, dir, toggle } = useSort(filas, accessors, {
    key: 'fecha',
    dir: 'desc',
  });

  const th = (campo: string, label: string, align?: 'right' | 'center') => (
    <SortableTh
      campo={campo}
      sortKey={sortKey}
      dir={dir}
      onSort={toggle}
      align={align}
    >
      {label}
    </SortableTh>
  );

  return (
    <div className="space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Solicitudes de Pago PPD</h1>
          <p className="text-sm text-gray-500">
            Facturas en parcialidades (PPD): controla el saldo y dosifica los pagos.
          </p>
        </div>
        {puede && (
          <button
            onClick={() => setNuevaFactura(true)}
            className="rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white hover:bg-[#172039]"
          >
            + Nueva factura PPD
          </button>
        )}
      </div>

      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por proveedor, folio o concepto…"
        className="w-full max-w-md rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30"
      />

      {error ? (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          No se pudo cargar el estado de cuenta.
        </div>
      ) : (
        <div className="overflow-auto rounded-lg border" style={{ maxHeight: '70vh' }}>
          <table className="w-full border-collapse text-sm">
            <thead className={THEAD_STICKY}>
              <tr className={THEAD_TR}>
                {th('proveedor', 'Proveedor')}
                <SortableTh>Folio</SortableTh>
                {th('fecha', 'Inicio')}
                {th('total', 'Total', 'right')}
                {th('solicitado', 'Solicitado', 'right')}
                {th('pagado', 'Pagado', 'right')}
                {th('disponible', 'Disponible', 'right')}
                {th('avance', 'Avance', 'center')}
                {th('parcialidades', 'Pagos', 'center')}
                <SortableTh align="center">Acciones</SortableTh>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-400">
                    Cargando…
                  </td>
                </tr>
              ) : ordenados.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-400">
                    No hay facturas PPD registradas.
                  </td>
                </tr>
              ) : (
                ordenados.map((f) => {
                  const sinSaldo = f.disponible <= 0.01;
                  return (
                    <tr
                      key={f.idCxpPPD}
                      className={`border-t ${
                        f.repVencido
                          ? 'bg-rose-100 hover:bg-rose-200'
                          : f.repPendiente
                            ? 'bg-amber-50 hover:bg-amber-100'
                            : 'hover:bg-gray-50'
                      }`}
                      title={
                        f.repVencido
                          ? 'Complemento de pago (REP) vencido'
                          : f.repPendiente
                            ? 'Complemento de pago (REP) pendiente'
                            : undefined
                      }
                    >
                      <td className="px-4 py-2 align-top">
                        <div className="max-w-[500px]">
                          <div className="font-medium text-gray-800">
                            {f.nombreProveedor ?? f.nomCFDI}
                          </div>
                          <div
                            className="whitespace-normal break-words text-xs text-gray-400"
                            title={f.concepto ?? ''}
                          >
                            {f.concepto ?? '—'}
                          </div>
                        </div>
                      </td>
                      <td
                        className="whitespace-nowrap px-4 py-2 align-top font-mono text-xs text-gray-500"
                        title={f.folio}
                      >
                        {f.folio}
                      </td>
                      <td className="px-4 py-2 text-gray-600">{fechaCorta(f.fecInicio)}</td>
                      <td className="px-4 py-2 text-right text-gray-700">
                        {fmt(f.total ?? 0, f.moneda)}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-700">
                        {fmt(f.solicitado, f.moneda)}
                      </td>
                      <td className="px-4 py-2 text-right text-green-700">
                        {fmt(f.pagado, f.moneda)}
                      </td>
                      <td
                        className={`px-4 py-2 text-right font-semibold ${
                          sinSaldo ? 'text-gray-400' : 'text-[#1f2a4d]'
                        }`}
                      >
                        {fmt(f.disponible, f.moneda)}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200">
                            <div
                              className="h-full bg-[#90BF32]"
                              style={{ width: `${Math.min(100, f.avance)}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">{f.avance}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-center text-gray-600">
                        {f.numParcialidades}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setDetalleDe(f)}
                            className="rounded border px-2 py-1 text-xs text-[#3f5b87] hover:bg-gray-50"
                          >
                            Detalle
                          </button>
                          {puede && (
                            <button
                              onClick={() => setParcialDe(f)}
                              disabled={sinSaldo}
                              title={sinSaldo ? 'Sin saldo disponible' : 'Solicitar otro pago'}
                              className="rounded bg-[#3f5b87] px-2 py-1 text-xs font-medium text-white hover:bg-[#1f2a4d] disabled:opacity-40"
                            >
                              Solicitar pago
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {nuevaFactura && (
        <NuevaFacturaPpd
          onClose={() => setNuevaFactura(false)}
          onCreada={() => {
            setNuevaFactura(false);
            refrescar();
          }}
        />
      )}
      {parcialDe && (
        <NuevaParcialPpd
          factura={parcialDe}
          onClose={() => setParcialDe(null)}
          onCreada={() => {
            setParcialDe(null);
            refrescar();
          }}
        />
      )}
      {detalleDe && (
        <DetalleModal
          idCxpPPD={detalleDe.idCxpPPD}
          moneda={detalleDe.moneda}
          onClose={() => setDetalleDe(null)}
        />
      )}
    </div>
  );
}

/** Modal de detalle: saldo + parcialidades (con su estatus) de una factura PPD. */
function DetalleModal({
  idCxpPPD,
  moneda,
  onClose,
}: {
  idCxpPPD: string;
  moneda: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { tienePermiso } = useAuth();
  const puedeDispensar = tienePermiso(403);
  const { data, isLoading } = useQuery<DetallePpd>({
    queryKey: ['cxp-ppd-detalle', idCxpPPD],
    queryFn: () => ppdApi.detalle(idCxpPPD),
  });
  const [subirDe, setSubirDe] = useState<ParcialidadPpd | null>(null);
  const [dispensarDe, setDispensarDe] = useState<ParcialidadPpd | null>(null);
  const mon = moneda || 'MXN';

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ['cxp-ppd-detalle', idCxpPPD] });
    qc.invalidateQueries({ queryKey: ['cxp-ppd'] });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-lg font-semibold text-gray-800">Estado de cuenta de la factura</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          {isLoading || !data ? (
            <p className="py-8 text-center text-sm text-gray-400">Cargando…</p>
          ) : (
            <>
              <div className="rounded-lg border bg-gray-50 p-3 text-sm">
                <p className="font-medium text-gray-800">
                  {data.maestro.nombreProveedor ?? data.maestro.nomCFDI}
                </p>
                <p className="truncate text-xs text-gray-400" title={data.maestro.concepto ?? ''}>
                  {data.maestro.concepto ?? '—'}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
                  <Resumen label="Total" valor={fmt(data.saldo.total, mon)} />
                  <Resumen label="Solicitado" valor={fmt(data.saldo.solicitado, mon)} />
                  <Resumen label="Pagado" valor={fmt(data.saldo.pagado, mon)} verde />
                  <Resumen label="Disponible" valor={fmt(data.saldo.disponible, mon)} fuerte />
                </div>
              </div>

              <div className="overflow-auto rounded-lg border">
                <table className="w-full border-collapse text-sm">
                  <thead className={THEAD_STICKY}>
                    <tr className={THEAD_TR}>
                      <SortableTh>Solicitud</SortableTh>
                      <SortableTh align="right">Monto</SortableTh>
                      <SortableTh align="right">Pagado</SortableTh>
                      <SortableTh align="center">Estatus</SortableTh>
                      <SortableTh>Clasificación</SortableTh>
                      <SortableTh>Pago</SortableTh>
                      <SortableTh align="center">Complemento (REP)</SortableTh>
                    </tr>
                  </thead>
                  <tbody>
                    {data.parcialidades.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                          Sin parcialidades.
                        </td>
                      </tr>
                    ) : (
                      data.parcialidades.map((p) => {
                        const e = ESTADO(p.idEstado);
                        return (
                          <tr key={p.idCxp} className="border-t">
                            <td className="px-4 py-2 text-gray-600">
                              {fechaCorta(p.fecSolicitud)}
                            </td>
                            <td className="px-4 py-2 text-right text-gray-700">
                              {fmt(p.total, p.moneda || mon)}
                            </td>
                            <td className="px-4 py-2 text-right text-green-700">
                              {p.montoAplicado ? fmt(p.montoAplicado, p.moneda || mon) : '—'}
                            </td>
                            <td className="px-4 py-2 text-center">
                              <span
                                className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${e.clase}`}
                              >
                                {e.etiqueta}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-gray-600">
                              {[p.categoria, p.clasificacion].filter(Boolean).join(' / ') || '—'}
                            </td>
                            <td className="px-4 py-2 text-gray-600">{fechaCorta(p.fecPago)}</td>
                            <td className="px-4 py-2 text-center">
                              <Complemento
                                parcial={p}
                                onSubir={() => setSubirDe(p)}
                                onDispensar={() => setDispensarDe(p)}
                                puedeDispensar={puedeDispensar}
                              />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end border-t px-5 py-3">
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">
            Cerrar
          </button>
        </div>
      </div>

      {subirDe && (
        <SubirComplementoModal
          parcial={subirDe}
          onClose={() => setSubirDe(null)}
          onSubido={() => {
            setSubirDe(null);
            refrescar();
          }}
        />
      )}
      {dispensarDe && (
        <DispensarComplementoModal
          parcial={dispensarDe}
          onClose={() => setDispensarDe(null)}
          onDispensado={() => {
            setDispensarDe(null);
            refrescar();
          }}
        />
      )}
    </div>
  );
}

/** Estado del Complemento de Pago de una parcialidad (en el detalle). */
function Complemento({
  parcial: p,
  onSubir,
  onDispensar,
  puedeDispensar,
}: {
  parcial: ParcialidadPpd;
  onSubir: () => void;
  onDispensar: () => void;
  puedeDispensar: boolean;
}) {
  const pagada = p.idEstado === 6 || p.idEstado === 7;
  if (!pagada) return <span className="text-xs text-gray-300">—</span>;
  if (p.uuidComplemento) {
    return p.urlComplementoXml ? (
      <a
        href={p.urlComplementoXml}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs font-medium text-green-700 hover:underline"
        title={p.uuidComplemento}
      >
        ✓ REP subido
      </a>
    ) : (
      <span className="text-xs font-medium text-green-700">✓ REP subido</span>
    );
  }
  if (p.complementoExento) {
    const tip = [
      p.complementoExentoMotivo,
      p.dispensadoPorNombre ? `Autorizó: ${p.dispensadoPorNombre}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
    return (
      <span className="text-xs font-medium text-gray-500" title={tip || undefined}>
        Dispensado (excepción)
      </span>
    );
  }
  const vencido = (p.diasDesdePago ?? 0) > 15;
  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`text-xs ${vencido ? 'font-semibold text-red-600' : 'text-amber-600'}`}>
        Pendiente{p.diasDesdePago != null ? ` (${p.diasDesdePago} d)` : ''}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={onSubir}
          className="rounded bg-[#3f5b87] px-2 py-0.5 text-xs font-medium text-white hover:bg-[#1f2a4d]"
        >
          Subir
        </button>
        {puedeDispensar && (
          <button
            onClick={onDispensar}
            title="Dispensar por excepción (proveedor que no emitirá el REP)"
            className="rounded border border-amber-400 px-2 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-50"
          >
            Dispensar
          </button>
        )}
      </div>
    </div>
  );
}

function Resumen({
  label,
  valor,
  fuerte,
  verde,
}: {
  label: string;
  valor: string;
  fuerte?: boolean;
  verde?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-wide text-gray-400">{label}</span>
      <span
        className={
          fuerte ? 'font-semibold text-[#1f2a4d]' : verde ? 'text-green-700' : 'text-gray-700'
        }
      >
        {valor}
      </span>
    </div>
  );
}
