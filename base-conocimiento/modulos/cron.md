---
modulo: Cron / Tareas programadas
estado: desarrollado
version_doc: 1.0
ultima_actualizacion: 2026-06-11
submodulos: [Tareas de base de datos (pg_cron), Tareas del backend (NestJS), Ejecución manual]
rutas: [/configuraciones/cron]
claves_permiso: []
acceso: solo soporte (catUsers.isSupport = true)
tablas: [v2_cron_ejecuciones, cron.job, cron.job_run_details]
funciones: [v2_cron_jobs, v2_cron_run_details]
palabras_clave: [cron, tarea programada, tareas programadas, job, jobs, scheduler, pg_cron, ejecución, ejecuciones, historial de tareas, bitácora de tareas, automático, programado, soporte, monitoreo, "no se ejecutó la tarea", "por qué no corrió el cron", "tarea aparece inactiva", "el programador de tareas", "los procesos automáticos", "última ejecución en memoria", "se reinició el backend"]
relacionado_con: [configuraciones, correo, cxp, arrendatarios, auditoria-y-ver-como]
---

# Módulo: Cron / Tareas programadas

Pantalla de **monitoreo** de todas las tareas automáticas del sistema y su historial de ejecuciones.
**Solo para personal de soporte.**

## 1. Identificación

- **Qué es:** una pantalla en **Configuraciones → Cron** que muestra **todas las tareas programadas** del
  sistema, su estado y el **historial de ejecuciones** (con logs). También permite **dispararlas manualmente**.
- **Quién la ve:** **únicamente** usuarios con `catUsers.isSupport = true` (soporte). No aparece para nadie más.
- **Sinónimos del usuario:** "los crons", "las tareas programadas", "los procesos automáticos", "los jobs",
  "el programador de tareas".

## 2. Por qué es solo de soporte (y no se asigna desde la app)

A diferencia del resto de pantallas, **no tiene una `clave` de permiso** en `segModulos`. Esto es
intencional: significa que **no se puede conceder desde la pantalla de Permisos**. El único requisito es el
flag **`isSupport`**, que solo se cambia desde el backend/BD (o por otro usuario de soporte en
Configuraciones → Usuarios). Así, el acceso a este monitoreo queda reservado a soporte por diseño.

- **Backend:** el controlador `cron` usa `@UseGuards(JwtAuthGuard, SoporteGuard)`. El `SoporteGuard`
  (`common/auth/soporte.guard.ts`) valida `isSupport` server-side con el `uid` del JWT (no se confía en el
  cliente). Cualquier otro usuario recibe **403**.
- **Frontend:** el ítem del menú lleva `soloSoporte: true` (se oculta si no eres soporte) y la página
  `CronPage` además muestra un aviso si se entra por URL sin ser soporte (la barrera real es el backend).

## 3. Qué tareas existen (dos tipos)

### 3.1 Tareas de base de datos (pg_cron)
Jobs programados dentro de Supabase (extensión `pg_cron`). Tienen **historial real y completo** en
`cron.job_run_details`. Hoy son 7:

| Job | Programación | Qué hace |
|-----|--------------|----------|
| `check-arrendamiento-vigencia` | `0 0 * * *` | Revisa vigencia de arrendamientos. |
| `actualizar-anios-planes-diario` | `0 7 * * *` | Actualiza los años de los planes nuevos. |
| `actualizar-ciclo-planes-diario` | `0 7 * * *` | Actualiza el ciclo de los planes de pago. |
| `job_cxp_agregar_fechas_anual` | `1 0 1 1 *` | Genera fechas (lunes/martes) de CxP del año. |
| `arrepdp-actualizar-vigencia` | `0 1 * * *` | Actualiza vigencia de planes de renta. |
| `arrepdp-desvincular-propiedades` | `30 7 * * *` | Desvincula propiedades de planes finalizados. |
| `v2-arrepdp-activar-renovaciones` | `0 2 * * *` | (v2) Activa renovaciones de planes de renta. |

### 3.2 Tareas del backend (schedulers NestJS `@Cron`)
Procesos programados dentro del servidor Node. Antes **no dejaban rastro persistente**; ahora se registran
en la tabla nueva `v2_cron_ejecuciones`. Hoy son 2:

| Tarea (id) | Programación | Qué hace |
|------------|--------------|----------|
| `correo-sync` | cada 5 min | Sincroniza el buzón de facturas (IMAP) y actualiza la bandeja. |
| `cxp-aviso-complementos` | diario ~07:00 MX | Avisa por correo de las parcialidades PPD pagadas sin su REP, próximas al bloqueo. |

## 4. Cómo funciona (arquitectura)

- **Frontend** `apps/web/src/features/cron/`: `CronPage.tsx` (2 secciones con tablas de encabezado fijo azul
  `#1f2a4d`, ordenables; cada fila se expande para ver su historial), `cron.api.ts`, `types.ts`. Ruta lazy
  `/configuraciones/cron`. Usa TanStack Query.
- **Backend** `apps/api/src/modules/cron/`:
  - `cron.controller.ts` (`@UseGuards(JwtAuthGuard, SoporteGuard)`): `GET /cron/jobs`,
    `GET /cron/jobs/:jobid/ejecuciones`, `GET /cron/backend`, `GET /cron/backend/:tarea/ejecuciones`,
    `POST /cron/backend/:tarea/ejecutar`.
  - `cron.service.ts`: lee pg_cron por RPC (`v2_cron_jobs` / `v2_cron_run_details`), lee el estado en vivo de
    los schedulers NestJS con `SchedulerRegistry` y su historial de `v2_cron_ejecuciones`, y **dispara** las
    tareas del backend manualmente.
- **Registro de ejecuciones** `apps/api/src/common/cron/`: `RegistroCronService` (global) cronometra cada
  corrida, captura éxito/error y la inserta en `v2_cron_ejecuciones`. Lo usan los schedulers
  (`origen='programada'`) y el disparo manual (`origen='manual'`, con `ejecutado_por`=uid). Los nombres
  canónicos de las tareas están en `common/cron/cron.tareas.ts`.

### Frontera de confianza
El front **nunca** toca Supabase. Como `supabase-js` solo expone el schema `public`, el schema `cron` se lee
mediante 2 **funciones nuevas `v2_`** de solo lectura (`SECURITY DEFINER`, `EXECUTE` solo a `service_role`).

## 5. Ejecución manual ("Ejecutar ahora")

En la sección **Tareas del backend**, cada tarea tiene un botón **Ejecutar ahora**. Dispara el scheduler en
ese momento; la corrida queda registrada con `origen='manual'` y el `uid` de quien la ejecutó. Útil para, p.
ej., forzar la sincronización del correo o reenviar los avisos de complementos sin esperar al horario.

> Los jobs de **pg_cron** son de **solo lectura** en esta pantalla (no se disparan a mano por seguridad:
> ejecutan lógica de negocio sensible). Si se requiere, se habilitaría caso por caso con autorización.

## 6. Objetos en la BD (todos NUEVOS de v2, autorizados)

- `public.v2_cron_jobs()` — lista los jobs de pg_cron + resumen de su última ejecución.
- `public.v2_cron_run_details(p_jobid, p_limit)` — historial de ejecuciones de pg_cron.
- `public.v2_cron_ejecuciones` — bitácora de los schedulers NestJS (telemetría; **sin** trigger de auditoría
  por no ser dato de negocio; RLS ON sin políticas → solo `service_role`).

SQL en `base-conocimiento/migraciones/2026-06-11-cron-monitoreo.sql`.

## 7. 🩺 Para el agente de soporte (diagnóstico / gotchas)

- "No se ejecutó la tarea" / "la última ejecución en memoria está vacía o desactualizada" → causa: el
  estado **"Última (en memoria)"** y **"Próxima"** de las tareas del backend vienen del
  `SchedulerRegistry`, que vive en memoria del proceso Node y **se reinicia cuando el backend se
  reinicia/redeploya** → regla: el historial **persistente** real está en `v2_cron_ejecuciones` (no se
  pierde con los reinicios); verificar ahí antes de asumir que la tarea no corrió.
- "Las fechas no cuadran con mi hora" → causa: las fechas se muestran en **horario de México** y
  formato `dd/mm/aaaa hh:mm` (regla 7b) → no es un error, es el formato estándar del sistema.
- "La tarea aparece como inactiva" / "por qué no corrió el cron" → causa: su módulo no está cargado o
  el `ScheduleModule` no se inicializó → regla: revisar que el módulo del backend esté registrado y que
  `ScheduleModule` esté inicializado.
