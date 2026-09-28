import "server-only";

import nodemailer, { type Transporter } from "nodemailer";
import { formatearPesos } from "@/lib/pozo";

type EmailParams = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

// SMTP de Gmail con una cuenta dedicada (GMAIL_USER + GMAIL_APP_PASSWORD, una
// contraseña de aplicación generada en myaccount.google.com/apppasswords, NO
// la contraseña real de la cuenta). Antes usábamos Resend vía fetch, pero sin
// un dominio propio verificado Resend solo entrega al email dueño de la
// cuenta (onboarding@resend.dev) y rechaza cualquier otro destinatario — un
// bloqueo real para avisar a usuarios/ganadores de verdad. Gmail SMTP entrega
// a cualquier destinatario real sin ese límite. Si en el futuro se verifica
// un dominio propio en Resend, se puede volver a ese proveedor para mejor
// deliverability a gran escala; para el volumen de una liga de amigos, Gmail
// alcanza de sobra (~500 emails/día en una cuenta gratuita).
let transporter: Transporter | null = null;

function getTransporter(user: string, pass: string): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
  }
  return transporter;
}

export async function enviarEmail({ to, subject, html, text }: EmailParams): Promise<{ error?: string }> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    return { error: "Falta configurar GMAIL_USER y GMAIL_APP_PASSWORD para enviar emails." };
  }

  // El remitente real que ve Gmail en el sobre siempre tiene que ser GMAIL_USER
  // (o un alias "Enviar como" verificado en esa cuenta); solo el nombre de
  // pantalla es libre. Si EMAIL_FROM no está seteado, se arma uno por defecto.
  const from = process.env.EMAIL_FROM || `Prode <${user}>`;
  const replyTo = process.env.EMAIL_REPLY_TO;

  try {
    await getTransporter(user, pass).sendMail({
      from,
      to,
      subject,
      html,
      text,
      ...(replyTo ? { replyTo } : {}),
    });
  } catch (err) {
    const detalle = err instanceof Error ? err.message : "";
    return { error: `No se pudo enviar el email. ${detalle}`.trim() };
  }

  return {};
}

// Email de confirmación de cuenta (SPEC 11). El link lleva a una página propia
// (/auth/confirmar) con un botón que recién ahí dispara la verificación: así
// evitamos que un escáner de seguridad de email (Outlook, Gmail corporativo)
// "gaste" el link solo por pre-visitarlo antes de que el usuario lo abra.
export function armarEmailConfirmacion(params: { confirmUrl: string }): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = "Confirmá tu cuenta en prode";
  const { confirmUrl } = params;
  const urlEscapada = escaparHtml(confirmUrl);

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escaparHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f7f2;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f5f7f2;">Confirmá tu cuenta para empezar a pronosticar en prode.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7f2;padding:32px 12px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e0e6d8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <tr><td style="background:#0b1f14;padding:28px 32px 24px;">
      <div style="font-size:22px;font-weight:800;letter-spacing:-0.5px;color:#ffffff;">prode<span style="color:#a3e635;">.</span></div>
      <div style="margin-top:28px;font-size:12px;font-weight:700;letter-spacing:3px;color:#c2f24e;">CONFIRMÁ TU CUENTA</div>
      <div style="margin-top:8px;font-size:28px;line-height:1.2;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Ya casi estás adentro</div>
    </td></tr>
    <tr><td style="background:#a3e635;height:6px;font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr><td style="padding:32px 32px 8px;color:#10241a;font-size:16px;line-height:1.55;">
      <p style="margin:0 0 12px;">Hola,</p>
      <p style="margin:0;">Para terminar de crear tu cuenta y empezar a pronosticar, confirmá que esta dirección de email es tuya.</p>
    </td></tr>
    <tr><td align="center" style="padding:24px 32px 32px;">
      <a href="${urlEscapada}" style="display:inline-block;background:#14532d;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;">Confirmar mi cuenta</a>
    </td></tr>
    <tr><td style="padding:0 32px 28px;color:#47594f;font-size:13px;line-height:1.5;">
      <p style="margin:0;">Si el botón no funciona, copiá y pegá este link en el navegador:</p>
      <p style="margin:6px 0 0;word-break:break-all;"><a href="${urlEscapada}" style="color:#14532d;">${urlEscapada}</a></p>
    </td></tr>
    <tr><td style="background:#f5f7f2;padding:20px 32px;color:#6f8177;font-size:12px;line-height:1.5;border-top:1px solid #e0e6d8;">
      El link vence en 1 hora. Si vos no creaste esta cuenta, podés ignorar este email.
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    "Hola,",
    "",
    "Para terminar de crear tu cuenta y empezar a pronosticar, confirmá que esta dirección de email es tuya.",
    "",
    `Confirmar mi cuenta: ${confirmUrl}`,
    "",
    "El link vence en 1 hora. Si vos no creaste esta cuenta, podés ignorar este email.",
  ].join("\n");

  return { subject, html, text };
}

function escaparHtml(valor: string): string {
  return valor
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export type AvisoGanador = {
  nombre: string | null;
  ligaNombre: string;
  jornada: number;
  cantidadCartones: number;
  montoTotal: number;
};

// Layout con tablas e inline styles: es lo único que renderizan de forma
// consistente Gmail, Outlook y las apps móviles.
export function armarEmailGanador(aviso: AvisoGanador): { subject: string; html: string; text: string } {
  const liga = escaparHtml(aviso.ligaNombre);
  const saludo = aviso.nombre?.trim() ? `Hola ${escaparHtml(aviso.nombre.trim())},` : "Hola,";
  const saludoTexto = aviso.nombre?.trim() ? `Hola ${aviso.nombre.trim()},` : "Hola,";
  const monto = formatearPesos(aviso.montoTotal);
  const detalleCartones =
    aviso.cantidadCartones === 1
      ? "por tu prode ganador"
      : `por tus ${aviso.cantidadCartones} prodes ganadores`;
  const urlApp = process.env.NEXT_PUBLIC_SITE_URL;
  const subject = `Ganaste ${monto} en ${aviso.ligaNombre} · Jornada ${aviso.jornada}`;

  const boton = urlApp
    ? `<tr><td align="center" style="padding:8px 32px 32px;">
         <a href="${escaparHtml(urlApp)}" style="display:inline-block;background:#14532d;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;">Ir a prode</a>
       </td></tr>`
    : "";

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escaparHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f7f2;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f5f7f2;">Acertaste todos los resultados de la jornada ${aviso.jornada}. Tu premio: ${monto}.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7f2;padding:32px 12px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e0e6d8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <tr><td style="background:#0b1f14;padding:28px 32px 24px;">
      <div style="font-size:22px;font-weight:800;letter-spacing:-0.5px;color:#ffffff;">prode<span style="color:#a3e635;">.</span></div>
      <div style="margin-top:28px;font-size:12px;font-weight:700;letter-spacing:3px;color:#c2f24e;">PRODE GANADOR</div>
      <div style="margin-top:8px;font-size:30px;line-height:1.15;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Acertaste todos los resultados</div>
    </td></tr>
    <tr><td style="background:#a3e635;height:6px;font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr><td style="padding:32px 32px 8px;color:#10241a;font-size:16px;line-height:1.55;">
      <p style="margin:0 0 12px;">${saludo}</p>
      <p style="margin:0;">Felicitaciones: tu pronóstico de la <strong>Jornada ${aviso.jornada}</strong> en <strong>${liga}</strong> fue el ganador. No fallaste ni un marcador.</p>
    </td></tr>
    <tr><td style="padding:24px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#14532d;border-radius:16px;">
        <tr><td align="center" style="padding:28px 16px;">
          <div style="font-size:12px;font-weight:700;letter-spacing:3px;color:#c2f24e;">TU PREMIO</div>
          <div style="margin-top:8px;font-size:44px;line-height:1.1;font-weight:800;color:#ffffff;letter-spacing:-1px;">${monto}</div>
          <div style="margin-top:8px;font-size:14px;color:#d9ead0;">${detalleCartones}</div>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:0 32px 24px;color:#10241a;font-size:15px;line-height:1.55;">
      <p style="margin:0 0 8px;font-weight:700;">Cómo cobrar tu premio</p>
      <p style="margin:0;color:#47594f;">Respondé este email y coordinamos el pago con vos. Te vamos a pedir los datos de una cuenta a tu nombre para transferirte el monto.</p>
    </td></tr>
    ${boton}
    <tr><td style="background:#f5f7f2;padding:20px 32px;color:#6f8177;font-size:12px;line-height:1.5;border-top:1px solid #e0e6d8;">
      Recibís este email porque participaste en ${liga}. Si no reconocés esta participación, ignoralo.
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    saludoTexto,
    "",
    `Felicitaciones: tu pronóstico de la Jornada ${aviso.jornada} en ${aviso.ligaNombre} fue el ganador. No fallaste ni un marcador.`,
    "",
    `Tu premio: ${monto} (${detalleCartones}).`,
    "",
    "Cómo cobrar: respondé este email y coordinamos el pago con vos. Te vamos a pedir los datos de una cuenta a tu nombre para transferirte el monto.",
    ...(urlApp ? ["", urlApp] : []),
  ].join("\n");

  return { subject, html, text };
}
