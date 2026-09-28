# SPEC 09 — Prodes Ganadores, Pozo por Jornada y Aviso por Email

> **Status:** Implementado (pendiente de prueba manual en UI) · **Depends on:** SPEC 04, SPEC 05, SPEC 08 · **Date:** 2026-09-27
> **Objective:** Determinar, para cada jornada de cada liga, cuáles cartones son **ganadores** (acertaron el marcador exacto de todos los partidos de la jornada), cuánto dinero hay en juego (**pozo** = 80% de lo recaudado por los cartones de esa jornada; el 20% restante es la comisión de la plataforma), cómo se reparte entre los ganadores, y cómo se les avisa por email. El usuario ve el pozo actual mientras carga sus prodes; el administrador ve los ganadores con sus emails, liquida la jornada (congelando el resultado) y dispara el aviso. Es la pieza económica central del producto: los montos deben quedar registrados de forma inmutable y auditable.

## Scope

**In:**

- **Definición de prode ganador.** Un cartón (`cartones`, SPEC 05) es ganador de su jornada si y solo si, para **todos** los partidos de esa jornada en su liga:
  - el partido está `finalizado`, y
  - el cartón tiene un pronóstico para ese partido con `goles_local_prediccion = goles_local` **y** `goles_visitante_prediccion = goles_visitante` (marcador exacto; no hay puntos por signo ni aciertos parciales).
  - Un cartón sin pronóstico para algún partido de la jornada (por ejemplo, un partido agregado después de crearlo) no puede ser ganador.
  - Cada **cartón** ganador cuenta por separado: un usuario con dos cartones ganadores en la misma jornada cobra dos partes.
- **Monto por prode (snapshot).** Cada cartón guarda `monto` al momento de crearse: `planes.precio / planes.cantidad_creditos` del plan del lote del que se consumió el crédito (SPEC 04). Hoy ese dato no existe y solo puede derivarse de un precio de plan editable; el snapshot evita que un cambio de precio altere pozos históricos. Los cartones existentes se completan por backfill con la misma fórmula.
- **Cálculo del pozo por (liga, jornada):**
  - `recaudado` = suma de `cartones.monto` de la jornada.
  - `pozo_jornada` = `recaudado * ligas.porcentaje_pozo / 100` (default 80), redondeado a centavos.
  - `comision_plataforma` = `recaudado - pozo_jornada` (el 20%).
  - `pozo_acumulado_entrante` = `pozo_acumulado_saliente` de la jornada liquidada inmediatamente anterior de la misma liga (0 si no hay).
  - `pozo_total` = `pozo_jornada + pozo_acumulado_entrante`. Es el monto que se lleva el/los ganador/es.
  - Ejemplo: 10 prodes de $1.500 en la jornada 1 → recaudado $15.000, pozo $12.000, plataforma $3.000. Con 2 cartones ganadores, cada uno se lleva $6.000.
- **Reparto:** `monto_por_ganador = floor(pozo_total / cantidad_ganadores * 100) / 100`. El resto de redondeo (centavos) queda en la plataforma.
- **Sin ganadores:** el `pozo_total` completo pasa como `pozo_acumulado_saliente` y se suma al pozo de la próxima jornada de la misma liga (nunca entre ligas).
- **Liquidación de jornada (acción del admin).** Hasta que el admin liquida, el pozo y los ganadores se calculan en vivo desde los datos actuales. Al liquidar, se congelan en `liquidaciones_jornada` y `ganadores_jornada`. Para liquidar:
  - la jornada debe tener al menos un partido y **todos** `finalizado`;
  - todas las jornadas anteriores de la liga que tengan partidos deben estar liquidadas (garantiza que la cadena de acumulado sea determinística);
  - la jornada no debe estar ya liquidada.
- **Congelamiento de resultados:** una vez liquidada la jornada, un trigger impide modificar o borrar sus partidos (goles, estado, jornada) y agregar partidos nuevos a ella.
- **Deshacer liquidación:** solo si ningún ganador de esa liquidación fue avisado y no existe una liquidación de una jornada posterior de la misma liga. Permite corregir un resultado cargado por error.
- **Aviso por email a ganadores:** botón "Enviar aviso" en el panel admin, solo sobre jornadas liquidadas. Envía un email por usuario ganador (consolidando sus cartones ganadores y el monto total) mediante un proveedor de email (Resend, vía `fetch`, sin dependencias nuevas). Se registra `avisado_en` por ganador, o `aviso_error` si falló, y es reintentable.
- **Panel admin de ganadores** (nueva pantalla por liga): selector de jornada; resumen con recaudado, pozo (80%), acumulado entrante, pozo total y comisión (20%); tabla de ganadores con nombre, **email** (para poder contactarlos), cantidad de cartones, monto y estado del aviso; acciones Liquidar / Enviar aviso / Deshacer.
- **Pozo visible para el usuario:** en la pantalla de pronósticos, donde hoy dice `{cargados} de {totalPosibles} cargados`, se muestra el **pozo total actual** de la jornada ("Pozo para el ganador: $X", equivalente a lo recaudado menos el 20%, más el acumulado). El conteo de cartones cargados / créditos pasa a subtexto secundario. Se calcula en cada request del servidor (no en tiempo real).

**Out of scope (for future specs):**

- Pago efectivo del premio (transferencia al ganador) y marca de "pagado".
- Mostrar nombres o identidad de los ganadores a otros usuarios (los usuarios solo ven el monto del pozo y, en jornadas liquidadas, la cantidad de ganadores).
- Premios parciales: segundo lugar, aciertos de signo, puntos por partido, ranking de usuarios.
- Configurar el porcentaje del pozo desde la UI (queda en la columna `ligas.porcentaje_pozo`, editable solo por SQL).
- Envío automático de emails, cron jobs o notificaciones push/in-app.
- Cliente con service role (todo corre con la sesión del admin y RLS).
- Destino del pozo acumulado de la última jornada de una liga si termina sin ganadores.
- Aspectos legales, impositivos y de cumplimiento de juegos con dinero real.
- Verificación real del pago de créditos (hoy la activación de suscripción es temporal y automática, SPEC 06).

## Data model

Dos columnas nuevas, dos tablas nuevas, cuatro funciones y un trigger en `public`:

```sql
-- Porcentaje del recaudado que va al pozo; el resto es de la plataforma
alter table public.ligas
  add column porcentaje_pozo numeric(5,2) not null default 80
  check (porcentaje_pozo between 0 and 100);

-- Snapshot del valor del prode al momento de crearlo
alter table public.cartones
  add column monto numeric(10,2) not null default 0
  check (monto >= 0);

-- Backfill de cartones existentes: precio del plan / créditos del plan
update public.cartones c
set monto = round(p.precio / nullif(p.cantidad_creditos, 0), 2)
from public.creditos_lotes l
join public.planes p on p.id = l.plan_id
where l.id = c.lote_id;

-- Liquidación congelada de una jornada de una liga
create table public.liquidaciones_jornada (
  id                        uuid primary key default gen_random_uuid(),
  liga_id                   uuid not null references public.ligas (id),
  jornada                   integer not null,
  recaudado                 numeric(12,2) not null,
  porcentaje_pozo           numeric(5,2) not null,
  pozo_jornada              numeric(12,2) not null,
  comision_plataforma       numeric(12,2) not null,
  pozo_acumulado_entrante   numeric(12,2) not null default 0,
  pozo_total                numeric(12,2) not null,
  cantidad_ganadores        integer not null default 0,
  monto_por_ganador         numeric(12,2) not null default 0,
  pozo_acumulado_saliente   numeric(12,2) not null default 0,
  liquidada_por             uuid not null references public.usuarios (id),
  liquidada_en              timestamptz not null default now(),
  unique (liga_id, jornada)
);

alter table public.liquidaciones_jornada enable row level security;

create policy "liquidaciones_select_admin"
on public.liquidaciones_jornada for select
to authenticated
using ( public.is_admin() );

grant select on public.liquidaciones_jornada to authenticated;
-- Sin grants de insert/update/delete: se escribe solo vía liquidar_jornada() / deshacer_liquidacion()

-- Cartones ganadores de una liquidación (un registro por cartón)
create table public.ganadores_jornada (
  id               uuid primary key default gen_random_uuid(),
  liquidacion_id   uuid not null references public.liquidaciones_jornada (id),
  carton_id        uuid not null unique references public.cartones (id),
  usuario_id       uuid not null references public.usuarios (id),
  email            text not null,          -- snapshot del email al liquidar
  monto_premio     numeric(12,2) not null,
  avisado_en       timestamptz,
  aviso_error      text
);

alter table public.ganadores_jornada enable row level security;

create policy "ganadores_select_admin"
on public.ganadores_jornada for select
to authenticated
using ( public.is_admin() );

create policy "ganadores_update_admin"
on public.ganadores_jornada for update
to authenticated
using ( public.is_admin() )
with check ( public.is_admin() );

grant select on public.ganadores_jornada to authenticated;
grant update (avisado_en, aviso_error) on public.ganadores_jornada to authenticated;

-- crear_carton(): tras consumir_credito(), lee el monto del plan del lote y lo
-- guarda en cartones.monto (coalesce a 0 si el lote no tiene plan). El resto
-- de la función (SPEC 05) no cambia.

-- Pozo de una jornada: devuelve los valores congelados si está liquidada, o el
-- cálculo en vivo si no. Solo agregados; sin datos personales. Lo puede llamar
-- cualquier usuario autenticado (necesita security definer porque RLS impide
-- leer los cartones ajenos).
create or replace function public.pozo_jornada(p_liga_id uuid, p_jornada integer)
returns table (
  recaudado numeric, cantidad_cartones integer, pozo_jornada numeric,
  pozo_acumulado_entrante numeric, pozo_total numeric,
  liquidada boolean, cantidad_ganadores integer
)
language plpgsql stable security definer set search_path = public
as $$ /* ... */ $$;

-- Cartones que cumplen la regla de ganador hoy (solo admin; 'no_autorizado' si no)
create or replace function public.ganadores_provisorios(p_liga_id uuid, p_jornada integer)
returns table (carton_id uuid, usuario_id uuid, nombre text, email text)
language plpgsql stable security definer set search_path = public
as $$ /* ... */ $$;

-- Liquida la jornada de forma atómica (solo admin). Errores:
-- no_autorizado | jornada_sin_partidos | partidos_pendientes |
-- jornadas_previas_sin_liquidar | jornada_ya_liquidada
create or replace function public.liquidar_jornada(p_liga_id uuid, p_jornada integer)
returns uuid
language plpgsql security definer set search_path = public
as $$ /* ... */ $$;

-- Revierte una liquidación (solo admin). Errores:
-- no_autorizado | liquidacion_inexistente | ganadores_ya_avisados |
-- liquidacion_posterior_existente
create or replace function public.deshacer_liquidacion(p_liga_id uuid, p_jornada integer)
returns void
language plpgsql security definer set search_path = public
as $$ /* ... */ $$;

-- Bloquea cambios en partidos de jornadas liquidadas
create or replace function public.bloquear_partido_jornada_liquidada()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if exists (
    select 1 from public.liquidaciones_jornada
    where liga_id = coalesce(old.liga_id, new.liga_id)
      and jornada = coalesce(old.jornada, new.jornada)
  ) then
    raise exception 'jornada_liquidada';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger partidos_bloquear_jornada_liquidada
before insert or update or delete on public.partidos
for each row execute function public.bloquear_partido_jornada_liquidada();
```

Conventions:

- Un cartón es ganador si **no existe** ningún partido de su jornada para el que le falte un pronóstico exacto sobre un partido `finalizado`. `ganadores_provisorios` y `liquidar_jornada` usan exactamente la misma consulta para que el panel y el resultado congelado nunca difieran.
- `monto = 0` (lote sin plan, o crédito otorgado sin costo) es válido y aporta $0 al pozo.
- `cantidad_ganadores = 0` → `monto_por_ganador = 0` y `pozo_acumulado_saliente = pozo_total`. Con ganadores, `pozo_acumulado_saliente = 0`.
- `pozo_acumulado_entrante` se toma de la liquidación de la jornada máxima menor a la actual en la misma liga; por eso liquidar exige que las anteriores estén liquidadas.
- En `pozo_jornada` en vivo, si alguna jornada anterior todavía no fue liquidada, el acumulado entrante puede estar subestimado hasta que se liquide (ver Risks).
- Ningún cliente tiene grants de escritura sobre `liquidaciones_jornada` ni `ganadores_jornada` salvo el `update` acotado de `avisado_en` / `aviso_error` para admin. `grant execute` explícito de `pozo_jornada` a `authenticated`; las demás validan `is_admin()` adentro.
- Toda tabla nueva lleva `grant` explícito a `authenticated` (`auto_expose_new_tables = false`).

## Implementation plan

1. **Migración `supabase/migrations/20260928100000_pozo_ganadores_liquidacion.sql`**, parte de esquema: `ligas.porcentaje_pozo`, `cartones.monto` con backfill, tablas `liquidaciones_jornada` y `ganadores_jornada` con RLS y grants. Redefinir `crear_carton` (`20260926130000_planes_creditos_cartones_pronosticos.sql`, líneas 214-285) con `create or replace` para guardar `monto`; el resto de la función queda idéntico.
   - Manual test: los cartones existentes quedan con `monto = precio / créditos` de su plan; crear un cartón nuevo con un lote de plan mensual_4 guarda `1250`, con `suelto` guarda `1500`; un usuario no admin no puede leer `liquidaciones_jornada` ni `ganadores_jornada`.
2. **Migración, parte de funciones:** `pozo_jornada`, `ganadores_provisorios`, `liquidar_jornada`, `deshacer_liquidacion` y trigger `partidos_bloquear_jornada_liquidada`.
   - Manual test: con 3 cartones, uno con todos los marcadores exactos, `ganadores_provisorios` devuelve solo ese; liquidar con un partido pendiente falla con `partidos_pendientes`; liquidar la jornada 2 sin liquidar la 1 falla con `jornadas_previas_sin_liquidar`; liquidar dos veces falla con `jornada_ya_liquidada`; tras liquidar, editar un resultado o agregar un partido a esa jornada falla con `jornada_liquidada`; con 2 ganadores y pozo $12.000 cada uno recibe $6.000; sin ganadores, el pozo total queda como acumulado saliente y aparece como entrante al liquidar la jornada siguiente; un usuario no admin que llame a `liquidar_jornada` recibe `no_autorizado`.
3. **Lógica pura `src/lib/pozo.ts`:** tipos TS, formateo ARS (`toLocaleString("es-AR", { style: "currency", currency: "ARS" })`, mismo criterio que `planes-suscripcion.tsx`), y una función que replica el reparto (`floor` a centavos) para poder verificar montos con arrays armados a mano, como `src/lib/estadisticas.ts`.
   - Manual test: `repartirPozo(12000, 2)` → 6000 por ganador; `repartirPozo(100, 3)` → 33.33 y 0.01 de resto; `repartirPozo(500, 0)` → 0 y acumulado 500.
4. **Pozo visible al usuario** en `src/app/(app)/ligas/[id]/pronosticos/page.tsx` (línea 241, donde hoy se renderiza `{cargados} de {totalPosibles} cargados`): llamar a `pozo_jornada` para la jornada seleccionada y mostrar "Pozo para el ganador: $X" como dato principal, con `{cargados} de {totalPosibles} cargados` como subtexto. En jornadas liquidadas mostrar "Pozo repartido" y la cantidad de ganadores, sin identidades.
   - Manual test: con la jornada 1 abierta y ningún cartón, el pozo muestra $0; después de que un usuario crea un cartón de $1.500 el pozo muestra $1.200 (80%); un segundo usuario ve el mismo valor; con un acumulado entrante de $500 el pozo suma $500; el conteo de cartones sigue visible como subtexto.
5. **Panel admin de ganadores:** nueva ruta `src/app/(admin)/admin/ligas/[id]/ganadores/` con `page.tsx`, `actions.ts` (`liquidarJornada`, `deshacerLiquidacion`, `enviarAvisoGanadores`, que llaman a los RPC de los pasos 1-2 y traducen errores como `mensajeErrorRpc` de `pronosticos/actions.ts`, líneas 41-62) y componentes de tabla/acciones. Agregar el enlace en `src/app/(admin)/admin/ligas/page.tsx` (líneas 51-74, junto a equipos/partidos/usuarios). En `partidos-admin.tsx`, mostrar un aviso y deshabilitar la edición cuando la jornada está liquidada.
   - Manual test: el selector lista solo jornadas con partidos; la tabla muestra nombre, email, cantidad de cartones y monto de cada ganador; "Liquidar" queda deshabilitado si hay partidos pendientes y muestra el motivo; tras liquidar, los valores dejan de cambiar aunque se creen cartones; "Deshacer" funciona antes del aviso y queda deshabilitado después.
6. **Email:** `src/lib/email.ts` (`import "server-only"`, `fetch` a `https://api.resend.com/emails` con `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` en `.env.local`) y la acción `enviarAvisoGanadores`. Como el envío no está cubierto por RLS, la acción **verifica el rol admin** con `getUsuarioActual()` (`src/lib/usuario-actual.ts`) antes de enviar. Agrupa los ganadores sin `avisado_en` por usuario, envía un email por usuario con liga, jornada, cantidad de cartones ganadores y monto total, y actualiza `avisado_en` o `aviso_error` de sus filas. Solo opera sobre jornadas liquidadas.
   - Manual test: con un ganador y variables configuradas, llega el email con el monto correcto y `avisado_en` queda cargado; un usuario con dos cartones ganadores recibe un solo email con la suma; sin `RESEND_API_KEY` la acción devuelve un error claro y no marca nada como avisado; reintentar solo envía a quienes no tienen `avisado_en`; un usuario no admin que invoque la acción es rechazado.
7. **Prueba manual end-to-end:** liga con 2 partidos en la jornada 1; tres usuarios cargan cartones (dos con el marcador exacto final, uno errado); el admin carga resultados, liquida, verifica pozo y reparto, envía el aviso, y comprueba que los emails llegaron. Luego repetir con una jornada 2 sin ganadores y verificar que el pozo se acumula en la jornada 3.

## Acceptance criteria

- [ ] `cartones.monto` se guarda al crear un cartón con el valor `precio / cantidad_creditos` del plan del lote consumido, y los cartones existentes tienen backfill.
- [ ] Un cartón es ganador solo si acertó el marcador exacto de todos los partidos finalizados de su jornada.
- [ ] El pozo mostrado al usuario es el 80% de lo recaudado en la jornada más el acumulado entrante, y coincide con el que ve el admin.
- [ ] Donde antes decía `X de Y cargados`, la pantalla de pronósticos muestra el pozo total actual de la jornada.
- [ ] Con N ganadores, cada cartón ganador recibe `floor(pozo_total / N)` a centavos; con 0 ganadores el pozo pasa a la jornada siguiente de la misma liga.
- [ ] No se puede liquidar una jornada con partidos pendientes, sin partidos, ya liquidada, o con jornadas anteriores sin liquidar.
- [ ] Una jornada liquidada no admite cambios en sus partidos, ni agregar partidos nuevos.
- [ ] Se puede deshacer una liquidación solo si nadie fue avisado y no hay liquidación posterior.
- [ ] El panel admin muestra ganadores con nombre, email, cantidad de cartones, monto y estado del aviso.
- [ ] El botón "Enviar aviso" manda un email por usuario ganador con el monto total y registra `avisado_en` o `aviso_error`; los reintentos no duplican envíos.
- [ ] Un usuario no admin no puede leer liquidaciones ni ganadores, ni ejecutar `liquidar_jornada`, `deshacer_liquidacion`, `ganadores_provisorios` ni `enviarAvisoGanadores`.
- [ ] El usuario no puede ver cartones, nombres ni emails de otros usuarios a través de `pozo_jornada`.

## Decisions

- **Yes:** ganador = marcador exacto en todos los partidos, sin puntos parciales. Es la definición pedida por el negocio y hace el cálculo binario y auditable.
- **Yes:** cada cartón ganador cuenta por separado. Un usuario que juega más cartones asume más costo y por eso puede cobrar más partes; el email se consolida por usuario para no spamear.
- **Yes:** snapshot de `monto` en `cartones`. `planes.precio` es editable y `creditos_lotes` no guarda el precio pagado; sin snapshot el pozo histórico cambiaría al editar un plan.
- **Yes:** `porcentaje_pozo` como columna de `ligas` (default 80) en lugar de constante. Una única fuente de verdad para SQL y TS, y cada liquidación guarda el porcentaje aplicado.
- **Yes:** liquidación explícita del admin. Los resultados `finalizado` hoy son corregibles indefinidamente; congelar automáticamente por trigger convertiría un error de carga en un pago mal calculado.
- **Yes:** el pozo sin ganadores se acumula a la próxima jornada de la misma liga. Aumenta el incentivo y evita decidir manualmente el destino del dinero.
- **Yes:** aviso por botón del admin vía Resend con `fetch`. Evita una dependencia nueva y envíos ante errores de carga; el admin ve los emails para contactar también a mano.
- **Yes:** verificar el rol admin explícitamente en `enviarAvisoGanadores`. Las demás acciones de admin se apoyan en RLS, pero el envío de email no pasa por RLS.
- **Yes:** `pozo_jornada` como función `security definer` con solo agregados. Los usuarios no pueden leer cartones ajenos por RLS, pero sí deben ver el pozo.
- **No:** premios parciales ni ranking por puntos. Cambiaría la definición de ganador y el modelo de reparto; queda para una spec propia.
- **No:** service role ni cron. Todo se resuelve con la sesión del admin y RPC; el proyecto hoy no tiene esa infraestructura y las specs 05 y 06 la descartaron.
- **No:** mostrar identidad de ganadores a otros usuarios. Privacidad; se comunican solo por email.
- **No:** marca de "pagado" en esta spec. El objetivo es calcular, registrar y avisar; el circuito de cobro se especifica aparte.

## Risks

| Risk | Mitigation |
|------|-----------|
| Los créditos hoy se activan sin verificar pago (`activar_suscripcion_liga` temporal, SPEC 06) y `otorgar_plan_admin` otorga créditos sin cobro: el pozo se infla con dinero no recibido. | El monto sale del plan aunque no haya cobro real. Antes de producción, revertir la activación automática y decidir si los créditos otorgados por admin aportan al pozo (por ejemplo, con `monto = 0`). |
| `planes.precio` es editable y el precio se toma al **crear el cartón**, no al comprar el lote. | Documentado; crear un plan nuevo en lugar de editar (recomendación de SPEC 04). Un `precio_unitario` en `creditos_lotes` puede resolverlo en una spec futura. |
| El acumulado entrante en vivo puede estar subestimado si una jornada anterior no fue liquidada. | La liquidación exige orden estricto; el panel admin advierte "jornadas previas sin liquidar" y el pozo definitivo solo se fija al liquidar. |
| Un resultado mal cargado y liquidado genera un aviso de premio incorrecto. | El aviso es un paso separado y deshacer está permitido hasta avisar; el admin debe revisar la tabla antes de enviar. |
| Resend solo envía a terceros con dominio verificado; sin configuración el aviso falla. | La acción devuelve un error claro y registra `aviso_error`; los emails visibles en el panel permiten contactar manualmente. |
| Redondeo a centavos deja restos. | El resto queda en la plataforma y se guarda: `pozo_total - monto_por_ganador * cantidad_ganadores` es derivable. |
| Última jornada sin ganadores deja un pozo acumulado sin destino. | Fuera de alcance; el valor queda registrado en `pozo_acumulado_saliente` para decidirlo después. |
| Emails de ganadores expuestos en el panel admin. | Solo visibles para admin por RLS; el snapshot en `ganadores_jornada` no es legible para usuarios comunes. |
| Manejar dinero real tiene implicancias legales/impositivas. | Fuera de alcance de esta spec; debe revisarse antes del lanzamiento con pagos reales. |

## Actualización 2026-09-28 — Implementación y configuración de pruebas

- Migración aplicada: `supabase/migrations/20260928100000_pozo_ganadores_liquidacion.sql`. Además de lo descrito, agrega el helper interno `cartones_ganadores(liga_id, jornada)` (sin ejecución para clientes) con la regla única de ganador, usado por `ganadores_provisorios` y `liquidar_jornada`. `ganadores_provisorios` devuelve `carton_id, usuario_id, nombre, email` (el monto por ganador lo calcula la pantalla con `repartirPozo`).
- Archivos: `src/lib/pozo.ts`, `src/lib/email.ts`, `src/app/(admin)/admin/ligas/[id]/ganadores/` (`page.tsx`, `acciones-ganadores.tsx`, `actions.ts`), aviso de jornada liquidada en `partidos-admin.tsx` y errores `jornada_liquidada` traducidos en `partidos/actions.ts`.
- Los créditos siguen activándose sin verificar el pago (a propósito, para probar); la validación de cuenta y de comprobante queda para una spec futura. El cobro del premio y la marca de "pagado" también.
- **Emails de prueba:** Resend sin dominio verificado solo entrega al email dueño de la cuenta de Resend. Para pruebas se usa `EMAIL_FROM="Prode <onboarding@resend.dev>"`, con la cuenta de Resend registrada con el email de prueba y los ganadores de prueba usando ese mismo email. Variables en `.env.local`: `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `NEXT_PUBLIC_SITE_URL`. Para producción hay que verificar un dominio propio en Resend y cambiar `EMAIL_FROM`.
- El email tiene diseño propio (cabecera, monto destacado, instrucciones de cobro) con versión de texto plano.

## What is **not** in this spec

- Pago efectivo del premio y marca de "pagado".
- Identidad de ganadores visible para otros usuarios.
- Premios parciales, segundo lugar, aciertos de signo y ranking por puntos.
- Porcentaje del pozo configurable desde la UI.
- Emails automáticos, cron jobs, notificaciones push o in-app.
- Cliente con service role.
- Destino del pozo acumulado de la última jornada.
- Verificación real de pagos de créditos y aspectos legales/impositivos.

Cada uno de estos, si se implementa, va en su propio spec.
