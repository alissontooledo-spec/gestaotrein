/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/campo/laudomiro-dados.js — perguntas sobre os DADOS DA EMPRESA
   dentro do Laudomiro (app 266, 16/10/2026; grupo 3 "Ligado ao GRID").
   Proposta aprovada: 08-Propostas-visuais/laudomiro-grupo3-ligado-ao-grid.html.

   Como funciona (LGPD):
     · A função do servidor só CLASSIFICA a pergunta e devolve a "consulta"
       { tipo, curso, cliente, situacao, dias, periodo, formato }.
     · Quem busca os dados é ESTE arquivo, no aparelho, com o login de quem
       perguntou (RLS do banco + filtro por org_id). Nenhum nome, CPF ou linha
       do banco é enviado à IA.
     · Vencimentos usam a MESMA conta da tela Conformidade (calcConformidade,
       pela ponte da casca), para os números nunca divergirem.
   Tipos: vencimentos · sem_treinamento · turmas · campo.
   ══════════════════════════════════════════════════════════════════════════ */

import { cliente as clienteBanco } from '../../nucleo/dados.js';
import * as sessao from '../../nucleo/sessao.js';
import { ponte } from './comum.js';
import { SITUACAO } from './dados.js';

const sb = () => { const c = clienteBanco(); if (!c) throw new Error('Banco indisponível. Recarregue o sistema.'); return c; };
const semAc = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dm = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
const dataDe = (aaaammdd) => { const [a, m, d] = String(aaaammdd || '').slice(0, 10).split('-').map(Number); return a ? new Date(a, m - 1, d) : null; };
const dma = (aaaammdd) => { const d = dataDe(aaaammdd); return d ? `${dm(d)}/${String(d.getFullYear()).slice(2)}` : '—'; };
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const MAX_PESSOAS = 20000;

/* ── nomes ──────────────────────────────────────────────────────────────── */
const PALAVRAS_VAZIAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'o', 'a', 'os', 'as', 'curso', 'treinamento', 'treinamentos', 'cliente', 'empresa', 'ltda', 'me', 'sa', 's']);

/** O nome do curso bate com o que a pessoa escreveu? "NR-35", "nr 35", "NR35" → \bNR 0?35\b; senão, todas as palavras. */
export function casaCurso(nome, termo) {
  if (!termo) return true;
  const n = semAc(nome), t = semAc(termo);
  const nr = t.match(/\bnr\s*-?\s*0*(\d{1,2})\b/);
  if (nr) {
    if (!new RegExp(`\\bnr\\s*-?\\s*0*${nr[1]}(?!\\d)`).test(n)) return false;
    const resto = t.replace(nr[0], ' ');
    return palavras(resto).every((p) => n.includes(p));
  }
  const ps = palavras(t);
  return ps.length ? ps.every((p) => n.includes(p)) : true;
}
/** Cliente: todas as palavras do que a pessoa escreveu aparecem no nome (sem acento, sem "Ltda"). */
export function casaCliente(nome, termo) {
  if (!termo) return true;
  const n = semAc(nome), ps = palavras(semAc(termo));
  return ps.length ? ps.every((p) => n.includes(p)) : false;   // só "Ltda", "ME"…: não serve para filtrar
}
function palavras(t) { return String(t || '').split(/[^a-z0-9]+/).filter((p) => p.length >= 2 && !PALAVRAS_VAZIAS.has(p)); }

/* ── períodos ───────────────────────────────────────────────────────────── */
/** { ini, fim, rotulo } a partir da consulta. Sem período nem dias: os próximos `padrao` dias. */
export function janela(c, padrao = 30, hoje = new Date()) {
  const h = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const mais = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const dow = (h.getDay() + 6) % 7;   // segunda = 0
  switch (c?.periodo) {
    case 'hoje': return { ini: h, fim: h, rotulo: 'hoje' };
    case 'esta_semana': { const f = mais(h, 6 - dow); return { ini: h, fim: f, rotulo: `nesta semana (até ${dm(f)})` }; }
    case 'proxima_semana': { const i = mais(h, 7 - dow), f = mais(i, 6); return { ini: i, fim: f, rotulo: `na próxima semana (${dm(i)} a ${dm(f)})` }; }
    case 'este_mes': { const f = new Date(h.getFullYear(), h.getMonth() + 1, 0); return { ini: h, fim: f, rotulo: `até ${dm(f)}` }; }
    case 'proximo_mes': { const i = new Date(h.getFullYear(), h.getMonth() + 1, 1), f = new Date(h.getFullYear(), h.getMonth() + 2, 0); return { ini: i, fim: f, rotulo: `de ${dm(i)} a ${dm(f)}` }; }
    default: { const n = c?.dias || padrao, f = mais(h, n); return { ini: h, fim: f, rotulo: `até ${dm(f)}` }; }
  }
}
/** Para "vencidos" com período: quantos dias para trás valem ("neste mês" = desde o dia 1). null = sem limite. */
export function janelaVencidos(c, hoje = new Date()) {
  if (c?.dias) return { desde: -c.dias, rotulo: `nos últimos ${c.dias} dias` };
  if (c?.periodo === 'este_mes') return { desde: -(hoje.getDate() - 1), rotulo: 'neste mês' };
  if (c?.periodo === 'esta_semana') return { desde: -((hoje.getDay() + 6) % 7), rotulo: 'nesta semana' };
  return { desde: null, rotulo: '' };
}
const diasAte = (d, hoje = new Date()) => Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())) / 86400000);

/* ── permissões (a casca responde pela ponte) ───────────────────────────── */
const pode = (rota) => { const p = ponte(); return typeof p.podeRota === 'function' ? !!p.podeRota(rota) : false; };   // sem a casca nova: fecha
const planoPro = () => { const p = ponte(); return typeof p.planoPro === 'function' ? !!p.planoPro() : false; };
/** Mesma janela da Conformidade e do Início (35 dias), quando a casca informa. */
const janelaPadrao = () => { const p = ponte(); const n = typeof p.janelaConformidade === 'function' ? Number(p.janelaConformidade()) : 0; return n > 0 ? n : 35; };
const recusa = (texto) => ({ ok: false, texto });

/** Lê em páginas de 1000 (o banco não entrega mais que isso de uma vez). Marca `truncado` se passar do limite. */
async function lerTudo(montar, max = MAX_PESSOAS) {
  const tudo = [];
  for (let de = 0; ; de += 1000) {
    if (de >= max) { tudo.truncado = true; break; }
    const { data, error } = await montar().range(de, de + 999);
    if (error) throw error;
    tudo.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return tudo;
}
const nomesClientes = (ns) => { const u = [...new Set(ns)]; return u.length <= 3 ? u.join(', ') : `${u.slice(0, 3).join(', ')} e mais ${u.length - 3}`; };
async function cursosAtivos(oi) {
  const { data, error } = await sb().from('catalogo').select('id,nome,ativo,arquivado').eq('org_id', oi);
  if (error) return null;
  return data || [];
}

/* ════════════════════════════════════════════════════════════════════════ */
/** Roda a consulta e devolve o quadro pronto para a tela:
    { ok, titulo, sub, colunas[], linhas[][{t,c?,acao?}], total, contagem?[], grupos?[], arquivo } ou { ok:false, texto } */
export async function executar(c) {
  const oi = sessao.orgId();
  if (!oi) return recusa('Abra uma organização para consultar os dados.');
  if (c?.tipo === 'vencimentos') return vencimentos(c, oi);
  if (c?.tipo === 'sem_treinamento') return semTreinamento(c, oi);
  if (c?.tipo === 'turmas') return turmas(c, oi);
  if (c?.tipo === 'campo') return campo(c, oi);
  return recusa('Não entendi qual dado você quer ver.');
}

/* ── vencimentos (mesma conta da tela Conformidade) ─────────────────────── */
async function vencimentos(c, oi) {
  if (!pode('conformidade')) return recusa('Seu perfil de acesso não inclui a Conformidade, onde ficam os vencimentos. Peça ao administrador da sua empresa.');
  if (!planoPro()) return recusa('Os vencimentos ficam na Conformidade, que faz parte do plano Pro.');
  const p = ponte();
  if (typeof p.conformidade !== 'function') return recusa('Atualize o GRID para usar esta consulta.');
  const [conf, cat] = await Promise.all([p.conformidade(), cursosAtivos(oi)]);
  const agendada = (x) => x.statusExcecao === 'renovacao_agendada';
  let base = [...(conf.todosAtivos || []), ...(conf.tratados || []).filter(agendada)];
  if (c.curso) {
    base = base.filter((x) => casaCurso(x.treinamentoNome, c.curso) || casaCurso(x.sugestaoNome, c.curso));
    if (!base.length && cat && !cat.some((k) => casaCurso(k.nome, c.curso))) return recusa(`Não achei o curso "${c.curso}" no seu catálogo.`);
  }
  let varios = '';
  if (c.cliente) {
    const antes = base.length;
    base = base.filter((x) => casaCliente(x.empresa, c.cliente));
    if (antes && !base.length) return recusa(`Não achei vencimentos no cliente "${c.cliente}". Confira o nome do cliente.`);
    const nomes = new Set(base.map((x) => x.empresa));
    if (nomes.size > 1) varios = `"${c.cliente}" achou ${nomes.size} clientes: ${nomesClientes([...nomes])}`;
  }
  const jan = janela(c, janelaPadrao());
  const atras = janelaVencidos(c);
  const lim = diasAte(jan.fim);
  const ini = c.periodo === 'proximo_mes' || c.periodo === 'proxima_semana' ? diasAte(jan.ini) : 0;
  // Com período ("este mês", "30 dias"), mostra o que vence nele; os já vencidos viram um aviso no subtítulo.
  // Sem período, "todos" junta os vencidos e os que vencem nos próximos 30 dias (como na Conformidade).
  const comVencidos = c.situacao === 'vencidos' || (c.situacao === 'todos' && !c.periodo && !c.dias);
  const dentro = (x) => c.situacao === 'vencidos' ? x.diffDias < 0 && (atras.desde == null || x.diffDias >= atras.desde) : (x.diffDias >= ini && x.diffDias <= lim) || (comVencidos && x.diffDias < 0);
  const lista = base.filter(dentro).sort((a, b) => a.diffDias - b.diffDias || String(a.colaboradorNome).localeCompare(String(b.colaboradorNome), 'pt-BR'));
  const vencidosFora = comVencidos ? 0 : base.filter((x) => x.diffDias < 0).length;

  const pessoas = new Set(lista.map((x) => x.colaborador_id)).size;
  const clientes = new Set(lista.map((x) => x.cliente_id || x.empresa)).size;
  const cursos = new Set(lista.map((x) => x.treinamentoNome));
  const nAgend = lista.filter(agendada).length;
  const umCurso = !!c.curso && cursos.size <= 1;
  const rotCurso = umCurso ? (c.curso.match(/nr\s*-?\s*\d+/i) ? c.curso.toUpperCase().replace(/\s+/g, '').replace(/^NR(\d)/, 'NR-$1') : [...cursos][0] || c.curso) : '';
  const quando = c.situacao === 'vencidos' ? `vencido${atras.rotulo ? ' ' + atras.rotulo : ''}` : comVencidos ? `vencido ou vencendo ${jan.rotulo}` : `vencendo ${jan.rotulo}`;
  const titulo = umCurso
    ? `${plural(pessoas, 'pessoa', 'pessoas')} com ${rotCurso} ${quando}`
    : `${plural(lista.length, 'treinamento', 'treinamentos')} ${quando.replace(/^vencido\b/, 'vencidos')}${lista.length ? ` · ${plural(pessoas, 'pessoa', 'pessoas')}` : ''}`;
  const sub = lista.length
    ? [varios || plural(clientes, 'cliente', 'clientes'), 'ordenado pelo vencimento', nAgend ? `${nAgend} já com turma marcada` : '', vencidosFora ? `fora da lista: ${vencidosFora} já ${vencidosFora === 1 ? 'vencido' : 'vencidos'}` : ''].filter(Boolean).join(' · ')
    : vencidosFora ? `Nada vence nesse período. Há ${vencidosFora} já ${vencidosFora === 1 ? 'vencido' : 'vencidos'}: pergunte "quais estão vencidos?".` : 'Nada encontrado com esses filtros.';
  const colunas = ['Pessoa', 'Cliente', ...(umCurso ? [] : ['Treinamento']), 'Vence em', 'Situação'];
  const linhas = lista.map((x) => {
    const d = x.diffDias;
    const rel = d < 0 ? `venceu há ${-d} ${-d === 1 ? 'dia' : 'dias'}` : d === 0 ? 'hoje' : `${d} ${d === 1 ? 'dia' : 'dias'}`;
    return [
      { t: x.colaboradorNome, c: 'b' }, { t: x.empresa },
      ...(umCurso ? [] : [{ t: x.treinamentoNome }]),
      { t: `${dma(x.data_vencimento)} (${rel})`, c: d < 0 ? 'no' : d <= 7 ? 'md' : '' },
      { t: agendada(x) ? 'Turma marcada' : '—', c: agendada(x) ? 'ok' : 'cz' },
    ];
  });

  // resumo por curso (pergunta "quantos…")
  const porCurso = new Map();
  lista.forEach((x) => { const g = porCurso.get(x.treinamentoNome) || { n: 0, cli: new Set() }; g.n++; g.cli.add(x.empresa); porCurso.set(x.treinamentoNome, g); });
  const contagem = [...porCurso.entries()].map(([rot, g]) => ({ n: g.n, rot, sub: g.cli.size === 1 ? [...g.cli][0] : plural(g.cli.size, 'cliente', 'clientes') })).sort((a, b) => b.n - a.n);

  // "Montar turma": mesmo cliente + mesmo curso sugerido (Reciclagem quando houver), sem quem já tem turma marcada
  let grupos = [];
  if (pode('turmas') && typeof p.montarTurma === 'function') {
    const ativos = cat ? new Set(cat.filter((k) => k.ativo !== false && k.arquivado !== true).map((k) => k.id)) : null;
    const m = new Map();
    lista.filter((x) => !agendada(x) && x.cliente_id && x.sugestaoId && (!ativos || ativos.has(x.sugestaoId))).forEach((x) => {
      const k = `${x.cliente_id}|${x.sugestaoId}`;
      const g = m.get(k) || { clienteId: x.cliente_id, cursoId: x.sugestaoId, rot: `${x.sugestaoNome} · ${x.empresa}`, ids: [], pessoas: new Set() };
      g.ids.push(x.id); g.pessoas.add(x.colaborador_id); m.set(k, g);
    });
    grupos = [...m.values()].map((g) => ({ clienteId: g.clienteId, cursoId: g.cursoId, rot: g.rot, ids: g.ids, n: g.pessoas.size })).filter((g) => g.n >= 2).sort((a, b) => b.n - a.n).slice(0, 3);  // como no Início: turma de 1 pessoa não vira sugestão
  }
  return { ok: true, titulo, sub, colunas, linhas, total: lista.length, pessoas, contagem, grupos, arquivo: 'vencimentos' };
}

/* ── quem não tem um treinamento ────────────────────────────────────────── */
/* Para cada pessoa, o registro do curso que manda:
     1. tem um válido (não vencido)                → tem o treinamento (fica fora);
     2. pendência com "turma marcada"               → aparece como "Turma marcada";
     3. outra exceção tratada na Conformidade       → fica fora (ex.: não se aplica), contada no subtítulo;
     4. só vencidos                                 → "Venceu em …";
     5. nenhum registro                             → "Nunca fez".
   Desligado em qualquer curso: fica fora. */
async function semTreinamento(c, oi) {
  if (!c.curso) return recusa('Diga qual treinamento. Exemplo: "quem do cliente Construtora Alfa não tem NR-35?"');
  if (!pode('conformidade')) return recusa('Seu perfil de acesso não inclui a Conformidade, onde ficam os treinamentos de cada pessoa. Peça ao administrador da sua empresa.');
  if (!planoPro()) return recusa('Esta consulta usa a Conformidade, que faz parte do plano Pro.');
  const p = ponte();
  if (typeof p.conformidade !== 'function') return recusa('Atualize o GRID para usar esta consulta.');
  const [conf, cat, clis] = await Promise.all([
    p.conformidade(), cursosAtivos(oi),
    lerTudo(() => sb().from('clientes').select('id,nome').eq('org_id', oi).order('id')),
  ]);
  if (cat && !cat.some((k) => casaCurso(k.nome, c.curso))) return recusa(`Não achei o curso "${c.curso}" no seu catálogo.`);
  const nomeCli = new Map(clis.map((x) => [x.id, x.nome]));
  let idsCli = null;
  if (c.cliente) {
    idsCli = clis.filter((x) => casaCliente(x.nome, c.cliente)).map((x) => x.id);
    if (!idsCli.length) return recusa(`Não achei o cliente "${c.cliente}". Confira o nome.`);
  }
  // com cliente, o filtro vai para o banco (empresa grande não precisa baixar todo mundo)
  const cols = [];
  if (idsCli) {
    for (let i = 0; i < idsCli.length; i += 100) {
      const parte = idsCli.slice(i, i + 100);
      cols.push(...await lerTudo(() => sb().from('colaboradores').select('id,nome,cliente_id').eq('org_id', oi).in('cliente_id', parte).order('id')));
    }
  } else {
    const t = await lerTudo(() => sb().from('colaboradores').select('id,nome,cliente_id').eq('org_id', oi).order('id'));
    cols.push(...t); if (t.truncado) cols.truncado = true;
  }
  const todos = [...(conf.todosAtivos || []), ...(conf.tratados || [])];
  const deslig = (x) => /deslig/i.test(String(x.statusExcecao || ''));
  const desligado = new Set(todos.filter(deslig).map((x) => x.colaborador_id));
  const doCurso = new Map();   // colaborador → registros deste curso
  todos.filter((x) => casaCurso(x.treinamentoNome, c.curso) || casaCurso(x.sugestaoNome, c.curso)).forEach((x) => {
    const l = doCurso.get(x.colaborador_id) || []; l.push(x); doCurso.set(x.colaborador_id, l);
  });
  let comExcecao = 0;
  const lista = [];
  cols.filter((x) => !desligado.has(x.id)).forEach((x) => {
    const regs = doCurso.get(x.id) || [];
    if (regs.some((r) => r.diffDias >= 0)) return;                                             // 1 (válido, mesmo já com renovação marcada)
    if (regs.some((r) => r.statusExcecao === 'renovacao_agendada')) { lista.push({ x, sit: { t: 'Turma marcada', c: 'ok' } }); return; }  // 2
    if (regs.some((r) => r.statusExcecao)) { comExcecao++; return; }                             // 3
    const venc = regs.filter((r) => r.diffDias < 0).sort((a, b) => b.diffDias - a.diffDias)[0];
    lista.push({ x, sit: venc ? { t: `Venceu em ${dma(venc.data_vencimento)}`, c: 'no' } : { t: 'Nunca fez', c: 'md' } });  // 4 e 5
  });
  lista.sort((a, b) => String(nomeCli.get(a.x.cliente_id) || '').localeCompare(String(nomeCli.get(b.x.cliente_id) || ''), 'pt-BR') || String(a.x.nome).localeCompare(String(b.x.nome), 'pt-BR'));
  const nunca = lista.filter((r) => r.sit.t === 'Nunca fez').length;
  const marcadas = lista.filter((r) => r.sit.t === 'Turma marcada').length;
  const vencidas = lista.length - nunca - marcadas;
  const nomesAchados = idsCli ? [...new Set(idsCli.map((id) => nomeCli.get(id)).filter(Boolean))] : [];
  const rot = c.curso.match(/nr\s*-?\s*\d+/i) ? c.curso.toUpperCase().replace(/\s+/g, '').replace(/^NR(\d)/, 'NR-$1') : c.curso;
  const sub = [
    lista.length ? [`${nunca} nunca ${nunca === 1 ? 'fez' : 'fizeram'}`, vencidas ? `${vencidas} com o treinamento vencido` : '', marcadas ? `${marcadas} já com turma marcada` : ''].filter(Boolean).join(' · ') : 'Todos têm o treinamento em dia.',
    comExcecao ? `${comExcecao} com exceção registrada na Conformidade (fora da lista)` : '',
    nomesAchados.length > 1 ? `clientes: ${nomesClientes(nomesAchados)}` : '',
    cols.truncado ? `mostrando os primeiros ${MAX_PESSOAS} colaboradores; filtre por cliente` : '',
  ].filter(Boolean).join(' · ');
  return {
    ok: true,
    titulo: `${plural(lista.length, 'pessoa', 'pessoas')} sem ${rot} válido${nomesAchados.length === 1 ? ` em ${nomesAchados[0]}` : ''}`,
    sub,
    nota: 'Lista todos os colaboradores cadastrados. Nem todos precisam deste treinamento: confira a função de cada um.',
    colunas: ['Pessoa', 'Cliente', 'Situação'],
    linhas: lista.map(({ x, sit }) => [{ t: x.nome, c: 'b' }, { t: nomeCli.get(x.cliente_id) || '—' }, sit]),
    total: lista.length, contagem: [], grupos: [], arquivo: 'sem-treinamento',
  };
}

/* ── turmas marcadas ────────────────────────────────────────────────────── */
async function turmas(c, oi) {
  if (!pode('turmas')) return recusa('Seu perfil de acesso não inclui as Turmas. Peça ao administrador da sua empresa.');
  const jan = janela(c, 30);   // turmas: próximos 30 dias quando não diz o período
  const a = iso(jan.ini), b = iso(jan.fim);
  const data = await lerTudo(() => sb().from('turmas')
    .select('id,status,cliente_id,clientes(nome),catalogo(nome),sessoes(data,cancelada),turma_participantes(id)')
    .eq('org_id', oi).in('status', ['agendada', 'em_andamento']).order('id'));
  const lista = data.map((t) => {
    const datas = (t.sessoes || []).filter((s) => !s.cancelada && s.data).map((s) => String(s.data).slice(0, 10)).sort();
    const noPeriodo = datas.filter((d) => d >= a && d <= b);
    return { t, quando: noPeriodo[0] || null, fim: datas[datas.length - 1] || null };
  })
    .filter(({ t, quando }) => quando && casaCurso(t.catalogo?.nome, c.curso) && casaCliente(t.clientes?.nome, c.cliente))
    .sort((x, y) => x.quando.localeCompare(y.quando));
  const porCurso = new Map();
  lista.forEach(({ t }) => { const k = t.catalogo?.nome || 'Curso'; const g = porCurso.get(k) || { n: 0, cli: new Set() }; g.n++; g.cli.add(t.clientes?.nome || '—'); porCurso.set(k, g); });
  const pessoas = lista.reduce((s, { t }) => s + (t.turma_participantes || []).length, 0);
  return {
    ok: true,
    titulo: `${plural(lista.length, 'turma', 'turmas')} ${jan.rotulo.startsWith('até') ? `até ${jan.rotulo.slice(4)}` : jan.rotulo}`,
    sub: lista.length ? [plural(pessoas, 'pessoa inscrita', 'pessoas inscritas'), 'ordenado pela data'].join(' · ') : 'Nenhuma turma marcada nesse período.',
    colunas: ['Data', 'Curso', 'Cliente', 'Pessoas', 'Situação'],
    linhas: lista.map(({ t, quando }) => [
      { t: dma(quando), c: 'b' }, { t: t.catalogo?.nome || 'Curso', acao: `campo:lq-dados-turma:${t.id}` }, { t: t.clientes?.nome || '—' },
      { t: String((t.turma_participantes || []).length) }, { t: t.status === 'em_andamento' ? 'Em andamento' : 'Agendada', c: t.status === 'em_andamento' ? 'md' : 'ok' },
    ]),
    total: lista.length,
    contagem: [...porCurso.entries()].map(([rot, g]) => ({ n: g.n, rot, sub: g.cli.size === 1 ? [...g.cli][0] : plural(g.cli.size, 'cliente', 'clientes') })).sort((x, y) => y.n - x.n),
    grupos: [], arquivo: 'turmas',
  };
}

/* ── avaliações de campo sem concluir ───────────────────────────────────── */
async function campo(c, oi) {
  if (!pode('campo')) return recusa('Seu perfil de acesso não inclui a Avaliação de Campo. Peça ao administrador da sua empresa.');
  const data = await lerTudo(() => sb().from('campo_avaliacoes').select('id,numero,cliente_id,situacao,data_visita')
    .eq('org_id', oi).not('situacao', 'in', '(concluida,cancelada)').order('id'));
  const ids = [...new Set((data || []).map((x) => x.cliente_id).filter(Boolean))];
  let nomes = new Map();
  for (let i = 0; i < ids.length; i += 100) {
    const r = await sb().from('clientes').select('id,nome').eq('org_id', oi).in('id', ids.slice(i, i + 100));
    if (r.error) throw r.error;
    (r.data || []).forEach((x) => nomes.set(x.id, x.nome));
  }
  let lista = data.filter((x) => casaCliente(nomes.get(x.cliente_id) || '', c.cliente));
  if (c.periodo || c.dias) {
    const jan = janela(c, 30), a = iso(jan.ini), b = iso(jan.fim);
    lista = lista.filter((x) => x.data_visita && String(x.data_visita).slice(0, 10) >= a && String(x.data_visita).slice(0, 10) <= b);
  }
  const hoje = iso(new Date());
  lista.sort((x, y) => String(x.data_visita || '9').localeCompare(String(y.data_visita || '9')));
  const atrasadas = lista.filter((x) => x.situacao === 'agendada' && x.data_visita && String(x.data_visita).slice(0, 10) < hoje).length;
  const porSit = new Map();
  lista.forEach((x) => porSit.set(x.situacao, (porSit.get(x.situacao) || 0) + 1));
  return {
    ok: true,
    titulo: `${plural(lista.length, 'avaliação de campo', 'avaliações de campo')} sem concluir`,
    sub: lista.length ? [plural(new Set(lista.map((x) => x.cliente_id)).size, 'cliente', 'clientes'), atrasadas ? `${atrasadas} com a visita atrasada` : '', 'ordenado pela visita'].filter(Boolean).join(' · ') : 'Todas as avaliações estão concluídas.',
    colunas: ['Avaliação', 'Cliente', 'Visita', 'Situação'],
    linhas: lista.map((x) => {
      const atras = x.situacao === 'agendada' && x.data_visita && String(x.data_visita).slice(0, 10) < hoje;
      return [{ t: x.numero || 'Sem número', c: 'b', acao: `ir:campo-avaliacao:${x.id}` }, { t: nomes.get(x.cliente_id) || '—' },
        { t: x.data_visita ? dma(x.data_visita) : 'A marcar', c: atras ? 'no' : '' }, { t: (SITUACAO[x.situacao] || [x.situacao])[0] || '—' }];
    }),
    total: lista.length,
    contagem: [...porSit.entries()].map(([s, n]) => ({ n, rot: (SITUACAO[s] || [s])[0], sub: '' })).sort((x, y) => y.n - x.n),
    grupos: [], arquivo: 'avaliacoes-de-campo',
  };
}

/* ── texto e planilha ───────────────────────────────────────────────────── */
export function textoQuadro(res) {
  if (!res?.ok) return '';
  return [res.titulo, res.sub, '', res.colunas.join(' | '), ...res.linhas.map((l) => l.map((x) => x.t).join(' | ')), '', 'Dados do GRID.'].join('\n');
}
export function csvQuadro(res) {
  const q = (v) => { let t = String(v ?? ''); if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; return `"${t.replace(/"/g, '""')}"`; };
  return '﻿' + [res.colunas, ...res.linhas.map((l) => l.map((x) => x.t))].map((x) => x.map(q).join(';')).join('\r\n');
}
