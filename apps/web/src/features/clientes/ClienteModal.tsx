import { useState } from 'react';
import {
  clientesApi,
  type Cliente,
  type ClienteInput,
  type RfcCoincidencia,
  type VerificarRfcResp,
} from './clientes.api';

const vacio = (
  pre: Partial<ClienteInput> = {},
): ClienteInput => ({
  nombre: '',
  apellido1: '',
  apellido2: '',
  telefono: '',
  correo: '',
  RFC: '',
  CURP: '',
  idContpac: '',
  razonsocial: '',
  personalidad: '',
  fecNacimiento: '',
  inversionista: false,
  arrendatario: false,
  ticket: false,
  usuarioFinal: false,
  permitirSimilar: false,
  ...pre,
});

const desdeCliente = (c: Cliente): ClienteInput => ({
  nombre: c.nombre ?? '',
  apellido1: c.apellido1 ?? '',
  apellido2: c.apellido2 ?? '',
  telefono: c.telefono ?? '',
  correo: c.correo ?? '',
  RFC: c.RFC ?? '',
  CURP: c.CURP ?? '',
  idContpac: c.idContpac ?? '',
  razonsocial: c.razonsocial ?? '',
  personalidad: c.personalidad ?? '',
  fecNacimiento: c.fecNacimiento ?? '',
  inversionista: c.inversionista,
  arrendatario: c.arrendatario,
  ticket: c.ticket,
  usuarioFinal: c.usuarioFinal,
  permitirSimilar: false,
});

/** Tipos de cliente (banderas) con su etiqueta legible. */
const TIPOS: { k: 'inversionista' | 'arrendatario' | 'ticket' | 'usuarioFinal'; label: string }[] = [
  { k: 'inversionista', label: 'Inversionista' },
  { k: 'arrendatario', label: 'Arrendatario' },
  { k: 'ticket', label: 'Ticket' },
  { k: 'usuarioFinal', label: 'Usuario final' },
];

const BASES_GENERICAS = ['XAXX010101', 'XEXX010101'];
const RFC_RE = /^([A-ZÑ&]{3,4}\d{6})([A-Z0-9]{0,3})$/;
const normalizarRfc = (v: string) => v.toUpperCase().replace(/[^A-ZÑ&0-9]/g, '');

/** Valida el RFC en el front (espejo del backend). Devuelve el error o null. */
function validarRfcLocal(rfc: string): string | null {
  const n = normalizarRfc(rfc);
  if (!n) return 'El RFC es obligatorio.';
  const m = RFC_RE.exec(n);
  if (!m) return 'RFC con formato inválido.';
  if (BASES_GENERICAS.includes(m[1]!))
    return 'El RFC genérico no está permitido. Captura el RFC real del cliente.';
  return null;
}

const nombreCoincidencia = (c: RfcCoincidencia): string =>
  c.razonsocial?.trim() ||
  [c.nombre, c.apellido1, c.apellido2].filter(Boolean).join(' ') ||
  'otro cliente';

const tiposDe = (c: RfcCoincidencia): string =>
  TIPOS.filter((t) => c[t.k]).map((t) => t.label).join(', ') || 'sin tipo asignado';

/** Alta/edición de un cliente (replica `DatInversionistaWidget` de v1). */
export function ClienteModal({
  cliente,
  preset,
  onClose,
  onGuardado,
  onAbrirExistente,
}: {
  /** Si viene, es edición; si no, alta. */
  cliente?: Cliente | null;
  /** Banderas de tipo preseleccionadas en alta (según el chip activo). */
  preset?: Partial<ClienteInput>;
  onClose: () => void;
  onGuardado: () => void;
  /** Abre el registro existente (en edición) cuando se detecta un duplicado. */
  onAbrirExistente?: (
    idInversionista: string,
    tipoSugerido?: 'inversionista' | 'arrendatario' | 'ticket' | 'usuarioFinal',
  ) => void;
}) {
  const [form, setForm] = useState<ClienteInput>(
    cliente ? desdeCliente(cliente) : vacio(preset),
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rfcError, setRfcError] = useState<string | null>(null);
  const [dup, setDup] = useState<VerificarRfcResp | null>(null);
  const [verificando, setVerificando] = useState(false);

  const set = (k: keyof ClienteInput, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  /** Cambia el RFC (uppercase) y limpia las validaciones previas. */
  const setRfc = (v: string) => {
    setForm((f) => ({ ...f, RFC: v.toUpperCase(), permitirSimilar: false }));
    setRfcError(null);
    setDup(null);
  };

  /** Verifica el RFC contra la BD. Devuelve la respuesta o null si hay error local. */
  async function verificarRfc(): Promise<VerificarRfcResp | null> {
    const err = validarRfcLocal(form.RFC ?? '');
    if (err) {
      setRfcError(err);
      setDup(null);
      return null;
    }
    setRfcError(null);
    setVerificando(true);
    try {
      const resp = await clientesApi.verificarRfc(form.RFC ?? '', cliente?.idInversionista);
      setDup(resp);
      return resp;
    } catch {
      // Si la verificación falla, no bloqueamos por front; el backend es la red final.
      setDup(null);
      return null;
    } finally {
      setVerificando(false);
    }
  }

  const exacta = dup?.coincidencias.find((c) => c.tipoCoincidencia === 'exacto') ?? null;
  const similar = dup?.coincidencias.find((c) => c.tipoCoincidencia === 'base') ?? null;
  // Tipos que el usuario quiere y que el registro existente aún NO tiene.
  const faltantes = exacta
    ? TIPOS.filter((t) => form[t.k] && !exacta[t.k])
    : [];
  // El alta/guardado se bloquea ante coincidencia exacta, o ante similar no confirmada.
  const bloqueado = !!exacta || (!!similar && !form.permitirSimilar);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.nombre.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    const rfcErr = validarRfcLocal(form.RFC ?? '');
    if (rfcErr) {
      setRfcError(rfcErr);
      return;
    }
    // Re-verifica justo antes de guardar (por si no se disparó el onBlur).
    const resp = await verificarRfc();
    if (resp) {
      const ex = resp.coincidencias.find((c) => c.tipoCoincidencia === 'exacto');
      const si = resp.coincidencias.find((c) => c.tipoCoincidencia === 'base');
      if (ex || (si && !form.permitirSimilar)) return; // las tarjetas guían la acción
    }
    setGuardando(true);
    try {
      if (cliente) await clientesApi.actualizar(cliente.idInversionista, form);
      else await clientesApi.crear(form);
      onGuardado();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el cliente.');
    } finally {
      setGuardando(false);
    }
  }

  const campo = (label: string, k: keyof ClienteInput, type = 'text', max?: number) => (
    <label className="text-xs text-gray-600">
      {label}
      <input
        type={type}
        maxLength={max}
        value={(form[k] as string) ?? ''}
        onChange={(e) => set(k, e.target.value)}
        className="mt-1 block w-full rounded border px-2 py-1.5 text-sm"
      />
    </label>
  );

  const check = (label: string, k: keyof ClienteInput) => (
    <label className="flex items-center gap-2 text-sm text-gray-700">
      <input
        type="checkbox"
        checked={form[k] as boolean}
        onChange={(e) => set(k, e.target.checked)}
        className="h-4 w-4"
      />
      {label}
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={guardar}
        className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b bg-[#1f2a4d] px-5 py-3 text-white">
          <h2 className="text-base font-semibold">
            {cliente ? 'Editar cliente' : 'Nuevo cliente'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="text-xs text-gray-600">
              Personalidad
              <select
                value={form.personalidad}
                onChange={(e) => set('personalidad', e.target.value)}
                className="mt-1 block w-full rounded border px-2 py-1.5 text-sm"
              >
                <option value="">—</option>
                {/* value sin acento ('Fisica') = canónico compatible con v1; la etiqueta sí lleva acento. */}
                <option value="Fisica">Física</option>
                <option value="Moral">Moral</option>
              </select>
            </label>
            {campo('Nombre *', 'nombre')}
            {campo('Razón social', 'razonsocial')}
            {campo('Primer apellido', 'apellido1')}
            {campo('Segundo apellido', 'apellido2')}
            {campo('Fecha de nacimiento', 'fecNacimiento', 'date')}
            {campo('Teléfono', 'telefono')}
            {campo('Correo', 'correo', 'email')}
            {campo('Contpaq ID', 'idContpac')}
            <label className="text-xs text-gray-600">
              RFC *
              <input
                type="text"
                maxLength={14}
                value={form.RFC ?? ''}
                onChange={(e) => setRfc(e.target.value)}
                onBlur={() => void verificarRfc()}
                className={`mt-1 block w-full rounded border px-2 py-1.5 text-sm uppercase ${
                  rfcError || exacta ? 'border-red-400' : similar ? 'border-amber-400' : ''
                }`}
                placeholder="Ej. VIBA7007129F6"
              />
            </label>
            {campo('CURP', 'CURP', 'text', 18)}
          </div>

          {verificando && (
            <p className="text-xs text-gray-400">Verificando RFC…</p>
          )}
          {rfcError && <p className="text-xs text-red-600">{rfcError}</p>}

          {/* Duplicado EXACTO: mismo cliente → editar, no recrear. */}
          {exacta && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm">
              {faltantes.length > 0 ? (
                <>
                  <p className="font-semibold text-red-700">
                    Este RFC ya existe: {nombreCoincidencia(exacta)} ({tiposDe(exacta)}).
                  </p>
                  <p className="mt-1 text-red-700">
                    Para agregarlo como {faltantes.map((t) => t.label).join(', ')} no crees otro
                    registro: abre el suyo y marca esa casilla.
                  </p>
                  {onAbrirExistente && (
                    <button
                      type="button"
                      onClick={() => onAbrirExistente(exacta.idInversionista, faltantes[0]!.k)}
                      className="mt-2 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                    >
                      Abrir y marcar {faltantes[0]!.label}
                    </button>
                  )}
                </>
              ) : (
                <>
                  <p className="font-semibold text-red-700">
                    {nombreCoincidencia(exacta)} ya está registrado ({tiposDe(exacta)}). No lo
                    registres de nuevo.
                  </p>
                  {onAbrirExistente && (
                    <button
                      type="button"
                      onClick={() => onAbrirExistente(exacta.idInversionista)}
                      className="mt-2 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                    >
                      Abrir su registro
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Posible duplicado por BASE (homoclave distinta): el usuario decide. */}
          {!exacta && similar && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
              <p className="font-semibold text-amber-800">
                Hay un cliente con un RFC muy parecido: {nombreCoincidencia(similar)} (
                {tiposDe(similar)}). Difiere en la homoclave; verifica si es la misma persona.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {onAbrirExistente && (
                  <button
                    type="button"
                    onClick={() => onAbrirExistente(similar.idInversionista)}
                    className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
                  >
                    Abrir su registro
                  </button>
                )}
                {!form.permitirSimilar && (
                  <button
                    type="button"
                    onClick={() => set('permitirSimilar', true)}
                    className="rounded-lg border border-amber-500 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
                  >
                    Es otra persona, registrar de todos modos
                  </button>
                )}
                {form.permitirSimilar && (
                  <span className="text-xs text-amber-700">
                    ✓ Confirmaste que es otra persona; ya puedes guardar.
                  </span>
                )}
              </div>
            </div>
          )}

          <div>
            <p className="mb-1 text-xs font-semibold text-gray-500">Tipo de cliente</p>
            <div className="flex flex-wrap gap-4">
              {check('Inversionista', 'inversionista')}
              {check('Arrendatario', 'arrendatario')}
              {check('Ticket', 'ticket')}
              {check('Usuario final', 'usuarioFinal')}
            </div>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando || verificando || bloqueado}
            className="rounded-lg bg-[#1f2a4d] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#2a376a] disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  );
}
