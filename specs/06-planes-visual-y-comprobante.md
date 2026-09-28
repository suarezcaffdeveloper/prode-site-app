# SPEC 06 — Planes de Suscripción (Visual) y Carga de Comprobante

> **Status:** Implementado · **Depends on:** SPEC 01 · **Date:** 2026-09-26
> **Objective:** Reemplazar el botón simple "Quiero suscribirme" (SPEC 01) por una experiencia visual completa: mostrar los 3 planes de la plataforma en la página de la liga, y al elegir uno, explicar el proceso y permitir subir un comprobante de transferencia. El motor real de créditos/pronósticos (SPEC 04/05) sigue sin implementarse; esta spec es un paso intermedio para validar la experiencia de compra antes de construirlo.

## Scope

**In:**

- Catálogo de 3 planes hardcodeado en código (no una tabla `planes` real todavía): "1 prode" (único), "4 prodes/mes" y "10 prodes/mes" (mensuales), cada uno con nombre, precio y una explicación corta.
- Sección "Elegí tu plan" en `ligas/[id]`, visible mientras el usuario no tenga la suscripción `activa` en esa liga (se muestra tanto si no tiene membresía como si está `pendiente` o `inactiva`, para poder elegir o volver a elegir un plan).
- Al elegir un plan, un modal que explica: cómo se usan los prodes (un prode = un pronóstico completo de la próxima fecha habilitada), y para los planes mensuales, que si una fecha se suspende y se reprograma el prode correspondiente no se pierde.
- Datos de transferencia (alias y titular **ficticios**, solo para la demo visual) y el monto del plan elegido.
- Formulario de carga de una imagen de comprobante, con validación server-side (presencia, tipo de archivo, tamaño máximo).
- Persistencia real: el plan elegido y el path del comprobante se guardan en `membresias_liga`; el archivo se sube a un bucket privado de Supabase Storage (`comprobantes`).
- El admin ve, en `admin/ligas/[id]/usuarios/`, qué plan eligió cada usuario y un link para ver su comprobante (signed URL de 10 minutos), y sigue siendo quien activa la suscripción a mano con el selector de estado ya existente (sin cambios).

**Out of scope (for future specs):**

- Pasarela de pago real o verificación automática del comprobante. La activación sigue siendo 100% manual, decidida por el admin al mirar el comprobante.
- Tabla `planes` real y el sistema de créditos/lotes (`creditos_lotes`) de SPEC 04, y el consumo de créditos / jornada activa de SPEC 05. Esta spec solo captura la intención de compra, no otorga créditos utilizables.
- Edición o cancelación de una solicitud ya enviada (reenviar sobreescribe el plan/comprobante anterior mientras la membresía siga `pendiente`/`inactiva`, pero no hay un botón explícito de "cancelar").
- Notificar al usuario (email/push) cuando el admin activa o rechaza su solicitud.

## Data model

Extiende `membresias_liga` (SPEC 01) con dos columnas nuevas, ajusta el privilegio de `UPDATE` a nivel de columna (antes era de tabla completa) y agrega un bucket de Storage privado:

```sql
alter table public.membresias_liga
  add column plan_elegido text
    check (plan_elegido is null or plan_elegido in ('suelto', 'mensual_4', 'mensual_10')),
  add column comprobante_path text;

revoke update on public.membresias_liga from authenticated;
grant update (estado_suscripcion, plan_elegido, comprobante_path)
  on public.membresias_liga to authenticated;

create policy "membresias_liga_update_propio_pendiente"
on public.membresias_liga for update
to authenticated
using ( usuario_id = (select auth.uid()) )
with check ( usuario_id = (select auth.uid()) and estado_suscripcion = 'pendiente' );

insert into storage.buckets (id, name, public)
values ('comprobantes', 'comprobantes', false)
on conflict (id) do nothing;

create policy "comprobantes_insert_propio"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'comprobantes'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "comprobantes_select_propio_o_admin"
on storage.objects for select
to authenticated
using (
  bucket_id = 'comprobantes'
  and ( (storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin() )
);
```

Conventions:

- `plan_elegido` es texto libre (con `check` de los 3 slugs vigentes), **no** una FK a una tabla `planes` — esa tabla es de SPEC 04 (futura) y representa lo que el admin efectivamente otorgó, un concepto distinto de "lo que el usuario dijo que quiso comprar".
- `comprobante_path` guarda el path dentro del bucket, no una URL pública (el bucket es privado); se resuelve a una URL temporal con `createSignedUrl` cuando el admin necesita verla.
- El path de subida sigue la convención `${usuario_id}/${liga_id}/${uuid}.${ext}`, igual que `escudos` (SPEC 02) pero con el `usuario_id` como primer segmento en vez del `liga_id`, porque acá la policy de Storage necesita filtrar por dueño del archivo, no por liga.
- El `revoke`/`grant` column-scoped es la defensa real contra que un usuario modifique `liga_id`/`usuario_id` de su propia fila: Postgres evalúa privilegios de columna antes que las policies de RLS.

## Implementation plan

1. Migración `supabase/migrations/20260926120000_membresias_liga_plan_y_comprobante.sql` con todo el SQL de la sección Data model.
2. `src/lib/planes.ts`: catálogo de los 3 planes (slug, nombre, tipo, cantidad de créditos, precio, bullets), con `obtenerPlan(slug)`.
3. `src/components/ui/modal.tsx`: componente `Modal` genérico y reutilizable (overlay, cierre con Escape/click afuera, bloqueo de scroll del body).
4. `src/app/(app)/ligas/[id]/actions.ts`: se elimina `suscribirse` (reemplazada) y se agrega `elegirPlan(ligaId, planSlug, prevState, formData)`, que valida el archivo, sube el comprobante y hace upsert sobre `membresias_liga` (insert si no existe la fila, update forzando `estado_suscripcion = 'pendiente'` si ya existía).
5. `src/app/(app)/ligas/[id]/planes-suscripcion.tsx`: client component con el grid de 3 cards y el modal; el formulario dentro del modal se monta solo cuando hay un plan seleccionado (con `key={plan.slug}`) para que `useActionState` arranque limpio en cada selección, y se cierra automáticamente al recibir `{success: true}`.
6. `src/app/(app)/ligas/[id]/page.tsx`: se quita el botón viejo y se renderiza `<PlanesSuscripcion ligaId={...} />` mientras la suscripción no esté `activa`; los avisos de estado `pendiente`/`inactiva` se actualizan para reflejar el nuevo flujo (comprobante en revisión, en vez de "coordiná el pago fuera de la app").
7. `src/app/(app)/admin/ligas/[id]/usuarios/page.tsx`: se agregan `plan_elegido`/`comprobante_path` al select, se generan signed URLs (10 min) para cada membresía con comprobante, y se muestra el plan elegido + link "Ver comprobante" junto al selector de estado existente.

Manual test end-to-end: ver sección Verification del plan de implementación (no repetido acá) — entrar sin membresía, elegir un plan, validar el modal y sus textos según tipo de plan, subir un comprobante, confirmar que el banner pasa a "pendiente" y que el admin ve el plan y puede abrir el comprobante.

## Acceptance criteria

- [ ] Las 3 cards de planes se ven en `ligas/[id]` mientras la suscripción no esté `activa`, y desaparecen cuando sí lo está.
- [ ] Al elegir un plan se abre un modal con la explicación del proceso, la aclaración de fechas suspendidas (solo planes mensuales), el alias/monto de transferencia y el formulario de comprobante.
- [ ] Enviar el formulario sin archivo, con un archivo que no es imagen, o con un archivo demasiado pesado, muestra un error claro y no crea ni modifica ninguna fila.
- [ ] Enviar un comprobante válido sube el archivo al bucket `comprobantes`, guarda `plan_elegido`/`comprobante_path` en `membresias_liga`, deja `estado_suscripcion` en `pendiente`, cierra el modal solo y refresca el banner de estado.
- [ ] Volver a enviar un comprobante mientras la membresía sigue `pendiente`/`inactiva` actualiza la misma fila (no duplica membresías).
- [ ] Un usuario no puede, vía RLS/privilegios, cambiar `liga_id` o `usuario_id` de su propia membresía, ni promoverse a `estado_suscripcion = 'activa'` por su cuenta.
- [ ] El admin ve, para cada membresía con comprobante cargado, el plan elegido y un link que abre la imagen subida.

## Decisions

- **Yes:** eliminar `suscribirse` y el botón "Quiero suscribirme" de SPEC 01 en vez de mantenerlo en paralelo. No tiene sentido ofrecer dos vías de alta a una membresía; el criterio de aceptación correspondiente en SPEC 01 queda anotado como superseded.
- **Yes:** catálogo de planes hardcodeado en código, no una tabla nueva. Implementar la tabla `planes` real de SPEC 04 antes de tener el motor de créditos que la va a usar sería trabajo prematuro; los slugs elegidos ya anticipan esa futura tabla.
- **Yes:** bucket de Storage privado con signed URLs, a diferencia de `escudos` (público). Un comprobante de transferencia es información sensible (nombre, monto, a veces CBU/alias del remitente); un escudo de equipo no.
- **Yes:** acotar el `GRANT UPDATE` de `membresias_liga` a columnas específicas, en vez de confiar solo en la policy de RLS. Es la defensa que efectivamente impide que un usuario reasigne su membresía a otra liga llamando directo a la API.
- **No:** notificaciones al usuario cuando el admin activa/rechaza su solicitud. Se agrega si hace falta en una spec futura, cuando haya un canal de notificaciones definido.
- **No:** permitir cancelar o borrar una solicitud ya enviada. Reenviar el formulario alcanza para corregir un error (sobreescribe plan y comprobante).

## Risks

| Risk | Mitigation |
| --- | --- |
| Un usuario llama a la API directo (sin pasar por `elegirPlan`) y escribe un `comprobante_path` arbitrario | Bajo impacto: el admin revisa manualmente antes de activar, y adivinar el path (UUID) de otro usuario es inviable. Aceptado como riesgo, no bloquea esta spec. |
| El signed URL expira mientras el admin revisa una lista larga de solicitudes | TTL de 10 minutos, generado en cada carga de la página; si expira, recargar la página genera uno nuevo. |
| `plan_elegido` queda desalineado con lo que realmente se otorgó | Es informativo por diseño: el admin decide a mano qué activar, independientemente de lo que el usuario haya marcado. Se resuelve del todo cuando se implemente SPEC 04. |
| Archivo subido no es realmente una imagen válida (extensión falsificada) | Validación server-side por `type` del `File` (MIME reportado por el navegador) y tamaño máximo; no se hace inspección de bytes del archivo. Riesgo aceptado dado que el consumo es un link abierto manualmente por el admin, no una ejecución del archivo. |

## What is **not** in this spec

- Tabla `planes` real y sistema de créditos/lotes (SPEC 04).
- Consumo de créditos / jornada activa / cartones de pronóstico (SPEC 05).
- Pasarela de pago o verificación automática del comprobante.
- Notificaciones de activación/rechazo.
- Cancelación de una solicitud ya enviada.

Cada uno de estos, si se implementa, va en su propio spec.
