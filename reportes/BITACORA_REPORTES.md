# Bitácora de Mantenimiento y Reportes - SPH Bienes Raíces

Este documento registra los cambios, ajustes, problemas resueltos y mantenimiento general realizado en los módulos de reportes del sistema. Sirve como referencia central para el historial de modificaciones y soluciones a problemas comunes.

## Registro de Actividades

### [16/01/2026] - Limpieza de Seguridad y Logs de Desarrollo
**Archivos afectados:**
- `reportes/inversionistas/vencidos.html`
- `reportes/inversionistas/estadoCta.html`

**Descripción:**
- Se realizó una limpieza exhaustiva de los logs de desarrollo (`console.log`, `console.error`) que exponían información técnica innecesaria en producción.
- **Objetivo:** Proteger información sensible (URLs de conexión, estructuras de datos, parámetros RPC) que se mostraba en la consola del navegador.
- **Resultado:** Los reportes mantienen su funcionalidad intacta, conservando las alertas de usuario, pero sin dejar rastro de depuración visible.

---

### [Enero 2026] - Corrección de Conflicto de Variables (Supabase)
**Archivos afectados:**
- `reportes/inversionistas/estadoCta.html` (y aplicable a otros reportes similares)

**Problema Identificado:**
- Error en consola: `SyntaxError: Identifier 'supabase' has already been declared`.
- **Causa:** Conflicto de nombres. La librería de Supabase (cargada vía CDN) y el script local intentaban declarar ambos una variable global llamada `supabase`.

**Solución Aplicada:**
1. Se renombró la variable local de la instancia del cliente a `supabaseClient`.
2. Se actualizaron todas las referencias y llamadas RPC (ej. `supabaseClient.rpc(...)`).

**Lección Aprendida / Guía:**
- Al usar librerías externas vía CDN que inyectan globales, evitar usar esos mismos nombres para variables locales.
- Estándar adoptado: Usar `supabaseClient` para la instancia local de conexión.

---

## Notas Técnicas Generales

### Estructura de Reportes
Los reportes actuales funcionan mayormente como archivos HTML independientes (`Standalone`) que:
1. Cargan dependencias vía CDN (Supabase, Tabulator, jsPDF).
2. Contienen su propia lógica JavaScript embebida.
3. Se conectan directamente a Supabase mediante funciones RPC.

### Recomendaciones de Mantenimiento
- **Logs:** Evitar dejar `console.log` con datos de negocio en las versiones finales.
- **Versiones CDN:** Se recomienda fijar versiones específicas en los scripts de importación para evitar roturas por actualizaciones automáticas de librerías externas.
