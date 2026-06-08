# Índice maestro — Base de conocimiento (agente de soporte)

> **Instrucción para el agente.** Consulta SIEMPRE este índice primero. Identifica el módulo a partir
> de las **palabras clave** o de la **tabla/ruta** que menciona el usuario, abre el documento indicado
> en `modulos/` y respóndele desde ahí. Si el tema cruza varios módulos, lee también los relacionados.
> Si un módulo está marcado **stub**, aún no existe en la versión nueva: explícalo y, si procede,
> ofrece levantar un ticket. Ante cualquier duda de datos, revisa primero `GLOSARIO.md` y `MAPA-DATOS.md`.

## Cómo está organizada la KB

- `INDICE.md` — este archivo (router + palabras clave + mapas inversos).
- `GLOSARIO.md` — entidades y términos transversales (inversionista, PDP, KVA, situación, INPC…).
- `OBSOLESCENCIA-BD.md` — qué objetos de la BD (RPCs, vistas, tablas…) se podrán eliminar al apagar v1
  (registro vivo). Útil para el agente si un usuario pregunta por una función/vista vieja.
- `MAPA-DATOS.md` — qué tabla pertenece a qué módulo y cómo se relacionan (pendiente de poblar; por
  ahora ver los mapas inversos al final de este índice y el `GLOSARIO.md`).
- `modulos/<modulo>.md` — un documento súper detallado por módulo.

Cada documento de módulo inicia con un bloque de metadatos (frontmatter YAML) con `claves_permiso`,
`tablas`, `palabras_clave` y `relacionado_con`. Esos metadatos son la base para indexarlo (en el
futuro, en una tabla vectorial `pgvector` para búsqueda semántica).

## Módulos

| Módulo | Estado | Documento | Rutas | Permisos | Palabras clave |
|---|---|---|---|---|---|
| Autenticación | ✅ desarrollado | `modulos/autenticacion.md` | /login, /recuperar | — | login, contraseña, usuario, sesión, dominio, correo |
| Configuraciones | ✅ desarrollado | `modulos/configuraciones.md` | /configuraciones/* | 200, 203, 210, 220, 221 | usuarios, parámetros, permisos, plantillas, INPC, cuentas, fechas CxP, logos, dominios |
| Parques | ✅ desarrollado | `modulos/parques.md` | /parques, /parques/disponibilidad | 700, 701, 702, 710 | parque, nave, bodega, KVA, disponibilidad, manzana, lote, GYM |
| Landing / Indicadores | ✅ desarrollado | `modulos/landing-indicadores.md` | / | — | inicio, tipo de cambio, dólar, INPC, indicadores, Banxico |
| Auditoría / Ver como | ✅ desarrollado | `modulos/auditoria-y-ver-como.md` | (transversal) | 200 | historial, bitácora, auditoría, trazabilidad, ver como, quién cambió |
| Clientes | ✅ desarrollado | `modulos/clientes.md` | /clientes | 300 | cliente, clientes, inversionista, arrendatario, ticket, usuario final, papelera, prueba, razón social, RFC, CURP, contpaq, personalidad, alta cliente, CRM |
| Inversionistas / Propietarios (Ventas) | 🟠 parcial | `modulos/inversionistas.md` | /ventas, /ventas/planes | 600, 610 | inversionista, propietario, dueño, propiedad, nave, parque, vincular nave, nave disponible, nave vendida, situación, KVAs, KVAs Alta, KVAs Media, tipoTension, venta, plan de pagos, PDP, parcialidad, cobranza, cobranza real, pago, eliminar pago, terreno, construcción, ticket, descuento, saldo a favor, % avance, renta garantizada, renta administrada, configuración, documentos, escrituración, comentarios, razón social |
| Arrendatarios | ✅ desarrollado | `modulos/arrendatarios.md` | /arrendatarios, /arrendatarios/planes | 10, 20 | arrendatario, inquilino, renta, arrendamiento, contrato, arrePdp, plan de renta, corrida, INPC, mes de gracia, cortesía, concepto financiado, KVA, vigencia, cobranza, aplicar pago, depósito, contrato por vencer, contrato vencido, m² construcción, liberar nave, renovación, renovar plan, fecha fin |
| Correo (buzón de facturas) | ✅ desarrollado | `modulos/correo.md` | /correo | 800 (usar), 801 (configurar cuenta) | correo, email, buzón, bandeja, factura, comprobante, IMAP, SMTP, Hostinger, responder, adjunto, sincronizar |
| CxP (Cuentas por pagar) | 🟠 parcial | `modulos/cxp.md` | /cxp/pagar, /cxp/aprobar, /cxp/solicitudes, /cxp/pendientes, /cxp/proveedores, /cxp/bancos | 400, 401, 402, 410, 420, 430, 431, 450, 470 | pago, pagar solicitudes, aprobar solicitudes, aprobación, presupuesto, fuera de presupuesto, cuenta por pagar, factura, CFDI, aplicar pago, comprobante, N8N, autorizar, rechazar, regresar, transferencia SPEI, proveedor, banco, conciliación, desaplicar, claves SAT, retención, tiempo real |
| Fideicomiso | 🟡 stub | `modulos/fideicomiso.md` | (pendiente v2) | — | fideicomiso, dispersión, aportación, rendimiento, contabilidad |
| CRM | 🟠 parcial | `modulos/crm.md` | (Clientes ya migrado → ver `modulos/clientes.md`) | 300 | lead, prospecto, empresa, inmobiliaria, actividad comercial · (Clientes = padrón) |

> Leyenda: **✅ desarrollado** = está en v2 y su doc está completo · **🟡 stub** = existe en v1 pero aún
> no en v2 (ficha mínima; el agente debe derivar a soporte para operaciones).

## Mapa inverso: tabla → módulo

Para cuando el usuario o un error menciona una tabla concreta.

| Tabla / vista | Módulo(s) |
|---|---|
| `parques`, `naves`, `v_naves`, `v_disponibilidad` | Parques |
| `inversionista` | **Clientes** (padrón) · Inversionistas/Propietarios (Ventas) · Arrendatarios |
| `propiedades`, `inversionista_docs`, `v_propiedades` | Inversionistas/Propietarios (Ventas) (y Parques para el dueño) |
| `kvasAsignados` | Inversionistas/Propietarios (Ventas) (KVAs por nave) · Parques |
| `pdp`, `pdpDetalle`, `pagos`, `rgPdp`, `rgPdpDetalle`, `raPdp`, `raPdpDetalle`, `v_rentasCombinadas` | Inversionistas/Propietarios (Ventas) |
| `arrenPropiedades`, `arrePdp`, `arrePdpDetalle`, `arreConceptos`, `v_arrendadasNaves` | Arrendatarios (y Parques para el arrendatario) |
| `catUsers`, `segModulosUsuarios`, `segModulos`, `segPlantillasPermisos` | Configuraciones (Usuarios/Permisos) |
| `inpc`, `PresCategorias`, `PresDetalle`, `cxp_fechas_habilitadas`, `catClavesProdServ` | Configuraciones (Parámetros: INPC/Cuentas/Fechas/**Claves SAT**) |
| `SPHConfiguraciones` | Configuraciones (Sistema) · `RFC_RECEPTORES_AUTORIZADOS` lo usa CxP |
| `auditoria`, `actividad` | Auditoría |
| `cxp`, `cxpComentarios`, `catProveedores`, `catBancos`, `catClavesProdServ`, `movbancarios` | CxP |
| `correo_cuentas`, `correo_mensajes`, `correo_adjuntos` | Correo (buzón de facturas) |
| `emails`, `email_attachments` | Soporte/CRM (vía N8N — NO es el módulo Correo) |

## Mapa inverso: ruta → módulo

| Ruta | Módulo |
|---|---|
| `/login`, `/recuperar` | Autenticación |
| `/` | Landing / Indicadores |
| `/clientes` | Clientes |
| `/ventas`, `/ventas/planes` | Inversionistas/Propietarios (Ventas) |
| `/arrendatarios` | Arrendatarios (Dashboard de cobranza) |
| `/arrendatarios/planes` | Arrendatarios (Planes de Renta) |
| `/parques`, `/parques/disponibilidad` | Parques |
| `/cxp/pagar` | CxP (Pagar solicitudes / tesorería) |
| `/cxp/aprobar` | CxP (Aprobar Solicitudes / aprobador) |
| `/cxp/solicitudes`, `/cxp/pendientes` | CxP (Solicitudes / Pendientes) |
| `/cxp/proveedores`, `/cxp/bancos` | CxP (Catálogos) |
| `/correo` | Correo (buzón de facturas) |
| `/configuraciones/usuarios` | Configuraciones (Usuarios) |
| `/configuraciones/parametros` | Configuraciones (Parámetros) |
| `/configuraciones/permisos` | Configuraciones (Permisos) |
| `/configuraciones/sistema` | Configuraciones (Sistema) |
| `/configuraciones/cambiar-contrasena` | Autenticación / Configuraciones |
