/**
 * Descripción de negocio de cada permiso (`segModulos.clave` → "para qué sirve").
 *
 * Redactadas contra el código real: cada texto se apoya en los endpoints que
 * exigen esa clave (`@RequierePermiso`) y en las pantallas que la consultan con
 * `tienePermiso()`, no en el nombre del catálogo. Alimentan la columna
 * «Descripción» de la pantalla de Permisos y la leyenda del reporte descargable
 * de la matriz.
 *
 * 📌 Viven en el código, no en la BD: `segModulos` no tiene columna de
 * descripción. Si se quiere que el área las edite sin desplegar, hay que agregar
 * esa columna (cambio de esquema — requiere autorización explícita).
 *
 * ⚠️ Al dar de alta una clave nueva en `segModulos`, agrégala aquí: si falta, la
 * pantalla la pinta con un «—» y el reporte con la celda vacía (no truena, pero
 * queda coja).
 */
export const DESCRIPCION_PERMISO: Record<number, string> = {
  /* ── Arrendatarios ── */
  10: 'Ver el tablero de Arrendatarios: cobranza del mes, naves pendientes y pagadas, y los paneles de contratos vencidos y por vencer.',
  20: 'Entrar a Planes de Renta: consultar los contratos de arrendamiento y su corrida de pagos.',
  21: 'Recalcular la corrida de un plan de renta (regenera las partidas del contrato).',
  22: 'Cancelar un plan de renta antes de su vencimiento.',
  23: 'Renovar un contrato al vencer, generando el plan del nuevo periodo.',
  24: 'Liberar la nave de un arrendatario: cierra el vínculo y la deja disponible.',
  25: 'Configurar el plan de renta: crear y editar partidas, montos, fechas y conceptos.',
  30: 'Entrar al módulo de cobro de agua a los inquilinos.',
  31: 'Ver la bandeja de incidentes que los inquilinos reportan por correo.',
  32: 'Responder por correo un incidente de inquilinos desde el ERP.',
  33: 'Clasificar un incidente (categoría y prioridad) y moverlo en el tablero.',
  34: 'Configurar el módulo de incidentes: cuenta de correo, firma y parámetros.',
  35: 'Asignar incidentes a un agente responsable.',
  36: 'Ver los incidentes de todos los agentes y no solo los propios (visibilidad de gerencia).',

  /* ── Comisiones ── */
  100: 'Entrar al módulo de comisiones.',

  /* ── Configuraciones ── */
  200: 'Entrar a la administración de usuarios (y a la bitácora de auditoría del sistema).',
  201: 'Ver el padrón completo de usuarios, no solo los propios o subordinados.',
  202: 'Dar de alta usuarios nuevos por invitación.',
  203: 'Editar los datos de un usuario existente.',
  204: 'Eliminar usuarios del sistema.',
  205: 'Bloquear (banear) el acceso de un usuario sin eliminarlo.',
  206: 'Administrar los perfiles y roles de usuario.',
  210: 'Entrar a los parámetros del sistema.',
  211: 'Editar los parámetros generales (IVA y valores globales).',
  212: 'Capturar el INPC y aplicar los incrementos automáticos de renta; administrar los responsables de parque.',
  213: 'Administrar el catálogo de cuentas bancarias.',
  214: 'Definir los periodos de captura de Cuentas por Pagar (qué días se pueden registrar facturas).',
  215: 'Administrar el catálogo de claves del SAT.',
  216: 'Publicar avisos en la pizarra de la pantalla de inicio.',
  220: 'Entrar a esta pantalla: asignar permisos por usuario, aplicar plantillas y descargar la matriz.',
  221: 'Configurar la identidad del sistema: logos, colores y dominios autorizados.',
  230: 'Entrar al módulo de tareas.',
  231: 'Consultar los manuales de uso de la aplicación.',
  240: 'Cambiar la propia contraseña desde Configuraciones.',

  /* ── CRM ── */
  300: 'Entrar al padrón de clientes: inversionistas, arrendatarios, tickets y usuarios finales.',
  301: 'Ver el tablero del CRM.',
  310: 'Administrar el catálogo de empresas.',
  320: 'Entrar al módulo de leads (prospectos comerciales).',
  321: 'Aprobar los leads capturados antes de que entren al embudo.',
  322: 'Dar de alta un lead.',
  323: 'Capturar un pre-lead: contacto preliminar aún sin calificar.',
  324: 'Editar los datos de un lead existente.',
  325: 'Ver los leads de todo el equipo (vista de gerencia).',
  326: 'Vista de administrador de leads: reasignar y gestionar la cartera completa.',
  327: 'Eliminar leads.',
  328: 'Consultar el reporte de leads sin interacciones (sin seguimiento reciente).',
  330: 'Administrar las inmobiliarias y brokers externos.',
  340: 'Configurar el CRM: catálogos y parámetros del embudo.',
  350: 'Administrar las carteras de clientes por ejecutivo.',
  360: 'Entrar al módulo de soporte del CRM.',

  /* ── Cuentas por Pagar ── */
  400: 'Pagar solicitudes: aplicar los pagos de las facturas ya aprobadas.',
  401: 'Desaplicar (revertir) un pago ya aplicado.',
  402: 'Ver las solicitudes aprobadas que todavía no tienen pago aplicado.',
  403: 'Dispensar el complemento de pago (REP) de una factura PPD cuando el proveedor no lo entrega.',
  410: 'Administrar el padrón de proveedores.',
  420: 'Capturar y consultar solicitudes de pago, incluidas las facturas PPD y sus parcialidades.',
  430: 'Aprobar, rechazar o regresar las solicitudes de pago que llegan a tu bandeja.',
  431: 'Aprobar solicitudes que exceden el presupuesto asignado.',
  440: 'Ver el tablero de Cuentas por Pagar.',
  441: 'Ver el tablero de CxP con la información de toda la empresa y no solo la propia.',
  450: 'Ver la bandeja de solicitudes pendientes de trámite.',
  460: 'Consultar los reportes de Cuentas por Pagar.',
  470: 'Administrar los bancos y sus movimientos en CxP.',

  /* ── Fideicomiso ── */
  500: 'Ver el tablero del Fideicomiso.',
  510: 'Administrar las aportaciones de los fideicomitentes y su rendimiento.',
  511: 'Modificar el rendimiento calculado de una aportación.',
  520: 'Configurar las adhesiones al fideicomiso (números de adhesión y condiciones). Da acceso además a la pantalla de Contabilidad.',
  530: 'Calcular y consultar la dispersión de rendimientos a los fideicomitentes.',
  540: 'Consultar los reportes del Fideicomiso (Kardex).',

  /* ── Inversionistas / Ventas ── */
  600: 'Ver el tablero de Ventas: cobranza, naves con atrasos y avance del periodo.',
  610: 'Administrar los planes de pago de los inversionistas (naves vendidas) y registrar sus pagos.',
  611: 'Trasladar el saldo de un plan de pagos a otro.',
  620: 'Consultar el dashboard gráfico y los reportes de Ventas (cobranza y saldos vencidos).',
  630: 'Dar seguimiento a las escrituras: estatus y fecha de escrituración por nave.',

  /* ── Parques ── */
  700: 'Consultar los parques industriales, sus naves y el historial de cada nave.',
  701: 'Dar de alta parques.',
  702: 'Dar de alta naves dentro de un parque.',
  710: 'Ver la disponibilidad de naves: ocupadas, libres y vendidas.',

  /* ── Correo ── */
  800: 'Entrar al buzón de correo integrado en el ERP.',
  801: 'Configurar la cuenta de correo (IMAP/SMTP) del buzón.',
};

/** Descripción de un permiso; cadena vacía si la clave aún no está documentada. */
export const descripcionPermiso = (clave: number): string =>
  DESCRIPCION_PERMISO[clave] ?? '';
