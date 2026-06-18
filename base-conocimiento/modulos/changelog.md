---
modulo: Changelog / Novedades
estado: desarrollado
version_doc: 1.1
ultima_actualizacion: 2026-06-18
submodulos: [Novedades (changelog), Versión del sistema]
rutas: [/configuraciones/novedades]
claves_permiso: []
tablas: [v2_changelog]
funciones: [v2_changelog_registrar]
palabras_clave: [novedades, changelog, versión, versiones, actualización, cambios, qué cambió, historial de versiones, release, nota de versión, SemVer, número de versión]
relacionado_con: [configuraciones, auditoria-y-ver-como]
---

# Módulo: Changelog / Novedades

La bitácora oficial de **versiones del sistema**: qué se agregó, cambió o corrigió en cada versión, y cuándo.

## 1. Identificación

- **Qué es:** un historial de versiones (estilo "notas de la versión") que el usuario consulta en
  **Configuraciones → Novedades**. Muestra cada versión con su **fecha** y la lista de **cambios** agrupados
  por tipo.
- **Versión del sistema:** la versión que aparece en el **sidebar** (debajo del nombre del usuario) es la del
  **bundle realmente cargado** en el navegador (`APP_VERSION`), **no** la del changelog. Al hacer clic se abre
  Novedades. ⚠️ Desde **v2.35.0** (2026-06-18): si el servidor ya tiene una versión más nueva, aparece un
  **banner "nueva versión disponible"** arriba, con la instrucción para recargar (**Ctrl + Shift + F5** en
  Windows o **⌘ + Shift + F5** en Mac). Así el usuario sabe que sigue en una versión anterior y fuerza la
  actualización.
- **Sinónimos del usuario:** "las novedades", "qué cambió", "qué versión es", "el historial de
  actualizaciones", "las notas de la versión".

## 2. Cómo funciona

- **Disponible para TODOS** los usuarios autenticados: el ítem de menú **no requiere permiso** (igual que
  "Cambiar contraseña"). Cualquiera que inicie sesión puede ver las novedades.
- Es de **solo lectura** para el usuario final. No hay pantalla para crear/editar versiones: el changelog lo
  **escribe el equipo de desarrollo** cuando publica cambios.
- Los datos vienen del backend (`GET /api/changelog`); el navegador **no** consulta la base directamente.

### Versionado (SemVer)

El número de versión es `MAYOR.MENOR.PARCHE`:

| Sube… | Cuándo | Ejemplo |
|---|---|---|
| **PARCHE** (2.0.**1**) | Corrección de un error | Se arregla un cálculo de fechas |
| **MENOR** (2.**1**.0) | Funcionalidad nueva (sin romper lo anterior) | Se agrega el módulo Reportes |
| **MAYOR** (**3**.0.0) | Cambio grande o que rompe compatibilidad | Rediseño de un flujo completo |

### Categorías de cambio

Cada cambio tiene un **tipo**, con su color en la pantalla:

- **Agregado** — funcionalidad nueva.
- **Cambiado** — cambia el comportamiento de algo existente.
- **Corregido** — corrección de un error.
- **Eliminado** — algo que se quitó.
- **Obsoleto** — algo marcado para retirarse en el futuro.
- **Seguridad** — corrección o medida de seguridad.

## 3. Dónde se consulta

- **Configuraciones → Novedades** (`/configuraciones/novedades`).
- Atajo: clic en la **versión** del sidebar.

## 4. ⚠️ Detalles no obvios (gotchas)

1. ⚠️ **(Cambió en v2.35.0)** La versión del sidebar **es la del bundle cargado** (`APP_VERSION` /
   `APP_VERSION_RAW` en `constants.ts`), **no** la del changelog. Antes se leía del changelog (BD), lo que hacía
   que "cambiara" sin que el usuario recargara — anulando su utilidad (veía la versión nueva pero seguía con el
   código viejo). Ahora solo cambia al **desplegar y recargar la página**. El changelog (BD) se usa para la
   lista de Novedades y para **avisar** (banner) de que hay una versión más nueva, comparando el bundle contra
   `/version.json` (que el build emite — **no** la BD).
2. Si una versión está marcada como **no publicada**, no aparece en la lista (sirve para preparar una versión
   antes de anunciarla).
3. El changelog **registra quién** lo edita (auditoría server-side), aunque eso no se muestra al usuario.
4. Es un **objeto nuevo de v2** (tabla `v2_changelog`); el sistema anterior (Flutter) no tiene esta pantalla.

## 5. Relaciones con otros módulos

- **Configuraciones:** Novedades vive dentro de este grupo de menú.
- **Auditoría:** los cambios al changelog quedan registrados en la bitácora (`auditoria`), como cualquier
  otra tabla de datos.

## 6. 🩺 Diagnóstico / problemas comunes

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| "No veo las Novedades en el menú." | Sesión no iniciada. | Iniciar sesión; el ítem es visible para todos. |
| "La lista de novedades está vacía." | Aún no se ha cargado el historial en la base (tabla `v2_changelog`). | Escalar: falta aplicar la migración / cargar versiones. |
| "La versión del sidebar no cambió tras una actualización." | El navegador sigue con el bundle anterior en caché (no recargó). | Recargar con **Ctrl + Shift + F5** (Windows) o **⌘ + Shift + F5** (Mac). Si aparece el banner "nueva versión disponible", usar su botón. |
| "Aparece 'nueva versión disponible' pero ya recargué." | El despliegue (build) aún no termina, o el navegador sirve caché vieja. | Esperar a que termine el deploy y forzar recarga dura (Ctrl/⌘ + Shift + F5). |

**Cuándo escalar a ticket:** la lista no carga (error del servidor) o una versión publicada no aparece.

## 7. Estado y pendientes

- ✅ Pantalla de Novedades (línea de tiempo + buscador), endpoint de solo lectura, versión del sidebar
  enlazada al changelog, regla de proceso documentada en el HANDOFF (regla 9 + sección 5e).
- ✅ Tabla `v2_changelog` y función `v2_changelog_registrar` **aplicadas** en la BD; historial 2.0.0 → 2.10.0
  cargado.
- ⏳ Indexar el changelog en la **BD vectorial** (pgvector) en la fase del agente de soporte, **derivado** de
  `v2_changelog` (la tabla sigue siendo la fuente de verdad). Permite preguntas semánticas tipo "¿cuándo se
  arregló lo de las fechas de los planes?".
- ⏳ Tras un futuro `gen types`: regenerar `@erp/types` y quitar el cast temporal `as any` de
  `changelog.service.ts`.

## 8. Para el desarrollador: registrar versiones y «documenta todo»

### Concurrencia (varios agentes a la vez)

Hay **varios agentes** trabajando en paralelo. Por eso **NUNCA** se hardcodea el número de versión: lo asigna
la BD. Se registra **siempre** con la función:

```sql
SELECT public.v2_changelog_registrar('minor', 'Título', '[{"tipo":"Agregado","descripcion":"…"}]'::jsonb);
```

La función toma un `pg_advisory_xact_lock`, lee la versión más alta **en ese instante** y calcula la
siguiente (`major`/`minor`/`patch`). Si dos agentes registran a la vez, el segundo espera y parte de la
versión que el primero acaba de crear → **no se tropiezan**.

### Comando «documenta todo»

Cuando el usuario dice **«documenta todo»**, el agente ejecuta en orden: (1) registra la versión con la
función; (2) alinea **`APP_VERSION_RAW`** en `constants.ts` (la versión visible y `/version.json` salen del
**bundle**, no de la BD — ver gotcha 1); (3) actualiza la KB; (4) actualiza HANDOFF y `contexto.md`;
(5) **commit + push en el repo `erp_v2`** con mensaje que empieza por `vN.N.N: …`.
**⛔ graphify NO se ejecuta** en el cierre salvo que el usuario lo indique explícitamente (regla 10).
Detalle completo en **HANDOFF.md → sección 5e**.
