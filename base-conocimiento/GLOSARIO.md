---
documento: Glosario transversal
estado: vivo
ultima_actualizacion: 2026-06-10
palabras_clave: [inversionista, arrendatario, propietario, propiedad, nave, parque, PDP, KVA, INPC, situacion, status, esTicket, auditoria, ver como, saldo vencido, días de atraso, cartera vencida, tipo de pago, escrituración, Montse AI, asistente]
---

# Glosario — entidades y términos transversales

> Para el agente: aquí están los conceptos que **cruzan varios módulos**. Si un término aparece en la
> consulta y está aquí, esta es la definición canónica. Los documentos de módulo enlazan a este
> glosario para no repetir (ni contradecir) estas definiciones.

## Interfaz transversal

- **Filtros de tabla (multi-selección)** — En todas las pantallas con tabla, los **encabezados de
  columna** tienen un **embudo** (▼) que abre un filtro con **buscador + casillas**: se pueden elegir
  **una o varias** opciones (p. ej. varios estatus, proveedores, parques). Sin nada marcado = se ven
  todas las filas; entre columnas distintas el filtro es "Y", dentro de una columna es "O". Los
  **totales del pie se recalculan** según lo filtrado. Es **regla de diseño 7c** (ver `HANDOFF.md` §1);
  el componente compartido es `apps/web/src/components/tabla/FiltroColumnaOpciones.tsx` (y
  `MultiSearchSelect.tsx` para selectores de formulario con varias opciones, p. ej. el **Mes** de
  Gestión de Cobranza, que admite varios meses o todo el año). Los **selectores que cargan datos del
  servidor** (Año, Inversionista, Periodo) NO son filtros de tabla y siguen siendo de una sola opción
  (salvo donde se habilitó multi explícitamente, como el Mes de Cobranza).

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
  como indicador en el landing. Lo gestiona Configuraciones → Parámetros. En la **corrida de renta** el
  INPC se captura por partida/concepto (`arrePdpDetalle.INPC` + `ptsINPC`) y al editarlo manualmente el
  `pm2` del año se recalcula `pm2[N] = pm2[N−1] × (1 + (INPC+ptsINPC)/100)`. Si "actualizar el INPC manual
  no funciona", ver el gotcha del **desfase del `anio` por concepto** en `modulos/arrendatarios.md`.
- **Tipo de cambio (USD/MXN):** indicador del landing; se obtiene de **Banxico** (serie SF43718, FIX)
  a través del backend (el token nunca se expone al frontend).
- **Tipo de pago** (`pdpDetalle.tipoPago`): clasifica cada parcialidad de un plan de pagos de venta.
  Valores: **Anticipo**, **Parcialidad**, **Escrituración** (en BD `Escrituracion`). Editable desde Ventas →
  Planes (doble clic). La pantalla **Escrituras** (Ventas) lista solo las de tipo `Escrituracion`.
- **Saldo vencido / Cartera vencida:** monto de una parcialidad **ya vencida** (su `fecha` < hoy) que **no
  ha sido cubierta** por pagos (`monto − Σ pagos > 0`). Los **días de atraso** se cuentan desde la fecha de
  vencimiento de la parcialidad más antigua sin cubrir. Se usa en Ventas → **Dashboard** (naves con atrasos)
  y → **Reportes → Vencidos**.

## Campos y banderas comunes

- **`situacion`** (en `naves`): estado comercial de una nave. Valores: `Disponible`, `Apartado`,
  `Bloqueado`, `Vendida`. ⚠️ `Vendida` solo se asigna desde **Propietarios**, no desde el editor de naves.
- **`status`** (booleano, muchas tablas): registro activo (true) / inactivo (false). El filtrado típico
  excluye inactivos.
- **`esTicket`** (booleano): marca registros que son contenedores de tickets, no datos reales de negocio
  (se filtran).
- **`fc`, `fum`, `fumUser`, `idUser`:** metadatos de auditoría básica (fecha de creación, última
  modificación y usuario). La auditoría detallada (antes/después) vive en la tabla `auditoria`.
- **`anio` (en `arrePdpDetalle`, corrida de renta):** año del contrato de cada partida (0 = depósito,
  1 = primer año, 2 = segundo…). ⚠️ **Gotcha:** los crons diarios `actualizar_anios_planes_nuevos()` /
  `actualizar_ciclo_plan_pago()` lo recalculan **por días/365.25** desde el inicio del plan; como cada
  concepto tiene la `fecha` con un día distinto (Renta día 1, Admin/Mtto/Vig día 2), en el **mes de
  aniversario** un concepto puede quedar con `anio` **una unidad por debajo** del resto de su partida. Eso
  rompe la **actualización manual del INPC** (la RPC filtra `WHERE anio >= …` y solo recalcula si `anio ≥
  2`). Diagnóstico y corrección detallados en `modulos/arrendatarios.md` → "Gotcha crítico — desfase del
  `anio` por concepto".
- **`cantidad` / `inpcTotal` (en `arrePdpDetalle`):** **columnas GENERADAS** (`cantidad = pm2 × constM2`,
  `inpcTotal = INPC + ptsINPC`). No se escriben directamente: cambian solas al cambiar `pm2`/`constM2` o
  `INPC`/`ptsINPC`. Por eso editar el INPC no mueve el monto salvo que se recalcule el `pm2`.

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

## Asistente IA

- **Montse AI:** asistente conversacional (chat) sobre los datos del ERP, dentro de **Ventas → Reportes**
  (pestaña). Responde en lenguaje natural consultando la BD (genera SQL de solo lectura) y puede adjuntar
  **gráficos** (bar/pie/line) y tablas. En v2 el frontend NO habla con Supabase: el backend hace de **proxy**
  de la **edge function `ia-chat`** (que usa OpenRouter con su secret), reenviando el JWT del usuario.
  Sesiones en `iaSesiones`, mensajes en `iaConversaciones`, cuota de uso por RPC `ia_tokens_disponibles`.

## Convenciones de la app nueva (v2)

- El **frontend nunca habla con la base de datos**; todo pasa por el backend (única vía a Supabase).
- Las **tablas** de la UI tienen encabezado fijo azul, filtros y orden por columnas (convención de diseño).
- Coexistencia: la app nueva (v2) y la vieja (v1, FlutterFlow) **conviven**; no se modifica nada de la
  base de datos sin autorización.
