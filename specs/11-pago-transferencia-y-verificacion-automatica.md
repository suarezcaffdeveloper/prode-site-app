# SPEC 11 — Pago por Transferencia y Verificación Automática de Comprobante

> **Status:** Implementado (pendiente del spike con la cuenta real de Mercado Pago y de prueba manual) · **Depends on:** SPEC 04, SPEC 06 (reemplaza su flujo de comprobante), SPEC 09 (notificaciones) · **Date:** 2026-09-28
> **Objective:** Que el usuario pueda comprar un plan pagando por transferencia a una cuenta de Mercado Pago dedicada al prode, y que la acreditación de sus prodes sea **automática** cuando el comprobante que sube coincide con el movimiento real que entró a esa cuenta. El usuario elige el plan, recibe un monto exacto (con centavos únicos) y los datos de la cuenta, transfiere y sube el comprobante. Una IA con visión **solo lee** el comprobante; un conjunto de reglas determinísticas lo cruza con la cuenta de Mercado Pago y decide. Si todo coincide, se da el alta sin intervención del admin; si algo no cierra (o la imagen no es un comprobante normal), la solicitud queda `pendiente_admin` y el admin la aprueba o rechaza a mano. Esta spec **elimina la activación temporal y automática** de suscripciones que hoy permite jugar sin pagar.

## Scope

**In:**

- **Solicitud de pago (`solicitudes_pago`).** Cada intento de compra es una solicitud con un estado explícito: `esperando_comprobante → verificando → aprobada | pendiente_admin | rechazada`, más `vencida` y `cancelada`. Un usuario tiene como máximo **una solicitud abierta** (`esperando_comprobante`) por liga; elegir otro plan cancela la anterior.
- **Monto único por solicitud.** El usuario no paga el precio de lista redondo sino `precio del plan + centavos únicos` (ej. plan de $5.000 → $5.000,37). Los centavos (0,01–0,99) se eligen al azar entre los que no estén en uso por otra solicitud activa; es la llave que vincula una transferencia con una solicitud concreta, incluso si dos usuarios pagan el mismo plan el mismo día. El monto queda reservado **48 horas**.
- **Datos de la cuenta y monto en pantalla.** El checkout (`checkout-plan.tsx`) muestra el monto exacto a transferir (con botón "Copiar"), alias, CBU y titular de la cuenta de Mercado Pago del prode, y una cuenta regresiva de la reserva. Los datos de la cuenta salen de variables de entorno y reemplazan el `DATOS_TRANSFERENCIA` hardcodeado de `src/lib/planes.ts`.
- **Lectura del comprobante con IA (`src/lib/comprobante-ia.ts`).** Se envía la imagen a la API de Claude (visión, modelo configurable por `ANTHROPIC_MODEL`, por defecto `claude-sonnet-5`) mediante el SDK oficial `@anthropic-ai/sdk` y se fuerza una salida estructurada con `output_config.format` (JSON schema; `effort: "low"`; sin parámetros de muestreo, que Sonnet 5 no admite). La IA **solo extrae datos**; nunca decide si se aprueba. Campos: `es_comprobante`, `legible`, `monto`, `moneda`, `fecha` y `hora` (hora local de Argentina; la hora puede faltar), `remitente_nombre`, `remitente_documento`, `destinatario_nombre`, `destinatario_alias`, `destinatario_cbu`, `numero_operacion`, `banco_o_billetera`, `senales_sospechosas[]` (texto editado, capturas de pantalla de pantalla, inconsistencias visuales) y `confianza` (0–1). La respuesta se valida con un parser estricto; si no cumple el esquema, la solicitud pasa a `pendiente_admin` con motivo `extraccion_invalida`.
- **Lectura de la cuenta de Mercado Pago.** Credenciales de la cuenta dedicada al prode (`MP_ACCESS_TOKEN`), leídas solo desde el servidor. Tres vías que alimentan el mismo ledger `movimientos_mp`:
  1. **Webhook** `POST /api/webhooks/mercadopago`: valida la firma `x-signature` con `MP_WEBHOOK_SECRET`, consulta `GET /v1/payments/{id}`, hace upsert idempotente del movimiento y dispara la conciliación de solicitudes en `verificando`.
  2. **Consulta directa al subir el comprobante:** antes de dejar la solicitud en espera, se buscan por API los pagos recientes (`/v1/payments/search`, últimas horas) para no depender de que el webhook ya haya llegado.
  3. **Reporte de respaldo** (`settlement_report` / `release_report` programados) leído por el cron: concilia ingresos que el webhook no haya notificado y trae **egresos** (retiros, devoluciones, contracargos). **Pendiente hasta cerrar el spike:** las columnas reales del reporte no están confirmadas, así que en esta primera implementación el respaldo es la búsqueda `GET /v1/payments/search` (que el cron ejecuta cada ciclo) y los egresos se detectan por el estado del pago (`refunded` → alerta `devuelto`, `charged_back` → alerta `contracargo`). El ledger completo de egresos vía reporte queda para cuando se conozca el formato.
- **Ledger de la cuenta (`movimientos_mp`).** Registra ingresos y egresos con monto, fecha de acreditación, estado, tipo, datos del pagador (nombre/documento) y el payload crudo. Un movimiento se **consume una sola vez**: queda asociado a la solicitud que aprobó (`solicitud_id` único).
- **Conciliación determinística (`src/lib/conciliacion.ts`, función pura).** Recibe solicitud + extracción de la IA + movimiento candidato (+ comprobantes ya usados) y devuelve `{ aprobar, reglas: [{codigo, ok, detalle}], motivos: [] }`. Se aprueba **solo si todas** las reglas pasan:
  - **R1 — Es un comprobante:** `es_comprobante` y `legible` verdaderos y `confianza` ≥ umbral (0,8), y sin `senales_sospechosas`.
  - **R2 — Monto del comprobante:** igual al `monto_a_transferir` de la solicitud, al centavo.
  - **R3 — Ingreso real en la cuenta:** existe un movimiento de dirección `ingreso`, estado acreditado/aprobado, con ese monto exacto y no consumido por otra solicitud.
  - **R4 — Fecha:** la fecha/hora del comprobante coincide con la de acreditación en Mercado Pago dentro de una tolerancia (15 minutos si el comprobante trae hora; mismo día calendario si solo trae fecha, en zona `America/Argentina/Buenos_Aires`) y es posterior a la creación de la solicitud.
  - **R5 — Remitente:** el remitente del comprobante coincide con el pagador del movimiento en Mercado Pago (normalizado sin tildes ni mayúsculas, comparación por tokens; si ambos traen documento también se compara, tolerando enmascarado parcial). **No** se exige que coincida con el nombre del usuario registrado: puede pagar un familiar o desde otra cuenta.
  - **R6 — Destinatario:** alias, CBU o titular del comprobante corresponden a la cuenta del prode.
  - **R7 — Número de operación:** si el comprobante y el movimiento traen uno y el comprobante fue emitido por Mercado Pago, deben coincidir (el n.º de operación de MP es el id del pago). Si lo emitió otro banco, el n.º que muestra es el de ese banco y no se puede contrastar con el de MP: no penaliza. Si falta en alguno de los dos, tampoco.
  - **R8 — No duplicado:** ni el hash SHA-256 de la imagen ni el número de operación fueron usados en otra solicitud.
  - **R9 — Vigencia:** la acreditación en la cuenta ocurrió mientras la solicitud estaba vigente (dentro de las 48 h de reserva).
- **Aprobación atómica.** Si todas las reglas pasan, se llama a la función `aprobar_solicitud_pago`, que en una sola transacción bloquea la solicitud y el movimiento (`for update`), verifica que el movimiento siga libre, marca la solicitud `aprobada` (`decidida_por = 'sistema'`), consume el movimiento y otorga membresía + lote de créditos con la misma lógica que hoy tiene `activar_suscripcion_liga` (incluida la notificación `plan_acreditado`). Es idempotente: un webhook duplicado o dos conciliaciones concurrentes acreditan una sola vez.
- **Fallback a revisión manual (nunca auto-rechazo).** Cualquier regla que falle deja la solicitud en `pendiente_admin`, con los códigos de regla que fallaron en `motivos` y el detalle completo en `evaluacion`. Casos típicos: la imagen no es un comprobante, monto o fecha que no coinciden, remitente distinto, comprobante duplicado, pago a otra cuenta, IA no disponible (`ia_no_disponible`) o extracción inválida.
- **Espera de la acreditación.** Si el comprobante llega antes de que el movimiento figure en la cuenta, la solicitud queda en `verificando` y el cron la re-evalúa cada pocos minutos; pasados **60 minutos** sin movimiento, pasa a `pendiente_admin` con motivo `sin_movimiento_en_cuenta`.
- **Vencimiento.** El cron marca `vencida` las solicitudes `esperando_comprobante` con más de 48 h y libera sus centavos. Si después llega plata con ese monto, el movimiento queda **sin solicitud asociada** y el admin lo ve en su bandeja.
- **Bandeja del admin (`admin/pagos`).** Lista de solicitudes `pendiente_admin` con: usuario, liga, plan, monto esperado, imagen del comprobante (signed URL de 10 min), datos extraídos por la IA, movimiento candidato de MP (si hay) y una tabla de reglas con ✓/✗ y su detalle. Acciones **Aprobar** (otorga el plan, opcionalmente asociando un movimiento) y **Rechazar** (con motivo obligatorio). Además: movimientos de ingreso sin solicitud asociada y alertas de egreso/contracargo sobre movimientos ya usados. Toda decisión registra `decidida_por`, `admin_id` y `decidida_en`.
- **Estado visible para el usuario** en `ligas/[id]/planes`: esperando pago (con reserva y cuenta regresiva), verificando, acreditado, en revisión, rechazado (con el motivo) o vencido (con acceso a reintentar). Notificaciones in-app (SPEC 09): `plan_acreditado` (ya existe), `pago_en_revision` y `pago_rechazado`.
- **Cliente con service role** (`src/lib/supabase/admin.ts`, `server-only`), usado exclusivamente por el webhook y el cron, que corren sin sesión de usuario.
- **Cierre del hueco actual.** Se elimina la activación temporal: se borra `activar_suscripcion_liga` (hoy cualquier usuario autenticado puede llamarla por API y autoactivarse sin pagar), se retira `elegirPlan` y se revoca el `grant update (plan_elegido, comprobante_path)` de `membresias_liga` que introdujo SPEC 06.
- **Spike de validación previo (paso 0, bloqueante).** Con la cuenta real de Mercado Pago del prode y una transferencia de prueba desde otra cuenta, confirmar: (a) que el webhook se dispara ante transferencias recibidas por alias/CVU, (b) que `GET /v1/payments/{id}` devuelve nombre y/o documento del pagador, (c) qué campos y con qué demora trae el `settlement_report`. Si (b) falla, R5 se degrada (la vinculación queda por monto único + fecha) y se documenta en la spec; si (a) falla, se depende solo de consulta directa + cron, con más latencia. **No se implementa nada más hasta cerrar este spike.**

**Out of scope (for future specs):**

- Checkout Pro / QR / links de pago de Mercado Pago (confirmación por pago dentro de MP, sin comprobante).
- Revocación automática de créditos ante un contracargo o devolución: solo se genera una alerta para el admin.
- Reembolsos y devoluciones iniciados desde la app.
- Renovación automática de suscripciones mensuales (sigue siendo una nueva compra cada ciclo).
- Auto-rechazo de solicitudes: la IA y las reglas solo pueden aprobar o derivar a revisión.
- Más de una cuenta cobradora, o medios de pago distintos de la transferencia a la cuenta de Mercado Pago.
- Aviso por email al admin cuando hay pendientes (la bandeja muestra un contador; el email queda para una spec futura).
- Facturación, impuestos y aspectos legales del cobro.

## Data model

Dos tablas nuevas, una función de creación, tres funciones de decisión y cambios de seguridad en `public`:

```sql
-- Ledger de movimientos de la cuenta de Mercado Pago del prode
create table public.movimientos_mp (
  id                  uuid primary key default gen_random_uuid(),
  mp_id               text not null unique,
  direccion           text not null check (direccion in ('ingreso', 'egreso')),
  tipo                text,
  estado_mp           text not null,
  monto               numeric(12, 2) not null check (monto > 0),
  moneda              text not null default 'ARS',
  fecha_acreditacion  timestamptz not null,
  pagador_nombre      text,
  pagador_documento   text,
  numero_operacion    text,
  raw                 jsonb not null,
  alerta              text check (alerta in ('devuelto', 'contracargo', 'egreso_sobre_movimiento_usado')),
  solicitud_id        uuid unique,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.movimientos_mp enable row level security;

-- Solo el admin lo ve; las escrituras las hace el service role (webhook/cron)
-- y las funciones security definer.
create policy "movimientos_mp_select_admin"
on public.movimientos_mp for select
to authenticated
using ( public.is_admin() );

create trigger movimientos_mp_set_updated_at
before update on public.movimientos_mp
for each row execute function public.set_updated_at();

-- Una solicitud por intento de compra de un plan
create table public.solicitudes_pago (
  id                       uuid primary key default gen_random_uuid(),
  usuario_id               uuid not null references public.usuarios (id),
  liga_id                  uuid not null references public.ligas (id),
  plan_slug                text not null,
  monto_base               numeric(10, 2) not null check (monto_base > 0),
  monto_a_transferir       numeric(10, 2) not null,
  estado                   text not null default 'esperando_comprobante'
    check (estado in (
      'esperando_comprobante', 'verificando', 'aprobada',
      'pendiente_admin', 'rechazada', 'vencida', 'cancelada'
    )),
  expira_en                timestamptz not null default now() + interval '48 hours',
  comprobante_path         text,
  comprobante_sha256       text,
  comprobante_enviado_en   timestamptz,
  extraccion               jsonb,
  evaluacion               jsonb,
  motivos                  text[] not null default '{}',
  decidida_por             text check (decidida_por in ('sistema', 'admin')),
  admin_id                 uuid references public.usuarios (id),
  decidida_en              timestamptz,
  motivo_rechazo           text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  check (monto_a_transferir > monto_base and monto_a_transferir < monto_base + 1)
);

alter table public.movimientos_mp
  add constraint movimientos_mp_solicitud_fk
  foreign key (solicitud_id) references public.solicitudes_pago (id);

-- El monto único no puede repetirse entre solicitudes que todavía compiten por él
create unique index solicitudes_pago_monto_activo_uidx
  on public.solicitudes_pago (monto_a_transferir)
  where estado in ('esperando_comprobante', 'verificando', 'pendiente_admin');

-- A lo sumo una solicitud abierta por usuario y liga
create unique index solicitudes_pago_abierta_uidx
  on public.solicitudes_pago (usuario_id, liga_id)
  where estado = 'esperando_comprobante';

create index solicitudes_pago_estado_idx on public.solicitudes_pago (estado, expira_en);
create index solicitudes_pago_sha_idx on public.solicitudes_pago (comprobante_sha256);

alter table public.solicitudes_pago enable row level security;

create policy "solicitudes_pago_select_propia_o_admin"
on public.solicitudes_pago for select
to authenticated
using ( usuario_id = (select auth.uid()) or public.is_admin() );

-- Sin grants de insert/update/delete: todo cambio pasa por funciones security definer.
-- (En la migración, además, el usuario solo puede leer las columnas necesarias para ver
-- el estado de su pago -- grant select por columna --: `extraccion`, `evaluacion`, `motivos`,
-- `comprobante_sha256` y `decidida_por`/`admin_id` quedan ocultos, y el admin los lee con el
-- service role desde /admin/pagos.)
revoke all on public.solicitudes_pago, public.movimientos_mp from anon, authenticated;
grant select on public.solicitudes_pago, public.movimientos_mp to authenticated;

create trigger solicitudes_pago_set_updated_at
before update on public.solicitudes_pago
for each row execute function public.set_updated_at();
```

Funciones (todas `security definer`, `set search_path = public`):

- `crear_solicitud_pago(p_liga_id uuid, p_plan_slug text) returns public.solicitudes_pago` — exige `auth.uid()`; lee el precio de `planes` (la tabla, no `src/lib/planes.ts`); cancela la solicitud abierta previa del usuario en esa liga; elige un centavo libre al azar y reintenta ante violación del índice único; si no queda ninguno libre, lanza `montos_agotados`.
- `registrar_comprobante(p_solicitud_id uuid, p_path text, p_sha256 text) returns void` — solo el dueño, solo en `esperando_comprobante` y con la reserva vigente (no se puede reemplazar un comprobante ya enviado: si estaba equivocado, el admin lo rechaza y el usuario genera un pago nuevo); guarda path/hash/`comprobante_enviado_en` y pasa a `verificando`.
- `aprobar_solicitud_pago(p_solicitud_id uuid, p_movimiento_id uuid default null) returns void` — autorización: `auth.role() = 'service_role'` (sistema) o `public.is_admin()` (aprobación manual, con o sin movimiento). Bloquea solicitud y movimiento, valida estados y monto, consume el movimiento, escribe `decidida_por`/`admin_id`/`decidida_en` y otorga membresía + lote + notificación mediante una función interna `otorgar_plan_a_usuario(usuario, liga, plan_slug, comprobante_path)` (sin `execute` para nadie más), extraída de la lógica actual de `activar_suscripcion_liga`.
- `rechazar_solicitud_pago(p_solicitud_id uuid, p_motivo text) returns void` — solo admin; motivo obligatorio; crea la notificación `pago_rechazado`.
- Cambio en `notificaciones`: se amplía el `check` de `tipo` con `pago_en_revision` y `pago_rechazado`; `hrefDe` en `src/lib/notificaciones.ts` los manda a `/ligas/{id}/planes`.

Seguridad y limpieza de lo temporal:

```sql
drop function if exists public.activar_suscripcion_liga(uuid, text, text);

revoke update on public.membresias_liga from authenticated;
grant update (estado_suscripcion) on public.membresias_liga to authenticated;
-- (plan_elegido y comprobante_path dejan de ser escribibles por el usuario;
--  ahora los escribe únicamente otorgar_plan_a_usuario)
```

Conventions:

- `monto_a_transferir` se congela al crear la solicitud; un cambio posterior del precio del plan no lo altera. Los centavos únicos son solo para identificar la transferencia: al otorgar el plan, el valor de referencia del prode sigue siendo el precio de lista (`planes.precio`), no el monto con centavos.
- Una solicitud `pendiente_admin` **sigue reservando** su monto único hasta que el admin la resuelva.
- El bucket `comprobantes` y su convención de path (`${usuario_id}/${liga_id}/${uuid}.${ext}`) de SPEC 06 se reutilizan sin cambios. La imagen se sigue sirviendo con signed URL.
- `movimientos_mp.raw` guarda la respuesta completa de Mercado Pago para auditoría y para poder re-evaluar reglas sin volver a consultar la API. `solicitudes_pago.extraccion` guarda lo que leyó la IA, de modo que ninguna decisión depende de volver a llamar a un modelo.
- Zona horaria: todas las fechas se guardan en `timestamptz`; la comparación de R4 se hace en `America/Argentina/Buenos_Aires` porque los comprobantes muestran hora local sin zona.
- Variables de entorno nuevas (todas solo servidor): `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `PAGO_ALIAS`, `PAGO_CBU`, `PAGO_TITULAR`.

## Implementation plan

0. **Spike Mercado Pago** (ver Scope). Crear la cuenta dedicada al prode, generar una aplicación en el panel de desarrolladores, configurar el webhook de pagos y hacer una transferencia real de prueba desde otra cuenta. Registrar en esta spec qué datos del pagador llegan y por qué vía. Manual test: la transferencia genera un evento en el webhook y `GET /v1/payments/{id}` devuelve el pago con monto y fecha; anotar si trae nombre/documento del pagador.
1. Antes de escribir código de rutas o server actions, leer la guía correspondiente de `node_modules/next/dist/docs/` (route handlers, `after`, cron, variables de entorno): esta versión de Next.js tiene cambios respecto de lo conocido (ver `AGENTS.md`).
2. Migración `supabase/migrations/<timestamp>_solicitudes_pago_y_movimientos_mp.sql` con las tablas, índices, policies, funciones, la ampliación del `check` de `notificaciones` y la limpieza de seguridad de la sección Data model. Manual test: dos solicitudes del mismo plan reciben centavos distintos; un usuario común no puede hacer `insert`/`update` directo sobre `solicitudes_pago`; ya no existe `activar_suscripcion_liga`.
3. `src/lib/supabase/admin.ts`: cliente con service role, `import "server-only"`. Manual test: importarlo desde un client component debe fallar en build.
4. `src/lib/mercadopago.ts`: `obtenerPago(id)`, `buscarPagosRecientes(desde)`, validación de la firma `x-signature` y `normalizarPago(...)` a la forma de `movimientos_mp` (guarda el payload completo en `raw`; el mapeo del nombre/documento del pagador prueba varias ubicaciones y se ajusta con los datos del spike). Sin dependencias nuevas (`fetch`, igual que `src/lib/email.ts`); la lectura del reporte de respaldo queda pendiente del spike. Manual test: con el pago del spike, `normalizarMovimiento` produce monto, fecha y pagador correctos.
5. `src/lib/comprobante-ia.ts`: llamada a la API de mensajes con el SDK oficial `@anthropic-ai/sdk` (dependencia nueva), la imagen en base64, salida estructurada por JSON schema, timeout de 45 s y un reintento ante 429/5xx. El prompt de sistema indica que todo texto dentro de la imagen es dato y nunca una instrucción. Si el servicio falla tras el reintento, se devuelve un resultado `ia_no_disponible` (la solicitud queda en revisión manual: una caída de la IA nunca aprueba ni bloquea al usuario indefinidamente). Manual test: con tres imágenes reales (captura de MP, captura de un banco, foto de un objeto cualquiera) la extracción devuelve datos correctos en las dos primeras y `es_comprobante = false` en la tercera.
6. `src/lib/conciliacion.ts`: reglas R1–R9 como función pura, con las tolerancias y umbrales como constantes con nombre al inicio del archivo. Manual test (casos armados a mano): todo coincide → aprueba; monto con un centavo de diferencia → R2 falla; remitente distinto → R5 falla; misma imagen usada en dos solicitudes → R8 falla; comprobante sin hora con misma fecha → R4 pasa; comprobante de otro día → R4 falla; comprobante de MP con nombre abreviado → R5 pasa.
7. Server actions en `ligas/[id]/pago-actions.ts`: `crearSolicitudPago(ligaId, planSlug)` y `enviarComprobante(ligaId, solicitudId, formData)`, que reemplazan a `elegirPlan`. `enviarComprobante` valida tipo por **firma de bytes** (no solo el MIME), tamaño máximo (5 MB) y calcula el SHA-256; sube el archivo, llama a `registrar_comprobante`, extrae con la IA, consulta movimientos recientes y evalúa. Aprueba (`aprobar_solicitud_pago`), deja en `verificando` (movimiento aún no visible) o deriva a `pendiente_admin`. Manual test: un archivo `.txt` renombrado a `.png` es rechazado antes de subirse.
8. Route handlers `POST /api/webhooks/mercadopago` y `GET /api/cron/conciliar` (esta última con `Authorization: Bearer ${CRON_SECRET}`), y el acceso público de ambas rutas en el proxy (`src/lib/supabase/middleware.ts`). No se incluye `vercel.json`: el plan gratuito de Vercel rechaza crons más frecuentes que uno por día, así que la programación (Vercel Cron en un plan que lo permita, o un cron HTTP externo cada ~5 minutos apuntando a `GET /api/cron/conciliar` con `Authorization: Bearer ${CRON_SECRET}`) se configura en el hosting. El cron: sincroniza movimientos recientes, re-evalúa `verificando`, deriva a `pendiente_admin` las de más de 60 min sin movimiento, vence solicitudes de más de 48 h y marca alertas en movimientos ya consumidos que aparezcan devueltos/contracargados. Manual test: reenviar el mismo webhook dos veces no duplica el movimiento ni acredita dos veces; una solicitud `verificando` cuyo movimiento aparece después queda `aprobada` en el siguiente ciclo.
9. UI del usuario: `checkout-plan.tsx` y `planes-suscripcion.tsx` pasan a un flujo de pasos (elegir plan → monto exacto y datos de cuenta con "Copiar" y cuenta regresiva → subir comprobante → estado), con estados `verificando`, `aprobada`, `pendiente_admin`, `rechazada` y `vencida`, y un aviso de privacidad de que el comprobante se procesa con un servicio de IA. Los datos de la cuenta se pasan por props desde el server component; `DATOS_TRANSFERENCIA` se elimina de `src/lib/planes.ts`. Manual test: la pantalla refleja cada estado y el monto mostrado es exactamente el de la solicitud.
10. Bandeja `src/app/(admin)/admin/pagos/` (page + actions): pendientes con imagen, extracción, movimiento candidato y tabla de reglas; acciones Aprobar/Rechazar; sección de movimientos sin solicitud y alertas de egreso/contracargo; contador de pendientes en el menú de admin. Manual test: aprobar una solicitud pendiente otorga los prodes y registra `decidida_por = 'admin'`; rechazar sin motivo es imposible.
11. Notificaciones: crear `pago_en_revision` al derivar a `pendiente_admin` y `pago_rechazado` al rechazar (con `dedupe_key` por solicitud), y registrar los dos tipos en `src/lib/notificaciones.ts`. Manual test: la campanita muestra cada aviso una sola vez.
12. Documentación cruzada: marcar en SPEC 06 (flujo de comprobante y activación temporal) y SPEC 01 como *superseded* por esta spec, y actualizar el punto "verificación real del pago" de SPEC 09 como resuelto.

Manual test end-to-end (lo ejecuta el usuario): elegir un plan → verificar el monto con centavos → transferir ese monto exacto desde otra cuenta → subir el comprobante → confirmar que los prodes se acreditan solos. Repetir con: una foto cualquiera, un comprobante de otro monto, el mismo comprobante dos veces, y un comprobante subido antes de que la plata figure en la cuenta.

## Acceptance criteria

- [ ] Elegir un plan crea una solicitud con un monto único (`precio + 0,01…0,99`) que ninguna otra solicitud activa comparte, y elegir otro plan cancela la solicitud abierta anterior.
- [ ] Un usuario común no puede activar su suscripción ni otorgarse créditos por ninguna vía (ya no existe `activar_suscripcion_liga`; no hay `insert`/`update` directo sobre `solicitudes_pago` ni sobre las columnas de plan/comprobante de `membresias_liga`).
- [ ] Un comprobante válido cuyo monto, fecha, remitente y destinatario coinciden con un ingreso real y libre en la cuenta de Mercado Pago aprueba la solicitud automáticamente y acredita los prodes del plan, sin intervención del admin.
- [ ] La acreditación ocurre **exactamente una vez** aunque el webhook llegue duplicado o el webhook y el cron evalúen la misma solicitud a la vez.
- [ ] Un movimiento de la cuenta solo puede aprobar una solicitud; un segundo comprobante para el mismo movimiento queda en `pendiente_admin`.
- [ ] Subir una imagen que no es un comprobante, un archivo cuyo contenido no es una imagen o una imagen ilegible no aprueba nada: la imagen falsa por firma de bytes se rechaza al subir y la ilegible queda `pendiente_admin`.
- [ ] Monto distinto (aunque sea por un centavo), fecha incoherente, remitente distinto, destinatario ajeno, comprobante duplicado (por hash o número de operación) o ausencia de movimiento dejan la solicitud en `pendiente_admin` con los motivos legibles; el sistema **nunca** rechaza automáticamente.
- [ ] Si el comprobante se sube antes de que el movimiento figure en la cuenta, la solicitud queda `verificando` y se aprueba sola cuando el movimiento aparece; pasados 60 minutos sin movimiento pasa a `pendiente_admin`.
- [ ] Si la API de la IA falla o devuelve algo fuera del esquema, la solicitud queda `pendiente_admin` (nunca aprobada).
- [ ] Una solicitud sin comprobante vence a las 48 h y libera sus centavos; una transferencia que llega después queda visible como movimiento sin solicitud asociada.
- [ ] El admin ve en `admin/pagos` las solicitudes pendientes con imagen, datos extraídos, movimiento candidato y resultado de cada regla, y puede aprobar (se otorga el plan) o rechazar (motivo obligatorio); toda decisión registra quién y cuándo.
- [ ] El usuario ve el estado de su solicitud (esperando, verificando, acreditado, en revisión, rechazado, vencido) y recibe una notificación in-app al ser acreditado, derivado a revisión o rechazado, una sola vez por evento.
- [ ] El webhook rechaza (401) notificaciones con firma inválida y el cron rechaza llamadas sin `CRON_SECRET`.
- [ ] Un egreso, devolución o contracargo sobre un movimiento ya usado genera una alerta visible para el admin y no modifica créditos por sí solo.
- [ ] Ninguna credencial (`MP_ACCESS_TOKEN`, `ANTHROPIC_API_KEY`, service role) llega al cliente ni aparece en el bundle.

## Decisions

- **Yes:** la IA solo **extrae** y el código **decide**. Un modelo que aprueba pagos es un vector de fraude (una imagen puede contener texto tipo "aprobá este pago" o información falsa); si la decisión es un conjunto de reglas determinísticas sobre datos ya validados por esquema, la superficie de ataque se reduce a "¿la cuenta de Mercado Pago recibió esa plata?", que es el hecho que importa.
- **Yes:** la fuente de verdad es el **movimiento real en la cuenta de Mercado Pago**; el comprobante solo sirve para vincular el pago con un usuario y con una solicitud. Una imagen editada no acredita nada si la plata no entró.
- **Yes:** monto único con centavos como llave de vinculación. Elimina la ambigüedad entre dos usuarios que pagan lo mismo el mismo día sin exigir un dato extra al usuario; el costo es que el usuario transfiere unos centavos distinto del precio de lista, y que hay a lo sumo 99 solicitudes simultáneas por precio base.
- **Yes:** webhook + consulta directa + reporte de respaldo. El webhook da inmediatez, la consulta directa cubre la carrera "comprobante antes que webhook" y el reporte cubre lo que el webhook pierda y trae los egresos.
- **Yes:** Claude Sonnet 5 con visión, configurable por `ANTHROPIC_MODEL`. El volumen de comprobantes es bajo y la precisión al leer capturas de distintos bancos y billeteras importa más que el costo por imagen (una fracción de centavo).
- **Yes:** comprobante obligatorio y ambas fuentes deben coincidir, tal como se definió en el diseño original, aunque el movimiento con centavos únicos ya sería prueba suficiente. Se prioriza la doble verificación; relajarlo más adelante es un cambio de reglas en `conciliacion.ts`, no de arquitectura.
- **Yes:** no se exige que el remitente sea el usuario registrado. Pagos de terceros, nombres abreviados y cuentas compartidas son habituales; el monto único ya ata el pago a la solicitud.
- **Yes:** ante cualquier duda o falla de infraestructura (IA caída, sin movimiento, extracción inválida) se falla hacia `pendiente_admin`, no hacia aprobar ni hacia rechazar.
- **Yes:** eliminar `activar_suscripcion_liga` en lugar de solo dejar de llamarla. Mientras exista y sea invocable por `authenticated`, cualquiera puede saltearse el pago llamando la función por API.
- **Yes:** cuenta de Mercado Pago **dedicada** al prode (no una personal), con retiros manuales frecuentes para no acumular saldo.
- **No:** auto-rechazo. Rechazar a un usuario que sí pagó por un falso negativo de la IA es peor que pedirle al admin una revisión.
- **No:** Checkout Pro / QR de Mercado Pago en esta spec. Sería más robusto (el pago se confirma dentro de MP, sin comprobante ni IA) pero cambia el flujo definido; queda como alternativa futura si el spike muestra que la lectura de transferencias directas no es confiable.
- **No:** revocar créditos automáticamente ante contracargos: una alerta al admin evita quitar prodes ya jugados por un error de conciliación.
- **Yes:** SDK oficial `@anthropic-ai/sdk` para llamar a Claude (única dependencia nueva); `fetch` para Mercado Pago, igual que `src/lib/email.ts` para Resend.

## Risks

| Risk | Mitigation |
| --- | --- |
| Las transferencias directas a alias/CVU de una cuenta común de MP podrían no disparar webhook o no traer nombre/documento del pagador | Spike obligatorio antes de implementar (paso 0). Contingencia documentada: sin nombre de pagador, R5 se degrada y la vinculación descansa en monto único + fecha; sin webhook, se usa consulta directa + cron con más latencia. Si ninguna alcanza, replantear con Checkout Pro/QR en una spec nueva. |
| Comprobante falsificado o editado (monto/fecha adulterados) | El comprobante nunca acredita por sí solo: hace falta un ingreso real con ese monto exacto (con centavos únicos) en la cuenta. La IA además reporta `senales_sospechosas`, que derivan a revisión. |
| Prompt injection: texto dentro de la imagen intenta instruir al modelo | La salida de la IA es solo datos validados por esquema; la decisión es código determinístico y el prompt de sistema declara que el texto de la imagen no son instrucciones. |
| La IA lee mal un campo (falso negativo o falso positivo) | Los campos críticos (monto, fecha) se contrastan con el movimiento real; un error de lectura produce, como mucho, una derivación a revisión manual, no una acreditación indebida. |
| El comprobante llega antes que la plata figure en la cuenta | Estado `verificando` con re-evaluación por webhook y cron durante 60 minutos; luego revisión manual. |
| Webhook duplicado, fuera de orden o cron simultáneo | Upsert idempotente por `mp_id`, `for update` en `aprobar_solicitud_pago` y `solicitud_id` único en `movimientos_mp`. |
| Se agotan los centavos disponibles para un precio base (99 solicitudes activas) | `crear_solicitud_pago` falla con un mensaje amable; el volumen esperado hace el caso improbable. Las solicitudes vencen a las 48 h y liberan su monto. |
| Solicitudes `pendiente_admin` acumuladas bloquean centavos | Contador de pendientes en el menú del admin; el admin resuelve o rechaza, lo que libera el monto. |
| Frecuencia del cron limitada por el hosting | El webhook cubre el caso normal; el cron es red de seguridad. Si el plan gratuito no permite ~5 minutos, se usa un cron HTTP externo contra el mismo endpoint. |
| Robo del token de Mercado Pago o del service role | Solo en variables de entorno de servidor; cuenta dedicada con retiros manuales frecuentes para limitar el saldo expuesto; rotación del token ante la menor sospecha. |
| Privacidad: el comprobante contiene datos personales (nombre, documento, cuenta) y se envía a un proveedor de IA | Aviso explícito en el checkout, uso exclusivo para verificar el pago, bucket privado con signed URLs; el proveedor se elige por su política de no entrenamiento con datos de API. |
| Un contracargo o devolución posterior deja créditos ya otorgados sin respaldo | Alerta al admin sobre el movimiento; la decisión (revocar o no) queda manual. Automatizarla es candidata a una spec futura. |
| Desfase de reloj o zona horaria entre el comprobante y MP en R4 | Tolerancia configurable (15 min con hora, mismo día sin hora), comparación en `America/Argentina/Buenos_Aires`; los casos límite caen a revisión manual, no a rechazo. |

## What is **not** in this spec

- Checkout Pro / QR / links de pago de Mercado Pago.
- Revocación automática de créditos por contracargo o devolución.
- Reembolsos iniciados desde la app.
- Renovación automática de suscripciones mensuales.
- Auto-rechazo de solicitudes.
- Múltiples cuentas cobradoras o medios de pago distintos de la transferencia a Mercado Pago.
- Email al admin por solicitudes pendientes.
- Facturación, impuestos y aspectos legales del cobro.

Cada uno de estos, si se implementa, va en su propio spec.
