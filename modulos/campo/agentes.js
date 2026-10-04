/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/campo/agentes.js — tela "Consultar agente" (v232, 04/10/2026)
   Busca na base do Laudomiro (laudomiro.js) e mostra a ficha: insalubridade,
   aposentadoria especial, código do eSocial e comparação com uma medição.
   Computador: busca à esquerda, ficha à direita. Celular: busca; tocar num
   agente abre a ficha com "Voltar à busca".
   ══════════════════════════════════════════════════════════════════════════ */

import * as L from './laudomiro.js';
import { I, esc, btn, ligarTela, avisar, ponte } from './comum.js';

let _q = '', _sel = null, _med = '', _un = '', _verFicha = false;
const COMUNS = ['tolueno-toluol', 'xileno-xilol', 'oleos-minerais-graxas-e-oleo-queimado', 'solventes-aromaticos-thinner-em-limpeza-e-pintura',
  'silica-livre-cristalizada-quartzo', 'fumos-de-solda', 'formaldeido-formol', 'amonia', 'cimento-e-cal', 'chumbo', 'acido-cloridrico', 'monoxido-de-carbono'];
const ATALHOS = [['tolueno', 'Tolueno'], ['graxa', 'Graxa'], ['thinner', 'Thinner'], ['sílica', 'Sílica'], ['solda', 'Solda'], ['formol', 'Formol'], ['cimento', 'Cimento'], ['amônia', 'Amônia']];

const mini = (a) => { const i = L.insal(a), p = L.apos(a);
  return `<span class="lm-mini ins-${i.cls}">${esc(a.nr15.grau ? `${a.nr15.grau} ${a.nr15.pct}%` : i.v)}</span><span class="lm-mini ae-${p.cls}">${esc(p.cls === 'sim' ? `aposent. ${a.prev.anos} anos` : p.cls === 'talvez' ? 'aposent. pode ter' : 'sem aposent.')}</span>`; };

function listaHtml() {
  const t = _q.trim();
  const itens = t ? L.buscar(t) : COMUNS.map(L.porId).filter(Boolean);
  const tn = L.norm(t);
  const linha = (a) => { const hit = t && !L.norm(a.nome).includes(tn) ? a.sinonimos.find(s => L.norm(s).includes(tn)) : '';
    return `<button type="button" class="lm-li${a.id === _sel ? ' on' : ''}" data-acao="campo:lm-ver:${esc(a.id)}">
      <span class="n">${esc(a.nome)}</span>${hit ? `<span class="h">também: ${esc(hit)}</span>` : ''}<span class="b">${mini(a)}</span></button>`; };
  const cab = t ? `<div class="lm-cont">${itens.length ? `${itens.length} encontrado${itens.length === 1 ? '' : 's'}` : ''}</div>`
    : `<div class="lm-cont">Comuns na visita · ou digite para buscar entre os ${L.AGENTES.length} da base</div>`;
  return cab + (itens.length ? `<div class="lm-lista">${itens.slice(0, 80).map(linha).join('')}</div>`
    : `<div class="lm-vazio">Nada encontrado para "${esc(t)}". Tente outro nome, o nome do produto na FISPQ ou o número CAS.</div>`);
}

function boasVindas() {
  return `<div class="lm-ficha lm-bv"><div class="lm-nome">Como ler a ficha</div>
    <div class="lm-sin">Escolha um agente na lista. A ficha responde três perguntas:</div>
    <div class="lm-resp">
      <div class="lm-t ins-med"><div class="lm-t-k">Insalubridade</div><div class="lm-t-v">Grau e %</div><div class="lm-t-s">pela NR-15: acima do limite ou pela atividade</div></div>
      <div class="lm-t ae-sim"><div class="lm-t-k">Aposentadoria especial</div><div class="lm-t-v">Sim, pode ter ou não</div><div class="lm-t-s">pelo Anexo IV do Decreto 3.048</div></div>
      <div class="lm-t es"><div class="lm-t-k">eSocial · S-2240</div><div class="lm-t-v mono">00.00.000</div><div class="lm-t-s">código da Tabela 24</div></div></div>
    <div class="lm-rod">Base montada pelo Laudomiro a partir dos textos oficiais (NR-15, Decreto 3.048, eSocial, LINACH e IN INSS 128). É indicação para o técnico; não substitui laudo nem LTCAT.</div></div>`;
}

export async function render(params = {}) {
  if (params.id && L.porId(params.id) && params.id !== _sel) { _sel = params.id; _verFicha = true; _med = ''; _un = ''; }
  ligarTela({ digitar: (chave, valor) => {
    if (chave !== 'lm.med') return;
    _med = valor;
    const a = L.porId(_sel); if (!a) return;
    const c = L.comparar(a, valor, _un || L.unidades(a)[0]);
    document.querySelectorAll('[data-lm-res]').forEach(el => { el.innerHTML = c ? L.barraHtml(c) : '<div class="lm-med-r">Digite o resultado para comparar com o limite.</div>'; });
  } });
  const a = L.porId(_sel);
  ponte().cabecalhoMobile?.(`<div class="mh-greeting">Avaliação de Campo</div><div class="mh-name">${a && _verFicha ? esc(L.curtoNome(a.nome)) : 'Consultar agente'}</div>`);
  return `<div class="cp-topo lm-topo${a && _verFicha ? ' na-ficha' : ''}"><div class="cp-topo-txt"><div class="cp-topo-emp">Avaliação de Campo</div><div class="cp-topo-tit">Consultar agente</div>
      <div class="cp-topo-sub">Insalubridade, aposentadoria especial e código do eSocial de cada agente, pelo Laudomiro.</div></div>${btn('Voltar para as avaliações', 'ir:campo', { cls: 'btn-ghost' })}</div>
    <div class="lm-wrap${a ? ' tem-sel' : ''}${_verFicha ? ' ver-ficha' : ''}">
      <div class="lm-col-busca">
        <div class="turmas-busca lm-busca"><span class="lm-busca-ic">${I.busca}</span>
          <input type="search" id="lmBusca" data-acao="campo:lm-busca" value="${esc(_q)}" placeholder="Nome, produto ou CAS" autocomplete="off"></div>
        ${_q.trim() ? '' : `<div class="lm-atalhos">${ATALHOS.map(([q, r]) => `<button type="button" data-acao="campo:lm-atalho:${esc(q)}">${esc(r)}</button>`).join('')}</div>`}
        ${listaHtml()}
      </div>
      <div class="lm-col-ficha">
        ${a ? `<button type="button" class="lm-volta" data-acao="campo:lm-voltar">${I.chevL}<span>Voltar à busca</span></button>
          ${L.fichaHtml(a, { medicao: _med, unidade: _un, acoes: btn(`<span style="width:15px;height:15px;display:inline-flex">${I.copiar}</span> Copiar resumo`, 'campo:lm-copiar', { cls: 'btn-outline btn-sm lm-copiar' }) })}` : boasVindas()}
      </div>
    </div>`;
}

export async function acao(nome, valor, redesenhar) {
  if (nome === 'campo:lm-busca') { _q = valor || ''; redesenhar(); return true; }
  if (nome === 'campo:lm-atalho') { _q = valor; redesenhar(); return true; }
  if (nome === 'campo:lm-ver') { if (valor !== _sel) { _med = ''; _un = ''; } _sel = valor; _verFicha = true; redesenhar(); window.scrollTo?.(0, 0); return true; }
  if (nome === 'campo:lm-voltar') { _verFicha = false; redesenhar(); return true; }
  if (nome === 'campo:lm-un') { _un = valor; redesenhar(); return true; }
  if (nome === 'campo:lm-copiar') {
    const a = L.porId(_sel); if (!a) return true;
    try { await navigator.clipboard.writeText(L.resumoTexto(a)); avisar('Resumo copiado. Cole no laudo, no SOC ou na conversa.'); }
    catch { avisar('Não foi possível copiar neste aparelho.', 'erro'); }
    return true;
  }
  return false;
}
