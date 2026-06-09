# Plan: Corregir el trigger `cxp_validar_fecha_cfdi_estado` (CxP)

> **Estado:** PENDIENTE de aplicar. El trigger está **desactivado** temporalmente (hotfix). Este plan
> se ejecuta **en cuanto se defina cómo se trabajará el PPD** (Fase 2). La Fase 1 puede aplicarse antes
> si se quiere reactivar el trigger ya corregido sin esperar a la decisión de PPD.
>
> Origen: incidente detectado el 2026-06-09 (el trigger cambiaba a "Rechazado" facturas ya pagadas).
> Autor: Claude (Opus 4.8).

## Contexto

En el módulo **Cuentas por Pagar** (tabla compartida `cxp`, usada por v1 FlutterFlow y v2)
existe un trigger **BEFORE INSERT OR UPDATE** `trigger_cxp_validar_fecha_cfdi` →
función `cxp_validar_fecha_cfdi_estado` cuya regla original es:

```sql
IF NEW."diferido" = true THEN RETURN NEW; END IF;
IF NEW."fecCFDI" IS NULL THEN RETURN NEW; END IF;
IF DATE_TRUNC('month', NEW."fecCFDI") < DATE_TRUNC('month', NEW.fc) THEN
    NEW."idEstado" := 3;   -- fuerza Rechazado
END IF;
```

### Dos defectos detectados
1. **Corrompe estados avanzados (crítico).** Al ser `BEFORE … OR UPDATE`, se ejecuta en
   **cualquier** `UPDATE`. Para toda factura cuyo `fecCFDI` sea de un mes anterior a `fc`
   (fecha de captura), **cualquier** actualización posterior (conciliar, cambiar responsable,
   etc.) la regresa a `idEstado=3` (Rechazado), **incluso si ya estaba Pagada/Aprobada**.
2. **No distingue PUE vs PPD.** La regla de "mes anterior" solo debería aplicar a **PUE**.
   Las **PPD** deberían quedar exentas (marcarse como `diferido`). Hoy, si el usuario olvida
   marcar "diferida" en la captura (v1), la PPD se auto-rechaza y no se puede corregir desde
   la app. **Limitación:** el método de pago (PUE/PPD) **NO se persiste** en `cxp` (solo se lee
   del XML al capturar), por lo que el trigger no puede "verlo"; el manejo PPD debe resolverse
   **en el momento del alta**, no dentro del trigger.

### Estado actual (hotfix ya aplicado por el usuario, 2026-06-09)
- El trigger fue **desactivado** (`ALTER TABLE public.cxp DISABLE TRIGGER trigger_cxp_validar_fecha_cfdi;`)
  → `tgenabled='D'`. **No se eliminó** (reversible).
- Los registros corrompidos **ya fueron corregidos** por el usuario. Verificado: 0 inconsistencias
  en las 1715 filas (`idEstado=3` con huella de pago = 0; `idEstado` vs texto desincronizado = 0).

> ⚠️ Reglas del proyecto: la BD es de **producción compartida** (v1 + v2). Todo cambio se entrega
> como **SQL exacto para que el usuario lo aplique**; no se ejecuta por cuenta propia.

---

## Fase 1 — Corregir el trigger (defecto crítico) y reactivarlo

**Objetivo (regla acordada con el usuario):** la validación de fecha del CFDI aplica al **CREAR**
(INSERT) y en **UPDATE solo cuando el estado de origen `OLD.idEstado` es 1 (Guardado) o 2 (Enviado)**
— es decir, en las transiciones **1→2 (enviar)** y **2→4 (aprobar)**. En estado **3 (Rechazado)** y
superiores (**4 Aprobado, 5, 6 Pagado, 7**) **NO** se valida. Con esto:
- No se corrompen facturas ya aprobadas/pagadas (un UPDATE sobre ellas no toca el estado).
- "Devolver a Guardado" (3→1) funciona, porque desde estado 3 no se re-valida.
- Se conserva la regla de negocio: una PUE de mes anterior se rechaza al crear o al enviar/aprobar.

**SQL a entregar al usuario (reemplaza la función; el trigger sigue desactivado hasta verificar):**

```sql
CREATE OR REPLACE FUNCTION public.cxp_validar_fecha_cfdi_estado()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    -- La validación aplica al CREAR (INSERT) y al ACTUALIZAR solo si la
    -- solicitud está en estado temprano: Guardado(1) o Enviado(2) -> p.ej.
    -- 1->2 (enviar) o 2->4 (aprobar). En estado 3 (Rechazado) y superiores
    -- (4/5/6/7) NO se valida: así no se corrompen facturas ya procesadas ni se
    -- re-rechaza al devolver a Guardado (3->1).
    IF TG_OP = 'UPDATE' AND COALESCE(OLD."idEstado", 0) NOT IN (1, 2) THEN
        RETURN NEW;
    END IF;

    -- Facturas diferidas (p. ej. PPD marcadas en el alta) quedan exentas.
    IF NEW."diferido" = true THEN
        RETURN NEW;
    END IF;

    IF NEW."fecCFDI" IS NULL THEN
        RETURN NEW;
    END IF;

    -- CFDI de un mes anterior al de captura: se marca Rechazado.
    IF DATE_TRUNC('month', NEW."fecCFDI") < DATE_TRUNC('month', NEW.fc) THEN
        NEW."idEstado" := 3;
    END IF;

    RETURN NEW;
END;
$function$;
```

**Reactivar el trigger (después de reemplazar la función):**
```sql
ALTER TABLE public.cxp ENABLE TRIGGER trigger_cxp_validar_fecha_cfdi;
```

> El trigger es `BEFORE INSERT OR UPDATE`, por lo que `OLD` está disponible en los UPDATE.
> `set_estado`/`update_estado` (que sincroniza el texto `estado`) corre antes por orden alfabético;
> esta función vuelve a fijar `idEstado` cuando aplica, así que conviene que el texto se derive de
> `idEstado` final — comportamiento ya existente y sin cambios aquí.

---

## Fase 2 — PPD ⇒ diferido automático (en el ALTA, no en el trigger)

**Problema de raíz:** los usuarios olvidan marcar "¿Es factura diferida?" para CFDI **PPD**.
**Solución:** marcar `diferido=true` **automáticamente** cuando el CFDI es PPD, en el punto de
captura (donde el método de pago SÍ está disponible tras parsear el XML).

- **v2** (`version2/apps/api/src/modules/cxp/`): el parser `cfdi.ts` ya extrae `metodoPago`.
  Hoy `solicitudes.service.ts:~353` **rechaza** todo lo que no sea PUE. Si v2 debe aceptar PPD,
  habilitar el flujo y, al insertar en `cxp`, hacer `diferido = (cfdi.metodoPago === 'PPD')`
  (más el manejo PPD que ya existe en v1: `idFolioDif`, tabla `cxp_ppd`, etc.).
- **v1** (Flutter, `lib/.../linea_fac_proveedor_widget.dart`): origen real de las PPD. Para
  resolverlo de raíz, marcar `diferido=true` automáticamente cuando `metodoPag=='PPD'` en lugar
  de depender del checkbox manual.

**Decisiones abiertas (definir antes de implementar Fase 2 — ESTO es lo que falta acordar):**
1. **Alcance:** ¿se corrige también en **v1** (tocar el Flutter) o solo en **v2**? El problema
   nace en v1; v2 hoy ni acepta PPD.
2. **¿v2 debe empezar a aceptar PPD?** (hoy las rechaza en validación).
3. **Persistir método de pago:** opcional, agregar columna `metodoPago` a `cxp` para trazabilidad
   y para que reportes/triggers futuros lo tengan. Implica DDL aditivo + llenarlo en el alta.

> Esta fase NO es necesaria para cerrar el incidente; la Fase 1 ya detiene la corrupción y permite
> reactivar el trigger con seguridad. La Fase 2 elimina la causa de fondo (PPD olvidadas).

---

## Verificación

1. **Casos a verificar** (con la función ya reemplazada y el trigger reactivado, en pruebas):
   - **INSERT** con `fecCFDI` de mes anterior y `diferido=false` → queda `idEstado=3` (rechaza al crear).
   - **1→2 (enviar)** con CFDI de mes anterior y PUE/`diferido=false` → se rechaza (`idEstado=3`). ✔ regla.
   - **2→4 (aprobar)** con CFDI de mes anterior → se valida (queda en 3 si aplica). ✔ regla.
   - **3→1 (Devolver a Guardado)** → **NO** se re-rechaza: queda en 1 (Guardado). ✔ ahora sí funciona.
   - **UPDATE sobre una Pagada (`idEstado=6`)** con CFDI de mes anterior → **sigue en 6** (no la corrompe).
     Esta es la verificación clave del bug original.
   - Cualquier caso con `diferido=true` → exento (no se rechaza).
2. **Reactivar** con `ENABLE TRIGGER` y reconfirmar `tgenabled='O'`.
3. **Monitoreo:** repetir el query de integridad (read-only) y confirmar 0 inconsistencias:
   ```sql
   SELECT COUNT(*) FILTER (WHERE "idEstado"=3 AND ("fecPago" IS NOT NULL OR "montoAplicado">0
            OR pagador IS NOT NULL OR "idMovBancarios" IS NOT NULL OR autorizo IS NOT NULL)) AS rechazadas_con_huella_pago
   FROM cxp;
   ```
4. Documentar el cambio del trigger en `version2/base-conocimiento/modulos/cxp.md` y, si aplica,
   en `OBSOLESCENCIA-BD.md`/`HANDOFF.md`.

## Archivos / objetos afectados
- **BD (SQL para que el usuario aplique):** función `public.cxp_validar_fecha_cfdi_estado` (Fase 1)
  y reactivación del trigger `trigger_cxp_validar_fecha_cfdi`.
- **Fase 2 (si se aprueba):** `version2/apps/api/src/modules/cxp/solicitudes.service.ts`,
  `cfdi.ts`; y opcionalmente el Flutter de v1 + columna nueva en `cxp`.
- **Docs:** `version2/base-conocimiento/modulos/cxp.md`, `HANDOFF.md`.
