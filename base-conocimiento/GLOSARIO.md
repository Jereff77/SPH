---
documento: Glosario transversal
estado: vivo
ultima_actualizacion: 2026-06-04
palabras_clave: [inversionista, arrendatario, propietario, propiedad, nave, parque, PDP, KVA, INPC, situacion, status, esTicket, auditoria, ver como]
---

# Glosario — entidades y términos transversales

> Para el agente: aquí están los conceptos que **cruzan varios módulos**. Si un término aparece en la
> consulta y está aquí, esta es la definición canónica. Los documentos de módulo enlazan a este
> glosario para no repetir (ni contradecir) estas definiciones.

## Entidades de negocio

- **Inversionista** (`inversionista`, PK `idInversionista`): persona/empresa que es **dueña** de una
  propiedad (nave). Su nombre comercial es `razonsocial`. ⚠️ **También funge como arrendatario**: ver
  "Arrendatario".
- **Arrendatario** (a veces "arrendador" en la UI vieja, "inquilino" para el usuario): quien **renta**
  una nave. ⚠️ **Clave:** `idArrendador = idInversionista`. Es decir, el arrendatario es un registro de
  la tabla `inversionista`; el vínculo nave↔arrendatario vive en `arrenPropiedades.idArrendador`, y su
  nombre se obtiene de `inversionista.razonsocial`. (El término correcto de negocio es **arrendatario**;
  en pantallas viejas aparecía "Arrendador" por error.)
- **Propietario:** rol/uso del inversionista cuando es dueño de una propiedad. El módulo "Propietarios"
  gestiona la asignación inversionista → nave (que vuelve la nave `Vendida`).
- **Propiedad** (`propiedades`, PK `idPropiedad`): vínculo entre una **nave** y su **inversionista**
  dueño. Una nave vendida tiene una propiedad.
- **Parque** y **Nave:** ver `modulos/parques.md`. Una nave es la unidad rentable/vendible dentro de un
  parque. Su etiqueta visible (`numNaveNAME`) es personalizable (p. ej. "GYM", "Coworking").

## Conceptos financieros / operativos

- **PDP (Plan de Pagos):** calendario de pagos. Hay PDP de compra (inversionista) y de **renta**
  (`arrePdp`, para arrendamientos). Campos como `tienePdp`, `pdpActivo` indican si una propiedad/nave
  ya tiene plan y si está activo.
- **KVA:** unidad de capacidad eléctrica de un parque, en dos niveles: **Alta** y **Media**. En
  `parques`: `kvasAlta/Media` (total), `*Disponibles` (libre) y `*Utilizados` (**columna generada** =
  total − disponibles). Las KVA's **por nave** aún no se desarrollan.
- **INPC:** Índice Nacional de Precios al Consumidor (tabla `inpc`). Se usa para actualizar rentas y
  como indicador en el landing. Lo gestiona Configuraciones → Parámetros.
- **Tipo de cambio (USD/MXN):** indicador del landing; se obtiene de **Banxico** (serie SF43718, FIX)
  a través del backend (el token nunca se expone al frontend).

## Campos y banderas comunes

- **`situacion`** (en `naves`): estado comercial de una nave. Valores: `Disponible`, `Apartado`,
  `Bloqueado`, `Vendida`. ⚠️ `Vendida` solo se asigna desde **Propietarios**, no desde el editor de naves.
- **`status`** (booleano, muchas tablas): registro activo (true) / inactivo (false). El filtrado típico
  excluye inactivos.
- **`esTicket`** (booleano): marca registros que son contenedores de tickets, no datos reales de negocio
  (se filtran).
- **`fc`, `fum`, `fumUser`, `idUser`:** metadatos de auditoría básica (fecha de creación, última
  modificación y usuario). La auditoría detallada (antes/después) vive en la tabla `auditoria`.

## Seguridad, identidad y soporte

- **Permisos / claves (`segModulos`, `segModulosUsuarios`):** cada acción/pantalla tiene una **clave**
  numérica. El acceso se valida **en el servidor** (backend), no solo en la UI. Ejemplos Parques: 700
  (módulo), 701 (agregar parque), 702 (agregar nave), 710 (disponibilidad).
- **Usuario de soporte (`isSupport`):** super-administrador; el backend le concede acceso total y puede
  usar **"Ver como"**.
- **"Ver como":** función de soporte para **observar la app como otro usuario** (solo lectura; no puede
  ejecutar acciones). Se activa con long-press en el logo del sidebar. No cambia la sesión real.
- **Auditoría / bitácora (`auditoria`):** registra cada cambio (crear/editar/eliminar) con su **diff
  antes/después** y **quién** lo hizo, tanto de v1 como de v2. La tabla vieja `actividad` (v1) se
  conserva; su histórico se copió a `auditoria` como registros `LEGACY`.

## Convenciones de la app nueva (v2)

- El **frontend nunca habla con la base de datos**; todo pasa por el backend (única vía a Supabase).
- Las **tablas** de la UI tienen encabezado fijo azul, filtros y orden por columnas (convención de diseño).
- Coexistencia: la app nueva (v2) y la vieja (v1, FlutterFlow) **conviven**; no se modifica nada de la
  base de datos sin autorización.
