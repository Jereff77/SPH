# Despliegue en EasyPanel (GitHub → Docker)

El sistema son **dos servicios** que se despliegan por separado desde la rama `erp_v2`:

| Servicio | Qué es | Dockerfile | Puerto interno |
|---|---|---|---|
| **api** | Backend NestJS (única vía a Supabase) | `apps/api/Dockerfile` | **3001** |
| **web** | Frontend React/Vite (SPA, nginx) | `apps/web/Dockerfile` | **80** |

> El **build context** de ambos es la **raíz del repo** (que en la rama `erp_v2` ya es el contenido de `version2/`). Es un monorepo pnpm: el Dockerfile instala desde la raíz, compila `@erp/types` + la app y genera una imagen liviana.

---

## 1) Servicio `api` (backend)

En EasyPanel → **Create → App**:

- **Source:** GitHub → repo `Jereff77/SPH`, **branch `erp_v2`**.
- **Build:** Dockerfile
  - **Dockerfile Path:** `apps/api/Dockerfile`
  - **Build Context / Root:** `/` (la raíz del repo)
- **Port:** `3001` (Proxy de EasyPanel → puerto 3001).
- **Dominio:** p. ej. `api-erp.tu-dominio.com` (con HTTPS/Let's Encrypt de EasyPanel).
- **Environment** (Variables de entorno — **secretas**, NO van en el repo):

```
NODE_ENV=production
API_PORT=3001
CORS_ORIGIN=https://erp.tu-dominio.com          # el dominio del frontend (sin / al final)
SUPABASE_URL=https://szjlkvakwljssdnysazp.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role key>     # SECRETO — salta RLS
SUPABASE_ANON_KEY=<anon key>
SUPABASE_JWT_SECRET=<JWT secret del proyecto>    # para verificar los JWT
DOMINIOS_AUTORIZADOS=aceleremos.com,gruposph.mx,gruposph.com
BANXICO_TOKEN=<token Banxico>                     # opcional (tiene default)
```

- **Health check (opcional):** path `GET /api/health` (el contenedor ya trae HEALTHCHECK).

---

## 2) Servicio `web` (frontend)

En EasyPanel → **Create → App**:

- **Source:** mismo repo `Jereff77/SPH`, **branch `erp_v2`**.
- **Build:** Dockerfile
  - **Dockerfile Path:** `apps/web/Dockerfile`
  - **Build Context / Root:** `/`
  - **Build Args:**
    ```
    VITE_API_URL=https://api-erp.tu-dominio.com   # URL pública del backend (sin / al final)
    ```
    > ⚠️ `VITE_API_URL` se "hornea" en el bundle en **build time**. Si cambias el dominio del backend, hay que **reconstruir** el servicio web.
- **Port:** `80`.
- **Dominio:** p. ej. `erp.tu-dominio.com` (HTTPS).

El frontend llama a `${VITE_API_URL}/api/...`. nginx hace fallback a `index.html` (rutas de React Router como `/cxp/pagar`).

---

## 3) Orden y verificación

1. Despliega primero **api**, asígnale dominio HTTPS y comprueba `https://api-erp.tu-dominio.com/api/health` → `{"status":"ok"}`.
2. Despliega **web** con `VITE_API_URL` apuntando a ese dominio.
3. Entra al frontend y haz login.

---

## 4) Notas importantes

- **CORS y cookies:** el login usa un **refresh token en cookie httpOnly**. Para que la sesión persista entre el dominio del front y el del api:
  - Usa **subdominios del mismo dominio raíz** (recomendado): `erp.tu-dominio.com` (web) y `api-erp.tu-dominio.com` (api). Ambos con **HTTPS**.
  - `CORS_ORIGIN` debe ser **exactamente** el origen del frontend (con esquema, sin `/` final). El backend ya envía `credentials: true`.
  - Si front y api estuvieran en dominios **distintos** (no subdominios), habría que ajustar la cookie a `SameSite=None; Secure` en el backend (`apps/api`); avísame y lo configuro.
- **Realtime (SSE):** la pantalla *Pagar solicitudes* usa Server-Sent Events (`/api/cxp/pagos/stream`). EasyPanel/nginx proxy no debe **bufferizar** ni cerrar conexiones largas para ese path (Traefik de EasyPanel lo soporta por defecto). Si el tiempo real no llega, revisar timeouts del proxy.
- **Secretos:** nunca subir `.env.local` (ya excluido por `.gitignore` y `.dockerignore`). Todas las claves van en las *Environment Variables* de EasyPanel.
- **Migraciones de BD:** este despliegue **no** corre migraciones; la base es la de Supabase ya existente (producción), compartida con v1.
- **Auto-deploy:** activa el webhook de GitHub en EasyPanel para reconstruir al hacer push a `erp_v2`.

---

## 5) Prueba local (opcional)

Con Docker en tu equipo, desde `version2/`:

```bash
# crea un .env con las variables (SUPABASE_*, CORS_ORIGIN, VITE_API_URL=http://localhost:3001 …)
docker compose up --build
# web → http://localhost:8080   ·   api → http://localhost:3001/api/health
```
