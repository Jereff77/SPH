-- =============================================================================
-- Fideicomiso — cerrar la exposición del padrón a usuarios NO autenticados
-- Fecha: 2026-09-07 · Autor: Toribio/Opus 5
-- Pendiente: tablero #7 (P0) · origen: DEUDA.md "Deuda diferida por sesión" 2026-08-11
--
-- CONTEXTO
-- En v2.68.0 se revocó EXECUTE a `anon` sobre `plan_dispersiones_dinamico`, pero
-- sus 8 RPC hermanas siguieron abiertas — y una de ellas,
-- `plan_dispersiones_dinamico_corregido`, es casi idéntica: bastaba llamar al
-- gemelo para esquivar el REVOKE.
--
-- VERIFICADO EN VIVO por el validador adversarial (2026-08-11) con
-- SET LOCAL ROLE anon, en transacción abortada: `resumen_fideicomiso_completo`
-- devolvió 97 FILAS con nombre, RFC y rendimientos de los fideicomitentes.
-- Re-verificado el 2026-09-02 y el 2026-09-07: las 8 siguen abiertas.
--
-- La anon key es PÚBLICA POR DISEÑO (viajaba en el bundle de la app Flutter v1),
-- así que "requiere la anon key" no es una barrera: es un dato público.
--
-- ⛔ POR QUÉ SE REVOCA TAMBIÉN DE **PUBLIC**
-- El ACL de las 8 es `=X/postgres | postgres=X | anon=X | authenticated=X |
-- service_role=X`. Ese `=X/postgres` inicial ES el grant a PUBLIC: revocar solo
-- de `anon` NO cerraría nada, porque PUBLIC seguiría concediendo EXECUTE.
--
-- POR QUÉ NO ROMPE LA APLICACIÓN (verificado el 2026-09-07)
--   · De las 8, v2 solo invoca DOS en runtime:
--       - `resumen_fideicomiso_completo`  (dispersiones.service.ts:76)
--       - `resumen_dispersion_dinamico`   (dispersiones.service.ts:104)
--     y ambas con `this.supabase.admin` = **service_role**, cuyo grant NO se toca.
--   · Las otras 6 no se invocan (dos aparecen solo en comentarios del código).
--   · 0 vistas dependen de ellas. Se llaman entre sí, pero 5 son SECURITY DEFINER:
--     las llamadas internas corren con los privilegios del owner, no del llamador.
--   · Ninguna edge function las usa (solo existen `comprobante-extraer` y
--     `soporte-chat`).
--   · v1 (Flutter) está apagado desde el 2026-06-21.
--
-- ES REVERSIBLE: no borra ni altera objetos ni datos, solo retira privilegios.
-- =============================================================================

-- 1) Retirar EXECUTE de PUBLIC, anon y authenticated ---------------------------
-- Se usa la firma COMPLETA de cada función (no solo el nombre) para no depender
-- de que no existan sobrecargas hoy.
-- ⚠️ NO se toca `service_role` ni `postgres`: el backend los necesita.

REVOKE EXECUTE ON FUNCTION public.resumen_fideicomiso_completo(text, text)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.resumen_fideicomiso_completo_corregido(text, text)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.resumen_dispersion_dinamico(text, text, text)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.resumen_dispersion_dinamico_corregido(text, text, text)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.plan_dispersiones_dinamico_corregido(text, text, text)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.fideicomiso_rendimientos_promocion(integer, integer, integer, integer, text)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.fideicomiso_rendimientos_resumen_consulta(integer, integer, integer, integer, text)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.fidepdpdispersion_recalcular_por_condicion(text)
  FROM PUBLIC, anon, authenticated;

-- 2) VERIFICACIÓN (correr después de aplicar) ---------------------------------
-- Esperado: anon_puede = false y authenticated_puede = false en las 8,
--           service_role_puede = true en las 8.
--
-- with objetivo(nombre) as (values
--   ('resumen_fideicomiso_completo'),('resumen_fideicomiso_completo_corregido'),
--   ('resumen_dispersion_dinamico'),('resumen_dispersion_dinamico_corregido'),
--   ('plan_dispersiones_dinamico_corregido'),('fideicomiso_rendimientos_promocion'),
--   ('fideicomiso_rendimientos_resumen_consulta'),('fidepdpdispersion_recalcular_por_condicion')
-- )
-- select o.nombre,
--        has_function_privilege('anon', p.oid, 'EXECUTE')          as anon_puede,
--        has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_puede,
--        has_function_privilege('service_role', p.oid, 'EXECUTE')  as service_role_puede
-- from objetivo o
-- join pg_proc p on p.proname = o.nombre
-- join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
-- order by o.nombre;
--
-- 3) PRUEBA REAL con el rol anon (transacción que se ABORTA) -------------------
-- Repite la prueba del validador: debe responder 42501 (insufficient_privilege)
-- en vez de devolver el padrón.
--
-- BEGIN;
--   SET LOCAL ROLE anon;
--   SELECT * FROM public.resumen_fideicomiso_completo('<idFide>', '<noDispersion>') LIMIT 1;
-- ROLLBACK;

-- =============================================================================
-- ROLLBACK (si algún consumidor no identificado se rompiera)
-- =============================================================================
-- GRANT EXECUTE ON FUNCTION public.resumen_fideicomiso_completo(text, text) TO PUBLIC, anon, authenticated;
-- GRANT EXECUTE ON FUNCTION public.resumen_fideicomiso_completo_corregido(text, text) TO PUBLIC, anon, authenticated;
-- GRANT EXECUTE ON FUNCTION public.resumen_dispersion_dinamico(text, text, text) TO PUBLIC, anon, authenticated;
-- GRANT EXECUTE ON FUNCTION public.resumen_dispersion_dinamico_corregido(text, text, text) TO PUBLIC, anon, authenticated;
-- GRANT EXECUTE ON FUNCTION public.plan_dispersiones_dinamico_corregido(text, text, text) TO PUBLIC, anon, authenticated;
-- GRANT EXECUTE ON FUNCTION public.fideicomiso_rendimientos_promocion(integer, integer, integer, integer, text) TO PUBLIC, anon, authenticated;
-- GRANT EXECUTE ON FUNCTION public.fideicomiso_rendimientos_resumen_consulta(integer, integer, integer, integer, text) TO PUBLIC, anon, authenticated;
-- GRANT EXECUTE ON FUNCTION public.fidepdpdispersion_recalcular_por_condicion(text) TO PUBLIC, anon, authenticated;
