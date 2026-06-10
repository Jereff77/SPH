import type { ComponentType, SVGProps } from 'react';
import {
  IconGear,
  IconParque,
  IconCxP,
  IconMail,
  IconVentas,
  IconClientes,
  IconArrendatarios,
} from '@/components/icons';

export interface MenuItem {
  label: string;
  to: string;
  /** Clave de permiso requerida para ver el ítem (de segModulos). */
  clave?: number;
}

export interface MenuGrupo {
  id: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  items: MenuItem[];
  /** Si se define, el grupo es un enlace directo (sin submenú). */
  to?: string;
  /** Clave de permiso del enlace directo. */
  clave?: number;
}

/**
 * Estructura del menú del sidebar. Cada ítem indica la clave de permiso que lo
 * habilita (el sidebar oculta los que el usuario no tiene). Los demás módulos
 * (Ventas, Arrendatarios, Parques, CxP, Comisiones, Fideicomiso, CRM, Soporte)
 * se irán añadiendo conforme se migren.
 */
export const MENU: MenuGrupo[] = [
  {
    id: 'ventas',
    label: 'Ventas',
    Icon: IconVentas,
    items: [
      { label: 'Dashboard', to: '/ventas/dashboard', clave: 620 },
      { label: 'Gestión de Cobranza', to: '/ventas', clave: 600 },
      { label: 'Planes', to: '/ventas/planes', clave: 610 },
      { label: 'Escrituras', to: '/ventas/escrituras', clave: 630 },
      { label: 'Reportes', to: '/ventas/reportes', clave: 620 },
    ],
  },
  {
    id: 'arrendatarios',
    label: 'Arrendatarios',
    Icon: IconArrendatarios,
    items: [
      { label: 'Dashboard', to: '/arrendatarios', clave: 10 },
      { label: 'Planes de Renta', to: '/arrendatarios/planes', clave: 20 },
    ],
  },
  {
    id: 'parques',
    label: 'Parques',
    Icon: IconParque,
    items: [
      { label: 'Parques', to: '/parques', clave: 700 },
      { label: 'Disponibilidad', to: '/parques/disponibilidad', clave: 710 },
    ],
  },
  {
    id: 'cxp',
    label: 'Cuentas por Pagar',
    Icon: IconCxP,
    items: [
      { label: 'Solicitudes de pago', to: '/cxp/solicitudes', clave: 420 },
      { label: 'Aprobar Solicitudes', to: '/cxp/aprobar', clave: 430 },
      { label: 'Pagar solicitudes', to: '/cxp/pagar', clave: 400 },
      { label: 'Solicitudes pendientes', to: '/cxp/pendientes', clave: 450 },
      { label: 'Proveedores', to: '/cxp/proveedores', clave: 410 },
      { label: 'Bancos', to: '/cxp/bancos', clave: 470 },
      // Próximas fases: Reportes (460), Dashboard (440/441)…
    ],
  },
  {
    id: 'correo',
    label: 'Correo',
    Icon: IconMail,
    items: [{ label: 'Bandeja', to: '/correo', clave: 800 }],
  },
  {
    id: 'clientes',
    label: 'Clientes',
    Icon: IconClientes,
    to: '/clientes',
    clave: 300,
    items: [],
  },
  {
    id: 'configuraciones',
    label: 'Configuraciones',
    Icon: IconGear,
    items: [
      { label: 'Usuarios', to: '/configuraciones/usuarios', clave: 200 },
      { label: 'Parámetros', to: '/configuraciones/parametros', clave: 210 },
      { label: 'Permisos', to: '/configuraciones/permisos', clave: 220 },
      { label: 'Sistema', to: '/configuraciones/sistema', clave: 221 },
      // Cambiar contraseña: disponible para todos (sin clave).
      { label: 'Cambiar contraseña', to: '/configuraciones/cambiar-contrasena' },
      // Novedades (changelog): disponible para todos (sin clave).
      { label: 'Novedades', to: '/configuraciones/novedades' },
    ],
  },
];
