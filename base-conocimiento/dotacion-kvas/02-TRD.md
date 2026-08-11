# 02 · TRD — Arquitectura y decisiones técnicas

> Anclado a `00-brief-conceptual.md`. El modelo de datos exacto vive en `05-BACKEND.md`.

## 1. Dónde encaja

No nace un módulo: se profundiza **Parques → KVA's**. El cambio toca tres capas del monorepo
y ninguna frontera de confianza nueva.

```
apps/api/src/modules/parques/
  ├── parques.service.ts      ← dotación al crear parque / agregar naves / editar nave
  ├── parques.schemas.ts      ← +dotacion* en los DTO
  ├── kvas.service.ts         ← resumen con dotado/sinDotar · compromiso · renovar
  ├── kvas.schemas.ts         ← etapa sin POR_ASIGNAR · validación de figura
  └── kvas-compromisos.scheduler.ts   ← NUEVO
apps/web/src/features/parques/
  ├── KvasPage.tsx            ← filas nuevas del tablero
  ├── NaveKvaModal.tsx        ← dotación + vencimiento + renovar
  └── ParqueModal.tsx         ← captura de la dotación por nave
packages/types/src/database.types.ts  ← columnas nuevas
```

## 2. Decisiones técnicas

### D-1 · La restricción vive en la BD, no solo en el servicio
`Σ dotación ≤ capacidad` se aplica con **trigger**, además de validarse en el backend.
**Por qué:** hay **cuatro caminos** que pueden violarla —crear parque, editar dotación de nave,
bajar la capacidad del parque, agregar naves— y basta que uno olvide validar para que el dato
quede inconsistente. La BD es el único lugar donde la regla no se puede esquivar.
*(No es por v1: v1 se eliminó hace más de dos meses. Es por los cuatro caminos de v2.)*

### D-2 · Trigger `FOR EACH STATEMENT`, nunca `FOR EACH ROW`
Crear un parque inserta hasta 300 naves en **una** sentencia. Un trigger por fila haría 300
validaciones, cada una sumando todas las naves del parque: cuadrático.
📌 Es exactamente la deuda **P2-9** que ya registramos con el recálculo de saldo; no se repite.

### D-3 · Ámbito de la restricción: el pool
Cuando `parques.idAcometida` no es nulo, la validación suma **todos** los parques de esa
acometida. Con `idAcometida` nulo, solo el parque. Un único `kva_validar_dotacion(idParque)`
resuelve ambos casos, así que no hay dos ramas de lógica que se puedan desincronizar.

### D-4 · Endpoint aparte para la dotación
`PATCH /parques/naves/:idNave` exige permiso **702** (editar naves); la dotación exige **721**
(KVA). Se crea `PATCH /parques/naves/:idNave/dotacion` en vez de mezclar dos permisos en un
endpoint según los campos del body — eso último es imposible de auditar y fácil de romper.

### D-5 · Borrar los `POR_ASIGNAR`, no darlos de baja
Ver `05-BACKEND.md` §2.4. Una fila cancelada con figura VENTA sigue consumiendo por diseño
del candado; dejarla ahí reintroduciría el descuadre que este cambio elimina. El rastro queda
en `auditoria` (el trigger registra el DELETE con `registro_anterior` completo).

### D-6 · El correo reusa la infraestructura existente
`modules/correo/smtp.service.ts` y el patrón de `invitaciones.mailer.ts`. No se crea un
segundo mecanismo de envío.

### D-7 · El cron reusa el motor existente
Se registra en `common/cron/cron.tareas.ts`, queda en la bitácora `v2_cron_ejecuciones` y es
disparable a mano desde la pantalla Cron. Aísla el error por parque.

## 3. Seguridad — checklist del gate

| Punto | Cómo queda |
|---|---|
| 🛡️ Frontera de confianza | Sin cambios: el front sigue hablando solo con el backend; ninguna credencial nueva |
| 🔑 Auth / identidad | El actor sale del **JWT verificado**; el cron corre con `service_role` y `uid` nulo (origen 3 en auditoría) |
| 🔒 RBAC | 701 parque · 702 naves · **721 dotación, compromiso y renovación** · 720 lectura |
| 🔒 RLS | Sin tablas nuevas. `naves` y `parques` conservan sus políticas |
| ✅ Validación | Zod por endpoint + **CHECK y trigger en BD** (D-1) |
| 🧾 Trazabilidad | `trg_auditoria` ya cubre `naves`, `parques` y `kvasAsignados`. Los DELETE del cron quedan registrados |
| 💉 Inyección | Todo por PostgREST parametrizado; las funciones nuevas son `plpgsql` sin SQL dinámico |
| 🔥 Errores | `fallaBd()`; el `RAISE EXCEPTION` de la restricción se traduce a **409** con mensaje de negocio, sin filtrar SQL |

## 4. Impacto sobre lo existente

| Qué | Impacto | Mitigación |
|---|---|---|
| `naves` | +2 columnas con default 0 | Sin otro escritor: v1 ya no existe |
| `parques` | +2 columnas con default 0 | ídem |
| `kvasAsignados` | Se borran 76 filas `POR_ASIGNAR`; cambia el CHECK | Migración transaccional + verificación de totales |
| `kva_consumo` | Cambia de firma (5 → 4 args) | Único llamador: `kva_recalcular_disponibles`, se actualiza en la misma migración |
| Tablero de KVA | Filas nuevas | Compatible: el endpoint agrega campos, no quita |
| Columnas espejo (`kvasAlta`…) | Sin cambio | Su retiro sigue siendo pendiente aparte |
| Candado de liberación de nave | **Se relaja**: hoy `POR_ASIGNAR` ya no bloqueaba (v2.65.0); al desaparecer la etapa, el comportamiento no cambia | Ninguna |

## 5. Lo que NO se toca

Bucket `kvaDocs` y expediente · devoluciones · acometidas · el resto del ERP.
