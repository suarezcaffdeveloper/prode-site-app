# SPEC 08 — Estadísticas y Tabla de Posiciones

> **Status:** Implementado (pendiente de prueba manual en UI) · **Depends on:** SPEC 02, SPEC 03 · **Date:** 2026-09-27
> **Objective:** Reemplazar el placeholder de `/ligas/[id]/estadisticas` por una tabla de posiciones completa, calculada automáticamente a partir de los resultados que el admin carga en cada jornada, y un conjunto de estadísticas de equipos (ataque/defensa, rachas, local vs visitante y tendencias) pensadas para ayudar a los usuarios a decidir sus pronósticos.

## Scope

**In:**

- Pantalla `/ligas/[id]/estadisticas` (ya enlazada desde `LigaBottomNav`) con dos secciones: **Tabla de posiciones** y **Estadísticas**.
- **Tabla de posiciones** con una fila por equipo de la liga y las columnas, en este orden: posición, escudo, equipo, puntos (Pts), partidos jugados (PJ), ganados (PG), empatados (PE), perdidos (PP), goles a favor (GF), goles en contra (GC) y diferencia de gol (DG).
- Sistema de puntos fijo: victoria 3, empate 1, derrota 0. Orden: puntos, luego diferencia de gol, luego goles a favor, luego nombre del equipo (alfabético, case-insensitive) como último desempate para que el orden sea siempre determinístico.
- Todos los equipos de la liga aparecen en la tabla desde el primer día (con ceros hasta que jueguen), no solo los que ya jugaron.
- **Cálculo automático:** la tabla y las estadísticas se derivan en cada request de los partidos con `estado = 'finalizado'`. No hay tabla ni columna nueva que mantener sincronizada: cuando el admin carga, corrige o borra un resultado, la pantalla lo refleja sola.
- **Estadísticas**, agrupadas en cuatro bloques de tarjetas. Cada tarjeta muestra el top 3 del ranking con escudo, nombre y valor (empates en el valor comparten posición y se listan todos):
  - **Ataque y defensa:** equipo que más convierte (promedio de goles a favor por partido), equipo con menos goles recibidos (promedio de goles en contra por partido), equipo con más vallas invictas (partidos con 0 goles en contra), equipo con más partidos sin convertir.
  - **Rachas:** racha ganadora, racha invicta (sin perder), racha sin ganar y racha de derrotas. Cada tarjeta rankea por **racha actual** y agrega al pie el **récord** de la temporada (equipo y cantidad).
  - **Local vs visitante:** mejor local, mejor visitante (ambos por aprovechamiento de puntos en esa condición) y mayor diferencia de rendimiento entre local y visitante.
  - **Tendencias para el prode:** equipo que más empata, equipo con más partidos de 3 o más goles totales, equipo con más partidos donde ambos equipos convierten, y **forma reciente** (últimos 5 partidos de cada equipo como chips G/E/P, ordenados según la tabla de posiciones).
- Visible para cualquier usuario autenticado, igual que el fixture (SPEC 02): es información pública del torneo, no del ranking competitivo de usuarios.
- Estado vacío: si todavía no hay ningún partido finalizado, la tabla se muestra con ceros y en lugar de las estadísticas aparece un mensaje claro ("Las estadísticas aparecen cuando se cargue el primer resultado"). Cada tarjeta individual muestra "Sin datos suficientes todavía" si ningún equipo califica.
- Mobile: la tabla completa se muestra con scroll horizontal, con posición y equipo fijos (sticky) a la izquierda.

**Out of scope (for future specs):**

- Ranking/leaderboard de **usuarios** del prode (puntos por pronóstico acertado). Esta spec es solo sobre el rendimiento de los equipos.
- Filtro "tabla a la jornada N" o vista histórica de la tabla.
- Desempate por enfrentamiento directo.
- Puntos configurables por liga (fijo 3-1-0).
- Detalle/página individual por equipo, historial de partidos por equipo, head-to-head entre dos equipos.
- Estadísticas por jugador (goleadores, asistencias, tarjetas): el modelo de datos no registra eventos de partido.
- Zonas, grupos, fases eliminatorias o zonas de clasificación/descenso coloreadas.
- Gráficos, exportar o compartir la tabla como imagen.
- Mostrar un resumen de la tabla en la pantalla principal de la liga (`/ligas/[id]`).
- Optimización por vistas materializadas, RPCs o caché (ver Risks).

## Data model

Sin cambios de esquema ni migraciones. Se leen las tablas existentes `equipos` (SPEC 02) y `partidos` (SPEC 02/03); la política RLS `select` para `authenticated` de ambas ya cubre el caso de uso.

Tipos y funciones puras nuevas, sin I/O, en `src/lib/estadisticas.ts`:

```ts
export type EquipoRef = { id: string; nombre: string; escudoUrl: string | null };

export type PartidoFinalizado = {
  jornada: number;
  equipoLocalId: string;
  equipoVisitanteId: string;
  golesLocal: number;
  golesVisitante: number;
};

export type FilaTabla = {
  equipo: EquipoRef;
  pos: number;
  pts: number;
  pj: number; pg: number; pe: number; pp: number;
  gf: number; gc: number; dg: number;
};

export function calcularTablaPosiciones(equipos: EquipoRef[], partidos: PartidoFinalizado[]): FilaTabla[];
export function calcularEstadisticas(equipos: EquipoRef[], partidos: PartidoFinalizado[]): EstadisticasLiga;
```

Definiciones de las métricas (`calcularEstadisticas`):

| Métrica | Definición | Califica si |
| --- | --- | --- |
| Más convierte | goles a favor / PJ, descendente (se muestra también el total) | PJ ≥ 1 |
| Menos goles recibidos | goles en contra / PJ, ascendente (se muestra también el total) | PJ ≥ 1 |
| Vallas invictas | cantidad de partidos con GC = 0, descendente | PJ ≥ 1 |
| Partidos sin convertir | cantidad de partidos con GF = 0, descendente | PJ ≥ 1 |
| Racha ganadora / invicta / sin ganar / derrotas | cantidad de partidos consecutivos (G / G o E / E o P / P) contados hacia atrás desde el último partido finalizado del equipo; el récord es la racha más larga del equipo en toda la liga | PJ ≥ 1 |
| Mejor local / mejor visitante | puntos obtenidos en esa condición / (3 × PJ en esa condición), descendente | PJ en esa condición ≥ 1 |
| Diferencia local vs visitante | \|aprovechamiento local − aprovechamiento visitante\|, descendente (se muestran ambos valores) | PJ local ≥ 1 y PJ visitante ≥ 1 |
| Más empata | cantidad de empates, descendente | PJ ≥ 1 |
| Partidos con 3+ goles | cantidad de partidos con GF + GC ≥ 3, descendente | PJ ≥ 1 |
| Ambos convierten | cantidad de partidos con GF ≥ 1 y GC ≥ 1, descendente | PJ ≥ 1 |
| Forma reciente | resultados G/E/P de los últimos 5 partidos finalizados, del más antiguo al más reciente | PJ ≥ 1 |

Reglas adicionales de los rankings: los conteos (vallas invictas, sin convertir, empates, 3+ goles, ambos convierten), "más convierte", "mejor local/visitante" y "diferencia local vs visitante" excluyen a los equipos con valor 0 (un 0 no es una "estadística destacable"); "menos goles recibidos" sí admite 0, porque es el mejor valor posible. Las rachas rankean solo equipos con racha actual ≥ 1. Los aprovechamientos se redondean a porcentaje entero y la diferencia se muestra en puntos porcentuales (pp).

Los partidos de un equipo se ordenan por `jornada` (SPEC 03 garantiza que un equipo juega como máximo una vez por jornada, así que el orden es inequívoco). Los partidos `pendiente` se ignoran por completo.

## Implementation plan

1. Crear `src/lib/estadisticas.ts` con `calcularTablaPosiciones`: un único recorrido sobre `partidos` acumulando PJ/PG/PE/PP/GF/GC por equipo (inicializando todos los equipos de la liga en cero), calculando `dg` y `pts`, ordenando por pts → dg → gf → nombre y asignando `pos`. Manual test: invocar con arrays armados a mano (liga de 4 equipos, 0 partidos → todos en 0 ordenados alfabéticamente; 2 jornadas con un empate en puntos resuelto por DG; un empate en puntos y DG resuelto por GF; uno resuelto por nombre) y comparar contra el resultado calculado a mano.
2. En el mismo archivo, agregar `calcularEstadisticas` con las métricas de la tabla de "Data model", incluyendo el manejo de empates en el valor (misma posición, se listan todos los equipos empatados dentro del top 3 según el valor, no según la cantidad de equipos) y el recorte a "califica si". Manual test: caso de 2 equipos empatados en el primer puesto de una métrica (aparecen ambos), un equipo con 0 PJ (no aparece en ningún ranking), una racha que se corta a mitad (actual < récord), y un equipo sin partidos de local todavía (no califica para "mejor local" pero sí para "mejor visitante").
3. Modificar `src/app/(app)/ligas/[id]/estadisticas/page.tsx`: mantener el `notFound()` para liga inexistente/inactiva; agregar dos queries en paralelo (`equipos` de la liga y `partidos` de la liga con `estado = 'finalizado'`), mapearlas a los tipos de `estadisticas.ts` y llamar a las dos funciones. Quitar el `max-w-2xl` del contenedor para que la tabla tenga ancho suficiente (mismo criterio que `partidos/page.tsx`). Manual test: liga sin resultados → tabla en ceros + mensaje de estado vacío; liga con resultados → tabla y estadísticas visibles.
4. Crear `estadisticas/tabla-posiciones.tsx`: tabla HTML semántica (`<table>` con `<th scope>`), 11 columnas en el orden pedido, `Escudo` de `src/components/ui/escudo.tsx` (con su placeholder de inicial cuando no hay escudo; escudo y nombre comparten celda para que solo dos columnas queden fijas y sobre espacio en mobile), Pts y DG en peso visual mayor, `tabular-nums` en las cifras, DG con signo (`+3`, `-2`, `0`). Contenedor `overflow-x-auto` con las dos primeras columnas `sticky left-0` (fondo opaco para que no se transparente el contenido que se desliza debajo). Manual test: en viewport de 375px la tabla no rompe el layout de la página, se desliza horizontalmente y Pos/Equipo quedan fijas.
5. Crear `estadisticas/estadistica-card.tsx` (tarjeta genérica: título, subtítulo opcional, lista top 3 con posición compartida en empates, escudo, nombre y valor; footer opcional para el récord de rachas; estado "Sin datos suficientes todavía") reutilizando `Card` y `Escudo`, con la tipografía y colores ya usados en el resto de la app (`font-mono` con `tracking` para títulos, paleta `pitch`/`ink`). Manual test: renderizar la tarjeta con un empate en el primer puesto y con lista vacía.
6. Crear `estadisticas/forma-reciente.tsx`: lista de todos los equipos en el orden de la tabla con hasta 5 chips G/E/P (verde/gris/rojo, con la letra visible para no depender solo del color). Manual test: equipo con 2 partidos (2 chips), equipo con 7 partidos (solo los últimos 5, del más antiguo al más reciente).
7. Armar en `page.tsx` los cuatro bloques de estadísticas (Ataque y defensa, Rachas, Local vs visitante, Tendencias para el prode) como grillas responsivas de tarjetas (1 columna en mobile, 2 en tablet, 3 en desktop, como el fixture). Manual test: recorrer los cuatro bloques en 375px, 768px y 1280px.
8. Verificar la actualización automática end-to-end: cargar un resultado desde `/admin/ligas/[id]/partidos` con `cargarResultado`, volver a `/ligas/[id]/estadisticas` y confirmar que la tabla y las estadísticas cambian sin acciones extra; repetir corrigiendo el resultado y borrando el partido. La página es dinámica (lee la sesión de Supabase vía cookies), por lo que no se agregó `revalidatePath` en las acciones del admin; si en la prueba manual la navegación del lado del cliente muestra datos viejos, agregar `revalidatePath(`/ligas/${ligaId}/estadisticas`)` en `cargarResultado`, `actualizarPartido` y `borrarPartido` (`admin/ligas/[id]/partidos/actions.ts`). Manual test: el descrito arriba.
9. Probar cada caso borde de "Acceptance criteria" contra la UI real (no solo la función pura): liga sin partidos finalizados, liga con un solo partido finalizado, tres equipos empatados en puntos y DG, un partido finalizado con 0–0, un equipo que solo jugó de local.
10. Probar permisos: un usuario autenticado sin membresía en la liga puede ver la pantalla; una request sin sesión es redirigida al login por el flujo existente.

## Acceptance criteria

- [ ] `/ligas/[id]/estadisticas` muestra la tabla de posiciones con las columnas Pos, escudo, Equipo, Pts, PJ, PG, PE, PP, GF, GC y DG, en ese orden.
- [ ] Todos los equipos de la liga aparecen en la tabla, incluso sin partidos jugados (con ceros).
- [ ] Solo se cuentan partidos con `estado = 'finalizado'`; los partidos `pendiente` no afectan la tabla ni las estadísticas.
- [ ] Victoria suma 3 puntos, empate 1 y derrota 0; `dg = gf − gc`; `pj = pg + pe + pp`.
- [ ] El orden de la tabla es pts → dg → gf → nombre, y es determinístico (recargar no cambia el orden).
- [ ] Al cargar, corregir o borrar un resultado desde el admin, la tabla y las estadísticas reflejan el cambio sin acciones adicionales.
- [ ] Los equipos sin escudo muestran el placeholder de inicial ya existente y no rompen la tabla.
- [ ] En mobile (≤ 375px) la tabla se desliza horizontalmente con Pos y Equipo fijos, y la página no tiene scroll horizontal propio.
- [ ] Bloque "Ataque y defensa": muestra top 3 de más convierte, menos goles recibidos, más vallas invictas y más partidos sin convertir.
- [ ] Bloque "Rachas": muestra top 3 por racha actual de ganadora, invicta, sin ganar y de derrotas, y el récord de cada una al pie.
- [ ] Bloque "Local vs visitante": muestra mejor local, mejor visitante y mayor diferencia de rendimiento; un equipo sin partidos en una condición no aparece en los rankings que la requieren.
- [ ] Bloque "Tendencias para el prode": muestra más empata, más partidos de 3+ goles, más partidos donde ambos convierten y la forma reciente (últimos 5) de cada equipo.
- [ ] Equipos empatados en el valor de una tarjeta comparten posición y se muestran todos.
- [ ] Un equipo con 0 partidos jugados no aparece en ningún ranking de estadísticas.
- [ ] Sin partidos finalizados: tabla en ceros y mensaje de estado vacío en lugar de las estadísticas.
- [ ] Cualquier usuario autenticado puede ver la pantalla, tenga o no suscripción en la liga.
- [ ] Una liga inexistente o inactiva devuelve 404, igual que hoy.

## Decisions

- **Yes:** calcular tabla y estadísticas en tiempo de request desde `partidos` finalizados, con funciones puras en `src/lib/estadisticas.ts`. Elimina el riesgo de tablas derivadas desincronizadas cuando el admin corrige o borra un resultado, y no requiere migración. El volumen (decenas de equipos, cientos de partidos) hace irrelevante el costo.
- **No:** vistas SQL, vistas materializadas o RPCs para la tabla. Mover la lógica a Postgres duplicaría reglas difíciles de testear a mano y no aporta a esta escala; se puede reevaluar si una liga crece órdenes de magnitud.
- **Yes:** puntos fijos 3-1-0 con desempate pts → DG → GF → nombre. Pedido explícito del usuario; el desempate por nombre solo existe para que el orden sea determinístico.
- **No:** desempate por enfrentamiento directo ni puntos configurables por liga — complejidad y cambios de esquema sin pedido concreto.
- **Yes:** mostrar todos los equipos de la liga en la tabla aunque no hayan jugado, para que la pantalla tenga contenido útil desde el inicio del torneo.
- **Yes:** rankear "más convierte" y "menos goles recibidos" por promedio por partido (mostrando también el total). Evita que un equipo con menos partidos jugados (resultados cargados a medias) aparezca injustamente como mejor defensa.
- **Yes:** rachas rankeadas por racha **actual**, con el récord al pie. La racha actual es lo que le sirve a un usuario para decidir un pronóstico; el récord es contexto.
- **Yes:** ignorar partidos `pendiente` al calcular rachas y forma reciente. Si el admin carga resultados fuera de orden, la racha conecta los partidos finalizados consecutivos por jornada (ver Risks).
- **Yes:** empates en el valor comparten posición y se listan todos, en vez de elegir un ganador arbitrario.
- **Yes:** visible para cualquier usuario autenticado, no solo suscriptos activos. Coherente con SPEC 02 (fixture y resultados públicos); lo privado/competitivo es el ranking de usuarios, que es otra spec.
- **No:** rankear por jugadores, goleadores o tarjetas — el modelo de datos no los registra.
- **Yes:** tabla completa en mobile con scroll horizontal y columnas Pos/Equipo fijas, en vez de una versión recortada, para no ocultar información según el dispositivo.
- **Yes:** reutilizar `Card` y `Escudo` existentes; no crear componentes de UI base nuevos.

## Risks

| Risk | Mitigation |
| --- | --- |
| Resultados cargados fuera de orden (ej. jornada 4 finalizada con la jornada 3 todavía pendiente) hacen que una racha "conecte" partidos no consecutivos en el calendario | Aceptado: las rachas se calculan sobre partidos finalizados ordenados por jornada. Se corrige solo cuando el admin completa la jornada faltante. |
| Comparar equipos con distinta cantidad de partidos jugados distorsiona los rankings absolutos (ej. vallas invictas) | Los rankings de goles usan promedio por partido; los conteos (vallas invictas, empates, etc.) muestran el valor absoluto y el PJ del equipo junto a él para dar contexto. |
| Con pocos partidos finalizados las estadísticas son ruido (un 5–0 convierte a un equipo en "el que más convierte") | Se muestran siempre las tarjetas que califican, pero el encabezado de la sección indica cuántas jornadas/partidos finalizados hay; no se agrega un umbral mínimo arbitrario en esta spec. |
| Volumen: si una liga crece a miles de partidos, calcular todo por request puede volverse lento | A la escala esperada (decenas de equipos, cientos de partidos) es despreciable. Si deja de serlo, el paso natural es una vista/RPC en Postgres en otra spec. |
| Columna sticky en mobile se ve mal si el fondo es transparente (el texto que se desliza se ve por debajo) | Fondo opaco explícito en las celdas sticky y verificación manual en 375px (paso 4). |
| Escudo faltante o URL rota en Storage | Se reutiliza `Escudo`, que ya cae al placeholder con la inicial cuando no hay URL (SPEC 02). |

## What is **not** in this spec

- Ranking/leaderboard de usuarios del prode.
- Tabla a una jornada específica o historial de la tabla.
- Desempate por enfrentamiento directo y puntos configurables por liga.
- Páginas de detalle por equipo, head-to-head.
- Estadísticas por jugador.
- Zonas, grupos, fases o indicadores de clasificación/descenso.
- Gráficos y exportación/compartir como imagen.
- Resumen de la tabla en la home de la liga.
- Vistas materializadas, RPCs o caché.

Cada uno de estos, si se implementa, va en su propio spec.
