-- ============================================================================
-- SPEC 11 — Pago por transferencia y verificación automática de comprobante
-- ============================================================================
-- Solicitudes de pago (una por intento de compra de un plan), ledger de
-- movimientos de la cuenta de Mercado Pago del prode y las funciones que
-- deciden el alta de la suscripción. Depende de 20261001100000, que elimina la
-- activación temporal: a partir de acá, los prodes se otorgan solo por
-- aprobar_solicitud_pago() (sistema o admin) u otorgar_plan_admin() (admin).
-- ============================================================================

-- Ledger de movimientos de la cuenta de Mercado Pago (ingresos y egresos).
create table public.movimientos_mp (
  id                  uuid primary key default gen_random_uuid(),
  mp_id               text not null unique,
  direccion           text not null check (direccion in ('ingreso', 'egreso')),
  tipo                text,
  estado_mp           text not null,
  monto               numeric(12, 2) not null check (monto > 0),
  moneda              text not null default 'ARS',
  fecha_acreditacion  timestamptz not null,
  pagador_nombre      text,
  pagador_documento   text,
  numero_operacion    text,
  raw                 jsonb not null,
  alerta              text check (alerta in ('devuelto', 'contracargo', 'egreso_sobre_movimiento_usado')),
  solicitud_id        uuid unique,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index movimientos_mp_monto_idx on public.movimientos_mp (monto, fecha_acreditacion);

-- Una solicitud por intento de compra de un plan.
create table public.solicitudes_pago (
  id                       uuid primary key default gen_random_uuid(),
  usuario_id               uuid not null references public.usuarios (id),
  liga_id                  uuid not null references public.ligas (id),
  plan_slug                text not null,
  monto_base               numeric(10, 2) not null check (monto_base > 0),
  monto_a_transferir       numeric(10, 2) not null,
  estado                   text not null default 'esperando_comprobante'
    check (estado in (
      'esperando_comprobante', 'verificando', 'aprobada',
      'pendiente_admin', 'rechazada', 'vencida', 'cancelada'
    )),
  expira_en                timestamptz not null default now() + interval '48 hours',
  comprobante_path         text,
  comprobante_sha256       text,
  comprobante_enviado_en   timestamptz,
  extraccion               jsonb,
  evaluacion               jsonb,
  motivos                  text[] not null default '{}',
  decidida_por             text check (decidida_por in ('sistema', 'admin')),
  admin_id                 uuid references public.usuarios (id),
  decidida_en              timestamptz,
  motivo_rechazo           text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  check (monto_a_transferir > monto_base and monto_a_transferir < monto_base + 1)
);

alter table public.movimientos_mp
  add constraint movimientos_mp_solicitud_fk
  foreign key (solicitud_id) references public.solicitudes_pago (id);

-- El monto único no puede repetirse entre solicitudes que todavía compiten por él.
create unique index solicitudes_pago_monto_activo_uidx
  on public.solicitudes_pago (monto_a_transferir)
  where estado in ('esperando_comprobante', 'verificando', 'pendiente_admin');

-- A lo sumo una solicitud abierta por usuario y liga.
create unique index solicitudes_pago_abierta_uidx
  on public.solicitudes_pago (usuario_id, liga_id)
  where estado = 'esperando_comprobante';

create index solicitudes_pago_estado_idx on public.solicitudes_pago (estado, expira_en);
create index solicitudes_pago_sha_idx on public.solicitudes_pago (comprobante_sha256);
create index solicitudes_pago_usuario_idx on public.solicitudes_pago (usuario_id, liga_id, created_at desc);

alter table public.solicitudes_pago enable row level security;
alter table public.movimientos_mp enable row level security;

create policy "solicitudes_pago_select_propia_o_admin"
on public.solicitudes_pago for select
to authenticated
using ( usuario_id = (select auth.uid()) or public.is_admin() );

create policy "movimientos_mp_select_admin"
on public.movimientos_mp for select
to authenticated
using ( public.is_admin() );

create trigger solicitudes_pago_set_updated_at
before update on public.solicitudes_pago
for each row execute function public.set_updated_at();

create trigger movimientos_mp_set_updated_at
before update on public.movimientos_mp
for each row execute function public.set_updated_at();

-- Sin grants de escritura para usuarios: todo cambio pasa por las funciones
-- security definer de más abajo o por el service role (webhook/cron).
-- El usuario solo lee las columnas que necesita para ver el estado de su pago:
-- la extracción de la IA, la evaluación de reglas y los motivos internos no se
-- exponen (revelarían qué campos falsificar). El admin los lee con el service
-- role desde las pantallas de /admin, ya protegidas por el layout.
revoke all on public.solicitudes_pago, public.movimientos_mp from anon, authenticated;
grant select (
  id, usuario_id, liga_id, plan_slug, monto_base, monto_a_transferir, estado,
  expira_en, comprobante_enviado_en, motivo_rechazo, decidida_en, created_at
) on public.solicitudes_pago to authenticated;

grant select, insert, update on public.solicitudes_pago, public.movimientos_mp to service_role;
grant select on public.usuarios, public.ligas, public.planes to service_role;

-- Tipos de notificación nuevos.
alter table public.notificaciones
  drop constraint notificaciones_tipo_check;

alter table public.notificaciones
  add constraint notificaciones_tipo_check check (tipo in (
    'ganaste',
    'sin_premio',
    'ultimo_prode',
    'sin_prodes',
    'jornada_abierta',
    'plan_acreditado',
    'cierra_pronto',
    'creditos_por_vencer',
    'suscripcion_vencida',
    'pago_en_revision',
    'pago_rechazado'
  ));

-- ============================================================================
-- Otorgamiento de un plan a un usuario (interno)
-- ============================================================================
-- Es la lógica que antes vivía en activar_suscripcion_liga(), pero sin
-- depender de auth.uid(): la invocan aprobar_solicitud_pago() y nadie más.
-- Activa la membresía y otorga el lote de créditos en la misma transacción.
create or replace function public.otorgar_plan_a_usuario(
  p_usuario_id uuid,
  p_liga_id uuid,
  p_plan_slug text,
  p_comprobante_path text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan         record;
  v_expira_en    timestamptz;
  v_membresia_id uuid;
  v_lote_id      uuid;
begin
  select id, nombre, cantidad_creditos, tipo into v_plan
  from public.planes
  where slug = p_plan_slug and activo;

  if not found then
    raise exception 'plan_invalido';
  end if;

  v_expira_en := case when v_plan.tipo = 'mensual' then now() + interval '30 days' else null end;

  select id into v_membresia_id
  from public.membresias_liga
  where usuario_id = p_usuario_id and liga_id = p_liga_id;

  if v_membresia_id is null then
    insert into public.membresias_liga (usuario_id, liga_id, plan_elegido, comprobante_path, estado_suscripcion)
    values (p_usuario_id, p_liga_id, p_plan_slug, p_comprobante_path, 'activa');
  else
    update public.membresias_liga
    set plan_elegido = p_plan_slug,
        comprobante_path = coalesce(p_comprobante_path, comprobante_path),
        estado_suscripcion = 'activa'
    where id = v_membresia_id;
  end if;

  insert into public.creditos_lotes (usuario_id, liga_id, plan_id, cantidad_total, expira_en)
  values (p_usuario_id, p_liga_id, v_plan.id, v_plan.cantidad_creditos, v_expira_en)
  returning id into v_lote_id;

  perform public.crear_notificacion(
    p_usuario_id, p_liga_id, null, 'plan_acreditado',
    'Plan acreditado',
    'Se acreditaron ' || v_plan.cantidad_creditos
      || case when v_plan.cantidad_creditos = 1 then ' prode' else ' prodes' end
      || ' (plan ' || v_plan.nombre || ').',
    'plan:' || v_lote_id
  );

  return v_lote_id;
end;
$$;

revoke execute on function public.otorgar_plan_a_usuario(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;

-- ============================================================================
-- Funciones del usuario
-- ============================================================================

-- Crea (o reutiliza) la solicitud abierta del usuario para un plan, con un
-- monto único: precio del plan + centavos (0,01–0,99) que ninguna otra
-- solicitud activa esté usando.
create or replace function public.crear_solicitud_pago(
  p_liga_id uuid,
  p_plan_slug text
)
returns public.solicitudes_pago
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario   uuid := auth.uid();
  v_plan      record;
  v_sol       public.solicitudes_pago;
  v_monto     numeric(10, 2);
  v_intentos  integer := 0;
begin
  if v_usuario is null then
    raise exception 'no_autenticado';
  end if;

  if not exists (select 1 from public.ligas where id = p_liga_id and activa) then
    raise exception 'liga_invalida';
  end if;

  select precio into v_plan
  from public.planes
  where slug = p_plan_slug and activo;

  if not found then
    raise exception 'plan_invalido';
  end if;

  if v_plan.precio <= 0 then
    raise exception 'plan_invalido';
  end if;

  update public.solicitudes_pago
  set estado = 'vencida'
  where usuario_id = v_usuario
    and liga_id = p_liga_id
    and estado = 'esperando_comprobante'
    and expira_en <= now();

  select * into v_sol
  from public.solicitudes_pago
  where usuario_id = v_usuario
    and liga_id = p_liga_id
    and estado = 'esperando_comprobante'
    and plan_slug = p_plan_slug;

  if found then
    return v_sol;
  end if;

  update public.solicitudes_pago
  set estado = 'cancelada'
  where usuario_id = v_usuario
    and liga_id = p_liga_id
    and estado = 'esperando_comprobante';

  loop
    v_intentos := v_intentos + 1;
    if v_intentos > 40 then
      raise exception 'montos_agotados';
    end if;

    v_monto := v_plan.precio + (1 + floor(random() * 99))::integer / 100.0;

    begin
      insert into public.solicitudes_pago (usuario_id, liga_id, plan_slug, monto_base, monto_a_transferir)
      values (v_usuario, p_liga_id, p_plan_slug, v_plan.precio, v_monto)
      returning * into v_sol;

      return v_sol;
    exception when unique_violation then
      -- Ese monto ya lo usa otra solicitud activa: se prueba con otros centavos.
      null;
    end;
  end loop;
end;
$$;

revoke execute on function public.crear_solicitud_pago(uuid, text) from public, anon;
grant execute on function public.crear_solicitud_pago(uuid, text) to authenticated;

-- Guarda el comprobante subido y deja la solicitud lista para verificarse.
create or replace function public.registrar_comprobante(
  p_solicitud_id uuid,
  p_path text,
  p_sha256 text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid := auth.uid();
  v_sol     record;
begin
  if v_usuario is null then
    raise exception 'no_autenticado';
  end if;

  select id, usuario_id, estado, expira_en into v_sol
  from public.solicitudes_pago
  where id = p_solicitud_id
  for update;

  if not found or v_sol.usuario_id <> v_usuario then
    raise exception 'solicitud_inexistente';
  end if;

  if v_sol.estado <> 'esperando_comprobante' then
    raise exception 'solicitud_no_editable';
  end if;

  if v_sol.expira_en <= now() then
    update public.solicitudes_pago set estado = 'vencida' where id = p_solicitud_id;
    raise exception 'solicitud_vencida';
  end if;

  -- El comprobante tiene que estar en la carpeta del propio usuario (misma
  -- convención que la policy de storage "comprobantes_insert_propio").
  if split_part(p_path, '/', 1) <> v_usuario::text then
    raise exception 'comprobante_invalido';
  end if;

  update public.solicitudes_pago
  set comprobante_path = p_path,
      comprobante_sha256 = p_sha256,
      comprobante_enviado_en = now(),
      estado = 'verificando'
  where id = p_solicitud_id;
end;
$$;

revoke execute on function public.registrar_comprobante(uuid, text, text) from public, anon;
grant execute on function public.registrar_comprobante(uuid, text, text) to authenticated;

-- ============================================================================
-- Decisión sobre una solicitud (sistema o admin)
-- ============================================================================

-- Aprueba una solicitud y otorga el plan, todo en una transacción.
--  * Sistema (service role): solo desde 'verificando' y siempre con un
--    movimiento de la cuenta cuyo monto coincida exactamente.
--  * Admin: desde cualquier estado no final, con o sin movimiento asociado.
-- Bloquea la solicitud y el movimiento, así un webhook duplicado o dos
-- conciliaciones simultáneas acreditan una sola vez.
create or replace function public.aprobar_solicitud_pago(
  p_solicitud_id uuid,
  p_movimiento_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_es_admin boolean := public.is_admin();
  v_sol      record;
  v_mov      record;
begin
  if not (auth.role() = 'service_role' or v_es_admin) then
    raise exception 'no_autorizado';
  end if;

  select * into v_sol
  from public.solicitudes_pago
  where id = p_solicitud_id
  for update;

  if not found then
    raise exception 'solicitud_inexistente';
  end if;

  if v_es_admin then
    if v_sol.estado not in ('esperando_comprobante', 'verificando', 'pendiente_admin', 'vencida') then
      raise exception 'solicitud_no_aprobable';
    end if;
  elsif v_sol.estado <> 'verificando' then
    raise exception 'solicitud_no_aprobable';
  end if;

  if p_movimiento_id is not null then
    select * into v_mov
    from public.movimientos_mp
    where id = p_movimiento_id
    for update;

    if not found then
      raise exception 'movimiento_inexistente';
    end if;

    if v_mov.direccion <> 'ingreso' or v_mov.solicitud_id is not null then
      raise exception 'movimiento_no_disponible';
    end if;

    if not v_es_admin and v_mov.monto <> v_sol.monto_a_transferir then
      raise exception 'monto_no_coincide';
    end if;

    update public.movimientos_mp
    set solicitud_id = p_solicitud_id
    where id = p_movimiento_id;
  elsif not v_es_admin then
    raise exception 'movimiento_requerido';
  end if;

  perform public.otorgar_plan_a_usuario(
    v_sol.usuario_id, v_sol.liga_id, v_sol.plan_slug, v_sol.comprobante_path
  );

  update public.solicitudes_pago
  set estado = 'aprobada',
      decidida_por = case when v_es_admin then 'admin' else 'sistema' end,
      admin_id = case when v_es_admin then auth.uid() else null end,
      decidida_en = now()
  where id = p_solicitud_id;
end;
$$;

revoke execute on function public.aprobar_solicitud_pago(uuid, uuid) from public, anon;
grant execute on function public.aprobar_solicitud_pago(uuid, uuid) to authenticated, service_role;

-- Solo admin. El motivo es obligatorio y se le muestra al usuario.
create or replace function public.rechazar_solicitud_pago(
  p_solicitud_id uuid,
  p_motivo text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sol record;
begin
  if not public.is_admin() then
    raise exception 'no_autorizado';
  end if;

  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'motivo_requerido';
  end if;

  select id, usuario_id, liga_id, estado into v_sol
  from public.solicitudes_pago
  where id = p_solicitud_id
  for update;

  if not found then
    raise exception 'solicitud_inexistente';
  end if;

  if v_sol.estado not in ('verificando', 'pendiente_admin') then
    raise exception 'solicitud_no_rechazable';
  end if;

  update public.solicitudes_pago
  set estado = 'rechazada',
      decidida_por = 'admin',
      admin_id = auth.uid(),
      decidida_en = now(),
      motivo_rechazo = btrim(p_motivo)
  where id = p_solicitud_id;

  perform public.crear_notificacion(
    v_sol.usuario_id, v_sol.liga_id, null, 'pago_rechazado',
    'Tu pago fue rechazado',
    btrim(p_motivo),
    'pago_rechazado:' || p_solicitud_id
  );
end;
$$;

revoke execute on function public.rechazar_solicitud_pago(uuid, text) from public, anon;
grant execute on function public.rechazar_solicitud_pago(uuid, text) to authenticated;

-- ============================================================================
-- Funciones exclusivas del sistema (service role: webhook, cron, verificación)
-- ============================================================================

-- Deriva una solicitud a revisión manual y avisa al usuario. Nunca rechaza.
create or replace function public.marcar_solicitud_en_revision(
  p_solicitud_id uuid,
  p_motivos text[],
  p_extraccion jsonb,
  p_evaluacion jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sol record;
begin
  select id, usuario_id, liga_id, estado into v_sol
  from public.solicitudes_pago
  where id = p_solicitud_id
  for update;

  if not found or v_sol.estado <> 'verificando' then
    return;
  end if;

  update public.solicitudes_pago
  set estado = 'pendiente_admin',
      motivos = coalesce(p_motivos, '{}'),
      extraccion = coalesce(p_extraccion, extraccion),
      evaluacion = coalesce(p_evaluacion, evaluacion)
  where id = p_solicitud_id;

  perform public.crear_notificacion(
    v_sol.usuario_id, v_sol.liga_id, null, 'pago_en_revision',
    'Estamos revisando tu pago',
    'No pudimos verificar tu comprobante de forma automática. Un administrador lo revisa a la brevedad.',
    'pago_revision:' || p_solicitud_id
  );
end;
$$;

revoke execute on function public.marcar_solicitud_en_revision(uuid, text[], jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.marcar_solicitud_en_revision(uuid, text[], jsonb, jsonb) to service_role;

-- Vence las solicitudes que no recibieron comprobante a tiempo y libera sus
-- centavos. Devuelve cuántas venció.
create or replace function public.vencer_solicitudes_pago()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cantidad integer;
begin
  update public.solicitudes_pago
  set estado = 'vencida'
  where estado = 'esperando_comprobante'
    and expira_en <= now();

  get diagnostics v_cantidad = row_count;
  return v_cantidad;
end;
$$;

revoke execute on function public.vencer_solicitudes_pago() from public, anon, authenticated;
grant execute on function public.vencer_solicitudes_pago() to service_role;
