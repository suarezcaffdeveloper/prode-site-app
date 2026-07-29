"use client";

import { useEffect } from "react";

export function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Instalar la PWA sigue funcionando sin SW registrado; solo se
        // pierde el fallback offline del app shell.
      });
    }
  }, []);

  return null;
}
