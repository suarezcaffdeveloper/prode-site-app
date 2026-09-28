export type PlanSlug = "suelto" | "mensual_4" | "mensual_10";

export interface Plan {
  slug: PlanSlug;
  nombre: string;
  tipo: "unico" | "mensual";
  cantidadCreditos: number;
  precio: number;
  bullets: string[];
  recomendado?: boolean;
}

// Valores de ejemplo (placeholder): el usuario los va a ajustar más adelante.
// Los slugs anticipan los nombres que va a tener la tabla `planes` real de
// SPEC 04, para no tener que reconciliar nomenclatura cuando se implemente.
// Los datos de la cuenta que cobra (alias, CBU, titular) ya no viven acá: salen
// de variables de entorno (ver src/lib/pago-config.ts, SPEC 11).

export const PLANES: Plan[] = [
  {
    slug: "suelto",
    nombre: "1 prode",
    tipo: "unico",
    cantidadCreditos: 1,
    precio: 1500,
    bullets: [
      "1 prode para jugar en la próxima fecha habilitada.",
      "No vence: lo usás cuando quieras armar tu pronóstico.",
      "Ideal si querés probar antes de suscribirte.",
    ],
  },
  {
    slug: "mensual_4",
    nombre: "4 prodes por mes",
    tipo: "mensual",
    cantidadCreditos: 4,
    precio: 5000,
    recomendado: true,
    bullets: [
      "4 prodes para usar durante el mes, uno por cada fecha.",
      "Si una fecha se suspende y se reprograma, no perdés ese prode: lo jugás cuando se reprograme.",
      "Precio promocional respecto de comprarlos sueltos.",
    ],
  },
  {
    slug: "mensual_10",
    nombre: "10 prodes por mes",
    tipo: "mensual",
    cantidadCreditos: 10,
    precio: 11000,
    bullets: [
      "10 prodes para usar durante el mes, para jugar varias combinaciones en cada fecha.",
      "Si una fecha se suspende y se reprograma, no perdés ese prode: lo jugás cuando se reprograme.",
      "El mayor descuento por volumen del catálogo.",
    ],
  },
];

export function obtenerPlan(slug: string): Plan | undefined {
  return PLANES.find((plan) => plan.slug === slug);
}

export function formatearPrecio(precio: number): string {
  return precio.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
}

export function precioPorProde(plan: Plan): number {
  return plan.precio / plan.cantidadCreditos;
}

// Descuento (en %) del precio por prode frente al plan suelto; null si no ahorra.
export function ahorroVsSuelto(plan: Plan): number | null {
  const base = PLANES.find((p) => p.tipo === "unico");
  if (!base || plan.tipo === "unico") return null;
  const ahorro = 1 - precioPorProde(plan) / precioPorProde(base);
  return ahorro > 0 ? Math.round(ahorro * 100) : null;
}
