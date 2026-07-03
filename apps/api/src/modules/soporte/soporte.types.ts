/**
 * Tipos compartidos del Agente de IA de Soporte.
 *
 * Antes vivían en `diagnostico.service.ts` (herramientas enlatadas), que se retiró
 * al pasar el agente a **razonar** con `consultar_datos` (text-to-SQL acotado) + KB.
 * Se conservan aquí porque los usan `soporte.service.ts` y `consultas.service.ts`.
 */

/** Especificación de una herramienta en el formato de tools de OpenRouter/OpenAI. */
export interface ToolSpec {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/** Lo mínimo del perfil del usuario que pregunta para validar RBAC / acotar consultas. */
export interface PerfilDiag {
  esSoporte: boolean;
  claves: { clave: number }[];
}
