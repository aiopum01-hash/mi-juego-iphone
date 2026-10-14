const CACHE_NAME = "mi-juego-v2";

const FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Solo gestionar peticiones del mismo origen.
  if (url.origin !== self.location.origin) return;

  // Para la navegación principal, intentar obtener la versión nueva.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();

            caches.open(CACHE_NAME).then(cache =>
              cache.put("./index.html", copy)
            );

            return response;
          }

          return caches.match("./index.html").then(cached =>
            cached || response
          );
        })
        .catch(() =>
          caches.match("./index.html").then(cached =>
            cached || Response.error()
          )
        )
    );

    return;
  }

  // Para los archivos precargados, usar la caché y actualizarla
  // en segundo plano cuando haya conexión.
  const path = url.pathname;
  const isLocalFile = FILES.some(file => {
    const expected = new URL(file, self.registration.scope);
    return expected.pathname === path;
  });

  if (!isLocalFile) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(request);

      const networkUpdate = fetch(request)
        .then(response => {
          if (response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        });

      if (cached) {
        event.waitUntil(networkUpdate.catch(() => {}));
        return cached;
      }

      try {
        return await networkUpdate;
      } catch {
        return Response.error();
      }
    })
  );
});
