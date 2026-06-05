import { SetMetadata } from '@nestjs/common';

export const PERMISO_KEY = 'permiso_requerido';

/**
 * Declara el permiso (clave de módulo/sección de `segModulosUsuarios`) que un
 * endpoint exige. Lo evalúa PermisoGuard server-side. Reemplaza la verificación
 * cosmética del cliente (`permisos.dart`) de v1.
 *
 *   @RequierePermiso(204)   // p.ej. "Configuraciones > Usuarios > eliminar"
 *   @Delete(':id') ...
 */
export const RequierePermiso = (clave: number) =>
  SetMetadata(PERMISO_KEY, clave);
