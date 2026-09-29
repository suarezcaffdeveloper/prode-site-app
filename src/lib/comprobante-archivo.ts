// Validación del archivo de comprobante por su contenido (firma de bytes), no
// por el MIME que reporta el navegador, que puede falsificarse. Solo se
// aceptan los formatos que la API de visión de Gemini puede leer.

export type MediaTypeImagen = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

export const COMPROBANTE_TAMANIO_MAXIMO = 5 * 1024 * 1024; // 5 MB

const EXTENSIONES: Record<MediaTypeImagen, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function empieza(bytes: Uint8Array, firma: number[], desde = 0): boolean {
  return firma.every((byte, indice) => bytes[desde + indice] === byte);
}

export function detectarImagen(
  bytes: Uint8Array,
): { mediaType: MediaTypeImagen; extension: string } | null {
  let mediaType: MediaTypeImagen | null = null;

  if (empieza(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    mediaType = "image/png";
  } else if (empieza(bytes, [0xff, 0xd8, 0xff])) {
    mediaType = "image/jpeg";
  } else if (empieza(bytes, [0x47, 0x49, 0x46, 0x38])) {
    mediaType = "image/gif";
  } else if (
    empieza(bytes, [0x52, 0x49, 0x46, 0x46]) && // "RIFF"
    empieza(bytes, [0x57, 0x45, 0x42, 0x50], 8) // "WEBP"
  ) {
    mediaType = "image/webp";
  }

  return mediaType ? { mediaType, extension: EXTENSIONES[mediaType] } : null;
}
