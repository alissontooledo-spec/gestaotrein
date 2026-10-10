/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/campo/laudomiro.js — consulta de agentes do Laudomiro (v232; v239: físicos, biológicos e periculosidade)
   Lê a base gerada (agentes-base.js) e monta a ficha: insalubridade (NR-15),
   aposentadoria especial (Decreto 3.048, Anexo IV), código do eSocial
   (Tabela 24) e a comparação com uma medição (nível de ação da NR-09).
   v239: ficha nova (medição e conclusão primeiro). Só marca as respostas do risco quando
   o técnico toca em "Aplicar ao risco" (sugestao()). Sem banco, sem dado pessoal.
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
/* v239: categoria do risco (quimico, fisico, biologico, operacao_perigosa) limita o grupo. */
const GRUPO_DA_CAT = { quimico: 'quimico', fisico: 'fisico', biologico: 'biologico', operacao_perigosa: 'periculosidade' };
export const GRUPO_NOME = { quimico: 'Químico', fisico: 'Físico', biologico: 'Biológico', periculosidade: 'Periculosidade' };
export const grupoDe = (a) => a.grupo || 'quimico';
export function doRisco(nomeRisco, categoria) {
  const t = norm(nomeRisco);
  if (!t) return null;
  const g = categoria ? GRUPO_DA_CAT[categoria] : null;
  if (categoria && !g) return null;
  let melhor = null, tam = 0;
  for (const { a, chaves } of IDX) { if (g && grupoDe(a) !== g) continue; for (const c of chaves) {
    if (c === t) return a;
    if (c.length >= 5 && (' ' + t + ' ').includes(' ' + c + ' ') && c.length > tam) { melhor = a; tam = c.length; }
  } }
  return melhor;
}

/* ── Respostas curtas ──────────────────────────────────────────────────── */
const COR_GRAU = { 'máximo': 'max', 'médio': 'med', 'mínimo': 'min' };
const numBr = (v) => { const n = parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
const limites = (a) => { const n = a.nr15; if (!n || a.medida) return []; return [n.lt_ppm && numBr(n.lt_ppm) != null ? ['ppm', n.lt_ppm] : null, n.lt_mg && numBr(n.lt_mg) != null ? ['mg/m³', n.lt_mg] : null].filter(Boolean); };

const S_MEDIDA = { ruido: 'se a dose passar de 100% (85 dB(A) em 8 h)', impacto: 'se o pico passar de 130 dB linear', calor: 'se o IBUTG passar do limite da atividade',
  vmb: 'se a aren passar de 5 m/s²', vci: 'se a aren passar de 1,1 m/s² ou o VDVR de 21' };
export function insal(a) {
  const n = a.nr15;
  if (grupoDe(a) === 'periculosidade') return { cls: 'max', v: 'Sim · 30%', s: `pela atividade, NR-16 Anexo ${a.nr16?.anexo || ''}`.trim() };
  if (!n.anexo) return { cls: 'nao', v: 'Não citado na NR-15', s: 'avaliar outro anexo no laudo' };
  if (n.avaliacao === 'proibida') return { cls: 'max', v: 'Exposição proibida', s: 'nenhum contato, por nenhuma via' };
  if (!n.grau) {
    if (String(n.anexo || '').includes('/')) return { cls: 'nao', v: 'Depende do metal', s: 'avaliar cada metal dos fumos (manganês, chumbo, cádmio...)' };
    if (/Asfixiante/.test(n.obs || '')) return { cls: 'nao', v: 'Não tem grau', s: 'asfixiante simples: oxigênio mínimo 18%' };
    return { cls: 'nao', v: 'Grau não fixado', s: 'a norma não fixa o grau; definir no laudo' };
  }
  const v = `Grau ${n.grau} · ${n.pct}%`;
  if (n.avaliacao === 'qualitativa') return { cls: COR_GRAU[n.grau], v, s: n.anexo === '14' ? 'contato permanente com a atividade (Anexo 14)'
    : ['7', '9', '10'].includes(n.anexo) ? 'sem proteção adequada, por laudo de inspeção' : `pela atividade, sem medição (Anexo ${n.anexo})` };
  if (a.medida) return { cls: COR_GRAU[n.grau], v, s: S_MEDIDA[a.medida.tipo] || 'se passar do limite' };
  if (n.anexo === '5') return { cls: COR_GRAU[n.grau], v, s: 'acima dos limites da CNEN-NN-3.01' };
  const l = limites(a);
  return { cls: COR_GRAU[n.grau], v, s: l.length ? `se passar de ${l.map(([u, x]) => `${x} ${u}`).join(' ou ')}` : (n.lt_texto ? 'se passar do limite' : '') };
}
export function apos(a) {
  const p = a.prev;
  if (p.status === 'sim') return { cls: 'sim', v: `Sim · ${p.anos} anos`, s: a.linach ? 'cancerígeno: vale a presença' : (a.nr15?.avaliacao === 'quantitativa' ? 'se passar do limite, de forma permanente' : 'pela atividade, de forma permanente') };
  if (p.status === 'familia') return { cls: 'talvez', v: `Pode ter · ${p.anos} anos`, s: 'o Decreto cita a família, não o nome' };
  if (p.status === 'conferir') return { cls: 'talvez', v: 'Conferir no laudo', s: 'caso discutível' };
  if (grupoDe(a) === 'periculosidade') return { cls: 'nao', v: 'Não', s: 'periculosidade não conta para aposentadoria' };
  if (/05\/03\/1997/.test(p.nota || '')) return { cls: 'nao', v: 'Não', s: 'só contava até 05/03/1997' };
  return { cls: 'nao', v: 'Não', s: a.linach ? 'cancerígeno, mas fora do Anexo IV' : 'fora do Anexo IV do Decreto 3.048' };
}
export const t24 = (a) => a.prev.t24 ? ({ cod: a.prev.t24, desc: T24[a.prev.t24] || '' }) : ({ cod: 'Sem código', desc: 'periculosidade não entra na Tabela 24' });

/* ── Comparação com uma medição ────────────────────────────────────────────
   Anexo 11, item 8: excede quando a MÉDIA passa do limite; item 9: com valor
   teto, qualquer amostra acima já excede. NR-09, 9.6.1 b: nível de ação =
   metade do limite (enquanto não houver anexo próprio). */
/* v239 — medidas físicas (campo "medida" da base):
   ruído: NEN/Lavg em dB(A); limite 85 (dose 100%), nível de ação = metade da dose (NR-09 9.6.1 c) = 80 dB(A) com q = 5.
   impacto: 130 dB linear ou 120 dB(C) (NR-15 Anexo 2). VMB: 5 e 2,5 m/s². VCI: aren 1,1 e 0,5 / VDVR 21 e 9,1 (NR-15 Anexo 8, NR-09 Anexo I).
   calor: limite do Quadro 1 do Anexo 3 da NR-15 e nível de ação do Quadro 1 do Anexo III da NR-09, pela taxa metabólica (Quadro 2);
   M entre linhas → linha de M imediatamente maior (conservador). */
const UN_MED = { ruido: ['dB(A)'], impacto: ['dB linear', 'dB(C)'], vmb: ['m/s² (aren)'], vci: ['m/s² (aren)', 'VDVR (m/s^1,75)'] };
export const ehCalor = (a) => a.medida?.tipo === 'calor';
const linhaCalor = (tab, m) => (tab.find(r => r.m >= m) || tab[tab.length - 1]).ibutg;
function limitesMedida(a, unidade) {
  const m = a.medida, t = m.tipo;
  if (t === 'ruido') return { lt: 85, na: 80, un: 'dB(A)', min: 76, max: 90 };
  if (t === 'impacto') return unidade === 'dB(C)' ? { lt: 120, na: null, un: 'dB(C)', min: 100, max: 135 } : { lt: 130, na: null, un: 'dB linear', min: 110, max: 145 };
  if (t === 'vmb') return { lt: 5, na: 2.5, un: 'm/s²' };
  if (t === 'vci') return /VDVR/.test(unidade || '') ? { lt: 21, na: 9.1, un: 'm/s^1,75' } : { lt: 1.1, na: 0.5, un: 'm/s²' };
  if (t === 'calor') { const w = parseInt(String(unidade || '').replace(/\D/g, ''), 10); if (!w) return null;
    const lt = linhaCalor(m.le, w), na = linhaCalor(m.na, w); return { lt, na, un: '°C', min: na - 3, max: lt + 2, w }; }
  return null;
}
export const unidades = (a) => a.medida ? (ehCalor(a) ? ['IBUTG (°C)'] : (UN_MED[a.medida.tipo] || [])) : limites(a).map(([u]) => u);
const doseRuido = (db) => Math.round(100 * Math.pow(2, (db - 85) / 5));
function compararMedida(a, valorTxt, unidade) {
  const v = numBr(valorTxt), L = limitesMedida(a, unidade);
  if (v == null || !L) return null;
  const nivel = v > L.lt ? 'acima' : (L.na != null && v > L.na) ? 'acao' : 'abaixo';
  const grau = `grau ${a.nr15.grau} (${a.nr15.pct}%)`, t = a.medida.tipo;
  const ref = t === 'ruido' ? `dose ${doseRuido(v)}%` : t === 'calor' ? `limite ${fmt(L.lt)} °C para ${L.w} W` : `${Math.round(v / L.lt * 100)}% do limite`;
  const txt = {
    acima: `Acima do limite (${ref}). Insalubre ${grau}.${t === 'ruido' ? ' Para aposentadoria o EPI não descaracteriza.' : ''}`,
    acao: `Entre o nível de ação e o limite (${ref}). Não é insalubre, mas exige controle sistemático (NR-09${t === 'ruido' ? ', 9.6.1 c: PCA' : ''}).`,
    abaixo: L.na != null ? `Abaixo do nível de ação (${ref}). Não caracteriza insalubridade.` : `Abaixo do limite (${ref}). Não caracteriza insalubridade.`
  }[nivel];
  return { nivel, pct: Math.round(v / L.lt * 100), v, lt: L.lt, na: L.na, un: L.un, min: L.min || 0, max: L.max, txt, w: L.w };
}
export function comparar(a, valorTxt, unidade) {
  if (a.medida) return compararMedida(a, valorTxt, unidade);
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
const fmt = (n) => String(Math.round(n * 1000) / 1000).replace('.', ',');
export const curtoNome = (s) => curto(s, 26);
const curto = (s, n) => (s = String(s || '')).length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
const IC = {
  alerta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5h.01"/></svg>',
  ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L19 7"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5h.01"/></svg>',
  chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>'
};

/* ── Lista: etiqueta escrita e linha de referência (sem depender só da cor) ── */
export function etiqueta(a) {
  if (grupoDe(a) === 'periculosidade') return { cls: 'per', t: 'Pericul. 30%' };
  const n = a.nr15 || {};
  if (n.avaliacao === 'proibida') return { cls: 'max', t: 'Proibido' };
  if (n.grau) return { cls: COR_GRAU[n.grau], t: `${n.grau[0].toUpperCase()}${n.grau.slice(1)} ${n.pct}%` };
  return { cls: 'min', t: String(n.anexo || '').includes('/') ? 'Depende' : 'Sem grau' };
}
const REF_MED = { ruido: '85 dB(A) em 8 h', impacto: '130 dB linear', calor: 'IBUTG pela atividade', vmb: '5 m/s²', vci: '1,1 m/s² ou VDVR 21' };
export function referencia(a) {
  if (grupoDe(a) === 'periculosidade') return `NR-16 Anexo ${a.nr16?.anexo || ''}`.trim();
  if (a.medida) return REF_MED[a.medida.tipo] || '';
  const n = a.nr15 || {};
  if (n.anexo === '14') return 'contato permanente';
  if (['7', '9', '10'].includes(n.anexo)) return 'laudo de inspeção';
  const l = limites(a);
  if (l.length) return `${l[0][1]} ${l[0][0]}${n.teto ? ', teto' : ''}`;
  if (n.avaliacao === 'qualitativa') return 'pela atividade';
  return n.anexo ? `NR-15 Anexo ${n.anexo}` : '';
}
const VER_TAMBEM = { 'ruido-continuo': ['ruido-impacto'], 'ruido-impacto': ['ruido-continuo'], 'peri-inflamaveis': ['benzeno'], 'benzeno': ['peri-inflamaveis'],
  'radiacoes-ionizantes': ['peri-radiacoes-ionizantes'], 'peri-radiacoes-ionizantes': ['radiacoes-ionizantes'], 'vibracao-maos-bracos': ['vibracao-corpo-inteiro'],
  'vibracao-corpo-inteiro': ['vibracao-maos-bracos'], 'fumos-de-solda': ['radiacoes-nao-ionizantes'], 'radiacoes-nao-ionizantes': ['fumos-de-solda'] };

/* ── Avaliação de uma medição (ruído com dois critérios) ───────────────────
   Ruído: insalubridade pelo Lavg da NR-15 (q = 5; dose = 2^((L-85)/5));
   aposentadoria pelo NEN da NHO-01 (q = 3; dose = 2^((N-85)/3)), IN 128 art. 292. */
export const doseQ = (db, q) => Math.round(100 * Math.pow(2, (db - 85) / q));
export const ehRuido = (a) => a.medida?.tipo === 'ruido';
const linhaApos = (a, acima) => {
  const p = a.prev;
  if (!acima) return 'Não conta: abaixo do limite.';
  if (p.status === 'sim') return `Conta como atividade especial, ${p.anos} anos, se a exposição for permanente. ${ehRuido(a) ? 'O protetor auricular não descaracteriza (IN 128 art. 290).' : 'EPI eficaz pode descaracterizar se cumprir o art. 291 da IN 128.'}`;
  if (p.status === 'familia') return `Pode contar (${p.anos} anos): o Decreto 3.048 cita a família do agente. Decisão do LTCAT.`;
  if (p.status === 'conferir') return 'Caso discutível: decisão do LTCAT.';
  return 'Não conta: o agente não está no Anexo IV do Decreto 3.048.';
};
const linhaIns = (a, nivel) => nivel === 'acima'
  ? `Grau ${a.nr15.grau} (${a.nr15.pct}% do salário mínimo), salvo neutralização por EPI eficaz comprovada: CA válido, atenuação, entrega e uso registrados (NR-15 15.4.1 b).`
  : nivel === 'acao' ? 'Não caracteriza. Passou do nível de ação: controle sistemático (NR-09 9.6.1).' : 'Não caracteriza.';
const linhaPgr = (a, nivel) => {
  if (nivel === 'abaixo') return 'Manter a avaliação periódica no PGR.';
  const t = a.medida?.tipo;
  if (t === 'ruido') return 'Incluir no Programa de Conservação Auditiva e na audiometria (NR-07), com medidas no plano de ação do PGR.';
  if (t === 'calor') return 'Água fresca, trabalho pesado nos horários amenos e vestimenta adequada (NR-09 Anexo III item 4).';
  return 'Medidas de controle no plano de ação do PGR (NR-09 9.6.1).';
};
export function avaliar(a, ctx = {}) {
  if (ehRuido(a)) {
    const L = numBr(ctx.valor), N = numBr(ctx.valor2);
    if (L == null && N == null) return null;
    const nIns = L == null ? null : L > 85 ? 'acima' : L > 80 ? 'acao' : 'abaixo';
    const nApo = N == null ? null : N > 85;
    const nivel = nIns === 'acima' || nApo ? 'acima' : nIns === 'acao' ? 'acao' : 'abaixo';
    const linhas = [
      ['Insalubridade', L == null ? 'Digite o Lavg (NR-15) para concluir.' : linhaIns(a, nIns)],
      ['Aposentadoria', N == null ? 'Digite o NEN (NHO-01) para concluir.' : linhaApos(a, nApo)],
      ['PGR e PCMSO', linhaPgr(a, nivel)]];
    const v = L ?? N;
    return { nivel, valor: v, titulo: nivel === 'acima' ? 'Acima do limite de tolerância' : nivel === 'acao' ? 'Acima do nível de ação' : 'Abaixo do nível de ação',
      sub: L != null ? `Lavg ${fmt(L)} dB(A), dose ${doseQ(L, 5)}%` : `NEN ${fmt(N)} dB(A)`, linhas };
  }
  const c = comparar(a, ctx.valor, ctx.unidade);
  if (!c) return null;
  const acima = c.nivel === 'acima';
  const linhas = [['Insalubridade', a.nr15?.grau ? linhaIns(a, c.nivel) : (acima ? 'Acima do limite. A norma não fixa o grau: definir no laudo.' : 'Não caracteriza.')],
    ['Aposentadoria', a.linach && a.prev.status !== 'nao' ? 'Cancerígeno (LINACH): vale a presença do agente, sem depender do limite (IN 128 art. 298).' : linhaApos(a, acima)],
    ['PGR', linhaPgr(a, c.nivel)]];
  const sub = a.medida?.tipo === 'calor' ? `${fmt(c.v)} °C; limite ${fmt(c.lt)} °C para ${c.w} W` : `${fmt(c.v)} ${c.un}; limite ${fmt(c.lt)} ${c.un}`;
  return { nivel: c.nivel, valor: c.v, titulo: acima ? 'Acima do limite de tolerância' : c.nivel === 'acao' ? 'Acima do nível de ação' : (c.na != null ? 'Abaixo do nível de ação' : 'Abaixo do limite'), sub, linhas, c };
}

/* ── Régua: faixas com nome escrito, escala com números e o ponto medido ── */
function escala(a, ctx) {
  const t = a.medida?.tipo;
  if (t === 'ruido') return { min: 70, max: 120, na: 80, lt: 85, grave: 115, marcas: [70, 80, 85, 115] };
  if (t === 'impacto') { const C = ctx.unidade === 'dB(C)'; return C ? { min: 100, max: 140, na: null, lt: 120, grave: 130, marcas: [100, 120, 130, 140] } : { min: 110, max: 150, na: null, lt: 130, grave: 140, marcas: [110, 130, 140, 150] }; }
  const c = ctx.c; if (!c) return null;
  if (t === 'calor') return { min: Math.floor(c.na - 3), max: Math.ceil(c.lt + 2), na: c.na, lt: c.lt, marcas: [c.na, c.lt] };
  return { min: 0, max: c.lt * 1.5, na: c.na, lt: c.lt, marcas: [0, c.na, c.lt] };
}
export function reguaHtml(a, av, ctx = {}) {
  const e = escala(a, { ...ctx, c: av?.c || (av ? comparar(a, ctx.valor, ctx.unidade) : null) });
  if (!e) return '';
  const P = (x) => Math.max(0, Math.min(100, (x - e.min) / (e.max - e.min) * 100));
  const zonas = [];
  if (e.na != null) zonas.push([e.min, e.na, 'za', 'Abaixo'], [e.na, e.lt, 'zb', 'Ação']); else zonas.push([e.min, e.lt, 'za', 'Abaixo']);
  zonas.push([e.lt, e.grave ?? e.max, 'zc', 'Acima do limite']);
  if (e.grave) zonas.push([e.grave, e.max, 'zd', '']);
  const v = av?.valor;
  const pin = v != null ? `<div class="lmx-r-top"><span class="lmx-r-pin" style="left:${P(v)}%">${esc(fmt(v))}</span></div>` : '<div class="lmx-r-top"></div>';
  return `<div class="lmx-regua" role="img" aria-label="${v != null ? esc(`${fmt(v)}: ${av.titulo.toLowerCase()}`) : 'Faixas de referência'}">${pin}
    <div class="lmx-r-bar">${zonas.map(([x0, x1, c, t]) => `<i class="${c}" style="width:${P(x1) - P(x0)}%">${(P(x1) - P(x0)) > 9 ? t : ''}</i>`).join('')}${v != null ? `<span class="lmx-r-mk" style="left:${P(v)}%"></span>` : ''}</div>
    <div class="lmx-r-esc">${e.marcas.map(m => `<span style="left:${P(m)}%">${esc(fmt(m))}</span>`).join('')}</div></div>`;
}
export function conclusaoHtml(a, av) {
  if (!av) return '';
  return `<div class="lmx-conc ${av.nivel}" aria-live="polite"><div class="lmx-conc-h">${av.nivel === 'abaixo' ? IC.ok : IC.alerta}<b>${esc(av.titulo)}</b><span>${esc(av.sub)}</span></div>
    ${av.linhas.map(([k, t]) => `<div class="lmx-conc-l"><span class="q">${esc(k)}</span><span>${esc(t)}</span></div>`).join('')}</div>`;
}
/* Conteúdo que muda ao digitar (régua + conclusão). */
export function resultadoHtml(a, ctx = {}) {
  const av = avaliar(a, ctx);
  if (!av) return `${reguaHtml(a, null, ctx)}<div class="lmx-dica-med">${esc(dicaMedicao(a, ctx.unidade))}</div>`;
  return reguaHtml(a, av, ctx) + conclusaoHtml(a, av);
}
export function dicaMedicao(a, unidade) {
  if (ehCalor(a)) return unidade ? 'Digite o IBUTG médio dos 60 minutos mais críticos.' : 'Escolha a atividade (taxa metabólica) e digite o IBUTG médio.';
  if (ehRuido(a)) return 'Digite o Lavg (insalubridade) e o NEN (aposentadoria) da jornada de 8 horas.';
  if (a.medida) { const L = limitesMedida(a, unidade || unidades(a)[0]); return `Digite o resultado para comparar com ${L.na != null ? `o nível de ação (${fmt(L.na)} ${L.un}) e ` : ''}o limite (${fmt(L.lt)} ${L.un}).`; }
  const l = limites(a); return l.length ? `Digite a média das amostras para comparar com o nível de ação (${fmt(numBr(l[0][1]) / 2)} ${l[0][0]}) e o limite (${l[0][1]} ${l[0][0]}).` : '';
}

/* ── Ficha ─────────────────────────────────────────────────────────────── */
const PH_MED = { impacto: 'Pico medido', vmb: 'aren medida', vci: 'Valor medido', calor: 'IBUTG médio' };
function linhaGrupo(a) {
  const g = grupoDe(a);
  const nome = { quimico: 'Agente químico', fisico: 'Agente físico', biologico: 'Agente biológico', periculosidade: 'Periculosidade' }[g];
  const ref = g === 'periculosidade' ? `NR-16 Anexo ${a.nr16?.anexo || ''}` : a.nr15?.anexo ? `NR-15 Anexo ${a.nr15.anexo}` : '';
  return `<b>${nome}</b>${ref ? ` <span>${esc(ref)}</span>` : ''}${a.linach ? ' <span class="lmx-can">Cancerígeno</span>' : ''}`;
}
function entradaHtml(a, ctx) {
  const un = unidades(a);
  if (!un.length) return '';
  if (ehRuido(a)) {
    const L = numBr(ctx.valor), N = numBr(ctx.valor2);
    return `<div class="lmx-ent">
      <label class="lmx-campo"><span class="lmx-lbl">Lavg da jornada <small>NR-15, q = 5, insalubridade</small></span>
        <span class="lmx-inp"><input type="text" inputmode="decimal" data-cp="lm.med" value="${esc(ctx.valor || '')}" placeholder="0" aria-label="Lavg em dB(A)"><span class="u">dB(A)</span><span class="d" data-lm-dose="1">${L != null ? `dose ${doseQ(L, 5)}%` : ''}</span></span></label>
      <label class="lmx-campo"><span class="lmx-lbl">NEN <small>NHO-01, q = 3, aposentadoria</small></span>
        <span class="lmx-inp"><input type="text" inputmode="decimal" data-cp="lm.med2" value="${esc(ctx.valor2 || '')}" placeholder="0" aria-label="NEN em dB(A)"><span class="u">dB(A)</span><span class="d" data-lm-dose="2">${N != null ? `dose ${doseQ(N, 3)}%` : ''}</span></span></label></div>
      <div class="lmx-nota">Jornada de 8 horas. Em outra jornada, use o NEN ou o Lavg já normalizado pelo dosímetro.</div>`;
  }
  const sel = ehCalor(a)
    ? `<label class="lmx-campo lmx-ativ"><span class="lmx-lbl">Atividade <small>taxa metabólica, NR-15 Anexo 3 Quadro 2</small></span><select class="cp-inp" data-acao="campo:lm-un"><option value="">Escolha a atividade…</option>${
        [...new Set(a.medida.metabolica.map(r => r.grupo))].map(g => `<optgroup label="${esc(g)}">${a.medida.metabolica.filter(r => r.grupo === g).map(r => `<option value="M${r.w}" ${ctx.unidade === 'M' + r.w ? 'selected' : ''}>${esc(r.atividade)} (${r.w} W)</option>`).join('')}</optgroup>`).join('')}</select></label>`
    : '';
  const unSel = un.length > 1 && !ehCalor(a) ? `<select class="cp-inp lmx-un" data-acao="campo:lm-un" aria-label="Unidade">${un.map(u => `<option ${u === (ctx.unidade || un[0]) ? 'selected' : ''}>${esc(u)}</option>`).join('')}</select>` : '';
  return `<div class="lmx-ent">${sel}
    <label class="lmx-campo"><span class="lmx-lbl">${ehCalor(a) ? 'IBUTG médio' : a.medida ? 'Resultado' : 'Média das amostras'}</span>
      <span class="lmx-inp"><input type="text" inputmode="decimal" data-cp="lm.med" value="${esc(ctx.valor || '')}" placeholder="${esc(a.medida ? PH_MED[a.medida.tipo] || '0' : '0')}" aria-label="Resultado da medição"><span class="u">${esc(ehCalor(a) ? '°C' : un.length === 1 ? un[0] : '')}</span></span></label>${unSel}</div>`;
}
function semMedicaoHtml(a) {
  const g = grupoDe(a), n = a.nr15 || {};
  if (g === 'periculosidade') return ['Sem medição: vale a atividade e a distância', `Perigoso para quem faz a atividade${a.nr16?.areas?.length || a.nr16?.anexo === 'I' ? ' e para quem trabalha na área de risco' : ''}, com exposição permanente ou intermitente. Exposição eventual, ou por tempo extremamente reduzido, não dá direito (Súmula 364 do TST).`];
  if (n.anexo === '14') return ['Sem medição: vale a atividade', 'Insalubre pelo contato permanente com a atividade listada no Anexo 14 da NR-15 (avaliação qualitativa).'];
  if (['7', '9', '10'].includes(n.anexo)) return ['Sem limite numérico: laudo de inspeção', 'Insalubre quando há exposição sem proteção adequada, comprovada por laudo de inspeção no local (NR-15 15.1.4).'];
  if (n.anexo === '6') return ['Sem medição: vale a atividade', 'Trabalho sob ar comprimido em tubulões e túneis pressurizados e trabalho submerso (NR-15 15.1.3).'];
  if (n.anexo === '5') return ['Limites da CNEN', 'Os limites de dose estão na Norma CNEN-NN-3.01, que ainda não está no GRID. Use o laudo radiométrico.'];
  if (n.avaliacao === 'qualitativa') return ['Sem medição: vale a atividade', `Insalubre pela atividade descrita no Anexo ${n.anexo} da NR-15 (avaliação qualitativa).`];
  if (n.avaliacao === 'proibida') return ['Exposição proibida', 'Nenhum contato com o agente, por nenhuma via.'];
  if (!n.anexo) return ['Não citado na NR-15', 'Avaliar no laudo se outro anexo se aplica.'];
  return null;
}
function enquadramentoHtml(a) {
  const g = grupoDe(a), n = a.nr15 || {}, p = a.prev, i = insal(a), ap = apos(a), e = t24(a);
  const c1 = g === 'periculosidade' ? ['Periculosidade', '30%', 'do salário-base', 'sem gratificações e prêmios. Não acumula com insalubridade: o empregado escolhe.', 'amb']
    : n.grau ? ['Insalubridade', `${n.pct}%`, `grau ${n.grau}`, `do salário mínimo, ${i.s}`, 'amb'] : ['Insalubridade', i.v, '', i.s, 'txt'];
  const c2 = p.status === 'sim' ? ['Aposentadoria especial', String(p.anos), 'anos', ap.s, '']
    : p.status === 'familia' ? ['Aposentadoria especial', 'Pode ter', '', `${p.anos} anos; o Decreto cita a família do agente`, 'txt']
    : p.status === 'conferir' ? ['Aposentadoria especial', 'Conferir', '', 'caso discutível, decisão do LTCAT', 'txt'] : ['Aposentadoria especial', 'Não', '', ap.s, 'nao'];
  const c3 = ['eSocial S-2240', e.cod, '', e.cod === '09.01.001' ? 'se não houver outro agente nocivo no ambiente' : curto(e.desc, 90), 'cod'];
  const col = ([k, v, sm, s, cls]) => `<div class="lmx-v-c"><div class="k${cls === 'amb' ? ' amb' : ''}">${esc(k)}</div><div class="v ${cls}">${esc(v)}${sm ? `<small>${esc(sm)}</small>` : ''}</div><div class="s">${esc(s)}</div></div>`;
  const quando = g === 'periculosidade' ? 'pela atividade' : a.medida || limites(a).length ? 'quando passa do limite' : 'pela atividade';
  return `<div class="lmx-enq-t">Enquadramento do agente <small>${quando}</small></div><div class="lmx-ver">${col(c1)}${col(c2)}${col(c3)}</div>`;
}
const secao = (titulo, ref, corpo, aberta = false) => corpo ? `<details class="lmx-sec"${aberta ? ' open' : ''}><summary><span>${esc(titulo)}</span>${IC.chev}</summary>
  <div class="lmx-sec-b">${ref ? `<span class="lmx-ref">${esc(ref)}</span>` : ''}${corpo}</div></details>` : '';
function secoesHtml(a) {
  const g = grupoDe(a), n = a.nr15, p = a.prev, r = a.nr16, e = t24(a), out = [];
  if (r) {
    out.push(secao('Quem tem direito', `NR-16 Anexo ${r.anexo}`, `<p>${esc(r.texto)}</p>`, !n && !r.areas?.length));
    if (r.areas?.length) out.push(secao('Áreas de risco', `NR-16 Anexo ${r.anexo}, item 3`, `<div class="lmx-areas">${r.areas.map(x => `<div><span>${esc(x.atividade)}</span><b>${esc(x.area)}</b></div>`).join('')}</div>`, true));
    if (r.excecoes) out.push(secao('O que não caracteriza', `NR-16 Anexo ${r.anexo}`, `<p>${esc(r.excecoes)}</p>`));
  }
  if (n) {
    const ps = [];
    const l = limites(a);
    if (l.length) ps.push(`Limite de tolerância: <b>${l.map(([u, x]) => `${esc(x)} ${u}`).join(' ou ')}</b>, para até 48 horas por semana.`);
    else if (n.lt_texto) ps.push(`Critério: <b>${esc(n.lt_texto)}</b>.`);
    if (n.teto) ps.push('Valor teto: não pode ser passado em nenhum momento da jornada.');
    if (n.pele) ps.push('Absorção também pela pele: luvas e proteção do corpo, além da respiratória.');
    if (n.obs) ps.push(esc(n.obs));
    if (a.medida?.explica) ps.push(esc(a.medida.explica));
    if (n.grau) ps.push('O adicional é sobre o salário mínimo, e só vale o maior grau quando há mais de um agente (NR-15 15.2 e 15.3).');
    out.push(secao(a.medida || l.length ? 'Como medir e caracterizar' : 'Como caracterizar', n.anexo ? `NR-15 Anexo ${n.anexo}` : '', ps.map(x => `<p>${x}</p>`).join(''), !r && !!(a.medida || l.length)));
  }
  const ap = [];
  if (p.iv) ap.push(`Decreto 3.048, Anexo IV, <b>${esc(p.iv)}</b>${p.iv_nome ? ', ' + esc(p.iv_nome) : ''}${p.anos ? `, ${p.anos} anos` : ''}.`);
  if (p.nota) ap.push(esc(p.nota));
  if (a.linach && p.status !== 'nao') ap.push('Cancerígeno da LINACH (Grupo 1): desde 08/10/2014 vale a presença do agente, sem medição; desde 01/07/2020, medidas de controle que eliminem a nocividade descaracterizam (IN 128 art. 298).');
  out.push(secao('Aposentadoria especial', p.iv ? `Decreto 3.048 Anexo IV ${p.iv}` : 'Decreto 3.048 Anexo IV', ap.map(x => `<p>${x}</p>`).join('')));
  out.push(secao('eSocial', 'Tabela 24', `<p><b>${esc(e.cod)}</b>, ${esc(e.desc)}.${e.cod === '09.01.001' ? ' Use só se não houver outro agente nocivo no ambiente.' : ''}</p>`));
  return out.join('');
}
export function fichaHtml(a, { ctx = {}, compacta = false, acoes = '' } = {}) {
  if (!a) return '';
  const sm = semMedicaoHtml(a);
  const at = a.atencoes?.length ? `<div class="lmx-at"><b>Atenção</b><ul>${a.atencoes.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
  const vt = (VER_TAMBEM[a.id] || []).map(porId).filter(Boolean);
  const med = !compacta && unidades(a).length ? `<div class="lmx-med">${entradaHtml(a, ctx)}<div data-lm-res>${resultadoHtml(a, ctx)}</div></div>` : '';
  return `<article class="lmx-ficha${compacta ? ' compacta' : ''}">
    <header class="lmx-cab"><div class="lmx-cab-t"><div class="lmx-grupo">${linhaGrupo(a)}</div><h2 class="lmx-nome">${esc(a.nome)}</h2>
      ${a.sinonimos?.length ? `<div class="lmx-sin">Também: ${esc(a.sinonimos.slice(0, 5).join(', '))}${a.cas ? `. CAS ${esc(a.cas)}` : ''}</div>` : a.cas ? `<div class="lmx-sin">CAS ${esc(a.cas)}</div>` : ''}</div>
      ${acoes ? `<div class="lmx-acoes">${acoes}</div>` : ''}</header>
    ${med}
    ${sm ? `<div class="lmx-sem"><b>${esc(sm[0])}</b>${esc(sm[1])}</div>` : ''}
    ${compacta ? '' : at}
    ${enquadramentoHtml(a)}
    ${compacta ? '' : `<div class="lmx-secs">${secoesHtml(a)}</div>`}
    ${!compacta && vt.length ? `<div class="lmx-vt">Veja também: ${vt.map(x => `<button type="button" class="lmx-lnk" data-acao="campo:lm-ver:${esc(x.id)}">${esc(x.nome)}</button>`).join(' ')}</div>` : ''}
    <footer class="lmx-rod">Indicação para orientar o técnico. Não substitui o laudo (CLT art. 195) nem o LTCAT (Lei 8.213/1991 art. 58). Base do Laudomiro de ${esc(VERSAO.split('-').reverse().join('/'))}.</footer>
  </article>`;
}

/* ── Textos para copiar: laudo, LTCAT/PPP e PGR ─────────────────────────── */
export function textos(a, ctx = {}) {
  const av = avaliar(a, ctx), n = a.nr15, p = a.prev, e = t24(a), i = insal(a);
  const res = av ? `Resultado: ${av.sub}. ${av.titulo}.` : '';
  const ins = a.nr16 && !n ? `Periculosidade: NR-16 Anexo ${a.nr16.anexo}, adicional de 30% sobre o salário-base, para exposição permanente ou intermitente. Caracterização por laudo (NR-16 16.3).`
    : `Insalubridade: NR-15${n?.anexo ? ' Anexo ' + n.anexo : ''}${n?.lt_texto ? `, critério ${n.lt_texto}` : ''}. ${av ? av.linhas[0][1] : `${i.v}, ${i.s}.`}`;
  const apo = av ? av.linhas[1][1] : `${apos(a).v}${p.iv ? ` (Decreto 3.048 Anexo IV ${p.iv})` : ''}. ${p.nota || ''}`;
  return {
    laudo: [`Agente: ${a.nome}${a.cas ? ` (CAS ${a.cas})` : ''}.`, res, ins, a.nr15 && a.nr16 ? `Periculosidade: ${a.nr16.texto}` : ''].filter(Boolean).join('\n'),
    ltcat: [`Agente nocivo: ${a.nome}${a.cas ? ` (CAS ${a.cas})` : ''}.`, p.iv ? `Enquadramento: Decreto 3.048, Anexo IV, ${p.iv} (${p.iv_nome || ''}), ${p.anos} anos.` : 'Enquadramento: não consta no Anexo IV do Decreto 3.048.',
      res, `Conclusão: ${apo}`, `eSocial S-2240, Tabela 24: ${e.cod}, ${e.desc}.`].filter(Boolean).join('\n'),
    pgr: [`Perigo: ${a.nome}.`, res || `Avaliação: ${n?.lt_texto ? 'comparar com ' + n.lt_texto : 'qualitativa'}.`, `Medidas: ${av ? av.linhas[2][1] : linhaPgr(a, 'acao')}`].filter(Boolean).join('\n')
  };
}
/* Texto curto (compatível com a v232). */
export function resumoTexto(a) { return textos(a).laudo + '\nIndicação do GRID (Laudomiro); não substitui laudo nem LTCAT.'; }
/* v232: usado pela lista antiga e por quem importava. */
export function respostasHtml(a) { return enquadramentoHtml(a); }

/* ── Sugestão para o risco da avaliação (só quando o técnico toca em Aplicar) ── */
export function sugestao(a, med = {}) {
  const g = grupoDe(a), n = a.nr15 || {}, p = a.prev, out = {}, porque = [];
  let acima = null;
  if (g === 'periculosidade') { out.per = 'S'; porque.push('periculosidade pela atividade (NR-16)'); }
  else if (n.avaliacao === 'qualitativa' && n.grau && !['7', '9', '10'].includes(n.anexo)) acima = true;   // 7, 9 e 10 dependem do laudo de inspeção
  else if (med?.situacao) acima = med.situacao === 'acima';
  else if (med?.resultado) { const c = comparar(a, med.resultado, med.unidade || ''); if (c) acima = c.nivel === 'acima'; }
  if (g !== 'periculosidade') {
    if (acima === true && n.grau) { out.ins = 'S'; out.grau = `${n.pct}%`; porque.push(`insalubridade grau ${n.grau}`); }
    else if (acima === false) { out.ins = 'N'; porque.push('abaixo do limite'); }
  }
  if (p.status === 'sim' && (acima === true || (a.linach && acima !== false))) { out.ae = 'S'; porque.push(`aposentadoria ${p.anos} anos`); }
  else if (p.status === 'nao' || acima === false) out.ae = 'N';
  return { valores: out, porque, falta: acima == null && g !== 'periculosidade' ? 'Registre a medição (acima ou abaixo do limite) para o Laudomiro concluir a insalubridade.' : '' };
}

/* Faixa curta dentro da Conclusão do risco (ghe.js). */
export function dicaRiscoHtml(a, med, { aplicar = false } = {}) {
  const i = insal(a), p = apos(a), e = t24(a);
  const c = med?.resultado && unidades(a).length && !ehCalor(a) && !ehRuido(a) ? comparar(a, med.resultado, unidades(a).find(u => norm(u) === norm(med.unidade)) || '') : null;
  const cmp = c && (!med.unidade || unidades(a).some(u => norm(u) === norm(med.unidade))) ? `<div class="lm-dica-m ${c.nivel}">Medição de hoje: ${esc(c.txt)}</div>` : '';
  return `<div class="lm-dica"><div class="lm-dica-t"><span class="lm-dica-ic">L</span>Laudomiro · ${esc(a.nome)}</div>
    <div class="lm-dica-g"><span>${grupoDe(a) === 'periculosidade' ? 'Periculosidade' : 'Insalubridade'}</span><b class="ins-${i.cls}">${esc(i.v)}</b><small>${esc(i.s)}</small>
      <span>Aposentadoria</span><b class="ae-${p.cls}">${esc(p.v)}</b><small>${esc(p.s)}</small>
      <span>eSocial</span><b>${esc(e.cod)}</b><small>${esc(curto(e.desc, 48))}</small></div>${cmp}
    <div class="lm-dica-a">${aplicar ? `<button type="button" class="btn btn-sm lmx-btn-am" data-acao="campo:lm-aplicar:${esc(a.id)}">${IC.ok} Aplicar ao risco</button>` : ''}
    <button type="button" class="cp-link" data-acao="campo:lm-ficha:${esc(a.id)}">Ver a ficha completa</button></div></div>`;
}
