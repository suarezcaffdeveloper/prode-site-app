-- Catálogo de equipos de una liga
create table public.equipos (
  id            uuid primary key default gen_random_uuid(),
  liga_id       uuid not null references public.ligas (id),
  nombre        text not null,
  escudo_url    text,
  created_at    timestamptz not null default now()
);

alter table public.equipos enable row level security;

-- Cualquier autenticado puede ver el catálogo de equipos de cualquier liga
-- (necesario para armar el fixture público); solo admin administra el CRUD.
create policy "equipos_select_autenticado"
on public.equipos for select
to authenticated
using ( true );

create policy "equipos_insert_admin"
on public.equipos for insert
to authenticated
with check ( public.is_admin() );

create policy "equipos_update_admin"
on public.equipos for update
to authenticated
using ( public.is_admin() )
with check ( public.is_admin() );

create policy "equipos_delete_admin"
on public.equipos for delete
to authenticated
using ( public.is_admin() );

-- Bucket de Storage para escudos: público en lectura, solo admin sube/borra.
insert into storage.buckets (id, name, public)
values ('escudos', 'escudos', true)
on conflict (id) do nothing;

create policy "escudos_select_publico"
on storage.objects for select
to public
using ( bucket_id = 'escudos' );

create policy "escudos_insert_admin"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'escudos' and public.is_admin() );

create policy "escudos_update_admin"
on storage.objects for update
to authenticated
using ( bucket_id = 'escudos' and public.is_admin() )
with check ( bucket_id = 'escudos' and public.is_admin() );

create policy "escudos_delete_admin"
on storage.objects for delete
to authenticated
using ( bucket_id = 'escudos' and public.is_admin() );
