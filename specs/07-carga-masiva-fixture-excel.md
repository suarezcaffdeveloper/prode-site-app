# SPEC 07 — Carga Masiva de Fixture por Excel

> **Status:** Implementado · **Depends on:** SPEC 02, SPEC 03 · **Date:** 2026-09-27
> **Objective:** Permitir al admin cargar de una sola vez todos los cruces de todas las jornadas de una liga subiendo un archivo Excel/CSV, en vez de cargar partido por partido, reutilizando las mismas reglas de negocio que ya blindan la carga manual (SPEC 03).

## Scope

**In:**

- Botón "Carga masiva" en `/admin/ligas/[id]/partidos`, junto al botón existente "+ Cargar partido", que abre un modal con el flujo de carga.
- Subida de un archivo **.xlsx o .csv** desde el input del navegador, con exactamente tres columnas: `Jornada`, `Equipo Local`, `Equipo Visitante` (detección de headers tolerante a mayúsculas/minúsculas y espacios, con alias razonables).
- El parseo del archivo ocurre **enteramente del lado del cliente**; solo se envían al servidor las filas ya estructuradas como JSON (no el archivo crudo), para no acercarse al límite de `bodySizeLimit` (1MB por default) de los Server Actions de este Next.js.
- Los equipos se matchean por **nombre exacto** (case-insensitive, con `trim` de espacios) contra los equipos ya cargados en `/admin/ligas/[id]/equipos`. No hay creación implícita de equipos ni fuzzy matching.
- Validación de todo el lote **en un solo recorrido en memoria** (sin una query por fila): rango de jornada, equipo no repite en jornada, cruce no repetido — tanto contra los partidos ya existentes en la base como entre las filas del propio archivo subido.
- Import **todo o nada**: si cualquier fila tiene error, no se inserta nada; se muestran todos los errores encontrados (con el número de fila tal como se ve en Excel/Sheets, header incluido) para que el admin corrija el archivo y vuelva a subirlo.
- Preview client-side antes de confirmar: cantidad de filas válidas/inválidas y tabla de errores por fila, con link a `/admin/ligas/[id]/equipos` cuando algún error es de equipo no encontrado.
- Límites: archivo de hasta 5 MB y hasta 1000 filas de datos, validados tanto en el cliente como (en el caso de la cantidad de filas) en el servidor.
- Los partidos cargados por este flujo quedan en estado `pendiente`, sin resultado ni horario — se cargan después, jornada a jornada, con el flujo ya existente (`cargarResultado`/`cargarHorario`).

**Out of scope (for future specs):**

- Carga por link/URL externa (Google Sheets publicado, OneDrive, etc.) — implicaría descargar contenido desde una URL puesta por el admin (riesgo SSRF) y manejar múltiples formatos de export. Se descarta explícitamente.
- Fuzzy matching de nombres de equipo (sugerencias ante typos). El matcheo es exacto; un nombre mal escrito es un error explícito.
- Plantilla Excel descargable de ejemplo.
- Soporte de `.xls` (formato binario legacy de Excel) — las librerías livianas y mantenidas disponibles no lo soportan; Excel exporta `.xlsx` por default.
- Reporte de importación parcial (guardar las filas válidas y listar aparte las inválidas). Se prioriza integridad del fixture sobre velocidad.
- Generación automática de cruces / algoritmo de round-robin (sigue fuera de alcance, ya excluido en SPEC 03).

## Data model

Sin cambios de esquema. La tabla `partidos` (SPEC 02/03) no se modifica; el insert masivo usa las mismas columnas que el insert individual y queda cubierto por el constraint `partidos_cruce_unico_por_liga` (SPEC 03) como defensa adicional.

Límites de la feature (no de la base de datos), en `src/lib/fixture.ts` y `src/lib/parsear-fixture-excel.ts`:

```ts
export const MAX_FILAS_CARGA_MASIVA = 1000; // src/lib/fixture.ts
export const MAX_TAMANO_ARCHIVO_BYTES = 5 * 1024 * 1024; // src/lib/parsear-fixture-excel.ts
```

## Implementation plan

1. Agregar la dependencia `read-excel-file` para parsear `.xlsx` en el navegador. **Decisión de seguridad:** se descartó la librería `xlsx` (SheetJS) publicada en npm porque a la fecha tiene dos vulnerabilidades de severidad alta sin parche disponible en el registro público (prototype pollution y ReDoS — `npm audit` las reporta como "No fix available"; SheetJS solo distribuye la versión corregida por su propio CDN, fuera de npm). Se evaluó también `exceljs` (agrega ~100 paquetes transitivos, con una vulnerabilidad moderada en una dependencia y varias advertencias de deprecación) antes de optar por `read-excel-file`, mantenida activamente, sin vulnerabilidades reportadas y con una huella mínima (6 paquetes). Manual test: `npm audit` reporta 0 vulnerabilidades después de instalar.
2. Agregar `MAX_FILAS_CARGA_MASIVA` a `src/lib/fixture.ts`. Manual test: se importa sin romper los usos existentes de `calcularTotalJornadas`/`calcularPartidosPorJornadaCompleta`.
3. Crear `src/lib/fixture-batch.ts` con `validarLoteFixture(filas, equipos, partidosExistentes)`: un solo recorrido en memoria que reutiliza `calcularTotalJornadas` y replica (sin refactorizar, ver Decisions) las reglas de SPEC 03 — rango de jornada, equipo no repite en jornada, cruce no repetido — acumulando qué equipos/cruces quedan "ocupados" a medida que procesa las filas en orden, para detectar tanto conflictos contra `partidosExistentes` como conflictos entre filas del propio archivo. Manual test: invocar la función con arrays armados a mano cubriendo cada caso de la tabla de la sección "Acceptance criteria".
4. Crear `src/lib/parsear-fixture-excel.ts`: detecta `.xlsx` (vía `read-excel-file/browser`) o `.csv` (parser propio mínimo tipo RFC4180, sin dependencia extra), busca las tres columnas por header tolerando mayúsculas/espacios, descarta en silencio filas completamente vacías, numera cada fila igual que Excel/Sheets (header = fila 1), y valida tamaño de archivo y cantidad de filas. Manual test: armar un `.xlsx` y un `.csv` de prueba equivalentes (headers correctos e incorrectos, filas vacías al final) y confirmar que ambos formatos parsean igual y que los mensajes de error coinciden con lo esperado.
5. Agregar `cargarFixtureMasivo(ligaId, filas)` a `admin/ligas/[id]/partidos/actions.ts`: trae `equipos` y `partidos` de la liga (una query cada uno), llama `validarLoteFixture`, y si hay errores los devuelve sin tocar la base; si no, hace un único `supabase.from("partidos").insert([...])` con todas las filas resueltas (atómico por construcción en Postgres — sin RPC ni transacción explícita), revalida la ruta y devuelve la cantidad cargada. Reutiliza `mensajeErrorGuardado` para el caso borde de `23505` por condición de carrera. Mismo boundary de auth que el resto del archivo (sin chequeo manual de rol — `admin/layout.tsx` + RLS `is_admin()`). Manual test: invocar con un lote chico de filas válidas contra una liga real y confirmar el insert; repetir con filas que fuercen cada tipo de error y confirmar que no se inserta nada.
6. Agregar una prop `size?: "md" | "lg"` opcional y retrocompatible a `src/components/ui/modal.tsx` (default `"md"`, comportamiento sin cambios) para dar más ancho a la tabla de preview/errores. Manual test: la pantalla `ligas/[id]/planes-suscripcion.tsx`, que usa `Modal` sin pasar la prop nueva, se ve exactamente igual que antes.
7. Crear `admin/ligas/[id]/partidos/carga-masiva-modal.tsx`: flujo de estados selección → preview (corre `validarLoteFixture` en el cliente con los `equipos`/`partidos` que la página ya trae, sin query extra) → confirmar (deshabilitado si hay errores) → envío (`startTransition`, sin `FormData`) → resultado. El servidor siempre revalida contra la base fresca antes de insertar; el preview del cliente es solo ayuda de UX. Manual test: recorrer el flujo feliz (archivo válido → preview sin errores → confirmar → éxito → fixture visible actualizado sin recargar la página) y el flujo con errores (preview con errores → botón de confirmar deshabilitado → corregir el archivo → volver a subir).
8. Enganchar el botón "Carga masiva" y el modal en `partidos-admin.tsx` (junto a "+ Cargar partido"), y pasar `partidosExistentes` (derivado del `partidos` que `page.tsx` ya fetchea, sin query nueva) y la acción bindeada. Manual test end-to-end: liga con 6 equipos y sin partidos, subir un Excel con las 5 jornadas completas (15 partidos), confirmar que se cargan todos y que la vista de jornadas se actualiza sola.
9. Probar desde la UI real cada edge case de la tabla de abajo (no solo la función pura): cruce ya existente en la base en otra jornada, dos filas del mismo archivo que arman el mismo cruce, un equipo repetido dos veces en la misma jornada dentro del archivo, un nombre de equipo mal escrito.
10. Probar los límites: un archivo de 1001 filas de datos se rechaza antes de tocar el servidor; un archivo de más de 5 MB se rechaza en el parseo.
11. Probar permisos: invocar `cargarFixtureMasivo` sin sesión de admin (llamada directa, sin pasar por la UI) y confirmar que RLS bloquea el insert, igual que ya ocurre con `crearPartido`.

## Acceptance criteria

- [ ] El botón "Carga masiva" abre un modal para subir un archivo `.xlsx` o `.csv`.
- [ ] Un archivo vacío o sin filas de datos muestra un error claro sin tocar el servidor.
- [ ] Un archivo sin las columnas `Jornada`, `Equipo Local` o `Equipo Visitante` (o con headers mal escritos) muestra qué columnas faltan.
- [ ] Una fila con jornada no numérica o fuera del rango calculado para la liga se marca con error, indicando el máximo de jornadas posible.
- [ ] Una fila con el mismo equipo como local y visitante se marca con error.
- [ ] Una fila con un nombre de equipo que no existe en la liga se marca con error y la UI ofrece un link a la pantalla de equipos.
- [ ] Dos filas del mismo archivo que arman el mismo cruce (en cualquier orden) se marcan con error, referenciando la fila conflictiva.
- [ ] Una fila cuyo cruce ya existe en otra jornada ya cargada en la base se marca con error, indicando que ya está cargado.
- [ ] Dos filas del mismo archivo que hacen jugar al mismo equipo dos veces en la misma jornada se marcan con error.
- [ ] Las filas completamente vacías (blancos al final de la planilla) se ignoran en silencio, sin contar como error ni como fila cargada.
- [ ] Si el archivo declara una jornada mayor a la posible según la cantidad de equipos actual de la liga, la fila se marca con error.
- [ ] Si hay al menos una fila con error, no se inserta ningún partido; el admin ve la lista completa de errores para corregir y reintentar.
- [ ] Si todas las filas son válidas, se insertan todas de una vez y la vista de jornadas se actualiza sin recargar la página.
- [ ] Un archivo de más de 1000 filas de datos o de más de 5 MB se rechaza antes de llegar al servidor.
- [ ] Sin sesión de admin, la inserción queda bloqueada por RLS igual que la carga manual.

## Decisions

- **Yes:** parsear el archivo enteramente en el cliente y enviar solo filas JSON al server action — evita el límite de `bodySizeLimit` (1MB) de los Server Actions y evita subir el binario innecesariamente.
- **Yes:** usar `read-excel-file` en vez de `xlsx`/SheetJS (npm) por las vulnerabilidades sin parchear de esta última en el registro público; también se descartó `exceljs` por su huella de dependencias y una vulnerabilidad moderada transitiva.
- **No:** soporte de `.xls` (legacy binario) — ninguna librería liviana y mantenida disponible lo soporta bien; se prioriza `.xlsx`/`.csv`.
- **Yes:** reutilizar `validarLoteFixture` tanto en el cliente (preview instantáneo, sin request extra) como en el server action (autoritativo, con datos frescos de la base). El cliente nunca decide si algo se inserta.
- **No:** refactorizar `validarEquipoNoRepiteEnJornada`/`validarCruceNoRepetido` (SPEC 03) para compartir código con `validarLoteFixture` — tienen perfiles de ejecución incompatibles (una query por partido vs. un fetch único + loop en memoria); se duplican unas pocas líneas de regla de negocio con comentarios cruzados en vez de forzar una abstracción común.
- **Yes:** import todo-o-nada a nivel de archivo completo.
- **Yes:** el insert final es un único `.insert([...])` con todas las filas — atómico por construcción en Postgres, sin necesitar RPC ni transacción explícita.
- **No:** soporte de carga por URL/link externo (riesgo SSRF).
- **No:** fuzzy matching de nombres de equipo — exacto, case-insensitive, con `trim`.
- **No:** generar/ofrecer una plantilla Excel descargable en esta spec — queda como mejora futura opcional.
- **Yes:** extender `Modal` con una prop `size` opcional y retrocompatible, en vez de construir un overlay nuevo desde cero, para no duplicar el manejo de `Escape`/scroll-lock ya resuelto ahí.
- **No:** chequeo manual de rol admin dentro de `cargarFixtureMasivo` — se mantiene el mismo boundary que el resto del archivo (`admin/layout.tsx` + RLS `is_admin()`).

## Risks

| Risk | Mitigation |
| --- | --- |
| Condición de carrera entre el preview client-side (con datos ya fetcheados por `page.tsx`) y el insert real, si otro proceso carga un partido conflictivo en el medio | El server action siempre revalida desde cero contra la base antes de insertar; el preview del cliente es solo una ayuda de UX, nunca la fuente de verdad. |
| El insert masivo falla por `23505` (constraint de cruce único) a mitad de un archivo grande | Se reporta como error general — no se puede identificar la fila exacta dentro de una violación de constraint multi-fila. Aceptado como riesgo, igual trade-off que SPEC 03 acepta para el insert individual. |
| Admin sube un archivo gigante o corrupto | Límite de tamaño (5 MB) y de filas (1000), aplicado en el cliente y revalidado en el servidor. |
| Nombres de equipo casi iguales pero no exactos (typo, espacio extra, mayúscula distinta) | Cubierto por `trim` + case-insensitive; un typo real sigue siendo un error explícito con mensaje claro y link a Equipos — decisión consciente de no hacer fuzzy matching. |
| Librería de parseo de Excel con vulnerabilidades sin parchear | Se descartó `xlsx`/SheetJS (npm) por esa razón; se usa `read-excel-file`, sin vulnerabilidades reportadas al momento de escribir esta spec. |

## What is **not** in this spec

- Carga por link/URL externa.
- Fuzzy matching de nombres de equipo.
- Plantilla Excel descargable de ejemplo.
- Soporte de `.xls` (formato legacy).
- Reporte de importación parcial.
- Generación automática de cruces / algoritmo de round-robin.

Cada uno de estos, si se implementa, va en su propio spec.
