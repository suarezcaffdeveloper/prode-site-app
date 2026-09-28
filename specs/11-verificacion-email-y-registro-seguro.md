# SPEC 11 — Verificación de Email y Registro Seguro

> **Status:** Implementado (pendiente de prueba manual en UI) · **Depends on:** SPEC 01 · **Date:** 2026-09-28
> **Objective:** Garantizar que el email de cada usuario sea real y esté bajo su control antes de dejarlo entrar a la app, porque es el único canal para contactar ganadores del pozo (SPEC 09). De paso, endurecer el formulario de registro: confirmación de contraseña, validación de contraseña segura y visibilidad de contraseña (ojito), con un flujo de confirmación de cuenta profesional en vez de un simple link automático.

## Scope

**In:**

- **Confirmación de email obligatoria** para cuentas creadas con email/password (`enable_confirmations = true` en Supabase Auth). Mientras la cuenta no esté confirmada, el usuario no puede iniciar sesión ni acceder a rutas protegidas.
- **Flujo de confirmación con doble paso (link + botón), no auto-confirmación al abrir el link:**
  1. Al registrarse, se genera el link de confirmación con la Admin API de Supabase (`auth.admin.generateLink({ type: "signup", ... })`, requiere `SUPABASE_SERVICE_ROLE_KEY` server-side) y se envía un email propio con Resend (`src/lib/email.ts`), con el mismo diseño de marca que el resto de los emails de la app (ver `armarEmailGanador` como referencia de layout).
  2. El link apunta a una página de la app (`/auth/confirmar?token_hash=...&type=signup`), **no** ejecuta la verificación al cargar. La página muestra el email destino y un botón **"Confirmar mi cuenta"**.
  3. Recién al hacer clic en ese botón se llama a `supabase.auth.verifyOtp({ token_hash, type: "signup" })`, que confirma la cuenta y crea la sesión. Esto evita que escáneres de seguridad corporativos (Outlook/Gmail que pre-visitan links de emails) consuman el token antes de que el usuario lo abra intencionalmente.
  4. Confirmada la cuenta, se redirige a `/ligas` (mismo destino que el callback de Google OAuth), ya logueado.
- **Reenvío de confirmación:** si un usuario con cuenta no confirmada intenta iniciar sesión, se le muestra el aviso existente ("Todavía no confirmaste tu email...") con un botón **"Reenviar email de confirmación"**. Sujeto a rate limit para evitar abuso (ver Risks).
- **Google OAuth queda exceptuado:** Google ya verifica el email antes de autorizar el login, así que esas cuentas se consideran confirmadas automáticamente (comportamiento nativo de Supabase Auth, sin cambios).
- **Registro endurecido (`/registro`):**
  - Segundo campo "Repetir contraseña", con validación en vivo de que coincide con el primero (mensaje de error/éxito mientras se escribe, sin esperar al submit).
  - Validación de contraseña segura, en cliente (feedback inmediato) y en servidor (fuente de verdad): mínimo 8 caracteres, al menos 1 mayúscula, 1 minúscula y 1 número. Sin exigencia de símbolo especial.
  - Indicador visual de qué reglas cumple la contraseña a medida que el usuario escribe (checklist: longitud, mayúscula, minúscula, número).
  - Botón "ojito" en ambos campos de contraseña (mostrar/ocultar), accesible (`aria-label` que cambia entre "Mostrar contraseña" / "Ocultar contraseña", `type` del input alternando `password`/`text`).
  - `minimum_password_length = 8` y `password_requirements = "lower_upper_letters_digits"` en `supabase/config.toml`, para que Supabase Auth rechace en el servidor cualquier intento que esquive la validación del cliente.
- **Pantalla intermedia post-registro:** en vez de redirigir directo a `/ligas` (como hoy), `/registro` redirige a `/registro/revisa-tu-email?email=...` con las instrucciones de revisar la bandeja de entrada (y spam) y un botón de reenvío.
- **Mensajes de error en español**, consistentes con el resto del proyecto (reutilizar y extender `traducirError` en `login/actions.ts` y `registro/actions.ts`).

**Out of scope (for future specs):**

- Recuperación de contraseña olvidada ("¿Olvidaste tu contraseña?"). No existe hoy y no fue pedido; queda para un spec propio que puede reusar buena parte de esta infraestructura (Resend + `generateLink`).
- Cambio de email de una cuenta existente (`double_confirm_changes` ya está en `true` en config, pero no hay UI).
- Autenticación de dos factores (2FA/MFA).
- CAPTCHA en registro/login (Supabase soporta hCaptcha/Turnstile vía `[auth.captcha]`, pero no fue pedido; se deja como riesgo mitigable a futuro si hay abuso de registros).
- Verificación de que el dominio del email exista de verdad (MX record) o que no sea un email descartable (`tempmail`, etc.). La confirmación por link ya cubre el caso principal (el usuario debe tener acceso real a la casilla); un filtro de dominios descartables es una mejora aparte.
- Unificar todos los emails de Supabase Auth (invite, magic link, recovery) bajo el envío propio con Resend. Este spec solo cubre el email de **confirmación de signup**; el resto de las plantillas de Supabase Auth quedan con su comportamiento default sin tocar.

## Data model

No se agregan tablas ni columnas. El estado de confirmación vive donde Supabase Auth ya lo guarda nativamente: `auth.users.email_confirmed_at` (accesible en server actions vía el `user` que devuelve `supabase.auth.getUser()` / `getSession()`, como `email_confirmed_at: string | null`). No hace falta espejarlo en `public.usuarios` porque:

- El trigger `handle_new_user()` (SPEC 01) ya inserta la fila en `usuarios` al crearse el `auth.users`, esté confirmado o no — sin cambios.
- Ninguna policy de RLS actual depende de si el email está confirmado; el control de acceso se hace en la capa de aplicación (middleware + `signInWithPassword` fallando con `Email not confirmed` hasta confirmar).

Variables de entorno nuevas (`.env.local` y variables del proyecto en Vercel/producción):

```
SUPABASE_SERVICE_ROLE_KEY=...   # server-only, nunca exponer al cliente ni loguear
```

`RESEND_API_KEY`, `EMAIL_FROM` y `EMAIL_REPLY_TO` ya existen (spec 09) y se reutilizan tal cual.

Conventions:

- La Service Role Key se usa **solo** en un helper server-only nuevo (`src/lib/supabase/admin.ts`, marcado `import "server-only"` como `src/lib/email.ts`), llamado exclusivamente desde `registro/actions.ts` y desde la acción de reenvío. Nunca se importa desde un Client Component ni se expone en una ruta pública.
- El `token_hash` del link de confirmación es de un solo uso y expira según `otp_expiry` (`supabase/config.toml`, default 3600s = 1 hora); si expiró, `verifyOtp` devuelve error y la página de confirmación ofrece reenviar.

## Implementation plan

1. **Config de Supabase Auth:** en `supabase/config.toml`, setear `auth.email.enable_confirmations = true`, `auth.minimum_password_length = 8`, `auth.password_requirements = "lower_upper_letters_digits"`. Correr migración/relink local y confirmar que un `signUp` de prueba ya no crea sesión hasta confirmar.
2. **Service role client:** crear `src/lib/supabase/admin.ts` con un cliente Supabase inicializado con `SUPABASE_SERVICE_ROLE_KEY` (sin persistencia de sesión), server-only. Agregar `SUPABASE_SERVICE_ROLE_KEY` a `.env.local` (valor ya visible en el dashboard local de Supabase) y documentarla en el README/`.env.example` si existe.
3. **Email de confirmación con marca propia:** agregar a `src/lib/email.ts` un `armarEmailConfirmacion({ email, confirmUrl })` con el mismo layout/tabla-inline-styles que `armarEmailGanador`, texto claro ("Confirmá tu cuenta para empezar a pronosticar") y botón que linkea a `/auth/confirmar?token_hash=...&type=signup`.
4. **`registro/actions.ts`:** en vez de `supabase.auth.signUp(...)`, usar el cliente admin para `generateLink({ type: "signup", email, password })`, que crea la cuenta y devuelve `properties.hashed_token` en un solo paso (sin disparar el mail nativo de Supabase). Armar la URL de confirmación apuntando a `/auth/confirmar?token_hash=...&type=signup`, mandarla con `enviarEmail`, y redirigir a `/registro/revisa-tu-email?email=...`. Manual test: registrarse y ver el mail llegar con el diseño correcto.
5. **Página `/auth/confirmar`:** Server Component que lee `token_hash` y `type` de la URL (`searchParams`) y renderiza un Client Component con un botón "Confirmar mi cuenta" que dispara una server action con `supabase.auth.verifyOtp({ token_hash, type })`. Éxito → redirige a `/ligas`; error (token vencido/ya usado) → mensaje claro + link a `/login`. Manual test: clic en el link del mail, confirmar con el botón, terminar logueado en `/ligas`.
6. **Página `/registro/revisa-tu-email`:** pantalla con instrucciones (revisar spam, tiempo de expiración) y botón "Reenviar email de confirmación" que llama a una nueva server action (`reenviarConfirmacion(email)` en `src/lib/auth-actions.ts`, compartida con el paso 7). **Ajuste sobre el plan original:** este reenvío usa `supabase.auth.resend({ type: "signup", email })` (el mail nativo de Supabase Auth) en vez de repetir `generateLink` + el mail propio de Resend. Motivo: `generateLink({ type: "signup" })` requiere la contraseña en texto plano, que ya no tenemos disponible en esa pantalla (no se persiste tras el registro); `resend()` es el método pensado específicamente para este caso y no la necesita. Como contrapartida, el email de reenvío usa la plantilla nativa de Supabase (no la de marca) y depende de que el SMTP de Supabase esté configurado — ver Risks.
7. **Reenvío desde `/login`:** cuando `iniciarSesion` devuelve el error "Email not confirmed", agregar en la UI un botón "Reenviar email de confirmación" que llama a la misma acción del paso 6. Manual test: intentar loguear con cuenta no confirmada, pedir el reenvío, confirmar y loguear.
8. **`PasswordField` component:** nuevo `src/components/ui/password-field.tsx` (Client Component) que envuelve `Field` agregando el botón ojito (toggle `type` entre `password`/`text`) con `aria-label` dinámico. Reemplaza el uso de `Field` para contraseña en `/login` y `/registro`.
9. **Validación de contraseña segura + confirmación en `/registro`:**
   - Helper compartido `src/lib/password.ts` con la regla (8+ caracteres, mayúscula, minúscula, número) y una función que devuelve qué reglas cumple, usada tanto en el cliente (checklist en vivo) como en `registro/actions.ts` (validación server-side antes de llamar a `signUp`, con mensaje de error igual de específico que el checklist).
   - Segundo campo "Repetir contraseña" en `/registro/page.tsx`, comparado en vivo contra el primero (estado de React, sin necesidad de submit) y también validado en `registro/actions.ts` antes de llamar a `signUp`.
   - Manual test: contraseña débil bloqueada con mensaje específico; contraseñas que no coinciden bloqueadas antes de tocar el servidor; contraseña fuerte y coincidente pasa.
10. **Middleware:** sin cambios en `src/lib/supabase/middleware.ts`. Verificado: `/auth/confirmar` ya matchea `pathname.startsWith("/auth/")` (público) y `/registro/revisa-tu-email` ya matchea `pathname.startsWith("/registro")` (ruta de auth, accesible sin sesión); un usuario sin confirmar nunca tiene `user`, así que ya queda afuera de rutas protegidas sin agregar nada.
11. **Traducción de errores:** extender `traducirError` en `registro/actions.ts` para los nuevos casos (contraseñas no coinciden, contraseña débil con detalle de qué falta) y revisar que el mensaje "Email not confirmed" en `login/actions.ts` siga siendo el correcto con confirmaciones activas.

## Acceptance criteria

- [ ] Un usuario que se registra con email/password **no** queda logueado automáticamente; recibe un email de confirmación con diseño de marca.
- [ ] El email de confirmación tiene un link que abre una página de la app con un botón "Confirmar mi cuenta"; la cuenta **no** se confirma solo con abrir el link, sino recién al hacer clic en el botón.
- [ ] Al confirmar la cuenta, el usuario queda logueado y es redirigido a `/ligas`.
- [ ] Un usuario no confirmado que intenta iniciar sesión ve el mensaje de "todavía no confirmaste tu email" con opción de reenviar el mail de confirmación.
- [ ] El link de confirmación deja de funcionar después de usarse una vez o de expirar (1 hora), mostrando un error claro y la opción de reenviar.
- [ ] Un usuario que inicia sesión con Google queda logueado sin pasar por el flujo de confirmación por email.
- [ ] El formulario de registro tiene un campo "Repetir contraseña" que muestra en vivo si coincide o no con la contraseña ingresada, antes de enviar el formulario.
- [ ] Una contraseña de menos de 8 caracteres, sin mayúscula, sin minúscula o sin número es rechazada con un mensaje que indica exactamente qué falta, tanto si el usuario la corrige a tiempo (cliente) como si igual llega al servidor.
- [ ] Ambos campos de contraseña en `/registro` (y el de `/login`) tienen un botón de "ojito" que alterna mostrar/ocultar el valor tipeado.
- [ ] Intentar registrarse con contraseñas que no coinciden no llega a crear la cuenta.

## Decisions

- **Yes:** confirmación de email obligatoria vía Supabase Auth (`enable_confirmations = true`) en vez de un sistema de verificación construido desde cero. Motivo: es el mecanismo nativo, ya probado, y el proyecto ya tiene la ruta `/auth/callback` con el mismo patrón (`exchangeCodeForSession` / `verifyOtp`) para OAuth.
- **Yes:** flujo de "link que lleva a una página con botón", no link que auto-confirma al abrirse. Motivo: evita que escáneres de seguridad de email corporativo consuman el token antes de que el usuario real lo use, un problema conocido de los links de confirmación "de un clic automático".
- **Yes:** email de confirmación enviado con la infraestructura propia de Resend (`src/lib/email.ts` + `SUPABASE_SERVICE_ROLE_KEY` + `generateLink`) en vez del envío nativo de Supabase Auth vía SMTP configurado en el dashboard. Motivo: mismo look & feel de marca que el resto de los mails de la app (ganadores), todo versionado en el repo en vez de vivir en el dashboard de Supabase, y reusa el proveedor (Resend) que el usuario ya tenía pensado para producción.
- **Yes:** reenvío de confirmación disponible desde `/login` y desde la pantalla post-registro. Motivo: un email puede perderse o caer en spam; sin reenvío, la única salida sería registrarse de nuevo (probablemente fallando por "email ya registrado").
- **Yes:** Google OAuth exceptuado del flujo de confirmación. Motivo: Google ya validó la casilla del usuario antes de autorizar el login; pedirle confirmación de nuevo sería fricción sin beneficio de seguridad.
- **Yes:** contraseña de 8+ caracteres, mayúscula, minúscula y número, **sin** símbolo obligatorio. Motivo: estándar razonable (alineado con guías actuales tipo NIST 800-63B, que ya no recomiendan forzar símbolos) con menos fricción que exigir además un carácter especial.
- **No:** recuperación de contraseña ("olvidé mi contraseña") en este spec. No fue pedido y es un flujo separado, aunque reutilizará gran parte de esta infraestructura (queda anotado para spec futuro).
- **No:** CAPTCHA en el registro. No fue pedido; se deja como mitigación futura si aparece abuso de registros masivos (bots creando cuentas para spamear el reenvío de confirmación).
- **No:** espejar el estado de confirmación en `public.usuarios`. Motivo: Supabase Auth ya es la fuente de verdad (`auth.users.email_confirmed_at`); duplicarlo agregaría una sincronización innecesaria.

## Risks

| Risk | Mitigation |
| --- | --- |
| El SMTP de producción con Resend no está confirmado como funcionando (el usuario no está seguro de haberlo configurado para prod). | Antes de mergear, probar el envío real en el entorno de producción/staging con una cuenta de prueba; si falla, es bloqueante para activar `enable_confirmations = true` ahí (en local no afecta porque Resend se llama desde el propio código, no desde el SMTP de Supabase). |
| El botón "Reenviar email de confirmación" usa `supabase.auth.resend()`, que sí depende del SMTP **nativo** de Supabase (a diferencia del mail inicial, que va por Resend desde el código). En local lo captura Mailpit automáticamente; en producción, si no hay un SMTP configurado en el dashboard de Supabase, el reenvío falla aunque el mail inicial funcione. | Configurar un proveedor SMTP (puede ser el mismo Resend, vía sus credenciales SMTP) en el dashboard de Supabase Auth para producción. Documentado como pendiente de verificar junto con el riesgo de arriba. |
| `SUPABASE_SERVICE_ROLE_KEY` es una credencial muy sensible (bypassa RLS por completo); un uso accidental fuera de `src/lib/supabase/admin.ts` sería una falla de seguridad grave. | Aislar el cliente admin en un único archivo `server-only`, nunca importado desde código de cliente; code review explícito de este punto antes de mergear. |
| Un usuario pide reenvío de confirmación muchas veces seguidas (abuso o bug de UI). | Rate limit ya existe a nivel Supabase (`auth.rate_limit.email_sent`, `auth.email.max_frequency`); además, deshabilitar el botón de reenvío por unos segundos después de cada click en la UI. |
| El link de confirmación expira (1 hora) antes de que el usuario lo abra. | Mensaje de error específico en `/auth/confirmar` ("el link venció") con botón directo para reenviar, en vez de un error genérico. |
| Cuentas ya existentes creadas antes de este spec (con `enable_confirmations = false`) podrían quedar bloqueadas si Supabase las tratara como "no confirmadas" al activar el flag. | Confirmar que Supabase marca `email_confirmed_at` en el momento del signup cuando el autoconfirm está activo (comportamiento esperado), por lo que activar el flag más adelante no afecta retroactivamente a usuarios ya creados. Verificar con una consulta a `auth.users` antes de activar en producción. |

## What is **not** in this spec

- Recuperación de contraseña olvidada.
- Cambio de email de una cuenta existente.
- Autenticación de dos factores (2FA/MFA).
- CAPTCHA en registro/login.
- Verificación de dominio de email real o filtro de emails descartables.
- Unificación de todas las plantillas de Supabase Auth (invite, recovery, magic link) bajo el envío propio con Resend.

Cada uno de estos, si se implementa, va en su propio spec.
