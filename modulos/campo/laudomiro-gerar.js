/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/campo/laudomiro-gerar.js — documentos pedidos no chat (app 284, formulários v295)
   v295: OS, ficha de EPI, PT, APR, checklist e procedimento no formulário novo (cabeçalho padrão,
   linhas em branco, caixas de marcar, assinatura por linha na ficha, P/S/Nível na APR), OS com os
   treinamentos EXIGIDOS pela função e conferência antes do PDF (proposta de 04/11/2026).
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
import { danosDe } from './plano.js';

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
  // v298: lista dos documentos já baixados (número, QR, assinatura, PDF de novo)
  emitidos: { nome: 'Documentos emitidos', ref: 'Número, QR, assinatura e PDF', sub: 'OS, ficha de EPI, PT, APR, checklist e procedimento já baixados' },
};
const LIVRES = ['apr', 'pt', 'checklist', 'procedimento'];
const IC = {
  os: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
  epi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14a8 8 0 0 1 16 0v2H4z"/><path d="M12 6V4M3 18h18"/></svg>',
  lista: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11l2 2 4-4"/><rect x="4" y="3" width="16" height="18" rx="2"/></svg>',
  emitidos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 13h6M15 16l1.5 1.5L19 15"/></svg>',
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
  if (/\bdocumentos? (ja )?emitidos?\b/.test(t)) return { tipo: 'emitidos' };
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
    if (g.tipo === 'emitidos') { g.ls = { cli: c?.id || '', tipo: '', sit: '', busca: '' }; await carregarEmitidos(g); _ctx.repintar(); return; }
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
      g.riscos.push({ risco: r.nome || '', fonte: r.fonte || '', danos: danosDe(r, null) || '', epc: r.epc || '', adm: r.medidas_adm || '', epi: vazioEpi(r.epi) ? '' : r.epi, origem: 'ghe' });
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
    const lista = (r.riscos || []).slice(0, MAX_RISCOS).map((x) => ({ risco: x.risco || '', fonte: x.fonte || '', danos: x.danos || '', epc: x.epc || '', adm: x.adm || '', epi: x.epi || '', origem: 'sug' }));
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

/* ── Textos fixos (conferidos no texto oficial da NR-01 e da NR-06 em 04/11/2026) ── */
const OS_DEVERES = ['Cumprir as normas de segurança e saúde no trabalho, inclusive esta Ordem de Serviço.', 'Fazer os exames médicos previstos nas Normas Regulamentadoras.', 'Colaborar com a empresa na aplicação das Normas Regulamentadoras.', 'Usar o EPI fornecido pela empresa.'];
const OS_FALTA = 'A recusa injustificada em cumprir estes deveres constitui ato faltoso (NR-01, item 1.4.2.1).';
const OS_PROIBICOES = ['Executar a tarefa sem o EPI indicado nesta Ordem de Serviço ou com EPI danificado.', 'Retirar, desligar ou burlar proteções de máquinas e equipamentos.', 'Executar atividade para a qual não foi treinado e autorizado.', '[preencher]'];
const OS_INTERROMPER = 'Você pode interromper a atividade quando constatar uma situação de trabalho em que, a seu ver, por motivos razoáveis, haja risco grave e iminente para a sua vida ou saúde, avisando imediatamente o seu superior. A empresa não pode exigir o retorno enquanto a situação não for corrigida, e você não pode sofrer consequências injustificadas por isso (NR-01, itens 1.4.3, 1.4.3.1 e 1.4.3.2).';
const OS_EMERG_PADRAO = 'Em acidente ou mal-estar: pare a atividade e avise o superior. Emergência interna: [preencher] · SAMU 192 · Bombeiros 193 · Ponto de encontro: [preencher]';
const OS_EXAMES = 'Os resultados dos seus exames médicos e das avaliações ambientais do seu local de trabalho ficam disponíveis com: [preencher] (NR-01, item 1.4.1, alínea b).';
const OS_CIENCIA = 'Declaro que recebi uma cópia desta Ordem de Serviço, que li e entendi as orientações e que tirei minhas dúvidas.';
const EPI_TERMO = 'Ao assinar cada linha, declaro que recebi gratuitamente o EPI daquela linha, em perfeito estado de conservação e funcionamento, e que fui orientado sobre o risco contra o qual ele protege, os limites de proteção, o uso e o ajuste corretos, a guarda, a higienização e a substituição (NR-06, itens 6.5.1 e 6.7.2). Comprometo-me a (NR-06, item 6.6.1):';
const EPI_DEVERES = ['Usar o EPI fornecido e apenas para a finalidade a que se destina.', 'Cuidar da guarda e da conservação.', 'Avisar a empresa quando o EPI for extraviado, danificado ou ficar impróprio para uso.', 'Cumprir as orientações da empresa sobre o uso adequado.'];
const EPI_FALTA = 'A recusa injustificada ao uso do EPI fornecido constitui ato faltoso (NR-01, itens 1.4.2, alínea d, e 1.4.2.1).';
const DATA_MAO = '___/___/______';
const hojeBr = () => new Date().toLocaleDateString('pt-BR');

const SIT_TXT = { emdia: (l) => `Válido até ${dataBr(l.vencimento)}`, vence: (l) => `Válido até ${dataBr(l.vencimento)}`, vencido: (l) => `VENCIDO em ${dataBr(l.vencimento)} · providenciar`, semregistro: () => 'Não registrado no GRID', semvalidade: (l) => `Concluído${l.conclusao ? ` em ${dataBr(l.conclusao)}` : ''}, sem validade cadastrada` };
const nrDe = (t) => { const m = String(t || '').match(/\bNR[\s-]?0?(\d{1,2})\b/i); return m ? `NR-${m[1].padStart(2, '0')}` : null; };
/** NRs dos treinamentos indicados nos GHE da função (avaliação de campo). Vazio: sem GHE. */
function nrsExigidas(g) {
  const out = new Set();
  ghesDaFuncao(g).forEach((ghe) => (ghe.treinamentos || []).forEach((cod) => { const t = g.D?.catTrein?.get(String(cod)); const nr = nrDe(t?.categoria) || nrDe(t?.nome) || nrDe(cod); if (nr) out.add(nr); }));
  return out;
}
/** v295: só os treinamentos EXIGIDOS pela função (GHE). Sem GHE, a tabela sai em branco "conforme o PGR". */
function treinosExigidos(p, exigidas) {
  if (!exigidas.size) return [];
  return (p.linhas || []).filter((l) => SIT_TXT[l.sit] && (l.sit === 'semregistro' || exigidas.has(l.nr)))
    .map((l) => [l.curso, l.nr || 'Conforme PGR', { x: SIT_TXT[l.sit](l), neg: l.sit === 'vencido' }]);
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
/** Na célula da OS: "Respirador PFF2 · CA ______" (o CA em branco é para escrever à mão). */
const comCaCel = (epi) => episDe(epi).map((e) => `${e.nome} · CA ${e.ca || '______'}`).join('. ');
const medidasCel = (r) => [r.epc, r.adm].map((x) => String(x || '').trim()).filter(Boolean).join('. ');

export function montarPartes(g) {
  if (g.tipo && TIPOS[g.tipo]?.livre) return partesLivre(g);
  const cli = g.fora ? { nome: String(g.fora.empresa || '').trim(), cnpj: '' } : (g.D?.cli || {});
  const docCli = g.fora ? '' : docClienteTxt(cli, true);   // v287: pessoa física com CPF escondido
  const [rotDoc, valDoc] = docCli ? [docCli.replace(/\s.*$/, ''), docCli.replace(/^\S+\s/, '')] : ['CNPJ', '[preencher]'];
  const pessoas = pessoasDe(g);
  const riscos = g.riscos.filter((r) => String(r.risco || '').trim());
  const emerg = String(g.emerg || '').trim();
  const exigidas = nrsExigidas(g);
  return pessoas.map((p) => {
    const setor = p.ghe || '';
    const nome = p.fora ? '' : p.nome;
    const quem = p.fora ? 'Colaborador' : p.nome;
    if (g.tipo === 'epi') {
      const vistos = new Set();
      const epis = riscos.flatMap((r) => episDe(r.epi)).filter((e) => { const k = norm(e.nome); if (vistos.has(k)) return false; vistos.add(k); return true; });
      const treinoUso = epis.filter((e) => /isolante|paraquedista|talabarte|trava.?quedas|respirador|m[aá]scara (semi|facial)|autônomo|autonomo/i.test(e.nome)).map((e) => e.nome);
      return [
        { t: 'cab', esq: cli.nome || '', titulo: 'FICHA DE ENTREGA DE EPI', norma: 'NR-06, item 6.5.1, alínea d', ctl: ['Nº [preencher]', 'Matrícula [preencher]', `Admissão ${DATA_MAO}`] },
        { t: 'faixa', itens: [['Empresa', cli.nome || '[preencher]'], [rotDoc, valDoc]] },
        { t: 'grade', cols: 4, itens: [{ r: 'Colaborador', v: nome, span: 2 }, { r: 'Função', v: p.funcao || '' }, { r: 'Setor ou GHE', v: setor }] },
        { t: 'h', x: 'Entregas · cada linha vale com a assinatura do trabalhador' },
        { t: 'tabela', alt: 8, cols: [{ t: 'Data', w: 0.1 }, { t: 'EPI', w: 0.25 }, { t: 'Tam.', w: 0.06, centro: true }, { t: 'Nº do CA', w: 0.1 }, { t: 'CA válido na entrega', w: 0.09, centro: true }, { t: 'Qtde', w: 0.06, centro: true }, { t: 'Motivo', w: 0.07, centro: true }, { t: 'Entregue por', w: 0.11 }, { t: 'Assinatura', w: 0.16 }],
          linhas: epis.map((e) => ['', /isolante/i.test(e.nome) ? `${e.nome} · nº de série ______` : e.nome, '', e.ca || '', '[ ]', '', '', '', '']), vazias: Math.max(4, 12 - epis.length) },
        { t: 'nota', x: 'Motivo: 1 primeira entrega · 2 troca por dano · 3 desgaste · 4 extravio · 5 vencimento. Na troca, anote a devolução do EPI anterior na mesma linha. Confira a validade do CA no dia da entrega.' },
        { t: 'decl', x: EPI_TERMO }, ...EPI_DEVERES.map((x) => ({ t: 'li', x })), { t: 'p', x: EPI_FALTA },
        ...(treinoUso.length ? [{ t: 'h', x: 'Orientação e treinamento de uso' }, { t: 'tabela', cols: [{ t: 'EPI que exige treinamento de uso', w: 0.5 }, { t: 'Data', w: 0.18 }, { t: 'Instrutor', w: 0.32 }], linhas: treinoUso.map((x) => [x, '', '']) }] : []),
        { t: 'rod', x: `Ficha de EPI · ${quem}` },
      ];
    }
    const treinos = treinosExigidos(p, exigidas);
    return [
      { t: 'cab', esq: cli.nome || '', titulo: 'ORDEM DE SERVIÇO DE SEGURANÇA E SAÚDE NO TRABALHO', norma: 'NR-01, itens 1.4.1, alínea c, e 1.4.4 · CLT, art. 157', ctl: ['Nº [preencher]', 'Revisão 00', `Emissão ${hojeBr()}`] },
      { t: 'faixa', itens: [['Empresa', cli.nome || '[preencher]'], [rotDoc, valDoc]] },
      { t: 'grade', cols: 4, itens: [{ r: 'Colaborador', v: nome, span: 2 }, { r: 'Matrícula', v: '' }, { r: 'Admissão', v: '' }, { r: 'Função', v: p.funcao || '', span: 2 }, { r: 'Setor ou GHE', v: setor, span: 2 }, { r: 'Atividades da função', v: '', span: 4 }] },
      { t: 'h', x: 'Riscos da função, danos possíveis e medidas de prevenção' },
      { t: 'tabela', cols: [{ t: 'Risco', w: 0.15 }, { t: 'Fonte', w: 0.14 }, { t: 'Possíveis danos à saúde', w: 0.17 }, { t: 'Medidas coletivas e administrativas', w: 0.27 }, { t: 'EPI (com CA)', w: 0.27 }],
        linhas: riscos.map((r) => [r.risco, r.fonte, r.danos || '', medidasCel(r), comCaCel(r.epi)]), vazias: riscos.length ? 0 : 4 },
      { t: 'h', x: 'Treinamentos exigidos para a função' },
      treinos.length
        ? { t: 'tabela', cols: [{ t: 'Treinamento', w: 0.46 }, { t: 'Base', w: 0.18 }, { t: 'Situação no GRID', w: 0.36 }], linhas: treinos }
        : { t: 'tabela', cols: [{ t: 'Treinamento', w: 0.46 }, { t: 'Base', w: 0.18 }, { t: 'Válido até', w: 0.36 }], linhas: [], vazias: 3 },
      { t: 'nota', x: treinos.length ? 'Lista vinda do GHE da função na avaliação de campo.' : 'Preencher com os treinamentos que o PGR exige para a função.' },
      { t: 'h', x: 'Proibições' }, ...OS_PROIBICOES.map((x) => ({ t: 'li', x })),
      { t: 'h', x: 'Deveres do empregado (NR-01, item 1.4.2)' }, ...OS_DEVERES.map((x) => ({ t: 'li', x })), { t: 'p', x: OS_FALTA },
      { t: 'h', x: 'Direito de interromper a atividade · emergência' }, { t: 'p', x: OS_INTERROMPER }, { t: 'p', x: emerg || OS_EMERG_PADRAO }, { t: 'p', x: OS_EXAMES },
      { t: 'decl', x: OS_CIENCIA },
      { t: 'assin', blocos: [{ titulo: quem, linhas: [`Matrícula: [preencher] · Data: ${DATA_MAO}`] }, { titulo: 'Responsável pela empresa', linhas: ['Nome e cargo: [preencher]', `Data: ${DATA_MAO}`] }] },
      { t: 'rod', x: `Ordem de Serviço · ${quem}` },
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
  if (g.tipo === 'emitidos') return renderEmitidos(g, t);
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
    <div class="lq-qual lq-qual2">${['os', 'epi', 'apr', 'pt', 'checklist', 'procedimento', 'lista', 'dossie', 'emitidos'].map(op).join('')}</div>
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
    ${conferencia(g, partes[0]).html}
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
        <label>Possíveis danos à saúde<input class="cp-inp" data-cp="lq.g.${t}.r.${i}.danos" value="${esc(r.danos || '')}" placeholder="Ex.: Perda auditiva"></label>
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
    out.push(nrsExigidas(g).size ? li('ok', 'Treinamentos exigidos para a função (GHE), com a situação de cada pessoa', sub) : li('pr', 'Treinamentos exigidos para a função', 'A função não tem GHE na avaliação de campo: a tabela sai em branco para preencher conforme o PGR'));
    out.push(li('ok', 'Proibições, deveres, direito de interromper a atividade, exames e ciência', 'Texto da NR-01, itens 1.4.1 a 1.4.4, conferido no texto oficial'));
    out.push(emergItem(g, t));
  } else {
    out.push(li('ok', 'Empresa, função e GHE de cada pessoa', g.origem?.tipo === 'ghe' ? `GHE ${esc(g.origem.ghes)}` : 'Setor ou GHE sai como [preencher] quando não há avaliação'));
    out.push(li('ok', 'Tabela com data, EPI, tamanho, CA, CA válido na entrega, motivo, quem entregou e assinatura', 'Os EPI acima já entram nas primeiras linhas. A declaração vale para cada linha assinada'));
    out.push(li('ok', 'Termo do trabalhador', 'NR-06, itens 6.5.1, 6.6.1 e 6.7.2'));
    out.push(li('pr', 'Matrícula e admissão', 'Saem em branco para escrever à mão'));
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
  const ocupado = g.sug?.carregando || g.editando >= 0 || conferencia(g, null).bloqueia || (g.prev?.doc && g.prev.escolha === 'rev' && String(g.prev.motivo || '').trim().length < 3);
  const qtd = n > 1 ? ` com ${n} ${g.tipo === 'epi' ? 'fichas' : 'OS'}, uma por pessoa` : '';
  const botoes = `<div class="lq-doc-acts"><button type="button" class="btn btn-amber" data-acao="campo:lq-g:${t}.baixar.pdf"${ocupado ? ' disabled' : ''}>Baixar PDF${qtd}</button><button type="button" class="btn btn-outline" data-acao="campo:lq-g:${t}.baixar.docx"${ocupado ? ' disabled' : ''}>Baixar Word</button></div>`;
  const antes = blocoRevisao(g, t);
  if (!g.baixado || g.fora) return `${antes}${botoes}${blocoEmitidos(g, t)}`;
  if (g.registro?.feito) return `${antes}${botoes}${blocoEmitidos(g, t)}<div class="lq-reg ok" role="status"><div><b>Entrega registrada em ${dataBr(g.registro.data)}</b> para ${plural(g.registro.n, 'pessoa', 'pessoas')}. Aparece na ficha de cada pessoa e no dossiê.</div></div>`;
  return `${antes}${botoes}${blocoEmitidos(g, t)}<div class="lq-reg"><div><b>${esc(g.baixado)} baixado.</b> Depois de entregar e colher as assinaturas, registre a entrega. Fica na ficha de cada pessoa e entra no dossiê.</div>
    <label class="lq-reg-d">Data da entrega<input type="date" class="cp-inp" data-cp="lq.g.${t}.regdata" value="${esc(g.regData || hojeIso())}" max="${hojeIso()}"></label>
    <button type="button" class="btn btn-outline btn-sm" data-acao="campo:lq-g:${t}.registrar"${g.registro?.salvando ? ' disabled' : ''}>${g.registro?.salvando ? 'Registrando...' : 'Registrar entrega'}</button></div>`;
}

/* miniatura da 1ª página, feita com as mesmas partes do arquivo (v295: formulário novo) */
function papel(partes, n, t) {
  if (!partes) return '';
  const y = (x) => esc(x).replace(/\[ \]/g, '<i class="cx"></i>').replace(/\[([^\]]{1,80})\]/g, '<span class="bl"></span>');
  const cel = (c) => (c && typeof c === 'object' ? c.x : c) ?? '';
  let linhas = 0;
  const html = partes.filter((b) => b.t !== 'rod').map((b) => {
    if (linhas > 26) return '';
    if (b.t === 'cab') { linhas += 3; return `<div class="cab"><div class="e">${esc(b.esq || '')}</div><div class="t">${esc(b.titulo)}<small>${esc(b.norma || '')}</small></div><div class="c">${(b.ctl || []).map((x) => `<span>${y(x)}</span>`).join('')}</div></div>`; }
    if (b.t === 'faixa') { linhas += 1; return `<div class="fx">${b.itens.map(([r, v]) => `<b>${esc(r)}:</b> ${y(v)}`).join(' &nbsp; ')}</div>`; }
    if (b.t === 'grade') { linhas += 2; return `<div class="gd">${b.itens.map((i) => `<div style="grid-column:span ${i.span || 1}"><small>${esc(i.r)}</small>${y(i.v || '')}</div>`).join('')}</div>`; }
    if (b.t === 'h') { linhas += 1; return `<div class="h">${esc(b.x)}</div>`; }
    if (b.t === 'tabela') { const ls = [...b.linhas, ...Array.from({ length: Math.min(2, b.vazias || 0) }, () => b.cols.map(() => ''))].slice(0, 4); linhas += ls.length + 1; return `<table><tr>${b.cols.map((c) => `<th>${esc(c.t)}</th>`).join('')}</tr>${ls.map((l) => `<tr>${l.map((x) => `<td>${y(cel(x))}</td>`).join('')}</tr>`).join('')}</table>`; }
    if (b.t === 'li') { linhas += 1; return `- ${y(b.x)}<br>`; }
    if (b.t === 'decl') { linhas += 2; return `<div class="dc">${y(b.x)}</div>`; }
    if (b.t === 'assin') { linhas += 2; return `<div class="ass">${b.blocos.map((x) => `<div>${esc(x.titulo)}</div>`).join('')}</div>`; }
    if (b.t === 'nota') return '';
    linhas += 1; return `<div class="ln"></div>`;
  }).join('');
  const rod = partes.find((b) => b.t === 'rod')?.x || '';
  return `<div class="lq-papel-w"><div class="lq-papel lq-papel2" aria-hidden="true">${html}<div class="rod"><span>${esc(rod)}</span><span>Pág. 1</span></div></div>
    <button type="button" class="lq-papel-ver" data-acao="campo:lq-g:${t}.ver">${n > 1 ? `Ver as ${n} pessoas em PDF` : 'Ver em PDF'}</button></div>`;
}

/* ── v296: número, revisão e QR de autenticidade (proposta aprovada em 04/11/2026, parte 3) ──────
   O documento é registrado em doc_emitidos (PASSO-94) quando é BAIXADO. Ver em PDF não gasta número.
   Baixar de novo o mesmo conteúdo (PDF e depois Word) usa os mesmos números. Sem o PASSO-94 no banco,
   o documento sai como antes (Nº em branco), sem travar. */
const SIGLA = { os: 'OS', epi: 'FEPI', pt: 'PT', apr: 'APR', checklist: 'CK', procedimento: 'PO' };
export const numTxt = (tipo, n) => `${SIGLA[tipo] || 'DOC'}-${String(n).padStart(4, '0')}`;
const revTxt = (r) => String(r || 0).padStart(2, '0');
const urlValidar = (c) => `https://www.toledolabs.com.br/validar.html?doc=${c}`;
const semFuncao = (e) => /PGRST202|42883|could not find the function|does not exist|schema cache/i.test(`${e?.code || ''} ${e?.message || ''}`);
function chaveEmissao(g) {
  if (g.dl) return `dl:${g.dl.id || ''}:${g.dl.empresa || ''}`;
  return [g.tipo, g.clienteId || 'fora', g.fora ? `${g.fora.empresa}|${g.fora.funcao}` : g.para, JSON.stringify(g.riscos), g.emerg, g.prev?.escolha || '', g.prev?.motivo || ''].join('|');
}
function clienteDoLivre(g) { return (g.clientes || []).find((c) => norm(c.nome) === norm(g.dl?.empresa || '')) || null; }
async function registrarEmissao(g, docs) {
  const chave = chaveEmissao(g);
  if (g.emit?.chave === chave) return g.emit.regs;
  const cliL = g.dl ? clienteDoLivre(g) : null;
  const clienteId = g.dl ? (cliL?.id || null) : g.fora ? null : (g.clienteId || null);
  const clienteNome = g.dl ? (g.dl.empresa || '') : g.fora ? (g.fora.empresa || '') : (g.D?.cli?.nome || '');
  const pessoas = g.dl ? [{ id: null, nome: '' }] : pessoasDe(g);
  const titulo = g.dl ? (g.dl.res?.titulo_atividade || g.dl.atividade || '') : `${TIPOS[g.tipo].nome}${funcaoDe(g) ? `, ${funcaoDe(g)}` : ''}`;
  let regs;
  try {
    if (g.prev?.doc && g.prev.escolha === 'rev' && docs.length === 1) {
      const { data, error } = await sb().rpc('doc_revisar', { p_anterior: g.prev.doc.id, p_motivo: String(g.prev.motivo || '').trim(), p_titulo: titulo, p_org_id: sessao.orgId() });
      if (error) throw error;
      regs = data || [];
    } else {
      const itens = pessoas.slice(0, docs.length).map((p) => ({ colaborador_id: p.fora ? null : p.id, pessoa_nome: p.fora ? '' : (p.nome || ''), titulo }));
      const { data, error } = await sb().rpc('doc_emitir', { p_tipo: g.tipo, p_cliente_id: clienteId, p_cliente_nome: clienteNome, p_itens: itens, p_org_id: sessao.orgId() });
      if (error) throw error;
      regs = (data || []).sort((a, b) => a.numero - b.numero);
    }
  } catch (e) {
    if (semFuncao(e)) { g.emit = { chave, regs: null, semBanco: true }; return null; }
    throw new Error(/42501|permiss/i.test(`${e?.code || ''} ${e?.message || ''}`) ? 'Seu perfil de acesso não permite registrar documentos. Peça ao administrador.' : 'Não foi possível registrar o número do documento. Confira a internet e tente de novo.');
  }
  if (regs.length !== docs.length) throw new Error('Não foi possível registrar o número do documento. Tente de novo.');
  const qr = typeof window.gerarQRCodeDataURL === 'function' ? await Promise.all(regs.map((r) => window.gerarQRCodeDataURL(urlValidar(r.codigo)).catch(() => ''))) : [];
  regs = regs.map((r, i) => ({ ...r, png: qr[i] || '' }));
  g.emit = { chave, regs };
  if (g.prev?.doc && g.prev.escolha === 'rev') g.prev = { ...g.prev, feita: true };
  return regs;
}
function aplicarRegistro(docs, regs, g) {
  docs.forEach((partes, i) => {
    const r = regs[i]; if (!r) return;
    const c = partes.find((b) => b.t === 'cab');
    if (c) {
      c.ctl = [...(c.ctl || [])];
      c.ctl[0] = `Nº ${numTxt(g.tipo, r.numero)}`;
      if (/^Revis/.test(c.ctl[1] || '')) c.ctl[1] = `Revisão ${revTxt(r.revisao)}`;
      c.qr = { codigo: r.codigo, png: r.png };
    }
    const rod = partes.find((b) => b.t === 'rod');
    if (rod) rod.x = `${numTxt(g.tipo, r.numero)} · Rev. ${revTxt(r.revisao)} · ${rod.x}`;
  });
}
/** OS ou ficha de UMA pessoa que já tem documento válido do mesmo tipo: pergunta se é revisão. */
function verAnterior(g) {
  const k = g.para?.startsWith('p:') && !g.fora && (g.tipo === 'os' || g.tipo === 'epi') ? `${g.tipo}|${g.para}` : '';
  if (!k) { g.prev = null; return; }
  if (g.prev?.k === k) return;
  g.prev = { k, carregando: true };
  let cli; try { cli = sb(); } catch { g.prev = { k, doc: null }; return; }
  cli.from('doc_emitidos').select('id,numero,revisao,emitido_em').eq('org_id', sessao.orgId()).eq('tipo', g.tipo).eq('colaborador_id', g.para.slice(2)).eq('situacao', 'valido').order('emitido_em', { ascending: false }).limit(1)
    .then(({ data, error }) => { if (g.prev?.k !== k) return; g.prev = { k, doc: !error && data?.[0] ? data[0] : null, escolha: 'rev', motivo: '' }; _ctx.repintar(); })
    .catch(() => { if (g.prev?.k === k) g.prev = { k, doc: null }; });
}
function blocoRevisao(g, t) {
  verAnterior(g);
  const p = g.prev;
  if (!p?.doc || p.feita) return '';
  const nome = `${numTxt(g.tipo, p.doc.numero)} · Rev. ${revTxt(p.doc.revisao)}`;
  const prox = revTxt(p.doc.revisao + 1);
  return `<div class="lq-rev"><p><b>Esta pessoa já tem ${esc(nome)}</b>, emitida em ${dataBr(String(p.doc.emitido_em).slice(0, 10))}.</p>
    <div class="lq-rev-op"><button type="button" class="${p.escolha === 'rev' ? 'on' : ''}" aria-pressed="${p.escolha === 'rev'}" data-acao="campo:lq-g:${t}.rev-sim"><b>Fazer a revisão ${prox}</b><small>A Rev. ${revTxt(p.doc.revisao)} passa a aparecer como substituída no QR</small></button>
    <button type="button" class="${p.escolha === 'novo' ? 'on' : ''}" aria-pressed="${p.escolha === 'novo'}" data-acao="campo:lq-g:${t}.rev-nao"><b>Emitir como documento novo</b><small>Ganha outro número</small></button></div>
    ${p.escolha === 'rev' ? `<label class="lq-doc-sel"><small>Motivo da revisão</small><input class="cp-inp lq-doc-inp" data-cp="lq.g.${t}.rev.motivo" value="${esc(p.motivo || '')}" placeholder="Ex.: ruído incluído no GHE 03" aria-label="Motivo da revisão"></label>` : ''}</div>`;
}
function blocoEmitidos(g, t) {
  const e = g.emit;
  if (!e) return '';
  if (e.semBanco) return '<p class="lq-doc-nota">O número e o QR ainda não estão ligados neste GRID (falta um passo no banco). O documento saiu com o Nº em branco.</p>';
  if (!e.regs?.length) return '';
  const nums = e.regs.map((r) => `${numTxt(g.tipo, r.numero)}${r.revisao ? ` Rev. ${revTxt(r.revisao)}` : ''}`);
  const lista = nums.length > 4 ? `${nums.slice(0, 3).join(', ')} e mais ${nums.length - 3}` : nums.join(', ');
  if (e.cancelado) return `<div class="lq-reg"><div><b>${esc(lista)} cancelado.</b> O QR passa a mostrar "documento cancelado".</div></div>`;
  const canc = e.regs.length === 1 ? (e.cancAberto
    ? `<label class="lq-doc-sel"><small>Motivo do cancelamento</small><input class="cp-inp lq-doc-inp" data-cp="lq.g.${t}.canc.motivo" value="${esc(e.motivoCanc || '')}" placeholder="Ex.: emitido com dado errado" aria-label="Motivo do cancelamento"></label>
      <span class="lq-doc-acts mini"><button type="button" class="btn btn-outline btn-sm" data-acao="campo:lq-g:${t}.canc-enviar"${e.cancelando ? ' disabled' : ''}>Cancelar o documento</button><button type="button" class="btn btn-outline btn-sm" data-acao="campo:lq-g:${t}.canc-fechar">Voltar</button></span>`
    : ` <button type="button" class="lq-lnk" data-acao="campo:lq-g:${t}.canc-abrir">Cancelar este documento</button>`) : '';
  return `<div class="lq-reg lq-emit"><div><b>Registrado: ${esc(lista)}.</b> ${e.regs.length > 1 ? 'Cada um tem QR próprio' : 'O QR está no cabeçalho'}: qualquer pessoa confere em toledolabs.com.br/validar.html.${canc}</div></div>${blocoAssinatura(g, t)}`;
}
async function cancelarEmitido(g) {
  const e = g.emit, motivo = String(e.motivoCanc || '').trim();
  if (motivo.length < 3) { avisar('Escreva o motivo do cancelamento.', 'erro'); return; }
  e.cancelando = true;
  try {
    const { error } = await sb().rpc('doc_cancelar', { p_id: e.regs[0].id, p_motivo: motivo, p_org_id: sessao.orgId() });
    if (error) throw error;
    e.cancelado = true; e.cancAberto = false; avisar('Documento cancelado.');
  } catch (er) { avisar(/42501|admin/i.test(`${er?.code || ''} ${er?.message || ''}`) ? 'Só o administrador ou quem emitiu pode cancelar.' : 'Não foi possível cancelar agora.', 'erro'); }
  e.cancelando = false;
}

/* ── v297: assinatura no celular, "neste aparelho" (parte 4 da proposta aprovada em 04/11/2026) ──────
   Ficha de EPI e ciência da OS. O trabalhador marca o aceite e assina com o dedo no aparelho do técnico.
   O banco guarda a imagem, o resumo (SHA-256) do documento, data e hora, aparelho e IP (PASSO-95).
   Depois sai o "PDF assinado": a assinatura entra nas linhas da ficha ou no bloco da OS, com a trilha. */
const hojeHora = () => { const d = new Date(); return { data: d.toLocaleDateString('pt-BR'), hora: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }; };
async function sha256(txt) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join(''); }
function episDoDoc(partes) {
  const tb = (partes || []).find((b) => b.t === 'tabela' && b.cols?.[1]?.t === 'EPI');
  return tb ? tb.linhas.map((l) => String(l[1] || '').replace(/\s*·\s*nº de série.*$/, '')).filter(Boolean) : [];
}
function blocoAssinatura(g, t) {
  const e = g.emit;
  if (!e?.regs?.length || !e.docs || e.cancelado || !(g.tipo === 'os' || g.tipo === 'epi')) return '';
  const linhas = e.regs.slice(0, 8).map((r, i) => {
    const a = e.ass?.[i], nome = e.nomes?.[i] || 'Colaborador';
    return `<li><div><b>${esc(nome)}</b><small>${esc(numTxt(g.tipo, r.numero))}${a ? ` · assinado em ${esc(a.data)} às ${esc(a.hora)}` : ''}</small></div>
      ${a ? `<button type="button" class="btn btn-outline btn-sm" data-acao="campo:lq-g:${t}.ass-pdf.${i}">Baixar PDF assinado</button>` : `<button type="button" class="btn btn-navy btn-sm" data-acao="campo:lq-g:${t}.ass-abrir.${i}">Assinar neste aparelho</button>`}</li>`;
  }).join('');
  return `<div class="lq-ass"><p><b>Colher assinatura no celular</b> <small>Opcional. Passe o celular ou o tablet para o trabalhador assinar com o dedo. O papel continua valendo.</small></p><ul>${linhas}</ul>${e.regs.length > 8 ? `<p class="lq-doc-nota">Aparecem as 8 primeiras pessoas. Para as outras, gere a ${g.tipo === 'epi' ? 'ficha' : 'OS'} por pessoa.</p>` : ''}</div>`;
}
/** Abre a assinatura de um documento. ctx: { tipo, partes, reg: { id, numero, codigo }, nome, aoAssinar(ass) } */
function abrirAssinatura(ctx) {
  if (typeof window.abrirModal !== 'function' || typeof window._initCanvas !== 'function') { avisar('Não foi possível abrir a assinatura neste aparelho.', 'erro'); return; }
  const num = numTxt(ctx.tipo, ctx.reg.numero);
  const itens = ctx.tipo === 'epi' ? episDoDoc(ctx.partes) : [];
  const decl = ctx.tipo === 'epi'
    ? 'Recebi gratuitamente os EPI acima, em perfeito estado, e fui orientado sobre o uso, o ajuste, a guarda, a higienização e a troca (NR-06, itens 6.5.1 e 6.7.2).'
    : `Recebi uma cópia da Ordem de Serviço ${num}, li e entendi as orientações e tirei minhas dúvidas (NR-01, item 1.4.1, alínea c).`;
  window.__lqAssCtx = ctx;
  window.abrirModal(`Assinatura · ${num}`, `
    <div class="lq-ass-m"><p><b>${esc(ctx.nome || 'Colaborador')}</b></p>
    ${itens.length ? `<ul>${itens.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    <p>${esc(decl)}</p>
    <label class="lq-ass-ok"><input type="checkbox" id="lqAceite"> Aceito assinar este documento eletronicamente, neste aparelho.</label>
    <canvas id="canvasAssinatura" width="440" height="180" aria-label="Espaço para assinar com o dedo" style="border:2px solid var(--border);border-radius:var(--r-md);touch-action:none;width:100%;height:180px;display:block;background:#fff;cursor:crosshair"></canvas>
    <button type="button" class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="limparAssinatura()">Limpar</button></div>`,
    `<button class="btn btn-outline" onclick="fecharModal()">Cancelar</button><button class="btn btn-navy" id="btnSalvarModal" onclick="window.__lqAssinar()">Confirmar assinatura</button>`);
  setTimeout(() => window._initCanvas(), 100);
}
function abrirAssinaturaDoc(g, ti, i, redesenhar) {
  abrirAssinatura({ tipo: g.tipo, partes: g.emit.docs[i], reg: g.emit.regs[i], nome: g.emit.nomes?.[i] || 'Colaborador',
    aoAssinar: (ass) => { g.emit.ass ||= {}; g.emit.ass[i] = ass; redesenhar?.(); } });
}
window.__lqAssinar = async () => {
  const ctx = window.__lqAssCtx; if (!ctx) return;
  if (!document.getElementById('lqAceite')?.checked) { avisar('Marque o aceite antes de assinar.', 'erro'); return; }
  const cv = document.getElementById('canvasAssinatura');
  const px = cv?.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  if (!px || !px.some((v, k) => k % 4 === 3 && v > 0)) { avisar('Assine no espaço antes de confirmar.', 'erro'); return; }
  const png = cv.toDataURL('image/png');
  if (typeof window.setBtnModalLoading === 'function') window.setBtnModalLoading(true);
  try {
    const hash = await sha256(JSON.stringify(conteudoDe(ctx.partes)));
    const aparelho = `${navigator.userAgentData?.platform || navigator.platform || ''} · ${String(navigator.userAgent || '').slice(0, 200)}`;
    const { data, error } = await sb().rpc('doc_assinar', { p_id: ctx.reg.id, p_png: png, p_hash: hash, p_aparelho: aparelho, p_org_id: sessao.orgId() });
    if (error) throw error;
    const q = data ? new Date(data) : new Date();
    window.fecharModal?.();
    avisar('Assinatura registrada.');
    ctx.aoAssinar?.({ png, hash, data: q.toLocaleDateString('pt-BR'), hora: q.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) });
  } catch (e) {
    const m = `${e?.code || ''} ${e?.message || ''}`;
    avisar(semFuncao(e) ? 'A assinatura no celular ainda não está ligada neste GRID (falta um passo no banco).' : /já assinado/.test(m) ? 'Este documento já foi assinado.' : /substitu|cancel/.test(m) ? 'Este documento foi substituído ou cancelado.' : 'Não foi possível registrar a assinatura. Confira a internet e tente de novo.', 'erro');
  }
  if (typeof window.setBtnModalLoading === 'function') window.setBtnModalLoading(false);
};
/** Partes com a assinatura colhida: nas linhas da ficha ou no bloco da OS, e a trilha no fim. */
function partesAssinadas(tipo, partesOrig, a, reg, nome) {
  const partes = JSON.parse(JSON.stringify(partesOrig)), num = numTxt(tipo, reg.numero);
  if (tipo === 'epi') {
    const tb = partes.find((b) => b.t === 'tabela' && b.cols?.[1]?.t === 'EPI');
    if (tb) tb.linhas = tb.linhas.map((l) => (String(l[1] || '').trim() ? [a.data, ...l.slice(1, 8), { x: '', img: a.png }] : l));
  } else {
    const as = partes.find((b) => b.t === 'assin');
    if (as?.blocos?.[0]) { as.blocos[0].img = a.png; as.blocos[0].linhas = [`Matrícula: [preencher] · Data: ${a.data}`]; }
  }
  const trilha = { t: 'nota', x: `Assinado eletronicamente por ${nome || 'Colaborador'} em ${a.data} às ${a.hora}, no aparelho do técnico, com aceite do trabalhador. ${num} · código ${reg.codigo} · conferir em toledolabs.com.br/validar.html · resumo do documento ${String(a.hash || '').slice(0, 16)}.` };
  const k = partes.findIndex((b) => b.t === 'rod');
  partes.splice(k < 0 ? partes.length : k, 0, trilha);
  return partes;
}
async function baixarAssinado(g, i) {
  const e = g.emit, r = e.regs[i];
  await Docs.baixarPartes('pdf', `${TIPOS[g.tipo].nome} ${numTxt(g.tipo, r.numero)} assinado`, [partesAssinadas(g.tipo, e.docs[i], e.ass[i], r, e.nomes?.[i])]);
}
/** v298: o conteúdo guardado não leva a imagem do QR (o QR sai de novo a partir do código). */
function conteudoDe(partes) {
  return (partes || []).map((b) => (b.t === 'cab' && b.qr ? { ...b, qr: { codigo: b.qr.codigo } } : b));
}
async function guardarConteudo(g) {
  const e = g.emit;
  if (!e?.regs?.length || !e.docs || e.guardado) return;
  e.guardado = true;
  await Promise.all(e.regs.map((r, i) => sb().rpc('doc_guardar_conteudo', { p_id: r.id, p_conteudo: conteudoDe(e.docs[i]), p_org_id: sessao.orgId() })
    .then(({ error }) => { if (error && !semFuncao(error)) console.warn('GRID: conteúdo do documento não guardado', error.message); })));
}

/* ── v298: Documentos emitidos (etapa 1 da proposta aprovada em 04/11/2026) ────────────────────
   Lista os documentos baixados (doc_emitidos) da empresa escolhida. O PDF sai de novo do conteúdo
   guardado (PASSO-96), com o QR refeito pelo código e, se assinado, com a assinatura e a trilha. */
const SIT_LS = { valido: ['Válido', 'b'], substituido: ['Substituído', 'b'], cancelado: ['Cancelado', 'r'] };
async function carregarEmitidos(g) {
  const f = g.ls; f.carregando = true; f.erro = '';
  try {
    let q = sb().from('doc_emitidos').select('id,cliente_id,cliente_nome,pessoa_nome,tipo,numero,revisao,titulo,codigo,situacao,emitido_em,assinado_em,motivo_cancelamento,tem:conteudo->0')
      .eq('org_id', sessao.orgId()).order('emitido_em', { ascending: false }).limit(f.limite || 60);
    if (f.cli === '__fora') q = q.is('cliente_id', null); else if (f.cli) q = q.eq('cliente_id', f.cli);
    if (f.tipo) q = q.eq('tipo', f.tipo);
    if (f.sit === 'aguardando') q = q.eq('situacao', 'valido').in('tipo', ['os', 'epi']).is('assinado_em', null);
    else if (f.sit === 'assinado') q = q.not('assinado_em', 'is', null);
    else if (f.sit) q = q.eq('situacao', f.sit);
    const { data, error } = await q;
    if (error) throw error;
    f.linhas = data || [];
  } catch (e) { f.linhas = []; f.erro = semFuncao(e) || semTabela(e) ? 'A lista de documentos ainda não está ligada neste GRID (falta um passo no banco).' : 'Não foi possível ler os documentos agora.'; }
  f.carregando = false;
}
function renderEmitidos(g, t) {
  const f = g.ls || {};
  const cliOps = `<option value=""${!f.cli ? ' selected' : ''}>Todas as empresas</option>${(g.clientes || []).map((c) => opt(c.id, c.nome, f.cli)).join('')}<option value="__fora"${f.cli === '__fora' ? ' selected' : ''}>Empresa fora do GRID</option>`;
  const tipoOps = `<option value="">Todos</option>${Object.keys(SIGLA).map((k) => opt(k, `${SIGLA[k]} · ${TIPOS[k].nome.split(',')[0]}`, f.tipo)).join('')}`;
  const sitOps = [['', 'Todas'], ['aguardando', 'Aguardando assinatura'], ['assinado', 'Assinados'], ['valido', 'Válidos'], ['substituido', 'Substituídos'], ['cancelado', 'Cancelados']].map(([v, l]) => opt(v, l, f.sit || '')).join('');
  const filtros = `<div class="lq-doc-para">${sel(t, 'lcli', 'Empresa', cliOps, f.cli)}${sel(t, 'ltipo', 'Tipo', tipoOps, f.tipo)}${sel(t, 'lsit', 'Situação', sitOps, f.sit)}
    <label class="lq-doc-sel"><small>Buscar</small><input class="cp-inp lq-doc-inp" data-cp="lq.g.${t}.ls.busca" value="${esc(f.busca || '')}" placeholder="Nome, atividade ou número" aria-label="Buscar documento"></label></div>`;
  let corpo;
  if (f.carregando) corpo = '<p class="lq-doc-nota" aria-live="polite">Lendo os documentos...</p>';
  else if (f.erro) corpo = `<p class="lq-doc-nota" role="alert">${esc(f.erro)}</p>`;
  else {
    const ls = f.linhas || [];
    if (!ls.length) corpo = '<p class="lq-doc-nota">Nenhum documento emitido com esses filtros. Os documentos aparecem aqui depois de baixados.</p>';
    else corpo = `<div class="lq-ls" data-lst="${t}"><table><thead><tr><th>Número</th><th>Pessoa ou atividade</th><th>Emitido</th><th>Situação</th><th><span class="sr-only">Ações</span></th></tr></thead><tbody>${ls.map((r) => linhaEmitido(g, t, r)).join('')}</tbody></table></div>
      ${(f.linhas || []).length >= (f.limite || 60) ? `<button type="button" class="lq-rs-add" data-acao="campo:lq-g:${t}.ls-mais">Mostrar mais</button>` : ''}`;
  }
  return `<article class="lq-resp lq-r2 lq-gerar">${cab('Documentos emitidos', 'Número, QR, assinatura e PDF de novo, a qualquer momento')}${filtros}${corpo}
    <p class="lq-doc-nota">Para uma nova revisão, gere o documento de novo para a pessoa: o GRID pergunta se é revisão.</p></article>`;
}
function linhaEmitido(g, t, r) {
  const num = `${numTxt(r.tipo, r.numero)}${r.revisao ? ` Rev. ${revTxt(r.revisao)}` : ''}`;
  const assinavel = (r.tipo === 'os' || r.tipo === 'epi') && r.situacao === 'valido';
  let sit;
  if (r.assinado_em) sit = `<span class="lq-tag v">Assinado ${dataBr(String(r.assinado_em).slice(0, 10))}</span>`;
  else if (assinavel) sit = '<span class="lq-tag y">Aguardando assinatura</span>';
  else { const [l, k] = SIT_LS[r.situacao] || ['', 'b']; sit = `<span class="lq-tag ${k}">${l}</span>`; }
  if (r.assinado_em && r.situacao !== 'valido') { const [l, k] = SIT_LS[r.situacao]; sit += ` <span class="lq-tag ${k}">${l}</span>`; }
  const tem = r.tem != null;
  const acts = [];
  if (tem) acts.push(`<button type="button" class="lq-lnk" data-acao="campo:lq-g:${t}.ls-pdf.${r.id}">${r.assinado_em ? 'PDF assinado' : 'Baixar PDF'}</button>`);
  if (tem && assinavel && !r.assinado_em) acts.push(`<button type="button" class="lq-lnk" data-acao="campo:lq-g:${t}.ls-ass.${r.id}">Colher assinatura</button>`);
  if (r.situacao === 'valido') acts.push(`<button type="button" class="lq-lnk" data-acao="campo:lq-g:${t}.ls-canc.${r.id}">Cancelar</button>`);
  if (!tem) acts.push('<small>Emitido antes de guardar o conteúdo</small>');
  if (r.situacao === 'cancelado' && r.motivo_cancelamento) acts.push(`<small>Motivo: ${esc(r.motivo_cancelamento)}</small>`);
  const canc = g.ls.cancId === r.id ? `<tr class="ed"><td colspan="5"><div class="lq-rs-ed"><label class="lg">Motivo do cancelamento de ${esc(num)}<input class="cp-inp" data-cp="lq.g.${t}.ls.motivo" value="${esc(g.ls.motivo || '')}" placeholder="Ex.: emitido com dado errado"></label>
    <button type="button" class="btn btn-navy btn-sm" data-acao="campo:lq-g:${t}.ls-canc-ok">Cancelar o documento</button><button type="button" class="btn btn-outline btn-sm" data-acao="campo:lq-g:${t}.ls-canc-fechar">Voltar</button></div></td></tr>` : '';
  const b = norm(g.ls.busca || ''), chave = norm(`${r.pessoa_nome} ${r.titulo} ${numTxt(r.tipo, r.numero)} ${r.cliente_nome}`);
  return `<tr data-lsb="${esc(chave)}"${b && !chave.includes(b) ? ' hidden' : ''}><td><b>${esc(num)}</b></td><td>${esc(r.pessoa_nome || r.titulo || '—')}${!g.ls.cli && r.cliente_nome ? `<small>${esc(r.cliente_nome)}</small>` : ''}</td><td>${dataBr(String(r.emitido_em).slice(0, 10))}</td><td>${sit}</td><td class="acts">${acts.join(' ')}</td></tr>${canc}`;
}
async function lerConteudo(id) {
  const { data, error } = await sb().from('doc_emitidos').select('id,tipo,numero,revisao,codigo,pessoa_nome,conteudo,assinado_em').eq('id', id).maybeSingle();
  if (error || !data?.conteudo) throw new Error('Não foi possível ler o documento guardado.');
  const partes = JSON.parse(JSON.stringify(data.conteudo));
  const c = partes.find((b) => b.t === 'cab');
  if (c?.qr?.codigo && typeof window.gerarQRCodeDataURL === 'function') c.qr.png = await window.gerarQRCodeDataURL(urlValidar(c.qr.codigo)).catch(() => '');
  return { d: data, partes };
}
async function baixarDaLista(g, id) {
  try {
    const { d, partes } = await lerConteudo(id);
    let saida = partes;
    if (d.assinado_em) {
      const { data: a, error } = await sb().from('doc_assinaturas').select('png,hash,assinado_em').eq('doc_id', id).maybeSingle();
      if (error || !a) throw new Error('Não foi possível ler a assinatura.');
      const q = new Date(a.assinado_em);
      saida = partesAssinadas(d.tipo, partes, { png: a.png, hash: a.hash, data: q.toLocaleDateString('pt-BR'), hora: q.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }, d, d.pessoa_nome);
    }
    await Docs.baixarPartes('pdf', `${TIPOS[d.tipo].nome.split(',')[0]} ${numTxt(d.tipo, d.numero)}${d.assinado_em ? ' assinado' : ''}`, [saida]);
  } catch (e) { avisar(e?.message || 'Não foi possível montar o PDF.', 'erro'); }
}
async function assinarDaLista(g, id, redesenhar) {
  try {
    const { d, partes } = await lerConteudo(id);
    abrirAssinatura({ tipo: d.tipo, partes, reg: d, nome: d.pessoa_nome, aoAssinar: async () => { await carregarEmitidos(g); redesenhar(); } });
  } catch (e) { avisar(e?.message || 'Não foi possível abrir o documento.', 'erro'); }
}
async function cancelarDaLista(g) {
  const motivo = String(g.ls.motivo || '').trim();
  if (motivo.length < 3) { avisar('Escreva o motivo do cancelamento.', 'erro'); return; }
  try {
    const { error } = await sb().rpc('doc_cancelar', { p_id: g.ls.cancId, p_motivo: motivo, p_org_id: sessao.orgId() });
    if (error) throw error;
    g.ls.cancId = ''; avisar('Documento cancelado.');
    await carregarEmitidos(g);
  } catch (er) { avisar(/42501|admin/i.test(`${er?.code || ''} ${er?.message || ''}`) ? 'Só o administrador ou quem emitiu pode cancelar.' : 'Não foi possível cancelar agora.', 'erro'); }
}

/* ── v295: conferência antes do PDF (proposta aprovada em 04/11/2026, seção 8) ───────────
   Mostra o que o GRID mudou ou o que falta: citações tiradas ou atualizadas pelo servidor,
   campos para escrever à mão, risco sem medida (bloqueia o PDF) e treinamento vencido na OS. */
const semMedidaOS = (r) => !String(r.epc || '').trim() && !String(r.adm || '').trim() && !String(r.epi || '').trim();
function conferencia(g, partes) {
  const it = [], liC = (k, tt, ss) => it.push(`<li><i class="${k}" aria-hidden="true">${k === 'g' ? '✓' : k === 'r' ? '!' : '?'}</i><div><b>${tt}</b>${ss ? `<small>${ss}</small>` : ''}</div></li>`);
  let bloqueia = false, motivo = '';
  if (g.dl?.res) {
    const r = g.dl.res, c = r.citacoes || {};
    const ret = c.retiradas || [], atu = c.atualizadas || [];
    if (ret.length) liC('r', `${plural(ret.length, 'citação retirada', 'citações retiradas')}`, ret.slice(0, 4).map((m) => `${esc(m.de)}: ${esc(m.motivo)}`).join('<br>'));
    if (atu.length) liC('r', `${plural(atu.length, 'citação atualizada', 'citações atualizadas')}`, atu.slice(0, 4).map((m) => `${esc(m.de)} virou ${esc(m.para)} (${esc(m.motivo)})`).join('<br>'));
    const val = c.valores || [];
    if (val.length) liC('y', `${plural(val.length, 'valor veio', 'valores vieram')} de NR de outro setor`, val.slice(0, 4).map((m) => `${esc(m.de)}: ${esc(m.motivo)}`).join('<br>'));
    if (r.conferir?.length) liC('y', 'Confira estes números', `${esc(r.conferir.join(', '))}. Não estão nos trechos da norma que o Laudomiro consultou`);
    if (r.sem_medida?.length) { bloqueia = true; motivo = 'Há risco sem medida de prevenção. Toque em "Mudar alguma coisa" e peça a medida.'; liC('r', `${plural(r.sem_medida.length, 'risco sem medida', 'riscos sem medida')}: o PDF não é gerado`, `${esc(r.sem_medida.join(', '))}. Toque em "Mudar alguma coisa" e peça a medida.`); }
    else if (g.tipo === 'apr' || g.tipo === 'pt') liC('g', 'Todos os riscos têm medida', '');
    if (!ret.length && !atu.length && r.citacoes) liC('g', 'Citações conferidas no texto vigente', 'Nenhuma precisou mudar');
  } else if (g.tipo === 'os' || g.tipo === 'epi') {
    const sem = g.riscos.filter((r) => String(r.risco || '').trim() && semMedidaOS(r));
    if (sem.length) { bloqueia = true; motivo = `Risco sem medida: ${sem.map((r) => r.risco).join(', ')}. Escreva a proteção coletiva, a medida administrativa ou o EPI.`; liC('r', `${plural(sem.length, 'risco sem medida', 'riscos sem medida')}: o PDF não é gerado`, `${esc(sem.map((r) => r.risco).join(', '))}. Toque no lápis e escreva a medida.`); }
    else if (g.riscos.length) liC('g', 'Todos os riscos têm medida', '');
    else if (!g.sug?.carregando) liC('y', 'Nenhum risco na lista', g.tipo === 'epi' ? 'A tabela de entregas sai em branco para escrever os EPI' : 'A tabela de riscos sai em branco. Peça a sugestão do Laudomiro ou escreva os riscos acima');
  }
  if (!partes) return { bloqueia, motivo };
  const n = Docs.camposAMao(partes);
  if (n) liC('y', `${plural(n, 'campo para preencher à mão', 'campos para preencher à mão')}`, 'Saem como linha em branco no papel');
  if (!it.length) return { html: '', bloqueia, motivo };
  return { html: `<div class="lq-conf" role="status"><p>Conferência antes do PDF</p><ul>${it.join('')}</ul></div>`, bloqueia, motivo };
}

/* ── Ações ──────────────────────────────────────────────────────────────── */
export function digitar(chave, valor) {
  const m = /^lq\.g\.(\d+)\.(.+)$/.exec(chave); if (!m) return false;
  const turno = _ctx.turno(+m[1]); const g = turno?.gerar; if (!g) return true;
  const r = /^r\.(\d+)\.(risco|fonte|danos|epc|adm|epi)$/.exec(m[2]);
  if (r && g.riscos[+r[1]]) { g.riscos[+r[1]][r[2]] = String(valor).slice(0, 200); g.riscos[+r[1]].origem = g.riscos[+r[1]].origem === 'manual' ? 'manual' : 'editado'; }
  else if (m[2] === 'emerg') g.emerg = String(valor).slice(0, 1500);
  else if (m[2] === 'regdata') g.regData = valor;
  else if (m[2] === 'ls.busca' && g.ls) {   // filtra na tela, sem redesenhar (o campo não perde o foco)
    g.ls.busca = String(valor).slice(0, 80); const b = norm(g.ls.busca);
    document.querySelectorAll(`[data-lst="${m[1]}"] tr[data-lsb]`).forEach((tr) => { tr.hidden = !!b && !tr.dataset.lsb.includes(b); });
  }
  else if (m[2] === 'ls.motivo' && g.ls) g.ls.motivo = String(valor).slice(0, 300);
  else if (m[2] === 'rev.motivo' && g.prev) g.prev.motivo = String(valor).slice(0, 300);
  else if (m[2] === 'canc.motivo' && g.emit) g.emit.motivoCanc = String(valor).slice(0, 300);
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
    if (['lcli', 'ltipo', 'lsit'].includes(campo) && g.ls) { g.ls[{ lcli: 'cli', ltipo: 'tipo', lsit: 'sit' }[campo]] = val; await carregarEmitidos(g); redesenhar(); return true; }
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
    if (arg === 'emitidos') { g.ls = { cli: c?.id || '', tipo: '', sit: '', busca: '' }; await carregarEmitidos(g); redesenhar(); return true; }
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
  if (op === 'mais') { if (g.riscos.length < MAX_RISCOS) { g.riscos.push({ risco: '', fonte: '', danos: '', epc: '', adm: '', epi: '', origem: 'manual' }); g.editando = g.riscos.length - 1; } redesenhar(); focar(ti, g.editando); return true; }
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
  if (op === 'ass-abrir' && g.emit?.regs?.[+arg]) { abrirAssinaturaDoc(g, +ti, +arg, redesenhar); return true; }
  if (op === 'ass-pdf' && g.emit?.ass?.[+arg]) { try { await baixarAssinado(g, +arg); } catch (e) { avisar(e?.message || 'Não foi possível montar o PDF assinado.', 'erro'); } return true; }
  if (op === 'ls-pdf' && g.ls) { await baixarDaLista(g, arg); return true; }
  if (op === 'ls-ass' && g.ls) { await assinarDaLista(g, arg, redesenhar); return true; }
  if (op === 'ls-canc' && g.ls) { g.ls.cancId = arg; g.ls.motivo = ''; redesenhar(); return true; }
  if (op === 'ls-canc-fechar' && g.ls) { g.ls.cancId = ''; redesenhar(); return true; }
  if (op === 'ls-canc-ok' && g.ls) { await cancelarDaLista(g); redesenhar(); return true; }
  if (op === 'ls-mais' && g.ls) { g.ls.limite = (g.ls.limite || 60) + 60; await carregarEmitidos(g); redesenhar(); return true; }
  if (op === 'rev-sim' && g.prev) { g.prev.escolha = 'rev'; redesenhar(); return true; }
  if (op === 'rev-nao' && g.prev) { g.prev.escolha = 'novo'; redesenhar(); return true; }
  if (op === 'canc-abrir' && g.emit) { g.emit.cancAberto = true; redesenhar(); return true; }
  if (op === 'canc-fechar' && g.emit) { g.emit.cancAberto = false; redesenhar(); return true; }
  if (op === 'canc-enviar' && g.emit?.regs?.length === 1) { await cancelarEmitido(g); redesenhar(); return true; }
  return acaoResto(g, op, arg, ti, redesenhar);
}
async function baixarOuVer(g, op, arg) {
  {
    const docs = montarPartes(g);
    if (!docs.length) { avisar('Escolha a função ou a pessoa.', 'erro'); return true; }
    const cf = conferencia(g, docs[0]);
    if (cf.bloqueia) { avisar(cf.motivo, 'erro'); return true; }
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
      // v296: número, revisão e QR (só ao baixar; ver em PDF não gasta número)
      try { const regs = await registrarEmissao(g, docs); if (regs) { aplicarRegistro(docs, regs, g); g.emit.docs = docs; g.emit.nomes = g.dl ? [''] : pessoasDe(g).map((p) => (p.fora ? '' : p.nome)); await guardarConteudo(g); } }
      catch (e) { avisar(e?.message || 'Não foi possível registrar o documento.', 'erro'); return true; }
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
    ${conferencia(g, partes[0]).html}
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
    d.res = { titulo_atividade: r.titulo_atividade || '', subtipo: r.subtipo || '', secoes: r.secoes || [], referencias: r.referencias || [], avisos: r.avisos || [], conferir: r.conferir || [], citacoes: r.citacoes || null, sem_medida: Array.isArray(r.sem_medida) ? r.sem_medida : [] };
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
    itens.push(li('pr', 'Empresa, datas, nomes e assinaturas', 'Saem em branco para escrever à mão'));
    const partes = partesLivre(g);
    const cf = conferencia(g, partes[0]);
    corpo = `<div class="lq-doc-b"><div>
      ${mudou ? '<p class="lq-doc-nota" style="margin:0 0 12px"><b>A atividade mudou.</b> Toque em Montar de novo para refazer o documento.</p>' : ''}
      <p class="lq-doc-h">O Laudomiro montou</p><ul class="lq-doc-l">${itens.join('')}</ul>
      <p class="lq-doc-nota">Usou 1 pergunta. Escrito com a base de normas do Laudomiro. Confira antes de assinar. Não substitui o PGR nem o profissional legalmente habilitado.</p>
      ${d.erro ? `<p class="lq-doc-nota" role="alert"><b>${esc(d.erro)}</b></p>` : ''}
      ${d.ajusteAberto ? `<div class="lq-ajuste"><label class="lq-doc-sel"><small>O que mudar</small><textarea class="cp-inp lq-g-ta" data-cp="lq.g.${t}.dl.ajuste" aria-label="O que mudar no documento" placeholder="Ex.: incluir a etapa de içamento das telhas com corda">${esc(d.ajuste)}</textarea></label>
        <span class="lq-doc-acts mini"><button type="button" class="btn btn-navy btn-sm" data-acao="campo:lq-g:${t}.ajuste-enviar"${d.carregando ? ' disabled' : ''}>${d.carregando === 'ajuste' ? 'Refazendo...' : 'Refazer com o ajuste (usa 1 pergunta)'}</button><button type="button" class="btn btn-outline btn-sm" data-acao="campo:lq-g:${t}.ajuste-fechar">Cancelar</button></span></div>` : ''}
      ${cf.html}
      <div class="lq-doc-acts"><button type="button" class="btn btn-amber" data-acao="campo:lq-g:${t}.baixar.pdf"${d.carregando || cf.bloqueia ? ' disabled' : ''}>Baixar PDF</button><button type="button" class="btn btn-outline" data-acao="campo:lq-g:${t}.baixar.docx"${d.carregando || cf.bloqueia ? ' disabled' : ''}>Baixar Word</button>${d.ajusteAberto ? '' : `<button type="button" class="btn btn-outline" data-acao="campo:lq-g:${t}.ajuste-abrir">Mudar alguma coisa</button>`}</div>
      ${blocoEmitidos(g, t)}
    </div>${papel(partes[0], 1, t)}</div>`;
  }
  return `<article class="lq-resp lq-r2 lq-gerar">${cabT}${topo}${botaoMontar}${corpo}</article>`;
}

/** Documento livre em partes (v295): cabeçalho, campos e formulários fixos (conferidos pelo engenheiro),
 *  seções escritas pela IA, já com as citações conferidas pelo servidor. */
function nrsCitadas(r) {
  const txt = [...(r.referencias || []), ...r.secoes.flatMap((s) => [s.texto, ...(s.itens || []), ...(s.linhas || []).flat()])].join(' ');
  const nrs = [...new Set([...txt.matchAll(/\bNR\s?-?\s?0?(\d{1,2})\b/gi)].map((m) => `NR-${m[1].padStart(2, '0')}`))].sort();
  return nrs.length > 1 ? `${nrs.slice(0, -1).join(', ')} e ${nrs[nrs.length - 1]}` : nrs[0] || '';
}
function secaoPartes(s, num) {
  const out = [{ t: 'h', x: num ? `${num}. ${s.titulo.replace(/^\d+\.\s*/, '')}` : s.titulo }];
  if (s.formato === 'texto') out.push({ t: 'p', x: s.texto });
  else if (s.formato === 'tabela') { const n = s.colunas.length || 1; out.push({ t: 'tabela', cols: s.colunas.map((c) => ({ t: c, w: 1 / n })), linhas: s.linhas }); }
  else if (s.formato === 'numerada') s.itens.forEach((x, i) => out.push({ t: 'p', x: `${i + 1}. ${x}` }));
  else s.itens.forEach((x) => out.push({ t: 'li', x }));
  return out;
}
export function partesLivre(g) {
  const T = TIPOS[g.tipo], d = g.dl || {}, r = d.res;
  if (!r) return [];
  const emp = String(d.empresa || '').trim();
  const cli = (g.clientes || []).find((c) => norm(c.nome) === norm(emp));
  const docCli = cli ? docClienteTxt(cli, true) : '';
  const [rotDoc, valDoc] = docCli ? [docCli.replace(/\s.*$/, ''), docCli.replace(/^\S+\s/, '')] : ['CNPJ', '[preencher]'];
  const atividade = r.titulo_atividade || d.atividade || '';
  const subK = semAc(r.subtipo || ''), sub = SUBTIPO[subK] || '';
  const nrs = nrsCitadas(r);
  const faixa = { t: 'faixa', itens: [[g.tipo === 'pt' ? 'Contratante' : 'Empresa', emp || '[preencher]'], [rotDoc, valDoc]] };
  const secs = r.secoes.filter((s) => !/REFER/.test(s.titulo));
  const refs = [...new Set([...(r.secoes.find((s) => /REFER/.test(s.titulo))?.itens || []), ...(r.referencias || [])])];
  const refPartes = refs.length ? [{ t: 'h', x: 'Referências normativas' }, ...refs.map((x) => ({ t: 'li', x }))] : [];
  const avisos = (r.avisos || []).length ? [{ t: 'nota', x: r.avisos.join(' ') }] : [];
  const acha = (rx) => secs.find((s) => rx.test(semAc(s.titulo)));
  const resto = (usadas) => secs.filter((s) => !usadas.includes(s));

  if (g.tipo === 'apr') {
    const analise = acha(/analise de risc/);
    const out = [
      { t: 'cab', esq: emp, titulo: 'ANÁLISE DE RISCO DA TAREFA (APR)', norma: nrs, ctl: ['Nº [preencher]', 'Revisão 00', `Data ${DATA_MAO}`] }, faixa,
      { t: 'grade', cols: 4, itens: [{ r: 'Tarefa', v: atividade, span: 4 }, { r: 'Unidade ou obra', v: '', span: 2 }, { r: 'Local exato', v: '', span: 2 }, { r: 'Equipe executante (nomes e funções)', v: '', span: 4 }, { r: 'Tipo', v: '[ ] Rotineira   [ ] Não rotineira', span: 2 }, { r: 'Responsável pela supervisão', v: '', span: 2 }] },
    ];
    secs.forEach((s) => {
      if (s !== analise) { out.push(...secaoPartes(s)); return; }
      // a classificação é da empresa: P, S, Nível e Residual em branco (a coluna "Nível" antiga sai)
      const keep = s.colunas.map((c, i) => (/n[ií]vel/i.test(c) ? -1 : i)).filter((i) => i >= 0);
      const cols = keep.map((i) => s.colunas[i]);
      const larg = (c) => (/medida/i.test(c) ? 0.33 : /etapa/i.test(c) ? 0.115 : /les[aã]o|agravo/i.test(c) ? 0.14 : 0.12);
      const soma = cols.reduce((a, c) => a + larg(c), 0), fator = (1 - 0.215) / soma;
      out.push({ t: 'h', x: 'Análise de riscos · P, S e Nível pela matriz da empresa' },
        { t: 'tabela', cols: [...cols.map((c) => ({ t: c, w: larg(c) * fator })), { t: 'P', w: 0.038, centro: true }, { t: 'S', w: 0.038, centro: true }, { t: 'Nível', w: 0.055, centro: true }, { t: 'Residual', w: 0.084, centro: true }],
          linhas: s.linhas.map((l) => [...keep.map((i) => l[i] || ''), '', '', '', '']) },
        { t: 'nota', x: 'P probabilidade · S severidade. Nível e risco residual pela matriz de risco da empresa, com os critérios em documento (NR-01, item 1.5.4.4.2.2). A classificação não é feita pela IA.' },
        { t: 'p', x: 'Matriz usada: [preencher]     Classificado por: [preencher]' });
    });
    out.push(...refPartes,
      { t: 'h', x: 'Trabalhadores consultados' }, { t: 'tabela', alt: 8, cols: [{ t: 'Nome', w: 0.4 }, { t: 'Função', w: 0.3 }, { t: 'Assinatura', w: 0.3 }], linhas: [], vazias: 4 },
      { t: 'assin', blocos: [{ titulo: 'Elaborado por', linhas: ['Nome e função: [preencher]', `Data: ${DATA_MAO}`] }, { titulo: 'Aprovado por', linhas: ['Nome e cargo: [preencher]', `Data: ${DATA_MAO}`] }] },
      { t: 'nota', x: 'Esta APR não substitui o inventário de riscos do PGR.' }, ...avisos, { t: 'rod', x: `APR · ${atividade}` });
    return [out];
  }

  if (g.tipo === 'pt') {
    const altura = subK === 'altura', eletr = subK === 'eletricidade';
    const titulo = eletr ? 'PERMISSÃO DE TRABALHO / ORDEM DE SERVIÇO · ELETRICIDADE' : `PERMISSÃO DE TRABALHO${sub ? ` · ${sub.toUpperCase()}` : ''}`;
    const norma = altura ? `NR-35, item 35.5.8${/NR-18/.test(nrs) ? ' · NR-18' : ''}` : eletr ? 'NR-10, item 10.11.2' : nrs;
    const desc = acha(/descricao/), req = acha(/requisito/), med = acha(/medidas/);
    const out = [
      { t: 'cab', esq: emp, titulo, norma, ctl: ['Nº PT [preencher]', 'APR vinculada [preencher]', `Data ${DATA_MAO}`] },
      { t: 'faixa', itens: [['Contratante', emp || '[preencher]'], ['Executante', '[preencher]']] },
      { t: 'grade', cols: 4, itens: [{ r: 'Serviço', v: atividade, span: 4 }, { r: 'Local exato', v: '', span: 2 }, { r: 'Início', v: '___:___' }, { r: 'Término previsto', v: '___:___' }, { r: 'Emitente (nome)', v: '', span: 2 }, { r: 'Responsável pela execução', v: '', span: 2 }] },
    ];
    if (desc) out.push(...secaoPartes(desc));
    if (req) out.push({ t: 'h', x: 'Checklist de liberação · "Não" em qualquer item: a PT não é liberada' },
      { t: 'tabela', cols: [{ t: 'Item verificado', w: 0.62 }, { t: 'Sim', w: 0.07, centro: true }, { t: 'Não', w: 0.07, centro: true }, { t: 'N/A', w: 0.07, centro: true }, { t: 'Rubrica', w: 0.17 }],
        linhas: [...(req.itens || []).map((x) => [x, '[ ]', '[ ]', '[ ]', '']), ...(altura ? [['Trabalhadores com NR-35 válida e ASO apto para altura', '[ ]', '[ ]', '[ ]', '']] : [])] });
    if (med) out.push({ t: 'h', x: 'Medidas da análise de risco' },
      { t: 'tabela', cols: [{ t: 'Medida', w: 0.6 }, { t: 'Implantada', w: 0.16, centro: true }, { t: 'Responsável', w: 0.24 }], linhas: (med.itens || []).map((x) => [x, '[ ] S   [ ] N', '']) });
    resto([desc, req, med]).forEach((s) => out.push(...secaoPartes(s)));
    out.push({ t: 'h', x: 'Envolvidos · todos com ciência antes de iniciar' },
      { t: 'tabela', alt: 8, cols: [{ t: 'Nome', w: 0.3 }, { t: 'Função na tarefa', w: 0.16 }, { t: altura ? 'NR-35 válida até' : eletr ? 'NR-10 válida até' : 'Autorização ou treinamento', w: 0.17 }, { t: 'ASO apto (data)', w: 0.15 }, { t: 'Ciência (assinatura)', w: 0.22 }], linhas: [], vazias: 4 },
      { t: 'h', x: 'Aprovação · revalidação · suspensão · encerramento' },
      { t: 'tabela', alt: 9, cols: [{ t: 'Etapa', w: 0.24 }, { t: 'Data e hora', w: 0.15 }, { t: 'Observação', w: 0.37 }, { t: 'Assinatura', w: 0.24 }],
        linhas: [['Aprovação e liberação (PT acessível no local)', '', '', ''], ['Revalidação [ ] condições e equipe iguais', '', '', ''], ['Suspensão ou cancelamento', '', 'Motivo:', ''], ['Encerramento [ ] área liberada', '', 'Ocorrências:', '']] },
      { t: 'nota', x: altura ? 'Validade: só a duração da atividade, restrita ao turno ou à jornada; revalidar só sem mudança nas condições ou na equipe (NR-35, item 35.5.8.2). Encerrar e arquivar para rastreabilidade (NR-35, item 35.5.8).' : 'Validade: só a duração da atividade, restrita ao turno ou à jornada. Encerrar e arquivar para rastreabilidade.' },
      ...refPartes,
      { t: 'assin', blocos: [{ titulo: 'Responsável pela autorização da permissão', linhas: ['Nome: [preencher]'] }, { titulo: 'Responsável pelo encerramento', linhas: ['Nome: [preencher]'] }] },
      ...avisos, { t: 'rod', x: `PT · ${atividade} · válida só no turno` });
    return [out];
  }

  if (g.tipo === 'checklist') {
    const out = [
      { t: 'cab', esq: emp, titulo: 'CHECKLIST DE INSPEÇÃO DE SEGURANÇA', norma: [sub, nrs].filter(Boolean).join(' · '), ctl: ['Nº [preencher]', 'Revisão 00', `Data ${DATA_MAO}`] }, faixa,
      { t: 'grade', cols: 4, itens: [{ r: 'O que é inspecionado', v: atividade, span: 2 }, { r: 'Identificação (TAG, série ou patrimônio)', v: '', span: 2 }, { r: 'Local', v: '', span: 2 }, { r: 'Hora', v: '___:___' }, { r: 'Inspetor', v: '' }] },
    ];
    secs.forEach((s) => {
      if (s.formato !== 'tabela') { out.push(...secaoPartes(s)); return; }
      const ii = Math.max(0, s.colunas.findIndex((c) => /item/i.test(c))), ic = s.colunas.findIndex((c) => /cr[ií]tico/i.test(c)), ib = s.colunas.findIndex((c) => /base|norma|refer|fundamento/i.test(c));
      out.push({ t: 'h', x: 'Itens · item crítico "NC": parar o uso e avisar o responsável' },
        { t: 'tabela', cols: [{ t: 'Nº', w: 0.04, centro: true }, { t: 'Item verificado', w: 0.43 }, { t: 'Crítico', w: 0.08, centro: true }, { t: 'C', w: 0.05, centro: true }, { t: 'NC', w: 0.05, centro: true }, { t: 'N/A', w: 0.05, centro: true }, { t: 'Observação', w: 0.15 }, { t: 'Base', w: 0.15 }],
          linhas: s.linhas.map((l, i) => [String(i + 1), l[ii] || '', ic >= 0 && /^sim/i.test(l[ic] || '') ? { x: 'Sim', neg: true } : '', '[ ]', '[ ]', '[ ]', '', ib >= 0 ? (l[ib] || '') : '']) },
        { t: 'nota', x: 'C conforme · NC não conforme · N/A não se aplica. Os itens críticos foram sugeridos pelo Laudomiro: a empresa pode ajustar.' });
    });
    out.push({ t: 'h', x: 'Não conformidades encontradas' },
      { t: 'tabela', alt: 8, cols: [{ t: 'Item', w: 0.06 }, { t: 'Descrição', w: 0.3 }, { t: 'Ação imediata', w: 0.2 }, { t: 'Responsável', w: 0.16 }, { t: 'Prazo', w: 0.12 }, { t: 'Corrigido em', w: 0.16 }], linhas: [], vazias: 3 },
      { t: 'p', x: 'Resultado: [ ] Liberado para uso     [ ] Não liberado' }, ...refPartes,
      { t: 'assin', blocos: [{ titulo: 'Inspetor', linhas: ['Nome: [preencher]', `Data: ${DATA_MAO}`] }, { titulo: 'Responsável pelo setor', linhas: ['Nome: [preencher]', `Data: ${DATA_MAO}`] }] },
      ...avisos, { t: 'rod', x: `Checklist · ${atividade}` });
    return [out];
  }

  // procedimento
  const eletr = subK === 'eletricidade' || /NR-10/.test(nrs) && secs.some((s) => /BASE T[EÉ]CNICA/.test(s.titulo));
  const out = [
    { t: 'cab', esq: emp, titulo: `PROCEDIMENTO DE TRABALHO · ${atividade.toUpperCase()}`.slice(0, 90), norma: eletr ? 'NR-10, item 10.11' : nrs, ctl: ['Nº [preencher]', 'Revisão 00', `Vigência ${DATA_MAO}`] }, faixa,
    ...(eletr ? [{ t: 'nota', x: 'Estrutura mínima da NR-10, item 10.11.3: objetivo, campo de aplicação, base técnica, competências e responsabilidades, disposições gerais, medidas de controle e orientações finais.' }] : []),
  ];
  secs.forEach((s, i) => out.push(...secaoPartes(s, i + 1)));
  out.push(...refPartes,
    { t: 'h', x: 'Controle de revisões' }, { t: 'tabela', cols: [{ t: 'Rev.', w: 0.08 }, { t: 'Data', w: 0.14 }, { t: 'Alteração', w: 0.52 }, { t: 'Aprovado por', w: 0.26 }], linhas: [['00', '', 'Emissão inicial', '']], vazias: 2 },
    { t: 'assin', blocos: [{ titulo: 'Elaborado por', linhas: ['Nome e registro: [preencher]'] }, { titulo: 'Aprovado por', linhas: ['Nome e cargo: [preencher]'] }] },
    ...avisos, { t: 'rod', x: `Procedimento · ${atividade} · Rev. 00` });
  return [out];
}
