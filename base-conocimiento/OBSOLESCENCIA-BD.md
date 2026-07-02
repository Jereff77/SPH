---
documento: Obsolescencia de la base de datos (registro de retiro)
estado: vivo
ultima_actualizacion: 2026-07-01
palabras_clave: [obsoleto, deprecado, retirar, eliminar, limpieza, RPC, vista, cdg, backup, duplicado, transicion, apagar v1, ia, v_pdpdetalle, reutilizado, saldos_vencidos, cuenta_corriente, fifo, inpc, incremento, arrepdpdetalle]
---

# Obsolescencia de la base de datos — qué se podrá eliminar al apagar v1

> **Propósito.** Registro VIVO de objetos de la base de datos (funciones/RPCs, vistas, tablas, columnas,
> buckets, políticas, etc.) que **probablemente se podrán eliminar** cuando la versión vieja (v1,
> FlutterFlow) se apague y v2 quede como único sistema. Se va alimentando conforme detectamos cosas.
>
> ⚠️ **v1 ya está APAGADO (2026-06-21).** Aun así, **nada se elimina automáticamente**: cada `DROP`/`REVOKE`
> requiere **autorización explícita del usuario, caso por caso**, y **verificar antes** que ningún consumidor
> vigente (otra vista/función/trigger en BD, o código `apps/api`/`apps/web`) lo use. Este documento CLASIFICA
> y PREPARA esa limpieza; el retiro se hace por lotes autorizados.
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
- Funciones con par "X" y "X_corregido" en Dispersión de Fideicomiso. ⚠️ **Hallazgo (v2.27.1):** aquí la
  variante **`_corregido` del plan es la DEFECTUOSA**, no la vieja. `plan_dispersiones_dinamico_corregido`
  itera `fidePdpDispersion` (periodos planeados) en vez de `pagos` (pagos reales) → infla el Desglose
  Detallado. v2 volvió a la **original `plan_dispersiones_dinamico`** (la misma que usa v1). →
  **`plan_dispersiones_dinamico_corregido` = candidata a `DROP`** una vez redesplegado v2.27.1 (nada más
  la usa: ni v1, ni otras funciones/vistas; ver `migraciones/2026-06-15-fideicomiso-dispersion-drop-rpc.sql`).
  Las `_corregido` de `resumen_dispersion_dinamico` y `resumen_fideicomiso_completo` daban resultado
  **idéntico** al original; quedan huérfanas (limpieza menor). La original `plan_dispersiones_dinamico`
  la usa v1 → **no retirar** mientras v1 viva.
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
| `v_pdpdetalle_get_saldos_vencidos_por_parque`, `v_pdpdetalle_get_resumen_saldos_vencidos_parque`, `v_pdpdetalle_get_evolucion_saldos_vencidos` | **`SaldosVencidosService`** (Ventas, `apps/api/src/modules/ventas/saldos-vencidos.service.ts`): saldo vencido por **cuenta corriente FIFO por plan**. Las 3 RPCs (vía la vista `v_pdpdetalle`) evaluaban **cada parcialidad aislada** (`balance < 0` por registro) e ignoraban el **saldo a favor** de los sobrepagos → inflaban el vencido (en producción, $67.4M vs $23.2M reales). **v2 dejó de llamarlas el 2026-06-21.** ⚠️ La **vista `v_pdpdetalle` NO es obsoleta**: la siguen usando Estado de Cuenta y los filtros (ver §4). |

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
- **PDP / estados de cuenta:** `pdp_*`, `pdpdetalle_*`, `v_pdpdetalle*`. ⚠️ **Excepción (reutilizadas, NO
  retirar):** v2 usa la **vista `v_pdpdetalle`** y las RPCs **`v_pdpdetalle_get_estado_cuenta_detalle`**,
  **`v_pdpdetalle_get_unique_values`/`_sin_a3`** y **`v_pdpdetalle_get_filtros_dependientes`** (Ventas →
  Reportes: Estado de Cuenta + cascada de filtros). En cambio, las 3 RPCs de **vencidos**
  (`v_pdpdetalle_get_saldos_vencidos_por_parque`, `..._resumen_saldos_vencidos_parque`,
  `..._evolucion_saldos_vencidos`) **ya NO las usa v2** (reemplazadas por `SaldosVencidosService`) → ver §3
  (🟡 obsoletas).
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

### 2026-07-01 — 🟡 Funciones de incremento de renta por INPC (Arrendatarios)

Detectadas durante el análisis del **incremento automático al capturar el INPC** (acordado con el
usuario: dejar UNA sola función correcta; estas quedan obsoletas para retiro posterior).
**Verificación de consumidores (2026-07-01):** código v2 `apps/api`/`apps/web` → **0 usos**; funciones/
vistas/triggers de la BD que las invoquen → **0**; `cron.job` → **0** (⚠️ NO existe ningún cron de INPC:
hoy todo incremento es manual, vía doble clic en Planes de Renta); v1 (apagado) → solo los 2 usos
huérfanos indicados abajo.

| Objeto | Tipo | Por qué se retira | Consumidores |
|---|---|---|---|
| `actualizar_inpc_por_ciclo(ciclo_inicio, nuevo_inpc)` | función | **ROTA**: hace `UPDATE … SET cantidad = …`, pero `cantidad` hoy es **columna generada** → falla si se ejecuta (es de un modelo de datos anterior). Además aplica un mismo INPC global a todos los planes ignorando la regla del desfase. | Nadie |
| `actualizar_inpc_todos_los_planes()` | función | Wrapper masivo que itera todos los planes llamando `arrepdpdetalle_actualizar_inpc`; hereda su limitación (solo escribe la columna `INPC`, **no recalcula `pm2`** → no cambia montos). | Nadie |
| `arrepdpdetalle_actualizar_inpc(id_arrepdp)` | función | Resuelve el INPC oficial con el desfase de **3 meses hardcodeado** (`primer mes del año − 3`), pero **solo escribe la columna `INPC`**, sin recalcular `pm2` → no mueve montos. Su lógica de resolución se absorbe (con desfase configurable) en la función nueva. | Nadie |
| `arrepdpdetalle_actualizar_inpc_desde_anio(id_arrepdp, anio_inicio)` | función | Ídem anterior con año inicial parametrizado. Mismas limitaciones. | Nadie |
| `arrepdpdetalle_actualizar_pm2_con_inpc_acumulado(id_arrepdp)` | función | **Matemática ERRÓNEA**: hace `pm2_nuevo = pm2_anterior + INPC` (suma el porcentaje como pesos en vez de aplicarlo) e **ignora `ptsINPC`**. Peligrosa si alguien la ejecutara. | Nadie |
| `arrepdp_listar_contratos_ciclo_inpc(p_anio, p_mes)` | función | Localiza contratos con aniversario en un mes dado, pero sin filtrar `status`/`vigente`/`pdpActivo` y con corte de fin grueso (`fecFin > 31/dic`). Su semántica sirve de **referencia** para la nueva función, corregida. | Solo v1 apagado (`contratos_incremento_widget.dart`, SQL crudo vía `cdg`) |

**NO retirar (relacionadas pero vigentes):**
- **`arrepdpdetalle_actualizar_campo_manual`** — la usa v2 (doble clic en la corrida, `PATCH
  /arrendatarios/planes/:id/detalle`). Única con la matemática correcta
  (`pm2 = pm2_anterior × (1 + (INPC+pts)/100)`, plano hacia años futuros). **Base de la función
  automatizada nueva.**
- **`inpc_trigger_corregir_id`** — trigger vivo (`inpc_before_insert_update_trigger`) de la tabla `inpc`.
- **`inpc_verificar_vigencia_ultimo_registro()`** — huérfana tras apagar v1 (la usaba la Bienvenida para
  avisar INPC desactualizado), pero su lógica (¿está al día el INPC según la fecha de publicación ~día 10?)
  es **candidata a reutilizarse** en el flujo automático (aviso de captura faltante). Decidir en el diseño;
  si no se usa, pasará a esta lista.

> Retiro: como todo en este documento, cada `DROP` requiere autorización explícita caso por caso, tras el
> despliegue de la función nueva.

- _(siguiente hallazgo…)_
