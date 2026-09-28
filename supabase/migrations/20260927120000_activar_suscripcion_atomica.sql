-- Hasta ahora, activar una membresía (estado_suscripcion = 'activa') y
-- otorgar los créditos correspondientes (insert en creditos_lotes) eran dos
-- pasos manuales e independientes -- nada garantizaba que el segundo
-- ocurriera junto con el primero. Resultado: una membresía podía quedar
-- "activa" sin ningún crédito disponible ("0 prodes para cargar").
--
-- Estas dos funciones unifican ambos pasos en una sola transacción, con el
-- mismo motivo que crear_carton()/consumir_credito() en
-- 20260926130000_planes_creditos_cartones_pronosticos.sql: supabase-js no
-- soporta transacciones multi-statement desde un server action, así que la
-- atomicidad se logra envolviendo ambas escrituras en una función plpgsql.
-- security definer también es necesario acá: "creditos_lotes_insert_admin"
-- solo permite insertar a un admin, así que el flujo de autogestión (un
-- usuario común activando su propia suscripción) no podría insertar su lote
-- de crédito sin correr como dueño de la función.

-- Activa la suscripción de quien invoca (auth.uid()) a partir de un plan
-- elegido (autogestión temporal, ver 20260926140000_temp_auto_activar_suscripcion),
-- y le otorga el lote de créditos de ese plan en el mismo paso.
create or replace function public.activar_suscripcion_liga(
  p_liga_id uuid,
  p_plan_slug text,
  p_comprobante_path text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id     uuid := auth.uid();
  v_plan           record;
  v_expira_en      timestamptz;
  v_membresia_id   uuid;
begin
  if v_usuario_id is null then
    raise exception 'no_autenticado';
  end if;

  select id, cantidad_creditos, tipo into v_plan
  from public.planes
  where slug = p_plan_slug and activo;

  if not found then
    raise exception 'plan_invalido';
  end if;

  v_expira_en := case when v_plan.tipo = 'mensual' then now() + interval '30 days' else null end;

  select id into v_membresia_id
  from public.membresias_liga
  where usuario_id = v_usuario_id and liga_id = p_liga_id;

  if v_membresia_id is null then
    insert into public.membresias_liga (usuario_id, liga_id, plan_elegido, comprobante_path, estado_suscripcion)
    values (v_usuario_id, p_liga_id, p_plan_slug, p_comprobante_path, 'activa');
  else
    update public.membresias_liga
    set plan_elegido = p_plan_slug,
        comprobante_path = p_comprobante_path,
        estado_suscripcion = 'activa'
    where id = v_membresia_id;
  end if;

  insert into public.creditos_lotes (usuario_id, liga_id, plan_id, cantidad_total, expira_en)
  values (v_usuario_id, p_liga_id, v_plan.id, v_plan.cantidad_creditos, v_expira_en);
end;
$$;

-- Otorga un plan a un usuario puntual (panel de admin): activa su membresía
-- en esta liga y le otorga el lote de créditos del plan, en el mismo paso.
create or replace function public.otorgar_plan_admin(
  p_liga_id uuid,
  p_usuario_id uuid,
  p_plan_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan       record;
  v_expira_en  timestamptz;
begin
  if not public.is_admin() then
    raise exception 'no_autorizado';
  end if;

  select cantidad_creditos, tipo into v_plan
  from public.planes
  where id = p_plan_id and activo;

  if not found then
    raise exception 'plan_invalido';
  end if;

  v_expira_en := case when v_plan.tipo = 'mensual' then now() + interval '30 days' else null end;

  update public.membresias_liga
  set estado_suscripcion = 'activa'
  where usuario_id = p_usuario_id and liga_id = p_liga_id;

  insert into public.creditos_lotes (usuario_id, liga_id, plan_id, cantidad_total, expira_en)
  values (p_usuario_id, p_liga_id, p_plan_id, v_plan.cantidad_creditos, v_expira_en);
end;
$$;
