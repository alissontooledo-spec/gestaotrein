// Service Worker — Toledo Labs
// Escopo: cache do app shell (arquivo app.html + manifest + ícones) para instalação como PWA
// e fallback amigável quando não há conexão. NÃO faz cache de dados (Supabase) —
// todas as operações de dados continuam exigindo internet.

const CACHE_VERSION = 'toledo-labs-shell-v1';
const CORE_ASSETS = [
  './app.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Só tratamos requisições GET de mesma origem (nunca interceptamos Supabase,
  // Resend, BrasilAPI, CDNs de fontes/bibliotecas ou chamadas de API).
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) {
    return;
  }

  // Navegação (abrir/recarregar o app): tenta rede primeiro, cai para o shell
  // em cache se estiver offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('./app.html'))
    );
    return;
  }

  // Demais assets same-origin (ícones, manifest): cache primeiro, com atualização
  // em segundo plano.
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req).then((res) => {
        if (res && res.ok) {
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, res.clone()));
        }
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
