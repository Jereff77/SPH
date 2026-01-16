--[Fecha y Hora]: 16/11/2025 10:52:00
--[Descripción]: Políticas RLS para las tablas del sistema de plantillas de permisos
--
--Este script establece las políticas de Row Level Security para las nuevas tablas
--siguiendo el mismo patrón que las políticas existentes en el sistema.
--
--Principios de seguridad:
--  - Solo usuarios con permiso 206 (Gestionar perfiles) pueden administrar plantillas
--  - Los creadores pueden ver y modificar sus propias plantillas
--  - Las plantillas públicas son visibles para todos los administradores
--  - Se mantiene la integridad referencial con las tablas existentes

-- ===============================================================================
-- POLÍTICAS PARA segPlantillasPermisos
-- ===============================================================================

-- Eliminar políticas existentes si las hay
DROP POLICY IF EXISTS "segplantillas_select_administradores" ON public."segPlantillasPermisos";
DROP POLICY IF EXISTS "segplantillas_insert_administradores" ON public."segPlantillasPermisos";
DROP POLICY IF EXISTS "segplantillas_update_administradores" ON public."segPlantillasPermisos";
DROP POLICY IF EXISTS "segplantillas_delete_administradores" ON public."segPlantillasPermisos";
DROP POLICY IF EXISTS "segplantillas_select_creadores" ON public."segPlantillasPermisos";
DROP POLICY IF EXISTS "segplantillas_update_creadores" ON public."segPlantillasPermisos";

-- Política 1: SELECT para administradores (permiso 206)
CREATE POLICY "segplantillas_select_administradores" ON public."segPlantillasPermisos"
    FOR SELECT
    TO authenticated
    USING (
        -- Usuarios con permiso de gestionar perfiles
        EXISTS (
            SELECT 1 FROM public."segModulosUsuarios" 
            WHERE "uid" = auth.uid() 
            AND "clave" = 206 
            AND "acceso" = true
        )
        OR
        -- Plantillas públicas
        "esPublica" = true
    );

-- Política 2: SELECT para creadores de sus propias plantillas
CREATE POLICY "segplantillas_select_creadores" ON public."segPlantillasPermisos"
    FOR SELECT
    TO authenticated
    USING (
        "uidCreador" = auth.uid()
    );

-- Política 3: INSERT para administradores
CREATE POLICY "segplantillas_insert_administradores" ON public."segPlantillasPermisos"
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public."segModulosUsuarios"
            WHERE "uid" = auth.uid()
            AND "clave" = 206
            AND "acceso" = true
        )
        AND
        -- El creador debe ser el usuario autenticado O un usuario válido especificado por el administrador
        (
            "uidCreador" = auth.uid()
            OR
            "uidCreador" IN (
                SELECT "uid" FROM public."catUsers" WHERE "status" = true
            )
        )
    );

-- Política 4: UPDATE para administradores
CREATE POLICY "segplantillas_update_administradores" ON public."segPlantillasPermisos"
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public."segModulosUsuarios" 
            WHERE "uid" = auth.uid() 
            AND "clave" = 206 
            AND "acceso" = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public."segModulosUsuarios" 
            WHERE "uid" = auth.uid() 
            AND "clave" = 206 
            AND "acceso" = true
        )
        AND
        -- No se permite cambiar el creador original
        "uidCreador" = COALESCE("uidCreador", auth.uid())
    );

-- Política 5: UPDATE para creadores de sus propias plantillas
CREATE POLICY "segplantillas_update_creadores" ON public."segPlantillasPermisos"
    FOR UPDATE
    TO authenticated
    USING (
        "uidCreador" = auth.uid()
    )
    WITH CHECK (
        "uidCreador" = auth.uid()
        AND
        -- Los creadores no pueden hacer públicas sus plantillas sin permiso de administrador
        (
            "esPublica" = false 
            OR 
            EXISTS (
                SELECT 1 FROM public."segModulosUsuarios" 
                WHERE "uid" = auth.uid() 
                AND "clave" = 206 
                AND "acceso" = true
            )
        )
    );

-- Política 6: DELETE para administradores
CREATE POLICY "segplantillas_delete_administradores" ON public."segPlantillasPermisos"
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public."segModulosUsuarios" 
            WHERE "uid" = auth.uid() 
            AND "clave" = 206 
            AND "acceso" = true
        )
        OR
        -- Los creadores pueden eliminar sus propias plantillas
        "uidCreador" = auth.uid()
    );

-- ===============================================================================
-- POLÍTICAS PARA segDetallesPlantilla
-- ===============================================================================

-- Eliminar políticas existentes si las hay
DROP POLICY IF EXISTS "segdetalles_select_administradores" ON public."segDetallesPlantilla";
DROP POLICY IF EXISTS "segdetalles_insert_administradores" ON public."segDetallesPlantilla";
DROP POLICY IF EXISTS "segdetalles_update_administradores" ON public."segDetallesPlantilla";
DROP POLICY IF EXISTS "segdetalles_delete_administradores" ON public."segDetallesPlantilla";
DROP POLICY IF EXISTS "segdetalles_select_creadores" ON public."segDetallesPlantilla";

-- Política 1: SELECT para administradores
CREATE POLICY "segdetalles_select_administradores" ON public."segDetallesPlantilla"
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public."segPlantillasPermisos" sp
            WHERE sp."idPlantilla" = "segDetallesPlantilla"."idPlantilla"
            AND sp."status" = true
            AND (
                -- Administradores pueden ver todas las plantillas
                EXISTS (
                    SELECT 1 FROM public."segModulosUsuarios" 
                    WHERE "uid" = auth.uid() 
                    AND "clave" = 206 
                    AND "acceso" = true
                )
                OR
                -- O plantillas públicas
                sp."esPublica" = true
                OR
                -- O plantillas propias
                sp."uidCreador" = auth.uid()
            )
        )
    );

-- Política 2: SELECT para creadores de plantillas
CREATE POLICY "segdetalles_select_creadores" ON public."segDetallesPlantilla"
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public."segPlantillasPermisos" sp
            WHERE sp."idPlantilla" = "segDetallesPlantilla"."idPlantilla"
            AND sp."uidCreador" = auth.uid()
        )
    );

-- Política 3: INSERT para administradores y creadores
CREATE POLICY "segdetalles_insert_administradores" ON public."segDetallesPlantilla"
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public."segPlantillasPermisos" sp
            WHERE sp."idPlantilla" = "segDetallesPlantilla"."idPlantilla"
            AND sp."status" = true
            AND (
                -- Administradores pueden modificar cualquier plantilla
                EXISTS (
                    SELECT 1 FROM public."segModulosUsuarios" 
                    WHERE "uid" = auth.uid() 
                    AND "clave" = 206 
                    AND "acceso" = true
                )
                OR
                -- O creadores pueden modificar sus propias plantillas
                sp."uidCreador" = auth.uid()
            )
        )
    );

-- Política 4: UPDATE para administradores y creadores
CREATE POLICY "segdetalles_update_administradores" ON public."segDetallesPlantilla"
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public."segPlantillasPermisos" sp
            WHERE sp."idPlantilla" = "segDetallesPlantilla"."idPlantilla"
            AND sp."status" = true
            AND (
                -- Administradores pueden modificar cualquier plantilla
                EXISTS (
                    SELECT 1 FROM public."segModulosUsuarios" 
                    WHERE "uid" = auth.uid() 
                    AND "clave" = 206 
                    AND "acceso" = true
                )
                OR
                -- O creadores pueden modificar sus propias plantillas
                sp."uidCreador" = auth.uid()
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public."segPlantillasPermisos" sp
            WHERE sp."idPlantilla" = "segDetallesPlantilla"."idPlantilla"
            AND sp."status" = true
            AND (
                -- Administradores pueden modificar cualquier plantilla
                EXISTS (
                    SELECT 1 FROM public."segModulosUsuarios" 
                    WHERE "uid" = auth.uid() 
                    AND "clave" = 206 
                    AND "acceso" = true
                )
                OR
                -- O creadores pueden modificar sus propias plantillas
                sp."uidCreador" = auth.uid()
            )
        )
    );

-- Política 5: DELETE para administradores y creadores
CREATE POLICY "segdetalles_delete_administradores" ON public."segDetallesPlantilla"
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public."segPlantillasPermisos" sp
            WHERE sp."idPlantilla" = "segDetallesPlantilla"."idPlantilla"
            AND sp."status" = true
            AND (
                -- Administradores pueden eliminar cualquier plantilla
                EXISTS (
                    SELECT 1 FROM public."segModulosUsuarios" 
                    WHERE "uid" = auth.uid() 
                    AND "clave" = 206 
                    AND "acceso" = true
                )
                OR
                -- O creadores pueden eliminar sus propias plantillas
                sp."uidCreador" = auth.uid()
            )
        )
    );

-- ===============================================================================
-- FUNCIONES DE APOYO PARA VERIFICACIÓN DE PERMISOS
-- ===============================================================================

-- Función para verificar si un usuario es administrador de plantillas
CREATE OR REPLACE FUNCTION public."seg_es_administrador_plantillas"(
    p_uid_usuario uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
    --[Fecha y Hora]: 16/11/2025 10:52:00
    -- [Descripción]: Verifica si un usuario tiene permisos de administrador de plantillas
    --
    -- [Parámetros]:
    --   - p_uid_usuario (uuid): UID del usuario a verificar (opcional, usa auth.uid() por defecto)
    --
    -- [Salida]: boolean - true si tiene permiso 206, false otherwise
    
    SELECT EXISTS (
        SELECT 1 FROM public."segModulosUsuarios" 
        WHERE "uid" = COALESCE(p_uid_usuario, auth.uid()) 
        AND "clave" = 206 
        AND "acceso" = true
    );
$$;

-- Función para verificar si un usuario puede acceder a una plantilla específica
CREATE OR REPLACE FUNCTION public."seg_puede_acceder_plantilla"(
    p_id_plantilla uuid,
    p_uid_usuario uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
    --[Fecha y Hora]: 16/11/2025 10:52:00
    -- [Descripción]: Verifica si un usuario puede acceder a una plantilla específica
    --
    -- [Parámetros]:
    --   - p_id_plantilla (uuid): ID de la plantilla a verificar
    --   - p_uid_usuario (uuid): UID del usuario a verificar (opcional)
    --
    -- [Salida]: boolean - true si puede acceder, false otherwise
    
    SELECT EXISTS (
        SELECT 1 FROM public."segPlantillasPermisos" sp
        WHERE sp."idPlantilla" = p_id_plantilla
        AND sp."status" = true
        AND (
            -- Es administrador
            EXISTS (
                SELECT 1 FROM public."segModulosUsuarios" 
                WHERE "uid" = COALESCE(p_uid_usuario, auth.uid()) 
                AND "clave" = 206 
                AND "acceso" = true
            )
            OR
            -- Es el creador
            sp."uidCreador" = COALESCE(p_uid_usuario, auth.uid())
            OR
            -- Es una plantilla pública y es administrador
            (sp."esPublica" = true AND EXISTS (
                SELECT 1 FROM public."segModulosUsuarios" 
                WHERE "uid" = COALESCE(p_uid_usuario, auth.uid()) 
                AND "clave" = 206 
                AND "acceso" = true
            ))
        )
    );
$$;

-- Mensaje de confirmación
DO $$
BEGIN
    RAISE NOTICE 'Políticas RLS para plantillas de permisos creadas exitosamente';
    RAISE NOTICE '- Políticas para segPlantillasPermisos: SELECT, INSERT, UPDATE, DELETE';
    RAISE NOTICE '- Políticas para segDetallesPlantilla: SELECT, INSERT, UPDATE, DELETE';
    RAISE NOTICE '- Funciones de apoyo: seg_es_administrador_plantillas, seg_puede_acceder_plantilla';
    RAISE NOTICE '- Seguridad basada en permiso 206 (Gestionar perfiles)';
    RAISE NOTICE '- Los creadores pueden gestionar sus propias plantillas';
    RAISE NOTICE '- Las plantillas públicas son visibles para administradores';
END $$;