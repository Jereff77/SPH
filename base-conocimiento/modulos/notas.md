---
modulo: Notas (chat reutilizable + avisos de MontseAI)
estado: desarrollado
version_doc: 1.0
ultima_actualizacion: 2026-10-07
rutas_v2: [/arrendatarios/planes]
rutas_v1: []
claves_permiso: [20]
tablas: [notasEntidad, arrePdp, catUsers, segModulosUsuarios, auditoria]
rpcs: []
palabras_clave: [notas del plan, chat del plan, nota, comentario del plan, MontseAI, avisos automáticos, panel de notas, colapsar notas, borrar una nota, no puedo borrar una nota, no veo el panel de notas, cambios manuales agrupados, notasEntidad, quién cambió el plan]
relacionado_con: [arrendatarios, incrementos-inpc, configuraciones]
---

# Notas por entidad (chat) + avisos de MontseAI — v2.77.0

Componente **reutilizable**: un panel de notas colapsable que se pega a cualquier pantalla. Primer uso: **Arrendatarios ▸
Planes de renta** (una conversación por plan `arrePdp`). Mockup aprobado: `docs/notas-plan-renta/notas-plan-renta.pen`;
plan y decisiones: `docs/notas-plan-renta/00-plan.md`.

## Cómo funciona

- **Tabla `notasEntidad`** (solo backend, RLS sin políticas, `trg_auditoria`). Cada nota se ubica por
  `modulo + pantalla + entidadTipo + entidadId` (aquí `arrendatarios · planes-renta · arrePdp · idArrePdp`). `tipo` =
  `usuario` (persona) o `sistema` (aviso de MontseAI, con `evento` y `detalle` JSON). `uid` sale del JWT, nunca del body.
- **API** (`apps/api/src/modules/notas/`): `GET /notas`, `POST /notas`, `DELETE /notas/:id`. El permiso depende de la pantalla:
  se resuelve en el catálogo `NOTAS_ENTIDADES` (`notas.config.ts`) → aquí la **clave 20**; soporte siempre pasa. Se valida que la
  entidad exista.
- **Web** (`apps/web/src/components/notas/PanelNotas.tsx`): recibe `refNotas = {modulo, pantalla, entidadTipo, entidadId}`.
  Colapsado por defecto (se recuerda por navegador), se refresca cada 60 s y al volver a la pestaña.
- **Borrar:** solo notas propias de tipo usuario, el mismo día (hora de México, `America/Mexico_City`). Los avisos de MontseAI
  no se borran. ⚠️ El texto de una nota borrada **permanece en `auditoria`** (trazabilidad): una nota con un dato sensible
  pegado por error no se puede purgar desde la pantalla.

## MontseAI (avisos automáticos)

Plantillas fijas (sin modelo de IA, sin créditos). Se escriben **después** del cambio, *best-effort* (si falla, solo log; el
cambio no se revierte). Eventos: `cambio_manual`, `inpc` (aplicado/revertido), `contrato`, `cancelacion`, `liberacion`.
Los `cambio_manual` consecutivos de la misma persona con menos de 10 min se agrupan en un solo mensaje
(`detalle.cambios[]`, control optimista por `fa`, tope 200 por aviso).

## Cómo replicarlo en otra pantalla

1. Registrar `modulo|pantalla|entidadTipo` en `NOTAS_ENTIDADES` (clave de permiso, tabla y columna del id).
2. Montar `<PanelNotas refNotas={…} titulo="…" />` junto a la tabla (el contenedor debe dar la altura).
3. (Opcional) Que los servicios del módulo llamen a `NotasService.avisar(...)` / `avisarCambioManual(...)`.

## Decisiones y límites conocidos (de diseño, no son pendientes)

- Notas por plan, no por propiedad: una renovación nace con el chat vacío.
- Listado: las **300 más recientes**, sin paginación (decisión de Jereff: no se registra pendiente).
- Refresco por sondeo de 60 s (no tiempo real); si ventas pide inmediatez se pasa a Realtime.
- Sin FK a las entidades: eliminar un plan en diseño deja sus notas huérfanas inofensivas.

## Para el agente de soporte

- "No veo el panel de notas" → le falta la **clave 20** (Planes de renta), o el plan no tiene corrida activa (el panel se
  muestra junto a la corrida; si el plan no está activo aparece junto al aviso «El plan no está activo…»).
- "No puedo borrar mi nota" → solo se borran **tus** notas y **el mismo día** en que las escribiste; los avisos de MontseAI
  no se borran.
- "¿Quién cambió el plan?" → los avisos de MontseAI dicen qué cambió (campo, valor anterior → nuevo, partida) y «por <persona>».
  El detalle completo está en la tabla `auditoria`.
- "Tarda en verse la nota de un compañero" → es normal hasta **60 s**; recargar la pestaña la muestra al instante.
