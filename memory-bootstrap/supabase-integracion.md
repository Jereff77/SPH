# Integración Supabase

## Proyecto

- **Ref:** `szjlkvakwljssdnysazp`
- **URL:** `https://szjlkvakwljssdnysazp.supabase.co`
- **MCP configurado:** `.mcp.json` → herramientas `supaSPH` en Claude Code

```json
{
  "mcpServers": {
    "supaSPH": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=szjlkvakwljssdnysazp"
    }
  }
}
```

## Clientes Supabase

```typescript
// Browser (componentes cliente)
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Servidor (Server Components, Server Actions, middleware)
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
export async function createClient() { /* SSR adapter */ }
```

## Variables de entorno requeridas

```
NEXT_PUBLIC_SUPABASE_URL=https://szjlkvakwljssdnysazp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

## Tablas del CRM Ventas

| Tabla | Descripción |
|-------|-------------|
| `crm_reports` | Definición de reportes |
| `crm_widgets` | Widgets dentro de reportes (tipo, fuente, campos) |
| `crm_reporte_permisos` | Control de acceso: creador/editor/visor |
| `leads` | Leads / prospectos |
| `leads_porAprobar` | Leads pendientes de aprobación |
| `actividad_historica` | Historial de actividades por lead |

## Vistas materializadas

| Vista | Uso |
|-------|-----|
| `v_leads_completo` | Datos completos de leads para reportes |
| `v_actividades_completo` | Datos completos de actividades para reportes |

## Tablas compartidas del ERP (no duplicar)

| Tabla | Descripción |
|-------|-------------|
| `catAsesoresInm` | Catálogo de asesores de inmobiliaria |
| `catInmobiliarias` | Catálogo de inmobiliarias |
| `catUsers` | Usuarios con roles y permisos |
| `segModulosUsuarios` | Asignación de módulos a usuarios |

## RLS — patrones aplicados

- **Asesores**: solo ven sus propios leads (`auth.uid()`)
- **Gerentes/Admin**: ven todos los registros
- **Reportes**: visibilidad `privado/publico/restringido` + roles `creador/editor/visor`
- Las políticas leen roles de `catUsers` y módulos de `segModulosUsuarios`
- **SIEMPRE** `SECURITY INVOKER` en funciones — nunca `SECURITY DEFINER` salvo necesidad explícita

## Módulo 340

- `/catalogos` requiere que el usuario tenga el módulo `340` asignado en `segModulosUsuarios`
- El middleware lo verifica antes de permitir acceso

## Convenciones SQL del ecosistema SPH

### Nomenclatura

| Elemento | Formato | Ejemplo |
|----------|---------|---------|
| Funciones | `[modulo]_[tabla]_[accion]` | `crm_leads_asignar_asesor` |
| Funciones RPC | sufijo `_rpc` | `crm_leads_crear_rpc` |
| Triggers | `trigger_[tabla]_[accion]` | `trigger_leads_webhook_uidrc` |
| Vistas | prefijo `v_` | `v_pipeline_ventas` |
| Parámetros | prefijo `p_` | `p_idlead`, `p_uid` |
| Variables locales | prefijo `v_` | `v_resultado`, `v_etapa` |

### Campos con mayúsculas — siempre entre comillas dobles

```sql
-- Correcto
SELECT "idLead", "idAsesor", "fecCreacion" FROM public.leads;
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

### Retorno estándar RPC

```json
{ "exito": true, "datos": <any>, "mensaje": "texto" }
```

### Conversiones de tipo obligatorias

```sql
p_uid::uuid          -- text → uuid
p_monto::numeric     -- text → numeric
p_etapa::integer     -- text → integer
'Nuevo'::"estadoLead"  -- text → enum
```

### Encabezado obligatorio en funciones

```sql
--[Fecha]: DD/MM/YYYY HH:MM:SS
--[Descripción]: Qué hace
--[Parámetros]: - p_nombre (tipo): descripción
--[Salida]: tipo — descripción
--[Uso típico]: cuándo se llama
--[Relaciones]: tablas y funciones relacionadas
```

### Códigos de error estándar

```
PARAMETRO_INVALIDO, REGISTRO_NO_ENCONTRADO, LEAD_DUPLICADO,
ASESOR_INACTIVO, ETAPA_INVALIDA, SIN_PERMISO
```
