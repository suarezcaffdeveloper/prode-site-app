-- Notificaciones in-app (campanita del header).
--
-- Se generan dentro de las funciones que ya son atómicas (liquidar_jornada,
-- crear_carton, alta de planes, cambio de jornada activa) y, para los avisos
-- que dependen del paso del tiempo (cierre cercano, créditos por vencer), de
-- forma perezosa desde sincronizar_avisos(), que llama la app al navegar.
-- Todas las altas son idempotentes gracias a unique (usuario_id, dedupe_key).

create table public.notificaciones (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references public.usuarios (id) on delete cascade,
  liga_id     uuid not null references public.ligas (id) on delete cascade,
  jornada     integer,
  tipo        text not null check (tipo in (
                'ganaste',
                'sin_premio',
                'ultimo_prode',
                'sin_prodes',
                'jornada_abierta',
                'plan_acreditado',
                'cierra_pronto',
                'creditos_por_vencer'
              )),
  titulo      text not null,
  texto       text not null,
  dedupe_key  text not null,
  vence_en    timestamptz,
  leida_en    timestamptz,
  created_at  timestamptz not null default now(),
  unique (usuario_id, dedupe_key)
);

create index notificaciones_usuario_created_idx
  on public.notificaciones (usuario_id, created_at desc);

alter table public.notificaciones enable row level security;

create policy "notificaciones_select_propia"
on public.notificaciones for select
to authenticated
using ( usuario_id = (select auth.uid()) );

create policy "notificaciones_update_propia"
on public.notificaciones for update
to authenticated
using ( usuario_id = (select auth.uid()) )
with check ( usuario_id = (select auth.uid()) );

-- Sin grants de insert/delete: solo se escribe desde funciones security definer.
grant select on public.notificaciones to authenticated;
grant update (leida_en) on public.notificaciones to authenticated;

-- "$12.500" / "$1.250,50": los montos se formatean acá porque el texto de la
-- notificación se congela al momento del evento.
create or replace function public.formato_pesos(p_monto numeric)
returns text
language sql
immutable
as $$
  select '$'
    || replace(to_char(trunc(p_monto), 'FM999,999,999,999,999'), ',', '.')
    || case
         when p_monto <> trunc(p_monto)
           then ',' || to_char(round((p_monto - trunc(p_monto)) * 100), 'FM00')
         else ''
       end;
$$;

create or replace function public.crear_notificacion(
  p_usuario_id uuid,
  p_liga_id    uuid,
  p_jornada    integer,
  p_tipo       text,
  p_titulo     text,
  p_texto      text,
  p_dedupe_key text,
  p_vence_en   timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notificaciones (
    usuario_id, liga_id, jornada, tipo, titulo, texto, dedupe_key, vence_en
  )
  values (
    p_usuario_id, p_liga_id, p_jornada, p_tipo, p_titulo, p_texto, p_dedupe_key, p_vence_en
  )
  on conflict (usuario_id, dedupe_key) do nothing;
end;
$$;

revoke execute on function public.crear_notificacion(uuid, uuid, integer, text, text, text, text, timestamptz)
  from public, anon, authenticated;

-- crear_carton(): igual a la versión de SPEC 09, más aviso de "queda 1 prode"
-- o "sin prodes" según el saldo que queda después de consumir el crédito.
create or replace function public.crear_carton(
  p_liga_id uuid,
  p_jornada integer,
  p_predicciones jsonb -- [{partido_id, goles_local, goles_visitante}, ...]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id      uuid := auth.uid();
  v_activa          record;
  v_lote_id         uuid;
  v_monto           numeric;
  v_carton_id       uuid;
  v_total_partidos  integer;
  v_validas         integer;
  v_saldo           integer;
begin
  if v_usuario_id is null then
    raise exception 'no_autenticado';
  end if;

  select * into v_activa from public.jornada_activa(p_liga_id);
  if not found then
    raise exception 'jornada_no_activa';
  end if;
  if v_activa.jornada <> p_jornada then
    raise exception 'jornada_no_activa';
  end if;
  if v_activa.hora_cierre is null then
    raise exception 'jornada_bloqueada';
  end if;
  if v_activa.hora_cierre <= now() then
    raise exception 'jornada_cerrada';
  end if;

  select count(*) into v_total_partidos
  from public.partidos
  where liga_id = p_liga_id and jornada = p_jornada;

  select count(distinct pred->>'partido_id') into v_validas
  from jsonb_array_elements(p_predicciones) pred
  join public.partidos p
    on p.id = (pred->>'partido_id')::uuid
   and p.liga_id = p_liga_id
   and p.jornada = p_jornada;

  if v_validas <> v_total_partidos or jsonb_array_length(p_predicciones) <> v_total_partidos then
    raise exception 'predicciones_incompletas';
  end if;

  v_lote_id := public.consumir_credito(v_usuario_id, p_liga_id);

  select round(p.precio / nullif(p.cantidad_creditos, 0), 2) into v_monto
  from public.creditos_lotes l
  join public.planes p on p.id = l.plan_id
  where l.id = v_lote_id;

  insert into public.cartones (usuario_id, liga_id, jornada, lote_id, monto)
  values (v_usuario_id, p_liga_id, p_jornada, v_lote_id, coalesce(v_monto, 0))
  returning id into v_carton_id;

  insert into public.pronosticos (carton_id, partido_id, goles_local_prediccion, goles_visitante_prediccion)
  select
    v_carton_id,
    (pred->>'partido_id')::uuid,
    (pred->>'goles_local')::integer,
    (pred->>'goles_visitante')::integer
  from jsonb_array_elements(p_predicciones) pred;

  select coalesce(sum(l.cantidad_total - l.cantidad_usada), 0)::integer into v_saldo
  from public.creditos_lotes l
  where l.usuario_id = v_usuario_id
    and l.liga_id = p_liga_id
    and (l.expira_en is null or l.expira_en > now());

  if v_saldo = 1 then
    perform public.crear_notificacion(
      v_usuario_id, p_liga_id, p_jornada, 'ultimo_prode',
      'Te queda 1 prode',
      'Es el último de tu plan.',
      'saldo:' || v_carton_id
    );
  elsif v_saldo = 0 then
    perform public.crear_notificacion(
      v_usuario_id, p_liga_id, p_jornada, 'sin_prodes',
      'Gastaste todos tus prodes',
      'Renová tu plan para seguir jugando.',
      'saldo:' || v_carton_id
    );
  end if;

  return v_carton_id;
end;
$$;

-- liquidar_jornada(): igual a la versión de SPEC 09, más una notificación de
-- resultado por usuario con prode en la jornada (ganaste / X aciertos de Y).
create or replace function public.liquidar_jornada(p_liga_id uuid, p_jornada integer)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_admin           uuid := auth.uid();
  v_total_partidos  integer;
  v_pendientes      integer;
  v_pct             numeric;
  v_recaudado       numeric;
  v_pozo            numeric;
  v_entrante        numeric;
  v_total           numeric;
  v_ganadores       integer;
  v_por_ganador     numeric;
  v_saliente        numeric;
  v_liq_id          uuid;
  r                 record;
  v_texto           text;
begin
  if not public.is_admin() then
    raise exception 'no_autorizado';
  end if;

  -- Serializa las liquidaciones de una misma liga.
  select li.porcentaje_pozo into v_pct
  from public.ligas li
  where li.id = p_liga_id
  for update;
  if not found then
    raise exception 'liga_no_encontrada';
  end if;

  if exists (
    select 1 from public.liquidaciones_jornada l
    where l.liga_id = p_liga_id and l.jornada = p_jornada
  ) then
    raise exception 'jornada_ya_liquidada';
  end if;

  select count(*)::integer, count(*) filter (where p.estado <> 'finalizado')::integer
  into v_total_partidos, v_pendientes
  from public.partidos p
  where p.liga_id = p_liga_id and p.jornada = p_jornada;

  if v_total_partidos = 0 then
    raise exception 'jornada_sin_partidos';
  end if;
  if v_pendientes > 0 then
    raise exception 'partidos_pendientes';
  end if;

  if exists (
    select 1 from public.partidos p
    where p.liga_id = p_liga_id
      and p.jornada < p_jornada
      and not exists (
        select 1 from public.liquidaciones_jornada l
        where l.liga_id = p.liga_id and l.jornada = p.jornada
      )
  ) then
    raise exception 'jornadas_previas_sin_liquidar';
  end if;

  select coalesce(sum(c.monto), 0) into v_recaudado
  from public.cartones c
  where c.liga_id = p_liga_id and c.jornada = p_jornada;

  v_pozo := round(v_recaudado * v_pct / 100, 2);

  select l.pozo_acumulado_saliente into v_entrante
  from public.liquidaciones_jornada l
  where l.liga_id = p_liga_id and l.jornada < p_jornada
  order by l.jornada desc
  limit 1;
  v_entrante := coalesce(v_entrante, 0);

  v_total := v_pozo + v_entrante;

  select count(*)::integer into v_ganadores
  from public.cartones_ganadores(p_liga_id, p_jornada);

  if v_ganadores > 0 then
    v_por_ganador := floor(v_total / v_ganadores * 100) / 100;
    v_saliente := 0;
  else
    v_por_ganador := 0;
    v_saliente := v_total;
  end if;

  insert into public.liquidaciones_jornada (
    liga_id, jornada, recaudado, porcentaje_pozo, pozo_jornada,
    comision_plataforma, pozo_acumulado_entrante, pozo_total,
    cantidad_ganadores, monto_por_ganador, pozo_acumulado_saliente,
    liquidada_por
  )
  values (
    p_liga_id, p_jornada, v_recaudado, v_pct, v_pozo,
    v_recaudado - v_pozo, v_entrante, v_total,
    v_ganadores, v_por_ganador, v_saliente,
    v_admin
  )
  returning id into v_liq_id;

  insert into public.ganadores_jornada (liquidacion_id, carton_id, usuario_id, email, monto_premio)
  select v_liq_id, g.carton_id, g.usuario_id, coalesce(u.email, ''), v_por_ganador
  from public.cartones_ganadores(p_liga_id, p_jornada) g
  join public.usuarios u on u.id = g.usuario_id;

  -- Un aviso de resultado por usuario: si tiene algún cartón ganador, "ganaste"
  -- (con el premio total de sus cartones); si no, el mejor de sus cartones.
  for r in
    with aciertos as (
      select
        c.id as carton_id,
        c.usuario_id,
        count(*) filter (
          where pa.estado = 'finalizado'
            and pr.goles_local_prediccion = pa.goles_local
            and pr.goles_visitante_prediccion = pa.goles_visitante
        )::integer as ok
      from public.cartones c
      join public.partidos pa
        on pa.liga_id = c.liga_id and pa.jornada = c.jornada
      left join public.pronosticos pr
        on pr.carton_id = c.id and pr.partido_id = pa.id
      where c.liga_id = p_liga_id and c.jornada = p_jornada
      group by c.id, c.usuario_id
    )
    select
      a.usuario_id,
      max(a.ok)                    as mejor,
      count(*)::integer            as cartones,
      count(g.id)::integer         as ganadores
    from aciertos a
    left join public.ganadores_jornada g
      on g.carton_id = a.carton_id and g.liquidacion_id = v_liq_id
    group by a.usuario_id
  loop
    if r.ganadores > 0 then
      v_texto := 'Te llevás ' || public.formato_pesos(v_por_ganador * r.ganadores) || '. ';
      if r.ganadores > 1 then
        v_texto := v_texto || 'Tuviste ' || r.ganadores || ' prodes ganadores.';
      else
        v_texto := v_texto || 'Acertaste ' || v_total_partidos || ' de ' || v_total_partidos || '.';
      end if;

      perform public.crear_notificacion(
        r.usuario_id, p_liga_id, p_jornada, 'ganaste',
        '¡Ganaste la jornada ' || p_jornada || '!',
        v_texto,
        'resultado:' || p_liga_id || ':' || p_jornada
      );
    else
      if r.cartones > 1 then
        v_texto := 'Tu mejor prode: ' || r.mejor || ' de ' || v_total_partidos || '.';
      else
        v_texto := 'Tuviste ' || r.mejor
          || case when r.mejor = 1 then ' acierto' else ' aciertos' end
          || ' de ' || v_total_partidos || '.';
      end if;
      if v_ganadores = 0 and v_saliente > 0 then
        v_texto := v_texto || ' El pozo de ' || public.formato_pesos(v_saliente)
          || ' pasa a la próxima jornada.';
      end if;

      perform public.crear_notificacion(
        r.usuario_id, p_liga_id, p_jornada, 'sin_premio',
        'Terminó la jornada ' || p_jornada,
        v_texto,
        'resultado:' || p_liga_id || ':' || p_jornada
      );
    end if;
  end loop;

  return v_liq_id;
end;
$$;

-- deshacer_liquidacion(): igual a la versión de SPEC 09, y además retira los
-- avisos de resultado de esa jornada.
create or replace function public.deshacer_liquidacion(p_liga_id uuid, p_jornada integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_liq_id uuid;
begin
  if not public.is_admin() then
    raise exception 'no_autorizado';
  end if;

  perform 1 from public.ligas li where li.id = p_liga_id for update;

  select l.id into v_liq_id
  from public.liquidaciones_jornada l
  where l.liga_id = p_liga_id and l.jornada = p_jornada;

  if v_liq_id is null then
    raise exception 'liquidacion_inexistente';
  end if;

  if exists (
    select 1 from public.ganadores_jornada g
    where g.liquidacion_id = v_liq_id and g.avisado_en is not null
  ) then
    raise exception 'ganadores_ya_avisados';
  end if;

  if exists (
    select 1 from public.liquidaciones_jornada l
    where l.liga_id = p_liga_id and l.jornada > p_jornada
  ) then
    raise exception 'liquidacion_posterior_existente';
  end if;

  delete from public.notificaciones n
  where n.liga_id = p_liga_id
    and n.jornada = p_jornada
    and n.tipo in ('ganaste', 'sin_premio');

  delete from public.ganadores_jornada where liquidacion_id = v_liq_id;
  delete from public.liquidaciones_jornada where id = v_liq_id;
end;
$$;

-- activar_suscripcion_liga() y otorgar_plan_admin(): iguales a
-- 20260927120000_activar_suscripcion_atomica, más el aviso de plan acreditado.
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
  v_lote_id        uuid;
begin
  if v_usuario_id is null then
    raise exception 'no_autenticado';
  end if;

  select id, nombre, cantidad_creditos, tipo into v_plan
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
  values (v_usuario_id, p_liga_id, v_plan.id, v_plan.cantidad_creditos, v_expira_en)
  returning id into v_lote_id;

  perform public.crear_notificacion(
    v_usuario_id, p_liga_id, null, 'plan_acreditado',
    'Plan acreditado',
    'Se acreditaron ' || v_plan.cantidad_creditos
      || case when v_plan.cantidad_creditos = 1 then ' prode' else ' prodes' end
      || ' (plan ' || v_plan.nombre || ').',
    'plan:' || v_lote_id
  );
end;
$$;

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
  v_lote_id    uuid;
begin
  if not public.is_admin() then
    raise exception 'no_autorizado';
  end if;

  select nombre, cantidad_creditos, tipo into v_plan
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
  values (p_usuario_id, p_liga_id, p_plan_id, v_plan.cantidad_creditos, v_expira_en)
  returning id into v_lote_id;

  perform public.crear_notificacion(
    p_usuario_id, p_liga_id, null, 'plan_acreditado',
    'Plan acreditado',
    'Se acreditaron ' || v_plan.cantidad_creditos
      || case when v_plan.cantidad_creditos = 1 then ' prode' else ' prodes' end
      || ' (plan ' || v_plan.nombre || ').',
    'plan:' || v_lote_id
  );
end;
$$;

-- Aviso de "jornada abierta" a los miembros con suscripción activa cada vez
-- que cambia ligas.jornada_activa (a mano con activarJornada o por el
-- auto-avance de avanzar_jornada_activa).
create or replace function public.notificar_jornada_abierta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notificaciones (
    usuario_id, liga_id, jornada, tipo, titulo, texto, dedupe_key
  )
  select
    m.usuario_id,
    new.id,
    new.jornada_activa,
    'jornada_abierta',
    'Jornada ' || new.jornada_activa || ' abierta',
    'Ya podés cargar tu prode.',
    'abierta:' || new.id || ':' || new.jornada_activa
  from public.membresias_liga m
  where m.liga_id = new.id
    and m.estado_suscripcion = 'activa'
  on conflict (usuario_id, dedupe_key) do nothing;

  return new;
end;
$$;

create trigger ligas_notificar_jornada_abierta
after update of jornada_activa on public.ligas
for each row
when (new.jornada_activa is not null and new.jornada_activa is distinct from old.jornada_activa)
execute function public.notificar_jornada_abierta();

-- Avisos que dependen del tiempo: la app la llama al navegar. Es idempotente
-- (dedupe_key) y solo escribe para auth.uid().
--  - cierra_pronto: la jornada activa cierra en <= 6 h, el usuario tiene saldo
--    y todavía no cargó ningún prode en esa jornada.
--  - creditos_por_vencer: lote con saldo que vence en <= 3 días.
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
end;
$$;

revoke execute on function public.sincronizar_avisos() from public, anon;
grant execute on function public.sincronizar_avisos() to authenticated;
