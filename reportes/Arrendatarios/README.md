# Reporte Pagos Arrendatarios — Documentación

---

## Arquitectura (Edge Function)

El reporte se sirve mediante una **Supabase Edge Function** que inyecta el JWT y UID del usuario autenticado server-side. FlutterFlow hace una sola llamada HTTP y usa la respuesta como contenido del WebView.

```
FF (usuario autenticado)
  │  GET /functions/v1/pagos-arrendatarios
  │  Authorization: Bearer [JWT del usuario]
  ▼
Edge Function
  │  1. Valida que el JWT empiece con 'eyJ'
  │  2. Extrae UID del payload (campo sub)
  │  3. Lee 'pagos_arrendatarios' de reporte_html_parts (base64)
  │  4. Decodifica base64 → HTML
  │  5. Replace "const USER_JWT = '';" → "const USER_JWT = '[JWT]';"
  │  6. Replace "const CURRENT_UID = '';" → "const CURRENT_UID = '[UID]';"
  │  7. Retorna HTML completo con Cache-Control: no-store
  ▼
WebView FF renderiza el reporte
  │
  ▼
JS del reporte usa SUPABASE_KEY = USER_JWT para llamar a Supabase con RLS activa
```

### Configuración en FlutterFlow

| Campo | Valor |
|---|---|
| Tipo | API Call — GET |
| URL | `https://szjlkvakwljssdnysazp.supabase.co/functions/v1/pagos-arrendatarios` |
| Header `Authorization` | `Bearer [Id token del usuario]` |
| Response type | Plain Text |

El resultado (`responseBody`) se pasa directamente al WebView como `HTML Content`.

---

## Archivos del reporte

| Archivo | Descripción |
|---|---|
| `pagos.html` | HTML completo del reporte — fuente de verdad para edición |
| `README.md` | Este documento |

> No hay parte1/parte3 — la Edge Function inyecta JWT y UID con `.replace()` sobre los placeholders del HTML completo.

---

## Edge Function

- **Nombre:** `pagos-arrendatarios`
- **Archivo fuente:** `supabase/functions/pagos-arrendatarios/index.ts`
- **verify_jwt:** `true` — Supabase valida el JWT antes de ejecutar la función
- **Versión activa:** 1

### Variables inyectadas

| Variable | Placeholder en HTML | Valor inyectado |
|---|---|---|
| `USER_JWT` | `const USER_JWT = '';` | JWT del usuario autenticado |
| `CURRENT_UID` | `const CURRENT_UID = '';` | UID extraído del campo `sub` del JWT |

### Variables JS en tiempo de ejecución

| Variable | Origen | Uso |
|---|---|---|
| `SUPABASE_URL` | Hardcoded en pagos.html | URL del proyecto Supabase |
| `SUPABASE_ANON_KEY` | Hardcoded en pagos.html | Clave pública anon (fallback) |
| `USER_JWT` | Inyectado por Edge Function | JWT de la sesión activa |
| `SUPABASE_KEY` | Calculado en el JS | JWT si válido, anon key si no |
| `CURRENT_UID` | Inyectado por Edge Function | UID del usuario autenticado |
| `sb` | Inicializado en pagos.html | Cliente Supabase con SUPABASE_KEY |

---

## Cómo actualizar el reporte

Cuando se modifica `pagos.html`, subir el nuevo base64 a `reporte_html_parts`. La Edge Function **no necesita redespliegue**.

```powershell
$base    = ".\reportes\arrendatarios"
$htmlB64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes("$base\pagos.html"))

$url     = 'https://szjlkvakwljssdnysazp.supabase.co'
$anonKey = '[SUPABASE_ANON_KEY]'

$headers = @{
    'apikey'        = $anonKey
    'Authorization' = "Bearer $anonKey"
    'Content-Type'  = 'application/json'
    'Prefer'        = 'resolution=merge-duplicates'
}

$body = @(@{ nombre = 'pagos_arrendatarios'; contenido = $htmlB64 }) | ConvertTo-Json -Depth 3

Invoke-RestMethod -Uri "$url/rest/v1/reporte_html_parts" -Method POST -Headers $headers -Body $body
```

---

## Tablas y funciones que consume

| Recurso | Tipo | Operación |
|---|---|---|
| `pagos_arrendatarios(...)` | RPC | SELECT — registros de pago por nave/arrendatario |
| `contratos_por_vencer(p_fecha_desde, p_fecha_hasta)` | RPC | SELECT — contratos próximos a vencer (sidebar) |
| `contratos_vencidos_sin_renovacion()` | RPC | SELECT — contratos vencidos sin nuevo contrato (sidebar) |
| `movbancarios_sin_aplicar(p_busqueda, p_anio, p_mes)` | RPC | SELECT — depósitos bancarios pendientes de aplicar |
| `aplicar_pago_arrendatario(p_idmov, p_ids_detalle[], p_fec_pago)` | RPC | UPDATE — aplica pago en arrePdpDetalle y movbancarios |
| `reporte_html_parts` | Tabla | SELECT — HTML del reporte en base64 (leído por Edge Function) |

---

## Funcionalidades del reporte

### Tabla principal
- Agrupada por nave · parque · razón social
- Columnas: Nave, Parque, Razón Social, Pendiente MXN, USD, Cobrado MXN, Opciones
- Filtros de columna en thead fijo (nave, parque, razón social, concepto)
- Toggle Todos / Pendientes / Pagados
- Filtro de periodo (mes/año) en las cards
- Tooltip de desglose de conceptos al hover sobre montos
- Scroll independiente (header y cards fijos, solo datos scrollean)

### Cards de resumen
- Naves totales
- Naves pendientes
- Monto pendiente MXN
- Cobrado MXN

### Sidebar
- **Contratos vencidos sin renovación** — usa `arrePdp`, panel rojo arriba
- **1 / 2 / 3 meses para vencerse** — usa `arrePdp`, paneles naranja/amarillo/verde

### Modal de aplicación de pagos
- Se abre con el botón 💲 en la columna Opciones
- Columna izquierda: depósitos de `movbancarios` sin aplicar (búsqueda fuzzy + filtro mes/año)
- Columna derecha: naves pendientes con checkboxes y montos
- Resumen dinámico: Depósito / Seleccionado / Diferencia (sobrante permitido, insuficiente bloqueado)
- Al confirmar: marca `arrePdpDetalle.fecPago` y `movbancarios.aplicado = true`

---

## Historial de cambios

| Fecha | Cambio |
|---|---|
| May 2026 | Creación del reporte con tabla agrupada, sidebar y stats cards |
| May 2026 | Función `pagos_arrendatarios` con filtros de fecha, mes, año y pdpActivo |
| May 2026 | Función `contratos_por_vencer` y `contratos_vencidos_sin_renovacion` |
| May 2026 | Modal de aplicación de pagos con `movbancarios_sin_aplicar` y `aplicar_pago_arrendatario` |
| May 2026 | Layout fijo: stats y thead sticky, scroll solo en tabla y sidebar |
| May 2026 | Toggle Todos/Pendientes/Pagados en stats bar |
| May 2026 | Migración a Edge Function — inyección de JWT y UID server-side |
