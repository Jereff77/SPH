# Validación adversarial «Gate-Datos» (Opus) — relleno de `cxp.subtotal` PPD + `SET NOT NULL`

Fecha: 2026-11-02 · Alcance: secciones 1, 2.1, 2.3, 5 y 6 del plan `temp/PLAN-subtotal-ppd.md` · Solo lectura (SELECT / `pg_get_functiondef` / catálogo). PG 15.14.

## (a) VEREDICTO: **APTO CON CONDICIONES**

No hay hallazgos ALTA. Los triggers no tocan nada más, las precondiciones se cumplen y nadie más inserta NULL. El candado sale barato. Hay **2 hallazgos MEDIA** que cambian el SQL y deben cerrarse antes de aplicar.

## (b) Hallazgos

### H1 · MEDIA — Al relleno le faltan 3 filas del mismo bug (no son «heredadas de v1»)
- **Evidencia:** `auditoria` registra **179** INSERT de `cxp` con `subtotal` NULL, todos con origen 2 (API v2). Se desglosan así: 174 siguen en NULL, 2 se borraron (`jnrd74LQseFYFvy`, `OxCxwbRRpN8XQpd`) y **3 pasaron de NULL a 0** con un UPDATE de v2 que cambió `subtotal,idCategoria[,uidGerente,nomGerente]`. Ese UPDATE es `solicitudes.service.ts:680` (`editar()` tras «Devolver»), y `solicitudes.schemas.ts:11` (`z.coerce.number().default(0)`) convierte el null en 0.
  | idCxp | idEstado | subtotal hoy | `cxp_ppd.subtotal` |
  |---|---|---|---|
  | wULNpbpQUEWh9nh | 6 | 0 | 16,800.00 |
  | rcJJWDUdp96u0JP | 6 | 0 | 25,200.00 |
  | v627XjI1hrm5Z99 | 2 (pendiente) | 0 | 11,200.00 |
  Las tres cumplen `abs(total − maestro.total) ≤ 0.01` y tienen una sola parcial por factura.
- **Impacto:** el §3 del plan dice que las 29 PPD en 0 son «heredadas de v1, el maestro tampoco trae subtotal». Para estas 3 eso es falso: el maestro sí trae subtotal y son víctimas del mismo bug. Si no se incluyen, quedan $53,200 sin contar en el presupuesto.
- **Corrección:** incluirlas en el relleno con una lista cerrada de `idCxp` y la guarda `subtotal = 0` (SQL abajo). Las otras 26 de §3 sí cumplen `maestro.subtotal = 0`; el conteo cuadra: 29 − 3 = 26.

### H2 · MEDIA — `editar()` puede volver a poner en 0 un subtotal PPD ya corregido
- **Evidencia:** las 3 filas de H1 muestran el mecanismo real: una parcial PPD regresa a estado 1 («Devolver») y se edita (cambio de categoría), y entonces `editar()` escribe el `subtotal` que manda el cliente. Pasó en 3 de 179 parciales.
- Con `SET NOT NULL`, este camino **no falla**, porque el esquema convierte null en 0. Por eso el candado no lo atrapa: la degradación sería silenciosa.
- **Corrección:** el plan §2.2 lo deja como «debe definirse». Debe cerrarse antes de aplicar: si la fila tiene `idCxpPPD`, `editar()` ignora `dto.subtotal` y conserva el valor de la BD (o lo recalcula con `subtotalParcial`). Sin esto el relleno se erosiona con el tiempo.

### H3 · BAJA — Triggers en el UPDATE masivo: inertes en las 174 filas (comprobado fila por fila)
Los triggers con `UPDATE OF <col>` solo se disparan si esa columna está en el SET. Con `SET subtotal = …` **no se disparan** `trigger_actualizar_nom_gerente` (OF uidGerente), `trigger_cxp_validar_categoria` (OF idCategoria, idEstado) ni `trigger_cxp_validar_y_actualizar_proveedor` (OF idProveedor, tipoProveedor). `trigger_cxp_actualizar_nomcfdi` es solo AFTER INSERT. `trigger_cxp_validar_fecha_cfdi` está en estado `D` (desactivado).

Los que sí se disparan, con su lógica replicada en SELECT sobre las 174 filas:

| Trigger → función | Qué podría cambiar | Resultado en las 174 |
|---|---|---|
| `set_estado` → `update_estado()` | recalcula `estado` desde `idEstado`; si `tdc=true` fuerza `idEstado=7` | `tdc_true=0`, `estado` distinto del recalculado = **0**, `idEstado` NULL = 0 → sin cambio |
| `set_week_info` → `update_week_info()` | recalcula `numSem`/`rangoSemana` desde `fecSolicitud` (tipo `date`, sin efecto de zona horaria) | `numSem` distinto = **0**, `rangoSemana` distinto = **0**, `fecSolicitud` NULL = 0 → sin cambio |
| `trigger_cxp_actualizar_gerente` | si `idCategoria` es NULL o '' borra `uidGerente`/`nomGerente`; si no cambió la categoría, regresa sin tocar nada | categoría vacía = **0** → sin cambio |
| `trigger_cxp_validar_fecha_insert` → `cxp_trigger_validar_fecha()` | en UPDATE, si `OLD.idEstado = NEW.idEstado` regresa NEW sin validar | `idEstado` no cambia (tdc=0) → **no puede lanzar excepción** ni depende del día habilitado |
| `trg_auditoria` → `fn_auditoria` | AFTER; nunca aborta (atrapa `WHEN OTHERS`) | ver H4 |

`numMes`/`numAnio`/`fecha` no los toca ningún trigger. La KB de `cxp.md` describe la degradación a `idEstado=3`; la causa fue `trigger_cxp_validar_fecha_cfdi`, que sigue apagado.

Nota de KB (BAJA): `cxp.md:836-838` dice que `trigger_cxp_validar_fecha_insert` está DISABLED, pero en la BD está **activo** (`O`). Hay que corregir la KB.

### H4 · BAJA — Auditoría: actor NULL, origen 3; trazable solo si se documenta
- Por el MCP no existe `request.jwt.claims`, así que `fn_auditoria` escribe `uid = NULL` y `origen = 3` («cambio directo en BD»). Se generan 177 filas (una por fila real cambiada), con diff solo de `subtotal` y unos 2.4 KB c/u (≈ 420 KB; `auditoria` pesa hoy 458 MB). Es aceptable.
- **Corrección:** el archivo de migración en `base-conocimiento/migraciones/` debe registrar quién aplicó, cuándo (timestamp) y la lista de `idCxp`, para ligar esas filas `origen=3`. Opcional: insertar en la misma transacción una fila marcador en `auditoria` con `comentario`.
- Efecto lateral: `cxp` está en la publicación `supabase_realtime` → salen 177 eventos UPDATE a los clientes suscritos. Es inocuo.

### H5 · BAJA — Ninguna otra escritura inserta NULL; el candado no rompe a nadie
- **Funciones SQL:** las únicas que escriben en `cxp` (`cxp_actualizar_estatus_mes_anio`, `cxp_aprobados_sin_pago_aplicado`, `cxp_autorizar_solicitud_pago`, `cxp_actualizar_nomcfdi_vacio`) solo hacen UPDATE de otras columnas. Ninguna hace INSERT ni toca `subtotal`. `pg_cron` no tiene jobs sobre `cxp`.
- **API:** el único `subtotal: null` del repo `version2` es `ppd.service.ts:523`. `solicitudes.service.ts:632` usa `cfdi.subtotal`. Los tipos especiales (`:915`, `fila`) omiten `subtotal`, así que aplica el DEFAULT 0. `editar()` siempre manda un número. El front no escribe `cxp` directo.
- **v1 Flutter:** su último INSERT/UPDATE en `cxp` (origen 1) fue el **2026-06-11**. Nunca insertó NULL. Ningún UPDATE histórico pone `subtotal` en NULL.
- **Tabla y dependencias:** 2,348 filas (2.4 MB). `SET NOT NULL` toma ACCESS EXCLUSIVE y hace un scan de milisegundos. Hoy no hay transacciones largas. No rompe vistas (`lkr_cxp`, `n8n_cxp_*`, `v_resumenPresupuesto`, `v_resumenpresupuesto`, `…_backup_20250820`) ni políticas RLS (`AuthenticatedAccess_cxp`, `BlockAnonAccess_cxp`).
- **Riesgo real:** la cola de locks. Si algo retiene un lock, el ALTER se queda esperando y bloquea a todos los que lleguen detrás. Mitigación: `SET LOCAL lock_timeout='5s'`.
- **Alternativas:** `CHECK … NOT VALID` + `VALIDATE` no vale la pena con 2.3k filas. Un trigger de relleno tampoco: escondería el bug, que es justo lo que el candado busca exponer.

### H6 · BAJA — Precondiciones: se cumplen exactas, conteo sin cambio (hoy 2026-11-02)
- NULL hoy = **174**: `sin idCxpPPD=0`, `maestro inexistente=0`, `maestro.subtotal ≤0 o NULL=0`, `abs(total dif)>0.01 = 0`. Hay **174 facturas distintas**, cada maestro con una sola fila en `cxp` (0 maestros con >1 fila), `diferido=false` 0, `idFolioDif` NULL 0, `status=false` 0.
- `Σ total = 36,365,650.17` y `Σ subtotal a escribir = 31,426,912.69`.
- Por estado: 6 → 144 (143 MXN + 1 `XXX`), 4 → 24, 3 → 3, 2 → 1, 1 → 2 (una de ellas **USD**: `IfXf7vkKbRWlY8X`, 2,900, cat. 53-480-0).
- `fc` va del 2026-06-10 al 2026-10-27. El último INSERT en `cxp` fue el 2026-10-28.
- **Retenciones:** 11 filas tendrán `subtotal > total`. Es coherente con la convención, porque hay 118 solicitudes no PPD que ya están así.
- **Folio 90699788-…EFFB** (`7Ls4PVOUab5CNRA`, 53-450-0, pagada): `total/subtotal = 0.99840`, que encaja con un 16.16 % de retención o descuento sobre IVA. Si fuera un `Descuento` del CFDI, el subtotal antes del descuento sobrestimaría el gasto en ≤ $27,930. El riesgo es de 1 fila y es aceptable copiar tal cual, siempre que quede anotado.
- La fila USD pendiente se validará contra un presupuesto en MXN como 2,900 «pesos». Hoy se valida con 0, así que no empeora. Cae dentro del pendiente de divisas de §3.

### H7 · BAJA — Efecto en `v_resumenPresupuesto` y `cxp_autorizar_solicitud_pago`
- **Ojo:** la función usa `v_resumenPresupuesto` **sin comillas**, así que resuelve a la vista en minúsculas `public.v_resumenpresupuesto`. La API (`aprobacion.service.ts:160`) usa la vista con mayúsculas. Hoy las dos tienen definición **idéntica** (`pg_get_viewdef` iguales), pero cualquier cambio futuro a la vista debe aplicarse a ambas.
- **Simulación:** con el presupuesto de **noviembre** se probaron las 61 solicitudes pendientes (estados 1/2, PPD y no PPD) de las categorías afectadas, más `v627…`. Se calculó `gastado_comprometido + Δrelleno + subtotal_propio ≤ presupuesto_acumulado` antes y después. **Ninguna cambia de resultado.**
  - Las que ya fallaban siguen fallando: 11-601-0 y 11-602-3 (`oXjvbHRem9oDFiM`, PPD estado 2) tienen acumulado 0, y las 25 de 52-210-0 ya están excedidas.
  - Las que pasaban siguen pasando.
- **Margen estrecho:** 53-480-0 quedaría en 1,592,916.80 contra 1,703,779 (holgura ≈ $110.9k). Tras aprobar `j8D3Dr7uK2X8daJ` ($95,000), la holgura baja a ≈ $15.9k. La afirmación del plan §4 («53-480-0 pasaría a fuera de presupuesto») usaba cifras de octubre y hoy no se sostiene; hay que recalcular §4 el día de aplicar.
- El camino del aprobador «fuera de presupuesto» no cambia.

### H8 · BAJA — Orden, concurrencia y reversa
- El orden código → relleno → candado es correcto. Además conviene que **relleno y candado vayan en UNA transacción** con un conteo exacto como guarda:
  - Si el código viejo sigue vivo y nace un NULL nuevo, el conteo ≠ 174 y todo aborta sin dejar nada a medias.
  - Si nace justo después del COMMIT, el INSERT falla con 23502 (500 ruidoso), que es lo buscado.
- **Concurrencia:** en READ COMMITTED, un UPDATE concurrente (aprobar/pagar) sobre la misma fila se serializa por lock de fila; el `WHERE subtotal IS NULL` se reevalúa (EvalPlanQual). Si otra transacción ya puso subtotal, la fila se salta y el `ROW_COUNT` ≠ esperado aborta. No hay pérdida de datos.
- **La reversa propuesta es insuficiente:**
  1. Debe hacer `ALTER COLUMN subtotal DROP NOT NULL` primero, o el `SET subtotal = NULL` falla.
  2. Debe restaurar **solo** las filas que no cambiaron desde el relleno (`AND c.subtotal = m.subtotal`), para no pisar ediciones legítimas posteriores.
  3. Las 3 filas de H1 vuelven a **0**, no a NULL.

## (c) Condiciones para aplicar

1. **Antes:** el código de §2.2 debe estar desplegado e incluir el cierre de `editar()` para filas `idCxpPPD` (H2). Hay que verificar que el API en producción ya es la versión nueva: hacer una parcial de prueba o revisar la versión desplegada.
2. Guardar respaldo en `base-conocimiento/migraciones/`: lista `(idCxp, subtotal_actual)` de las 177 filas y el script de reversa corregido (H8).
3. Ejecutar en una sola transacción:

```sql
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $$
DECLARE n_null int; n_ok int; n_upd int;
BEGIN
  SELECT count(*) INTO n_null FROM public.cxp WHERE subtotal IS NULL;
  SELECT count(*) INTO n_ok
  FROM public.cxp c JOIN public.cxp_ppd m ON m."idCxpPPD" = c."idCxpPPD"
  WHERE c.subtotal IS NULL AND m.subtotal > 0 AND abs(c.total - m.total) <= 0.01
    AND c.tdc = false AND c."idEstado" IS NOT NULL
    AND (SELECT count(*) FROM public.cxp x WHERE x."idCxpPPD" = c."idCxpPPD") = 1;
  IF n_null <> 174 OR n_ok <> 174 THEN
    RAISE EXCEPTION 'Precondición: nulos=% aptos=% (esperado 174/174)', n_null, n_ok;
  END IF;

  UPDATE public.cxp c SET subtotal = m.subtotal
  FROM public.cxp_ppd m
  WHERE m."idCxpPPD" = c."idCxpPPD" AND c.subtotal IS NULL
    AND m.subtotal > 0 AND abs(c.total - m.total) <= 0.01;
  GET DIAGNOSTICS n_upd = ROW_COUNT;
  IF n_upd <> 174 THEN RAISE EXCEPTION 'Relleno NULL: % filas (esperado 174)', n_upd; END IF;

  -- H1: mismas víctimas del bug, puestas en 0 por editar()
  UPDATE public.cxp c SET subtotal = m.subtotal
  FROM public.cxp_ppd m
  WHERE m."idCxpPPD" = c."idCxpPPD"
    AND c."idCxp" IN ('wULNpbpQUEWh9nh','rcJJWDUdp96u0JP','v627XjI1hrm5Z99')
    AND c.subtotal = 0 AND m.subtotal > 0 AND abs(c.total - m.total) <= 0.01;
  GET DIAGNOSTICS n_upd = ROW_COUNT;
  IF n_upd <> 3 THEN RAISE EXCEPTION 'Relleno H1: % filas (esperado 3)', n_upd; END IF;
END $$;
ALTER TABLE public.cxp ALTER COLUMN subtotal SET NOT NULL;
COMMIT;
```

4. **Después** (SELECT):
   - 0 filas NULL.
   - Las 177 filas con `c.subtotal = m.subtotal`.
   - En `auditoria`, las 177 filas `origen=3` del timestamp de aplicación tienen como **única** llave en `cambios` a `subtotal`: `SELECT count(*) … WHERE cambios - 'subtotal' <> '{}'::jsonb` debe dar 0. Esto comprueba de forma directa que ningún trigger tocó otra columna.
   - `attnotnull = true`.
   - Recalcular la vista para 11-604-0 / 11-607-0 / 53-480-0.
5. Corregir la KB (`cxp.md:836-838`: `trigger_cxp_validar_fecha_insert` está activo) y anotar el folio 90699788 (H6) y la doble vista (H7).
