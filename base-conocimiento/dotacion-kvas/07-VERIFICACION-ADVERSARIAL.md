# 07 · Verificación adversarial — Dotación de KVA por nave

> Fecha: 2026-08-08 · Verificado contra la BD de producción vía MCP `supaSPH`.
>
> ⚠️ **Limitación declarada:** el proceso estándar del proyecto pide varios verificadores
> independientes con lentes distintas (seguridad/RLS · consistencia · completitud). **Esta
> sesión tiene deshabilitado el uso de subagentes**, así que la verificación la hizo el mismo
> autor del diseño, recorriendo las tres lentes por separado y contrastando cada afirmación
> contra el catálogo real. Un revisor independiente sigue siendo deseable antes de construir.

## Veredicto

**2 BLOQUEANTES · 1 MEDIO · 1 BAJO · 1 descartado.**
Los cuatro vigentes ya están **corregidos y aplicados** a los documentos. La única condición
que queda abierta es la autorización de Jereff para la migración destructiva (tarea 1.3).

| # | Severidad | Estado |
|---|---|---|
| H-1 Trigger sin `NEW`/`OLD` | BLOQUEANTE | ✅ corregido con transition tables |
| H-2 Check-then-act sin lock | BLOQUEANTE | ✅ corregido con advisory lock |
| H-3 Default 5 en la columna | MEDIO | ✅ corregido a 0 |
| H-4 Tabla compartida con v1 | ~~MEDIO~~ | ❌ descartado: v1 ya no existe |
| H-5 Dotación migrada en disputa | MEDIO | 📌 anotado, se resuelve con el cliente |
| H-6 Conteo 76 → 85 filas | BAJO | ✅ corregido |
| H-7 Restricciones de las transition tables | MEDIO | ✅ corregido al aplicar (ver abajo) |

---

## H-1 · BLOQUEANTE — El trigger `STATEMENT` no sabe qué parque validar

**Dónde:** `05-BACKEND.md` §2.6 · `02-TRD.md` D-2.

**El defecto:** el diseño pide un trigger `AFTER ... FOR EACH STATEMENT` que llame a
`kva_validar_dotacion(p_id_parque)`. Pero un trigger de sentencia **no tiene `NEW` ni `OLD`**:
no hay de dónde sacar el `idParque`. Tal como está escrito, no compila.

**Por qué se me pasó:** al evitar la deuda P2-9 (trigger por fila = cuadrático) salté a
`STATEMENT` sin resolver cómo obtiene las filas afectadas.

**Corrección:** usar **transition tables**, que es justo para esto:

```sql
CREATE TRIGGER trg_naves_valida_dotacion
  AFTER INSERT OR UPDATE OF "dotacionMt","dotacionBt" ON public.naves
  REFERENCING NEW TABLE AS nuevas
  FOR EACH STATEMENT EXECUTE FUNCTION public.kva_validar_dotacion_stmt();
```

Y la función itera los parques **distintos** de la tabla de transición:

```sql
CREATE OR REPLACE FUNCTION public.kva_validar_dotacion_stmt()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT "idParque" FROM nuevas LOOP
    PERFORM public.kva_validar_dotacion(r."idParque");
  END LOOP;
  RETURN NULL;
END; $$;
```

Así el alta de un parque de 169 naves valida **una vez**, no 169. Requiere Postgres 10+
(Supabase corre 15+, verificado).

---

## H-2 · BLOQUEANTE — La restricción es un *check-then-act* sin lock

**Dónde:** `05-BACKEND.md` §2.6.

**El defecto:** `kva_validar_dotacion` **lee** la suma y **decide**. Dos transacciones
concurrentes que suben la dotación de naves distintas del mismo parque leen ambas el estado
anterior, ambas pasan, y al confirmarse dejan la suma por encima de la capacidad.

**Escenario concreto:** capacidad 100, dotado 90. A sube la nave 1 en +5 y B la nave 2 en +5,
a la vez. Ambas ven 90+5=95 ≤ 100 y pasan. Resultado: 100... y si fueran +8 cada una, 106.
La restricción que existe justamente para impedirlo, no lo impide.

**Corrección:** serializar por parque con un advisory lock **antes de leer**:

```sql
PERFORM pg_advisory_xact_lock(hashtext('kva_dotacion:' || COALESCE(v_acom::text, p_id_parque)));
```

El lock se toma sobre la **acometida** cuando hay pool, para que dos parques hermanos no se
validen en paralelo entre sí. Se libera solo al terminar la transacción.

**Nota:** este mismo defecto existe hoy en `kva_recalcular_disponibles`, pero ahí es benigno
—recalcula desde la fuente, no decide—. Aquí sí decide, y por eso importa.

---

## H-3 · MEDIO — El default `5` rompería los parques existentes

**Dónde:** `05-BACKEND.md` §2.2.

**El defecto:** la columna se define `dotacionBtNave numeric NOT NULL DEFAULT 5`. Ese default
se aplica a **los 12 parques ya existentes**, de los cuales **10 tienen capacidad 0**
(verificado). Agregar una sola nave a cualquiera de ellos intentaría dotarla con 5 KVA sobre
una capacidad de 0 y **fallaría la restricción**, rompiendo una función que hoy sirve.

**Corrección:** la columna nace con `DEFAULT 0`; el **5 es la sugerencia del formulario de
alta**, no el default de la columna. Son cosas distintas y las confundí.

```sql
ADD COLUMN "dotacionBtNave" numeric(12,2) NOT NULL DEFAULT 0;   -- no 5
```
En `ParqueModal` el campo se precarga con 5, que es lo que el negocio pidió como valor
propuesto (RF-1.1).

---

## H-4 · ~~MEDIO~~ **DESCARTADO** — `naves` compartida con v1

**Planteaba:** que v1 (Flutter) creara naves sin pasar por el default del parque y fallara
contra el trigger nuevo con un error que su interfaz no sabría explicar.

**Resolución (Jereff, 2026-08-08): `v1 ya no existe`** — se eliminó hace más de dos meses.
`naves` y `parques` ya **no son tablas compartidas**: el backend de v2 es su único escritor.
El hallazgo se cierra sin acción.

📌 **Implicación fuera de este paquete, que conviene revisar aparte:** varias decisiones del
proyecto se tomaron *porque* v1 existía —entre ellas las políticas RLS permisivas para
`authenticated`, que están en la deuda P0 justo por eso—. Ahora que v1 no está, esa superficie
se puede cerrar. No entra aquí, pero queda anotado.

---

## H-5 · MEDIO — La dotación migrada refleja lo cargado, no lo que el negocio quiere

**Dónde:** `05-BACKEND.md` §2.4 · `04-FLUJOS.md` F-5.

La siembra hace `dotación = suma de asignaciones vivas de la nave`. Eso es correcto para las
102 naves que cuadran, pero **arrastra los 20 casos donde el Excel del cliente se excede a sí
mismo** (la nave 48 con 150 sobre un paquete de 10, y ocho con 10 sobre 5).

No es un defecto del diseño: es que esos datos están en disputa y **solo el cliente puede
resolverlos**. Queda anotado para que nadie lea la dotación migrada como verdad revisada.

**Acción:** tras la sesión de Jereff con el cliente, corregir esas 20 naves editando su
dotación — que es justo la función que este paquete crea.

---

## H-6 · BAJO — Conteo incorrecto en el 05

`05-BACKEND.md` decía «380 KVA de baja en 76 filas» en `POR_ASIGNAR`. El conteo real es
**85 filas** (verificado). Corregido.

---

## H-7 · MEDIO — Las transition tables tienen dos restricciones que el diseño ignoraba

**Encontrado al aplicar la migración (no en la revisión de escritorio).** La corrección de H-1
—usar transition tables— no compilaba tampoco, por dos límites de Postgres:

```
ERROR 0A000: transition tables cannot be specified for triggers with more than one event
ERROR 0A000: transition tables cannot be specified for triggers with column lists
```

**Consecuencia:** no se puede escribir `AFTER INSERT OR UPDATE OF "dotacionBt","dotacionMt"`.
Hay que partirlo en **un trigger por evento** y **sin lista de columnas** — lo que a su vez
significa que el trigger de UPDATE se dispara en *cualquier* update de `naves`.

**Corrección aplicada:** el filtro pasa a la función, comparando `NEW TABLE` contra `OLD TABLE`.
Solo se valida si de verdad cambió la dotación, el status, el parque o la acometida. Un UPDATE
masivo de naves que no toque nada de eso no dispara ninguna validación — **verificado con la
prueba 4**.

**Lección para el proceso:** este hallazgo era invisible en revisión de escritorio; solo lo
saca aplicar el DDL contra un Postgres real. Refuerza que las migraciones se prueben antes de
darlas por diseñadas, no solo se lean.

---

## Pruebas de la restricción contra producción

Ejecutadas dentro de bloques con rollback forzado: **ningún dato quedó modificado**
(0 naves con dotación, 170 filas en `kvasAsignados`, 2,290 KVA — idénticos a antes).

| # | Caso | Esperado | Resultado |
|---|---|---|---|
| 1 | Dotar 9,999 a una nave de Spartek (pool 1,017) | Rechazar | ✅ «La dotacion de baja (9999.00) supera la capacidad (1017.00). Sobran 8982.00 KVA.» |
| 2 | Dotar 10 a esa misma nave | Pasar | ✅ pasó |
| 3 | Dotar 5 en Actitek (capacidad 0) | Rechazar | ✅ «Sobran 5.00 KVA» |
| 4 | UPDATE masivo de naves sin tocar dotación | No validar | ✅ pasó sin validar |

La prueba 1 confirma además que **el ámbito es el pool**: la capacidad contra la que se validó
fue 1,017 (Spartek I + II), no los 488 del parque suelto.

---

## Lo que se verificó y salió limpio

| Riesgo evaluado | Resultado |
|---|---|
| `DELETE` de `POR_ASIGNAR` chocando con la FK `RESTRICT` de `kvaDevoluciones` | **0 filas** afectadas ✓ |
| El CHECK `(etapa='COMPROMETIDO') = (vence IS NOT NULL)` rompiendo filas actuales | **0 comprometidos** hoy ✓ |
| Ventas canceladas que seguirían consumiendo tras la migración | **0 canceladas** en total ✓ |
| Frontera de confianza | Sin cambios: ni credenciales nuevas ni datos al front ✓ |
| RLS | Sin tablas nuevas; `naves` y `parques` conservan políticas ✓ |
| Identidad del actor | Del JWT; el cron con `service_role` queda como origen 3 en auditoría ✓ |
| Trazabilidad del borrado por cron | `trg_auditoria` guarda `registro_anterior` completo ✓ |
| Escalabilidad del alta de parque | Con H-1 corregido: 1 validación por sentencia, no por fila ✓ |

## Condiciones para dar luz verde

1. H-1 y H-2 aplicados a `05-BACKEND.md` — **hecho**.
2. H-3 aplicado — **hecho**.
3. H-4 — **descartado**: v1 ya no existe.
4. **Aprobación explícita de Jereff para la migración destructiva** (tarea 1.3 del plan) —
   única condición pendiente.
