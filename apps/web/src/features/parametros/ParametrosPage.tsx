import { useState } from 'react';
import { Tabs, type TabDef } from '@/components/Tabs';
import { InpcTab } from './InpcTab';
import { CuentasTab } from './CuentasTab';
import { FechasCxpTab } from './FechasCxpTab';
import { ClavesSatTab } from './ClavesSatTab';

const TABS: TabDef[] = [
  { id: 'avisos', label: 'Pizarra de Avisos' },
  { id: 'inpc', label: 'INPC' },
  { id: 'cuentas', label: 'Cuentas' },
  { id: 'fechas', label: 'Fechas CxP' },
  { id: 'claves-sat', label: 'Claves SAT' },
];

export function ParametrosPage() {
  const [activo, setActivo] = useState('inpc');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-800">
          Parámetros
        </h1>
        <p className="text-sm text-gray-500">Parámetros generales del ERP.</p>
      </div>

      <Tabs tabs={TABS} activo={activo} onChange={setActivo} />

      <div>
        {activo === 'avisos' && (
          <div className="rounded-xl border border-dashed bg-white p-10 text-center text-sm text-gray-400">
            Pizarra de Avisos — en desarrollo.
          </div>
        )}
        {activo === 'inpc' && <InpcTab />}
        {activo === 'cuentas' && <CuentasTab />}
        {activo === 'fechas' && <FechasCxpTab />}
        {activo === 'claves-sat' && <ClavesSatTab />}
      </div>
    </div>
  );
}
