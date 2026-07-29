# SPEC 02 — Equipos, Fixture y Resultados

> **Status:** Aprobado · **Depends on:** SPEC 01 · **Date:** 2026-07-29
> **Objective:** Permitir que el admin cargue equipos, fixture de partidos y resultados por liga, con una vista de solo lectura del fixture/resultados para cualquier usuario logueado.

## Scope

**In:**

- Tabla de equipos (`equipos`) por liga, gestionada solo por admin (crear, editar, borrar).
- Subida de escudo de equipo a Supabase Storage (bucket `escudos`, público en lectura, solo admin puede subir).
- Tabla de partidos (`partidos`) por liga: equipo local, equipo visitante, jornada (número asignado a mano por el admin), y fecha/hora opcional (el admin puede dejarla vacía).
- Panel de admin para crear/editar/borrar partidos de una liga, sin restricciones aunque ya tengan resultado cargado.
- Carga de resultado (marcador final: goles local, goles visitante) por parte del admin, lo que cambia el estado del partido de `pendiente` a `finalizado`.
- Confirmación explícita en la UI antes de ejecutar cualquier borrado (equipo o partido).
- Vista de solo lectura del fixture y resultados de una liga (partidos agrupados por jornada), visible para cualquier usuario logueado.

**Out of scope (for future specs):**

- Estados intermedios del partido (ej. "en juego", entretiempo) — solo `pendiente` / `finalizado`.
- Uso de la fecha/hora para bloquear pronósticos o mostrar cuentas regresivas (no hay pronósticos todavía).
- Pronósticos de usuarios sobre los partidos.
- Motor de cálculo de puntajes.
- Tabla de posiciones / leaderboard (ranking privado por liga).
- Validación de que una jornada esté "completa" (el admin puede cargar partidos sueltos sin verificación cruzada).
- Integración con APIs externas de resultados de fútbol.

## Data model

```sql
-- Catálogo de equipos de una liga
equipos (
  id            uuid primary key default gen_random_uuid(),
  liga_id       uuid not null references ligas(id),
  nombre        text not null,
  escudo_url    text, -- URL pública del bucket de Storage `escudos`
  created_at    timestamptz not null default now()
)

-- Partido dentro de una liga
partidos (
  id                  uuid primary key default gen_random_uuid(),
  liga_id             uuid not null references ligas(id),
  jornada             integer not null,
  equipo_local_id     uuid not null references equipos(id),
  equipo_visitante_id uuid not null references equipos(id),
  fecha_hora          timestamptz, -- opcional
  goles_local         integer,
  goles_visitante     integer,
  estado              text not null default 'pendiente'
                      check (estado in ('pendiente', 'finalizado')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (equipo_local_id <> equipo_visitante_id)
)
```

Conventions:

- Storage: bucket `escudos` (público en lectura). Solo `usuarios.rol = 'admin'` puede subir/borrar archivos.
- RLS: cualquier usuario autenticado puede leer `equipos` y `partidos`; solo admin puede insertar/editar/borrar en ambas tablas.
- Un partido pasa a `estado = 'finalizado'` cuando el admin carga `goles_local` y `goles_visitante`; hasta entonces queda `'pendiente'` (ambos campos en `null`).
- `jornada` es un entero libre asignado a mano por el admin, sin validación de que la jornada esté "completa".

## Implementation plan

1. Migración SQL de `equipos` + RLS, y creación del bucket de Storage `escudos` (lectura pública, insert/update/delete solo admin).
2. Página de admin `/admin/ligas/[id]/equipos`: listar, crear, editar y borrar equipos de la liga (con confirmación antes de borrar), con subida de escudo al bucket. Manual test: crear un equipo con escudo y verlo en el listado.
3. Migración SQL de `partidos` + RLS (lectura para cualquier autenticado, escritura solo admin).
4. Página de admin `/admin/ligas/[id]/partidos`: crear, editar y borrar partidos (con confirmación antes de borrar) eligiendo equipo local/visitante del catálogo de esa liga, jornada, y fecha/hora opcional. Manual test: cargar varios partidos en distintas jornadas.
5. Extender la misma página de admin para cargar el marcador (goles local/visitante) de un partido existente, lo que lo pasa a `finalizado`. Manual test: cargar un resultado y ver el cambio de estado.
6. Página pública `/ligas/[id]/partidos`: fixture agrupado por jornada, visible para cualquier usuario logueado, mostrando escudo, nombres, y marcador o "pendiente" según el estado. Manual test: un usuario no-admin ve el fixture completo.

## Acceptance criteria

- [ ] Un admin puede crear un equipo dentro de una liga con nombre y escudo subido a Storage.
- [ ] Un admin puede editar un equipo de una liga.
- [ ] Borrar un equipo pide confirmación explícita antes de ejecutarse.
- [ ] Un usuario no-admin no puede crear, editar ni borrar equipos.
- [ ] Un admin puede crear un partido eligiendo equipo local, equipo visitante y jornada dentro de una liga.
- [ ] Un admin puede indicar fecha/hora al crear un partido, o dejarla vacía.
- [ ] Un partido nuevo queda en estado `pendiente`, sin resultado.
- [ ] Un admin puede editar un partido en cualquier momento, tenga o no resultado cargado.
- [ ] Borrar un partido pide confirmación explícita antes de ejecutarse.
- [ ] Un admin puede cargar el marcador final de un partido, y este pasa a estado `finalizado`.
- [ ] Un usuario no-admin no puede crear, editar ni borrar partidos ni cargar resultados.
- [ ] Cualquier usuario logueado puede ver el fixture completo de una liga, agrupado por jornada.
- [ ] En la vista de fixture, un partido finalizado muestra el marcador; uno pendiente indica que aún no tiene resultado.

## Decisions

- **Yes:** tabla `equipos` propia por liga en vez de texto libre. Evita duplicados/errores de tipeo y permite reutilizar el equipo en todos sus partidos.
- **Yes:** escudo subido a Supabase Storage (bucket `escudos` público). Decisión explícita del usuario.
- **No:** fecha/hora obligatoria. Es opcional porque todavía no hay pronósticos que dependan de un horario límite.
- **Yes:** jornada como número entero libre asignado a mano, sin validación cruzada. Distintas ligas tienen distinta cantidad de equipos y fechas; forzar una estructura rígida no aporta valor ahora.
- **No:** estados intermedios de partido (en vivo, entretiempo). Solo `pendiente`/`finalizado`, ya que no hay integración en tiempo real.
- **Yes:** fixture/resultados visible para cualquier usuario logueado, no solo suscriptos activos. El fixture es información pública del torneo; lo privado/competitivo es el ranking, que se define en otra spec.
- **No:** integración con APIs externas de resultados. Carga 100% manual por admin, consistente con SPEC 01.
- **Yes:** toda acción de borrado (equipo o partido) pide confirmación explícita en la UI antes de ejecutarse. Motivo: evita pérdidas accidentales de datos, pedido explícito del usuario.

## Risks

| Risk | Mitigation |
| --- | --- |
| Admin borra un partido o equipo por error | Se pide confirmación explícita en la UI antes de ejecutar cualquier borrado. |
| Equipo sin escudo cargado | La vista de fixture debe soportar mostrar el equipo solo con nombre (placeholder), sin romper el render. |

## What is **not** in this spec

- Estados intermedios del partido (en vivo, entretiempo).
- Uso de la fecha/hora para bloquear pronósticos o cuentas regresivas.
- Pronósticos de usuarios.
- Motor de cálculo de puntajes.
- Tabla de posiciones / leaderboard.
- Validación de jornada completa.
- Integración con APIs externas de resultados.

Cada uno de estos, si se implementa, va en su propio spec.
