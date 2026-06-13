import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { invitacionesApi } from '@/features/usuarios/invitaciones.api';
import { ApiRequestError } from '@/lib/api';
import { Logo } from '@/components/Logo';
import { IconEye, IconEyeOff } from '@/components/icons';

/**
 * Página PÚBLICA de registro por invitación. Lee el token de la URL
 * (?token=XXX), valida contra el backend y muestra el formulario para que el
 * invitado complete sus datos y defina su contraseña. El correo se muestra fijo
 * (viene de la invitación; no es editable).
 */
export function RegistroPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const {
    data: invitacion,
    isLoading,
    isError,
    error: errorValidacion,
  } = useQuery({
    queryKey: ['invitacion', token],
    queryFn: () => invitacionesApi.validar(token),
    enabled: Boolean(token),
    retry: false,
  });

  if (!token) {
    return <Mensaje titulo="Enlace inválido" texto="No se encontró el token de invitación en el enlace." />;
  }
  if (isLoading) {
    return <Mensaje titulo="Verificando invitación…" texto="Un momento, por favor." />;
  }
  if (isError || !invitacion) {
    const msg =
      errorValidacion instanceof ApiRequestError
        ? errorValidacion.message
        : 'La invitación no es válida o ha expirado.';
    return <Mensaje titulo="Invitación no válida" texto={msg} />;
  }

  return <Formulario token={token} email={invitacion.email} nombreInicial={invitacion.nombre} apellidosIniciales={invitacion.apellidos} />;
}

function Formulario({
  token,
  email,
  nombreInicial,
  apellidosIniciales,
}: {
  token: string;
  email: string;
  nombreInicial: string | null;
  apellidosIniciales: string | null;
}) {
  const [nombre, setNombre] = useState(nombreInicial ?? '');
  const [apellidos, setApellidos] = useState(apellidosIniciales ?? '');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  const m = useMutation({
    mutationFn: () =>
      invitacionesApi.aceptar({
        token,
        nombre: nombre.trim(),
        apellidos: apellidos.trim(),
        telefono: telefono.trim() || undefined,
        password,
      }),
    onSuccess: () => setListo(true),
    onError: (e) =>
      setError(
        e instanceof ApiRequestError ? e.message : 'No se pudo completar el registro.',
      ),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirmar) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    m.mutate();
  }

  if (listo) {
    return (
      <Mensaje
        titulo="¡Registro completado!"
        texto="Tu cuenta ya está activa. Ya puedes iniciar sesión con tu correo y contraseña."
        accion={
          <Link
            to="/login"
            className="inline-block rounded-xl bg-[#1f2a4d] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#172039]"
          >
            Ir a iniciar sesión
          </Link>
        }
      />
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-white md:flex-row">
      <div className="flex items-center justify-center p-6 md:w-1/2 md:p-10">
        <Logo fondo="claro" />
      </div>

      <div className="flex flex-1 items-center justify-center p-6 md:p-10">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold text-[#3f5b87]">Completa tu registro</h1>
            <p className="text-sm text-gray-500">
              Define tu contraseña para activar tu cuenta.
            </p>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Correo</label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full cursor-not-allowed rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Nombre</label>
              <input
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-[#3f5b87] focus:ring-2 focus:ring-[#3f5b87]/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Apellidos</label>
              <input
                type="text"
                required
                value={apellidos}
                onChange={(e) => setApellidos(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-[#3f5b87] focus:ring-2 focus:ring-[#3f5b87]/30"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Teléfono <span className="text-gray-400">(opcional)</span>
            </label>
            <input
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-[#3f5b87] focus:ring-2 focus:ring-[#3f5b87]/30"
            />
          </div>

          <div className="relative">
            <label className="mb-1 block text-xs font-medium text-gray-500">Contraseña</label>
            <input
              type={verPassword ? 'text' : 'password'}
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 pr-11 text-sm outline-none focus:border-[#3f5b87] focus:ring-2 focus:ring-[#3f5b87]/30"
            />
            <button
              type="button"
              onClick={() => setVerPassword((v) => !v)}
              aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="absolute right-3 top-[2.1rem] text-gray-400 hover:text-gray-600"
            >
              {verPassword ? <IconEyeOff /> : <IconEye />}
            </button>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Confirmar contraseña
            </label>
            <input
              type={verPassword ? 'text' : 'password'}
              required
              autoComplete="new-password"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-[#3f5b87] focus:ring-2 focus:ring-[#3f5b87]/30"
            />
          </div>

          <button
            type="submit"
            disabled={m.isPending}
            className="w-full rounded-xl bg-[#1f2a4d] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#172039] disabled:opacity-60"
          >
            {m.isPending ? 'Creando cuenta…' : 'Crear mi cuenta'}
          </button>

          <p className="text-center text-sm text-gray-500">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="font-semibold text-[#3f5b87] hover:underline">
              Inicia sesión
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}

function Mensaje({
  titulo,
  texto,
  accion,
}: {
  titulo: string;
  texto: string;
  accion?: ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-white p-6">
      <Logo fondo="claro" />
      <div className="w-full max-w-sm space-y-3 text-center">
        <h1 className="text-2xl font-semibold text-[#3f5b87]">{titulo}</h1>
        <p className="text-sm text-gray-500">{texto}</p>
        {accion ?? (
          <Link
            to="/login"
            className="inline-block text-sm font-semibold text-[#3f5b87] hover:underline"
          >
            Volver a iniciar sesión
          </Link>
        )}
      </div>
    </main>
  );
}
