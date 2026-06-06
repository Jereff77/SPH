import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs, type TabDef } from '@/components/Tabs';
import { correoApi } from './correo.api';
import { CuentaCorreoTab } from './CuentaCorreoTab';
import { BandejaCorreoTab } from './BandejaCorreoTab';

const TABS: TabDef[] = [
  { id: 'bandeja', label: 'Bandeja' },
  { id: 'cuenta', label: 'Cuenta' },
];

export function CorreoPage() {
  const [activo, setActivo] = useState('bandeja');
  const { data: cuentas = [] } = useQuery({
    queryKey: ['correo-cuentas'],
    queryFn: () => correoApi.cuentas(),
  });
  const cuentaActiva = cuentas.find((c) => c.activo) ?? cuentas[0];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight text-gray-800">Correo</h1>
      <Tabs tabs={TABS} activo={activo} onChange={setActivo} />

      {activo === 'bandeja' &&
        (cuentaActiva ? (
          <BandejaCorreoTab idCuenta={cuentaActiva.id} />
        ) : (
          <div className="rounded-xl border border-dashed bg-white p-10 text-center text-sm text-gray-400">
            Aún no hay una cuenta de correo configurada.{' '}
            <button onClick={() => setActivo('cuenta')} className="text-[#3f5b87] underline">
              Configúrala aquí.
            </button>
          </div>
        ))}
      {activo === 'cuenta' && <CuentaCorreoTab />}
    </div>
  );
}
