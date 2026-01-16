-- =====================================================
-- Corrección de Política RLS para Vista Gerencial (clave 325)
-- Problema: Usuarios con permiso 325 están viendo leads con status = false
-- Solución: Modificar la política para que solo permita ver leads activos
-- =====================================================

-- 1. Eliminar la política actual incorrecta
DROP POLICY IF EXISTS leads_vista_gerencial_policy ON leads;

-- 2. Crear la política corregida para Vista Gerencial (clave 325)
-- Permite SOLO VER todos los leads con status = true
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

-- 3. Verificar que la política esté creada correctamente
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'leads' AND policyname = 'leads_vista_gerencial_policy';

-- =====================================================
-- Notas importantes:
-- 
-- 1. Esta corrección asegura que los usuarios con permiso 325
--    solo puedan ver leads con status = true
-- 2. La política combina dos condiciones:
--    - El usuario debe tener permiso 325 activo
--    - El lead debe tener status = true
-- 3. Los usuarios con permiso 326 no se ven afectados
-- 4. Los usuarios estándar continúan viendo solo sus leads activos
-- =====================================================