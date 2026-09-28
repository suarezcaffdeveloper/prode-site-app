# SPEC 01 — Fundaciones: Auth, Ligas, Suscripciones y Subgrupos

> **Status:** Aprobado · **Depends on:** ninguno · **Date:** 2026-07-28
> **Objective:** Levantar la base de la PWA de prode en Next.js + Supabase con autenticación, catálogo de ligas de fútbol administrado, suscripción manual por liga y subgrupos privados dentro de cada liga.

## Scope

**In:**

- Setup del proyecto Next.js (App Router) conectado a Supabase (auth + Postgres).
- Registro e inicio de sesión de usuarios (email/password y Google OAuth vía Supabase Auth).
- Perfil de usuario básico (`usuarios`) vinculado a `auth.users`, con rol `admin` o `usuario`.
- Catálogo de ligas de fútbol (`ligas`), gestionado solo por admin (crear, editar, activar/desactivar).
- Vista pública del catálogo de ligas activas para cualquier usuario logueado.
- Flujo de suscripción manual: usuario pide suscribirse a una liga → queda en estado `pendiente` → admin confirma pago (fuera de la app) y cambia el estado a `activa` desde un panel simple.
- Panel de admin: listado de usuarios por liga con selector para cambiar `estado_suscripcion` (`pendiente` / `activa` / `inactiva`).
- Subgrupos privados (`grupos`) dentro de una liga: cualquier usuario con suscripción `activa` en esa liga puede crear un subgrupo, sin límite de miembros.
- Unión a un subgrupo mediante código corto alfanumérico generado al crear el grupo.
- El creador de un subgrupo es el único con permisos de gestión (echar miembros, renombrar, eliminar el grupo).
- Si la suscripción de un usuario a una liga pasa a `inactiva`, su membresía en los subgrupos de esa liga se mantiene pero queda marcada como oculta/sin puntuar hasta reactivar.
- PWA básica: manifest (`manifest.json`), íconos, meta tags de instalabilidad.
- Service worker básico: cachea el app shell (assets estáticos), la app instala y abre correctamente (Add to Home Screen en mobile/desktop).

**Out of scope (for future specs):**

- Procesamiento de pagos automático (gateway, Stripe/MercadoPago) — el cambio de estado es 100% manual en este spec.
- Carga de fixtures, resultados y motor de cálculo de puntajes (spec aparte).
- Tabla de posiciones / leaderboard (depende del motor de puntajes).
- Notificaciones push (depende del motor de pronósticos/resultados, no existe todavía).
- Soporte offline de datos dinámicos (predicciones, ranking) — el service worker solo cachea el shell estático, no datos de Supabase.
- Temporadas/años por liga (la liga es una entidad simple sin versionado temporal).
- Roles de admin granulares (solo existe `admin` y `usuario`).

## Data model

Se usa el Supabase Auth (`auth.users`) como fuente de identidad. Tablas nuevas en `public`, todas en español:

```sql
-- Perfil de usuario, vinculado 1 a 1 con auth.users
usuarios (
  id            uuid primary key references auth.users(id),
  email         text not null,
  nombre        text,
  rol           text not null default 'usuario' check (rol in ('admin', 'usuario')),
  created_at    timestamptz not null default now()
)

-- Catálogo de ligas de fútbol, administrado por admin
ligas (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  descripcion   text,
  activa        boolean not null default true,
  created_at    timestamptz not null default now()
)

-- Suscripción de un usuario a una liga (1 fila por usuario x liga)
membresias_liga (
  id                  uuid primary key default gen_random_uuid(),
  usuario_id          uuid not null references usuarios(id),
  liga_id             uuid not null references ligas(id),
  estado_suscripcion  text not null default 'pendiente'
                      check (estado_suscripcion in ('pendiente', 'activa', 'inactiva')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (usuario_id, liga_id)
)

-- Subgrupo privado dentro de una liga
grupos (
  id                 uuid primary key default gen_random_uuid(),
  liga_id            uuid not null references ligas(id),
  nombre             text not null,
  creador_id         uuid not null references usuarios(id),
  codigo_invitacion  text not null unique, -- ej. 6 caracteres alfanuméricos
  created_at         timestamptz not null default now()
)

-- Membresía a un subgrupo (1 fila por usuario x grupo)
membresias_grupo (
  id           uuid primary key default gen_random_uuid(),
  grupo_id     uuid not null references grupos(id),
  usuario_id   uuid not null references usuarios(id),
  created_at   timestamptz not null default now(),
  unique (grupo_id, usuario_id)
)
```

Conventions:

- No existe columna de "oculto" en `membresias_grupo`: la visibilidad/puntuación de un miembro se deriva en tiempo de consulta a partir de `membresias_liga.estado_suscripcion` (si no es `activa`, se muestra como inactivo).
- RLS: cualquier usuario autenticado puede leer `ligas` donde `activa = true`; solo `usuarios.rol = 'admin'` puede insertar/editar `ligas` y actualizar `estado_suscripcion` en `membresias_liga`.
- El primer admin se setea a mano en la base (no hay flujo de UI para esto en este spec).

## Implementation plan

1. Crear proyecto Next.js (App Router, TypeScript) e instalar `@supabase/supabase-js` y `@supabase/ssr`.
2. Crear proyecto en Supabase, configurar variables de entorno y clientes de Supabase (browser y server).
3. Migración SQL de la tabla `usuarios` + trigger que inserta una fila al crearse un `auth.users` nuevo (rol por defecto `usuario`).
4. Páginas `/login` y `/registro` con email/password y botón de Google OAuth vía Supabase Auth. Manual test: registrarse, ver la fila creada en `usuarios`.
5. Migración SQL de `ligas` + RLS. Página de admin para crear/editar/activar ligas.
6. Vista de catálogo (`/ligas`) con las ligas activas para cualquier usuario logueado.
7. Migración SQL de `membresias_liga` + RLS. Botón "Quiero suscribirme" en el catálogo que crea la membresía en `pendiente` y muestra instrucciones de pago.
8. Panel de admin (`/admin/ligas/[id]/usuarios`) con listado de usuarios de una liga y selector para cambiar `estado_suscripcion`.
9. Migración SQL de `grupos` + `membresias_grupo` + RLS. Página para crear un subgrupo (solo si `estado_suscripcion = 'activa'` en esa liga), generando `codigo_invitacion`.
10. Página para unirse a un subgrupo ingresando el código, y vista de miembros del subgrupo (marcando como inactivo a quien no tenga suscripción `activa`). Manual test: el creador puede echar miembros y eliminar el grupo; otro miembro no puede.
11. Agregar `manifest.json`, íconos y meta tags de instalabilidad. Registrar service worker básico que cachea el app shell. Manual test: instalar la PWA en Chrome (mobile y desktop).

## Acceptance criteria

> **Nota (2026-09-26):** el criterio de "pedir suscribirse" de abajo quedó **superseded por SPEC 06**, que reemplaza el botón simple "Quiero suscribirme" por la elección de un plan + carga de comprobante. El resto de esta spec (registro, catálogo de ligas, subgrupos) sigue vigente sin cambios.
>
> **Nota (2026-09-28):** la visual de `/grupos/[id]` y el ranking por puntos de los subgrupos (cartón que compite, tabla de posiciones, cartones visibles desde el cierre) se definen en **SPEC 10**. Las reglas de creación, unión por código, gestión del creador y miembros inactivos de esta spec no cambian.

- [ ] Un usuario puede registrarse con email/password y queda logueado.
- [ ] Un usuario puede iniciar sesión con Google OAuth.
- [ ] Al registrarse se crea automáticamente una fila en `usuarios` con rol `usuario`.
- [ ] Un admin (rol seteado a mano en la base) puede crear una liga desde el panel de admin.
- [ ] Un usuario logueado ve el catálogo de ligas activas.
- [ ] ~~Un usuario puede pedir suscribirse a una liga y su membresía queda en estado `pendiente`.~~ Ver SPEC 06.
- [ ] El admin puede cambiar el estado de suscripción de un usuario a `activa` desde el panel.
- [ ] Un usuario con suscripción `activa` en una liga puede crear un subgrupo y recibe un código corto de invitación.
- [ ] Otro usuario con suscripción `activa` en la misma liga puede unirse al subgrupo ingresando el código.
- [ ] Un usuario sin suscripción `activa` no puede crear ni unirse a un subgrupo de esa liga.
- [ ] El creador de un subgrupo puede echar miembros y eliminar el grupo; otros miembros no pueden.
- [ ] Si se desactiva la suscripción de un usuario, aparece marcado como inactivo en la lista de miembros del subgrupo, sin perder su membresía.
- [ ] La PWA se puede instalar (Add to Home Screen) en Chrome mobile y desktop.
- [ ] Con la app instalada y sin conexión, el app shell carga (aunque las páginas dinámicas fallen sin red).

## Decisions

- **Yes:** tablas y columnas en español, consistente con el dominio del producto.
- **Yes:** suscripción manual (estado editado a mano por admin) en vez de integrar un gateway de pago ahora. Motivo: el pago se gestiona fuera de la app por decisión del usuario, y esto simplifica drásticamente el spec.
- **No:** roles de admin granulares (múltiples niveles). Innecesario con un solo rol de admin.
- **Yes:** al desactivar una suscripción, el miembro queda oculto/marcado en el subgrupo en vez de ser expulsado automáticamente. Motivo: evita perder el historial de membresía si el usuario vuelve a pagar.
- **No:** límite de miembros por subgrupo. No fue pedido.
- **Yes:** código corto alfanumérico para unirse a grupos, en vez de link con token. Motivo: más simple de compartir por WhatsApp o verbalmente.
- **No:** concepto de temporada/año en ligas. Se definirá en el spec de fixtures/resultados si hace falta.
- **Yes:** PWA básica (manifest + service worker de app shell) incluida en este spec. Motivo: es configuración de proyecto, no lógica de negocio nueva, y no agrega otro dominio de decisiones.
- **No:** notificaciones push y soporte offline de datos dinámicos en este spec. Dependen de features que todavía no existen (pronósticos, resultados).

## Risks

| Risk | Mitigation |
| --- | --- |
| No hay UI para asignar el primer admin | Se documenta como paso manual: `UPDATE usuarios SET rol='admin' WHERE email=...` ejecutado directo en Supabase. |
| Un usuario pide suscripción y el admin tarda en confirmar el pago | El estado `pendiente` queda visible en la UI del usuario para que sepa que está esperando confirmación. |
| Colisión o reutilización del código de invitación de un grupo | Generar código de longitud suficiente (6 caracteres alfanuméricos) con constraint `UNIQUE` en la columna. |

## What is **not** in this spec

- Procesamiento de pagos automático (gateway).
- Carga de fixtures, resultados y motor de puntajes.
- Tabla de posiciones / leaderboard.
- Notificaciones push.
- Soporte offline de datos dinámicos.
- Temporadas/años por liga.
- Roles de admin granulares.

Cada uno de estos, si se implementa, va en su propio spec.
