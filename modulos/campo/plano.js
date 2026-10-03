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
   v228: obrigações da empresa que não dependem de risco (origem 'obrigacao'):
   SESMT (NR-04) e CIPA ou representante nomeado (NR-05), pelo enquadramento
   do CNAE + número de funcionários (enquadramento.js). A ação só nasce depois
   que o técnico responde se a empresa já tem (Sim → manter; Não → constituir;
   Não sei → verificar). Ações "manter" anuais levam recorrencia_meses = 12.
   ══════════════════════════════════════════════════════════════════════════ */

import { enquadrar, cnaeBr, normCnae, LIMITE_CIPA } from './enquadramento.js';

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
const maiusc = (t) => { const x = String(t ?? '').trim(); return x ? x[0].toUpperCase() + x.slice(1) : x; };
/* primeira letra minúscula (não mexe em sigla: "NR-17", "EPI"). */
const inicioMinusc = (t) => { const x = String(t ?? '').trim(); return /^[A-ZÀ-Ú][a-zà-ú]/.test(x) ? x[0].toLowerCase() + x.slice(1) : x; };
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
export function contexto(d, cat, { tecnico = '', cliente = null } = {}) {
  const soc = d.av?.soc || {};
  const unidades = new Map((soc.unidades || []).map(u => [String(u.codigo), u.nome]));
  const socGhe = (g) => (soc.ghes || []).find(x => g.codigo_soc && (String(x.codigo) === String(g.codigo_soc) || x.nome === g.codigo_soc)) || null;
  return {
    data: d.av?.data_visita || hojeIso(),
    revisao: d.av?.revisao || 1,
    numeroAv: d.av?.numero || '',
    tecnico,
    matriz: cat?.matriz,
    aep: ['S', 'N'].includes(d.av?.plano?.aep) ? d.av.plano.aep : null,   // v225: a empresa tem AEP (NR-17) registrada?
    enq: enquadramentoDa(d, cliente),                                      // v228: SESMT e CIPA
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
  itens.push(...itensAep(d, ctx, porGhe));
  itens.push(...itensTreinamento(d, ctx, porGhe));
  itens.push(...itensObrigacao(ctx));
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
    corrigir: ['Corrigir de imediato: ', ''],
    implantar: ['Implantar medidas de controle para ', ''],
    realizar: ['Realizar medidas de controle para ', ''],
    melhorar: med.acima ? ['Reduzir a exposição ocupacional a ', ''] : ['Aprimorar as medidas de controle para ', ''],
    manter: ['Manter e inspecionar as medidas de controle para ', '']
  }[verbo];
  const oq = pre + cortar(rc, Math.max(20, 90 - pre.length - pos.length)) + pos;

  // MOTIVO (direto: o SOC já imprime GHE e risco no Onde?)
  const m = [];
  if (med.resTxt) m.push(`Leitura de ${med.resTxt}${med.un ? ' ' + med.un : ''} em ${dataBr(ctx.data)}${med.lim != null ? `, ${med.acima ? 'acima' : 'abaixo'} do limite de tolerância de ${fmtNum(med.lim)}${med.un ? ' ' + med.un : ''}` : ''}.`);
  const expo = { P: 'permanente', I: 'intermitente', E: 'eventual' }[r.exposicao] || '';
  if (expo || util(r.analise)) m.push(`Exposição ${expo}${util(r.analise) ? (expo ? ', ' : '') + inicioMinusc(cortar(r.analise, 400)) : ''}`.replace(/\s+/g, ' ').replace(/\s*[.;,]?\s*$/, '.'));
  if (util(r.fonte)) m.push(`Fonte geradora: ${frase(inicioMinusc(cortar(r.fonte, 120)))}`);
  if (!existe) m.push('Sem medida de controle implantada.');
  if (epiRuim) m.push(`EPI em uso (${cortar(r.epi, 80)}) ${r.epi_eficaz === 'N' ? 'não eficaz' : 'insuficiente'} para o controle da exposição.`);
  if (!m.length) m.push(`Risco classificado como ${nv.nome} na avaliação de ${dataBr(ctx.data)}.`);

  // META
  const meta = verbo === 'corrigir' ? 'risco eliminado ou controlado antes da retomada da atividade.'
    : med.acima && med.lim != null ? `exposição abaixo de ${fmtNum(med.lim)}${med.un ? ' ' + med.un : ''} e risco no nível Baixo ou inferior.`
    : verbo === 'manter' ? 'medidas existentes mantidas e eficazes.'
    : verbo === 'realizar' ? 'medida de controle implantada e registrada.'
    : 'risco reduzido ao nível Baixo ou inferior.';

  // MEDIDAS (ordem da NR-01, item 1.4.1, alínea g)
  const md = [];
  if (verbo === 'corrigir') md.push('Interromper a atividade exposta até a correção (o risco Crítico não permite iniciar nem continuar o trabalho).');
  if (temAdm) String(r.medidas_adm).split(/\n+/).map(t => t.replace(/^\s*[-•*\d.)]+\s*/, '').trim()).filter(Boolean).slice(0, 4)
    .forEach(t => md.push(frase(maiusc(cortar(t, 300)))));
  const ehIlu = /ilumin/i.test(String(r.nome || '')) || String(r.codigo || '') === '537';
  if (ehErgo(r) && ehIlu) {
    md.push(verbo === 'manter' ? 'Manter a iluminação adequada à tarefa, com manutenção e limpeza periódica das luminárias.'
      : 'Adequar a iluminação do posto aos níveis mínimos da tarefa (NR-17 e NHO 11), com manutenção periódica das luminárias.');
  } else if (ehErgo(r)) {
    /* v225 (engenheiro): sem AEP registrada, as medidas saem da AEP (ação própria, NR-17 17.3.1); com AEP, dela e, se insuficiente, da AET (17.3.2). */
    if (ctx.aep === 'S') {
      if (verbo !== 'manter') md.push('Adequar o posto e a organização do trabalho conforme a AEP da empresa (pausas, rodízio de tarefas, mobiliário e ferramentas).');
      else md.push('Manter as adequações ergonômicas existentes e inspecioná-las periodicamente.');
      if (verbo === 'melhorar') md.push('Se as medidas da AEP se mostrarem insuficientes, realizar a AET (NR-17, item 17.3.2).');
    } else if (verbo !== 'manter') md.push('Após a AEP, implantar as medidas de prevenção indicadas (pausas, rodízio de tarefas, mobiliário e ferramentas).');
    else md.push('Manter as adequações ergonômicas existentes e registrá-las na AEP.');
  } else if (temEpc) {
    md.push(verbo === 'manter' ? `Manter e inspecionar a proteção coletiva: ${inicioMinusc(cortar(r.epc, 120))}.` : `Revisar e aprimorar a proteção coletiva: ${inicioMinusc(cortar(r.epc, 120))}.`);
  } else if (verbo !== 'manter') {
    md.push('Eliminar ou substituir a fonte; se inviável, implantar proteção coletiva.');
  }
  if (nv.codigo === 'alto' || prio === 'alta') md.push('Até a medida definitiva: rodízio, redução do tempo de exposição e supervisão.');
  if (temEpi) {
    md.push(epiRuim ? `Substituir ou complementar o EPI (${cortar(r.epi, 100)}) por equipamento adequado, com CA válido, treinamento e registro de entrega (NR-06).`
      : `Manter o EPI (${cortar(r.epi, 100)}) com CA válido, substituição periódica, treinamento e registro de entrega (NR-06).`);
  } else if (!ehErgo(r) && verbo !== 'manter' && ['fisico', 'quimico', 'biologico', 'acidente'].includes(r.categoria)) {
    md.push('Avaliar EPI complementar até a conclusão das demais medidas (NR-06).');
  }
  if (verbo === 'manter' && md.length === 0) md.push('Inspecionar periodicamente as medidas existentes e registrar.');

  const acomp = acompanhamentoPadrao(prio);
  const afericao = med.temQuant && med.lim != null
    ? (verbo === 'manter' ? 'nova avaliação quantitativa na próxima revisão do PGR.' : 'nova avaliação quantitativa em até 30 dias após a implantação.')
    : ['manter', 'realizar'].includes(verbo) ? 'inspeção no local confirmando a implantação e a eficácia.'
    : 'reavaliação do risco no local após a implantação.';

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
    danos: cortar(danosDe(r, { risco: ctx.risco }), 300),
    prioridade: prio, verbo,
    o_que_base: cortar(oq, 90),
    motivo: m.join(' '), meta, medidas: md, acompanhamento: acomp, afericao, base_legal: base,
    categoria: verbo === 'manter' ? 'Inspeção' : 'Implementação', relatorios: rel,
    quem: ctx.quemPadrao || '', quanto: null
  };
}

export function acompanhamentoPadrao(prio) {
  return {
    imediata: 'verificação no local antes da retomada da atividade, com registro.',
    alta: 'andamento reportado a cada 15 dias; verificação na próxima visita técnica.',
    media: 'andamento reportado a cada 30 dias; verificação na próxima visita técnica.',
    baixa: 'verificação na próxima visita técnica ou revisão do PGR.'
  }[prio] || '';
}

/* v225 (engenheiro): empresa sem AEP registrada → primeiro realizar a Avaliação Ergonômica
   Preliminar (NR-17, item 17.3.1). Uma ação por GHE com risco ergonômico no plano, ou uma só
   para toda a empresa quando todos os GHEs têm. Prioridade: a maior dos riscos ergonômicos,
   no mínimo Média e no máximo Alta (a AEP é exigência legal, mas precisa de prazo realista). */
function itensAep(d, ctx, porGhe) {
  if (ctx.aep === 'S') return [];
  const todos = d.ghes || [];
  const comErgo = todos.map((g, gi) => ({ g, gi, rs: (porGhe.get(g) || []).filter(({ r }) => ehErgo(r)) })).filter(x => x.rs.length);
  if (!comErgo.length) return [];
  const limitar = (p) => (p === 'imediata' ? 'alta' : p);
  const montar = (chave, alvo, grupos, gi) => {
    let prio = 'media';
    for (const x of grupos) for (const { it } of x.rs) prio = maiorPrio(prio, limitar(it.prioridade));
    const nomes = [...new Set(grupos.flatMap(x => x.rs.map(({ r }) => cortar(String(r.nome).split('(')[0].trim(), 60))))];
    const pessoas = grupos.reduce((s0, x) => s0 + (ctx.pessoas?.(x.g) || 0), 0);
    return {
      chave, origem: 'aep', ghe_id: alvo?.id || null, ghe: alvo ? alvo.nome : 'Toda a empresa', ghe_soc: alvo?.codigo_soc || null,
      unidade: alvo ? (ctx.unidade?.(alvo) || '') : '', toda_empresa: !alvo, pessoas, ordem: 800000 + gi,
      risco: null, risco_soc: null, categoria_risco: 'ergonomico', nivel: null,
      prioridade: prio, verbo: 'realizar',
      o_que_base: cortar(alvo ? `Realizar a Avaliação Ergonômica Preliminar (AEP) do GHE ${alvo.nome}` : 'Realizar a Avaliação Ergonômica Preliminar (AEP) da empresa', 90),
      motivo: `${ctx.aep === 'N' ? 'A empresa não possui AEP registrada.' : 'AEP não apresentada na visita.'} Riscos ergonômicos identificados: ${nomes.slice(0, 5).join('; ')}${nomes.length > 5 ? '…' : ''}.`,
      meta: 'AEP registrada, com os resultados no inventário e as medidas no plano de ação do PGR.',
      medidas: ['Realizar a AEP das situações de trabalho, por abordagem qualitativa, semiquantitativa ou quantitativa, conforme o risco (NR-17, item 17.3.1).',
        'Ouvir os trabalhadores durante a avaliação e registrar a AEP (NR-17, itens 17.3.8 e 17.3.1.2).',
        'Incluir os resultados no inventário de riscos e as medidas no plano de ação do PGR (NR-17, itens 17.3.5 e 17.3.6).',
        'Realizar a AET se a AEP indicar necessidade de avaliação aprofundada ou se as medidas se mostrarem insuficientes (NR-17, item 17.3.2).'],
      acompanhamento: acompanhamentoPadrao(prio),
      afericao: 'AEP registrada e disponível na empresa.',
      base_legal: 'NR-17, itens 17.3.1 a 17.3.6; NR-01, item 1.5.4',
      categoria: 'Implementação', relatorios: ['PGR', 'AEP'], quem: ctx.quemPadrao || '', quanto: null
    };
  };
  if (todos.length > 1 && comErgo.length === todos.length) return [montar('aep:*', null, comErgo, 0)];
  return comErgo.map(x => montar(`aep:${norm(x.g.nome)}`, x.g, [x], x.gi + 1));
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
    if (!ligados.length) return { txt: 'indicado na avaliação de riscos', prio: 'media' };
    let prio = null; for (const { it } of ligados) prio = maiorPrio(prio, it.prioridade);
    return { txt: 'em razão do risco ' + ligados.slice(0, 3).map(({ r }) => cortar(String(r.nome).split('(')[0].trim(), 50)).join(', '), prio: prio || 'media' };
  };
  const montar = (chave, gheAlvo, codigos, gi) => {
    const lista = codigos.map(cod => {
      const t = ctx.treinamento?.(cod);
      const mot = gheAlvo ? motivoTrein(gheAlvo, cod) : { txt: 'aplicável a todos os GHEs', prio: 'media' };
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
      o_que_base: cortar((gheAlvo ? `Capacitar os trabalhadores do GHE ${gheAlvo.nome}` : 'Capacitar todos os trabalhadores') + (nrs.length ? ': ' + nrs.join(', ') : ''), 90),
      trein: lista.map(({ prio: _p, ...x }) => x),
      motivo: `Capacitações indicadas na avaliação:\n` + lista.map(x => `- ${x.nr ? x.nr + ' · ' : ''}${x.nome}: ${x.motivo}.`).join('\n'),
      meta: `100% dos trabalhadores ${gheAlvo ? 'do GHE' : 'da empresa'} capacitados no prazo${pessoas ? ` (${plural(pessoas, 'pessoa', 'pessoas')})` : ''}.`,
      medidas: ['Realizar os treinamentos com instrutor qualificado, na carga horária e no conteúdo exigidos por cada NR.',
        'Capacitar admitidos e transferidos de função antes do início das atividades.',
        'Arquivar lista de presença, conteúdo programático e certificados.'],
      acompanhamento: 'lista de presença e certificados enviados ao SESMT ou à assessoria de SST.',
      afericao: 'conferência dos certificados.',
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

/* ══ v228: enquadramento da empresa (SESMT e CIPA) ═══════════════════════════
   Respostas do técnico em av.plano.enq (jsonb, sem coluna nova):
     terceiros 'S'|'N' · n_terceiros · preponderante (CNAE) · cnae (se o cadastro
     não tem) · empregados (se o SOC não trouxe) · sesmt|cipa|nomeado 'S'|'N'|'?'  */
export const RESP_ENQ = [['S', 'Sim'], ['N', 'Não'], ['?', 'Não sei']];

/* Efetivo da empresa: a conferência da visita (SOC − saiu + incluídos) ou o total do SOC. */
export function efetivoDa(d) {
  const soc = d?.av?.soc || null;
  const lista = d?.av?.funcionarios?.lista || [];
  const porUnidade = new Map();
  for (const h of soc?.hierarquias || []) {
    const n = Number(h.funcionarios) || 0; if (!n) continue;
    porUnidade.set(String(h.unidade), (porUnidade.get(String(h.unidade)) || 0) + n);
  }
  const nomesU = new Map((soc?.unidades || []).map(u => [String(u.codigo), u.nome]));
  const unidades = [...porUnidade.entries()].map(([c, n]) => ({ codigo: c, nome: nomesU.get(c) || `Unidade ${c}`, total: n }));
  const informado = d?.av?.plano?.enq?.empregados;
  if (informado !== undefined && informado !== null && informado !== '' && Number.isFinite(Number(informado)))
    return { total: Math.max(0, Math.trunc(Number(informado))), fonte: 'informado', unidades };
  if (lista.length) {
    const doSoc = lista.filter(p => p.origem === 'soc');
    const saiu = doSoc.filter(p => p.situacao === 'saiu').length;
    const incl = lista.filter(p => p.origem === 'empresa').length;
    return { total: doSoc.length - saiu + incl, fonte: 'conferencia', unidades, saiu, incluidos: incl };
  }
  if (soc && Number.isFinite(Number(soc.total_funcionarios)) && Number(soc.total_funcionarios) > 0)
    return { total: Number(soc.total_funcionarios), fonte: 'soc', unidades };
  return { total: null, fonte: null, unidades };
}

/* Enquadramento com o cadastro do cliente (cnae, cnaes_secundarios, opcao_mei) e as respostas da visita. */
export function enquadramentoDa(d, cliente) {
  const r = (d?.av?.plano?.enq && typeof d.av.plano.enq === 'object') ? d.av.plano.enq : {};
  /* Avaliação concluída: vale a foto do cadastro guardada no "Revisei o plano" (o cadastro pode mudar depois). */
  const foto = d?.av?.situacao === 'concluida' && r.foto && typeof r.foto === 'object' ? r.foto : null;
  const cli = foto ? { cnae: foto.cnae, cnaes_secundarios: foto.cnaes_secundarios, opcao_mei: foto.opcao_mei } : cliente;
  const cnae = normCnae(r.cnae || cli?.cnae || '') || null;
  const ef = foto && foto.empregados != null ? { ...efetivoDa(d), total: foto.empregados, fonte: foto.fonte || 'soc' } : efetivoDa(d);
  const nTer = r.terceiros === 'S' ? Math.max(0, Math.trunc(Number(r.n_terceiros) || 0)) : 0;
  const e = enquadrar({ cnae, cnaesSecundarios: Array.isArray(cli?.cnaes_secundarios) ? cli.cnaes_secundarios : [],
    preponderante: r.preponderante || null, empregados: ef.total, terceiros: nTer, mei: cli?.opcao_mei === true });
  return { ...e, cnae, cnae_do_cadastro: !!(cli?.cnae && !r.cnae), cnae_descricao: r.cnae ? '' : (cli?.cnae_descricao || ''), efetivo: ef, resp: r,
    sem_cadastro: !cliente && !foto };   // cadastro da empresa não está neste aparelho (sem internet)
}
/* Foto do que entrou no enquadramento (gravada no "Revisei o plano"). */
export function fotoEnquadramento(e, cliente) {
  return { cnae: e?.cnae || null, cnaes_secundarios: Array.isArray(cliente?.cnaes_secundarios) ? cliente.cnaes_secundarios : [],
    opcao_mei: cliente?.opcao_mei === true, empregados: e?.empregados ?? null, fonte: e?.efetivo?.fonte || null };
}

const equipeTxt = (ds) => (ds?.profissionais || []).map(p => `${p.qtd} ${p.profissional.toLowerCase()}${p.parcial ? ' (tempo parcial, mínimo de 3 horas)' : ''}${p.ou_enfermeiro ? ' (pode ser enfermeiro do trabalho em tempo parcial)' : ''}`).join('; ');
const qtdTxt = (n, s, p) => `${n} ${n === 1 ? s : p}`;

function itensObrigacao(ctx) {
  const e = ctx.enq;
  if (!e?.grau?.valor || e.empregados === null) return [];   // sem cadastro no aparelho: mesclar() mantém as que já existem
  const g = e.grau.valor;
  const r = e.resp || {};
  const out = [];
  const grauTxt = `Grau de risco ${g} (${e.grau.nome}), pela ${e.grau.origem === 'preponderante' ? 'atividade preponderante' : 'atividade principal'} CNAE ${cnaeBr(e.grau.origem === 'preponderante' ? r.preponderante : e.cnae)} (NR-04, Anexo I)`;
  const efTxt = qtdTxt(e.empregados, 'empregado', 'empregados');
  const base = (o) => ({ origem: 'obrigacao', ghe_id: null, ghe: 'Toda a empresa', ghe_soc: null, unidade: '', toda_empresa: true,
    pessoas: e.empregados || 0, risco: null, risco_soc: null, categoria_risco: null, nivel: null, relatorios: ['PGR'], quem: ctx.quemPadrao || '', quanto: null, ...o });
  const variante = (resp, porResp) => porResp[resp] || null;

  /* SESMT (NR-04) */
  if (e.sesmt.estado === 'obrigatorio' && r.sesmt) {
    const ds = e.sesmt.dimensionamento;
    const fatos = `${grauTxt} e ${qtdTxt(e.sesmt.base, 'trabalhador', 'trabalhadores')} (${efTxt}${e.terceiros ? ` e ${e.terceiros} de empresas contratadas, de forma não eventual, NR-04, item 4.5.2` : ''}): o estabelecimento precisa de SESMT, faixa de ${ds.faixa} do Anexo II.`;
    const equipe = equipeTxt(ds);
    const v = variante(r.sesmt, {
      N: { prioridade: 'alta', verbo: 'implantar', categoria: 'Implementação', o_que_base: 'Constituir o SESMT conforme o Anexo II da NR-04',
        motivo: `${fatos} A empresa informou que não tem SESMT constituído.`,
        meta: 'SESMT constituído com a equipe mínima do Anexo II e registrado no gov.br.',
        medidas: [`Contratar a equipe mínima do Anexo II: ${equipe}.`,
          'Definir a modalidade do SESMT (individual, regionalizado ou estadual) conforme os estabelecimentos da empresa (NR-04, item 4.4).',
          'Registrar o SESMT no sistema eletrônico do gov.br, com os profissionais, o grau de risco e o número de trabalhadores atendidos (NR-04, itens 4.6.1 e 4.6.1.1).',
          'Refazer o dimensionamento quando mudar o número de trabalhadores, o CNAE ou as contratadas (NR-04, itens 4.5.1 e 4.5.2).'],
        afericao: 'comprovante do registro no gov.br e contratos dos profissionais.' },
      S: { prioridade: 'baixa', verbo: 'manter', categoria: 'Inspeção', o_que_base: 'Manter o SESMT dimensionado e registrado (NR-04)',
        motivo: `${fatos} A empresa informou que o SESMT está constituído.`,
        meta: 'SESMT com a equipe mínima e o registro no gov.br atualizados.',
        medidas: [`Conferir se a equipe atende ao Anexo II: ${equipe}.`,
          'Manter atualizados no gov.br os profissionais, o grau de risco e o número de trabalhadores atendidos (NR-04, item 4.6.1.1).',
          'Refazer o dimensionamento quando mudar o número de trabalhadores, o CNAE ou as contratadas (NR-04, itens 4.5.1 e 4.5.2).'],
        afericao: 'registro do SESMT no gov.br atualizado.' },
      '?': { prioridade: 'media', verbo: 'verificar', categoria: 'Inspeção', o_que_base: 'Verificar o SESMT exigido pelo Anexo II da NR-04',
        motivo: `${fatos} A situação do SESMT não foi confirmada na visita.`,
        meta: 'situação do SESMT confirmada e, se faltar, constituído.',
        medidas: ['Confirmar se o SESMT está constituído e registrado no gov.br (NR-04, item 4.6.1).',
          `Se não estiver, contratar a equipe mínima do Anexo II: ${equipe}.`],
        afericao: 'comprovante do registro no gov.br.' }
    });
    if (v) {
      if (e.cipa.estado === 'sesmt_faz') v.medidas.push('Como o estabelecimento não se enquadra no Quadro I da NR-05, o SESMT desempenha as atribuições da CIPA (NR-05, item 5.4.13.1).');
      out.push(base({ chave: 'o:sesmt', obrig: 'sesmt', ordem: 700000, ...v, acompanhamento: acompanhamentoPadrao(v.prioridade),
        base_legal: 'NR-04, itens 4.2, 4.4, 4.5 e 4.6 e Anexos I e II', recorrencia_meses: null }));
    }
  }

  /* CIPA (NR-05, Quadro I) */
  const h = e.cipa.horas_treinamento;
  if (e.cipa.estado === 'cipa' && r.cipa) {
    const dc = e.cipa.dimensionamento;
    const fatos = `${grauTxt} e ${efTxt}: a NR-05 exige CIPA com ${qtdTxt(dc.efetivos, 'efetivo', 'efetivos')} e ${qtdTxt(dc.suplentes, 'suplente', 'suplentes')} (Quadro I, faixa de ${dc.faixa} empregados).`;
    const v = variante(r.cipa, {
      N: { prioridade: 'alta', verbo: 'implantar', o_que_base: 'Constituir a CIPA conforme o Quadro I da NR-05',
        motivo: `${fatos} A empresa informou que não tem CIPA constituída.`,
        meta: 'CIPA eleita, empossada e treinada, com calendário de reuniões.',
        medidas: [`Constituir a CIPA com o dimensionamento do Quadro I (${qtdTxt(dc.efetivos, 'efetivo', 'efetivos')} e ${qtdTxt(dc.suplentes, 'suplente', 'suplentes')}), com representantes da organização designados e representantes dos empregados eleitos (NR-05, itens 5.4.1 a 5.4.5).`,
          'Conduzir o processo eleitoral conforme o item 5.5 da NR-05 e dar posse aos eleitos.',
          `Treinar titulares e suplentes antes da posse; no primeiro mandato, em até 30 dias após a posse; carga mínima de ${h} horas (NR-05, itens 5.7.1, 5.7.1.1 e 5.7.4).`,
          'Realizar as reuniões ordinárias mensais e registrar em ata (NR-05, item 5.6.1).',
          'Guardar a documentação da CIPA por no mínimo 5 anos (NR-05, item 5.9.2).'],
        afericao: 'atas da eleição e da posse, certificados do treinamento e calendário de reuniões.', recorrencia_meses: null },
      S: { prioridade: 'baixa', verbo: 'manter', o_que_base: 'Manter a CIPA: eleição anual, treinamento e reuniões (NR-05)',
        motivo: `${fatos} A empresa informou que a CIPA está constituída. O mandato é de 1 ano (NR-05, item 5.4.6).`,
        meta: 'CIPA com mandato em dia, integrantes treinados e reuniões registradas.',
        medidas: ['Convocar a eleição do próximo mandato com no mínimo 60 dias antes do término do mandato atual (NR-05, item 5.5.1).',
          `Treinar os novos integrantes antes da posse, com carga mínima de ${h} horas (NR-05, itens 5.7.1 e 5.7.4); treinamento feito há menos de 2 anos na mesma organização pode ser aproveitado (item 5.7.3).`,
          'Manter as reuniões ordinárias mensais com ata (NR-05, item 5.6.1).',
          `Conferir o dimensionamento no Quadro I a cada eleição (hoje: ${qtdTxt(dc.efetivos, 'efetivo', 'efetivos')} e ${qtdTxt(dc.suplentes, 'suplente', 'suplentes')}).`],
        afericao: 'atas da eleição, da posse e das reuniões; certificados do treinamento.', recorrencia_meses: 12 },
      '?': { prioridade: 'media', verbo: 'verificar', o_que_base: 'Verificar a CIPA exigida pelo Quadro I da NR-05',
        motivo: `${fatos} A situação da CIPA não foi confirmada na visita.`,
        meta: 'situação da CIPA confirmada e, se faltar, constituída.',
        medidas: ['Confirmar se a CIPA está constituída, com mandato em dia e integrantes treinados (NR-05, itens 5.4.6 e 5.7).',
          'Se não estiver, constituir a CIPA conforme o Quadro I e o item 5.5 da NR-05.'],
        afericao: 'atas da eleição e da posse.', recorrencia_meses: null }
    });
    if (v) out.push(base({ chave: 'o:cipa', obrig: 'cipa', ordem: 700100, categoria: 'CIPA', ...v, acompanhamento: acompanhamentoPadrao(v.prioridade),
      base_legal: 'NR-05, itens 5.4, 5.5, 5.6, 5.7 e Quadro I; NR-04, Anexo I' }));
  }

  /* Representante nomeado (NR-05, item 5.4.13) */
  if (e.cipa.estado === 'nomeado' && r.nomeado) {
    const lim = LIMITE_CIPA[g];
    const fatos = `${grauTxt} e ${efTxt}: o estabelecimento não se enquadra no Quadro I da NR-05 (CIPA a partir de ${lim} empregados no grau ${g}). Se não for atendido por SESMT (inclusive regionalizado, estadual ou compartilhado, NR-04, item 4.4), a organização deve nomear um representante entre os empregados (NR-05, item 5.4.13); se for, o SESMT desempenha as atribuições da CIPA (item 5.4.13.1).`;
    const v = variante(r.nomeado, {
      N: { prioridade: 'alta', verbo: 'implantar', o_que_base: 'Nomear o representante da organização na NR-05',
        motivo: `${fatos} A empresa informou que não há representante nomeado.`,
        meta: 'representante nomeado, com a nomeação formalizada e o treinamento feito.',
        medidas: ['Nomear, entre os empregados, o representante da organização para auxiliar nas ações de prevenção em segurança e saúde no trabalho, e formalizar a nomeação e a forma de atuação (NR-05, itens 5.4.13 e 5.4.14).',
          `Treinar o representante antes de assumir, com carga mínima de ${h} horas; pode ser a distância ou semipresencial (NR-05, itens 5.7.1, 5.7.4 e 5.7.4.3).`,
          'Renovar a formalização da nomeação a cada ano (NR-05, item 5.4.14).'],
        afericao: 'termo de nomeação assinado e certificado do treinamento.', recorrencia_meses: null },
      S: { prioridade: 'baixa', verbo: 'manter', o_que_base: 'Renovar a nomeação do representante da NR-05',
        motivo: `${fatos} A empresa informou que há representante nomeado. A nomeação é formalizada a cada ano (NR-05, item 5.4.14).`,
        meta: 'nomeação renovada e representante treinado.',
        medidas: ['Formalizar de novo a nomeação e a forma de atuação do representante (NR-05, item 5.4.14).',
          `Se houver troca de representante, treinar o novo antes de assumir, com carga mínima de ${h} horas (NR-05, itens 5.7.1 e 5.7.4).`,
          `Acompanhar o número de empregados: a CIPA passa a ser obrigatória a partir de ${lim} empregados no grau ${g}.`],
        afericao: 'termo de nomeação do ano assinado.', recorrencia_meses: 12 },
      '?': { prioridade: 'media', verbo: 'verificar', o_que_base: 'Verificar a nomeação do representante da NR-05',
        motivo: `${fatos} A nomeação não foi confirmada na visita.`,
        meta: 'nomeação confirmada e, se faltar, feita.',
        medidas: ['Confirmar se há representante nomeado neste ano, com termo de nomeação e treinamento (NR-05, itens 5.4.13, 5.4.14 e 5.7.1).',
          'Se não houver, nomear e treinar o representante.'],
        afericao: 'termo de nomeação assinado.', recorrencia_meses: null }
    });
    if (v) out.push(base({ chave: 'o:nomeado', obrig: 'nomeado', ordem: 700100, categoria: 'CIPA', ...v, acompanhamento: acompanhamentoPadrao(v.prioridade),
      base_legal: 'NR-05, itens 5.4.13, 5.4.14 e 5.7; NR-04, Anexo I' }));
  }
  for (const it of out) if (it.recorrencia_meses) it.acompanhamento = `${it.acompanhamento.replace(/\.$/, '')}; ação anual, repetir a cada ${it.recorrencia_meses} meses.`;
  return out;
}

/* ── textos para o SOC ──────────────────────────────────────────────────── */
const ACEIT = { aceitavel: 'aceitável', toleravel: 'tolerável', nao_aceitavel: 'não aceitável' };
const NOME_P = { 1: 'altamente improvável', 2: 'improvável', 3: 'pouco provável', 4: 'provável', 5: 'altamente provável' };
const NOME_S = { 1: 'lesão leve', 2: 'lesão moderada', 3: 'lesão grave', 4: 'lesão gravíssima', 5: 'lesão crítica ou fatal' };
export function linhaSituacao({ situacao = 'pendente', desde = null, prazo = null, data_conclusao = null } = {}) {
  if (situacao === 'concluida') return `SITUAÇÃO: CONCLUÍDA em ${dataBr(data_conclusao) || '__/__/____'}.`;
  if (situacao === 'cancelada') return `SITUAÇÃO: CANCELADA${desde ? ' em ' + dataBr(desde) : ''}.`;
  const pz = '';   // o prazo sai no campo Quando? do SOC
  if (situacao === 'em_andamento') return `SITUAÇÃO: EM ANDAMENTO${desde ? ' desde ' + dataBr(desde) : ''}.${pz}`;
  return `SITUAÇÃO: PENDENTE.${pz}`;
}
export function linhaConclusao({ situacao = 'pendente', data_conclusao = null, resultado = '' } = {}) {
  if (situacao === 'concluida') return `CONCLUSÃO: ${util(resultado) ? frase(String(resultado).trim().replace(/\s*\n+\s*/g, ' ')) : 'concluída em ' + dataBr(data_conclusao) + '.'}`;
  if (situacao === 'cancelada') return `CONCLUSÃO: cancelada${util(resultado) ? ' — ' + frase(String(resultado).trim()) : '.'}`;
  return 'CONCLUSÃO: em aberto.';
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
    const ac = it.nivel.codigo === 'alto' ? 'tolerável somente com medidas complementares' : (ACEIT[it.nivel.aceitabilidade] || '');
    /* NR-01 1.5.4.4.2: nível = combinação da severidade com a probabilidade (grade da matriz, não multiplicação). */
    const sp = it.nivel.p && it.nivel.s ? ` (severidade ${it.nivel.s}, ${NOME_S[it.nivel.s] || ''}; probabilidade ${it.nivel.p}, ${NOME_P[it.nivel.p] || ''})` : '';
    L.push(`PRIORIDADE: ${prioTxt}. ${it.nivel.nome}${sp}${ac ? ', ' + ac : ''}.`);
  } else L.push(`PRIORIDADE: ${prioTxt}.`);
  const just = [util(it.motivo) ? String(it.motivo).trim() : '', it.origem === 'risco' && util(it.danos) ? `Possíveis agravos: ${frase(inicioMinusc(it.danos))}` : ''].filter(Boolean).join(it.origem === 'treinamento' ? '\n' : ' ');
  if (just) L.push(`JUSTIFICATIVA: ${just}`);
  if (util(it.base_legal)) L.push(`BASE LEGAL: ${frase(it.base_legal)}`);
  L.push(`REFERÊNCIA: Relatório${ctx?.numeroAv ? ' ' + ctx.numeroAv : ' de avaliação de riscos'}${(ctx?.revisao || 1) > 1 ? `, rev. ${ctx.revisao}` : ''}, de ${dataBr(ctx?.data)}${ctx?.tecnico ? `. Responsável técnico: ${ctx.tecnico}` : ''}.`);
  it.por_que = L.join('\n');

  const C = [];
  const md = (it.medidas || []).map(x => String(x || '').trim()).filter(Boolean);
  if (md.length) {
    C.push('MEDIDAS:');
    md.forEach((x, i) => C.push(`${i + 1}) ${frase(x)}`));
  }
  C.push(linhaSituacao({ situacao: 'pendente', prazo: it.prazo }));
  if (util(it.acompanhamento)) C.push(`ACOMPANHAMENTO: ${frase(maiusc(it.acompanhamento))}`);
  if (util(it.meta)) C.push(`META: ${frase(maiusc(it.meta))}`);
  if (util(it.afericao)) C.push(`AFERIÇÃO DO RESULTADO: ${frase(maiusc(it.afericao))}`);
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
  'categoria_risco', 'risco_uid', 'nivel', 'fonte', 'danos', 'verbo', 'trein', 'obrig', 'recorrencia_meses'];
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
      if (a.origem === 'manual' || (a.origem === 'obrigacao' && ctx?.enq?.sem_cadastro)) out.push(a);   // v228: sem o cadastro (offline), não tira
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

/* ── v225: possíveis lesões ou agravos à saúde (NR-01, item 1.5.7.3.2, alínea d) ──
   Texto padrão por risco, escrito pelo engenheiro de segurança do GRID; o técnico
   pode trocar no próprio risco (campo "Possíveis lesões ou agravos"). O catálogo
   pode sobrescrever em dados.danos. PENDENTE: revisão final do engenheiro. */
export const DANOS_RISCO = {
  '460': 'Perda auditiva induzida por ruído (PAIR), zumbido, estresse e irritabilidade',
  '461': 'Perda auditiva, trauma acústico e zumbido',
  '462': 'Desidratação, cãibras, exaustão e intermação pelo calor',
  '467': 'Hipotermia, lesões pelo frio e agravos respiratórios',
  '468': 'Doenças de pele e agravos respiratórios',
  '466': 'Dores lombares e lesões na coluna vertebral, desconforto e fadiga',
  '1001': 'Dores lombares e lesões na coluna vertebral, desconforto e fadiga',
  '534': 'Síndrome da vibração em mãos e braços (alterações vasculares, neurológicas e osteoarticulares)',
  '463': 'Lesões de pele, efeitos genéticos e câncer pela radiação ionizante',
  '465': 'Queimaduras e lesões nos olhos e na pele',
  '544': 'Queimaduras solares, insolação e câncer de pele',
  '537': 'Fadiga visual, dor de cabeça e desconforto visual; mais chance de acidente por visibilidade ruim',
  '1040': 'Distúrbios osteomusculares (DORT), como tendinites e bursites, e dores nos membros superiores',
  '1037': 'Lombalgia, lesões musculoesqueléticas e hérnias; fadiga',
  '1038': 'Lombalgia e lesões musculoesqueléticas; fadiga',
  '1041': 'Lesões musculoesqueléticas nos membros superiores e na coluna; fadiga',
  '1035': 'Fadiga, lombalgia e lesões musculoesqueléticas',
  '1034': 'Fadiga e dores nos membros inferiores; entorses',
  '540': 'Quedas com fraturas, traumatismos graves e morte',
  '562': 'Asfixia, intoxicação, explosão e morte',
  '553': 'Cortes, esmagamentos, fraturas e amputações',
  '558': 'Cortes e perfurações',
  '1057': 'Cortes e perfurações com risco de contaminação biológica',
  '1009': 'Contusões e traumatismos por queda de objetos',
  '1030': 'Lesões nos olhos e ferimentos por partículas',
  '1046': 'Queimaduras',
  '1010': 'Quedas, entorses, contusões e fraturas',
  '1020': 'Quedas, entorses, contusões e fraturas',
  '1002': 'Quedas, entorses, contusões e fraturas',
  '560': 'Traumatismos e lesões graves em acidente de trânsito',
  '1056': 'Traumatismos e lesões graves em acidente de trânsito',
  '1100': 'Traumatismos e lesões graves em acidente de trânsito',
  '1053': 'Atropelamento, esmagamento, prensamento e queda de carga',
  '1022': 'Atropelamento, esmagamento, prensamento e queda de carga',
  '554': 'Contusões e fraturas por queda de materiais armazenados',
  '1079': 'Queimaduras químicas na pele e nos olhos',
  '555': 'Envenenamento por picada e reações alérgicas',
  '541': 'Choque elétrico, queimaduras e parada cardiorrespiratória',
  '542': 'Queimaduras e lesões por incêndio ou explosão',
  '549': 'Queimaduras e lesões por explosão',
  '434': 'Intoxicação, alterações no sangue (benzenismo) e câncer',
  '539': 'Doenças respiratórias e intoxicação por metais',
  '543': 'Irritação de pele, olhos e vias respiratórias; dermatites',
  '1039': 'Irritação e doenças respiratórias',
  '1073': 'Doenças respiratórias, como as pneumoconioses',
  '1045': 'Irritação e doenças respiratórias; alergias',
  '545': 'Dermatites e irritação dos olhos e vias respiratórias'
};
const DANOS_CATEGORIA = {
  ergonomico: 'Dores e distúrbios musculoesqueléticos (DORT) e fadiga',
  quimico: 'Intoxicação e irritação de pele, olhos e vias respiratórias, conforme o agente (ver FISPQ)',
  biologico: 'Doenças infecciosas e parasitárias transmitidas pelo agente biológico',
  fisico: '', acidente: '', operacao_perigosa: ''
};
const POSTURA = new Set(['1031', '1032', '1033', '1054', '1055', '1072']);
/* Texto padrão (sem o que o técnico escreveu). */
export function danosPadrao(r, cat) {
  const c = cat?.risco ? cat.risco(r?.codigo) : null;
  if (c?.dados?.danos) return c.dados.danos;
  const cod = String(r?.codigo || '');
  if (DANOS_RISCO[cod]) return DANOS_RISCO[cod];
  if (POSTURA.has(cod)) return 'Dores musculoesqueléticas (coluna e membros inferiores) e fadiga';
  return DANOS_CATEGORIA[r?.categoria] || '';
}
/* O que vai para o relatório: o texto do técnico ou o padrão. */
export const danosDe = (r, cat) => (String(r?.danos || '').trim() || danosPadrao(r, cat));
/* Normas citadas (para "Referências normativas"): NR-xx, NHO xx. */
export function normasDe(texto) {
  const out = [];
  for (const m of String(texto || '').matchAll(/NR-(\d{2})|NHO\s?(\d{2})/g)) out.push(m[1] ? `NR-${m[1]}` : `NHO ${m[2]}`);
  return out;
}
export const baseLegalRisco = (r, cat) => {
  const c = cat?.risco ? cat.risco(r?.codigo) : null;
  return c?.dados?.base_legal || BASE_LEGAL_RISCO[String(r?.codigo || '')] || BASE_CATEGORIA[r?.categoria] || '';
};
