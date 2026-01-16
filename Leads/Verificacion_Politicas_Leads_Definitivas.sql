-- =====================================================
-- Verificación de Políticas RLS para la tabla leads
-- Proyecto: SPH Bines Raices
-- Fecha: 2025-10-11
-- Descripción: Script para verificar las políticas definitivas
-- =====================================================

-- 1. Verificar políticas actuales en la tabla leads
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

-- 2. Verificar que RLS esté habilitado en la tabla
SELECT 
    relname AS tabla,
    relrowsecurity AS rls_habilitado
FROM pg_class 
WHERE relname = 'leads';

-- 3. Estadísticas generales de leads
SELECT 
    COUNT(*) AS total_leads,
    COUNT(CASE WHEN "uidRC" IS NOT NULL THEN 1 END) AS leads_con_responsable,
    COUNT(CASE WHEN status = true THEN 1 END) AS leads_activos,
    COUNT(CASE WHEN status = false THEN 1 END) AS leads_inactivos
FROM leads;

-- 4. Verificar usuarios y sus permisos en módulos
SELECT 
    u.uid,
    u."nomCompleto",
    p."nomPerfil",
    u.email,
    CASE 
        WHEN smu325.acceso = true THEN 'Sí'
        ELSE 'No'
    END AS permiso_325_vista_gerencial,
    CASE 
        WHEN smu326.acceso = true THEN 'Sí'
        ELSE 'No'
    END AS permiso_326_vista_admin
FROM "catUsers" u
LEFT JOIN perfil p ON u."idPerfil" = p.nivel
LEFT JOIN "segModulosUsuarios" smu325 ON u.uid = smu325.uid AND smu325.clave = 325
LEFT JOIN "segModulosUsuarios" smu326 ON u.uid = smu326.uid AND smu326.clave = 326
WHERE u.status = true
ORDER BY p."nomPerfil", u."nomCompleto";

-- 5. Verificar asignación de leads por usuario
SELECT 
    u."nomCompleto",
    COUNT(l.id) AS leads_asignados,
    COUNT(CASE WHEN l.status = true THEN 1 END) AS leads_activos,
    COUNT(CASE WHEN l.status = false THEN 1 END) AS leads_inactivos
FROM "catUsers" u
LEFT JOIN leads l ON u.uid = l."uidRC"
WHERE u.status = true
GROUP BY u.uid, u."nomCompleto"
ORDER BY leads_asignados DESC;

-- 6. Pruebas de acceso (descomentar según el usuario a probar)
-- =====================================================
-- Para probar el acceso de un usuario específico:
-- 1. Inicia sesión como ese usuario
-- 2. Ejecuta las siguientes consultas
-- 3. Compara los resultados con lo esperado

-- Prueba 1: Usuario estándar (debería ver solo sus leads)
-- SELECT COUNT(*) AS leads_visibles_usuario_estandar FROM leads;

-- Prueba 2: Usuario con permiso 325 (debería ver sus leads + todos los activos)
-- SELECT COUNT(*) AS leads_visibles_permiso_325 FROM leads;

-- Prueba 3: Usuario con permiso 326 (debería ver todos los leads)
-- SELECT COUNT(*) AS leads_visibles_permiso_326 FROM leads;

-- Prueba 4: Usuario con ambos permisos (debería ver todos los leads)
-- SELECT COUNT(*) AS leads_visibles_ambos_permisos FROM leads;

-- Prueba de UPDATE - Usuario estándar: Debería poder actualizar solo sus leads
-- UPDATE leads SET "nombreLead" = 'Test' WHERE id = 'uuid-del-lead-asignado';

-- Prueba de UPDATE - Usuario estándar: No debería poder actualizar leads de otros
-- UPDATE leads SET "nombreLead" = 'Test' WHERE id = 'uuid-de-lead-de-otro-usuario';

-- Prueba de INSERT - Usuario con permiso 325: NO debería poder insertar
-- INSERT INTO leads ("nombreLead", telefono, correo, "uidRC")
-- VALUES ('Test Lead', '1234567890', 'test@email.com', 'uuid-de-otro-usuario');

-- Prueba de INSERT - Usuario con permiso 326: SÍ debería poder insertar
-- INSERT INTO leads ("nombreLead", telefono, correo, "uidRC")
-- VALUES ('Test Lead Admin', '1234567890', 'admin@email.com', 'uuid-cualquiera');

-- Prueba de DELETE - Usuario con permiso 326: SÍ debería poder eliminar
-- DELETE FROM leads WHERE id = 'uuid-del-lead-a-eliminar';
-- =====================================================

-- 7. Verificar permisos específicos por usuario
-- Reemplaza <TU_UID> con el UUID del usuario a verificar
-- WITH usuario_perms AS (
--     SELECT
--         '<TU_UID>'::uuid AS uid,
--         EXISTS(SELECT 1 FROM "segModulosUsuarios" WHERE uid = '<TU_UID>'::uuid AND clave = 325 AND acceso = true) AS tiene_325,
--         EXISTS(SELECT 1 FROM "segModulosUsuarios" WHERE uid = '<TU_UID>'::uuid AND clave = 326 AND acceso = true) AS tiene_326
-- )
-- SELECT
--     uid,
--     tiene_325,
--     tiene_326,
--     CASE
--         WHEN tiene_326 THEN 'CONTROL TOTAL sobre todos los leads (INSERT, UPDATE, SELECT, DELETE)'
--         WHEN tiene_325 THEN 'SOLO LECTURA de todos los leads activos + UPDATE de sus leads'
--         ELSE 'SELECT y UPDATE solo de sus leads asignados'
--     END AS nivel_de_acceso
-- FROM usuario_perms;

-- 8. Prueba específica de permisos por operación
-- Descomentar las líneas correspondientes según el tipo de usuario

-- -- Para usuarios con permiso 325 (solo lectura de otros leads)
-- -- Debería poder ver todos los leads activos
-- SELECT COUNT(*) FROM leads WHERE status = true;
-- -- No debería poder ver leads inactivos
-- SELECT COUNT(*) FROM leads WHERE status = false;
-- -- No debería poder insertar nuevos leads
-- INSERT INTO leads ("nombreLead", "uidRC") VALUES ('Test', auth.uid());
-- -- No debería poder eliminar leads
-- DELETE FROM leads WHERE id = 'algun-uuid';

-- -- Para usuarios con permiso 326 (control total)
-- -- Debería poder ver todos los leads (activos e inactivos)
-- SELECT COUNT(*) FROM leads;
-- -- Debería poder ver leads inactivos
-- SELECT COUNT(*) FROM leads WHERE status = false;
-- -- Debería poder insertar nuevos leads
-- INSERT INTO leads ("nombreLead", "uidRC") VALUES ('Test Admin', auth.uid());
-- -- Debería poder eliminar leads
-- DELETE FROM leads WHERE id = 'algun-uuid';

-- =====================================================
-- Instrucciones para verificar el funcionamiento:
-- 
-- 1. Ejecutar este script como usuario con permisos de lectura
-- 2. Revisar los resultados de las consultas 1-5 para entender el estado actual
-- 3. Para probar el acceso real:
--    a. Inicia sesión como diferentes usuarios
--    b. Ejecuta las consultas de prueba del sección 6
--    c. Verifica que los resultados coincidan con lo esperado
-- 4. Los usuarios estándar deberían ver solo sus leads ACTIVOS
-- 5. Usuarios con permiso 325 deberían ver sus leads + todos los activos, pero SOLO LECTURA
-- 6. Usuarios con permiso 326 deberían tener CONTROL TOTAL sobre todos los leads (activos e inactivos)
-- 7. Verifica que los usuarios estándar no puedan ver leads inactivos
-- 8. Verifica que los usuarios con permiso 325 no puedan ver leads inactivos
-- 9. Verifica que los usuarios con permiso 325 no puedan INSERTAR o ELIMINAR
-- 10. Verifica que los usuarios con permiso 326 puedan realizar todas las operaciones
-- =====================================================