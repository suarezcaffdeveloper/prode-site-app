-- Perfil de usuario, vinculado 1 a 1 con auth.users
create table public.usuarios (
  id            uuid primary key references auth.users (id),
  email         text not null,
  nombre        text,
  rol           text not null default 'usuario' check (rol in ('admin', 'usuario')),
  created_at    timestamptz not null default now()
);

alter table public.usuarios enable row level security;

-- Helper reutilizado por el resto de las migraciones (ligas, membresias_liga,
-- grupos) para las policies que requieren rol admin. security definer porque
-- una policy en "usuarios" no puede hacer una subconsulta contra "usuarios"
-- sin RLS de por medio; esta funcion resuelve solo un boolean sobre el propio
-- auth.uid(), no expone datos.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.usuarios
    where id = (select auth.uid()) and rol = 'admin'
  );
$$;

create policy "usuarios_select_propio_o_admin"
on public.usuarios for select
to authenticated
using ( id = (select auth.uid()) or public.is_admin() );

-- Alta automatica de fila en "usuarios" al crearse un auth.users nuevo.
-- security definer: el trigger corre en el contexto de signup (sin sesion
-- autenticada todavia), por lo que necesita saltear RLS para insertar.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usuarios (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
