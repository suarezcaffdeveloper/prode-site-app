-- Evita correr la lógica completa de sincronizar_avisos() en cada
-- navegación: la app la saltea (ver obtenerNotificaciones() en
-- lib/notificaciones.ts) si ya corrió hace menos de 1 minuto para ese
-- usuario. No cambia qué hace la función, solo agrega el timestamp que la
-- app usa para decidir cuándo llamarla.

alter table public.usuarios
  add column if not exists ultimo_sync_avisos timestamptz;

create or replace function public.sincronizar_avisos()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario  uuid := auth.uid();
  r          record;
begin
  if v_usuario is null then
    return;
  end if;

  for r in
    select m.liga_id, ja.jornada, ja.hora_cierre
    from public.membresias_liga m
    cross join lateral public.jornada_activa(m.liga_id) ja
    where m.usuario_id = v_usuario
      and m.estado_suscripcion = 'activa'
      and ja.hora_cierre is not null
      and ja.hora_cierre > now()
      and ja.hora_cierre <= now() + interval '6 hours'
  loop
    if not exists (
      select 1 from public.cartones c
      where c.usuario_id = v_usuario
        and c.liga_id = r.liga_id
        and c.jornada = r.jornada
    ) and exists (
      select 1 from public.creditos_lotes l
      where l.usuario_id = v_usuario
        and l.liga_id = r.liga_id
        and l.cantidad_usada < l.cantidad_total
        and (l.expira_en is null or l.expira_en > now())
    ) then
      perform public.crear_notificacion(
        v_usuario, r.liga_id, r.jornada, 'cierra_pronto',
        'Cierra la jornada ' || r.jornada,
        'Cierra el '
          || to_char(r.hora_cierre at time zone 'America/Argentina/Buenos_Aires', 'DD/MM')
          || ' a las '
          || to_char(r.hora_cierre at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI')
          || ' y todavía no cargaste tu prode.',
        'cierra:' || r.liga_id || ':' || r.jornada,
        r.hora_cierre
      );
    end if;
  end loop;

  for r in
    select
      l.id,
      l.liga_id,
      (l.cantidad_total - l.cantidad_usada) as restantes,
      l.expira_en
    from public.creditos_lotes l
    where l.usuario_id = v_usuario
      and l.expira_en is not null
      and l.expira_en > now()
      and l.expira_en <= now() + interval '3 days'
      and l.cantidad_usada < l.cantidad_total
  loop
    perform public.crear_notificacion(
      v_usuario, r.liga_id, null, 'creditos_por_vencer',
      'Tus prodes están por vencer',
      r.restantes
        || case when r.restantes = 1 then ' prode vence' else ' prodes vencen' end
        || ' el '
        || to_char(r.expira_en at time zone 'America/Argentina/Buenos_Aires', 'DD/MM')
        || '.',
      'vence:' || r.id,
      r.expira_en
    );
  end loop;

  update public.usuarios set ultimo_sync_avisos = now() where id = v_usuario;
end;
$$;

revoke execute on function public.sincronizar_avisos() from public, anon;
grant execute on function public.sincronizar_avisos() to authenticated;
