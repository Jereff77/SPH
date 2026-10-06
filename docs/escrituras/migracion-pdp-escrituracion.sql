-- Escrituras (630): estatus y fecha de escrituración pasan de pdpDetalle a pdp (una fila por propiedad/plan).
-- Las columnas de pdpDetalle NO se tocan (quedan como respaldo; su retiro es un paso aparte).

ALTER TABLE public.pdp
  ADD COLUMN IF NOT EXISTS "escriturada" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "fechaEscrituracion" date;

COMMENT ON COLUMN public.pdp."escriturada" IS 'Estatus de escrituración de la propiedad: true = Escriturada, false = Pendiente.';
COMMENT ON COLUMN public.pdp."fechaEscrituracion" IS 'Fecha de escrituración de la propiedad (capturada en Ventas > Escrituras).';

-- Regla: si alguna fila de escrituración del plan está Escriturada, el plan queda Escriturada
-- con la fecha más reciente de esas filas; si no, queda Pendiente con la fecha más reciente que exista (normalmente nula).
UPDATE public.pdp p
SET "escriturada" = x.esc,
    "fechaEscrituracion" = x.fec
FROM (
  SELECT d."idPdp",
         bool_or(coalesce(d."escriturada", false)) AS esc,
         max(d."fechaEscrituracion") FILTER (WHERE coalesce(d."escriturada", false)) AS fec
  FROM public."pdpDetalle" d
  WHERE d."tipoPago" = 'Escrituracion' AND d.status = true
  GROUP BY d."idPdp"
) x
WHERE p."idPdp" = x."idPdp";

-- Verificación esperada: 46 planes escriturados.
-- SELECT count(*) FROM public.pdp WHERE "escriturada";
