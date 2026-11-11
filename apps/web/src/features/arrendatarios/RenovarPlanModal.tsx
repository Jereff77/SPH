import { useEffect, useRef, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/useAuth';
import { Modal } from '@/components/ui/Modal';
import {
  arrendatariosApi,
  moneda,
  montoExacto,
  fechaCorta,
  type RenovarInput,
  type TraspasarInput,
  type TraspasarResultado,
  type TraspasoCandidato,
} from './arrendatarios.api';
import { TraspasoDepositoForm } from './TraspasoDepositoForm';
import {
  invalidarTraspasos,
  mensajeError,
  nuevaClave,
  origenesVigentes,
  traspasoValido,
  valorInicialTraspaso,
} from './traspaso-deposito.util';

/** Lista vacía estable (evita un arreglo nuevo por render mientras no han llegado los candidatos). */
const FORM_ID = 'renovar-plan-form';
const SIN_CANDIDATOS: TraspasoCandidato[] = [];

/** Vista de resultado tras crear el plan (D12): el plan queda siempre; el traspaso puede fallar aparte. */
interface ResultadoRenovar {
  idNuevo: string;
  /** Texto fijo de la renovación («inicia el … (plazo N meses)»). */
  inicio: string;
  /** Moneda de la renovación (para los importes del aviso). */
  divisa: string;
  traspaso:
    | { estado: 'omitido' }
    | {
        estado: 'aplicado';
        total: number;
        restante: number;
        contratos: number;
        pagada: boolean;
      }
    | { estado: 'fallido'; mensaje: string };
  /** Cuerpo del traspaso, con su clave de idempotencia, para «Reintentar traspaso» (no recrea el plan). */
  payload: TraspasarInput | null;
}

/** Totales que muestra el aviso ✓/✓, tomados de la respuesta del servidor (la autoridad). */
function aplicado(r: TraspasarResultado, payload: TraspasarInput | null) {
  return {
    estado: 'aplicado' as const,
    total: r.total,
    restante: r.cantidadRestante,
    contratos: r.traspasos.length || payload?.origenes.length || 0,
    pagada: r.pagadaPorTraspaso,
  };
}

type FormStr = Record<
  | 'plazo'
  | 'm2Construccion'
  | 'inpcPlus'
  | 'deposito'
  | 'precioM2'
  | 'pm2Admin'
  | 'pm2Mtto'
  | 'pm2Vig'
  | 'cortesiaRenta'
  | 'cortesiaAdmin'
  | 'cortesiaMtto'
  | 'cortesiaVig',
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

  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const puedeTraspasar = tienePermiso(23) && tienePermiso(25);

  const [form, setForm] = useState<FormStr | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  // Traspaso de depósito (D1/D11/D12): estado del formulario, clave de idempotencia del envío y resultado.
  const [traspaso, setTraspaso] = useState(() => valorInicialTraspaso());
  const claveTraspaso = useRef(nuevaClave());
  const preseleccionado = useRef(false);
  const [resultado, setResultado] = useState<ResultadoRenovar | null>(null);
  const [reintentando, setReintentando] = useState(false);

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

  // Candidatos a origen del traspaso: se piden por moneda (la moneda distinta sale bloqueada).
  const monedaSel = form?.moneda;
  const { data: candidatosData, isPlaceholderData: candidatosPrevios } = useQuery({
    queryKey: ['arre-renov-traspaso-origenes', idArrePdp, monedaSel],
    queryFn: () => arrendatariosApi.renovacionTraspasoOrigenes(idArrePdp, monedaSel!),
    enabled: puedeTraspasar && !!monedaSel,
    placeholderData: keepPreviousData,
    staleTime: 0,
  });

  const candidatos = candidatosData ?? SIN_CANDIDATOS;

  // Al llegar los candidatos por primera vez, el plan que se renueva sale preseleccionado
  // (las naves hermanas quedan sin marcar como «Posible adicional»).
  useEffect(() => {
    if (preseleccionado.current || candidatos.length === 0) return;
    preseleccionado.current = true;
    const renovado = candidatos.find((c) => c.tipo === 'RENOVADO' && !c.bloqueo);
    if (renovado) setTraspaso((t) => ({ ...t, origenes: [renovado.idArrePdp] }));
  }, [candidatos]);

  const depositoNuevo = form ? n(form.deposito) : 0;
  // La sección solo aparece con permisos 23 y 25, depósito nuevo > 0 y candidatos.
  const seccionTraspaso = puedeTraspasar && depositoNuevo > 0 && candidatos.length > 0;
  const origenesMarcados = seccionTraspaso ? origenesVigentes(candidatos, traspaso.origenes) : [];
  // Sin orígenes marcados la renovación es la de siempre; con orígenes exige nota, fecha y casilla.
  const traspasoIncompleto =
    origenesMarcados.length > 0 && !traspasoValido(traspaso, candidatos, depositoNuevo);
  // Tras cambiar la moneda se muestran los candidatos anteriores mientras llegan los nuevos: con
  // traspaso elegido no se puede registrar hasta que se actualicen (si no, se enviaría a la BD una
  // lista de la moneda equivocada y el plan quedaría creado con el traspaso rechazado).
  const actualizandoCandidatos = candidatosPrevios && origenesMarcados.length > 0;

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
    if (n(form.plazo) <= 0 || m2 <= 0) {
      setError('El plazo y la construcción (m²) deben ser mayores a 0.');
      return;
    }
    if (actualizandoCandidatos) return;
    if (traspasoIncompleto) {
      setError(
        'Para traspasar el depósito escribe la nota, confirma que fue recibido y cuida que no supere el depósito nuevo; o desmarca los contratos de origen.',
      );
      return;
    }
    setGuardando(true);
    try {
      const payload: TraspasarInput | null =
        origenesMarcados.length > 0
          ? {
              origenes: origenesMarcados,
              fecTraspaso: traspaso.fecTraspaso,
              nota: traspaso.nota.trim(),
              confirmado: true,
              claveIdempotencia: claveTraspaso.current,
            }
          : null;
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
        ...(payload ? { traspaso: payload } : {}),
      };
      const r = await arrendatariosApi.renovar(idArrePdp, dto);
      const t = r.traspaso;
      setResultado({
        idNuevo: r.idArrePdp,
        inicio: `inicia el ${fechaCorta(pre?.fecInicio ?? null)} (plazo ${n(form.plazo)} meses)`,
        divisa: form.moneda,
        traspaso:
          t?.estado === 'aplicado'
            ? aplicado(t, payload)
            : t?.estado === 'fallido'
              ? { estado: 'fallido', mensaje: t.mensaje }
              : payload
                ? // Se pidió traspaso y el servidor lo omitió: se avisa en vez de callarlo.
                  { estado: 'fallido', mensaje: 'No se aplicó el traspaso.' }
                : { estado: 'omitido' },
        payload,
      });
      // El plan ya existe: se refrescan las listas y las vistas del depósito, pero el modal
      // NO se cierra (hoy el aviso se perdía): queda la vista de resultado.
      onRenovado();
      invalidarTraspasos(queryClient);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la renovación.');
    } finally {
      setGuardando(false);
    }
  }

  /** Reintenta SOLO el traspaso sobre el plan ya creado, con la misma clave (no vuelve a /renovar). */
  async function reintentarTraspaso() {
    if (!resultado?.payload) return;
    setReintentando(true);
    try {
      const r = await arrendatariosApi.traspasarDeposito(resultado.idNuevo, resultado.payload);
      setResultado({ ...resultado, traspaso: aplicado(r, resultado.payload) });
      invalidarTraspasos(queryClient);
    } catch (err) {
      setResultado({
        ...resultado,
        traspaso: {
          estado: 'fallido',
          mensaje: mensajeError(err, 'No se pudo aplicar el traspaso.'),
        },
      });
    } finally {
      setReintentando(false);
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

  const concepto = (label: string, kPm2: keyof FormStr, kCort: keyof FormStr, subtotal: number) => (
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

  // Pie de botones (prop `pie` del Modal): según la vista (resultado / formulario / cargando).
  const pie = resultado ? (
    resultado.traspaso.estado === 'fallido' ? (
      <>
        <button
          type="button"
          onClick={() => void reintentarTraspaso()}
          disabled={reintentando}
          className="rounded-lg bg-[#1f2a4d] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#2a376a] disabled:opacity-50"
        >
          {reintentando ? 'Reintentando…' : 'Reintentar traspaso'}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={reintentando}
          className="rounded-lg border px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
        >
          Cerrar
        </button>
      </>
    ) : (
      <button
        type="button"
        onClick={onClose}
        className="rounded-lg bg-[#1f2a4d] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#2a376a]"
      >
        Cerrar
      </button>
    )
  ) : isLoading || !form ? undefined : (
    <>
      <button
        type="button"
        onClick={onClose}
        className="rounded-lg border px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
      >
        Cancelar
      </button>
      <button
        type="submit"
        form={FORM_ID}
        disabled={guardando || traspasoIncompleto || actualizandoCandidatos}
        title={
          actualizandoCandidatos
            ? 'Actualizando los contratos de origen para la moneda elegida…'
            : traspasoIncompleto
              ? 'Escribe la nota y confirma que el depósito fue recibido, o desmarca los contratos de origen.'
              : undefined
        }
        className="rounded-lg bg-[#1f2a4d] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#2a376a] disabled:opacity-50"
      >
        {guardando ? 'Registrando…' : 'Registrar renovación'}
      </button>
    </>
  );

  return (
    <Modal
      abierto
      onCerrar={onClose}
      titulo={`Renovar plan · ${nombre}`}
      ancho="lg"
      cabeceraAzul
      bloqueado={guardando || reintentando}
      pie={pie}
    >
      {resultado ? (
        // Vista de resultado: el plan ya está creado (los datos del formulario quedan bloqueados).
        <div className="space-y-3">
          <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
            <b>Renovación registrada</b>
            {resultado.traspaso.estado === 'fallido' ? ' ✓' : ''} · {resultado.inicio}.
          </p>
          {resultado.traspaso.estado === 'aplicado' && (
            <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
              <b>Depósito traspasado {montoExacto(resultado.traspaso.total, resultado.divisa)}</b>{' '}
              desde {resultado.traspaso.contratos}{' '}
              {resultado.traspaso.contratos === 1 ? 'contrato' : 'contratos'} ·{' '}
              <b>
                Por cobrar {montoExacto(resultado.traspaso.restante, resultado.divisa)}{' '}
                {resultado.divisa}
              </b>
              {resultado.traspaso.pagada && (
                <> · el depósito del nuevo contrato quedó pagado por traspaso.</>
              )}
            </p>
          )}
          {resultado.traspaso.estado === 'fallido' && (
            <p
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
              role="alert"
            >
              <b>El traspaso no se aplicó.</b> {resultado.traspaso.mensaje} Puedes reintentarlo
              ahora o hacerlo después con el botón «Traspasar depósito» del plan.
            </p>
          )}
        </div>
      ) : isLoading || !form ? (
        <p className="py-10 text-center text-sm text-gray-400">Cargando datos del plan…</p>
      ) : (
        <form id={FORM_ID} onSubmit={registrar} className="space-y-3">
          <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
            La renovación inicia el <b>{fechaCorta(pre?.fecInicio ?? null)}</b> (día siguiente al
            fin del plan vigente, {fechaCorta(pre?.fecFinActual ?? null)}). Datos precargados con el
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

          {seccionTraspaso && (
            <TraspasoDepositoForm
              modo="renovar"
              candidatos={candidatos}
              depositoDestino={{ cantidad: depositoNuevo, divisa: form.moneda }}
              valor={traspaso}
              onChange={setTraspaso}
              deshabilitado={guardando || candidatosPrevios}
            />
          )}

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
        </form>
      )}
    </Modal>
  );
}
