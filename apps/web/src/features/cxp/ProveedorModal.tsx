import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  proveedoresApi,
  TIPOS_CUENTA,
  PERSONALIDADES,
  type Proveedor,
  type ProveedorDto,
} from './proveedores.api';
import { ApiRequestError } from '@/lib/api';

interface Props {
  proveedor?: Proveedor | null; // editar si viene; alta si no
  onClose: () => void;
  onListo: () => void;
}

const inputCls =
  'mt-1 block w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30';

export function ProveedorModal({ proveedor, onClose, onListo }: Props) {
  const esEdicion = !!proveedor;
  const [f, setF] = useState<ProveedorDto>({
    razonSocial: proveedor?.razonSocial ?? '',
    rfc: proveedor?.rfc ?? '',
    nombre: proveedor?.nombre ?? '',
    apellidos: proveedor?.apellidos ?? '',
    email: proveedor?.email ?? '',
    telefono: proveedor?.telefono ?? '',
    nombreBanco: proveedor?.nombreBanco ?? '',
    tipoCuenta: proveedor?.tipoCuenta ?? '',
    noCuenta: proveedor?.noCuenta ?? '',
    personalidad: (proveedor?.personalidad as 'Fisica' | 'Moral') || undefined,
    numIdentificacion: proveedor?.numIdentificacion ?? '',
  });
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof ProveedorDto>(k: K, v: ProveedorDto[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));

  const guardar = useMutation({
    mutationFn: async (): Promise<void> => {
      const dto: ProveedorDto = { ...f, rfc: f.rfc.trim().toUpperCase() };
      if (esEdicion) await proveedoresApi.editar(proveedor.idProveedor, dto);
      else await proveedoresApi.crear(dto);
    },
    onSuccess: onListo,
    onError: (e) =>
      setError(e instanceof ApiRequestError ? e.message : 'No se pudo guardar.'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (f.razonSocial.trim() === '') return setError('La razón social es obligatoria.');
    if (f.rfc.trim().length < 12) return setError('El RFC debe tener 12 o 13 caracteres.');
    if (f.nombreBanco.trim() === '') return setError('El banco es obligatorio.');
    if (f.tipoCuenta.trim() === '') return setError('El tipo de cuenta es obligatorio.');
    guardar.mutate();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-gray-800">
          {esEdicion ? 'Editar proveedor' : 'Nuevo proveedor'}
        </h2>

        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <label className="block text-xs text-gray-600">
          Razón social *
          <input
            value={f.razonSocial}
            onChange={(e) => set('razonSocial', e.target.value)}
            className={inputCls}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs text-gray-600">
            RFC *
            <input
              value={f.rfc}
              onChange={(e) => set('rfc', e.target.value.toUpperCase())}
              className={inputCls}
            />
          </label>
          <label className="block text-xs text-gray-600">
            Personalidad
            <select
              value={f.personalidad ?? ''}
              onChange={(e) =>
                set('personalidad', (e.target.value || undefined) as ProveedorDto['personalidad'])
              }
              className={inputCls}
            >
              <option value="">—</option>
              {PERSONALIDADES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-gray-600">
            Nombre
            <input
              value={f.nombre}
              onChange={(e) => set('nombre', e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block text-xs text-gray-600">
            Apellidos
            <input
              value={f.apellidos}
              onChange={(e) => set('apellidos', e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block text-xs text-gray-600">
            Correo
            <input
              type="email"
              value={f.email}
              onChange={(e) => set('email', e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block text-xs text-gray-600">
            Teléfono
            <input
              value={f.telefono}
              onChange={(e) => set('telefono', e.target.value)}
              className={inputCls}
            />
          </label>
        </div>

        <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Datos bancarios
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs text-gray-600">
            Banco *
            <input
              value={f.nombreBanco}
              onChange={(e) => set('nombreBanco', e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block text-xs text-gray-600">
            Tipo de cuenta *
            <select
              value={f.tipoCuenta}
              onChange={(e) => set('tipoCuenta', e.target.value)}
              className={inputCls}
            >
              <option value="">Selecciona…</option>
              {TIPOS_CUENTA.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
              {/* Conserva un valor heredado de v1 que no esté en la lista. */}
              {f.tipoCuenta && !TIPOS_CUENTA.includes(f.tipoCuenta as never) && (
                <option value={f.tipoCuenta}>{f.tipoCuenta}</option>
              )}
            </select>
          </label>
          <label className="col-span-2 block text-xs text-gray-600">
            Número de cuenta / CLABE
            <input
              value={f.noCuenta}
              onChange={(e) => set('noCuenta', e.target.value)}
              className={inputCls}
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardar.isPending}
            className="rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white hover:bg-[#172039] disabled:opacity-50"
          >
            {guardar.isPending ? 'Guardando…' : esEdicion ? 'Guardar' : 'Crear'}
          </button>
        </div>
      </form>
    </div>
  );
}
