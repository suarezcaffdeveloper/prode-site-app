-- Normaliza el par de equipos de cada partido (sin importar quién es local
-- o visitante) para poder aplicar un UNIQUE constraint real que impida que
-- el mismo cruce se repita dos veces en la misma liga (SPEC 03).
alter table public.partidos
  add column equipo_menor_id uuid generated always as (least(equipo_local_id, equipo_visitante_id)) stored,
  add column equipo_mayor_id uuid generated always as (greatest(equipo_local_id, equipo_visitante_id)) stored;

alter table public.partidos
  add constraint partidos_cruce_unico_por_liga
  unique (liga_id, equipo_menor_id, equipo_mayor_id);
