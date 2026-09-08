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

const BUILD    = '162';
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

// ── PRECACHE DE CÓDIGO — preencher na Entrega 2 ────────────────────────────
// Hoje produção é um HTML único e esta lista fica vazia. Quando a Entrega 2
// trouxer `nucleo/` e `modulos/`, cada arquivo precisa entrar aqui.
//
// Por que não basta o network-first do fetch: ele só vale depois que este
// service worker assume a página. No primeiro carregamento após publicar, quem
// responde é o cache HTTP do navegador, e o GitHub Pages manda
// `Cache-Control: max-age=600` — por dez minutos o módulo ANTIGO é servido sem
// consultar o servidor. Aconteceu duas vezes em homologação (h26→h27 e
// h31→h32), e nas duas o número da versão na tela estava certo.
//
// `cache: 'reload'` no install é o que fura esses dez minutos.
const CODIGO = [
  './modulos/crm/acoes.js',
  './modulos/crm/atividades.js',
  './modulos/crm/contatos.js',
  './modulos/crm/conversas.js',
  './modulos/crm/crm.css',
  './modulos/crm/empresa.js',
  './modulos/crm/exemplo.js',
  './modulos/crm/funil.js',
  './modulos/crm/funis.js',
  './modulos/crm/lead.js',
  './modulos/crm/modulo.js',
  './modulos/crm/numeros.js',
  './modulos/crm/painel.js',
  './modulos/treinamentos/modulo.js',
  './nucleo/config.js',
  './nucleo/dados.js',
  './nucleo/design-system-aditivo.css',
  './nucleo/design-system.css',
  './nucleo/estagios.js',
  './nucleo/icones.js',
  './nucleo/navegacao.js',
  './nucleo/plataforma.js',
  './nucleo/sessao.js',
  './nucleo/ui.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // addAll falha inteiro se um único arquivo faltar; aqui cada um é
      // independente, para um ícone ausente não impedir a instalação.
      .then((cache) => Promise.all([
        ...ASSETS.map((u) => cache.add(u).catch(() => null)),
        ...CODIGO.map((u) => fetch(u, { cache: 'reload' })
          .then((res) => res && res.ok ? cache.put(u, res) : null)
          .catch(() => null))
      ]))
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
  // ── 2026-09-05 · correção obrigatória antes da Entrega 2 ──────────────────
  // A estratégia abaixo é cache-first. Hoje isso é quase inofensivo em
  // produção, porque o app é um HTML único e o HTML já é network-first.
  // A Entrega 2 muda esse cenário: ela traz `nucleo/` e `modulos/` — módulos
  // ES importados SEM `?v=` (regra do projeto, correta). Com cache-first, a
  // URL de `nucleo/dados.js` é a mesma em toda versão, e a cópia antiga fica
  // no cache indefinidamente: o cliente vê o número da versão nova na tela e
  // executa o código velho. Aconteceu em homologação entre o h26 e o h27, e
  // levou um ciclo inteiro para ser diagnosticado.
  //
  // `cache: 'reload'` é necessário junto: o GitHub Pages responde com
  // `Cache-Control: max-age=600`, então por dez minutos nem o service worker
  // pergunta ao servidor. São dois caches em série.
  //
  // Imagem e fonte seguem cache-first — não mudam sem mudar de nome.
  const ehCodigo = /\.(js|css)$/i.test(url.pathname);

  if (ehCodigo) {
    event.respondWith(
      fetch(req, { cache: 'reload' }).then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

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
