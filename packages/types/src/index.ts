/**
 * @erp/types — contratos compartidos entre backend (apps/api) y frontend (apps/web).
 *
 * Aquí viven los DTOs y tipos de dominio que ambos lados deben conocer, de modo que
 * el contrato de la API esté tipado de extremo a extremo. Los tipos de la base de
 * datos están en ./database.types.ts (generados de Supabase).
 */
export type {
  Database,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
  Enums,
  CompositeTypes,
} from './database.types.js';
// Valores constantes (listas de enums del esquema) para usar en runtime.
export { Constants } from './database.types.js';

/** Identidad del usuario autenticado, derivada del JWT verificado en el backend. */
export interface AuthUser {
  uid: string;
  email: string | null;
  role: string;
}

/** Un permiso de módulo/sección (reemplazo server-side de segModulosUsuarios). */
export interface Permiso {
  modulo: string;
  seccion: string;
  clave: number;
  acceso: boolean;
}

/** Envoltura estándar de respuesta de error de la API. */
export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
}

/** Metadatos de paginación para listados (tablas grandes -> fluidez). */
export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}
