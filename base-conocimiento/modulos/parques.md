---
modulo: Parques
estado: desarrollado          # desarrollado | parcial | stub (pendiente)
version_doc: 1.2
ultima_actualizacion: 2026-07-05
submodulos: [Parques, Disponibilidad, Historial de la nave]
rutas: [/parques, /parques/disponibilidad]
claves_permiso: [700, 701, 702, 710]
tablas: [parques, naves, v_naves, v_disponibilidad, propiedades, arrenPropiedades, arrePdp, pdp, raPdp, rgPdp, auditoria, catUsers, inversionista]
palabras_clave: [parque, parque industrial, nave, bodega, local, lote, manzana, mza, KVA, kva, energia, disponibilidad, terreno, construccion, GYM, coworking, cafeteria, inquilino, arrendatario, dueño, inversionista, historial de la nave, trazabilidad de la nave, "línea de tiempo de la nave", "quién desvinculó la nave", "por qué se desvinculó", "motivo de la baja", "vida de la nave", "por dónde ha pasado la nave", "no veo el botón para crear un parque", "no me deja poner la nave como vendida", "el arrendatario aparece vacío", "la cantidad de naves no coincide", "la nave aparece duplicada", "aparece un arrendatario que ya se fue", "arrendatario fantasma", "sale dos veces la misma nave", "aparece un dueño que ya no es", "propietario fantasma"]
relacionado_con: [propietarios, arrendatarios, fideicomiso, auditoria-y-ver-como, configuraciones]
---

# Módulo: Parques

> Cómo leer este documento (para el agente): primero la sección **Identificación** para confirmar
> que el tema corresponde a este módulo; luego **Modelo de datos** y **Detalles no obvios** para
> responder con precisión; y **Diagnóstico** cuando el usuario reporta un problema.

## 1. Identificación

- **Propósito:** administrar el catálogo de **parques industriales** y sus **naves** (las unidades
  rentables/vendibles dentro de un parque). Es la base sobre la que operan Propietarios,
  Arrendatarios y CxP.
- **A quién sirve:** personal de operaciones/comercial que da de alta parques, genera naves y
  consulta su disponibilidad.
- **Sinónimos del usuario:** a una **nave** el usuario puede llamarla "bodega", "local", "lote" o
  por su etiqueta personalizada (p. ej. "GYM", "Coworking", "Cafetería"). A un **parque** lo puede
  llamar "parque industrial" o por su nombre (Actitek, Acupark, Norponiente, Spartek…).

## 2. Pantallas y rutas

| Pantalla | Ruta v2 | Permiso | Qué hace |
|---|---|---|---|
| Parques | `/parques` | 700 (ver) | Lista de parques + tarjetas de KVA's + tarjetas de naves del parque seleccionado. |
| Disponibilidad | `/parques/disponibilidad` | 710 | Tablero de naves por parque con su situación y ocupante. |
| Editar nave (modal) | dentro de `/parques` | 700 | Editor de la nave con pestañas **Datos** e **Historial** (la trazabilidad/línea de tiempo de la nave — ver §4b). |

Equivalente en v1 (FlutterFlow): `lib/pages/web_app/i03_parques/` (`parques`, `disponibilidad`).

## 3. Permisos (claves de `segModulos`)

| Clave | Área | Habilita |
|---|---|---|
| **700** | Módulo Parques | Acceder/ver el módulo Parques (lectura). |
| **701** | Agregar Parques | Botón/endpoint para **crear un parque nuevo**. |
| **702** | Agregar Naves | Botón/endpoint para **agregar naves** a un parque existente. |
| **710** | Disponibilidad | Acceder al submenú Disponibilidad. |

> La autorización es **server-side** (el backend valida la clave con el JWT). La edición de una nave
> es parte del módulo (700). Los botones de la UI se ocultan según el permiso, pero la barrera real
> está en el backend (responde 403 si falta el permiso).

## 4. Modelo de datos

### Tabla `parques`
PK `idParque` (texto, generado en el servidor). Un registro por parque.

| Columna | Tipo | Significado / notas |
|---|---|---|
| `idParque` | text | PK. Identificador del parque. |
| `nomParque` | text | Nombre del parque. |
| `direccion` | text | Domicilio. |
| `naves` | bigint | Cantidad de naves del parque (ver gotcha #1). |
| `kvasAlta` | int | Capacidad eléctrica total en nivel **Alta** (KVA). |
| `kvasMedia` | int | Capacidad eléctrica total en nivel **Media**. |
| `kvasAltaDisponibles` | int | KVA Alta disponibles (default 0; lo ajusta la operación). |
| `kvasMediaDisponibles` | int | KVA Media disponibles (default 0). |
| `kvasAltaUtilizados` | int | **GENERADA** = `kvasAlta − kvasAltaDisponibles`. No se escribe. |
| `kvasMediaUtilizados` | int | **GENERADA** = `kvasMedia − kvasMediaDisponibles`. No se escribe. |
| `status` | bool | Activo (true). |
| `esTicket` | bool | Marca registros que son "contenedor de tickets", no parques reales. |
| `idUser`, `fc` | text/ts | Auditoría básica de creación. |

Filtro habitual: `status = true AND esTicket = false`.

### Tabla `naves`
PK `idNave` (texto, generado en el servidor). Un registro por nave; pertenece a un parque (`idParque`).

| Columna | Tipo | Significado / notas |
|---|---|---|
| `idNave` | text | PK. |
| `idParque` | text | Parque al que pertenece. |
| `numNave` | int | **Consecutivo** numérico dentro del parque (1..N). |
| `numNaveNAME` | text | **Etiqueta visible** de la nave. Por defecto es el consecutivo, pero es **personalizable** (p. ej. "GYM"). |
| `situacion` | text | Estado comercial: `Disponible`, `Apartado`, `Bloqueado`, `Vendida`. |
| `mza` | int | Manzana. Default 0. |
| `lote` | int | Lote. Default 0. |
| `terreno` | double | m² de terreno. Default 0. |
| `construccion` | double | m² de construcción. Default 0. |
| `precio` | double | Precio. Default 0. |
| `fecEntrega` | date | Fecha estimada de entrega (puede ser null). |
| `Arrendada` | bool | Marca si la nave está bajo arrendamiento. Default false. |
| `status` | bool | Activo. Default true. |
| `fum`, `fumUser` | ts/text | Última modificación (fecha y usuario). |

### Vista `v_naves` (lectura del detalle de naves)
Une `naves` + `propiedades` (dueño) + `inversionista` (razón social del dueño) + `arrenPropiedades`
(arrendatario). Campos clave: `razonsocial` = **nombre del dueño/inversionista**, `idArrendador` =
id del **arrendatario** (ver gotcha #2), `nomDescriptivo`, `tienePdp`, `pdpActivo`.

### Vista `v_disponibilidad` (tablero comercial)
Por nave: `situacion`, `nombre` (ocupante), `idPropiedad`, `idInversionista`, datos físicos. Se filtra
por `idParque`.

## 4b. Historial / trazabilidad de la nave (v2.56.0)

En **Parques → editar una nave → pestaña "Historial"** se ve la **línea de tiempo de la nave**: por dónde
ha pasado a lo largo de su vida, con **quién hizo cada cosa, cuándo y con qué motivo**. Cubre las dos
dimensiones de la nave (venta y renta).

### De dónde sale (clave)
- **NO existe una bitácora aparte de la nave.** El historial se **RECONSTRUYE desde la tabla `auditoria`**
  (la bitácora general del sistema, llenada por los triggers `trg_auditoria`). Endpoint
  `GET /parques/naves/:idNave/historial` (clave 700). Ventaja: el **actor** de cada evento se toma del
  **JWT verificado** (no falsificable), así que el "quién" es confiable.
- El backend **traduce** cada registro crudo de auditoría a un evento legible; **no** expone el jsonb
  técnico al usuario. Solo alcanza lo que la auditoría v2 capturó (desde ~junio 2026); los movimientos
  anteriores (v1/Flutter, o cambios directos en BD) aparecen como "Sistema (v1)" / "Cambio directo en BD",
  o no aparecen. Es el límite honesto del historial.

### Qué eventos muestra
| Dimensión | Eventos |
|---|---|
| **Venta** | Vinculada a venta (con inversionista) · Desvinculada de venta (+ motivo) · Plan de pagos creado · Renta Administrada/Garantizada creada |
| **Renta** | Vinculada a renta (con arrendatario) · Liberada de renta (+ motivo) · Plan de renta creado / renovado / cancelado (+ motivo) / finalizado |
| **Nave** | Nave creada · Cambio de situación |

### El "por qué": columna `motivoBaja`
Al **desvincular** una nave de venta (Propietarios) o **liberar** una de renta (Arrendatarios) se **pide un
motivo**, que se guarda en `propiedades.motivoBaja` (venta) o `arrenPropiedades.motivoBaja` (renta) y queda
auditado. El actor y la fecha viven en `auditoria` (no se duplican). Ese motivo es el que aparece en la línea
de tiempo. Ambas operaciones son **baja lógica** (`status=false`): NO borran el vínculo (ver gotcha #8).

## 5. Reglas de negocio y validaciones

- Al **crear un parque** se generan automáticamente sus naves (cantidad indicada), todas en
  situación `Disponible`, numeradas 1..N. Operación atómica: si falla la generación de naves, se
  deshace el parque (no quedan parques a medias).
- Al **agregar naves** a un parque existente, el consecutivo **continúa** desde la última nave
  (`max(numNave) + 1`).
- La situación **`Vendida` NO se asigna desde el editor de naves**; solo desde el módulo
  **Propietarios** (al asignar un inversionista). El editor solo permite `Disponible`, `Apartado`,
  `Bloqueado` (ver gotcha #3).
- La **etiqueta** (`numNaveNAME`) es obligatoria y personalizable.
- Límite de naves a generar de una vez: 300.

## 6. Flujos paso a paso

- **Crear un parque:** Parques → botón "+" (requiere permiso 701) → nombre, domicilio, nº de naves,
  KVA's Alta/Media → "Crear parque". Se generan las naves automáticamente.
- **Agregar naves a un parque:** seleccionar el parque → "+ Agregar naves" (requiere 702) → indicar
  cuántas → se crean Disponibles continuando el consecutivo.
- **Renombrar una nave (GYM, Coworking…):** editar la nave (✎) → campo "Etiqueta de la nave".
- **Cambiar datos físicos / situación:** editar la nave → manzana, lote, terreno, construcción,
  precio, fecha; situación entre Disponible/Apartado/Bloqueado.
- **Ver disponibilidad:** Disponibilidad → elegir parque → tabla con situación y ocupante; filtros y
  orden disponibles.

## 7. ⚠️ Detalles no obvios (gotchas)

1. **`parques.naves` vs. conteo real:** en v1 este campo guardaba por error las KVA's Alta. En v2 se
   corrigió (guarda la cantidad real) y, además, la lista muestra el **conteo real** de naves
   (`COUNT` sobre `naves`), no el campo.
2. **`idArrendador = idInversionista`:** el **arrendatario** de una nave es también un registro de la
   tabla `inversionista`. Por eso `v_naves` solo trae `idArrendador` (un id) y el **nombre** del
   arrendatario se resuelve consultando `inversionista.razonsocial` con ese id. (Mismo patrón que usa
   la vista `v_propiedades` con su columna `arrendador`.)
3. **`Vendida` es especial:** intentar ponerla desde el editor de naves se rechaza. La venta se
   registra en **Propietarios**.
4. **`kvasUtilizados` es columna generada:** `kvasAltaUtilizados`/`kvasMediaUtilizados` = total −
   disponibles. No se pueden escribir directamente.
5. **KVA's por nave: aún no desarrollado.** En las tarjetas de nave puede aparecer una sección de
   KVA's sin datos; esa funcionalidad está pendiente (no es un error de datos).
6. **`esTicket = true`** excluye parques/naves que en realidad son contenedores de tickets; no son
   parques reales y se filtran.
7. **🐛 (CORREGIDO 2026-07-04, v2.55.1) `v_naves` mostraba arrendatarios ya desvinculados y duplicaba
   naves.** La vista unía `arrenPropiedades` **sin filtrar `status=true`**: cualquier vínculo de renta ya
   cerrado (histórico) seguía apareciendo como si la nave estuviera ocupada, y si una nave tenía **más de
   un vínculo** en `arrenPropiedades` (activo o no), la nave salía **duplicada** en la pantalla (una fila
   por vínculo). Diagnosticado en "Prueba Parque" (6 de 10 naves con arrendatario fantasma) y reproducido
   en vivo por el usuario. Fix: `LEFT JOIN "arrenPropiedades" arren ON arren."idNave"=n."idNave" AND
   arren.status=true`. De paso se corrigió que `nomParque` se unía por `prop."idParque"` (el parque de la
   propiedad) en vez de `n."idParque"` (el parque real de la nave) — salía vacío en naves sin propiedad.
   Ver `migraciones/2026-07-04-v-naves-fix-arrendador-inactivo-y-parque.sql`. Sin impacto en consumidores
   (nadie esperaba filas duplicadas); el Agente de Soporte también consulta esta vista (rol
   `v2_agente_ro`) y se benefició del fix.
   - **Continuación (v2.56.0):** el mismo hueco existía para la dimensión de **VENTA**. `v_naves` y
     `v_disponibilidad` unían `propiedades` **sin `status=true`**, así que una propiedad dada de baja
     (baja lógica) mostraba a su **inversionista/ocupante como fantasma** (síntoma: "aparece un dueño que ya
     no es"; visto en el contenedor de Tickets `A3`). Fix: `AND prop.status = true` en el LEFT JOIN a
     `propiedades` de ambas vistas. Ahora **ninguna de las dos muestra vínculos ya dados de baja** (venta o
     renta). Ver `migraciones/2026-07-05-vistas-prop-status.sql`.
8. **Desvincular una nave es BAJA LÓGICA, no borrado (v2.56.0).** Tanto desvincular de **venta**
   (Propietarios) como liberar de **renta** (Arrendatarios) marcan el vínculo con `status=false`, regresan
   la nave a `Disponible` y **conservan todo el histórico** (planes, pagos) — que alimenta el Historial de la
   nave (§4b). **NO se borra la fila.**
   - Guarda de negocio: impide desvincular si hay un plan **activo** (venta: `pdpActivo`; RG/RA: se consulta
     la **tabla real** por `rentaActiva=true`, porque las banderas `raPdpActivo`/`rgPdpActivo` pueden estar
     desincronizadas). Los planes **saldados/históricos NO bloquean**.
   - Antes de v2.56.0 el desvincular de venta hacía un **DELETE físico** que rompía por FK cuando la propiedad
     tenía plan/pagos (se veía como "Error interno del servidor"), y si se borraba `propiedades` directo en BD
     la nave quedaba "Vendida" sin dueño. Con la baja lógica esto ya no ocurre. (Saneo histórico de tickets
     huérfanos: 2026-07-04/05.)

## 8. Relaciones con otros módulos

- **Propietarios / Inversionistas:** asignan un inversionista (dueño) a una nave → la nave pasa a
  `Vendida`. El dueño se ve como `razonsocial` en `v_naves`. Tablas: `propiedades`, `inversionista`.
- **Arrendatarios:** el arrendamiento de una nave vive en `arrenPropiedades` (+ `arrePdp` para el
  plan de pagos de renta). El arrendatario es un `inversionista` (gotcha #2).
- **CxP:** los pagos/presupuestos pueden referenciar naves/propiedades.

## 9. Para el agente de soporte (🩺 diagnóstico / problemas comunes)

| Síntoma que reporta el usuario | Causa probable | Qué hacer |
|---|---|---|
| "No veo el botón para crear un parque." | No tiene el permiso **701**. | Verificar permisos del usuario (Configuraciones → Permisos). |
| "No veo el botón de agregar naves." | Falta permiso **702** o no hay un parque seleccionado. | Verificar 702 y que haya un parque elegido. |
| "No me deja poner la nave como Vendida." | Es por diseño: `Vendida` se asigna en **Propietarios**. | Indicar el flujo correcto (asignar inversionista). |
| "El arrendatario aparece vacío (—)." | La nave no tiene arrendamiento activo en `arrenPropiedades`. | Normal si no está rentada; si debería estarlo → revisar Arrendatarios. |
| "La cantidad de naves no coincide." | Confusión con el campo `parques.naves` (histórico) vs. conteo real. | El conteo real es el que muestra la lista (cuenta `naves`). |
| "Guardé un cambio en la nave pero no se aplicó." / "Dice solo lectura." | Está en modo **"Ver como"** (soporte). | Salir del modo "Ver como" para poder editar. |
| Error 403 al crear/editar. | Falta el permiso correspondiente (700/701/702). | Escalar a soporte si el usuario debería tenerlo. |

**Cuándo levantar ticket a soporte:** asignación incorrecta de permisos, datos inconsistentes entre
`naves`/`propiedades`/`arrenPropiedades` (p. ej. una nave marcada arrendada sin registro en
`arrenPropiedades`), o KVA's que no cuadran. Estos requieren intervención del área de soporte/datos.

## 10. Estado y pendientes

- ✅ Parques, Disponibilidad, crear/editar parque, agregar naves, editar nave, etiqueta personalizable,
  filtros y orden, permisos 700/701/702/710.
- ✅ (2026-07-04, v2.55.1) `v_naves` corregida: ya no muestra arrendatarios desvinculados ni duplica naves.
- ✅ (2026-07-05, v2.56.0) **Historial de la nave** (pestaña en el editor, reconstruido de `auditoria`);
  **desvincular = baja lógica** en venta y renta (ya no borra) con **motivo**; `v_naves` y `v_disponibilidad`
  filtran también `prop.status=true` (ya no muestran propiedades dadas de baja como fantasma).
- ⏳ **KVA's por nave** (sección no desarrollada).
- ⏳ Disponibilidad podría migrarse al formato de tarjetas (hoy es tabla).
- ⏳ **Backlog:** naves-ticket dadas de baja (`propiedades.status=false`) dentro del contenedor de Tickets
  (`A3 (Tickets)`, `esTicket=true`) — las **vistas ya no las muestran** (filtro `prop.status=true`), pero las
  filas `status=false` permanecen; limpieza opcional si se trabaja ese módulo. **Gotcha de tickets:** una
  nave-ticket "A3 · N" puede tener **varios inversionistas históricos en naves físicas distintas** con la
  misma etiqueta, y sus pagos viven en la tabla `pagos` (por `idPdp` con prefijo `tkt-…`), no en `tickets`.
