---
modulo: KVA's
estado: desarrollado
rutas: [/parques/kvas]
claves_permiso: [720, 721, 722]
tablas: [kvaAcometidas, kvasAsignados, kvaDevoluciones, parques, naves]
palabras_clave: [kva, kvas, kvas, energia, electricidad, luz, tension, media tension, baja tension, acometida, cfe, capacidad electrica, carga, contrato de cfe, numero de servicio, devolucion de kvas, liberar kvas, sobregiro, "cuantos kva tiene el parque", "no me deja liberar la nave", "faltan kva por regresar", "los kva no cuadran", "aparece en rojo", "kva disponibles negativos", "como asigno kva", "vendidos o rentados", "ya hay contrato con cfe", "quien tiene los kva"]
relacionado_con: [parques, inversionistas, arrendatarios]
---

# Módulo: KVA's (capacidad eléctrica)

## 1. Qué hace / para qué sirve

Lleva el control de la **energía eléctrica** que SPH tiene contratada con CFE y de cómo se reparte
entre las naves de cada parque. Responde tres preguntas del negocio:

1. **¿Cuánta capacidad hay?** — contratada por acometida y repartida por parque.
2. **¿A quién se le dio y bajo qué figura?** — vendida (se va con la nave) o rentada (se presta
   mientras dure el contrato).
3. **¿Qué falta por regresar?** — los KVA vendidos deben volver al parque cuando el ocupante deja la
   nave, y eso se acredita con documento.

Antes de este módulo el control vivía **fuera del sistema**, en un Excel de 7 hojas.

## 2. Conceptos (los tres ejes)

| Eje | Valores | Qué significa |
|---|---|---|
| **Nivel** | `MT` (media) · `BT` (baja) | Los dos niveles de tensión. Son **bolsas independientes**: cada una se negocia por separado con CFE y **no hay trasvase** entre ellas. |
| **Figura** | `VENTA` · `RENTA` | VENTA: el KVA se va con la nave y **solo regresa con devolución acreditada**. RENTA: regresa solo al cerrar el vínculo. |
| **Etapa** | `POR_ASIGNAR` · `COMPROMETIDO` · `ASIGNADO` | El trámite: reservado del paquete de la nave → apalabrado con el inquilino → **ya hay contrato con CFE** a nombre del usuario final. |

**Acometida:** la fuente física contratada con CFE (con su tensión en kV y su folio). **Alimenta a uno
o varios parques** — caso real: Spartek I y II comparten una acometida de 34.5 kV.

## 3. Pantallas y permisos

| Pantalla | Ruta | Permiso |
|---|---|---|
| KVA's | `/parques/kvas` | **720** (ver) |
| Asignar / editar / cancelar | modal | **721** |
| Registrar devolución | modal | **722** |

La capacidad del parque (MT/BT) se captura al **crear o editar el parque** (`/parques`, permisos
700/701).

## 4. Modelo de datos

### `kvaAcometidas` (nueva, 2026-08-03)
`idAcometida` (uuid PK) · `nombre` · `tensionKv` · `capacidadMt` / `capacidadBt` · `folioCfe` ·
`notas` · `status` · `uidr` · `fc`.

### `parques` (columnas de KVA)
| Columna | Notas |
|---|---|
| `kvasMt` / `kvasBt` | Capacidad del parque en media / baja tensión. **Antes se llamaban `kvasAlta` / `kvasMedia`** (ver gotcha #1). `numeric(12,2)`: admiten decimales. |
| `kvasMtDisponibles` / `kvasBtDisponibles` | Lo libre. **Puede ser NEGATIVO** (gotcha #2). Lo recalcula la BD; no se escribe a mano. |
| `kvasMtUtilizados` / `kvasBtUtilizados` | **GENERADAS** = capacidad − disponibles. |
| `idAcometida` | De qué acometida cuelga el parque (puede ser null). |

### `kvasAsignados`
`idKvas` (uuid PK) · `idParque` · `idNave` · `nivel` · `figura` · `etapa` · `cantKvas` ·
`cantDevuelta` · `contratoCfe` · `fechaContratoCfe` · `idPropiedad` / `idNavArrend` (el vínculo) ·
`motivoBaja` · `status` (baja lógica).
⚠️ `tipoTension` y `tipoContrato` quedan **DEPRECADAS** (se eliminan en la migración F1b).

### `kvaDevoluciones` (nueva, 2026-08-03)
`idDevolucion` · `idKvas` · `cantidad` · `fechaDevolucion` · `documento` (folio) · `urldoc` (ruta en
el bucket **privado** `kvaDocs`, se sirve firmada) · `observaciones` · `uidValida` · `status`.

## 5. Reglas de negocio

- **El saldo lo calcula la BD, no el código.** `kva_recalcular_disponibles(idParque)` recorre las
  asignaciones y actualiza los disponibles en cada cambio de `kvasAsignados` o `kvaDevoluciones`.
- **Cuánto consume cada asignación** (`kva_consumo`): en **RENTA**, todo mientras `status=true`; en
  **VENTA**, `cantKvas − cantDevuelta` **aunque el vínculo esté cerrado**.
- ⛔ **Candado de liberación de nave:** no se puede **liberar** (renta) ni **desvincular** (venta) una
  nave con KVA **vendidos** sin devolución acreditada. Responde **409** con el faltante por nivel.
- **Etapa ASIGNADO exige `contratoCfe`** (validado en Zod y en el front): "asignado" significa "ya hay
  contrato con CFE"; sin el número, el tablero mostraría trámites cerrados sin respaldo.
- **Cancelar una asignación es baja lógica con motivo** y **no devuelve** los KVA vendidos: cancelar no
  es la puerta trasera para saltarse el candado.
- **Devolución parcial permitida**, nunca por encima de lo pendiente.
- **El parque se toma de la nave**, no del cliente: no se puede descontar capacidad de un parque ajeno.
- El documento de la devolución es **obligatorio**: PDF/JPG/PNG/WEBP, validado por **magic bytes**
  (el mimetype del cliente es falsificable), máx. 15 MB, en bucket privado.

## 6. Arquitectura

- Backend: `apps/api/src/modules/parques/kvas.service.ts`, `kvas.controller.ts`, `kvas.schemas.ts`.
  Helper de archivos reutilizable: `apps/api/src/common/utils/archivo-seguro.ts`.
- El candado vive en `planes-arre.service.ts` → `liberarNave` y `planes.service.ts` →
  `desvincularNave`, ambos vía `KvasService.exigirKvasDevueltos(idNave)`.
- Frontend: `apps/web/src/features/parques/KvasPage.tsx`, `AsignacionKvaModal.tsx`,
  `DevolucionKvaModal.tsx`, `kvas.api.ts`.
- BD: funciones `kva_consumo`, `kva_recalcular_disponibles`, `kva_pendientes_por_devolver`; triggers
  `trg_kvasasignados_recalcular`, `trg_kvadevoluciones_aplicar`,
  `trg_parques_actualizar_kvas_disponibles`. Migración
  `migraciones/2026-08-03-kvas-administracion-f1.sql`.

## 7. Para el agente de soporte (reglas de datos / diagnóstico)

| Síntoma del usuario | Causa | Qué hacer |
|---|---|---|
| "No me deja liberar la nave / dice que faltan KVA por regresar." | La nave tiene KVA con `figura='VENTA'` y `cantKvas > cantDevuelta`. El candado responde 409 (`exigirKvasDevueltos`). | Registrar la devolución en Parques → KVA's → botón **Devolución**, con folio y documento. Al acreditarla, la nave se libera. |
| "Los KVA disponibles salen en rojo / en negativo." | **Sobregiro real**: se asignó más de lo contratado. NO es un error de cálculo — el sistema muestra la verdad a propósito. | Revisar asignaciones del parque; renegociar con CFE o cancelar asignaciones. |
| "Asigné KVA y el disponible no cambió." | El recálculo es automático por trigger. Si no cambió, revisar que la asignación quedó con `status=true` y el `idParque` correcto. | Verificar en `kvasAsignados`; el disponible sale de `kva_recalcular_disponibles`. |
| "No me deja marcar «Asignado»." | La etapa ASIGNADO exige el **número de contrato de CFE**. | Capturar `contratoCfe` en el modal. |
| "Cancelé la asignación de una venta y los KVA no volvieron al parque." | Es por diseño: una VENTA solo regresa con **devolución acreditada** (`kvaDevoluciones`), no al cancelar. | Registrar la devolución con su documento. |
| "No veo el módulo KVA's." | Falta el permiso **720**. | Configuraciones → Permisos. |
| "No puedo asignar / no veo el botón de devolución." | Faltan **721** (asignar) o **722** (devolución). | Configuraciones → Permisos. |
| "Los totales del parque están en cero." | La capacidad aún no se captura: los 10 parques nacieron en 0 y la carga desde el Excel operativo está **pendiente**. | Capturar en Parques → editar parque (KVA's Media / Baja). |

## 8. Gotchas / trampas conocidas

1. **Rename 2026-08-03:** `kvasAlta` → **`kvasMt`** (media) y `kvasMedia` → **`kvasBt`** (baja). La BD
   llamaba "Alta/Media" a lo que el negocio llama "Media/Baja"; el nombre corría un escalón. Se
   eligieron `Mt`/`Bt` **a propósito**, para que ningún código viejo pudiera seguir leyendo "Media"
   con el significado anterior sin tronar.
2. **Un disponible NEGATIVO es válido** y se pinta en rojo. La función vieja lo truncaba a 0, lo que
   ocultaba el faltante y su magnitud.
3. **🐛 Convención invertida (corregida):** el trigger viejo trataba `tipoTension=2` como Alta mientras
   `planes.service.ts` lo leía como Media. La pantalla de Ventas mostraba el nivel equivocado. Ahora
   se usa la columna `nivel` ('MT'/'BT') con CHECK, y `tipoTension`/`tipoContrato` quedan deprecadas.
4. 📌 **SUPUESTOS a confirmar con el negocio:** (a) que la "Alta" de la BD era la **Media** real;
   (b) que `tipoContrato=1` era **VENTA**. Afectan solo a 3 filas de prueba de "Prueba Parque".
5. **Áreas comunes fuera de alcance:** caseta, alumbrado, PTAR, locales y amenidades consumen KVA en
   el control operativo pero **no se modelan** todavía (decisión de alcance del MVP).
6. **Fuera del MVP:** disponibilidad futura (parques en construcción), "KVA que CFE libera con obras
   específicas", lista de espera y los montos de renta/venta de KVA.
