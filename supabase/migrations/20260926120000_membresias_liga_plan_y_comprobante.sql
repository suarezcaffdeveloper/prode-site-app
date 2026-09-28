-- Agrega el plan elegido y el comprobante de pago a una membresía, para el
-- flujo visual de "elegir plan -> transferir -> subir comprobante" (SPEC 06).
-- No son las tablas reales de SPEC 04 (planes, creditos_lotes): plan_elegido
-- es solo lo que el usuario dijo que quiso, informativo para que el admin lo
-- revise a mano antes de activar la suscripción.
alter table public.membresias_liga
  add column plan_elegido text
    check (plan_elegido is null or plan_elegido in ('suelto', 'mensual_4', 'mensual_10')),
  add column comprobante_path text;

-- El grant anterior (20260925150000) daba UPDATE de tabla completa a
-- authenticated. Lo acotamos a las columnas que un usuario puede tocar de su
-- propia fila: ni RLS ni la app necesitan proteger liga_id/usuario_id/
-- created_at si Postgres ya rechaza el UPDATE a nivel de privilegio de
-- columna antes de evaluar cualquier policy.
revoke update on public.membresias_liga from authenticated;
grant update (estado_suscripcion, plan_elegido, comprobante_path)
  on public.membresias_liga to authenticated;

-- Permite que el propio usuario reenvíe plan/comprobante (por ejemplo si
-- estaba "inactiva") sin poder auto-promoverse a "activa": el with check
-- fuerza que la fila resultante quede en "pendiente". Coexiste con
-- membresias_liga_update_admin (policies permisivas del mismo comando se
-- combinan con OR), que sigue permitiendo al admin poner "activa"/"inactiva".
create policy "membresias_liga_update_propio_pendiente"
on public.membresias_liga for update
to authenticated
using ( usuario_id = (select auth.uid()) )
with check ( usuario_id = (select auth.uid()) and estado_suscripcion = 'pendiente' );

-- Bucket privado para comprobantes de pago (a diferencia de "escudos", que es
-- público): se guarda el path, no una URL pública, y se accede vía signed URL
-- generado server-side por el admin (o por el propio usuario a futuro).
insert into storage.buckets (id, name, public)
values ('comprobantes', 'comprobantes', false)
on conflict (id) do nothing;

-- El primer segmento del path debe ser el usuario_id de quien sube (ver
-- convención de path en la action `elegirPlan`), así la policy puede
-- verificarlo sin necesidad de una tabla intermedia.
create policy "comprobantes_insert_propio"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'comprobantes'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "comprobantes_select_propio_o_admin"
on storage.objects for select
to authenticated
using (
  bucket_id = 'comprobantes'
  and ( (storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin() )
);
