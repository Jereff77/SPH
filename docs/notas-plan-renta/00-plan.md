# Notas del plan de renta — mini-plan (pendiente de visto bueno)

Mockup: `notas-plan-renta.pen` (dos pantallas: chat expandido y colapsado).

## Decisiones de Jereff (2026-10-07)
- Las notas viven en el **plan** (`idArrePdp`). Una renovación nace con su chat vacío.
- Ver y escribir: quien tenga permiso para abrir el módulo.
- Cada usuario puede **borrar solo sus propias notas, y solo el mismo día** en que las subió. No se editan.
- **MontseAI** registra avisos automáticos en el chat de ese plan (plantillas fijas, sin llamar al modelo de IA, sin gastar créditos).

## Eventos que avisa MontseAI
1. Cancelación anticipada.
2. Incremento INPC aplicado (manual o automático).
3. Contrato firmado cargado o cambiado.
4. Nave liberada.
5. Cambios manuales al plan: edición con doble clic en el desglose de partida (`DetallePartida`) y cambios desde Configuración (conceptos, activar/desactivar, eliminar plan en diseño).

Fuera: renovación (pertenece al plan nuevo).

## Agrupación (decisión de Jereff)
Los cambios manuales consecutivos del mismo usuario en el mismo plan se agrupan en **un solo mensaje de MontseAI** que se despliega ahí mismo con el detalle (partida · concepto · campo: antes → después). Propuesta técnica: ventana de unos minutos; el mensaje se actualiza, no se duplica. Se ajusta al construir.

## Propuesta técnica (a verificar contra la BD real antes de construir)
- **Tabla genérica y reutilizable** (Jereff, 2026-10-07: se replicará en otras partes de la plataforma). Cada nota lleva `modulo` + `pantalla` + `entidadTipo` + `entidadId` (aquí: `arrendatarios` · `planes-renta` · `arrePdp` · `idArrePdp`), además de autor, tipo `usuario`/`sistema`, texto, detalle JSON de cambios y fecha. El permiso de ver/escribir se resuelve por el módulo de la nota. Con RLS y auditoría con el actor del JWT.
- Para replicarlo: un componente de panel compartido que recibe `modulo`, `pantalla`, `entidadTipo` y `entidadId`; el servidor valida el permiso del módulo recibido.
- Endpoints en el módulo arrendatarios; el borrado valida en el servidor autor + mismo día.
- MontseAI inserta el aviso **después** del cambio, best-effort (no en la misma transacción: el cliente de BD del proyecto no lo permite; si el aviso falla, el cambio queda y se registra en el log).
- Panel colapsable a la derecha, misma altura que la tabla; el estado colapsado se recuerda por usuario.

## Estado
✅ **Construido y publicado como v2.77.0 (2026-10-07).** Mockup aprobado por Jereff; migración aplicada (`notasEntidad` + candados); validador adversarial Opus: APTO (hallazgos M1-M3 corregidos). Por probar por el equipo de Ventas: los avisos automáticos de MontseAI al editar un plan real (no se probó en vivo para no modificar datos de producción). Decisiones posteriores de Jereff: panel **colapsado por defecto**; refresco de **60 s** (tiempo real queda descartado hasta que se pida).
