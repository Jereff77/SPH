---
modulo: CxP (Cuentas por Pagar)
estado: parcial              # Proveedores en v2; resto en desarrollo por fases
version_doc: 0.2
ultima_actualizacion: 2026-06-04
submodulos: [Proveedores, Bancos, Solicitudes, Aprobación, Pago/Conciliación, Reportes]
rutas: [/cxp/proveedores, /cxp/bancos, /cxp/solicitudes, /cxp/pendientes]
claves_permiso: [400, 401, 402, 410, 420, 430, 431, 440, 441, 450, 460, 470]
tablas: [cxp, catProveedores, catBancos, cxpComentarios, cxp_fechas_habilitadas, movbancarios, PresCategorias, v_resumenPresupuesto]
palabras_clave: [pago, cuenta por pagar, CxP, factura, CFDI, autorizar, aprobar, solicitud de pago, proveedor, banco, bancos, transferencia, conciliación, movimiento bancario, presupuesto, devolución, urgente, RFC]
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
| Solicitudes de pago | `/cxp/solicitudes` | 420 | 🟠 listado (4 etapas, lectura); edición/captura pendiente |
| Dashboard CxP | (pendiente) | 400 / 440 / 441 | ⏳ |
| Solicitudes pendientes | `/cxp/pendientes` | **450** | ✅ desarrollado |
| Aprobar facturas | (pendiente) | 430 | ⏳ |
| Reportes | (pendiente) | 460 | ⏳ |

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
- **Filtros:** Año, Mes, Estado, Semana, Responsable (uidGerente).
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
5. CFDI se guarda en el bucket `CFDIproveedores`.

## 8. 🩺 Diagnóstico / problemas comunes

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| "No veo Proveedores / CxP." | Falta permiso 400/410. | Revisar permisos. |
| "No puedo crear/editar un proveedor." | Falta permiso 410 o RFC/banco incompletos. | Verificar permiso y campos obligatorios. |
| "No me deja autorizar." | `cxp_puede_autorizar()` = false o no es el gerente. | Revisar quién autoriza esa solicitud. |
| "No puedo cargar CFDI hoy." | La fecha no está habilitada (`cxp_fechas_habilitadas`). | Habilitar la fecha en Parámetros → Fechas CxP. |
| "Un pago quedó mal conciliado." | Asignación incorrecta de `movbancarios`. | Escalar a soporte (desaplicar, permiso 401). |

**Cuándo escalar a ticket:** desaplicar/corregir pagos, inconsistencias de conciliación, solicitudes
atoradas en un estado, o cargas de CFDI bloqueadas por fechas.

## 9. Estado y pendientes

- ✅ **Proveedores** (catálogo CRUD + status).
- ⏳ **Solicitudes** (captura con/sin CFDI: subir archivo + captura manual), **Aprobación**,
  **Pago/Conciliación bancaria** (sensible), **Reportes**, devoluciones y urgentes.
- Decisiones acordadas: reutilizar RPCs de negocio seguras; CFDI = subir archivo + captura manual; las
  escrituras de v2 quedan auditadas con el usuario real.

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

### Archivos
- Backend: `cfdi.ts` (parser + `validarDeducciones`), `claves-sat.{schemas,service,controller}.ts`,
  `solicitudes.service.ts` (`analizar`/`crear`/`validarCfdi`/`textoDePdf`), `solicitudes.controller.ts`
  (endpoints multipart con `FileFieldsInterceptor`). Dependencias: `fast-xml-parser`, `pdf-parse`.
- Frontend: `NuevaSolicitudPago.tsx` (modal de alta), `MenuTipos` (drawer en `SolicitudesPage.tsx`),
  `ClavesSatTab.tsx` + `clavesSat.api.ts` (catálogo en Parámetros).

### Pendiente / notas
- La validación XML↔PDF requiere que el PDF tenga texto (un PDF escaneado/imagen se
  rechaza con mensaje específico).
- Tipos de solicitud Urgentes / Línea de Captura / Devoluciones / Facturas sin XML:
  fase futura (el menú ya los lista como "Próx.").
- `cxp` no guarda desglose de impuestos (solo `subtotal`/`total`); las retenciones se
  validan pero no se almacenan desglosadas.
