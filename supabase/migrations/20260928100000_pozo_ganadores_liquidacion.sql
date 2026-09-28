-- SPEC 09: pozo por jornada, prodes ganadores y liquidación.

-- Porcentaje del recaudado que va al pozo; el resto es de la plataforma.
alter table public.ligas
  add column porcentaje_pozo numeric(5,2) not null default 80
  check (porcentaje_pozo between 0 and 100);

-- Snapshot del valor del prode al momento de crearlo.
alter table public.cartones
  add column monto numeric(10,2) not null default 0
  check (monto >= 0);

-- Backfill de cartones existentes: precio del plan / créditos del plan.
update public.cartones c
set monto = round(p.precio / p.cantidad_creditos, 2)
from public.creditos_lotes l
join public.planes p on p.id = l.plan_id
where l.id = c.lote_id
  and p.cantidad_creditos > 0;

-- Liquidación congelada de una jornada de una liga.
create table public.liquidaciones_jornada (
  id                        uuid primary key default gen_random_uuid(),
  liga_id                   uuid not null references public.ligas (id),
  jornada                   integer not null,
  recaudado                 numeric(12,2) not null,
  porcentaje_pozo           numeric(5,2) not null,
  pozo_jornada              numeric(12,2) not null,
  comision_plataforma       numeric(12,2) not null,
  pozo_acumulado_entrante   numeric(12,2) not null default 0,
  pozo_total                numeric(12,2) not null,
  cantidad_ganadores        integer not null default 0,
  monto_por_ganador         numeric(12,2) not null default 0,
  pozo_acumulado_saliente   numeric(12,2) not null default 0,
  liquidada_por             uuid not null references public.usuarios (id),
  liquidada_en              timestamptz not null default now(),
  unique (liga_id, jornada)
);

alter table public.liquidaciones_jornada enable row level security;

create policy "liquidaciones_select_admin"
on public.liquidaciones_jornada for select
to authenticated
using ( public.is_admin() );

-- Sin grants de insert/update/delete: se escribe solo vía liquidar_jornada()
-- y deshacer_liquidacion().
grant select on public.liquidaciones_jornada to authenticated;

-- Cartones ganadores de una liquidación (un registro por cartón).
create table public.ganadores_jornada (
  id               uuid primary key default gen_random_uuid(),
  liquidacion_id   uuid not null references public.liquidaciones_jornada (id),
  carton_id        uuid not null unique references public.cartones (id),
  usuario_id       uuid not null references public.usuarios (id),
  email            text not null,
  monto_premio     numeric(12,2) not null,
  avisado_en       timestamptz,
  aviso_error      text
);

create index ganadores_jornada_liquidacion_idx on public.ganadores_jornada (liquidacion_id);

alter table public.ganadores_jornada enable row level security;

create policy "ganadores_select_admin"
on public.ganadores_jornada for select
to authenticated
using ( public.is_admin() );

create policy "ganadores_update_admin"
on public.ganadores_jornada for update
to authenticated
using ( public.is_admin() )
with check ( public.is_admin() );

grant select on public.ganadores_jornada to authenticated;
grant update (avisado_en, aviso_error) on public.ganadores_jornada to authenticated;

-- crear_carton(): igual a SPEC 05 pero guarda el monto del prode (precio del
-- plan del lote / créditos del plan) como snapshot en cartones.monto.
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

  return v_carton_id;
end;
$$;

-- Regla única de "cartón ganador": todos los partidos de la jornada están
-- finalizados y el cartón tiene el marcador exacto en cada uno. Helper interno:
-- lo usan ganadores_provisorios() y liquidar_jornada() para que el panel y el
-- resultado congelado nunca difieran. No se expone a los clientes.
create or replace function public.cartones_ganadores(p_liga_id uuid, p_jornada integer)
returns table (carton_id uuid, usuario_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.usuario_id
  from public.cartones c
  where c.liga_id = p_liga_id
    and c.jornada = p_jornada
    and exists (
      select 1 from public.partidos p
      where p.liga_id = p_liga_id and p.jornada = p_jornada
    )
    and not exists (
      select 1 from public.partidos pa
      where pa.liga_id = c.liga_id
        and pa.jornada = c.jornada
        and not exists (
          select 1 from public.pronosticos pr
          where pr.carton_id = c.id
            and pr.partido_id = pa.id
            and pa.estado = 'finalizado'
            and pr.goles_local_prediccion = pa.goles_local
            and pr.goles_visitante_prediccion = pa.goles_visitante
        )
    );
$$;

revoke execute on function public.cartones_ganadores(uuid, integer) from public, anon, authenticated;

-- Pozo de una jornada: valores congelados si está liquidada, cálculo en vivo
-- si no. Solo agregados, sin datos personales. security definer porque RLS
-- impide leer los cartones ajenos.
create or replace function public.pozo_jornada(p_liga_id uuid, p_jornada integer)
returns table (
  recaudado numeric,
  cantidad_cartones integer,
  pozo_jornada numeric,
  pozo_acumulado_entrante numeric,
  pozo_total numeric,
  liquidada boolean,
  cantidad_ganadores integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_liq        public.liquidaciones_jornada;
  v_recaudado  numeric;
  v_cartones   integer;
  v_pct        numeric;
  v_pozo       numeric;
  v_entrante   numeric;
begin
  if auth.uid() is null then
    raise exception 'no_autenticado';
  end if;

  select * into v_liq
  from public.liquidaciones_jornada l
  where l.liga_id = p_liga_id and l.jornada = p_jornada;

  select count(*)::integer, coalesce(sum(c.monto), 0)
  into v_cartones, v_recaudado
  from public.cartones c
  where c.liga_id = p_liga_id and c.jornada = p_jornada;

  if v_liq.id is not null then
    return query select
      v_liq.recaudado::numeric,
      v_cartones,
      v_liq.pozo_jornada::numeric,
      v_liq.pozo_acumulado_entrante::numeric,
      v_liq.pozo_total::numeric,
      true,
      v_liq.cantidad_ganadores;
    return;
  end if;

  select li.porcentaje_pozo into v_pct from public.ligas li where li.id = p_liga_id;
  v_pozo := round(v_recaudado * coalesce(v_pct, 80) / 100, 2);

  select l.pozo_acumulado_saliente into v_entrante
  from public.liquidaciones_jornada l
  where l.liga_id = p_liga_id and l.jornada < p_jornada
  order by l.jornada desc
  limit 1;
  v_entrante := coalesce(v_entrante, 0);

  return query select
    v_recaudado,
    v_cartones,
    v_pozo,
    v_entrante,
    v_pozo + v_entrante,
    false,
    0;
end;
$$;

revoke execute on function public.pozo_jornada(uuid, integer) from public, anon;
grant execute on function public.pozo_jornada(uuid, integer) to authenticated;

-- Cartones que cumplen la regla de ganador hoy (solo admin).
create or replace function public.ganadores_provisorios(p_liga_id uuid, p_jornada integer)
returns table (carton_id uuid, usuario_id uuid, nombre text, email text)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'no_autorizado';
  end if;

  return query
  select g.carton_id, g.usuario_id, u.nombre::text, u.email::text
  from public.cartones_ganadores(p_liga_id, p_jornada) g
  join public.usuarios u on u.id = g.usuario_id
  order by u.email;
end;
$$;

revoke execute on function public.ganadores_provisorios(uuid, integer) from public, anon;
grant execute on function public.ganadores_provisorios(uuid, integer) to authenticated;

-- Liquida la jornada de forma atómica: congela recaudado, pozo, acumulado y
-- ganadores. Solo admin.
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

  return v_liq_id;
end;
$$;

revoke execute on function public.liquidar_jornada(uuid, integer) from public, anon;
grant execute on function public.liquidar_jornada(uuid, integer) to authenticated;

-- Revierte una liquidación mientras nadie haya sido avisado y no exista una
-- liquidación posterior. Solo admin.
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

  delete from public.ganadores_jornada where liquidacion_id = v_liq_id;
  delete from public.liquidaciones_jornada where id = v_liq_id;
end;
$$;

revoke execute on function public.deshacer_liquidacion(uuid, integer) from public, anon;
grant execute on function public.deshacer_liquidacion(uuid, integer) to authenticated;

-- Congela los partidos de jornadas liquidadas (goles, estado, alta y baja).
create or replace function public.bloquear_partido_jornada_liquidada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and exists (
    select 1 from public.liquidaciones_jornada l
    where l.liga_id = old.liga_id and l.jornada = old.jornada
  ) then
    raise exception 'jornada_liquidada';
  end if;

  if tg_op in ('INSERT', 'UPDATE') and exists (
    select 1 from public.liquidaciones_jornada l
    where l.liga_id = new.liga_id and l.jornada = new.jornada
  ) then
    raise exception 'jornada_liquidada';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger partidos_bloquear_jornada_liquidada
before insert or update or delete on public.partidos
for each row execute function public.bloquear_partido_jornada_liquidada();
