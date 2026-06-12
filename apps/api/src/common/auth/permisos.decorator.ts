import { SetMetadata } from '@nestjs/common';

export const PERMISO_KEY = 'permiso_requerido';

/**
 * Declara el/los permiso(s) (clave de módulo/sección de `segModulosUsuarios`) que
 * un endpoint exige. Lo evalúa PermisoGuard server-side. Reemplaza la verificación
 * cosmética del cliente (`permisos.dart`) de v1.
 *
 *   @RequierePermiso(204)        // exige la clave 204
 *   @RequierePermiso(500, 520)   // exige CUALQUIERA de 500 o 520 (any-of)
 *   @Delete(':id') ...
 *
 * Cuando se pasan varias claves, basta con tener acceso a una de ellas (útil
 * cuando una misma pantalla se alcanza desde dos secciones del menú, p. ej. el
 * Dashboard (500) y Adhesiones (520) del Fideicomiso, que son la misma vista).
 */
export const RequierePermiso = (...claves: number[]) =>
  SetMetadata(PERMISO_KEY, claves);
