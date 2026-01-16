-- [Fecha y Hora]: 12/10/2025 06:47:00
-- [Descripción]: Script para eliminar las políticas RLS actuales de la tabla catUsers
--                y crear nuevas políticas más restrictivas donde los usuarios
--                solo pueden ver y editar su propio registro.

-- Paso 1: Eliminar todas las políticas actuales de la tabla catUsers
DROP POLICY IF EXISTS catusers_delete_basado_permisos ON public."catUsers";
DROP POLICY IF EXISTS catusers_insert_basado_permisos ON public."catUsers";
DROP POLICY IF EXISTS catusers_select_basado_permisos ON public."catUsers";
DROP POLICY IF EXISTS catusers_update_basado_permisos ON public."catUsers";

-- Paso 2: Crear política para que los usuarios solo puedan ver su propio registro
CREATE POLICY catusers_select_propio_registro ON public."catUsers"
    FOR SELECT USING (uid = auth.uid());

-- Paso 3: Crear política para que usuarios con permiso clave 201 puedan ver todos los usuarios
CREATE POLICY catusers_select_ver_todos_usuarios ON public."catUsers"
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public."segModulosUsuarios"
            WHERE uid = auth.uid()
              AND modulo = 'Configuraciones'
              AND seccion = 'Usuarios'
              AND clave = 201
              AND acceso = true
        )
    );

-- Paso 4: Crear política para que usuarios con permiso clave 202 puedan crear usuarios
CREATE POLICY catusers_insert_crear_usuarios ON public."catUsers"
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public."segModulosUsuarios"
            WHERE uid = auth.uid()
              AND modulo = 'Configuraciones'
              AND seccion = 'Usuarios'
              AND clave = 202
              AND acceso = true
        )
    );

-- Paso 5: Crear política para que los usuarios solo puedan editar su propio registro
CREATE POLICY catusers_update_propio_registro ON public."catUsers"
    FOR UPDATE USING (uid = auth.uid());

-- Paso 6: Crear política para que usuarios con permiso clave 203 puedan modificar cualquier usuario
CREATE POLICY catusers_update_modificar_usuarios ON public."catUsers"
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public."segModulosUsuarios"
            WHERE uid = auth.uid()
              AND modulo = 'Configuraciones'
              AND seccion = 'Usuarios'
              AND clave = 203
              AND acceso = true
        )
    );

-- Paso 7: Crear política para que usuarios con permiso clave 204 puedan eliminar usuarios
CREATE POLICY catusers_delete_eliminar_usuarios ON public."catUsers"
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public."segModulosUsuarios"
            WHERE uid = auth.uid()
              AND modulo = 'Configuraciones'
              AND seccion = 'Usuarios'
              AND clave = 204
              AND acceso = true
        )
    );

-- Verificación de políticas creadas
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'catUsers' AND schemaname = 'public'
ORDER BY policyname;