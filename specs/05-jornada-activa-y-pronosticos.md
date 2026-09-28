# SPEC 05 — Jornada Activa y Carga de Pronósticos

> **Status:** Propuesto · **Depends on:** SPEC 02, SPEC 03, SPEC 04 · **Date:** 2026-09-26
> **Objective:** Determinar automáticamente, para cada liga, cuál es la única jornada habilitada para pronosticar en cada momento, y permitir que el usuario cargue uno o más cartones de pronóstico sobre esa jornada, gastando su saldo de créditos (SPEC 04). Objetivo de negocio explícito: nunca permitir pronosticar una jornada que todavía no es la próxima a jugarse.

## Scope

**In:**

- Regla de "jornada activa" por liga, calculada por horario, no por estado de carga de resultados:
  - Para cada jornada de una liga, `hora_cierre = min(fecha_hora) de sus partidos - 30 minutos`, y solo existe si **todos** los partidos de esa jornada tienen `fecha_hora` cargada.
  - La jornada activa es la de **menor número** cuyo `hora_cierre` todavía no pasó (es decir, `hora_cierre is null` o `hora_cierre > now()`).
  - Si la jornada activa candidata tiene `hora_cierre is null` (el admin todavía no completó los horarios de todos sus partidos), la liga queda **bloqueada para pronosticar** hasta que se completen — el sistema nunca salta a una jornada posterior que sí tenga horario cargado, para preservar el orden estricto.
- Un cartón de pronóstico (`cartones`) es un conjunto completo de predicciones (una por cada partido de la jornada activa), identificado como una unidad independiente: un mismo usuario puede tener varios cartones distintos en la misma jornada.
- Crear un cartón consume exactamente 1 crédito del saldo del usuario en esa liga (SPEC 04), descontado del lote más próximo a vencer primero (FIFO por `expira_en`, priorizando los que vencen antes; los que no vencen se usan al final).
- El usuario puede editar los resultados de un cartón propio mientras la jornada siga abierta (antes de `hora_cierre`); una vez pasado ese momento, el cartón queda inmutable.
- El fixture completo de la liga sigue siendo visible para cualquier usuario autenticado (ya lo es hoy vía `partidos_select_autenticado`, SPEC 02); se agrega una indicación de cuál jornada es la activa y su `hora_cierre`.
- Mensaje claro al usuario cuando no tiene saldo suficiente para crear un cartón nuevo.
- Bloqueo de creación/edición de cartones para cualquier jornada que no sea la activa en ese momento (ni pasadas ni futuras).

**Out of scope (for future specs):**

- Eliminar un cartón ya creado. Si el usuario se equivoca, edita los resultados del mismo cartón antes del cierre; permitir borrar obligaría a revertir el consumo del crédito, lo cual queda fuera de alcance.
- Scoring, cálculo de aciertos y tabla de posiciones/ranking de los cartones.
- Notificaciones (push, email) cuando se abre o está por cerrar una jornada.
- Configuración del minuto de cierre desde la UI del admin — queda fijo en 30 minutos antes del primer partido, hardcodeado.
- Cualquier cambio al flujo de otorgamiento de créditos o al catálogo de planes (SPEC 04, ya resuelto).
- Vista de "mis cartones" agregada entre distintas ligas (cada liga se ve por separado, igual que hoy).

## Data model

Dos tablas nuevas y dos funciones en `public`:

```sql
-- Un cartón = un conjunto de predicciones de un usuario para una jornada de una liga
create table public.cartones (
  id                  uuid primary key default gen_random_uuid(),
  usuario_id          uuid not null references public.usuarios (id),
  liga_id             uuid not null references public.ligas (id),
  jornada             integer not null,
  lote_id             uuid not null references public.creditos_lotes (id),
  created_at          timestamptz not null default now()
);

alter table public.cartones enable row level security;

create policy "cartones_select_propio_o_admin"
on public.cartones for select
to authenticated
using ( usuario_id = (select auth.uid()) or public.is_admin() );

create policy "cartones_insert_propio"
on public.cartones for insert
to authenticated
with check ( usuario_id = (select auth.uid()) );

-- Predicción de un partido puntual dentro de un cartón
create table public.pronosticos (
  id                        uuid primary key default gen_random_uuid(),
  carton_id                 uuid not null references public.cartones (id),
  partido_id                uuid not null references public.partidos (id),
  goles_local_prediccion    integer not null check (goles_local_prediccion >= 0),
  goles_visitante_prediccion integer not null check (goles_visitante_prediccion >= 0),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (carton_id, partido_id)
);

alter table public.pronosticos enable row level security;

create policy "pronosticos_select_propio_o_admin"
on public.pronosticos for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.cartones c
    where c.id = carton_id and c.usuario_id = (select auth.uid())
  )
);

create policy "pronosticos_insert_propio"
on public.pronosticos for insert
to authenticated
with check (
  exists (
    select 1 from public.cartones c
    where c.id = carton_id and c.usuario_id = (select auth.uid())
  )
);

create policy "pronosticos_update_propio"
on public.pronosticos for update
to authenticated
using (
  exists (
    select 1 from public.cartones c
    where c.id = carton_id and c.usuario_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.cartones c
    where c.id = carton_id and c.usuario_id = (select auth.uid())
  )
);

create trigger pronosticos_set_updated_at
before update on public.pronosticos
for each row execute function public.set_updated_at();

-- Jornada activa de una liga: la de menor número cuyo cierre
-- (30 min antes del primer partido) todavía no pasó. Si esa jornada
-- tiene algún partido sin fecha_hora, se devuelve igual (jornada y
-- hora_cierre = null) para que el server action bloquee la carga en
-- vez de saltar a una jornada posterior.
create or replace function public.jornada_activa(p_liga_id uuid)
returns table (jornada integer, hora_cierre timestamptz)
language sql
stable
as $$
  with por_jornada as (
    select
      p.jornada,
      case
        when bool_and(p.fecha_hora is not null)
          then min(p.fecha_hora) - interval '30 minutes'
        else null
      end as hora_cierre
    from public.partidos p
    where p.liga_id = p_liga_id
    group by p.jornada
  )
  select jornada, hora_cierre
  from por_jornada
  where hora_cierre is null or hora_cierre > now()
  order by jornada asc
  limit 1;
$$;

-- Descuenta 1 crédito del lote más próximo a vencer (los que no
-- vencen se usan al final) y devuelve el id del lote usado. Usa
-- "for update skip locked" para que dos consumos simultáneos no
-- puedan gastar el mismo último crédito dos veces.
create or replace function public.consumir_credito(p_usuario_id uuid, p_liga_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lote_id uuid;
begin
  select id into v_lote_id
  from public.creditos_lotes
  where usuario_id = p_usuario_id
    and liga_id = p_liga_id
    and cantidad_usada < cantidad_total
    and (expira_en is null or expira_en > now())
  order by expira_en asc nulls last
  for update skip locked
  limit 1;

  if v_lote_id is null then
    raise exception 'sin_creditos_disponibles';
  end if;

  update public.creditos_lotes
  set cantidad_usada = cantidad_usada + 1
  where id = v_lote_id;

  return v_lote_id;
end;
$$;
```

Conventions:

- `jornada_activa` es una función, no una columna guardada: siempre se recalcula contra `now()` y el `fecha_hora` real de los partidos, así nunca queda desincronizada.
- `consumir_credito` es `security definer` para poder hacer el `update` de `creditos_lotes` aunque el usuario autenticado no tenga policy de `update` directa sobre esa tabla (SPEC 04 no la definió); el server action la llama dentro de la misma transacción en la que crea el cartón.
- El server action de creación de cartón debe, en una sola transacción: 1) confirmar que `jornada` coincide con la jornada activa devuelta por `jornada_activa(liga_id)` y que `hora_cierre > now()`, 2) llamar `consumir_credito`, 3) insertar el `carton` con el `lote_id` devuelto, 4) insertar un `pronostico` por cada partido de esa jornada. Si `consumir_credito` lanza `sin_creditos_disponibles`, la transacción aborta entera y no se crea nada.

## Implementation plan

1. Migración SQL nueva (`supabase/migrations/<timestamp>_cartones_y_pronosticos_init.sql`) con las tablas, policies, trigger y las dos funciones de la sección Data model. Manual test: en el SQL editor, con un usuario y liga de prueba con 0 créditos, llamar `select public.consumir_credito(...)` y confirmar que lanza `sin_creditos_disponibles`; otorgarle 1 lote (SPEC 04) y confirmar que la segunda llamada sí devuelve un `lote_id` y que una tercera vuelve a fallar.
2. Manual test de `jornada_activa`: crear una liga de prueba con 3 jornadas — jornada 1 con todos los partidos en el pasado, jornada 2 con todos los partidos con `fecha_hora` futura completa, jornada 3 con un partido sin `fecha_hora`. Confirmar que `jornada_activa` devuelve la jornada 2 con su `hora_cierre` correcto (30 min antes del primero). Luego borrar el `fecha_hora` de un partido de la jornada 2 y confirmar que `jornada_activa` devuelve la jornada 2 con `hora_cierre = null` (bloqueada), sin saltar a la 3 aunque esta tenga horarios completos.
3. Manual test de concurrencia: con un usuario que tiene exactamente 1 crédito disponible, disparar dos llamadas simultáneas a `consumir_credito` (dos pestañas o dos requests en paralelo) y confirmar que una tiene éxito y la otra falla con `sin_creditos_disponibles`, sin quedar `cantidad_usada > cantidad_total`.
4. Crear server actions en `ligas/[id]/partidos/actions.ts` (o un archivo nuevo `ligas/[id]/pronosticos/actions.ts`): `crearCarton(ligaId, jornada, predicciones)` que valida jornada activa + hora de cierre, llama `consumir_credito` e inserta cartón + pronósticos en una transacción; `actualizarCarton(cartonId, predicciones)` que valida que la jornada del cartón siga siendo la activa y no haya pasado `hora_cierre` antes de actualizar los `pronosticos`. Manual test: intentar crear un cartón pasando una `jornada` distinta a la activa y confirmar que se rechaza con mensaje claro.
5. Página de usuario (extendiendo `ligas/[id]/partidos/page.tsx` o una ruta nueva) que muestre: la jornada activa y su hora de cierre, el saldo de créditos disponible (SPEC 04), el listado de partidos de la jornada activa con un formulario para cargar un cartón nuevo (deshabilitado si no hay saldo), y los cartones ya cargados por el usuario en esa jornada con opción de editar cada uno mientras siga abierta. Manual test: con saldo de 2 créditos, cargar 2 cartones con resultados distintos para la misma jornada y confirmar que ambos quedan guardados de forma independiente y el saldo baja a 0.
6. Prueba de punta a punta del cierre automático: en un entorno de prueba, crear una jornada cuyo `hora_cierre` caiga en los próximos minutos, confirmar que antes de esa hora se puede crear/editar el cartón, y que inmediatamente después el mismo intento se rechaza con el mensaje de jornada cerrada, sin necesidad de ningún job/cron (la validación es siempre contra `now()` en el momento del request).

## Acceptance criteria

- [ ] `jornada_activa(liga_id)` devuelve siempre, como máximo, una única jornada por liga.
- [ ] Si todos los partidos de la jornada candidata tienen horario y su cierre (30 min antes del primero) todavía no pasó, esa jornada queda abierta para pronosticar.
- [ ] Si a la jornada candidata le falta el horario de al menos un partido, la liga queda bloqueada para pronosticar (no salta a una jornada posterior).
- [ ] Crear un cartón exige una predicción para cada partido de la jornada activa, todo en una única operación (todo o nada).
- [ ] Crear un cartón descuenta exactamente 1 crédito, priorizando el lote más próximo a vencer.
- [ ] Sin saldo disponible, no se puede crear un cartón nuevo y el usuario ve un mensaje claro.
- [ ] Un usuario puede tener más de un cartón en la misma jornada, cada uno con predicciones independientes.
- [ ] Un usuario puede editar los resultados de su propio cartón mientras la jornada siga abierta.
- [ ] Pasado el `hora_cierre` de la jornada, ni crear ni editar cartones de esa jornada es posible.
- [ ] No se puede crear ni editar un cartón para una jornada que no sea la activa en ese momento.
- [ ] Dos intentos simultáneos de consumir el mismo último crédito disponible nunca dejan `cantidad_usada > cantidad_total`; exactamente uno de los dos tiene éxito.
- [ ] El fixture completo de la liga (todas las jornadas) sigue siendo visible para cualquier usuario autenticado.

## Decisions

- **Yes:** bloquear la liga entera para pronosticar si la jornada candidata tiene el fixture incompleto, en vez de saltar a una jornada posterior que sí tenga horarios cargados. Es la única forma de garantizar el orden estricto que pidió el negocio (nunca jugar la jornada 8 si falta completar la 3).
- **Yes:** `jornada_activa` como función calculada contra `now()`, no como columna persistida. Evita tener que correr un job/cron para "avanzar" la jornada; el cierre es instantáneo apenas pasa la hora, sin desincronización posible.
- **Yes:** descuento de crédito con `for update skip locked` dentro de una función `security definer`. Es el mecanismo estándar de Postgres para evitar que dos requests concurrentes gasten el mismo crédito; más simple y confiable que manejar el lock desde el server action de Next.js.
- **No:** permitir eliminar un cartón ya creado. Habilitarlo requeriría revertir el consumo de crédito (decrementar `cantidad_usada` del lote correcto), lo cual agrega complejidad no pedida; el usuario corrige editando los resultados del mismo cartón.
- **No:** hacer configurable desde la UI el minuto de cierre (los "30 minutos antes"). Se hardcodea por ahora; si se necesita por liga o por partido especial, es un cambio incremental a futuro.
- **No:** automatizar el "avance" de jornada con un cron/scheduler. No hace falta: al ser una función calculada, el simple paso del tiempo ya produce el resultado correcto en el próximo request.
- **Yes:** entre el cierre de la jornada activa (30 min antes del primer partido) y la activación de la siguiente (manual o automática, ver "Actualización 2026-09-26"), ninguna jornada es apostable — parate total. `crear_carton()`/`actualizar_carton()` ya lo garantizan rechazando con `jornada_cerrada` en cuanto `hora_cierre <= now()`, y la UI de usuario expone ese lapso con un estado propio (`"cerrada"`, distinto de `"abierta"` y de `"bloqueada"`) en vez de mostrarlo como jornada abierta con una cuenta regresiva vencida. Evita que un usuario confunda estar apostando a la jornada que está por jugarse con la jornada que ya está corriendo.

## Risks

| Risk | Mitigation |
| --- | --- |
| Condición de carrera al descontar el último crédito disponible | Cubierta por `for update skip locked` en `consumir_credito`, ejecutada dentro de la misma transacción que la creación del cartón. |
| El admin se atrasa en cargar los horarios de la próxima jornada, bloqueando el juego para toda la liga | Aceptado por diseño (preferible a permitir pronosticar jornadas fuera de orden); se podría agregar a futuro un aviso al admin cuando falten horarios y la jornada anterior ya cerró. |
| Un usuario edita un cartón justo en el límite de `hora_cierre` (race entre el submit y el cierre) | El server action valida `hora_cierre > now()` en el momento del request, no en el momento de renderizar el formulario; un submit que llega después del cierre se rechaza igual que una creación tardía. |
| Un partido de la jornada activa cambia de horario después de que ya se cargaron cartones (se pospone) | Fuera de alcance de esta spec: el `hora_cierre` se recalcula en cada consulta, así que un cambio de horario puede reabrir o adelantar el cierre de una jornada con cartones ya cargados. Se documenta como comportamiento conocido, no se agrega lógica de congelamiento. |
| Server action falla a mitad de camino (crédito descontado pero cartón no creado) | Todo el flujo (`consumir_credito` + insert de `carton` + insert de `pronosticos`) corre dentro de una única transacción de base de datos; si algo falla, Postgres revierte todo, incluido el descuento del crédito. |

## Actualización 2026-09-26 — activación manual y por resultados

La regla original de esta spec ("Yes: `jornada_activa` como función calculada
contra `now()`, no como columna persistida") quedó **superada** por un
requerimiento de negocio posterior: el admin necesita poder activar una
jornada puntual a mano (por ejemplo, cuando un partido se reprograma a mitad
de semana y conviene abrir la siguiente jornada sin esperar), y además
cuando eso no pasa, la siguiente jornada debe abrirse sola apenas se cargan
todos los resultados de la jornada activa (no antes, aunque ya haya pasado
su horario).

Implementado en `supabase/migrations/20260926150000_jornada_activa_manual_y_auto.sql`:

- `ligas.jornada_activa` (columna `integer`, nullable): la jornada activa
  pasa a ser un estado persistido por liga, no más una función pura de
  horario. Al ser una sola columna, garantiza por construcción que nunca
  haya dos jornadas activas a la vez en la misma liga.
- `jornada_activa(liga_id)` mantiene exactamente la misma firma
  (`jornada`, `hora_cierre`) y sigue devolviendo `hora_cierre = null` si a
  la jornada activa le falta algún `fecha_hora`; solo cambia de dónde saca
  el número de jornada (de `ligas.jornada_activa` en vez de recalcularlo).
  `crear_carton()`/`actualizar_carton()` no se tocaron: el cierre por
  horario (30 min antes del primer partido) sigue siendo condición
  necesaria además de que la jornada esté activa.
- Activación manual: server action `activarJornada(ligaId, jornada)` en
  `admin/ligas/[id]/partidos/actions.ts`, solo valida que la jornada tenga
  partidos cargados y actualiza `ligas.jornada_activa` (protegido por la
  policy `ligas_update_admin` ya existente).
- Activación automática: trigger `partidos_avanzar_jornada_activa` sobre
  `partidos`, que corre después de que un partido pasa a `estado =
  'finalizado'`. Si con ese cambio ya no queda ningún partido pendiente en
  la jornada activa de esa liga, activa la siguiente jornada con partidos
  cargados (si existe). No exige que esa siguiente jornada tenga horarios
  completos: si le faltan, `jornada_activa()` la devuelve igual pero con
  `hora_cierre = null`, y el bloqueo lo siguen resolviendo
  `crear_carton()`/`actualizar_carton()` como ya hacían.

El resto de la spec (cartones, pronósticos, consumo de crédito,
inmutabilidad post-cierre) no cambia.

## What is **not** in this spec

- Eliminación de cartones ya creados.
- Scoring, cálculo de aciertos y tabla de posiciones.
- Notificaciones de apertura/cierre de jornada.
- Configuración del minuto de cierre desde la UI.
- Manejo especial de partidos pospuestos después del cierre de su jornada.

Cada uno de estos, si se implementa, va en su propio spec.
