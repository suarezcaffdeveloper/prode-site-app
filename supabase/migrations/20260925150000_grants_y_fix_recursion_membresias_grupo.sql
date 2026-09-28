-- Grants explícitos: "auto_expose_new_tables" pasó a false por defecto en
-- las versiones nuevas de supabase-cli/postgres. Crear una tabla en public y
-- activar RLS ya no alcanza para que las policies se evalúen: Postgres
-- primero exige el privilegio de tabla (GRANT) al rol, y recién después
-- entra en juego RLS. Sin este grant, toda query devuelve "permission
-- denied" aunque la policy correspondiente la permitiría.
grant usage on schema public to authenticated;

grant select on public.usuarios to authenticated;
grant select, insert, update on public.ligas to authenticated;
grant select, insert, update on public.membresias_liga to authenticated;
grant select, insert, update, delete on public.grupos to authenticated;
grant select, insert, delete on public.membresias_grupo to authenticated;
grant select, insert, update, delete on public.equipos to authenticated;
grant select, insert, update, delete on public.partidos to authenticated;

-- Corrige recursión infinita: la policy de select de membresias_grupo
-- consultaba la propia tabla membresias_grupo dentro de un exists(), lo que
-- dispara la misma policy de nuevo en loop infinito (42P17). Se resuelve
-- igual que is_admin(): una función security definer que bypassea RLS.
create or replace function public.es_miembro_grupo(p_grupo_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.membresias_grupo
    where grupo_id = p_grupo_id and usuario_id = (select auth.uid())
  );
$$;

drop policy if exists "membresias_grupo_select_miembros" on public.membresias_grupo;

create policy "membresias_grupo_select_miembros"
on public.membresias_grupo for select
to authenticated
using (
  usuario_id = (select auth.uid())
  or public.es_miembro_grupo(grupo_id)
  or public.is_admin()
);
