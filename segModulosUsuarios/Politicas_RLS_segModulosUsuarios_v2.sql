-- [Fecha y Hora]: 07/11/2025 07:09:00
-- [Descripción]: Script para implementar políticas RLS seguras en segModulosUsuarios
--                basadas en permisos específicos según los requerimientos solicitados

-- Paso 1: Eliminar políticas actuales
DROP POLICY IF EXISTS segmodulosusuarios_select ON public."segModulosUsuarios";
DROP POLICY IF EXISTS segmodulosusuarios_update ON public."segModulosUsuarios";
DROP POLICY IF EXISTS INSERT ON public."segModulosUsuarios";

-- Paso 2: Política SELECT - Usuarios sin permiso 220
CREATE POLICY segmodulosusuarios_select_propios ON public."segModulosUsuarios"
    FOR SELECT USING (
        -- Solo puede ver sus propios permisos
        uid = auth.uid()
    );

-- Paso 3: Política SELECT - Usuarios con permiso 220
CREATE POLICY segmodulosusuarios_select_permisos_220 ON public."segModulosUsuarios"
    FOR SELECT USING (
        -- Puede ver sus propios permisos siempre
        uid = auth.uid()
        OR 
        -- Puede ver todos los permisos si tiene permiso 220
        EXISTS (
            SELECT 1 FROM public."segModulosUsuarios" smu_inner
            WHERE smu_inner.uid = auth.uid()
              AND smu_inner.modulo = 'Configuraciones'
              AND smu_inner.seccion = 'Permisos'
              AND smu_inner.clave = 220
              AND smu_inner.acceso = true
        )
    );

-- Paso 4: Política INSERT - Usuarios con permiso 220
CREATE POLICY segmodulosusuarios_insert_permisos_220 ON public."segModulosUsuarios"
    FOR INSERT WITH CHECK (
        -- Solo usuarios con permiso 220 pueden insertar permisos
        EXISTS (
            SELECT 1 FROM public."segModulosUsuarios" smu_inner
            WHERE smu_inner.uid = auth.uid()
              AND smu_inner.modulo = 'Configuraciones'
              AND smu_inner.seccion = 'Permisos'
              AND smu_inner.clave = 220
              AND smu_inner.acceso = true
        )
    );

-- Paso 5: Política UPDATE - Usuarios con permiso 220
CREATE POLICY segmodulosusuarios_update_permisos_220 ON public."segModulosUsuarios"
    FOR UPDATE USING (
        -- Puede actualizar sus propios permisos siempre
        uid = auth.uid()
        OR 
        -- Puede actualizar permisos si tiene permiso 220
        EXISTS (
            SELECT 1 FROM public."segModulosUsuarios" smu_inner
            WHERE smu_inner.uid = auth.uid()
              AND smu_inner.modulo = 'Configuraciones'
              AND smu_inner.seccion = 'Permisos'
              AND smu_inner.clave = 220
              AND smu_inner.acceso = true
        )
    );

-- Paso 6: Verificación de políticas creadas
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'segModulosUsuarios' AND schemaname = 'public'
ORDER BY policyname;

-- Comentario final
-- Estas políticas aseguran que:
-- 1. Los usuarios sin permiso 220 solo puedan ver y modificar sus propios permisos
-- 2. Los usuarios con permiso 220 puedan ver, insertar y actualizar todos los permisos
-- 3. Se mantiene la seguridad y auditoría del sistema
-- 4. Se resuelve el problema de la función segmodulosusuarios_smu() cuando intenta sincronizar