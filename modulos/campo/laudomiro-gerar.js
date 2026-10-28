/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/campo/laudomiro-gerar.js — documentos pedidos no chat (app 284)
   Ordem de Serviço (NR-01, item 1.4.1, alínea c), Ficha de entrega de EPI
   (NR-06, item 6.5.1, alínea d), Lista de presença e Dossiê para fiscalização.
   Proposta aprovada em 24/10/2026: 08-Propostas-visuais/grid-proposta-laudomiro-documentos-v284b.png.

   Como funciona (LGPD):
     · O pedido é reconhecido AQUI, no aparelho. Não chama a IA e não gasta pergunta.
     · Os dados (empresa, pessoas, treinamentos, GHE) são lidos com o login de quem
       pediu (RLS do banco). Nenhum nome ou CPF vai para a IA. O CPF não sai no documento.
     · Sem avaliação de campo, o Laudomiro sugere os riscos da FUNÇÃO (ação riscos_funcao
       da função do servidor). Só o nome da função vai para a IA. Gasta 1 pergunta.
     · Textos fixos conferidos pelo engenheiro de segurança do time em 24/10/2026
       (NR-01 1.4.1 c, 1.4.2, 1.4.2.1, 1.4.3, 1.4.4. NR-06 6.5.1 c, d, 6.6.1, 6.7.2).
   ══════════════════════════════════════════════════════════════════════════ */

import * as Dossie from '../dossie/dossie.js';
import * as Docs from './laudomiro-docs.js';
import { esc, avisar, docClienteTxt } from './comum.js';
import { cliente as clienteBanco } from '../../nucleo/dados.js';
import * as sessao from '../../nucleo/sessao.js';

const sb = () => { const c = clienteBanco(); if (!c) throw new Error('Banco indisponível. Recarregue o sistema.'); return c; };
const semAc = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = (t) => semAc(t).replace(/[^a-z0-9]+/g, ' ').trim();
const dataBr = (iso) => { if (!iso) return ''; const [a, m, d] = String(iso).slice(0, 10).split('-'); return d && m && a ? `${d}/${m}/${a}` : ''; };
const hojeIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const semTabela = (e) => /42P01|does not exist|schema cache/i.test(`${e?.code || ''} ${e?.message || ''}`);
const MAX_PESSOAS = 60;    // um arquivo com mais que isso trava o celular
const MAX_RISCOS = 12;

export const TIPOS = {
  os: { nome: 'Ordem de Serviço', ref: 'NR-01, item 1.4.1, alínea c', sub: 'Riscos e medidas de uma função ou pessoa (NR-01)' },
  epi: { nome: 'Ficha de entrega de EPI', ref: 'NR-06, item 6.5.1, alínea d', sub: 'Com os EPI do GHE ou da função (NR-06, item 6.5.1, alínea d)' },
  lista: { nome: 'Lista de presença', ref: 'Turma registrada no GRID', sub: 'De uma turma, em branco para assinar ou com a presença registrada' },
  dossie: { nome: 'Dossiê para fiscalização', ref: 'Treinamentos, riscos por GHE e plano de ação', sub: 'Treinamentos, riscos por GHE e plano de ação da empresa' },
  // v286: documentos livres, montados pela IA com roteiro fixo (servidor, ação doc_livre). Servem para qualquer empresa.
  apr: { nome: 'APR, Análise Preliminar de Risco', ref: 'Análise de risco da tarefa', sub: 'Etapas, perigos e medidas de uma tarefa', livre: true, titulo: 'ANÁLISE PRELIMINAR DE RISCO DA TAREFA', curto: 'a APR' },
  pt: { nome: 'Permissão de Trabalho', ref: 'Altura, eletricidade ou trabalho a quente', sub: 'Altura, eletricidade ou trabalho a quente', livre: true, titulo: 'PERMISSÃO DE TRABALHO', curto: 'a Permissão de Trabalho' },
  checklist: { nome: 'Checklist de inspeção', ref: 'Itens com a NR de cada um', sub: 'Máquina, andaime, escada, extintor, EPI', livre: true, titulo: 'CHECKLIST DE INSPEÇÃO', curto: 'o checklist' },
  procedimento: { nome: 'Procedimento de trabalho', ref: 'Passo a passo seguro', sub: 'Passo a passo seguro de uma atividade', livre: true, titulo: 'PROCEDIMENTO DE TRABALHO SEGURO', curto: 'o procedimento' },
};
const LIVRES = ['apr', 'pt', 'checklist', 'procedimento'];
const IC = {
  os: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
  epi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14a8 8 0 0 1 16 0v2H4z"/><path d="M12 6V4M3 18h18"/></svg>',
  lista: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11l2 2 4-4"/><rect x="4" y="3" width="16" height="18" rx="2"/></svg>',
  dossie: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
  apr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.5"/></svg>',
  pt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h4"/><path d="m15 16 1.5 1.5L19 15"/></svg>',
  checklist: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4 6 1.5 1.5L8 5M4 12l1.5 1.5L8 11M4 18l1.5 1.5L8 17M11 6h9M11 12h9M11 18h9"/></svg>',
  procedimento: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h1M4 12h1M4 18h1"/></svg>',
  ch: '<svg class="ch" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><polyline points="9 6 15 12 9 18"/></svg>',
  alerta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.5"/></svg>',
  lapis: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
};

/* ── Reconhecer o pedido ────────────────────────────────────────────────── */
/* Regra (revisão 24/10): só é pedido de documento quando o verbo vem LOGO ANTES do nome do documento
   ("faz a OS", "gera a ficha de EPI", "preciso da lista de presença") ou quando a frase começa pelo
   documento e não é pergunta ("Ficha de EPI do Fulano"). Qualquer dúvida segue para a IA. */
const VERBOS = 'faz|faca|fazer|gera|gere|gerar|monta|monte|montar|cria|crie|criar|emite|emita|emitir|elabora|elabore|elaborar|imprime|imprima|imprimir|baixa|baixe|baixar|preciso|precisava|quero|queria|me da|me de|manda|mande|tira|tire|tirar|prepara|prepare|preparar';
const DOCS_RX = '(fichas?|ordem|ordens|o\\.?s\\.?|lista|listas|folha|dossie|documentos?|apr|analise preliminar|permissao|permissoes|pt|checklists?|check list|check-list|procedimentos?|pop|instrucao de trabalho|roteiro de inspecao)';
const PEDIDO = new RegExp(`\\b(${VERBOS})\\s+(?:(?:a|o|as|os|uma|um|umas|uns|minha|meu|me|pra|para|de|da|do|das|dos|essa|esse|nova|novo)\\s+){0,3}${DOCS_RX}\\b`);
const DUVIDA = /\b(saber|entender|duvida|explica|explique|significa|obrigatori\w*|validade|vale (para|pra)|serve|precisa ter|tem que ter|deve ter|o que|como (se )?faz|como fazer|como faco|quando|quem|qual|quais|por que|porque|pode|devo|precisa|tem que|e necessari\w*|exige|exigid\w*)\b/;
/** Volta { tipo: 'os'|'epi'|'lista'|'dossie'|null } quando o texto pede um documento. Pergunta sobre a norma segue para a IA. */
export function detectar(texto) {
  const orig = String(texto || '').trim();
  const t = semAc(orig).replace(/\s+/g, ' ');
  if (orig.length < 4 || orig.length > 300 || /\?/.test(orig)) return null;
  const m = PEDIDO.exec(t);
  // sem verbo: só quando a frase começa pelo documento e é curta ("Ficha de EPI do Fulano", "OS do soldador")
  const comeca = !m && /^(a |as |uma |um |minha )?(ficha|fichas|ordem|ordens|o\.?s\.? (do|da|dos|das|de|para|pra)\b|lista|folha|dossie|apr\b|analise preliminar de risco|permissao de trabalho|pt (de|da|do|para|pra)\b|checklist|check list|check-list|procedimento)/.test(t) && t.split(' ').length <= 14;
  if (!m && !comeca) return null;
  // dúvida antes do pedido ("como fazer a OS", "a empresa precisa fazer a ficha") ou em qualquer parte ("quero entender") vai para a IA
  if (m && DUVIDA.test(t.slice(0, m.index + m[1].length))) return null;
  if (/\b(saber|entender|duvida|explica|explique)\b/.test(t)) return null;
  if (comeca && (DUVIDA.test(t) || /\b(tem|precisa|deve|pode|serve)\b/.test(t.replace(/^(a |as |uma |um |minha )?\S+( de| da)? \S+/, '')))) return null;
  // comparação ou dúvida sobre o documento ("APR e PT diferença", "checklist é diário ou semanal") vai para a IA
  if (/\b(diferenca|mesm[ao]s?|igua(l|is)|vale (por|para|pra|quanto)|valid[ao]s?|diari[ao]s?|semana(l|is)|mensa(l|is)|exigencia|prazo|quanto tempo)\b/.test(t)) return null;
  if (/\bpt-?br\b/.test(t)) return null;
  if (/\bfichas? (de )?(entrega (de )?)?epis?\b|\bentrega de epis?\b|\bcontrole de (entrega de )?epis?\b/.test(t)) return { tipo: 'epi' };
  if (/\bcheck ?-?lists?\b|\blista de verificacao\b|\broteiro de inspecao\b/.test(t)) return { tipo: 'checklist' };
  if (/\bapr\b|\banalise preliminar de risco/.test(t)) return { tipo: 'apr' };
  if (/\bpermiss(ao|oes) de trabalho\b/.test(t) || (m && m[2] === 'pt') || /^pt (de|da|do|para|pra)\b/.test(t)) return { tipo: 'pt' };
  if (/\bprocedimentos?\b|\bpop\b|\binstrucao de trabalho\b/.test(t)) return { tipo: 'procedimento' };
  if (/\borde(m|ns) de servico\b/.test(t) || /(^|[^a-z])o\.?s\.?($|[^a-z])/.test(m ? m[0] : t.slice(0, 8))) return { tipo: 'os' };
  if (/\b(lista|ficha|folha) de (presenca|chamada)\b/.test(t)) return { tipo: 'lista' };
  if (/\bdossie\b/.test(t)) return { tipo: 'dossie' };
  if (m && /^documentos?$/.test(m[2])) return { tipo: null };   // "preciso de um documento para…"
  return null;
}

/* casa nomes pelo que a pessoa escreveu: todas as palavras fortes do nome aparecem no texto */
const FRACAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'ltda', 'me', 'sa', 'eireli', 'epp', 'cia', 'industria', 'comercio']);
const palavras = (t) => norm(t).split(' ').filter((p) => p.length >= 2 && !FRACAS.has(p));
const raiz = (p) => p.replace(/(oes|aes)$/, 'ao').replace(/(res|zes)$/, (m) => m[0]).replace(/s$/, '');
function acertos(nome, texto) {
  const ps = palavras(nome); if (!ps.length) return { ok: 0, n: 0 };
  const tx = new Set(palavras(texto).map(raiz));
  return { ok: ps.filter((p) => tx.has(raiz(p))).length, n: ps.length };
}
function nota(nome, texto) { const a = acertos(nome, texto); return a.n ? a.ok / a.n : 0; }
/** O nome que mais casa com o texto: todas as palavras, ou pelo menos 2 e mais da metade. Empate entre dois: nenhum. */
function melhor(lista, texto, campo) {
  let m = null, v = 0, empate = false;
  for (const x of lista) {
    const a = acertos(x[campo], texto); if (!a.n) continue;
    const r = a.ok / a.n, vale = r === 1 || (a.ok >= 2 && r > 0.5);
    if (!vale) continue;
    const sc = r + a.ok / 100;
    if (sc > v) { v = sc; m = x; empate = false; } else if (sc === v && m && norm(x[campo]) !== norm(m[campo])) empate = true;
  }
  return empate ? null : m;
}
/** A função citada no texto ("soldadores", "operador"): a de maior acerto, sem empate. */
function cargoDoTexto(cargos, texto) {
  let m = null, v = 0, empate = false;
  for (const c of cargos) { const r = nota(c.cargo, texto); if (r < 0.5) continue; if (r > v) { v = r; m = c; empate = false; } else if (r === v) empate = true; }
  return empate ? null : m;
}

/* ── Estado ─────────────────────────────────────────────────────────────── */
let _ctx = { chamar: null, repintar: () => {}, aoGastar: () => {}, turno: () => null };
export function ligar(ctx) { _ctx = { ..._ctx, ...ctx }; }

export function novoTurno(pergunta, det) {
  return { pergunta, gerar: { tipo: det.tipo, texto: pergunta, etapa: 'carregando', clientes: null, clienteId: '', para: '', D: null, riscos: [], editando: -1, sug: null, emerg: '', emergSalva: '', emergAberta: false, turmas: null, turmaId: '', sessaoId: '', baixado: null, registro: null, erro: '', fora: null, dl: null } };
}

export async function iniciar(turno) {
  const g = turno.gerar;
  try {
    const oi = sessao.orgId();
    if (!oi) throw new Error('Abra uma empresa para gerar documentos.');
    const { data, error } = await sb().from('clientes').select('*').eq('org_id', oi).eq('ativo', true).order('nome').limit(3000);
    if (error) throw error;
    g.clientes = data || [];
    const c = melhor(g.clientes, g.texto, 'nome');
    g.etapa = 'pronto';
    if (g.tipo && TIPOS[g.tipo]?.livre) { iniciarLivre(turno, c); return; }
    if (c && g.tipo) await escolherEmpresa(turno, c.id, true);
    else if (g.tipo === 'os' || g.tipo === 'epi') {
      // v286: empresa que não está no GRID: o cartão sugere "Outra empresa" (não entra sozinho, para não confundir pessoa com empresa)
      const ex = extrairPedido(g.texto);
      if (ex.empresa) g.foraSugerida = ex.empresa;
    }
  } catch (e) { g.etapa = 'erro'; g.erro = e?.message || 'Não foi possível ler as empresas.'; }
  _ctx.repintar();
}

async function escolherEmpresa(turno, clienteId, doTexto = false) {
  const g = turno.gerar;
  const req = (g.req = (g.req || 0) + 1);   // troca de empresa no meio da leitura: vale só a última
  Object.assign(g, { clienteId, D: null, para: '', riscos: [], riscosFuncao: null, sug: null, editando: -1, turmas: null, turmaId: '', sessaoId: '', baixado: null, registro: null, emerg: '', emergSalva: '', emergAberta: false });
  if (!clienteId) { g.lendo = false; _ctx.repintar(); return; }
  g.lendo = true; _ctx.repintar();
  try {
    const oi = sessao.orgId();
    if (g.tipo === 'lista') {
      // turmas: protocolo e data vêm dos encontros (a turma não tem data própria)
      const { data, error } = await sb().from('turmas').select('id,protocolo,status,created_at,catalogo(nome),sessoes(id,data,hora_inicio,concluida,cancelada)')
        .eq('org_id', oi).eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(40);
      if (g.req !== req) return;
      if (error) throw error;
      g.turmas = (data || []).filter((t) => t.status !== 'cancelada').map((t) => {
        const sessoes = (t.sessoes || []).filter((x) => !x.cancelada).sort((a, b) => String(a.data).localeCompare(String(b.data)));
        return { ...t, sessoes, data_inicio: sessoes[0]?.data || null };
      }).sort((a, b) => String(b.data_inicio || '').localeCompare(String(a.data_inicio || '')));
      const nr = /\bnr\s*-?\s*0*(\d{1,2})\b/.exec(semAc(g.texto));
      const curso = doTexto && g.turmas.find((t) => (nr && new RegExp(`\\bnr\\s*-?\\s*0*${nr[1]}(?!\\d)`).test(semAc(t.catalogo?.nome))) || nota(t.catalogo?.nome || '', g.texto) === 1);
      if (curso) escolherTurma(g, curso.id);
    } else {
      const D = await Dossie.carregar(sb(), oi, clienteId);
      if (g.req !== req) return;
      g.D = D; g.desligados = desligadosDe(D);
      const ativos = D.colabs.filter((c) => !g.desligados.has(c.id));
      // o nome da empresa sai do texto antes de procurar pessoa e função ("soldadores da Aurora Alimentos")
      const texto = semEmpresa(g.texto, D.cli?.nome);
      if (g.tipo === 'os' || g.tipo === 'epi') {
        const cargos = cargosDe(g);
        const completo = doTexto ? melhor(ativos, texto, 'nome') : null;
        const cargo = !completo && doTexto ? cargoDoTexto(cargos, texto) : null;
        const pessoa = completo || (!cargo && doTexto ? pessoaDoTexto(ativos, texto) : null);
        if (pessoa) g.para = `p:${pessoa.id}`;
        else if (cargo) g.para = `f:${cargo.cargo}`;
        else if (cargos.length === 1) g.para = `f:${cargos[0].cargo}`;
        await lerEmergencia(g, req);
        if (g.req !== req) return;
        if (g.para) prepararRiscos(turno);
      } else if (g.tipo === 'dossie') {
        const pessoa = doTexto ? pessoaDoTexto(ativos, texto) : null;
        g.para = pessoa ? `p:${pessoa.id}` : '';
      }
    }
  } catch (e) { if (g.req !== req) return; avisar(e?.message || 'Não foi possível ler os dados desta empresa.', 'erro'); g.clienteId = ''; }
  g.lendo = false;
}

function semEmpresa(texto, nome) {
  const fora = new Set(palavras(nome).map(raiz));
  return norm(texto).split(' ').filter((p) => !fora.has(raiz(p))).join(' ');
}
/** Desligado em todos os treinamentos (marcação da Conformidade): não entra nas listas. */
function desligadosDe(D) {
  const por = new Map();
  (D?.conf || []).forEach((r) => { if (!por.has(r.colaborador_id)) por.set(r.colaborador_id, []); por.get(r.colaborador_id).push(r); });
  return new Set([...por.entries()].filter(([, rs]) => rs.length && rs.every((x) => x.status_excecao === 'desligado')).map(([id]) => id));
}
/** Nome completo (ou a maior parte) no texto. Se não, o primeiro nome, quando só uma pessoa da empresa tem ele. */
function pessoaDoTexto(colabs, texto) {
  const p = melhor(colabs, texto, 'nome');
  if (p) return p;
  const tx = new Set(palavras(texto));
  const porPrimeiro = colabs.filter((c) => { const pn = palavras(c.nome)[0]; return pn && pn.length >= 3 && tx.has(pn); });
  return porPrimeiro.length === 1 ? porPrimeiro[0] : null;
}

function escolherTurma(g, turmaId) {
  g.turmaId = turmaId;
  const t = (g.turmas || []).find((x) => x.id === turmaId);
  const hoje = hojeIso();
  const ses = t?.sessoes || [];
  g.sessaoId = (ses.find((s) => s.data === hoje) || ses[ses.length - 1] || {}).id || '';
}

function cargosDe(g) {
  const m = new Map();
  (g.D?.colabs || []).filter((c) => !g.desligados?.has(c.id)).forEach((c) => { const k = norm(c.cargo); if (!k) return; const x = m.get(k) || { cargo: String(c.cargo).trim(), n: 0 }; x.n++; m.set(k, x); });
  return [...m.values()].sort((a, b) => b.n - a.n || a.cargo.localeCompare(b.cargo, 'pt-BR'));
}
/** Pessoas do documento (cada uma vira uma página), com treinamentos e GHE já montados pelo dossiê. */
function pessoasDe(g) {
  if (g.fora) return [{ id: null, nome: '[preencher]', funcao: g.fora.funcao || '[preencher]', ghe: '', linhas: [], fora: true }];
  if (!g.D || !g.para) return [];
  const [k, v] = [g.para.slice(0, 1), g.para.slice(2)];
  const R = Dossie.montar(g.D, k === 'p' ? { colaboradorId: v } : { cargo: v });
  return R.pessoas.slice(0, MAX_PESSOAS);
}
function funcaoDe(g) {
  if (g.fora) return String(g.fora.funcao || '').trim();
  if (!g.para) return '';
  if (g.para.startsWith('f:')) return g.para.slice(2);
  return (g.D?.colabs || []).find((c) => c.id === g.para.slice(2))?.cargo || '';
}
function ghesDaFuncao(g) {
  const f = norm(funcaoDe(g));
  return f ? (g.D?.ghes || []).filter((x) => (x.funcoes || []).some((y) => norm(y) === f)) : [];
}
const vazioEpi = (e) => !e || /^(na|n\/a|nao se aplica|-|nenhum)$/.test(semAc(String(e).trim()));

function prepararRiscos(turno) {
  const g = turno.gerar;
  const f = funcaoDe(g);
  if (g.riscosFuncao != null && norm(g.riscosFuncao) === norm(f)) return;   // mesma função (outra pessoa): mantém o que foi ajustado
  g.riscos = []; g.sug = null; g.editando = -1; g.riscosFuncao = f;
  const gs = ghesDaFuncao(g);
  if (gs.length) {
    const vistos = new Set();
    gs.forEach((ghe) => (ghe.riscos || []).forEach((r) => {
      const k = norm(r.nome); if (!k || vistos.has(k)) return; vistos.add(k);
      g.riscos.push({ risco: r.nome || '', fonte: r.fonte || '', epc: r.epc || '', adm: r.medidas_adm || '', epi: vazioEpi(r.epi) ? '' : r.epi, origem: 'ghe' });
    }));
    g.origem = { tipo: 'ghe', ghes: gs.map((x) => x.nome).join(', '), visita: g.D.visita };
    return;
  }
  g.origem = { tipo: 'sem' };
  g.sugCache ||= {};
  const guardada = g.sugCache[norm(f)];
  if (guardada) { g.riscos = guardada.map((x) => ({ ...x })); g.sug = { feita: true, funcao: f, vazia: !guardada.length }; return; }
  // Só a primeira sugestão do cartão sai sozinha. As outras, o técnico pede (cada uma gasta 1 pergunta).
  if (f && _ctx.chamar && !g.autoUsado) { g.autoUsado = true; sugerir(turno, f); }
}

async function sugerir(turno, funcao) {
  const g = turno.gerar;
  if (g.sug?.carregando) return;   // clique duplo não gasta 2 perguntas
  g.sug = { carregando: true, funcao }; _ctx.repintar();
  try {
    const r = await _ctx.chamar({ acao: 'riscos_funcao', funcao });
    if (r.restantes != null) _ctx.aoGastar(r.restantes);
    const lista = (r.riscos || []).slice(0, MAX_RISCOS).map((x) => ({ risco: x.risco || '', fonte: x.fonte || '', epc: x.epc || '', adm: x.adm || '', epi: x.epi || '', origem: 'sug' }));
    g.sugCache ||= {}; g.sugCache[norm(funcao)] = lista;
    if (norm(funcaoDe(g)) !== norm(funcao)) { if (g.sug?.funcao === funcao) g.sug = null; _ctx.repintar(); return; }   // mudou de função enquanto esperava
    // o que o técnico já escreveu fica, e a sugestão entra depois (sem repetir o mesmo risco)
    const meus = g.riscos.filter((x) => x.origem === 'manual' || x.origem === 'editado');
    const ja = new Set(meus.map((x) => norm(x.risco)));
    g.riscos = [...meus, ...lista.filter((x) => !ja.has(norm(x.risco)))].slice(0, MAX_RISCOS);
    g.editando = -1;
    g.sug = { feita: true, funcao, vazia: !lista.length };
  } catch (e) {
    if (g.sug?.funcao === funcao) g.sug = { erro: e?.message || 'O Laudomiro não conseguiu sugerir os riscos agora.', funcao };
  }
  _ctx.repintar();
}

async function lerEmergencia(g, req) {
  g.emerg = ''; g.emergSalva = ''; g.semTabelaTextos = false;
  try {
    const { data, error } = await sb().from('doc_textos').select('texto').eq('org_id', sessao.orgId()).eq('cliente_id', g.clienteId).eq('chave', 'emergencia').maybeSingle();
    if (req != null && g.req !== req) return;   // trocou de empresa (ou foi para "fora") enquanto lia
    if (error) { if (semTabela(error)) g.semTabelaTextos = true; return; }
    g.emerg = g.emergSalva = data?.texto || '';
  } catch { /* segue sem o texto guardado */ }
}
async function guardarEmergencia(g) {
  const texto = String(g.emerg || '').trim().slice(0, 1500);
  try {
    const { error } = await sb().from('doc_textos').upsert({ org_id: sessao.orgId(), cliente_id: g.clienteId, chave: 'emergencia', texto, atualizado_em: new Date().toISOString() }, { onConflict: 'org_id,cliente_id,chave' });
    if (error) throw error;
    g.emerg = g.emergSalva = texto; g.emergAberta = false;
    avisar('Procedimento guardado para esta empresa.');
  } catch (e) {
    avisar(semTabela(e) ? 'Falta um passo no banco para guardar este texto. Ele vale só para este documento.' : 'Não foi possível guardar agora. O texto vale para este documento.', 'erro');
    g.emergAberta = false;
  }
}

/* ── Textos fixos (conferidos na NR-01 e na NR-06) ──────────────────────── */
const OS_OBJETIVO = 'Esta Ordem de Serviço informa ao trabalhador os riscos da sua função, as medidas de prevenção adotadas pela empresa e as precauções para evitar acidentes e doenças do trabalho, conforme a NR-01 (item 1.4.1, alínea c, e item 1.4.4).';
const OS_DEVERES = ['Cumprir as normas de segurança e saúde no trabalho e esta Ordem de Serviço.', 'Fazer os exames médicos previstos nas Normas Regulamentadoras.', 'Colaborar com a empresa na aplicação das Normas Regulamentadoras.', 'Usar o EPI fornecido pela empresa.'];
const OS_FALTA = 'A recusa sem justificativa em cumprir estes deveres constitui ato faltoso (NR-01, item 1.4.2.1).';
const OS_INTERROMPER = 'O trabalhador pode interromper a atividade quando constatar, por motivos razoáveis, risco grave e iminente para sua vida ou saúde. Deve avisar imediatamente o seu superior. A empresa não pode exigir o retorno antes da correção da situação. O trabalhador não pode sofrer consequências injustas por essa interrupção (NR-01, itens 1.4.3, 1.4.3.1 e 1.4.3.2).';
const OS_ACIDENTE = 'Em caso de acidente, mal-estar ou risco grave para você ou para outras pessoas, pare a atividade e avise imediatamente o superior.';
const OS_CIENCIA = 'Declaro que recebi, li e entendi esta Ordem de Serviço e as orientações nela contidas.';
const EPI_TERMO = 'Recebi gratuitamente os EPI listados, em perfeito estado de conservação e funcionamento. Fui orientado sobre o risco contra o qual cada EPI protege, os limites de proteção, o uso e o ajuste corretos, a manutenção e a substituição, a limpeza, a higienização, a guarda e a conservação (NR-06, item 6.5.1, alíneas b e c, e item 6.7.2). Comprometo-me a (NR-06, item 6.6.1):';
const EPI_DEVERES = ['Usar o EPI fornecido pela empresa.', 'Usar o EPI apenas para a finalidade a que se destina.', 'Cuidar da limpeza, da guarda e da conservação.', 'Avisar a empresa quando o EPI for extraviado, danificado ou ficar impróprio para uso.', 'Cumprir as orientações da empresa sobre o uso adequado.'];
const EPI_FALTA = 'Estou ciente de que a recusa injustificada ao uso do EPI constitui ato faltoso (NR-01, itens 1.4.2, alínea d, e 1.4.2.1).';

const SIT_TXT = { emdia: (l) => `válido até ${dataBr(l.vencimento)}`, vence: (l) => `válido até ${dataBr(l.vencimento)}`, vencido: (l) => `VENCIDO em ${dataBr(l.vencimento)}. Providenciar a reciclagem`, semregistro: () => 'indicado para a função, sem registro no GRID', semvalidade: (l) => `concluído${l.conclusao ? ` em ${dataBr(l.conclusao)}` : ''}, sem validade cadastrada` };
const nrDe = (t) => { const m = String(t || '').match(/\bNR[\s-]?0?(\d{1,2})\b/i); return m ? `NR-${m[1].padStart(2, '0')}` : null; };
/** NRs dos treinamentos indicados nos GHE da função (avaliação de campo). Vazio: sem GHE. */
function nrsExigidas(g) {
  const out = new Set();
  ghesDaFuncao(g).forEach((ghe) => (ghe.treinamentos || []).forEach((cod) => { const t = g.D?.catTrein?.get(String(cod)); const nr = nrDe(t?.categoria) || nrDe(t?.nome) || nrDe(cod); if (nr) out.add(nr); }));
  return out;
}
/** Com GHE: só os treinamentos exigidos para a função. Sem GHE: os registrados no GRID. */
function treinosTexto(p, exigidas) {
  return (p.linhas || []).filter((l) => SIT_TXT[l.sit] && (!exigidas.size || l.sit === 'semregistro' || exigidas.has(l.nr))).map((l) => `${l.curso}: ${SIT_TXT[l.sit](l)}`);
}
/** "Protetor auricular · CA 12345" → [{ nome, ca }]. Vírgulas ficam (nome composto). */
export function episDe(texto) {
  return String(texto || '').replace(/\s+·\s+(?=C\.?A\.?\s*(?:n|\d|\[))/gi, ', ').split(/\s+·\s+|;|\s\+\s|\.\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/).map((x) => x.trim().replace(/\.$/, '')).filter(Boolean).flatMap((x) => {
    const m = x.match(/\bC\.?A\.?\s*(?:n[ºo°.]*\s*)?(\d{3,6})\b/i);
    const nome = x.replace(/,?\s*\bC\.?A\.?\s*(?:n[ºo°.]*\s*)?(\d{3,6}|\[[^\]]*\])/i, '').replace(/[,\s]+$/, '').trim();
    return nome && !vazioEpi(nome) ? [{ nome, ca: m ? m[1] : '' }] : [];
  });
}
const comCa = (epi) => { const es = episDe(epi); return es.length ? es.map((e) => `${e.nome}, CA ${e.ca || '[preencher]'}`).join('. ') : ''; };

export function montarPartes(g) {
  if (g.tipo && TIPOS[g.tipo]?.livre) return partesLivre(g);
  const cli = g.fora ? { nome: String(g.fora.empresa || '').trim() || '[preencher]', cnpj: '[preencher]' } : (g.D?.cli || {});
  const _doc = g.fora ? (cli.cnpj ? `CNPJ ${cli.cnpj}` : '') : docClienteTxt(cli, true);   // v287: pessoa física com CPF escondido
  const empresa = `${cli.nome || ''}${_doc ? `, ${_doc}` : ''}`;
  const pessoas = pessoasDe(g);
  const riscos = g.riscos.filter((r) => String(r.risco || '').trim());
  const emerg = String(g.emerg || '').trim();
  const exigidas = nrsExigidas(g);
  return pessoas.map((p) => {
    const setor = p.ghe || '[preencher]';
    if (g.tipo === 'epi') {
      const vistos = new Set();
      const epis = riscos.flatMap((r) => episDe(r.epi)).filter((e) => { const k = norm(e.nome); if (vistos.has(k)) return false; vistos.add(k); return true; });
      return [
        { t: 'titulo', x: 'FICHA DE ENTREGA DE EPI', sub: 'NR-06, item 6.5.1, alínea d' },
        { t: 'campos', itens: [['Empresa', empresa], ['Colaborador', p.nome], ['Função', p.funcao || '[preencher]'], ['Setor ou GHE', setor], ['Matrícula', '[preencher]'], ['Admissão', '[preencher]']] },
        { t: 'tabela', cols: [{ t: 'Data', w: 0.11 }, { t: 'EPI', w: 0.25 }, { t: 'Nº do CA', w: 0.11 }, { t: 'Qtde', w: 0.07 }, { t: 'Motivo', w: 0.14 }, { t: 'Devolução ou troca', w: 0.13 }, { t: 'Assinatura', w: 0.19 }],
          linhas: epis.map((e) => ['', e.nome, e.ca || '[preencher]', '', '', '', '']), vazias: Math.max(3, 10 - epis.length) },
        { t: 'p', x: 'Motivo: primeira entrega, troca por dano, extravio, desgaste ou validade.' },
        { t: 'h', x: 'TERMO DE RESPONSABILIDADE' },
        { t: 'p', x: EPI_TERMO }, ...EPI_DEVERES.map((x) => ({ t: 'li', x })), { t: 'p', x: EPI_FALTA },
        { t: 'campos', itens: [['Local e data', '[preencher]']] },
        { t: 'assin', nomes: [p.fora ? 'Colaborador' : p.nome, 'Responsável pela entrega'] },
      ];
    }
    const treinos = treinosTexto(p, exigidas);
    return [
      { t: 'titulo', x: 'ORDEM DE SERVIÇO DE SEGURANÇA E SAÚDE NO TRABALHO', sub: 'NR-01, item 1.4.1, alínea c' },
      { t: 'campos', itens: [['Empresa', empresa], ['Colaborador', p.nome], ['Função', p.funcao || '[preencher]'], ['Setor ou GHE', setor]] },
      { t: 'h', x: 'OBJETIVO' }, { t: 'p', x: OS_OBJETIVO },
      { t: 'h', x: 'RISCOS DA FUNÇÃO E MEDIDAS DE PREVENÇÃO' },
      riscos.length
        ? { t: 'tabela', cols: [{ t: 'Risco', w: 0.2 }, { t: 'Fonte', w: 0.18 }, { t: 'Proteção coletiva', w: 0.2 }, { t: 'Medidas administrativas', w: 0.21 }, { t: 'EPI', w: 0.21 }], linhas: riscos.map((r) => [r.risco, r.fonte, r.epc, r.adm, comCa(r.epi)]) }
        : { t: 'p', x: '[preencher com os riscos da função e as medidas de prevenção]' },
      { t: 'h', x: exigidas.size ? 'TREINAMENTOS EXIGIDOS PARA A FUNÇÃO' : p.fora ? 'TREINAMENTOS' : 'TREINAMENTOS REGISTRADOS NO GRID' },
      ...(treinos.length ? treinos.map((x) => ({ t: 'li', x })) : [{ t: 'p', x: p.fora ? '[preencher com os treinamentos exigidos para a função e as datas]' : exigidas.size ? 'Nenhum registro no GRID dos treinamentos exigidos. [preencher]' : 'Nenhum treinamento registrado no GRID para esta pessoa. [preencher]' }]),
      { t: 'h', x: 'DEVERES DO EMPREGADO (NR-01, ITEM 1.4.2)' }, ...OS_DEVERES.map((x) => ({ t: 'li', x })), { t: 'p', x: OS_FALTA },
      { t: 'h', x: 'DIREITO DE INTERROMPER A ATIVIDADE' }, { t: 'p', x: OS_INTERROMPER },
      { t: 'h', x: 'EM CASO DE EMERGÊNCIA OU ACIDENTE' }, { t: 'p', x: OS_ACIDENTE }, { t: 'p', x: emerg || 'Procedimento de emergência da empresa: [preencher]' },
      { t: 'h', x: 'CIÊNCIA DO TRABALHADOR' }, { t: 'p', x: OS_CIENCIA }, { t: 'campos', itens: [['Local e data', '[preencher]']] },
      { t: 'assin', nomes: [p.fora ? 'Colaborador' : p.nome, 'Responsável pela empresa'] },
    ];
  });
}

/* ── Tela ───────────────────────────────────────────────────────────────── */
const chev = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';
const sel = (t, campo, rotulo, opcoes, atual, vazio) => `<label class="lq-doc-sel"><small>${rotulo}</small><span class="lq-doc-selw"><select data-acao="campo:lq-g-sel:${t}.${campo}" aria-label="${esc(rotulo)}">${vazio ? `<option value="">${esc(vazio)}</option>` : ''}${opcoes}</select>${chev}</span></label>`;
const opt = (v, l, atual) => `<option value="${esc(v)}"${v === atual ? ' selected' : ''}>${esc(l)}</option>`;
const li = (k, t, s) => `<li><i class="${k}" aria-hidden="true">${k === 'ok' ? '✓' : '!'}</i><div>${t}${s ? `<small>${s}</small>` : ''}</div></li>`;
const cab = (titulo, sub) => `<header class="lq-ver"><span class="lq-selo"><i></i>Documento</span><div><h3>${esc(titulo)}</h3>${sub ? `<p>${esc(sub)}</p>` : ''}</div></header>`;
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

export function render(turno, t) {
  const g = turno.gerar;
  if (g.etapa === 'carregando') return `<article class="lq-resp lq-carr" aria-live="polite"><div><b>Lendo os dados do GRID</b><small>Empresas, pessoas e treinamentos.</small></div></article>`;
  if (g.etapa === 'erro') return `<article class="lq-resp lq-falha"><div><b>${esc(g.erro)}</b><button type="button" class="btn btn-outline btn-sm" data-acao="campo:lq-g:${t}.de-novo">Tentar de novo</button></div></article>`;
  if (!g.tipo) return qual(g, t);
  const T = TIPOS[g.tipo];
  if (T.livre) return renderLivre(g, t);
  const cli = (g.clientes || []).find((c) => c.id === g.clienteId);
  const foraOk = g.tipo === 'os' || g.tipo === 'epi';
  const empresaSel = sel(t, 'empresa', 'Empresa', (g.clientes || []).map((c) => opt(c.id, c.nome, g.clienteId)).join('') + (foraOk ? `<option value="__fora"${g.fora ? ' selected' : ''}>Outra empresa (fora do GRID)</option>` : ''), g.fora ? '__fora' : g.clienteId, 'Escolha a empresa');
  if (g.fora) return `<article class="lq-resp lq-r2 lq-gerar">${cab(tituloDoc(g), [String(g.fora.empresa || '').trim() || 'Empresa fora do GRID', T.ref].join(' · '))}${corpoFora(g, t, empresaSel)}</article>`;
  if (!g.clientes?.length && !foraOk) return `<article class="lq-resp lq-r2">${cab(T.nome, T.ref)}<p class="lq-doc-nota">Nenhuma empresa ativa cadastrada no GRID ainda.</p></article>`;
  let corpo = '';
  if (!g.clienteId) corpo = `<div class="lq-doc-para">${empresaSel}</div><p class="lq-doc-nota">${g.foraSugerida && foraOk ? `Não achei "${esc(g.foraSugerida)}" no GRID. <button type="button" class="lq-lnk" data-acao="campo:lq-g:${t}.fora-usar">Fazer para empresa fora do GRID</button> ou escolha uma empresa da lista.` : `Escolha a empresa para o Laudomiro montar ${g.tipo === 'lista' ? 'a lista' : 'o documento'}.${foraOk ? ' Para empresa que não está no GRID, escolha "Outra empresa".' : ''}`}</p>`;
  else if (g.lendo) corpo = `<div class="lq-doc-para">${empresaSel}</div><p class="lq-doc-nota" aria-live="polite">Lendo os dados de ${esc(cli?.nome || 'empresa')}...</p>`;
  else if (g.tipo === 'lista') corpo = corpoLista(g, t, empresaSel);
  else if (g.tipo === 'dossie') corpo = corpoDossie(g, t, empresaSel);
  else corpo = corpoDoc(g, t, empresaSel);
  const titulo = g.tipo === 'os' || g.tipo === 'epi' ? tituloDoc(g) : T.nome;
  return `<article class="lq-resp lq-r2 lq-gerar">${cab(titulo, [cli?.nome, T.ref].filter(Boolean).join(' · '))}${corpo}</article>`;
}
function tituloDoc(g) {
  const T = TIPOS[g.tipo];
  if (g.fora) return `${T.nome}${funcaoDe(g) ? `, função ${funcaoDe(g)}` : ''}`;
  if (!g.para) return T.nome;
  if (g.para.startsWith('p:')) { const c = (g.D?.colabs || []).find((x) => x.id === g.para.slice(2)); return `${T.nome}${c ? ` de ${c.nome}` : ''}`; }
  return `${T.nome}, função ${g.para.slice(2)}`;
}

function qual(g, t) {
  const op = (k) => `<button type="button" data-acao="campo:lq-g:${t}.tipo.${k}"><span class="ic">${IC[k]}</span><span><b>${TIPOS[k].nome}</b><small>${TIPOS[k].sub}</small></span>${IC.ch}</button>`;
  const cli = melhor(g.clientes || [], g.texto, 'nome');
  return `<article class="lq-resp lq-r2 lq-gerar">${cab('Qual documento você quer?', `${cli ? cli.nome + ' · ' : ''}com os dados do GRID quando houver`)}
    <div class="lq-qual lq-qual2">${['os', 'epi', 'apr', 'pt', 'checklist', 'procedimento', 'lista', 'dossie'].map(op).join('')}</div>
    <p class="lq-doc-nota">Para empresa do GRID ou qualquer outra. Você também pode pedir direto, por exemplo "APR para troca de telhas", "checklist da NR-12 para prensa" ou "OS do soldador da empresa X".</p></article>`;
}

function corpoLista(g, t, empresaSel) {
  const ts = g.turmas || [];
  if (!ts.length) return `<div class="lq-doc-para">${empresaSel}</div><p class="lq-doc-nota">Esta empresa não tem turma no GRID. A lista de presença sai de uma turma.</p>`;
  const rot = (x) => [x.catalogo?.nome || 'Turma', x.data_inicio ? dataBr(x.data_inicio) : 'sem encontro', x.protocolo].filter(Boolean).join(' · ');
  const turma = ts.find((x) => x.id === g.turmaId);
  const ses = turma?.sessoes || [];
  return `<div class="lq-doc-para">${empresaSel}${sel(t, 'turma', 'Turma', ts.map((x) => opt(x.id, rot(x), g.turmaId)).join(''), g.turmaId, 'Escolha a turma')}
    ${ses.length > 1 ? sel(t, 'sessao', 'Encontro', ses.map((s, i) => opt(s.id, `${i + 1}º encontro · ${dataBr(s.data)}${s.hora_inicio ? ' às ' + String(s.hora_inicio).slice(0, 5) : ''}`, g.sessaoId)).join(''), g.sessaoId) : ''}</div>
    ${!turma ? '<p class="lq-doc-nota">Escolha a turma. As mais recentes aparecem primeiro.</p>' : ''}
    ${turma && !ses.length ? '<p class="lq-doc-nota">Esta turma ainda não tem encontro agendado. Agende um encontro na turma para gerar a lista.</p>' : ''}
    ${turma && ses.length ? `<p class="lq-doc-nota">A mesma lista que o GRID gera na turma, com o instrutor e o local do encontro.</p>
    <div class="lq-doc-acts"><button type="button" class="btn btn-amber" data-acao="campo:lq-g:${t}.lista.coleta">Em branco para assinar</button>${listaFinal(turma, g.sessaoId) ? `<button type="button" class="btn btn-outline" data-acao="campo:lq-g:${t}.lista.final">Com a presença registrada</button>` : ''}</div>
    ${listaFinal(turma, g.sessaoId) ? '' : '<p class="lq-doc-nota">A lista com a presença registrada sai quando o encontro for concluído na turma.</p>'}` : ''}`;
}
/** A lista "final" é a oficial do encontro: só depois de concluído (mesma regra da tela da turma). */
function listaFinal(turma, sessaoId) {
  const s = (turma?.sessoes || []).find((x) => x.id === sessaoId);
  return !!turma && (turma.status === 'concluida' || !!s?.concluida);
}

function corpoDossie(g, t, empresaSel) {
  const pode = typeof window._podeAcao !== 'function' || window._podeAcao('exportar_relatorios');
  const ops = (g.D?.colabs || []).filter((c) => !g.desligados?.has(c.id)).map((c) => opt(`p:${c.id}`, `${c.nome}${c.cargo ? ' · ' + c.cargo : ''}`, g.para)).join('');
  return `<div class="lq-doc-para">${empresaSel}${sel(t, 'para', 'Para quem', `<option value=""${!g.para ? ' selected' : ''}>A empresa inteira</option><optgroup label="Uma pessoa">${ops}</optgroup>`, g.para)}</div>
    <p class="lq-doc-nota">O dossiê abre com as duas opções: para entregar ao fiscal ou para conferência interna.</p>
    <div class="lq-doc-acts">${pode ? `<button type="button" class="btn btn-amber" data-acao="campo:lq-g:${t}.dossie">Abrir o dossiê</button>` : '<p class="lq-doc-nota">Seu perfil de acesso não inclui exportar relatórios. Peça ao administrador.</p>'}</div>`;
}

function corpoDoc(g, t, empresaSel) {
  const cargos = cargosDe(g);
  const colabs = (g.D?.colabs || []).filter((c) => !g.desligados?.has(c.id));
  const paraOps = `${cargos.length ? `<optgroup label="Uma função, um documento por pessoa">${cargos.map((c) => opt(`f:${c.cargo}`, `${c.cargo} (${plural(c.n, 'pessoa', 'pessoas')})`, g.para)).join('')}</optgroup>` : ''}<optgroup label="Uma pessoa">${colabs.map((c) => opt(`p:${c.id}`, `${c.nome}${c.cargo ? ' · ' + c.cargo : ''}`, g.para)).join('')}</optgroup>`;
  const topo = `<div class="lq-doc-para">${empresaSel}${sel(t, 'para', 'Para quem', paraOps, g.para, 'Escolha a função ou a pessoa')}</div>`;
  if (!colabs.length) return `${topo}<p class="lq-doc-nota">Esta empresa não tem colaboradores cadastrados no GRID.</p>`;
  if (!g.para) return `${topo}<p class="lq-doc-nota">Escolha a função (um documento por pessoa) ou uma pessoa.</p>`;
  const pessoas = pessoasDe(g);
  if (!pessoas.length) return `${topo}<p class="lq-doc-nota">Ninguém ativo nesta função.</p>`;
  const nMais = (g.para.startsWith('f:') ? (colabs.filter((c) => norm(c.cargo) === norm(g.para.slice(2))).length) : 1) > MAX_PESSOAS;
  const partes = montarPartes(g);
  return `${topo}<div class="lq-doc-b"><div>
    <p class="lq-doc-h">${g.tipo === 'epi' ? 'EPI e de onde vêm' : 'Riscos e medidas'}</p>${blocoRiscos(g, t)}
    <p class="lq-doc-h">${g.tipo === 'epi' ? 'Também entra' : 'Também entra'}</p><ul class="lq-doc-l">${itensExtras(g, t, pessoas)}</ul>
    ${nMais ? `<p class="lq-doc-nota">Vão as primeiras ${MAX_PESSOAS} pessoas desta função. Para as outras, escolha a pessoa.</p>` : ''}
    <p class="lq-doc-nota">${g.origem?.tipo === 'sem' && g.sug?.feita ? 'A sugestão de riscos usou 1 pergunta e só levou o nome da função. ' : ''}Montado no seu aparelho com os dados do GRID. O CPF não sai no documento.</p>
    ${acoesDoc(g, t, pessoas.length)}
  </div>${papel(partes[0], pessoas.length, t)}</div>`;
}

function blocoRiscos(g, t) {
  const o = g.origem || {};
  let aviso = '';
  if (o.tipo === 'ghe') aviso = `<div class="lq-rs-h ok"><span>Do GHE <b>${esc(o.ghes)}</b>${o.visita ? `, avaliação ${esc(o.visita.numero || '')} de ${dataBr(o.visita.data_visita)}` : ''}. Pode ajustar antes de baixar.</span></div>`;
  else if (g.sug?.carregando) aviso = `<div class="lq-rs-h" aria-live="polite">${IC.alerta}<div><b>O Laudomiro está sugerindo os riscos da função ${esc(g.sug.funcao)}.</b> Esta empresa não tem avaliação de campo para esta função.</div></div>`;
  else if (g.sug?.erro) aviso = `<div class="lq-rs-h">${IC.alerta}<div><b>${esc(g.sug.erro)}</b> Você pode escrever os riscos abaixo. <button type="button" class="lq-lnk" data-acao="campo:lq-g:${t}.sugerir">Tentar de novo</button></div></div>`;
  else if (g.sug?.feita) aviso = `<div class="lq-rs-h">${IC.alerta}<div><b>Sugestão do Laudomiro para a função ${esc(g.sug.funcao)}.</b> ${g.sug.vazia ? 'Ele não reconheceu a função. Escreva os riscos abaixo.' : g.fora ? 'Confira, tire ou acrescente antes de baixar.' : 'Esta empresa ainda não tem avaliação de campo para esta função. Confira, tire ou acrescente antes de baixar. Com avaliação, os riscos vêm do GHE.'}</div></div>`;
  else aviso = `<div class="lq-rs-h">${IC.alerta}<div><b>${g.fora ? 'Riscos da função.' : 'Esta função não tem GHE na avaliação de campo.'}</b> ${funcaoDe(g) ? `<button type="button" class="lq-lnk" data-acao="campo:lq-g:${t}.sugerir">Pedir sugestão ao Laudomiro (usa 1 pergunta)</button> ou escreva abaixo.` : 'A pessoa está sem função cadastrada. Escreva os riscos abaixo.'}</div></div>`;
  const linhas = g.riscos.map((r, i) => g.editando === i
    ? `<tr class="ed"><td colspan="3"><div class="lq-rs-ed">
        <label>Risco<input class="cp-inp" data-cp="lq.g.${t}.r.${i}.risco" value="${esc(r.risco)}" placeholder="Ex.: Ruído"></label>
        <label>Fonte<input class="cp-inp" data-cp="lq.g.${t}.r.${i}.fonte" value="${esc(r.fonte)}" placeholder="O que gera o risco"></label>
        <label>Proteção coletiva<input class="cp-inp" data-cp="lq.g.${t}.r.${i}.epc" value="${esc(r.epc)}"></label>
        <label>Medidas administrativas<input class="cp-inp" data-cp="lq.g.${t}.r.${i}.adm" value="${esc(r.adm)}"></label>
        <label class="lg">EPI e CA<input class="cp-inp" data-cp="lq.g.${t}.r.${i}.epi" value="${esc(r.epi)}" placeholder="Ex.: Protetor auricular, CA 12345"></label>
        <button type="button" class="btn btn-navy btn-sm" data-acao="campo:lq-g:${t}.ok-risco">Pronto</button></div></td></tr>`
    : `<tr><td>${esc(r.risco) || '<i>sem nome</i>'}${r.fonte ? `<small>${esc(r.fonte)}</small>` : ''}</td><td>${medidasHtml(r)}</td>
        <td class="x"><button type="button" class="lq-ib" data-acao="campo:lq-g:${t}.editar.${i}" aria-label="Editar ${esc(r.risco || 'risco sem nome')}" title="Editar">${IC.lapis}</button><button type="button" class="lq-ib" data-acao="campo:lq-g:${t}.tirar.${i}" aria-label="Tirar ${esc(r.risco || 'risco sem nome')}" title="Tirar">×</button></td></tr>`).join('');
  return `<div class="lq-rs">${aviso}${g.riscos.length ? `<table><thead><tr><th>Risco e fonte</th><th>Medidas, na ordem: proteção coletiva, administrativas, EPI</th><th><span class="sr-only">Ações</span></th></tr></thead><tbody>${linhas}</tbody></table>` : ''}
    ${g.riscos.length < MAX_RISCOS && !g.sug?.carregando ? `<button type="button" class="lq-rs-add" data-acao="campo:lq-g:${t}.mais">+ Acrescentar risco</button>` : ''}</div>`;
}
function medidasHtml(r) {
  const ps = [r.epc, r.adm].filter((x) => String(x || '').trim()).map(esc);
  if (r.epi) ps.push(esc(comCa(r.epi)).replace(/\[preencher\]/g, '<span class="y">[preencher]</span>'));
  return ps.length ? ps.join('. ') : '<span class="y">[preencher]</span>';
}

function itensExtras(g, t, pessoas) {
  const out = [];
  if (g.tipo === 'os') {
    const venc = pessoas.flatMap((p) => p.linhas.filter((l) => l.sit === 'vencido' || l.sit === 'semregistro').map((l) => ({ p, l })));
    const emdia = pessoas.filter((p) => !p.linhas.some((l) => l.sit === 'vencido' || l.sit === 'semregistro')).length;
    const sub = venc.length
      ? `${emdia ? `${plural(emdia, 'pessoa em dia', 'pessoas em dia')}. ` : ''}${venc.slice(0, 3).map(({ p, l }) => `<span class="lq-vencm">${esc(p.nome)}: ${esc(l.nr || l.curso)} ${l.sit === 'vencido' ? `vencido em ${dataBr(l.vencimento)}` : 'sem registro'}</span>`).join(' ')}${venc.length > 3 ? ` e mais ${venc.length - 3}` : ''}. Sai marcado no documento de cada um`
      : 'Todos em dia no GRID';
    out.push(li('ok', 'Treinamentos de cada pessoa, com a validade', sub));
    out.push(li('ok', 'Deveres do empregado, direito de interromper a atividade e ciência', 'Texto da NR-01, itens 1.4.2 a 1.4.4'));
    out.push(emergItem(g, t));
  } else {
    out.push(li('ok', 'Empresa, função e GHE de cada pessoa', g.origem?.tipo === 'ghe' ? `GHE ${esc(g.origem.ghes)}` : 'Setor ou GHE sai como [preencher] quando não há avaliação'));
    out.push(li('ok', 'Tabela com data, EPI, CA, quantidade, motivo, devolução e assinatura', 'Os EPI acima já entram nas primeiras linhas. O resto fica em branco'));
    out.push(li('ok', 'Termo de responsabilidade do trabalhador', 'Texto da NR-06, item 6.6.1'));
    out.push(li('pr', 'Matrícula e admissão', 'Saem como [preencher]'));
  }
  return out.join('');
}
function emergItem(g, t) {
  if (g.emergAberta) return `<li><i class="pr" aria-hidden="true">!</i><div>Procedimento de emergência da empresa
      <textarea class="cp-inp lq-g-ta" data-cp="lq.g.${t}.emerg" aria-label="Procedimento de emergência da empresa" placeholder="Ex.: Acione o brigadista do setor pelo rádio, canal 2. Telefone do SAMU 192. Ponto de encontro no estacionamento.">${esc(g.emerg)}</textarea>
      <span class="lq-doc-acts mini"><button type="button" class="btn btn-navy btn-sm" data-acao="campo:lq-g:${t}.emerg-guardar">Guardar para esta empresa</button><button type="button" class="btn btn-outline btn-sm" data-acao="campo:lq-g:${t}.emerg-fechar">Usar só neste documento</button></span></div></li>`;
  if (String(g.emerg || '').trim()) return li('ok', 'Procedimento de emergência da empresa', `${esc(String(g.emerg).slice(0, 110))}${String(g.emerg).length > 110 ? '...' : ''} <button type="button" class="lq-lnk" data-acao="campo:lq-g:${t}.emerg-abrir">Mudar</button>`);
  return li('pr', 'Procedimento de emergência da empresa', `Sai como [preencher]. <button type="button" class="lq-lnk" data-acao="campo:lq-g:${t}.emerg-abrir">Escrever agora</button>, o GRID guarda para as próximas`);
}

function acoesDoc(g, t, n) {
  const ocupado = g.sug?.carregando || g.editando >= 0;
  const qtd = n > 1 ? ` com ${n} ${g.tipo === 'epi' ? 'fichas' : 'OS'}, uma por pessoa` : '';
  const botoes = `<div class="lq-doc-acts"><button type="button" class="btn btn-amber" data-acao="campo:lq-g:${t}.baixar.pdf"${ocupado ? ' disabled' : ''}>Baixar PDF${qtd}</button><button type="button" class="btn btn-outline" data-acao="campo:lq-g:${t}.baixar.docx"${ocupado ? ' disabled' : ''}>Baixar Word</button></div>`;
  if (!g.baixado || g.fora) return botoes;
  if (g.registro?.feito) return `${botoes}<div class="lq-reg ok" role="status"><div><b>Entrega registrada em ${dataBr(g.registro.data)}</b> para ${plural(g.registro.n, 'pessoa', 'pessoas')}. Aparece na ficha de cada pessoa e no dossiê.</div></div>`;
  return `${botoes}<div class="lq-reg"><div><b>${esc(g.baixado)} baixado.</b> Depois de entregar e colher as assinaturas, registre a entrega. Fica na ficha de cada pessoa e entra no dossiê.</div>
    <label class="lq-reg-d">Data da entrega<input type="date" class="cp-inp" data-cp="lq.g.${t}.regdata" value="${esc(g.regData || hojeIso())}" max="${hojeIso()}"></label>
    <button type="button" class="btn btn-outline btn-sm" data-acao="campo:lq-g:${t}.registrar"${g.registro?.salvando ? ' disabled' : ''}>${g.registro?.salvando ? 'Registrando...' : 'Registrar entrega'}</button></div>`;
}

/* miniatura da 1ª página, feita com as mesmas partes do arquivo */
function papel(partes, n, t) {
  if (!partes) return '';
  const y = (x) => esc(x).replace(/\[([^\]]{1,80})\]/g, '<span class="y">[$1]</span>');
  const html = partes.slice(0, 9).map((b) => {
    if (b.t === 'titulo') return `<div class="t">${esc(b.x)}</div><div class="a"></div>`;
    if (b.t === 'campos') return b.itens.map(([r, v]) => `<b>${esc(r)}:</b> ${y(v)}<br>`).join('') + '<br>';
    if (b.t === 'h') return `<b>${esc(b.x)}</b><br>`;
    if (b.t === 'tabela') return `<table><tr>${b.cols.map((c) => `<th>${esc(c.t)}</th>`).join('')}</tr>${[...b.linhas, ...Array.from({ length: Math.min(3, b.vazias || 0) }, () => b.cols.map(() => ''))].slice(0, 4).map((l) => `<tr>${l.map((x) => `<td>${y(x)}</td>`).join('')}</tr>`).join('')}</table>`;
    if (b.t === 'li') return `- ${y(b.x)}<br>`;
    if (b.t === 'assin') return `<div class="ass">${b.nomes.map((x) => `<div>${esc(x)}</div>`).join('')}</div>`;
    return `<div class="ln"></div><div class="ln" style="width:72%"></div>`;
  }).join('');
  return `<div class="lq-papel-w"><div class="lq-papel" aria-hidden="true">${html}<div class="rod">${esc(Docs.RODAPE_GRID())}</div></div>
    <button type="button" class="lq-papel-ver" data-acao="campo:lq-g:${t}.ver">${n > 1 ? `Ver as ${n} páginas em PDF` : 'Ver a página em PDF'}</button></div>`;
}

/* ── Ações ──────────────────────────────────────────────────────────────── */
export function digitar(chave, valor) {
  const m = /^lq\.g\.(\d+)\.(.+)$/.exec(chave); if (!m) return false;
  const turno = _ctx.turno(+m[1]); const g = turno?.gerar; if (!g) return true;
  const r = /^r\.(\d+)\.(risco|fonte|epc|adm|epi)$/.exec(m[2]);
  if (r && g.riscos[+r[1]]) { g.riscos[+r[1]][r[2]] = String(valor).slice(0, 200); g.riscos[+r[1]].origem = g.riscos[+r[1]].origem === 'manual' ? 'manual' : 'editado'; }
  else if (m[2] === 'emerg') g.emerg = String(valor).slice(0, 1500);
  else if (m[2] === 'regdata') g.regData = valor;
  else if (m[2] === 'fora.empresa' && g.fora) g.fora.empresa = String(valor).slice(0, 120);
  else if (m[2] === 'fora.funcao' && g.fora) g.fora.funcaoDigitada = String(valor).slice(0, 80);
  else if (m[2] === 'dl.atividade' && g.dl) g.dl.atividade = String(valor).slice(0, 200);
  else if (m[2] === 'dl.empresa' && g.dl) g.dl.empresa = String(valor).slice(0, 120);
  else if (m[2] === 'dl.ajuste' && g.dl) g.dl.ajuste = String(valor).slice(0, 300);
  return true;
}

export async function acao(nome, valor, redesenhar) {
  if (nome === 'campo:lq-g-sel') {
    const [ref, ...v] = String(valor).split(':'); const val = v.join(':');
    const [ti, campo] = ref.split('.'); const turno = _ctx.turno(+ti); const g = turno?.gerar; if (!g) return true;
    if (campo === 'empresa') {
      if (val === '__fora') { const ex = extrairPedido(g.texto); g.clienteId = ''; g.req = (g.req || 0) + 1; usarFora(turno, ex.empresa || '', ex.funcao || ''); redesenhar(); return true; }
      g.fora = null; await escolherEmpresa(turno, val, !g.paraManual); redesenhar(); return true;
    }
    if (campo === 'para') { g.para = val; g.paraManual = true; g.baixado = null; g.registro = null; if (g.tipo !== 'dossie') { redesenhar(); await prepararRiscos(turno); } redesenhar(); return true; }
    if (campo === 'turma') { escolherTurma(g, val); redesenhar(); return true; }
    if (campo === 'sessao') { g.sessaoId = val; redesenhar(); return true; }
    return true;
  }
  if (nome !== 'campo:lq-g') return false;
  const [ti, op, arg] = String(valor).split('.');
  const turno = _ctx.turno(+ti); const g = turno?.gerar; if (!g) return true;
  if (op === 'de-novo') { g.etapa = 'carregando'; redesenhar(); iniciar(turno); return true; }
  if (op === 'tipo' && TIPOS[arg]) {
    g.tipo = arg; redesenhar();
    const c = melhor(g.clientes || [], g.texto, 'nome');
    if (TIPOS[arg].livre) { iniciarLivre(turno, c); return true; }
    if (c) { await escolherEmpresa(turno, c.id, true); redesenhar(); }
    return true;
  }
  if (op === 'sugerir') { const f = funcaoDe(g); if (f && !g.sug?.carregando) sugerir(turno, f); return true; }
  if (op === 'fora-funcao') {   // v286: função digitada (empresa fora do GRID)
    const f = String(g.fora?.funcaoDigitada ?? g.fora?.funcao ?? '').trim();
    if (!g.fora || f.length < 3) { avisar('Escreva a função.', 'erro'); return true; }
    if (g.sug?.carregando) return true;   // clique duplo não gasta 2 perguntas
    g.fora.funcao = f; g.riscosFuncao = null; g.autoUsado = true; g.baixado = null; prepararRiscos(turno);
    if (!g.sugCache?.[norm(f)]) sugerir(turno, f);   // pedido explícito do técnico
    redesenhar(); return true;
  }
  if (op === 'fora-usar') { usarFora(turno, g.foraSugerida || '', extrairPedido(g.texto).funcao || ''); redesenhar(); return true; }
  if (op === 'montar') { montarLivre(turno, false); return true; }
  if (op === 'ajuste-abrir') { if (g.dl) { g.dl.ajusteAberto = true; redesenhar(); setTimeout(() => [...document.querySelectorAll(`[data-cp="lq.g.${ti}.dl.ajuste"]`)].find((x) => x.getBoundingClientRect().width > 0)?.focus(), 60); } return true; }
  if (op === 'ajuste-fechar') { if (g.dl) { g.dl.ajusteAberto = false; redesenhar(); } return true; }
  if (op === 'ajuste-enviar') { montarLivre(turno, true); return true; }
  if (op === 'editar') { g.editando = +arg; redesenhar(); focar(ti, +arg); return true; }
  if (op === 'ok-risco') {
    const i = g.editando;
    if (i >= 0 && !String(g.riscos[i]?.risco || '').trim()) g.riscos.splice(i, 1);
    g.editando = -1; g.baixado = null; redesenhar();
    setTimeout(() => [...document.querySelectorAll(`[data-acao="campo:lq-g:${ti}.editar.${i}"], [data-acao="campo:lq-g:${ti}.mais"]`)].find((x) => x.getBoundingClientRect().width > 0)?.focus(), 60);
    return true;
  }
  if (op === 'tirar') { g.riscos.splice(+arg, 1); g.editando = -1; g.baixado = null; redesenhar(); return true; }
  if (op === 'mais') { if (g.riscos.length < MAX_RISCOS) { g.riscos.push({ risco: '', fonte: '', epc: '', adm: '', epi: '', origem: 'manual' }); g.editando = g.riscos.length - 1; } redesenhar(); focar(ti, g.editando); return true; }
  if (op === 'emerg-abrir') { g.emergAberta = true; redesenhar(); setTimeout(() => [...document.querySelectorAll(`[data-cp="lq.g.${ti}.emerg"]`)].find((x) => x.getBoundingClientRect().width > 0)?.focus(), 60); return true; }
  if (op === 'emerg-fechar') { g.emergAberta = false; redesenhar(); return true; }
  if (op === 'emerg-guardar') { await guardarEmergencia(g); redesenhar(); return true; }
  if (op === 'baixar' || op === 'ver') {
    if (g.editando >= 0 || g.sug?.carregando || g.baixando || g.dl?.carregando) return true;
    g.baixando = true;
    try { await baixarOuVer(g, op, arg); } finally { g.baixando = false; }
    redesenhar(); return true;
  }
  if (op === 'registrar') { await registrar(g); redesenhar(); return true; }
  return acaoResto(g, op, arg, ti, redesenhar);
}
async function baixarOuVer(g, op, arg) {
  {
    const docs = montarPartes(g);
    if (!docs.length) { avisar('Escolha a função ou a pessoa.', 'erro'); return true; }
    const T = TIPOS[g.tipo], cli = g.dl ? (g.dl.empresa || '') : g.fora ? (g.fora.empresa || '') : (g.D?.cli?.nome || '');
    try {
      if (op === 'ver') {
        const blob = await Docs.pdfPartes(docs);
        const url = URL.createObjectURL(blob);
        const w = window.open(url, '_blank');
        if (!w) { avisar('O navegador bloqueou a nova aba. Use Baixar PDF.', 'erro'); }
        setTimeout(() => URL.revokeObjectURL(url), 120000);
        return true;
      }
      await Docs.baixarPartes(arg === 'pdf' ? 'pdf' : 'docx', T.livre ? `${T.nome.split(',')[0]} ${g.dl?.res?.titulo_atividade || g.dl?.atividade || ''}` : `${T.nome} ${funcaoDe(g) || ''} ${cli}`, docs);
      g.baixado = `${arg === 'pdf' ? 'PDF' : 'Word'}${docs.length > 1 ? ` com ${docs.length} ${g.tipo === 'epi' ? 'fichas' : 'OS'}` : ''}`;
      g.registro = null;
    } catch (e) { avisar(e?.message || 'Não foi possível montar o arquivo.', 'erro'); }
  }
}
async function acaoResto(g, op, arg, ti, redesenhar) {
  if (op === 'lista') {
    if (typeof window.gerarListaPresenca !== 'function' || !g.turmaId || !g.sessaoId) return true;
    const turmaL = (g.turmas || []).find((x) => x.id === g.turmaId);
    const modo = arg === 'final' && listaFinal(turmaL, g.sessaoId) ? 'final' : 'coleta';
    await window.gerarListaPresenca(g.turmaId, g.sessaoId, true, { modo });
    return true;
  }
  if (op === 'dossie') {
    if (typeof window.abrirDossie !== 'function' || !g.clienteId) return true;
    await window.abrirDossie(g.clienteId, g.para.startsWith('p:') ? g.para.slice(2) : undefined);
    return true;
  }
  return true;
}
function focar(ti, i) { setTimeout(() => [...document.querySelectorAll(`[data-cp="lq.g.${ti}.r.${i}.risco"]`)].find((x) => x.getBoundingClientRect().width > 0)?.focus(), 60); }

async function registrar(g) {
  const pessoas = pessoasDe(g);
  if (!pessoas.length || g.registro?.salvando) return;
  const data = /^\d{4}-\d{2}-\d{2}$/.test(g.regData || '') && g.regData <= hojeIso() ? g.regData : hojeIso();
  g.registro = { salvando: true };
  try {
    const linhas = pessoas.map((p) => ({ org_id: sessao.orgId(), cliente_id: g.clienteId, colaborador_id: p.id, tipo: g.tipo === 'epi' ? 'ficha_epi' : 'ordem_servico', entregue_em: data, funcao: p.funcao || null }));
    const { error } = await sb().from('doc_entregas').insert(linhas);
    if (error) throw error;
    g.registro = { feito: true, data, n: linhas.length };
  } catch (e) {
    g.registro = null;
    avisar(semTabela(e) ? 'Falta um passo no banco para registrar a entrega. Avise o administrador do GRID.'
      : /42501|row-level security|permission/i.test(`${e?.code || ''} ${e?.message || ''}`) ? 'Seu perfil de acesso não permite registrar a entrega. Peça ao administrador.'
        : 'Não foi possível registrar agora. Confira a internet e tente de novo.', 'erro');
  }
}

/* ══ v286: empresa fora do GRID e documentos livres ══════════════════════════ */
const maiusc1 = (x) => (x ? x[0].toUpperCase() + x.slice(1) : x);
/** Do pedido: empresa ("da Serralheria Bom Jesus"), função ("do soldador") e a atividade (o que vem depois do nome do documento). */
export function extrairPedido(texto) {
  const orig = String(texto || '').trim().replace(/[.!]+$/, '');
  const out = { empresa: '', funcao: '', atividade: '' };
  const emp = /\b(?:da|do|na|no|para a|para o|pra|pro)\s+(?:empresa\s+)?((?:[A-ZÀ-Ú0-9][\wÀ-ú&.'-]*)(?:\s+(?:[A-ZÀ-Ú0-9][\wÀ-ú&.'-]*|de|da|do|das|dos|e|&))*)\s*$/.exec(orig);
  if (emp && !/^(NR|OS|APR|PT|EPI)\b/.test(emp[1]) && emp[1].length >= 3) out.empresa = emp[1].replace(/\s+(de|da|do|das|dos|e)$/i, '').trim();
  const semEmp = out.empresa ? orig.slice(0, emp.index) : orig;
  const fun = /\b(?:do|da|dos|das|de|para o|para a|para os|para as|pro|pra)\s+([a-zà-ú][a-zà-ú]+(?:\s+(?:de|da|do)\s+[a-zà-ú]+)?)\s*$/i.exec(semEmp);
  if (fun && !/^(empresa|funcao|setor|trabalho|servico|fulano|epi|epis|os|apr|pt|checklist|documento|ficha|lista)$/i.test(semAc(fun[1])) && !/^[A-ZÀ-Ú]/.test(fun[1].trim())) out.funcao = maiusc1(fun[1].split(' ').map((w, i) => (i === 0 ? raiz(semAc(w)) === semAc(w) ? w : w.replace(/(ores|eres|ões|ães|es|s)$/i, (m) => ({ ores: 'or', eres: 'er', 'ões': 'ão', 'ães': 'ão' }[m.toLowerCase()] ?? '')) : w)).join(' '));
  // atividade: o que vem depois do nome do documento livre
  const t = semAc(orig);
  const k = /\b(apr|analise preliminar de risco|permiss(?:ao|oes) de trabalho|pt|check ?-?lists?|lista de verificacao|roteiro de inspecao|procedimentos?(?: operacional| de trabalho(?: seguro)?)?|pop|instrucao de trabalho)\b/.exec(t);
  if (k) out.atividade = orig.slice(k.index + k[0].length).replace(/^[\s,:]+/, '').replace(/^(?:(?:para|pra|de|do|da|dos|das|sobre|na|no|em|o|a|os|as|um|uma)\s+)+/i, '').trim().slice(0, 200);
  return out;
}
function usarFora(turno, empresa, funcao) {
  const g = turno.gerar;
  g.req = (g.req || 0) + 1;   // leitura de empresa do GRID em andamento não vale mais
  // a função vem preenchida, mas só é usada (e a sugestão só gasta pergunta) quando o técnico confirma
  Object.assign(g, { fora: { empresa, funcao: '', funcaoDigitada: funcao }, clienteId: '', D: null, para: '', riscos: [], riscosFuncao: null, sug: null, editando: -1, baixado: null, registro: null, emerg: '', emergSalva: '', emergAberta: false, lendo: false, autoUsado: true });
}
function corpoFora(g, t, empresaSel) {
  const inp = (k, v, rot, ph) => `<label class="lq-doc-sel"><small>${rot}</small><input class="cp-inp lq-doc-inp" data-cp="lq.g.${t}.${k}" value="${esc(v || '')}" placeholder="${esc(ph)}" aria-label="${esc(rot)}"></label>`;
  const f = funcaoDe(g);
  const topo = `<div class="lq-doc-para">${empresaSel}</div>
    <div class="lq-doc-para">${inp('fora.empresa', g.fora.empresa, 'Nome da empresa', 'Ex.: Serralheria Bom Jesus')}${inp('fora.funcao', g.fora.funcaoDigitada ?? g.fora.funcao, 'Função', 'Ex.: Soldador')}</div>
    <div class="lq-doc-acts mini" style="margin:-8px 0 14px"><button type="button" class="btn ${f ? 'btn-outline' : 'btn-amber'} btn-sm" data-acao="campo:lq-g:${t}.fora-funcao"${g.sug?.carregando ? ' disabled' : ''}>${f ? 'Trocar a função e sugerir riscos' : 'Sugerir riscos desta função'} (usa 1 pergunta)</button></div>
    <p class="lq-doc-nota" style="margin:-4px 0 16px">Empresa fora do GRID. O documento sai com CNPJ, colaborador e setor para preencher.</p>`;
  if (!f) return `${topo}<p class="lq-doc-nota">Confira a função e toque em Sugerir riscos. Só o nome da função vai para o Laudomiro.</p>`;
  const partes = montarPartes(g);
  const itens = g.tipo === 'os'
    ? [li('ok', 'Deveres do empregado, direito de interromper a atividade e ciência', 'Texto da NR-01, itens 1.4.2 a 1.4.4'), li('pr', 'Empresa, colaborador, setor, treinamentos e emergência', 'Saem como [preencher]'), emergItemFora(g, t)]
    : [li('ok', 'Tabela com data, EPI, CA, quantidade, motivo, devolução e assinatura', 'Os EPI acima já entram nas primeiras linhas'), li('ok', 'Termo de responsabilidade do trabalhador', 'Texto da NR-06, item 6.6.1'), li('pr', 'Colaborador, setor, matrícula e admissão', 'Saem como [preencher]')];
  return `${topo}<div class="lq-doc-b"><div>
    <p class="lq-doc-h">${g.tipo === 'epi' ? 'EPI e de onde vêm' : 'Riscos e medidas'}</p>${blocoRiscos(g, t)}
    <p class="lq-doc-h">Também entra</p><ul class="lq-doc-l">${itens.join('')}</ul>
    <p class="lq-doc-nota">${g.sug?.feita ? 'A sugestão de riscos usou 1 pergunta e só levou o nome da função. ' : ''}Confira antes de assinar.</p>
    ${acoesDoc(g, t, 1)}
  </div>${papel(partes[0], 1, t)}</div>`;
}
function emergItemFora(g, t) {
  if (g.emergAberta) return `<li><i class="pr" aria-hidden="true">!</i><div>Procedimento de emergência da empresa
      <textarea class="cp-inp lq-g-ta" data-cp="lq.g.${t}.emerg" aria-label="Procedimento de emergência da empresa" placeholder="Ex.: Acione o brigadista do setor. Telefone do SAMU 192. Ponto de encontro no estacionamento.">${esc(g.emerg)}</textarea>
      <span class="lq-doc-acts mini"><button type="button" class="btn btn-navy btn-sm" data-acao="campo:lq-g:${t}.emerg-fechar">Usar neste documento</button></span></div></li>`;
  if (String(g.emerg || '').trim()) return li('ok', 'Procedimento de emergência', `${esc(String(g.emerg).slice(0, 110))} <button type="button" class="lq-lnk" data-acao="campo:lq-g:${t}.emerg-abrir">Mudar</button>`);
  return li('pr', 'Procedimento de emergência', `Sai como [preencher]. <button type="button" class="lq-lnk" data-acao="campo:lq-g:${t}.emerg-abrir">Escrever agora</button>`);
}

/* ── Documentos livres: APR, PT, checklist, procedimento ─────────────────── */
function iniciarLivre(turno, cli) {
  const g = turno.gerar;
  const ex = extrairPedido(g.texto);
  // empresa citada no pedido sai da atividade (vai só para o cabeçalho, no aparelho). A IA recebe só a atividade.
  let atividade = ex.atividade || '';
  const tira = [ex.empresa, cli?.nome].filter(Boolean);
  (g.clientes || []).forEach((c) => { if (c.nome && nota(c.nome, atividade) === 1) tira.push(c.nome); });
  tira.forEach((nome) => { atividade = atividade.replace(new RegExp(`\\s*(?:\\b(?:da|do|na|no|para a|para o|pra|pro|em)\\s+)?(?:empresa\\s+)?${nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'), ''); });
  g.dl = { atividade: atividade.trim().replace(/[,\s]+$/, ''), empresa: cli?.nome || ex.empresa || '', cnpj: (cli?.tipo_pessoa === 'fisica' ? '' : cli?.cnpj) || '', res: null, carregando: false, erro: '', ajuste: '', ajusteAberto: false };
  _ctx.repintar();
}
const ESPACO_CONFINADO = /espacos? confinados?|\bsilos?\b|\bgalerias?\b|(dentro|interior|entrar|limpeza) d[eo]s? tanques?|\bcisternas?\b|\bpocos? de visita\b/;
function bloqueioLivre(g) {
  if (ESPACO_CONFINADO.test(semAc(`${g.dl?.atividade || ''} ${g.dl?.ajuste || ''}`))) return 'Espaço confinado segue a NR-33, que tem modelo próprio de Permissão de Entrada e Trabalho (PET). O Laudomiro ainda não monta documentos de espaço confinado.';
  return '';
}
async function montarLivre(turno, comAjuste) {
  const g = turno.gerar, d = g.dl;
  if (!d || d.carregando) return;
  const atividade = String(d.atividade || '').trim();
  if (atividade.length < 4) { avisar('Descreva a atividade.', 'erro'); return; }
  const bloq = bloqueioLivre(g); if (bloq) { avisar(bloq, 'erro'); return; }
  if (comAjuste && String(d.ajuste || '').trim().length < 3) { avisar('Escreva o que mudar.', 'erro'); return; }
  d.carregando = comAjuste ? 'ajuste' : 'novo'; d.erro = ''; _ctx.repintar();
  try {
    // ajuste vale sobre o documento já montado (mesma atividade). O servidor lê o anterior do banco pelo id.
    const body = { acao: 'doc_livre', tipo: g.tipo, atividade: comAjuste && d.feitoCom ? d.feitoCom : atividade };
    if (comAjuste && d.res) Object.assign(body, { ajuste: String(d.ajuste).trim(), anteriorId: d.id });
    const r = await _ctx.chamar(body);
    if (r.restantes != null) _ctx.aoGastar(r.restantes);
    d.id = r.id;
    d.res = { titulo_atividade: r.titulo_atividade || '', subtipo: r.subtipo || '', secoes: r.secoes || [], referencias: r.referencias || [], avisos: r.avisos || [], conferir: r.conferir || [] };
    d.feitoCom = body.atividade; d.ajusteAberto = false; d.ajuste = ''; g.baixado = null;
  } catch (e) { d.erro = e?.message || 'O Laudomiro não conseguiu montar o documento agora.'; }
  d.carregando = false; _ctx.repintar();
}
const SUBTIPO = { altura: 'Trabalho em altura', eletricidade: 'Eletricidade', quente: 'Trabalho a quente', geral: 'Geral', maquina: 'Máquina', andaime: 'Andaime', escada: 'Escada', extintor: 'Extintor', epi: 'EPI', autopropelida: 'Máquina autopropelida', outro: 'Outro' };
function contagem(s) {
  if (s.formato === 'tabela') return plural(s.linhas.length, 'linha', 'linhas');
  if (s.formato === 'texto') return 'texto';
  return plural(s.itens.length, 'item', 'itens');
}
function renderLivre(g, t) {
  const T = TIPOS[g.tipo], d = g.dl || {};
  const inp = (k, v, rot, ph, lista) => `<label class="lq-doc-sel"><small>${rot}</small><input class="cp-inp lq-doc-inp" data-cp="lq.g.${t}.${k}" value="${esc(v || '')}" placeholder="${esc(ph)}" aria-label="${esc(rot)}"${lista ? ` list="lqgdl${t}"` : ''}></label>`;
  const dl = '';
  const rotAtv = g.tipo === 'checklist' ? 'O que será inspecionado' : 'Atividade';
  const phAtv = { apr: 'Ex.: troca de telhas no galpão', pt: 'Ex.: solda em tubulação no 2º andar', checklist: 'Ex.: prensa hidráulica, andaime fachadeiro', procedimento: 'Ex.: troca de rolamento do motor da esteira' }[g.tipo];
  const mudou = d.res && String(d.atividade || '').trim() !== d.feitoCom;
  const topo = `${dl}<div class="lq-doc-para">${inp('dl.empresa', d.empresa, 'Empresa (do GRID ou qualquer outra)', 'Deixe em branco para preencher depois')}${inp('dl.atividade', d.atividade, rotAtv, phAtv)}</div>
    <p class="lq-doc-nota" style="margin:-8px 0 12px">Só ${g.tipo === 'checklist' ? 'o que será inspecionado' : 'a atividade'} vai para o Laudomiro. Não escreva nome de pessoa nem de empresa nesse campo.</p>`;
  const bloq = bloqueioLivre(g);
  const botaoMontar = bloq ? '' : `<div class="lq-doc-acts mini" style="margin:-8px 0 14px"><button type="button" class="btn ${d.res ? 'btn-outline' : 'btn-amber'} btn-sm" data-acao="campo:lq-g:${t}.montar"${d.carregando ? ' disabled' : ''}>${d.res ? 'Montar de novo com esta atividade' : `Montar ${T.curto}`} (usa 1 pergunta)</button></div>`;
  const cabT = cab(T.nome, [d.res?.titulo_atividade || d.atividade, d.res?.subtipo && SUBTIPO[semAc(d.res.subtipo)]].filter(Boolean).join(' · ') || T.ref);
  let corpo;
  if (bloq) corpo = `<div class="lq-rs"><div class="lq-rs-h">${IC.alerta}<div><b>${esc(bloq)}</b></div></div></div>`;
  else if (d.carregando === 'novo' || (d.carregando && !d.res)) corpo = `<p class="lq-doc-nota" aria-live="polite"><b>Montando ${T.curto}.</b> O Laudomiro consulta as normas e escreve cada parte. Leva até um minuto.</p>`;
  else if (d.erro && !d.res) corpo = `<div class="lq-rs"><div class="lq-rs-h">${IC.alerta}<div><b>${esc(d.erro)}</b></div></div></div>`;
  else if (!d.res) corpo = `<p class="lq-doc-nota">Confira ${g.tipo === 'checklist' ? 'o que será inspecionado' : 'a atividade'} e toque em Montar. Sai com [preencher] no que depende da empresa.</p>`;
  else {
    const r = d.res;
    const itens = r.secoes.map((s) => li('ok', esc(maiusc1(s.titulo.toLowerCase())), contagem(s)));
    (r.avisos || []).forEach((a) => itens.push(li('pr', 'Atenção', esc(a))));
    if (r.conferir?.length) itens.push(li('pr', 'Confira estes números', `${esc(r.conferir.join(', '))}. Não estão nos trechos da norma que o Laudomiro consultou`));
    itens.push(li('pr', 'Empresa, datas, nomes e assinaturas', 'Saem como [preencher]'));
    const partes = partesLivre(g);
    corpo = `<div class="lq-doc-b"><div>
      ${mudou ? '<p class="lq-doc-nota" style="margin:0 0 12px"><b>A atividade mudou.</b> Toque em Montar de novo para refazer o documento.</p>' : ''}
      <p class="lq-doc-h">O Laudomiro montou</p><ul class="lq-doc-l">${itens.join('')}</ul>
      <p class="lq-doc-nota">Usou 1 pergunta. Escrito com a base de normas do Laudomiro. Confira antes de assinar. Não substitui o PGR nem o profissional legalmente habilitado.</p>
      ${d.erro ? `<p class="lq-doc-nota" role="alert"><b>${esc(d.erro)}</b></p>` : ''}
      ${d.ajusteAberto ? `<div class="lq-ajuste"><label class="lq-doc-sel"><small>O que mudar</small><textarea class="cp-inp lq-g-ta" data-cp="lq.g.${t}.dl.ajuste" aria-label="O que mudar no documento" placeholder="Ex.: incluir a etapa de içamento das telhas com corda">${esc(d.ajuste)}</textarea></label>
        <span class="lq-doc-acts mini"><button type="button" class="btn btn-navy btn-sm" data-acao="campo:lq-g:${t}.ajuste-enviar"${d.carregando ? ' disabled' : ''}>${d.carregando === 'ajuste' ? 'Refazendo...' : 'Refazer com o ajuste (usa 1 pergunta)'}</button><button type="button" class="btn btn-outline btn-sm" data-acao="campo:lq-g:${t}.ajuste-fechar">Cancelar</button></span></div>` : ''}
      <div class="lq-doc-acts"><button type="button" class="btn btn-amber" data-acao="campo:lq-g:${t}.baixar.pdf"${d.carregando ? ' disabled' : ''}>Baixar PDF</button><button type="button" class="btn btn-outline" data-acao="campo:lq-g:${t}.baixar.docx"${d.carregando ? ' disabled' : ''}>Baixar Word</button>${d.ajusteAberto ? '' : `<button type="button" class="btn btn-outline" data-acao="campo:lq-g:${t}.ajuste-abrir">Mudar alguma coisa</button>`}</div>
    </div>${papel(partes[0], 1, t)}</div>`;
  }
  return `<article class="lq-resp lq-r2 lq-gerar">${cabT}${topo}${botaoMontar}${corpo}</article>`;
}

/** Documento livre em partes: cabeçalho e assinaturas do roteiro (fixos), seções escritas pela IA. */
export function partesLivre(g) {
  const T = TIPOS[g.tipo], d = g.dl || {}, r = d.res;
  if (!r) return [];
  const P = '[preencher]';
  const emp = String(d.empresa || '').trim();
  const cli = (g.clientes || []).find((c) => norm(c.nome) === norm(emp));
  const empresa = emp || P, cnpj = (cli?.tipo_pessoa === 'fisica' ? docClienteTxt(cli, true).replace(/^CPF /, '') : cli?.cnpj) || P;
  const atividade = r.titulo_atividade || d.atividade || P;
  const sub = SUBTIPO[semAc(r.subtipo || '')] || '';
  const titulo = g.tipo === 'pt' && r.subtipo === 'eletricidade' ? 'PERMISSÃO DE TRABALHO / ORDEM DE SERVIÇO' : T.titulo;
  const out = [{ t: 'titulo', x: titulo, sub: [sub, g.tipo === 'pt' && r.subtipo === 'eletricidade' ? 'NR-10, item 10.11.2' : ''].filter(Boolean).join(' · ') }];
  const campos = {
    apr: [['Empresa', empresa], ['CNPJ', cnpj], ['Unidade ou obra', P], ['Nº da APR', P], ['Data', P], ['Tarefa', atividade], ['Local exato', P], ['Setor', P], ['Equipe executante (nomes e funções)', P], ['Rotineira ou não rotineira', P], ['Responsável pela supervisão', P]],
    pt: [['Empresa', empresa], ['Nº da PT', P], ['Tipo', sub || P], ['Serviço', atividade], ['Data', P], ['Local', P], ['Nº da APR vinculada', P], ['Horário de início', P], ['Horário de término previsto', P], ['Turno', P]],
    checklist: [['Empresa', empresa], ['Nº', P], ['Tipo de inspeção', sub ? `${sub}. ${atividade}` : atividade], ['Data', P], ['Equipamento e identificação (TAG, nº de série ou patrimônio)', P], ['Local', P], ['Inspetor (nome e função)', P], ['Inspeção inicial, rotineira ou periódica', P]],
    procedimento: [['Empresa', empresa], ['Código', P], ['Revisão', '00'], ['Data', P], ['Atividade', atividade]],
  }[g.tipo];
  out.push({ t: 'campos', itens: campos });
  const largAPR = [0.12, 0.14, 0.16, 0.16, 0.26, 0.16];
  r.secoes.forEach((s) => {
    if (g.tipo === 'checklist' && s.formato === 'tabela') {
      out.push({ t: 'h', x: s.titulo });
      const f = s.colunas.findIndex((c) => /base|norma|refer|fundamento/i.test(c)), ib = f < 0 ? 1 : f, ii = f === 0 ? 1 : 0;
      out.push({ t: 'tabela', cols: [{ t: 'Nº', w: 0.05 }, { t: 'Item verificado', w: 0.4 }, { t: 'Sim', w: 0.06 }, { t: 'Não', w: 0.06 }, { t: 'N/A', w: 0.06 }, { t: 'Observação', w: 0.19 }, { t: 'Base', w: 0.18 }],
        linhas: s.linhas.map((l, i) => [String(i + 1), l[ii] || '', '', '', '', '', s.colunas.length > 1 ? (l[ib] || '') : '']) });
      return;
    }
    out.push({ t: 'h', x: s.titulo });
    if (s.formato === 'texto') out.push({ t: 'p', x: s.texto });
    else if (s.formato === 'tabela') {
      const n = s.colunas.length || 1;
      const ws = g.tipo === 'apr' && n === 6 ? largAPR : Array(n).fill(1 / n);
      out.push({ t: 'tabela', cols: s.colunas.map((c, i) => ({ t: c, w: ws[i] })), linhas: s.linhas });
    } else if (s.formato === 'numerada') s.itens.forEach((x, i) => out.push({ t: 'p', x: `${i + 1}. ${x}` }));
    else s.itens.forEach((x) => out.push({ t: 'li', x }));
  });
  const temRef = r.secoes.some((s) => /REFER/.test(s.titulo));
  if (!temRef && r.referencias?.length) { out.push({ t: 'h', x: 'REFERÊNCIAS' }); r.referencias.forEach((x) => out.push({ t: 'li', x })); }
  // partes fixas do roteiro (conferido pelo engenheiro de segurança)
  if (g.tipo === 'apr') {
    out.push({ t: 'h', x: 'TRABALHADORES CONSULTADOS' }, { t: 'tabela', cols: [{ t: 'Nome', w: 0.4 }, { t: 'Função', w: 0.3 }, { t: 'Assinatura', w: 0.3 }], linhas: [], vazias: 4 });
    out.push({ t: 'assin', nomes: ['Elaborado por (nome e função)', 'Aprovado por'] }, { t: 'nota', x: 'Esta APR não substitui o inventário de riscos do PGR.' });
  } else if (g.tipo === 'pt') {
    out.push({ t: 'h', x: 'RELAÇÃO DOS ENVOLVIDOS' }, { t: 'tabela', cols: [{ t: 'Nome', w: 0.3 }, { t: 'Função', w: 0.22 }, { t: 'Autorização ou capacitação', w: 0.26 }, { t: 'Assinatura', w: 0.22 }], linhas: [], vazias: 5 });
    out.push({ t: 'h', x: 'REVALIDAÇÃO' }, { t: 'p', x: 'Só se não mudarem as condições nem a equipe.' }, { t: 'tabela', cols: [{ t: 'Data', w: 0.25 }, { t: 'Hora', w: 0.2 }, { t: 'Assinatura do aprovador', w: 0.55 }], linhas: [], vazias: 2 });
    out.push({ t: 'h', x: 'ENCERRAMENTO' }, { t: 'campos', itens: [['Serviço concluído', 'Sim (   )  Não (   )'], ['Área liberada', 'Sim (   )  Não (   )'], ['Hora', P]] });
    out.push({ t: 'assin', nomes: ['Responsável pela autorização da permissão', 'Responsável pelo encerramento'] }, { t: 'nota', x: 'Validade limitada à duração da atividade, restrita ao turno ou à jornada. Arquivar depois de encerrada, para rastreabilidade.' });
  } else if (g.tipo === 'checklist') {
    out.push({ t: 'p', x: 'Qualquer item marcado Não em item de segurança impede o uso até a correção.' });
    out.push({ t: 'campos', itens: [['Resultado', 'Liberado (   )  Não liberado (   )'], ['Ações corretivas', P]] }, { t: 'assin', nomes: ['Inspetor'] });
  } else if (g.tipo === 'procedimento') {
    out.push({ t: 'h', x: 'QUADRO DE REVISÕES' }, { t: 'tabela', cols: [{ t: 'Revisão', w: 0.15 }, { t: 'Data', w: 0.2 }, { t: 'Descrição da alteração', w: 0.65 }], linhas: [['00', P, 'Emissão inicial']], vazias: 2 });
    out.push({ t: 'assin', nomes: ['Elaborado por (nome e função)', 'Aprovado por (nome, função e registro)'] });
  }
  if (r.avisos?.length) out.push({ t: 'nota', x: r.avisos.join(' ') });
  return [out];
}
