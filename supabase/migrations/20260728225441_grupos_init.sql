-- Subgrupo privado dentro de una liga
create table public.grupos (
  id                 uuid primary key default gen_random_uuid(),
  liga_id            uuid not null references public.ligas (id),
  nombre             text not null,
  creador_id         uuid not null references public.usuarios (id),
  codigo_invitacion  text not null unique,
  created_at         timestamptz not null default now()
);

-- Membresía a un subgrupo (1 fila por usuario x grupo). on delete cascade
-- para que "eliminar el grupo" (criterio de aceptación) no choque con la FK.
create table public.membresias_grupo (
  id           uuid primary key default gen_random_uuid(),
  grupo_id     uuid not null references public.grupos (id) on delete cascade,
  usuario_id   uuid not null references public.usuarios (id),
  created_at   timestamptz not null default now(),
  unique (grupo_id, usuario_id)
);

alter table public.grupos enable row level security;
alter table public.membresias_grupo enable row level security;

-- grupos: visible para quien lo creó, para sus miembros, o para el admin.
create policy "grupos_select_miembro_o_admin"
on public.grupos for select
to authenticated
using (
  creador_id = (select auth.uid())
  or exists (
    select 1 from public.membresias_grupo mg
    where mg.grupo_id = grupos.id and mg.usuario_id = (select auth.uid())
  )
  or public.is_admin()
);

-- Solo puede crear un subgrupo quien tenga suscripción "activa" a esa liga,
-- y siempre como su propio creador (no en nombre de otro usuario).
create policy "grupos_insert_con_suscripcion_activa"
on public.grupos for insert
to authenticated
with check (
  creador_id = (select auth.uid())
  and exists (
    select 1 from public.membresias_liga ml
    where ml.liga_id = grupos.liga_id
      and ml.usuario_id = (select auth.uid())
      and ml.estado_suscripcion = 'activa'
  )
);

-- Renombrar el grupo: solo el creador.
create policy "grupos_update_creador"
on public.grupos for update
to authenticated
using ( creador_id = (select auth.uid()) )
with check ( creador_id = (select auth.uid()) );

-- Eliminar el grupo: solo el creador.
create policy "grupos_delete_creador"
on public.grupos for delete
to authenticated
using ( creador_id = (select auth.uid()) );

-- membresias_grupo: cualquier miembro del grupo puede ver la lista completa
-- de miembros (para la vista de "quién está en el subgrupo").
create policy "membresias_grupo_select_miembros"
on public.membresias_grupo for select
to authenticated
using (
  usuario_id = (select auth.uid())
  or exists (
    select 1 from public.membresias_grupo mg2
    where mg2.grupo_id = membresias_grupo.grupo_id
      and mg2.usuario_id = (select auth.uid())
  )
  or public.is_admin()
);

-- Alta directa por RLS: solo el creador insertando su propia membresía justo
-- al crear el grupo. Unirse con código pasa por la función security definer
-- de abajo, que valida el código y la suscripción antes de insertar.
create policy "membresias_grupo_insert_creador"
on public.membresias_grupo for insert
to authenticated
with check (
  usuario_id = (select auth.uid())
  and exists (
    select 1 from public.grupos g
    where g.id = membresias_grupo.grupo_id and g.creador_id = (select auth.uid())
  )
);

-- Echar miembros: solo el creador del grupo.
create policy "membresias_grupo_delete_creador"
on public.membresias_grupo for delete
to authenticated
using (
  exists (
    select 1 from public.grupos g
    where g.id = membresias_grupo.grupo_id and g.creador_id = (select auth.uid())
  )
);

-- Unirse a un grupo por código: valida el código y que el usuario tenga
-- suscripción activa a la liga del grupo, todo en una sola operación atómica
-- que no depende de exponer "grupos" por código vía una policy de select
-- (evita que cualquier autenticado pueda enumerar códigos ajenos).
create or replace function public.unirse_a_grupo(p_codigo text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grupo_id uuid;
  v_liga_id uuid;
  v_estado text;
begin
  select id, liga_id into v_grupo_id, v_liga_id
  from public.grupos
  where codigo_invitacion = upper(p_codigo);

  if v_grupo_id is null then
    raise exception 'codigo_invalido';
  end if;

  select estado_suscripcion into v_estado
  from public.membresias_liga
  where usuario_id = auth.uid() and liga_id = v_liga_id;

  if v_estado is distinct from 'activa' then
    raise exception 'suscripcion_no_activa';
  end if;

  insert into public.membresias_grupo (grupo_id, usuario_id)
  values (v_grupo_id, auth.uid())
  on conflict (grupo_id, usuario_id) do nothing;

  return v_grupo_id;
end;
$$;
