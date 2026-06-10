# Arquitectura de Reportes — SPH Bienes Raíces

Este documento define el estándar y flujo completo para crear, mantener e integrar reportes
interactivos en FlutterFlow mediante WebView y Supabase Edge Functions.

---

## Índice

1. [Arquitectura general](#1-arquitectura-general)
2. [Tipos de reporte](#2-tipos-de-reporte)
3. [Estándar recomendado: Edge Function](#3-estándar-recomendado-edge-function)
4. [Enfoque anterior: Combine Text](#4-enfoque-anterior-combine-text-referencia)
5. [Cómo crear un nuevo reporte](#5-cómo-crear-un-nuevo-reporte)
6. [Estructura de archivos](#6-estructura-de-archivos)
7. [Seguridad](#7-seguridad)
8. [Integración en FlutterFlow](#8-integración-en-flutterflow)
9. [Convenciones de código](#9-convenciones-de-código)

---

## 1. Arquitectura general

Los reportes son **Single Page Applications (SPA)** escritas en HTML/CSS/JS puro que:

- Se renderizan dentro de un **WebView** en FlutterFlow.
- Se conectan a Supabase directamente desde el navegador usando la librería `supabase-js` vía CDN.
- Usan el **JWT del usuario autenticado** para respetar RLS y registrar trazabilidad.
- Consumen datos via **RPCs de PostgreSQL** (funciones que encapsulan las queries).

```
Usuario en app FF
      │
      │  (sesión activa con JWT)
      ▼
FlutterFlow WebView
      │
      │  HTML+CSS+JS completo
      ▼
Reporte renderizado en dispositivo
      │
      │  supabase-js (HTTPS)
      ▼
Supabase (RPCs / REST API)
      │
      ▼
PostgreSQL (datos reales)
```

---

## 2. Tipos de reporte

### Tipo A — Standalone (reportes legacy)
Archivo HTML único, autocontenido. Usado en: `CRM/`, `inversionistas/`, `Fideicomiso/fide.html`.

**Limitación:** Las credenciales de Supabase van hardcodeadas (anon key solamente). No pueden
usar el JWT del usuario → no pueden respetar RLS personalizada por usuario.

### Tipo B — Combine Text (en desuso)
El HTML se parte en 3–5 fragmentos y FlutterFlow los ensambla inyectando JWT y UID.

**Limitación:** Frágil. FlutterFlow interpola variables `{{...}}` en los textos estáticos,
lo que puede romper el ensamble. Difícil de depurar.

### Tipo C — Edge Function (estándar actual ✅)
FlutterFlow llama a una Edge Function con el JWT en el header `Authorization`.
La función ensambla el HTML completo con las credenciales ya inyectadas y lo retorna.
FlutterFlow usa el string retornado como contenido HTML del WebView.

**Ventajas:**
- Un solo bloque estático en FF (sin Combine Text).
- El JWT nunca se manipula en FF; viaja directo al servidor por HTTPS.
- Si el JWT es inválido, la función retorna `401` antes de entregar el HTML.
- Fácil de actualizar: solo se modifica el repositorio, no la configuración de FF.

---

## 3. Estándar recomendado: Edge Function

### Flujo detallado

```
FF llama a la Edge Function
  │  GET https://[proyecto].supabase.co/functions/v1/[nombre-reporte]
  │  Header: Authorization: Bearer [JWT del usuario]
  │  ← HTTPS (encriptado) →
  ▼
Edge Function (Deno / TypeScript)
  │  1. Lee JWT del header Authorization
  │  2. Valida que el JWT empiece con 'eyJ' (formato básico)
  │  3. Extrae el UID del payload: JSON.parse(atob(jwt.split('.')[1])).sub
  │  4. Ensambla: parte1 + JWT + conector + UID + parte3
  │  5. Retorna el HTML completo con Content-Type: text/html
  ▼
FF recibe el HTML como string
  │  (resultado de la llamada API en FF)
  ▼
WebView renderiza el reporte completo
  │
  ▼
El JS dentro del reporte llama a Supabase
  usando el JWT ya embebido → RLS activa ✓
```

### Estructura de la Edge Function

```typescript
// supabase/functions/[nombre-reporte]/index.ts

import { PARTE1, PARTE3 } from './html_parts.ts';

const CONECTOR = `'; const SUPABASE_KEY = (USER_JWT && USER_JWT.startsWith('eyJ'))
  ? USER_JWT : SUPABASE_ANON_KEY; const CURRENT_UID = '`;

Deno.serve(async (req) => {
  // 1. Extraer JWT
  const authHeader = req.headers.get('Authorization') || '';
  const jwt = authHeader.replace('Bearer ', '').trim();

  // 2. Validación básica
  if (!jwt.startsWith('eyJ')) {
    return new Response('Unauthorized', { status: 401 });
  }

  // 3. Extraer UID del payload
  let uid = '';
  try {
    const payload = JSON.parse(atob(jwt.split('.')[1]));
    uid = payload.sub || '';
  } catch (_) { /* uid queda vacío */ }

  // 4. Ensamblar HTML
  const html = PARTE1 + jwt + CONECTOR + uid + PARTE3;

  // 5. Retornar
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',           // nunca cachear (el JWT cambia cada sesión)
    },
  });
});
```

### Partes del HTML

Cada reporte se divide en exactamente **3 archivos** dentro de su carpeta:

| Archivo | Descripción |
|---|---|
| `parte1.html` | Todo el HTML desde `<!DOCTYPE html>` hasta `const USER_JWT = '` |
| `parte3.html` | Desde `';` (cierre del JWT) hasta `</html>` — contiene toda la lógica JS |
| `test_completo.html` | Ensamble local para pruebas (JWT vacío, sin credenciales reales) |

El **conector** (lo que va entre JWT y UID) está hardcodeado en la Edge Function, no en un archivo separado.

---

## 4. Enfoque anterior: Combine Text (referencia)

> Solo se documenta para entender reportes existentes. No usar para nuevos reportes.

En FlutterFlow se usaba un widget `Combine Text` con 5 piezas:

```
[parte1.html] + [JWT variable] + [parte2.txt] + [UID variable] + [parte3.html]
```

**Problema:** FF interpreta `{{...}}` dentro de los textos estáticos como variables propias,
lo que corrompe el conector `parte2.txt`. Además, si el UID se inyecta mal, el reporte
queda en carga infinita porque `loadSaldos` (u otras funciones con `fetch` directo) se cuelga
sin timeout dentro de un `Promise.all`.

**Solución aplicada (Fideicomiso/contabilidad):**
- Se migró a Edge Function.
- `loadSaldos` usa `sb.from()` en lugar de `fetch` directo para evitar cuelgues en WebView.

---

## 5. Cómo crear un nuevo reporte

### Paso 1 — Diseñar el HTML/CSS/JS

Crear el reporte como HTML standalone y probarlo en el navegador con la **anon key**
(RLS desactivada temporalmente para desarrollo).

Convenciones obligatorias:

```html
<!-- Al inicio del <script>, SIEMPRE estas 3 constantes en este orden: -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
<script>
const SUPABASE_URL  = 'https://[proyecto].supabase.co';
const SUPABASE_ANON_KEY = '[anon key pública]';
const USER_JWT = '          ← aquí parte1 termina

// ← aquí inicia parte3 (después de inyectar JWT y UID)
';
const SUPABASE_KEY  = (USER_JWT && USER_JWT.startsWith('eyJ')) ? USER_JWT : SUPABASE_ANON_KEY;
const CURRENT_UID   = '...'; // se inyecta desde la Edge Function

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { headers: { Authorization: `Bearer ${SUPABASE_KEY}` } }
});
```

> **Importante:** La instancia del cliente siempre se llama `sb` en reportes nuevos.
> Los reportes legacy usan `supabaseClient` — no mezclar.

### Paso 2 — Dividir en parte1 y parte3

Una vez que el reporte funciona en el navegador:

1. Cortar el archivo en el punto exacto `const USER_JWT = '` (parte1 incluye esa línea hasta la comilla).
2. Todo lo que sigue (desde `';` en adelante) es parte3.
3. Guardar ambos archivos en `reportes/[Modulo]/[nombre-reporte]/`.

### Paso 3 — Crear la Edge Function

1. Crear la carpeta `supabase/functions/[nombre-reporte]/`.
2. Copiar la plantilla de Edge Function (sección 3).
3. Incrustar parte1 y parte3 como strings en `html_parts.ts` usando base64 para evitar
   problemas de escape con backticks y template literals:

```typescript
// html_parts.ts
// Generar con PowerShell:
//   $b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes("parte1.html"))

export const PARTE1 = new TextDecoder().decode(
  Uint8Array.from(atob('BASE64_DE_PARTE1'), c => c.charCodeAt(0))
);
export const PARTE3 = new TextDecoder().decode(
  Uint8Array.from(atob('BASE64_DE_PARTE3'), c => c.charCodeAt(0))
);
```

### Paso 4 — Generar test_completo.html

```powershell
# Ejecutar desde la carpeta del reporte
$base = ".\reportes\[Modulo]\[nombre-reporte]"
$p1   = Get-Content "$base\parte1.html" -Raw -Encoding UTF8
$p3   = Get-Content "$base\parte3.html" -Raw -Encoding UTF8
$html = $p1 + "" + $p3
[System.IO.File]::WriteAllText("$base\test_completo.html", $html, [System.Text.Encoding]::UTF8)
```

> Con JWT vacío el reporte usa la `ANON_KEY` como fallback. Desactivar RLS durante desarrollo.

### Paso 5 — Desplegar la Edge Function

```bash
supabase functions deploy [nombre-reporte] --project-ref [ref-proyecto]
```

O usar el MCP de Supabase: `mcp__supaSPH__deploy_edge_function`.

### Paso 6 — Conectar en FlutterFlow

Ver sección [8. Integración en FlutterFlow](#8-integración-en-flutterflow).

### Paso 7 — Reactivar RLS

```sql
ALTER TABLE public."[tabla]" ENABLE ROW LEVEL SECURITY;
```

---

## 6. Estructura de archivos

```
reportes/
├── ARQUITECTURA_REPORTES.md       ← este documento
├── BITACORA_REPORTES.md           ← historial de cambios y problemas resueltos
│
├── CRM/                           ← Tipo A (standalone legacy)
│   ├── dashboard.html
│   └── prospectos.html
│
├── inversionistas/                ← Tipo A (standalone legacy)
│   ├── vencidos.html
│   └── estadoCta.html
│
└── Fideicomiso/                   ← Mixto
    ├── fide.html                  ← Tipo A (standalone legacy)
    └── contabilidad/              ← Tipo C (Edge Function) ✅
        ├── parte1.html            ← HTML hasta `const USER_JWT = '`
        ├── parte3.html            ← JS desde `';` en adelante
        ├── test_completo.html     ← Para pruebas locales (sin credenciales reales)
        └── README.md              ← Documentación específica del reporte
```

Cada nuevo reporte Tipo C debe tener su propia subcarpeta con esta estructura mínima:
```
reportes/[Modulo]/[nombre-reporte]/
├── parte1.html
├── parte3.html
├── test_completo.html
└── README.md
```

---

## 7. Seguridad

### Qué viaja por la red

| Dato | Cómo viaja | Riesgo |
|---|---|---|
| JWT del usuario | HTTPS al llamar la Edge Function | Bajo (TLS, expira en 1h) |
| JWT embebido en HTML retornado | HTTPS (respuesta de la función) | Bajo (misma sesión) |
| SUPABASE_URL | En el HTML (visible) | Nulo (es pública) |
| SUPABASE_ANON_KEY | En el HTML (visible) | Nulo (es pública por diseño) |
| UID del usuario | Extraído del JWT en el servidor | No viaja separado |

### Reglas obligatorias

1. **Nunca hardcodear JWTs reales** en los archivos del repositorio.
2. **`Cache-Control: no-store`** en la Edge Function — el HTML contiene el JWT y no debe cachearse.
3. **Validar el JWT** antes de retornar el HTML (si es inválido → 401).
4. **RLS activa en producción** — desactivar solo durante desarrollo local y reactivar al terminar.
5. **No usar `fetch` directo** para llamadas a Supabase dentro del JS del reporte.
   Siempre usar `sb.from()` o `sb.rpc()` para garantizar manejo de auth y CORS en WebView.
6. **`Promise.all` sin funciones que usen `fetch` directo** — si una promesa se cuelga en WebView,
   el spinner queda infinito. Toda llamada debe ir por el cliente `sb`.

### Por qué el JWT en el HTML no es un problema mayor

El JWT ya está en el HTML de todas formas (sea Combine Text o Edge Function). El JS necesita
ese token para autenticarse en cada llamada a Supabase. Lo que sí cambia con la Edge Function:
- El JWT no se manipula en FF (menos riesgo de corrupción del token).
- La función puede validarlo antes de retornar el HTML.
- El token expira en 1 hora, lo que limita el daño si alguien accede al HTML.

---

## 8. Integración en FlutterFlow

### Configuración en FF (reporte Tipo C con Edge Function)

**1. Crear el API Call**

En FF → API Calls → `+` → configurar:

| Campo | Valor |
|---|---|
| Nombre | `getReporte[NombreReporte]` |
| Método | `GET` |
| URL | `https://[proyecto].supabase.co/functions/v1/[nombre-reporte]` |
| Header `Authorization` | `Bearer [FF Variable: Id token]` |
| Response Type | `Plain Text` |

**2. Configurar el WebView**

En la pantalla de FF donde va el reporte:
- Agregar widget `WebView`.
- En la propiedad `HTML Content`: usar el resultado del API Call (`responseBody`).
- El WebView renderiza el HTML directamente.

**3. Llamar al API antes de mostrar**

En la acción de inicialización de la página (o en `On Page Load`):
1. Acción: `Backend/Database` → `API Call` → `getReporte[NombreReporte]`.
2. Guardar el resultado en una variable de página (`pageVar_htmlReporte`).
3. El WebView usa `pageVar_htmlReporte` como `HTML Content`.

### Consideraciones de WebView en FF

- **Android:** El WebView de Android puede bloquear `fetch` desde HTML local. Por eso se usa
  `sb.from()` / `sb.rpc()` (supabase-js maneja correctamente los headers CORS en WebView).
- **iOS:** WKWebView (usado por FF en iOS) requiere que las peticiones salgan por HTTPS. Supabase
  siempre usa HTTPS, por lo que no hay problema.
- **Cache:** El WebView puede cachear el HTML. Agregar un query param con timestamp si se necesita
  forzar recarga: `?t=[timestamp]` en la URL de la Edge Function.

---

## 9. Convenciones de código

### Variables globales del reporte (orden obligatorio)

```js
const SUPABASE_URL      = 'https://...';          // URL del proyecto
const SUPABASE_ANON_KEY = 'eyJ...';               // Clave pública anon
const USER_JWT          = '[inyectado por EF]';   // JWT del usuario
const SUPABASE_KEY      = USER_JWT.startsWith('eyJ') ? USER_JWT : SUPABASE_ANON_KEY;
const CURRENT_UID       = '[inyectado por EF]';   // UID del usuario (extraído del JWT)

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { headers: { Authorization: `Bearer ${SUPABASE_KEY}` } }
});
```

### Nombre de instancia del cliente

| Contexto | Nombre |
|---|---|
| Reportes nuevos (Tipo C) | `sb` |
| Reportes legacy (Tipo A) | `supabaseClient` |

No mezclar nombres en el mismo archivo.

### Manejo de errores en llamadas async

```js
// ✅ Correcto
try {
  const { data, error } = await sb.rpc('mi_funcion', { p_param: valor });
  if (error) throw error;
  // usar data
} catch (err) {
  mostrarError(err.message || JSON.stringify(err));
}

// ❌ Incorrecto — fetch directo cuelga en WebView sin timeout
const res = await fetch(`${SUPABASE_URL}/rest/v1/miTabla`, { headers: {...} });
```

### Toast de feedback

Todos los reportes deben implementar una función `showToast(msg)` para feedback al usuario
(guardado, error, acción completada). Ver implementación en `Fideicomiso/contabilidad/parte3.html`.

---

*Última actualización: 19/05/2026*
*Autor: Claude Sonnet 4.6 — Proyecto SPH Bienes Raíces*
