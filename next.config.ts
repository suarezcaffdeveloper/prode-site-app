import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El comprobante de pago (hasta 5 MB) viaja dentro del server action
  // elegirPlan; el límite por defecto de 1 MB lo rechazaba con una excepción.
  experimental: {
    serverActions: { bodySizeLimit: "6mb" },
  },
  // Sin esto, Turbopack detecta el package-lock.json de la carpeta de
  // usuario (un nivel por encima del repo) y toma esa como raíz del
  // workspace por error.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
