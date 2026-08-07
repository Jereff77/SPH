---
modulo: KVA's
estado: desarrollado
rutas: [/parques/kvas]
claves_permiso: [720, 721, 722, 723]
tablas: [kvaAcometidas, kvasAsignados, kvaDevoluciones, kvaNaveDocs, parques, naves, arrenPropiedades, propiedades]
palabras_clave: [kva, kvas, energia, electricidad, luz, tension, media tension, baja tension, acometida, cfe, capacidad electrica, carga, contrato de cfe, numero de servicio, devolucion de kvas, liberar kvas, sobregiro, expediente de la nave, documentos de la nave, carta de compra de kva, contrato de kva, "cuantos kva tiene el parque", "no me deja liberar la nave", "faltan kva por regresar", "los kva no cuadran", "aparece en rojo", "kva disponibles negativos", "como asigno kva", "vendidos o rentados", "ya hay contrato con cfe", "quien tiene los kva", "quien renta la nave", "de quien es la nave", "donde subo el contrato", "no puedo subir documentos", "no veo los documentos de la nave", "el parque sale en ceros", "sin informacion capturada"]
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
| KVA's (tablero) | `/parques/kvas` | **720** (ver) |
| Asignar / editar / cancelar | modal | **721** |
| Registrar devolución | modal | **722** |
| Subir / dar de baja documentos de la nave | modal | **723** (consultarlos basta con 720) |

La capacidad del parque (MT/BT) se captura al **crear o editar el parque** (`/parques`, permisos
700/701).

### El tablero (rediseño v2.64.0)

Replica la lectura del control operativo en Excel. Se listan **TODOS los parques activos**, agrupados
por acometida — **también los que no tienen nada capturado**, que salen en ceros con la nota «Sin
información capturada» (así se ve qué falta por registrar; antes desaparecían).

Cada parque es un bloque con columnas **Baja | Media** y estas filas:

| Fila | De dónde sale |
|---|---|
| Disponibilidad actual del parque | `parques.kvasBt` / `kvasMt` (capacidad) |
| Asignados contratos venta | suma de `cantKvas` con `figura='VENTA'` y `status=true` |
| Rentados a inquilinos | ídem con `figura='RENTA'` (se **oculta** si es 0) |
| Ya asignados (ya hay contrato con CFE) | suma por `etapa='ASIGNADO'` |
| Comprometidos con inquilinos | suma por `etapa='COMPROMETIDO'` |
| Por asignar | suma por `etapa='POR_ASIGNAR'` |
| Devueltos al parque | suma de `cantDevuelta` (se **oculta** si es 0) |
| **Disponibles actualmente** | `kvasBtDisponibles` / `kvasMtDisponibles` — resaltado; **rojo si es negativo** |

Botón **«Ver naves»** por parque: detalle nave × bolsa, **ordenado por número de nave**. Junto al
número aparece **la empresa que ocupa la nave** (ver §5, regla del ocupante).

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

### `kvaNaveDocs` (nueva, 2026-08-04) — expediente de la nave
`idDoc` (uuid PK) · `idNave` (FK a `naves`) · `idParque` · `titulo` · `descripcion` · `urldoc` (ruta
en el bucket privado `kvaDocs`, prefijo `naves/<idNave>/`) · `status` / `motivoBaja` (baja lógica) ·
`uidr` · `fc`. Índice `ix_kvanavedocs_nave_fc (idNave, fc DESC)`.

⚠️ Los documentos se cuelgan de la **NAVE**, no de una asignación concreta: un mismo contrato suele
cubrir la baja y la media a la vez (decisión de Jereff, 2026-08-04). **Sin catálogo de tipos**:
título y descripción libres, igual que el resto de los `*_docs` del ERP.

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
- **Ocupante de la nave (quién aparece junto al número):** manda la **empresa arrendataria**
  (`arrenPropiedades` con `status=true` → `idArrendador`); si la nave no está arrendada, se muestra la
  **razón social del inversionista dueño** (`propiedades` con `status=true` → `idInversionista`),
  etiquetada como «(propietario)». Si no hay ninguno, un guion.
- **Los documentos no se borran:** baja **lógica** con motivo obligatorio. El archivo se conserva en el
  bucket para que el expediente pueda auditarse después.

## 6. Arquitectura

- Backend: `apps/api/src/modules/parques/kvas.service.ts`, `kvas.controller.ts`, `kvas.schemas.ts`.
  Helper de archivos reutilizable: `apps/api/src/common/utils/archivo-seguro.ts`.
- El candado vive en `planes-arre.service.ts` → `liberarNave` y `planes.service.ts` →
  `desvincularNave`, ambos vía `KvasService.exigirKvasDevueltos(idNave)`.
- Frontend: `apps/web/src/features/parques/KvasPage.tsx` (tablero), `DocumentosNaveModal.tsx`
  (expediente), `AsignacionKvaModal.tsx`, `DevolucionKvaModal.tsx`, `kvas.api.ts`.
- ⛔ **`FideicomisoModule` debe importar `ParquesModule`.** Reprovee `PlanesService`, que inyecta
  `KvasService` para el candado; sin ese import **Nest no arranca** y el contenedor queda sirviendo la
  versión anterior con builds en verde (ver gotcha #7).
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
| "Veo los documentos pero no puedo subir ninguno / no aparece el formulario." | Falta el permiso **723**. Con 720 solo se consultan. | Configuraciones → Permisos → `Parques · KVA's · Documentos`. |
| "El parque aparece en ceros / dice «Sin información capturada»." | Ese parque todavía no tiene capacidad ni asignaciones. **Es correcto que se vea**: se listan todos a propósito. Solo Spartek I, II y III y «Prueba Parque» tienen datos. | Capturar la capacidad en Parques → editar parque (KVA's Media / Baja) y luego asignar a naves. |
| "Junto a la nave sale un nombre de persona y no la empresa." | La nave **no está arrendada**: se muestra el inversionista dueño con la etiqueta «(propietario)». | Si debería estar arrendada, revisar `arrenPropiedades` (¿el vínculo tiene `status=true`?). |
| "Subí un documento y no lo veo en otra nave." | El expediente es **por nave**: cada nave tiene el suyo. | Abrir la nave correcta desde el tablero. |
| "El enlace del documento dejó de funcionar." | Las URLs son **firmadas y caducan a la hora** (el bucket es privado). | Volver a abrir el modal: se firman de nuevo al cargar. |

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
7. **🐛 El API no arrancaba y nadie se enteraba (2026-08-04).** `FideicomisoModule` reprovee
   `PlanesService`, que desde v2.60.0 inyecta `KvasService`, pero no importaba `ParquesModule`. Nest
   fallaba al **arrancar** (`Nest can't resolve dependencies of the PlanesService`). Como es un error de
   **inyección en runtime**, `tsc` y `nest build` pasaban en VERDE: EasyPanel construía la imagen, el
   contenedor moría al iniciar y quedaba sirviendo la versión anterior. Síntoma visible: la pantalla de
   KVA's vacía y `GET /api/kvas/resumen` → **404** mientras `/api/health` → 200.
   **Lección:** al inyectar un servicio nuevo en un servicio que otro módulo reprovee, hay que importar
   su módulo en **todos** los que lo declaran como provider — y hacer un `pnpm dev` de arranque real
   antes de dar por buena la sesión (el typecheck no lo detecta).
8. **`arrenPropiedades.idArrendador` apunta a `inversionista`**, no a una tabla de arrendatarios: es un
   catálogo único de terceros con banderas `inversionista` / `arrendatario` / `usuarioFinal`.
9. **Nave 85 del Excel sin cargar:** aparece en el control operativo de Spartek II con 5 KVA de baja,
   pero **no existe** en ese parque dentro del ERP. Por eso la baja cargada suma 1 060 y no 1 065.
10. **Spartek I quedó con −112 de baja disponible** tras la carga: es el sobregiro real del control
    operativo (el Excel lleva Spartek I y II en un solo pool). Pendiente de decidir el reparto con el
    negocio (§9 del PLAN).
