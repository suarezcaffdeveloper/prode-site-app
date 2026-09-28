# SPEC 10 — Subgrupos: Ranking, Cartón que Compite y Nueva Visual

> **Status:** Implementado (pendiente de prueba manual en UI) · **Depends on:** SPEC 01, SPEC 05, SPEC 08, SPEC 09 · **Date:** 2026-09-28
> **Objective:** Convertir los subgrupos, hoy una simple lista de miembros con código de invitación, en una competencia entre amigos con tabla de posiciones propia. Cada miembro compite con **un solo cartón por jornada**, para que nadie tenga ventaja por comprar más prodes, y se puntúa por partido (exacto, signo y bonus por jornada perfecta). El subgrupo no cobra ni reparte dinero: es una lente social sobre los cartones que el usuario ya juega, y el pozo (SPEC 09) no cambia. Incluye la nueva visual de `/grupos/[id]`: hero, tabla, jornadas, miembros y reglas.

## Scope

**In:**

- **Cartón que compite.** Por cada `(usuario, liga, jornada)` exactamente un cartón está marcado como el que compite en los subgrupos (`cartones.es_principal`).
  - Por defecto es el **primero** que el usuario cargó en esa jornada.
  - El usuario puede elegir otro de sus cartones de esa jornada hasta el cierre (30 minutos antes del primer partido, SPEC 05). Después del cierre queda fijo.
  - Vale para **todos** los subgrupos del usuario en esa liga (no se elige uno por subgrupo).
  - Los cartones que no compiten en el subgrupo siguen participando por el pozo de la jornada (SPEC 09), sin ningún cambio.
- **Puntaje por partido** (solo partidos `finalizado`):
  - Marcador exacto: **3 puntos**.
  - Sin marcador exacto pero mismo resultado (gana local, gana visitante o empate): **1 punto**.
  - Cualquier otro caso: 0.
  - **Bonus de jornada perfecta: +5** cuando el cartón acierta el marcador exacto de todos los partidos de la jornada y todos están `finalizado`.
  - Un partido sin pronóstico en el cartón (por ejemplo, agregado después) suma 0 y impide el bonus.
- **Tabla de posiciones del subgrupo** (acumulada): posición, miembro, jornadas jugadas, exactos, puntos. Orden: puntos, luego cantidad de exactos, luego jornadas perfectas, luego nombre (alfabético, case-insensitive) para que sea determinístico.
- **Detalle por jornada:** selector de jornada con los puntos de cada miembro en esa jornada y, desde el cierre, el cartón que compite de cada uno contra el resultado real, partido por partido.
- **Ingreso tardío:** a un miembro solo le cuentan las jornadas cuyo cierre es **posterior** al momento en que se unió al subgrupo (`membresias_grupo.created_at`).
- **Visibilidad de cartones ajenos:** desde el cierre de la jornada, cualquier miembro del subgrupo ve el cartón que compite de los demás. Antes del cierre son privados, para evitar copiarse.
- **Miembros:** lista con nombre, fecha de ingreso, marca de creador y estado (activo / inactivo según la suscripción a la liga, SPEC 01). Un miembro inactivo se muestra atenuado y **fuera del ranking**, sin perder su membresía. Nunca se muestra el email de otros miembros, solo el nombre.
- **Nueva visual de `/grupos/[id]`:** hero (nombre, liga, código con botón de compartir por WhatsApp, cantidad de miembros, mi posición y líder), aviso con el cartón que compite en la jornada actual, tabla, jornadas, miembros, "cómo se puntúa" y la gestión del creador ya existente (renombrar, echar, eliminar).
- **Selector en Pronósticos:** cuando el usuario pertenece a al menos un subgrupo de la liga y tiene más de un cartón en la jornada, cada cartón muestra si es el que compite y permite elegirlo.

**Out of scope (for future specs):**

- Pozo, premios o cobros por subgrupo. El subgrupo es solo competencia por puntos.
- Ranking global de usuarios de la liga (fuera de los subgrupos).
- Puntos configurables por liga o por subgrupo desde la UI (quedan como constantes en código).
- Elegir un cartón distinto por subgrupo.
- Chat, comentarios, reacciones, notificaciones o avisos por email del subgrupo.
- Invitación por link con token (se mantiene el código corto de SPEC 01).
- Historial por temporada, medallas o logros.
- Eliminar un cartón ya creado (sigue fuera de alcance, SPEC 05).
- Cambios en la definición de ganador o en el pozo (SPEC 09).

## Data model

Una migración nueva: `supabase/migrations/<timestamp>_subgrupos_ranking.sql`. No hay tablas nuevas: una columna, un trigger, un helper y tres funciones.

```sql
-- Cartón que compite en los subgrupos (uno por usuario/liga/jornada)
alter table public.cartones
  add column es_principal boolean not null default false;

create unique index cartones_un_principal_por_jornada
on public.cartones (usuario_id, liga_id, jornada)
where es_principal;

-- Backfill: el cartón más antiguo de cada (usuario, liga, jornada) compite
update public.cartones c
set es_principal = true
from (
  select distinct on (usuario_id, liga_id, jornada) id
  from public.cartones
  order by usuario_id, liga_id, jornada, created_at asc, id asc
) primero
where c.id = primero.id;

-- Un cartón nuevo nace como principal si es el primero del usuario en esa
-- (liga, jornada). Se hace con trigger para no redefinir crear_carton() por
-- cuarta vez (SPEC 05, SPEC 09 y notificaciones ya la redefinieron). Toma un
-- advisory lock para que dos altas simultáneas no queden ambas como principal.
create or replace function public.cartones_marcar_principal()
returns trigger
language plpgsql
as $$
begin
  perform pg_advisory_xact_lock(
    hashtext(new.usuario_id::text || new.liga_id::text || new.jornada::text)
  );
  if not exists (
    select 1 from public.cartones
    where usuario_id = new.usuario_id
      and liga_id = new.liga_id
      and jornada = new.jornada
  ) then
    new.es_principal := true;
  end if;
  return new;
end;
$$;

create trigger cartones_marcar_principal
before insert on public.cartones
for each row execute function public.cartones_marcar_principal();

-- Hora de cierre de una jornada: 30 minutos antes del primer partido, o null
-- si a algún partido le falta fecha_hora. Misma fórmula que jornada_activa()
-- (20260926150000), pero para cualquier jornada y no solo la activa.
create or replace function public.hora_cierre_jornada(p_liga_id uuid, p_jornada integer)
returns timestamptz
language sql
stable
as $$
  select case
    when bool_and(p.fecha_hora is not null) then min(p.fecha_hora) - interval '30 minutes'
    else null
  end
  from public.partidos p
  where p.liga_id = p_liga_id and p.jornada = p_jornada
  having count(*) > 0;
$$;

-- Elegir cuál cartón compite. Errores: no_autenticado | carton_no_encontrado |
-- jornada_cerrada. Mismo criterio de "abierta" que crear/actualizar_carton():
-- la jornada del cartón debe ser la activa y hora_cierre > now().
-- Baja el flag del anterior y sube el nuevo en la misma transacción.
create or replace function public.elegir_carton_principal(p_carton_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$ /* ... */ $$;

-- Miembros del subgrupo con nombre y estado. Solo miembros del grupo
-- ('no_autorizado' si no). Sin email: usuarios tiene RLS "propio o admin".
create or replace function public.miembros_grupo(p_grupo_id uuid)
returns table (
  usuario_id uuid, membresia_id uuid, nombre text, unido_en timestamptz,
  es_creador boolean, suscripcion_activa boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$ /* ... */ $$;

-- Pronósticos del cartón que compite de cada miembro, solo de jornadas ya
-- cerradas y posteriores al ingreso del miembro. Solo miembros del grupo.
-- Nunca devuelve cartones que no compiten, jornadas abiertas ni datos personales.
create or replace function public.pronosticos_grupo(p_grupo_id uuid)
returns table (
  usuario_id uuid, jornada integer, carton_id uuid, partido_id uuid,
  goles_local_prediccion integer, goles_visitante_prediccion integer
)
language plpgsql
stable
security definer
set search_path = public
as $$ /* ... */ $$;

grant execute on function public.elegir_carton_principal(uuid) to authenticated;
grant execute on function public.miembros_grupo(uuid) to authenticated;
grant execute on function public.pronosticos_grupo(uuid) to authenticated;
```

Conventions:

- `pronosticos_grupo` filtra por `es_principal`, por `hora_cierre_jornada(...) <= now()` y por `hora_cierre_jornada(...) >= membresias_grupo.created_at` del miembro. Como el cierre es siempre anterior al primer partido, cualquier partido `finalizado` pertenece a una jornada ya cerrada y visible.
- Los usuarios **no** tienen grant de `update` sobre `cartones`: el flag `es_principal` solo cambia por `elegir_carton_principal` y por el trigger de alta.
- El **resultado real** de cada partido sale de `partidos`, legible por cualquier autenticado. Las funciones exponen solo pronósticos, así el cálculo del puntaje vive en un único lugar (TypeScript), como en SPEC 08 y SPEC 09.
- No hay cambios de RLS en `cartones`, `pronosticos`, `grupos` ni `membresias_grupo`. Las acciones del creador (renombrar, echar, eliminar) no cambian.
- El helper `hora_cierre_jornada` no existía: `jornada_activa()` calcula el cierre inline solo para la jornada activa. La migración lo extrae sin modificar `jornada_activa()`.

Lógica pura, sin I/O, en `src/lib/puntos-grupo.ts` (mismo patrón que `src/lib/estadisticas.ts` y `src/lib/pozo.ts`):

```ts
export const PUNTOS_EXACTO = 3;
export const PUNTOS_SIGNO = 1;
export const BONUS_JORNADA_PERFECTA = 5;

export type MiembroGrupo = {
  usuarioId: string;
  nombre: string;
  unidoEn: string;
  esCreador: boolean;
  activo: boolean;
};

export type PartidoPuntuable = {
  id: string;
  jornada: number;
  finalizado: boolean;
  golesLocal: number | null;
  golesVisitante: number | null;
};

export type PronosticoGrupo = {
  usuarioId: string;
  jornada: number;
  cartonId: string;
  partidoId: string;
  golesLocal: number;
  golesVisitante: number;
};

export type FilaGrupo = {
  usuarioId: string;
  nombre: string;
  pos: number | null; // null si el miembro está inactivo (fuera del ranking)
  pts: number;
  exactos: number;
  signos: number;
  perfectas: number;
  jornadasJugadas: number;
  activo: boolean;
};

export function puntosPartido(pred: { golesLocal: number; golesVisitante: number }, real: { golesLocal: number; golesVisitante: number }): 0 | 1 | 3;
export function calcularTablaGrupo(miembros: MiembroGrupo[], pronosticos: PronosticoGrupo[], partidos: PartidoPuntuable[]): FilaGrupo[];
export function calcularDetalleJornada(jornada: number, miembros: MiembroGrupo[], pronosticos: PronosticoGrupo[], partidos: PartidoPuntuable[]): DetalleJornada;
```

Definiciones:

| Métrica | Definición |
| --- | --- |
| Puntos de un partido | 3 si `golesLocal` y `golesVisitante` coinciden con el resultado; 1 si `sign(gl − gv)` coincide (local, empate o visitante); 0 en cualquier otro caso. Solo si el partido está `finalizado`. |
| Jornada perfecta | El cartón tiene pronóstico exacto para **todos** los partidos de la jornada y todos están `finalizado`. Suma el bonus una sola vez por jornada. |
| Jornada jugada (de un miembro) | Jornada cerrada, posterior a su ingreso, con al menos un partido `finalizado`. |
| Exactos / signos | Cantidad de partidos puntuados con 3 / con 1, acumulados en todas las jornadas que cuentan. |
| Miembro sin cartón | 0 puntos en esa jornada; el detalle muestra "Sin cartón". |
| Miembro inactivo | Aparece en la tabla atenuado, sin posición y por debajo de los activos. |

## Implementation plan

1. **Migración `supabase/migrations/<timestamp>_subgrupos_ranking.sql`:** columna `es_principal`, índice único parcial, backfill, trigger, `hora_cierre_jornada`, `elegir_carton_principal` y grants. Aplicar con `supabase migration up`; **no** usar `supabase db reset` (borra los datos locales).
   - Manual test: los cartones existentes quedan con exactamente uno principal por `(usuario, liga, jornada)`; un usuario con 3 cartones nuevos en una jornada tiene solo el primero como principal; `elegir_carton_principal` sobre el tercero deja solo ese en `true`; la misma llamada con la jornada cerrada falla con `jornada_cerrada`; llamarla sobre el cartón de otro usuario falla con `carton_no_encontrado`; un `update` directo de `es_principal` desde un cliente autenticado es rechazado.
2. **Migración, funciones de lectura:** `miembros_grupo` y `pronosticos_grupo`.
   - Manual test: un no miembro recibe `no_autorizado` en ambas; `miembros_grupo` no incluye emails; con la jornada abierta `pronosticos_grupo` no devuelve nada de esa jornada, y una vez pasado el cierre devuelve solo el cartón principal de cada miembro (no los otros); un miembro que se unió después del cierre de la jornada 1 no tiene filas de la jornada 1.
3. **Lógica pura `src/lib/puntos-grupo.ts`.**
   - Manual test con arrays armados a mano: 2–1 contra 2–1 = 3; 2–0 contra 3–1 = 1; 1–1 contra 2–2 = 1; 1–0 contra 0–1 = 0; jornada de 3 partidos con 3 exactos = 9 + 5 = 14; un partido pendiente no suma ni permite el bonus; miembro sin cartón = 0; miembro inactivo queda sin `pos` y al final; dos miembros empatados en puntos se desempatan por exactos, luego por perfectas, luego por nombre; miembro con `unidoEn` posterior al cierre de la jornada 1 no cuenta esa jornada.
4. **Selector en Pronósticos:** server action `elegirCartonPrincipal(cartonId)` en `src/app/(app)/ligas/[id]/pronosticos/actions.ts` (llama a `elegir_carton_principal` y traduce `jornada_cerrada` con `mensajeErrorRpc`), y en `carton-card.tsx` la marca "Compite en tus subgrupos" con botón para elegir, visible solo si el usuario pertenece a algún subgrupo de la liga y tiene más de un cartón en la jornada; deshabilitado tras el cierre. `pronosticos/page.tsx` trae `es_principal` y los subgrupos del usuario en la liga.
   - Manual test: con 2 cartones y un subgrupo, elegir el segundo cambia la marca y recarga; con 1 cartón o sin subgrupos la marca no aparece; tras el cierre el botón queda deshabilitado.
5. **`src/app/(app)/grupos/[id]/page.tsx`:** mantener `notFound()` para grupo inexistente o sin acceso; traer en paralelo `grupos`, `miembros_grupo`, `pronosticos_grupo`, los `partidos` de la liga (jornada, estado, goles) y `equipos`; calcular con `puntos-grupo.ts`. Reemplazar el join `usuarios(email, nombre)` por `miembros_grupo` (hoy el join no devuelve a los otros miembros por la RLS de `usuarios`).
   - Manual test: la página muestra el nombre de todos los miembros y nunca un email ajeno.
6. **Componentes de la visual** en `src/app/(app)/grupos/[id]/`: `grupo-hero.tsx`, `tabla-grupo.tsx`, `jornadas-grupo.tsx`, `miembros-grupo.tsx` y `como-se-puntua.tsx`. Reutilizar:
   - Hero: patrón de `ligas/[id]/estadisticas/estadisticas-hero.tsx` (imagen de estadio, `Reveal`, `NumeroAnimado`, CTA lime), con `MarcadorCodigo` y compartir por WhatsApp.
   - `RielSecciones` de `estadisticas/riel-secciones.tsx`, parametrizando el `aria-label` (hoy fijo en "Secciones de estadísticas").
   - Tabla con Pos y miembro fijos y scroll horizontal: patrón de `estadisticas/tabla-posiciones.tsx`.
   - Selector de jornada: patrón de `pronosticos/filtro-jornadas.tsx`.
   - `Card`, `MarcadorActiva` y `MarcadorCodigo` de `src/components/ui`.
   - La gestión del creador (`gestion-creador.tsx`, `actions.ts`) se mantiene sin cambios de comportamiento.
   - Manual test: recorrer las cuatro secciones en 375, 768 y 1280 px; la tabla se desliza sin generar scroll horizontal de página; la fila propia y el líder se distinguen; los estados vacíos (sin resultados, sin cartones) muestran un mensaje claro.
7. **Notas cruzadas:** en SPEC 01 (criterios de subgrupos) y SPEC 09 (Out of scope: "ranking por puntos") agregar que el ranking de subgrupos vive en SPEC 10.
8. **Prueba de punta a punta (manual):** subgrupo con 3 miembros, uno con 3 cartones en la jornada; verificar que por defecto compite el primero y que se puede cambiar hasta el cierre; que antes del cierre no se ven cartones ajenos y después sí; cargar resultados y verificar puntos, bonus y orden; sumar un cuarto miembro después del cierre de la jornada 1 y verificar que esa jornada no le cuenta; desactivar la suscripción de un miembro y verificar que sale del ranking sin perder la membresía; confirmar que el pozo y los ganadores de SPEC 09 no cambiaron.

## Acceptance criteria

- [ ] Por cada `(usuario, liga, jornada)` con cartones hay exactamente un cartón con `es_principal = true`, y el primero cargado nace como principal.
- [ ] El usuario puede elegir otro de sus cartones como el que compite hasta el cierre de la jornada; después no puede, y nunca puede tocar el de otro usuario.
- [ ] Un usuario con 3 cartones tiene una sola entrada en el ranking del subgrupo; los otros dos siguen participando por el pozo.
- [ ] Marcador exacto suma 3, mismo resultado sin marcador exacto suma 1, y una jornada con todos los marcadores exactos y todos los partidos finalizados suma +5.
- [ ] Los partidos `pendiente` no suman puntos ni permiten el bonus.
- [ ] La tabla del subgrupo ordena por puntos, exactos, jornadas perfectas y nombre, y el orden es determinístico.
- [ ] Un miembro sin cartón en una jornada tiene 0 puntos en esa jornada.
- [ ] Un miembro con suscripción inactiva se ve atenuado, sin posición y fuera del ranking, sin perder la membresía.
- [ ] A un miembro nuevo no le cuentan las jornadas cuyo cierre fue anterior a su ingreso.
- [ ] Antes del cierre de una jornada, un miembro no puede ver el cartón que compite de los demás; después del cierre sí.
- [ ] Solo los miembros del subgrupo pueden ver la tabla, los miembros y los cartones; un usuario ajeno recibe `no_autorizado`.
- [ ] Nunca se expone el email de otros miembros.
- [ ] La regla de ganador, los pozos y las liquidaciones de SPEC 09 no cambian.
- [ ] La página funciona en 375 px sin scroll horizontal de página, con tabla deslizable y columnas fijas.
- [ ] Renombrar, echar miembros y eliminar el subgrupo siguen funcionando solo para el creador.

## Decisions

- **Yes:** mantener los subgrupos. Son el gancho social del producto (compartir el código por WhatsApp y competir con amigos) y con la regla de un cartón por persona no le quitan justicia al juego.
- **Yes:** un solo cartón por persona y por jornada compite en el subgrupo. Cada cartón cuesta un crédito y quien compra más tendría más chances de acertar; limitarlo a uno da a todos la misma cantidad de intentos en la competencia entre amigos. Los cartones extra tienen su premio en el pozo.
- **Yes:** el cartón por defecto es el primero que cargó el usuario, y se puede cambiar hasta el cierre. Nadie tiene que elegir nada si juega un solo cartón; al quedar fijo al cierre, no se puede elegir "el mejor" viendo los resultados.
- **No:** contar el mejor cartón o el promedio de todos. El mejor cartón le da ventaja a quien juega más; el promedio empareja las chances pero hace que jugar más achate los resultados y nunca se pueda ganar por mucho.
- **Yes:** el cartón que compite vale para todos los subgrupos del usuario en esa liga. Una sola elección por jornada, sin tener que decidir por grupo.
- **Yes:** puntos 3 / 1 / +5, con partidos `finalizado`. La regla del pozo (todo exacto o nada) dejaría casi a todos en 0; el puntaje parcial mantiene viva la tabla, y el bonus premia el prode completo, que sigue siendo lo más difícil.
- **Yes:** las constantes de puntos viven en `src/lib/puntos-grupo.ts` y no en la base. El cálculo tiene un único dueño (TypeScript) y se puede verificar con arrays a mano, igual que `estadisticas.ts` y `pozo.ts`.
- **No:** puntos configurables desde la UI o por liga. Cambiaría el modelo de datos sin un pedido concreto.
- **Yes:** solo cuentan las jornadas que cierran después del ingreso del miembro. Nadie llega con ventaja ni entra solo por los puntos que ya hizo.
- **Yes:** los cartones ajenos son visibles desde el cierre de la jornada. Es la parte más divertida del subgrupo y ya no hay riesgo de copia, porque los cartones son inmutables.
- **Yes:** las funciones `security definer` exponen solo pronósticos del cartón principal de jornadas cerradas, y solo a miembros. La RLS de `cartones` y `pronosticos` no cambia.
- **Yes:** `miembros_grupo` devuelve solo el nombre, sin email. Hoy `usuarios` solo es legible por su dueño o el admin, así que el join de la página actual no devuelve a los demás.
- **Yes:** un miembro inactivo queda fuera del ranking pero conserva la membresía, en línea con SPEC 01.
- **Yes:** trigger para el flag `es_principal` en lugar de redefinir `crear_carton()`, que ya se redefinió tres veces (SPEC 05, SPEC 09 y notificaciones). Evita una cuarta copia de una función crítica.
- **No:** pozo o premios por subgrupo. Es otra economía con implicancias legales y de cobro; queda para una spec propia si el negocio lo pide.

## Risks

| Risk | Mitigation |
| --- | --- |
| Un usuario con 3 cartones piensa que "perdió" dos en el subgrupo | Texto explícito en la UI (Pronósticos y "cómo se puntúa"): los cartones extra siguen jugando por el pozo. |
| El primer cartón cargado no es el que el usuario quiere que compita | Aviso "tu cartón para el subgrupo" en la página del grupo con enlace a Pronósticos, y selector visible en cada cartón hasta el cierre. |
| Dos altas simultáneas de cartones dejan dos principales | El trigger toma un `pg_advisory_xact_lock` por `(usuario, liga, jornada)` y el índice único parcial rechaza cualquier duplicado. |
| Un partido cambia de horario y el cierre se mueve (SPEC 05) | `pronosticos_grupo` usa siempre el cierre en vivo (`hora_cierre_jornada`); comportamiento conocido, sin lógica de congelamiento. |
| `hora_cierre_jornada` devuelve `null` si falta algún `fecha_hora`, por lo que la jornada no cuenta como cerrada | Es lo correcto: una jornada sin horario completo no puede haber cerrado; sus pronósticos siguen ocultos hasta que el admin complete los horarios. |
| Las constantes de puntos se vuelven configurables más adelante | Están aisladas en un solo archivo; migrarlas a columnas de `ligas` o `grupos` es un cambio incremental en otra spec. |
| Un miembro sale y vuelve a entrar y cambia su `created_at` | Aceptado: al volver se toma como un ingreso nuevo y solo cuentan las jornadas posteriores. |
| Volumen: se calcula todo por request | A la escala esperada (grupos de decenas de miembros, decenas de jornadas) es despreciable; si crece, una vista o RPC en Postgres en otra spec. |
| `usuarios.nombre` nunca se completa (el alta solo guarda `id` y `email`) | `miembros_grupo` cae a `full_name`/`name` del proveedor de login y, si no hay, a la parte local del email (nunca el email completo). Ver "Actualización". |

## What is **not** in this spec

- Pozo, premios o cobros por subgrupo.
- Ranking global de usuarios de la liga.
- Puntos configurables desde la UI.
- Elección de un cartón distinto por subgrupo.
- Chat, comentarios, notificaciones o emails del subgrupo.
- Invitación por link con token.
- Historial por temporada, medallas o logros.
- Eliminación de cartones.
- Cambios en la regla de ganador ni en el pozo (SPEC 09).

Cada uno de estos, si se implementa, va en su propio spec.

## Actualización 2026-09-28 — Implementación

- Migración: `supabase/migrations/20260930100000_subgrupos_ranking.sql` (columna `es_principal`, índice único parcial, backfill, trigger, `hora_cierre_jornada`, `elegir_carton_principal`, `miembros_grupo`, `pronosticos_grupo` y grants). Se valida en una transacción con rollback; hay que aplicarla con `supabase migration up`.
- Lógica: `src/lib/puntos-grupo.ts`. UI: `src/app/(app)/grupos/[id]/` (`page.tsx`, `grupo-hero.tsx`, `tabla-grupo.tsx`, `jornadas-grupo.tsx`, `miembros-grupo.tsx`, `como-se-puntua.tsx`, `aviso-carton.tsx`, `compartir-codigo.tsx`). Selector en `pronosticos/carton-card.tsx` y acción `elegirCartonPrincipal` en `pronosticos/actions.ts`. `RielSecciones` ahora recibe `descripcion` para el `aria-label`.
- **Nombre de los miembros:** `usuarios.nombre` no se completa en el alta (`handle_new_user` solo inserta `id` y `email`) ni hay pantalla para editarlo. Para no mostrar "Jugador" en todos, `miembros_grupo` usa `usuarios.nombre`, luego `full_name`/`name` del login de Google y, por último, la parte local del email (lo que va antes de la `@`). Los miembros de un subgrupo ven ese texto de los demás. Si se prefiere no exponerlo, la solución es pedir un nombre o apodo al registrarse (spec aparte).
- Los partidos pendientes no puntúan, pero la fila del detalle muestra los pronósticos ya cerrados contra "POR JUGAR".
- Los usuarios con suscripción inactiva ven la página pero no el aviso de fecha abierta.
- **Bug previo corregido (2026-09-28):** crear un subgrupo fallaba con `infinite recursion detected in policy for relation "membresias_grupo"`: las policies de insert y delete de `membresias_grupo` consultaban `grupos`, cuya policy de select consulta `membresias_grupo`. `crearGrupo` ignoraba el error y el creador quedaba sin membresía (antes no se notaba; con el ranking la página lo trata como no miembro). `20260930120000_fix_recursion_insert_membresias_grupo.sql` agrega `es_creador_grupo()` (`security definer`), rehace ambas policies y repara los subgrupos que quedaron sin la membresía del creador (con la fecha de creación del grupo como ingreso). `crearGrupo` ahora verifica ese insert y deshace el grupo si falla.
