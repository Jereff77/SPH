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
- `PLAN-incrementos-inpc-automaticos.md` — 📌 diseño aprobado (2026-07-02, pendiente de implementar):
  incremento automático de rentas al capturar el INPC (vista previa, bitácora reversible
  `arre_incrementos`, responsables de parque + correo). Sustituirá al kit viejo de funciones INPC.
- `MAPA-DATOS.md` — qué tabla pertenece a qué módulo y cómo se relacionan (pendiente de poblar; por
  ahora ver los mapas inversos al final de este índice y el `GLOSARIO.md`).
- `modulos/<modulo>.md` — un documento súper detallado por módulo.

Cada documento de módulo inicia con un bloque de metadatos (frontmatter YAML) con `claves_permiso`,
`tablas`, `palabras_clave` y `relacionado_con`. Esos metadatos son la base para indexarlo (en el
futuro, en una tabla vectorial `pgvector` para búsqueda semántica).

## Módulos

| Módulo | Estado | Documento | Rutas | Permisos | Palabras clave |
|---|---|---|---|---|---|
| Autenticación | ✅ desarrollado | `modulos/autenticacion.md` | /login, /recuperar, /restablecer | — | login, contraseña, usuario, sesión, dominio, correo, recuperar, olvidé mi contraseña, restablecer, enlace de recuperación |
| Configuraciones | ✅ desarrollado | `modulos/configuraciones.md` | /configuraciones/* · /registro | 200, 203, 210, 220, 221 | usuarios, invitación, invitar usuario, registro, alta de usuario, parámetros, permisos, plantillas, INPC, cuentas, fechas CxP, logos, dominios |
| Parques | ✅ desarrollado | `modulos/parques.md` | /parques, /parques/disponibilidad | 700, 701, 702, 710 | parque, nave, bodega, KVA, disponibilidad, manzana, lote, GYM, historial de la nave, trazabilidad de la nave, quién desvinculó, motivo de baja, dueño fantasma, propietario fantasma, baja lógica, ticket |
| Landing / Indicadores | ✅ desarrollado | `modulos/landing-indicadores.md` | / | — | inicio, tipo de cambio, dólar, INPC, indicadores, Banxico |
| Auditoría / Ver como | ✅ desarrollado | `modulos/auditoria-y-ver-como.md` | (transversal) | 200 | historial, bitácora, auditoría, trazabilidad, ver como, quién cambió |
| Changelog / Novedades | ✅ desarrollado | `modulos/changelog.md` | /configuraciones/novedades | — (sin permiso) | novedades, changelog, versión, versiones, actualización, qué cambió, notas de la versión, SemVer, nueva versión disponible, recargar página, actualizar página, refrescar, versión del bundle |
| Clientes | ✅ desarrollado | `modulos/clientes.md` | /clientes | 300 | cliente, clientes, inversionista, arrendatario, ticket, usuario final, papelera, sin clasificar, prueba, no aparece, todos los clientes, columna tipo, paginación, no me deja mandar a papelera, tiene una nave, desvincular, razón social, RFC, CURP, contpaq, personalidad, alta cliente, CRM |
| Inversionistas / Propietarios (Ventas) | 🟠 parcial | `modulos/inversionistas.md` | /ventas, /ventas/dashboard, /ventas/planes, /ventas/escrituras | 600, 610, 620, 630 | inversionista, propietario, dueño, propiedad, nave, parque, vincular nave, nave disponible, nave vendida, situación, KVAs, KVAs Alta, KVAs Media, tipoTension, venta, plan de pagos, PDP, parcialidad, cobranza, cobranza real, pago, eliminar pago, terreno, construcción, ticket, descuento, saldo a favor, % avance, renta garantizada, renta administrada, configuración, documentos, escrituración, escriturada, pendiente, estatus de escrituración, fecha de escrituración, filtro por mes, vencido a hoy, adeudo a hoy, indicadores del dashboard, comentarios, razón social, plan huérfano, pdp huérfano, el plan no tiene parcialidades, con plan pero vacío, no me aparece el plan, no puedo desvincular la nave |
| Arrendatarios | ✅ desarrollado | `modulos/arrendatarios.md` | /arrendatarios, /arrendatarios/planes | 10, 20 | arrendatario, inquilino, renta, arrendamiento, contrato, arrePdp, plan de renta, corrida, INPC, actualizar INPC manual, INPC manual no funciona, no cambia el monto, lo modifica desde el año 1, desfase del año, anio desalineado, mes de gracia, cortesía, concepto financiado, KVA, vigencia, cobranza, aplicar pago, depósito, contrato por vencer, contrato vencido, m² construcción, liberar nave, renovación, renovar plan, fecha fin, importar estado de cuenta, SPEI recibido, BanBajío, conciliación, depósito no aparece, sugeridos, registro de movimientos, desaplicar pago, revertir pago, aplicar exacto, saldo a favor, arre_pagos, arre_ordenante, plan de renta huérfano, arrePdp huérfano, el plan no tiene parcialidades, no puedo liberar la nave |
| Incrementos INPC (Arrendatarios) | ✅ desarrollado | `modulos/incrementos-inpc.md` | Parámetros→INPC (disparo) · /arrendatarios/responsables · /arrendatarios/planes (bitácora) | 212 (aplicar/revertir/responsables), 20 (bitácora por plan) | incremento, INPC, renta, aniversario, aplicar incremento, revertir, re-aplicar, desfase, responsable de parque, gerente, correo de incrementos, bitácora, no se aplicó el incremento, incremento pendiente, reserva incompleta, captura tardía |
| Correo (buzón de facturas) | ✅ desarrollado | `modulos/correo.md` | /correo | 800 (usar), 801 (configurar cuenta) | correo, email, buzón, bandeja, factura, comprobante, IMAP, SMTP, Hostinger, responder, adjunto, sincronizar |
| Soporte a Inquilinos (Arrendatarios) | ✅ desarrollado | `modulos/soporte-inquilinos.md` | /arrendatarios/soporte | 31, 32, 33, 34, 35, 36 | soporte a inquilinos, incidente, incidentes, ticket, reporte de falla, queja, mantenimiento, contacto@portal.gruposph.mx, bandeja de incidentes, responder, firma corporativa, logo en el correo, vincular inquilino, remitente, estado, nuevo, en proceso, resuelto, detenido, cerrado, sin avance 7 días, asignar, agente, gerente, ver todos, tablero, kanban, seguimientos, nota interna, clasificar con IA, categoría, prioridad, folio en el asunto, mismo incidente |
| CxP (Cuentas por pagar) | 🟠 parcial | `modulos/cxp.md` | /cxp/pagar, /cxp/aprobar, /cxp/solicitudes, /cxp/ppd, /cxp/pendientes, /cxp/proveedores, /cxp/bancos | 400, 401, 402, 403, 410, 420, 430, 431, 450, 470 | pago, pagar solicitudes, aprobar solicitudes, aprobación, presupuesto, fuera de presupuesto, cuenta por pagar, factura, CFDI, aplicar pago, comprobante, lectura de comprobante, documentos privados, URL firmada, autorizar, rechazar, regresar, transferencia SPEI, proveedor, banco, conciliación, desaplicar, claves SAT, carga masiva claves, layout, importación, plantilla Excel, retención, tiempo real, solicitud urgente, línea de captura, devolución, factura sin XML, PPD, pago en parcialidades, diferido, parcialidad, abono, dosificar, saldo disponible, estado de cuenta, solicitar otro pago, cxp_ppd, complemento de pago, REP, recibo electrónico de pago, candado, bloqueo, usuario bloqueado, complemento pendiente, complemento vencido, aviso por correo, subir complemento, complementospago, dispensa, dispensar complemento, excepción, proveedor de única vez, exento, permiso 403, liberar usuario, badge de pendientes por aprobar, círculo con número en el menú, aviso de solicitudes por aprobar, contador en el menú |
| Fideicomiso | ✅ desarrollado | `modulos/fideicomiso.md` | /fideicomiso/dashboard, /fideicomiso/aportaciones (+ config ⚙️), /fideicomiso/adhesiones, /fideicomiso/contabilidad, /fideicomiso/dispersiones, /fideicomiso/reportes | 500, 510, 511, 520, 530, 540 | fideicomiso, dashboard, dispersión, dispersiones, aportación, aportaciones, adhesión, adhesiones, rendimiento, kardex, reportes, ticket, contabilidad, pivote, concepto contable, inversión, rendimiento promedio, retención ISR, comisión SPH |
| CRM | 🟠 parcial | `modulos/crm.md` | (Clientes ya migrado → ver `modulos/clientes.md`) | 300 | lead, prospecto, empresa, inmobiliaria, actividad comercial · (Clientes = padrón) |
| Cron / Tareas programadas | ✅ desarrollado | `modulos/cron.md` | /configuraciones/cron | — (solo soporte, isSupport) | cron, tarea programada, tareas programadas, job, jobs, scheduler, pg_cron, ejecución, historial de tareas, automático, programado, soporte, monitoreo, ejecutar ahora |
| Recordatorio de aprobación CxP (correo) | ✅ desarrollado | `modulos/recordatorio-aprobacion-cxp.md` | (cron 07:00 MX) · /configuraciones/cron · /configuraciones/soporte (bitácora) | 430 (destinatario), isSupport (bitácora) | recordatorio, recordatorio de aprobación, correo a aprobadores, solicitudes por aprobar, pendientes de aprobar, aviso 7am, recordatorio diario, n8n, miércoles, recordatorios enviados, mail_recordatorios_aprobacion |
| Asistente / Agente de IA de Soporte | ✅ desarrollado | `modulos/soporte-ia.md` | (transversal — widget flotante) · /configuraciones/soporte (auditoría, solo soporte) | — (todos; auditoría solo soporte) | asistente, ayuda, soporte, agente, IA, chat, chatbot, cómo hago, no me deja, no aparece, ticket, escalar, OpenRouter, widget, dudas, guía, auditoría, conversaciones, bandeja de tickets |
| Directorio de Contactos y Responsables | ✅ desarrollado | `modulos/directorio-contactos.md` | (transversal — **siempre** en contexto) | — | quién, a quién contactar, responsable, asignar permiso, no tengo permiso, quién asigna, soporte, área, encargado, administrador |

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
| RPCs `v_pdpdetalle_get_*` (estado_cuenta_detalle, unique_values, filtros_dependientes) + vista `v_pdpdetalle` | Inversionistas/Propietarios (Ventas) → **Reportes** (Estado de Cuenta + filtros; las llama el backend). ⚠️ Las RPCs de **vencidos** (`saldos_vencidos_por_parque`/`resumen`/`evolucion`) ya **NO** se usan → reemplazadas por `SaldosVencidosService` (FIFO); ver `OBSOLESCENCIA-BD.md` |
| `iaSesiones`, `iaConversaciones`, RPCs `ia_*`, edge `ia-chat` (OpenRouter) | Ventas → Reportes → **Montse AI** (asistente; backend proxy) |
| `v2_soporte_sesiones`, `v2_soporte_mensajes`, `v2_soporte_tickets`, rol `v2_soporte_ro`, edge `soporte-chat` (OpenRouter) | **Asistente / Agente de IA de Soporte** (widget transversal) |
| `pdp`, `pdpDetalle`, `pagos`, `rgPdp`, `rgPdpDetalle`, `raPdp`, `raPdpDetalle`, `v_rentasCombinadas` | Inversionistas/Propietarios (Ventas) |
| `arrenPropiedades`, `arrePdp`, `arrePdpDetalle`, `arreConceptos`, `v_arrendadasNaves`, `arre_pagos`, `arre_ordenante` | Arrendatarios (y Parques para el arrendatario). `arre_pagos` = pagos/historial; `arre_ordenante` = mapeo ordenante↔arrendatario; los depósitos están en `movbancarios` |
| `arre_incrementos`, `parque_responsables`, RPCs `arrepdp_aplicar_incremento_inpc`/`arrepdp_revertir_incremento_inpc`, columna `arrePdpDetalle.aplicaInpc` | **Incrementos INPC** (bitácora reversible de incrementos de renta + responsables de parque para el correo) |
| `catUsers`, `segModulosUsuarios`, `segModulos`, `segPlantillasPermisos` | Configuraciones (Usuarios/Permisos) |
| `v2_invitaciones` | Configuraciones (Usuarios → invitaciones de registro) |
| `inpc`, `PresCategorias`, `PresDetalle`, `cxp_fechas_habilitadas`, `catClavesProdServ` | Configuraciones (Parámetros: INPC/Cuentas/Fechas/**Claves SAT**) |
| `SPHConfiguraciones` | Configuraciones (Sistema) · `RFC_RECEPTORES_AUTORIZADOS` lo usa CxP |
| `auditoria`, `actividad` | Auditoría · **Parques** (el "Historial de la nave" se reconstruye desde `auditoria`) |
| `v2_changelog` | Changelog / Novedades |
| `v2_cron_ejecuciones` | Cron / Tareas programadas |
| `mail_recordatorios_aprobacion` | **Recordatorio de aprobación CxP** (bitácora de correos enviados; solo backend) |
| `cxp`, `cxp_ppd`, `cxpComentarios`, `catProveedores`, `catBancos`, `catClavesProdServ`, `movbancarios` | CxP (`cxp_ppd` = maestro de facturas PPD) |
| `correo_cuentas`, `correo_mensajes`, `correo_adjuntos` | Correo (buzón de facturas) · **Soporte a Inquilinos** (reutiliza la cuenta designada) |
| `incidentes`, `incidentes_remitentes`, `incidentes_seguimientos` | **Soporte a Inquilinos** (incidentes por correo + mapeo aprendido remitente→inquilino/nave + árbol de seguimientos) |
| `emails`, `email_attachments` | Soporte/CRM (vía N8N — NO es el módulo Correo) |
| `fidePdpDispersion`, `fideicomiso`, `fideCondiciones`, `fide_periodos_dispersion`, `v_fideicomiso`, `v_propiedadesfide`, `v_pagos` | **Fideicomiso** (Kardex/Dispersiones/Adhesiones/Aportaciones) |
| `fideContabilidad`, `fideContaConceptos`, `fideContaHistorial`, `fideSaldosBanco` | **Fideicomiso** (Contabilidad) |

## Mapa inverso: ruta → módulo

| Ruta | Módulo |
|---|---|
| `/login`, `/recuperar`, `/restablecer` | Autenticación |
| `/` | Landing / Indicadores |
| `/clientes` | Clientes |
| `/ventas`, `/ventas/dashboard`, `/ventas/reportes`, `/ventas/planes`, `/ventas/escrituras` | Inversionistas/Propietarios (Ventas) |
| `/arrendatarios` | Arrendatarios (Dashboard de cobranza) |
| `/arrendatarios/planes` | Arrendatarios (Planes de Renta) |
| `/arrendatarios/soporte` | Soporte a Inquilinos (incidentes por correo) |
| `/fideicomiso/dashboard`, `/fideicomiso/adhesiones`, `/fideicomiso/aportaciones`, `/fideicomiso/contabilidad`, `/fideicomiso/dispersiones`, `/fideicomiso/reportes` | Fideicomiso |
| `/parques`, `/parques/disponibilidad` | Parques |
| `/cxp/pagar` | CxP (Pagar solicitudes / tesorería) |
| `/cxp/aprobar` | CxP (Aprobar Solicitudes / aprobador) |
| `/cxp/solicitudes`, `/cxp/pendientes` | CxP (Solicitudes / Pendientes) |
| `/cxp/proveedores`, `/cxp/bancos` | CxP (Catálogos) |
| `/correo` | Correo (buzón de facturas) |
| `/configuraciones/usuarios` | Configuraciones (Usuarios) |
| `/registro` (público) | Configuraciones (Usuarios → registro por invitación) |
| `/configuraciones/parametros` | Configuraciones (Parámetros) |
| `/configuraciones/permisos` | Configuraciones (Permisos) |
| `/configuraciones/sistema` | Configuraciones (Sistema) |
| `/configuraciones/cambiar-contrasena` | Autenticación / Configuraciones |
| `/configuraciones/novedades` | Changelog / Novedades |
| `/configuraciones/cron` | Cron / Tareas programadas (solo soporte) |
| `/configuraciones/soporte` | Asistente de IA de Soporte — Auditoría de conversaciones + bandeja de tickets + **Recordatorios de aprobación CxP enviados** (solo soporte) |
