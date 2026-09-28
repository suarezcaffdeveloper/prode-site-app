-- SPEC 10 — Subgrupos: cartón que compite y funciones de lectura para el ranking.
-- No agrega tablas: una columna, un trigger, un helper y tres funciones.

-- Cartón que compite en los subgrupos (uno por usuario/liga/jornada).
alter table public.cartones
  add column es_principal boolean not null default false;

create unique index cartones_un_principal_por_jornada
on public.cartones (usuario_id, liga_id, jornada)
where es_principal;

-- Backfill: el cartón más antiguo de cada (usuario, liga, jornada) compite.
update public.cartones c
set es_principal = true
from (
  select distinct on (usuario_id, liga_id, jornada) id
  from public.cartones
  order by usuario_id, liga_id, jornada, created_at asc, id asc
) primero
where c.id = primero.id;

-- Un cartón nuevo nace como principal si es el primero del usuario en esa
-- (liga, jornada). Se hace con trigger para no redefinir crear_carton() por
-- cuarta vez. El advisory lock evita que dos altas simultáneas queden ambas
-- como principal (el índice único parcial rechazaría la segunda).
create or replace function public.cartones_marcar_principal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(
    hashtext(new.usuario_id::text || new.liga_id::text || new.jornada::text)
  );

  if not exists (
    select 1 from public.cartones c
    where c.usuario_id = new.usuario_id
      and c.liga_id = new.liga_id
      and c.jornada = new.jornada
  ) then
    new.es_principal := true;
  end if;

  return new;
end;
$$;

create trigger cartones_marcar_principal
before insert on public.cartones
for each row execute function public.cartones_marcar_principal();

-- Hora de cierre de una jornada cualquiera: 30 minutos antes del primer
-- partido, o null si a algún partido le falta fecha_hora (o no hay partidos).
-- Misma fórmula que jornada_activa(), que la calcula inline solo para la
-- jornada activa.
create or replace function public.hora_cierre_jornada(p_liga_id uuid, p_jornada integer)
returns timestamptz
language sql
stable
as $$
  select case
    when bool_and(p.fecha_hora is not null) then min(p.fecha_hora) - interval '30 minutes'
    else null
  end
  from public.partidos p
  where p.liga_id = p_liga_id and p.jornada = p_jornada
  having count(*) > 0;
$$;

-- Elegir cuál de sus cartones compite en los subgrupos. Mismo criterio de
-- "jornada abierta" que actualizar_carton(): la jornada del cartón debe ser la
-- activa y no haber cerrado. Errores: no_autenticado | carton_no_encontrado |
-- jornada_cerrada. Los usuarios no tienen grant de update sobre cartones: el
-- flag solo cambia por esta función y por el trigger de alta.
create or replace function public.elegir_carton_principal(p_carton_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_carton     record;
  v_activa     record;
begin
  if v_usuario_id is null then
    raise exception 'no_autenticado';
  end if;

  select * into v_carton from public.cartones where id = p_carton_id;
  if not found or v_carton.usuario_id <> v_usuario_id then
    raise exception 'carton_no_encontrado';
  end if;

  select * into v_activa from public.jornada_activa(v_carton.liga_id);
  if not found
     or v_activa.jornada <> v_carton.jornada
     or v_activa.hora_cierre is null
     or v_activa.hora_cierre <= now() then
    raise exception 'jornada_cerrada';
  end if;

  perform pg_advisory_xact_lock(
    hashtext(v_carton.usuario_id::text || v_carton.liga_id::text || v_carton.jornada::text)
  );

  -- Primero se baja el anterior: el índice único parcial no admite dos a la vez.
  update public.cartones
  set es_principal = false
  where usuario_id = v_carton.usuario_id
    and liga_id = v_carton.liga_id
    and jornada = v_carton.jornada
    and es_principal
    and id <> p_carton_id;

  update public.cartones
  set es_principal = true
  where id = p_carton_id;
end;
$$;

-- Miembros del subgrupo con nombre y estado. Solo para miembros del grupo.
-- "usuarios" tiene RLS "propio o admin", así que un join directo no devuelve a
-- los demás miembros. Como usuarios.nombre no se completa en el alta, el nombre
-- cae a full_name/name del proveedor de login y, en última instancia, a la
-- parte local del email (nunca el email completo).
create or replace function public.miembros_grupo(p_grupo_id uuid)
returns table (
  usuario_id uuid,
  membresia_id uuid,
  nombre text,
  unido_en timestamptz,
  es_creador boolean,
  suscripcion_activa boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.es_miembro_grupo(p_grupo_id) then
    raise exception 'no_autorizado';
  end if;

  return query
  select
    mg.usuario_id,
    mg.id,
    coalesce(
      nullif(btrim(u.nombre), ''),
      nullif(btrim(au.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(au.raw_user_meta_data ->> 'name'), ''),
      split_part(u.email, '@', 1)
    ),
    mg.created_at,
    (g.creador_id = mg.usuario_id),
    exists (
      select 1 from public.membresias_liga ml
      where ml.liga_id = g.liga_id
        and ml.usuario_id = mg.usuario_id
        and ml.estado_suscripcion = 'activa'
    )
  from public.membresias_grupo mg
  join public.grupos g on g.id = mg.grupo_id
  join public.usuarios u on u.id = mg.usuario_id
  left join auth.users au on au.id = mg.usuario_id
  where mg.grupo_id = p_grupo_id
  order by mg.created_at asc, mg.id asc;
end;
$$;

-- Pronósticos del cartón que compite de cada miembro, solo de jornadas ya
-- cerradas y cuyo cierre es posterior al ingreso del miembro. Solo para
-- miembros del grupo. Nunca devuelve cartones que no compiten, jornadas
-- abiertas ni datos personales. El resultado real sale de "partidos" (legible
-- por cualquier autenticado), así el puntaje se calcula en un único lugar (TS).
create or replace function public.pronosticos_grupo(p_grupo_id uuid)
returns table (
  usuario_id uuid,
  jornada integer,
  carton_id uuid,
  partido_id uuid,
  goles_local_prediccion integer,
  goles_visitante_prediccion integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_liga_id uuid;
begin
  if not public.es_miembro_grupo(p_grupo_id) then
    raise exception 'no_autorizado';
  end if;

  select g.liga_id into v_liga_id from public.grupos g where g.id = p_grupo_id;

  return query
  select
    c.usuario_id,
    c.jornada,
    c.id,
    pr.partido_id,
    pr.goles_local_prediccion,
    pr.goles_visitante_prediccion
  from public.membresias_grupo mg
  join public.cartones c
    on c.usuario_id = mg.usuario_id
   and c.liga_id = v_liga_id
   and c.es_principal
  join public.pronosticos pr on pr.carton_id = c.id
  where mg.grupo_id = p_grupo_id
    and public.hora_cierre_jornada(c.liga_id, c.jornada) <= now()
    and public.hora_cierre_jornada(c.liga_id, c.jornada) >= mg.created_at;
end;
$$;

grant execute on function public.elegir_carton_principal(uuid) to authenticated;
grant execute on function public.miembros_grupo(uuid) to authenticated;
grant execute on function public.pronosticos_grupo(uuid) to authenticated;
