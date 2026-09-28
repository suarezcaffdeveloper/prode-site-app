# SPEC 04 — Planes y Créditos por Liga

> **Status:** Propuesto · **Depends on:** SPEC 01 · **Date:** 2026-09-26
> **Objective:** Definir un catálogo único de planes de la plataforma (compra suelta o suscripción mensual) y un sistema de créditos por usuario y liga que esos planes otorgan, para que más adelante (SPEC 05) el usuario pueda gastar esos créditos cargando cartones de pronóstico. El otorgamiento sigue siendo 100% manual por parte del admin, igual que hoy con `estado_suscripcion` — todavía no hay pasarela de pago.

## Scope

**In:**

- Catálogo de planes (`planes`), único para toda la plataforma (no por liga): nombre, tipo (`unico` o `mensual`), cantidad de créditos que otorga, precio total, activo/inactivo.
- Saldo de créditos por usuario y liga, modelado como un ledger de lotes (`creditos_lotes`) en vez de un contador simple, para poder distinguir créditos que vencen (origen suscripción, vencen al cierre del ciclo) de créditos que no vencen (origen compra suelta).
- Cálculo del saldo disponible de un usuario en una liga: suma de `cantidad_total - cantidad_usada` de todos sus lotes en esa liga cuyo `expira_en` sea `null` o todavía no haya pasado.
- Acción de admin para otorgar un plan a un usuario en una liga (extiende la página existente `admin/ligas/[id]/usuarios/`), que crea el lote de créditos correspondiente con el `expira_en` que corresponda según el tipo de plan.
- El usuario ve su saldo de créditos disponible en cada liga en la que participa.

**Out of scope (for future specs):**

- Procesamiento de pagos automático (Mercado Pago, Stripe, etc.). El otorgamiento de un plan sigue siendo una acción manual del admin, análoga a cómo hoy se cambia `estado_suscripcion` a mano tras confirmar el pago fuera de la app.
- Renovación automática mensual de las suscripciones. Mientras no haya pasarela de pago, el admin repite manualmente la acción de otorgar plan cada ciclo; automatizar esto queda para cuando se integre el cobro real.
- Consumo/gasto de créditos al cargar un pronóstico — eso vive en SPEC 05, que depende de esta.
- Notificaciones o recordatorios de vencimiento de créditos.
- Reembolso o devolución de créditos ya otorgados.
- Catálogo de planes distinto por liga (el catálogo es único de plataforma).

## Data model

Dos tablas nuevas en `public`:

```sql
-- Catálogo único de planes de la plataforma
create table public.planes (
  id                  uuid primary key default gen_random_uuid(),
  nombre              text not null,
  tipo                text not null check (tipo in ('unico', 'mensual')),
  cantidad_creditos   integer not null check (cantidad_creditos > 0),
  precio              numeric(10, 2) not null check (precio >= 0),
  activo              boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.planes enable row level security;

-- Catálogo público: cualquier autenticado puede verlo para elegir un plan
create policy "planes_select_autenticado"
on public.planes for select
to authenticated
using ( true );

create policy "planes_insert_admin"
on public.planes for insert
to authenticated
with check ( public.is_admin() );

create policy "planes_update_admin"
on public.planes for update
to authenticated
using ( public.is_admin() )
with check ( public.is_admin() );

create trigger planes_set_updated_at
before update on public.planes
for each row execute function public.set_updated_at();

-- Ledger de créditos otorgados: cada fila es un "lote" de créditos
-- que un usuario recibió en una liga a partir de un plan.
create table public.creditos_lotes (
  id                  uuid primary key default gen_random_uuid(),
  usuario_id          uuid not null references public.usuarios (id),
  liga_id             uuid not null references public.ligas (id),
  plan_id             uuid not null references public.planes (id),
  cantidad_total      integer not null check (cantidad_total > 0),
  cantidad_usada      integer not null default 0 check (cantidad_usada >= 0),
  expira_en           timestamptz,
  created_at          timestamptz not null default now(),
  check (cantidad_usada <= cantidad_total)
);

alter table public.creditos_lotes enable row level security;

create policy "creditos_lotes_select_propio_o_admin"
on public.creditos_lotes for select
to authenticated
using ( usuario_id = (select auth.uid()) or public.is_admin() );

-- El otorgamiento es exclusivo del admin (no hay pasarela de pago:
-- el usuario nunca crea su propio lote de créditos).
create policy "creditos_lotes_insert_admin"
on public.creditos_lotes for insert
to authenticated
with check ( public.is_admin() );
```

Conventions:

- `expira_en = null` → créditos de un plan `unico` (compra suelta), no vencen.
- `expira_en = <fin de ciclo>` → créditos de un plan `mensual`, dejan de contar para el saldo disponible una vez pasada esa fecha (no se borran, quedan como historial).
- El saldo disponible de un usuario en una liga se calcula, no se guarda: `select coalesce(sum(cantidad_total - cantidad_usada), 0) from creditos_lotes where usuario_id = ? and liga_id = ? and (expira_en is null or expira_en > now())`.
- `cantidad_usada` la actualiza SPEC 05 al consumir un crédito; en esta spec siempre se crea en `0`.
- Vencimiento: `expira_en = now() + 30 días corridos` desde la compra (no fin de mes calendario).
- Recompra: se puede comprar cualquier plan, incluso el mismo, las veces que se quiera y en cualquier momento (también con la suscripción activa y con saldo 0). Cada compra agrega un lote nuevo con su propio vencimiento; los lotes se apilan, no se renuevan ni se pisan.
- Estado de la suscripción: `activa` significa "tiene al menos un lote vigente" (`expira_en` nulo o futuro), tenga o no saldo. Quedarse sin prodes NO la desactiva. Pasa sola a `inactiva` cuando vence el último lote del usuario en esa liga (función `vencer_suscripciones`, ejecutada de forma perezosa por la app antes de leer la membresía; no hay pg_cron). Los lotes `unico` no vencen, así que mantienen la suscripción activa.
- No hay `update`/`delete` habilitados por RLS para nadie salvo lo que agregue SPEC 05 (consumo transaccional vía función `security definer`, ver esa spec) — desde esta spec, un lote es inmutable una vez creado.

## Implementation plan

1. Migración SQL nueva (`supabase/migrations/<timestamp>_planes_y_creditos_init.sql`) con las dos tablas, policies y trigger de la sección Data model. Manual test: en el SQL editor, insertar un plan de ejemplo (`('Suelto x1', 'unico', 1, 1500)`) y un lote de créditos para un usuario/liga de prueba; confirmar que el `check (cantidad_usada <= cantidad_total)` rechaza un `update` que intente poner `cantidad_usada = cantidad_total + 1`.
2. Seed manual de planes iniciales (vía SQL editor o una migración de datos separada), por ejemplo: "1 prode" (unico, 1 crédito), "4 prodes/mes" (mensual, 4 créditos, precio con descuento), "10 prodes/mes" (mensual, 10 créditos, precio con más descuento). Manual test: confirmar que los tres aparecen con `activo = true`.
3. Crear `src/lib/creditos.ts` con una función `calcularSaldoDisponible(lotes: {cantidad_total, cantidad_usada, expira_en}[]): number` (pura, sin acceso a red) que replica la lógica SQL del saldo, para poder mostrar el mismo número tanto en server components como en validaciones. Manual test: casos manuales (lote sin vencer con saldo parcial, lote vencido no debe sumar, mezcla de ambos).
4. En `admin/ligas/[id]/usuarios/actions.ts`, agregar `otorgarPlan(ligaId, membresiaId, usuarioId, formData)`: lee `plan_id` del form, busca el plan, calcula `expira_en` (`null` si `tipo = 'unico'`, `now() + interval '30 days'` si `tipo = 'mensual'`) e inserta el lote en `creditos_lotes`. Manual test: desde el admin, otorgar un plan mensual a un usuario y confirmar en la base que el lote quedó con `expira_en` a 1 mes.
5. Extender `admin/ligas/[id]/usuarios/page.tsx`: junto a cada membresía, mostrar el saldo actual de créditos del usuario en esa liga (usando `calcularSaldoDisponible`) y un selector de plan + botón "Otorgar" que llama a `otorgarPlan`. Manual test: otorgar dos planes seguidos al mismo usuario (uno suelto, uno mensual) y confirmar que el saldo mostrado suma ambos correctamente.
6. Mostrar el saldo de créditos del usuario logueado en `ligas/[id]/page.tsx` (vista pública de la liga), reutilizando `calcularSaldoDisponible` sobre sus propios lotes. Manual test: con un usuario sin créditos otorgados, confirmar que se muestra saldo `0` sin error.

## Acceptance criteria

- [ ] El catálogo de planes existe y es visible para cualquier usuario autenticado.
- [ ] Solo el admin puede crear o modificar planes.
- [ ] El admin puede otorgar un plan a un usuario en una liga puntual desde `admin/ligas/[id]/usuarios/`.
- [ ] Otorgar un plan `unico` crea un lote con `expira_en = null`.
- [ ] Otorgar un plan `mensual` crea un lote con `expira_en` seteado a 30 días corridos desde el otorgamiento.
- [ ] Un usuario con suscripción activa puede comprar más planes (incluso el mismo) en cualquier momento; los lotes se acumulan.
- [ ] Un usuario activo con saldo 0 pero con un lote vigente sigue `activa` y ve cómo comprar más prodes.
- [ ] Cuando vence el último lote de un usuario en una liga, su suscripción pasa a `inactiva`.
- [ ] El saldo disponible de un usuario en una liga es la suma de `cantidad_total - cantidad_usada` de sus lotes no vencidos en esa liga.
- [ ] Un lote vencido (`expira_en` pasado) deja de sumar al saldo disponible, aunque siga existiendo en la base como historial.
- [ ] Un usuario nunca puede crear su propio lote de créditos (solo el admin puede insertar en `creditos_lotes`).
- [ ] El saldo es siempre por usuario + liga; un usuario con créditos en la Liga A no puede usarlos en la Liga B.

## Decisions

- **Yes:** modelar los créditos como un ledger de lotes (`creditos_lotes`) en vez de un único contador por membresía. Es lo único que permite distinguir, dentro del mismo saldo, qué créditos vencen (suscripción) y cuáles no (compra suelta) — un contador simple no puede expresar eso.
- **Yes:** catálogo de planes único para toda la plataforma, sin `liga_id`. No hay indicios de que cada liga sea un negocio independiente con pricing propio; simplifica la administración y la comunicación al usuario.
- **No:** pasarela de pago automática en esta spec. Se mantiene el mismo patrón manual que `estado_suscripcion` (SPEC 01) hasta que se decida integrar un cobro real.
- **No:** renovación automática del ciclo mensual. Mientras el otorgamiento sea manual, automatizar solo la renovación (sin automatizar el cobro) generaría créditos "gratis" sin control; el admin repite la acción cada ciclo.
- **No:** consumo de créditos en esta spec. Gastar un crédito está atado a la creación de un cartón de pronóstico, que depende de la "jornada activa" — ambas cosas viven en SPEC 05 para no mezclar la infraestructura de billetera con la mecánica de juego.

## Risks

| Risk | Mitigation |
| --- | --- |
| El admin se olvida de renovar manualmente una suscripción mensual a tiempo | Aceptado por diseño mientras no haya pasarela de pago; queda como candidato a automatizar cuando se integre el cobro real. |
| Condición de carrera al descontar créditos de un lote (dos consumos simultáneos) | No aplica en esta spec (acá solo se otorga, nunca se descuenta); SPEC 05 resuelve el descuento atómico con locking a nivel de base de datos. |
| Un admin otorga un plan equivocado por error | No hay mecanismo de reversión en esta spec (fuera de alcance); el lote queda como historial permanente. Corrección manual vía SQL editor si hace falta. |
| Precio del plan definido en el catálogo queda desactualizado | El campo `activo` permite dar de baja un plan sin borrar su historial; el admin crea un plan nuevo con el precio actualizado en vez de editar el existente para no alterar el historial de compras pasadas. |

## What is **not** in this spec

- Procesamiento de pagos automático (pasarela).
- Renovación automática de suscripciones.
- Consumo/gasto de créditos (SPEC 05).
- Notificaciones de vencimiento.
- Reembolsos o devoluciones de créditos.
- Catálogo de planes por liga.

Cada uno de estos, si se implementa, va en su propio spec.
