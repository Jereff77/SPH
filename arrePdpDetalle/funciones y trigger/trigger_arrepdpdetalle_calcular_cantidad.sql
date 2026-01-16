--[Fecha y Hora]: 21/10/2025 23:48:00
--[Descripción]: Trigger que se ejecuta automáticamente antes de insertar o actualizar
--                registros en la tabla arrePdpDetalle para calcular el campo cantidad.
--
--[Eventos]: INSERT, UPDATE
--
--[Timing]: BEFORE
--
--[Función asociada]: arrepdpdetalle_calcular_cantidad()
--
--[Tabla]: public."arrePdpDetalle"
--
--[Uso]: Se activa automáticamente en operaciones INSERT y UPDATE
--
--[Relaciones]: 
--   - Tabla principal: public."arrePdpDetalle"
--   - Función ejecutada: public.arrepdpdetalle_calcular_cantidad()
--
--[Comportamiento]:
--   - Antes de cada INSERT o UPDATE, ejecuta la función arrepdpdetalle_calcular_cantidad()
--   - La función determina si calcula automáticamente o preserva valores manuales
--   - Garantiza consistencia en el cálculo de cantidades
--
--[Validaciones]:
--   - El trigger se ejecuta para todas las filas (FOR EACH ROW)
--   - No tiene condiciones adicionales (se ejecuta siempre)
--
--[Consideraciones de rendimiento]:
--   - Trigger ligero que delega la lógica a la función
--   - Se ejecuta a nivel de fila para cada operación
--   - Impacto mínimo en rendimiento
--
--[Notas importantes]:
--   - Este trigger es fundamental para mantener la integridad de los cálculos
--   - Asegura que toda modificación pase por la lógica de cálculo estándar
--   - No debe desactivarse sin evaluar impacto en el negocio

CREATE TRIGGER trigger_arrepdpdetalle_calcular_cantidad
BEFORE INSERT OR UPDATE ON public."arrePdpDetalle"
FOR EACH ROW
EXECUTE FUNCTION arrepdpdetalle_calcular_cantidad();