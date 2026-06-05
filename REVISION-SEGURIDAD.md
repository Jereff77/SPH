# Revisión de seguridad y mejores prácticas — version2

**Fecha:** 2026-06-04
**Alcance:** monorepo completo `version2/` (backend `apps/api` NestJS + frontend `apps/web` React/Vite).
**Metodología:** chequeos automáticos (lint + typecheck + build) + auditoría de seguridad de solo lectura con dos agentes especializados (backend y frontend). La base de datos de producción **no** se tocó (revisión read-only).

---

## 1. Estado de los chequeos automáticos

| Verificación | `@erp/api` | `@erp/web` |
|---|---|---|
| ESLint | ✅ sin errores/warnings | ✅ sin errores/warnings |
| TypeScript (`tsc --noEmit`) | ✅ | ✅ |
| Build de producción | ✅ `nest build` | ✅ `tsc -b && vite build` |

**Cambios de tooling realizados durante la revisión:**
- Se instalaron las dependencias de ESLint que faltaban (`eslint`, `@eslint/js`, `globals`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`).
- `apps/web/eslint.config.js` ampliado con los plugins `react-hooks` y `react-refresh`.
- `apps/api/eslint.config.js` → renombrado a `eslint.config.mjs` para eliminar el warning de Node `MODULE_TYPELESS_PACKAGE_JSON` (el backend usa CommonJS y el config es ESM).

---

## 2. Hallazgos de seguridad y su resolución

Severidad: **CRÍTICO / ALTO / MEDIO / BAJO**. Estado: ✅ corregido · 📌 recomendación pendiente (requiere decisión del equipo o cambio en la BD de producción).

### Backend

| # | Sev. | Hallazgo | Estado |
|---|---|---|---|
| C-1 | CRÍTICO | `jwtVerify` se invocaba sin fijar `algorithms`/`issuer`/`audience`. | ✅ Se fija `algorithms: ['HS256']`, `issuer = ${SUPABASE_URL}/auth/v1`, `audience: 'authenticated'`. `apps/api/src/common/auth/jwt-auth.guard.ts` |
| A-1 | ALTO | Sin rate limiting (fuerza bruta en login / cambiar-contraseña / refresh). | ✅ `@nestjs/throttler` global (120 req/min) + `@Throttle` estricto: login 10/min, cambiar-contraseña 5/min. `app.module.ts`, `auth.controller.ts` |
| A-2 | ALTO | CSRF: cookie `sph_rt` con `SameSite=Lax` y endpoints (refresh/logout) que se autentican solo con la cookie. | ✅ Cookie cambiada a `SameSite=Strict` (el refresh/logout siempre los dispara la propia SPA). `auth.controller.ts` |
| A-3 | ALTO | `PATCH usuarios/:uid/soporte` sin `@RequierePermiso` específico. | 📌 Mitigado: el service revalida soporte server-side (`exigirSoporte`). Se documenta; aplicar clave fina requiere confirmar el modelo de permisos en producción. |
| M-1 | MEDIO | `Parametros` autoriza por módulo (210) y no por acción: lectura y `DELETE` comparten permiso. | 📌 Pendiente: aplicar claves finas (212/213/214) **requiere verificar en la BD de producción** que los usuarios las tengan asignadas; cambiarlo a ciegas rompería accesos. Decisión del equipo. |
| M-2 | MEDIO | `error.message` de Supabase/PostgREST se reenviaba al cliente en errores 5xx (filtra nombres de tablas/columnas). | ✅ El filtro global devuelve "Error interno del servidor" en 5xx; el detalle se registra solo server-side. `all-exceptions.filter.ts` |
| M-3 | MEDIO | Filtro PostgREST `.or()` construido por concatenación con datos derivados de input. | ✅ Defensa en profundidad: se descartan candidatos con caracteres que alteran la sintaxis del filtro (`, ( ) *`). `auth.service.ts` |
| M-4 | MEDIO | Subida de logos/favicon sin `limits` en Multer (DoS de memoria) + mensaje incoherente. | ✅ `FileInterceptor` con `limits: { fileSize: 2 MB, files: 1 }`; mensaje corregido. `configuracion.controller.ts` |
| B-1 | BAJO | `.env.local` con secretos reales (service_role, JWT secret) en el árbol de trabajo. | 📌 Acción operativa del equipo: está cubierto por `.gitignore` (no se versiona); confirmar que nunca se commiteó y considerar rotación si hubo duda de exposición. |

**Nota M-4 (SVG):** los logos/favicon se sirven desde un bucket y se renderizan en el frontend vía `<img src>` / `<link href>`, contexto en el que los navegadores **no** ejecutan scripts embebidos en un SVG. El riesgo de XSS almacenado por SVG solo existiría si se sirviera inline o se navegara directo a la URL; como endurecimiento adicional opcional se puede sanitizar el SVG server-side o servirlo con `Content-Disposition: attachment`.

### Frontend

El frontend partía de una postura **sólida**: token de acceso solo en memoria (nunca en `localStorage`), cookie httpOnly gestionada por el backend, auto-refresh single-flight sin loops, RBAC de cliente tratado como puramente cosmético (la autorización real es server-side), sin `dangerouslySetInnerHTML`, sin secretos en `import.meta.env` (solo `VITE_API_URL`, pública por diseño). No se encontraron hallazgos críticos ni altos.

| # | Sev. | Hallazgo | Estado |
|---|---|---|---|
| W-MEDIO-1 | MEDIO | URLs de branding (favicon/logo) asignadas a `src`/`href` sin validar el esquema. | ✅ Nuevo helper `urlImagenSegura()` (solo http(s)/relativa/blob/data:image). Aplicado en `BrandingEffects.tsx` y `Logo.tsx`. `apps/web/src/lib/safeUrl.ts` |
| W-MEDIO-2 | MEDIO | Sin Error Boundary global (riesgo de pantalla en blanco ante error de render). | ✅ `ErrorBoundary` raíz que envuelve toda la app con opción de recarga. `apps/web/src/components/ErrorBoundary.tsx`, `main.tsx` |
| W-BAJO-1..4 | BAJO | Tipado parcial de la respuesta de refresh; queries sin feedback de error; `key` por valor en una lista; validación de formularios manual (sin zod/RHF en cliente). | 📌 Deuda de UX/consistencia, sin impacto de seguridad (la validación crítica es server-side con Zod). Mejora futura. |

---

## 3. Aspectos correctos confirmados (no requirieron cambios)

- Identidad siempre derivada del JWT verificado, nunca de campos del cliente.
- `service_role` exclusivamente server-side; el frontend nunca importa el SDK de Supabase.
- Validación con Zod en todos los endpoints con body.
- Mensajes de login genéricos (anti-enumeración de usuarios).
- Validación fail-fast de variables de entorno al arranque.
- CORS restringido a un único origen con `credentials`.
- `helmet()` activo; cookie `httpOnly` + `Secure` en producción.
- RPCs parametrizadas y queries con `.eq()` parametrizado (sin string-building de SQL).

---

## 4. Pendientes para el equipo (fuera del alcance de código)

1. **M-1 / A-3** — Refinar la autorización de `Parametros` (lectura vs. escritura/borrado) y del toggle de soporte con claves finas, **previa verificación en la BD de producción** de que los usuarios tengan esas claves (no se puede aplicar a ciegas).
2. **B-1** — Confirmar que los secretos de `.env.local` nunca se versionaron; rotar `SUPABASE_JWT_SECRET` y `service_role` si hay cualquier duda de exposición.
3. **Remediaciones P0 de la BD** (documentadas en `documentacion-replicacion/06`): habilitar RLS en las tablas sin política, revocar permisos amplios sobre `segModulosUsuarios`, sustituir políticas `USING(true)`, volver privados los buckets públicos. Son cambios DDL sobre producción que aplica el equipo con autorización explícita.
4. Endurecimiento opcional: sanitizar/forzar descarga de SVG de branding; CSP a nivel del host del SPA.

---

## 5. Archivos modificados en esta revisión

**Backend (`apps/api`)**
- `src/common/auth/jwt-auth.guard.ts` — verificación JWT con algorithms/issuer/audience.
- `src/app.module.ts` — ThrottlerModule + ThrottlerGuard global.
- `src/modules/auth/auth.controller.ts` — `@Throttle` en login y cambiar-contraseña; cookie `SameSite=Strict`.
- `src/modules/auth/auth.service.ts` — saneo de candidatos del filtro `.or()`.
- `src/common/filters/all-exceptions.filter.ts` — mensaje genérico en 5xx.
- `src/modules/configuracion/configuracion.controller.ts` — `limits` de Multer + mensaje.
- `package.json` — `@nestjs/throttler`; `eslint`. `eslint.config.js` → `eslint.config.mjs`.

**Frontend (`apps/web`)**
- `src/lib/safeUrl.ts` — *nuevo*, validación de URL de imagen.
- `src/components/ErrorBoundary.tsx` — *nuevo*, Error Boundary raíz.
- `src/components/BrandingEffects.tsx`, `src/components/Logo.tsx` — uso de `urlImagenSegura`.
- `src/main.tsx` — envuelve la app en `ErrorBoundary`.
- `eslint.config.js`, `package.json` — plugins react-hooks/react-refresh.

**Resultado final:** lint + typecheck + build ✅ en API y Web.
