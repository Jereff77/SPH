# 07 — Verificación adversarial · Presupuesto por año, «solo anual» y Ajuste Presupuestal

> 2026-11-03. Tres revisores **Opus** independientes, uno por lente, con acceso de **solo lectura** al código y a la BD de producción.
> Informes completos (no versionados): `temp/diseno-ajuste-presupuestal/validacion-seguridad.md`, `validacion-dinero.md`, `validacion-migracion.md`.
> Mapa de consumidores previo (Sonnet): `temp/diseno-ajuste-presupuestal/consumidores.md`.
> Regla: **hallazgo ALTA = no se construye** hasta resolverlo.

## 1. Veredictos

| Lente | Veredicto | ALTA | MEDIA | BAJA |
|---|---|---|---|---|
| Seguridad / permisos / auditoría | CONDICIONADO | 1 (S-1, **preexistente**: P0 #2/#3 del tablero) | 3 | 8 |
| Dinero / cálculo / tiempo | CONDICIONADO | 0 | 5 | 8 |
| Migración / compatibilidad / operación | CONDICIONADO | 0 | 10 | 16 |

**Conclusión:** ningún hallazgo propio del paquete es ALTA. El único ALTA (S-1) describe una brecha **que ya existe hoy** para todo el sistema —cualquier usuario con sesión puede
escribir directo en la BD y concederse permisos (tablero **#2** y **#3**, P0)—; este paquete no la crea ni la empeora para el dinero ya existente, pero sí **depende** de ella
para que el permiso 432 sea infranqueable. Se mitiga lo que es del paquete (M8) y se declara la dependencia por escrito.

## 2. Disposición de cada hallazgo MEDIA/ALTA

| ID | Lente | Hallazgo | Disposición | Dónde quedó |
|---|---|---|---|---|
| S-1 | Seguridad | Con el token del navegador y la anon key se puede insertar/editar/borrar un 98 directo en `cxp`, concederse la clave 432 y borrar `auditoria` (RLS `USING(true)`) | **Mitigado en lo propio + dependencia declarada.** M8: guardia que solo deja tocar un 98 al servicio (`service_role`). Cerrar #2/#3 es del tablero (P0): el 432 es tan fuerte como cualquier otro permiso hasta entonces. Se corrigen las afirmaciones del brief §5.1 y TRD §5.6/5.7 | SQL M8; TRD T14; brief §5.1 |
| S-2 | Seguridad | `ia_consulta_sql` (SECURITY DEFINER, abierta a anon; P0 #1) salta el REVOKE de la función nueva | **Aceptado/preexistente** (tablero #1). La función nueva es `SECURITY INVOKER`, así que no agrava la fuga | TRD T1 |
| S-3 | Seguridad | `SECURITY DEFINER` innecesario en la función | **Aceptado:** `SECURITY INVOKER` + `search_path = public, pg_temp` (los dos llamadores tienen BYPASSRLS y SELECT; verificado) | SQL M2 |
| S-4 | Seguridad | La hora real de captura vive solo en `auditoria` (borrable); no basar «anulado por» en un prefijo de texto | **Aceptado:** `cxpComentarios` con `tipo` 10 (captura) y 11 (anulación) + `ultimoComentario` | 05 §4.2 |
| M-01 | Migración | La reversa de M2b no funciona con `CREATE OR REPLACE` (27→26 columnas) | **Aceptado:** `DROP VIEW`+`CREATE VIEW`+GRANTs, orden exacto; el SQL de reversa se escribe y prueba en seco antes de aplicar | SQL M2b; plan §3 |
| M-02 / D4 | Migración / Dinero | `status = false` es un estado nuevo; Looker/n8n lo cuentan como Pagado | **Aceptado:** M9 (filtro `status = true` en `lkr_cxp` y `n8n_cxp_resumen`; sin efecto con los datos de hoy); KB del agente «para gasto real filtra `status = true`». Se avisa a Jereff que Looker/n8n no se pudieron verificar | SQL M9; 05 V29 |
| M-03 | Migración | «Solo anual» quedaría auditado sin autor (`admin`, uid NULL) | **Aceptado:** `comoActor` (y se corrigen las hermanas del mismo archivo) | 05 §4.4; plan 1.9 |
| M-04 | Migración | La anulación no es atómica (3 llamadas) | **Aceptado:** un solo `UPDATE` con `status=false` y el motivo en `ultimoComentario`; el comentario de historial va después | 05 §4.2.2 |
| M-05 | Migración | Regla inventada «años anteriores = solo lectura en el servidor» (bloquearía corregir el presupuesto 2026 en enero) | **Aceptado:** se elimina; sin regla por año | 05 §4.4; 03; 04 |
| M-06 | Migración | El PRD promete «etiquetar» ajustes en Reportes; la RPC compartida no devuelve el tipo | **Aceptado:** PRD H5 reescrito; el etiquetado en ese reporte exigiría cambiar una RPC compartida y queda fuera | PRD H5 |
| M-07 / D5 | Migración / Dinero | Doble conteo si los históricos ya cargados como urgentes (monto contable 0) se recapturan como ajuste y luego se corrige su monto | **Mitigado + decisión de Jereff:** la vista previa avisa cuántos urgentes/especiales hay en esa cuenta y mes; qué se hace con ellos lo dispone Jereff | 05 §4.2.4; brief §8.3 |
| M-08 | Migración | El plan subía el código antes de M3–M6: Soporte podría capturar sin CHECK ni proveedor genérico | **Aceptado:** dos despliegues (F1, F2) y siempre BD antes que código | plan §3b; 05 §5; SQL |
| M-09 | Migración | La prueba con un ajuste demo en producción es imposible de limpiar (no se borra) | **Aceptado:** alta y anulación solo dentro de `BEGIN…ROLLBACK` o rama; nada demo en producción | plan 2.8 |
| M-10 | Migración | La reversa de F1 no incluía el código | **Aceptado:** primero el código anterior, luego la BD | plan §3 |
| D1 | Dinero | El comprometido (4/99) se fecha por `fc`, no por autorización: $630,572.58 (3 facturas dic→ene) cuentan en 2025 y no en 2026 | **Conservado a propósito** (igual que hoy y que el plan de julio; F1 no mueve cifras). Se resuelve en el **Paquete 2** (año de origen = año de autorización) y queda documentado | brief §3 y §8.4; 05 V26 |
| D2 | Dinero | El CHECK deja pasar NULLs | **Aceptado:** `IS DISTINCT FROM`, `IS NOT NULL`, `COALESCE`, `tdc` | SQL M6 |
| D3 | Dinero | Un ajuste con proveedor real no se puede anular si luego desactivan al proveedor | **Aceptado:** se rechaza desactivar un proveedor con ajustes activos (sin tocar el trigger compartido) | 05 §6 C9 |

## 3. Hallazgos BAJA incorporados (resumen)
Texto de UTC/hora local corregido (D6); fila «Sin cuenta en catálogo» en Cuentas por año (D7); año futuro = acumulado anual completo, como la función (D8); la prueba de equivalencia compara `estado_comprometido` y el conteo correcto es 6 (D9);
validación del monto como cadena con tope 999,999,999.99 (D11); «hoy» en `America/Mexico_City` (D12); el CHECK **sí** frena el cambio de estado, texto corregido (D13, TRD §8); protección contra doble envío (60 s);
Zod `.strict()`, saneo de caracteres bidireccionales y de control, `incluirAnulados` parseado a mano; exportar Excel con saneo de celdas que empiezan por `= + - @`; vista previa limitada a cifras de la cuenta consultada;
`anular()` con `comoActor`; clave 432 en la lista de claves del agente (`consultas.service.ts`); O3 del PRD aclarado (2025 sube $6.67 M por los estados 7 y 99).

## 4. Lo que los revisores intentaron romper y **resistió** (verificado)
- La función reproduce la vista actual para 2026 (**82 cuentas, 0 diferencias de dinero**, dos revisores independientes); con M1+M2+M2b, **0 cuentas cambian su disponible mañana**.
- Sin choques de `plpgsql.variable_conflict = error` (revisado referencia por referencia); las vistas envolventes conservan nombre, tipo y orden de las 26 columnas, y nada depende de ellas.
- La conversión UTC→México no mueve ninguna fila de mes ni de año; estados 7/99 no se cuentan doble (0 coincidencias).
- El INSERT del ajuste simulado contra los 10 triggers reales: ninguno lo rechaza ni lo deja fuera del CHECK (con `nomCFDI` no vacío).
- Mass-assignment por la API, IDOR y carrera al anular, actor tomado del JWT, triggers de auditoría presentes, errores 5xx redactados, Soporte pasa sin la 432, proveedor genérico sin choque de RFC.
- El autorizador corre como `service_role` (vía `comoActor`): quitar EXECUTE a `authenticated` no rompe la aprobación. Rendimiento: 7.3 ms hoy; ≈350 ms por autorización a 50× el volumen (BAJA; índice propuesto si hace falta).

## 5. Lo que los revisores NO pudieron verificar (queda como riesgo declarado)
- Qué tableros de **Looker** y qué flujos de **n8n** existen y con qué rol leen (se avisa a Jereff).
- La **ejecución real** de la función y del INSERT (la regla de solo lectura lo impidió): es el paso 1.4 y el 2.2 del plan, con autorización.
- La corrección de subtotales PPD que está en curso: si se aplica antes de M2b, se repite la prueba de equivalencia.
- Si la anon key ya está en manos de terceros (precondición de S-1).

## 6. Decisiones que quedan en manos de Jereff (negocio)
1. **Gastos ya cargados como «urgentes»** (monto contable 0): **resuelta el 2026-11-04 (A9/F0)**: pasan a contar y no se recapturan como ajuste (brief §8.3). Quedan dos decisiones nuevas de F0: brief §8.6 y §8.7.
2. **Looker/n8n:** M9 cambia dos vistas externas (sin efecto hoy); él decide si autoriza ese bloque.
3. **P0 #2/#3:** la fuerza real del permiso 432 depende de cerrarlos; es prioridad suya.
4. Paquete 2: ¿el compromiso se fecha por autorización?, ¿cierra 2026 en enero? (brief §8).

## 7. Alcance F0 — urgentes y líneas de captura con subtotal (2026-11-04)

Un revisor **Opus** (solo lectura: código + `SELECT`), informe completo (no versionado) en `temp/diseno-ajuste-presupuestal/validacion-f0.md`. **Veredicto: CONDICIONADO — 0 ALTA, 4 MEDIA, 4 BAJA.**
Verificado bien: los 86 UPDATE no disparan ningún efecto colateral (triggers, auditoría con `origen 3`); los montos de 2026 y 2025 cuadran al centavo; solo v2 inserta tipos 2/4; el aprobador de fuera de presupuesto está configurado y activo;
ningún paso de pago vuelve a validar presupuesto (nada se traba en lo ya aprobado/pagado).

| ID | Sev. | Hallazgo | Disposición | Dónde quedó |
|---|---|---|---|---|
| F0-01 | MEDIA | Dos cargas manuales del 29-sep (23.4 M, 91 % del efecto) podrían ser gasto de años anteriores; M10 las pondría en septiembre 2026 | **Decisión de Jereff antes de M10**: si no son de 2026, se excluyen y se capturan como ajustes 98 con su fecha real | brief §8.6; 05 V35; plan 0.1b |
| F0-02 | MEDIA | 34 urgentes/líneas aprobadas sin pago; 2 son duplicados confirmados de facturas ya pagadas (48,531.32) | **CxP revisa la lista antes de M10**; las pagadas por otra vía se eliminan (`devolver` → `eliminar`) o se excluyen | brief §8.7; 05 V36; plan 0.1b; CSV en `temp/respaldos/` |
| F0-03 | MEDIA | «subtotal ≤ total» falla con retenciones (124 facturas normales ya tienen subtotal > total) | **Aceptado:** tope 1.2 × total con confirmación «lleva retenciones»; el CHECK solo exige > 0; se corrige la frase «lado conservador» | brief inv. 12; 01 H6/riesgos; 02; 03 §8; 04 F-6; 05 §4.5, V37; plan 0.2/0.3 |
| F0-04 | MEDIA | Tras F0 deja de cumplirse el criterio de F1 («0 diferencias en 2026»): 4 líneas en 99 = 65,013.00 | **Aceptado:** se reescribe la aceptación de 1.4; A8 y O3 se actualizan | brief A8; 01 O3; 05 §1 y V20; plan 1.4 |
| F0-05 | BAJA | `mapearErrorCxp` no traduce el `23514` y `insertarEspecial`/`editar()` no lo llaman (saldría 500) | **Aceptado:** el mapper reconoce el código y se llama en ambos | 05 §4.5.4; 02 §8; plan 0.2 |
| F0-06 | BAJA | Cifras inconsistentes (14 cuentas, no 15; 22 líneas, no 26) | **Corregido** | 01 §1; 05 §7 |
| F0-07 | BAJA | El aviso al equipo no nombra a quién le cambia el trabajo; la 2.ª corrida de M10 sin respaldo propio | **Aceptado** | plan 3b y 0.8 |
| F0-08 | BAJA (preexistente) | Con un token cualquiera se puede cambiar el subtotal directo en la BD | Es el P0 #2 del tablero; no se abre otro | — |

No se pudo verificar: tableros de Looker y flujos de n8n, que Flutter v1 esté apagado de verdad, y si el front amortigua los 86 eventos de Realtime que genera M10.
