import type { ReactNode } from 'react';

/** Variantes de color del badge (par fondo/texto estilo Tailwind de la casa). */
export type BadgeColor =
  | 'azul'
  | 'verde'
  | 'morado'
  | 'teal'
  | 'ambar'
  | 'gris'
  | 'rojo';

const CLASES: Record<BadgeColor, string> = {
  azul: 'bg-blue-100 text-blue-700',
  verde: 'bg-green-100 text-green-700',
  morado: 'bg-purple-100 text-purple-700',
  teal: 'bg-teal-100 text-teal-700',
  ambar: 'bg-amber-100 text-amber-800',
  gris: 'bg-gray-100 text-gray-500',
  rojo: 'bg-red-100 text-red-700',
};

/**
 * Pill/etiqueta de estado reutilizable con el estilo canónico del proyecto
 * (`rounded-full px-2 py-0.5 text-xs font-medium` + par de color). Centraliza el
 * patrón que hoy se reescribe inline en varias features (CxP, Ventas, Arrendatarios…).
 */
export function Badge({
  children,
  color = 'gris',
  title,
}: {
  children: ReactNode;
  color?: BadgeColor;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${CLASES[color]}`}
    >
      {children}
    </span>
  );
}
