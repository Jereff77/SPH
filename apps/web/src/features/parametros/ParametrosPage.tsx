import { useMemo, useState } from 'react';
import { Tabs, type TabDef } from '@/components/Tabs';
import { useAuth } from '@/features/auth/useAuth';
import { InpcTab } from './InpcTab';
import { CuentasTab } from './CuentasTab';
import { FechasCxpTab } from './FechasCxpTab';
import { ClavesSatTab } from './ClavesSatTab';

// Cada pestaña tiene su clave de visualización (catálogo segModulos):
// INPC 212, Cuentas 213, Fechas CxP 214, Claves SAT 215, Pizarra de Avisos 216.
const TABS: (TabDef & { clave: number })[] = [
  { id: 'avisos', label: 'Pizarra de Avisos', clave: 216 },
  { id: 'inpc', label: 'INPC', clave: 212 },
  { id: 'cuentas', label: 'Cuentas', clave: 213 },
  { id: 'fechas', label: 'Fechas CxP', clave: 214 },
  { id: 'claves-sat', label: 'Claves SAT', clave: 215 },
];

export function ParametrosPage() {
  const { tienePermiso } = useAuth();

  // Solo se muestran las pestañas cuya clave de visualización tiene el usuario.
  const visibles = useMemo(
    () => TABS.filter((t) => tienePermiso(t.clave)),
    [tienePermiso],
  );

  const [activo, setActivo] = useState(
    () => visibles.find((t) => t.id === 'inpc')?.id ?? visibles[0]?.id ?? '',
  );

  // La pestaña activa debe seguir siendo visible (p. ej. al cambiar de usuario en "Ver como").
  const activoVisible = visibles.some((t) => t.id === activo)
    ? activo
    : (visibles[0]?.id ?? '');

  if (visibles.length === 0) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-800">
            Parámetros
          </h1>
          <p className="text-sm text-gray-500">Parámetros generales del ERP.</p>
        </div>
        <div className="rounded-xl border border-dashed bg-white p-10 text-center text-sm text-gray-400">
          No tienes permiso para ver ninguna sección de Parámetros.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-800">
          Parámetros
        </h1>
        <p className="text-sm text-gray-500">Parámetros generales del ERP.</p>
      </div>

      <Tabs tabs={visibles} activo={activoVisible} onChange={setActivo} />

      <div>
        {activoVisible === 'avisos' && (
          <div className="rounded-xl border border-dashed bg-white p-10 text-center text-sm text-gray-400">
            Pizarra de Avisos — en desarrollo.
          </div>
        )}
        {activoVisible === 'inpc' && <InpcTab />}
        {activoVisible === 'cuentas' && <CuentasTab />}
        {activoVisible === 'fechas' && <FechasCxpTab />}
        {activoVisible === 'claves-sat' && <ClavesSatTab />}
      </div>
    </div>
  );
}
