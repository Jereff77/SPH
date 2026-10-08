---
modulo: Notas (chat reutilizable + avisos de MontseAI)
estado: desarrollado
version_doc: 1.1
ultima_actualizacion: 2026-10-07
rutas_v2: [/arrendatarios/planes]
rutas_v1: []
claves_permiso: [20]
tablas: [notasEntidad, arrePdp, arrenPropiedades, arrePdpDetalle, arre_incrementos, arre_pagos, catUsers, segModulosUsuarios, auditoria]
rpcs: []
palabras_clave: [notas del plan, chat del plan, nota, comentario del plan, MontseAI, avisos automáticos, panel de notas, colapsar notas, borrar una nota, no puedo borrar una nota, no veo el panel de notas, cambios manuales agrupados, notasEntidad, quién cambió el plan, historial del plan, pestaña Historial, qué pasó con el plan, quién aplicó el pago, quién activó el plan]
relacionado_con: [arrendatarios, incrementos-inpc, configuraciones]
---

# Notas por entidad (chat) + avisos de MontseAI + Historial — v2.77.0 / v2.78.0

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

## Pestañas Notas | Historial (v2.78.0, nivel A)

- **Notas** = solo lo que escriben las **personas** (`tipo='usuario'`). **Historial** = todo lo **automático**, de solo lectura.
- Quien tiene la **clave 20** (acceso al contrato / Planes de renta) ve el historial completo, **incluidos los montos de los
  pagos aplicados** (decisión de Jereff: «es transparencia»); soporte siempre.
- API: `GET /arrendatarios/planes/:idArrePdp/historial` (clave 20) → `HistorialPlanService`
  (`apps/api/src/modules/arrendatarios/historial-plan.service.ts`). Devuelve eventos ya redactados (sin JSON crudo de auditoría):
  `{fecha, tipo, titulo, detalle, cambios?, autor, origen}`. Tope: 300 eventos recientes.
- **Qué muestra y de dónde sale:**

  | Evento | Fuente |
  |---|---|
  | Plan creado | `auditoria` · `arrePdp` INSERT (consulta aparte) |
  | Plan activado / desactivado | `auditoria` · `arrenPropiedades` (`pdpActivo`) — **siempre** de la auditoría (MontseAI no lo emite como evento) |
  | Contrato firmado, cancelación anticipada, nave liberada, INPC aplicado/revertido | **aviso de MontseAI** desde su primer aviso; **antes** de ese momento, de `auditoria` / `arre_incrementos` |
  | Cambios manuales agrupados (doble clic, conceptos) | solo avisos de MontseAI (desplegables) |
  | Pago aplicado / desaplicado | `arre_pagos` (agrupado por depósito y momento; «parcialidad #n» desde `arrePdpDetalle`) |

- **Regla anti-duplicado («corte»):** el corte es el instante del **primer aviso de MontseAI de toda la plataforma** menos 2 min
  (cacheado en memoria; si aún no hay avisos = ∞, todo sale de la auditoría). Un evento sale **o** de MontseAI **o** de la
  auditoría, nunca de ambas. Límite aceptado: los avisos son best-effort; si uno falla después del corte, ese evento no se ve.
- **No se muestra** el ruido: `arrePdpVigente` (lo cambia el cron diario) ni cada edición de la corrida (`arrePdpDetalle`, nivel B).
  La auditoría de planes **solo existe desde junio de 2026**; un plan creado antes no muestra «Plan creado».
- Web: `PanelNotas` recibe la prop opcional `historial` (`queryKey`, `queryFn`, `pie`); sin ella es solo el chat. Filas con icono,
  marca «MontseAI» y «cambios manuales» desplegables. Sondeo cada 60 s solo con el panel abierto en la pestaña activa.

## Cómo replicarlo en otra pantalla

1. Registrar `modulo|pantalla|entidadTipo` en `NOTAS_ENTIDADES` (clave de permiso, tabla y columna del id).
2. Montar `<PanelNotas refNotas={…} titulo="…" />` junto a la tabla (el contenedor debe dar la altura).
3. (Opcional) Que los servicios del módulo llamen a `NotasService.avisar(...)` / `avisarCambioManual(...)`.
4. (Opcional) Pasar `historial` a `PanelNotas` con un endpoint propio que devuelva `EventoHistorial[]`.

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
- "¿Quién cambió el plan?" / "¿Qué pasó con este plan?" → pestaña **Historial** del panel: avisos de MontseAI (campo, valor anterior → nuevo, partida) y eventos del plan (activación, contrato, pagos, INPC…) con «por <persona>».
  El detalle completo está en la tabla `auditoria`.
- "Tarda en verse la nota de un compañero" → es normal hasta **60 s**; recargar la pestaña la muestra al instante.
- "¿Quién aplicó/desaplicó este pago?" → pestaña **Historial** (solo lectura): trae el monto, la parcialidad, el depósito, el motivo y la persona. Los pagos solo existen en el historial desde que se usa `arre_pagos` (junio de 2026).
- "No sale «Plan creado» / el historial está vacío" → el plan se creó antes de junio de 2026 (no hay auditoría) o aún no ha tenido eventos.
