---
modulo: Fideicomiso
estado: stub
version_doc: 0.1
ultima_actualizacion: 2026-06-04
rutas_v1: [i06_fideicomiso]
tablas: [fidePdpDispersion, v_fideicomiso, v_propiedadesfide]
palabras_clave: [fideicomiso, dispersión, aportación, rendimiento, adherente, contabilidad, reporte de rendimientos]
relacionado_con: [inversionistas, cxp]
---

# Módulo: Fideicomiso  — (STUB, pendiente en v2)

> ⚠️ **Estado: NO desarrollado en v2.** Existe en v1. Ficha mínima; derivar a soporte para operaciones.

## Qué hace (en v1)
Gestiona el **fideicomiso**: adhesiones de inversionistas, aportaciones, **dispersiones**, contabilidad y
**reportes de rendimientos** a inversionistas.

## Entidades y tablas principales
- `fidePdpDispersion` (dispersiones del plan), vistas `v_fideicomiso`, `v_propiedadesfide`.
- Funciones `fideicomiso_*`, `guardar_dispersiones_fideicomiso`, `plan_dispersiones_*`,
  `resumen_fideicomiso_*`, `insertar_dispersiones_adherente`.

## Notas para la migración
- En v1, el **reporte** de fideicomiso era un documento HTML embebido que consultaba Supabase desde el
  navegador con la anon key (hallazgo de seguridad). En v2 debe reconstruirse server-side.
- Hay funciones con pares "X" / "X_corregido" (la vieja suele estar obsoleta) — ver `OBSOLESCENCIA-BD.md`.

## Para el agente
Explicar a alto nivel; para operaciones/reportes, **levantar ticket** o remitir a v1 mientras no se migre.
