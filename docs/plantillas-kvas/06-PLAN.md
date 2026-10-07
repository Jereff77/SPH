# 06 · Plan de construcción — Plantillas de documentos de KVA's

> Anclado a `00-brief-conceptual.md` (decisiones D1-D14), `02-TRD.md`, `03-UI-UX.md` y `05-BACKEND.md`.
> Autor: Nicanor (Sonnet) por encargo de Toribio. Fecha: 2026-10-07.
> Estado: **PLAN — nada se construye hasta el visto bueno de Jereff, el cierre de `07-VERIFICACION-ADVERSARIAL.md`
> sin hallazgos ALTA y la corrección del `.pen` (pantalla 3, ver PARADA P-3).**
> Rutas relativas a `version2/` salvo que se indique. Versión vigente en el repo: `2.75.1` (`apps/web/src/lib/constants.ts`).

---

## 0. Resumen ejecutivo (una página)

**Qué se construye.** Un generador de documentos por plantilla en Parques: **Parques → Plantillas** (listado + editor
Tiptap, versionado) y, en **Parques → KVA's**, un modal «Generar documento de asignación» que prellena la carta a CFE
con empresa + naves, deja ajustar el texto y emite un **PDF armado en el servidor** (pdfmake, con logo) que queda en el
expediente de cada nave. Caso de prueba real: **EM BAJÍO EMPAQUES**, naves 107-110 y 119-122, «5 KVAS».

**Cómo se parte.** 9 olas pequeñas (0-8). Cada ola termina con su comando de verificación en verde; la siguiente no
arranca sin eso. **Solo 1 ola toca producción** (ola 1, migración) y es PARADA obligatoria.

| Ola | Qué entrega | Modelo | Horas | Depende de |
|---|---|---|---:|---|
| 0 | Prerrequisitos: `branding.md`, `Modal` y `Flotante` en portal, dependencias (pdfmake, Tiptap), fuentes | Sonnet | 3.0 | — |
| 1 | Migración BD (4 tablas, 7 funciones, 3 permisos) en rama → producción | **Opus** (revisa) + Toribio aplica | 3.5 | 0 (solo el visto bueno) + `07` cerrado |
| 2 | Backend plantillas: CRUD + versiones + catálogo + campos puros + Zod | Sonnet (Opus revisa saneo) | 6.0 | 1 |
| 3 | Backend generar PDF: documentos, logo, motor pdfmake, idempotencia, X-9 | Sonnet (**Opus** revisa) | 8.0 | 2 |
| 4 | Frontend Plantillas: menú, listado, alta, editor Tiptap, conflicto de versión | Sonnet | 10.0 | 0, 2 |
| 5 | Frontend generar en KVA's: modal de 2 columnas, vista previa, expediente | Sonnet | 8.0 | 3, 4 (editor) y `.pen` corregido |
| 6 | Permisos 724/730/731: alta verificada, descripciones, concesión de prueba | Sonnet | 1.5 | 1 (alta en BD) · se cierra con 4 y 5 |
| 7 | Pruebas E2E y verificación adversarial final | Sonnet (E2E) + **Opus** (gate) | 6.0 | 2-6 |
| 8 | KB del módulo, diagrama de BD, changelog, versión, commit | Sonnet + Toribio | 3.0 | 7 |
| | **Total** | | **49 h** | |

**Calendario realista:** ~6-7 jornadas de trabajo efectivo. Camino crítico: 0 → 1 → 2 → 3 → 5 → 7 → 8 (≈ 38 h);
la ola 4 corre en paralelo a la 3 (son carpetas distintas), con lo que el calendario baja a ~5 jornadas si se lanzan
dos ejecutores a la vez.

**Dónde se detiene todo y se espera a Jereff** (detalle en §11): P-1 aprobar el plan · P-2 `07` sin ALTA ·
P-3 `.pen` pantalla 3 corregido · **P-4 migración en producción** · P-5 dependencias nuevas · P-6 concesión de permisos
en producción · **P-7 push/despliegue**.

**Riesgos que más importan** (matriz completa en §12): (1) arranque real de Nest con DI nueva —se verifica con
`pnpm dev`, no solo `tsc`—; (2) migración en producción; (3) `pdfmake` ESM/CJS y fuentes en `node:22-slim`;
(4) editor Tiptap: que el JSON que emite pase el Zod `strict` del servidor.

---

## 1. Reglas de ejecución (valen para TODAS las olas)

1. **Encargo cerrado:** cada ola se lanza como subagente con este documento + el brief + el TRD + 05 como contexto.
   Si el ejecutor tuviera que decidir arquitectura, el encargo está mal: PARA y avisa.
2. **Se respeta lo aprobado.** Cualquier apartarse de texto o visual autorizado → PARADA (regla global).
3. **Archivos temporales** en `temp/` del proyecto (en `.gitignore`); nada en el scratchpad del harness.
4. **Verificación de cada ola = 4 niveles**, en este orden, y se pega la salida real en la bitácora:
   - `pnpm --filter @erp/api typecheck` y/o `pnpm --filter @erp/web typecheck`
   - `pnpm --filter @erp/api build` y/o `pnpm --filter @erp/web build`
   - `pnpm --filter @erp/api test` (cuando la ola tiene pruebas)
   - ⛔ **ARRANQUE REAL (`pnpm dev:api`) en toda ola que toque el API**: en este proyecto un fallo de inyección de
     dependencias de Nest (proveedor sin registrar en `ParquesModule`, dependencia circular, módulo no `@Global`)
     **pasa `tsc` y `nest build` pero mata el contenedor**. Criterio de aceptación: el log muestra
     `Nest application successfully started` y `GET /api/health` (o la ruta de salud vigente) responde 200, y el
     log **no** contiene `Nest can't resolve dependencies`. Si hay front: `pnpm dev:web` abre sin errores en consola.
   - Puertos: consultar `~/.claude/puertos-en-uso.md` antes de arrancar; **nunca** matar procesos por nombre,
     solo por PID propio (regla global).
5. **Matar un proceso colgado** solo por PID confirmado con su `CommandLine`; si no se puede aislar → PARADA.
6. **Ninguna ola toca**: `kvasAsignados`, dotación, devoluciones, acometidas, el candado de liberación, el motor
   de saldo de KVA, `archivo-seguro.ts`, el bucket/políticas de Storage, ni modales existentes de `features/parques/`
   (migrarlos al `Modal` compartido queda fuera de alcance → pendiente a registrar en `base-conocimiento/DEUDA.md`).
7. **Commits:** selectivos (`git add <archivos>`, nunca `git add .`); uno por ola o por bloque lógico; **sin push**.
8. **Mutaciones de BD:** solo la ola 1, solo con autorización explícita de Jereff. Las demás olas **no ejecutan SQL
   mutante**. Los `SELECT` de verificación sí valen.

---

## 2. Ola 0 · Prerrequisitos

**Objetivo:** dejar listo el terreno compartido (marca, componentes en portal, dependencias, fuentes) sin tocar negocio.
**Modelo:** Sonnet · **Horas:** 3.0 · **Depende de:** nada (la instalación de dependencias exige P-5).

### 2.1 Tareas y archivos

| # | Tarea | Archivos exactos |
|---|---|---|
| 0.1 | Crear `modulos/branding.md` del proyecto (regla global: fuente de verdad de la marca). Contenido: azul `#1f2a4d`, verde `#8cc63f`, ámbar y rojo de `Badge.tsx`, tipografía real de `apps/web/src/index.css`, y **dónde vive el logo**: `SPHConfiguraciones` (`LOGO_FONDO_CLARO` JPG 400 px / `LOGO_FONDO_OSCURO` PNG), bucket público `branding`, `configuracionApi.getLogos`, `components/Logo.tsx`. Los valores se **leen** de `index.css`/`Badge.tsx` y de un `SELECT` en `SPHConfiguraciones`; no se reconstruyen de memoria. | Ruta de `modulos/` del proyecto: confirmar con `Glob` si existe `.sessions/base-conocimiento/modulos/` o `version2/base-conocimiento/modulos/` y crear `branding.md` junto a `kvas.md` (hoy está en `version2/base-conocimiento/modulos/`). |
| 0.2 | **`Modal` compartido en portal** (TRD/UI §10): `createPortal` a `document.body`, velo, Escape, clic fuera, foco atrapado y devuelto al abrir/cerrar, bloqueo de scroll del body, `role="dialog"`, `aria-modal`, `aria-labelledby`, props `titulo`, `ancho`, `cabeceraAzul`, `bloqueado` (deshabilita Escape/clic fuera mientras se genera). | `apps/web/src/components/Modal.tsx` (nuevo) |
| 0.3 | **`Flotante` y `Tooltip`** (portal + `position: fixed`, recoloca en scroll/resize, voltea arriba si no cabe, Escape y clic fuera; el tooltip aparece también con foco de teclado). Para el menú `/` del editor y los tooltips de iconos. | `apps/web/src/components/Flotante.tsx`, `apps/web/src/components/Tooltip.tsx` (nuevos) |
| 0.4 | **Iconos que faltan** (duplicar, baja, negrita, cursiva, subrayado, alinear ×4, lista, deshacer, rehacer, rayo, lápiz, advertencia, lupa si no existe). | `apps/web/src/components/icons.tsx` (solo agregar exports) |
| 0.5 | **Helper de fecha**: buscar antes en `apps/web/src/lib/` si existe `formatearFecha`/`formatearFechaHora` (dd/mm/aaaa, `HH:mm`); si no existe, crear uno. | `apps/web/src/lib/` (verificar con `Grep` antes) |
| 0.6 | **Instalar dependencias** (⛔ requiere P-5): `pnpm --filter @erp/api add pdfmake` y `-D @types/pdfmake`; `pnpm --filter @erp/web add @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-underline @tiptap/extension-text-align`. Revisar licencia de cada paquete (MIT esperado; **ninguna extensión de pago de Tiptap**) y correr `pnpm audit --prod`; anotar el resultado. Fijar versiones exactas (`pdfmake` 0.3.x). | `apps/api/package.json`, `apps/web/package.json`, `pnpm-lock.yaml` |
| 0.7 | **Fuentes del PDF**: confirmar que `pdfmake` 0.3.x trae Roboto con ñ/acentos y que el motor la carga **desde el paquete** (sin fuentes del sistema; `node:22-slim` no tiene ninguna). Prueba humo: script que renderiza «Año núm. 5 — ÁÉÍÓÚ ñ» a `temp/humo.pdf` y se abre. Si Roboto no se resuelve en el contenedor, **PARAR** (no improvisar otra fuente). | `temp/humo-pdfmake.mjs` (no se versiona) |
| 0.8 | Registrar el hallazgo «modales existentes sin portal» y «`ColumnFilter` de selección única» en `base-conocimiento/DEUDA.md` (o en el tablero si el proyecto ya lo usa; **un solo destino**: confirmar cuál es). | destino único de pendientes |

**Receta / módulo de referencia:** `components/tabla/ColumnFilter.tsx` (ya usa `createPortal` + `position: fixed`) para el
patrón de portal; `components/Sheet.tsx` para el manejo de foco y Escape.
**NO debe tocar:** modales existentes (`AsignacionKvaModal.tsx`, etc.), `ColumnFilter.tsx`, `Logo.tsx`.

### 2.2 Criterios de aceptación
- `modulos/branding.md` existe y cita colores/logo con su origen (archivo y línea o `SELECT`).
- `Modal` renderiza bajo `document.body` (verificable en DevTools: el nodo **no** está dentro de `#root` de la página), cierra con Escape y clic fuera, devuelve el foco, y con `bloqueado` no cierra.
- `Flotante` se recoloca al hacer scroll y voltea arriba cerca del borde inferior.
- `pdfmake` renderiza acentos y ñ en `humo.pdf` (revisión visual).
- Ningún archivo existente modificado salvo `icons.tsx` (solo adiciones) y los `package.json`/lockfile.

### 2.3 Verificación
```
pnpm install --frozen-lockfile=false
pnpm --filter @erp/web typecheck && pnpm --filter @erp/web build
pnpm --filter @erp/api typecheck && pnpm --filter @erp/api build
pnpm dev:api    # arranque real: sin «Nest can't resolve dependencies»
pnpm dev:web    # abre sin errores de consola
node temp/humo-pdfmake.mjs   # genera temp/humo.pdf con acentos
pnpm audit --prod            # anotar hallazgos; ALTA/CRÍTICA = PARAR
```

---

## 3. Ola 1 · Migración de base de datos `⛔ PRODUCCIÓN`

**Objetivo:** crear las 4 tablas, 7 funciones, triggers y 3 permisos de `05-BACKEND.md §2` sin alterar ninguna tabla existente.
**Modelo:** **Opus** para la revisión final del SQL (seguridad/migración, regla global); **Toribio** aplica; Sonnet solo prepara el archivo y los scripts de verificación.
**Horas:** 3.5 (0.5 preparar archivo y scripts · 1.0 rama + pruebas negativas · 1.0 revisión Opus · 0.5 producción + conteos · 0.5 tipos y KB de BD) · **Depende de:** P-1, P-2 (`07` cerrado sin ALTA).

### 3.1 Archivos
| Archivo | Acción |
|---|---|
| `base-conocimiento/migraciones/2026-10-XX-kvas-plantillas-documentos.sql` (ruta real: confirmar con `Glob`; `05-BACKEND §2` la nombra así) | **Crear** copiando el SQL de `05-BACKEND.md §2` **tal cual** (con el nombre y fecha reales) y **añadiendo el bloque de rollback ejecutable** (§3.4). Cualquier cambio al SQL aprobado → PARADA. |
| `temp/verif-migracion-antes.sql`, `temp/verif-migracion-despues.sql`, `temp/verif-migracion-negativas.sql` | Crear (no se versionan): las consultas de §3.3. |
| `packages/types/src/database.types.ts` | **Regenerar** con `generate_typescript_types` tras aplicar (Sonnet) y `pnpm --filter @erp/types build`. |

**Receta / referencia:** `2026-06-12-invitaciones.sql` (patrón «RLS sin políticas + REVOKE ALL»); `2026-09-07-fideicomiso-revoke-8-rpc-anon.sql` (REVOKE de funciones).
**NO debe tocar:** ninguna tabla existente (cero `ALTER`/`DROP`); los índices opcionales de §10 del SQL (`arrenPropiedades`, `propiedades`) **quedan comentados**.

### 3.2 Procedimiento (en este orden; cada paso es una parada de verificación)
1. **Conteos ANTES (solo `SELECT`, producción):** guardarlos en la bitácora:
   - `select count(*) from "kvaNaveDocs";` · `select count(*) from "segModulos";` · `select count(*) from "segModulosUsuarios";`
   - `select count(*) from naves; select count(*) from inversionista; select count(*) from "kvasAsignados" where status;`
   - `select clave from "segModulos" where clave in (724,730,731);` → **0 filas** (si hay alguna: PARAR, otro cambio chocó).
   - `select count(*) from information_schema.tables where table_name in ('kvaPlantillas','kvaPlantillaVersiones','kvaDocGenerados','kvaDocGeneradoNaves');` → 0.
2. **Rama de Supabase** (`create_branch`) y aplicar el archivo **completo** ahí. Si `create_branch` no está disponible o tiene costo no autorizado → PARADA (herramienta/gasto): no hay «plan B» de aplicar directo en producción sin decirlo.
3. **Verificación posterior en la rama** (el bloque «Verificación posterior» del SQL):
   - 0 filas en las 4 tablas · 3 filas en `segModulos` (724, 730, 731) · **0 políticas** en las tablas nuevas.
   - `has_function_privilege('anon','public.kva_naves_elegibles(text)','execute')` = **false**; ídem `authenticated`, para las 7 funciones; `service_role` = true.
   - `select count(*) from kva_naves_elegibles(null)` = **510** (hoy; 313 empresas; 96 naves en 2 empresas) — si difiere, entender por qué **antes** de seguir (los datos pueden haber cambiado; no es error por sí solo, pero se documenta).
4. **Pruebas negativas en la rama** (`temp/verif-migracion-negativas.sql`, con `set local role` y claims simulados): `update` sobre `kvaPlantillaVersiones` → `KV423`; `delete` en `kvaDocGenerados` → `KV423`; `update kvaDocGenerados set "contenidoFinal"=…` → `KV423`; `kva_plantilla_crear` sin claims → `KV401`; como `anon`/`authenticated`: `select` en las 4 tablas y `rpc` de las 7 funciones → denegado.
5. **Prueba funcional mínima en la rama** (con claims de un `uid` real de prueba): crear plantilla → guardar v2 (`baseVersion` 1) → guardar con `baseVersion` 1 otra vez → `KV409`; `kva_documento_registrar` con una nave de **otra** empresa → `KV422 NAVE_NO_PERTENECE`; con naves de la empresa → 1 fila en `kvaDocGenerados`, N en `kvaNaveDocs`, N en la puente; `kva_documento_baja` → baja el documento y sus N filas del expediente. Auditoría: filas en `auditoria` con el `uid` del actor.
6. **Revisión Opus del SQL ya probado** (encargo cerrado: el archivo + `07` + resultados de 3-5). Hallazgo ALTA = no se aplica.
7. ⛔ **PARADA P-4 — autorización explícita de Jereff** para aplicar en producción, **en el momento** (no basta la aprobación del plan). Mensaje corto: qué se aplica, que solo crea, el rollback, y que se hace fuera de horario si lo prefiere.
8. **Producción:** aplicar con `apply_migration` (una sola transacción, `begin … commit` ya incluido). Inmediatamente: conteos DESPUÉS (§3.3).
9. Si **cualquier** conteo no cuadra → ejecutar el rollback (§3.4) y reportar. No se «arregla sobre la marcha».
10. Borrar la rama de pruebas (`delete_branch`) **solo tras** confirmar que no se necesita.

### 3.3 Conteos antes/después (criterio de aceptación)
| Verificación | ANTES | DESPUÉS |
|---|---|---|
| `count(*)` `kvaNaveDocs` | N₀ | **N₀** (igual: la migración no genera documentos) |
| `count(*)` `segModulos` | M₀ | **M₀ + 3** |
| `count(*)` `segModulosUsuarios` | U₀ | **U₀** (nadie tiene los permisos nuevos) |
| `count(*)` `naves`, `inversionista`, `kvasAsignados` | n, i, k | **n, i, k** |
| Tablas `kva*` nuevas | 0 | **4**, todas con 0 filas |
| Políticas RLS en tablas nuevas | — | **0** · `relrowsecurity` = true en las 4 |
| `has_function_privilege('anon'/'authenticated', …)` de las 7 funciones | — | **false** |
| `kva_naves_elegibles(null)` | — | = 510 (o el valor actual explicado) |
| `get_advisors` (seguridad) | baseline guardado | **sin hallazgos nuevos** atribuibles a las tablas/funciones nuevas |

### 3.4 Plan de rollback (en el archivo de migración, comentado, y en `temp/rollback.sql`)
```sql
begin;
drop table if exists public."kvaDocGeneradoNaves", public."kvaDocGenerados",
                      public."kvaPlantillaVersiones", public."kvaPlantillas" cascade;
drop function if exists public.kva_documento_baja(uuid,text);
drop function if exists public.kva_documento_registrar(uuid,uuid,integer,text,text,date,jsonb,jsonb,jsonb,text,integer,text,uuid,text,text,jsonb);
drop function if exists public.kva_plantilla_baja(uuid,text);
drop function if exists public.kva_plantilla_guardar(uuid,integer,text,jsonb,jsonb,text);
drop function if exists public.kva_plantilla_crear(text,text,text,jsonb,jsonb,text);
drop function if exists public.kva_naves_elegibles(text);
drop function if exists public.kva_docgen_guardia();
drop function if exists public.kva_inmutable();
drop function if exists public.kva_actor();
delete from public."segModulos" s where s.clave in (724,730,731)
  and not exists (select 1 from public."segModulosUsuarios" u where u.clave in (724,730,731));
commit;
```
- **Cuándo se usa:** conteos que no cuadran, o fallo de la verificación posterior. **Antes** de que haya documentos generados es seguro (tablas vacías).
- **Después de que existan documentos generados:** el rollback destruiría documentos y filas del expediente enlazadas. Entonces **no** se hace `drop`: se corrige hacia adelante con una migración nueva y los archivos de Storage se conservan. Este punto de no retorno empieza en la primera generación en producción: se anota en la bitácora.
- Las filas de `kvaNaveDocs` que cree la función `kva_documento_registrar` **no** las borra el rollback de tablas (FK entrante): si se necesitara, se dan de baja con `status = false`, nunca `delete`.
- Orden de despliegue: la migración es **aditiva y retrocompatible** (el código viejo no la usa), así que puede ir **antes** del código sin riesgo.

### 3.5 Criterios de aceptación
Conteos de §3.3 cumplidos · pruebas negativas de §3.2.4 todas denegadas · `database.types.ts` regenerado y `pnpm --filter @erp/types build` en verde · bitácora con la salida real.

### 3.6 Verificación
```
pnpm --filter @erp/types build && pnpm --filter @erp/api typecheck && pnpm --filter @erp/web typecheck
# y los SELECT de §3.3 contra producción (MCP supaSPH) — solo lectura
```

---

## 4. Ola 2 · Backend de plantillas (CRUD + versiones)

**Objetivo:** que el API cree, lea, versione, restaure y dé de baja plantillas, con el contenido saneado por Zod y el catálogo cerrado por tipo.
**Modelo:** Sonnet (encargo cerrado); **Opus revisa** solo `kvas-plantillas.schemas.ts` (entrada hostil) · **Horas:** 6.0 · **Depende de:** ola 1 aplicada (al menos en la rama para desarrollar; para el arranque real contra producción, aplicada en producción).

### 4.1 Archivos (`apps/api/src/modules/parques/`)
| Archivo | Acción |
|---|---|
| `kvas-plantillas.schemas.ts` | **Crear**: copiar `05-BACKEND §3 y §3.1` (catálogo, límites, `textoSeguro`, `datosFijosSchema`, `crearContenidoSchema(tipo)`, `crearPlantillaSchema`, `guardarPlantillaSchema`, `restaurarVersionSchema`, `bajaSchema`). |
| `kvas-plantillas.campos.ts` | **Crear**: `agruparNaves`, `redactarKvas`, `unirY`, `fmtNum`, `kva`, `porEtiquetaCanonica`, `fechaLarga(date)` (meses propios, sin ICU), catálogo con etiquetas y ejemplos. **Puro**, sin imports de Nest. |
| `kvas-plantillas.service.ts` | **Crear**: `catalogo(tipo)`, `listar`, `obtener`, `versiones`, `version(n)`, `crear` (rpc `kva_plantilla_crear`), `guardar` (rpc `kva_plantilla_guardar`), `restaurar`, `baja`. Escrituras con `comoActor(uid)`; lecturas con `admin`; `.range(0, 4999)`; errores vía `fallaBd()` + traducción de SQLSTATE `KV404/KV409/KV410/KV422` a 404/409/409/422 con **texto de negocio redactado**, nunca `error.message`. |
| `kvas-plantillas.controller.ts` | **Crear**: `@Controller('kvas/plantillas')` **sin** `@RequierePermiso` de clase; `catalogo/:tipo` declarado **antes** de `:id`; cada ruta con su permiso de `05 §5.1` (730/724 lecturas, 731 escrituras); `ZodValidationPipe` por endpoint. |
| `parques.module.ts` | **Modificar**: registrar controlador y servicio nuevos (`controllers`, `providers`). |
| `kvas-plantillas.campos.spec.ts`, `kvas-plantillas.schemas.spec.ts` | **Crear**: pruebas (ver 4.3). |

**Receta / módulo de referencia:** `kvas.controller.ts` + `kvas.service.ts` (estructura, `PermisoGuard`, `comoActor`, `fallaBd`, `ZodValidationPipe`, `firmarVarias`), `kvas.schemas.ts` (estilo Zod del módulo), `supabase.service.ts:78-100` (`comoActor`).
**NO debe tocar:** `kvas.service.ts` (eso es la ola 3), `archivo-seguro.ts`, `permiso.guard.ts`, ningún otro módulo, ninguna migración.

### 4.2 Criterios de aceptación
- Con JWT de un usuario con 731: `POST /api/kvas/plantillas` → 201 `{ idPlantilla, version: 1 }`; `PUT` con `baseVersion` correcta → versión 2; `PUT` con `baseVersion` vieja → **409** `VERSION_DESACTUALIZADA` con `{ versionActual, contenido, datosFijos }`.
- Sin 731 → 403 en escrituras; con solo 730 → lecturas 200 y escrituras 403; usuario soporte → todo 200.
- `GET /kvas/plantillas/catalogo/ASIGNACION_CARGA` devuelve 7 campos y 5 datos fijos con etiquetas legibles y ejemplo; `catalogo/XX` → 400; `catalogo` no es capturado por `:id`.
- Nombre duplicado entre plantillas vivas del mismo tipo → 409 `NOMBRE_DUPLICADO`; baja sin motivo → 400; guardar sobre plantilla de baja → 409 `PLANTILLA_DE_BAJA`.
- **Pruebas negativas de entrada hostil (05 §9)**: nodo `image`, mark `link` con `href: javascript:`, `attrs` extra, `__proto__`, campo `password`, clave válida de otro tipo, árbol de 3 000 nodos, texto de 60 000 caracteres → **400**; caracteres bidi/ancho cero eliminados por `textoSeguro`.
- Casos de §4.2 de 05 en verde: `agruparNaves` (los 4 casos), `redactarKvas` (los 4 casos, incluido `mixto`), cantidades hostiles (-1, 0, 1e9, 1.234, "abc", NaN) rechazadas.
- Cada mutación deja fila en `auditoria` con el `uid` del actor y `origen = 2`.

### 4.3 Verificación
```
pnpm --filter @erp/api typecheck
pnpm --filter @erp/api lint
pnpm --filter @erp/api test -- kvas-plantillas
pnpm --filter @erp/api build
pnpm dev:api     # ⛔ ARRANQUE REAL: sin «Nest can't resolve dependencies»; ver rutas /api/kvas/plantillas* en el log de rutas mapeadas
# humo manual con JWT de prueba (cuenta de Toribio si Jereff autoriza «revisa»): crear → guardar → conflicto → baja
```

---

## 5. Ola 3 · Backend de generación de PDF

**Objetivo:** empresas y naves elegibles, vista previa, PDF con logo, `generar` todo-o-nada con idempotencia, listado/baja de documentos y la guarda X-9.
**Modelo:** Sonnet implementa; **Opus revisa** (dinero indirecto/documento ante CFE, RLS, Storage, entrada hostil) · **Horas:** 8.0 · **Depende de:** ola 2.

### 5.1 Archivos
| Archivo | Acción |
|---|---|
| `apps/api/src/modules/parques/kvas-documentos.service.ts` | **Crear**: empresas (`kva_naves_elegibles(null)` agrupado + `select … in`), naves por empresa con `kvasSugeridos`, `vistaPrevia` (resolución de campos, `origenKvas`, `advertencias`, `faltantes`, `huellaCampos`, `contenidoResuelto`), `vistaPreviaPdf`, `generar` (los 10 pasos de `05 §4.4`), `listar`, `detalle`, `baja`. Candado en memoria `uid+clave`. |
| `apps/api/src/modules/parques/kvas-documentos.controller.ts` | **Crear**: `@Controller('kvas/documentos')`; permisos 724/720/723 según `05 §5.2`; `@Throttle({ default: { ttl: 60_000, limit: 10 } })` en `vista-previa-pdf` y `generar`. |
| `apps/api/src/modules/parques/kvas-pdf.service.ts` | **Crear**: `render(modelo): Promise<Buffer>` con pdfmake; mapeo nodos→docDefinition; semáforo de 2; timeout 10 s; límites 2 MB / 10 páginas; marca de agua «VISTA PREVIA»; pie «Documento generado el … · Folio … · pág. n de m». **No toca BD ni red.** |
| `apps/api/src/modules/parques/kvas-logo-pdf.service.ts` | **Crear**: `obtener()` con `ConfiguracionService.obtenerLogos()` (módulo `@Global`), anti-SSRF por prefijo del bucket `branding`, `redirect: 'error'`, 5 s, ≤ 2 MB, magic bytes con `contenidoCoincide`, caché TTL 10 min, `null` ante cualquier falla. |
| `apps/api/src/modules/parques/kvas.service.ts` | **Modificar, solo +3 líneas** en `bajaDocumentoNave` (X-9): si `idDoc` existe en `kvaDocGeneradoNaves` → `ConflictException` con el texto de `05 §5.2`. |
| `apps/api/src/modules/parques/parques.module.ts` | **Modificar**: registrar los 4 proveedores/controlador nuevos. |
| `apps/api/src/modules/parques/kvas-documentos.service.spec.ts`, `kvas-pdf.service.spec.ts`, `kvas-logo-pdf.service.spec.ts` | **Crear**. |

**Receta / referencia:** `kvas.service.ts` (`subirDocumentoNave` ~líneas 854-896: subida a Storage + compensación; `ocupantesDeNaves` ~482-529: lectura por lotes con `.range`; `firmarVarias`), `archivo-seguro.ts` (`rutaSegura`, `contenidoCoincide`), `kvas-compromisos.scheduler.ts:52` (fecha en `America/Mexico_City`), `db-error.ts` (`fallaBd`).
**NO debe tocar:** `archivo-seguro.ts`, `kvasAsignados`/dotación (generar **no** modifica `naves.dotacion*`), `kvas.service.ts` fuera de las 3 líneas de X-9, `ConfiguracionService` (solo se **inyecta**).

### 5.2 Orden interno (cada paso con arranque real)
1. `kvas-logo-pdf.service.ts` + prueba (URL ajena, redirección, > 2 MB, SVG, no-imagen → `null`).
2. `kvas-pdf.service.ts` + prueba (snapshot árbol→docDefinition; ejemplo de 8 naves < 100 KB y 1 página; fuzz hostil dentro de tiempo).
3. `kvas-documentos.service.ts` lecturas (empresas, naves) → vista previa → `vistaPreviaPdf`.
4. `generar` + idempotencia + compensación de Storage.
5. Listado, detalle, baja + X-9 en `kvas.service.ts`.

### 5.3 Criterios de aceptación
- `GET /kvas/documentos/empresas` devuelve dueñas **y** arrendatarias (≈313 hoy); `…/empresas/:id/naves` devuelve **todas** las naves de **todos** los parques, con `kvasSugeridos: []` para dotación 0 (EM BAJÍO EMPAQUES: 8 naves de Acupark III sin prellenado).
- **Caso EM BAJÍO EMPAQUES:** vista previa con 8 naves × `{BT, 5}` → `naves = «107-110 y 119-122»`, `kvas_por_nave = «5 KVAS»`, `nivel = «baja tensión»`, `parque = «Acupark III»`, `origenKvas = DECLARADO`.
- Empresa con naves en 2 parques → `parque = «A y B»`.
- `generar`: 201 con `idDocGenerado`, `docs[N]`, `urlPdf` firmada; en BD **1** `kvaDocGenerados`, **N** `kvaNaveDocs`, **N** puente, **1** archivo en `kvaDocs` con ruta `^\d{4}-\d{2}/plantillas/[0-9a-f-]{36}\.pdf$`, `hashPdf` = SHA-256 del archivo descargado.
- Doble envío con la misma `claveIdempotencia` → un solo documento (`repetido: true` en la segunda).
- `huellaCampos` distinta → **409 `DATOS_CAMBIARON`**; nave de otra empresa → **422** mensaje único; dato fijo vacío usado → **422 `DATO_FIJO_VACIO`**; plantilla de baja → 409.
- Falla forzada de `kva_documento_registrar` → el archivo subido **se borra** (sin huérfanos en Storage).
- Logo ajeno/SVG/enorme → PDF sin logo + advertencia `LOGO_NO_DISPONIBLE`, nunca error.
- Baja manual de una fila de `kvaNaveDocs` generada → **409**; baja del documento generado → baja de documento **y** de sus N filas.
- Body con `idParque` extra → 400; permisos: sin 724 → 403 en empresas/naves/vista previa/generar.
- Ráfaga de 20 `generar` → 429/503 sin degradar el API.

### 5.4 Verificación
```
pnpm --filter @erp/api typecheck && pnpm --filter @erp/api lint
pnpm --filter @erp/api test -- kvas-pdf kvas-logo kvas-documentos kvas-plantillas
pnpm --filter @erp/api build
pnpm dev:api    # ⛔ ARRANQUE REAL: DI de KvasDocumentosService → ConfiguracionService, SupabaseService, KvasPdfService, LogoPdfService
```
Prueba de integración de punta a punta (script en `temp/`, con cuenta de prueba): los dos casos de `05 §10.3` (Spartek con dotación → `origenKvas = DOTACION`; EM BAJÍO). **Los documentos de prueba que se creen en producción se dan de baja con motivo** y se anota el conteo residual (regla de la cuenta de Toribio: datos demo + limpieza verificada). Revisión Opus de la ola antes de pasar a la 5.

---

## 6. Ola 4 · Frontend de Plantillas (listado + editor)

**Objetivo:** Parques → Plantillas funcional: listado con filtros, alta con tipo, editor Tiptap con campos/datos fijos, versionado y manejo de conflicto.
**Modelo:** Sonnet · **Horas:** 10.0 · **Depende de:** ola 0 (componentes) y ola 2 (API). Puede correr **en paralelo** con la ola 3 (carpetas distintas).

### 6.1 Archivos (`apps/web/src/`)
| Archivo | Acción |
|---|---|
| `features/parques/plantillas.api.ts` | **Crear** (patrón de `kvas.api.ts`): catálogo, listar, obtener, versiones, crear, guardar, restaurar, baja; tipos TS del contrato. |
| `features/parques/plantillas/PlantillasPage.tsx` | **Crear**: listado (UI §2): filtros rápidos, tabla con `SortableTh`/`useSort`, `Badge`, paginación si > 20, estados (cargando/vacío/error/sin permiso), acciones ✎ ⧉ ⛔ con `Tooltip`; modales con `Modal` (alta con tipo, duplicar, baja con motivo). Sin exportación (P5; excepción a asentar en contexto). |
| `features/parques/plantillas/PlantillaEditorPage.tsx` | **Crear**: barra superior, hoja carta, panel derecho; estados (UI §3.6) incl. solo lectura y **conflicto de versión** (modal con 3 opciones); borrador local en `localStorage` con try/catch; `beforeunload`. |
| `features/parques/plantillas/EditorPlantilla.tsx` | **Crear**: Tiptap configurado **solo** con las extensiones permitidas (`StarterKit` sin código/cita/regla/enlace/tachado, `heading.levels=[1,2,3]`, `Underline`, `TextAlign`), modos `edicion` y `generacion`. |
| `features/parques/plantillas/nodos/CampoNode.tsx`, `nodos/DatoFijoNode.tsx` | **Crear**: nodos atómicos inline (chip verde con rayo / azul con lápiz; ámbar «(sin definir)»); guardan solo `clave`. |
| `features/parques/plantillas/BarraFormato.tsx`, `PanelCampos.tsx`, `MenuInsertar.tsx` | **Crear**: barra (`role="toolbar"`, `aria-pressed`), panel de campos **pintado desde el catálogo del API** (sin lista a mano) y datos fijos con validaciones; menú `/` con `Flotante`. |
| `components/Membrete.tsx` | **Crear**: logo (`Logo.tsx`) + texto de Grupo SPH, compartido por editor y vista previa. Texto adicional según **N-1** (si Jereff no decide, solo logo). |
| `components/layout/menu.tsx` | **Modificar**: ítem `{ label: 'Plantillas', to: '/parques/plantillas', clave: 730 }` bajo «KVA's» en el grupo `parques`. |
| `routes/router.tsx` | **Modificar**: rutas `/parques/plantillas`, `/parques/plantillas/nueva`, `/parques/plantillas/:idPlantilla`; el editor con `lazy` + `Suspense` (patrón de `/arrendatarios/*`). |
| `features/permisos/permisos-descripciones.ts` | **Modificar**: 730 y 731 (ver ola 6 para el texto; si se hace aquí, 724 va en la ola 5/6; el archivo se toca una sola vez por ola para evitar conflictos). |
| `index.css` | **Modificar solo si hace falta** estilos del editor (chips, hoja carta); `.scrollbar-hide` ya existe. |

**Receta / referencia:** `features/parques/KvasPage.tsx` (página, `useQuery`, permisos), `kvas.api.ts` (cliente), `components/Badge.tsx`, `SortableTh`, `Paginacion`, `SearchSelect`. Para el filtro por columna estilo Excel: **P11** — usar `ColumnFilter` tal cual y registrar la brecha (selección única) en el destino único de pendientes, salvo que Toribio decida extenderlo (si se extiende, es una ola 4b separada, no mezclada).
**NO debe tocar:** `ColumnFilter.tsx`/`FiltroColumnaOpciones.tsx` (salvo decisión explícita de P11), `KvasPage.tsx`, modales de KVA's, `Logo.tsx`, ninguna ruta existente.

### 6.2 Criterios de aceptación
- Con 730: el ítem aparece en el menú y el listado carga; sin 730 no hay ítem y la URL directa muestra «No tienes permiso…». Con solo 730: sin «+ Nueva plantilla» ni iconos de acción y el editor abre en solo lectura.
- Crear plantilla de tipo «Asignación de carga» con el texto de la carta de ejemplo (chips `empresa`, `naves`, `kvas_por_nave`, `fecha`; datos fijos `apoderado`, `destinatario`, `oficio`, `solicitud_cfe`, `domicilio`) → guarda **v1**; editar y guardar → **v2**; toast «Se guardó la versión 2.»
- Dato fijo usado y vacío → el guardado se bloquea y el foco va al input; un campo fuera del catálogo no se puede insertar.
- **El JSON que emite el editor pasa el `crearContenidoSchema` del servidor** (prueba: guardar una plantilla con todas las marcas, alineaciones, listas y chips → 201; ningún 400 por `attrs` extra).
- Dos pestañas editando la misma plantilla → la segunda recibe el modal de conflicto con sus 3 opciones y **no se pierde** el contenido.
- Pegar texto externo con formato (HTML) → queda como texto plano con solo los formatos permitidos.
- Baja con motivo obligatorio; plantilla dada de baja → editor en solo lectura con banda ámbar.
- Accesibilidad: foco atrapado en modales, `aria-live` en guardado/errores, chips con `aria-label`.
- Móvil (<768 px): listado en tarjetas bajo 640 px; editor con panel como `Sheet`.

### 6.3 Verificación
```
pnpm --filter @erp/web typecheck && pnpm --filter @erp/web lint
pnpm --filter @erp/web build      # revisar que el editor salga en un chunk aparte (lazy)
pnpm dev:api & pnpm dev:web       # recorrer a mano los criterios de 6.2 (cuenta de prueba si Jereff autoriza «revisa»)
```
Si hay pruebas de componentes en el proyecto (`pnpm --filter @erp/web test`), correrlas; si no existen, la cobertura de esta ola la da la ola 7 (E2E).

---

## 7. Ola 5 · Frontend: generar el documento desde KVA's

**Objetivo:** el modal «Generar documento de asignación» (pantalla 3) que elige empresa, plantilla y naves, muestra la vista previa editable y emite el PDF.
**Modelo:** Sonnet · **Horas:** 8.0 · **Depende de:** ola 3 (API), ola 4 (editor y `Membrete`) y **P-3** (`.pen` corregido: nave sin dotación con inputs habilitados; la construcción **no** puede apartarse del visual).

### 7.1 Archivos (`apps/web/src/features/parques/`)
| Archivo | Acción |
|---|---|
| `documentos.api.ts` | **Crear**: empresas, naves, vista previa (JSON), vista previa PDF (blob), generar, listar, baja. |
| `plantillas/GenerarDocumentoModal.tsx` | **Crear** con el `Modal` compartido: 2 columnas ≥1024 px; <768 px pantalla completa con `Tabs` («1 · Selección» / «2 · Vista previa»); columna izquierda (Empresa con `SearchSelect`, parques informativo, Plantilla, naves **agrupadas por parque** con casillas, «Marcar todas» indeterminada, **input KVA por nave** como texto numérico vaciable + **select Nivel**, nota «Sin dotación: captura los KVA»); derecha: aviso ámbar, hoja con `Membrete` y texto resuelto resaltado, «Restablecer texto»; pie con el resumen «Se generará 1 PDF y se guardará en el expediente de N naves» y «Generar PDF y guardar». Debounce 400 ms de la vista previa; `claveIdempotencia` = `crypto.randomUUID()` por apertura; estados de la UI §5.4; manejo de 409 `DATOS_CAMBIARON` (re-resolver con confirmación). Fecha con `InputFecha`. **Nunca** calcula valores resueltos en el cliente. |
| `KvasPage.tsx` | **Modificar, mínimo**: botón «Generar documento» en el encabezado (visible con 724) que abre el modal. |
| `NaveKvaModal.tsx` | **Modificar, mínimo**: botón en la ficha de la nave que abre el modal con empresa y nave precargadas (P3, si Jereff confirma). |
| `DocumentosNave.tsx` | **Modificar, mínimo**: tras generar, invalidar la consulta del expediente; el botón de baja de una fila **generada** ya no ofrece la baja manual (el API responde 409) y remite al documento generado. |
| `features/permisos/permisos-descripciones.ts` | **Modificar**: 724 (si no se hizo en la ola 4). |

**Receta / referencia:** `AsignacionKvaModal.tsx` (flujo y validaciones del dominio KVA), `DevolucionKvaModal.tsx`, `EditorPlantilla.tsx` en `modo="generacion"` (ola 4).
**NO debe tocar:** el flujo «+ Asignar» (`AsignacionKvaModal`), `kvas.api.ts`, ni migrar los modales existentes.

### 7.2 Criterios de aceptación
- Sin 724 el botón no se renderiza; con 724 abre el modal.
- **Caso EM BAJÍO EMPAQUES:** elegir empresa → 8 naves de Acupark III sin prellenado y con la nota «Sin dotación…»; «Marcar todas», teclear 5 y «Baja tensión» en las 8 → la vista previa dice «naves 107-110 y 119-122», «5 KVAS», «baja tensión»; «Generar PDF y guardar» queda deshabilitado mientras falte KVA o nivel de una nave marcada, con su mensaje bajo el input.
- Empresa de Spartek: KVA y nivel **prellenados** desde la dotación.
- Empresa con naves en dos parques: grupos por parque, campo «Parques de las naves marcadas» con «A, B», y el PDF dice «A y B».
- Editar la vista previa y luego cambiar la selección → confirmación «perderás tus ajustes»; cerrar con ajustes → confirmación.
- Doble clic en «Generar» → un solo documento.
- Éxito: «Documento generado.», enlace «Abrir PDF» (pestaña nueva), lista de naves, y el expediente de cada nave lo muestra.
- Error del API → banda roja con «Reintentar» y la selección se conserva.
- Móvil (<768 px): dos pasos con pestañas, hoja escalada, blancos de toque ≥ 44 px.

### 7.3 Verificación
```
pnpm --filter @erp/web typecheck && pnpm --filter @erp/web lint && pnpm --filter @erp/web build
pnpm dev:api & pnpm dev:web      # recorrer 7.2 de punta a punta contra BD real (rama o prod con datos demo)
```

---

## 8. Ola 6 · Permisos 724 / 730 / 731

**Objetivo:** que los tres permisos existan en BD, se describan en la pantalla de Permisos y se pueda conceder y probar cada uno.
**Modelo:** Sonnet · **Horas:** 1.5 · **Depende de:** ola 1 (alta en BD vía la migración) · se cierra después de 4 y 5.

> El **alta en `segModulos`** ya viaja en la migración de la ola 1 (§9 del SQL). Esta ola **no inserta nada nuevo en BD**: verifica y describe.

### 8.1 Tareas
| # | Tarea | Archivo |
|---|---|---|
| 6.1 | Confirmar con `SELECT` que `segModulos` tiene 724/730/731 con `modulo/seccion/area` de `05 §6` y que `max(clave)` no choca con otra rama de trabajo (re-verificar justo antes de cerrar). | solo lectura |
| 6.2 | Añadir las **3 descripciones** (textos de `05 §6`) a `permisos-descripciones.ts` (si ya están por la ola 4/5, solo verificar que **las tres** estén: si falta una, la pantalla de Permisos pinta «—»). | `apps/web/src/features/permisos/permisos-descripciones.ts` |
| 6.3 | Abrir la pantalla de Permisos y comprobar que aparecen «Generar documento» (KVA's) y «Plantillas · Modulo / Editar» con su texto. | UI |
| 6.4 | **Matriz de pruebas** con una cuenta de prueba (⛔ P-6: conceder en producción lo hace/autoriza Jereff; Toribio no se auto-asigna): solo 730 · 730+731 · solo 724 · 724+723 · 720 sin 724 · soporte. Verificar contra la matriz de `05 §5.3`. | UI + API |
| 6.5 | Anotar en bitácora que **D3** («editan ambos: quien administra y quien asigna») se cumple **otorgando 731 a los dos perfiles** desde la pantalla de Permisos: es dato, no código; Jereff decide a quién. | bitácora |

**NO debe tocar:** `permiso.guard.ts`, `segModulosUsuarios` (las filas las crea la pantalla de Permisos al conceder), nada de BD.

### 8.2 Criterios de aceptación
Las 3 claves tienen texto en la pantalla de Permisos · la matriz de 6.4 coincide celda por celda con `05 §5.3` · soporte pasa todo y sus acciones salen a su nombre en `auditoria`.

### 8.3 Verificación
```
pnpm --filter @erp/web typecheck && pnpm --filter @erp/web build
# SELECT clave, seccion, area FROM "segModulos" WHERE clave IN (724,730,731) ORDER BY 1;   -- 3 filas
# curl con JWT de cada perfil de prueba a una ruta por permiso: 200/403 según la matriz
```

---

## 9. Ola 7 · Pruebas E2E y verificación

**Objetivo:** demostrar de punta a punta que funciona, que es seguro y que no rompió lo existente.
**Modelo:** Sonnet escribe y corre las pruebas E2E/regresión; **Opus** hace el gate final adversarial · **Horas:** 6.0 (3.0 E2E y regresión · 1.0 revisión de escalabilidad · 2.0 gate Opus y corrección de hallazgos) · **Depende de:** olas 2-6.

### 9.1 Archivos
| Archivo | Acción |
|---|---|
| `apps/web/e2e/…` o la carpeta de E2E vigente del proyecto (confirmar con `Glob`; si **no existe infraestructura E2E**, las pruebas son guion Playwright/MCP en `temp/e2e-plantillas.md` ejecutado por Nicanor y **no se introduce una infraestructura nueva** sin avisar → PARADA de decisión) | Crear los escenarios. |
| `base-conocimiento/docs` o `docs/plantillas-kvas/07-VERIFICACION-ADVERSARIAL.md` | Lo redacta el gate Opus (ya debe existir cerrado antes de la ola 1; aquí se **actualiza** con la verificación de lo construido). |

### 9.2 Escenarios obligatorios
1. **Camino feliz, caso inicial:** crear plantilla de «Asignación de carga» → generar para EM BAJÍO EMPAQUES (8 naves, 5 KVAS BT) → PDF con logo y membrete, 1 página, texto correcto → aparece en el expediente de las 8 naves.
2. **Con dotación:** empresa de Spartek, prellenado, `origenKvas = DOTACION`.
3. **Dos parques:** empresa con naves en 2 parques → «A y B».
4. **Dueña y arrendataria (D12):** nave con dueño A y arrendatario B → aparece en ambas; generar a nombre de A funciona; a nombre de C → 422.
5. **Idempotencia:** doble clic → 1 documento.
6. **Concurrencia de edición:** dos sesiones → 409 y modal de conflicto, sin pérdida.
7. **Corrección:** baja del documento generado → baja de documento y de sus N filas; baja manual de una fila generada → 409; generar otro y dar de baja el anterior.
8. **Entrada hostil** (todas las pruebas negativas de `05 §9`): inyección en contenido, campo fuera del catálogo, nave ajena, `idParque` extra, cantidades hostiles, logo ajeno, DoS, acceso directo PostgREST con `anon` y `authenticated`, mutar lo inmutable, fuga de errores.
9. **Permisos:** matriz de la ola 6.
10. **Regresión del módulo KVA's:** «+ Asignar», devolución, expediente (subir/baja manual de documentos **no generados** sigue igual), resumen del tablero, cron de compromisos: arrancan y responden como antes.
11. **Auditoría:** cada mutación con `uid` del actor y `origen = 2`.
12. **Arranque limpio de contenedor:** `pnpm build` de ambos y `pnpm dev:api` desde cero (sin `dist` previo); si es posible, build de la imagen Docker del API y arranque (verifica que `pdfmake` y Roboto empaquetan con `pnpm deploy --prod` en `node:22-slim`).

### 9.3 Revisión de escalabilidad (skill `revision-escalabilidad`)
Obligatoria (se tocó superficie de datos, UI que carga datos y trabajo de render): índices de las FK nuevas presentes (`EXPLAIN` de `kva_naves_elegibles(:emp)` y de `documentos?idNave=`), sin N+1 (una llamada por pantalla), caché del logo, semáforo/timeout del PDF, paginación de documentos generados. Resultado en la bitácora. Los índices opcionales sobre `arrenPropiedades`/`propiedades` se **registran como pendiente** (no se crean sin decisión de Toribio).

### 9.4 Gate adversarial final (Opus, no negociable)
Alcance: permisos, REVOKE/RLS, migración aplicada, entrada hostil (S-1…S-15), documento inmutable, Storage. **Hallazgo ALTA = no se cierra.** El validador recibe el código final, `07` y los resultados de §9.2.

### 9.5 Criterios de aceptación
Los 12 escenarios en verde con evidencia pegada en la bitácora · 0 hallazgos ALTA abiertos · revisión de escalabilidad hecha · sin cambios de comportamiento en el resto de KVA's.

### 9.6 Verificación
```
pnpm typecheck && pnpm lint && pnpm test && pnpm build      # desde la raíz de version2/ (turbo)
pnpm dev:api & pnpm dev:web                                  # arranque real + recorrido de escenarios
pnpm audit --prod                                            # sin ALTA/CRÍTICA nuevas por pdfmake/Tiptap
```

---

## 10. Ola 8 · KB, changelog, versión y cierre

**Objetivo:** dejar documentado, versionado y commiteado (punto de restauración) lo construido.
**Modelo:** Sonnet (KB, diagrama, changelog) + Toribio (versión, bitácora, commit) · **Horas:** 3.0 · **Depende de:** ola 7.

### 10.1 Tareas y archivos
| # | Tarea | Archivo / destino |
|---|---|---|
| 8.1 | **KB del módulo** en el formato canónico de la skill `kb-agente-soporte` (7 campos + sección «Para el agente de soporte», palabras clave en el frontmatter): agregar sección «Plantillas de documentos» a `kvas.md` y crear `plantillas-kvas.md` si conviene separar; actualizar `INDICE.md` y `GLOSARIO.md` (plantilla, tipo, campo automático, dato fijo, documento generado). | `version2/base-conocimiento/modulos/kvas.md` (+ `INDICE.md`, `GLOSARIO.md`) |
| 8.2 | **Diagrama de BD** (skill `diagrama-bd`): regenerar DBML/SVG/`base-datos.md` desde el catálogo real; las descripciones salen de los `COMMENT ON` ya incluidos en la migración. | `version2/base-conocimiento/bd/` |
| 8.3 | **Cerrar deuda**: marcar resueltos en el destino único los pendientes que esta funcionalidad cierre (si los hubiera) y **registrar** los nuevos: modales sin portal, `ColumnFilter` multiselección (P11), índices opcionales de `arrenPropiedades`/`propiedades`, `DEVOLUCION` sin campos (decisión D7), N-1 membrete, brief §5.1/§5.6 a actualizar por D10, excepción «sin exportación en el listado» (asentar en `contexto.md` como «Excepción acordada con Jereff (2026-10-07)»). | destino único de pendientes + `.sessions/contexto.md` |
| 8.4 | **Versión (protocolo anti-colisión):** el número sale del **máximo** de (a) `APP_VERSION_RAW` en `apps/web/src/lib/constants.ts` (hoy `2.75.1`), (b) el último de CHANGELOG, (c) `.sessions/version-en-curso.md`. **Reservar** el número en `.sessions/version-en-curso.md` **antes** de editar. Publicar **obliga a tocar** `APP_VERSION_RAW`, no solo el changelog. Funcionalidad nueva ⇒ incremento de **minor** (p. ej. 2.76.0 si el máximo sigue en 2.75.x al momento de cerrar). | `apps/web/src/lib/constants.ts`, `.sessions/version-en-curso.md` |
| 8.5 | **Changelog** (usuario final, en español, qué puede hacer ahora: «Plantillas de documentos de KVA's: …»). Ubicar el archivo/fuente real del changelog con `Grep` (existe el módulo `changelog` del API); no inventar ruta. | fuente del changelog |
| 8.6 | **Bitácora** (`.sessions/bitacora.md` + línea en `indice-sesiones.md`): qué agentes/modelos se usaron por ola y su desempeño, conteos antes/después de la migración, resultados de E2E y del gate. **Contexto** solo si cambiaron reglas/patrones estructurales (nuevo patrón: tablas «solo backend» + funciones `plpgsql` con `comoActor`; receta «PDF en servidor con pdfmake»). | `.sessions/` |
| 8.7 | **Commit selectivo** (revisar `git status`; el índice puede traer archivos ajenos). Sugerencia: un commit por bloque (migración+tipos · backend · frontend · KB/versión). Mensaje en español, con la línea de atribución vigente. **Sin push.** | git |

**NO debe tocar:** nada fuera de lo listado; no se hace push.

### 10.2 Criterios de aceptación
KB con frontmatter válido y visible para el router del agente de soporte · diagrama regenerado incluye las 4 tablas · `APP_VERSION_RAW` = número reservado y coincide con el changelog · `git status` limpio de archivos ajenos en los commits · bitácora e índice actualizados.

### 10.3 Verificación
```
pnpm --filter @erp/web typecheck && pnpm --filter @erp/web build   # la versión se hornea en el bundle
git status && git log --oneline -n 5
# abrir la app: la versión visible en la UI = APP_VERSION_RAW
```
⛔ **P-7: el push es un paso aparte, explícito** (redespliega la app). No se ejecuta sin la orden de Jereff.

---

## 11. Puntos de PARADA (esperar a Jereff)

| # | Cuándo | Qué se necesita de Jereff |
|---|---|---|
| **P-1** | Antes de la ola 0 | Aprobar este plan y el paquete (00-05). Sin visto bueno no se escribe código. |
| **P-2** | Antes de la ola 1 | `07-VERIFICACION-ADVERSARIAL.md` cerrado **sin hallazgos ALTA** (lo cierra Toribio con los Opus; Jereff solo se entera). |
| **P-3** | Antes de la ola 5 | Aprobar el `.pen` corregido de la pantalla 3 (nave sin dotación con inputs de KVA y nivel habilitados). Confirmar P3 (botones de entrada) y P8 (advertir y permitir con datos fijos vacíos). |
| **P-4** | **Ola 1, paso 7** | **Autorización explícita para aplicar la migración en producción**, en el momento, tras ver la verificación en rama. Sin ella no se aplica. |
| **P-5** | Ola 0, tarea 0.6 | Autorizar las dependencias nuevas (`pdfmake`, Tiptap) y el resultado de `pnpm audit` y licencias. |
| **P-6** | Ola 6, tarea 6.4 | Conceder 724/730/731 a la cuenta de prueba en producción (Toribio no se auto-asigna) y decidir a qué perfiles de usuario real se otorga 731 (D3). |
| **P-7** | Ola 8 | **Push/despliegue.** Paso aparte, nunca automático. |
| P-8 | Cualquier momento | Si al construir hace falta apartarse de lo aprobado (texto o visual), si falta una herramienta (MCP de BD, `create_branch`, acceso), o si `pdfmake`/Roboto falla en el contenedor: PARAR y preguntar; nada de plan B por cuenta propia. |

**Preguntas de negocio que Jereff puede responder en paralelo (no bloquean las olas 0-4):** N-1 (qué lleva el membrete además del logo) · N-2 (logo claro en PNG/JPG) · P4 (reactivar plantillas dadas de baja) · P6 (nombre único por tipo, ya diseñado como sí) · P7 (texto inicial = carta de EM BAJÍO) · P10 (editar plantillas desde móvil) · pregunta abierta de `DEVOLUCION` (ampliar D7).

---

## 12. Matriz de riesgos

| # | Riesgo | Prob. | Impacto | Mitigación | Ola |
|---|---|:-:|:-:|---|:-:|
| R1 | **DI de Nest rota** (proveedor nuevo sin registrar, `ConfiguracionService` no inyectable): pasa `tsc`/`nest build` pero mata el contenedor | Media | **Alto** (API caído) | **Arranque real `pnpm dev:api` en cada ola de API** y criterio explícito «sin `Nest can't resolve dependencies`»; revisar `parques.module.ts` en cada PR | 2, 3 |
| R2 | **Migración en producción** (tablas compartidas/permisos) | Baja | Alto | Solo crea; rama primero; conteos antes/después; rollback listo y probado; Opus revisa; P-4 con autorización explícita; `get_advisors` | 1 |
| R3 | `pdfmake` falla en `node:22-slim` (ESM/CJS, fuentes Roboto, empaquetado `pnpm deploy --prod`) | Media | Alto | Prueba humo en ola 0; build de imagen Docker en ola 7; si falla, PARAR (reserva: `pdfkit` directo, decisión de Toribio) | 0, 7 |
| R4 | El JSON de Tiptap no pasa el Zod `strict` (atributos extra por defecto: `textAlign`, `start`, `class`) | Alta | Medio | Configurar Tiptap solo con extensiones permitidas; prueba «guardar con todas las marcas» en ola 4; el servidor es la autoridad y rechaza | 4 |
| R5 | Entrada hostil/XSS/SSRF en contenido o logo | Baja | Alto | Zod strict + lista permitida; logo solo del bucket `branding`; pruebas negativas obligatorias; gate Opus | 2, 3, 7 |
| R6 | Nave/empresa mal resuelta (unión dueño ∪ arrendatario; D12/D13) → carta a nombre equivocado | Media | Alto (documento ante CFE) | Una sola fuente `kva_naves_elegibles` en servicio y SQL; `huellaCampos`; escenarios 3 y 4 de E2E; la dotación declarada se audita (`origenKvas`) | 3, 7 |
| R7 | Doble generación o huérfanos en Storage | Media | Medio | `claveIdempotencia` + índice único + candado en memoria + compensación de Storage; prueba de falla forzada | 3 |
| R8 | Tablas que cambian de forma entre el diseño y la ejecución (datos del 2026-10-07: 510 pares, 313 empresas) | Media | Bajo | Los conteos de referencia se **re-verifican** en la ola 1; una diferencia se explica, no bloquea por sí sola | 1 |
| R9 | **Colisión de versión o de trabajo paralelo** (otra sesión usa 2.76.0 o toca `parques.module.ts`/`menu.tsx`/`router.tsx`/`permisos-descripciones.ts`) | Media | Medio | Protocolo anti-colisión de versión (máximo de 3 fuentes + reservar antes); `git status` y `git diff` antes de editar archivos compartidos; las olas 3 y 4 no comparten archivos | 4, 5, 8 |
| R10 | Falta de `create_branch` o de permisos MCP de BD | Baja | Medio | PARADA (herramienta): se dice y se espera; no se aplica directo a producción por conveniencia | 1 |
| R11 | Calidad del editor en móvil / Tiptap pesado en bundle | Media | Bajo | `lazy` + `Suspense`; edición completa solo escritorio (P10); revisar tamaño de chunk en `build` | 4 |
| R12 | Licencias/dependencias nuevas con vulnerabilidades | Baja | Medio | `pnpm audit --prod`, versiones fijadas, P-5 | 0, 7 |
| R13 | Alcance que crece (migrar modales, `ColumnFilter`, índices opcionales) | Alta | Medio | Todo eso está **fuera de alcance** y va al destino único de pendientes; ola 4b solo si Toribio lo decide | todas |
| R14 | Estimación optimista (editor Tiptap con nodos atómicos y vista previa editable es lo más incierto) | Media | Medio | Holgura de ~15 % ya incluida en olas 4 y 5; si una ola excede 1.5× su estimación se avisa a Toribio antes de seguir | 4, 5 |

---

## 13. Orden de ejecución y dependencias (diagrama)

```
P-1 aprobar plan ─▶ Ola 0 (prerrequisitos, P-5) ─┐
P-2 `07` sin ALTA ─▶ Ola 1 (migración, P-4) ─────┼─▶ Ola 2 (API plantillas) ─┬─▶ Ola 3 (API generar PDF) ──┐
                                                 │                            └─▶ Ola 4 (Front Plantillas) ─┤  (3 y 4 en paralelo)
                                                 │                                                          ▼
                                                 │                              P-3 `.pen` ──▶ Ola 5 (Front generar en KVA's)
                                                 └─────────────────────────▶ Ola 6 (permisos; verifica con 4 y 5; P-6)
                                                                                     ▼
                                                                  Ola 7 (E2E + gate Opus) ─▶ Ola 8 (KB, versión, commit) ─▶ P-7 push
```

Reglas de orden: **no** se arranca una ola con la anterior en rojo · la ola 1 puede desarrollarse (rama) mientras corre la 0 · las olas 3 y 4 no comparten archivos (API vs. web), por eso pueden ir con dos ejecutores a la vez, **cuidando** `permisos-descripciones.ts`, `menu.tsx` y `router.tsx` (solo los toca la ola 4/5/6, uno a la vez).

## 14. Qué NO se hace en este trabajo
Firma electrónica · envío por correo a CFE · tipos de plantilla creados por el usuario · Word editable · campos de fuentes distintas a D7 · campos propios de `DEVOLUCION` · modificar `naves.dotacion*` o `kvasAsignados` al generar · migrar los modales existentes al `Modal` compartido · extender `ColumnFilter` a multiselección (salvo decisión P11) · índices opcionales sobre `arrenPropiedades`/`propiedades` · exportación del listado de plantillas.
