---
documento: PLAN — Administración de KVA's
modulo_destino: Parques
estado: 🔄 diseño (NO construir hasta visto bueno de Jereff)
fecha: 2026-08-03
autor: Toribio / Opus 5
palabras_clave: [kva, kvas, energia, tension, media tension, baja tension, acometida, cfe, capacidad electrica, parque, nave, devolucion de kvas, liberacion de nave]
tablas: [parques, naves, kvasAsignados, kvaAcometidas, kvaDevoluciones, propiedades, arrenPropiedades]
claves_permiso: [700, 720, 721, 722]
---

# Administración de KVA's — documento de diseño ejecutable

> Plan para construir el módulo. **Nada de esto está aplicado.** Fuente: plática con Jereff
> (2026-08-03) + verificación contra la BD real vía MCP + el Excel operativo
> `D:\Clientes\SPH Bines Raices\Asignación de KVA'S_SPH_2026.xlsx`.

## 1. Qué problema resuelve

Cada parque tiene una capacidad eléctrica contratada con CFE, en **dos niveles independientes**:
**Media Tensión (MT)** y **Baja Tensión (BT)**. Esa capacidad se reparte entre las naves, bajo dos
figuras: **venta** (el KVA se va con la nave) o **renta** (se presta mientras dure el contrato).

Hoy ese control vive **fuera del sistema**, en un Excel de 7 hojas que solo una persona mantiene.
El ERP tiene la plomería a medias y **sin un solo dato productivo cargado**.

Requisito nuevo (no existe ni en el Excel): al dejar una nave, si los KVA estaban **vendidos**, debe
acreditarse con **documentación** que regresaron al parque antes de poder liberar la nave.

## 2. Estado verificado de la BD (evidencia, no memoria)

| Objeto | Realidad hoy |
|---|---|
| `parques.kvasAlta` / `kvasMedia` | int. **Los 10 parques reales están en 0**; solo "Prueba Parque" tiene 1500/1000 |
| `parques.kvas*Disponibles` | int. Los lleva un trigger |
| `parques.kvas*Utilizados` | **Columnas GENERADAS** = total − disponibles |
| `kvasAsignados` | **3 filas en total**, 2 naves, todas de "Prueba Parque" |
| `trg_parques_actualizar_kvas_disponibles` | BEFORE I/U — inicializa y recalcula disponibles |
| `trg_kvasasignados_actualizar_parques_kvasdisponibles` | AFTER I/U/D — descuenta y **devuelve al poner `status=false`** |
| v1 (FlutterFlow) | **APAGADO desde 2026-06-21** → los renames no rompen la app vieja |

### 🐛 Bug vivo detectado: convención de `tipoTension` invertida

- El **trigger** trata `tipoTension = 2` → descuenta de **Alta**; `= 1` → de **Media**.
- El **código v2** (`apps/api/src/modules/ventas/planes.service.ts:167`) hace lo contrario
  (`1 → alta, 2 → media`), marcado en el propio código como *"supuesto a confirmar"*.
- Prueba: las 3 filas son `tipoTension=2` (50 KVA) y el parque quedó con `kvasAltaUtilizados = 50`,
  mientras la pantalla de Ventas los pinta como **"KVAs Media"**.
- Impacto real hoy: **nulo** (solo hay datos de prueba). Impacto si se cargan datos reales sin
  corregir: la pantalla miente. **Se corrige en este módulo, antes de cargar nada.**

## 3. Lo que revela el Excel operativo

Cada hoja es un parque; **las columnas son naves** y las filas son conceptos. Ejes que maneja:

1. **Nivel**: `Carga | Baja | Media` (confirma la nomenclatura correcta).
2. **Figura**: Vendidos / Rentados (leyenda de color) + "uso final / inquilino".
3. **Etapa del trámite**: `Asignados para venta` → `Comprometidos` → **`Ya asignados (ya hay
   contrato con CFE)`** → `Por asignar` → `Disponibles`.
4. **Horizonte**: disponibilidad **actual** vs. **futura (tentativo)** + "KVA que CFE libera con
   obras específicas".
5. **Dinero**: monto de renta mensual y monto de venta por nave (fuera de alcance por ahora, §5).

Datos reales de capacidad (para la carga inicial):

| Parque (Excel) | BT | MT | Folio CFE |
|---|---|---|---|
| Spartek I & II (34.5 kV) | 1017 | 4958 | DP09000001290/2025 |
| Spartek III (13.2 kV) | 178 | 1515 | — |
| Norponiente | 1294 | 3206 | DP0900000456/2024 |
| Acupark II | 732.5 | 2620.5 | DP0900000619/2026 |
| Acupark III | 272 | 2617 | DP0900001660/2024 |
| Santa Catarina | 407 | 193 | — (parque futuro) |

⚠️ **Hay decimales** (`732.5`, `2620.5`) y las columnas de BD son `integer` → se truncarían.

## 4. Decisiones cerradas por Jereff (2026-08-03)

| # | Decisión |
|---|---|
| 1 | El saldo se lleva **por parque Y por acometida** (dos niveles) |
| 2 | MT y BT son **bolsas independientes**, cada una negociada con CFE. **No hay trasvase** |
| 3 | **Áreas comunes** (caseta, alumbrado, PTAR, locales, amenidades) **fuera del MVP** |
| 4 | El **contrato/folio de CFE sí se guarda** |
| 5 | MVP = **disponibilidad actual**. Sin obras futuras, sin lista de espera |
| 6 | **Santa Catarina** se dará de alta cuando exista el parque |
| 7 | Nomenclatura correcta: **Media y Baja** (hoy la BD dice Alta y Media) |

## 5. Preguntas abiertas (van a la sesión con el cliente)

1. ¿Qué documento acredita la devolución de KVA vendidos? (hipótesis: la **baja del contrato CFE**)
2. ¿Se puede devolver **parcial** (20 de 50) o es todo o nada?
3. ¿El bloqueo de liberación es **duro**, o un rol autorizado puede saltarlo dejando constancia?
4. ¿Una nave puede tener KVA **vendidos y rentados a la vez**?
5. Los **montos** de renta/venta de KVA: ¿viven aquí o en los "Cargos KVA" de los planes de renta?
6. La Hoja 4 dice *"Son 300 KVA's que se pasan de baja a media"* — ¿fue una renegociación puntual
   con CFE o pasa seguido? (contradice la decisión #2)
7. **Reparto Spartek I vs II**: el Excel los lleva en un solo pool de 6110 KVA; en el ERP son dos
   parques. ¿Cómo se reparte la capacidad entre ambos?
8. **Numeración**: el Excel numera naves corrido entre parques (SP I&II: 1-123; SP III: 124-153) y
   el ERP numera desde 1 en cada parque. Hay que mapear columna→`idNave` real, nave por nave.

## 6. Modelo de datos propuesto

### 6.1 Rename (⚠️ es un CORRIMIENTO, no un rename simple)

`kvasAlta` debe pasar a llamarse "Media" y `kvasMedia` a "Baja". Renombrar reusando la palabra
"Media" con **otro significado** deja código que no truena: lee el número equivocado en silencio.

**Propuesta: nombres inequívocos que nadie pueda confundir.**

| Hoy | Nuevo | Significado |
|---|---|---|
| `kvasAlta` | `kvasMt` | Capacidad en Media Tensión |
| `kvasAltaDisponibles` | `kvasMtDisponibles` | |
| `kvasAltaUtilizados` | `kvasMtUtilizados` | Generada |
| `kvasMedia` | `kvasBt` | Capacidad en Baja Tensión |
| `kvasMediaDisponibles` | `kvasBtDisponibles` | |
| `kvasMediaUtilizados` | `kvasBtUtilizados` | Generada |

📌 **SUPUESTO a confirmar con Jereff:** que la "Alta" de la BD equivale a la **Media** real y la
"Media" de la BD a la **Baja** real. No hay datos productivos que lo prueben (todo en 0); se deduce
de que el Excel maneja exactamente dos niveles y de la jerarquía eléctrica.

### 6.2 Tipos: `integer` → `numeric(12,2)`

En `parques.kvas*` y `kvasAsignados.cantKvas`. Obligatorio por los decimales de Acupark II.

### 6.3 Tabla nueva `kvaAcometidas`

La acometida es la **fuente física** contratada a CFE; los parques cuelgan de ella.

| Columna | Tipo | Notas |
|---|---|---|
| `idAcometida` | text PK | generado server-side (12 chars, patrón del proyecto) |
| `nombre` | text NOT NULL | p. ej. "Spartek I & II" |
| `tensionKv` | numeric(6,2) | 34.5 / 13.2 |
| `capacidadMt` / `capacidadBt` | numeric(12,2) NOT NULL DEFAULT 0 | contratado con CFE |
| `folioCfe` | text | `DP09000001290/2025` |
| `status` | bool DEFAULT true | baja lógica |
| `idUser`, `fc` | text/timestamptz | auditoría de creación |

Y en `parques`: **`idAcometida` text NULL** (1 acometida : N parques).
Regla de negocio: la suma de capacidades de los parques de una acometida **no debe exceder** la
capacidad de la acometida → se valida y se avisa (no se bloquea en el MVP).

📌 Si un parque llegara a necesitar **dos** acometidas (caso Acupark II 2ª etapa), se resuelve con
tabla puente en una fase posterior. No se diseña ahora.

### 6.4 Rediseño de `kvasAsignados`

Columnas nuevas (todas aditivas salvo las dos que sustituyen a los smallint sin catálogo):

| Columna | Tipo | Para qué |
|---|---|---|
| `nivel` | text NOT NULL CHECK IN ('MT','BT') | **sustituye a `tipoTension`** (mata el bug de §2) |
| `figura` | text NOT NULL CHECK IN ('VENTA','RENTA') | **sustituye a `tipoContrato`** |
| `etapa` | text NOT NULL CHECK IN ('POR_ASIGNAR','COMPROMETIDO','ASIGNADO') | del Excel; `ASIGNADO` = ya hay contrato con CFE |
| `contratoCfe` | text NULL | nº de servicio/contrato del usuario final |
| `fechaContratoCfe` | date NULL | |
| `idPropiedad` | text NULL | vínculo de **venta** (a quién se le asignó) |
| `idNavArrend` | text NULL | vínculo de **renta** |
| `motivoBaja` | text NULL | mismo patrón que `propiedades.motivoBaja` |

`tipoTension` y `tipoContrato` se **eliminan** tras migrar las 3 filas existentes (v1 apagado;
requiere el OK caso-por-caso de Jereff según la regla de `OBSOLESCENCIA-BD.md`).

Regla: `figura='VENTA'` ⇒ `idPropiedad` obligatorio · `figura='RENTA'` ⇒ `idNavArrend` obligatorio.

### 6.5 Tabla nueva `kvaDevoluciones` (el corazón del requisito)

| Columna | Tipo | Notas |
|---|---|---|
| `idDevolucion` | text PK | |
| `idKvas` | uuid FK → `kvasAsignados` | qué asignación se devuelve |
| `cantidad` | numeric(12,2) NOT NULL | permite **devolución parcial** (pendiente §5.2) |
| `fechaDevolucion` | date NOT NULL | |
| `documento` | text NOT NULL | folio/nº del documento que acredita |
| `urldoc` | text NOT NULL | archivo en bucket **privado**, servido firmado |
| `uidValida` | uuid NULL | quién la dio por buena (si se decide que requiere aprobación) |
| `status` | bool DEFAULT true | |

Patrón de subida: reutilizar **`subirArchivoCxp`** de CxP (allowlist de mimetype + magic bytes +
sanitización de path + bucket privado + URL firmada). ⛔ No reinventar la subida.

### 6.6 Triggers

1. **Reescribir** las 2 funciones plpgsql (el rename **no** actualiza su cuerpo → tronarían).
2. Cambiarlas para operar sobre `nivel` ('MT'/'BT') en vez del smallint invertido.
3. ⛔ **Cambio de comportamiento:** hoy `status=false` **devuelve siempre** los KVA al parque. Con
   la nueva regla, `figura='VENTA'` **no devuelve** al liberar: solo regresa al pool cuando existe
   una `kvaDevoluciones` válida. `figura='RENTA'` sigue devolviendo automáticamente.
4. `trg_auditoria` en las 2 tablas nuevas (patrón del proyecto).
5. RLS solo-autenticados en las tablas nuevas, como el resto del esquema.

## 7. Backend (endpoints y permisos)

Claves nuevas en `segModulos` (verificado: 720/721/722 están libres):

| Clave | Habilita |
|---|---|
| **720** | Ver la administración de KVA's |
| **721** | Asignar / editar / cancelar asignaciones de KVA |
| **722** | Registrar la devolución de KVA (subir el documento) |

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/parques/kvas/resumen` | 720 |
| GET | `/parques/kvas/parque/:idParque` | 720 |
| GET | `/parques/kvas/nave/:idNave` | 720 |
| POST | `/parques/kvas` | 721 |
| PATCH | `/parques/kvas/:idKvas` | 721 |
| DELETE | `/parques/kvas/:idKvas` (baja lógica + motivo) | 721 |
| POST | `/parques/kvas/:idKvas/devolucion` (multipart) | 722 |
| GET | `/parques/acometidas` · POST · PATCH | 720 / 721 |

Todo con validación **Zod** por endpoint, actor del **JWT** (nunca del body), consultas
parametrizadas y `fallaBd` para los errores (regla §1 4b del HANDOFF).

### 7.1 El candado de liberación

Guarda nueva en **ambos** flujos existentes:

- `PlanesArreService.liberarNave` — `apps/api/src/modules/arrendatarios/planes-arre.service.ts:316`
- `PlanesService.desvincularNave` — módulo `ventas`

Regla: **409** si la nave tiene KVA con `figura='VENTA'` y `status=true` sin devolución acreditada,
con mensaje de negocio ("Faltan N KVA de media tensión por acreditar su devolución al parque").
Los de `figura='RENTA'` no bloquean.

## 8. Frontend

1. **`/parques/kvas`** — pantalla nueva (menú dentro de Parques):
   - Tarjetas por acometida: contratado / asignado / disponible, en MT y BT.
   - Tabla de parques de esa acometida con su reparto.
2. **Detalle del parque** — tabla nave × (MT/BT) × figura × etapa, con filtros y totales. Es el
   equivalente vivo de la hoja de Excel.
3. **Modal de asignación** — nave, nivel, figura, cantidad, etapa, contrato CFE, vínculo.
4. **Modal de devolución** — cantidad, fecha, documento + archivo. Solo para `VENTA`.
5. **Pestaña KVA en el editor de nave** (hoy dice "no desarrollado", gotcha #5 de `parques.md`).

Reutilizar `components/Badge.tsx` y `components/Paginacion.tsx` (ya existen; DRY).

## 9. Orden de ejecución

| # | Fase | Qué incluye | Riesgo | Modelo |
|---|---|---|---|---|
| 1 | **Migración de esquema** | Rename + numeric + `kvaAcometidas` + rediseño de `kvasAsignados` + `kvaDevoluciones` + reescritura de los 2 triggers + RLS + auditoría | 🔴 **ALTO** — prod, triggers, columnas generadas | Toribio |
| 2 | Tipos + backend | `@erp/types` regenerado, servicio, endpoints, Zod, permisos 720/721/722 | 🟠 medio | Nicanor |
| 3 | Candado de liberación | Guarda en `liberarNave` + `desvincularNave` | 🟠 medio | Nicanor |
| 4 | Frontend | Las 5 pantallas de §8 | 🟢 bajo | Nicanor |
| 5 | Carga inicial | Capacidades del Excel + asignaciones nave por nave | 🔴 **ALTO** — datos de prod | Jereff decide |
| 6 | Cierre | KB (`modulos/parques.md` + módulo nuevo), changelog, versión | 🟢 bajo | Toribio |

⛔ **Fase 1 no se ejecuta sin gate adversarial** (toca esquema y triggers de producción), y la
Fase 5 requiere resolver antes las preguntas 7 y 8 de §5 (reparto Spartek y mapeo de naves).

### Orden seguro de la migración de la Fase 1

1. `DROP` de las 2 columnas generadas (dependen de las que se renombran).
2. `ALTER TABLE parques RENAME COLUMN` (×4) + `ALTER TYPE ... numeric(12,2)`.
3. Recrear las 2 columnas generadas con los nombres nuevos.
4. `CREATE OR REPLACE` de las **2 funciones** de trigger (su cuerpo NO se renombra solo).
5. Tablas nuevas + RLS + `trg_auditoria`.
6. Migrar las 3 filas de `kvasAsignados` (`tipoTension`→`nivel`, `tipoContrato`→`figura`) y
   eliminar las columnas viejas.
7. Regenerar `@erp/types` y corregir `planes.service.ts:152-170` (el bug de §2).

## 10. Riesgos

| Riesgo | Mitigación |
|---|---|
| El rename deja código leyendo el campo equivocado en silencio | Nombres `Mt`/`Bt` que no reusan "Media"; typecheck detecta todo lo que quede |
| Los triggers truenan tras el rename | Se reescriben en la **misma** migración |
| Truncamiento de decimales | `numeric(12,2)` antes de cargar cualquier dato |
| Cambiar el trigger de devolución rompe el saldo de "Prueba Parque" | Solo hay 3 filas de prueba; se verifica el saldo antes y después |
| Mapeo de naves del Excel mal hecho | La Fase 5 se hace nave por nave, con validación de Jereff, después de las demás |

## 11. Lo que este documento NO decide

- Los montos de renta/venta de KVA (pregunta 5 de §5).
- Si la devolución requiere aprobación de un rol o basta adjuntar (pregunta 3).
- Áreas comunes, disponibilidad futura, obras de CFE y lista de espera (fuera del MVP por
  decisión #3 y #5 de §4).
