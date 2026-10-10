/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/campo/agentes.js — tela "Consultar agente" (v232; v239: nova cara)
   v239 (Opção A v2, aprovada pelo Alisson em 09/10/2026, depois da revisão de
   três especialistas): busca + filtro por grupo; lista separada por grupo com
   etiqueta escrita; ficha com a medição e a conclusão primeiro, enquadramento,
   seções que abrem ao tocar e "Copiar texto para…" (laudo, LTCAT/PPP, PGR).
   Computador: lista à esquerda, ficha à direita. Celular: lista; tocar abre a
   ficha com "Voltar à busca" e o botão de copiar fixo embaixo.
   ══════════════════════════════════════════════════════════════════════════ */

import * as L from './laudomiro.js';
import { I, esc, ligarTela, avisar, ponte } from './comum.js';

let _q = '', _grp = 'todos', _sel = null, _verFicha = false, _ctx = {};
/* v241: campos da medição → chave do contexto do Laudomiro. */
const CAMPOS = { 'lm.med': 'valor', 'lm.med2': 'valor2', 'lm.fx1': 'fx1', 'lm.fx2': 'fx2', 'lm.d5': 'd5', 'lm.d3': 'd3', 'lm.tm': 'tm', 'lm.tj': 'tj' };
const GRUPOS = [['todos', 'Todos'], ['quimico', 'Químicos'], ['fisico', 'Físicos'], ['biologico', 'Biológicos'], ['periculosidade', 'Periculosidade']];
const NOME_GRUPO = { quimico: 'Químicos', fisico: 'Físicos', biologico: 'Biológicos', periculosidade: 'Periculosidade' };
/* Quando não há busca nem filtro: os mais vistos na visita, por grupo. */
const COMUNS = {
  fisico: ['ruido-continuo', 'calor', 'vibracao-maos-bracos', 'vibracao-corpo-inteiro'],
  quimico: ['tolueno-toluol', 'oleos-minerais-graxas-e-oleo-queimado', 'solventes-aromaticos-thinner-em-limpeza-e-pintura', 'silica-livre-cristalizada-quartzo', 'fumos-de-solda'],
  biologico: ['bio-esgoto', 'bio-lixo-urbano', 'bio-saude-humana'],
  periculosidade: ['peri-inflamaveis', 'peri-energia-eletrica', 'peri-motocicleta']
};
const contar = (g) => L.AGENTES.filter(a => L.grupoDe(a) === g).length;
const IC_COP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';

function itemHtml(a) {
  const e = L.etiqueta(a), ref = L.referencia(a);
  return `<button type="button" class="lmx-li${a.id === _sel ? ' on' : ''}" data-acao="campo:lm-ver:${esc(a.id)}"${a.id === _sel ? ' aria-current="true"' : ''}>
    <span class="n">${esc(a.nome)}</span><span class="r"><span class="lmx-bdg b-${e.cls}">${esc(e.t)}</span>${esc(ref)}</span></button>`;
}
function listaHtml() {
  const t = _q.trim();
  if (t) {
    const itens = L.buscar(t).filter(a => _grp === 'todos' || L.grupoDe(a) === _grp);
    return itens.length ? `<div class="lmx-lista"><div class="lmx-lh"><span>${itens.length} encontrado${itens.length === 1 ? '' : 's'}</span></div>${itens.slice(0, 80).map(itemHtml).join('')}</div>`
      : `<div class="lmx-vazio">Nada encontrado para "${esc(t)}". Tente outro nome, o nome do produto na FISPQ, a atividade ou o número CAS.</div>`;
  }
  if (_grp !== 'todos') {
    const itens = L.AGENTES.filter(a => L.grupoDe(a) === _grp).sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
    return `<div class="lmx-lista"><div class="lmx-lh"><span>${NOME_GRUPO[_grp]}</span><span>${itens.length}</span></div>${itens.map(itemHtml).join('')}</div>`;
  }
  return `<div class="lmx-lista">${['fisico', 'quimico', 'biologico', 'periculosidade'].map(g => {
    const itens = COMUNS[g].map(L.porId).filter(Boolean), n = contar(g);
    return `<div class="lmx-lh"><span>${NOME_GRUPO[g]}</span><span>${n}</span></div>${itens.map(itemHtml).join('')}
      ${n > itens.length ? `<button type="button" class="lmx-mais" data-acao="campo:lm-grp:${g}">Ver ${g === 'periculosidade' ? 'as' : 'os'} ${n} ${g === 'periculosidade' ? 'situações' : NOME_GRUPO[g].toLowerCase()}</button>` : ''}`;
  }).join('')}</div>`;
}
function boasVindas() {
  return `<article class="lmx-ficha lmx-bv"><header class="lmx-cab"><div class="lmx-cab-t"><h2 class="lmx-nome">Escolha um agente</h2>
    <div class="lmx-sin">Químico, físico, biológico ou uma atividade perigosa. A ficha responde se gera insalubridade ou periculosidade, se conta para a aposentadoria especial e qual o código do eSocial. Com a medição em mãos, ela compara com o nível de ação e o limite.</div></div></header>
    <footer class="lmx-rod">Base montada pelo Laudomiro a partir dos textos oficiais (NR-15, NR-09, NR-16, Decreto 3.048, eSocial, LINACH e IN INSS 128). É indicação para o técnico; não substitui laudo nem LTCAT.</footer></article>`;
}
const btnCopiar = (cls = '') => `<button type="button" class="btn lmx-btn-am ${cls}" data-acao="campo:lm-copiar">${IC_COP}<span>Copiar texto para…</span></button>`;

function pintarResultado() {
  const a = L.porId(_sel); if (!a) return;
  document.querySelectorAll('[data-lm-res]').forEach(el => { el.innerHTML = L.resultadoHtml(a, _ctx); });
  L.atualizarEntrada(a, _ctx);   // v241: dose ao lado do campo (Lavg/NEN ou Faixa e dose)
}

export async function render(params = {}) {
  if (params.id && L.porId(params.id) && params.id !== _sel) { _sel = params.id; _verFicha = true; _ctx = {}; }
  ligarTela({ digitar: (chave, valor) => {
    const k = CAMPOS[chave], m = /^lm\.(pn|pt)\.(\d+)$/.exec(chave || '');
    if (k) { _ctx[k] = valor; pintarResultado(); }
    else if (m) {   // decibelímetro: linhas nível + horas
      _ctx.pts = _ctx.pts?.length ? _ctx.pts : [{}];
      const i = +m[2]; while (_ctx.pts.length <= i) _ctx.pts.push({});
      _ctx.pts[i][m[1] === 'pn' ? 'n' : 'h'] = valor; pintarResultado();
    }
  } });
  const a = L.porId(_sel);
  ponte().cabecalhoMobile?.(`<div class="mh-greeting">Avaliação de Campo</div><div class="mh-name">${a && _verFicha ? esc(L.curtoNome(a.nome)) : 'Consultar agente'}</div>`);
  return `<div class="lmx-topo${a && _verFicha ? ' na-ficha' : ''}">
      <div class="lmx-crumb">Avaliação de campo <span aria-hidden="true">/</span> <button type="button" class="lmx-lnk" data-acao="ir:campo">voltar para as avaliações</button></div>
      <h1 class="lmx-tit">Consultar agente</h1>
      <div class="lmx-filtros">
        <div class="lmx-busca"><span class="lmx-busca-ic">${I.busca}</span><input type="search" id="lmBusca" data-acao="campo:lm-busca" value="${esc(_q)}" placeholder="Agente, produto, atividade ou CAS" autocomplete="off" aria-label="Buscar agente"></div>
        <div class="lmx-seg" role="tablist">${GRUPOS.map(([k, t]) => `<button type="button" role="tab" aria-selected="${_grp === k}" class="${_grp === k ? 'on' : ''}" data-acao="campo:lm-grp:${k}">${t}<i>${k === 'todos' ? L.AGENTES.length : contar(k)}</i></button>`).join('')}</div>
      </div></div>
    <div class="lmx-wrap${a ? ' tem-sel' : ''}${_verFicha ? ' ver-ficha' : ''}">
      <div class="lmx-col-lista">${listaHtml()}</div>
      <div class="lmx-col-ficha">
        ${a ? `<button type="button" class="lmx-volta" data-acao="campo:lm-voltar">${I.chevL}<span>Voltar à busca</span></button>
          ${L.fichaHtml(a, { ctx: _ctx, acoes: btnCopiar() })}
          <div class="lmx-barra">${btnCopiar('lmx-btn-big')}</div>` : boasVindas()}
      </div>
    </div>`;
}

function abrirCopiar() {
  const a = L.porId(_sel); if (!a) return;
  const t = L.textos(a, _ctx);
  window.__lmCopiar = async (tipo) => {
    try { await navigator.clipboard.writeText(t[tipo] + '\nIndicação do GRID (Laudomiro); não substitui laudo nem LTCAT.'); avisar('Texto copiado. Cole no documento.'); }
    catch { avisar('Não foi possível copiar neste aparelho.', 'erro'); }
  };
  const op = [['laudo', 'Laudo de insalubridade ou periculosidade', 'Agente, critério, resultado e conclusão pela NR-15 ou NR-16.'],
    ['ltcat', 'LTCAT e PPP', 'Enquadramento no Anexo IV, conclusão para aposentadoria e código do eSocial.'],
    ['pgr', 'PGR', 'Perigo, avaliação e medidas de controle.']];
  ponte().abrirModal?.('Copiar texto para…', `<div class="lmx-cp">${op.map(([k, tt, d]) => `<button type="button" class="lmx-cp-op" onclick="window.__lmCopiar&&window.__lmCopiar('${k}');fecharModal()"><b>${tt}</b><span>${d}</span></button>`).join('')}</div>`,
    '<button class="btn btn-outline" onclick="fecharModal()">Cancelar</button>');
}

export async function acao(nome, valor, redesenhar) {
  if (nome === 'campo:lm-busca') { _q = valor || ''; redesenhar(); return true; }
  if (nome === 'campo:lm-grp') { _grp = valor || 'todos'; _verFicha = false; redesenhar(); return true; }
  if (nome === 'campo:lm-ver') { if (valor !== _sel) _ctx = {}; _sel = valor; _verFicha = true; redesenhar(); window.scrollTo?.(0, 0); return true; }
  if (nome === 'campo:lm-voltar') { _verFicha = false; redesenhar(); return true; }
  if (nome === 'campo:lm-un') { _ctx.unidade = valor; redesenhar(); return true; }
  if (nome === 'campo:lm-ap') { _ctx.ap = valor === 'dec' ? 'dec' : 'dos'; redesenhar(); return true; }
  if (nome === 'campo:lm-rel') { _ctx.rel = valor === 'db' ? 'db' : 'dose'; redesenhar(); return true; }
  if (nome === 'campo:lm-pt-add') { _ctx.pts = _ctx.pts?.length ? _ctx.pts : [{}]; _ctx.pts.push({}); redesenhar(); return true; }
  if (nome === 'campo:lm-pt-del') { const i = +valor; if (_ctx.pts?.length > 1) _ctx.pts.splice(i, 1); redesenhar(); return true; }
  if (nome === 'campo:lm-parcial') { _ctx.parcial = !_ctx.parcial; redesenhar(); return true; }
  if (nome === 'campo:lm-copiar') { abrirCopiar(); return true; }
  return false;
}
