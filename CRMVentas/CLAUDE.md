# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Contexto del Proyecto

CRM de Ventas para **SPH Bines Raices** — sistema de seguimiento de prospectos, leads y pipeline comercial para la inmobiliaria. El backend es 100% Supabase (PostgreSQL + RLS + Edge Functions). La capa de presentación aún no está definida; el ecosistema SPH utiliza Flutter para consistencia tecnológica.

Este proyecto forma parte de un ecosistema mayor:
- **erp-rls/SPH**: ERP con RLS — arrendamientos, cuentas por pagar, planes de pago
- **CFDIs/SPH**: Procesamiento automático de facturas XML vía IMAP
- **soporte/SPH**: CRM de incidencias para parques comerciales

## Conexión Supabase

El proyecto se conecta al proyecto Supabase `szjlkvakwljssdnysazp` mediante el servidor MCP configurado en `mcp.json`. Usar las herramientas MCP `supaSPH` para consultar y modificar el esquema sin salir del editor.

```json
// mcp.json — ya configurado
{ "mcpServers": { "supaSPH": { "type": "http", "url": "https://mcp.supabase.com/mcp?project_ref=szjlkvakwljssdnysazp" } } }
```

## Gestión de Sesiones (Obligatorio)

Antes de iniciar cualquier tarea, verificar si existe `.sessions/contexto.md`. Si no existe, crearlo con la estructura del CLAUDE.md global. Al terminar trabajo significativo, agregar una entrada al archivo con las tareas realizadas, archivos modificados y decisiones tomadas.

## Convenciones SQL (Compartidas con el Ecosistema SPH)

### Nomenclatura

| Elemento | Formato | Ejemplo |
|---|---|---|
| Funciones | `[modulo]_[tabla]_[accion]` | `crm_leads_asignar_asesor` |
| Funciones RPC complejas | sufijo `_rpc` | `crm_leads_crear_rpc` |
| Triggers | `trigger_[tabla]_[accion]` | `trigger_leads_webhook_uidrc` |
| Vistas | prefijo `v_` | `v_pipeline_ventas` |
| Parámetros | prefijo `p_` | `p_idlead`, `p_uid` |
| Variables locales | prefijo `v_` | `v_resultado`, `v_etapa` |

### Campos con mayúsculas — siempre entre comillas dobles

```sql
-- Correcto
SELECT "idLead", "idAsesor", "fecCreacion" FROM public.leads;

-- Incorrecto
SELECT idLead, idAsesor FROM public.leads;
```

### Firma estándar de funciones

```sql
CREATE OR REPLACE FUNCTION public.nombre_funcion(
    p_param1 uuid,
    p_param2 text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $function$
```

- **Siempre** `SECURITY INVOKER` — nunca `SECURITY DEFINER` salvo necesidad explícita.
- Las funciones **no** controlan transacciones (sin BEGIN/COMMIT/ROLLBACK internos).
- Las funciones RPC retornan `jsonb` con estructura: `{"exito": bool, "datos": any, "mensaje": text}`.

### Conversiones explícitas de tipo (crítico)

```sql
p_uid::uuid          -- text → uuid
p_monto::numeric     -- text → numeric
p_etapa::integer     -- text → integer
'Nuevo'::"estadoLead"  -- text → enum
```

### Encabezado obligatorio para cada función

```sql
--[Fecha]: DD/MM/YYYY HH:MM:SS
--[Descripción]: Qué hace la función
--[Parámetros]:
--   - p_nombre (tipo): descripción
--[Salida]: tipo — descripción
--[Uso típico]: cuándo se llama
--[Relaciones]: tablas y funciones relacionadas
```

### Códigos de error estándar

```
PARAMETRO_INVALIDO, REGISTRO_NO_ENCONTRADO, LEAD_DUPLICADO,
ASESOR_INACTIVO, ETAPA_INVALIDA, SIN_PERMISO
```

### Scripts de instalación

- Cada módulo debe tener `instalar_todo.sql` que aplique las funciones y políticas RLS en orden.
- Los archivos de prueba se nombran `test_[nombre_funcion].sql`.

### Ejecutar SQL en Supabase

```bash
# Via MCP (preferido — sin salir del editor)
# Usar herramienta supaSPH desde Claude Code

# Via psql directo
psql "postgresql://postgres:[password]@db.szjlkvakwljssdnysazp.supabase.co:5432/postgres" -f archivo.sql
```

## Arquitectura Esperada del CRM Ventas

El sistema manejará el pipeline comercial de la inmobiliaria. Las entidades principales anticipadas son:

- **Leads/Prospectos**: contactos interesados en comprar o rentar
- **Propiedades**: inmuebles en cartera (referencia al catálogo del ERP)
- **Asesores**: del catálogo `catAsesoresInm` ya existente en el ERP
- **Etapas del pipeline**: estados del prospecto (Nuevo → Calificado → Propuesta → Cierre)
- **Actividades**: llamadas, citas, seguimientos registrados por asesor

## Políticas RLS

Seguir el mismo patrón del proyecto `erp-rls/SPH`:
- Los asesores solo ven sus propios leads.
- Los gerentes/admin ven todos los registros.
- Las políticas se aplican a nivel de tabla con `auth.uid()` y roles de `catUsers`.

## Notas de Integración con el ERP

- El catálogo de asesores (`catAsesoresInm`) y de inmobiliarias (`catInmobiliarias`) ya existen en el mismo proyecto Supabase.
- No duplicar esas tablas; referenciarlas mediante foreign keys.
- La tabla `catUsers` del ERP gestiona roles y permisos — el CRM Ventas debe respetar esa estructura.
