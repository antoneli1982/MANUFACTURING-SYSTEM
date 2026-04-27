// LION MES — Service Worker
// Estratégia: cache-first para a app shell, network-first para terceiros (fontes Google)

const CACHE_NAME = 'lion-mes-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// INSTALL — pré-cacheia o shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // addAll pode falhar se um item der 404 — usamos add individual e ignoramos falhas
      return Promise.all(
        APP_SHELL.map((url) =>
          cache.add(url).catch((err) => console.warn('SW: failed to cache', url, err))
        )
      );
    })
  );
  self.skipWaiting();
});

// ACTIVATE — limpa caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// FETCH — cache-first com fallback de rede; atualiza cache em background
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Só GET; ignora chrome-extension://, etc.
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((resp) => {
          // Só cacheia respostas válidas mesma origem ou cors básicos
          if (resp && resp.status === 200 && (resp.type === 'basic' || resp.type === 'cors')) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone));
          }
          return resp;
        })
        .catch(() => cached); // offline → devolve cache (se houver)

      // cached primeiro pra velocidade; senão espera a rede
      return cached || networkFetch;
    })
  );
});
