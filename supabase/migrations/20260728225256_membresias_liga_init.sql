-- Suscripción de un usuario a una liga (1 fila por usuario x liga)
create table public.membresias_liga (
  id                  uuid primary key default gen_random_uuid(),
  usuario_id          uuid not null references public.usuarios (id),
  liga_id             uuid not null references public.ligas (id),
  estado_suscripcion  text not null default 'pendiente'
                      check (estado_suscripcion in ('pendiente', 'activa', 'inactiva')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (usuario_id, liga_id)
);

alter table public.membresias_liga enable row level security;

create policy "membresias_liga_select_propia_o_admin"
on public.membresias_liga for select
to authenticated
using ( usuario_id = (select auth.uid()) or public.is_admin() );

-- El usuario solo puede crear su propia solicitud, y siempre arranca en
-- "pendiente": el cambio a "activa"/"inactiva" es exclusivo del admin
-- (policy de update de abajo), nunca del propio usuario.
create policy "membresias_liga_insert_propia_pendiente"
on public.membresias_liga for insert
to authenticated
with check (
  usuario_id = (select auth.uid())
  and estado_suscripcion = 'pendiente'
);

create policy "membresias_liga_update_admin"
on public.membresias_liga for update
to authenticated
using ( public.is_admin() )
with check ( public.is_admin() );

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger membresias_liga_set_updated_at
before update on public.membresias_liga
for each row execute function public.set_updated_at();
