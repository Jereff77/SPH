# Contabilidad Fideicomiso — Estructura de Partes para FlutterFlow

Este reporte se embebe en un **WebView de FlutterFlow** usando un widget de tipo `HtmlWidget` o similar con una variable `Combine Text`. El archivo HTML completo se ensambla dinámicamente inyectando las credenciales del usuario autenticado.

---

## ¿Por qué está dividido en partes?

El JWT de Supabase y el UID del usuario no pueden estar hardcodeados en el HTML porque:
- El JWT expira con cada sesión
- Cada usuario tiene su propio UID
- El archivo vive en el repositorio y sería un riesgo de seguridad

La solución es dividir el HTML en fragmentos estáticos y dejar que FlutterFlow inyecte los valores dinámicos en tiempo de ejecución.

---

## Estructura del Combine Text en FlutterFlow

El widget Combine Text ensambla 5 piezas en este orden:

```
[Text 1] parte1.html
[Text 2] → Variable FF: Id token (JWT token)       ← DINÁMICO
[Text 3] → parte2.txt                              ← ESTÁTICO (conector)
[Text 4] → Variable FF: usuarioActual -> uid       ← DINÁMICO
[Text 5] → parte3.html
```

El resultado concatenado forma el HTML completo y válido que se renderiza en el WebView.

---

## Contenido de cada archivo

### `parte1.html`
Todo el HTML desde `<!DOCTYPE html>` hasta la línea:
```js
const USER_JWT = '
```
Incluye: estructura HTML, todos los estilos CSS, el HTML del body (tabla, modales, filtros) y el inicio del bloque `<script>` con las constantes públicas de Supabase (`SUPABASE_URL`, `SUPABASE_ANON_KEY`).

**Cambio aplicado:** Se agregó `cursor: pointer` a las filas de datos para indicar que son clickeables.

### `parte2.txt`
Texto estático que conecta el JWT con el UID. Contiene:
```
'; const SUPABASE_KEY = (USER_JWT && USER_JWT !== '{{USER_JWT_TOKEN}}') ? USER_JWT : SUPABASE_ANON_KEY; const CURRENT_UID = '
```
Este fragmento:
- Cierra el string del JWT (`'`)
- Define `SUPABASE_KEY` eligiendo entre el JWT del usuario o la anon key como fallback
- Abre el string para recibir el UID (`= '`)

### `parte3.html`
El resto del JavaScript desde:
```js
';

const sb = supabase.createClient(...)
```
Incluye: inicialización del cliente Supabase, toda la lógica de la tabla pivot, filtros, notas, saldo banco, modal de alta/edición, detección de duplicados, historial de cambios.

**Cambios aplicados:**
1. `tr.onclick = () => openEditPicker(f)` — activado para que al hacer clic en un renglón abra el modal de edición
2. `const isEdit = !!editId` al inicio de `guardarMovimiento()` — corrige el bug del botón que siempre mostraba "Agregar" en lugar de "Actualizar" al editar

---

## Variables que usa el JS en tiempo de ejecución

| Variable | Origen | Uso |
|---|---|---|
| `SUPABASE_URL` | Hardcoded en parte1 | URL del proyecto Supabase |
| `SUPABASE_ANON_KEY` | Hardcoded en parte1 | Clave pública anon |
| `USER_JWT` | Inyectado por FF (Text 2) | JWT de la sesión activa del usuario |
| `SUPABASE_KEY` | Calculado en parte2 | Key efectiva: usa JWT si es válido, si no cae a anon |
| `CURRENT_UID` | Inyectado por FF (Text 4) | UID del usuario para trazabilidad en escrituras |
| `sb` | Inicializado en parte3 | Cliente Supabase con el header Authorization correcto |

---

## Tablas y RPCs que consume

| Recurso | Tipo | Operación |
|---|---|---|
| `pivot_contabilidad(p_anio)` | RPC | SELECT — datos del pivot por mes |
| `pivot_contabilidad_totales(p_anio)` | RPC | SELECT — filas de subtotales y gran total |
| `fideContaConceptos` | Tabla | SELECT — catálogo en cascada para el modal |
| `fideContabilidad` | Tabla | INSERT / UPDATE / SELECT — movimientos contables |
| `fideSaldosBanco` | Tabla | SELECT / POST / DELETE — saldo estado de cuenta por mes |
| `fideContaHistorial` | Tabla | INSERT — registro de auditoría de cambios |

---

## Flujo de ensamble

```
FF Authentication
      │
      ├─ Id token (JWT)  ──────────────────────┐
      └─ usuarioActual.uid  ───────────────┐   │
                                           │   │
parte1.html ──► [JWT] ──► parte2.txt ──► [UID] ──► parte3.html
      │                                               │
      └─────────────── HTML completo ────────────────┘
                              │
                         WebView FF
                              │
                    Renderiza el reporte
```
