# Historial del plan — nivel A (mini-plan) — ✅ construido en v2.78.0

Extiende el panel «Notas del plan» (v2.77.0) con dos pestañas (decisión de Jereff, 2026-10-07):

- **Notas** = solo lo que **escriben las personas** (los avisos de MontseAI dejan de verse aquí).
- **Historial** = **todo lo automático**, de solo lectura: los avisos de MontseAI + los eventos que salen de la auditoría.

El nivel B (cada edición de partida de la corrida, una por una) queda fuera: solo si Ventas lo pide.

**Mockup:** `notas-plan-renta.pen` — pantallas «Chat expandido» (pestaña Notas), «Chat colapsado» y «Historial (nivel A)»
(renglones por día con icono, quién y hora; los de MontseAI llevan la marca «MontseAI»; los cambios manuales agrupados se
despliegan; pie «Solo lectura · desde junio de 2026»). Pendiente de aprobación.

## Qué muestra el Historial (fuentes verificadas en la BD el 2026-10-07)

| Evento | Fuente |
|---|---|
| Cancelación anticipada · INPC aplicado/revertido · contrato firmado · nave liberada · cambios manuales agrupados (incluye plan activado/desactivado y conceptos) | **Avisos de MontseAI** (`notasEntidad` tipo `sistema`), desde el despliegue de la v2.77.0 |
| Esos mismos eventos **antes** del despliegue | `auditoria` (`arrePdp`: contratoFirmado, canceladoAnticipado; `arrenPropiedades`: pdpActivo, status) y `arre_incrementos` |
| Plan creado | `auditoria` · `arrePdp` INSERT |
| Pago aplicado / desaplicado (partidas del mismo depósito agrupadas en un renglón) | `arre_pagos` |

**Regla anti-duplicado:** desde la fecha de corte (despliegue de la v2.77.0) los eventos que MontseAI ya avisa se toman SOLO de
su aviso; de la auditoría se toman únicamente los anteriores a esa fecha y los tipos que MontseAI no cubre (creación, pagos).

**Ruido que NO se muestra:** los cambios de `arrePdpVigente` (≈2,826 de ≈2,900 UPDATE de `arrePdp`: el cron diario de
vigencia) y todo `arrePdpDetalle` (nivel B). Antes de junio de 2026 no hay auditoría de planes.

## Propuesta técnica (a validar con un Opus: expone auditoría y pagos)

- **Sin migración ni tablas nuevas:** `auditoria` tiene índice `(entidad, id_entidad)`; las demás fuentes son chicas. Solo lectura.
- API: `GET /arrendatarios/planes/:idArrePdp/historial` (clave 20, `PermisoGuard`) en un servicio nuevo `HistorialPlanService`
  (patrón de `ParquesService.historialDeNave`): consulta las fuentes en paralelo con tope (≈300 eventos más recientes),
  normaliza a `{fecha, tipo, titulo, detalle, autor, origen, cambios?}`, resuelve nombres con `catUsers` y devuelve texto ya
  redactado (sin JSON crudo de auditoría).
- `GET /notas` sigue igual; la pestaña **Notas** muestra solo `tipo='usuario'` (filtro en el panel; los avisos de MontseAI se
  siguen guardando en `notasEntidad`) y el Historial toma los de `tipo='sistema'` desde el mismo endpoint de historial.
- Web: `PanelNotas` gana las pestañas «Notas | Historial» (la de Historial recibe los eventos del servidor: otra pantalla podría
  traer los suyos). El pie de Historial es solo lectura, sin caja de texto.

## Decisiones de Jereff
1. ✅ Dos pestañas: Notas (personas) / Historial (todo lo automático). Decidido 2026-10-07.
2. ✅ **Quién ve el Historial:** quien tenga acceso al contrato (clave 20, y soporte), con los pagos aplicados y su monto — «es transparencia». Decidido 2026-10-07.

## Esfuerzo estimado
≈ 1.5 días: servicio + endpoint + pestañas + regla de fecha de corte + validador + prueba en navegador. Sin migración.

## Resultado (2026-10-07)
Construido y publicado como **v2.78.0**. Validador adversarial Opus: APTO, 0 ALTA de seguridad; corregido H1 (las activaciones
posteriores al corte no se veían: ahora siempre de la auditoría), H2 (la liberación ya no genera un «Plan desactivado» aparte),
H3 («Plan creado» en consulta aparte), H4 (partidas por plan, sin `.in` largo) y H5 (sondeo solo con la pestaña abierta).
Probado en navegador con datos reales de producción (solo lectura). No aplicado a propósito (los ids de plan son texto, no UUID):
`ParseUUIDPipe`. Menores no aplicados (cosméticos): agrupar pagos por `uidPago`, `role=tabpanel`, extraer helpers de nombre/fecha.
⚠️ Por ver en vivo: que los avisos de MontseAI aparezcan en la pestaña Historial al editar un plan real.
