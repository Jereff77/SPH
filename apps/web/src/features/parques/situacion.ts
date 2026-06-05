/** Color sólido (Tailwind) para la ceja lateral de la tarjeta de nave. */
export function situacionCeja(situacion: string | null): string {
  switch (situacion) {
    case 'Disponible':
      return 'bg-[#90BF32]';
    case 'Apartado':
      return 'bg-amber-400';
    case 'Bloqueado':
      return 'bg-gray-400';
    case 'Vendida':
      return 'bg-[#1f2a4d]';
    default:
      return 'bg-gray-300';
  }
}

/** Clases de color (Tailwind) según la situación de una nave. */
export function situacionBadge(situacion: string | null): string {
  switch (situacion) {
    case 'Disponible':
      return 'bg-green-100 text-green-700';
    case 'Apartado':
      return 'bg-amber-100 text-amber-700';
    case 'Bloqueado':
      return 'bg-gray-200 text-gray-600';
    case 'Vendida':
      return 'bg-[#1f2a4d] text-white';
    default:
      return 'bg-gray-100 text-gray-500';
  }
}
