/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/campo/laudomiro-tela.js — tela "Laudomiro" (v248, 10/10/2026)
   Junta num lugar só as duas formas de usar o Laudomiro:
     · Perguntar: pergunta livre; a resposta vem com veredito, os itens da
       norma clicáveis (o texto oficial abre ao lado) e o principal cuidado.
       Quem responde é a função do servidor `laudomiro-perguntar` (PASSO-79).
     · Fichas dos agentes: a antiga "Consultar agente" (agentes.js), igual.
   Layout "C leve" aprovado pelo Alisson em 10/10 (08-Propostas-visuais/
   laudomiro-v3-*), com as peças do GRID: cabeçalho e menu reais.
   O texto do painel ao lado é o trecho ORIGINAL da base, nunca texto do modelo.
   ══════════════════════════════════════════════════════════════════════════ */

import * as Fichas from './agentes.js';
import * as L from './laudomiro.js';
import { I, esc, ligarTela, avisar, ponte, valorVisivel } from './comum.js';
import { cliente as clienteBanco } from '../../nucleo/dados.js';
import * as sessao from '../../nucleo/sessao.js';

const FUNCAO = 'laudomiro-perguntar';
let _aba = 'perguntar';
let _status = null, _statusCarregando = false;
let _conv = [];            // [{ pergunta, id, resposta, trechos, resumo, carregando, erro, nota }]
let _txt = '';
let _painel = null;        // { t: índice do turno, n: número do trecho }

const SEAL = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2.8 4.5 5.6v5.6c0 4.6 3.1 8.7 7.5 10 4.4-1.3 7.5-5.4 7.5-10V5.6L12 2.8Z" stroke="#F59E0B" stroke-width="1.8" stroke-linejoin="round"/><path d="M9.6 8v7.2h5" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const SEND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>';
const IC = {
  copiar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
  util: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M7 11v9H4v-9h3Zm0 0 4-7a2 2 0 0 1 2 2v3h5a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 16.8 20H7"/></svg>',
  erro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 9v4m0 4h.01M10.3 3.9 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>',
  fichas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14Z"/><path d="M8 7h8M8 11h6"/></svg>',
  perg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/></svg>',
};
const SUGESTOES = [
  ['Na visita', 'Frentista de posto de combustível tem periculosidade?'],
  ['No laudo e no LTCAT', 'Tolueno conta para aposentadoria especial?'],
  ['Nos treinamentos', 'O treinamento de NR-35 pode ser a distância?'],
];
const VEREDITO = {
  SIM: ['SIM', 'v-sim'], NAO: ['NÃO', 'v-nao'], DEPENDE: ['DEPENDE', 'v-dep'],
  INFO: ['RESPOSTA', 'v-info'], NAO_SEI: ['NÃO ACHEI', 'v-ns'],
};

const sb = () => { const c = clienteBanco(); if (!c) throw new Error('Banco indisponível. Recarregue o sistema.'); return c; };

async function chamar(body) {
  const { data, error } = await sb().functions.invoke(FUNCAO, { body });
  if (error) {
    let msg = error.message, codigo = '', status = error.context?.status || 0;
    try { const c = await error.context?.json?.(); if (c?.error) msg = c.error; if (c?.codigo) codigo = c.codigo; } catch { /* ok */ }
    const e = new Error(msg || 'O Laudomiro não respondeu.'); e.codigo = codigo; e.status = status; throw e;
  }
  if (data?.error) { const e = new Error(data.error); e.codigo = data.codigo || ''; throw e; }
  return data;
}

/* Pede para a própria tela se redesenhar quando uma chamada termina —
   só se a pessoa ainda estiver nela. */
function repintar() {
  const h = (location.hash || '').replace('#', '').split('?')[0];
  if (h && !/^(laudomiro|campo-agentes)/.test(h)) return;
  window.GRID?.tratarAcao?.('campo:lq-pintar');
}

async function carregarStatus() {
  if (_statusCarregando) return;
  _statusCarregando = true;
  try { _status = await chamar({ acao: 'status' }); }
  catch (e) {
    /* Função ainda não publicada (404) ou sem módulo: a tela fica no modo "em configuração". */
    _status = { configurado: false, falha: e.message, restantes: null, recentes: [] };
  }
  finally { _statusCarregando = false; repintar(); }
}

function saudacao() {
  const h = new Date().getHours();
  const nome = (sessao.usuario()?.nome || '').trim().split(/\s+/)[0];
  return `${h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'}${nome ? ', ' + esc(nome) : ''}.`;
}

/* ── Pedaços da tela ───────────────────────────────────────────────────── */
function abas() {
  const n = L.AGENTES.length;
  const cota = _aba === 'perguntar' && _status?.configurado && _status.restantes != null
    ? `<span class="lq-cota-t"><b>${_status.restantes}</b> ${_status.restantes === 1 ? 'pergunta restante' : 'perguntas restantes'} em ${esc(_status.mes || 'este mês')}</span>` : '';
  const nova = _aba === 'perguntar' && _conv.length ? '<button type="button" class="btn btn-outline btn-sm" data-acao="campo:lq-nova">Nova conversa</button>' : '';
  return `<div class="lq-topo">
    <div class="lq-id"><span class="lq-seal">${SEAL}</span><div><b>Laudomiro</b><small>Engenheiro de segurança do GRID</small></div></div>
    <div class="lq-abas" role="tablist" aria-label="Laudomiro">
      <button type="button" role="tab" aria-selected="${_aba === 'perguntar'}" class="${_aba === 'perguntar' ? 'on' : ''}" data-acao="campo:lq-aba:perguntar">${IC.perg}<span>Perguntar</span></button>
      <button type="button" role="tab" aria-selected="${_aba === 'fichas'}" class="${_aba === 'fichas' ? 'on' : ''}" data-acao="campo:lq-aba:fichas">${IC.fichas}<span>Fichas<span class="lq-ab-x"> dos agentes</span></span><i>${n}</i></button>
    </div>
    <div class="lq-cota">${cota}${nova}</div>
  </div>`;
}

function compositor({ grande = false } = {}) {
  const off = _status && !_status.configurado;
  const ocupado = _conv.some(t => t.carregando);
  return `<div class="lq-comp${grande ? ' grande' : ''}${off ? ' off' : ''}">
      <input type="text" id="lqTxt" data-cp="lq.txt" data-cp-enter="lq.enviar" value="${esc(_txt)}" maxlength="1000" autocomplete="off"
        placeholder="${off ? 'O Laudomiro está sendo configurado' : 'Pergunte ao Laudomiro'}" aria-label="Sua pergunta" ${off ? 'disabled' : ''}>
      <button type="button" class="lq-env" data-acao="campo:lq-enviar" aria-label="Enviar pergunta" ${off || ocupado ? 'disabled' : ''}>${SEND}</button>
    </div>
    <div class="lq-priv">Não escreva nome, CPF nem dados de trabalhadores.</div>`;
}

function inicio() {
  const off = _status && !_status.configurado;
  const rec = (_status?.recentes || []).slice(0, 5);
  return `<section class="lq-ini">
    <h2 class="lq-h">${saudacao()} O que você precisa resolver?</h2>
    <p class="lq-sub">Pergunte como perguntaria a um engenheiro de segurança. Ele responde com o item da norma.</p>
    ${off ? `<div class="lq-conf">${I.info}<div><b>O Laudomiro está sendo configurado.</b> Logo você poderá perguntar aqui. Enquanto isso, as <button type="button" class="lq-lnk" data-acao="campo:lq-aba:fichas">Fichas dos agentes</button> continuam funcionando.</div></div>` : ''}
    ${compositor({ grande: true })}
    <div class="lq-sug">${SUGESTOES.map(([r, p], i) => `<button type="button" class="lq-cd" data-acao="campo:lq-sug:${i}" ${off ? 'disabled' : ''}><small>${r}</small><b>${esc(p)}</b></button>`).join('')}</div>
    ${rec.length ? `<div class="lq-rec"><h4>Conversas recentes</h4>${rec.map(r => `<button type="button" data-acao="campo:lq-abrir:${esc(r.id)}"><span>${esc(r.pergunta)}</span><small>${esc(quando(r.criado_em))}</small></button>`).join('')}</div>` : ''}
  </section>`;
}

function quando(iso) {
  if (!iso) return '';
  const d = new Date(iso), hoje = new Date();
  if (d.toDateString() === hoje.toDateString()) return 'hoje';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

/* {{n}} → botão com o rótulo do trecho; **negrito** simples. */
function textoComRefs(texto, turno, tIdx) {
  const mapa = new Map((turno.trechos || []).map(t => [t.n, t]));
  return esc(texto).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\{\{(\d+)\}\}/g, (m, n) => {
    const t = mapa.get(+n); if (!t) return '';
    const on = _painel && _painel.t === tIdx && _painel.n === +n;
    return `<button type="button" class="lq-it${on ? ' on' : ''}" data-acao="campo:lq-fonte:${tIdx}.${+n}" title="Ver o texto: ${esc(t.fonte)}">${esc(t.rotulo)}</button>`;
  });
}

function tipoFonte(t) { return t.tipo === 'oficial' ? 'Texto oficial' : 'Ficha do Laudomiro'; }

function resposta(turno, tIdx) {
  if (turno.carregando) return `<article class="lq-resp lq-carr" aria-live="polite"><span class="lq-seal p">${SEAL}</span><div><b>Consultando as normas…</b><small>Buscando os itens que respondem a sua pergunta.</small></div></article>`;
  if (turno.erro) return `<article class="lq-resp lq-falha">${IC.erro}<div><b>${esc(turno.erro)}</b>${turno.podeRepetir ? `<button type="button" class="btn btn-outline btn-sm" data-acao="campo:lq-repetir:${tIdx}">Tentar de novo</button>` : ''}</div></article>`;
  const r = turno.resposta; if (!r) return '';
  const [vt, vc] = VEREDITO[r.veredito] || VEREDITO.INFO;
  const fontes = (turno.trechos || []).filter(t => (r.fontes || []).includes(t.n));
  return `<article class="lq-resp">
    <header class="lq-ver"><span class="lq-selo ${vc}">${vt}</span><div><h3>${esc(r.titulo)}</h3>${r.subtitulo ? `<p>${esc(r.subtitulo)}</p>` : ''}</div></header>
    <div class="lq-txt">${(r.resposta || []).map(p => `<p>${textoComRefs(p, turno, tIdx)}</p>`).join('')}</div>
    ${r.cuidado ? `<div class="lq-cuid">${IC.erro}<div><b>Cuidado:</b> ${textoComRefs(r.cuidado, turno, tIdx)}</div></div>` : ''}
    ${fontes.length ? `<div class="lq-fontes">${fontes.slice(0, 4).map(t => `<button type="button" class="lq-fo" data-acao="campo:lq-fonte:${tIdx}.${t.n}"><small>${tipoFonte(t)}</small><b>${esc(t.rotulo)}</b></button>`).join('')}</div>` : ''}
    <footer class="lq-acts">
      <button type="button" data-acao="campo:lq-copiar:${tIdx}">${IC.copiar}<span>Copiar</span></button>
      ${turno.id ? `<button type="button" class="${turno.nota === 'util' ? 'on' : ''}" data-acao="campo:lq-util:${tIdx}" aria-pressed="${turno.nota === 'util'}">${IC.util}<span>Útil</span></button>
      <button type="button" class="${turno.nota === 'erro' ? 'on' : ''}" data-acao="campo:lq-erro:${tIdx}">${IC.erro}<span>Tem erro</span></button>` : ''}
      <small>Indicação para o técnico. Não substitui laudo.</small>
    </footer>
  </article>`;
}

function conversa() {
  return `<div class="lq-fio">${_conv.map((t, i) => `<div class="lq-eu"><span>${esc(t.pergunta)}</span></div>${resposta(t, i)}`).join('')}</div>
    <div class="lq-comp-fixo">${compositor()}</div>`;
}

function limparMd(x) {
  return String(x || '').replace(/<!--[\s\S]*?-->/g, '').replace(/^.*não substitui o publicado no DOU.*$/gim, '')
    .split('\n').map(l => l.replace(/[ \t]{2,}/g, ' ').trim()).join('\n')
    .replace(/^#{1,6}\s*/gm, '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/^\s*[-*]\s+/gm, '• ').replace(/\|/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function painel() {
  if (!_painel) return '';
  const t = (_conv[_painel.t]?.trechos || []).find(x => x.n === _painel.n);
  if (!t) return '';
  return `<aside class="lq-painel" aria-label="Texto da norma">
    <div class="lq-p-h"><div><small>${esc(t.fonte.replace(/^Texto oficial:\s*/, 'Texto oficial · ').replace(/^Ficha do Laudomiro:\s*/, 'Ficha do Laudomiro · ').replace(/^Base de agentes do Laudomiro:\s*/, 'Ficha do agente · '))}</small><h4>${esc(t.rotulo)}</h4>${t.secao ? `<p>${esc(t.secao)}</p>` : ''}</div>
      <button type="button" class="lq-x" data-acao="campo:lq-fechar" aria-label="Fechar">${I.x}</button></div>
    <blockquote>${esc(limparMd(t.tipo === 'agente' ? fichaAgente(t.texto) : t.texto))}</blockquote>
    <div class="lq-p-m">Texto copiado da base do Laudomiro${t.tipo === 'oficial' ? ' (texto oficial)' : ''}. Toque em outro item da resposta para trocar.</div>
  </aside>`;
}

/* O trecho de agente é o JSON da base: mostra como texto corrido. */
function fichaAgente(json) {
  try {
    const a = JSON.parse(json);
    const lin = [];
    const add = (r, v) => { if (v != null && v !== '' && !(Array.isArray(v) && !v.length)) lin.push(`${r}: ${Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? Object.entries(v).map(([k, x]) => `${k} ${x}`).join('; ') : v}`); };
    add('Agente', a.nome); add('Também chamado', a.sinonimos?.slice?.(0, 6));
    for (const [k, v] of Object.entries(a)) if (!['nome', 'sinonimos', 'id'].includes(k)) add(k.replace(/_/g, ' '), v);
    return lin.join('\n');
  } catch { return json; }
}

export async function render(params = {}) {
  if (params.id && L.porId?.(params.id)) _aba = 'fichas';
  ponte().cabecalhoMobile?.(`<div class="mh-greeting">Avaliação de Campo</div><div class="mh-name">Laudomiro</div>`);
  if (_aba === 'fichas') {
    const html = await Fichas.render({ ...params, embutido: true });
    return `<div class="lq lq-na-ficha">${abas()}${html}</div>`;
  }
  ligarTela({
    digitar: (chave, valor) => { if (chave === 'lq.txt') _txt = valor; },
    enter: (chave, valor) => { if (chave === 'lq.enviar') { _txt = valor; enviar(); } },
  });
  if (!_status) carregarStatus();
  return `<div class="lq${_painel ? ' com-painel' : ''}${_conv.length ? ' em-conversa' : ''}">${abas()}
    <div class="lq-corpo"><div class="lq-col">${_conv.length ? conversa() : inicio()}</div>${painel()}</div></div>`;
}

async function enviar(texto) {
  const p = String(texto ?? (valorVisivel('#lqTxt') || _txt)).trim();
  if (p.length < 4) { avisar('Escreva a pergunta.', 'erro'); return; }
  if (_conv.some(t => t.carregando)) return;
  if (_status && !_status.configurado) { avisar('O Laudomiro ainda está sendo configurado.', 'erro'); return; }
  const historico = _conv.filter(t => t.resposta).slice(-2).map(t => ({ pergunta: t.pergunta, resposta: t.resumo || '' }));
  const turno = { pergunta: p, carregando: true };
  _conv.push(turno); _txt = ''; _painel = null;
  repintar();
  rolarFim();
  try {
    const r = await chamar({ acao: 'perguntar', pergunta: p, historico });
    Object.assign(turno, { carregando: false, id: r.id, resposta: r.resposta, trechos: r.trechos || [], resumo: r.resumo || '' });
    if (_status && r.restantes != null) _status.restantes = r.restantes;
    if (_status && r.id) _status.recentes = [{ id: r.id, pergunta: p, criado_em: new Date().toISOString() }, ...(_status.recentes || [])].slice(0, 6);
  } catch (e) {
    Object.assign(turno, { carregando: false, erro: e.message || 'O Laudomiro não respondeu.', podeRepetir: !['NAO_CONFIGURADO', 'COTA'].includes(e.codigo) });
    if (e.codigo === 'NAO_CONFIGURADO' && _status) _status.configurado = false;
  }
  repintar();
  rolarFim();
}

function rolarFim() {
  setTimeout(() => {
    const el = [...document.querySelectorAll('.lq-fio')].find(c => c.getBoundingClientRect().width > 0);
    const ult = el?.lastElementChild; if (ult) ult.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, 60);
}

function copiar(i) {
  const t = _conv[i]; const r = t?.resposta; if (!r) return;
  const mapa = new Map((t.trechos || []).map(x => [x.n, x.rotulo]));
  const tira = (s) => String(s || '').replace(/\{\{(\d+)\}\}/g, (m, n) => (mapa.get(+n) ? `(${mapa.get(+n)})` : '')).replace(/\s{2,}/g, ' ').trim();
  const txt = [`${(VEREDITO[r.veredito] || VEREDITO.INFO)[0]}: ${r.titulo}`, r.subtitulo, '', ...r.resposta.map(tira), r.cuidado ? '\nCuidado: ' + tira(r.cuidado) : '',
    '', 'Fontes: ' + (t.trechos || []).filter(x => r.fontes?.includes(x.n)).map(x => x.rotulo).join('; '),
    'Indicação do GRID (Laudomiro); não substitui laudo nem LTCAT.'].filter(x => x !== undefined).join('\n');
  navigator.clipboard?.writeText(txt).then(() => avisar('Resposta copiada.'), () => avisar('Não foi possível copiar neste aparelho.', 'erro'));
}

async function avaliar(i, nota, comentario = '') {
  const t = _conv[i]; if (!t?.id) return;
  t.nota = nota; repintar();
  try { await chamar({ acao: 'avaliar', id: t.id, nota, comentario }); avisar(nota === 'util' ? 'Obrigado! Isso ajuda o Laudomiro a melhorar.' : 'Obrigado. O erro foi registrado para correção da base.'); }
  catch (e) { t.nota = null; repintar(); avisar(e.message, 'erro'); }
}

function pedirErro(i) {
  window.__lqErro = () => {
    const c = (document.getElementById('lqErroTxt')?.value || '').trim();
    window.fecharModal?.(); avaliar(i, 'erro', c);
  };
  ponte().abrirModal?.('O que está errado?',
    `<p style="margin:0 0 10px;font-size:13px;color:var(--text-2)">Conte em poucas palavras o que não confere (item, valor, norma). Não escreva nomes nem CPF.</p>
     <textarea id="lqErroTxt" rows="4" maxlength="1000" style="width:100%;font:inherit;font-size:14px;padding:10px;border:1px solid var(--border);border-radius:8px" placeholder="Ex.: o item citado foi revogado em 2025"></textarea>`,
    '<button class="btn btn-outline" onclick="fecharModal()">Cancelar</button><button class="btn btn-amber" onclick="window.__lqErro&&window.__lqErro()">Enviar</button>');
}

async function abrirRecente(id) {
  try {
    const r = await chamar({ acao: 'ver', id });
    _conv = [{ pergunta: r.pergunta, id: r.id, resposta: r.resposta, trechos: r.trechos || [], nota: r.avaliacao || null,
      resumo: [r.resposta?.titulo, ...(r.resposta?.resposta || [])].join(' ').replace(/\{\{\d+\}\}/g, '') }];
    _painel = null; repintar();
  } catch (e) { avisar(e.message, 'erro'); }
}

export async function acao(nome, valor, redesenhar) {
  if (nome === 'campo:lq-pintar') { await redesenhar(); return true; }
  if (nome === 'campo:lq-aba') { _aba = valor === 'fichas' ? 'fichas' : 'perguntar'; _painel = null; redesenhar(); window.scrollTo?.(0, 0); return true; }
  if (_aba === 'fichas') return Fichas.acao(nome, valor, redesenhar);
  if (nome === 'campo:lq-enviar') { enviar(); return true; }
  if (nome === 'campo:lq-sug') { const s = SUGESTOES[+valor]; if (s) enviar(s[1]); return true; }
  if (nome === 'campo:lq-nova') { _conv = []; _painel = null; _txt = ''; redesenhar(); return true; }
  if (nome === 'campo:lq-fonte') { const [t, n] = String(valor).split('.').map(Number); _painel = (_painel && _painel.t === t && _painel.n === n) ? null : { t, n }; redesenhar(); return true; }
  if (nome === 'campo:lq-fechar') { _painel = null; redesenhar(); return true; }
  if (nome === 'campo:lq-copiar') { copiar(+valor); return true; }
  if (nome === 'campo:lq-util') { avaliar(+valor, 'util'); return true; }
  if (nome === 'campo:lq-erro') { pedirErro(+valor); return true; }
  if (nome === 'campo:lq-abrir') { abrirRecente(valor); return true; }
  if (nome === 'campo:lq-repetir') { const t = _conv[+valor]; if (t) { _conv.splice(+valor, 1); enviar(t.pergunta); } return true; }
  return false;
}

/* A rota antiga "Consultar agente" (campo-agentes) abre esta mesma tela na aba Fichas. */
export const comoFichas = {
  render: (params = {}) => { if (!params.__lq) { params.__lq = 1; _aba = 'fichas'; } return render(params); },
  acao,
};
