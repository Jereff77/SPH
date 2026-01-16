--[Fecha y Hora]: 18/10/2025 20:14:00
-- [Descripción]: Políticas de seguridad a nivel de fila (RLS) para la tabla naves
--                que restringen el acceso según los parques asignados al usuario.
--
-- [Políticas implementadas]:
--   - naves_ver_parques_asignados: Permite SELECT solo de naves en parques asignados
--   - naves_actualizar_parques_asignados: Permite UPDATE solo de naves en parques asignados
--
-- [Restricciones]:
--   - Solo usuarios autenticados (auth.uid() no NULL)
--   - Solo naves cuyo idParque esté en catUsers.parques.Parques[].idParque del usuario
--   - El usuario debe estar activo (status = true)
--
-- [Efecto]: Los usuarios solo pueden ver las naves de los parques a los que tienen acceso
--           Los usuarios anónimos no pueden ver ninguna nave

-- Habilitar RLS en la tabla naves
ALTER TABLE naves ENABLE ROW LEVEL SECURITY;

-- Política para ver solo naves de parques asignados al usuario autenticado
CREATE POLICY "naves_ver_parques_asignados" ON naves
FOR SELECT
USING (
    auth.uid() IS NOT NULL
    AND "idParque" IN (
        SELECT parque->>'idParque'
        FROM jsonb_array_elements(
            (SELECT parques->'Parques'
             FROM "catUsers"
             WHERE uid = auth.uid() AND status = true)
        ) AS parque
    )
);

-- Política para actualizar solo naves de parques asignados al usuario autenticado
CREATE POLICY "naves_actualizar_parques_asignados" ON naves
FOR UPDATE
USING (
    auth.uid() IS NOT NULL
    AND "idParque" IN (
        SELECT parque->>'idParque'
        FROM jsonb_array_elements(
            (SELECT parques->'Parques'
             FROM "catUsers"
             WHERE uid = auth.uid() AND status = true)
        ) AS parque
    )
);