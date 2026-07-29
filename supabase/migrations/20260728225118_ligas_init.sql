-- Catálogo de ligas de fútbol, administrado por admin
create table public.ligas (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  descripcion   text,
  activa        boolean not null default true,
  created_at    timestamptz not null default now()
);

alter table public.ligas enable row level security;

-- Cualquier usuario autenticado ve las ligas activas; el admin las ve todas
-- (incluidas las inactivas) porque necesita administrarlas desde su panel.
create policy "ligas_select_activas_o_admin"
on public.ligas for select
to authenticated
using ( activa = true or public.is_admin() );

create policy "ligas_insert_admin"
on public.ligas for insert
to authenticated
with check ( public.is_admin() );

create policy "ligas_update_admin"
on public.ligas for update
to authenticated
using ( public.is_admin() )
with check ( public.is_admin() );
