-- Publica las notificaciones en Realtime para que la campanita se actualice al
-- instante. Realtime respeta RLS: cada usuario solo recibe las suyas.
alter publication supabase_realtime add table public.notificaciones;
