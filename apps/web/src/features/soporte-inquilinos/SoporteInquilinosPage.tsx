import { useState } from 'react';
import { Tabs, type TabDef } from '@/components/Tabs';
import { useAuth } from '@/features/auth/useAuth';
import { IncidentesTab } from './IncidentesTab';
import { TableroTab } from './TableroTab';
import { CuentaSoporteTab } from './CuentaSoporteTab';

/**
 * Soporte a Inquilinos (Arrendatarios). Bandeja de incidentes por correo +
 * configuración de la cuenta. Permisos: 31 ver · 32 responder · 33 clasificar ·
 * 34 configurar la cuenta.
 */
export function SoporteInquilinosPage() {
  const { tienePermiso } = useAuth();
  const puedeConfigurar = tienePermiso(34);
  const [activo, setActivo] = useState('incidentes');

  const tabs: TabDef[] = [
    { id: 'incidentes', label: 'Incidentes' },
    { id: 'tablero', label: 'Tablero' },
    ...(puedeConfigurar ? [{ id: 'cuenta', label: 'Cuenta' }] : []),
  ];
  const tabActivo = activo === 'cuenta' && !puedeConfigurar ? 'incidentes' : activo;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight text-gray-800">Soporte a Inquilinos</h1>
      <Tabs tabs={tabs} activo={tabActivo} onChange={setActivo} />
      {tabActivo === 'incidentes' && <IncidentesTab />}
      {tabActivo === 'tablero' && <TableroTab />}
      {tabActivo === 'cuenta' && puedeConfigurar && <CuentaSoporteTab />}
    </div>
  );
}
