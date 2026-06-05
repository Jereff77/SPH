import type { PerfilUsuario } from './types';

/** Nombre a mostrar: "Apellidos, Nombre" (como el sistema original). */
export function nombreUsuario(u: PerfilUsuario | null): string {
  if (!u) return '';
  if (u.apellidos && u.nombre) return `${u.apellidos}, ${u.nombre}`;
  return u.nomCompleto ?? u.nombre ?? u.email ?? '';
}
