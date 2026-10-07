-- ---------------------------------------------------------------------
-- KVA's · Fase 2 (campos automáticos) · función de LECTURA kva_naves_elegibles
-- Autor: Nicanor/Toribio, 2026-10-07. NO aplicada: la aplica Toribio con autorización de Jereff.
-- Solo crea una función (sin tablas, sin datos). Idempotente.
--
-- «Vivo» (verificado en BD real y contra kvas.service.ts `ocupantesDeNaves`): `status = true`.
--   En propiedades y arrenPropiedades, `motivoBaja` solo se llena al dar de baja (status=false);
--   hay 0 filas con status=true y motivo, así que filtrar por motivoBaja no cambia nada y se omite.
--   La nave también debe estar viva (naves.status). `propiedades.PActual` se ignora.
-- Empresa = inversionista.idInversionista: dueño (propiedades.idInversionista) o
--   arrendatario (arrenPropiedades.idArrendador, misma tabla inversionista).
-- rol: INVERSIONISTA | ARRENDATARIO | AMBOS (misma empresa con ambos papeles en la misma nave).
-- ---------------------------------------------------------------------
create or replace function public.kva_naves_elegibles(p_id_inversionista text default null)
returns table ("idInversionista" text, "idNave" text, rol text)
language sql
stable
set search_path = public
as $$
  with v as (
    select p."idInversionista" as emp, p."idNave" as nave, 'INVERSIONISTA'::text as rol
      from public.propiedades p
     where p.status is true
       and p."idNave" is not null
       and p."idInversionista" is not null
       and (p_id_inversionista is null or p."idInversionista" = p_id_inversionista)
    union all
    select a."idArrendador", a."idNave", 'ARRENDATARIO'::text
      from public."arrenPropiedades" a
     where a.status is true
       and a."idNave" is not null
       and a."idArrendador" is not null
       and (p_id_inversionista is null or a."idArrendador" = p_id_inversionista)
  )
  select v.emp,
         v.nave,
         case when count(distinct v.rol) > 1 then 'AMBOS' else min(v.rol) end
    from v
    join public.naves n on n."idNave" = v.nave and n.status is true
   group by v.emp, v.nave
$$;

revoke all on function public.kva_naves_elegibles(text) from public, anon, authenticated;
grant execute on function public.kva_naves_elegibles(text) to service_role;

-- Verificación (tras aplicar):
--   select count(*) from public.kva_naves_elegibles();
--   select * from public.kva_naves_elegibles('<idInversionista de EM BAJÍO EMPAQUES>');
-- Rollback:
--   drop function if exists public.kva_naves_elegibles(text);
