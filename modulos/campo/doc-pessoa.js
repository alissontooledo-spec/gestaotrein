/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/campo/doc-pessoa.js — aba Documentos do cadastro do colaborador (v308)
   Proposta aprovada em 06/11/2026: 08-Propostas-visuais/grid-proposta-fluxo-empresa-colaborador-v308.html

   O operador escolhe o documento e ele é montado ali mesmo, com a empresa e a pessoa do
   cadastro já escolhidas. Quem monta é o MESMO gerador do Laudomiro (laudomiro-gerar.js):
   mesmos textos de NR, mesma numeração, QR, assinatura e registro em "Documentos emitidos".
   A tela do Laudomiro não muda: ela continua com o gerador dela; aqui só se usa o mesmo cartão.

   A casca monta esta tela dentro da aba (navegacao.abrirNoPainel), com
   params = { id: <colaborador>, cliente: <empresa>, embutido: { aoMudar } }.
   ══════════════════════════════════════════════════════════════════════════ */

import * as Gerar from './laudomiro-gerar.js';
import { esc, ligarTela, ponte } from './comum.js';
import { cliente as clienteBanco } from '../../nucleo/dados.js';
import * as sessao from '../../nucleo/sessao.js';
import * as nav from '../../nucleo/navegacao.js';

const FUNCAO = 'laudomiro-perguntar';   // a mesma função do servidor que a tela do Laudomiro usa
const sb = () => { const c = clienteBanco(); if (!c) throw new Error('Banco indisponível. Recarregue o sistema.'); return c; };

/* Chamada ao servidor do Laudomiro (riscos da função, APR, PT, checklist, procedimento).
   Igual à da tela do Laudomiro: manda a organização aberta e renova a sessão uma vez se vencer. */
async function chamar(body, renovou = false) {
  const { data, error } = await sb().functions.invoke(FUNCAO, { body: { ...body, orgId: sessao.orgId?.() || undefined } });
  if (error && error.context?.status === 401 && !renovou) {
    const { error: eR } = await sb().auth.refreshSession().catch((e) => ({ error: e }));
    if (!eR) return chamar(body, true);
  }
  if (error) {
    let msg = error.message, codigo = '';
    try { const c = await error.context?.json?.(); if (c?.error) msg = c.error; if (c?.codigo) codigo = c.codigo; } catch { /* ok */ }
    const e = new Error(msg || 'O Laudomiro não respondeu.'); e.codigo = codigo; throw e;
  }
  if (data?.error) { const e = new Error(data.error); e.codigo = data.codigo || ''; throw e; }
  return data;
}

const IC = {
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
  epi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 15a8 8 0 0 1 16 0v1H4z"/><path d="M12 7V5M3 19h18"/></svg>',
  dossie: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
  apr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.5"/></svg>',
  lista: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4 6 1.5 1.5L8 5M4 12l1.5 1.5L8 11M4 18l1.5 1.5L8 17M11 6h9M11 12h9M11 18h9"/></svg>',
  voltar: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>',
};
/* Os documentos desta pessoa. Emitir documento é do Laudomiro: todos (menos o dossiê) precisam da
   permissão "usar o Laudomiro", como na 307b. O dossiê precisa de "exportar relatórios". */
const DOCS = [
  ['os', IC.doc, 'Ordem de Serviço', 'Riscos e medidas da função (NR-01)', 'lq'],
  ['epi', IC.epi, 'Ficha de EPI para assinar no papel', 'Com os EPI do GHE da função', 'lq'],
  ['dossie', IC.dossie, 'Dossiê do colaborador', 'Treinamentos, EPI e documentos', 'rel'],
  ['apr', IC.apr, 'APR', 'Análise preliminar de risco da tarefa', 'ia'],
  ['pt', IC.doc, 'Permissão de Trabalho', 'Altura, eletricidade ou trabalho a quente', 'ia'],
  ['checklist', IC.lista, 'Checklist de inspeção', 'Máquina, andaime, escada, extintor, EPI', 'ia'],
  ['procedimento', IC.lista, 'Procedimento de trabalho', 'Passo a passo seguro de uma atividade', 'ia'],
];
const podeAcao = (a) => { const p = ponte(); return typeof p.podeAcao === 'function' ? p.podeAcao(a) !== false : true; };
/* Mesma regra da tela do Laudomiro (semPermissao): vale a resposta do servidor (que sabe se a organização
   liberou o Laudomiro para o perfil padrão); sem ela, vale o perfil de acesso personalizado. */
let _lq = null;   // { org, v }
async function lerPermLq() {
  const pa = typeof window._permAtual === 'function' ? window._permAtual() : null;
  const org = `${sessao.orgId?.() || ''}|${pa ? (pa.acoes || {}).usar_laudomiro === true : 'padrao'}`;   // troca de perfil ou de empresa: pergunta de novo
  if (_lq?.org === org) return _lq.v;
  let v;
  try { const st = await chamar({ acao: 'status' }); if (typeof st?.permitido === 'boolean') v = st.permitido; } catch { /* sem resposta: vale o perfil */ }
  if (v === undefined) v = !pa || !!(pa.acoes || {}).usar_laudomiro;
  _lq = { org, v };
  return v;
}
const podeDoc = (req) => (req === 'rel' ? podeAcao('exportar_relatorios') : !!_lq?.v);

let S = { pessoa: '', cliente: '', turno: null };
let EMB = null;

/* O gerador pede para redesenhar quando termina de ler; só redesenha se esta tela ainda é a aberta. */
function repintar() { if (nav.telaAberta() === tela) nav.redesenhar(); }

function lista() {
  const xs = DOCS.filter(([, , , , req]) => podeDoc(req));
  const semLq = !_lq?.v;
  return `<section class="fc-p dp"><div class="dp-tit"><h3>Emitir documento</h3><small>Empresa e pessoa já preenchidas</small></div>
    ${xs.length ? `<div class="dp-tipos">${xs.map(([k, ic, t, sub, req]) => `<button type="button" class="dp-t" data-acao="campo:dp-tipo:${k}"><span class="ico">${ic}</span><span><b>${esc(t)}</b><small>${esc(sub)}</small></span>${req === 'ia' ? '<span class="ia">Laudomiro</span>' : ''}</button>`).join('')}</div>` : ''}
    ${semLq ? '<p class="lq-doc-nota" style="margin-top:12px">Emitir OS, ficha de EPI, APR, PT, checklist e procedimento usa o Laudomiro, que não está no seu perfil de acesso. Peça ao administrador.</p>' : ''}</section>`;
}

export const tela = {
  async render(params = {}) {
    EMB = params.embutido || null;
    const pessoa = String(params.id || ''), cliente = String(params.cliente || '');
    // cada vez que a aba abre, o documento começa do zero (a função ou a avaliação podem ter mudado);
    // nos redesenhos da mesma abertura (params.__dp), o que está sendo preenchido continua
    if (S.pessoa !== pessoa || S.cliente !== cliente || !params.__dp) S = { pessoa, cliente, turno: null };
    params.__dp = 1;
    ligarTela({ digitar: (chave, valor) => { if (String(chave).startsWith('lq.g.')) Gerar.digitar(chave, valor); } });
    Gerar.ligar({ chamar, repintar, aoGastar: () => {}, turno: (i) => (i === 0 ? S.turno : null) });   // a tela do Laudomiro liga o dela quando abre
    await lerPermLq();
    if (!cliente) return '<section class="fc-p dp"><div class="fc-vazio">Esta pessoa não está ligada a uma empresa. Edite o cadastro e escolha a empresa para emitir documentos.</div></section>';
    if (!S.turno) return lista();
    return `<div class="dp"><div class="dp-voltar"><button type="button" class="btn btn-ghost btn-sm" data-acao="campo:dp-trocar">${IC.voltar} Escolher outro documento</button></div>${Gerar.render(S.turno, 0)}</div>`;
  },
  async acao(nome, valor, redesenhar) {
    if (nome === 'campo:dp-tipo') {
      const d = DOCS.find(([k]) => k === valor);
      if (!Gerar.TIPOS[valor] || !d || !podeDoc(d[4])) return true;   // a permissão vale também aqui, não só na lista
      const turno = S.turno = Gerar.novoTurno('', { tipo: valor });
      redesenhar();
      await Gerar.iniciarCom(turno, { clienteId: S.cliente, pessoaId: S.pessoa });
      if (S.turno === turno) redesenhar();
      return true;
    }
    if (nome === 'campo:dp-trocar') { S.turno = null; redesenhar(); return true; }
    if (nome === 'campo:lq-g' || nome === 'campo:lq-g-sel') {
      const r = await Gerar.acao(nome, valor, redesenhar);
      // baixou, registrou, assinou ou cancelou: a lista de "Documentos emitidos" ao lado se atualiza
      const op = String(valor).split('.')[1] || '';
      if (/^(baixar|registrar|ass-|ls-)/.test(op)) { try { EMB?.aoMudar?.(); } catch { /* segue */ } }
      return r;
    }
    if (nome === 'campo:lq-pintar') { redesenhar(); return true; }
    return false;
  },
};
export default tela;
