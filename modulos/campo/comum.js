/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/campo/comum.js — peças compartilhadas pelas telas
   • pedaços de HTML (escolha única, múltipla escolha, cabeçalho, fotos);
   • o ouvinte de digitação do módulo: a casca só entrega cliques e selects,
     e redesenhar a tela a cada letra derrubaria o teclado do celular. Aqui a
     digitação vai direto para o dado (dados.alterar...) sem redesenhar;
   • a assinatura na tela (modal com área de desenho).
   ══════════════════════════════════════════════════════════════════════════ */

import { esc } from '../../nucleo/ui.js';
import * as D from './dados.js';
import { I } from './icones.js';
export { I, esc };

export const ponte = () => (typeof window !== 'undefined' && window.__GRID_PONTE) || {};
export const avisar = (msg, tipo = 'ok') => { const p = ponte(); if (p.avisar) p.avisar(msg, tipo === 'erro' ? 'error' : 'ok'); else console.log(msg); };
export const confirmar = async (msg) => { const p = ponte(); return p.confirmar ? p.confirmar(msg) : true; };

/* ── Datas ──────────────────────────────────────────────────────────────── */
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export function dataBr(aaaammdd) {
  if (!aaaammdd) return '';
  const [a, m, d] = String(aaaammdd).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}
export function dataCurta(aaaammdd, hora) {
  if (!aaaammdd) return '';
  const [a, m, d] = String(aaaammdd).slice(0, 10).split('-').map(Number);
  const dt = new Date(a, m - 1, d);
  return `${DIAS[dt.getDay()]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}${hora ? ' · ' + String(hora).slice(0, 5) : ''}`;
}
export function quando(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
export const horaMin = (iso) => iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';

/* Navegar a partir de código (depois de um modal, por exemplo). */
export const irPara = (rotaId) => window.GRID?.tratarAcao?.('ir:' + rotaId);

/* ── Pedaços de tela ────────────────────────────────────────────────────── */
export const ico = (nome, px = 14) => `<span style="width:${px}px;height:${px}px;display:inline-flex;flex-shrink:0">${I[nome] || ''}</span>`;

/* Escolha única. Tocar de novo na opção marcada desmarca (campo opcional). */
export function seg(acao, opcoes, atual, { amb = true, travado = false } = {}) {
  return `<div class="cp-seg${amb ? ' amb' : ''}">${opcoes.map(([v, l]) =>
    `<button type="button" class="${String(v) === String(atual ?? '') ? 'on' : ''}" ${travado ? 'disabled' : `data-acao="campo:${acao}:${esc(v)}"`}>${esc(l ?? v)}</button>`).join('')}</div>`;
}
/* Múltipla escolha (caixa). */
export const opt = (acao, rotulo, on, travado = false) =>
  `<span class="cp-opt${on ? ' on' : ''}" ${travado ? '' : `data-acao="campo:${acao}"`}><span class="cx">${I.check}</span>${esc(rotulo)}</span>`;

export const secTit = (t, cor) => `<div class="gh-sec" style="display:flex;align-items:center;gap:8px;margin:14px 0 10px"><span class="dot"${cor ? ` style="background:${cor}"` : ''}></span><span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--text-3)">${esc(t)}</span><span style="flex:1;height:1px;background:var(--border)"></span></div>`;
export const nota = (texto, tipo = '') => `<div class="cp-nota ${tipo}">${tipo === 'warn' ? I.relogio : tipo === 'red' ? I.alerta : I.info}<span>${texto}</span></div>`;

/* Campo de texto que grava enquanto digita (sem redesenhar). */
export const inp = (chave, valor, { ph = '', tipo = 'text', travado = false, modo = '' } = {}) =>
  `<input class="cp-inp" type="${tipo}" data-cp="${esc(chave)}" value="${esc(valor ?? '')}" placeholder="${esc(ph)}"${modo ? ` inputmode="${modo}"` : ''}${travado ? ' readonly' : ''}>`;
export const area = (chave, valor, { ph = '', travado = false, alto = 0 } = {}) =>
  `<textarea class="cp-inp" data-cp="${esc(chave)}" placeholder="${esc(ph)}"${alto ? ` style="min-height:${alto}px"` : ''}${travado ? ' readonly' : ''}>${esc(valor ?? '')}</textarea>`;

/* Situação da cópia do aparelho × banco. */
export function syncHtml(d) {
  if (!d) return '';
  const pend = D.qtdPendente(d);
  if (!D.online()) return `<span class="cp-sync offline" data-cp-sync="${d.id}"><span class="dot"></span>Sem internet · ${pend ? 'guardado neste aparelho' : 'tudo salvo'}</span>`;
  if (d.erroEnvio && pend) return `<span class="cp-sync offline" data-cp-sync="${d.id}" data-acao="campo:enviar"><span class="dot"></span>Não enviado · tocar para tentar de novo</span>`;
  if (pend) return `<span class="cp-sync" data-cp-sync="${d.id}"><span class="dot" style="background:var(--warn)"></span>Salvando…</span>`;
  return `<span class="cp-sync" data-cp-sync="${d.id}"><span class="dot"></span>Salvo${d.enviadoEm ? ' · ' + horaMin(d.enviadoEm) : ''}</span>`;
}
export function pintarSync(id) {
  const d = D.doc(id); if (!d) return;
  document.querySelectorAll(`[data-cp-sync="${CSS.escape(id)}"]`).forEach(el => { el.outerHTML = syncHtml(d); });
}

export function topo(d, cli, { rotulo = 'Avaliação de riscos ambientais', sub } = {}) {
  const end = cli ? [cli.logradouro || cli.endereco, cli.numero, cli.bairro].filter(Boolean).join(', ') : '';
  const cid = cli ? [cli.cidade, cli.uf].filter(Boolean).join('/') : '';
  const linha = sub ?? [cli?.cnpj ? 'CNPJ ' + fmtCnpj(cli.cnpj) : '', end, cid].filter(Boolean).join(' · ');
  return `<div class="cp-topo"><div class="cp-topo-txt"><div class="cp-topo-emp">${esc(rotulo)}</div>
    <div class="cp-topo-tit">${esc(cli?.nome || 'Empresa')}</div>${linha ? `<div class="cp-topo-sub">${esc(linha)}</div>` : ''}</div>${syncHtml(d)}</div>`;
}
export function fmtCnpj(v) {
  const s = String(v || '').replace(/\D/g, '');
  return s.length === 14 ? `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5, 8)}/${s.slice(8, 12)}-${s.slice(12)}` : (v || '');
}
export const selo = (sit) => { const [t, c] = D.SITUACAO[sit] || [sit, 'badge-gray']; return `<span class="badge ${c}">${esc(t)}</span>`; };

/* Fotos: miniaturas + botão de tirar foto. As imagens entram depois do
   desenho (carregarFotos), porque podem vir do aparelho ou do banco. */
export function fotos(d, filtro, { chave, travado = false, rotulo = 'Tirar foto' } = {}) {
  const lista = d.fotos.filter(filtro);
  return `<div class="cp-fotos">${lista.map(f => `<div class="cp-foto" data-cp-img="${f.id}">
      ${travado ? '' : `<button type="button" class="cp-foto-x" data-acao="campo:foto-apagar:${f.id}" aria-label="Apagar foto">${I.x}</button>`}
      <span data-acao="campo:foto-legenda:${f.id}">${esc(f.legenda || (travado ? '' : 'Pôr legenda'))}</span></div>`).join('')}
    ${travado ? '' : `<label class="cp-foto-add">${I.cam}${esc(rotulo)}<input type="file" accept="image/*" capture="environment" multiple data-cp-foto="${esc(chave)}"></label>`}
  </div>`;
}
export async function carregarFotos(d) {
  if (!d) return;
  for (const el of document.querySelectorAll('[data-cp-img]')) {
    if (el.querySelector('img')) continue;
    const f = d.fotos.find(x => x.id === el.dataset.cpImg); if (!f) continue;
    try {
      const url = await D.urlFoto(f);
      if (url && !el.querySelector('img')) el.insertAdjacentHTML('afterbegin', `<img src="${esc(url)}" alt="">`);
    } catch { /* sem imagem: fica o fundo cinza */ }
  }
}
export function legendarFoto(d, fotoId, redesenhar) {
  const f = d.fotos.find(x => x.id === fotoId); if (!f) return;
  const p = ponte();
  p.abrirModal('Legenda da foto', `<div class="field"><label>O que a foto mostra</label>
    <input type="text" id="cpLegenda" maxlength="160" value="${esc(f.legenda || '')}" placeholder="Ex.: armário de produtos de limpeza"></div>`,
    p.botoes('Salvar', 'cpLegendaOk'));
  p.aoConfirmar('cpLegendaOk', async () => {
    D.legendarFoto(d.id, fotoId, document.getElementById('cpLegenda')?.value.trim() || '');
    p.fecharModal(); redesenhar();
  });
}

/* ── Ouvintes do módulo (uma vez só, no document) ───────────────────────── */
let _tela = null;
export function ligarTela(t) { _tela = t; }
const dentro = (el) => el && el.closest('#mainBody, #mobileBody');
if (typeof document !== 'undefined' && !window.__campoOuvintes) {
  window.__campoOuvintes = true;
  document.addEventListener('input', (ev) => {
    const el = ev.target.closest?.('[data-cp]');
    if (!el || !dentro(el) || !_tela?.digitar) return;
    _tela.digitar(el.dataset.cp, el.value, el);
  });
  document.addEventListener('change', async (ev) => {
    const el = ev.target;
    if (!dentro(el) || !_tela) return;
    if (el.dataset?.cpFoto !== undefined && el.files?.length) {
      const arquivos = [...el.files]; el.value = '';
      try { await _tela.foto?.(el.dataset.cpFoto, arquivos); }
      catch (e) { avisar('Não foi possível guardar a foto: ' + (e?.message || e), 'erro'); }
    } else if (el.dataset?.cp && (el.type === 'date' || el.type === 'time')) {
      _tela.digitar?.(el.dataset.cp, el.value, el);
    }
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter') return;
    const el = ev.target.closest?.('[data-cp-enter]');
    if (!el || !dentro(el) || !_tela?.enter) return;
    ev.preventDefault();
    _tela.enter(el.dataset.cpEnter, el.value, el);
  });
  window.addEventListener('online', () => document.querySelectorAll('[data-cp-sync]').forEach(el => pintarSync(el.dataset.cpSync)));
  window.addEventListener('offline', () => document.querySelectorAll('[data-cp-sync]').forEach(el => pintarSync(el.dataset.cpSync)));
  D.aoMudarSync((id) => pintarSync(id));
}
/* Valor do campo de texto visível (a casca tem duas cópias da tela). */
export function valorVisivel(seletor) {
  const el = [...document.querySelectorAll(seletor)].find(c => c.getBoundingClientRect().width > 0);
  return el ? el.value : '';
}

/* ── Assinatura ─────────────────────────────────────────────────────────── */
export function colherAssinatura({ titulo, nome, sub }, aoSalvar) {
  const p = ponte();
  p.abrirModal(titulo, `
    <div style="font-size:14px;font-weight:700;color:var(--text-1)">${esc(nome || '')}</div>
    ${sub ? `<div style="font-size:12px;color:var(--text-3);margin-bottom:8px">${esc(sub)}</div>` : ''}
    <canvas id="cpCanvas" class="cp-canvas"></canvas>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
      <span style="font-size:12px;color:var(--text-3)">Assine com o dedo dentro do quadro.</span>
      <button type="button" class="btn btn-outline btn-sm" id="cpCanvasLimpar">Limpar</button></div>`,
    p.botoes('Salvar assinatura', 'cpAssinOk'));
  setTimeout(() => {
    const cv = document.getElementById('cpCanvas'); if (!cv) return;
    const r = cv.getBoundingClientRect(), dpr = Math.max(1, window.devicePixelRatio || 1);
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr); ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#172541';
    let desenhando = false, riscou = false, ult = null;
    const pos = (e) => { const b = cv.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
    cv.addEventListener('pointerdown', (e) => { desenhando = true; ult = pos(e); cv.setPointerCapture?.(e.pointerId); e.preventDefault(); });
    cv.addEventListener('pointermove', (e) => {
      if (!desenhando) return;
      const q = pos(e); ctx.beginPath(); ctx.moveTo(ult.x, ult.y); ctx.lineTo(q.x, q.y); ctx.stroke(); ult = q; riscou = true; e.preventDefault();
    });
    const fim = () => { desenhando = false; };
    cv.addEventListener('pointerup', fim); cv.addEventListener('pointercancel', fim); cv.addEventListener('pointerleave', fim);
    document.getElementById('cpCanvasLimpar').onclick = () => { ctx.clearRect(0, 0, cv.width, cv.height); riscou = false; };
    p.aoConfirmar('cpAssinOk', async () => {
      if (!riscou) { avisar('Faça a assinatura dentro do quadro.', 'erro'); return; }
      const blob = await new Promise(ok => cv.toBlob(ok, 'image/png'));
      await aoSalvar(blob);
      p.fecharModal();
    });
  }, 60);
}
export async function urlArquivoLocal(path) {
  const u = await D.dataUrlArquivo(path).catch(() => null);
  return u;
}

/* Barra de ações fixa no rodapé. */
export const acoes = (itens) => `<div class="cp-acoes">${itens.filter(Boolean).join('')}</div>`;
export const btn = (rotulo, acao, { cls = 'btn-outline', papel = '', travado = false, estilo = '' } = {}) =>
  `<button type="button" class="btn ${cls} ${papel}" ${travado ? 'disabled style="opacity:.5;' + estilo + '"' : (estilo ? `style="${estilo}"` : '')} ${acao && !travado ? `data-acao="${acao}"` : ''}>${rotulo}</button>`;

/* Ícone da categoria de risco. */
export const ICONE_CAT = { fisico: 'termo', acidente: 'tri', operacao_perigosa: 'raio', ergonomico: 'corpo', quimico: 'frasco', biologico: 'bio', outro: 'alerta' };
