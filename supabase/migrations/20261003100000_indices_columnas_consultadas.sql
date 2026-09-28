-- Postgres no indexa automáticamente las columnas FK: estas se consultan en
-- casi cada request (fixture, inicio, pronósticos, jornada_activa(),
-- sincronizar_avisos(), liquidación) y hoy hacen seq scan. Migración
-- puramente aditiva, no toca datos existentes.

create index if not exists partidos_liga_id_idx
  on public.partidos (liga_id);

create index if not exists grupos_liga_id_idx
  on public.grupos (liga_id);

create index if not exists cartones_liga_jornada_usuario_idx
  on public.cartones (liga_id, jornada, usuario_id);

create index if not exists creditos_lotes_usuario_liga_idx
  on public.creditos_lotes (usuario_id, liga_id);
