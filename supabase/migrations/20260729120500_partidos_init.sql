-- Partido dentro de una liga
create table public.partidos (
  id                  uuid primary key default gen_random_uuid(),
  liga_id             uuid not null references public.ligas (id),
  jornada             integer not null,
  equipo_local_id     uuid not null references public.equipos (id),
  equipo_visitante_id uuid not null references public.equipos (id),
  fecha_hora          timestamptz,
  goles_local         integer,
  goles_visitante     integer,
  estado              text not null default 'pendiente'
                      check (estado in ('pendiente', 'finalizado')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (equipo_local_id <> equipo_visitante_id)
);

alter table public.partidos enable row level security;

-- Cualquier autenticado ve el fixture completo de cualquier liga (es
-- información pública del torneo); solo admin administra el CRUD.
create policy "partidos_select_autenticado"
on public.partidos for select
to authenticated
using ( true );

create policy "partidos_insert_admin"
on public.partidos for insert
to authenticated
with check ( public.is_admin() );

create policy "partidos_update_admin"
on public.partidos for update
to authenticated
using ( public.is_admin() )
with check ( public.is_admin() );

create policy "partidos_delete_admin"
on public.partidos for delete
to authenticated
using ( public.is_admin() );

-- Reutiliza la función set_updated_at() creada en la migración de
-- membresias_liga (SPEC 01).
create trigger partidos_set_updated_at
before update on public.partidos
for each row execute function public.set_updated_at();
