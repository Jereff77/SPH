# 05 · Backend y modelo de datos — Dotación de KVA por nave

> ⚠️ Todo lo de este documento está **verificado contra la BD y el código reales**
> (MCP `supaSPH` + lectura de fuentes), no supuesto. Fecha de verificación: 2026-08-08.

## 1. Estado actual verificado

| Objeto | Hoy | Evidencia |
|---|---|---|
| `parques.kvasMt` / `kvasBt` | `numeric(12,2) NOT NULL DEFAULT 0` | catálogo |
| `parques.kvasMtDisponibles` / `kvasBtDisponibles` | `numeric(12,2) NOT NULL DEFAULT 0`, lo calcula la BD | catálogo |
| `parques.kvasMtUtilizados` / `kvasBtUtilizados` | `GENERATED` = capacidad − disponibles | catálogo |
| `parques.kvasAlta`, `kvasMedia`, +4 | `GENERATED` espejo, **compatibilidad temporal** | catálogo |
| `parques.idAcometida` | `uuid` FK → `kvaAcometidas` | catálogo |
| `naves` | sin columnas de KVA | catálogo |
| `kvasAsignados.etapa` | `text NOT NULL DEFAULT 'POR_ASIGNAR'` + CHECK de 3 valores | catálogo |
| `kva_consumo(figura, etapa, status, cant, devuelta)` | `POR_ASIGNAR → 0` (parche de v2.65.0) | `pg_get_functiondef` |
| `crearParqueSchema` | `nomParque, direccion, naves, kvasMt, kvasBt` | `parques.schemas.ts:14` |
| `agregarNavesSchema` | solo `cantidad` | `parques.schemas.ts:33` |
| Motor de cron | `cron.tareas.ts` + bitácora `v2_cron_ejecuciones` + disparo manual | `common/cron/` |
| SMTP | `modules/correo/smtp.service.ts`; patrón de mailer en `invitaciones.mailer.ts` | fuentes |

**Datos productivos en riesgo:** 169 filas en `kvasAsignados`, de las cuales **85 filas
(380 KVA de baja)** están en etapa `POR_ASIGNAR` y deben convertirse en dotación.
Verificado también: **0 comprometidos**, **0 canceladas**, y **0** filas `POR_ASIGNAR` con
devolución asociada — el borrado no choca con la FK `RESTRICT`.

## 2. Cambios de esquema

### 2.1 `naves` — la dotación

```sql
ALTER TABLE public.naves
  ADD COLUMN "dotacionMt" numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "dotacionBt" numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.naves
  ADD CONSTRAINT naves_dotacion_no_negativa
    CHECK ("dotacionMt" >= 0 AND "dotacionBt" >= 0);

COMMENT ON COLUMN public.naves."dotacionBt" IS
  'KVA de BAJA que le corresponden a la nave por disposicion del parque, tenga o no cliente. Es capacidad reservada por diseno, NO entregada: lo entregado vive en kvasAsignados.';
COMMENT ON COLUMN public.naves."dotacionMt" IS
  'KVA de MEDIA que le corresponden a la nave por disposicion del parque.';
```

📌 `naves` **ya no es una tabla compartida**: v1 (Flutter) se eliminó hace más de dos meses
(Jereff, 2026-08-08). El backend de v2 es su único escritor, así que no hay un segundo camino
que pueda dejar la dotación sin mantener ni chocar contra el trigger nuevo.

### 2.2 `parques` — el default de dotación

```sql
ALTER TABLE public.parques
  ADD COLUMN "dotacionMtNave" numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "dotacionBtNave" numeric(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.parques."dotacionBtNave" IS
  'KVA de BAJA que se le dan por defecto a cada nave nueva de este parque. Solo es la semilla: la dotacion real vive en naves.dotacionBt y se edita por nave.';
```

⛔ **El default de la COLUMNA es 0, no 5** (hallazgo H-3). El 5 que pidió el negocio es el
**valor precargado en el formulario de alta**, no el default del esquema: los 12 parques que ya
existen heredarían ese default, y **10 de ellos tienen capacidad 0** — agregarles una nave
fallaría la restricción y rompería una función que hoy sirve.

### 2.3 `kvasAsignados` — vencimiento del compromiso

```sql
ALTER TABLE public."kvasAsignados"
  ADD COLUMN "venceCompromiso" date;

COMMENT ON COLUMN public."kvasAsignados"."venceCompromiso" IS
  'Fecha en que caduca un COMPROMETIDO (10 dias desde que se aparto, renovable). El cron kvas-compromisos-vencidos BORRA los vencidos para que la suma cuadre; el DELETE queda en auditoria. NULL en cualquier otra etapa.';

ALTER TABLE public."kvasAsignados"
  ADD CONSTRAINT kvasasignados_vence_solo_comprometido
    CHECK ((etapa = 'COMPROMETIDO') = ("venceCompromiso" IS NOT NULL));
```

### 2.4 Depuración de `POR_ASIGNAR` — **el paso delicado**

Orden obligatorio (una sola transacción):

```sql
-- 1. La dotacion de cada nave = lo que hoy tiene en asignaciones (todas las etapas)
UPDATE public.naves n SET
  "dotacionBt" = COALESCE((SELECT SUM(k."cantKvas") FROM public."kvasAsignados" k
     WHERE k."idNave" = n."idNave" AND k.nivel='BT' AND k.status), 0),
  "dotacionMt" = COALESCE((SELECT SUM(k."cantKvas") FROM public."kvasAsignados" k
     WHERE k."idNave" = n."idNave" AND k.nivel='MT' AND k.status), 0);

-- 2. Se borran las filas POR_ASIGNAR: su informacion ya vive en la dotacion
DELETE FROM public."kvasAsignados" WHERE etapa = 'POR_ASIGNAR';

-- 3. El CHECK se reduce a dos valores
ALTER TABLE public."kvasAsignados" DROP CONSTRAINT IF EXISTS <check_etapa>;
ALTER TABLE public."kvasAsignados"
  ADD CONSTRAINT kvasasignados_etapa_check
    CHECK (etapa IN ('COMPROMETIDO','ASIGNADO'));
ALTER TABLE public."kvasAsignados" ALTER COLUMN etapa SET DEFAULT 'ASIGNADO';
```

⛔ **`DELETE`, no baja lógica**: una fila `POR_ASIGNAR` con `status=false` seguiría siendo
ruido y, por la regla de `kva_consumo` para VENTA, podría volver a consumir. Su contenido no
se pierde: pasa a la dotación en el paso 1, y `trg_auditoria` registra cada DELETE con la
fila completa.

**Verificación posterior obligatoria** (debe dar exactamente esto):
```sql
SELECT SUM("dotacionBt") FROM naves n JOIN parques p USING("idParque")
 WHERE p."nomParque" IN ('Spartek','Spartek II');           -- 935
SELECT COUNT(*) FROM "kvasAsignados" WHERE etapa='POR_ASIGNAR';  -- 0
```

### 2.5 `kva_consumo` — se quita el parche de v2.65.0

Sin `POR_ASIGNAR` no hay nada que excluir: la firma vuelve a 4 argumentos.

```sql
DROP FUNCTION IF EXISTS public.kva_consumo(text, text, boolean, numeric, numeric);
CREATE OR REPLACE FUNCTION public.kva_consumo(
  p_figura text, p_status boolean, p_cant numeric, p_devuelta numeric
) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_figura = 'VENTA' THEN GREATEST(COALESCE(p_cant,0)-COALESCE(p_devuelta,0), 0)
    WHEN p_status IS TRUE   THEN COALESCE(p_cant,0)
    ELSE 0 END;
$$;
```
Y `kva_recalcular_disponibles` deja de pasar la etapa.

### 2.6 La restricción Σ dotación ≤ capacidad

Trigger sobre `naves` (INSERT/UPDATE de dotación) y sobre `parques` (UPDATE de capacidad).
Evalúa sobre el **pool** cuando hay acometida compartida:

```sql
CREATE OR REPLACE FUNCTION public.kva_validar_dotacion(p_id_parque text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_acom uuid; v_capBt numeric; v_capMt numeric; v_dotBt numeric; v_dotMt numeric;
BEGIN
  SELECT "idAcometida" INTO v_acom FROM parques WHERE "idParque" = p_id_parque;

  -- ⛔ LOCK ANTES DE LEER (hallazgo H-2): sin esto, dos transacciones que suben
  -- la dotacion de naves distintas del mismo parque leen ambas el estado viejo,
  -- ambas pasan la validacion y juntas exceden la capacidad. El lock se toma
  -- sobre la ACOMETIDA cuando hay pool, para serializar tambien entre hermanos.
  -- Se libera solo al terminar la transaccion.
  PERFORM pg_advisory_xact_lock(
    hashtext('kva_dotacion:' || COALESCE(v_acom::text, p_id_parque)));

  -- Ambito: el pool si comparte acometida; el parque solo si no.
  SELECT COALESCE(SUM(p."kvasBt"),0), COALESCE(SUM(p."kvasMt"),0)
    INTO v_capBt, v_capMt
    FROM parques p
   WHERE (v_acom IS NOT NULL AND p."idAcometida" = v_acom)
      OR (v_acom IS NULL AND p."idParque" = p_id_parque);

  SELECT COALESCE(SUM(n."dotacionBt"),0), COALESCE(SUM(n."dotacionMt"),0)
    INTO v_dotBt, v_dotMt
    FROM naves n JOIN parques p ON p."idParque" = n."idParque"
   WHERE n.status IS TRUE
     AND ((v_acom IS NOT NULL AND p."idAcometida" = v_acom)
       OR (v_acom IS NULL AND p."idParque" = p_id_parque));

  IF v_dotBt > v_capBt THEN
    RAISE EXCEPTION 'La dotacion de baja (%) supera la capacidad (%). Sobran % KVA.',
      v_dotBt, v_capBt, v_dotBt - v_capBt USING ERRCODE = 'check_violation';
  END IF;
  IF v_dotMt > v_capMt THEN
    RAISE EXCEPTION 'La dotacion de media (%) supera la capacidad (%). Sobran % KVA.',
      v_dotMt, v_capMt, v_dotMt - v_capMt USING ERRCODE = 'check_violation';
  END IF;
END; $$;
```

**Los triggers** (hallazgos H-1 y H-7). Un trigger `FOR EACH ROW` haría el alta de un parque de
169 naves cuadrática — la misma trampa de la deuda P2-9. Pero un trigger de sentencia **no
tiene `NEW`/`OLD`** y necesita **transition tables**, que traen dos restricciones que solo
aparecieron al aplicar (H-7):

> `ERROR 0A000: transition tables cannot be specified for triggers with more than one event`
> `ERROR 0A000: transition tables cannot be specified for triggers with column lists`

Es decir: **un evento por trigger** y **sin `UPDATE OF columnas`**. Como no se puede filtrar por
columna en la definición, el filtro se hace **dentro** de la función comparando `NEW TABLE`
contra `OLD TABLE` — así un UPDATE masivo de naves que no toque la dotación no valida nada.

**Diseño final (aplicado y probado en producción, 2026-08-08):**

| Trigger | Evento | Transition tables | Función |
|---|---|---|---|
| `trg_naves_valida_dotacion_ins` | `AFTER INSERT` on `naves` | `NEW TABLE as nuevas` | `kva_dotacion_naves_ins()` |
| `trg_naves_valida_dotacion_upd` | `AFTER UPDATE` on `naves` | `NEW` + `OLD TABLE` | `kva_dotacion_naves_upd()` |
| `trg_parques_valida_dotacion` | `AFTER UPDATE` on `parques` | `NEW` + `OLD TABLE` | `kva_dotacion_parques_upd()` |

Cada función itera solo los `idParque` **distintos** cuya dotación (o capacidad, o status, o
acometida) realmente cambió, y llama a `kva_validar_dotacion` una vez por parque.

**Pruebas ejecutadas contra producción** (con rollback, sin dejar rastro):

| Caso | Resultado |
|---|---|
| Dotar 9,999 en Spartek (pool 1,017) | ✅ rechazado: «Sobran 8,982.00 KVA» |
| Dotar 10 en Spartek (cabe) | ✅ pasó |
| Dotar 5 en Actitek (capacidad 0) | ✅ rechazado: «Sobran 5.00 KVA» |
| UPDATE masivo de naves sin tocar dotación | ✅ pasó sin validar |

## 3. Endpoints

| Método | Ruta | Permiso | Cambio |
|---|---|---|---|
| `POST` | `/parques` | 701 | **+** `dotacionMtNave`, `dotacionBtNave` en el body |
| `PATCH` | `/parques/:id` | 701 | **+** los mismos (no re-aplica a naves existentes) |
| `POST` | `/parques/:id/naves` | 702 | usa el default del parque para las nuevas |
| `PATCH` | `/parques/naves/:idNave` | **721** | **+** `dotacionMt`, `dotacionBt` |
| `GET` | `/kvas/resumen` | 720 | **+** `dotado` y `sinDotar` por bolsa |
| `POST` | `/kvas/asignacion` | 721 | **+** valida arrendatario→RENTA; fija `venceCompromiso` |
| `POST` | `/kvas/asignacion/:id/renovar` | 721 | **nuevo**: reinicia los 10 días |

⚠️ El `PATCH /parques/naves/:idNave` hoy exige **702**. La dotación exige **721**: el
controlador debe separar ambos permisos según qué campos vengan en el body, o partirse en dos
endpoints. **Decisión: endpoint aparte** `PATCH /parques/naves/:idNave/dotacion` con 721 —
mezclar permisos en un endpoint es una trampa de auditoría.

## 4. Cron y correo

```ts
// common/cron/cron.tareas.ts
export const TAREA_KVAS_COMPROMISOS = 'kvas-compromisos-vencidos';
```

Corre **diario**. En una pasada:
1. Envía correo por cada compromiso que vence en ≤ 3 días y aún no se avisó.
2. Borra los vencidos (`venceCompromiso < CURRENT_DATE`) y recalcula los parques tocados.

Reglas que hereda de la infraestructura existente: se registra en `v2_cron_ejecuciones`, es
disparable a mano desde la pantalla Cron, y **aísla el error por parque** para que uno que
falle no aborte el resto.

📌 **Pendiente de diseño menor:** para no reenviar el aviso a diario hace falta marcar el
envío. Opción propuesta: columna `avisoCompromiso date` en `kvasAsignados`.
