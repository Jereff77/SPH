import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { authApi } from './auth.api';
import { ApiRequestError } from '@/lib/api';
import { IconEye, IconEyeOff } from '@/components/icons';

export function CambiarContrasenaPage() {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [ver, setVer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  const cambiar = useMutation({
    mutationFn: () => authApi.cambiarContrasena(actual, nueva),
    onSuccess: () => {
      setExito(true);
      setError(null);
      setActual('');
      setNueva('');
      setConfirmar('');
    },
    onError: (e) =>
      setError(
        e instanceof ApiRequestError ? e.message : 'No se pudo cambiar la contraseña.',
      ),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setExito(false);
    if (nueva.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (nueva !== confirmar) {
      setError('La nueva contraseña y su confirmación no coinciden.');
      return;
    }
    setError(null);
    cambiar.mutate();
  }

  const inputCls =
    'w-full rounded-xl border border-gray-300 px-4 py-3 pr-11 text-sm outline-none focus:border-[#3f5b87] focus:ring-2 focus:ring-[#3f5b87]/30';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-800">
          Cambiar contraseña
        </h1>
        <p className="text-sm text-gray-500">
          Actualiza tu contraseña de acceso.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="max-w-md space-y-4 rounded-xl border bg-white p-5 shadow-sm"
      >
        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        {exito && (
          <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            Tu contraseña se actualizó correctamente.
          </div>
        )}

        <div className="relative">
          <label className="text-xs font-medium text-gray-600">
            Contraseña actual
          </label>
          <input
            type={ver ? 'text' : 'password'}
            autoComplete="current-password"
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            className={`mt-1 ${inputCls}`}
          />
        </div>

        <div className="relative">
          <label className="text-xs font-medium text-gray-600">
            Nueva contraseña
          </label>
          <input
            type={ver ? 'text' : 'password'}
            autoComplete="new-password"
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            className={`mt-1 ${inputCls}`}
          />
        </div>

        <div className="relative">
          <label className="text-xs font-medium text-gray-600">
            Confirmar nueva contraseña
          </label>
          <input
            type={ver ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            className={`mt-1 ${inputCls}`}
          />
          <button
            type="button"
            onClick={() => setVer((v) => !v)}
            aria-label={ver ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}
            className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600"
          >
            {ver ? <IconEyeOff /> : <IconEye />}
          </button>
        </div>

        <button
          type="submit"
          disabled={cambiar.isPending || !actual || !nueva || !confirmar}
          className="w-full rounded-xl bg-[#1f2a4d] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#172039] disabled:opacity-60"
        >
          {cambiar.isPending ? 'Cambiando…' : 'Cambiar contraseña'}
        </button>
      </form>
    </div>
  );
}
