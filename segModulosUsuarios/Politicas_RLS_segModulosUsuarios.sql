-- [Fecha y Hora]: 12/10/2025 07:02:00
-- [Descripción]: Script para eliminar las políticas RLS actuales de la tabla segModulosUsuarios
--                y crear nuevas políticas basadas en los permisos específicos de las claves 201-206.
--                Estas políticas controlan el acceso a la gestión de usuarios según los permisos
--                asignados a cada usuario en el sistema de módulos.

-- Paso 1: Eliminar la política actual muy permisiva de la tabla segModulosUsuarios
DROP POLICY IF EXISTS "Usuarios_Autenticados_Policy" ON public."segModulosUsuarios";

-- Paso 2: Crear política para que los usuarios puedan ver sus propios permisos
CREATE POLICY segmodulosusuarios_select_propios ON public."segModulosUsuarios"
    FOR SELECT USING (uid = auth.uid());

-- Nota: No se crean políticas de administrador para evitar problemas de permisos con auth.users
--       No se crean políticas de INSERT, UPDATE, DELETE para evitar recursión infinita
--       Estas operaciones deben ser manejadas por administradores o a través de funciones específicas

-- Verificación de políticas creadas
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'segModulosUsuarios' AND schemaname = 'public'
ORDER BY policyname;