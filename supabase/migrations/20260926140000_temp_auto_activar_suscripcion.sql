-- ============================================================================
-- TEMPORAL — SOLO PARA TESTING, REVERTIR ANTES DE PRODUCCIÓN
-- ============================================================================
-- Mientras no haya integración real de pago (Mercado Pago) ni revisión manual
-- de comprobante por parte del admin, se permite que el propio usuario active
-- su membresía al elegir un plan (en vez de quedar "pendiente" esperando que
-- el admin la revise), para poder probar de punta a punta el flujo de
-- créditos/jornada activa/cartones sin depender de un paso manual.
--
-- Cuando se implemente la corroboración real (comprobante + admin, o pasarela
-- de pago), esta migración debe revertirse: volver a exigir
-- estado_suscripcion = 'pendiente' en el insert/update propio, igual que
-- estaba en 20260728225256_membresias_liga_init.sql y
-- 20260926120000_membresias_liga_plan_y_comprobante.sql.
-- ============================================================================

drop policy if exists "membresias_liga_insert_propia_pendiente" on public.membresias_liga;

create policy "membresias_liga_insert_propia_pendiente"
on public.membresias_liga for insert
to authenticated
with check (
  usuario_id = (select auth.uid())
  and estado_suscripcion in ('pendiente', 'activa') -- TEMPORAL: normalmente solo 'pendiente'
);

drop policy if exists "membresias_liga_update_propio_pendiente" on public.membresias_liga;

create policy "membresias_liga_update_propio_pendiente"
on public.membresias_liga for update
to authenticated
using ( usuario_id = (select auth.uid()) )
with check (
  usuario_id = (select auth.uid())
  and estado_suscripcion in ('pendiente', 'activa') -- TEMPORAL: normalmente solo 'pendiente'
);
