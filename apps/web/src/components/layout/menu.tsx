import type { ComponentType, SVGProps } from 'react';
import {
  IconGear,
  IconParque,
  IconCxP,
  IconMail,
  IconVentas,
  IconClientes,
  IconArrendatarios,
  IconFideicomiso,
} from '@/components/icons';

export interface MenuItem {
  label: string;
  to: string;
  /** Clave de permiso requerida para ver el ítem (de segModulos). */
  clave?: number;
  /** Si es true, el ítem solo se muestra a personal de soporte (isSupport). */
  soloSoporte?: boolean;
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
      { label: 'Reportes', to: '/arrendatarios/reportes', clave: 20 },
    ],
  },
  {
    id: 'fideicomiso',
    label: 'Fideicomiso',
    Icon: IconFideicomiso,
    items: [
      { label: 'Dashboard', to: '/fideicomiso/dashboard', clave: 500 },
      { label: 'Aportaciones', to: '/fideicomiso/aportaciones', clave: 510 },
      { label: 'Adhesiones', to: '/fideicomiso/adhesiones', clave: 520 },
      { label: 'Contabilidad', to: '/fideicomiso/contabilidad', clave: 520 },
      { label: 'Dispersion', to: '/fideicomiso/dispersiones', clave: 530 },
      { label: 'Reportes', to: '/fideicomiso/reportes', clave: 540 },
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
      { label: 'Solicitudes de Pago PPD', to: '/cxp/ppd', clave: 420 },
      { label: 'Aprobar Solicitudes', to: '/cxp/aprobar', clave: 430 },
      { label: 'Pagar solicitudes', to: '/cxp/pagar', clave: 400 },
      { label: 'Solicitudes pendientes', to: '/cxp/pendientes', clave: 450 },
      { label: 'Proveedores', to: '/cxp/proveedores', clave: 410 },
      { label: 'Bancos', to: '/cxp/bancos', clave: 470 },
      { label: 'Reportes', to: '/cxp/reportes', clave: 460 },
      // Próxima fase: Dashboard (440/441)…
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
      // Cron: monitoreo de tareas programadas. SOLO soporte (sin clave: no se
      // asigna desde la app, solo por el flag isSupport del backend).
      { label: 'Cron', to: '/configuraciones/cron', soloSoporte: true },
      // Soporte: auditoría de conversaciones del agente IA + tickets. SOLO soporte
      // (sin clave: igual que Cron, se gobierna por el flag isSupport del backend).
      { label: 'Soporte', to: '/configuraciones/soporte', soloSoporte: true },
    ],
  },
];
