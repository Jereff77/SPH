# Diagnóstico del Problema RLS en segModulosUsuarios

## [Fecha y Hora]: 07/11/2025 06:06:00

## Problema Reportado

**Usuario**: jereff@aceleremos.com (Juanjereff Lopez)
**Perfil**: Soporte
**Permiso**: 201 (Ver todos los usuarios) - CONFIRMADO como activo

**Error Recibido**:
```json
{
    "code": "P0001",
    "details": null,
    "hint": null,
    "message": "CDG Error: [MODO COMPLETO] Error al procesar módulos: new row violates row-level security policy for table \"segModulosUsuarios\" (SQLSTATE: 42501)"
}
```

**Función Problemática**: `segmodulosusuarios_smu('32e36384-e5e0-409f-bf7e-7e5d008a0223')`

## Análisis del Problema

### 1. Verificación de Permisos del Usuario
✅ **Confirmado**: El usuario jereff@aceleremos.com SÍ tiene el permiso 201 activo
- Email: jereff@aceleremos.com
- Perfil: Soporte
- Módulo: Configuraciones → Usuarios → Ver todos los usuarios
- Clave: 201
- Acceso: true

### 2. Políticas RLS en segModulosUsuarios
La tabla `segModulosUsuarios` tiene 2 políticas RLS activas:

#### Política 1: segmodulosusuarios_select
- **Tipo**: SELECT
- **Aplica a**: authenticated
- **Condición**: `true` (permite todo)

#### Política 2: segmodulosusuarios_update
- **Tipo**: UPDATE
- **Aplica a**: authenticated
- **Condición**: `true` (permite todo)

### 3. Análisis de la Función segmodulosusuarios_smu

#### Comportamiento Esperado
La función tiene dos modos de operación:
- **Modo Completo** (p_ro = false): Sincroniza módulos faltantes + retorna datos
- **Modo Read-Only** (p_ro = true): Solo retorna datos existentes

#### Operación Interna Crítica
```sql
INSERT INTO public."segModulosUsuarios" (modulo, seccion, area, clave, uid, acceso)
SELECT 
    sm.modulo,
    sm.seccion,
    sm.area,
    sm.clave,
    p_uid,
    false -- Por defecto sin acceso
FROM public."segModulos" sm
LEFT JOIN public."segModulosUsuarios" smu 
    ON sm.clave = smu.clave 
    AND smu.uid = p_uid
WHERE smu.uid IS NULL; -- Solo los que NO existen para este usuario
```

## Diagnóstico del Error

### Causa Principal
El error `new row violates row-level security policy` ocurre cuando la función intenta hacer un `INSERT` en `segModulosUsuarios` pero alguna política RLS está bloqueando la operación.

### Posibles Causas

#### 1. Política RLS Oculta o Adicional
Puede existir una política RLS adicional no visible en la consulta estándar que:
- Se aplica solo a operaciones INSERT
- Tiene condiciones restrictivas
- No aparece en `pg_policies` por alguna razón

#### 2. Contexto de Ejecución
La función podría estar ejecutándose con un contexto de usuario diferente:
- **auth.uid()** podría no corresponder a jereff@aceleremos.com
- El contexto podría ser de otro usuario

#### 3. Problema de Bypass o Elevación de Privilegios
La función podría necesitar:
- **SECURITY DEFINER** en lugar de **SECURITY INVOKER**
- Privilegios elevados para modificar la tabla

#### 4. Condición de Política Compleja
Alguna política podría tener condiciones complejas que:
- Evalúan el contexto del usuario
- Validan permisos específicos
- Bloquean ciertos usuarios o condiciones

## Soluciones Propuestas

### Solución 1: Verificar Contexto de Ejecución
```sql
-- Ejecutar para verificar el contexto actual
SELECT 
    current_user,
    session_user,
    auth.uid() as authenticated_uid,
    current_setting('request.jwt.claims', true) as jwt_claims;
```

### Solución 2: Modificar Función a SECURITY DEFINER
```sql
CREATE OR REPLACE FUNCTION public.segmodulosusuarios_smu(p_uid uuid, p_ro boolean DEFAULT false)
RETURNS TABLE(...)
LANGUAGE plpgsql
SECURITY DEFINER -- Cambiar a DEFINER
AS $BODY$
-- Código existente
$BODY$;
```

### Solución 3: Revisión Completa de Políticas RLS
```sql
-- Verificar todas las políticas incluyendo las del sistema
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'segModulosUsuarios' 
ORDER BY policyname;
```

### Solución 4: Ejecución en Modo Read-Only
Como workaround inmediato:
```sql
-- Usar modo Read-Only para evitar INSERT
SELECT * FROM public.segmodulosusuarios_smu('32e36384-e5e0-409f-bf7e-7e5d008a0223', true);
```

### Solución 5: Verificar Permisos del Usuario Objetivo
```sql
-- Verificar si puedes ver los permisos de Alma Galindo
SELECT 
    u.email,
    u.nomCompleto,
    p.nomPerfil,
    sm.modulo,
    sm.seccion,
    sm.area,
    sm.clave,
    sm.acceso
FROM public.catUsers u
LEFT JOIN public.perfil p ON u.idPerfil = p.nivel
LEFT JOIN public.segModulosUsuarios sm ON u.uid = sm.uid
WHERE u.email = 'agalindo@gruposph.mx'
AND sm.clave = 201;
```

## Pasos para Diagnóstico Completo

### Paso 1: Verificación Inmediata
1. Ejecutar la función en modo Read-Only
2. Verificar el contexto de autenticación actual
3. Consultar permisos directos sin usar la función

### Paso 2: Análisis de Políticas
1. Revisar todas las políticas RLS en segModulosUsuarios
2. Verificar si hay políticas con condiciones complejas
3. Identificar políticas que se apliquen solo a INSERT

### Paso 3: Prueba de Contexto
1. Ejecutar como usuario diferente
2. Verificar si el problema es específico del usuario
3. Probar con diferentes parámetros

## Recomendación Inmediata

**Workaround**: Usa el modo Read-Only de la función para evitar el error mientras se resuelve el problema:

```javascript
// En FlutterFlow
await supabase.rpc('segmodulosusuarios_smu', { 
    p_uid: '32e36384-e5e0-409f-bf7e-7e5d008a0223', 
    p_ro: true  // Modo Read-Only
});
```

Esto debería permitirte consultar los permisos de Alma Galindo sin intentar sincronizar módulos faltantes.

## Conclusión

El problema parece estar relacionado con una política RLS restrictiva que bloquea operaciones INSERT en `segModulosUsuarios` cuando se ejecuta desde ciertos contextos o bajo ciertas condiciones. La función está intentando sincronizar módulos (INSERT) pero una política lo está impidiendo.

Se recomienda una revisión completa de las políticas RLS y considerar modificar la función a SECURITY DEFINER o usar el modo Read-Only como solución temporal.