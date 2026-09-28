# SPEC 03 — Validación de Jornadas y Cruces en el Fixture

> **Status:** Propuesto · **Depends on:** SPEC 02 · **Date:** 2026-09-25
> **Objective:** Evitar que el admin cargue, por error, un equipo dos veces en la misma jornada o un cruce repetido entre las mismas dos escuadras en dos jornadas distintas, y guiarlo con selects filtrados (equipos disponibles por jornada, jornadas todavía no completas) al cargar el fixture completo de una liga partido por partido.

## Scope

**In:**

- Regla de negocio: un equipo no puede tener dos partidos cargados en la misma jornada, dentro de la misma liga.
- Regla de negocio: un mismo cruce (par de equipos, sin importar quién es local/visitante) no puede repetirse en dos jornadas distintas dentro de la misma liga (fase regular a una sola vuelta, sin revancha).
- Ambas reglas se validan tanto al crear como al editar un partido (al editar, se excluye el propio partido de la comprobación).
- Cálculo automático de la cantidad total de jornadas de una liga a partir de su cantidad actual de equipos, soportando tanto número par como impar de equipos (con un equipo libre/"descansa" por jornada cuando es impar).
- El `<select>` de "Jornada" del formulario de carga de partido (creación) solo ofrece jornadas que todavía no están completas.
- Los `<select>` de "Equipo local" y "Equipo visitante" excluyen, según la jornada elegida en ese momento del formulario, los equipos que ya tienen partido cargado en esa jornada.
- Mensaje claro cuando ya no quedan jornadas disponibles para cargar más partidos.
- Constraint de base de datos que impide, a nivel de motor, guardar dos partidos con el mismo par de equipos en la misma liga (defensa adicional ante condiciones de carrera, además de la validación en el server action).

**Out of scope (for future specs):**

- Carga masiva de partidos por Excel/CSV.
- Generación automática de cruces (algoritmo de round-robin que arme el fixture solo). El admin sigue eligiendo manualmente equipo local, equipo visitante y jornada.
- Fase de revancha / ida y vuelta (levantar la regla de cruce único para permitir el partido de vuelta).
- Mostrar explícitamente en la UI qué equipo "descansa" en una jornada, cuando la liga tiene número impar de equipos (se infiere por ausencia, no se registra).
- Trigger de base de datos para la regla de "equipo no repite en jornada" (queda solo como validación de server action).
- Cambios a la vista pública `/ligas/[id]/partidos` más allá de lo estrictamente necesario.

## Data model

No se agregan tablas nuevas. Se extiende `partidos` (definida en SPEC 02) con dos columnas generadas y un constraint:

```sql
alter table public.partidos
  add column equipo_menor_id uuid generated always as (least(equipo_local_id, equipo_visitante_id)) stored,
  add column equipo_mayor_id uuid generated always as (greatest(equipo_local_id, equipo_visitante_id)) stored;

alter table public.partidos
  add constraint partidos_cruce_unico_por_liga
  unique (liga_id, equipo_menor_id, equipo_mayor_id);
```

Conventions:

- `equipo_menor_id`/`equipo_mayor_id` normalizan el par de equipos de un partido (sin importar quién es local o visitante), para poder expresar "el cruce no se repite" como un `UNIQUE` constraint real de Postgres.
- La regla de "un equipo no repite en la misma jornada" **no** tiene equivalente a nivel de constraint de base de datos (requeriría un trigger PL/pgSQL, ver Decisions) — vive únicamente en el server action.
- Antes de aplicar la migración, hay que verificar que no existan ya cruces duplicados cargados en la base (ver Implementation plan, paso 1); si los hay, el `alter table` con el `unique constraint` va a fallar hasta resolverlos a mano.

## Implementation plan

1. Correr en el SQL editor de Supabase una query de verificación de cruces duplicados ya cargados:
   ```sql
   select liga_id,
          least(equipo_local_id, equipo_visitante_id) as equipo_a,
          greatest(equipo_local_id, equipo_visitante_id) as equipo_b,
          count(*)
   from public.partidos
   group by 1, 2, 3
   having count(*) > 1;
   ```
   Manual test: confirmar 0 filas (o resolver a mano cualquier duplicado encontrado) antes de seguir.
2. Migración SQL nueva (`supabase/migrations/<timestamp>_partidos_cruce_unico.sql`) con las columnas generadas y el `unique constraint` de la sección Data model. Manual test: en el SQL editor, intentar insertar un partido con un cruce ya existente en otra jornada de la misma liga y verificar que Postgres lo rechaza.
3. Crear `src/lib/fixture.ts` con dos funciones puras:
   - `calcularTotalJornadas(cantidadEquipos)`: par → `cantidadEquipos - 1`; impar → `cantidadEquipos`; menos de 2 equipos → `0`.
   - `calcularPartidosPorJornadaCompleta(cantidadEquipos)`: `Math.floor(cantidadEquipos / 2)`.
   Manual test: casos manuales (4 equipos → 3 jornadas × 2 partidos; 5 equipos → 5 jornadas × 2 partidos; 2 equipos → 1 jornada × 1 partido).
4. En `admin/ligas/[id]/partidos/actions.ts`, agregar tres validaciones server-side (consultando `partidos` antes del insert/update) e integrarlas en `crearPartido` y `actualizarPartido`, siempre excluyendo el propio partido al editar:
   - `validarRangoJornada`: rechaza si la jornada elegida supera `calcularTotalJornadas` según la cantidad actual de equipos de la liga.
   - `validarEquipoNoRepiteEnJornada`: rechaza si el equipo local o visitante elegido ya tiene otro partido en esa jornada, con mensaje indicando qué equipo y qué jornada.
   - `validarCruceNoRepetido`: rechaza si el par de equipos (en cualquier orden) ya se enfrentó en otra jornada de la liga, con mensaje indicando en qué jornada.
   Además, traducir el error de Postgres `23505` (violación del constraint `partidos_cruce_unico_por_liga`) a un mensaje amigable en vez del genérico actual.
   Manual test: desde el admin, intentar cargar un equipo que ya juega en la jornada elegida → ver el mensaje específico sin crear el partido; repetir un cruce ya cargado en otra jornada → mismo resultado con el mensaje de cruce repetido.
5. Actualizar `admin/ligas/[id]/partidos/page.tsx`: calcular `totalJornadas`, `ocupacionPorJornada` (mapa jornada → ids de equipos ocupados) y `jornadasDisponibles` (jornadas 1..totalJornadas que todavía no están completas), pasarlos como props a `PartidoForm`, y mostrar un mensaje claro si `jornadasDisponibles` queda vacío. Manual test: en una liga de 4 equipos, cargar los 2 partidos de la jornada 1 y confirmar que esa jornada desaparece del selector al crear un partido nuevo.
6. Actualizar `admin/ligas/[id]/partidos/[partidoId]/editar/page.tsx` con el mismo cálculo, excluyendo el propio partido de `ocupacionPorJornada` (vía `.neq("id", partidoId)`) y garantizando que la jornada actual del partido esté siempre incluida en `jornadasDisponibles`, aunque ya esté completa. Manual test: editar un partido de una jornada ya completa y guardar sin cambios → debe funcionar; intentar moverlo a otra jornada también completa → debe rechazarse.
7. Reestructurar `admin/ligas/[id]/partidos/partido-form.tsx`: el campo "Jornada" pasa de `<input type="number">` libre a `<select>` controlado con las opciones de `jornadasDisponibles`; los `<select>` de equipo local/visitante se filtran dinámicamente según `ocupacionPorJornada[jornadaSeleccionada]`; al cambiar de jornada, si el equipo ya elegido deja de estar disponible, se resetea su selección. Manual test: elegir una jornada con cupo parcial (liga de 5 equipos) y confirmar que los selects de equipo solo muestran los equipos que todavía no juegan esa jornada.
8. Prueba de punta a punta con número impar de equipos: liga de 5 equipos, cargar las 5 jornadas completas (2 partidos cada una) y confirmar que cada equipo descansó exactamente una vez y que, al completarse la jornada 5, el formulario indica que no quedan jornadas disponibles.
9. Prueba de condición de carrera simulada: desde el SQL editor, intentar insertar directamente (bypaseando la UI) un partido que repita un cruce ya cargado en otra jornada, con local/visitante invertidos, y confirmar que el constraint de base de datos lo bloquea igual.

## Acceptance criteria

- [ ] Al crear un partido, si el equipo local o visitante ya tiene otro partido cargado en la misma jornada de la misma liga, la creación se rechaza indicando qué equipo y qué jornada.
- [ ] Al editar un partido, la misma validación aplica excluyendo el propio partido (se puede guardar sin cambios).
- [ ] Al crear un partido, si el par de equipos ya se enfrentó en cualquier otra jornada de la misma liga, la creación se rechaza indicando en qué jornada ya jugaron.
- [ ] Al editar un partido, la misma validación de cruce repetido aplica excluyendo el propio partido.
- [ ] El selector de jornada en el formulario de creación solo muestra jornadas entre 1 y el total calculado que todavía no están completas.
- [ ] Con N equipos par, el total de jornadas es `N - 1` y cada jornada completa tiene `N / 2` partidos.
- [ ] Con N equipos impar, el total de jornadas es `N` y cada jornada completa tiene `(N - 1) / 2` partidos.
- [ ] Si todas las jornadas posibles ya están completas, el formulario de creación lo indica claramente y no permite cargar más partidos.
- [ ] Al elegir una jornada en el formulario, los selects de equipo local y visitante excluyen los equipos que ya juegan esa jornada.
- [ ] Al editar un partido, sus propios equipos no se autoexcluyen de la jornada en la que ya están cargados.
- [ ] Al editar un partido y cambiar su jornada a otra ya completa, la validación lo rechaza igual que al crear.
- [ ] Un constraint de base de datos impide guardar dos partidos con el mismo par de equipos en la misma liga, como defensa adicional.
- [ ] El admin sigue eligiendo manualmente equipo local, equipo visitante y jornada; el sistema no genera cruces automáticamente.

## Decisions

- **Yes:** constraint `UNIQUE` de base de datos (vía columnas generadas `equipo_menor_id`/`equipo_mayor_id`) para la regla de cruce único. Es barato de implementar y protege contra condiciones de carrera sin necesitar un trigger.
- **No:** trigger de base de datos para "equipo no repite en jornada". Esa regla compara contra `equipo_local_id` OR `equipo_visitante_id` de otras filas de la misma jornada, lo cual no se expresa como `UNIQUE` constraint simple y requeriría PL/pgSQL. Con un solo admin operando de forma secuencial (SPEC 01/02), el riesgo de condición de carrera es despreciable; se prioriza no duplicar lógica de negocio entre DB y server action.
- **Yes:** validar el rango de jornada también server-side (además del `<select>` del cliente), recalculando el total de jornadas según la cantidad de equipos actual. Defensa en profundidad con costo mínimo.
- **No:** validación server-side separada de "jornada completa". La regla de "equipo no repite en jornada" ya implica, por construcción matemática, que no se puede superar la cantidad de partidos de una jornada completa; el concepto de "completa" solo se usa para filtrar opciones del selector (UX).
- **Yes:** al editar un partido, su jornada actual siempre aparece en el selector aunque ya esté completa. Consistente con la decisión de SPEC 02 de permitir editar cualquier partido en cualquier momento.
- **No:** carga masiva por Excel/CSV en esta spec. Se prioriza terminar de blindar la carga manual primero; queda como candidato a spec futuro.
- **No:** generación automática de cruces (round-robin). El admin arma el fixture a mano; el sistema solo valida.
- **No:** soporte de fase de revancha/vuelta en esta spec (implicaría levantar la regla de cruce único).

## Risks

| Risk | Mitigation |
| --- | --- |
| Condición de carrera: dos inserts simultáneos con el mismo cruce | Cubierta por el constraint único de base de datos; el server action traduce el error `23505` a un mensaje amigable. No cubierta de igual forma para "equipo repite en jornada" — riesgo aceptado dado que hay un solo admin operando. |
| Admin edita un partido y mueve su jornada a una ya completa | La validación server-side de "equipo no repite en jornada" lo rechaza automáticamente con mensaje claro. |
| Liga con equipos impares: el equipo que descansa no se muestra en ningún lado | Aceptado por diseño; se infiere por ausencia en la jornada. Mostrarlo explícitamente queda como mejora futura opcional. |
| La migración falla si ya existen cruces duplicados cargados | Paso 1 del plan: correr la query de verificación antes de aplicar la migración y resolver manualmente cualquier duplicado. |
| Admin borra un equipo que ya tiene partidos cargados | Ya mitigado desde SPEC 02 (el FK sin `ON DELETE CASCADE` bloquea el borrado con mensaje de error); esta spec no cambia ese comportamiento, solo lo hace más frecuente de encontrar. |

## What is **not** in this spec

- Carga masiva de partidos por Excel/CSV.
- Generación automática de cruces / algoritmo de round-robin.
- Fase de revancha o ida y vuelta.
- Mostrar explícitamente en la UI qué equipo descansa en una jornada con número impar de equipos.
- Trigger de base de datos para la regla de "equipo no repite en jornada".
- Cambios a la vista pública `/ligas/[id]/partidos` más allá de lo estrictamente necesario.

Cada uno de estos, si se implementa, va en su propio spec.
