---
modulo: Parques
estado: desarrollado          # desarrollado | parcial | stub (pendiente)
version_doc: 1.0
ultima_actualizacion: 2026-06-04
submodulos: [Parques, Disponibilidad]
rutas: [/parques, /parques/disponibilidad]
claves_permiso: [700, 701, 702, 710]
tablas: [parques, naves, v_naves, v_disponibilidad, propiedades, arrenPropiedades, arrePdp, inversionista]
palabras_clave: [parque, parque industrial, nave, bodega, local, lote, manzana, mza, KVA, kva, energia, disponibilidad, terreno, construccion, GYM, coworking, cafeteria, inquilino, arrendatario, dueño, inversionista, "no veo el botón para crear un parque", "no me deja poner la nave como vendida", "el arrendatario aparece vacío", "la cantidad de naves no coincide"]
relacionado_con: [propietarios, arrendatarios, cxp, configuraciones]
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
- ⏳ **KVA's por nave** (sección no desarrollada).
- ⏳ Disponibilidad podría migrarse al formato de tarjetas (hoy es tabla).
