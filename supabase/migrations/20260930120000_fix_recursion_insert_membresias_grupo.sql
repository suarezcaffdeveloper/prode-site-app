-- Corrige "infinite recursion detected in policy for relation membresias_grupo"
-- al crear un subgrupo. Las policies de insert y delete de membresias_grupo
-- consultaban "grupos", cuya policy de select consulta a su vez
-- membresias_grupo: Postgres detecta el ciclo y rechaza el insert. La migración
-- 20260925150000 solo había resuelto el ciclo del select. Igual que
-- es_miembro_grupo(): una función security definer que bypassea RLS.
create or replace function public.es_creador_grupo(p_grupo_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.grupos
    where id = p_grupo_id and creador_id = (select auth.uid())
  );
$$;

grant execute on function public.es_creador_grupo(uuid) to authenticated;

drop policy if exists "membresias_grupo_insert_creador" on public.membresias_grupo;
create policy "membresias_grupo_insert_creador"
on public.membresias_grupo for insert
to authenticated
with check (
  usuario_id = (select auth.uid())
  and public.es_creador_grupo(grupo_id)
);

drop policy if exists "membresias_grupo_delete_creador" on public.membresias_grupo;
create policy "membresias_grupo_delete_creador"
on public.membresias_grupo for delete
to authenticated
using ( public.es_creador_grupo(grupo_id) );

-- Los subgrupos creados mientras el insert fallaba quedaron sin la membresía
-- del creador. Se repara con la fecha de creación del grupo como ingreso, para
-- que al creador le cuenten todas las fechas desde que el grupo existe.
insert into public.membresias_grupo (grupo_id, usuario_id, created_at)
select g.id, g.creador_id, g.created_at
from public.grupos g
on conflict (grupo_id, usuario_id) do nothing;
