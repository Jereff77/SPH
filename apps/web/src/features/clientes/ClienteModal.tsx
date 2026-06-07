import { useState } from 'react';
import { clientesApi, type Cliente, type ClienteInput } from './clientes.api';

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
});

/** Alta/edición de un cliente (replica `DatInversionistaWidget` de v1). */
export function ClienteModal({
  cliente,
  preset,
  onClose,
  onGuardado,
}: {
  /** Si viene, es edición; si no, alta. */
  cliente?: Cliente | null;
  /** Banderas de tipo preseleccionadas en alta (según el chip activo). */
  preset?: Partial<ClienteInput>;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const [form, setForm] = useState<ClienteInput>(
    cliente ? desdeCliente(cliente) : vacio(preset),
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof ClienteInput, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.nombre.trim()) {
      setError('El nombre es obligatorio.');
      return;
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
                <option value="Física">Física</option>
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
            {campo('RFC', 'RFC', 'text', 14)}
            {campo('CURP', 'CURP', 'text', 18)}
          </div>

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
            disabled={guardando}
            className="rounded-lg bg-[#1f2a4d] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#2a376a] disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  );
}
