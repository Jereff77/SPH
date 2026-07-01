-- =============================================================================
-- Fix: Soporte a Inquilinos — "Vincular" fallaba con 400 "Datos de entrada inválidos"
-- Fecha: 2026-07-01
-- =============================================================================
-- CAUSA RAÍZ:
--   Los IDs de v1 (naves/parques/inquilinos, heredados de FlutterFlow) son de
--   TEXTO CORTO (p. ej. `9qZzRbzAznSP`, `b8EiKD9wSs9h`), NO UUIDs. Las tablas
--   nuevas `incidentes` e `incidentes_remitentes` (v2.42.0) se crearon por error
--   con esas 4 columnas como `uuid`, contradiciendo su propio comentario de
--   migración ("Sin FKs estrictas a v1, igual que arre_pagos"). Resultado: el
--   endpoint /incidentes/:id/vincular nunca funcionó (37 incidentes, 0 vinculados):
--     - 1er muro: el Zod `vincularSchema` validaba con `.uuid()` -> 400.
--     - 2o muro: aun pasando Zod, un text corto en columna uuid -> error 22P02.
--
-- FIX (esta migración): alinear las columnas a `text`, como arre_pagos/arre_ordenante.
--   SEGURO: las 8 columnas están 100% vacías (verificado), no hay conversión de datos.
--   El fix de código acompañante relaja el `vincularSchema` a `z.string().trim().min(1)`.
--
-- Autorizado por: Jereff (pendiente de aplicar con aprobación manual; el clasificador
--   de auto mode bloquea apply_migration sobre la BD compartida).
-- =============================================================================

ALTER TABLE public.incidentes
  ALTER COLUMN "idArrendador" TYPE text,
  ALTER COLUMN "idNavArrend"  TYPE text,
  ALTER COLUMN "idNave"       TYPE text,
  ALTER COLUMN "idParque"     TYPE text;

ALTER TABLE public.incidentes_remitentes
  ALTER COLUMN "idArrendador" TYPE text,
  ALTER COLUMN "idNavArrend"  TYPE text,
  ALTER COLUMN "idNave"       TYPE text,
  ALTER COLUMN "idParque"     TYPE text;

-- Verificación posterior (debe devolver text en las 8 filas):
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema='public'
--   AND table_name IN ('incidentes','incidentes_remitentes')
--   AND column_name IN ('idArrendador','idNavArrend','idNave','idParque')
-- ORDER BY table_name, column_name;
