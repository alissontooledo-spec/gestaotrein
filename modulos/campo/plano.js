/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/campo/plano.js — Plano de ação 5W2H para o SOC (v223)
   Monta o plano a partir da avaliação de campo e escreve os textos que o
   operador cola na tela "GRO › Plano de ação › Ação" do SOC.
   O SOC NÃO imprime Prioridade, Situação nem Data de Conclusão no documento:
   por isso esses dados vão escritos dentro do "Por quê?" e do "Como?".
   Regras técnicas (engenheiro de segurança, 29/09/2026 —
   05-Decisoes/2026-09-29-plano-de-acao-5w2h-v223.md):
     • nasce ação: risco Moderado, Alto ou Crítico; risco Baixo (ação de
       manter ou realizar); medição acima do limite; EPI "não" ou "sim, não
       suficiente"; treinamentos (1 ação por GHE, ou 1 "Toda Empresa").
     • verbo pela NR-01 1.5.5.2.1 (introduzir, aprimorar ou manter): a empresa
       não tem a medida → Implantar/Realizar; tem mas não basta → Melhorar;
       tem e funciona → Manter e inspecionar.
     • prioridade pelo nível da matriz; prazo pela prioridade (2, 60, 120 e
       365 dias — configurável na Matriz de risco da organização).
     • ação Alta sempre com medida provisória já.
   Módulo sem dependências (roda no navegador e nos testes em node).
   ══════════════════════════════════════════════════════════════════════════ */

export const LIMITE = { o_que: 100, texto: 2500, resultado: 500, quem: 300 };
export const PRIORIDADES = [['imediata', 'Imediata'], ['alta', 'Alta'], ['media', 'Média'], ['baixa', 'Baixa']];
export const NOME_PRIO = Object.fromEntries(PRIORIDADES);
const ORDEM = { imediata: 0, alta: 1, media: 2, baixa: 3 };
export const PADRAO_NIVEL = {
  critico: { prioridade: 'imediata', prazo_dias: 2 }, alto: { prioridade: 'alta', prazo_dias: 60 },
  moderado: { prioridade: 'media', prazo_dias: 120 }, baixo: { prioridade: 'baixa', prazo_dias: 365 },
  irrelevante: { prioridade: null, prazo_dias: null }
};
export const PRAZO_PADRAO = { imediata: 2, alta: 60, media: 120, baixa: 365 };
/* Listas da tela do SOC (lidas em 29/09 na empresa de teste; Categoria é editável no SOC de cada cliente). */
export const CATEGORIAS_SOC = ['Implementação', 'Inspeção', 'Manutenção', 'Monitoria', 'CIPA'];
export const RELATORIOS_SOC = ['PGR', 'AEP', 'PPR'];
export const SITUACOES = [['pendente', 'Pendente'], ['em_andamento', 'Em Andamento'], ['concluida', 'Concluída'], ['cancelada', 'Cancelada']];
export const NOME_SIT = Object.fromEntries(SITUACOES);

/* Base legal padrão por risco (código do catálogo). O catálogo pode trocar
   em dados.base_legal. Nada de item "parecido": quando não há norma
   específica segura, fica só a NR-01 (regra do engenheiro). */
export const BASE_LEGAL_RISCO = {
  '460': 'NR-09; NR-15, Anexo 1; NHO 01 (Fundacentro)', '461': 'NR-09; NR-15, Anexo 2',
  '462': 'NR-09, Anexo 3; NR-15, Anexo 3', '463': 'NR-15, Anexo 5', '465': 'NR-15, Anexo 7', '544': 'NR-21',
  '466': 'NR-09, Anexo 1; NR-15, Anexo 8', '1001': 'NR-09, Anexo 1; NR-15, Anexo 8', '534': 'NR-09, Anexo 1; NR-15, Anexo 8',
  '467': 'NR-15, Anexo 9', '468': 'NR-15, Anexo 10',
  '553': 'NR-12', '540': 'NR-35', '562': 'NR-33', '1053': 'NR-11', '1022': 'NR-11', '554': 'NR-11',
  '1057': 'NR-32', '1079': 'NR-26', '1020': 'NR-08', '1010': 'NR-08', '1002': 'NR-08',
  '541': 'NR-10; NR-16, Anexo 4', '542': 'NR-20; NR-16, Anexo 2', '549': 'NR-19; NR-16, Anexo 1',
  '550': 'NR-16, Anexo 5', '563': 'NR-16, Anexo 3', '1052': 'NR-16',
  '537': 'NR-17; NHO 11 (Fundacentro)',
  '434': 'NR-09; NR-15, Anexo 13-A', '819': 'NR-09; NR-15, Anexo 13', '1012': 'NR-09; NR-15, Anexo 13',
  '1013': 'NR-09; NR-15, Anexo 13', '1014': 'NR-09; NR-15, Anexo 13', '1011': 'NR-09; NR-15, Anexo 13',
  '1073': 'NR-09; NR-15, Anexo 12',
  '1077': 'NR-32; NR-15, Anexo 14', '1058': 'NR-32; NR-15, Anexo 14', '1076': 'NR-32; NR-15, Anexo 14',
  '1061': 'NR-15, Anexo 14', '469': 'NR-15, Anexo 14', '1065': 'NR-15, Anexo 14', '1066': 'NR-15, Anexo 14',
  '1080': 'NR-15, Anexo 14', '10867': 'NR-15, Anexo 14'
};
const BASE_CATEGORIA = { ergonomico: 'NR-17', quimico: 'NR-09; NR-15 (anexo do agente)', fisico: 'NR-09', biologico: 'NR-15, Anexo 14' };
/* Limites já conhecidos (os mesmos da tela de medição). */
const REF_MED = {
  '460': { un: 'dB(A)', lim: 85 }, '461': { un: 'dB(C)', lim: 120 }, '466': { un: 'm/s²', lim: 1.1 },
  '1001': { un: 'm/s¹,⁷⁵', lim: 21 }, '534': { un: 'm/s²', lim: 5 }
};
/* Treinamento sugerido pelo risco (o mesmo mapa da tela do GHE). */
const TREIN_DO_RISCO = { '540': 'NR-35', '562': 'NR-33', '541': 'NR-10', '1053': 'NR-11', '1022': 'NR-11',
  '553': 'NR-12', '434': 'NR-20', '542': 'NR-20', '1057': 'NR-32', '543': 'NR-26', '1079': 'NR-26', '819': 'NR-26',
  '1012': 'NR-26', '1013': 'NR-26', '1014': 'NR-26', '1011': 'NR-26' };

/* ── utilidades ─────────────────────────────────────────────────────────── */
const vazio = (t) => !String(t ?? '').trim() || /^(na|n\/a|-|não se aplica|nao se aplica|nada a acrescentar\.?)$/i.test(String(t).trim());
const util = (t) => !vazio(t);
export const norm = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const cortar = (t, n) => { const s = String(t ?? '').replace(/\s+/g, ' ').trim(); return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '').replace(/(\s+(de|do|da|dos|das|com|em|e|para|por|a|o|no|na))+$/i, '') + '…'; };
const frase = (t) => { const s = String(t ?? '').trim(); return !s ? '' : /[.!?…:]$/.test(s) ? s : s + '.'; };
const minus = (t) => String(t ?? '').trim();
/* "RUÍDO CONTÍNUO" / "Ruído Contínuo" → "ruído contínuo" (siglas e NR12 ficam). */
const SIGLAS = /^(NR-?\d*|EPI|EPC|CA|PNOS|AREN|VDVR|GLP|NHO|SEP|LTCAT|PGR|PCMSO|AEP|AET)$/i;
export const nomeFrase = (t) => String(t ?? '').replace(/\s+/g, ' ').trim().split(' ')
  .map(w => /\d/.test(w) || SIGLAS.test(w.replace(/[^\wÀ-ú-]/g, '')) ? w.toUpperCase() : w.toLowerCase()).join(' ');
export const numTxt = (v) => { const m = String(v ?? '').replace(/\s/g, '').match(/-?\d+(?:[.,]\d+)?/); return m ? Number(m[0].replace(',', '.')) : null; };
const fmtNum = (n) => n == null ? '' : String(Math.round(n * 100) / 100).replace('.', ',');
export function dataBr(iso) { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; }
export function hojeIso() { const h = new Date(); return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`; }
export function somarDias(iso, dias) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); if (!m || dias == null) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + Number(dias)));
  return d.toISOString().slice(0, 10);
}
/* Quanto?: guardado como "4800.00"; na tela e no SOC, "4.800,00". */
export function fmtQuanto(v) {
  if (v == null || v === '') return '';
  const n = Number(v); if (!isFinite(n)) return '';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function lerQuanto(txt) {
  let s = String(txt ?? '').replace(/[R$\s]/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(s)) return undefined;   // inválido
  return Number(s).toFixed(2);
}
const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;
const maiorPrio = (a, b) => (!a ? b : !b ? a : ORDEM[a] <= ORDEM[b] ? a : b);

/* Prioridade e prazo do nível, pela matriz da organização (ou o padrão). */
export function regrasDoNivel(matriz, codigo) {
  const n = (matriz?.niveis || []).find(x => x.codigo === codigo);
  const pad = PADRAO_NIVEL[codigo] || { prioridade: null, prazo_dias: null };
  const prioridade = n && 'prioridade' in n ? (n.prioridade || null) : pad.prioridade;
  const prazo_dias = n && n.prazo_dias != null ? Number(n.prazo_dias) : (prioridade ? pad.prazo_dias ?? PRAZO_PADRAO[prioridade] : null);
  return { prioridade, prazo_dias };
}
/* Dias de prazo de uma prioridade (o menor que a matriz usa para ela). */
export function diasDaPrioridade(matriz, prio) {
  const ds = (matriz?.niveis || []).map(n => regrasDoNivel(matriz, n.codigo)).filter(r => r.prioridade === prio && r.prazo_dias != null).map(r => r.prazo_dias);
  return ds.length ? Math.min(...ds) : PRAZO_PADRAO[prio];
}
function nivelPS(matriz, p, s) {
  const pi = Number(p), si = Number(s);
  if (!(pi >= 1 && pi <= 5 && si >= 1 && si <= 5) || !Array.isArray(matriz?.grade)) return null;
  const cod = matriz.grade[pi - 1]?.[si - 1];
  return (matriz.niveis || []).find(n => n.codigo === cod) || null;
}

/* ── contexto da avaliação ──────────────────────────────────────────────── */
/* d = documento da avaliação ({av, ghes}); cat = catálogo; extra = {tecnico}. */
export function contexto(d, cat, { tecnico = '' } = {}) {
  const soc = d.av?.soc || {};
  const unidades = new Map((soc.unidades || []).map(u => [String(u.codigo), u.nome]));
  const socGhe = (g) => (soc.ghes || []).find(x => g.codigo_soc && (String(x.codigo) === String(g.codigo_soc) || x.nome === g.codigo_soc)) || null;
  return {
    data: d.av?.data_visita || hojeIso(),
    revisao: d.av?.revisao || 1,
    numeroAv: d.av?.numero || '',
    tecnico,
    matriz: cat?.matriz,
    quemPadrao: [d.av?.acompanhante_nome, d.av?.acompanhante_cargo].filter(util).join(' (') + (util(d.av?.acompanhante_cargo) && util(d.av?.acompanhante_nome) ? ')' : ''),
    risco: (cod) => (cat?.risco ? cat.risco(cod) : null),
    treinamento: (cod) => (cat?.treinamento ? cat.treinamento(cod) : null),
    pessoas: (g) => socGhe(g)?.total_funcionarios || 0,
    unidade: (g) => {
      const sg = socGhe(g); if (!sg) return '';
      const cods = [...new Set((sg.hierarquias || []).map(h => String(h.unidade)).filter(Boolean))];
      return cods.map(c => `${(unidades.get(c) || 'Unidade').toUpperCase()} # ${c}`).join(', ');
    }
  };
}

const ehPsico = (r) => /psicossoc/.test(norm(r?.nome || '').replace(/-/g, ' '));
const semEpi = (r) => vazio(r.epi);
const ehErgo = (r) => r.categoria === 'ergonomico';
function medicaoDe(r) {
  const med = r.medicao || {}; const ref = REF_MED[String(r.codigo || '')] || null;
  const res = numTxt(med.resultado);
  const lim = numTxt(med.limite) ?? ref?.lim ?? null;
  const un = med.unidade || ref?.un || r.soc?.medicao?.unidade || '';
  const refTxt = String(med.limite || '').includes('·') ? String(med.limite).split('·').slice(1).join('·').trim() : '';
  const acima = med.situacao === 'acima' || (res != null && lim != null && med.situacao !== 'abaixo' && res > lim);
  return { res, lim, un, acima, temQuant: res != null || !!ref || util(med.limite), refTxt, resTxt: util(med.resultado) ? String(med.resultado).trim() : '' };
}

/* ── sugestões: uma ação por risco que pede ação + treinamentos ─────────── */
export function sugerir(d, ctx) {
  const itens = [], semNivel = [];
  const porGhe = new Map();
  (d.ghes || []).forEach((g, gi) => {
    const doGhe = [];
    (g.riscos || []).forEach((r, ri) => {
      if (!r || r.codigo === '1068' || ehPsico(r)) return;
      const nv = r.nivel?.codigo ? ((ctx.matriz?.niveis || []).find(n => n.codigo === r.nivel.codigo) || r.nivel) : nivelPS(ctx.matriz, r.probabilidade, r.severidade);
      if (!nv) { semNivel.push({ ghe: g.nome, risco: r.nome }); return; }
      const it = itemRisco(g, gi, r, ri, nv, ctx);
      if (it) { itens.push(it); doGhe.push({ r, it }); }
    });
    porGhe.set(g, doGhe);
  });
  itens.push(...itensTreinamento(d, ctx, porGhe));
  return { itens, semNivel };
}

function itemRisco(g, gi, r, ri, nv, ctx) {
  const regra = regrasDoNivel(ctx.matriz, nv.codigo);
  const med = medicaoDe(r);
  const epiRuim = ['N', 'SNS'].includes(r.epi_eficaz) && !semEpi(r);
  let prio = regra.prioridade;
  if (med.acima) prio = maiorPrio(prio, 'alta');
  if (epiRuim) prio = maiorPrio(prio, 'media');
  if (!prio) return null;                      // Irrelevante, sem medição acima nem EPI ruim
  const temEpc = util(r.epc), temEpi = !semEpi(r), temAdm = util(r.medidas_adm);
  const existe = temEpc || temEpi || temAdm;
  const grave = ['alto', 'critico'].includes(nv.codigo);
  let verbo;
  if (nv.codigo === 'critico') verbo = 'corrigir';
  else if (!existe) verbo = nv.codigo === 'baixo' || nv.codigo === 'irrelevante' ? 'realizar' : 'implantar';
  else if (epiRuim || med.acima || grave || nv.codigo === 'moderado') verbo = 'melhorar';
  else verbo = 'manter';

  const rc = nomeFrase(String(r.nome || '').split('(')[0].trim() || r.nome);
  const [pre, pos] = {
    corrigir: ['Corrigir ', ' antes de continuar a atividade'],
    implantar: ['Implantar controle de ', ''],
    realizar: ['Realizar o controle de ', ''],
    melhorar: med.acima ? ['Reduzir a exposição a ', ''] : ['Melhorar o controle de ', ''],
    manter: ['Manter e inspecionar o controle de ', '']
  }[verbo];
  const oq = pre + cortar(rc, Math.max(20, 90 - pre.length - pos.length)) + pos;

  // MOTIVO
  const m = [];
  if (med.resTxt) m.push(`Na avaliação de campo de ${dataBr(ctx.data)}, a medição deu ${med.resTxt}${med.un ? ' ' + med.un : ''}${med.lim != null ? `, ${med.acima ? 'acima' : 'abaixo'} do limite de tolerância de ${fmtNum(med.lim)}${med.un ? ' ' + med.un : ''}` : ''}.`);
  if (epiRuim) m.push(`O EPI em uso (${cortar(r.epi, 80)}) ${r.epi_eficaz === 'N' ? 'não é eficaz' : 'não é suficiente'} para este risco.`);
  if (!existe && nv.codigo !== 'baixo') m.push('Não há medida de controle registrada para este risco.');
  if (util(r.analise)) m.push(`Como a exposição acontece: ${frase(cortar(r.analise, 400))}`);
  if (!m.length) m.push(`Na avaliação de campo de ${dataBr(ctx.data)}, o risco foi classificado como ${nv.nome} pela matriz de risco.`);

  // META
  const meta = verbo === 'corrigir' ? 'eliminar ou reduzir o risco antes de retomar a atividade e reavaliar depois da correção.'
    : med.acima && med.lim != null ? `deixar a exposição abaixo do limite de tolerância (${fmtNum(med.lim)}${med.un ? ' ' + med.un : ''}) e o risco no nível Baixo ou menor pela matriz.`
    : verbo === 'manter' ? 'manter as medidas atuais funcionando e o risco no nível Baixo ou menor.'
    : verbo === 'realizar' ? 'ter a medida de controle implantada e registrada, com o risco no nível Baixo ou menor.'
    : 'reduzir o risco para o nível Baixo ou menor pela matriz de risco.';

  // MEDIDAS (ordem da NR-01, item 1.4.1, alínea g)
  const md = [];
  if (verbo === 'corrigir') md.push('Imediato: parar a atividade exposta até a correção (a matriz não permite continuar com risco Crítico).');
  if (temAdm) String(r.medidas_adm).split(/\n+/).map(t => t.replace(/^\s*[-•*\d.)]+\s*/, '').trim()).filter(Boolean).slice(0, 4)
    .forEach(t => md.push(`Recomendação do técnico: ${frase(cortar(t, 300))}`));
  if (ehErgo(r)) {
    if (verbo !== 'manter') md.push('Posto e organização do trabalho: adequar conforme a NR-17 (pausas, rodízio, mobiliário e ferramentas), com base na AEP.');
    else md.push('Posto e organização do trabalho: manter as adequações atuais e inspecionar.');
  } else if (temEpc) {
    md.push(verbo === 'manter' ? `Proteção coletiva: manter e inspecionar ${cortar(r.epc, 120)}.` : `Proteção coletiva: rever e melhorar ${cortar(r.epc, 120)}.`);
  } else if (verbo !== 'manter') {
    md.push(`Proteção coletiva: avaliar a eliminação da fonte ou a instalação de proteção coletiva para ${minus(rc)}.`);
  }
  if (nv.codigo === 'alto' || prio === 'alta') md.push('Provisória, já: medidas administrativas (rodízio, menos tempo de exposição e supervisão) até a medida definitiva ficar pronta.');
  if (temEpi) {
    md.push(epiRuim ? `EPI: trocar ou complementar ${cortar(r.epi, 100)} por EPI adequado ao risco, com CA válido, treinamento de uso e ficha de entrega (NR-06).`
      : `EPI: manter ${cortar(r.epi, 100)} com CA válido, troca periódica, treinamento de uso e ficha de entrega (NR-06).`);
  } else if (!ehErgo(r) && verbo !== 'manter' && ['fisico', 'quimico', 'biologico', 'acidente'].includes(r.categoria)) {
    md.push('EPI: avaliar a necessidade de EPI complementar enquanto as outras medidas não ficam prontas (NR-06).');
  }
  if (verbo === 'manter' && md.length === 0) md.push('Inspecionar periodicamente as medidas existentes e registrar a inspeção.');

  const acomp = acompanhamentoPadrao(prio);
  const afericao = med.temQuant && med.lim != null
    ? (verbo === 'manter' ? `nova medição de ${minus(rc)} no próximo ciclo do PGR, confirmando exposição abaixo de ${fmtNum(med.lim)}${med.un ? ' ' + med.un : ''}.`
      : `nova medição de ${minus(rc)} em até 30 dias depois da implantação. Resultado esperado: abaixo de ${fmtNum(med.lim)}${med.un ? ' ' + med.un : ''}.`)
    : ['manter', 'realizar'].includes(verbo) ? 'inspeção no local confirma que as medidas estão implantadas e funcionando.'
    : 'reavaliação do risco no local depois da implantação. Resultado esperado: nível Baixo ou menor pela matriz.';

  const c = ctx.risco?.(r.codigo);
  const baseRisco = c?.dados?.base_legal || BASE_LEGAL_RISCO[String(r.codigo || '')] || BASE_CATEGORIA[r.categoria] || '';
  const base = ['NR-01, itens 1.5.5.2.1 e 1.5.5.2.2', baseRisco, temEpi && !/NR-06/.test(baseRisco) ? 'NR-06' : ''].filter(Boolean).join('; ');
  const rel = ['PGR'];
  if (ehErgo(r)) rel.push('AEP');
  if (r.categoria === 'quimico' && /respir|pff|m[aá]scara|filtro/i.test(String(r.epi || ''))) rel.push('PPR');

  return {
    chave: `r:${norm(g.nome)}:${r.codigo ? String(r.codigo) : norm(r.nome)}`,
    origem: 'risco', ghe_id: g.id, ghe: g.nome, ghe_soc: g.codigo_soc || null, unidade: ctx.unidade?.(g) || '',
    toda_empresa: false, pessoas: ctx.pessoas?.(g) || 0, ordem: gi * 1000 + ri,
    risco: r.nome, risco_soc: r.codigo || null, categoria_risco: r.categoria || null, risco_uid: r.uid || null,
    nivel: { codigo: nv.codigo, nome: nv.nome, p: r.probabilidade ?? null, s: r.severidade ?? null, aceitabilidade: nv.aceitabilidade || null },
    fonte: util(r.fonte) ? cortar(r.fonte, 120) : '',
    prioridade: prio, verbo,
    o_que_base: cortar(oq, 90),
    motivo: m.join(' '), meta, medidas: md, acompanhamento: acomp, afericao, base_legal: base,
    categoria: verbo === 'manter' ? 'Inspeção' : 'Implementação', relatorios: rel,
    quem: ctx.quemPadrao || '', quanto: null
  };
}

export function acompanhamentoPadrao(prio) {
  return {
    imediata: 'verificação no local antes de a atividade voltar, com registro (foto ou relatório).',
    alta: 'o responsável informa o andamento a cada 15 dias; inspeção no local na próxima visita técnica.',
    media: 'o responsável informa o andamento a cada 30 dias; inspeção no local na próxima visita técnica.',
    baixa: 'inspeção das medidas na próxima visita técnica ou no próximo ciclo do PGR.'
  }[prio] || '';
}

function nrDe(t) {
  const s = String(t?.categoria || t?.nr || t?.nome || '').match(/NR\s?-?\s?(\d{1,2})/i);
  return s ? `NR-${s[1].padStart(2, '0')}` : '';
}
const nomeTrein = (t, cod) => String(t?.nome || cod || '').replace(/^NR\s?\d+\s*-\s*/i, '').trim();

function itensTreinamento(d, ctx, porGhe) {
  const ghes = (d.ghes || []).filter(g => (g.treinamentos || []).length);
  if (!ghes.length) return [];
  const todosGhes = d.ghes || [];
  const emTodos = todosGhes.length > 1 ? (todosGhes[0].treinamentos || []).filter(c => todosGhes.every(g => (g.treinamentos || []).includes(c))) : [];
  const motivoTrein = (g, cod) => {
    const t = ctx.treinamento?.(cod); const nr = nrDe(t);
    const rs = (porGhe.get(g) || []);
    if (nr === 'NR-01') return { txt: 'obrigatório para todos os trabalhadores (NR-01, item 1.7)', prio: 'media' };
    const ligados = rs.filter(({ r }) => TREIN_DO_RISCO[String(r.codigo || '')] === nr || (nr === 'NR-06' && !semEpi(r)));
    if (!ligados.length) return { txt: 'indicado pelo técnico na avaliação', prio: 'media' };
    let prio = null; for (const { it } of ligados) prio = maiorPrio(prio, it.prioridade);
    return { txt: 'por causa de ' + ligados.slice(0, 3).map(({ r }) => `${cortar(String(r.nome).split('(')[0], 50)}${r.codigo ? ' (' + r.codigo + ')' : ''}`).join(', '), prio: prio || 'media' };
  };
  const montar = (chave, gheAlvo, codigos, gi) => {
    const lista = codigos.map(cod => {
      const t = ctx.treinamento?.(cod);
      const mot = gheAlvo ? motivoTrein(gheAlvo, cod) : { txt: 'vale para todos os GHEs', prio: 'media' };
      if (!gheAlvo) for (const g of todosGhes) { const mm = motivoTrein(g, cod); mot.prio = maiorPrio(mot.prio, mm.prio); if (mm.txt.startsWith('obrigatório')) mot.txt = mm.txt; }
      return { codigo: cod, nr: nrDe(t), nome: nomeTrein(t, cod), motivo: mot.txt, prio: mot.prio };
    }).sort((a, b) => (parseInt(a.nr.slice(3)) || 99) - (parseInt(b.nr.slice(3)) || 99));
    let prio = null; for (const x of lista) prio = maiorPrio(prio, x.prio);
    const nrs = [...new Set(lista.map(x => x.nr).filter(Boolean))];
    const pessoas = gheAlvo ? (ctx.pessoas?.(gheAlvo) || 0) : todosGhes.reduce((s, g) => s + (ctx.pessoas?.(g) || 0), 0);
    return {
      chave, origem: 'treinamento', ghe_id: gheAlvo?.id || null, ghe: gheAlvo ? gheAlvo.nome : 'Toda a empresa', ghe_soc: gheAlvo?.codigo_soc || null,
      unidade: gheAlvo ? (ctx.unidade?.(gheAlvo) || '') : '', toda_empresa: !gheAlvo, pessoas, ordem: 900000 + gi,
      risco: null, risco_soc: null, categoria_risco: null, nivel: null,
      prioridade: prio || 'media', verbo: 'treinar',
      o_que_base: cortar((gheAlvo ? `Treinar a equipe do GHE ${gheAlvo.nome}` : 'Treinar todos os trabalhadores') + (nrs.length ? ': ' + nrs.join(', ') : ''), 90),
      trein: lista.map(({ prio: _p, ...x }) => x),
      motivo: `Treinamentos indicados na avaliação de campo de ${dataBr(ctx.data)}:\n` + lista.map(x => `- ${x.nr ? x.nr + ' ' : ''}${x.nome} (${x.motivo})`).join('\n'),
      meta: `${pessoas ? `todos os ${plural(pessoas, 'trabalhador', 'trabalhadores')}` : 'todos os trabalhadores'} ${gheAlvo ? 'do GHE' : 'da empresa'} treinados no prazo, com lista de presença, conteúdo programático e certificado.`,
      medidas: ['Realizar cada treinamento com instrutor qualificado, com a carga horária e o conteúdo exigidos pela NR de cada um.',
        'Treinar também quem for admitido ou mudar de função, antes de começar a atividade.',
        'Guardar lista de presença, conteúdo programático e certificados.'],
      acompanhamento: 'o responsável envia a lista de presença e os certificados ao SESMT ou à consultoria.',
      afericao: 'conferência dos certificados de todos os trabalhadores. Resultado esperado: 100% treinados dentro do prazo.',
      base_legal: ['NR-01, item 1.7', ...nrs.filter(n => n !== 'NR-01')].join('; '),
      categoria: 'Implementação', relatorios: ['PGR'], quem: ctx.quemPadrao || '', quanto: null
    };
  };
  const out = [];
  if (emTodos.length) out.push(montar('t:*', null, emTodos, 0));
  ghes.forEach((g, gi) => {
    const resto = (g.treinamentos || []).filter(c => !emTodos.includes(c));
    if (resto.length) out.push(montar(`t:${norm(g.nome)}`, g, resto, gi + 1));
  });
  return out;
}

/* ── textos para o SOC ──────────────────────────────────────────────────── */
const ACEIT = { aceitavel: 'aceitável', toleravel: 'tolerável', nao_aceitavel: 'não aceitável' };
export function linhaSituacao({ situacao = 'pendente', desde = null, prazo = null, data_conclusao = null } = {}) {
  if (situacao === 'concluida') return `SITUAÇÃO: CONCLUÍDA em ${dataBr(data_conclusao) || '__/__/____'}.`;
  if (situacao === 'cancelada') return `SITUAÇÃO: CANCELADA${desde ? ' em ' + dataBr(desde) : ''}.`;
  const pz = prazo ? ` Prazo até ${dataBr(prazo)}.` : '';
  if (situacao === 'em_andamento') return `SITUAÇÃO: EM ANDAMENTO${desde ? ' desde ' + dataBr(desde) : ''}.${pz}`;
  return `SITUAÇÃO: PENDENTE.${pz}`;
}
export function linhaConclusao({ situacao = 'pendente', data_conclusao = null, resultado = '' } = {}) {
  if (situacao === 'concluida') return `CONCLUSÃO: ${util(resultado) ? frase(String(resultado).trim().replace(/\s*\n+\s*/g, ' ')) : 'concluída em ' + dataBr(data_conclusao) + '.'}`;
  if (situacao === 'cancelada') return `CONCLUSÃO: cancelada${util(resultado) ? ' — ' + frase(String(resultado).trim()) : '.'}`;
  return 'CONCLUSÃO: ainda não concluída.';
}
/* Troca só as linhas SITUAÇÃO e CONCLUSÃO de um Como? já colado no SOC. */
export function atualizarComo(como, estado) {
  let t = String(como || '');
  const s = linhaSituacao(estado), c = linhaConclusao(estado);
  t = /^SITUAÇÃO:.*$/m.test(t) ? t.replace(/^SITUAÇÃO:.*$/m, s) : (t ? t + '\n' : '') + s;
  t = /^CONCLUSÃO:.*$/m.test(t) ? t.replace(/^CONCLUSÃO:.*$/m, c) : t + '\n' + c;
  return t;
}

/* Monta O quê?, Por quê? e Como? do item (grava no próprio item). */
export function compor(it, ctx) {
  const num = it.numero ? ` · ${it.numero}` : '';
  it.o_que = cortar(it.o_que_base || '', LIMITE.o_que - num.length) + num;
  const L = [];
  const prioTxt = (NOME_PRIO[it.prioridade] || '').toUpperCase();
  if (it.nivel?.nome) {
    const ac = it.nivel.codigo === 'alto' ? 'tolerável só com medidas complementares' : (ACEIT[it.nivel.aceitabilidade] || '');
    const ps = it.nivel.p && it.nivel.s ? ` (probabilidade ${it.nivel.p} × severidade ${it.nivel.s})` : '';
    L.push(`PRIORIDADE: ${prioTxt}. Nível de risco pela matriz: ${it.nivel.nome}${ps}${ac ? ', ' + ac : ''}.`);
  } else L.push(`PRIORIDADE: ${prioTxt}.`);
  if (it.origem === 'risco') {
    L.push(`RISCO: ${it.risco}${it.risco_soc ? ` (SOC ${it.risco_soc})` : ''}${it.fonte ? ', fonte: ' + it.fonte : ''}, no GHE ${it.ghe}${it.pessoas ? `. ${plural(it.pessoas, 'trabalhador exposto', 'trabalhadores expostos')}` : ''}.`);
  } else if (it.ghe) {
    L.push(`ONDE: ${it.toda_empresa ? 'toda a empresa' : 'GHE ' + it.ghe}${it.pessoas ? `, ${plural(it.pessoas, 'trabalhador', 'trabalhadores')}` : ''}.`);
  }
  if (util(it.motivo)) L.push(`MOTIVO: ${String(it.motivo).trim()}`);
  if (util(it.meta)) L.push(`META: ${frase(it.meta)}`);
  if (util(it.base_legal)) L.push(`BASE LEGAL: ${frase(it.base_legal)}`);
  L.push(`ORIGEM: Avaliação de campo GRID${ctx?.numeroAv ? ' ' + ctx.numeroAv : ''} de ${dataBr(ctx?.data)}${(ctx?.revisao || 1) > 1 ? `, revisão ${ctx.revisao}` : ''}${ctx?.tecnico ? `. Técnico: ${ctx.tecnico}` : ''}.${it.numero ? ` Ação ${it.numero}.` : ''}`);
  it.por_que = L.join('\n');

  const C = [];
  const md = (it.medidas || []).map(x => String(x || '').trim()).filter(Boolean);
  if (md.length) {
    C.push(it.origem === 'risco' ? 'MEDIDAS, na ordem da NR-01 (item 1.4.1, alínea g):' : 'MEDIDAS:');
    md.forEach((x, i) => C.push(`${i + 1}) ${frase(x)}`));
  }
  C.push(linhaSituacao({ situacao: 'pendente', prazo: it.prazo }));
  if (util(it.acompanhamento)) C.push(`ACOMPANHAMENTO: ${frase(it.acompanhamento)}`);
  if (util(it.afericao)) C.push(`AFERIÇÃO DO RESULTADO: ${frase(it.afericao)}`);
  C.push(linhaConclusao({ situacao: 'pendente' }));
  it.como = C.join('\n');
  return it;
}
export const excede = (it) => ({
  o_que: (it.o_que || '').length > LIMITE.o_que,
  por_que: (it.por_que || '').length > LIMITE.texto,
  como: (it.como || '').length > LIMITE.texto
});

/* ── mesclar o plano atual com as sugestões novas ──────────────────────── */
const CAMPOS_AUTO = ['o_que_base', 'motivo', 'meta', 'medidas', 'acompanhamento', 'afericao', 'base_legal', 'prioridade',
  'categoria', 'relatorios', 'quem', 'quanto'];
const CAMPOS_FIXOS = ['origem', 'ghe_id', 'ghe', 'ghe_soc', 'unidade', 'toda_empresa', 'pessoas', 'ordem', 'risco', 'risco_soc',
  'categoria_risco', 'risco_uid', 'nivel', 'fonte', 'verbo', 'trein'];
/* JSON com chaves em ordem (para comparar planos). */
export const estavel = (v) => JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(c => [c, x[c]])) : x);
const numDe = (n) => parseInt(String(n || '').replace(/\D/g, ''), 10) || 0;
export const numeroTxt = (n) => `A-${String(n).padStart(2, '0')}`;

export function prazoPadrao(it, ctx) {
  const dias = it.nivel?.codigo && regrasDoNivel(ctx.matriz, it.nivel.codigo).prioridade === it.prioridade
    ? regrasDoNivel(ctx.matriz, it.nivel.codigo).prazo_dias
    : diasDaPrioridade(ctx.matriz, it.prioridade);
  return somarDias(ctx.data, dias ?? PRAZO_PADRAO[it.prioridade]);
}

export function mesclar(plano, sugestoes, ctx) {
  const antes = estavel(plano?.acoes || []);
  const disp = new Set((plano?.dispensadas || []).map(x => x.chave));
  const atuais = new Map((plano?.acoes || []).map(a => [a.chave, a]));
  const sug = new Map(sugestoes.filter(s => !disp.has(s.chave)).map(s => [s.chave, s]));
  let maior = Math.max(0, ...[...atuais.values()].map(a => numDe(a.numero)));
  const out = [];
  for (const a of atuais.values()) {
    const s = sug.get(a.chave);
    const ed = new Set(a.editados || []);
    if (!s) {
      if (a.origem === 'manual') out.push(a);
      else if (ed.size) out.push({ ...a, orfa: true });
      continue;   // sugestão que sumiu e ninguém mexeu: sai
    }
    const n = { ...a }; delete n.orfa;
    for (const k of CAMPOS_FIXOS) { if (k in s) n[k] = s[k]; else delete n[k]; }
    for (const k of CAMPOS_AUTO) if (!ed.has(k)) n[k] = s[k] ?? null;
    if (!ed.has('prazo')) n.prazo = prazoPadrao(n, ctx);
    out.push(n);
    sug.delete(a.chave);
  }
  const novos = [...sug.values()].sort((x, y) => ORDEM[x.prioridade] - ORDEM[y.prioridade] || x.ordem - y.ordem);
  for (const s of novos) {
    const n = { ...s, numero: numeroTxt(++maior), editados: [] };
    n.prazo = prazoPadrao(n, ctx);
    out.push(n);
  }
  for (const a of out) compor(a, ctx);
  out.sort((x, y) => numDe(x.numero) - numDe(y.numero));
  const novo = { ...(plano || {}), acoes: out };
  const mudou = estavel(out) !== antes;
  if (mudou) { delete novo.revisado_em; delete novo.revisado_por; }
  return { plano: novo, mudou };
}

/* Ação escrita à mão pelo técnico. */
export function novaManual(plano, ctx, dados = {}) {
  const maior = Math.max(0, ...(plano?.acoes || []).map(a => numDe(a.numero)));
  const it = { chave: 'm:' + (dados.uid || Math.random().toString(36).slice(2, 10)), origem: 'manual', numero: numeroTxt(maior + 1),
    ghe_id: dados.ghe_id || null, ghe: dados.ghe || '', ghe_soc: dados.ghe_soc || null, unidade: dados.unidade || '',
    toda_empresa: !dados.ghe, pessoas: dados.pessoas || 0, ordem: 999999, risco: null, risco_soc: null, nivel: null,
    prioridade: 'media', verbo: 'implantar', o_que_base: '', motivo: '', meta: '', medidas: [],
    acompanhamento: acompanhamentoPadrao('media'), afericao: '', base_legal: 'NR-01, itens 1.5.5.2.1 e 1.5.5.2.2',
    categoria: 'Implementação', relatorios: ['PGR'], quem: ctx.quemPadrao || '', quanto: null,
    editados: [...CAMPOS_AUTO, 'prazo'] };
  it.prazo = somarDias(ctx.data, diasDaPrioridade(ctx.matriz, 'media'));
  return compor(it, ctx);
}

export function contar(acoes) {
  const c = { imediata: 0, alta: 0, media: 0, baixa: 0, total: 0 };
  for (const a of acoes || []) { if (c[a.prioridade] != null) c[a.prioridade]++; c.total++; }
  return c;
}

/* Técnico mudou um campo: marca como editado (o GRID não sobrescreve mais). */
export function editar(it, campo, valor, ctx) {
  it[campo] = valor;
  const ed = new Set(it.editados || []); ed.add(campo); it.editados = [...ed];
  if (campo === 'prioridade') {
    if (!ed.has('prazo')) it.prazo = prazoPadrao(it, ctx);
    if (!ed.has('acompanhamento')) it.acompanhamento = acompanhamentoPadrao(valor);
  }
  return compor(it, ctx);
}
