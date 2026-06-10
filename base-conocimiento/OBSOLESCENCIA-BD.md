---
documento: Obsolescencia de la base de datos (registro de retiro)
estado: vivo
ultima_actualizacion: 2026-06-10
palabras_clave: [obsoleto, deprecado, retirar, eliminar, limpieza, RPC, vista, cdg, backup, duplicado, transicion, apagar v1, ia, v_pdpdetalle, reutilizado]
---

# Obsolescencia de la base de datos — qué se podrá eliminar al apagar v1

> **Propósito.** Registro VIVO de objetos de la base de datos (funciones/RPCs, vistas, tablas, columnas,
> buckets, políticas, etc.) que **probablemente se podrán eliminar** cuando la versión vieja (v1,
> FlutterFlow) se apague y v2 quede como único sistema. Se va alimentando conforme detectamos cosas.
>
> ⛔ **NADA se elimina ahora.** Rige la regla de **coexistencia**: v1 sigue en producción usando estos
> objetos. Cualquier `DROP`/`REVOKE`/borrado se difiere hasta que v2 tenga paridad y con **autorización
> explícita del usuario, caso por caso**. Este documento solo CLASIFICA y PREPARA esa limpieza.
>
> Inventario base tomado del esquema real (≈190 funciones, ≈50 vistas) el 2026-06-04. Este documento NO
> es exhaustivo por diseño: el grueso de objetos pertenece a módulos aún no migrados y se evaluará al
> migrar cada uno.

## Cómo se clasifica

| Estado | Significado |
|---|---|
| 🔴 Retiro prioritario | Inseguro y v2 ya NO lo usa. Retirar en cuanto v1 deje de usarlo. |
| 🟠 Duplicado / backup / versión vieja | Residuos de desarrollo; candidatos claros a limpieza. |
| 🟡 Reemplazado por v2 | v2 ya hace esto de otra forma (server-side); el objeto v1 quedará huérfano al apagar v1. |
| 🟢 A evaluar por módulo | Lógica de negocio de módulos aún no migrados; se decide al migrar ese módulo. |
| ⚪ No tocar | De extensiones del sistema o reutilizado por v2. No es candidato a eliminar. |

---

## 1. 🔴 RPCs inseguras (retiro prioritario — seguridad)

Identificadas en la auditoría (`documentacion-replicacion/03` y `06`). v2 **no** las usa; son la causa de
los hallazgos críticos (SQL crudo desde el cliente / inyección).

| Objeto | Tipo | Por qué se retira | ¿v2 lo usa? |
|---|---|---|---|
| `cdg` | función | "SQL cifrado" (XOR falso, clave hardcodeada) que ejecuta SQL arbitrario enviado por el cliente. Vector crítico. | No |
| `consulta_segura_parametrizada` | función | Construye SQL dinámico con fragmentos del cliente → inyección. v1 la usaba p. ej. para las KVA's de Parques. | No |
| `consulta_dinamica` | función | SQL dinámico genérico. | No |
| `sum_column` | función | Suma una columna recibida como texto → inyección. | No |
| `ia_consulta_sql` | función | Ejecuta SELECT para el agente de IA. **⚠️ Ya NO es candidata a retiro:** la usa la edge `ia-chat` que **v2 reutiliza** (Montse AI). | **Sí (Montse AI, vía edge `ia-chat`)** |
| `get_distinct_values`, `get_fields_by_source`, `get_widget_grouped` | funciones | Consulta genérica parametrizada por nombres de campo/tabla. | No |

> Acción al apagar v1: `REVOKE` de `anon/authenticated` primero (cuando ya nadie las llame), luego `DROP`.

## 2. 🟠 Duplicados, backups y versiones viejas (limpieza)

Residuos de desarrollo. Confirmar que ningún proceso los lee antes de eliminar.

- Vistas backup/old/respaldo: `v_pdpdetalle_old`, `v_resumenPresupuesto_backup_20250820`,
  `v_rentascombinadas_respaldo`, `vista_pdpdetalle`.
- Posibles versiones paralelas: `v_pdpdetalle2`, `v_pdpdetalletotales_2`.
- **Duplicados por mayúsculas/minúsculas** (Postgres distingue con comillas; parecen accidentales):
  `v_resumenPresupuesto` vs `v_resumenpresupuesto`; `v_pagosTotalAnual` vs `v_pagostotalanual`;
  `v_rentasCombinadas` vs `v_rentascombinadas`. → Confirmar cuál usa cada sistema y unificar.
- Funciones con par "X" y "X_corregido" (la vieja suele quedar obsoleta): `plan_dispersiones_dinamico`
  / `_corregido`, `resumen_dispersion_dinamico` / `_corregido`, `resumen_fideicomiso_completo` /
  `_corregido`.
- Funciones temporales/debug: `dev_pdpdetalle`, `debug_saldos_vencidos`, `temp_validar_telefono`,
  `test_simple_trigger`.

## 3. 🟡 Reemplazado por lógica de v2

v2 ya resuelve esto server-side; el objeto v1 quedará sin uso al apagar v1.

| Objeto v1 | Reemplazo en v2 |
|---|---|
| `consulta_segura_parametrizada` (KVA's de Parques) | Lectura directa de `parques` desde el backend. |
| `presdetalle_obtener_o_crear_registros_mensual` | Lógica propia del backend (la RPC tenía un bug con `claveUnica`). |
| Verificación de permisos en cliente (`permisos.dart`) | `PermisoGuard` server-side (RBAC con `segModulosUsuarios`). |
| Bitácora `actividad` escrita desde el cliente | Auditoría por **triggers** (`fn_auditoria` → tabla `auditoria`), no falsificable. |

> Nota: algunas funciones de negocio **sí** se reutilizan en v2 y por ahora **no** son obsoletas:
> `prescategorias_obtener_con_presupuesto`, `seg_aplicar_plantilla_a_usuario`,
> `seg_crear_plantilla_desde_usuario`, `segmodulosusuarios_smu`. Ver ⚪.

## 4. 🟢 A evaluar al migrar cada módulo

Estas familias pertenecen a módulos **aún no migrados** a v2. No decidir hasta migrar el módulo
correspondiente; entonces se marcará cada una como "reutilizar" o "retirar".

- **Arrendatarios / rentas:** `arrepdp_*`, `arrepdpdetalle_*`, `rapdp_*`, `rgpdp_*`, vistas `v_arre*`,
  `v_rentas*`, `v_arrendadasNaves`.
- **CxP:** `cxp_*`, vistas `v_pagos`, `v_ResumenPagos`, `lkr_cxp`, `n8n_cxp_*`, `zv_pagos*`.
- **Fideicomiso:** `fideicomiso_*`, `fidepdpdispersion_*`, `guardar_dispersiones_*`,
  `resumen_fideicomiso_*`, `plan_dispersiones_*`, vistas `v_fideicomiso`, `v_propiedadesfide`.
- **CRM:** `crm_*`, `leads_*`, vistas `crm_Agenda`.
- **PDP / estados de cuenta:** `pdp_*`, `pdpdetalle_*`, `v_pdpdetalle*`. ⚠️ **Excepción:** las RPCs
  **`v_pdpdetalle_get_*`** (estado_cuenta_detalle, saldos_vencidos_por_parque, resumen/evolución,
  unique_values, filtros_dependientes) y la **vista `v_pdpdetalle`** las **reutiliza v2** (Ventas → Reportes,
  desde el backend). **NO retirar** mientras Reportes v2 las use.
- **Inversionistas/Propietarios:** `propiedades_eliminar_propiedad`, `v_propiedades` (esta última **v2 la
  evita**: calcula desde tablas base), etc.
- **Integraciones n8n / IA:** vistas `n8n_*`. ⚠️ Los objetos **IA** (`ia_*` como `ia_tokens_disponibles`,
  `ia_nueva_sesion`, `ia_log_conversacion`, `ia_consulta_sql`; tablas `iaSesiones`/`iaConversaciones`; edge
  `ia-chat`) los **reutiliza v2** (Montse AI). **NO son obsoletos.**

## 5. ⚪ No tocar

- **Extensiones del sistema** (no se eliminan manualmente): `pg_trgm` (`gtrgm_*`, `gin_trgm_*`,
  `similarity*`, `word_similarity*`, `set_limit`, `show_*`, `strict_word_similarity*`), `fuzzystrmatch`
  (`levenshtein*`, `soundex`, `metaphone`, `dmetaphone*`, `difference`, `text_soundex`).
- **Objetos nuevos de v2** (vigentes): `fn_auditoria`, tabla `auditoria`, `v2_obtener_logo_url`, bucket
  `branding`.
- **Funciones de negocio reutilizadas por v2** (ver ⚪ en sección 3).

## 6. Tablas / columnas / otros a vigilar

- **`actividad`** (bitácora v1): se **conserva** mientras v1 viva; su histórico ya se copió a `auditoria`.
  Candidata a retiro cuando v1 se apague.
- **`parques.naves`** (columna): quedó como dato histórico (en v1 guardaba KVA's Alta por error). v2 usa
  el conteo real; evaluar si se deja, se corrige masivamente o se ignora.
- **Buckets de Storage públicos** (6, según auditoría): volverlos privados es parte de las remediaciones
  P0; no es "eliminar" pero sí endurecer al migrar.
- **Políticas RLS `USING(true)`** y tablas sin RLS: remediación de seguridad (ver `documentacion-
  replicacion/06`), no eliminación.

## 7. Pendientes de detección (se irá llenando)

> Conforme migremos módulos y detectemos objetos sin uso, se agregan aquí con: nombre, tipo, por qué se
> considera obsoleto, qué lo reemplaza y si algún proceso externo (n8n/IA) lo consume.

- _(siguiente hallazgo…)_
