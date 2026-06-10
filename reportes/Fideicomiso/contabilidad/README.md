# Contabilidad Fideicomiso — Documentación del Reporte

---

## Arquitectura actual (Edge Function) ✅

Este reporte se sirve mediante una **Supabase Edge Function** que ensambla el HTML completo con las credenciales del usuario inyectadas server-side. FlutterFlow hace una sola llamada HTTP y usa la respuesta como contenido del WebView.

```
FF (usuario autenticado)
  │  GET /functions/v1/contabilidad-fideicomiso
  │  Authorization: Bearer [JWT del usuario]
  ▼
Edge Function
  │  1. Valida que el JWT empiece con 'eyJ'
  │  2. Extrae UID del payload (campo sub)
  │  3. Lee parte1 y parte3 de la tabla reporte_html_parts (base64)
  │  4. Ensambla: parte1 + JWT + conector + UID + parte3
  │  5. Retorna HTML completo con Cache-Control: no-store
  ▼
WebView FF renderiza el reporte
  │
  ▼
JS del reporte llama a Supabase con el JWT embebido → RLS activa
```

### Configuración en FlutterFlow

| Campo | Valor |
|---|---|
| Tipo | API Call — GET |
| URL | `https://szjlkvakwljssdnysazp.supabase.co/functions/v1/contabilidad-fideicomiso` |
| Header `Authorization` | `Bearer [Id token del usuario]` |
| Response type | Plain Text |

El resultado (`responseBody`) se pasa directamente al WebView como `HTML Content`. No se usa Combine Text.

---

## Archivos del reporte

| Archivo | Descripción |
|---|---|
| `parte1.html` | HTML completo desde `<!DOCTYPE html>` hasta `const USER_JWT = '` |
| `parte2.txt` | Conector legacy (ya no se usa en producción, se conserva como referencia) |
| `parte3.html` | JavaScript desde `';` hasta `</html>` — toda la lógica del reporte |
| `test_completo.html` | Ensamble local para pruebas en el navegador (JWT vacío, usa anon key) |

### Cómo regenerar test_completo.html

```powershell
$base = ".\reportes\Fideicomiso\contabilidad"
$p1   = Get-Content "$base\parte1.html" -Raw -Encoding UTF8
$p3   = Get-Content "$base\parte3.html" -Raw -Encoding UTF8
[System.IO.File]::WriteAllText("$base\test_completo.html", $p1 + $p3, [System.Text.Encoding]::UTF8)
```

> Con JWT vacío el reporte usa la anon key como fallback. Desactivar RLS durante pruebas locales.

---

## Cómo actualizar el reporte

Cuando se modifica `parte1.html` o `parte3.html`, hay que subir los nuevos base64 a la tabla `reporte_html_parts`. La Edge Function **no necesita redespliegue**.

```powershell
$url     = 'https://szjlkvakwljssdnysazp.supabase.co'
$anonKey = '[SUPABASE_ANON_KEY]'
$base    = ".\reportes\Fideicomiso\contabilidad"

$p1b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes("$base\parte1.html"))
$p3b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes("$base\parte3.html"))

$headers = @{
    'apikey'        = $anonKey
    'Authorization' = "Bearer $anonKey"
    'Content-Type'  = 'application/json'
    'Prefer'        = 'resolution=merge-duplicates'
}

$body = @(
    @{ nombre = 'contabilidad_parte1'; contenido = $p1b64 }
    @{ nombre = 'contabilidad_parte3'; contenido = $p3b64 }
) | ConvertTo-Json -Depth 3

Invoke-RestMethod -Uri "$url/rest/v1/reporte_html_parts" -Method POST -Headers $headers -Body $body
```

---

## Edge Function

- **Nombre:** `contabilidad-fideicomiso`
- **Archivo fuente:** `supabase/functions/contabilidad-fideicomiso/index.ts`
- **verify_jwt:** `true` — Supabase valida el JWT antes de ejecutar la función
- **Versión activa:** 2

### Lógica del conector (inyectado entre parte1 y parte3)

```js
'; const SUPABASE_KEY = (USER_JWT && USER_JWT.startsWith('eyJ')) ? USER_JWT : SUPABASE_ANON_KEY; const CURRENT_UID = '
```

---

## Variables del JS en tiempo de ejecución

| Variable | Origen | Uso |
|---|---|---|
| `SUPABASE_URL` | Hardcoded en parte1 | URL del proyecto Supabase |
| `SUPABASE_ANON_KEY` | Hardcoded en parte1 | Clave pública anon |
| `USER_JWT` | Inyectado por Edge Function | JWT de la sesión activa |
| `SUPABASE_KEY` | Calculado en el conector | JWT si válido, anon key si no |
| `CURRENT_UID` | Inyectado por Edge Function | UID extraído del payload del JWT |
| `sb` | Inicializado en parte3 | Cliente Supabase con Authorization header |

---

## Tablas y RPCs que consume

| Recurso | Tipo | Operación |
|---|---|---|
| `pivot_contabilidad(p_anio smallint)` | RPC | SELECT — filas del pivot por concepto y mes |
| `pivot_contabilidad_totales(p_anio smallint)` | RPC | SELECT — filas BASE IVA, IVA 16%, SIN IVA, GRAN TOTAL |
| `fideContaConceptos` | Tabla | SELECT — catálogo en cascada para el modal Nuevo |
| `fideContabilidad` | Tabla | INSERT / UPDATE — movimientos contables |
| `fideSaldosBanco` | Tabla | SELECT / INSERT / DELETE — saldo estado de cuenta por mes |
| `fideContaHistorial` | Tabla | INSERT — auditoría de cambios |
| `reporte_html_parts` | Tabla | SELECT — partes del HTML en base64 (leído por la Edge Function) |

---

## Estado de la RLS

| Tabla | RLS | Política SELECT |
|---|---|---|
| `fideContabilidad` | ✅ Activa | `auth.role() = 'authenticated'` |
| `fideContaConceptos` | ✅ Activa | `auth.role() = 'authenticated'` |
| `fideSaldosBanco` | ✅ Activa | `auth.role() = 'authenticated'` |
| `fideContaHistorial` | ✅ Activa | `auth.role() = 'authenticated'` |

---

## ⚠️ Pendiente: corregir SECURITY DEFINER en los RPCs

Las funciones `pivot_contabilidad` y `pivot_contabilidad_totales` se cambiaron a `SECURITY DEFINER` como solución temporal para que la RLS no bloquee las consultas internas del reporte.

**Implicación:** Cualquier usuario autenticado puede llamar estas funciones y obtener todos los datos contables, sin restricción por usuario o rol.

**Por qué se hizo así:** La RLS con `auth.role() = 'authenticated'` bloqueaba las tablas cuando los RPCs se ejecutaban como `SECURITY INVOKER`, devolviendo arrays vacíos aunque el JWT fuera válido (PostgREST retorna 200 con `[]` en lugar de error).

**Lo que hay que hacer cuando se corrija:**
1. Cambiar las funciones de vuelta a `SECURITY INVOKER`
2. Agregar una política RLS más específica, por ejemplo filtrando por un campo de fideicomiso o usando un rol de Supabase dedicado
3. O bien, mantener `SECURITY DEFINER` pero agregar dentro de la función un `WHERE` que valide el rol del usuario usando `current_setting('request.jwt.claims')::jsonb->>'role'` u otro campo del JWT

---

## Historial de cambios relevantes

| Fecha | Cambio |
|---|---|
| May 2026 | Implementación inicial del reporte con Combine Text (5 partes en FF) |
| May 2026 | Refactor a edición inline por celda (Excel-like) + filtros de texto |
| May 2026 | Indicadores IVA por celda (punto naranja/gris) con toggle interactivo |
| May 2026 | Modal "+ Catálogo" para agregar conceptos nuevos a `fideContaConceptos` |
| May 2026 | Migración a Edge Function — elimina Combine Text, un solo API Call en FF |
| May 2026 | `loadSaldos` migrado de `fetch` directo a `sb.from()` para evitar cuelgues en WebView |
| May 2026 | RPCs cambiados a `SECURITY DEFINER` como solución temporal a bloqueo de RLS |
