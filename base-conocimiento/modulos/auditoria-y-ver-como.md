---
modulo: Auditoría / Ver como
estado: desarrollado
version_doc: 1.0
ultima_actualizacion: 2026-06-04
submodulos: [Auditoría (bitácora), Ver como]
rutas: [/configuraciones/usuarios]
claves_permiso: [200]
tablas: [auditoria, actividad, catUsers]
palabras_clave: [auditoría, bitácora, historial, trazabilidad, quién cambió, antes y después, log, ver como, impersonar, soporte, así estaba, el sistema lo cambió, "quién cambió este dato", "el sistema lo cambió solo", "no veo el historial", "el long-press no hace nada", "no me deja guardar", "modo solo lectura", "un cambio no aparece en la bitácora"]
relacionado_con: [configuraciones, autenticacion]
---

# Módulo: Auditoría / Ver como

Dos funciones transversales orientadas a soporte y trazabilidad.

## 1. Identificación

- **Auditoría (bitácora):** registra **todo cambio** de datos (crear/editar/eliminar) con su **diff
  antes/después** y **quién** lo hizo. Resuelve disputas tipo "así estaba" / "el sistema lo cambió solo".
- **Ver como:** permite a un usuario de **soporte** observar la aplicación **como otro usuario** (solo
  lectura) para diagnosticar qué ve y qué puede hacer.
- **Sinónimos del usuario:** "el historial", "quién modificó esto", "la bitácora"; "ver como tal persona".

## 2. Auditoría (bitácora)

### Cómo funciona
- El registro se hace con **triggers en la base de datos** (`fn_auditoria`) sobre las tablas de negocio
  (≈107 tablas). Por eso captura cambios **tanto de v2 como de v1**, e incluso cambios hechos directo en
  la base.
- Cada registro guarda: **quién** (`uid`), **origen** (1 = v1/Flutter, 2 = v2/backend, 3 = directo en BD),
  **entidad** (tabla), **id_entidad**, **acción** (INSERT/UPDATE/DELETE), **cambios** (diff
  `{campo: {antes, después}}`) y snapshots completos del antes/después.
- El **"quién"** se toma del JWT verificado, **no** de campos del cliente → no es falsificable.
- La función es **a prueba de fallos**: si la auditoría fallara, nunca rompe la operación del usuario.

### Tablas
- **`auditoria`** (nueva, v2): la bitácora estructurada.
- **`actividad`** (vieja, v1): bitácora de texto libre. **Se conserva** (v1 la usa). Su histórico
  (8,737 registros) se **copió** a `auditoria` como registros `accion = 'LEGACY'` (origen 1), conservando
  el comentario y el contexto original. Así el historial queda unificado.

### Dónde se consulta
- En **Configuraciones → Usuarios**: cada usuario tiene un botón de **Historial** (icono reloj) que abre,
  a la derecha, su actividad en orden **descendente**. Para los registros nuevos muestra el **diff**
  (campo: antes → después); para los `LEGACY` muestra el **comentario** original de v1.
- Endpoint: `GET /auditoria?uid=…` (permiso 200).

## 3. Ver como (impersonación de solo lectura)

### Cómo se usa
- Disponible **solo para usuarios de soporte** (`isSupport`).
- Se activa con **long-press (mantener presionado ~0.6 s) sobre el logo** del sidebar → abre un selector
  buscable de usuarios.
- Al elegir uno, la app muestra los **menús, botones y pantallas con los permisos de ese usuario** (lo
  que él vería). Aparece un **banner ámbar**: "Viendo como [Nombre] — modo solo lectura", con botón
  **Salir**.

### Reglas y seguridad
- Es **solo lectura**: mientras está activo, **toda acción de escritura queda bloqueada** (no se puede
  crear/editar/eliminar a nombre de nadie). No sirve para actuar como otro, solo para **ver**.
- **No cambia la sesión real:** el soporte sigue siendo él mismo; solo se cargan los permisos del objetivo
  para reflejar su vista. Validado en el servidor (`GET /auth/contexto/:uid`, solo si el solicitante es
  soporte).
- **Ve también los DATOS del usuario observado:** en las pantallas cuyos datos dependen del usuario (p. ej.
  CxP → Solicitudes de pago, que muestra "mis solicitudes"), el frontend envía la cabecera **`X-Ver-Como`**
  con el uid observado y el backend la respeta **solo si quien pide es soporte** (`SupabaseService.
  uidEfectivo`). Así soporte ve exactamente lo que vería ese usuario, no sus propios registros. Las
  pantallas de catálogos globales (parques, proveedores, bancos) no cambian (son iguales para todos).
- El estado vive **solo en memoria**: al recargar la página, vuelve a la identidad real.

## 4. ⚠️ Detalles no obvios (gotchas)

1. La auditoría cubre **v1 y v2** porque está a nivel de base de datos (triggers), no en una sola app.
2. `actividad` (v1) NO se elimina; es candidata a retiro **cuando se apague v1** (ver `OBSOLESCENCIA-BD.md`).
3. En "Ver como", si el usuario intenta guardar algo verá un aviso de **"solo lectura"**: es esperado.
4. "Ver como" refleja los permisos del objetivo **sin** el bypass de soporte (así ve exactamente lo que
   ese usuario ve).

## 5. Relaciones con otros módulos

- **Todos los módulos:** cualquier cambio en cualquier módulo queda en `auditoria`.
- **Usuarios (Configuraciones):** es el punto de consulta del historial y el origen del selector de
  "Ver como".

## 6. Para el agente de soporte (diagnóstico / problemas comunes)

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| "¿Quién cambió este dato?" | — | Consultar el Historial del usuario o la entidad en `auditoria`. |
| "No veo el historial de un usuario." | Falta permiso 200 (módulo Usuarios). | Revisar permisos. |
| "El long-press en el logo no hace nada." | El usuario no es soporte. | Es por diseño; solo soporte. |
| "En 'Ver como' no me deja guardar." | Modo solo lectura. | Salir de "Ver como" para editar. |
| "Un cambio no aparece en la bitácora." | La tabla no tiene trigger, o fue una lectura (no cambio). | Verificar que la tabla esté auditada (soporte). |

**Cuándo escalar a ticket:** sospecha de cambios no registrados, o necesidad de auditar una tabla que no
tiene trigger.

## 7. Estado y pendientes

- ✅ Auditoría con diff antes/después en ≈107 tablas (v1+v2), histórico de `actividad` migrado, panel de
  Historial por usuario, "Ver como" de solo lectura para soporte.
- ⏳ Pantalla de auditoría global con filtros avanzados (hoy se consulta por usuario).
- ⏳ Indexar la KB en pgvector (fase del agente de soporte).
