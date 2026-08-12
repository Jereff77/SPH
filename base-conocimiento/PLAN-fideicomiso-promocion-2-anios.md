# PLAN — Fideicomiso · Promoción del 9% configurable a 1 ó 2 años (por condición de adhesión)

> **Estado: ✅ IMPLEMENTADO en producción el 2026-08-11 (v2.68.0).** Aprobado por Jereff con las 4
> decisiones cerradas (§8). Migraciones archivadas en
> `migraciones/2026-08-11-fideicomiso-promocion-2-anios.sql`.
> Autor: Toribio. Plan: 2026-08-04. Riesgo: **ALTO** (dinero + RPC compartida + migración).
> Gate adversarial del PLAN: ejecutado (2 verificadores Opus; RECHAZADO v1.0 / APROBADO CON CAMBIOS
> → v1.1 incorporó todas las correcciones). Validación adversarial del CÓDIGO: ejecutada al cierre.
>
> **Evidencia de no-regresión (lo que Jereff pidió cuidar):** huella de los cálculos de las 97
> adhesiones **idéntica antes y después** — `filas=4078`, `huella=ca1ee0226340150dbc3b082ce7922578`.
> Las 114 condiciones quedaron en `promoAnios=1`; las 48 con promoción siguen exactamente igual.
>
> **Pendiente operativo:** Jereff indicará los **2 fideicomitentes** que pasan a 2 años; se aplican
> con el procedimiento del §3.5 (listar TODAS sus condiciones → medir delta → aplicar con actor
> atribuible). Nada se ha aplicado todavía.

## 1. Contexto y decisiones de negocio

Los fideicomitentes con promoción reciben el **9% íntegro** del fideicomiso (comisión SPH = $0)
durante su periodo promocional; al vencer, cobran su tasa contratada (7.1–8.7%) y SPH el
diferencial. El negocio pide poder otorgar la promoción a **2 años** a fideicomitentes concretos.

Decisiones **cerradas** por Jereff (2026-08-04):

1. La duración vive **por condición de adhesión** (`fideCondiciones`, una por propiedad/ticket) —
   no en el fideicomiso general. ⚠️ Corrección del gate: un fideicomitente puede tener **varias**
   condiciones (adhesión 88 tiene 2, ambas con promo; la B tiene 9); "ponerle 2 años a un
   fideicomitente" = actualizar **todas** sus condiciones con promo (ver §3.5).
2. **Tasa del 2º año = 9% íntegro** (comisión SPH $0 los dos años). Sin campo de tasa.
3. **⛔ INMUTABILIDAD:** una promoción asignada no se modifica por el sistema (ni 1↔2 años, ni
   quitarla). Los **2 fideicomitentes** a extender los indica Jereff y se cambian por **update
   manual autorizado en BD**, con evidencia y auditoría.
4. 🧑‍⚖️ **PENDIENTES (bloqueantes, ver §8):** D1 blindaje de la inmutabilidad en BD ·
   D2 retroactividad · D3 ¿la UI ofrece "2 años"? · D4 REVOKE de la RPC a anon/PUBLIC.

## 2. Cómo funciona hoy (verificado contra BD real)

- Flag `fideCondiciones."Prom9%"` (boolean); UI: checkbox en `ConfigFideModal.tsx` (clave 510).
- Regla hardcodeada en la RPC **`plan_dispersiones_dinamico`** (SECURITY DEFINER, owner postgres):
  `v_fin_promocion := v_primer_pago + INTERVAL '1 year'`, con `v_primer_pago = MIN(pagos.fecha)`
  **por propiedad** de la condición; tasa promo `9.0` literal (== `fideicomiso.rendimiento` hoy).
- Cadena de consumo (Dispersiones, 530): `resumen_fideicomiso_completo` → LATERAL
  `resumen_dispersion_dinamico` → `plan_dispersiones_dinamico`; el desglose del front llama a la
  última directo. Verificado por el gate: **inventario completo** — ninguna otra función/vista/
  trigger/cron/edge contiene la regla del año; los `resumen_*` no la duplican; los 7 cron jobs no
  tocan fideicomiso; la edge `contabilidad-fideicomiso` no toca la promo.
- Funciones relacionadas que **NO se tocan**: `plan_dispersiones_dinamico_corregido` (defectuosa,
  obsoleta), `fideicomiso_rendimientos_promocion`/`_resumen_consulta` (huérfanas),
  `fidepdpdispersion_recalcular_por_condicion` (rota: CTE placeholder + columna inexistente),
  `insertar_dispersiones_adherente`/`guardar_dispersiones_fideicomiso` (snapshot
  `fideDispersiones`, heredan el cambio solos).
- Kardex (540): lee `fidePdpDispersion`, **snapshot congelado** jul-2025 (775 filas) — deuda
  preexistente (R1).
- Datos: 114 condiciones / 97 adhesiones; **48 con promo**; **21 de esas 48 ya vencieron su
  primer año** (primer pago 2024-09-17 a 2026-03-04); 0 excederían `fideicomiso.fecfin`
  (2028-12-31) con 2 años; 1 condición con promo y sin pagos (inocua: el cursor no la itera).
- v1 (Flutter) está **archivado** (`version1.zip`); su mapper de la tabla opera por nombre de
  columna → la columna nueva con DEFAULT **no lo rompería**. PERO su **anon key es pública** (en
  el bundle) y los grants/políticas RLS actuales de `fideCondiciones` permiten a cualquier
  usuario `authenticated` escribirla vía PostgREST → ver D1.

## 3. Cambios propuestos

### 3.1 BD — columna nueva (migración; requiere autorización con este SQL exacto)

Archivo: `migraciones/2026-08-04-fidecondiciones-promo-anios.sql`

```sql
SET lock_timeout = '5s';  -- fideCondiciones la leen las 3 RPC de Dispersión

ALTER TABLE public."fideCondiciones"
  ADD COLUMN "promoAnios" smallint NOT NULL DEFAULT 1
  CONSTRAINT "fideCondiciones_promoAnios_check" CHECK ("promoAnios" BETWEEN 1 AND 2)
  CONSTRAINT "fideCondiciones_promo_coherente_check" CHECK ("Prom9%" = true OR "promoAnios" = 1);

COMMENT ON COLUMN public."fideCondiciones"."promoAnios" IS
  'Duración en años de la promoción del 9% (solo aplica si "Prom9%"=true; el CHECK exige 1 sin promo). 1=primer año (default), 2=dos años. Inmutable una vez asignada la promoción; 2 años solo por update manual autorizado.';
```

- DEFAULT 1 cubre las 114 filas (48 con promo quedan idénticas); PG 15 no reescribe la tabla.
- El 2º CHECK impide un `promoAnios=2` "dormido" bajo `Prom9%=false`.
- La tabla ya tiene `trg_auditoria` (verificado, diff campo a campo).

### 3.1-bis BD — blindaje de inmutabilidad en el MOTOR (🧑‍⚖️ D1)

Hallazgo del gate (ambos verificadores, ALTA): la inmutabilidad solo en NestJS es **cosmética** —
`authenticated` tiene DML sobre `fideCondiciones` con políticas RLS permisivas
(`auth.role()='authenticated'`, sin WITH CHECK), la anon key viaja en el bundle v1, y la
auditoría registra escrituras reales recientes fuera de v2 (`origen=1` y `origen=3`). Además el
`ON DELETE CASCADE` de propiedades permite borrar-y-recrear la condición desde fuera.

Propuesta (recomendada): **trigger `BEFORE UPDATE OR DELETE` en `fideCondiciones`**:
- UPDATE: si `OLD."Prom9%"=true` y cambia `"Prom9%"` o `"promoAnios"` → `RAISE EXCEPTION`,
  salvo escape explícito `current_setting('app.promo_override', true)='on'` (solo usable por
  quien entra directo a BD con autorización — §3.5).
- DELETE: si `OLD."Prom9%"=true` → mismo bloqueo con el mismo escape.
- Protege contra v1/PostgREST **y** contra bugs futuros del propio backend (`service_role`
  bypassa RLS pero NO los triggers). v2 no se rompe: sus escrituras legítimas nunca cambian una
  promo asignada.
- Complemento opcional (empalma con la deuda P0 ya diagnosticada del rol `authenticated`):
  `REVOKE INSERT, UPDATE, DELETE ON "fideCondiciones" FROM authenticated;` — v2 usa
  `service_role`, no le afecta (verificado en `supabase.service.ts`).

### 3.2 BD — RPC `plan_dispersiones_dinamico` (CREATE OR REPLACE, misma firma)

Un solo punto de cambio en el cuerpo (re-emitido desde `pg_get_functiondef` REAL, nunca de
memoria — R4):

```sql
-- ANTES
v_fin_promocion := v_primer_pago + INTERVAL '1 year';
-- DESPUÉS
v_fin_promocion := v_primer_pago + make_interval(years => COALESCE(v_condiciones."promoAnios", 1));
```

Más dos endurecimientos aprovechando el REPLACE (hallazgos del gate):
- **`SET search_path = public, pg_temp`** (SECURITY DEFINER sin search_path = advisor conocido;
  `proconfig` hoy NULL).
- 🧑‍⚖️ **D4:** `REVOKE EXECUTE ... FROM PUBLIC, anon;` — hoy la RPC es ejecutable por **anon** y
  devuelve el padrón con RFC y montos, con la anon key pública en el bundle v1 y adhesiones
  enumerables (1–3 caracteres). v2 la invoca con `service_role` (no le afecta); si Jereff lo
  difiere, queda en `DEUDA.md` como P0 con esta evidencia.

Garantías verificadas por el gate: `make_interval` ≡ `INTERVAL '1 year'` para years=1 (casos
bisiestos incluidos); `promoAnios` es inerte sin promo (solo se lee dentro de
`IF v_tiene_promocion`); ISR y `rendimiento_sph=0` del 2º año usan el mismo código ya probado del
1º; `dias_promo + dias_normal = dias_periodo` en el mixto. Consumidores intactos (misma firma).
⚠️ Verificación obligatoria del REPLACE: `prosecdef/proowner/proacl` idénticos antes/después
(si el cuerpo omitiera SECURITY DEFINER pasaría a INVOKER en silencio) — §6.

### 3.3 Backend (`apps/api/src/modules/fideicomiso/`)

1. `fideicomiso.schemas.ts` → `condicionesSchema`:
   - `promoAnios: z.coerce.number().int().min(1).max(2).optional()` — **SIN `.default()`**
     (hallazgo H5: un default reintroducido por Zod en requests que omiten el campo — p. ej.
     bundle viejo — dispararía el 400 de inmutabilidad al editar cualquier otro campo).
   - `prom9`: pasa a `.optional()` **sin default** por la misma razón.
   - `undefined` = "no cambiar".
   - 🧑‍⚖️ D3: si la UI no ofrece 2 años, la API acota `max(1)` y el 2 queda inalcanzable por API.
2. `config-fide.service.ts`:
   - `condiciones()`: agregar `"promoAnios"` al SELECT.
   - `guardarCondiciones()` — reglas server-side:
     - UPDATE con promo ya asignada (`actual."Prom9%"=true`): **excluir** `Prom9%`/`promoAnios`
       del payload si vienen `undefined` o iguales; si vienen con valor **distinto** → 400
       `'La promoción ya está asignada a esta adhesión y no puede modificarse desde el sistema.'`
       Editar los demás campos (comentarios, apartado, etc.) sigue funcionando (criterio §6.4).
     - UPDATE sin promo: se permite asignarla (`prom9=true` + duración según D3).
     - Si `prom9=false` → forzar `promoAnios=1` (coherente con el CHECK).
   - **Regla 4b (hallazgo D2):** sustituir los `InternalServerErrorException(error.message)` de
     `guardarCondiciones`/`validarAdhesionUnica` por `fallaBd(...)` (el texto crudo de Postgres
     ya se fuga hoy, y la constraint nueva agregaría otra vía).
3. Sin endpoints nuevos; mismas rutas, permiso **510**; escrituras vía `comoActor(uid)`.

### 3.4 Frontend (`apps/web/src/features/fideicomiso/`)

1. `fideicomiso.api.ts`: `CfgCondiciones.promoAnios: number | null`;
   `CondicionesInput.promoAnios?: number`.
2. `ConfigFideModal.tsx` → `CondicionesTab`: el checkbox se sustituye por un selector.
   Opciones según 🧑‍⚖️ D3; en cualquier caso:
   - Una condición con `promoAnios=2` asignado **se muestra** («9% los primeros 2 años»).
   - Promo ya asignada → selector **deshabilitado** + leyenda «La promoción no se puede
     modificar una vez asignada.» (cosmético; la regla real: backend + trigger D1).
3. **Dashboard/Adhesiones (hallazgo H6, recomendado):** `v_fideicomiso` no expone la promo — con
   duración variable e inmutable conviene verla sin abrir el engrane por propiedad. Cambio
   aditivo: `CREATE OR REPLACE VIEW v_fideicomiso` agregando `"Prom9%"` y `"promoAnios"` +
   columna «Promoción» en la tabla (—/1 año/2 años). La vista es solo-lectura (único consumidor:
   Dashboard/Adhesiones v2 — verificado). Si Jereff lo excluye, se anota fuera de alcance.
4. Sin cambios en `DispersionesPage`/Kardex: el filtro «fin de promoción» sigue funcionando solo.

### 3.5 Datos — los 2 fideicomitentes a 2 años (posterior al deploy, manual y autorizado)

Procedimiento obligatorio por fideicomitente (correcciones C3/H4/E2/H3 del gate):

1. Listar **TODAS** sus condiciones (nunca una suelta):
   ```sql
   SELECT fc."idfideCond", fc."noAdhesion", fc."Prom9%", fc."promoAnios", pr."nomDescriptivo", i.razonsocial
   FROM "fideCondiciones" fc JOIN propiedades pr USING("idPropiedad")
   JOIN inversionista i ON i."idInversionista" = pr."idInversionista"
   WHERE i.razonsocial ILIKE '%<nombre>%' ORDER BY fc."noAdhesion";
   ```
2. **Delta cuantificado ANTES de aplicar** (decisión D2 informada): `plan_dispersiones_dinamico`
   del adherente agregado por `nodispersion`, comparando `rendimiento_bruto`/`rendimiento_sph`/
   `dispersion_neta` actual vs simulado con 2 años (transacción `BEGIN … ROLLBACK`, viable por
   MCP — verificado). Si ya venció su año 1, el delta muestra los trimestres pasados re-preciados.
3. Aplicar en transacción, **con actor atribuible** (hallazgo E2 — sin esto la auditoría queda
   `origen=3` sin QUIÉN):
   ```sql
   BEGIN;
   SET LOCAL "request.jwt.claims" = '{"sub":"<uid real del autorizador>","role":"service_role"}';
   SET LOCAL app.promo_override = 'on';           -- escape del trigger D1
   UPDATE "fideCondiciones" SET "promoAnios" = 2
    WHERE "idfideCond" IN (<todas las de ese fideicomitente con "Prom9%"=true>);
   COMMIT;
   ```
   Referencia de la autorización en `auditoria.comentario` + entrada en bitácora.
4. Verificar coherencia por adhesión: `SELECT "noAdhesion" … HAVING count(DISTINCT "promoAnios")>1`
   sobre condiciones con promo → debe devolver 0 filas.
5. ⚠️ Advertir en ese momento: el **Kardex** de ese fideicomitente no reflejará la extensión (R1).

### 3.6 Tipos, KB y cierre

- `@erp/types`: `promoAnios` en `database.types.ts` (edición puntual, patrón v2.44.0) + build.
- KB con la skill **`kb-agente-soporte`** (hallazgo H7): `modulos/fideicomiso.md` debe sumar a
  `palabras_clave` («promoción 9%», «promoción 2 años», «cuánto dura la promoción», «por qué me
  bajó el rendimiento», «fin de promoción») + bloque para el agente de soporte con la regla
  (9% íntegro, comisión SPH 0, duración por condición, inmutable, fin = primer pago de la
  propiedad + N años). El agente ya consulta `fideCondiciones` (rol RO) y hoy no puede responder
  nada de la promo.
- Cierre estándar «documenta todo» + skill `revision-escalabilidad`.

## 4. Checklist del gate (§ reglas del proyecto)

- 🛡️ Frontera de confianza: intacta (front → api → BD). Sin secretos nuevos.
- 🔑 Auth/RBAC: mismas rutas, `@RequierePermiso(510)`, actor del JWT (`comoActor`).
- 🔒 RLS/aislamiento: columna aditiva; **el blindaje real de la inmutabilidad depende de D1**
  (sin él, la regla es solo de v2 — no marcar ✔ hasta decidir). RPC: mismo SECURITY DEFINER;
  D4 decide si se cierra el EXECUTE de anon/PUBLIC.
- ✅ Validación: Zod (sin defaults que mientan) + 2 CHECKs en BD.
- 🧾 Trazabilidad: `trg_auditoria` verificado; updates manuales con `SET LOCAL` de claims para
  atribuir actor + `auditoria.comentario`.
- ♻️ Reutilización/impacto: inventario de consumidores COMPLETO validado por el gate (BD, cron,
  edge, código v2 y v1).

## 5. Riesgos y advertencias

- **R1 — Kardex congelado (preexistente):** `fidePdpDispersion` es snapshot de jul-2025 y su
  función de regeneración está rota y huérfana. Fuera de alcance; va a `DEUDA.md`. Los 2
  extendidos no lo verán reflejado ahí.
- **R2 — Retroactividad (🧑‍⚖️ D2):** **21 de 48** promos ya vencieron su año 1. Poner
  `promoAnios=2` a una de ellas re-precia al 9% trimestres ya dispersados y pagados a tasa
  contratada (el cálculo es dinámico) — hasta ~1.5 años hacia atrás. El §3.5.2 lo cuantifica
  antes de aplicar; la semántica la decide Jereff (D2).
- **R3 — Off-by-one preexistente** en la función muerta (`+1 year −1 day` vs `+1 year`). No se
  corrige (muerta); anotado.
- **R4 — Precisión del REPLACE:** cuerpo re-emitido desde la definición real + verificación de
  `prosecdef/proacl` + hash de no-regresión (§6.1).
- **R5 — Supuesto tasa 9:** la RPC usa `9.0` literal y `fideicomiso.rendimiento` (=9 hoy) para
  el diferencial SPH. Si algún día divergen, la promo de 2 años arrastra la divergencia el doble
  de tiempo. Supuesto explícito, sin acción.

## 6. Verificación (criterios de aceptación ejecutables)

1. **No-regresión EXHAUSTIVA (las 97 adhesiones, hash — no "a ojo"):** query canónica del gate
   (huella md5 de las 4078 filas de `plan_dispersiones_dinamico`, excluyendo `fecha_calculo`).
   **Baseline capturado 2026-08-04 (pre-cambio): `filas=4078`,
   `huella=ca1ee0226340150dbc3b082ce7922578`.** Tras el REPLACE debe ser idéntica. Equivalente
   para `resumen_fideicomiso_completo` barriendo los 20 periodos (excluyendo `fecha_calculo`).
2. **Caso 2 años (sintético, `BEGIN…ROLLBACK` en una sola llamada MCP — viabilidad verificada):**
   `promoAnios=2` a una adhesión de prueba → `TOTAL_PROMOCION`/`PERIODO_MIXTO` se extienden al 2º
   año con tasa 9 y `rendimiento_sph=0`; el año 3 regresa a tasa contratada.
3. **REPLACE sano:** `prosecdef, proowner, proacl, proconfig` esperados tras aplicar (mismo
   DEFINER/owner/ACL — o ACL sin anon/PUBLIC si D4=sí — y `search_path` fijado). Si D4=sí:
   probar con anon key que la RPC responde 42501/permission denied.
4. **Inmutabilidad y no-bloqueo:** (a) UPDATE vía API cambiando promo asignada → 400 con el
   mensaje definido; (b) editar `comentarios`/`apartado`/`rendimiento` de una condición con promo
   asignada (sin mandar los campos de promo) → **200** (hallazgo H9 — el caso que un default de
   Zod rompería); (c) asignación inicial → OK; (d) si D1=trigger: UPDATE directo sin
   `app.promo_override` → excepción; con override → pasa.
5. **Builds:** typecheck/lint/build api+web limpios.

## 7. Orden de implementación y rollback (tras el visto bueno)

1. Migración 3.1 (columna) → 2. Trigger 3.1-bis (si D1=sí) → 3. RPC 3.2 (+ §6.1/§6.3) →
   4. Tipos → backend → front (typecheck/build por fase) → 5. §6.2–§6.5 + validación adversarial
   de código (obligatoria: dinero) → 6. «documenta todo» (push lo decide Jereff).
- **Rollback (hallazgo F1) — ORDEN INVERSO OBLIGATORIO:** primero revertir la RPC (cuerpo
  anterior archivado en la migración), después la columna. ⛔ Revertir la columna con la RPC
  nueva viva tira TODO Dispersiones (el RECORD `v_condiciones."promoAnios"` revienta en
  ejecución). Prohibido revertir la columna sola.

## 8. ✅ Decisiones de Jereff (cerradas 2026-08-11)

| # | Decisión | Resolución |
|---|---|---|
| D1 | Blindaje de inmutabilidad en BD | ✅ **Trigger + REVOKE**. Aplicados: `trg_fidecondiciones_promo_inmutable` y `REVOKE INSERT/UPDATE/DELETE/TRUNCATE` de `authenticated` sobre `fideCondiciones`. |
| D2 | Retroactividad | ✅ **No aplica en la práctica**: Jereff confirmó que a ninguno de los candidatos se le ha pagado todavía una dispersión sin promoción — apenas terminaron su 1er año y la **próxima** dispersión es la primera afectada. Aun así, el §3.5 exige medir el delta antes de cada ajuste. |
| D3 | ¿«2 años» en la UI? | ✅ **Solo ajuste manual autorizado**. Implementado más estricto que lo planeado: el `condicionesSchema` **ni siquiera acepta** `promoAnios`, así que la API no puede otorgarlo por ninguna vía. En pantalla la opción se muestra deshabilitada (solo lectura, para ver a quién se le concedió). |
| D4 | `REVOKE EXECUTE` de la RPC a `anon`/`PUBLIC` | ✅ **Revocado ahora**, dentro del mismo REPLACE. ACL resultante: `postgres`, `authenticated`, `service_role`. |

## 9. Registro del gate adversarial

- **Verificador A (seguridad/dinero, Opus):** RECHAZADO v1.0. ALTA: inmutabilidad esquivable
  (grants+RLS+anon key v1), 2 años al alcance del 510, RPC ejecutable por anon con PII, 21/48 en
  ventana retroactiva. MEDIA: delete-cascade bypass, search_path, fuga `error.message`, actor
  NULL en updates manuales, rollback sin definir. Verificado OK: equivalencia `make_interval`,
  inercia sin promo, ISR/SPH del 2º año, mensaje 4b.
- **Verificador B (consistencia/realidad, Opus):** APROBADO CON CAMBIOS. ALTA: idem inmutabilidad;
  §6.1 inejecutable (fecha_calculo) → sustituido por hash exhaustivo con baseline; retroactividad
  21/48; "por fideicomitente" vs "por condición" (adhesiones multi-condición reales: 88, 30, B, A).
  MEDIA: default Zod bloquearía edición (H5), v_fideicomiso sin la promo (H6), KB/agente soporte
  (H7). Verificado OK: inventario BD completo, crons/edges limpios, v1 no rompe, ROLLBACK viable
  por MCP, RPC maneja bien duraciones distintas por propiedad en la misma adhesión.
- Todos los hallazgos no-decisorios están incorporados en §3–§7 de esta v1.1.
