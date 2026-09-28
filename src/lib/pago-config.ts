import "server-only";

// Cuenta de Mercado Pago dedicada al prode a la que transfieren los usuarios.
// Salen de variables de entorno (no van hardcodeadas) porque son datos reales.
export type DatosCuenta = {
  alias: string;
  cbu: string;
  titular: string;
};

export function obtenerDatosCuenta(): DatosCuenta | null {
  const alias = process.env.PAGO_ALIAS;
  const cbu = process.env.PAGO_CBU;
  const titular = process.env.PAGO_TITULAR;

  if (!alias || !cbu || !titular) return null;
  return { alias, cbu, titular };
}

// La regla R5 (remitente) puede relajarse si Mercado Pago no informa quién
// transfirió (ver "Spike" de SPEC 11). Por defecto es obligatoria.
export function exigirRemitente(): boolean {
  return process.env.PAGO_EXIGIR_REMITENTE !== "false";
}
