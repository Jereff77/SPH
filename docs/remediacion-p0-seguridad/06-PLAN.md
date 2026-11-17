# 06 — Plan por fases · Seguridad P0: cerrar el acceso directo a la base (RLS)

> Mini-paquete de **seguridad con producción** (riesgo alto → verificación adversarial Opus y autorización de Jereff
> sobre el SQL exacto de cada paso). Base técnica: `.sessions/base-conocimiento/PLAN-remediacion-P0.md` (julio 2026,
> FASE 1 y FASE 2) y `DEUDA.md` (P0-1 a P0-4). Seguimiento del avance en Skywrap: `plan.json` de esta carpeta.
> **Estado: PLAN. Nada aplicado.**

## 1. Objetivo
Que ninguna persona con sesión (rol `authenticated`) ni sin sesión (`anon`) pueda leer o cambiar datos de la base
saltándose el backend, y que nadie pueda darse permisos a sí mismo. El backend (`service_role`) no se afecta.

## 2. Qué se cierra
| Id | Hueco | Fase de este plan |
|---|---|---|
| P0-1 / P0-4 | `anon` y `authenticated` ejecutan `ia_consulta_sql` y 7 RPCs inseguras de la v1 | Ola 3 (Paso 0) |
| P0-3 | cualquier usuario con sesión escribe en `segModulosUsuarios` (auto-escalado de permisos) | Ola 4 (Lote A) |
| P0-2 | 175 tablas y vistas con permiso directo a `authenticated` y 117 políticas abiertas (`true`) | Olas 5 y 6 (Lotes B y C) |
| — | las tablas nuevas nacen con permisos abiertos (6 permisos por defecto a `authenticated`) | Ola 7 (Lote D) |

**Fuera de este plan** (siguen en `PLAN-remediacion-P0.md`): P0-5 buckets de Storage, P0-6 llaves y la anon key
legacy, FASE 5 (limpieza). Se planean aparte.

## 3. Evidencia verificada el 2026-11-17 (solo lectura)
- **P0-1 sigue abierto:** `anon` y `authenticated` tienen EXECUTE sobre `ia_consulta_sql`; la FASE 1 de julio nunca se aplicó.
- **Nadie legítimo usa `authenticated` para datos:** el API usa `service_role` (`admin` y `comoActor`); la llave `anon` solo hace el login;
  el agente usa los roles `v2_soporte_ro` y `v2_agente_ro`; Realtime va con `service_role`; la web no referencia Supabase;
  las edge functions solo llaman `auth.getUser`.
- **Tráfico de las últimas 24 h:** 0 peticiones con rol `authenticated`; 20 de login con `anon`; 57 descargas de archivos sin JWT.
  El script Python que lee `catFacturas` usa `service_role`.
- **La v1 ya no opera directo:** última sesión de navegador contra Supabase el 2026-06-10 (Windows) y el 2026-07-24 (Mac).
- **Looker (verificado 2026-11-17):** no pasa por la API ni por `authenticated`: usa dos roles de Postgres con login propio,
  `looker_reader` (SELECT en 39 tablas, incluidas `cxp`, `inversionista` y `catUsers`) y `lkr_cxp` (SELECT en la vista `lkr_cxp`).
  Ninguno es miembro de `authenticated`, así que **los lotes no lo tocan**. Sin sesiones activas ni rastro en los logs de 24 h;
  Jereff recuerda que ya no funciona. Los roles siguen vivos y sin vencimiento (decisión pendiente: quitarles el login).
- **n8n (verificado 2026-11-17):** sin conexión a la base, sin tareas programadas, sin llamadas `pg_net` en 7 días y sin triggers que lo invoquen;
  la v2 reemplazó sus flujos en código. Quedan dos vistas `n8n_cxp_resumen` y `n8n_cxp_x_autorizar` con todos los permisos para `anon`
  y `authenticated`; las cierra el lote C.
- **Confirmado por Jereff (2026-11-17): el script sigue funcionando y debe operar como está.** Ningún lote lo toca; se le respeta en todas las olas.
- **Hallazgo aparte:** un script Python (`python-httpx`, alojado en Hostinger) usa la llave `service_role` hoy: ≈3,750 lecturas
  diarias a `catFacturas` y escrituras a `movbancarios`. No lo afectan los lotes, pero tiene la llave maestra; relevante para P0-6.

## 4. Reglas del plan
1. **Ningún cambio en BD sin autorización de Jereff sobre el SQL exacto**, paso por paso (Regla de PARADA).
2. **Respaldo de reversa antes de tocar:** inventario de permisos y políticas como SQL restaurable, guardado en `temp/respaldos/`.
3. **Un lote a la vez.** No se pasa al siguiente sin verificación completa del anterior.
4. **Verificación de cada lote:** (a) repetir el inventario de permisos; (b) humo de la app con la cuenta de Toribio (login, listados,
   aprobar, pagar, Ventas, Arrendatarios); (c) logs sin `permission denied` (42501) inesperados; (d) prueba negativa con la
   cuenta de Toribio llamando directo a `/rest/v1/<tabla>`: debe responder «permission denied».
5. **Reversa por lote:** el `GRANT`/`CREATE POLICY` guardado; tarda un minuto. Si algo del humo falla → se revierte el lote antes de investigar.
6. Si al aplicar hace falta apartarse del SQL aprobado, **se para y se pregunta**.
7. La cuenta de Toribio solo se usa para validar; no se muta producción con ella.

## 5. Olas
| Ola | Qué entrega | Entra | Sale / criterio de aceptación |
|---|---|---|---|
| **0 · Verificación y plan** | Estado real confirmado, plan escrito, Looker y n8n aclarados | — | Evidencia de §3 y respuesta sobre Looker/n8n. Si alguno usa `authenticated`, se rediseña el lote B antes de seguir |
| **1 · SQL exacto y respaldo** | Respaldo de reversa y SQL del Paso 0 y lotes A–D | Ola 0 | Respaldo restaurable probado en seco (se lee y se revisa); SQL con firmas exactas |
| **2 · Validación adversarial** | Dos validadores Opus con lentes distintas | Ola 1 | 0 hallazgos ALTA abiertos; visto bueno de Jereff al SQL del Paso 0 |
| **3 · Paso 0 (P0-1/P0-4)** | `anon`/`authenticated` sin EXECUTE en las 8 RPCs | Ola 2 | El inventario ya no los lista; Montse (agente) sigue respondiendo; app OK |
| **4 · Lote A (P0-3)** | `segModulosUsuarios` sin escritura para `anon`/`authenticated`; políticas `_220` de escritura fuera | Ola 3 | Prueba negativa de auto-escalado: INSERT/UPDATE directo falla; pantalla de Permisos sigue guardando |
| **5 · Lote B (P0-2)** | Sin permisos directos en `cxp`, `cxp_ppd`, `pagos`, `movbancarios`, `inversionista`, `catUsers`, `SPHConfiguraciones`, `emails`, `correo_*`, `auditoria` y similares | Ola 4 | Lectura directa a `cxp` = permission denied; CxP, Ventas y Arrendatarios completos |
| **6 · Lote C (P0-2)** | Resto de tablas y las 50 vistas | Ola 5 | Inventario final: 0 tablas con permisos a `anon`/`authenticated` salvo excepciones documentadas |
| **7 · Lote D** | Permisos por defecto cerrados | Ola 6 | Una tabla de prueba creada y borrada nace sin permisos para `authenticated` |
| **8 · Cierre** | Regresión final, documentación, commit | Ola 7 | Bitácora, KB, estados en PLAN-remediacion-P0 y DEUDA, tablero cerrado con versión y fecha, commit selectivo |

## 6. Riesgos y mitigación
| Riesgo | Mitigación |
|---|---|
| Looker o n8n dependen de los permisos que se quitan | Verificado: Looker usa roles propios que no son `authenticated`; n8n no tiene actividad. Sin impacto |
| Un consumidor desconocido deja de funcionar | Lotes pequeños, logs de 42501 tras cada uno y reversa de un minuto |
| Vistas `SECURITY DEFINER` (`crm_Agenda`, `v_rentascombinadas`, `lkr_cxp`) saltan el cierre | Las revisa el validador 2; si siguen abiertas se plantean en la FASE 5 de `PLAN-remediacion-P0.md` |
| Una migración del presupuesto crea objetos con permisos abiertos | Este plan va **antes** de F0/F1/F2; la Ola 7 cierra los permisos por defecto |
| Sesión de Jereff o de la cuenta de Toribio cambia de IP | Se avisa y se espera su autorización (regla 6 de la cuenta de Toribio) |

## 7. Equipo
Toribio (Sonnet 5.5): diseño, SQL, aplicación y verificación. Opus ×2: validadores adversariales (seguridad, producción).
Jereff: autoriza el SQL exacto de cada paso y responde lo de Looker/n8n. Sin Nicanor: todo es seguridad o datos.

## 8. Estimación
≈ 10 h de trabajo efectivo (620 min sumando las tareas) repartidas en varias ventanas por las autorizaciones de Jereff (detalle por tarea en `plan.json`).
