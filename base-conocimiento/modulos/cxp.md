---
modulo: CxP (Cuentas por Pagar)
estado: parcial              # Proveedores, Bancos, Solicitudes (alta+listado), Pendientes y Pagar en v2; resto por fases
version_doc: 0.8
ultima_actualizacion: 2026-06-17
submodulos: [Proveedores, Bancos, Solicitudes, "Pagar solicitudes", Aprobación, Pago/Conciliación, Reportes, "Claves SAT"]
rutas: [/cxp/proveedores, /cxp/bancos, /cxp/solicitudes, /cxp/pendientes, /cxp/pagar]
claves_permiso: [400, 401, 402, 410, 420, 430, 431, 440, 441, 450, 460, 470]
tablas: [cxp, catProveedores, catBancos, catClavesProdServ, cxpComentarios, cxp_fechas_habilitadas, movbancarios, PresCategorias, v_resumenPresupuesto, SPHConfiguraciones]
palabras_clave: [pago, cuenta por pagar, CxP, factura, CFDI, autorizar, aprobar, solicitud de pago, pagar solicitudes, aplicar pago, comprobante, lectura de comprobante, documentos privados, URL firmada, proveedor, banco, bancos, transferencia, SPEI, conciliación, movimiento bancario, desaplicar, presupuesto, devolución, urgente, RFC, claves SAT, carga masiva, layout, plantilla, importación, Excel, retención, IVA, ISR, tiempo real, SSE]
relacionado_con: [configuraciones, inversionistas, fideicomiso]
---

# Módulo: CxP (Cuentas por Pagar)

## 1. Identificación

- **Propósito:** gestionar el pago a proveedores: registrar **solicitudes de pago** (con o sin CFDI),
  **autorizarlas**, **pagarlas** y **conciliarlas** contra movimientos bancarios. Es el módulo con más
  actividad histórica del sistema.
- **A quién sirve:** capturistas, gerentes (autorizan), tesorería (pagan/concilian).
- **Sinónimos del usuario:** "pagos", "facturas por pagar", "solicitud de pago", "CxP".

## 2. Flujo de negocio (end-to-end)

```
Captura/Solicitud  →  Autorización  →  Pago/Transferencia  →  Conciliación bancaria  →  Reportes
   (estado 1/2)        (estado 4)        (estado 6/7)            (movbancarios)
```

- **Tabla central `cxp`** con dos campos de máquina de estados:
  - `idEstado` (smallint): estado de la solicitud. **Catálogo real (confirmado en BD):** **1**=Guardado ·
    **2**=Enviado · **3**=Rechazado · **4**=Aprobado · **6**=Pagado (la mayoría) · **7**=Pago T. Bancaria ·
    **99**=Aprobado sin pago aplicado. (No hay tabla catálogo; la columna `estado` text es legacy e
    inconsistente — la fuente de verdad es `idEstado`.)
  - `tipoOperacion` (smallint): **1**=normal (factura con XML), **2**=urgente, **3**, **4**=captura
    manual, **5**=devolución, **6**=sin XML.

## 3. Pantallas, rutas y permisos

| Submódulo | Ruta v2 | Permiso | Estado v2 |
|---|---|---|---|
| Proveedores | `/cxp/proveedores` | **410** | ✅ desarrollado |
| Bancos | `/cxp/bancos` | **470** | ✅ desarrollado |
| Solicitudes de pago | `/cxp/solicitudes` | 420 | ✅ listado (4 etapas) + **alta de los 5 tipos** (Solicitud de Pago CFDI, Urgentes, Línea de Captura, Devoluciones, Sin XML) + editar/enviar/eliminar |
| **Solicitudes de Pago PPD** | `/cxp/ppd` | 420 | ✅ desarrollado (estado de cuenta por factura PPD + dosificación de pagos parciales con control de saldo) |
| **Pagar solicitudes** | `/cxp/pagar` | **400** | ✅ desarrollado (tesorería: listado + registrar pago/conciliación + tiempo real) |
| Claves SAT | `/configuraciones/parametros` (pestaña) | 210 | ✅ desarrollado |
| **Aprobar Solicitudes** | `/cxp/aprobar` | **430** | ✅ desarrollado (bandeja del aprobador: regresar/rechazar/aprobar con presupuesto) |
| Solicitudes pendientes | `/cxp/pendientes` | **450** | ✅ desarrollado |
| Dashboard CxP | (pendiente) | 440 / 441 | ⏳ |
| **Reportes** | `/cxp/reportes` | **460** | ✅ desarrollado (Estado de Cuenta: filtros server-side + Excel/PDF) |

Permisos (confirmados en `segModulos`): **400** módulo · **401** desaplicar pagos · **402** aprobados sin
pago aplicado · **410** proveedores · **420** solicitudes de pago · **430** aprobar facturas · **431**
aprobar fuera de presupuesto · **440/441** dashboard · **450** pendientes · **460** reportes · **470**
**Bancos** (NUEVO en v2). Equivalente v1: `lib/pages/web_app/i04_cx_p/`.

## 4. Submódulo: Proveedores  ✅ (desarrollado en v2)

- **Ruta:** `/cxp/proveedores` · **Permiso:** 410.
- **Tabla `catProveedores`** (PK `idProveedor` text): `razonSocial` (obl.), `rfc` (obl., 12-13),
  `nombre`, `apellidos`, `email`, `telefono`, `nombreBanco` (obl.), `tipoCuenta` (obl.), `noCuenta`,
  `personalidad` (Fisica/Moral), `claveRegimen`, `tipoIdentificacion`, `numIdentificacion`, `status`.
- **Acciones:** listar (tabla con encabezado fijo + filtros + orden), crear, editar, activar/desactivar
  (toggle). El `idProveedor` se genera en el servidor. Escrituras auditadas (con el usuario real).
- **Relación:** `cxp.idProveedor → catProveedores.idProveedor`. El nombre se **desnormaliza** en
  `cxp.nombreProveedor` (no se sincroniza solo; ver gotcha).

## 4b. Submódulo: Bancos  ✅ (NUEVO en v2)

- **Ruta:** `/cxp/bancos` · **Permiso:** **470** (`Cuentas por Pagar → Bancos`, creado en v2 siguiendo el
  patrón de decenas: 400/410/420/430/440/450/460 → **470**).
- **Tabla `catBancos`** (PK `id` autoincremental): `nombre` (obl.), `codigo` (obl.), `tipo` (opcional),
  `created_at`.
- **Acciones:** listar (tabla con encabezado fijo + filtros + orden), agregar, editar. Antes los bancos
  se daban de alta **directo en la base de datos**; ahora se gestionan desde la app. Escrituras auditadas.
- **Relación:** el banco se usa como texto (`nombreBanco`) en `catProveedores`; este catálogo permite
  estandarizar/agregar bancos disponibles.

## 4c. Submódulo: Solicitudes de pago  🟠 (listado en v2)

- **Ruta:** `/cxp/solicitudes` · **Permiso:** 420.
- **Muestra SOLO las solicitudes del usuario activo** (`uidr = uid`), filtradas por un único dropdown
  **`rangoSemana`** (texto de la BD, p. ej. "Sem 23 del 01 al 07 de jun 2026"; por defecto la más reciente).
- **4 etapas** (cada solicitud cae en una; condiciones del código v1):
  1. **Devolución o Pagos Urgentes** = `esUrgente = true`.
  2. **Guardados o Rechazados** = `idEstado ∈ {1,3}` (no urgentes).
  3. **Enviados o Aprobados** = `idEstado ∈ {2,4}`.
  4. **Reprogramados o Pagados** = `idEstado ∈ {5,6}`.
  (Los estados 7 y 99 no se listan en esta pantalla, igual que en v1.)
- **Columnas:** Editar (3 acciones), Documentos (PDF=`urlCFDI`, XML=`urlXLM`), Estatus, Folio, Proveedor
  (`nombreProveedor`), **Nombre en CFDI** (`nomCFDI`), Fecha CFDI (`fecCFDI`), Concepto.
- **Acciones (solo en estado Guardado, `idEstado=1`):**
  - **Eliminar** (`DELETE /cxp/solicitudes/:id`): borra archivos CFDI/XML del bucket, los comentarios y el
    registro. Es delete físico (igual que v1), pero queda auditado (antes/después).
  - **Enviar** (`POST /cxp/solicitudes/:id/enviar`): pasa a `idEstado=2` (Enviado) + inserta comentario
    "Se envió la solicitud a aprobación".
  - **Editar** (`PATCH /cxp/solicitudes/:id`): edita proveedor/cuenta/concepto/folio/montos/fecCFDI (NO
    re-sube CFDI). Habilitado si `idEstado=1` y `tipoOperacion<4`. Catálogos: `GET /cxp/solicitudes/catalogos`.
  - Validación server-side: la solicitud debe ser del usuario (`uidr`) y estar en estado Guardado.
- ⚠️ **Gotcha de fechas:** `numSem` se calcula de `fecSolicitud`, pero `numAnio`/`numMes` de `fc`
  (creación). El `rangoSemana` (texto) es la forma fiable de filtrar por semana.

## 4d. Submódulo: Solicitudes pendientes  ✅ (dashboard de gestión)

- **Ruta:** `/cxp/pendientes` · **Permiso:** **450** (en v1 la pantalla usaba 430 por inconsistencia; en
  v2 se usa la clave dedicada 450). Muestra **TODAS** las solicitudes (no solo las del usuario).
- **Filtros:** Año, Mes, Estado, Semana, Responsable (uidGerente) + **buscador de texto** (Nombre CFDI,
  Solicitado por, Cuenta, Clasificación; sin acentos/mayúsculas; el total y el conteo se ajustan a lo
  encontrado). La tabla es **ordenable por columna** (clic en el encabezado, `useSort`/`SortableTh`).
- **Columnas:** Acciones (Devolver ↩, PDF, XML) · Estado · Fecha sol. · Semana · Folio · Nombre CFDI ·
  Fecha CFDI · Concepto · **Monto** · Cuenta · Sección · Solicitado por (`uidr`→nombre) · **Responsable**
  (dropdown editable). Total al pie (suma `total`, o `montoAplicado` si el filtro es Pagada).
- **Acciones por registro:**
  - **Cambiar responsable/aprobador** (solo ese registro): dropdown inline con los usuarios activos; hace
    `PATCH /cxp/pendientes/:id/responsable` → `UPDATE cxp SET uidGerente, nomGerente` (v2 actualiza el nombre
    desnormalizado; v1 solo el uid). La lista de aprobadores = `catUsers` activos (sin filtro de rol).
  - **Devolver** (`PATCH /cxp/pendientes/:id/devolver`): regresa a Guardado (`idEstado=1`); solo desde
    estados 2–4. (En v1 además insertaba en `actividad`; en v2 lo registran los triggers de auditoría.)
- Endpoints auxiliares: `GET /cxp/pendientes/anios`, `GET /cxp/pendientes/responsables`.

> Nota: la pantalla **Solicitudes de pago** muestra columnas extra (Categoría/Clasificación = cuenta/
> sección de `PresCategorias`, Justificación = primer comentario de `cxpComentarios`, Asignado a =
> responsable). Categoría y Clasificación se muestran juntas separadas por "/".

## 5. Modelo de datos (tabla central `cxp`)

PK `idCxp` (text). Campos clave: `idProveedor`, `idCategoria` (→ `PresCategorias`), `concepto`,
`subtotal`/`total` (montos), `montoAplicado`, `idEstado`, `tipoOperacion`, `esUrgente`, `pagoInmediato`,
`autorizadoFP` (fuera de presupuesto), `autorizo`/`fecAutorizacion`, `pagador`/`fecPago`, `uidGerente`,
`idMovBancarios` (conciliación), `urlXLM`/`urlCFDI`/`nomCFDI` (archivos), `folio`, `fecCFDI`,
`lineaCaptura`/`referencia`/`fechaLimite`, `moneda`. **`numSem`/`numMes`/`numAnio` son GENERADAS**
(de la fecha). Tablas relacionadas: `cxpComentarios` (historial), `cxp_fechas_habilitadas` (fechas
válidas para CFDI/autorizar), `movbancarios` (conciliación), `PresCategorias`/`v_resumenPresupuesto`
(presupuesto).

## 6. RPCs de negocio (se reutilizan en v2)

`cxp_puede_insertar()`, `cxp_puede_autorizar()`, `cxp_autorizar_solicitud_pago(idCxp, comentario, uid)`,
`cxp_aprobados_sin_pago_aplicado(mes, anio)`, validaciones `cxp_validar_*`. ⚠️ La RPC genérica
`consulta_segura_parametrizada` (insegura) que usa v1 **NO** se reutiliza; en v2 las consultas se hacen
parametrizadas desde el backend.

## 7. ⚠️ Detalles no obvios (gotchas)

1. `cxp.nombreProveedor` / `nomGerente` / `ultimoComentario` están **desnormalizados**: cambiar el
   proveedor NO actualiza solicitudes viejas.
2. `numSem/numMes/numAnio` son **columnas generadas** (de la fecha): no se escriben.
3. `tipoOperacion >= 4` (captura/devolución/sin XML) y `idEstado > 1` suelen volver la solicitud **no
   editable**.
4. La **conciliación** (asignar un `movbancarios` y marcar `aplicado=true`, pasar a estado pagado) mueve
   pagos reales: es la parte más sensible.
5. CFDI se guarda en el bucket `CFDIproveedores`; el **comprobante de pago** en el bucket `cxp`. **Ambos
   buckets son PRIVADOS (desde v2.28.0).** El backend NO devuelve URLs públicas: genera **URLs firmadas** al
   vuelo (helper `documentos.util.ts`, expiración 2 h) en cada listado/modal. Las URLs públicas históricas
   guardadas en `urlCFDI`/`urlXLM`/`imgComp` se normalizan al firmar (sin migrar datos). El acceso público
   directo a estos buckets está bloqueado (HTTP 400).
6. **`idCategoria = '-'` (sin categoría real):** un trigger fuerza la solicitud a **Guardado** al crearla
   o al intentar **enviarla** (no se puede enviar a aprobación sin categoría válida). El backend además
   bloquea el envío con mensaje claro. Los ya **Pagados** no se tocan.
7. **Al enviar**, el CFDI debe ser **del mes en curso** (misma regla que el alta): no se puede enviar a
   aprobación una factura de un mes anterior. ⚠️ Esta regla la imponía el trigger
   `cxp_validar_fecha_cfdi_estado`, **hoy DESACTIVADO** por el bug del punto 9.
8. **Movimientos para pagar:** solo `tipo='Transferencia SPEI'` sin aplicar, filtrados por proveedor
   (nombre **o** importe = total). Los **depósitos** no aparecen (son entradas).
9. **🔴 Trigger `trigger_cxp_validar_fecha_cfdi` DESACTIVADO (incidente 2026-06-09).** La función
   `cxp_validar_fecha_cfdi_estado` (BEFORE INSERT OR UPDATE) ponía `idEstado=3` (Rechazado) cuando el
   CFDI era de un mes anterior a `fc`, **en cualquier UPDATE** — corrompiendo incluso facturas
   **pagadas/aprobadas** y re-rechazando al intentar "Devolver a Guardado". Se **desactivó** (reversible,
   no eliminado) y se corrigieron los registros afectados. **Corrección pendiente** (validar solo en
   INSERT y en UPDATE con `OLD.idEstado IN (1,2)`; PPD⇒`diferido` automático) en
   `base-conocimiento/PLAN-correccion-trigger-cxp-fecha-cfdi.md`, **bloqueada hasta definir el manejo de
   PPD**. Mientras esté off, las PUE de meses anteriores **no** se auto-rechazan.

## 8. 🩺 Diagnóstico / problemas comunes

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| "No veo Proveedores / CxP." | Falta permiso 400/410. | Revisar permisos. |
| "No puedo crear/editar un proveedor." | Falta permiso 410 o RFC/banco incompletos. | Verificar permiso y campos obligatorios. |
| "No me deja autorizar." | `cxp_puede_autorizar()` = false o no es el gerente. | Revisar quién autoriza esa solicitud. |
| "No puedo cargar CFDI hoy." | La fecha no está habilitada (`cxp_fechas_habilitadas`). | Habilitar la fecha en Parámetros → Fechas CxP. |
| "No me deja enviar la solicitud." | `idCategoria='-'` (sin categoría) o el CFDI no es del mes en curso. | Asignar categoría válida / la factura debe ser del mes actual. |
| "Al analizar el CFDI me rechaza." | RFC receptor no autorizado, no es PUE, mes distinto, folio duplicado, proveedor no registrado, o clave SAT sin registrar. | Seguir el mensaje; registrar proveedor/clave SAT si aplica. |
| "Al pagar no aparece el movimiento del proveedor." | No hay SPEI sin aplicar que coincida (nombre truncado **y** importe ≠ total), o es otro tipo. | Verificar el comprobante; usar la opción de capturar comprobante (PDF). |
| "No me deja registrar el pago." | El importe del comprobante no coincide con el total de la solicitud. | Verificar el comprobante / monto. |
| "Un pago quedó mal conciliado." | Asignación incorrecta de `movbancarios`. | Desaplicar (permiso 401) y reasignar. |
| "Error interno del servidor al aplicar pago por captura/comprobante." | **Resuelto en v2.22.1.** El INSERT a `movbancarios` enviaba columnas GENERADAS (`numAnio`/`numMes`). | Actualizar a v2.22.1+ (el backend ya no las envía). Si reaparece, revisar que ningún INSERT a `movbancarios` incluya columnas generadas. |

**Cuándo escalar a ticket:** desaplicar/corregir pagos, inconsistencias de conciliación, solicitudes
atoradas en un estado, o cargas de CFDI bloqueadas por fechas.

## 9. Estado y pendientes

- ✅ **Proveedores** (catálogo CRUD + status).
- ✅ **Bancos** (catálogo).
- ✅ **Claves SAT** (catálogo de retenciones, en Parámetros).
- ✅ **Solicitudes de pago**: listado en 4 etapas + **alta de Solicitud de Pago (CFDI)** con parser
  propio y validaciones fiscales + editar/enviar/eliminar (solo Guardado).
- ✅ **Solicitudes pendientes** (gestión: responsable + devolver).
- ✅ **Aprobar Solicitudes** (430, bandeja del aprobador): regresar/rechazar/aprobar con validación de
  presupuesto + reasignar fuera de presupuesto + marca `autorizadoFP` + tiempo real (SSE).
- ✅ **Pagar solicitudes** (tesorería): listado con filtros estilo Excel + **tiempo real (SSE)** +
  **registrar pago en 3 vías** (asignar `movbancarios` del proveedor · comprobante PDF leído por el backend
  —parser local + fallback IA— · captura de pantalla con banco Banbajío/Actinver) + desaplicar (401) +
  batch aprobados sin pago (402). Validación de monto = total.
- ✅ **Tipos de solicitud especiales**: Urgentes, Línea de Captura, Devoluciones y Facturas sin XML
  (ver sección "Tipos de solicitud especiales" más abajo).
- ⏳ **Dashboard** (440/441), **Reportes** (460), conciliación avanzada (automática/parciales/importación
  de estado de cuenta).
- Decisiones acordadas: reutilizar RPCs de negocio seguras; **tanto el CFDI como el comprobante de pago se
  leen en el backend (sin N8N)** — el comprobante con parser determinista local + fallback de IA (edge
  `comprobante-extraer`); las escrituras quedan auditadas con el usuario real.

---

## Alta de Solicitud de Pago (CFDI con XML) — v2

> Reescritura del flujo de FlutterFlow (`linea_fac_proveedor`). En v1 la lectura
> del XML la hacía un webhook externo de N8N; en **v2 el backend NestJS parsea el
> CFDI 4.0 directamente** (sin dependencias externas) y aplica todas las
> validaciones fiscales server-side.

### Flujo
1. El usuario abre **Solicitudes de pago → "Nueva solicitud"** → menú lateral con
   los tipos (Solicitud de Pago / Urgentes / Línea de Captura / Devoluciones /
   Facturas sin XML). **Solo "Solicitud de Pago" está operativa**; el resto es fase futura.
2. Sube **PDF + XML** de la factura → "Analizar".
3. El backend (`POST /cxp/solicitudes/analizar`) lee el XML, valida y devuelve los
   datos + el proveedor detectado. No persiste nada.
4. El usuario captura **Categoría/Clasificación** (de `PresCategorias`) y una
   **justificación** (20–100 caracteres).
5. "Crear solicitud" (`POST /cxp/solicitudes`, multipart) re-valida (no confía en el
   cliente), sube los archivos al bucket `CFDIproveedores` e inserta en `cxp`
   (`idEstado=1`, `tipoOperacion=1`) + comentario inicial en `cxpComentarios`.

### Validaciones (en orden; cualquiera bloquea con mensaje claro)
1. XML es un CFDI parseable.
2. `TipoDeComprobante = I` (Ingreso).
3. **RFC del receptor** ∈ `SPHConfiguraciones.RFC_RECEPTORES_AUTORIZADOS`
   (la empresa; admite varios separados por coma; hoy `GSP17122021A`).
4. **MetodoPago = PUE** (PPD se rechaza).
5. **Fecha del CFDI del mes en curso**.
6. **UUID (folio fiscal) no duplicado** en `cxp.folio`.
7. **`cxp_puede_insertar()`** (periodo de captura abierto).
8. **Emisor (RFC) registrado** en `catProveedores` (si no → bloquea pidiendo registrarlo).
9. **Deducciones según régimen** (612, 626, 606): cada `ClaveProdServ` del XML debe
   existir en el catálogo `catClavesProdServ`; si falta → bloquea pidiendo registrarla.
   Estrategia "presencia + tasa esperada": Ret. IVA 10.6667%, Ret. ISR 612→10% ·
   626→1.25% · 606→10% (IVA trasladado 16%). Otros regímenes (ej. 601) no validan retención.
10. **Correspondencia XML↔PDF**: el UUID del XML debe aparecer en el texto del PDF
    (extraído con `pdf-parse`).

### Objetos de BD nuevos (aditivos, autorizados)
- **`catClavesProdServ`**: `idClave` (uuid PK), `claveProdServ` (único), `descripcion`,
  `retieneIVA`, `retieneISR`, `status`, `fc`, `uidr`. RLS habilitado (solo service_role)
  + trigger `trg_auditoria` (regla de oro). Se administra en **Configuraciones →
  Parámetros → pestaña "Claves SAT"** (permiso 210).
- **`SPHConfiguraciones.RFC_RECEPTORES_AUTORIZADOS`** = `GSP17122021A`.

#### Carga masiva de Claves SAT (layout Excel + importación) — v2.30.0
Para poblar el catálogo en lote (en lugar de una por una) la pestaña **Claves SAT** tiene dos botones:
- **Descargar layout**: genera `Layout_ClavesSAT_<fecha>.xlsx` (hoja "Claves SAT" con columnas
  `Clave SAT | Descripción | Retiene IVA | Retiene ISR` + listas Sí/No + hoja de instrucciones). Se crea
  en el front con `exceljs` (lazy), sin pasar por el backend.
- **Importar**: el front lee el Excel (`leerLayout`), valida/limpia, **deduplica por clave** (gana la
  última) y envía las filas al backend **en lotes de 500** (chunking, para no rebasar el límite del body).
  El endpoint `POST /cxp/claves-sat/importar` (permiso **215**) re-valida cada fila con Zod y hace
  **upsert por `claveProdServ`** con `comoActor` (auditado): las nuevas se crean, las existentes se
  **actualizan** (descripción + retenciones) y quedan **activas** (`status=true`). Devuelve `{recibidas,
  creadas, actualizadas, duplicadasEnArchivo}`; el front acumula y muestra el resumen (más las filas con
  problema detectadas al leer el Excel). Acepta `Sí/No`, `TRUE/FALSE`, `1/0`, `X`.
- ⚠️ **Gotcha clave × régimen:** `catClavesProdServ` marca la retención **por clave** (global), pero la
  retención real depende de **clave × régimen del emisor** (p. ej. la clave `90101500` la usan un **612**
  sin retención y un **626/RESICO** con 1.25% ISR). Para claves compartidas, el modelo actual puede dar
  un falso positivo en RESICO al validar. (Pendiente de diseño si se quiere afinar.)

### Archivos
- Backend: `cfdi.ts` (parser + `validarDeducciones`), `claves-sat.{schemas,service,controller}.ts`
  (incluye `importar` + `importarClavesSatSchema`),
  `solicitudes.service.ts` (`analizar`/`crear`/`validarCfdi`/`textoDePdf`), `solicitudes.controller.ts`
  (endpoints multipart con `FileFieldsInterceptor`). Dependencias: `fast-xml-parser`, `pdf-parse`.
- Frontend: `NuevaSolicitudPago.tsx` (modal de alta), `MenuTipos` (drawer en `SolicitudesPage.tsx`),
  `ClavesSatTab.tsx` + `clavesSat.api.ts` (catálogo en Parámetros) + `clavesSatLayout.ts` (descargar/leer
  el layout Excel para la carga masiva).

### Pendiente / notas
- La validación XML↔PDF requiere que el PDF tenga texto (un PDF escaneado/imagen se
  rechaza con mensaje específico).
- Tipos de solicitud Urgentes / Línea de Captura / Devoluciones / Facturas sin XML:
  fase futura (el menú ya los lista como "Próx.").
- `cxp` no guarda desglose de impuestos (solo `subtotal`/`total`); las retenciones se
  validan pero no se almacenan desglosadas.

---

## Pagar solicitudes (tesorería) — v2  ✅

> Pantalla principal de pago: **`/cxp/pagar`** · permiso **400**. Reescribe la v1
> `solicitudes_cx_p` (que usaba SQL interpolado inseguro) con consultas tipadas.
> **La aprobación (rechazar/regresar/aprobar) NO va aquí** — la hace otra gente en el
> módulo de Aprobación (clave 430, pendiente). Aquí solo se **paga/concilia**.

### Listado y filtros
- **Por defecto muestra los Aprobados** (`idEstado = 4`) del mes/año actuales.
- Filtros **fuera de la tabla**: solo **Año** y **Mes** (+ botón ✨ "Aprobados sin pago").
- Filtros **estilo Excel en los encabezados** (icono de embudo, popover): **Estado**,
  **Proveedor**, **Categoría**, **Clasificación**. (Para ver pagados se filtra Estado→Pagado.)
- Columnas: Documentos (PDF/XML) · Fecha Sol. · Fecha Autoriz. · Semana · Estado · Folio ·
  **Proveedor** (con el botón de pago al lado) · Fecha CFDI · Monto · M. aplicado · Concepto ·
  Justificación · Categoría · Clasificación · **Solicitó/Autorizó** (`uidr`/`autorizo`→`catUsers`).
  Encabezado azul fijo + orden por columna + fila de **Totales** fija al pie.
- Endpoints: `GET /cxp/pagos` (filtros), `GET /cxp/pagos/filtros` (años/proveedores/categorías).

### Tiempo real (SSE)
- El backend **escucha Supabase Realtime** sobre `cxp` (`RealtimeService`) y reenvía los
  cambios por **SSE** (`GET /cxp/pagos/stream`); el front (`usePagosRealtime`, EventSource)
  refresca la tabla al instante. Captura también cambios hechos desde **v1**.
- El front **no habla con Supabase**: el SSE pasa por el backend. Auth del stream por
  `?token=` en la URL (EventSource no manda cabeceras) + permiso 400 (`SseAuthGuard`).
- La tabla `cxp` ya estaba en la publicación `supabase_realtime`.

### Aplicar pago — TRES opciones (botón 💵 junto al proveedor)
Solo para solicitudes **Aprobadas** (`idEstado=4`, sin pago previo). Abre un modal con:

**A) Asignar movimiento bancario** (`movbancarios` existente)
- Lista **solo los movimientos del proveedor** de esa solicitud, replicando la consulta v1
  (`arrastrar_pago`): `(beneficiario ILIKE '%nombreProveedor%' OR importe = total) AND
  aplicado=false AND tipo='Transferencia SPEI'`. El **OR por importe** cubre cuando el
  beneficiario del comprobante viene **truncado**. (Implementado server-side con 2 consultas
  unidas; excluye depósitos.) Endpoint: `GET /cxp/pagos/:idCxp/movimientos`.
- Al asignar (`POST /cxp/pagos/:idCxp/asignar`): `movbancarios.aplicado=true` + `UPDATE cxp`
  (`montoAplicado`, `idEstado=6`, `pagador`, `fecPago`, `idMovBancarios`) + comentario.

**B) Capturar desde comprobante (PDF, automático)** — lectura **integrada en el backend** (desde v2.28.0; ya **no** usa N8N)
- El usuario sube el PDF; el **backend** lo guarda (bucket `cxp`), **extrae su texto** con `pdf-parse` y lo
  pasa por una **cascada de lectura**:
  1. **Parser determinista local** (`comprobantes.parser.ts`) para los formatos conocidos (hoy **BanBajío**,
     ~80%): instantáneo, sin red, sin costo.
  2. Si el formato no se reconoce → **fallback de IA**: edge `comprobante-extraer` (proxy a OpenRouter,
     `gpt-4o-mini`, custodia `OPENROUTER_API_KEY`); recibe el **texto** (nunca el PDF ni una URL) y devuelve
     los campos.
  3. Si la IA falla → captura manual (todos los campos del modal son editables).
- Mapea los campos (FechadeOperacion, Importe, NombredelOrdenante, CuentaDestino, BancoDestino,
  NombreBeneficiario, ConceptodePago, Referencia, NoAutorizacion, ClaveRastreo) y **prellena el formulario**.
  Endpoint: `POST /cxp/pagos/:idCxp/analizar-comprobante`.
- "Registrar pago" (`POST /cxp/pagos/:idCxp`) crea el `movbancarios` y aplica el pago (usa `urlComprobante`).
- **Añadir un formato nuevo:** agregar `detecta`/`parsea` en `comprobantes.parser.ts` (registro `FORMATOS`).

**C) Captura de pantalla del pago** (manual, sin lectura automática)
- El usuario elige el **banco** (`Banbajío` / `Actinver`), captura el **monto** (= total) y sube una
  **imagen o PDF** del pago (**PDF, JPG, PNG, WEBP, GIF, HEIC**). Botón "Aplicar pago" → mismo
  `POST /cxp/pagos/:idCxp` (con el archivo como `comprobante`, sin webhook): crea el `movbancarios`
  (`bcoDestino` = banco, `manual=true`, `tipo='Transferencias'`) y aplica el pago. Útil cuando solo se
  tiene la captura del SPEI. Los bancos disponibles son una lista fija en el front (`BANCOS_CAPTURA`).

> ⚠️ **Validación de monto (B y C):** el importe del pago **debe coincidir** con el total de la
> solicitud (tolerancia 1 centavo) — bloqueado en el front (aviso + botón inhabilitado) y en el
> backend (`registrarPago`).

> 🐛 **Gotcha resuelto (v2.22.1):** en `movbancarios` las columnas **`numAnio`/`numMes`** (y también
> `idtipo`/`idUnico`) son **GENERADAS** por Postgres (`EXTRACT(year/month FROM "fecOperacion")`). El
> INSERT de `registrarPago` las pasaba explícitamente → Postgres rechazaba con *"cannot insert a
> non-DEFAULT value into column numAnio"* y el front mostraba **"Error interno del servidor"** (500)
> al aplicar pago por **captura (C)** o **comprobante (B)**. Fix: **no** enviar esas columnas en el
> INSERT (Postgres las deriva de `fecOperacion`). Regla general: al insertar en `movbancarios` desde
> v2, **nunca** incluir columnas generadas. La opción **A** no se veía afectada (hace UPDATE, no INSERT).

### Otras acciones
- **Ver pago / desaplicar** (🏦): muestra el `movbancarios` aplicado; **desaplicar**
  (`POST /cxp/pagos/:idCxp/desaplicar`, permiso **401**) revierte a Aprobado (`idEstado=4`,
  limpia `montoAplicado`/`pagador`/`fecPago`/`idMovBancarios`) + comentario.
- **Aprobados sin pago** (✨, permiso **402**): batch `cxp_aprobados_sin_pago_aplicado(mes, anio)`.

### Archivos
- Backend: `pagos.{service,controller,schemas}.ts`, `pagos-stream.controller.ts`,
  `realtime.service.ts`, `sse-auth.guard.ts`, **`comprobantes.parser.ts`** (parser determinista de
  comprobantes) y **`documentos.util.ts`** (firma de documentos al vuelo). Edge **`comprobante-extraer`**
  (fallback IA, en `supabase/functions/`).
- Frontend: `PagarSolicitudesPage.tsx`, `pagos.api.ts`, `AplicarPagoModal.tsx` (3 opciones: banco /
  comprobante (lectura backend) / captura), `TransferenciaModal.tsx`, `usePagosRealtime.ts`;
  `components/tabla/ColumnFilter.tsx` (filtro Excel).

### Pendiente (fase futura)
- Conciliación automática por monto, drag-drop, 1 pago↔N solicitudes, pagos parciales,
  importación del estado de cuenta bancario.
- Lectura de comprobante: sumar los parsers deterministas de los **otros 2 formatos** de banco (hoy caen al
  fallback de IA hasta que se agreguen a `comprobantes.parser.ts`).

---

## Reportes — "Estado de Cuenta" (clave 460) — v2  ✅

Réplica **segura** del reporte HTML embebido de v1 (`/reportescxp`, widget Flutter
`cxp_reportes_widget.dart` → `FlutterFlowWebView`). En v1 el HTML hablaba **directo a Supabase** con la
*publishable key embebida* y filtraba en el navegador trayendo todo (riesgos: key en el bundle, sin JWT,
permiso solo en Flutter, XSS por `innerHTML`, búsqueda "rota" que reusaba el filtro de proveedor). En v2 el
front **nunca toca Supabase**: el backend sirve los datos tras `JwtAuthGuard`+`PermisoGuard` (clave **460**).

### Datos (reusa RPCs EXISTENTES de v1 — autorizado, solo lectura, sin objetos nuevos en BD)
El backend (`reportes.service.ts`) invoca con `service_role` las 3 RPCs de v1:
- `cxp_get_unique_values_v2(tipo_dato)` → combos (1=Proveedores, 2=Categorías, 3=Secciones, 5=Solicitantes,
  6=Autorizadores, 7=Pagadores).
- `cxp_get_filtros_dependientes_v2(p_proveedor,p_categoria,p_seccion)` → cascada (recalcula secciones).
- `cxp_get_estado_cuenta_detalle_v2(...)` → datos. Devuelve por fila: `idCxp, folio, proveedor, estado,
  idEstado, categoria, seccion, concepto, fecSolicitud, fecCFDI, fecPago, subtotal, total, montoAplicado,
  quienSolicito, quienAutorizo, quienPago, esUrgente, tipoProveedor, anio, mes, balance`.

> ⚠️ **Coexistencia:** estas RPCs son de v1 y **no se tocan**. v2 las **lee** con service_role (mismo
> patrón autorizado que Ventas → Reportes con `v_pdpdetalle_get_*`).

### Correcciones vs v1
- **Búsqueda real** por folio/concepto/proveedor (v1 sobreescribía `p_proveedor`).
- **Todo el filtrado server-side**: el rango de fechas (sobre `fecSolicitud`), los estados (multi) y la
  búsqueda se aplican en el backend, no en el navegador. La RPC recibe proveedor/categoría/sección/tipo/
  urgente/quién*; el backend filtra fechas/estados/búsqueda y calcula los totales. Devuelve el dataset YA
  filtrado + `{ totalRegistros, montoTotal, montoAplicado, balance }`.

### UI (idéntica a v1)
Panel de filtros colapsable (rango de fechas con `InputFecha`, proveedor/categoría/sección con
`SearchSelect`, tipo proveedor, **8 estados** en checkboxes [Guardado, Enviado, Rechazado, Aprobado,
Reprogramado, Pagado, Pago T. Bancaria, Aprobado sin pago aplicado], urgente, quién solicitó/autorizó/pagó,
búsqueda). **4 tarjetas** (Total Registros, Monto Total, Monto Aplicado, Balance). **Tabla de 14 columnas**
(Folio, Proveedor, Estado [badge coloreado], Categoría, Sección, Concepto, F. Solicitud, F. CFDI, Subtotal,
Total, Monto Aplicado, Balance, Urgente, Acciones) con encabezado fijo azul (regla 7), orden por columna y
**paginación 20/pág**. **Modal de detalle** con 17 campos. Default del rango de fechas = mes actual.

### Exportar
- **Excel** (`exceljs` lazy): 17 columnas, hoja "CXP", archivo `Reporte_CXP_<aaaa-mm-dd>.xlsx`.
- **PDF** (`jspdf`+`jspdf-autotable`): 7 columnas (Folio, Proveedor, Estado, F. Solicitud, Total, Monto
  Aplicado, Balance), encabezado de tabla `#2c3e50`, resumen al pie, `Reporte_CXP_<aaaa-mm-dd>.pdf`.

### Archivos
- Backend: `cxp/reportes.{service,controller,schemas}.ts` (registrados en `cxp.module.ts`).
- Frontend: `features/cxp/ReportesCxpPage.tsx` (lazy), `reportes.api.ts`, `reportes-export.ts`. Ruta
  `/cxp/reportes` en `router.tsx`; ítem "Reportes" (clave 460) en `menu.tsx`.

---

## Aprobar Solicitudes (bandeja del aprobador) — v2  ✅

> Ruta **`/cxp/aprobar`** · permiso **430**. Reescribe la v1 `solicitudes_aprobar`. Es la bandeja del
> **aprobador/gerente**. La **aprobación la hace gente distinta** de quien paga (módulo "Pagar
> solicitudes", 400). Tiempo real por SSE (`/cxp/aprobar/stream`, reutiliza `RealtimeService`).

### Listado
- **Solo las solicitudes asignadas al aprobador** (`uidGerente = actorUid`), por estado. **Por defecto
  Enviado (idEstado=2).** Filtro de **Estado** en el encabezado (estilo Excel: Enviado/Rechazado/Aprobado)
  + **buscador general** (proveedor, concepto, justificación, cuenta, solicitado por). Endpoint
  `GET /cxp/aprobar?idEstado=`.
- Columnas: Acciones (↩/🗑/✔) · Documentos (PDF/XML) · Estado (badge **"Fuera de presup."** si
  `autorizadoFP`) · Nombre · Folio · Fecha CFDI · Monto · Concepto · Justificación · Cuenta/Clasif. ·
  Solicitado por.

### Acciones (modal con motivo; solo en estado Enviado)
- **Contenido del modal**: datos de la solicitud (proveedor, folio, concepto, cuenta, subtotal y **«Solicita»**
  = quién la pidió), la **justificación que escribió el solicitante** al enviarla (panel destacado; campo
  `justificacion` ← `cxp.ultimoComentario`, vía `aprobacion.service`) y el **panel de presupuesto** de la
  categoría. El campo de texto inferior es el **comentario del aprobador** (obligatorio al Regresar/Rechazar;
  opcional al Aprobar). *(v2.33.1: se añadieron al modal la justificación del solicitante y «Solicita»; el dato
  ya viajaba del backend, solo faltaba mostrarlo.)*
- **Regresar** (`POST /:idCxp/regresar`, motivo obligatorio): `idEstado→1` (al solicitante para corregir).
- **Rechazar** (`POST /:idCxp/rechazar`, motivo obligatorio): `idEstado→3` (la factura debe refacturarse).
- **Aprobar** (`POST /:idCxp/aprobar`): pre-valida `cxp_puede_autorizar()`; llama la RPC
  `cxp_autorizar_solicitud_pago(idCxp, comentario, p_autorizo = actorUid)`. La RPC valida presupuesto
  (categoría activa, `idCategoria≠'-'`, presupuestable, `total_gastado_comprometido + subtotal ≤
  presupuesto_acumulado`); si `p_autorizo` = aprobador FP, **omite** la validación. Pone `idEstado=4`,
  `autorizo`, `fecAutorizacion`. Devuelve `{ autorizado, mensaje }` (el front muestra el mensaje).
  Si `autorizado` y estaba **fuera de presupuesto**, el backend marca **`autorizadoFP=true`**.
- 🔐 **Seguridad v2**: el `p_autorizo` se toma del **JWT** (no del cliente, como hacía v1). Escrituras con `comoActor`.

### Presupuesto y "fuera de presupuesto"
- `GET /:idCxp/presupuesto` → datos de `v_resumenPresupuesto` (acumulado, consumido, comprometido, total,
  % avance) + `fuera = presupuestable && (total_gastado_comprometido + subtotal > presupuesto_acumulado)`
  + `esAprobadorFP` + `puedeReasignar`. El modal lo muestra (en **rojo** si fuera).
- El **aprobador FP** se configura en `SPHConfiguraciones.'Aprobar fuera de presupuesto'` (= un uid).
- Si una solicitud está **fuera de presupuesto** y el usuario **no** es el aprobador FP, el modal ofrece
  **"Solicitar aprobar fuera de presupuesto"** → `POST /:idCxp/fuera-presupuesto`: reasigna
  `uidGerente = aprobador_FP` (la solicitud pasa a su bandeja). El aprobador FP sí puede aprobarla
  (la RPC omite la validación cuando `p_autorizo` = aprobador FP).

### Archivos
- Backend: `aprobacion.{service,controller,schemas}.ts`, `aprobacion-stream.controller.ts` (SSE 430),
  `sse-auth.guard.ts` (generalizado: lee la clave de `@RequierePermiso` con Reflector).
- Frontend: `AprobarSolicitudesPage.tsx`, `AprobarSolicitudModal.tsx`, `aprobar.api.ts`,
  `useCxpRealtime.ts` (hook SSE genérico; `usePagosRealtime` ahora lo envuelve).

### RPCs/objetos reutilizados (sin crear nada nuevo)
`cxp_autorizar_solicitud_pago`, `cxp_puede_autorizar`, vista `v_resumenPresupuesto`, parámetro
`SPHConfiguraciones.'Aprobar fuera de presupuesto'`, permisos 430/431, campo `cxp.autorizadoFP`.

---

## Tipos de solicitud especiales (Urgentes / Línea de Captura / Devoluciones / Sin XML) — v2  ✅

> Reescritura de los flujos de FlutterFlow `linea_solicitud_urgente`, `linea_captura`,
> `linea_devolucion` y `linea_factura_sin_x_m_l`. Se abren desde **Solicitudes de pago →
> "Nueva solicitud"** (drawer con los 5 tipos). A diferencia de la **Solicitud de Pago normal**
> (CFDI con XML, `tipoOperacion=1`), estos **no parsean XML**: el **monto se captura a mano** y los
> datos vienen de los campos del formulario. El **aprobador** (`uidGerente`) lo resuelve el backend
> desde **`PresCategorias.uidResponsable`** de la clasificación elegida (no se confía en el cliente).

### Tabla comparativa (qué escribe cada tipo en `cxp`)

| Tipo | Ruta API | `tipoOperacion` | `idEstado` inicial | `tipoProveedor` | `esUrgente` | Archivo | Contraparte | Campos propios |
|---|---|---|---|---|---|---|---|---|
| **Urgentes** | `POST /cxp/solicitudes/urgente` | 2 | **2 = Enviado** (directo a aprobación) | 1 | **true** | — | Proveedor | `completada=false` |
| **Línea de Captura** | `POST /cxp/solicitudes/linea-captura` (multipart) | 4 | **2 = Enviado** | 1 | false | **PDF** | Proveedor | `lineaCaptura`, `referencia`, `fechaLimite`, `pagoInmediato` |
| **Devoluciones** | `POST /cxp/solicitudes/devolucion` | 5 | 1 = Guardado | **2** | false | — | **Inversionista** (`inversionista`) | `referencia` = concepto de devolución |
| **Sin XML** | `POST /cxp/solicitudes/sin-xml` (multipart) | 6 | 1 = Guardado | 1 | false | **PDF** | Proveedor | `folio` (manual), `fecCFDI`, `fechaLimite` (= fecha factura), `moneda` |

**Campos comunes a los 4:** `idCxp` (15, server), `uidr`, `fecSolicitud`=hoy, `montoAplicado`=0,
`total` (manual), `idCategoria` (la **clasificación**), `concepto`, `ultimoComentario`=justificación,
`uidGerente`=`PresCategorias.uidResponsable`, `nomCFDI`=''. Todos insertan un comentario inicial en
`cxpComentarios` (tipo 1 = la justificación). Escrituras **auditadas** (`comoActor`).

### Decisiones vs. v1 (paridad con correcciones puntuales)
- **Estado inicial**: se replica v1 — Urgentes y Línea de Captura **nacen en Enviado (2)** y van directo a
  la bandeja del aprobador asignado; Devoluciones y Sin XML nacen en **Guardado (1)**.
- **Bug corregido**: en Línea de Captura `concepto` ahora es **un campo propio** (en v1 reusaba la
  justificación). 
- **Duplicados coherentes** (el chequeo de v1 estaba roto — comparaba `lineaCaptura` contra el concepto):
  - Línea de Captura: bloquea si ya existe una solicitud **activa con la misma `lineaCaptura`**.
  - Sin XML: bloquea si ya existe **mismo proveedor + mismo `folio`**.
  - Urgentes/Devoluciones: sin chequeo (no hay clave natural fiable).
- **No** validan "mes en curso" ni llaman `cxp_puede_insertar` (paridad con v1: estos tipos son atajos
  manuales; la regla fiscal del mes solo aplica al alta con CFDI).
- **Devoluciones**: la contraparte es un **Inversionista** (selector `GET /cxp/solicitudes/inversionistas`:
  `inversionista` activos, no de prueba). Se guarda `idProveedor`=`idInversionista`, `tipoProveedor=2` y
  `nombreProveedor`=`razonsocial` (resuelto en el backend; v1 lo dejaba en null).
- **Archivos** (Línea de Captura y Sin XML): PDF al bucket **`CFDIproveedores`**, ruta
  `{yyyy-MM}/{idProveedor}/{idCxp}.pdf` → `urlCFDI`.

### Archivos
- Backend: `solicitudes.schemas.ts` (schemas `crearUrgente`/`crearLineaCaptura`/`crearDevolucion`/
  `crearSinXml`), `solicitudes.service.ts` (métodos homónimos + `inversionistas()` +
  `responsableDeCategoria()` + `subirComprobante()`), `solicitudes.controller.ts` (endpoints).
- Frontend: `NuevaSolicitudEspecial.tsx` (4 modales: `NuevaUrgente`/`NuevaLineaCaptura`/`NuevaDevolucion`/
  `NuevaSinXml`, con `SearchSelect` + `InputFecha` compartidos), `solicitudes.api.ts` (DTOs + métodos),
  `SolicitudesPage.tsx` (drawer con los 5 tipos activos).

### Pendiente / notas
- ⚠️ Cuando se **reactive** el trigger `cxp_validar_fecha_cfdi_estado` (hoy off), revisar el caso **Sin XML**:
  escribe `fecCFDI` = fecha de factura (capturada por el usuario), que podría ser de un mes anterior. El plan
  de corrección del trigger debe contemplar `tipoOperacion=6`.
- Sin objetos nuevos en BD: todo se construye sobre `cxp`/`cxpComentarios`/`PresCategorias`/`catProveedores`/
  `inversionista` existentes.

## Solicitudes de Pago PPD (facturas en parcialidades) — v2  ✅

**Qué es.** Sección dedicada (`/cxp/ppd`, **clave 420**) para facturas con **MetodoPago = PPD** (Pago en
Parcialidades o Diferido): una factura grande (p. ej. $1,000,000) se **dosifica** en varios pagos a lo largo
del tiempo, llevando el control del **saldo disponible** para que **nunca se solicite más de lo que queda**.
Las solicitudes normales (`/cxp/solicitudes`) siguen siendo **solo PUE**; el PPD se rechaza ahí y se trabaja
aquí.

### Modelo (reutiliza tablas EXISTENTES de v1, autorizado por el cliente)
- **`cxp_ppd`** = maestro de la factura PPD (una fila por CFDI). Campos clave: `idCxpPPD` (PK), `folio`
  (UUID del CFDI), `total`/`subtotal` (de la factura), `montoAplicado` (Σ pagado, se sincroniza al pagar),
  `numPagos` (nº de parcialidades), `urlXLM`/`urlCFDI`, `idProveedor`, `idCategoria`. Tiene `trg_auditoria`.
- **`cxp`** = cada **solicitud parcial** (un abono), ligada al maestro por **`idCxpPPD`** (FK
  `cxp_idCxpPPD_fkey`) y por **`idFolioDif`** = UUID del CFDI. Marca **`diferido=true`**, `total` = monto del
  abono, `tipoOperacion=1`. **Nace en `idEstado=2` (Enviado)** → entra directo a la bandeja del aprobador
  (igual que las Urgentes). Al ser filas `cxp` normales, **fluyen por Aprobar (430) y Pagar (400)** sin cambios.

### Control de saldo (la regla central)
`Disponible = cxp_ppd.total − Σ(cxp.total de las parciales NO rechazadas)`. Es decir, se descuenta **todo lo
comprometido** (Guardado/Enviado/Aprobado/Pagado), no solo lo pagado, para no sobre-comprometer. Si una parcial
se **rechaza** (`idEstado=3`), su monto **vuelve** a estar disponible. El cálculo es **server-side y
parametrizado** (`PpdService.saldoDe`), sin el SQL crudo inseguro de v1.

### Flujo
1. **Nueva factura PPD** (`NuevaFacturaPpd`): sube XML+PDF → "Analizar" (valida PPD, receptor, proveedor,
   retenciones; **se relaja la regla de "mes en curso"** porque las PPD se abonan en meses posteriores) →
   captura el **monto del primer pago** (≤ total) + categoría + justificación → crea el maestro `cxp_ppd` + la
   **primera parcial**. Si la factura ya estaba registrada, avisa para usar "Solicitar otro pago".
2. **Solicitar otro pago** (`NuevaParcialPpd`): sobre una factura existente, **sin re-subir XML**; captura
   monto (validado ≤ disponible) + categoría + justificación → nueva parcial Enviada.
3. **Estado de cuenta** (`PpdPage`): tabla con Total / Solicitado / Pagado / **Disponible** / % avance por
   factura + detalle con las parcialidades y su estatus.

### Sincronización de saldo al pagar
`pagos.service.ts` (`registrarPago`, `asignarMovimiento`, `desaplicarPago`): tras actualizar `cxp`, si la fila
tiene `idCxpPPD` llama a `sincronizarMaestroPpd()` que recalcula `cxp_ppd.montoAplicado` = Σ pagado de las
parciales (idEstado 6/7). El estado de cuenta de v2 se calcula on-the-fly; esto mantiene el maestro coherente
con v1.

### Detalle no obvio (clave para entender por qué funciona)
`cxp.numAnio`/`numMes` son **columnas GENERADAS desde `fc`** (= `now()` al crear), y `numSem`/`rangoSemana` los
pone el trigger `update_week_info` desde **`fecSolicitud`** (= hoy). Por eso, aunque el CFDI PPD sea de un mes
anterior, **cada parcial aparece en el periodo ACTUAL** en "Pagar". Ambos triggers de validación de fecha
(`trigger_cxp_validar_fecha_cfdi`, `trigger_cxp_validar_fecha_insert`) están **DISABLED**, así que la relajación
de "mes en curso" en el backend no choca con la BD.

### Validación CFDI reutilizada
`SolicitudesService.validarCfdi(xml, pdf, opts)` se parametrizó: para PPD se invoca con
`{ metodoPago:'PPD', exigirMesActual:false, verificarDuplicado:false }` (el control de duplicado del maestro lo
hace `PpdService` contra `cxp_ppd.folio`). El resto de validaciones (tipo Ingreso, receptor autorizado, UUID,
proveedor registrado, retenciones, XML↔PDF) se mantienen iguales.

### Archivos
- Backend: `apps/api/src/modules/cxp/ppd.service.ts`, `ppd.controller.ts`, `ppd.schemas.ts` (registrados en
  `cxp.module.ts`); cambios en `solicitudes.service.ts` (validarCfdi parametrizable + helpers públicos) y
  `pagos.service.ts` (sincronización del maestro).
- Frontend: `apps/web/src/features/cxp/ppd.api.ts`, `PpdPage.tsx`, `NuevaFacturaPpd.tsx`, `NuevaParcialPpd.tsx`;
  ruta en `routes/router.tsx`; ítem de menú en `components/layout/menu.tsx`.

### Endpoints
- `GET /api/cxp/ppd` — estado de cuenta (facturas PPD con saldos).
- `GET /api/cxp/ppd/:idCxpPPD` — detalle + parcialidades.
- `POST /api/cxp/ppd/analizar` — analiza el CFDI PPD (multipart xml+pdf).
- `POST /api/cxp/ppd` — crea factura + primera parcial (multipart).
- `POST /api/cxp/ppd/:idCxpPPD/parcial` — nueva solicitud parcial (JSON).
- `POST /api/cxp/ppd/parcial/:idCxp/complemento` — sube el Complemento de Pago (REP) de una parcialidad
  pagada (multipart xml + pdf opcional).

### Complemento de Pago (REP) + candado escalonado  ✅ (v2.15+)
Cada pago de una parcialidad PPD obliga al proveedor a emitir un **Complemento de Pago (REP)**: un CFDI
**tipo `P`** (`Pagos 2.0`) que referencia la factura por su UUID (`DoctoRelacionado.IdDocumento`) y el importe
(`ImpPagado`). v2 lo captura y controla.

- **Almacenamiento (objetos autorizados):** 4 columnas NULLABLE nuevas en `cxp` —
  `urlComplementoXml`, `urlComplementoPdf` (rutas en el bucket), `uuidComplemento` (UUID del REP, anti-duplicado)
  y `fecComplemento` — + bucket **privado `complementospago`**. El detalle PPD entrega **URLs firmadas** (1 h)
  para ver/descargar los archivos. `cxp` ya tiene `trg_auditoria` → todo auditado.
- **Parser/validación** (`cfdi.ts`): `parsearComplementoPago` (limpia **BOM**; `Pago`/`DoctoRelacionado` como
  arrays) + `validarRepContra`. Al subir (`PpdService.subirComplemento`) se exige: tipo `P`; receptor ∈
  `RFC_RECEPTORES_AUTORIZADOS`; emisor == RFC del proveedor de la factura; un `DoctoRelacionado.IdDocumento` =
  `cxp_ppd.folio`; `ImpPagado` == monto de la parcialidad (±0.01); UUID del REP no repetido. Solo sobre
  parcialidades **pagadas** (idEstado 6/7) y sin REP previo.
- **Candado escalonado** (`bloqueo.service.ts`, derivado de datos — se levanta solo al subir el REP; `isSupport`
  exento). Se verifica al inicio de **las 7 altas** (`crear`, urgente, línea de captura, devolución, sin XML,
  `crearConFactura`, `nuevaParcial`):
  - **Nivel 1 — proveedor (inmediato):** si el proveedor tiene una parcialidad PPD pagada sin REP, **se bloquea
    cualquier tipo** de solicitud de pago de ese proveedor (403).
  - **Nivel 2 — usuario (>15 días):** si una parcialidad PPD pagada por el usuario (`uidr`) lleva >15 días sin
    REP, el usuario no puede crear **ninguna** solicitud de pago (de cualquier proveedor) hasta subirlo (403).
- **Aviso diario** (`complementos.scheduler.ts`, `@Cron('0 13 * * *')` ≈07:00 MX): para parcialidades pagadas
  hace **10–14 días** sin REP (faltando ≤5 días para el bloqueo), envía correo al **solicitante (`uidr`)** y al
  **gerente que autorizó (`autorizo`)** con la **cuenta activa del buzón de facturas** (reutiliza
  `SmtpService.enviarNotificacion` + `CuentasService`; `CorreoModule` exporta ambos y `CxpModule` lo importa).
- **Dispensa por excepción (plan B, permiso `403` «Dispensar complemento PPD»):** salida para cuando el REP
  **nunca llegará** (p. ej. **proveedor de única vez**) y, sin ella, el usuario quedaría bloqueado de forma
  permanente. Un usuario con el permiso 403 marca **esa parcialidad** como **exenta** con un **motivo
  obligatorio** (`PpdService.dispensarComplemento`, `POST /cxp/ppd/parcial/:idCxp/dispensar-complemento`). Es
  **granular** (solo esa parcialidad; las demás siguen exigiéndose), no anula el pago (que es real y conciliado)
  y queda **auditado** (motivo + `complementoExentoPor` + fecha + comentario). Las dispensadas se **excluyen**
  del candado y de los avisos → el bloqueo se levanta solo. El endpoint usa `@RequierePermiso(403)` a nivel de
  método (sobrescribe el 420 de la clase). Front: botón **Dispensar** junto a Subir (`DispensarComplementoModal`,
  solo si `tienePermiso(403)`); la parcialidad muestra **"Dispensado (excepción)"** con tooltip (motivo + quién).
- **Front:** en el detalle PPD, columna **Complemento (REP)** por parcialidad pagada: "✓ REP subido" (link
  firmado) / "Pendiente (n d)" en ámbar/rojo (+ botones **Subir** y **Dispensar**) / **"Dispensado (excepción)"**.
  El candado se refleja con el mensaje 403 del backend en el modal de alta.
- **Resaltado en el listado PPD (v2.34.0):** `PpdService.listar()` devuelve por factura dos banderas —
  `repPendiente` (alguna parcialidad pagada sin REP ni dispensa) y `repVencido` (…y con **>15 días** desde el
  pago). En `PpdPage` la fila se pinta en **rojo (`bg-rose-100`)** si `repVencido` y en **ámbar (`bg-amber-50`)**
  si solo `repPendiente`, para detectar de un vistazo las facturas que requieren el REP (se levanta solo al subir
  el complemento o dispensarlo). Además, la columna **Proveedor** se acota (máx. 500px; el concepto hace *wrap*
  hacia abajo en vez de ensanchar la tabla) y **Folio** muestra el folio fiscal completo.

### Regla de negocio del PPD (confirmada 2026-06-17)
Una factura puede ser **PPD aunque se pague en una sola exhibición**: el proveedor emite el CFDI al **iniciar**
el trabajo (método de pago PPD) y se paga al **terminarlo**, semanas o meses después. Por eso existen facturas
PPD pagadas de una vez que **sí requieren** Complemento de Pago (REP). Si el REP no llegará, se **dispensa** por
excepción (permiso 403); no se "quita el diferido".

### Migración de facturas diferidas previas a la sección PPD (2026-06-17)
Antes de existir `/cxp/ppd`, varias facturas PPD se subieron como solicitudes normales marcándolas
`diferido=true` (atajo para tramitarlas con fecha de mes anterior). Quedaron con `cxp.diferido=true` pero **sin
maestro `cxp_ppd` ni `idCxpPPD`** → disparaban el candado del REP pero **no aparecían** en la sección PPD (ni se
les podía subir/dispensar el complemento). Se **regularizaron** creando el maestro `cxp_ppd` por factura
(`folio = idFolioDif`, UUID limpio) y ligando sus parcialidades (`cxp.idCxpPPD`):
- **Alcance:** todas las diferidas **activas** (idEstado ≠ 3) sin maestro, agrupadas por **folio**. Se crearon
  **25 maestros** y se ligaron **27 parcialidades**. Los `idCxpPPD` llevan prefijo `mig…` → **reversible**.
- **Total del maestro:** suma de las parcialidades no rechazadas del folio (evita disponible negativo; **no** se
  leyó el XML porque el desbloqueo es por dispensa, no por el monto exacto).
- **Desbloqueo:** las **11** parcialidades pagadas sin REP quedaron listas para que un usuario con permiso
  **403** las **dispense** desde `/cxp/ppd` (motivo obligatorio, auditado). Afectaba a Mónica (8), Jessamyn (2)
  y Carlos Carreón (1, JAZA); hoy **solo Carlos Carreón** tiene el 403 → él dispensa por todas (el listado PPD
  muestra todas las facturas, no solo las propias).
- ⚠️ La inserción se hizo vía **service_role** (MCP), por lo que la auditoría del alta de maestros no lleva
  actor JWT (la dispensa posterior sí). **Revertir:** `UPDATE cxp SET "idCxpPPD"=NULL WHERE "idCxpPPD" LIKE
  'mig%'; DELETE FROM cxp_ppd WHERE "idCxpPPD" LIKE 'mig%';`.

### Pendiente / notas
- **Supuesto:** el PPD se trabaja **solo desde v2** de aquí en adelante (no en paralelo desde Flutter), para no
  duplicar maestros `cxp_ppd`.
- Objetos de BD del complemento (autorizados): columnas `cxp.{urlComplementoXml,urlComplementoPdf,uuidComplemento,
  fecComplemento,complementoExento,complementoExentoMotivo,complementoExentoPor,fecComplementoExento}` + bucket
  `complementospago` + permiso `403` en `segModulos`. El resto reutiliza `cxp` + `cxp_ppd` (con `trg_auditoria`).
- El job de avisos requiere **al menos una cuenta de correo activa** en `correo_cuentas` (la del buzón de
  facturas) y `EMAIL_ENCRYPTION_KEY` configurada para descifrar su contraseña.
