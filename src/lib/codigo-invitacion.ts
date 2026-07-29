// Alfabeto sin caracteres ambiguos (0/O, 1/I) para que el código se pueda
// compartir de palabra o por WhatsApp sin confusiones.
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generarCodigoInvitacion(longitud = 6) {
  let codigo = "";
  for (let i = 0; i < longitud; i++) {
    codigo += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
  }
  return codigo;
}
