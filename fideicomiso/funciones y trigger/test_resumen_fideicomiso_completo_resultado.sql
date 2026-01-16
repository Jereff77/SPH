--[Resultado de prueba EXITOSO - CORREGIDO]
--[Fecha]: 08/01/2026
--[Fideicomiso]: jsRw4C6FswY20O
--[Consulta]: SELECT * FROM resumen_fideicomiso_completo('jsRw4C6FswY20O', 2025, 12);

--[RESULTADO]: ✓ Funciona correctamente
-- La función retornó datos correctamente para diciembre 2025.

--[PROBLEMA DETECTADO Y SOLUCIONADO]:
-- El problema original era que el filtro usaba `periodo_mes` que indica
-- el mes de INICIO del trimestre (octubre = 10), pero cuando el usuario
-- filtra por diciembre (12), necesita buscar por la FECHA_FIN del período.
--
-- Solución: Cambiar el filtro de:
--   ' AND periodo_mes = ' || p_mes
-- A:
--   ' AND EXTRACT(YEAR FROM fecha_fin) = ' || p_anio ||
--   ' AND EXTRACT(MONTH FROM fecha_fin) = ' || p_mes

--[PERÍODOS TRIMESTRALES]:
-- Los períodos de dispersión son trimestrales y se identifican por su mes de inicio:
-- - Enero (1):   del 01/01 al 31/03
-- - Abril (4):   del 01/04 al 30/06
-- - Julio (7):   del 01/07 al 30/09
-- - Octubre (10): del 01/10 al 31/12
--
-- Por lo tanto, al filtrar por diciembre (12), se buscan períodos cuya
-- fecha_fin esté en diciembre, que corresponde al trimestre que inicia en octubre.

--[Ejemplos de consultas válidas]:
-- SELECT * FROM resumen_fideicomiso_completo('jsRw4C6FswY20O', 2025, 12); -- Diciembre (trimestre oct-dic)
-- SELECT * FROM resumen_fideicomiso_completo('jsRw4C6FswY20O', 2025, 11); -- Noviembre (trimestre oct-dic)
-- SELECT * FROM resumen_fideicomiso_completo('jsRw4C6FswY20O', 2025, 10); -- Octubre (trimestre oct-dic)
-- SELECT * FROM resumen_fideicomiso_completo('jsRw4C6FswY20O', 2025, 6);  -- Junio (trimestre abr-jun)
-- SELECT * FROM resumen_fideicomiso_completo('jsRw4C6FswY20O', 2025, 3);  -- Marzo (trimestre ene-mar)
-- SELECT * FROM resumen_fideicomiso_completo('jsRw4C6FswY20O', 2025);    -- Todo el año 2025
-- SELECT * FROM resumen_fideicomiso_completo('jsRw4C6FswY20O');         -- Todo el histórico
