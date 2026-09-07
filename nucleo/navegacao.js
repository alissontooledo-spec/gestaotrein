/* ══════════════════════════════════════════════════════════════════════════
   GRID · nucleo/navegacao.js
   Registro de módulos, menu em blocos e roteamento.

   Regras que este arquivo garante:
     • Um módulo ACRESCENTA itens; nunca substitui o menu existente.
     • Com um módulo só, não existe bloco nem rótulo de módulo — o menu fica
       igual ao que está em produção hoje.
     • Item com mobile:false não aparece no menu do celular; a rota continua
       existindo e mostra a tela "isto é do computador".
     • Perfil sem acesso não vê o item. A trava de verdade é a RLS no banco.
   ══════════════════════════════════════════════════════════════════════════ */

import { icone } from './icones.js';
import { esc }   from './ui.js';
import * as sessao from './sessao.js';

const _modulos = new Map();
let _rotaAtual = null;
let _moduloAberto = null;

export function registrar(mod) {
  if (!mod || !mod.id) throw new Error('módulo sem id');
  _modulos.set(mod.id, mod);
  if (mod.css) carregarCSS(mod.css, mod.id);
  return mod;
}

export const registrados = () => [..._modulos.values()];
export const modulo = (id) => _modulos.get(id) || null;

/* CSS do módulo, uma vez só, com a versão do app na URL. */
const _css = new Set();
function carregarCSS(href, id) {
  if (_css.has(href) || typeof document === 'undefined') return;
  _css.add(href);
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = href + (href.includes('?') ? '' : `?v=${window.APP_BUILD || 'dev'}`);
  l.dataset.modulo = id;
  document.head.appendChild(l);
}

/* Itens visíveis para o perfil atual e para o formato de tela atual. */
function itensVisiveis(mod) {
  const p = sessao.perfil();
  const cel = sessao.ehCelular();
  return (mod.itens || []).filter(i =>
    !i.oculto && (!i.perfis || i.perfis.includes(p)) && (!cel || i.mobile !== false));
}

/* ── Menu ────────────────────────────────────────────────────────────────────
   `extras` são os itens da plataforma (Início, Configurações), que não
   pertencem a nenhum módulo.                                              */
export function menu({ inicio, configuracoes = [], contadores = {} } = {}) {
  const mods = registrados();
  const umModuloSo = mods.length <= 1;

  const item = (i) => `
    <div class="sidebar-item ${i.id === _rotaAtual ? 'active' : ''}" data-nav="${esc(i.id)}">
      <span class="si-icon">${icone(i.icone || 'grid')}</span>
      <span class="si-label">${esc(i.rotulo)}</span>
      ${contadores[i.id] ? `<span class="mod-cnt">${contadores[i.id]}</span>` : ''}
    </div>`;

  const bloco = (mod) => {
    const aberto = _moduloAberto === mod.id || umModuloSo;
    const cnt = (mod.itens || []).reduce((s, i) => s + (contadores[i.id] || 0), 0);
    return `
      <div class="mod-head ${aberto ? 'aberto' : ''}" data-modulo="${esc(mod.id)}">
        ${icone(mod.icone || 'grid')}${esc(mod.nome)}
        ${aberto ? `<span class="seta">${icone('chevrondown','sm')}</span>`
                 : (cnt ? `<span class="cnt">${cnt}</span>` : `<span class="seta">${icone('chevronright','sm')}</span>`)}
      </div>
      ${aberto ? `<div class="mod-itens">${itensVisiveis(mod).map(item).join('')}</div>` : ''}`;
  };

  return `
    ${inicio ? `<div style="padding:0 10px">${item(inicio)}</div>` : ''}
    ${mods.map(bloco).join('')}
    ${configuracoes.length ? `<div style="margin:12px 10px 0;padding-top:10px;border-top:1px solid rgba(255,255,255,.08)">
      <div class="sidebar-section-label" style="padding-left:2px">Configurações</div>
      ${configuracoes.filter(i => !sessao.ehCelular() || i.mobile !== false).map(item).join('')}
    </div>` : ''}`;
}

/* Rodapé do celular: Início + 2 do módulo aberto + Conta ou seletor. */
export function rodapeCelular() {
  const mods = registrados();
  const mod = modulo(_moduloAberto) || mods[0];
  const dois = itensVisiveis(mod || { itens: [] }).slice(0, 3);
  const fim = mods.length > 1
    ? { id: '__modulos', rotulo: 'Módulos', icone: 'grid' }
    : { id: 'conta', rotulo: 'Conta', icone: 'user' };
  return [{ id: 'home', rotulo: 'Início', icone: 'home' }, ...dois, fim];
}

/* ── Rotas ──────────────────────────────────────────────────────────────── */
export function rota(id) {
  for (const mod of _modulos.values()) {
    const i = (mod.itens || []).find(x => x.id === id);
    if (i) return { modulo: mod, item: i };
  }
  return null;
}

export const rotaAtual = () => _rotaAtual;

/* A tela aberta agora — e quem recebe as acoes declaradas por ela. */
let _telaAberta = null, _paramsAtuais = {};
export const telaAberta = () => _telaAberta;

/* Redesenha a tela atual sem passar pelo roteador: usado depois de uma
   gravacao, para a lista refletir o que acabou de mudar sem piscar a tela
   inteira nem perder a rota. */
/* ── Foco atravessa o redesenho (05/09, h37) ───────────────────────────────
   A tela e refeita INTEIRA a cada acao, entao o campo em que a pessoa estava
   digitando deixa de existir: o foco cai no body e a proxima tecla se perde.
   Quem digita uma busca de tres letras ve o campo morrer no meio.

   A devolucao mora aqui, e nao em quem trata o clique, por um motivo achado
   testando: `acao()` chama `redesenhar()` SEM esperar, entao quem deu
   `await tratarAcao(...)` volta antes do DOM ter sido trocado — e devolvia o
   foco para o elemento velho, que era descartado logo depois. Aqui e o unico
   ponto que sabe exatamente quando o DOM novo entrou.

   Vale para qualquer controle com id, nao so a busca. */
const _EH_TEXTO = (el) => el.tagName === 'TEXTAREA' ||
  (el.tagName === 'INPUT' && /^(text|search|email|tel|url|password)$/.test(el.type));

function _guardarFoco() {
  const el = typeof document !== 'undefined' ? document.activeElement : null;
  if (!el || !el.id || !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return null;
  let pos = null;
  try { pos = el.selectionStart; } catch (e) { /* number/email nao tem selecao */ }
  /* Guarda tambem o TEXTO, e nao so a posicao — ver _devolverFoco. */
  return { id: el.id, pos, texto: _EH_TEXTO(el) ? el.value : null };
}
function _devolverFoco(g) {
  if (!g) return;
  /* A casca desenha dois corpos (computador e celular) com os mesmos ids;
     devolver o foco para o invisivel e o mesmo que perde-lo. */
  const alvo = [...document.querySelectorAll(`[id="${CSS.escape(g.id)}"]`)]
    .find((c) => c.getBoundingClientRect().width > 0);
  if (!alvo) return;

  /* ── O TEXTO tambem precisa atravessar (05/09, h38) ────────────────────
     Devolver so o foco nao bastava. A tela e desenhada a partir do ESTADO
     (`value="${_busca}"`), e a busca tem 250ms de espera: enquanto o
     redesenho da letra anterior esta a caminho, a pessoa ja digitou mais.
     Quando ele chega, escreve o valor ANTIGO por cima do campo e apaga o que
     foi digitado no meio-tempo.

     Nao e teoria: digitando "ceram" numa cadencia normal, o campo terminava
     com "cmr". Letras somem e trocam de lugar, porque cada redesenho volta o
     campo alguns caracteres atras.

     Entao o que a pessoa digitou vence o que o estado sabia — para campos de
     texto. Um `select` fica de fora de proposito: ali o estado e a verdade, e
     e o proprio redesenho que corrige a opcao escolhida. */
  if (g.texto != null && _EH_TEXTO(alvo) && alvo.value !== g.texto) alvo.value = g.texto;
  if (alvo !== document.activeElement) alvo.focus();
  if (g.pos != null) { try { alvo.setSelectionRange(g.pos, g.pos); } catch (e) { /* idem */ } }
}

export async function redesenhar() {
  if (!_telaAberta) return false;
  /* ── A ORDEM AQUI E O CONSERTO (05/09, h39) ──────────────────────────────
     `render()` e assincrono: consulta o banco e pode levar centenas de
     milissegundos. Enquanto isso a tela ANTIGA continua na frente da pessoa,
     e ela continua digitando nela.

     No h38 eu guardava o texto ANTES do `await`. Quando o HTML novo chegava,
     eu devolvia um texto ja velho — e o campo voltava algumas letras atras a
     cada redesenho. Digitando "ceramica", ele travava em "c": cada ciclo
     restaurava a mesma foto antiga.

     Guardar DEPOIS do await e imediatamente antes de trocar o DOM: assim a
     foto e do ultimo instante em que a tela antiga existiu, e nada do que foi
     digitado se perde. Um `await` no meio nao e uma pausa — e uma janela em
     que o mundo muda. */
  const html = await _telaAberta.render(_paramsAtuais);
  const foco = _guardarFoco();
  _destino()(html);
  if (_telaAberta.depois) _telaAberta.depois(_paramsAtuais);
  _devolverFoco(foco);
  return true;
}

/* Abre uma tela de módulo. Devolve false quando a rota não é de módulo —
   assim o roteador do app segue para o comportamento atual dele. */
export async function abrir(id, params = {}) {
  const r = rota(id);
  if (!r) return false;
  const { modulo: mod, item } = r;
  _rotaAtual = id; _moduloAberto = mod.id;

  const { soComputador, carregando } = await import('./ui.js');
  const alvo = _destino();
  alvo(carregando(4));

  try {
    if (sessao.ehCelular() && item.mobile === false) {
      alvo(soComputador({
        titulo: item.rotulo,
        texto: item.textoDesktop || 'Esta tela foi feita para telas maiores. No computador ela abre direto.',
        alternativa: item.alternativa
      }));
      return true;
    }
    const tela = await item.rota();
    _telaAberta = tela;
    _paramsAtuais = params;
    alvo(await tela.render(params));
    if (tela.depois) tela.depois(params);
  } catch (e) {
    const { erro } = await import('./ui.js');
    alvo(erro(e?.message || 'Falha ao abrir a tela.', { rotulo: 'Tentar de novo', acao: 'recarregar' }));
  }
  return true;
}

/* Onde desenhar: dentro do app real usa setConteudo (DOM duplo);
   fora dele, um contêiner informado em iniciar(). */
let _container = null;
/* ── Despachante de acoes ──────────────────────────────────────────────────
   Os modulos so declaram `data-acao="nome:valor"`. Quem traduz isso em
   comportamento e este ponto, e mais ninguem — e o que impede cada tela de
   inventar o proprio jeito de tratar clique.

   Ordem de tentativa:
     1. `ir:rota[:id]`      → navegacao do app (callback informado pela casca)
     2. a tela aberta       → acao(nome, valor, redesenhar)
     3. o modulo da rota    → acoes(acao, contexto)  — e onde mora a escrita
   Nada respondeu: devolve false, e a casca avisa em vez de fingir que fez. */
let _aoNavegar = null;
export function aoNavegar(fn) { _aoNavegar = fn; }

export async function tratarAcao(acao) {
  if (!acao) return false;
  const [nome, ...resto] = acao.split(':');
  const valor = resto.join(':');

  if (nome === 'ir') {
    const [rota, id] = valor.split(':');
    if (_aoNavegar) { await _aoNavegar(rota, id ? { id } : {}); return true; }
    return abrir(rota, id ? { id } : {});
  }

  if (_telaAberta?.acao) {
    /* ── BUG CORRIGIDO EM 05/09 (h17) ────────────────────────────────────
       As acoes chegam em duas formas: "nome:valor" (ordenar:valor) e
       "modulo:nome:valor" (crm:conversa:c3). Antes, qualquer acao comecando
       com o id do modulo era entregue INTEIRA como nome — entao
       "crm:conversa:c3" batia contra `nome === 'crm:conversa'` e nunca
       casava. Resultado: trocar de conversa ou de caixa nao era tratado pela
       tela, caia no modulo e recebia o aviso "depende do WhatsApp" — a tela
       de Conversas inteira parecia congelada.
       Regra agora: o prefixo do modulo faz parte do NOME, nunca do valor. */
    const p = acao.split(':');
    const doModulo = _moduloAberto && p[0] === _moduloAberto && p.length > 1;
    const nomeTela  = doModulo ? p.slice(0, 2).join(':') : nome;
    const valorTela = doModulo ? p.slice(2).join(':')    : valor;
    const tratou = await _telaAberta.acao(nomeTela, valorTela, redesenhar);
    if (tratou) return true;
  }

  const mod = _moduloAberto ? _modulos.get(_moduloAberto) : null;
  if (mod?.acoes) {
    const tratou = await mod.acoes(acao, { redesenhar, rota: _rotaAtual, params: _paramsAtuais });
    if (tratou) return true;
  }
  return false;
}

export function definirContainer(el) { _container = el; }
function _destino() {
  if (typeof window !== 'undefined' && typeof window.setConteudo === 'function') return window.setConteudo;
  return (html) => { if (_container) _container.innerHTML = html; };
}
