import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs, type TabDef } from '@/components/Tabs';
import { correoApi } from './correo.api';
import { CuentaCorreoTab } from './CuentaCorreoTab';
import { BandejaCorreoTab } from './BandejaCorreoTab';
import { useAuth } from '@/features/auth/useAuth';

export function CorreoPage() {
  const { tienePermiso } = useAuth();
  const puedeConfigurar = tienePermiso(801);
  const [activo, setActivo] = useState('bandeja');
  const { data: cuentas = [] } = useQuery({
    queryKey: ['correo-cuentas'],
    queryFn: () => correoApi.cuentas(),
  });
  const cuentaActiva = cuentas.find((c) => c.activo) ?? cuentas[0];

  // La pestaña "Cuenta" (configuración) solo para autorizados (permiso 801).
  const tabs: TabDef[] = [
    { id: 'bandeja', label: 'Bandeja' },
    ...(puedeConfigurar ? [{ id: 'cuenta', label: 'Cuenta' }] : []),
  ];
  const tabActivo = activo === 'cuenta' && !puedeConfigurar ? 'bandeja' : activo;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight text-gray-800">Correo</h1>
      <Tabs tabs={tabs} activo={tabActivo} onChange={setActivo} />

      {tabActivo === 'bandeja' &&
        (cuentaActiva ? (
          <BandejaCorreoTab idCuenta={cuentaActiva.id} />
        ) : (
          <div className="rounded-xl border border-dashed bg-white p-10 text-center text-sm text-gray-400">
            Aún no hay una cuenta de correo configurada.{' '}
            {puedeConfigurar ? (
              <button onClick={() => setActivo('cuenta')} className="text-[#3f5b87] underline">
                Configúrala aquí.
              </button>
            ) : (
              <span>Contacta a un administrador para configurarla.</span>
            )}
          </div>
        ))}
      {tabActivo === 'cuenta' && puedeConfigurar && <CuentaCorreoTab />}
    </div>
  );
}
