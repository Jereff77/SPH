# PLAN — Agente de Soporte: panel lateral fijo + visión de pantalla

> **Plan ligero** (acordado con Jereff, 2026-08-05: «solo es readaptar lo que ya tenemos y agregar
> lo nuevo»). Sin superficie de BD, sin permisos nuevos, edge intacta. Patrón portado del agente
> **Montse de Kaizen2** (`kaizen2/src/components/montse-ai/` — `MontsePanel.tsx`,
> `screen-capture.ts`, `MontseChat.tsx`, `api/montse/chat/route.ts`), que ya opera así en
> producción. Construcción **solo tras visto bueno de Jereff** sobre este documento.

## Objetivo

1. El widget de soporte deja de ser popup flotante que tapa contenido: pasa a **panel lateral
   fijo derecho** que **empuja** el contenido (como Montse).
2. El agente puede **ver la pantalla del usuario**: botón 📷 manual **y** la IA la pide sola
   (`request_screenshot`), imagen inline al modelo, **sin persistirla**.
3. Complemento: los **últimos errores de API** del navegador viajan como contexto del turno
   (mata el caso «me sale un error» sin transcribir nada).

## Qué se readapta / qué se agrega

| Pieza | Acción |
|---|---|
| `apps/web/src/components/layout/AppShell.tsx` | Readaptar: aside derecho + margen compensatorio |
| `apps/web/src/features/soporte/SoporteWidget.tsx` | Readaptar: popup → contenido del panel; burbuja = disparador |
| `apps/web/src/features/soporte/screen-capture.ts` | **Nuevo** (port de Kaizen2) |
| `apps/web/src/features/soporte/{soporte.api,useSoporte}.ts` | Extender: `captura`, `permitirCaptura`, auto-reenvío |
| `apps/web/src/lib/api.ts` | Extender: buffer de últimos errores |
| `apps/api/src/modules/soporte/{soporte.schemas,soporte.service}.ts` | Extender: campos nuevos + tool + content multimodal |
| `apps/api/src/main.ts` | Extender: límite de body JSON (hoy default 100 KB) |
| `supabase/functions/soporte-chat/` | **Sin cambios** (reenvía `messages` sin inspeccionar — verificado) |
| BD / esquema / permisos | **Sin cambios** |

---

## Fase 1 — Panel lateral fijo derecho

El AppShell de SPH usa el idioma «`fixed` + margen compensatorio» (sidebar izquierdo:
`AppShell.tsx:54-69`). El panel es el **espejo a la derecha** — no se reestructura el layout a
flex como Kaizen2; mismo resultado visual con menos riesgo:

- **Aside** `fixed inset-y-0 right-0 z-40 w-96` (móvil: `w-full`), `translate-x-full` cerrado /
  `translate-x-0` abierto, con transición. Contenido: el chat actual del widget (mensajes,
  historial de conversaciones, escalado a ticket) — se **mueve**, no se reescribe.
- **Wrapper de contenido**: `md:mr-96` cuando el panel está abierto (junto al `md:ml-*` que ya
  tiene por el sidebar).
- **Al abrir: colapsar el sidebar de navegación** recordando su estado previo en un ref; al
  cerrar, restaurarlo (patrón `MontsePanel.tsx:79-92`). El usuario puede re-expandirlo.
- **Burbuja 💬** se conserva como disparador (abre/cierra el panel). Se sigue ocultando en modo
  «Ver como» (`!verComoActivo`, sin cambio).
- El aside queda **fuera de `<main>`** (hermano) → la captura de F2 nunca se auto-fotografía.
- Estado `abierto` sube del widget a un punto compartible (context ligero del feature o el propio
  AppShell vía prop) para que burbuja, aside y margen se coordinen.

## Fase 2 — Visión de pantalla

### Captura (front)
- `screen-capture.ts` (port de Kaizen2): `html-to-image` → `toCanvas(document.querySelector('main'))`,
  `pixelRatio: 1`, fondo blanco, **filtro que excluye** `input[type=password]` y todo nodo con
  `data-soporte-exclude-capture="true"` → redimensionar a **≤1024 px** lado mayor → **JPEG 0.8**
  base64. Limitación conocida (heredada): canvas/WebGL e imágenes cross-origin pueden salir en
  blanco.
- **Dependencia nueva en `apps/web`**: `html-to-image` (la misma que usa Kaizen2; ~10 KB gzip).
- **Botón 📷** en el composer del chat: captura y adjunta (miniatura con ✕ para quitarla antes de
  enviar). Máx **1 captura por mensaje**.

### Contrato front → back
- `POST /soporte/mensaje` (Zod): + `captura?: string` (dataURL; validar prefijo
  `data:image/jpeg;base64,` y tope ~1.5 MB) + `permitirCaptura?: boolean`.
- ⚠️ **`main.ts`: subir el límite de body JSON a 2 MB** (hoy no está configurado → default
  Express **100 KB**; la captura no pasaría). Verificado 2026-08-05.

### Backend (`soporte.service.ts`)
- Si `dto.captura`: el mensaje `user` del turno va como content multimodal formato OpenAI —
  `[{type:'text',text}, {type:'image_url',image_url:{url:dataUrl}}]`. La edge lo reenvía tal
  cual (no inspecciona `messages`) y OpenRouter lo acepta.
- **Tool nueva `request_screenshot`** (sin parámetros), agregada al array `tools` **solo si**
  `permitirCaptura === true && !dto.captura` (mismo doble candado que Kaizen2). Si el modelo la
  llama: se corta el tool-loop y la respuesta incluye **`pideCaptura: true`** (nuestro equivalente
  al evento SSE de Kaizen2 — aquí no streameamos). Se registra en `debug_meta.traza`.
- **Persistencia:** la imagen **NO se guarda** — en `v2_soporte_mensajes` queda el texto del
  usuario + marcador `📸 [captura adjunta]`. El historial que se re-envía al modelo (últimos 10,
  desde BD) sigue siendo solo texto → la captura solo existe en el turno que la lleva (igual que
  Kaizen2: solo imágenes del último turno). Auditoría de Configuraciones → Soporte no cambia.
- **System prompt:** bloque condicional (solo cuando la tool está disponible) con la redacción de
  Kaizen2: úsala solo para algo visual que no puedas deducir; no la pidas si ya puedes responder
  o si el turno ya trae imagen.

### Auto-flujo (front, `useSoporte.ts`)
- Respuesta con `pideCaptura` → el widget muestra «Déjame ver tu pantalla… 👀», captura y
  **re-envía solo** con texto visible «📸 Esta es mi pantalla ahora mismo.» y
  `permitirCaptura: false` (**anti-bucle**: una captura por cadena). Si la captura falla, mensaje
  guía hacia el botón 📷. Transparente siempre — nunca captura silenciosa.

### Modelo
- Requiere visión: `openai/gpt-4o` (actual) ✅ y Sonnet 5 (objetivo Fase 4 del plan razonador) ✅.
  Sin dependencia entre ambos trabajos.

## Fase 3 — Últimos errores de API como contexto

- `lib/api.ts`: buffer en memoria (módulo) con los **últimos 3 errores** de respuesta
  (`{metodo, ruta, status, mensaje, hace}`) — sin tokens ni headers. Export `ultimosErroresApi()`.
- `useSoporte.enviar` los adjunta (`erroresRecientes?: […]`, Zod: máx 3, strings acotados) y el
  backend los inyecta como bloque «ERRORES RECIENTES EN EL NAVEGADOR» del system prompt del turno.
- Son mensajes que el usuario ya vio en pantalla (los produce nuestro propio API) — sin PII nueva.

---

## Checklist de seguridad (gate ligero)

- 🛡️ **Frontera de confianza intacta:** front → `apps/api` → edge → OpenRouter. El front sigue
  sin SDK de Supabase; la edge sigue custodiando `OPENROUTER_API_KEY`.
- 🔑 **Auth/RBAC:** endpoints existentes, mismos guards (`JwtAuthGuard`); sin permisos nuevos.
- ✅ **Validación:** todos los campos nuevos con Zod (tipo, prefijo dataURL, topes de tamaño).
- 🔒 **BD:** cero cambios de esquema/roles/RLS; cero escrituras nuevas (la captura no se persiste).
- 🧾 **Trazabilidad:** `debug_meta.traza` registra la petición/uso de captura; el marcador 📸
  queda en el mensaje persistido.
- 👁️ **Privacidad:** exclusión de passwords + `data-soporte-exclude-capture`; la captura solo
  contiene lo que ese usuario ya ve con sus permisos; consentimiento siempre visible (botón
  explícito o mensaje «📸 Esta es mi pantalla»). PII hacia OpenRouter: mismo perímetro que
  `consultar_datos` (aceptado por Jereff en la plática del 2026-08-05).

## Fuera de alcance (explícito)

- Adjuntar/pegar imágenes arbitrarias del usuario (Kaizen2 lo tiene; aquí no se pidió).
- Persistir capturas (bucket/URL firmada) — decisión: no se guardan.
- Co-browsing en vivo. Pestaña «Qué sigue» de Montse (guía por reglas).

## Criterios de aceptación

1. El panel abre/cierra empujando el contenido (sin taparlo) en escritorio; en móvil ocupa el
   ancho completo. El sidebar se colapsa al abrir y se restaura al cerrar.
2. Botón 📷: el modelo describe correctamente lo que hay en pantalla (probar en una tabla con
   filtros y en un modal con error).
3. Pregunta tipo «¿por qué se ve así?» sin captura → el agente la pide → auto-captura → responde
   viéndola; el reenvío no puede encadenar otra captura.
4. Un campo password y un nodo marcado con `data-soporte-exclude-capture` salen en blanco/ausentes.
5. `v2_soporte_mensajes` no contiene base64; el marcador 📸 sí. La auditoría de conversaciones
   sigue funcionando.
6. typecheck + lint + build limpios (api y web); envío de captura de ~500 KB pasa el body limit.

## Estimación y orden

| Fase | Esfuerzo | Puede entregarse sola |
|---|---|---|
| F1 Panel | ~½ día | Sí |
| F2 Visión | ~1 día | Requiere F1 (captura excluye el panel por construcción) |
| F3 Errores API | ~¼ día | Sí (cualquier momento) |

Cierre estándar: «documenta todo» (KB `modulos/soporte-ia.md` + changelog + versión). Riesgo del
cambio: **medio-bajo** (sin BD/dinero/auth) → auto-revisión del orquestador + prueba funcional;
sin gate adversarial completo.
