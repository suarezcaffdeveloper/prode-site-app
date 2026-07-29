import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sin esto, Turbopack detecta el package-lock.json de la carpeta de
  // usuario (un nivel por encima del repo) y toma esa como raíz del
  // workspace por error.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
