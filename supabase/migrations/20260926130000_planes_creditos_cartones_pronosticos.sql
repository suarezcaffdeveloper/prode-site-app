-- Implementa juntas SPEC 04 (catálogo de planes + ledger de créditos) y
-- SPEC 05 (jornada activa + cartones/pronósticos): están acopladas, créditos
-- sin consumo no sirven y el consumo no existe sin créditos que otorgar.

-- ===== SPEC 04: catálogo de planes y ledger de créditos =====

create table public.planes (
  id                  uuid primary key default gen_random_uuid(),
  nombre              text not null,
  tipo                text not null check (tipo in ('unico', 'mensual')),
  cantidad_creditos   integer not null check (cantidad_creditos > 0),
  precio              numeric(10, 2) not null check (precio >= 0),
  activo              boolean not null default true,
  -- Vínculo informativo (no FK) con los slugs hardcodeados en
  -- src/lib/planes.ts y con membresias_liga.plan_elegido (SPEC 06): solo
  -- sirve para preseleccionar en el admin el plan que el usuario dijo que
  -- quería. Nullable porque un plan nuevo del catálogo real no necesita
  -- tener un slug de marketing asociado.
  slug                text unique,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.planes enable row level security;

create policy "planes_select_autenticado"
on public.planes for select
to authenticated
using ( true );

create policy "planes_insert_admin"
on public.planes for insert
to authenticated
with check ( public.is_admin() );

create policy "planes_update_admin"
on public.planes for update
to authenticated
using ( public.is_admin() )
with check ( public.is_admin() );

create trigger planes_set_updated_at
before update on public.planes
for each row execute function public.set_updated_at();

grant select, insert, update on public.planes to authenticated;

-- Ledger de créditos otorgados: cada fila es un lote que un usuario recibió
-- en una liga a partir de un plan. Se usa un ledger de lotes en vez de un
-- contador simple para poder distinguir créditos que vencen (suscripción)
-- de créditos que no vencen (compra suelta) dentro del mismo saldo.
create table public.creditos_lotes (
  id                  uuid primary key default gen_random_uuid(),
  usuario_id          uuid not null references public.usuarios (id),
  liga_id             uuid not null references public.ligas (id),
  plan_id             uuid not null references public.planes (id),
  cantidad_total      integer not null check (cantidad_total > 0),
  cantidad_usada      integer not null default 0 check (cantidad_usada >= 0),
  expira_en           timestamptz,
  created_at          timestamptz not null default now(),
  check (cantidad_usada <= cantidad_total)
);

alter table public.creditos_lotes enable row level security;

create policy "creditos_lotes_select_propio_o_admin"
on public.creditos_lotes for select
to authenticated
using ( usuario_id = (select auth.uid()) or public.is_admin() );

-- El otorgamiento es exclusivo del admin: el usuario nunca crea su propio
-- lote de créditos (no hay pasarela de pago todavía).
create policy "creditos_lotes_insert_admin"
on public.creditos_lotes for insert
to authenticated
with check ( public.is_admin() );

grant select, insert on public.creditos_lotes to authenticated;
-- Sin grant de update/delete: el único update de cantidad_usada lo hace
-- consumir_credito() como dueño de la función (security definer corre con
-- los privilegios del owner, no del rol "authenticated" que la invoca).

-- ===== SPEC 05: jornada activa, cartones y pronósticos =====

-- Un cartón = un conjunto completo de predicciones de un usuario para una
-- jornada de una liga. Un mismo usuario puede tener varios cartones
-- distintos en la misma jornada (uno por cada crédito que gaste).
create table public.cartones (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references public.usuarios (id),
  liga_id     uuid not null references public.ligas (id),
  jornada     integer not null,
  lote_id     uuid not null references public.creditos_lotes (id),
  created_at  timestamptz not null default now()
);

alter table public.cartones enable row level security;

create policy "cartones_select_propio_o_admin"
on public.cartones for select
to authenticated
using ( usuario_id = (select auth.uid()) or public.is_admin() );

grant select on public.cartones to authenticated;
-- Sin insert/update: un cartón se crea exclusivamente vía crear_carton()
-- (security definer), nunca con un insert directo desde el cliente. Esto es
-- más fuerte que resolverlo solo con RLS: una llamada directa a la API de
-- Supabase falla en la capa de privilegios de Postgres, antes de que exista
-- siquiera una policy que evaluar.

-- Predicción de un partido puntual dentro de un cartón.
create table public.pronosticos (
  id                          uuid primary key default gen_random_uuid(),
  carton_id                   uuid not null references public.cartones (id),
  partido_id                  uuid not null references public.partidos (id),
  goles_local_prediccion      integer not null check (goles_local_prediccion >= 0),
  goles_visitante_prediccion  integer not null check (goles_visitante_prediccion >= 0),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (carton_id, partido_id)
);

alter table public.pronosticos enable row level security;

create policy "pronosticos_select_propio_o_admin"
on public.pronosticos for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.cartones c
    where c.id = carton_id and c.usuario_id = (select auth.uid())
  )
);

create trigger pronosticos_set_updated_at
before update on public.pronosticos
for each row execute function public.set_updated_at();

grant select on public.pronosticos to authenticated;
-- Sin insert/update: se escriben exclusivamente vía crear_carton()/
-- actualizar_carton(), mismo razonamiento que en "cartones".

-- Jornada activa de una liga: la de menor número cuyo cierre (30 min antes
-- del primer partido) todavía no pasó. Si esa jornada tiene algún partido
-- sin fecha_hora, se devuelve igual (jornada y hora_cierre = null) para que
-- crear_carton()/actualizar_carton() bloqueen la carga en vez de saltar a
-- una jornada posterior, preservando el orden estricto de juego.
create or replace function public.jornada_activa(p_liga_id uuid)
returns table (jornada integer, hora_cierre timestamptz)
language sql
stable
as $$
  with por_jornada as (
    select
      p.jornada,
      case
        when bool_and(p.fecha_hora is not null)
          then min(p.fecha_hora) - interval '30 minutes'
        else null
      end as hora_cierre
    from public.partidos p
    where p.liga_id = p_liga_id
    group by p.jornada
  )
  select jornada, hora_cierre
  from por_jornada
  where hora_cierre is null or hora_cierre > now()
  order by jornada asc
  limit 1;
$$;

-- Descuenta 1 crédito del lote más próximo a vencer (los que no vencen se
-- usan al final) y devuelve el id del lote usado. "for update skip locked"
-- evita que dos consumos simultáneos gasten el mismo último crédito dos
-- veces.
create or replace function public.consumir_credito(p_usuario_id uuid, p_liga_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lote_id uuid;
begin
  select id into v_lote_id
  from public.creditos_lotes
  where usuario_id = p_usuario_id
    and liga_id = p_liga_id
    and cantidad_usada < cantidad_total
    and (expira_en is null or expira_en > now())
  order by expira_en asc nulls last
  for update skip locked
  limit 1;

  if v_lote_id is null then
    raise exception 'sin_creditos_disponibles';
  end if;

  update public.creditos_lotes
  set cantidad_usada = cantidad_usada + 1
  where id = v_lote_id;

  return v_lote_id;
end;
$$;

-- Crea un cartón completo de forma atómica: valida la jornada activa,
-- consume el crédito e inserta el cartón + sus pronósticos, todo dentro del
-- mismo bloque plpgsql (transacción implícita). supabase-js no soporta
-- transacciones multi-statement desde un server action, así que envolver
-- todo en una única función es lo que evita dejar un crédito consumido sin
-- cartón creado si algo falla a mitad de camino.
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

  -- Cuenta cuántas predicciones recibidas corresponden a un partido real de
  -- esta jornada; comparado contra el total de partidos y contra el largo
  -- del array, bloquea tanto "faltan partidos" como "partido repetido o
  -- ajeno a esta jornada" en una sola validación.
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

  insert into public.cartones (usuario_id, liga_id, jornada, lote_id)
  values (v_usuario_id, p_liga_id, p_jornada, v_lote_id)
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

-- Simétrica a crear_carton(): mismo problema de atomicidad (actualizar N
-- filas de pronosticos debe ser todo o nada) y misma validación de cierre
-- en el instante de la escritura, no en el momento de renderizar el form.
create or replace function public.actualizar_carton(
  p_carton_id uuid,
  p_predicciones jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id      uuid := auth.uid();
  v_carton          record;
  v_activa          record;
  v_total_partidos  integer;
  v_validas         integer;
begin
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

  select count(*) into v_total_partidos
  from public.partidos
  where liga_id = v_carton.liga_id and jornada = v_carton.jornada;

  select count(distinct pred->>'partido_id') into v_validas
  from jsonb_array_elements(p_predicciones) pred
  join public.partidos p
    on p.id = (pred->>'partido_id')::uuid
   and p.liga_id = v_carton.liga_id
   and p.jornada = v_carton.jornada;

  if v_validas <> v_total_partidos or jsonb_array_length(p_predicciones) <> v_total_partidos then
    raise exception 'predicciones_incompletas';
  end if;

  update public.pronosticos pr
  set goles_local_prediccion = (pred->>'goles_local')::integer,
      goles_visitante_prediccion = (pred->>'goles_visitante')::integer
  from jsonb_array_elements(p_predicciones) pred
  where pr.carton_id = p_carton_id
    and pr.partido_id = (pred->>'partido_id')::uuid;
end;
$$;

-- Seed de los 3 planes ya hardcodeados en src/lib/planes.ts (SPEC 06).
-- Idempotente: una segunda corrida no duplica filas.
insert into public.planes (nombre, tipo, cantidad_creditos, precio, slug) values
  ('1 prode', 'unico', 1, 1500, 'suelto'),
  ('4 prodes por mes', 'mensual', 4, 5000, 'mensual_4'),
  ('10 prodes por mes', 'mensual', 10, 11000, 'mensual_10')
on conflict (slug) do nothing;
