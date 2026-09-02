---
modulo: Pendientes (tablero de trabajo del proyecto)
estado: desarrollado
version_doc: 1.0
ultima_actualizacion: 2026-09-02
submodulos: [Listado, Alta y edición, Cambio de estado, Filtros por columna]
rutas: [/configuraciones/pendientes]
claves_permiso: []
acceso: solo soporte (catUsers.isSupport = true)
tablas: [dev_pendientes, auditoria]
funciones: [fn_dev_pendientes_touch, fn_auditoria]
palabras_clave: [pendientes, tablero de pendientes, backlog, deuda, deuda técnica, DEUDA.md, "dónde registro esto", "dónde anoto la deuda", "dónde va este pendiente", "una sola fuente", pendiente, bug conocido, mejora pendiente, módulo nuevo, decisión abierta, urgencia, P0, P1, P2, P3, bloqueado, en curso, descartado, "qué falta por hacer", "qué sigue", roadmap, prioridades, "trabajo diferido", "lo que quedó pendiente", soporte, "solo soporte"]
relacionado_con: [configuraciones, cron, soporte-ia, auditoria-y-ver-como]
---

# Módulo: Pendientes (tablero de trabajo del proyecto)

**Destino ÚNICO** de todo el trabajo pendiente del proyecto. **Solo para personal de soporte.**

## 1. Identificación

- **Qué es:** una pantalla en **Configuraciones → Pendientes** con la lista de todo lo que falta por
  hacer en el sistema, clasificado por **tipo**, **urgencia** y **estado**.
- **Quién la ve:** **únicamente** usuarios con `catUsers.isSupport = true`. No aparece para nadie más.
- **Desde cuándo:** v2.70.0 (2026-09-02).

## 2. Qué hace / para qué sirve

Antes de esto los pendientes vivían en **cinco lugares**: los dos `DEUDA.md`, las secciones §8/§9 del
contrato, las secciones «Estado y pendientes» de cada módulo de la KB, y lo que se hubiera dicho en una
conversación. **Un pendiente anotado en dos lugares se desincroniza y acaba mintiendo en los dos.**

Ahora hay **un solo destino**. Los archivos anteriores quedaron **congelados como histórico de solo
lectura**: conservan el análisis largo (evidencia, matices, por qué se difirió) que no cabe en una fila,
y el campo `origen` de cada fila apunta a ellos. **El estado vigente es siempre el de la fila.**

## 3. Cómo se usa

1. **Ver qué sigue:** los contadores de arriba cuentan **solo lo abierto** (abiertos, P0, P1, en curso,
   bloqueados). Lo terminado no cuenta: el tablero es para trabajar, no para lucir avance.
2. **Cambiar el estado:** con el desplegable **de la propia fila**, sin abrir nada. Si mover algo
   exigiera abrir un diálogo, nadie lo movería y el tablero se desactualizaría.
3. **Capturar o editar:** «+ Nuevo pendiente», o clic en el título de una fila. Lo **único
   obligatorio es el título** — capturar tiene que ser barato o los pendientes no se capturan.
4. **Buscar algo viejo** («¿esto ya lo habíamos hecho?»): activar **«Ver terminados y descartados»**.
   Por defecto solo se ve lo vivo.
5. **Filtrar:** embudo en Tipo, Urgencia, Estado y Módulo (selección múltiple, regla 7c).

## 4. Reglas de negocio

### 4.1. Qué va al tablero y qué no

| | Va al **tablero** | Se queda en **documentos** |
|---|---|---|
| Qué es | **Trabajo pendiente**: deuda técnica, bug conocido, mejora, módulo nuevo, petición de negocio, decisión abierta | **Conocimiento**: por qué un módulo funciona así, decisiones ya tomadas (📌) |
| Por qué | Tiene **estado**, cambia, y hay que priorizarlo | No tiene estado: es historia |

⛔ **Operar la plataforma NO es un pendiente.** Asignar un permiso, capturar los correos de los
proveedores, publicar un registro DNS: eso lo hace quien administra el sistema. Se menciona **una vez**
al entregar y **no se arrastra**. Meterlo aquí infla el tablero y entierra lo que sí importa.

### 4.2. Cómo se escribe una fila (la fila debe bastarse sola)

⛔ **Si hay que abrir otro archivo para entender el pendiente, la fila está mal escrita.**

- **titulo** — el problema **afirmado**, en lenguaje de negocio. Bien: *«Cualquier usuario autenticado
  puede concederse todos los permisos»*. Mal: *«P0-3»*, *«arreglar segModulosUsuarios»*.
- **descripcion** — el **qué** y el **porqué**, con evidencia concreta (archivo:línea, tabla, cifras
  reales) y, si se difirió, **por qué se difirió** (evita que alguien lo redescubra y lo vuelva a diferir
  por la misma razón).
- **notas** — el **arreglo propuesto** y las trampas al implementarlo. Es lo que ahorra rehacer el
  análisis la próxima vez.
- **origen** — la traza al análisis largo (`DEUDA.md P0-1`, `Sesión 2026-08-26`, quién lo pidió). Sirve
  para **leer el detalle**, nunca para saber el **estado**.

### 4.3. Los tres catálogos

| Campo | Valores | Criterio |
|---|---|---|
| **tipo** | `modulo_nuevo` · `mejora` · `bug` · `deuda_tecnica` · `seguridad` · `datos` | Un módulo nuevo exige gate de diseño; un bug no. |
| **urgencia** | `p0` crítica · `p1` alta · `p2` media · `p3` cuando se pueda | **Si todo es P0, nada es P0.** |
| **estado** | `propuesto` · `aprobado` · `en_curso` · `bloqueado` · `terminado` · `descartado` | **`bloqueado` es el más útil**: separa «no lo hemos hecho» de «no lo podemos hacer todavía» (espera una decisión, un tercero, otro pendiente). |

### 4.4. Otras reglas

- **Un pendiente = una unidad de trabajo.** Si el arreglo real es una sola pasada, es UN pendiente que
  cita varios orígenes (así se agruparon P2-11 + P2-15, que se resuelven con el mismo RPC).
- **Antes de capturar, buscar si ya existe.** Un duplicado con otro título es peor que no tenerlo.
- **`resuelto_at` lo sella y lo LIMPIA el backend**, no se toca a mano: si al reabrir se quedara el
  sello, seguiría contando como resuelto.
- **Lo terminado no se borra: se marca.** `descartado` conserva el registro y lo saca de la vista.
- **Al resolverlo se llena `version_resuelto`** — cierra el círculo con `v2_changelog`.
- **En el cierre «documenta todo»:** lo diferido entra al tablero **antes** de commitear; lo resuelto se
  marca `terminado` con su versión (regla 11 de `contexto.md` §1 y paso 0 de §5e).

## 5. Arquitectura

**Backend** — `apps/api/src/modules/pendientes/`
- `pendientes.types.ts` — catálogos (`TIPOS`, `URGENCIAS`, `ESTADOS`) y tipos. ⛔ Sus **claves** deben ser
  idénticas a los `CHECK` de la tabla: agregar un valor en TypeScript sin agregarlo en la BD hace que el
  INSERT se rechace en runtime.
- `pendientes.schemas.ts` — Zod. Los enums salen de los catálogos, no se reescriben.
- `pendientes.service.ts` — `listar` / `guardar` / `cambiarEstado` / `borrar`. Escrituras con
  **`comoActor(uid)`** (regla 6). Errores con `fallaBd` (regla 4b). El sellado de `resuelto_at` vive en
  **un solo** método privado que reusan `guardar` y `cambiarEstado`.
- `pendientes.controller.ts` — `@UseGuards(JwtAuthGuard, SoporteGuard)`. Clases `TableroPendientes*` para
  no chocar con el `PendientesController` de CxP (que es otra cosa: solicitudes pendientes).

**Frontend** — `apps/web/src/features/pendientes/`
- `types.ts` (espejo de los catálogos) · `pendientes.api.ts` · `TableroPendientesPage.tsx`.
- Ruta **lazy** en `router.tsx` (`/configuraciones/pendientes`); ítem en `menu.tsx` con `soloSoporte: true`.

**Endpoints:** `GET /pendientes[?incluirCerrados=true]` · `POST /pendientes` (alta y edición) ·
`PATCH /pendientes/:id/estado` · `DELETE /pendientes/:id`.

## 6. Seguridad

⛔ **Sin clave de permiso, a propósito.** Una clave existe para **repartirla**. Este tablero lista deuda
técnica y **hallazgos de seguridad**: no es material para repartir en la empresa, y cada clave que no se
asigna a nadie es una puerta que alguien puede abrir por descuido. El gate es `isSupport`, igual que Cron
y Soporte. Verificado el 2026-09-02: **1 solo usuario** lo tiene.

**Dos capas:**
1. `JwtAuthGuard` + `SoporteGuard` en el controlador (los 4 endpoints).
2. `dev_pendientes` con **RLS ON sin políticas** + `REVOKE ALL` a `anon`/`authenticated`: solo el backend
   (`service_role`) la alcanza. Aunque alguien llamara el endpoint sin ser soporte, la tabla no responde.

⚠️ **Si algún día se abre a más gente**, entonces sí convendría una clave — y hay que revisar antes qué
hallazgos de seguridad contiene el tablero.

## 7. Gotchas / trampas conocidas

- ⚠️ **`dev_pendientes` no está en `@erp/types`**: se accede con `.from('dev_pendientes' as any)` y el
  cast del resultado, igual que `mail_avisos_rep`. Se limpia cuando se regeneren los tipos.
- ⚠️ **Hay DOS `PendientesPage` en el front** y había dos `PendientesController` en el back: el de CxP
  (solicitudes pendientes de gestionar) y este. Por eso las clases de aquí se llaman `TableroPendientes*`.
  Si vuelven a colisionar, el síntoma es `TS2440: Import declaration conflicts with local declaration`.
- ⚠️ **El listado NO pagina, a propósito:** es el backlog de un producto (decenas de filas) y el filtrado
  por columna necesita tenerlas en memoria. Lleva `.range(0, 4999)` explícito para no depender del tope de
  PostgREST. Si algún día pasara de unos cientos, mover filtro y paginación al servidor.
- ⚠️ **El filtro de «solo abiertos» usa `.in()` con la lista de abiertos**, no `not.in`: la sintaxis de
  PostgREST para negar una lista es fácil de escribir mal y **falla en silencio** devolviendo todo.
- 📌 **Sin exportación a Excel/PDF** (decisión 2026-09-02): la regla transversal de tablas de datos pide
  exportación corporativa, pero un PDF con el membrete de la empresa listando hallazgos de seguridad es
  justo lo que no conviene que circule, y la pantalla la ve una sola persona. Si se abre a más gente, se
  reconsidera junto con el permiso.
- 📌 **No se anuncia en el CHANGELOG.** El changelog es lo que el usuario lee en «Novedades»; describirle
  una pantalla que no puede abrir es contarle algo que no va a encontrar, y avisarle que existe un tablero
  con deuda técnica. La versión se registra como mejoras internas.

## 8. Decisiones

- **📌 2026-09-02 — El gate es `isSupport`, no un permiso.** Se descartó crear claves `.view`/`.gestionar`
  por lo dicho en §6.
- **📌 2026-09-02 — `modulo` es texto libre, sin catálogo.** Los módulos nacen y se renombran más rápido de
  lo que costaría mantener el catálogo, y un pendiente puede ser transversal.
- **📌 2026-09-02 — `id` (bigserial) ES el folio.** Es el número corto para hablar («el 12»); el orden de
  captura ya es información.

## 9. Para el agente de soporte

- **«¿Dónde registro este pendiente / esta deuda / este bug conocido?»** → En **Configuraciones ▸
  Pendientes**, y **solo ahí**. No en `DEUDA.md` ni en ningún otro archivo: esos quedaron congelados el
  2026-09-02 y sus estados pueden estar vencidos.
- **«¿Qué falta por hacer en el sistema?» / «¿qué sigue?»** → El tablero, ordenado por urgencia. Los
  contadores de arriba cuentan solo lo abierto.
- **Solo lo ve personal de soporte** (`catUsers.isSupport`). Si un usuario normal pregunta por él, no
  aparece en su menú y no es un error: no tiene acceso, y no es una clave que se pueda pedir.
- **«¿Por qué mi pendiente sigue ahí si ya se hizo?»** → Puede que se resolviera sin marcarlo. La regla
  es marcarlo `terminado` con su `version_resuelto` en el cierre de la versión que lo resolvió.
- **Diferencia importante:** «Pendientes» de **Configuraciones** es el backlog del proyecto; «Solicitudes
  pendientes» de **CxP** son facturas por gestionar. No son lo mismo.
