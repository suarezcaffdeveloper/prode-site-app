-- ============================================================================
-- Cierra la activación temporal de suscripciones (SPEC 11)
-- ============================================================================
-- Hasta ahora, cualquier usuario autenticado podía activarse una suscripción
-- sin pagar por tres vías, todas introducidas solo para poder probar el flujo
-- de créditos/pronósticos (ver 20260926140000_temp_auto_activar_suscripcion):
--
--   1. Llamar a la RPC activar_suscripcion_liga(), que activa la membresía y
--      otorga el lote de créditos del plan elegido.
--   2. Insertar su propia fila en membresias_liga con estado 'activa'.
--   3. Actualizar su propia fila de membresias_liga a 'activa'.
--
-- Desde acá la membresía solo pasa a 'activa' (y se otorgan créditos) por
-- otorgar_plan_admin() (admin) o por la aprobación de una solicitud de pago
-- (aprobar_solicitud_pago(), definida en 20261001110000). El usuario común ya
-- no escribe nunca en membresias_liga.
-- ============================================================================

-- 1. La RPC de autoactivación se elimina (no se limita: mientras exista y sea
--    invocable por 'authenticated', cualquiera puede saltearse el pago).
drop function if exists public.activar_suscripcion_liga(uuid, text, text);

-- 2 y 3. Se eliminan las policies de escritura propia (las dos permitían
--    'activa' por el cambio temporal).
drop policy if exists "membresias_liga_insert_propia_pendiente" on public.membresias_liga;
drop policy if exists "membresias_liga_update_propio_pendiente" on public.membresias_liga;

-- Sin privilegios de escritura para el usuario común: Postgres los evalúa
-- antes que RLS, así que es la defensa real. El admin sigue actualizando el
-- estado (policy membresias_liga_update_admin) con el grant de una sola columna.
revoke insert, update on public.membresias_liga from authenticated;
grant update (estado_suscripcion) on public.membresias_liga to authenticated;
