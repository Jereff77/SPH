---
modulo: Landing / Indicadores
estado: desarrollado
version_doc: 1.0
ultima_actualizacion: 2026-06-04
submodulos: [Inicio]
rutas: [/]
claves_permiso: []
tablas: [inpc]
apis_externas: [Banxico SIE API (serie SF43718)]
palabras_clave: [inicio, landing, dashboard, tipo de cambio, dólar, USD, MXN, INPC, indicadores, Banxico, "no carga el tipo de cambio", "aparece como raya", "inpc desactualizado", "la página principal", "el tablero"]
relacionado_con: [configuraciones, autenticacion]
---

# Módulo: Landing / Indicadores

## 1. Identificación

- **Propósito:** pantalla de inicio tras el login. Muestra el logotipo y dos tarjetas de indicadores:
  **Tipo de cambio** (USD/MXN) e **INPC**.
- **A quién sirve:** todos los usuarios autenticados.
- **Sinónimos del usuario:** "la pantalla de inicio", "el tablero", "la página principal".

## 2. Pantalla y ruta

| Pantalla | Ruta | Permiso |
|---|---|---|
| Inicio (landing) | `/` | requiere sesión |

## 3. Indicadores

### Tipo de cambio (USD/MXN)
- **Fuente:** API de **Banxico** (SIE), serie **SF43718** (tipo de cambio FIX, pesos por dólar).
- **Cómo se obtiene:** el **backend** hace de proxy (`GET /indicadores/tipo-cambio`). El **token de
  Banxico vive en el servidor** (`BANXICO_TOKEN`) y **nunca se expone al frontend**.
- **Muestra:** valor en MXN (4 decimales) + la fecha que publica Banxico. Se refresca ~cada 30 min
  (Banxico publica una vez al día).

### INPC
- **Fuente:** el **último registro** capturado en la tabla `inpc` (`GET /indicadores/inpc`, ordenado por
  consecutivo descendente).
- **Muestra:** el valor del INPC (3 decimales) + el mes/año correspondiente.
- Se captura/gestiona en **Configuraciones → Parámetros → INPC**.

## 4. ⚠️ Detalles no obvios (gotchas)

1. El **token de Banxico** es server-side por seguridad; si el tipo de cambio no carga, suele ser la API
   de Banxico (caída/limite) o el token, no el frontend.
2. El INPC del landing es el **último capturado**; si se ve desactualizado, falta capturar el mes en
   Parámetros → INPC.
3. Ambos indicadores requieren **sesión** (el landing es post-login).

## 5. Relaciones con otros módulos

- **Configuraciones → Parámetros (INPC):** alimenta la tarjeta de INPC.
- **Configuraciones → Sistema:** define el logotipo que se muestra centrado.

## 6. Para el agente de soporte (🩺 diagnóstico / problemas comunes)

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| "El tipo de cambio aparece como —." | Banxico no respondió o el token falla. | Reintentar más tarde; si persiste, revisar el token/servicio (soporte). |
| "El INPC está desactualizado." | No se ha capturado el mes actual. | Capturar en Parámetros → INPC. |
| "Las tarjetas no cargan." | Sesión expirada. | Volver a iniciar sesión. |

**Cuándo escalar a ticket:** caída sostenida de Banxico o token inválido (requiere intervención técnica).

## 7. Estado y pendientes

> 📋 **Los pendientes de este módulo viven en el TABLERO** (Configuraciones ▸ Pendientes, tabla
> `dev_pendientes`) desde el 2026-09-02 — regla 11 de `contexto.md` §1. Lo de abajo es **histórico**:
> su estado puede estar vencido y **no se abren pendientes nuevos aquí**. Lo que sí sigue vivo en esta
> sección es el **✅ hecho** (qué hace el módulo hoy), que es conocimiento, no trabajo pendiente.

- ✅ Tipo de cambio (Banxico, vía backend) e INPC (último registro) conectados.
- ⏳ Posibles indicadores/accesos directos adicionales en el dashboard.
