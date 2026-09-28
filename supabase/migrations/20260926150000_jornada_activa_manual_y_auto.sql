-- Reemplaza el cálculo puramente por horario de jornada_activa() (SPEC 05)
-- por un estado persistido en ligas.jornada_activa: el admin puede activar
-- una jornada puntual a mano, o se activa sola cuando se completan todos los
-- resultados de la jornada activa anterior. El cierre por horario (30 min
-- antes del primer partido) se mantiene: sigue siendo condición necesaria
-- para poder cargar/editar cartones, además de que la jornada esté marcada
-- como activa.

alter table public.ligas add column jornada_activa integer;

-- Backfill: preserva la jornada que hoy computaría el jornada_activa() viejo
-- (la de menor número cuyo cierre no pasó), para no romper ligas que ya
-- tienen fixture y cartones cargados en curso.
with candidatos as (
  select
    p.liga_id,
    p.jornada,
    case
      when bool_and(p.fecha_hora is not null) then min(p.fecha_hora) - interval '30 minutes'
      else null
    end as hora_cierre
  from public.partidos p
  group by p.liga_id, p.jornada
),
activa as (
  select distinct on (liga_id) liga_id, jornada
  from candidatos
  where hora_cierre is null or hora_cierre > now()
  order by liga_id, jornada asc
)
update public.ligas l
set jornada_activa = a.jornada
from activa a
where l.id = a.liga_id;

-- jornada_activa(liga_id) mantiene la misma firma que ya consumen
-- crear_carton()/actualizar_carton() y las páginas de usuario (vía RPC): solo
-- cambia de dónde saca qué jornada es "la" activa. El hora_cierre se sigue
-- calculando igual (null si falta algún fecha_hora de esa jornada puntual),
-- así que crear_carton() sigue bloqueando por "jornada_bloqueada" cuando el
-- admin activó una jornada con el fixture incompleto.
create or replace function public.jornada_activa(p_liga_id uuid)
returns table (jornada integer, hora_cierre timestamptz)
language sql
stable
as $$
  select
    l.jornada_activa as jornada,
    case
      when bool_and(p.fecha_hora is not null) then min(p.fecha_hora) - interval '30 minutes'
      else null
    end as hora_cierre
  from public.ligas l
  join public.partidos p
    on p.liga_id = l.id and p.jornada = l.jornada_activa
  where l.id = p_liga_id
    and l.jornada_activa is not null
  group by l.jornada_activa;
$$;

-- Auto-avance: cuando un partido pasa a 'finalizado' y con ese cambio quedan
-- todos los partidos de la jornada actualmente activa de su liga en
-- 'finalizado', activa automáticamente la siguiente jornada con partidos
-- cargados (si existe). No valida que la siguiente jornada tenga horarios
-- completos: si le faltan, jornada_activa() ya la devuelve con
-- hora_cierre = null y crear_carton()/actualizar_carton() la bloquean igual.
create or replace function public.avanzar_jornada_activa()
returns trigger
language plpgsql
as $$
declare
  v_jornada_activa integer;
  v_pendientes      integer;
  v_siguiente       integer;
begin
  select jornada_activa into v_jornada_activa
  from public.ligas
  where id = new.liga_id;

  if v_jornada_activa is null or new.jornada <> v_jornada_activa then
    return new;
  end if;

  select count(*) into v_pendientes
  from public.partidos
  where liga_id = new.liga_id
    and jornada = v_jornada_activa
    and estado <> 'finalizado';

  if v_pendientes > 0 then
    return new;
  end if;

  select min(jornada) into v_siguiente
  from public.partidos
  where liga_id = new.liga_id
    and jornada > v_jornada_activa;

  if v_siguiente is not null then
    update public.ligas set jornada_activa = v_siguiente where id = new.liga_id;
  end if;

  return new;
end;
$$;

create trigger partidos_avanzar_jornada_activa
after update on public.partidos
for each row
when (new.estado = 'finalizado' and old.estado is distinct from new.estado)
execute function public.avanzar_jornada_activa();
