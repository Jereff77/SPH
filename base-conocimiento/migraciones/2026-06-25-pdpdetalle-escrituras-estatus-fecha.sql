-- 2026-06-25 · v2.44.0 · Ventas → Escrituras (clave 630)
-- Estatus manual de escrituración + fecha real de escrituración.
--
-- Contexto: la pantalla de Escrituras pasó a ser operativa. Necesita un estatus
-- manual (Escriturada/Pendiente) y una fecha REAL de escrituración independiente
-- de la fecha PROGRAMADA de la parcialidad (`pdpDetalle.fecha`).
--
-- Aditivo y seguro: ambas columnas son nuevas. `escriturada` nace en false y
-- `fechaEscrituracion` en NULL; no altera ninguna columna existente ni rompe v1
-- (que de todos modos ya no opera). En Postgres es solo-metadatos (instantáneo).
--
-- Autorizado por el usuario (2026-06-25). Aplicado en prod vía migración
-- `escrituras_estatus_y_fecha`.

ALTER TABLE "pdpDetalle"
  ADD COLUMN "escriturada" boolean NOT NULL DEFAULT false,
  ADD COLUMN "fechaEscrituracion" date;

-- Reversión (si fuese necesario):
-- ALTER TABLE "pdpDetalle" DROP COLUMN "escriturada", DROP COLUMN "fechaEscrituracion";
