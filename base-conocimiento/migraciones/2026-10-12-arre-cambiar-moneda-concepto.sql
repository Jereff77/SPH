-- ---------------------------------------------------------------------
-- Arrendatarios · Planes de Renta · moneda editable por concepto
-- Autor: Toribio, 2026-10-12. NO aplicada hasta pasar la verificación adversarial.
-- Crea UNA función (sin tablas, sin datos). Idempotente.
--
-- Cambia `arrePdpDetalle.moneda` de un concepto DESDE un año hacia abajo (mismo
-- alcance que `arrepdpdetalle_actualizar_campo_manual`: anio >= p_anio_desde).
-- Reglas (todas aplicadas EN LA BD, no solo en la API):
--   1. Moneda solo 'MXN' | 'USD'.
--   2. El plan debe existir y estar vigente (arrePdpVigente <> 'No').
--   3. BLOQUEO por pagos (decisión de Jereff, 2026-10-12): si alguna partida del
--      alcance tiene pago aplicado (fecPago/uidPago no nulos o cantidadAplicada > 0)
--      NO se cambia nada y se devuelve PAGO_APLICADO con la primera partida pagada.
--   4. Las filas del alcance se bloquean (FOR UPDATE) ANTES de revisar pagos, para que
--      `aplicar_pago_arrendatario` no pueda colarse entre la revisión y el UPDATE.
--   5. p_simular = true: solo revisa alcance y pagos (para la confirmación de la UI).
--   6. NO toca `arrePdp."Moneda"` (moneda del encabezado del plan).
-- Invocada solo por la API (service_role). Sin SECURITY DEFINER.
-- ---------------------------------------------------------------------
create or replace function public.v2_arrepdpdetalle_cambiar_moneda(
  p_id_arre_pdp text,
  p_anio_desde  smallint,
  p_concepto    text,
  p_moneda      text,
  p_simular     boolean default false
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_vigente    text;
  v_total      integer;
  v_pagadas    integer;
  v_part_pago  integer;
  v_fec_pago   date;
  v_anteriores text[];
  v_cambiadas  integer;
begin
  if p_id_arre_pdp is null or btrim(p_id_arre_pdp) = '' then
    return jsonb_build_object('exito', false, 'codigo', 'PARAMETRO_INVALIDO', 'mensaje', 'Falta el plan.');
  end if;
  if p_anio_desde is null or p_anio_desde < 0 then
    return jsonb_build_object('exito', false, 'codigo', 'PARAMETRO_INVALIDO', 'mensaje', 'El año de inicio no es válido.');
  end if;
  if p_concepto is null or btrim(p_concepto) = '' then
    return jsonb_build_object('exito', false, 'codigo', 'PARAMETRO_INVALIDO', 'mensaje', 'Falta el concepto.');
  end if;
  if p_moneda is null or p_moneda not in ('MXN', 'USD') then
    return jsonb_build_object('exito', false, 'codigo', 'PARAMETRO_INVALIDO', 'mensaje', 'La moneda debe ser MXN o USD.');
  end if;

  select "arrePdpVigente" into v_vigente
    from public."arrePdp"
   where "idArrePdp" = p_id_arre_pdp and status = true
     for share;
  if not found then
    return jsonb_build_object('exito', false, 'codigo', 'PLAN_NO_EXISTE', 'mensaje', 'El plan no existe.');
  end if;
  if v_vigente = 'No' then
    return jsonb_build_object('exito', false, 'codigo', 'PLAN_NO_VIGENTE', 'mensaje', 'No se puede modificar un plan no vigente.');
  end if;

  -- Bloquea el alcance (evita carrera con aplicar_pago_arrendatario).
  perform 1
     from public."arrePdpDetalle"
    where "idArrePdp" = p_id_arre_pdp
      and concepto = p_concepto
      and anio >= p_anio_desde
      and status = true
      for update;

  select count(*),
         count(*) filter (where "fecPago" is not null or "uidPago" is not null or coalesce("cantidadAplicada", 0) > 0),
         array_agg(distinct moneda) filter (where moneda is distinct from p_moneda)
    into v_total, v_pagadas, v_anteriores
    from public."arrePdpDetalle"
   where "idArrePdp" = p_id_arre_pdp
     and concepto = p_concepto
     and anio >= p_anio_desde
     and status = true;

  if v_total = 0 then
    return jsonb_build_object('exito', false, 'codigo', 'REGISTRO_NO_EXISTE',
      'mensaje', 'No hay partidas de ese concepto desde ese año en el plan.');
  end if;

  if v_pagadas > 0 then
    select "numPartida", "fecPago"::date into v_part_pago, v_fec_pago
      from public."arrePdpDetalle"
     where "idArrePdp" = p_id_arre_pdp
       and concepto = p_concepto
       and anio >= p_anio_desde
       and status = true
       and ("fecPago" is not null or "uidPago" is not null or coalesce("cantidadAplicada", 0) > 0)
     order by "numPartida"
     limit 1;
    return jsonb_build_object('exito', false, 'codigo', 'PAGO_APLICADO',
      'mensaje', 'La partida ' || coalesce(v_part_pago::text, '?') ||
                 ' ya tiene un pago aplicado; no se puede cambiar la moneda.',
      'detalles', jsonb_build_object('partida', v_part_pago, 'fec_pago', v_fec_pago, 'partidas_pagadas', v_pagadas));
  end if;

  -- Simulación (confirmación de la UI): alcance revisado y sin pagos; no cambia nada.
  if p_simular then
    return jsonb_build_object('exito', true, 'codigo', 'SIMULACION', 'mensaje', 'Sin pagos aplicados',
      'detalles', jsonb_build_object(
        'partidas_alcance', v_total,
        'partidas_cambiadas', 0,
        'moneda_anterior', coalesce(to_jsonb(v_anteriores), '[]'::jsonb),
        'moneda_nueva', p_moneda));
  end if;

  update public."arrePdpDetalle"
     set moneda = p_moneda
   where "idArrePdp" = p_id_arre_pdp
     and concepto = p_concepto
     and anio >= p_anio_desde
     and status = true
     and moneda is distinct from p_moneda;
  get diagnostics v_cambiadas = row_count;

  return jsonb_build_object('exito', true,
    'codigo', case when v_cambiadas = 0 then 'SIN_CAMBIOS' else 'EXITO' end,
    'mensaje', case when v_cambiadas = 0 then 'Ya estaba en ' || p_moneda else 'Moneda actualizada' end,
    'detalles', jsonb_build_object(
      'partidas_alcance', v_total,
      'partidas_cambiadas', v_cambiadas,
      'moneda_anterior', coalesce(to_jsonb(v_anteriores), '[]'::jsonb),
      'moneda_nueva', p_moneda));
exception when others then
  return jsonb_build_object('exito', false, 'codigo', 'ERROR_INTERNO',
    'mensaje', 'Error interno', 'detalles', jsonb_build_object('sqlstate', sqlstate));
end;
$$;

revoke all on function public.v2_arrepdpdetalle_cambiar_moneda(text, smallint, text, text, boolean) from public, anon, authenticated;
grant execute on function public.v2_arrepdpdetalle_cambiar_moneda(text, smallint, text, text, boolean) to service_role;

-- Verificación (tras aplicar):
--   -- Debe dar PARAMETRO_INVALIDO (moneda 'EUR'):
--   select public.v2_arrepdpdetalle_cambiar_moneda('PDP_x', 1::smallint, 'Renta', 'EUR', false);
--   -- Sin permiso de ejecución para anon/authenticated:
--   select has_function_privilege('anon', 'public.v2_arrepdpdetalle_cambiar_moneda(text,smallint,text,text,boolean)', 'execute'); -- false
-- Rollback:
--   drop function if exists public.v2_arrepdpdetalle_cambiar_moneda(text, smallint, text, text, boolean);
