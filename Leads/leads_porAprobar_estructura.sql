--[Fecha y Hora]: 03/12/2025 11:44:00
--[Descripción]: Documentación de la estructura de la tabla leads_porAprobar del sistema supaSPH-QR.
--                Esta tabla funciona como área de staging para nuevos leads que requieren 
--                aprobación antes de ser incorporados al sistema principal de leads.
--
--[Estructura]: Tabla de almacenamiento temporal de leads pendientes de aprobación
--
--[Flujo de trabajo]:
--   1. Los leads ingresan inicialmente desde la tabla leads_puente
--   2. Pasan a leads_porAprobar para revisión y validación
--   3. El campo 'aprobado' controla el estado: NULL = pendiente, true = aprobado, false = rechazado
--   4. Los leads aprobados migran a la tabla principal leads
--   5. Los leads rechazados pueden eliminarse o mantenerse para auditoría
--
--[Relaciones]:
--   - catUsers (uidr): Usuario que registró el lead
--   - catUsers (uidRC): Usuario responsable comercial asignado
--   - catInmobiliarias (idInmobiliaria): Inmobiliaria asociada al lead
--   - catAsesoresInm (idAsesorInm): Asesor inmobiliario responsable
--   - crm_Etapas (idEtapa): Etapa actual del proceso del lead
--   - crm_Origen (idOrigen): Origen de donde provino el lead
--   - crm_tipoCliente (idTipoCliente): Tipo de cliente (ej. comprador, vendedor)
--   - crm_tipoOperaciones (idTipoOperacion): Tipo de operación (ej. venta, renta)
--   - crm_tipoVenta (idTipoVenta): Tipo específico de venta
--
--[Validaciones implementadas]:
--   - Campo 'aprobado' con valores NULL (pendiente), true (aprobado), false (rechazado)
--   - Relaciones de integridad referencial con tablas catálogo
--   - Campos descriptivos mantenidos automáticamente por triggers
--   - Control de estado mediante campo 'status' (boolean)
--
--[Uso típico]: 
--   - Almacenamiento temporal de nuevos leads antes de su aprobación
--   - Revisión y validación de información por parte de supervisores
--   - Control de calidad de datos antes de incorporar al sistema principal
--   - Auditoría de leads ingresados al sistema
--
--[Ejemplo]: 
--   -- Consultar leads pendientes de aprobación
--   SELECT * FROM "leads_porAprobar" WHERE "aprobado" IS NULL ORDER BY "fechaRegistro" DESC;
--   
--   -- Aprobar un lead específico
--   UPDATE "leads_porAprobar" SET "aprobado" = true WHERE id = 'uuid-del-lead';
--   
--   -- Rechazar un lead
--   UPDATE "leads_porAprobar" SET "aprobado" = false WHERE id = 'uuid-del-lead';

-- ============================================================================
-- ESTRUCTURA COMPLETA DE LA TABLA leads_porAprobar
-- ============================================================================

-- Tabla: leads_porAprobar
-- Descripción: Tabla de almacenamiento temporal para leads pendientes de aprobación

/*
CREATE TABLE public."leads_porAprobar" (
    -- Identificadores principales
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),                    -- Identificador único del lead
    uidr uuid NOT NULL,                                               -- Usuario que registró el lead (FK: catUsers.id)
    uidRC uuid,                                                       -- Usuario responsable comercial (FK: catUsers.id)
    
    -- Campos de estado y control
    status boolean DEFAULT true,                                      -- Estado del lead (true = activo, false = inactivo)
    fc timestamp with time zone DEFAULT now(),                        -- Fecha de creación del registro
    aprobado boolean,                                                 -- Estado de aprobación (NULL = pendiente, true = aprobado, false = rechazado)
    
    -- Información de contacto del lead
    nombreLead text,                                                  -- Nombre completo del lead/cliente
    telefono text,                                                    -- Teléfono de contacto
    correo text,                                                      -- Correo electrónico
    
    -- Relaciones con entidades externas
    idInmobiliaria uuid,                                              -- ID de la inmobiliaria (FK: catInmobiliarias.id)
    idAsesorInm uuid,                                                 -- ID del asesor inmobiliario (FK: catAsesoresInm.id)
    
    -- Fechas importantes
    fechaContacto timestamp with time zone,                           -- Fecha de contacto inicial
    fechaRegistro timestamp with time zone DEFAULT now(),             -- Fecha de registro en el sistema
    
    -- Información adicional
    mensaje text,                                                     -- Mensaje adicional o comentarios
    
    -- Clasificación del lead (catálogos CRM)
    idEtapa bigint,                                                   -- ID de la etapa del proceso (FK: crm_Etapas.id)
    idOrigen bigint,                                                  -- ID del origen del lead (FK: crm_Origen.id)
    idTipoCliente bigint,                                             -- ID del tipo de cliente (FK: crm_tipoCliente.id)
    idTipoOperacion bigint,                                           -- ID del tipo de operación (FK: crm_tipoOperaciones.id)
    idTipoVenta bigint,                                               -- ID del tipo de venta (FK: crm_tipoVenta.id)
    
    -- Información de la propiedad
    valor double precision,                                           -- Valor asociado a la propiedad/operación
    KVAs text,                                                        -- Campos adicionales (Key-Value pairs)
    superficie text,                                                  -- Superficie de la propiedad
    ubicacion text,                                                   -- Ubicación de la propiedad
    
    -- Campos descriptivos mantenidos por triggers
    -- Estos campos se actualizan automáticamente mediante triggers
    -- basados en los IDs de las tablas catálogo
    nombreInmobiliaria text,                                          -- Nombre descriptivo de la inmobiliaria
    nombreAsesorInm text,                                             -- Nombre descriptivo del asesor inmobiliario
    nombreEtapa text,                                                 -- Nombre descriptivo de la etapa
    nombreOrigen text,                                                -- Nombre descriptivo del origen
    nombreTipoCliente text,                                           -- Nombre descriptivo del tipo de cliente
    nombreTipoOperacion text,                                         -- Nombre descriptivo del tipo de operación
    nombreTipoVenta text                                              -- Nombre descriptivo del tipo de venta
);
*/

-- ============================================================================
-- DESCRIPCIÓN DETALLADA DE CAMPOS
-- ============================================================================

-- CAMPOS PRINCIPALES
-- ==================
-- id: Identificador único UUID generado automáticamente
-- uidr: UUID del usuario que registró el lead (obligatorio)
-- uidRC: UUID del usuario responsable comercial asignado (opcional)
-- status: Booleano que indica si el lead está activo (true) o inactivo (false)
-- fc: Timestamp de creación del registro (automático)
-- aprobado: Booleano que controla el estado de aprobación
--   - NULL: Pendiente de aprobación (valor por defecto)
--   - true: Aprobado, listo para migrar a tabla leads
--   - false: Rechazado

-- CAMPOS DE CONTACTO
-- ==================
-- nombreLead: Nombre completo del cliente/prospecto
-- telefono: Número telefónico de contacto
-- correo: Dirección de correo electrónico

-- CAMPOS DE RELACIÓN
-- ==================
-- idInmobiliaria: UUID que referencia a la inmobiliaria asociada
-- idAsesorInm: UUID que referencia al asesor inmobiliario responsable
-- fechaContacto: Fecha en que se estableció el primer contacto
-- fechaRegistro: Fecha en que se registró el lead en el sistema

-- CAMPOS DE CLASIFICACIÓN
-- =======================
-- mensaje: Comentarios o información adicional del lead
-- idEtapa: ID que referencia a la etapa actual del proceso (ej. inicial, contacto, visita)
-- idOrigen: ID que referencia al origen del lead (ej. web, referral, llamada)
-- idTipoCliente: ID que referencia al tipo de cliente (ej. comprador, vendedor, inversor)
-- idTipoOperacion: ID que referencia al tipo de operación (ej. venta, renta, traspaso)
-- idTipoVenta: ID que referencia al tipo específico de venta

-- CAMPOS DE PROPIEDAD
-- ===================
-- valor: Valor numérico asociado a la propiedad u operación
-- KVAs: Campos adicionales en formato key-value pairs
-- superficie: Descripción de la superficie de la propiedad
-- ubicacion: Descripción de la ubicación de la propiedad

-- CAMPOS DESCRIPTIVOS (mantenidos por triggers)
-- ============================================
-- nombreInmobiliaria: Nombre descriptivo de la inmobiliaria (actualizado por trigger)
-- nombreAsesorInm: Nombre descriptivo del asesor inmobiliario (actualizado por trigger)
-- nombreEtapa: Nombre descriptivo de la etapa (actualizado por trigger)
-- nombreOrigen: Nombre descriptivo del origen (actualizado por trigger)
-- nombreTipoCliente: Nombre descriptivo del tipo de cliente (actualizado por trigger)
-- nombreTipoOperacion: Nombre descriptivo del tipo de operación (actualizado por trigger)
-- nombreTipoVenta: Nombre descriptivo del tipo de venta (actualizado por trigger)

-- ============================================================================
-- FLUJO DE TRABAJO DETALLADO
-- ============================================================================

/*
1. INGRESO DESDE leads_puente
   =========================
   - Los nuevos leads ingresan primero a la tabla leads_puente
   - Mediante un proceso automatizado, se transfieren a leads_porAprobar
   - En este punto, el campo 'aprobado' se establece como NULL (pendiente)

2. PROCESO DE APROBACIÓN
   ======================
   - Los supervisores consultan los leads pendientes:
     SELECT * FROM "leads_porAprobar" WHERE "aprobado" IS NULL;
   
   - Revisan la información, validan datos y verifican calidad
   - Pueden actualizar campos si es necesario antes de aprobar
   
   - Toman decisión de aprobación:
     -- Aprobar lead
     UPDATE "leads_porAprobar" SET "aprobado" = true WHERE id = 'uuid-lead';
     
     -- Rechazar lead
     UPDATE "leads_porAprobar" SET "aprobado" = false WHERE id = 'uuid-lead';

3. MIGRACIÓN A TABLA leads
   ========================
   - Los leads aprobados (aprobado = true) migran automáticamente a la tabla leads
   - Este proceso puede ser manual o mediante un trigger/proceso automatizado
   - Una vez migrados, pueden eliminarse de leads_porAprobar o mantenerse para auditoría

4. MANEJO DE LEADS RECHAZADOS
   ===========================
   - Los leads rechazados (aprobado = false) pueden:
     * Eliminarse después de un período de tiempo
     * Mantenerse para análisis y auditoría
     * Revisarse nuevamente si se considera necesario
*/

-- ============================================================================
-- RELACIONES CON TABLAS DE CATÁLOGO
-- ============================================================================

/*
Relaciones de integridad referencial:

1. catUsers (uidr):
   - Relación con el usuario que registró el lead
   - Permite auditoría y seguimiento de quién ingresó cada lead

2. catUsers (uidRC):
   - Relación con el responsable comercial asignado
   - Permite asignación y seguimiento de leads a asesores específicos

3. catInmobiliarias (idInmobiliaria):
   - Relación con la inmobiliaria asociada al lead
   - Permite segmentación por inmobiliaria

4. catAsesoresInm (idAsesorInm):
   - Relación con el asesor inmobiliario externo
   - Útil para colaboraciones con agentes externos

5. crm_Etapas (idEtapa):
   - Relación con las etapas del proceso de venta
   - Permite seguimiento del progreso del lead

6. crm_Origen (idOrigen):
   - Relación con los orígenes de leads
   - Permite análisis de efectividad de canales de marketing

7. crm_tipoCliente (idTipoCliente):
   - Relación con los tipos de clientes
   - Permite segmentación y personalización de abordaje

8. crm_tipoOperaciones (idTipoOperacion):
   - Relación con los tipos de operaciones
   - Permite clasificación por tipo de transacción

9. crm_tipoVenta (idTipoVenta):
   - Relación con los tipos específicos de venta
   - Permite granularidad en la clasificación
*/

-- ============================================================================
-- CONSULTAS TÍPICAS DE USO
-- ============================================================================

/*
-- Consultar todos los leads pendientes de aprobación
SELECT 
    id, 
    "nombreLead", 
    "telefono", 
    "correo", 
    "fechaRegistro",
    "nombreOrigen",
    "nombreTipoCliente"
FROM "leads_porAprobar" 
WHERE "aprobado" IS NULL 
ORDER BY "fechaRegistro" DESC;

-- Consultar leads aprobados pendientes de migración
SELECT 
    id,
    "nombreLead",
    "nombreInmobiliaria",
    "nombreAsesorInm"
FROM "leads_porAprobar" 
WHERE "aprobado" = true 
ORDER BY "fechaRegistro" ASC;

-- Consultar leads rechazados
SELECT 
    id,
    "nombreLead",
    "fechaRegistro",
    "mensaje"
FROM "leads_porAprobar" 
WHERE "aprobado" = false 
ORDER BY "fechaRegistro" DESC;

-- Estadísticas de aprobación
SELECT 
    COUNT(*) as total_leads,
    COUNT(CASE WHEN "aprobado" IS NULL THEN 1 END) as pendientes,
    COUNT(CASE WHEN "aprobado" = true THEN 1 END) as aprobados,
    COUNT(CASE WHEN "aprobado" = false THEN 1 END) as rechazados
FROM "leads_porAprobar";

-- Leads por origen pendientes de aprobación
SELECT 
    "nombreOrigen",
    COUNT(*) as cantidad
FROM "leads_porAprobar" 
WHERE "aprobado" IS NULL 
GROUP BY "nombreOrigen" 
ORDER BY cantidad DESC;
*/

-- ============================================================================
-- CONSIDERACIONES DE SEGURIDAD Y PERMISOS
-- ============================================================================

/*
La tabla leads_porAprobar debe tener las siguientes consideraciones de seguridad:

1. POLÍTICAS RLS (Row Level Security):
   - Los usuarios solo pueden ver los leads que registraron (uidr = auth.uid())
   - Los supervisores pueden ver todos los leads pendientes
   - Los administradores pueden aprobar/rechazar leads

2. PERMISOS REQUERIDOS:
   - INSERT: Para registrar nuevos leads desde leads_puente
   - SELECT: Para consultar leads pendientes según rol
   - UPDATE: Para aprobar/rechazar leads (solo supervisores/administradores)
   - DELETE: Para eliminar leads rechazados o migrados

3. AUDITORÍA:
   - Mantener registro de quién aprueba/rechaza cada lead
   - Timestamp de aprobación/rechazo
   - Motivo de rechazo (si aplica)

4. INTEGRIDAD:
   - Validación de datos antes de la aprobación
   - Verificación de relaciones con tablas catálogo
   - Control de duplicados
*/

-- ============================================================================
-- NOTAS IMPORTANTES
-- ============================================================================

/*
1. Los campos descriptivos (nombreXXXX) se mantienen automáticamente mediante triggers
2. El campo 'aprobado' es NULL por defecto, indicando estado pendiente
3. La tabla funciona como área de staging, no es el destino final de los leads
4. Los leads aprobados deben migrarse a la tabla principal 'leads'
5. Considerar implementar procesos automatizados para la migración
6. Mantener políticas de seguridad adecuadas para proteger datos de clientes
7. Implementar auditoría completa para cumplimiento normativo
8. Considerar tiempos de vida para leads rechazados (ej. 30 días antes de eliminación)
*/

-- ============================================================================
-- FIN DE DOCUMENTACIÓN
-- ============================================================================

--[Notas de instalación]:
--   - Este archivo es solo documentación, no ejecuta comandos DDL
--   - La estructura real de la tabla debe estar creada previamente
--   - Los triggers para campos descriptivos deben implementarse por separado
--   - Las políticas RLS deben configurarse según los roles definidos
--
--[Mantenimiento]:
--   - Actualizar esta documentación cuando se modifiquen campos
--   - Revisar periódicamente las relaciones con tablas catálogo
--   - Verificar que los ejemplos de consulta sigan siendo válidos
--
--[Versión]: 1.0
--[Autor]: Sistema de Documentación supaSPH-QR
--[Proyecto]: SPH Bines Raices - Sistema de Gestión de Leads