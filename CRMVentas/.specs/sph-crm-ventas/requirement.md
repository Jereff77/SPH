# Requerimientos — SPH CRM Ventas
**Versión:** 1.0 | **Fecha:** 2026-04-29 | **Estado:** Borrador

---

## Contexto del Proyecto

SPH Bienes Raíces Industriales es una empresa con 18 años de experiencia en desarrollo, venta y arrendamiento de naves industriales en México (Querétaro/Bajío) y EE.UU. El equipo comercial gestiona más de 5,200 leads activos. Se necesita un CRM de ventas propio, visual y ágil, que reemplace procesos manuales y centralice el seguimiento del pipeline inmobiliario industrial.

**Backend existente:** Supabase (`szjlkvakwljssdnysazp`) con todas las tablas CRM ya operativas.
**Autenticación:** Supabase Auth (ya configurada).
**Frontend:** Flutter (Web + Mobile) — ecosistema tecnológico ya adoptado por SPH.

---

## Usuarios del Sistema

| Rol | Descripción | Acceso |
|---|---|---|
| **Responsable Comercial (RC)** | Asesor de ventas. Gestiona sus propios leads. | Solo sus leads asignados |
| **Gerente** | Supervisión del equipo. Ve todo el pipeline. | Lectura de todos los leads |
| **Administrador** | Control total. Asigna, aprueba y elimina. | CRUD completo |

---

## Requerimientos Funcionales

### [REQ-001] Autenticación
- Login con email/contraseña via Supabase Auth
- Cierre de sesión
- Rol detectado automáticamente desde `catUsers` y `segModulosUsuarios`
- Sin registro público — solo el admin crea usuarios

### [REQ-002] Dashboard Principal
- **Tarjetas KPI** visibles al entrar sin scroll: total de leads, leads activos esta semana, tasa de conversión (Contrato Firmado / total), valor total del pipeline
- **Gráfico de embudo** (funnel) por etapas del pipeline — cuántos leads hay en cada etapa
- **Gráfico de barras** — leads por origen (crm_Origen)
- **Gráfico de línea** — leads registrados por mes (últimos 6 meses)
- **Top 5 leads sin actividad reciente** (+7 días) — acceso directo con 1 click
- **Leads pendientes de aprobación** — contador con acceso directo
- El dashboard se actualiza en tiempo real (Supabase Realtime)

### [REQ-003] Pipeline Kanban
- Columnas = etapas de `crm_Etapas` ordenadas por `orden`
- Cada columna muestra: nombre de etapa, contador de leads, suma de valor
- Cada tarjeta (card) muestra: nombre del lead, teléfono, inmobiliaria, días en etapa, valor, RC asignado
- **Arrastrar y soltar** para cambiar de etapa — registra en `crm_historial_etapas` y `activity_history`
- Filtros rápidos: por RC, por origen, por tipo de operación — máximo 1 click para aplicar
- Color de borde de tarjeta según calor (`heat_level` de última actividad): verde/amarillo/rojo

### [REQ-004] Lista de Leads
- Tabla con paginación (50 por página)
- Columnas: Nombre, Teléfono, Etapa, RC, Origen, Tipo Operación, Valor, Última actividad, Días sin actividad
- Búsqueda global (nombre, teléfono, correo)
- Filtros combinables: Etapa, RC, Origen, Tipo Operación, Tipo Cliente, Rango de fechas
- Acciones rápidas por fila: llamar (abre tel:), WhatsApp, ver detalle — sin abrir pantalla nueva
- Exportar a CSV (admin/gerente)
- Indicador visual de alerta si el lead lleva +7 días sin actividad

### [REQ-005] Detalle de Lead
- Todo en una sola pantalla sin tabs, con panel lateral o sección inferior para historial:
  - **Encabezado:** nombre, teléfono (clickeable), correo, inmobiliaria, asesor, indicador de calor
  - **Pipeline:** etapa actual con botones de avance/retroceso rápido y barra visual de progreso
  - **Clasificación:** origen, tipo cliente, tipo operación, tipo venta, campaña, valor
  - **Mensaje/necesidad** del lead
  - **Árbol de historial de actividades:** vista tipo timeline/árbol cronológico — cada nodo muestra ícono del tipo, fecha, nota, RC que registró; los nodos se expanden para ver detalle completo
  - **Nueva actividad inline:** formulario en la misma pantalla (no modal, no navegación), máximo 3 campos: tipo (select), nota (textarea), fecha agenda (datepicker opcional); el árbol se actualiza al guardar sin recargar la página
  - **Naves presentadas** — lista de naves de `crm_lead_naves` con precio y resultado
- Edición inline de campos clave (etapa, valor, RC) — sin pantalla de edición separada

### [REQ-006] Registro de Nuevo Lead
- Formulario de máximo 8 campos en una sola pantalla
- Campos: Nombre*, Teléfono*, Correo, Mensaje/Necesidad*, Origen*, Tipo Operación*, Tipo Venta, RC asignado
- Autocompletado de inmobiliaria si el teléfono ya existe
- Al guardar: valida duplicados por teléfono (similar a `leads_poraprobar_validar_y_migrar_similitud`)
- Confirmación de guardado visible sin salir de la pantalla

### [REQ-007] Aprobación de Leads Web (leads_porAprobar)
- Vista de bandeja de entrada de leads capturados por formulario web
- Cada tarjeta muestra: nombre, teléfono, superficie requerida, KVAs, ubicación, fecha
- Acciones: Aprobar (mueve a `leads`) | Rechazar (marca status=false) | Editar antes de aprobar
- Indicador de similitud si ya existe un lead parecido

### [REQ-008] Actividades y Seguimiento
- Registrar actividad desde cualquier pantalla (botón flotante o inline desde detalle de lead)
- Tipos desde `crm_tipoActividad`: Llamada, Correo, WhatsApp, Reunión, Visita, Agendar, Otro
- Al agendar: seleccionar fecha/hora → aparece en el dashboard, en el árbol del lead y en el **Calendario**
- Nivel de calor (heat_level): Frío / Tibio / Caliente — afecta color de tarjeta en Kanban

### [REQ-012] Calendario por Asesor
- Vista de calendario mensual y semanal de actividades agendadas (`fechaAgenda` en `activity_history`)
- Cada evento muestra: nombre del lead, tipo de actividad, hora, RC asignado
- Click en evento → navega directamente al detalle del lead
- Filtro por RC (gerente y admin pueden ver el calendario de cualquier asesor)
- Código de color por tipo de actividad (llamada = azul, visita = verde, WhatsApp = teal, etc.)
- Vista "Mi agenda" para el RC activo — solo sus eventos
- Integración con librería de calendario: `react-big-calendar` o `FullCalendar`

### [REQ-009] Naves Presentadas al Lead
- Desde el detalle del lead: buscar nave por nombre o parque
- Registrar: nave, precio cotizado, condiciones, resultado (presentada/interesado/propuesta enviada/descartada)
- Vista rápida de las naves disponibles con superficie, precio, parque

### [REQ-010] Notificaciones en App
- Alerta cuando se asigna un nuevo lead al RC
- Alerta cuando un lead lleva +7 días sin actividad
- Alerta de leads pendientes de aprobación (solo admin)

### [REQ-013] Integración Google (DIFERIDA — Fase 2)
- **Correo:** cada asesor configura su cuenta Gmail/Workspace en el CRM mediante SMTP + App Password (sin API de Google). El CRM envía correos en nombre del asesor desde el detalle del lead y los registra en el timeline
- **Recepción:** IMAP polling — las respuestas de clientes con tag `[SPH-{leadId}]` en el asunto se capturan y aparecen en el historial del lead
- **Google Calendar:** sincronización vía OAuth por usuario (cada asesor autoriza individualmente; el admin de Workspace aprueba la app en `admin.google.com` — sin revisión formal de Google). Las citas creadas en el CRM se crean también en el Google Calendar del asesor y viceversa
- **Prerequisito:** tramitar acceso a Google Workspace API antes de iniciar esta fase

### [REQ-011] Catálogos (solo Administrador)
- CRUD básico para: crm_Etapas, crm_Origen, crm_tipoOperaciones, crm_tipoVenta, crm_tipoCliente, crm_campania, crm_Recepcion
- Cada catálogo permite: activar/desactivar, reordenar, editar color (bkColor/txtColor)

---

## Requerimientos No Funcionales

### [NFR-001] Rendimiento
- Dashboard carga en < 2 segundos
- Kanban carga en < 1.5 segundos
- Transición entre pantallas < 300ms

### [NFR-002] Usabilidad — Regla de los 3 clicks
- Ninguna acción frecuente (registrar actividad, cambiar etapa, ver detalle) debe requerir más de 3 clicks desde cualquier pantalla

### [NFR-003] Visual / Diseño
- Paleta SPH: Gris oscuro `#2C2C2C` (primary), Blanco `#FFFFFF` (surface), Gris medio `#6B6B6B` (secondary)
- Color de acento: Dorado/Ámbar `#C9963A` (consistente con branding industrial premium)
- Tipografía: Inter (variable font vía next/font)
- Componentes: shadcn/ui con tema personalizado SPH (CSS variables, dark mode automático)
- Modo oscuro soportado (toggle en perfil, persistido en cookie)
- Gráficas con `Recharts` o `Tremor`
- Animaciones sutiles con `Framer Motion`

### [NFR-004] Compatibilidad
- Next.js App Router (v14+): Chrome, Edge, Safari, Firefox (últimas 2 versiones)
- Diseño responsivo: breakpoints 768px (tablet), 1280px (desktop)
- Optimizado para uso en desktop/laptop — CRM de oficina

### [NFR-005] Seguridad
- RLS de Supabase activo en todas las tablas
- Tokens JWT de Supabase con refresh automático
- Sin datos sensibles en localStorage

### [NFR-006] Caché y rendimiento web
- React Query (TanStack Query) para caché de datos en cliente con stale-while-revalidate
- Server Components de Next.js para carga inicial rápida sin hydration overhead
- Paginación con cursor para listas grandes (no offset)

---

## Restricciones

### [CON-001] Backend fijo
El esquema de Supabase ya existe y es de producción. No se pueden renombrar tablas ni eliminar columnas existentes. Solo se agregan nuevas tablas y columnas nullables.

### [CON-002] Autenticación
Exclusivamente Supabase Auth. No se implementa SSO, OAuth social ni 2FA en fase 1.

### [CON-003] Tecnología
Next.js 14+ (App Router) con TypeScript para la capa de presentación web. shadcn/ui como sistema de componentes. No Flutter para web.

### [CON-004] Fase 1
No incluye: múltiples contactos por lead, reportes avanzados, integración con email/WhatsApp API, integración con ERP de arrendamiento.

---

## Suposiciones

### [ASM-001]
El `project_ref` de Supabase (`szjlkvakwljssdnysazp`) permanece estable durante el desarrollo.

### [ASM-002]
Los usuarios del CRM ya existen en `catUsers`. No se requiere flujo de registro.

### [ASM-003]
Las naves disponibles se consultan desde la tabla `naves` ya existente.

### [ASM-004]
Las tablas `crm_historial_etapas`, `crm_lead_naves` y `crm_tipoActividad` serán creadas antes de iniciar el frontend (pendiente de migración).
