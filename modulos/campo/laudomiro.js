/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/campo/laudomiro.js — consulta de agentes do Laudomiro (v232)
   Lê a base gerada (agentes-base.js) e monta a ficha: insalubridade (NR-15),
   aposentadoria especial (Decreto 3.048, Anexo IV), código do eSocial
   (Tabela 24) e a comparação com uma medição (nível de ação da NR-09).
   Só mostra; nunca marca as respostas do risco. Sem banco, sem dado pessoal.
   ══════════════════════════════════════════════════════════════════════════ */

import { AGENTES, T24, VERSAO } from './agentes-base.js';
import { esc } from './comum.js';

export { AGENTES, VERSAO };

export const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9,.\- ]+/g, ' ').replace(/\s+/g, ' ').trim();
const semParen = (s) => String(s || '').replace(/\s*\(.*?\)\s*/g, ' ').trim();

const IDX = AGENTES.map(a => ({ a, chaves: [a.nome, semParen(a.nome), ...a.sinonimos, a.cas || ''].map(norm).filter(Boolean) }));
const POR_ID = new Map(AGENTES.map(a => [a.id, a]));
export const porId = (id) => POR_ID.get(id) || null;

/* Busca por nome, sinônimo ou CAS. Começa-com vem antes de contém. */
export function buscar(q) {
  const t = norm(q);
  if (!t) return AGENTES.slice().sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
  const r = [];
  for (const { a, chaves } of IDX) {
    let p = 99;
    for (const c of chaves) { if (c === t) p = Math.min(p, 0); else if (c.startsWith(t)) p = Math.min(p, 1); else if (c.includes(t)) p = Math.min(p, 2); }
    if (p < 99) r.push([p, a]);
  }
  return r.sort((x, y) => x[0] - y[0] || x[1].nome.localeCompare(y[1].nome, 'pt-BR')).map(x => x[1]);
}

/* Agente de um risco da avaliação (nome vindo do SOC ou do catálogo).
   Igual vence; depois a chave mais longa contida no nome (mín. 5 letras). */
export function doRisco(nomeRisco) {
  const t = norm(nomeRisco);
  if (!t) return null;
  let melhor = null, tam = 0;
  for (const { a, chaves } of IDX) for (const c of chaves) {
    if (c === t) return a;
    if (c.length >= 5 && (' ' + t + ' ').includes(' ' + c + ' ') && c.length > tam) { melhor = a; tam = c.length; }
  }
  return melhor;
}

/* ── Respostas curtas ──────────────────────────────────────────────────── */
const COR_GRAU = { 'máximo': 'max', 'médio': 'med', 'mínimo': 'min' };
const numBr = (v) => { const n = parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
const limites = (a) => { const n = a.nr15; return [n.lt_ppm && numBr(n.lt_ppm) != null ? ['ppm', n.lt_ppm] : null, n.lt_mg && numBr(n.lt_mg) != null ? ['mg/m³', n.lt_mg] : null].filter(Boolean); };

export function insal(a) {
  const n = a.nr15;
  if (n.avaliacao === 'proibida') return { cls: 'max', v: 'Exposição proibida', s: 'nenhum contato, por nenhuma via' };
  if (!n.grau) {
    if (String(n.anexo || '').includes('/')) return { cls: 'nao', v: 'Depende do metal', s: 'avaliar cada metal dos fumos (manganês, chumbo, cádmio...)' };
    if (/Asfixiante/.test(n.obs || '')) return { cls: 'nao', v: 'Não tem grau', s: 'asfixiante simples: oxigênio mínimo 18%' };
    return { cls: 'nao', v: 'Grau não fixado', s: 'a norma não fixa o grau; definir no laudo' };
  }
  const v = `Grau ${n.grau} · ${n.pct}%`;
  if (n.avaliacao === 'qualitativa') return { cls: COR_GRAU[n.grau], v, s: 'pela atividade, sem medição (Anexo 13)' };
  const l = limites(a);
  return { cls: COR_GRAU[n.grau], v, s: l.length ? `se passar de ${l.map(([u, x]) => `${x} ${u}`).join(' ou ')}` : (n.lt_texto ? 'se passar do limite' : '') };
}
export function apos(a) {
  const p = a.prev;
  if (p.status === 'sim') return { cls: 'sim', v: `Sim · ${p.anos} anos`, s: a.linach ? 'cancerígeno: vale a presença' : (a.nr15.avaliacao === 'quantitativa' ? 'se passar do limite, de forma permanente' : 'pela atividade, de forma permanente') };
  if (p.status === 'familia') return { cls: 'talvez', v: `Pode ter · ${p.anos} anos`, s: 'o Decreto cita a família, não o nome' };
  if (p.status === 'conferir') return { cls: 'talvez', v: 'Conferir no laudo', s: 'caso discutível' };
  return { cls: 'nao', v: 'Não', s: a.linach ? 'cancerígeno, mas fora do Anexo IV' : 'fora do Anexo IV do Decreto 3.048' };
}
export const t24 = (a) => ({ cod: a.prev.t24, desc: T24[a.prev.t24] || '' });

/* ── Comparação com uma medição ────────────────────────────────────────────
   Anexo 11, item 8: excede quando a MÉDIA passa do limite; item 9: com valor
   teto, qualquer amostra acima já excede. NR-09, 9.6.1 b: nível de ação =
   metade do limite (enquanto não houver anexo próprio). */
export const unidades = (a) => limites(a).map(([u]) => u);
export function comparar(a, valorTxt, unidade) {
  const v = numBr(valorTxt);
  const l = limites(a).find(([u]) => u === unidade) || limites(a)[0];
  if (v == null || !l) return null;
  const lt = numBr(l[1]), na = lt / 2, pct = Math.round(v / lt * 100);
  const grau = a.nr15.grau ? `grau ${a.nr15.grau} (${a.nr15.pct}%)` : '';
  const nivel = v > lt ? 'acima' : v > na ? 'acao' : 'abaixo';
  const txt = {
    acima: `Acima do limite (${pct}% do limite). ${a.nr15.teto ? 'Valor teto: basta uma amostra acima.' : 'Vale a média das amostras.'} Insalubre ${grau}.`,
    acao: `Entre o nível de ação e o limite (${pct}% do limite). Não é insalubre, mas exige controle sistemático (NR-09, 9.6.1).`,
    abaixo: `Abaixo do nível de ação (${pct}% do limite). Não caracteriza insalubridade.`
  }[nivel];
  return { nivel, pct, v, lt, na, un: l[0], txt };
}
export function barraHtml(c) {
  if (!c) return '';
  const max = c.lt * 1.5, pos = (x) => Math.min(100, Math.round(x / max * 1000) / 10);
  return `<div class="lm-barra ${c.nivel}"><span style="width:${pos(Math.min(max, c.v))}%"></span>
      <i style="left:${pos(c.na)}%"><b>nível de ação ${fmt(c.na)}</b></i><i class="lt" style="left:${pos(c.lt)}%"><b>limite ${fmt(c.lt)}</b></i></div>
    <div class="lm-med-r ${c.nivel}">${esc(c.txt)}</div>`;
}
const fmt = (n) => String(Math.round(n * 1000) / 1000).replace('.', ',');

/* ── Ficha ─────────────────────────────────────────────────────────────── */
function tags(a) {
  const t = [];
  if (a.linach) t.push('<span class="lm-tag can">Cancerígeno</span>');
  if (a.nr15.pele) t.push('<span class="lm-tag">Absorve pela pele</span>');
  if (a.nr15.teto) t.push('<span class="lm-tag">Valor teto</span>');
  return t.join('');
}
export function respostasHtml(a) {
  const i = insal(a), p = apos(a), e = t24(a);
  return `<div class="lm-resp">
    <div class="lm-t ins-${i.cls}"><div class="lm-t-k">Insalubridade</div><div class="lm-t-v">${esc(i.v)}</div><div class="lm-t-s">${esc(i.s)}</div></div>
    <div class="lm-t ae-${p.cls}"><div class="lm-t-k">Aposentadoria especial</div><div class="lm-t-v">${esc(p.v)}</div><div class="lm-t-s">${esc(p.s)}</div></div>
    <div class="lm-t es"><div class="lm-t-k">eSocial · S-2240</div><div class="lm-t-v mono">${esc(e.cod)}</div><div class="lm-t-s">${esc(curto(e.desc, 70))}</div></div></div>`;
}
export const curtoNome = (s) => curto(s, 26);
const curto = (s, n) => (s = String(s || '')).length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;

function porqueHtml(a) {
  const n = a.nr15, p = a.prev, li = [];
  const lim = limites(a);
  const ins = [];
  if (lim.length) ins.push(`Limite de tolerância: <b>${lim.map(([u, x]) => `${esc(x)} ${u}`).join(' · ')}</b>, para até 48 horas por semana.`);
  if (n.lt_texto) ins.push(`Limite: <b>${esc(n.lt_texto)}</b>.`);
  if (n.teto) ins.push('Valor teto: o limite não pode ser passado em nenhum momento da jornada.');
  if (n.pele) ins.push('Absorção também pela pele: luvas e proteção do corpo, além da respiratória.');
  if (n.obs) ins.push(esc(n.obs));
  if (n.grau) ins.push(`O adicional é sobre o salário mínimo e só vale o maior grau quando há mais de um agente (NR-15, 15.2 e 15.3).`);
  li.push(`<div class="lm-pq"><div class="lm-pq-t">Insalubridade · NR-15${n.anexo ? ' Anexo ' + esc(n.anexo) : ''}</div>${ins.map(x => `<p>${x}</p>`).join('')}</div>`);
  const ap = [];
  if (p.iv) ap.push(`Decreto 3.048, Anexo IV, <b>${esc(p.iv)}</b>${p.iv_nome ? ' · ' + esc(p.iv_nome) : ''}${p.anos ? ` · ${p.anos} anos` : ''}.`);
  if (p.nota) ap.push(esc(p.nota));
  if (a.linach && p.status !== 'nao') ap.push('Cancerígeno da LINACH (Grupo 1): para períodos desde 08/10/2014 vale a presença do agente, sem medição; desde 01/07/2020, medidas de controle que eliminem a nocividade descaracterizam (IN INSS 128, art. 298).');
  else if (p.status !== 'nao' && n.avaliacao === 'quantitativa') ap.push('Para agente com limite, só conta acima do limite e de forma permanente (IN INSS 128, arts. 286 e 297). EPI eficaz pode descaracterizar se cumprir o art. 291.');
  li.push(`<div class="lm-pq"><div class="lm-pq-t">Aposentadoria especial</div>${ap.map(x => `<p>${x}</p>`).join('')}</div>`);
  const e = t24(a);
  li.push(`<div class="lm-pq"><div class="lm-pq-t">eSocial · Tabela 24</div><p><b>${esc(e.cod)}</b> · ${esc(e.desc)}${e.cod === '09.01.001' ? '. Usar só se não houver outro agente nocivo no ambiente.' : '.'}</p></div>`);
  return li.join('');
}

export function fichaHtml(a, { medicao = null, unidade = '', compacta = false, acoes = '' } = {}) {
  if (!a) return '';
  const un = unidades(a);
  const c = medicao ? comparar(a, medicao, unidade || un[0]) : null;
  const med = un.length && !compacta ? `<div class="lm-med"><div class="lm-med-t">Comparar com uma medição</div>
      <div class="lm-med-in"><input class="cp-inp" type="text" inputmode="decimal" data-cp="lm.med" value="${esc(medicao || '')}" placeholder="Resultado da média">
        ${un.length > 1 ? `<select class="cp-inp" data-acao="campo:lm-un">${un.map(u => `<option ${u === (unidade || un[0]) ? 'selected' : ''}>${u}</option>`).join('')}</select>` : `<span class="lm-un">${un[0]}</span>`}</div>
      <div data-lm-res>${c ? barraHtml(c) : `<div class="lm-med-r">Digite o resultado para ver se passa do nível de ação (${fmt(numBr(limites(a)[0][1]) / 2)} ${un[0]}) ou do limite.</div>`}</div></div>` : '';
  const at = a.atencoes.length ? `<div class="lm-at"><div class="lm-pq-t">Atenção</div><ul>${a.atencoes.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
  return `<div class="lm-ficha${compacta ? ' compacta' : ''}">
    <div class="lm-cab"><div><div class="lm-nome">${esc(a.nome)}</div>
      <div class="lm-sin">${a.sinonimos.length ? 'Também: ' + esc(a.sinonimos.slice(0, 6).join(', ')) : ''}${a.cas ? `${a.sinonimos.length ? ' · ' : ''}CAS ${esc(a.cas)}` : ''}</div></div>
      <div class="lm-tags">${tags(a)}${acoes}</div></div>
    ${respostasHtml(a)}${med}
    ${compacta ? '' : `<div class="lm-pqs">${porqueHtml(a)}</div>${at}`}
    <div class="lm-rod">Indicação para orientar o técnico. Não substitui o laudo de insalubridade (CLT, art. 195) nem o LTCAT (Lei 8.213/1991, art. 58). Base do Laudomiro de ${esc(VERSAO.split('-').reverse().join('/'))}.</div>
  </div>`;
}

/* Texto para colar no laudo, no SOC ou no WhatsApp. */
export function resumoTexto(a) {
  const i = insal(a), p = apos(a), e = t24(a);
  return [`${a.nome}${a.cas ? ` (CAS ${a.cas})` : ''}`,
    `Insalubridade (NR-15${a.nr15.anexo ? ' Anexo ' + a.nr15.anexo : ''}): ${i.v}${i.s ? ', ' + i.s : ''}.`,
    `Aposentadoria especial (Decreto 3.048, Anexo IV${a.prev.iv ? ' ' + a.prev.iv : ''}): ${p.v}${p.s ? ', ' + p.s : ''}.`,
    `eSocial S-2240 (Tabela 24): ${e.cod} - ${e.desc}.`,
    'Indicação do GRID (Laudomiro); não substitui laudo nem LTCAT.'].join('\n');
}

/* Faixa curta dentro da Conclusão do risco (ghe.js). */
export function dicaRiscoHtml(a, med) {
  const i = insal(a), p = apos(a), e = t24(a);
  const c = med?.resultado && unidades(a).length ? comparar(a, med.resultado, unidades(a).find(u => norm(u) === norm(med.unidade)) || '') : null;
  const cmp = c && (!med.unidade || unidades(a).some(u => norm(u) === norm(med.unidade))) ? `<div class="lm-dica-m ${c.nivel}">Medição de hoje: ${esc(c.txt)}</div>` : '';
  return `<div class="lm-dica"><div class="lm-dica-t"><span class="lm-dica-ic">L</span>Laudomiro · ${esc(a.nome)}</div>
    <div class="lm-dica-g"><span>Insalubridade</span><b class="ins-${i.cls}">${esc(i.v)}</b><small>${esc(i.s)}</small>
      <span>Aposentadoria</span><b class="ae-${p.cls}">${esc(p.v)}</b><small>${esc(p.s)}</small>
      <span>eSocial</span><b>${esc(e.cod)}</b><small>${esc(curto(e.desc, 48))}</small></div>${cmp}
    <button type="button" class="cp-link" data-acao="campo:lm-ficha:${esc(a.id)}">Ver a ficha completa</button></div>`;
}
