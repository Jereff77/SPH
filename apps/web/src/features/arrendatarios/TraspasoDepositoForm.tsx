import { useId } from 'react';
import { InputFecha } from '@/components/InputFecha';
import { THEAD_STICKY, THEAD_TR } from '@/components/tabla/SortableTh';
import { hoyMexico, montoExacto, type TraspasoCandidato } from './arrendatarios.api';
import {
  NOTA_MAX,
  NOTA_MIN,
  calcularComplemento,
  etiquetaNave,
  etiquetasCandidato,
  fechaTraspasoValida,
  motivoBloqueo,
  notaValida,
  periodoCandidato,
  sugerenciaAdicional,
  type Tono,
  type TraspasoFormValor,
} from './traspaso-deposito.util';

const TONO_PILL: Record<Tono, string> = {
  verde: 'bg-green-100 text-green-700',
  gris: 'bg-gray-100 text-gray-500',
  ambar: 'bg-amber-100 text-amber-700',
  rojo: 'bg-red-100 text-red-600',
};

/** «Nave 13» → «La nave 13» (el resto de nombres se deja tal cual). */
const conArticulo = (nombre: string): string =>
  nombre.startsWith('Nave ') ? `La nave ${nombre.slice(5)}` : nombre;

function Pill({ tono, children }: { tono: Tono; children: React.ReactNode }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-px text-[11px] font-semibold ${TONO_PILL[tono]}`}
    >
      {children}
    </span>
  );
}

/**
 * Formulario **compartido** del traspaso de depósito de garantía (D1): lo usan la sección
 * de «Renovar» (`modo='renovar'`) y el modal «Traspasar depósito» (`modo='manual'`).
 *
 * La persona **elige orígenes** (casillas) — nunca teclea montos (D3): se traspasa el
 * `disponible` completo de cada uno. El complemento («Por cobrar en efectivo») se calcula
 * en vivo; si lo elegido supera el depósito se muestra el aviso y el padre bloquea confirmar
 * (`traspasoValido`). El servidor decide qué candidatos están bloqueados y por qué; aquí solo
 * se muestran con su motivo.
 */
export function TraspasoDepositoForm({
  candidatos,
  depositoDestino,
  valor,
  onChange,
  modo,
  deshabilitado = false,
}: {
  candidatos: TraspasoCandidato[];
  /** Depósito del contrato destino: en `renovar` el campo «Depósito garantía»; en `manual` el monto actual de la partida. */
  depositoDestino: { cantidad: number; divisa: string };
  valor: TraspasoFormValor;
  onChange: (v: TraspasoFormValor) => void;
  /** En `renovar` el plan que se renueva (`tipo: RENOVADO`) sale con la etiqueta «Mismo contrato (renovado)». */
  modo: 'renovar' | 'manual';
  deshabilitado?: boolean;
}) {
  const idNota = useId();
  const idFecha = useId();
  const { cantidad: deposito, divisa } = depositoDestino;
  const comp = calcularComplemento(deposito, candidatos, valor.origenes);
  const sugerencia = modo === 'renovar' ? sugerenciaAdicional(deposito, candidatos, valor.origenes) : null;
  const todasBloqueadas = candidatos.length > 0 && candidatos.every((c) => !!c.bloqueo);
  const notaLen = valor.nota.trim().length;
  const fechaMala = valor.fecTraspaso !== '' && !fechaTraspasoValida(valor.fecTraspaso, hoyMexico());

  const set = (parcial: Partial<TraspasoFormValor>) => onChange({ ...valor, ...parcial });
  const alternar = (id: string) =>
    set({
      origenes: valor.origenes.includes(id)
        ? valor.origenes.filter((x) => x !== id)
        : [...valor.origenes, id],
    });

  const textoComplemento =
    comp.contratos === 0
      ? 'Elige al menos un contrato de origen'
      : comp.excede
        ? `Lo elegido (${montoExacto(comp.traspasado, divisa)}) > ${modo === 'renovar' ? 'depósito nuevo' : 'depósito del contrato'} (${montoExacto(deposito, divisa)})`
        : modo === 'renovar'
          ? `Depósito del nuevo contrato ${montoExacto(deposito, divisa)} − traspaso elegido ${montoExacto(comp.traspasado, divisa)}`
          : `${montoExacto(deposito, divisa)} − ${montoExacto(comp.traspasado, divisa)}`;

  return (
    <div
      className={
        modo === 'renovar' ? 'space-y-2.5 border-t pt-3' : 'space-y-3'
      }
    >
      {modo === 'renovar' && (
        <div className="space-y-0.5">
          <h3 className="text-[13px] font-semibold text-gray-700">
            Traspasar depósito de contratos anteriores
          </h3>
          <p className="text-xs text-gray-500">
            Elige de dónde viene el depósito que SPH ya tiene de este arrendatario. No tecleas montos:
            se traspasa el disponible completo de cada contrato elegido.
          </p>
        </div>
      )}

      {/* Candidatos a origen */}
      <div className="scrollbar-hide overflow-auto rounded-lg border border-gray-200">
        <table className="min-w-full border-collapse text-[13px]">
          <thead className={THEAD_STICKY}>
            <tr className={THEAD_TR}>
              <th className="w-9 px-2.5 py-2.5" />
              <th className="px-2.5 py-2.5">Nave / contrato</th>
              <th className="px-2.5 py-2.5">Periodo</th>
              <th className="px-2.5 py-2.5">{todasBloqueadas ? 'Motivo del bloqueo' : 'Etiqueta'}</th>
              <th className="px-2.5 py-2.5 text-right">Disponible</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {candidatos.map((c) => {
              const bloqueado = !!c.bloqueo;
              const marcado = !bloqueado && valor.origenes.includes(c.idArrePdp);
              const monCand = c.moneda ?? divisa;
              const motivo = bloqueado ? motivoBloqueo(c, divisa) : null;
              return (
                <tr key={c.idArrePdp} className={bloqueado ? 'bg-gray-50 text-gray-400' : 'bg-white'}>
                  <td className="px-2.5 py-2 align-top">
                    <input
                      type="checkbox"
                      checked={marcado}
                      disabled={bloqueado || deshabilitado}
                      onChange={() => alternar(c.idArrePdp)}
                      aria-label={`Traspasar el depósito de ${etiquetaNave(c.nave)}, ${periodoCandidato(c)}`}
                      className="mt-0.5 h-4 w-4 accent-[#1f2a4d] disabled:cursor-not-allowed"
                    />
                  </td>
                  <td className="px-2.5 py-2 align-top">{etiquetaNave(c.nave)}</td>
                  <td className="whitespace-nowrap px-2.5 py-2 align-top tabular-nums">
                    {periodoCandidato(c)}
                  </td>
                  <td className="px-2.5 py-2 align-top">
                    {motivo ? (
                      <>
                        <Pill tono={motivo.tono}>{motivo.titulo}</Pill>
                        <div className="mt-0.5 text-[11px] leading-snug text-gray-500">
                          {motivo.detalle}
                        </div>
                      </>
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {etiquetasCandidato(c, modo).map((e) => (
                          <Pill key={e.texto} tono={e.tono}>
                            {e.texto}
                          </Pill>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 text-right align-top tabular-nums">
                    {c.bloqueo === 'DEPOSITO_NO_ESTANDAR' || c.bloqueo === 'DEPOSITO_AMBIGUO' ? (
                      '—'
                    ) : c.bloqueo === 'DEPOSITO_EN_CERO' ? (
                      <>
                        {montoExacto(c.cantidad, monCand)}
                        <div className="text-[11px]">(plan: {montoExacto(c.depositoPlan, monCand)})</div>
                      </>
                    ) : (
                      montoExacto(c.disponible, monCand)
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Complemento resultante (grande, fijo bajo la lista) */}
      <div
        className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 ${
          comp.excede ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'
        }`}
        aria-live="polite"
      >
        <div>
          <span className="block text-xs text-gray-500">{textoComplemento}</span>
          <b className="text-[13px] text-gray-700">Por cobrar en efectivo</b>
        </div>
        <div
          className={`shrink-0 whitespace-nowrap text-xl font-bold tabular-nums ${comp.excede ? 'text-red-600' : 'text-[#1f2a4d]'}`}
        >
          {comp.excede
            ? '—'
            : `${montoExacto(comp.contratos === 0 ? deposito : comp.complemento, divisa)} ${divisa}`}
        </div>
      </div>

      {comp.excede && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          Lo que eliges ({montoExacto(comp.traspasado, divisa)}) supera el{' '}
          {modo === 'renovar' ? 'depósito del nuevo contrato' : 'depósito de este contrato'} (
          {montoExacto(deposito, divisa)}). Quita un origen
          {modo === 'renovar' ? ' o ajusta el depósito nuevo' : ''}.
        </p>
      )}

      {sugerencia && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          💡{' '}
          {sugerencia.naves.length === 1
            ? `${conArticulo(sugerencia.naves[0]!)} vence el mismo día.`
            : `${sugerencia.naves.join(', ')} vencen el mismo día.`}{' '}
          Si los {montoExacto(deposito, divisa)} cubren{' '}
          {sugerencia.contratos === 2 ? 'las dos naves' : 'todos esos contratos'}, márcala
          {sugerencia.naves.length === 1 ? '' : 's'}: el complemento bajaría a{' '}
          <b>{montoExacto(sugerencia.complemento, divisa)}</b>.
        </p>
      )}

      {/* Nota obligatoria */}
      <div className="text-xs text-gray-600">
        <label htmlFor={idNota}>
          Nota (obligatoria, mín. {NOTA_MIN} caracteres)
          {modo === 'renovar' ? ' — folio o número de contrato del depósito anterior' : ''}
        </label>
        <input
          id={idNota}
          type="text"
          value={valor.nota}
          maxLength={NOTA_MAX}
          disabled={deshabilitado}
          onChange={(e) => set({ nota: e.target.value })}
          placeholder={
            modo === 'renovar'
              ? 'Ej.: Contrato SPH-2025-12, cláusula de depósito'
              : 'Folio o número de contrato del depósito anterior'
          }
          className="mt-1 block w-full rounded border px-2 py-1.5 text-sm text-gray-800"
        />
        <span
          className={`mt-0.5 block text-right text-[11px] ${
            notaValida(valor.nota) ? 'text-gray-400' : 'text-amber-600'
          }`}
        >
          {notaLen}/{NOTA_MAX}
        </span>
      </div>

      {/* Fecha del traspaso + confirmación */}
      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_2fr]">
        <div className="text-xs text-gray-600">
          <label htmlFor={idFecha}>Fecha del traspaso</label>
          <InputFecha
            id={idFecha}
            value={valor.fecTraspaso}
            onChange={(iso) => set({ fecTraspaso: iso })}
            disabled={deshabilitado}
            className="mt-1 block w-full rounded border px-2 py-1.5 text-sm text-gray-800"
          />
          {(fechaMala || valor.fecTraspaso === '') && (
            <span className="mt-0.5 block text-[11px] text-red-600">
              {valor.fecTraspaso === ''
                ? 'Captura la fecha (dd/mm/aaaa).'
                : 'La fecha no puede ser futura.'}
            </span>
          )}
        </div>
        <label className="flex items-start gap-2 pb-1.5 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={valor.confirmado}
            disabled={deshabilitado}
            onChange={(e) => set({ confirmado: e.target.checked })}
            className="mt-0.5 h-4 w-4 accent-[#1f2a4d]"
          />
          Confirmo que el depósito del contrato anterior fue recibido
        </label>
      </div>
    </div>
  );
}
