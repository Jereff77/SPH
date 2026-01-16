# Propuesta de Solución para Políticas RLS en segModulosUsuarios

## [Fecha y Hora]: 07/11/2025 06:38:00

## Problema Identificado

**Síntoma**: La función `segmodulosusuarios_smu()` funciona en modo Read-Only (`p_ro = true`) pero falla en modo Completo (`p_ro = false`) cuando un usuario intenta consultar permisos de otro usuario.

**Error**: `new row violates row-level security policy for table "segModulosUsuarios" (SQLSTATE: 42501)`

**Causa Raíz**: La tabla `segModulosUsuarios` solo tiene políticas RLS para SELECT y UPDATE con condición `true`, pero la función intenta hacer INSERT cuando `p_ro = false`, y no existe una política RLS que permita INSERT.

## Análisis del Problema

### Estado Actual de Políticas RLS
```sql
-- Políticas actuales en segModulosUsuarios
CREATE POLICY segmodulosusuarios_select ON public."segModulosUsuarios"
    FOR SELECT USING (true);  -- Permite todo a usuarios autenticados

CREATE POLICY segmodulosusuarios_update ON public."segModulosUsuarios"
    FOR UPDATE USING (true);  -- Permite todo a usuarios autenticados
```

### Problema Principal
- **Falta política INSERT**: No existe política para INSERT
- **Función intenta INSERT**: Cuando `p_ro = false`, la función intenta sincronizar módulos faltantes
- **Violación RLS**: El INSERT es bloqueado porque no hay política que lo permita

## Propuestas de Solución

### Opción 1: Política RLS Basada en Permisos (Recomendada)

Crear políticas RLS que validen los permisos específicos del usuario:

```sql
-- Eliminar políticas actuales
DROP POLICY IF EXISTS segmodulosusuarios_select ON public."segModulosUsuarios";
DROP POLICY IF EXISTS segmodulosusuarios_update ON public."segModulosUsuarios";

-- Política SELECT basada en permisos
CREATE POLICY segmodulosusuarios_select_permisos ON public."segModulosUsuarios"
    FOR SELECT USING (
        -- Puede ver sus propios permisos siempre
        uid = auth.uid() 
        OR 
        -- Puede ver permisos de otros si tiene permiso 201
        EXISTS (
            SELECT 1 FROM public."segModulosUsuarios" smu_inner
            WHERE smu_inner.uid = auth.uid()
              AND smu_inner.modulo = 'Configuraciones'
              AND smu_inner.seccion = 'Usuarios'
              AND smu_inner.clave = 201
              AND smu_inner.acceso = true
        )
    );

-- Política INSERT para usuarios con permiso 202
CREATE POLICY segmodulosusuarios_insert_crear_permisos ON public."segModulosUsuarios"
    FOR INSERT WITH CHECK (
        -- Solo usuarios con permiso 202 pueden crear/actualizar permisos
        EXISTS (
            SELECT 1 FROM public."segModulosUsuarios" smu_inner
            WHERE smu_inner.uid = auth.uid()
              AND smu_inner.modulo = 'Configuraciones'
              AND smu_inner.seccion = 'Usuarios'
              AND smu_inner.clave = 202
              AND smu_inner.acceso = true
        )
    );

-- Política UPDATE para usuarios con permiso 203
CREATE POLICY segmodulosusuarios_update_modificar_permisos ON public."segModulosUsuarios"
    FOR UPDATE USING (
        -- Puede actualizar sus propios permisos siempre
        uid = auth.uid() 
        OR 
        -- Puede actualizar permisos de otros si tiene permiso 203
        EXISTS (
            SELECT 1 FROM public."segModulosUsuarios" smu_inner
            WHERE smu_inner.uid = auth.uid()
              AND smu_inner.modulo = 'Configuraciones'
              AND smu_inner.seccion = 'Usuarios'
              AND smu_inner.clave = 203
              AND smu_inner.acceso = true
        )
    );
```

### Opción 2: Política RLS Jerárquica (Alternativa)

Basada en el perfil del usuario:

```sql
-- Política SELECT jerárquica
CREATE POLICY segmodulosusuarios_select_jerarquica ON public."segModulosUsuarios"
    FOR SELECT USING (
        -- Siempre puede ver sus propios permisos
        uid = auth.uid()
        OR
        -- Soporte y Gerencia pueden ver todo
        EXISTS (
            SELECT 1 FROM public."catUsers" u
            WHERE u.uid = auth.uid()
              AND u."idPerfil" IN (1, 2)  -- Soporte y Gerencia
        )
        OR
        -- Administradores pueden ver todo
        EXISTS (
            SELECT 1 FROM public."catUsers" u
            WHERE u.uid = auth.uid()
              AND u."idPerfil" = 3  -- Administrador
        )
    );

-- Política INSERT jerárquica
CREATE POLICY segmodulosusuarios_insert_jerarquica ON public."segModulosUsuarios"
    FOR INSERT WITH CHECK (
        -- Soporte, Gerencia y Administradores pueden insertar
        EXISTS (
            SELECT 1 FROM public."catUsers" u
            WHERE u.uid = auth.uid()
              AND u."idPerfil" IN (1, 2, 3)  -- Soporte, Gerencia, Administrador
        )
    );
```

### Opción 3: Modificar Función (Solución Temporal)

Mantener políticas actuales pero modificar la función:

```sql
CREATE OR REPLACE FUNCTION public.segmodulosusuarios_smu(p_uid uuid, p_ro boolean DEFAULT false)
RETURNS TABLE(...)
LANGUAGE plpgsql
SECURITY DEFINER  -- Cambiar a DEFINER para evitar problemas RLS
AS $BODY$
DECLARE
    v_tiene_permiso_201 boolean;
    v_tiene_permiso_202 boolean;
BEGIN
    -- Verificar permisos del usuario actual
    SELECT EXISTS(
        SELECT 1 FROM public."segModulosUsuarios" smu
        WHERE smu.uid = auth.uid()
          AND smu.modulo = 'Configuraciones'
          AND smu.seccion = 'Usuarios'
          AND smu.clave = 201
          AND smu.acceso = true
    ) INTO v_tiene_permiso_201;
    
    SELECT EXISTS(
        SELECT 1 FROM public."segModulosUsuarios" smu
        WHERE smu.uid = auth.uid()
          AND smu.modulo = 'Configuraciones'
          AND smu.seccion = 'Usuarios'
          AND smu.clave = 202
          AND smu.acceso = true
    ) INTO v_tiene_permiso_202;
    
    -- Solo permitir sincronización si tiene permisos adecuados
    IF NOT p_ro AND NOT (v_tiene_permiso_201 OR v_tiene_permiso_202) THEN
        RAISE EXCEPTION 'No tienes permisos para sincronizar módulos de otros usuarios';
    END IF;
    
    -- Continuar con el código existente...
    -- [resto del código de la función]
END;
$BODY$;
```

## Recomendación Final

### Solución Recomendada: Opción 1

**Ventajas**:
- **Control granular**: Basado en permisos específicos (201, 202, 203)
- **Seguridad**: Solo usuarios autorizados pueden modificar permisos
- **Flexibilidad**: Permite casos especiales sin comprometer seguridad
- **Auditoría**: Fácil de rastrear quién puede hacer qué

**Implementación**:
1. Aplicar el script de la Opción 1
2. Probar con diferentes usuarios y perfiles
3. Verificar que la función funcione correctamente en ambos modos

### Pruebas Recomendadas

```sql
-- Prueba 1: Usuario con permiso 201 (jereff@aceleremos.com)
SELECT * FROM public.segmodulosusuarios_smu('58b87c88-b5c5-4c7b-9723-78d96659ba4d', false);

-- Prueba 2: Usuario sin permisos 201
SELECT * FROM public.segmodulosusuarios_smu('uid_sin_permiso_201', false);

-- Prueba 3: Modo Read-Only (debe funcionar siempre)
SELECT * FROM public.segmodulosusuarios_smu('58b87c88-b5c5-4c7b-9723-78d96659ba4d', true);
```

## Script Completo de Implementación

```sql
-- [Fecha y Hora]: 07/11/2025 06:38:00
-- [Descripción]: Implementación de políticas RLS seguras para segModulosUsuarios
--                basadas en permisos específicos de gestión de usuarios

-- Paso 1: Eliminar políticas actuales
DROP POLICY IF EXISTS segmodulosusuarios_select ON public."segModulosUsuarios";
DROP POLICY IF EXISTS segmodulosusuarios_update ON public."segModulosUsuarios";

-- Paso 2: Crear política SELECT basada en permisos
CREATE POLICY segmodulosusuarios_select_permisos ON public."segModulosUsuarios"
    FOR SELECT USING (
        -- Puede ver sus propios permisos siempre
        uid = auth.uid() 
        OR 
        -- Puede ver permisos de otros si tiene permiso 201
        EXISTS (
            SELECT 1 FROM public."segModulosUsuarios" smu_inner
            WHERE smu_inner.uid = auth.uid()
              AND smu_inner.modulo = 'Configuraciones'
              AND smu_inner.seccion = 'Usuarios'
              AND smu_inner.clave = 201
              AND smu_inner.acceso = true
        )
    );

-- Paso 3: Crear política INSERT para usuarios con permiso 202
CREATE POLICY segmodulosusuarios_insert_crear_permisos ON public."segModulosUsuarios"
    FOR INSERT WITH CHECK (
        -- Solo usuarios con permiso 202 pueden crear/actualizar permisos
        EXISTS (
            SELECT 1 FROM public."segModulosUsuarios" smu_inner
            WHERE smu_inner.uid = auth.uid()
              AND smu_inner.modulo = 'Configuraciones'
              AND smu_inner.seccion = 'Usuarios'
              AND smu_inner.clave = 202
              AND smu_inner.acceso = true
        )
    );

-- Paso 4: Crear política UPDATE para usuarios con permiso 203
CREATE POLICY segmodulosusuarios_update_modificar_permisos ON public."segModulosUsuarios"
    FOR UPDATE USING (
        -- Puede actualizar sus propios permisos siempre
        uid = auth.uid() 
        OR 
        -- Puede actualizar permisos de otros si tiene permiso 203
        EXISTS (
            SELECT 1 FROM public."segModulosUsuarios" smu_inner
            WHERE smu_inner.uid = auth.uid()
              AND smu_inner.modulo = 'Configuraciones'
              AND smu_inner.seccion = 'Usuarios'
              AND smu_inner.clave = 203
              AND smu_inner.acceso = true
        )
    );

-- Paso 5: Verificación de políticas creadas
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'segModulosUsuarios' AND schemaname = 'public'
ORDER BY policyname;
```

## Conclusión

El problema se debe a que las políticas RLS actuales en `segModulosUsuarios` son demasiado permisivas (`true`) pero no incluyen operaciones INSERT, que la función `segmodulosusuarios_smu()` necesita cuando sincroniza módulos.

La solución recomendada implementa **control granular basado en permisos específicos**, asegurando que:
- Solo usuarios con permisos adecuados puedan ver/crear/modificar permisos de otros
- Todos puedan ver sus propios permisos
- La función de sincronización funcione correctamente
- Se mantenga la seguridad y auditoría del sistema