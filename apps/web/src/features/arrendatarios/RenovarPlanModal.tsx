import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  arrendatariosApi,
  moneda,
  fechaCorta,
  type RenovarInput,
} from './arrendatarios.api';

type FormStr = Record<
  | 'plazo' | 'm2Construccion' | 'inpcPlus' | 'deposito' | 'precioM2'
  | 'pm2Admin' | 'pm2Mtto' | 'pm2Vig'
  | 'cortesiaRenta' | 'cortesiaAdmin' | 'cortesiaMtto' | 'cortesiaVig',
  string
> & { moneda: 'MXN' | 'USD' };

/**
 * Modal de **renovación** de un plan: precarga los datos del último mes del plan
 * anterior (renta ya incrementada por INPC), con fecha de inicio fija = fin del
 * vigente + 1 día (solo lectura). El usuario ajusta y registra; el backend crea el
 * plan de renovación sin tocar el vigente (RPC `v2_arrepdp_renovar`).
 */
export function RenovarPlanModal({
  idArrePdp,
  nombre,
  onClose,
  onRenovado,
}: {
  idArrePdp: string;
  nombre: string;
  onClose: () => void;
  onRenovado: () => void;
}) {
  const { data: pre, isLoading } = useQuery({
    queryKey: ['arre-renovacion-precarga', idArrePdp],
    queryFn: () => arrendatariosApi.renovacionPrecarga(idArrePdp),
  });

  const [form, setForm] = useState<FormStr | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Inicializa el formulario con la precarga (una vez que llega).
  useEffect(() => {
    if (pre && !form) {
      setForm({
        moneda: pre.moneda,
        plazo: String(pre.plazo ?? ''),
        m2Construccion: pre.m2Construccion ? String(pre.m2Construccion) : '',
        inpcPlus: pre.inpcPlus ? String(pre.inpcPlus) : '',
        deposito: pre.deposito ? String(pre.deposito) : '',
        precioM2: pre.precioM2 ? String(pre.precioM2) : '',
        pm2Admin: pre.pm2Admin ? String(pre.pm2Admin) : '',
        pm2Mtto: pre.pm2Mtto ? String(pre.pm2Mtto) : '',
        pm2Vig: pre.pm2Vig ? String(pre.pm2Vig) : '',
        cortesiaRenta: '',
        cortesiaAdmin: '',
        cortesiaMtto: '',
        cortesiaVig: '',
      });
    }
  }, [pre, form]);

  const set = (k: keyof FormStr, v: string) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const n = (s: string) => Number(s) || 0;

  const m2 = form ? n(form.m2Construccion) : 0;
  const subRenta = form ? n(form.precioM2) * m2 : 0;
  const subAdmin = form ? n(form.pm2Admin) * m2 : 0;
  const subMtto = form ? n(form.pm2Mtto) * m2 : 0;
  const subVig = form ? n(form.pm2Vig) * m2 : 0;
  const totalMes = subRenta + subAdmin + subMtto + subVig;

  async function registrar(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError(null);
    setMsg(null);
    if (n(form.plazo) <= 0 || m2 <= 0) {
      setError('El plazo y la construcción (m²) deben ser mayores a 0.');
      return;
    }
    setGuardando(true);
    try {
      const dto: RenovarInput = {
        plazo: n(form.plazo),
        m2Construccion: m2,
        deposito: n(form.deposito),
        precioM2: n(form.precioM2),
        pm2Admin: n(form.pm2Admin),
        pm2Mtto: n(form.pm2Mtto),
        pm2Vig: n(form.pm2Vig),
        inpcPlus: n(form.inpcPlus),
        moneda: form.moneda,
        cortesiaRenta: n(form.cortesiaRenta),
        cortesiaAdmin: n(form.cortesiaAdmin),
        cortesiaMtto: n(form.cortesiaMtto),
        cortesiaVig: n(form.cortesiaVig),
      };
      const r = await arrendatariosApi.renovar(idArrePdp, dto);
      setMsg(r.mensaje);
      onRenovado();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la renovación.');
    } finally {
      setGuardando(false);
    }
  }

  const numField = (label: string, k: keyof FormStr, step = '0.01') => (
    <label className="text-xs text-gray-600">
      {label}
      <input
        type="number"
        step={step}
        value={form ? form[k] : ''}
        placeholder="0"
        onChange={(e) => set(k, e.target.value)}
        className="mt-1 block w-full rounded border px-2 py-1.5 text-right text-sm"
      />
    </label>
  );

  const concepto = (
    label: string,
    kPm2: keyof FormStr,
    kCort: keyof FormStr,
    subtotal: number,
  ) => (
    <div className="grid grid-cols-12 items-end gap-2 border-t pt-2">
      <span className="col-span-3 text-xs font-medium text-gray-600">{label}</span>
      <label className="col-span-3 text-[11px] text-gray-500">
        $ x m²
        <input
          type="number"
          step="0.01"
          value={form ? form[kPm2] : ''}
          placeholder="0"
          onChange={(e) => set(kPm2, e.target.value)}
          className="mt-0.5 block w-full rounded border px-2 py-1 text-right text-sm"
        />
      </label>
      <div className="col-span-4 text-[11px] text-gray-500">
        SubTotal
        <div className="mt-0.5 rounded border bg-gray-50 px-2 py-1 text-right text-sm font-medium">
          {moneda(subtotal, form?.moneda ?? 'MXN')}
        </div>
      </div>
      <label className="col-span-2 text-[11px] text-gray-500">
        Gracia
        <input
          type="number"
          step="0.5"
          min={0}
          max={6}
          value={form ? form[kCort] : ''}
          placeholder="0"
          onChange={(e) => set(kCort, e.target.value)}
          className="mt-0.5 block w-full rounded border px-1 py-1 text-right text-sm"
        />
      </label>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between bg-[#1f2a4d] px-5 py-3 text-white">
          <h2 className="text-base font-semibold">Renovar plan · {nombre}</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white" aria-label="Cerrar">
            ✕
          </button>
        </div>

        {isLoading || !form ? (
          <p className="px-5 py-10 text-center text-sm text-gray-400">Cargando datos del plan…</p>
        ) : (
          <form onSubmit={registrar} className="space-y-3 p-5">
            <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
              La renovación inicia el <b>{fechaCorta(pre?.fecInicio ?? null)}</b> (día siguiente al fin
              del plan vigente, {fechaCorta(pre?.fecFinActual ?? null)}). Datos precargados con el
              último mes del plan anterior; ajústalos si es necesario.
            </p>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <label className="text-xs text-gray-600">
                Fecha inicio
                <input
                  type="text"
                  readOnly
                  value={fechaCorta(pre?.fecInicio ?? null)}
                  className="mt-1 block w-full rounded border bg-gray-100 px-2 py-1.5 text-sm text-gray-600"
                />
              </label>
              {numField('Plazo (meses)', 'plazo', '1')}
              {numField('m² construcción', 'm2Construccion')}
              {numField('INPC adicional (%)', 'inpcPlus')}
              {numField('Depósito garantía', 'deposito')}
              <label className="text-xs text-gray-600">
                Moneda
                <select
                  value={form.moneda}
                  onChange={(e) => set('moneda', e.target.value as 'MXN' | 'USD')}
                  className="mt-1 block w-full rounded border px-2 py-1.5 text-sm"
                >
                  <option value="MXN">MXN</option>
                  <option value="USD">USD</option>
                </select>
              </label>
            </div>

            <div className="space-y-1">
              {concepto('Renta base', 'precioM2', 'cortesiaRenta', subRenta)}
              {concepto('Administración', 'pm2Admin', 'cortesiaAdmin', subAdmin)}
              {concepto('Mantenimiento', 'pm2Mtto', 'cortesiaMtto', subMtto)}
              {concepto('Vigilancia', 'pm2Vig', 'cortesiaVig', subVig)}
            </div>

            <div className="flex items-center justify-between border-t pt-2">
              <span className="text-sm font-semibold text-gray-700">Total Mes</span>
              <span className="rounded bg-[#1f2a4d] px-3 py-1 text-sm font-bold text-white tabular-nums">
                {moneda(totalMes, form.moneda)}
              </span>
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}
            {msg && <p className="text-xs text-[#1f2a4d]">{msg}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando}
                className="rounded-lg bg-[#1f2a4d] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#2a376a] disabled:opacity-50"
              >
                {guardando ? 'Registrando…' : 'Registrar renovación'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
