-- =====================================================
-- Implementación de Políticas RLS para la tabla leads
-- Proyecto: SPH Bines Raices
-- Fecha: 2025-10-11
-- Descripción: Políticas definitivas con permisos de módulo
-- =====================================================

-- 1. Eliminar políticas existentes
DROP POLICY IF EXISTS leads_asesor_access_policy ON leads;
DROP POLICY IF EXISTS leads_gerente_access_policy ON leads;
DROP POLICY IF EXISTS leads_usuario_asignado_policy ON leads;
DROP POLICY IF EXISTS leads_status_visibility_policy ON leads;

-- 2. Crear política para usuarios estándar (solo sus leads asignados y activos) - SELECT
CREATE POLICY leads_usuario_asignado_select_policy ON leads
    FOR SELECT
    TO authenticated
    USING ("uidRC" = auth.uid() AND status = true);

-- 3. Crear política para usuarios estándar (solo sus leads asignados) - UPDATE
CREATE POLICY leads_usuario_asignado_update_policy ON leads
    FOR UPDATE
    TO authenticated
    USING ("uidRC" = auth.uid())
    WITH CHECK ("uidRC" = auth.uid());

-- 4. Crear política para Vista Gerencial (clave 325) - SELECT
-- Importante: Solo permite ver leads con status = true
CREATE POLICY leads_vista_gerencial_policy ON leads
    FOR SELECT
    TO authenticated
    USING (EXISTS (
        SELECT 1
        FROM "segModulosUsuarios" smu
        WHERE smu.uid = auth.uid()
        AND smu.clave = 325
        AND smu.acceso = true
    ) AND status = true);

-- 5. Crear política para Vista Administrador (clave 326) - SELECT
CREATE POLICY leads_vista_administrador_select_policy ON leads
    FOR SELECT
    TO authenticated
    USING (EXISTS (
        SELECT 1
        FROM "segModulosUsuarios" smu
        WHERE smu.uid = auth.uid()
        AND smu.clave = 326
        AND smu.acceso = true
    ));

-- 6. Crear política para Vista Administrador (clave 326) - INSERT
CREATE POLICY leads_vista_administrador_insert_policy ON leads
    FOR INSERT
    TO authenticated
    WITH CHECK (EXISTS (
        SELECT 1
        FROM "segModulosUsuarios" smu
        WHERE smu.uid = auth.uid()
        AND smu.clave = 326
        AND smu.acceso = true
    ));

-- 7. Crear política para Vista Administrador (clave 326) - UPDATE
CREATE POLICY leads_vista_administrador_update_policy ON leads
    FOR UPDATE
    TO authenticated
    USING (EXISTS (
        SELECT 1
        FROM "segModulosUsuarios" smu
        WHERE smu.uid = auth.uid()
        AND smu.clave = 326
        AND smu.acceso = true
    ))
    WITH CHECK (EXISTS (
        SELECT 1
        FROM "segModulosUsuarios" smu
        WHERE smu.uid = auth.uid()
        AND smu.clave = 326
        AND smu.acceso = true
    ));

-- 8. Crear política para Vista Administrador (clave 326) - DELETE
CREATE POLICY leads_vista_administrador_delete_policy ON leads
    FOR DELETE
    TO authenticated
    USING (EXISTS (
        SELECT 1
        FROM "segModulosUsuarios" smu
        WHERE smu.uid = auth.uid()
        AND smu.clave = 326
        AND smu.acceso = true
    ));

-- 9. Verificar políticas creadas
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'leads'
ORDER BY policyname;

-- =====================================================
-- Notas importantes:
--
-- 1. Las políticas son PERMISSIVE, se combinan con operador OR
-- 2. Usuarios estándar: Solo ven y actualizan sus leads (uidRC = auth.uid())
-- 3. Usuarios con permiso 325: Solo pueden VER todos los leads activos + sus propios leads
-- 4. Usuarios con permiso 326: Tienen control total sobre todos los leads (INSERT, UPDATE, SELECT, DELETE)
-- 5. Los usuarios con permiso 326 pueden crear, modificar y eliminar cualquier lead
-- 6. Los usuarios con permiso 325 solo tienen acceso de lectura
-- 7. Cada operación tiene su propia política para mayor control granular
-- =====================================================