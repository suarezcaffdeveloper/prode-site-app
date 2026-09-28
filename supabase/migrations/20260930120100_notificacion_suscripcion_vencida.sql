-- Aviso in-app cuando una suscripción pasa sola a "inactiva" porque venció su
-- último lote de créditos (ver 20260930110000_vencer_suscripciones).

alter table public.notificaciones
  drop constraint notificaciones_tipo_check;

alter table public.notificaciones
  add constraint notificaciones_tipo_check check (tipo in (
    'ganaste',
    'sin_premio',
    'ultimo_prode',
    'sin_prodes',
    'jornada_abierta',
    'plan_acreditado',
    'cierra_pronto',
    'creditos_por_vencer',
    'suscripcion_vencida'
  ));

create or replace function public.vencer_suscripciones(p_liga_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario  uuid := auth.uid();
  r          record;
  v_vencio   timestamptz;
begin
  if v_usuario is null then
    return;
  end if;

  for r in
    with vencidas as (
      update public.membresias_liga m
      set estado_suscripcion = 'inactiva'
      where m.usuario_id = v_usuario
        and m.estado_suscripcion = 'activa'
        and (p_liga_id is null or m.liga_id = p_liga_id)
        and exists (
          select 1 from public.creditos_lotes l
          where l.usuario_id = m.usuario_id and l.liga_id = m.liga_id
        )
        and not exists (
          select 1 from public.creditos_lotes l
          where l.usuario_id = m.usuario_id
            and l.liga_id = m.liga_id
            and (l.expira_en is null or l.expira_en > now())
        )
      returning m.liga_id
    )
    select v.liga_id, li.nombre as liga_nombre
    from vencidas v
    join public.ligas li on li.id = v.liga_id
  loop
    select max(l.expira_en) into v_vencio
    from public.creditos_lotes l
    where l.usuario_id = v_usuario and l.liga_id = r.liga_id;

    -- La dedupe_key lleva el vencimiento: cada ciclo vencido avisa una sola vez.
    perform public.crear_notificacion(
      v_usuario, r.liga_id, null, 'suscripcion_vencida',
      'Tu suscripción venció',
      'Tu suscripción en ' || r.liga_nombre
        || ' venció. Elegí un plan para volver a jugar.',
      'suscripcion_vencida:' || r.liga_id || ':' || extract(epoch from v_vencio)::bigint
    );
  end loop;
end;
$$;

revoke execute on function public.vencer_suscripciones(uuid) from public, anon;
grant execute on function public.vencer_suscripciones(uuid) to authenticated;
