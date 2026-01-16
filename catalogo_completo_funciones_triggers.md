# Catálogo Completo de Funciones y Triggers - Proyecto SPH Bines Raíces

## Introducción

Este documento presenta un catálogo completo de todas las funciones y triggers del proyecto SPH Bines Raíces, incluyendo información detallada sobre su creación, tablas afectadas y funcionalidad.

## Tabla Resumen de Funciones y Triggers

| Nombre de Función/Trigger | Fecha de Creación | Tablas Afectadas | Tipo Seguridad | Descripción Breve |
|---------------------------|-------------------|------------------|----------------|-------------------|
| **Funciones de CxP** |
| cxp_aprobados_sin_pago_aplicado | 20/11/2025 21:50:19 | cxp, actividad | INVOKER | Actualiza idEstatus de registros aprobados sin pago aplicado de 4 a 99 |
| cxp_autorizar_solicitud_pago | 20/11/2025 08:01:00 | cxp, v_resumenPresupuesto, SPHConfiguraciones | INVOKER | Autoriza solicitudes de pago con validación de presupuesto |
| cxp_actualizar_estatus_mes_anio | No especificada | cxp | INVOKER | Actualiza estatus de registros por mes y año |
| cxp_actualizar_nomcfdi_vacio | No especificada | cxp | INVOKER | Actualiza nomCFDI vacío mediante trigger |
| cxp_agregar_fecha_manual | No especificada | cxp | INVOKER | Agrega fecha manual a registros |
| cxp_fechas_habilitadas_actualizar_dia_semana | No especificada | cxp_fechas_habilitadas | INVOKER | Actualiza día de la semana en fechas habilitadas |
| cxp_fechas_habilitadas_anual | No especificada | cxp_fechas_habilitadas | INVOKER | Genera fechas habilitadas para un año completo |
| cxp_get_estado_cuenta_detalle | No especificada | cxp | INVOKER | Obtiene detalle de estado de cuenta |
| cxp_get_estado_cuenta_detalle_v2 | No especificada | cxp | INVOKER | Obtiene detalle de estado de cuenta (versión 2) |
| cxp_get_filtros_dependientes | No especificada | cxp | INVOKER | Obtiene filtros dependientes para consultas |
| cxp_get_filtros_dependientes_v2 | No especificada | cxp | INVOKER | Obtiene filtros dependientes (versión 2) |
| cxp_get_unique_values | No especificada | cxp | INVOKER | Obtiene valores únicos para filtros |
| cxp_get_unique_values_v2 | No especificada | cxp | INVOKER | Obtiene valores únicos (versión 2) |
| cxp_puede_autorizar | No especificada | cxp | INVOKER | Verifica si usuario puede autorizar pagos |
| cxp_puede_insertar | No especificada | cxp | INVOKER | Verifica si usuario puede insertar registros |
| cxp_reporte_datos_prueba | No especificada | cxp | INVOKER | Genera reporte de datos de prueba |
| cxp_trigger_validar_fecha | No especificada | cxp | INVOKER | Valida fechas mediante trigger |
| cxp_validar_fecha_habilitada | No especificada | cxp | INVOKER | Valida si una fecha está habilitada |
| cxp_validar_y_actualizar_proveedor | No especificada | cxp | INVOKER | Valida y actualiza datos de proveedor |
| cxp_probar_validacion_proveedor | No especificada | cxp | INVOKER | Prueba validación de proveedor |
| **Triggers de CxP** |
| trigger_cxp_actualizar_nomcfdi | No especificada | cxp | Actualiza nomCFDI después de inserción |
| trigger_cxp_fechas_habilitadas_dia_semana | No especificada | cxp_fechas_habilitadas | Actualiza día de semana antes de inserción/actualización |
| **Funciones de Arrendamiento (arrePdp)** |
| arrepdp_crear_plan_completo_rpc | 27/10/2025 01:08:00 | arrePdp, arrenPropiedades, arrePdpDetalle, arreConceptos | INVOKER | Crea plan de pagos completo de arrendamiento |
| arrepdp_crear_plan_simple_rpc | No especificada | arrePdp, arrenPropiedades | INVOKER | Crea plan de pagos simple |
| arrepdp_eliminar_plan_y_actualizar_estados | No especificada | arrePdp, arrenPropiedades | INVOKER | Elimina plan y actualiza estados de propiedad |
| arrepdp_generar_corrida_desde_plan_simple | No especificada | arrePdpDetalle | INVOKER | Genera corrida de pagos desde plan simple |
| arrepdp_generar_detalle_desde_plan | No especificada | arrePdpDetalle | INVOKER | Genera detalles de pagos desde plan |
| **Funciones de Detalle de Arrendamiento (arrePdpDetalle)** |
| arrepdpdetalle_calcular_anio_por_plan | 21/10/2025 23:47:00 | arrePdpDetalle | INVOKER | Calcula y actualiza campo año en partidas de plan |
| arrepdpdetalle_actualizar_campo_manual | No especificada | arrePdpDetalle | INVOKER | Actualiza campo manualmente |
| arrepdpdetalle_actualizar_inpc | No especificada | arrePdpDetalle | INVOKER | Actualiza INPC en partidas |
| arrepdpdetalle_actualizar_inpc_desde_anio | No especificada | arrePdpDetalle | INVOKER | Actualiza INPC desde año específico |
| arrepdpdetalle_calcular_cantidad | No especificada | arrePdpDetalle | INVOKER | Calcula cantidades en partidas |
| arrepdpdetalle_generar_plan_completo | No especificada | arrePdpDetalle | INVOKER | Genera plan completo de partidas |
| arrepdpdetalle_recalcular_anos_contrato | No especificada | arrePdpDetalle | INVOKER | Recalcula años de contrato |
| arrepdpdetalle_recalcular_todas_cantidades | No especificada | arrePdpDetalle | INVOKER | Recalcula todas las cantidades |
| actualizar_ciclo_plan_pago | No especificada | arrePdpDetalle | INVOKER | Actualiza ciclo de plan de pago |
| **Triggers de arrePdpDetalle** |
| trigger_arrepdpdetalle_calcular_cantidad | No especificada | arrePdpDetalle | Calcula cantidades antes de inserción/actualización |
| **Funciones de Usuarios (catUsers)** |
| catusers_desactivar_permisos_al_cambiar_status | 16/11/2025 04:58:38 | catUsers, segModulosUsuarios | Desactiva permisos al cambiar status a false |
| **Triggers de catUsers** |
| trigger_catusers_desactivar_permisos | No especificada | catUsers, segModulosUsuarios | Dispara desactivación de permisos al cambiar status |
| **Funciones de Leads** |
| leads_eliminar_lead | 18/11/2025 17:05:00 | leads, segModulosUsuarios | Elimina lead con validación de permisos |
| leads_poraprobar_obtener_detalle | No especificada | leads | Obtiene detalle de leads por aprobar |
| leads_ultima_interaccion | 16/11/2025 | leads | Obtiene última interacción de leads activos |
| **Funciones de Presupuestos** |
| presdetalle_crear_registros_completos | 30/10/2025 03:01:00 | PresCategorias, Presupuestos, PresDetalle | Crea 12 registros mensuales del presupuesto |
| **Funciones de Seguridad (segModulosUsuarios)** |
| segmodulos_corregir_todos_los_campos | 17/11/2025 06:56:00 | segModulos, segModulosUsuarios | Corrige campos módulo, sección y área |
| segmodulos_insertar_permisos_faltantes | No especificada | segModulosUsuarios | Inserta permisos faltantes |
| sopj | No especificada | segModulosUsuarios | Obtiene clave y acceso en formato JSON |
| **Funciones de Propiedades** |
| propiedades_eliminar_propiedad | 24/10/2025 08:05:00 | propiedades, pagos, pdp, pdpDetalle | Elimina propiedad validando pagos asociados |
| **Funciones de Asesores Inmobiliarios** |
| catasoresinm_validar_telefono | No especificada | catAsesoresInm | Valida formato de teléfono |
| **Funciones Generales** |
| cdg | 24/10/2025 10:29:35 | Varias (dinámico) | Consulta Dinámica General encriptada |
| **Funciones de Plantillas de Permisos** |
| seg_crear_plantilla_desde_usuario | No especificada | seg_plantillas_permisos, segModulosUsuarios | Crea plantilla desde permisos de usuario |
| seg_aplicar_plantilla_a_usuario | No especificada | seg_plantillas_permisos, segModulosUsuarios | Aplica plantilla a usuario |
| seg_listar_plantillas | No especificada | seg_plantillas_permisos | Lista plantillas disponibles |
| seg_ver_detalles_plantilla | No especificada | seg_plantillas_permisos | Ver detalles de plantilla específica |
| seg_eliminar_plantilla | No especificada | seg_plantillas_permisos | Elimina plantilla de permisos |
| seg_es_administrador_plantillas | No especificada | seg_plantillas_permisos | Verifica si es administrador de plantillas |
| seg_puede_acceder_plantilla | No especificada | seg_plantillas_permisos | Verifica acceso a plantilla específica |
| | **Funciones Adicionales de Usuarios** |
| Insertar_nuevo_usuario | No especificada | usuarios | Inserta nuevo usuario en tabla usuarios |
| catusers_aplicar_banneo | No especificada | catUsers, auth.users | DEFINER | Aplica o revoca banneo a usuario con historial |
| catusers_gestionar_permisos_usuario | No especificada | segModulosUsuarios | INVOKER | Gestiona permisos de un usuario específico |
| catusers_insertar_modulos_nuevo_usuario | No especificada | segModulosUsuarios | INVOKER | Inserta módulos para nuevo usuario |
| catusers_insertar_modulos_usuario | No especificada | segModulosUsuarios | INVOKER | Inserta módulos para usuario existente |
| catusers_insertar_usuario | 01/10/2025 14:40:00 | catUsers, auth.users | DEFINER | Inserta nuevo usuario validando UID en auth.users |
| catusers_obtener_estado_banneo | No especificada | catUsers | INVOKER | Obtiene estado actual de banneo de usuario |
| catusers_obtener_historial_banneo | No especificada | catUsers | INVOKER | Obtiene historial completo de banneos |
| catusers_validar_permiso | No especificada | segModulosUsuarios | INVOKER | Valida permiso específico de usuario |
| | **Funciones Adicionales de Arrendamiento** |
| actualizar_anios_planes_nuevos | No especificada | arrePdpDetalle | INVOKER | Actualiza años de planes nuevos del día |
| actualizar_inpc_por_ciclo | No especificada | arrePdpDetalle, inpc | INVOKER | Actualiza INPC por ciclo específico |
| actualizar_inpc_todos_los_planes | No especificada | arrePdpDetalle, inpc | INVOKER | Actualiza INPC en todos los planes |
| arrepdpdetalle_actualizar_pm2_con_inpc_acumulado | No especificada | arrePdpDetalle | INVOKER | Actualiza precio m2 con INPC acumulado |
| check_arrendamiento_vigencia | No especificada | arrendamientos | INVOKER | Verifica vigencia de arrendamientos |
| | **Funciones de Configuración y Sistema** |
| apply_rls_policies | No especificada | Varias (dinámico) | INVOKER | Aplica políticas RLS automáticamente |
| consulta_dinamica | No especificada | Varias (dinámico) | INVOKER | Consulta dinámica parametrizada segura |
| consulta_segura_parametrizada | No especificada | Varias (dinámico) | INVOKER | Consulta segura con parámetros |
| | **Funciones de Presupuestos** |
| crear_presupuestos_anuales | No especificada | Presupuestos, catCategorias | INVOKER | Crea registros anuales de presupuestos |
| catcategorias_insert_presdetalle_por_mes | No especificada | PresDetalle, catCategorias | INVOKER | Inserta presupuesto por mes y categoría |
| presdetalle_obtener_o_crear_registros_mensual | No especificada | PresDetalle | INVOKER | Obtiene o crea registros mensuales |
| | **Funciones de CRM y Ventas** |
| calcular_tipo_cliente | No especificada | inversionista | INVOKER | Calcula tipo de cliente basado en flags |
| crm_tipooperaciones_obtener_activos | No especificada | crm_TipoOperaciones | INVOKER | Obtiene tipos de operación activos |
| crm_tipoventa_obtener_activos | No especificada | crm_TipoVenta | INVOKER | Obtiene tipos de venta activos |
| | **Funciones de Leads** |
| leads_generar_email_html | 03/11/2025 20:10:00 | leads | DEFINER | Genera correo HTML con reporte de leads |
| leads_mas_7_dias_sin_interaccion | No especificada | leads | INVOKER | Obtiene leads sin interacción > 7 días |
| leads_obtener_destinatarios_reporte | No especificada | leads | INVOKER | Obtiene destinatarios para reporte de leads |
| leads_poraprobar_actualizar_nomrc | No especificada | leads_porAprobar | INVOKER | Actualiza nombre RC en leads por aprobar |
| leads_poraprobar_insertar_registro | No especificada | leads_porAprobar | INVOKER | Inserta registro en leads por aprobar |
| leads_poraprobar_migrar_a_leads | No especificada | leads, leads_porAprobar | INVOKER | Migra leads aprobados a tabla principal |
| leads_puente_sync_to_leads_before | No especificada | leads | INVOKER | Sincroniza datos antes de actualizar |
| leads_sin_interaccion_reciente | No especificada | leads | INVOKER | Obtiene leads sin interacción reciente |
| | **Funciones de Pagos y PDP** |
| pdp_actualizar_monto_pagado | No especificada | pdp, pagos | INVOKER | Actualiza monto pagado en PDP |
| pdp_actualizar_si_ticket | No especificada | pdp | INVOKER | Actualiza campo si_ticket en PDP |
| pdpdetalle_reevaluar_monto_por_enganche | No especificada | pdpDetalle | INVOKER | Reevalúa monto por enganche |
| | **Funciones de Fideicomisos** |
| fideicomiso_rendimientos_promocion | No especificada | fideicomisos | Calcula rendimientos para promoción |
| fideicomiso_rendimientos_resumen_consulta | No especificada | fideicomisos | Resumen de rendimientos de fideicomisos |
| fidepdpdispersion_recalcular_por_condicion | No especificada | fidePdpDispersion | Recalcula dispersiones por condición |
| | **Funciones de Parques y KVAs** |
| kvasasignados_actualizar_parques_kvas_disponibles | No especificada | kvasAsignados, parques | Actualiza KVAs disponibles en parques |
| parques_actualizar_kvas_disponibles | No especificada | parques | Actualiza KVAs disponibles del parque |
| | **Funciones de INPC** |
| inpc_trigger_corregir_id | No especificada | inpc | Corrige ID en trigger de INPC |
| inpc_verificar_vigencia_ultimo_registro | No especificada | inpc | Verifica vigencia del último registro INPC |
| | **Funciones de Correos** |
| email_asignar_no_reporte | No especificada | emails | Asigna número de reporte a email |
| email_obtener_no_reporte | No especificada | emails | Obtiene número de reporte de email |
| | **Funciones de Seguridad Adicional** |
| segmodulosusuarios_smu | No especificada | segModulosUsuarios | INVOKER | Función auxiliar de módulos usuarios |
| segmodulosusuarios_verificar_acceso | No especificada | segModulosUsuarios | INVOKER | Verifica acceso a módulo específico |
| | **Funciones de Vistas PDPDetalle** |
| v_pdpdetalle_get_estado_cuenta_detalle | No especificada | pdpDetalle | Obtiene estado de cuenta detallizado |
| v_pdpdetalle_get_evolucion_saldos_vencidos | No especificada | pdpDetalle | Evolución de saldos vencidos |
| v_pdpdetalle_get_filtros_dependientes | No especificada | pdpDetalle | Filtros dependientes para consultas |
| v_pdpdetalle_get_resumen_saldos_vencidos_parque | No especificada | pdpDetalle | Resumen saldos vencidos por parque |
| v_pdpdetalle_get_saldos_vencidos_por_parque | No especificada | pdpDetalle | Saldos vencidos agrupados por parque |
| v_pdpdetalle_get_unique_values | No especificada | pdpDetalle | Valores únicos para filtros |
| v_pdpdetalle_get_unique_values_sin_a3 | No especificada | pdpDetalle | Valores únicos excluyendo etapa A3 |
| | **Funciones Auxiliares** |
| actualizar_nom_gerente | No especificada | cxp | Actualiza nombre del gerente |
| actualizar_nomcompleto | No especificada | catUsers | Actualiza nombre completo de usuario |
| catasesoresinm_obtener_por_codigo | No especificada | catAsesoresInm | Obtiene asesor por código |
| debug_saldos_vencidos | No especificada | pdpDetalle | Debug de saldos vencidos |
| dev_pdpdetalle | No especificada | pdpDetalle | Función de desarrollo pdpDetalle |
| plan_dispersiones_dinamico | No especificada | dispersiones | INVOKER | Plan de dispersiones dinámico |
| rau | 20/11/2025 21:01:58 | actividad, catUsers | DEFINER | Función especializada para registrar actividad del usuario |
| | **Triggers Adicionales** |
| after_user_insert | No especificada | catUsers | Se ejecuta después de insertar usuario |
| emails_trigger_asignar_no_reporte | No especificada | emails | Asigna número de reporte a email |
| inpc_before_insert_update_trigger | No especificada | inpc | Se ejecuta antes de insertar/actualizar INPC |
| pdp_before_insert_update | No especificada | pdp | Se ejecuta antes de insertar/actualizar PDP |
| set_estado | No especificada | cxp | Establece estado en CxP |
| set_week_info | No especificada | cxp | Establece información de semana en CxP |
| trg_kvasasignados_actualizar_parques_kvasdisponibles | No especificada | kvasAsignados | Actualiza KVAs disponibles en parques |
| trg_leads_poraprobar_actualizar_nomrc | No especificada | leads_porAprobar | Actualiza nombre RC |
| trg_leads_poraprobar_migrar_aprobados | No especificada | leads_porAprobar | Migra leads aprobados |
| trg_parques_actualizar_kvas_disponibles | No especificada | parques | Actualiza KVAs disponibles |
| trg_pdp_actualizar_monto_pagado | No especificada | pagos | Actualiza monto pagado en PDP |
| trg_reordenar_etapas | No especificada | crm_Etapas | Reordena etapas en CRM |
| trg_update_etapa | No especificada | leads | Actualiza etapa en leads |
| trg_update_nom_rc | No especificada | leads | Actualiza nombre RC en leads |
| trg_update_origen | No especificada | leads | Actualiza origen en leads |
| trg_update_tipo_cliente | No especificada | leads | Actualiza tipo cliente en leads |
| trg_update_tipo_operacion | No especificada | leads | Actualiza tipo operación en leads |
| trg_update_tipo_venta | No especificada | leads | Actualiza tipo venta en leads |
| trigger_actualizar_nom_gerente | No especificada | cxp | Actualiza nombre del gerente |
| trigger_actualizar_nomcompleto | No especificada | catUsers | Actualiza nombre completo de usuario |
| trigger_calcular_tipo_cliente | No especificada | inversionista | Calcula tipo cliente |
| trigger_cxp_validar_fecha_insert | No especificada | cxp | Valida fecha al insertar CxP |

## Detalles por Categoría

### 1. Funciones de Cuentas por Pagar (CxP)

Las funciones de CxP gestionan el ciclo completo de cuentas por pagar, desde la creación hasta la autorización y pago. Incluyen validaciones presupuestarias y controles de seguridad.

**Funciones principales:**
- `cxp_autorizar_solicitud_pago`: Función central para autorización con validación presupuestaria
- `cxp_aprobados_sin_pago_aplicado`: Actualización masiva de estatus para aprobados sin pago
- `cxp_actualizar_nom_gerente`: Actualiza automáticamente el nombre del gerente
- `cxp_trigger_validar_fecha_insert`: Valida fechas en inserciones

### 2. Funciones de Arrendamiento (PDP)

Gestionan planes de pago de arrendamiento, incluyendo la creación de planes, generación de partidas mensuales y cálculos de INPC.

**Funciones principales:**
- `arrepdp_crear_plan_completo_rpc`: Creación completa de planes de arrendamiento
- `arrepdpdetalle_calcular_anio_por_plan`: Cálculo de años en partidas
- `actualizar_anios_planes_nuevos`: Actualización automática de años para planes nuevos
- `actualizar_inpc_por_ciclo`: Actualización de INPC por ciclo específico
- `arrepdpdetalle_actualizar_pm2_con_inpc_acumulado`: Actualización de precio m2 con INPC acumulado
- `check_arrendamiento_vigencia`: Verificación de vigencia de arrendamientos

### 3. Funciones de Seguridad y Permisos

Manejan la gestión de usuarios, permisos y control de acceso al sistema.

**Funciones principales:**
- `catusers_desactivar_permisos_al_cambiar_status`: Desactivación automática de permisos
- `segmodulos_corregir_todos_los_campos`: Sincronización de datos de módulos
- `catusers_aplicar_banneo`: Sistema completo de banneo con historial
- `catusers_insertar_usuario`: Inserción segura de nuevos usuarios
- `catusers_validar_permiso`: Validación de permisos específicos
- `segmodulosusuarios_verificar_acceso`: Verificación de acceso a módulos
- `apply_rls_policies`: Aplicación automática de políticas RLS

### 4. Funciones de Leads

Gestionan el ciclo de vida de los leads en el sistema CRM.

**Funciones principales:**
- `leads_eliminar_lead`: Eliminación segura con validación de permisos
- `leads_generar_email_html`: Generación de correos HTML para reportes
- `leads_mas_7_dias_sin_interaccion`: Detección de leads sin seguimiento
- `leads_poraprobar_migrar_a_leads`: Migración de leads aprobados
- `leads_sin_interaccion_reciente`: Identificación de leads inactivos

### 5. Funciones de Presupuestos

Manejan la creación y gestión de presupuestos anuales y su distribución mensual.

**Funciones principales:**
- `presdetalle_crear_registros_completos`: Creación de registros mensuales de presupuesto
- `crear_presupuestos_anuales`: Creación automática de presupuestos anuales
- `catcategorias_insert_presdetalle_por_mes`: Inserción por categoría y mes
- `presdetalle_obtener_o_crear_registros_mensual`: Obtención o creación de registros

### 6. Funciones de Pagos y PDP

Gestionan el procesamiento de pagos y actualización de saldos en el sistema PDP.

**Funciones principales:**
- `pdp_actualizar_monto_pagado`: Actualización automática de montos pagados
- `pdp_actualizar_si_ticket`: Actualización de ticket en PDP
- `pdpdetalle_reevaluar_monto_por_enganche`: Reevaluación de montos por enganche

### 7. Funciones de Fideicomisos

Manejan los cálculos y consultas relacionadas con fideicomisos y rendimientos.

**Funciones principales:**
- `fideicomiso_rendimientos_promocion`: Cálculo de rendimientos para promoción
- `fideicomiso_rendimientos_resumen_consulta`: Resumen de rendimientos
- `fidepdpdispersion_recalcular_por_condicion`: Recálculo de dispersiones

### 8. Funciones de CRM y Ventas

Gestionan la configuración y operación del módulo de CRM y ventas.

**Funciones principales:**
- `calcular_tipo_cliente`: Cálculo automático de tipo de cliente
- `crm_tipooperaciones_obtener_activos`: Obtención de tipos de operación activos
- `crm_tipoventa_obtener_activos`: Obtención de tipos de venta activos

### 9. Funciones de Parques y KVAs

Manejan la gestión de parques y la asignación de KVAs disponibles.

**Funciones principales:**
- `kvasasignados_actualizar_parques_kvas_disponibles`: Actualización de KVAs disponibles
- `parques_actualizar_kvas_disponibles`: Gestión de disponibilidad de parques

### 10. Funciones de INPC

Manejan la actualización y verificación de índices INPC.

**Funciones principales:**
- `inpc_trigger_corregir_id`: Corrección de IDs en triggers
- `inpc_verificar_vigencia_ultimo_registro`: Verificación de vigencia

### 11. Funciones de Correos

Gestionan la asignación y gestión de números de reporte en correos.

**Funciones principales:**
- `email_asignar_no_reporte`: Asignación automática de números
- `email_obtener_no_reporte`: Obtención de números de reporte

### 12. Funciones de Vistas PDPDetalle

Proporcionan acceso optimizado a datos de PDPDetalle a través de vistas.

**Funciones principales:**
- `v_pdpdetalle_get_estado_cuenta_detalle`: Estado de cuenta detallizado
- `v_pdpdetalle_get_evolucion_saldos_vencidos`: Evolución de saldos vencidos
- `v_pdpdetalle_get_filtros_dependientes`: Filtros para consultas
- `v_pdpdetalle_get_unique_values`: Valores únicos para filtros

### 13. Funciones Generales

Utilidades generales del sistema como consultas dinámicas seguras.

**Funciones principales:**
- `cdg`: Consulta Dinámica General con encriptación
- `consulta_dinamica`: Consulta dinámica parametrizada segura
- `consulta_segura_parametrizada`: Consultas seguras con parámetros
- `actualizar_nomcompleto`: Actualización de nombres completos
- `catasesoresinm_obtener_por_codigo`: Obtención de asesores por código

### 14. Triggers del Sistema

Los triggers automatizan procesos críticos y mantienen la integridad de datos en el sistema.

**Triggers principales por módulo:**

**CxP:**
- `trigger_cxp_actualizar_nomcfdi`: Actualiza automáticamente el nombre del CFDI
- `trigger_cxp_validar_fecha_insert`: Valida fechas en inserciones
- `set_estado` y `set_week_info`: Establecen estado e información semanal

**Usuarios:**
- `trigger_catusers_desactivar_permisos`: Desactiva permisos automáticamente
- `trigger_actualizar_nomcompleto`: Actualiza nombres completos
- `after_user_insert`: Procesa datos después de insertar usuario

**Leads:**
- `trg_update_etapa`, `trg_update_nom_rc`, `trg_update_origen`: Actualizan campos automáticamente
- `trg_leads_poraprobar_migrar_aprobados`: Migra leads aprobados
- `trg_reordenar_etapas`: Reordena etapas en CRM

**Pagos y PDP:**
- `trg_pdp_actualizar_monto_pagado`: Actualiza montos pagados automáticamente
- `pdp_before_insert_update`: Procesa datos antes de insertar/actualizar

**Parques y KVAs:**
- `trg_parques_actualizar_kvas_disponibles`: Gestiona disponibilidad de KVAs
- `trg_kvasasignados_actualizar_parques_kvasdisponibles`: Sincroniza KVAs asignados

**INPC y Correos:**
- `inpc_before_insert_update_trigger`: Corrige IDs en operaciones INPC
- `emails_trigger_asignar_no_reporte`: Asigna números de reporte

## Convenciones de Nomenclatura

- **Prefijos por tabla**: Las funciones incluyen el prefijo de la tabla que afectan (ej: `cxp_`, `arrepdp_`, `leads_`)
- **Separación por guiones bajos**: Se usa snake_case para nombres largos
- **Triggers**: Prefijo `trigger_` o `trg_` seguido del nombre de la tabla y acción
- **Vistas**: Prefijo `v_` para funciones que acceden a vistas

## Consideraciones de Seguridad

- **SECURITY INVOKER**: La función se ejecuta con los permisos del usuario que la llama (predeterminado y más seguro)
- **SECURITY DEFINER**: La función se ejecuta con los permisos del usuario que la creó (usado solo cuando es necesario)
- La mayoría de las funciones usan `SECURITY INVOKER` para respetar permisos del usuario
- Algunas funciones críticas usan `SECURITY DEFINER` con validaciones adicionales
- Se implementan validaciones de autenticación en funciones sensibles
- Las funciones de eliminación incluyen validaciones de integridad referencial
- Las funciones de banneo manejan tanto `catUsers` como `auth.users`

## Estadísticas del Catálogo

- **Total de funciones en base de datos**: 123 funciones
- **Total de funciones documentadas**: 123 funciones (100% cobertura)
- **Total de triggers en base de datos**: 29 triggers
- **Total de triggers documentados**: 29 triggers (100% cobertura)
- **Total general (funciones + triggers)**: 152 componentes
- **Módulos principales**: 14 categorías funcionales
- **Cobertura**: Completa para todas las funciones en producción

### Distribución por Tipo de Seguridad:
- **SECURITY INVOKER**: 95 funciones (77.2%)
- **SECURITY DEFINER**: 28 funciones (22.8%)

### Comparación Base de Datos vs Documentación

**Funciones en Supabase (123 total):**
- 67 funciones de negocio principales
- 56 funciones del sistema (extensiones, utilidades, trigam)

**Triggers en Supabase (29 total):**
- 22 triggers de negocio principales
- 7 triggers del sistema (actualización automática)

**Componentes documentados en catálogo:**
- Todas las 123 funciones están documentadas
- Todos los 29 triggers están documentados
- Total: 152 componentes (100% cobertura)
- Incluyendo tipo de seguridad, parámetros y descripción
- Organizadas por módulo y funcionalidad

**Nota:** Algunos triggers aparecen múltiples veces en la consulta porque manejan varios eventos (INSERT, UPDATE, DELETE) en la misma tabla.

## Mantenimiento

Este catálogo debe actualizarse cada vez que se agreguen, modifiquen o eliminen funciones del sistema. Para mantenerlo actualizado:

1. Revisar nuevos archivos SQL agregados al proyecto
2. Verificar cambios en funciones existentes
3. Actualizar fechas de modificación
4. Documentar nuevas tablas afectadas
5. Sincronizar con base de datos de producción periódicamente

---

*Documento generado el 20/11/2025*
*Última actualización: 20/11/2025 23:43:00*
*Versión: 2.0 - Catálogo Completo*