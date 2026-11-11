import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { arrendatariosApi, montoExacto, type TraspasarResultado } from './arrendatarios.api';
import { TraspasoDepositoForm } from './TraspasoDepositoForm';
import {
  calcularComplemento,
  debeRecargar,
  esOcupado,
  invalidarTraspasos,
  mensajeError,
  nuevaClave,
  origenesVigentes,
  statusError,
  traspasoValido,
  valorInicialTraspaso,
} from './traspaso-deposito.util';

interface ErrorEnvio {
  mensaje: string;
  /** «Otro usuario está modificando este depósito» (`OCUPADO`): reintento simple, sin recargar. */
  ocupado: boolean;
  /** Cambió el depósito o la lista mientras operabas: se ofrece «Recargar». */
  recargar: boolean;
}

const BTN_SEC = 'rounded-lg border px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50';
const BTN_PRI =
  'rounded-lg bg-[#1f2a4d] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#2a376a] disabled:cursor-not-allowed disabled:opacity-50';

function Tarjeta({
  etiqueta,
  valor,
  resaltada = false,
}: {
  etiqueta: string;
  valor: string;
  resaltada?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-2 ${
        resaltada ? 'border-[#1f2a4d] bg-indigo-50' : 'border-gray-200 bg-white'
      }`}
    >
      <small className="block text-[11px] text-gray-500">{etiqueta}</small>
      <b className="text-[17px] tabular-nums text-[#1f2a4d]">{valor}</b>
    </div>
  );
}

/**
 * Modal «Traspasar depósito» (botón manual del plan destino, permiso 25): resumen del
 * depósito + `TraspasoDepositoForm modo='manual'`. Un solo paso: el formulario ya es la
 * confirmación. La clave de idempotencia (UUID) se genera al abrir y se renueva tras un
 * rechazo 4xx definitivo; en un `OCUPADO` o un corte de red se reusa (no duplica, D15).
 */
export function TraspasarDepositoModal({
  idArrePdp,
  nombre,
  divisaPlan,
  onClose,
  onTraspasado,
}: {
  idArrePdp: string;
  nombre: string;
  /** Moneda del plan: respaldo si la partida de depósito trae moneda vacía. */
  divisaPlan?: string | null;
  onClose: () => void;
  onTraspasado?: () => void;
}) {
  const queryClient = useQueryClient();
  const info = useQuery({
    queryKey: ['arre-deposito', idArrePdp],
    queryFn: () => arrendatariosApi.depositoPlan(idArrePdp),
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const cand = useQuery({
    queryKey: ['arre-traspaso-origenes', idArrePdp],
    queryFn: () => arrendatariosApi.traspasoOrigenes(idArrePdp),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const [valor, setValor] = useState(() => valorInicialTraspaso());
  const [clave, setClave] = useState(() => nuevaClave());
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<ErrorEnvio | null>(null);
  const [resultado, setResultado] = useState<TraspasarResultado | null>(null);

  const deposito = info.data?.deposito ?? null;
  const lista = cand.data ?? [];
  // Moneda de la partida; si viene vacía/sucia ('' o 'null'), la del plan.
  const divisa =
    deposito?.moneda === 'USD' || deposito?.moneda === 'MXN'
      ? deposito.moneda
      : divisaPlan === 'USD'
        ? 'USD'
        : 'MXN';
  const cargando = info.isLoading || cand.isLoading;
  const falloCarga = info.error ?? cand.error;
  const cubierto = !!deposito && (deposito.pagada || deposito.cantidad <= 0);
  const sinCandidatos = !cargando && !falloCarga && !!deposito && !cubierto && lista.length === 0;
  const comp = calcularComplemento(deposito?.cantidad ?? 0, lista, valor.origenes);
  const puede = !!deposito && !cubierto && traspasoValido(valor, lista, deposito.cantidad);
  const ocupado = !!error?.ocupado;

  async function enviar() {
    if (!deposito || !puede || enviando) return;
    setError(null);
    setEnviando(true);
    try {
      const r = await arrendatariosApi.traspasarDeposito(idArrePdp, {
        origenes: origenesVigentes(lista, valor.origenes),
        fecTraspaso: valor.fecTraspaso,
        nota: valor.nota.trim(),
        confirmado: true,
        claveIdempotencia: clave,
      });
      setResultado(r);
      invalidarTraspasos(queryClient);
      onTraspasado?.();
    } catch (err) {
      const status = statusError(err);
      const bloqueoTemporal = esOcupado(err);
      setError({
        mensaje: mensajeError(err, 'No se pudo traspasar el depósito.'),
        ocupado: bloqueoTemporal,
        recargar: debeRecargar(err),
      });
      // Rechazo definitivo (4xx): nada se aplicó, la siguiente vez va con clave nueva.
      // Si estaba ocupado, o fue un corte de red/5xx, se reusa la misma (idempotente).
      if (status !== null && status >= 400 && status < 500 && !bloqueoTemporal) {
        setClave(nuevaClave());
      }
    } finally {
      setEnviando(false);
    }
  }

  async function recargar() {
    setError(null);
    setClave(nuevaClave());
    setValor((v) => ({ ...v, origenes: [] }));
    await Promise.all([cand.refetch(), info.refetch()]);
  }

  const titulo = `Traspasar depósito · ${nombre}`;

  // ---- Resultado (éxito) ----
  if (resultado) {
    return (
      <Modal
        abierto
        onCerrar={onClose}
        titulo={titulo}
        ancho="md"
        cabeceraAzul
        pie={
          <button type="button" onClick={onClose} className={BTN_PRI}>
            Cerrar
          </button>
        }
      >
        <div className="space-y-3">
          <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
            <b>Depósito traspasado {montoExacto(resultado.total, divisa)}</b> · Por cobrar{' '}
            <b>
              {montoExacto(resultado.cantidadRestante, divisa)} {divisa}
            </b>
          </p>
          {resultado.pagadaPorTraspaso && (
            <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
              El depósito de este contrato quedó <b>pagado por traspaso</b>: no hay nada que cobrar.
            </p>
          )}
        </div>
      </Modal>
    );
  }

  // ---- Sin candidatos / sin depósito traspasable / error de carga ----
  if (sinCandidatos || (!cargando && (falloCarga || !deposito || cubierto))) {
    return (
      <Modal
        abierto
        onCerrar={onClose}
        titulo={titulo}
        ancho="sm"
        cabeceraAzul
        pie={
          <button type="button" onClick={onClose} className={BTN_PRI}>
            Cerrar
          </button>
        }
      >
        <div className="space-y-3">
          {falloCarga ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              {mensajeError(falloCarga, 'No se pudo consultar el depósito.')}
            </p>
          ) : !deposito ? (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Este contrato no tiene una partida de depósito de garantía.
            </p>
          ) : cubierto ? (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              El depósito de este contrato ya está pagado o cubierto: no admite más traspasos.
            </p>
          ) : (
            <>
              <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                No hay contratos anteriores de este arrendatario con depósito disponible para este
                contrato.
              </p>
              <p className="text-xs text-gray-500">
                Si debería haberlos, revisa que el contrato anterior esté terminado, sea del mismo
                arrendatario y de la misma moneda.
              </p>
            </>
          )}
        </div>
      </Modal>
    );
  }

  // ---- Formulario ----
  return (
    <Modal
      abierto
      onCerrar={onClose}
      titulo={titulo}
      ancho={ocupado ? 'sm' : 'lg'}
      cabeceraAzul
      bloqueado={enviando}
      pie={
        ocupado ? (
          <>
            <button type="button" onClick={onClose} className={BTN_SEC}>
              Cerrar
            </button>
            <button type="button" onClick={() => void enviar()} disabled={enviando} className={BTN_PRI}>
              {enviando ? 'Traspasando…' : 'Reintentar'}
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={onClose} disabled={enviando} className={BTN_SEC}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void enviar()}
              disabled={!puede || enviando}
              title={
                puede
                  ? undefined
                  : 'Elige al menos un contrato, escribe la nota, confirma y cuida que no supere el depósito.'
              }
              className={BTN_PRI}
            >
              {enviando ? 'Traspasando…' : 'Traspasar depósito'}
            </button>
          </>
        )
      }
    >
      {cargando || !deposito ? (
        <p className="py-10 text-center text-sm text-gray-400">Cargando…</p>
      ) : ocupado ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <b>Otro usuario está modificando este depósito.</b> Espera unos segundos e inténtalo de nuevo.
        </p>
      ) : (
        <div className="space-y-3">
          {/* Resumen del destino (D14) */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <Tarjeta etiqueta="Depósito contractual" valor={montoExacto(deposito.contractual, divisa)} />
            <Tarjeta
              etiqueta={
                comp.contratos === 0
                  ? 'Traspasado'
                  : deposito.recibido > 0
                    ? 'Traspasado (con esta operación)'
                    : 'Traspasado (esta operación)'
              }
              valor={montoExacto(deposito.recibido + comp.traspasado, divisa)}
            />
            <Tarjeta
              resaltada
              etiqueta="Por cobrar"
              valor={comp.excede ? '—' : montoExacto(comp.complemento, divisa)}
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800" role="alert">
              {error.recargar ? (
                <>
                  {error.mensaje} No se aplicó nada. Recarga para ver los datos actuales y vuelve a
                  elegir.{' '}
                  <button
                    type="button"
                    onClick={() => void recargar()}
                    className="ml-1 rounded bg-[#1f2a4d] px-2.5 py-0.5 text-xs font-medium text-white hover:bg-[#2a376a]"
                  >
                    Recargar
                  </button>
                </>
              ) : (
                error.mensaje
              )}
            </div>
          )}

          <TraspasoDepositoForm
            candidatos={lista}
            depositoDestino={{ cantidad: deposito.cantidad, divisa }}
            valor={valor}
            onChange={(v) => {
              setValor(v);
              if (error) setError(null);
            }}
            modo="manual"
            deshabilitado={enviando}
          />
        </div>
      )}
    </Modal>
  );
}
