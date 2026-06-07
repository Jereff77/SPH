# HANDOFF — ERP SPH Bienes Raíces v2 (continuación para otro agente)

> **Propósito de este documento.** Dar a cualquier agente/desarrollador que continúe el proyecto el
> contexto completo: qué se está construyendo, por qué, qué reglas son inviolables, qué hay hecho, cómo
> está organizado, los patrones a seguir y los próximos pasos concretos. Leer este documento **antes de
> tocar nada**.
>
> Última actualización: 2026-06-06. Autor: Claude (Opus 4.8).
>
> 📌 **El estado detallado y al día por módulo está en `base-conocimiento/INDICE.md`** (router) y los
> `base-conocimiento/modulos/*.md`. El **handoff operativo** (despliegue EasyPanel, rama, variables,
> pendientes) está en `../.sessions/contexto.md` (sección "HANDOFF CONSOLIDADO"). Este documento mantiene
> las **reglas inviolables** y los patrones.

---

## 0. TL;DR (lo mínimo para arrancar)

- Estamos **reescribiendo** un ERP inmobiliario que hoy es **FlutterFlow + Supabase** hacia un nuevo
  stack: **NestJS (backend) + React/Vite (frontend) + Supabase (se mantiene)**.
- El código nuevo vive en **`version2/`** (monorepo pnpm + Turborepo). El código Flutter original sigue
  en la raíz del repo y se **retirará al final**.
- **Motivo central:** además de cambiar el front, hay que **corregir vulnerabilidades críticas**
  documentadas en `../documentacion-replicacion/`. La peor: el cliente Flutter ejecuta SQL crudo contra
  Supabase. La regla de oro de v2 es **el frontend NUNCA habla con Supabase; solo el backend lo hace**.
- **COEXISTENCIA:** el sistema Flutter actual y v2 **conviven** durante la transición. **No se elimina ni
  modifica NADA de la BD** (objetos del sistema viejo intactos); v2 solo **lee** lo existente y, si necesita
  lógica en BD, **crea funciones NUEVAS** — todo con autorización explícita. Ver reglas 1 y 2 (sección 1).
- **Hecho hasta ahora (verificado; desplegado en EasyPanel desde la rama `erp_v2`):**
  - Seguridad (guards JWT/RBAC, `@RequierePermiso`), tipos del esquema real, **Auditoría** (triggers
    `fn_auditoria` + `comoActor(uid)`) y **"Ver como"** (impersonación de solo lectura para soporte).
  - **Autenticación**, **Landing/Indicadores** (Banxico/INPC reales), **Configuraciones** completas
    (Usuarios, **Parámetros** con INPC/Cuentas/Fechas CxP/**Claves SAT**, Permisos, Sistema).
  - **Parques** (parques + disponibilidad).
  - **CxP** casi completo: Proveedores, Bancos, **Solicitudes de pago** (alta de CFDI con parser propio +
    validaciones fiscales), **Aprobar Solicitudes** (presupuesto + fuera de presupuesto), **Pagar
    solicitudes** (3 vías de pago + tiempo real SSE), **Solicitudes pendientes**.
  - **Correo** (sección propia): buzón de facturas IMAP/SMTP en el backend (sin N8N).
  - **Ventas** (Inversionistas/Propietarios) — **Etapa 1**: **Dashboard** (clave 600) y **Planes** (clave
    610). **Cálculos sin vistas** (desde tablas base) con un **único universo**: propiedades con
    `propiedades.pdpActivo=<filtro>` e inversionista `inversionista=true` y `pruebas=false` (NO tipoCliente;
    la bandera de "activo" vigente es `propiedades.pdpActivo`, no `pdp.pdpactivo`). Dashboard: 3 tarjetas
    (objetivo/cobranza/balance — año, mes por vencimiento, cobranza real por fecha de pago), tabla con C/T
    apilado + fila de totales + un solo scroll, pestañas separadas de Renta Garantizada/Administrada
    (`v_rentasCombinadas`), agregar/eliminar pago con comprobante (registra en `actividad`+`comentarios`),
    fechas en horario MX, tiempo real SSE. Planes: selector con búsqueda, tab Plan de Pagos detallado
    (Movimiento C/T, % avance, saldo a favor, totales) con $ (pago) y 💬 (comentarios), Config (Datos,
    Documentos, Propiedades, crear Plan de Pagos). Sin objetos nuevos en BD.
  - **Clientes** (clave 300, sección directa `/clientes`): padrón de la tabla `inversionista` (migra la
    pantalla "Clientes" del CRM de v1). Chips Inversionistas/Arrendatarios/Ticket/Usuario Final/Papelera +
    buscador + tabla ordenable + alta/edición + mover a papelera. Sin objetos nuevos en BD.
- **Objetos NUEVOS en BD (con autorización):** bucket `branding` + `v2_obtener_logo_url()`;
  `catClavesProdServ`; permisos 470/800/801 + enum `Modulos`+='Correo'; tablas `correo_*`; parámetro
  `RFC_RECEPTORES_AUTORIZADOS`. Detalle por módulo en `base-conocimiento/`. Nada del sistema viejo fue tocado.
- **Despliegue:** EasyPanel, 2 apps (api Dockerfile `apps/api/Dockerfile` :3001, web `apps/web/Dockerfile`
  :80). Guía: `DEPLOY-EASYPANEL.md`. Flujo: push a `erp_v2` → Implementar.
- **Siguiente:** Ventas Etapa 2 (**Reportes 620**, **Escrituras 630**, creación de **Renta Garantizada**
  vía RPCs `rgpdp_insertar_registro`/`rgpdp_generar_plan_pagos` y **Renta Administrada** `rapdp_actualizar`,
  pasar las pestañas de rentas a cálculo propio); CxP Dashboard(440/441) y Reportes(460); conciliación
  bancaria avanzada; configurar la cuenta de Correo (`EMAIL_ENCRYPTION_KEY` en EasyPanel); migrar stubs
  (Arrendatarios, Fideicomiso, resto del CRM). Ver pendientes completos en `../.sessions/contexto.md`.

> ⚠️ **Nota de UI:** el sidebar (`components/layout/menu.tsx` + `Sidebar.tsx`) soporta **grupos directos**
> (un grupo con `to`/`clave` se renderiza como enlace sin submenú — así está "Clientes"). Componente
> reutilizable nuevo: `components/SearchSelect.tsx` (combobox con búsqueda, sin dependencias).
> ⚠️ **Pitfall:** al usar la herramienta Write con rutas **relativas** (`version2\apps\...`) mientras el
> cwd ya es `version2/`, algunos archivos se crean en una carpeta `version2/version2/...` anidada. Usa
> **rutas absolutas** al escribir, o verifica con `ls` y mueve los archivos si pasa.

---

## 1. ⛔ Reglas ULTRA-inviolables (acordadas con el cliente)

1. **La base de datos Supabase es de PRODUCCIÓN y está EN USO ACTIVO por el sistema FlutterFlow.**
   Está **TERMINANTEMENTE PROHIBIDO eliminar, modificar, reemplazar o alterar de cualquier forma** algo de
   la base de datos —tablas, columnas, RPCs/funciones, RLS, políticas, triggers, vistas, `INSERT/UPDATE/
   DELETE` de datos, migraciones, edge functions, Storage— **sin la autorización explícita del usuario,
   caso por caso**. Solo se permiten operaciones de **lectura** (`SELECT` a catálogos, `get_advisors`,
   `generate_typescript_types`, `list_tables`).
   - Cualquier cambio se **propone al usuario con el SQL exacto para que él lo revise y lo aplique**, o se
     pide autorización explícita. **Nunca** actuar por cuenta propia sobre el servidor.

2. **COEXISTENCIA de ambos sistemas (regla clave).** El sistema **FlutterFlow actual** y el **nuevo (v2)**
   van a **convivir** durante toda la transición. En consecuencia:
   - **Todos los objetos del sistema viejo PERMANECEN INTACTOS**: las RPCs (`cdg`,
     `consulta_segura_parametrizada`, `sum_column`, …), tablas, RLS, Storage, etc. **NO se eliminan ni se
     modifican** mientras los dos sistemas coexistan. El sistema Flutter debe seguir funcionando sin cambios.
   - **v2 NO reutiliza las RPCs/funciones del sistema viejo.** Si v2 necesita una función en BD, se **crea
     una función NUEVA** (nombre propio, p. ej. prefijo `v2_…`), siempre **con autorización explícita** del
     usuario. Lo nuevo se añade; lo viejo no se toca.
   - La retirada de los objetos antiguos y las **remediaciones de seguridad que afectan al esquema** (ver
     sección 9) **se difieren** hasta que v2 esté **completo, probado y validado** con paridad funcional
     respecto al sistema anterior.

3. **Construir SOBRE el esquema existente.** No se rediseña la base de datos. Se leen/usan las **mismas
   tablas/columnas actuales** (nombres camelCase: `segModulosUsuarios`, `catUsers`, `fidePdpDispersion`,
   etc.). Los tipos se generan del esquema real.

4. **Frontera de confianza.** El frontend (`apps/web`) **no importa el SDK de Supabase** ni arma SQL. Todo
   pasa por el backend (`apps/api`), que es el único con la `service_role` key y el único que toca la BD.

5. **Idioma:** todo en **español** (código, comentarios, mensajes, docs), con acentos correctos.

6. **🔒 TRAZABILIDAD OBLIGATORIA (regla de oro de auditoría).** **Toda** acción de un usuario que cree,
   modifique o elimine datos **debe quedar registrada en la bitácora de auditoría** (tabla `auditoria`), de
   forma **server-side / a nivel de base de datos** (no falsificable por el cliente) y con el detalle
   **antes/después**. El objetivo es la trazabilidad total para resolver disputas ("así estaba", "el sistema
   lo cambió solo"). En consecuencia:
   - El mecanismo base son **triggers en la BD** sobre las tablas de negocio (cubren v1 y v2 a la vez). Por
     eso, **al crear cualquier tabla nueva que almacene datos de negocio, es OBLIGATORIO adjuntarle el
     trigger de auditoría** como parte de su definición (forma parte del checklist de "terminado").
   - Ningún endpoint de mutación se considera completo si su efecto no queda auditado. El `uid` del actor se
     toma **siempre del JWT verificado** (v2) o de `auth.uid()` (v1), nunca de un campo enviado por el cliente.
   - La tabla `actividad` de v1 **se conserva intacta** (v1 la sigue usando); la auditoría nueva es
     **adicional** y su historial se importa una sola vez (sin perder nada).

7. **🎨 CONVENCIÓN DE TABLAS (regla de diseño).** En **toda** pantalla que muestre datos en una **tabla**,
   salvo que el usuario indique algo distinto:
   - El **encabezado de columnas queda FIJO** (sticky) al hacer scroll: el contenedor de la tabla tiene su
     propio scroll (`overflow-auto` + `max-h`) y el `thead` se pega arriba (no se usa el scroll de la página).
   - El encabezado va con **fondo azul del sidebar (`#1f2a4d`) y letra blanca**.
   - La tabla debe ofrecer **filtros** (búsqueda y/o por criterios) y la posibilidad de **ordenar por el valor
     de las columnas** (clic en el encabezado, asc/desc).
   - Patrón de implementación: usar los helpers compartidos `useSort` + `SortableTh` + `THEAD_STICKY`
     (`apps/web/src/components/tabla/`). No reinventar el encabezado en cada pantalla.

8. **📚 BASE DE CONOCIMIENTO (regla de documentación para el agente de soporte).** Existe una KB en
   `version2/base-conocimiento/` pensada para un **futuro agente de IA de soporte** (explicar cómo usar
   el sistema, diagnosticar problemas y decidir cuándo escalar a ticket). En consecuencia:
   - **Cada módulo que se desarrolle o modifique** debe crear/actualizar su documento súper detallado en
     `base-conocimiento/modulos/<modulo>.md` (con su frontmatter: claves de permiso, tablas, palabras
     clave, relacionados) y reflejarse en `INDICE.md`. Aprovechar el conocimiento que se va teniendo
     (incluidos los "gotchas" tipo `idArrendador = idInversionista`).
   - Mantener `GLOSARIO.md` (términos transversales) y `OBSOLESCENCIA-BD.md` (lo que se podrá eliminar al
     apagar v1: RPCs, vistas, tablas, buckets, código… — registro vivo que se alimenta conforme se detecta).
   - Por ahora la KB son **solo archivos `.md`** (fuente de verdad versionable). La indexación para el
     agente (tabla vectorial `pgvector` en Supabase) es una **fase posterior** que se derivará de estos
     documentos, con su autorización de DDL.

---

## 2. Contexto y documentación previa

El sistema fue auditado a fondo. **Lee estos documentos** (en `../documentacion-replicacion/`) para entender
el dominio y los riesgos:

- `README.md` — índice maestro.
- `00-vision-general-y-arquitectura.md` — qué es el sistema y arquitectura objetivo.
- `01-modelo-de-datos-supabase.md` — catálogo de ~111 tablas, 52 vistas, 128 funciones.
- `02-nucleo-tecnico-consultas-y-servicios.md` — cómo funciona la capa de datos de v1 (el "ORM casero").
- `03-seguridad-y-vulnerabilidades.md` — **auditoría maestra**, 115 hallazgos (35 críticos).
- `04-funcionalidades-generales-y-apariencia.md` — UI/UX a replicar.
- `05-guia-de-replicacion-node-react.md` — **el plano de implementación de v2** (leer sí o sí).
- `06-verificacion-base-de-datos-supabase.md` — evidencia real del servidor (RPCs peligrosas, RLS, etc.).
- `modulos/01..12-*.md` — un documento por módulo de negocio (Inversionistas, Arrendatarios, Parques,
  CxP, Fideicomiso, CRM, Autorizaciones, Configuraciones, Soporte, App Móvil, Autenticación).

**Los 5 riesgos críticos que v2 debe cerrar** (resumen):
1. SQL crudo desde el cliente vía RPC `cdg` (clave hardcodeada, "cifrado" XOR falso).
2. Inyección SQL vía `consulta_segura_parametrizada` y `sum_column`.
3. Control de acceso solo-cliente (`permisos.dart`) — y peor: `segModulosUsuarios` es auto-escribible.
4. Secretos en el bundle (anon key, etc.).
5. 6/7 buckets de Storage públicos con documentos fiscales.

---

## 3. Stack y estructura del monorepo

**Stack:** pnpm workspaces + Turborepo · NestJS 10 + TypeScript · React 19 + Vite 6 + TanStack Query +
React Router 7 + Tailwind v4 · Zod · `@supabase/supabase-js` (solo en el backend) · `jose` (verificación JWT).

```
version2/
├── package.json              # raíz del workspace (scripts turbo)
├── pnpm-workspace.yaml        # workspaces + onlyBuiltDependencies (esbuild, @nestjs/core)
├── turbo.json                # pipeline build/dev/lint/typecheck (dev dependsOn ^build)
├── tsconfig.base.json
├── .env.example              # plantilla raíz
├── HANDOFF.md                # este documento
├── README.md
│
├── apps/
│   ├── api/                  # === BACKEND NestJS (única vía a Supabase) ===
│   │   ├── .env.example · .env.local   # credenciales (NO .env; usar .env.local, git-ignored)
│   │   ├── nest-cli.json · tsconfig.json · tsconfig.build.json · eslint.config.js
│   │   └── src/
│   │       ├── main.ts                 # bootstrap: helmet, cookieParser, CORS, prefijo /api, filtro global
│   │       ├── app.module.ts           # ConfigModule(.env.local) + registra módulos
│   │       ├── common/
│   │       │   ├── config/env.validation.ts   # Zod: SUPABASE_*, DOMINIOS_AUTORIZADOS, etc.
│   │       │   ├── supabase/                   # SupabaseService: admin (service_role) + auth (anon)
│   │       │   ├── auth/                       # JwtAuthGuard, PermisoGuard, @RequierePermiso, @CurrentUser
│   │       │   ├── pipes/zod-validation.pipe.ts
│   │       │   └── filters/all-exceptions.filter.ts
│   │       ├── health/                  # GET /api/health (público)
│   │       └── modules/
│   │           ├── auth/                # ✅ login (usuario|correo)/refresh/logout/me
│   │           ├── configuracion/      # ✅ logos, favicon, dominios, correos (SPHConfiguraciones)
│   │           └── usuarios/           # ✅ listar + toggles status/esRC/esSoporte
│   │
│   └── web/                  # === FRONTEND React + Vite (SPA) ===
│       ├── .env.example      # VITE_API_URL
│       ├── vite.config.ts    # alias '@' -> ./src ; plugins react + tailwind
│       ├── index.html · tsconfig.json
│       └── src/
│           ├── main.tsx                 # QueryClientProvider > BrandingEffects + AuthProvider > Router
│           ├── index.css                # @import "tailwindcss"
│           ├── lib/
│           │   ├── api.ts               # cliente HTTP (refresh en 401, soporta FormData/postForm)
│           │   ├── constants.ts         # APP_VERSION, COLORS, STORAGE keys
│           │   ├── useMediaQuery.ts     # hook responsive
│           │   └── queryClient.ts       # TanStack Query
│           ├── routes/
│           │   ├── router.tsx           # /login, /recuperar públicos; resto bajo ProtectedRoute>AppShell
│           │   └── Home.tsx             # landing: 2 tarjetas + logo claro centrado
│           ├── components/
│           │   ├── Logo.tsx             # logo dinámico (fondo claro/oscuro, dimensiones, mini)
│           │   ├── Toggle.tsx · icons.tsx · BrandingEffects.tsx (favicon)
│           │   └── layout/              # AppShell (header+sidebar colapsable/drawer), Sidebar, menu
│           └── features/
│               ├── auth/               # AuthContext, useAuth, LoginPage, RecuperarPage, ProtectedRoute, format
│               ├── configuraciones/    # SistemaPage, LogoUploader, FaviconUploader, ListaAutorizados, api
│               └── usuarios/           # UsuariosPage, usuarios.api, types
│
└── packages/
    ├── types/                # @erp/types — tipos compartidos
    │   ├── src/
    │   │   ├── database.types.ts   # AUTOGENERADO del esquema real (111 tablas/52 vistas/128 funciones)
    │   │   └── index.ts            # re-exporta Database, Tables<>, TablesInsert<>, ... + DTOs propios
    │   └── dist/                   # build emitido (.d.ts + .js) — api/web lo consumen desde aquí
    └── config/               # @erp/config — tsconfig base + ESLint compartido
```

---

## 4. La capa de seguridad (lo más importante de v2)

Está en `apps/api/src/common/`. **Todo módulo nuevo debe apoyarse en esto.**

- **`SupabaseService`** (`common/supabase/supabase.service.ts`)
  - `.admin` → cliente `service_role` (acceso total, salta RLS). **Único punto de acceso a datos.** Usar
    siempre detrás de los guards.
  - `.auth` → cliente con `anon` key, **solo** para el flujo de login/refresh.
  - Ambos tipados con `Database` (`@erp/types`).
- **`JwtAuthGuard`** (`common/auth/jwt-auth.guard.ts`) — verifica el JWT de Supabase (HS256 con
  `SUPABASE_JWT_SECRET`) y adjunta `req.user = { uid, email, role }`. La identidad **nunca** se toma del
  body del cliente. Si el proyecto migra a JWT asimétrico, cambiar a verificación JWKS.
- **`PermisoGuard` + `@RequierePermiso(clave)`** (`common/auth/`) — RBAC server-side: lee la tabla
  **existente** `segModulosUsuarios` con el `uid` del JWT y autoriza por `clave`. Reemplaza a
  `permisos.dart`. Debe ejecutarse **después** de `JwtAuthGuard`.
- **`@CurrentUser()`** — inyecta el usuario autenticado en un handler.
- **`ZodValidationPipe`** — validación de entrada por endpoint con Zod.
- **`AllExceptionsFilter`** — respuestas de error uniformes y logging server-side **sin** datos sensibles
  (v1 imprimía SQL y tokens en consola del navegador).

### Frontera de confianza en el frontend
- `apps/web/src/lib/api.ts` es la **única** puerta de datos. No se importa `@supabase/supabase-js` en el front.
- El **access token vive en memoria** (no en localStorage → mitiga XSS). El **refresh token va en cookie
  `httpOnly`** gestionada por el backend. Ante un `401`, `api.ts` intenta `/auth/refresh` una vez y
  reintenta; si falla, dispara "sesión expirada".

---

## 5. Módulo de Autenticación (✅ HECHO — úsalo de referencia)

**Patrón:** el backend es **proxy de auth**; el front nunca toca Supabase Auth directamente.

### Backend — `apps/api/src/modules/auth/`
- `auth.controller.ts` — endpoints:
  - `POST /api/auth/login` `{usuario, password}` → `{ accessToken, expiresAt, usuario, permisos }` + setea
    cookie `httpOnly` `sph_rt` con el refresh token. `usuario` acepta **nombre corto o correo completo**.
  - `POST /api/auth/refresh` → renueva desde la cookie.
  - `POST /api/auth/logout` → revoca y limpia la cookie.
  - `GET /api/auth/me` (protegido por `JwtAuthGuard`) → `{ usuario, permisos }`.
- `auth.service.ts` — **resuelve el correo** desde `usuario`: si es corto, busca `usuario@<dominio
  autorizado>` y los correos específicos cuya parte local coincida, en `catUsers`; si es correo completo,
  valida que su dominio esté autorizado o que esté en la lista de correos. Ambigüedad (>1 coincidencia) →
  pide correo completo. Luego `signInWithPassword`/`refreshSession` (cliente `auth`). Carga perfil de
  `catUsers` (incl. `apellidos`) y permisos de `segModulosUsuarios` (cliente `admin`). **Bloquea
  `status=false`**. Mensajes genéricos (anti-enumeración). Dominios/correos vienen de `ConfiguracionService`.
- `auth.schemas.ts` (Zod) · `auth.types.ts` (DTOs).

### Frontend — `apps/web/src/features/auth/`
- `AuthContext.tsx` — al montar intenta restaurar sesión vía `/auth/refresh` (cookie). Expone
  `login`, `logout`, `usuario`, `permisos`, `tienePermiso(clave)`.
- `useAuth.ts` · `LoginPage.tsx` · `ProtectedRoute.tsx` · `auth.api.ts` · `types.ts`.

### Correcciones de seguridad aplicadas vs. v1
| Hallazgo v1 | Corrección v2 |
|---|---|
| Tokens en localStorage (XSS) | Access token en memoria + refresh en cookie `httpOnly` |
| Front habla con Supabase | Backend proxy de auth |
| Permisos leídos en cliente | Perfil/permisos cargados server-side (`service_role`) |
| Enumeración de cuentas | Mensaje genérico "Credenciales inválidas" |
| Usuario inactivo no bloqueado | Bloqueo por `status=false` |

---

## 5b. Módulo Configuraciones → Sistema (✅ HECHO)

Backend: `apps/api/src/modules/configuracion/` (`ConfiguracionService` es **@Global**, lo usa AuthService).
Frontend: `apps/web/src/features/configuraciones/`. Todo se persiste en la tabla EXISTENTE
**`SPHConfiguraciones`** (clave-valor: `parametro`/`valor`/`detalle`/`tipo`/`status`), creando **solo
parámetros propios de v2** (nunca toca `version`, `INPC`, prompts IA, etc.).

| Función | Endpoint | Parámetro en SPHConfiguraciones |
|---|---|---|
| Logos (claro/oscuro) + dimensiones | `GET /configuracion/logos` (público), `POST /configuracion/logo/:fondo`, `PATCH /configuracion/logo/:fondo/dimensiones` | `LOGO_FONDO_CLARO`, `LOGO_FONDO_OSCURO` (JSON `{url,ancho,alto}`); respaldo del oscuro: `LOGO_URL` |
| Favicon | `POST /configuracion/favicon`, incluido en `GET /logos` | `FAVICON_URL` |
| Dominios autorizados | `GET/POST/DELETE /configuracion/dominios` | `DOMINIOS_AUTORIZADOS` (CSV) |
| Correos autorizados (excepciones) | `GET/POST/DELETE /configuracion/correos` | `CORREOS_AUTORIZADOS` (CSV) |

- Archivos de imagen → bucket público **`branding`** (`logo-claro.*`, `logo-oscuro.*`, `favicon.*`), subidos
  con `service_role` (multer). Frontend: `LogoUploader`, `FaviconUploader`, `ListaAutorizados` (componente
  reutilizable para dominios y correos), `SistemaPage`.
- Componente `Logo` (`components/Logo.tsx`) obtiene la URL del endpoint público y respeta dimensiones (si una
  es null → `auto`, mantiene proporción). `BrandingEffects` aplica el favicon al `<head>`.
- `GET /configuracion/logos` y `GET /health` son **públicos**; el resto exige `JwtAuthGuard`.

## 5c. Módulo Configuraciones → Usuarios (✅ HECHO)

Backend: `apps/api/src/modules/usuarios/`. Frontend: `apps/web/src/features/usuarios/UsuariosPage.tsx`.
**Escribe en tablas COMPARTIDAS con Flutter (autorizado por el cliente):**

| Columna UI | Origen | Endpoint |
|---|---|---|
| Status (activo/inactivo) | `catUsers.status` | `PATCH /usuarios/:uid/status` |
| esSoporte | `catUsers.isSupport` | `PATCH /usuarios/:uid/soporte` |
| esRC (responsable comercial) | presencia en `crm_responsableComercial` (uid+id) | `PATCH /usuarios/:uid/rc` |

- `GET /usuarios` lista todos con esos flags. La columna/acción **esSoporte solo es visible y operable por
  usuarios con `isSupport=true`** (validado también en el backend, no solo en la UI).
- Nuevo RC: `id = max(id < 9999) + 1` (9999 es el centinela "ASIGNAR, SIN"). Toggles con optimistic update.
- La columna **Perfil (`idPerfil`) se omite** a propósito: en v2 los permisos serán granulares.

## 5d. Objetos creados en la BD de producción (con autorización explícita)

Únicos cambios hechos al servidor hasta ahora (objetos **NUEVOS**, no se tocó nada del sistema viejo):

1. **Bucket `branding`** (público, límite 2 MB, mimes imagen) — almacena logos y favicon.
2. **Función `public.v2_obtener_logo_url()`** `SECURITY DEFINER`, `set search_path=public`, `stable`;
   devuelve `LOGO_URL`; `GRANT EXECUTE` a `anon, authenticated`. (v2 usa el endpoint backend para los logos;
   esta función queda disponible por RPC para clientes directos / Flutter.)
3. **Parámetros nuevos en `SPHConfiguraciones`** (filas insertadas/actualizadas por el backend cuando el
   usuario configura): `LOGO_FONDO_CLARO`, `LOGO_FONDO_OSCURO`, `FAVICON_URL`, `DOMINIOS_AUTORIZADOS`,
   `CORREOS_AUTORIZADOS`.

> Toda futura escritura a la BD sigue requiriendo autorización explícita (regla 1). El módulo Usuarios
> escribe en `catUsers`/`crm_responsableComercial` por autorización ya concedida para ese módulo.

---

## 6. Cómo arrancar y verificar

```bash
cd version2
pnpm install

# Configurar entorno. El backend lee apps/api/.env.local (prioridad sobre .env), git-ignored.
cp apps/api/.env.example apps/api/.env.local   # y rellenar credenciales reales
cp apps/web/.env.example apps/web/.env

pnpm build         # construye @erp/types (necesario) + api + web
pnpm dev           # api en :3001/api, web en :5173
# o por separado: pnpm dev:api / pnpm dev:web
```

Variables del backend (`apps/api/.env.local`): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`, `DOMINIOS_AUTORIZADOS`, `API_PORT=3001`,
`CORS_ORIGIN=http://localhost:5173`, `NODE_ENV=development`.

**Estado actual:** el sistema está **conectado a la BD real** (vía `apps/api/.env.local`) y `pnpm dev` se
ejecuta durante el desarrollo. `typecheck` + `build` OK en los tres paquetes. Endpoints públicos
(`/health`, `/configuracion/logos`) responden; los protegidos devuelven 401 sin token. El login real, la
gestión de Sistema y Usuarios funcionan (el usuario los prueba en el navegador en `localhost:5173`).

> ⚠️ Para generar los tipos: `@erp/types` debe construirse antes que api/web (`pnpm build` lo hace por el
> `dependsOn: ["^build"]` de Turbo). En dev, `pnpm dev` también construye los tipos primero.

---

## 7. Patrón para crear un módulo de dominio nuevo (receta)

Sigue la estructura del módulo `auth`. Para un módulo `X` (p. ej. `inversionistas`):

### Backend — `apps/api/src/modules/x/`
1. `x.schemas.ts` — esquemas Zod de entrada (crear/editar/filtros) + tipos inferidos.
2. `x.service.ts` — lógica de negocio. Usa `this.supabase.admin.from('<tabla_existente>')...` con el query
   builder **parametrizado** (NUNCA SQL crudo). Tipar con `Tables<'tabla'>`, `TablesInsert<'tabla'>`.
   Para llamar RPCs existentes y seguras: `this.supabase.admin.rpc('<fn>', { ...params })`.
3. `x.controller.ts` — rutas REST. Proteger con `@UseGuards(JwtAuthGuard, PermisoGuard)` y declarar la
   clave con `@RequierePermiso(<clave>)`. Validar el body con `new ZodValidationPipe(schema)`. Paginación
   para listados grandes (no traer datasets completos como v1).
4. `x.module.ts` — declara controller + service.
5. Registrar el módulo en `apps/api/src/app.module.ts` (`imports`).

> Las **claves de permiso** (`@RequierePermiso(204)`, etc.) salen de la tabla `segModulosUsuarios` /
> `segModulos` existente. Consultar (solo lectura) qué `clave` corresponde a cada módulo/sección, o ver el
> documento `modulos/09-configuraciones.md`.

### Frontend — `apps/web/src/features/x/`
1. `x.api.ts` — funciones que llaman a `api.get/post/...('/x...')`.
2. `types.ts` — tipos de la vista (pueden derivarse de `@erp/types`).
3. Componentes/páginas (lista, detalle, formulario) con **TanStack Query** (`useQuery`/`useMutation`),
   formularios validados, tablas con paginación/virtualización. Reusar el look del documento `04`.
4. Añadir rutas en `apps/web/src/routes/router.tsx` como **hijas de `ProtectedRoute`** (idealmente
   `lazy` para code-splitting por módulo).
5. Ocultar acciones según `tienePermiso(clave)` (cosmético; la seguridad real está en el backend).

### Reglas al escribir acceso a datos
- ❌ v2 **NO usa** las RPCs del sistema viejo (`cdg`/`cdgEncryptConsult`, `consulta_segura_parametrizada`,
  `sum_column`) ni SQL en string. (Esas RPCs **permanecen en la BD** para el sistema Flutter; no se tocan —
  ver regla 2. No se "matan": coexisten.)
- ✅ Query builder de `supabase-js` con filtros parametrizados sobre las **tablas existentes**.
- ✅ Si se necesita una función en BD para v2, se **crea una función NUEVA** (p. ej. prefijo `v2_…`) con
  **autorización explícita del usuario**; nunca se reutiliza ni modifica una del sistema viejo.
- ✅ Toda mutación/lectura sensible pasa por `JwtAuthGuard` + `PermisoGuard`.
- ✅ Validar TODA entrada con Zod en el backend.

---

## 8. Próximos pasos (orden recomendado)

> Ya hecho: Auth, Landing/AppShell, Configuraciones (Sistema + Usuarios). Pendiente:

1. **Permisos granulares** — diseñar el modelo de permisos de v2 sobre `segModulos`/`segModulosUsuarios`
   (y `segPlantillasPermisos`/`segDetallesPlantilla`). Definir las **claves** por módulo/sección y aplicar
   `@RequierePermiso(<clave>)` + `PermisoGuard` a los endpoints de Configuraciones (Usuarios, Sistema) y a
   los módulos futuros. Pantalla de administración de permisos por usuario. Ver `modulos/09-configuraciones.md`.
2. **Conectar indicadores del landing** — Tipo de cambio (Banxico, el sistema viejo usa
   `obtener_tipo_cambio_banxico`) e INPC (de `SPHConfiguraciones`/tabla `inpc`). Reemplazar los `—`.
3. **Inversionistas** (`modulos/01-inversionistas.md`) — alta/edición, documentos, propiedades, PDP.
4. **Cuentas por Pagar (CxP)** — el módulo más grande (`modulos/04-cuentas-por-pagar.md`).
5. **Fideicomiso**, **CRM**, **Arrendatarios**, **Parques**, **Autorizaciones**, **Soporte**, **App móvil**.
6. **Generar/refrescar tipos** cuando cambie el esquema:
   `supabase gen types typescript --project-id szjlkvakwljssdnysazp > packages/types/src/database.types.ts`
   (o vía MCP `generate_typescript_types`), luego `pnpm --filter @erp/types build`.
7. Componentes UI compartidos: considerar **shadcn/ui** en `apps/web` y poblar `components/`.
8. Tests (Jest en api, Vitest/Playwright en web) y CI.
9. **Al final de la transición** (v2 validado con paridad funcional, con autorización del usuario): retirar
   el código Flutter de la raíz, y recién entonces aplicar las remediaciones de la sección 9.

---

## 9. Remediaciones de seguridad en Supabase — DIFERIDAS por la coexistencia (NO aplicar todavía)

> ⚠️ **IMPORTANTE (regla 2).** Estas remediaciones **NO se aplican ahora**: el sistema FlutterFlow sigue en
> producción y depende de estos objetos (RPCs, RLS permisiva, etc.). Aplicarlas **rompería el sistema
> actual**. Se **difieren** hasta que v2 esté **completo, probado y validado** con paridad funcional, y
> **solo entonces**, con **autorización explícita** del usuario y el SQL entregado para que él lo aplique.
>
> Se documentan aquí (con detalle en `../documentacion-replicacion/06-…md`) **como backlog de transición**,
> no como tareas pendientes inmediatas:

- Retirar/`REVOKE` de las RPCs `cdg`, `consulta_segura_parametrizada`, `sum_column` → **solo cuando el
  sistema Flutter ya no exista** y v2 cubra toda su funcionalidad.
- `ENABLE ROW LEVEL SECURITY` en las 7 tablas sin RLS (`inversionista` con PII, etc.) → requiere antes
  verificar que no rompe a Flutter (que hoy depende de ese acceso).
- Corregir `segModulosUsuarios` (hoy `authenticated` puede auto-concederse permisos) → coordinar para no
  afectar al sistema actual.
- Reemplazar las ~96 políticas `USING(true)`; marcar privados los 6 buckets públicos; `REVOKE` de `anon` en
  las 45 funciones `SECURITY DEFINER`; `SET search_path`.

**Qué SÍ se puede hacer durante la coexistencia (siempre con autorización explícita):**
- **Crear objetos NUEVOS** para v2 sin tocar los existentes: funciones nuevas (`v2_…`), tablas nuevas,
  políticas/roles nuevos, buckets nuevos. Lo nuevo no interfiere con Flutter.

**Mitigación ya lograda sin tocar la BD:** el backend de v2 elimina el vector principal *para los usuarios
de v2* (su front ya no ejecuta SQL ni recibe la `service_role`). La exposición de la BD vía anon key +
PostgREST persiste mientras Flutter siga vivo; se cierra al final de la transición.

---

## 10. Convenciones y notas

- **Idioma:** español en todo (identificadores de dominio, comentarios, mensajes de error de la API).
- **Commits/Git:** el monorepo `version2/` aún no es un repo git propio (el repo raíz no es git). Coordinar
  con el usuario antes de inicializar git o hacer commits.
- **Gestor de paquetes:** pnpm 10.12. Node 22. No usar npm/yarn dentro de `version2/`.
- **`.env`:** nunca commitear secretos. El `service_role` y el `jwt_secret` solo en `apps/api/.env`.
- **Memoria de sesión:** el contexto histórico del proyecto está en `../.sessions/contexto.md` (actualizarlo
  al terminar trabajo significativo, según las instrucciones globales).
- **MCP de Supabase (`supaSPH`):** disponible para **lectura** (`execute_sql` con SELECT, `get_advisors`,
  `generate_typescript_types`, `list_tables`). Para escritura, autorización explícita del usuario.

---

## 11. Glosario rápido de tablas clave (esquema existente)

| Tabla | Uso |
|-------|-----|
| `catUsers` | Usuarios (uid, email, nombre, apellidos, nomCompleto, idPerfil, rol, status, isSupport). **Ya usada (Auth + Usuarios).** |
| `crm_responsableComercial` | Responsables comerciales (uid + id). Presencia = es RC. **Ya usada (Usuarios).** |
| `SPHConfiguraciones` | Config clave-valor (parametro/valor/detalle/tipo/status). **Ya usada (Sistema): logos, favicon, dominios, correos.** |
| `segModulosUsuarios` | Permisos por usuario (uid, modulo, seccion, clave, acceso). **Base del RBAC** (leída en login; pendiente para granulares). |
| `segModulos`, `segPlantillasPermisos`, `segDetallesPlantilla` | Catálogo de módulos y plantillas de permisos. |
| `inversionista` | Inversionistas/clientes (PII: RFC, CURP, correo). **Sin RLS hoy.** |
| `propiedades`, `parques`, `naves` | Inmuebles. |
| `cxp`, `catFacturas`, `facturasProveedor`, `pagos`, `movbancarios` | Cuentas por pagar / finanzas. |
| `fideDispersiones`, `fidePdpDispersion`, `fideContabilidad` | Fideicomiso. |
| `leads`, `crm_*` | CRM comercial. |

(Lista completa y columnas: `packages/types/src/database.types.ts` y `../documentacion-replicacion/01-*`.)
