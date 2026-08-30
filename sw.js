// GRID — service worker
//
// Reescrito em 2026-08-28. O anterior (`toledo-labs-shell-v2`) usava um nome
// de cache FIXO e precacheava o `app.html` na instalação. Publicar uma versão
// nova não mudava esse nome, então o service worker nunca se reinstalava e
// continuava entregando a cópia guardada — o usuário precisava limpar o cache
// do navegador para ver a atualização. Era essa a causa do problema relatado.
//
// O que muda aqui:
//   1. O nome do cache deriva de BUILD. A cada publicação o número muda, o
//      arquivo muda, o navegador reinstala o service worker e o `activate`
//      apaga todos os caches antigos (inclusive `toledo-labs-shell-v2`).
//   2. O `app.html` deixa de ser precacheado na instalação. A cópia de
//      emergência é reescrita a cada carregamento bem-sucedido, então nunca
//      congela numa versão antiga.
//   3. `version.json` nunca é cacheado — é o arquivo que o app consulta para
//      saber se existe versão nova.
//
// AO PUBLICAR UMA VERSÃO NOVA: atualize BUILD aqui, o `version` em
// version.json e o `APP_BUILD` dentro do app.html — os três com o mesmo
// número. É o único passo manual do processo.

const BUILD    = '149';
const CACHE    = 'grid-' + BUILD;
const FALLBACK = './app.html';

// Só arquivos estáticos que não mudam entre versões. O app.html NÃO entra
// aqui de propósito — ver item 2 acima.
const ASSETS = [
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // addAll falha inteiro se um único arquivo faltar; aqui cada um é
      // independente, para um ícone ausente não impedir a instalação.
      .then((cache) => Promise.all(ASSETS.map((u) => cache.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;

  // version.json: sempre da rede, nunca guardado. É o sinal de versão nova.
  if (url.pathname.endsWith('/version.json')) {
    event.respondWith(fetch(req, { cache: 'no-store' }));
    return;
  }

  // Navegação: rede primeiro, sem cache. Em sucesso, atualiza a cópia de
  // emergência; só cai para ela se a rede falhar de verdade.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((res) => {
          if (res && res.ok) {
            const copia = res.clone();
            caches.open(CACHE).then((c) => c.put(FALLBACK, copia)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(FALLBACK))
    );
    return;
  }

  // Demais arquivos estáticos: cache primeiro. Seguro porque o nome do cache
  // muda a cada publicação — não existe cópia sobrevivendo entre versões.
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      if (res && res.ok && res.type === 'basic') {
        const copia = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {});
      }
      return res;
    }))
  );
});
