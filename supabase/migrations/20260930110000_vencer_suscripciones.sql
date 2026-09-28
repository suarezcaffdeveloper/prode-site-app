-- Una suscripción "activa" pasa sola a "inactiva" cuando vence el último lote
-- de créditos del usuario en esa liga. Quedarse sin saldo NO la desactiva:
-- mientras haya un lote vigente (expira_en null o futuro) sigue activa y el
-- usuario puede comprar más prodes; cada compra agrega un lote nuevo con su
-- propio vencimiento a 30 días corridos.
--
-- No hay pg_cron: la app la llama de forma perezosa antes de leer la
-- membresía (mismo patrón que sincronizar_avisos). Solo toca las membresías
-- de auth.uid(). Una membresía sin ningún lote nunca se desactiva acá.
create or replace function public.vencer_suscripciones(p_liga_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid := auth.uid();
begin
  if v_usuario is null then
    return;
  end if;

  update public.membresias_liga m
  set estado_suscripcion = 'inactiva'
  where m.usuario_id = v_usuario
    and m.estado_suscripcion = 'activa'
    and (p_liga_id is null or m.liga_id = p_liga_id)
    and exists (
      select 1 from public.creditos_lotes l
      where l.usuario_id = m.usuario_id and l.liga_id = m.liga_id
    )
    and not exists (
      select 1 from public.creditos_lotes l
      where l.usuario_id = m.usuario_id
        and l.liga_id = m.liga_id
        and (l.expira_en is null or l.expira_en > now())
    );
end;
$$;

revoke execute on function public.vencer_suscripciones(uuid) from public, anon;
grant execute on function public.vencer_suscripciones(uuid) to authenticated;
