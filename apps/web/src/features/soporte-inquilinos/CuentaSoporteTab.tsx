import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CuentaInput, ResultadoConexion } from '@/features/correo/correo.api';
import { soporteApi } from './soporte-inquilinos.api';
import { Toggle } from '@/components/Toggle';
import { ApiRequestError } from '@/lib/api';

const DEFAULTS: CuentaInput = {
  nombre: 'Soporte a Inquilinos',
  email: 'contacto@portal.gruposph.mx',
  imapHost: 'imap.hostinger.com',
  imapPort: 993,
  smtpHost: 'smtp.hostinger.com',
  smtpPort: 465,
  usuario: '',
  password: '',
  activo: true,
};

export function CuentaSoporteTab() {
  const queryClient = useQueryClient();
  const { data: cuenta } = useQuery({
    queryKey: ['inc-cuenta'],
    queryFn: () => soporteApi.cuenta(),
  });

  const [f, setF] = useState<CuentaInput>(DEFAULTS);
  const [error, setError] = useState<string | null>(null);
  const [prueba, setPrueba] = useState<ResultadoConexion | null>(null);

  useEffect(() => {
    if (cuenta) {
      setF({
        nombre: cuenta.nombre ?? '',
        email: cuenta.email,
        imapHost: cuenta.imapHost,
        imapPort: cuenta.imapPort,
        smtpHost: cuenta.smtpHost,
        smtpPort: cuenta.smtpPort,
        usuario: cuenta.usuario,
        password: '',
        activo: cuenta.activo,
      });
    }
  }, [cuenta]);

  const set = <K extends keyof CuentaInput>(k: K, v: CuentaInput[K]) =>
    setF((p) => ({ ...p, [k]: v }));
  const onErr = (e: unknown) =>
    setError(e instanceof ApiRequestError ? e.message : 'Ocurrió un error.');

  const guardar = useMutation({
    mutationFn: async (): Promise<void> => {
      if (cuenta) await soporteApi.editarCuenta(cuenta.id, f);
      else await soporteApi.crearCuenta(f);
    },
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['inc-cuenta'] });
    },
    onError: onErr,
  });

  const probar = useMutation({
    mutationFn: () => (cuenta ? soporteApi.probarGuardada(cuenta.id, f) : soporteApi.probar(f)),
    onSuccess: (r) => {
      setError(null);
      setPrueba(r);
    },
    onError: onErr,
  });

  const inputCls =
    'mt-1 block w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30';
  const lbl = 'block text-xs text-gray-600';
  const puedeGuardar = !!f.email && (!!cuenta || !!f.password);

  return (
    <div className="max-w-xl space-y-4">
      <p className="text-sm text-gray-500">
        Cuenta de correo (Hostinger) desde la que se reciben y responden los incidentes de
        los inquilinos. La contraseña se guarda cifrada y nunca se muestra. Al crearla queda
        designada como la cuenta de Soporte a Inquilinos.
      </p>

      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {prueba && (
        <div className={`rounded-md px-3 py-2 text-sm ${prueba.imap && prueba.smtp ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-800'}`}>
          IMAP: {prueba.imap ? '✅' : '❌'} · SMTP: {prueba.smtp ? '✅' : '❌'} — {prueba.mensaje}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className={`${lbl} col-span-2`}>
          Nombre (opcional)
          <input value={f.nombre} onChange={(e) => set('nombre', e.target.value)} className={inputCls} placeholder="Soporte a Inquilinos" />
        </label>
        <label className={`${lbl} col-span-2`}>
          Correo *
          <input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} className={inputCls} placeholder="contacto@portal.gruposph.mx" />
        </label>
        <label className={lbl}>
          Usuario (si difiere del correo)
          <input value={f.usuario} onChange={(e) => set('usuario', e.target.value)} className={inputCls} placeholder="(igual al correo)" />
        </label>
        <label className={lbl}>
          Contraseña {cuenta && <span className="text-gray-400">(vacío = no cambiar)</span>}
          <input type="password" value={f.password} onChange={(e) => set('password', e.target.value)} className={inputCls} autoComplete="new-password" />
        </label>
        <label className={lbl}>
          IMAP host
          <input value={f.imapHost} onChange={(e) => set('imapHost', e.target.value)} className={inputCls} />
        </label>
        <label className={lbl}>
          IMAP puerto
          <input type="number" value={f.imapPort} onChange={(e) => set('imapPort', Number(e.target.value))} className={inputCls} />
        </label>
        <label className={lbl}>
          SMTP host
          <input value={f.smtpHost} onChange={(e) => set('smtpHost', e.target.value)} className={inputCls} />
        </label>
        <label className={lbl}>
          SMTP puerto
          <input type="number" value={f.smtpPort} onChange={(e) => set('smtpPort', Number(e.target.value))} className={inputCls} />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <Toggle checked={f.activo} title="Activa" onChange={(v) => set('activo', v)} />
        Cuenta activa (se sincroniza automáticamente)
      </label>

      <div className="flex gap-2">
        <button
          onClick={() => probar.mutate()}
          disabled={probar.isPending || !f.email}
          className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          {probar.isPending ? 'Probando…' : 'Probar conexión'}
        </button>
        <button
          onClick={() => guardar.mutate()}
          disabled={guardar.isPending || !puedeGuardar}
          className="rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white hover:bg-[#172039] disabled:opacity-50"
        >
          {guardar.isPending ? 'Guardando…' : cuenta ? 'Guardar cambios' : 'Crear cuenta'}
        </button>
      </div>
    </div>
  );
}
