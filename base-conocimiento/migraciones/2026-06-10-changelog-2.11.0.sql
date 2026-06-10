-- Changelog v2.11.0 — Ventas: Reportes, Dashboard gráfico, Escrituras y Montse AI
-- Aplicado el 2026-06-10 (registro del changelog del sistema v2).
--
-- NOTA: NO se usó la función public.v2_changelog_registrar() porque tiene un BUG:
--   inserta  (... ->> 'sub')  [tipo text]  en la columna "creadoPor" [tipo uuid]
--   SIN el cast ::uuid  → falla con "column creadoPor is of type uuid but expression is of type text".
-- Por indicación del usuario NO se corrigió la función (este registro no lo hace un usuario,
-- así que "creadoPor" se omite → queda NULL). Se insertó directamente calculando la siguiente
-- versión (minor) desde la tabla. Si en el futuro se desea reactivar la función, agregar el cast:
--   ... (NULLIF(current_setting('request.jwt.claims', true),'')::jsonb->>'sub')::uuid

INSERT INTO public.v2_changelog (version, fecha, titulo, cambios, publicada)
SELECT
  format('%s.%s.0', split_part(v_max, '.', 1)::int, split_part(v_max, '.', 2)::int + 1),
  CURRENT_DATE,
  'Ventas: Reportes, Dashboard gráfico, Escrituras y asistente Montse AI',
  '[
    {"tipo":"Agregado","descripcion":"Nuevo Dashboard de Ventas con indicadores del año (Monto, Pagos, Balance), gráfica mensual/acumulada y un panel de naves con atrasos (monto vencido y días de atraso)."},
    {"tipo":"Agregado","descripcion":"Sección Reportes en Ventas con los reportes Estado de Cuenta y Vencidos: filtros enlazados, tarjetas de totales, gráficas y exportación a CSV, JSON y PDF."},
    {"tipo":"Agregado","descripcion":"Montse AI: asistente que responde preguntas sobre tus datos del sistema en lenguaje natural, con tablas y gráficas, dentro de Reportes."},
    {"tipo":"Agregado","descripcion":"Sección Escrituras en Ventas para consultar los pagos de escrituración y ajustar su fecha y monto, con doble clic y confirmación para evitar cambios accidentales."},
    {"tipo":"Agregado","descripcion":"En Planes ahora puedes cambiar el tipo de pago de una parcialidad (Anticipo, Parcialidad o Escrituración)."},
    {"tipo":"Cambiado","descripcion":"El tablero operativo de Ventas se renombró de Dashboard a Gestión de Cobranza para distinguirlo del nuevo Dashboard gráfico."}
  ]'::jsonb,
  true
FROM (
  SELECT version AS v_max FROM public.v2_changelog
  ORDER BY string_to_array(version, '.')::int[] DESC LIMIT 1
) t
RETURNING version;
