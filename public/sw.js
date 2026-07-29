// Service worker básico: solo cachea el app shell estático (esta lista de
// assets) para que la PWA instale y abra offline. No cachea datos de
// Supabase ni respuestas dinámicas — eso queda fuera de este spec.
const CACHE_NAME = "prode-shell-v1";
const APP_SHELL = [
  "/offline",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Navegaciones (cargar una página): red primero, y si falla (sin
  // conexión) se cae al app shell offline cacheado.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/offline")),
    );
    return;
  }

  // Assets estáticos propios del shell: cache primero, red de respaldo.
  const url = new URL(request.url);
  if (APP_SHELL.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => cached ?? fetch(request)),
    );
  }
});
