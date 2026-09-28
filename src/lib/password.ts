// Reglas de contraseña segura (SPEC 11), compartidas entre el checklist en
// vivo del cliente y la validación de servidor en registro/actions.ts. La
// fuente de verdad final es Supabase Auth (config.toml: minimum_password_length
// = 8, password_requirements = "lower_upper_letters_digits"), pero validamos
// acá también para dar mensajes específicos en español antes de llamar a la API.

export type ReglasContrasena = {
  longitud: boolean;
  mayuscula: boolean;
  minuscula: boolean;
  numero: boolean;
};

export function evaluarContrasena(password: string): ReglasContrasena {
  return {
    longitud: password.length >= 8,
    mayuscula: /[A-Z]/.test(password),
    minuscula: /[a-z]/.test(password),
    numero: /[0-9]/.test(password),
  };
}

export function esContrasenaSegura(password: string): boolean {
  const reglas = evaluarContrasena(password);
  return reglas.longitud && reglas.mayuscula && reglas.minuscula && reglas.numero;
}

// Mensaje único y específico para el error de servidor, listando lo que falta.
export function mensajeContrasenaInsegura(password: string): string | null {
  const reglas = evaluarContrasena(password);
  const faltantes: string[] = [];

  if (!reglas.longitud) faltantes.push("al menos 8 caracteres");
  if (!reglas.mayuscula) faltantes.push("una letra mayúscula");
  if (!reglas.minuscula) faltantes.push("una letra minúscula");
  if (!reglas.numero) faltantes.push("un número");

  if (faltantes.length === 0) return null;

  return `La contraseña debe tener ${faltantes.join(", ")}.`;
}
