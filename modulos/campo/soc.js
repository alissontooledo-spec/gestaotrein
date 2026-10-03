/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/campo/soc.js — Lançar o plano de ação no SOC (v223)
   Tela do operador (computador, com o SOC aberto ao lado). Os campos seguem
   a ordem da tela "GRO › Plano de ação › Ação" do SOC; cada texto tem o
   botão Copiar. Os campos de lista do SOC mostram o que escolher.
   "Salvei no SOC" grava a versão do texto que foi lançada (campo_acoes,
   PASSO-74). Quando a situação muda aqui (em andamento, concluída), o GRID
   reescreve as linhas SITUAÇÃO e CONCLUSÃO do "Como?" — porque o documento
   do SOC não imprime Situação nem Data de Conclusão — e pede para colar o
   Como? novo no SOC.
   ══════════════════════════════════════════════════════════════════════════ */

import * as D from './dados.js';
import * as P from './plano.js';
import { I, esc, nota, ligarTela, avisar, confirmar, ponte, btn, seg, irPara, cabecalhoCelular, rolarTopo } from './comum.js';
import { pill } from './planotela.js';

let _id = null, _grupo = null, _acoes = [], _sel = null, _cli = null, _av = null;
let _focoAplicado = null;
let _feitos = new Set();         // "acaoId:versão:campo" já copiados/feitos nesta sessão
let _concluir = null;            // { data, resultado } enquanto preenche a conclusão
const hoje = () => P.hojeIso();
const podeAlterar = () => (ponte().pode ? ponte().pode('campo', 2) !== false : true);

export function estadoSoc(a) {
  if (a.removida_em && !(a.soc_versao > 0)) return ['fora', 'saiu do plano', 's-cin'];
  if (a.removida_em) return ['fora', 'saiu do plano · tirar do SOC', 's-ver'];
  if (!(a.soc_versao > 0)) return ['lancar', 'a lançar no SOC', 's-pen'];
  if (a.soc_versao < a.texto_versao) return ['atualizar', 'atualizar no SOC', 's-atu'];
  return ['ok', 'no SOC', 's-soc'];
}
export const vencida = (a) => ['pendente', 'em_andamento'].includes(a.situacao) && a.prazo && a.prazo < hoje();

async function carregar() {
  const d = await D.abrir(_id);
  _av = d.av; _grupo = d.av.grupo_id;
  _cli = (await D.clientesPorId([d.av.cliente_id]))[d.av.cliente_id] || null;
  _acoes = await D.listarAcoes({ grupoId: _grupo });
  _acoes.sort((a, b) => (parseInt(String(a.numero).replace(/\D/g, '')) || 0) - (parseInt(String(b.numero).replace(/\D/g, '')) || 0));
}

export async function render(params) {
  const [id, foco] = String(params?.id || '').split('~');
  if (id !== _id) { _sel = null; _concluir = null; _focoAplicado = null; }
  _id = id;
  ligarTela({ digitar });
  if (!_id) return nota('Nenhuma avaliação selecionada.');
  try { await carregar(); }
  catch (e) { return nota(esc(D.traduzirErro(e)), 'red'); }
  cabecalhoCelular(null, _cli, 'Lançar o plano no SOC');
  if (!D.temTabelaAcoes()) return nota('O plano de ação precisa do PASSO-74 no banco. Peça ao suporte do GRID.', 'warn');
  if (!_acoes.length) return `${cab()}${nota(_av?.situacao === 'concluida'
    ? 'Esta avaliação foi concluída sem plano de ação (antes da versão 223, ou sem riscos que pedem ação).'
    : 'O plano vai para o SOC depois que a avaliação é concluída. Até lá, ele fica na tela Plano de ação da avaliação.')}
    <div style="margin-top:10px">${btn('Voltar para a avaliação', `ir:campo-avaliacao:${_id}`, { cls: 'btn-ghost' })}</div>`;
  if (foco && foco !== _focoAplicado) { const f = _acoes.find(a => a.numero === foco && a.situacao !== 'concluida') || _acoes.find(a => a.numero === foco); if (f) _sel = f.id; _focoAplicado = foco; }   // só na chegada (v228: ação anual repete o número; vale a aberta)
  if (!_acoes.some(a => a.id === _sel)) _sel = (_acoes.find(a => estadoSoc(a)[0] === 'lancar') || _acoes.find(a => estadoSoc(a)[0] === 'atualizar') || _acoes[0]).id;
  const a = _acoes.find(x => x.id === _sel);
  const nOk = _acoes.filter(x => estadoSoc(x)[0] === 'ok').length;
  const lista = _acoes.map(x => { const [, t, c] = estadoSoc(x);
    return `<button type="button" class="cp-soc-it${x.id === _sel ? ' on' : ''}" data-acao="campo:soc-sel:${x.id}">
      <span class="n">${esc(x.numero || '')}</span><span class="tx"><b>${esc(String(x.o_que || '').replace(/\s·\s*A-\d+$/, ''))}</b>
      <span>${pill(x.prioridade)} <span class="cp-sit ${c}">${esc(t)}</span>${vencida(x) ? ' <span class="cp-sit s-ver">vencida</span>' : ''}${x.recorrencia_meses ? ` <span class="cp-sit s-ano">${x.recorrencia_meses === 12 ? 'todo ano' : 'a cada ' + x.recorrencia_meses + ' meses'}</span>` : ''}${x.situacao !== 'pendente' ? ` <span class="cp-sit s-and">${esc(P.NOME_SIT[x.situacao] || x.situacao)}</span>` : ''}</span></span></button>`; }).join('');
  return `${cab()}
    <div class="cp-soc">
      <div class="cp-soc-lista"><div class="cp-soc-lh"><b>${_acoes.length} ${_acoes.length === 1 ? 'ação' : 'ações'}</b><span>${nOk} no SOC</span></div>
        <div class="cp-soc-prog"><i style="width:${Math.round(nOk / _acoes.length * 100)}%"></i></div>${lista}</div>
      <div class="cp-soc-painel">${painel(a)}</div>
    </div>
    <div style="margin:14px 0">${btn('Voltar para a avaliação', `ir:campo-avaliacao:${_id}`, { cls: 'btn-ghost' })} ${btn('Todas as ações', 'ir:campo-acoes', { cls: 'btn-ghost' })}</div>`;
}

function cab() {
  return `<div class="cp-topo cp-topo-desk"><div class="cp-topo-txt"><div class="cp-topo-emp">Plano de ação · lançar no SOC</div>
    <div class="cp-topo-tit">${esc(_cli?.nome || 'Empresa')}</div>
    <div class="cp-topo-sub">Avaliação ${esc(_av?.numero || '')} · revisão ${esc(_av?.revisao || 1)} · no SOC: GRO › Plano de ação › nova ação</div></div></div>`;
}

const chaveF = (a, campo) => `${a.id}:${a.texto_versao}:${campo}`;
function linhaCampo(a, campo, rotulo, valor, { sub = '', copiar = true, pre = false, dica = '' } = {}) {
  const feito = _feitos.has(chaveF(a, campo));
  const val = valor === '' || valor == null ? '<span class="cp-soc-vz">(deixe em branco)</span>' : (pre ? `<pre>${esc(valor)}</pre>` : esc(valor));
  const bt = copiar && valor ? btn(feito ? 'Copiado' : 'Copiar', `campo:soc-copiar:${campo}`, { cls: feito ? 'btn-ok btn-sm' : 'btn-navy btn-sm' })
    : btn(feito ? 'Feito' : 'Feito?', `campo:soc-feito:${campo}`, { cls: feito ? 'btn-ok btn-sm' : 'btn-outline btn-sm' });
  return `<div class="cp-soc-campo${feito ? ' feito' : ''}"><div class="rot">${esc(rotulo)}${sub ? `<small>${esc(sub)}</small>` : ''}</div>
    <div class="val">${val}${dica ? `<div class="cp-soc-dica">${dica}</div>` : ''}</div><div class="bt">${bt}</div></div>`;
}

const valores = (a) => ({
  o_que: a.o_que, por_que: a.por_que, como: a.como,
  quem: a.quem || '', quanto: a.quanto != null ? P.fmtQuanto(a.quanto) : '', quando: P.dataBr(a.prazo),
  data_conclusao: a.situacao === 'concluida' ? P.dataBr(a.data_conclusao) : '', resultado: a.resultado || ''
});

function painel(a) {
  const [est] = estadoSoc(a);
  const v = valores(a);
  const onde = a.toda_empresa
    ? 'Ligue a chave <b>Toda Empresa</b>.'
    : `Unidade <b>${esc(a.unidade || '(a do GHE)')}</b> · GHE <b>${esc(a.ghe_nome || '')}${a.ghe_codigo_soc ? ' # ' + esc(a.ghe_codigo_soc) : ''}</b>${a.risco_nome ? ` · Perigos/Fatores de risco: <b>${esc(a.risco_nome)}${a.risco_codigo ? ' (' + esc(a.risco_codigo) + ')' : ''}</b>` : ''}`;
  const avisoEst = est === 'atualizar' ? nota(`O texto mudou depois do lançamento (versão ${a.texto_versao}; no SOC está a ${a.soc_versao}). No SOC, abra a ação <b>${esc(a.numero)}</b>, cole o <b>Como?</b> novo e acerte a <b>Situação</b>${a.situacao === 'concluida' ? ' e a <b>Data de Conclusão</b>' : ''}. Depois toque em <b>Atualizei no SOC</b>.`, 'warn')
    : est === 'fora' ? nota(a.soc_versao > 0 ? 'Esta ação saiu do plano numa revisão nova da avaliação. No SOC, apague a ação ou marque como concluída.' : 'Esta ação saiu do plano numa revisão nova da avaliação. Não precisa lançar.', 'warn')
    : est === 'ok' ? `<div class="cp-pa-ok">${I.check}<span>Lançada no SOC em ${esc(new Date(a.soc_lancada_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }))}.</span></div>` : '';
  const botaoSoc = !podeAlterar() ? '' : est === 'lancar' ? btn('Salvei no SOC · próxima ação', 'campo:soc-salvei', { cls: 'btn-amber' })
    : est === 'atualizar' ? btn('Atualizei no SOC', 'campo:soc-salvei', { cls: 'btn-amber' }) : '';
  return `<div class="cp-soc-ph"><div>${pill(a.prioridade)} <span class="cp-soc-num">${esc(a.numero || '')}</span></div>
      <h3>${esc(String(a.o_que || '').replace(/\s·\s*A-\d+$/, ''))}</h3>
      <div class="cp-soc-nav">${btn(I.chevL, 'campo:soc-ant', { cls: 'btn-outline btn-sm' })}${btn('Próxima', 'campo:soc-prox', { cls: 'btn-outline btn-sm' })}</div></div>
    ${avisoEst}
    ${linhaCampo(a, 'o_que', 'O quê?', v.o_que, { sub: `${v.o_que.length} de 100` })}
    ${linhaCampo(a, 'por_que', 'Por quê?', v.por_que, { sub: `${v.por_que.length} de 2.500`, pre: true })}
    ${linhaCampo(a, 'como', 'Como?', v.como, { sub: `${v.como.length} de 2.500`, pre: true })}
    <div class="cp-soc-grp">Escolher nas listas do SOC (não saem no documento: o GRID já escreveu no Por quê? e no Como?)</div>
    ${linhaCampo(a, 'prioridade', 'Prioridade', P.NOME_PRIO[a.prioridade], { copiar: false })}
    ${linhaCampo(a, 'situacao', 'Situação', P.NOME_SIT[a.situacao] || a.situacao, { copiar: false, dica: a.situacao === 'cancelada' ? 'No SOC não existe "Cancelada": apague a ação lá.' : '' })}
    ${linhaCampo(a, 'data_conclusao', 'Data de Conclusão', v.data_conclusao, { copiar: !!v.data_conclusao })}
    ${linhaCampo(a, 'categoria', 'Categoria', a.categoria || '', { copiar: false })}
    ${linhaCampo(a, 'relatorios', 'Exibir no relatório', (Array.isArray(a.relatorios) ? a.relatorios : []).join(' e ') || 'PGR', { copiar: false })}
    ${linhaCampo(a, 'quem', 'Quem?', v.quem, { sub: 'botão Adicionar', dica: v.quem ? 'No SOC, o responsável é escolhido da lista: procure por este nome.' : 'Escolha o responsável da empresa na lista do SOC.' })}
    ${linhaCampo(a, 'quanto', 'Quanto?', v.quanto)}
    ${linhaCampo(a, 'quando', 'Quando?', v.quando, { sub: 'Data Limite' })}
    <div class="cp-soc-campo${_feitos.has(chaveF(a, 'onde')) ? ' feito' : ''}"><div class="rot">Onde?<small>Seleção de hierarquia</small></div><div class="val">${onde}</div>
      <div class="bt">${btn(_feitos.has(chaveF(a, 'onde')) ? 'Feito' : 'Feito?', 'campo:soc-feito:onde', { cls: _feitos.has(chaveF(a, 'onde')) ? 'btn-ok btn-sm' : 'btn-outline btn-sm' })}</div></div>
    ${a.situacao === 'concluida' && v.resultado ? linhaCampo(a, 'resultado', 'Resultado (Conclusão)', v.resultado, { sub: `${v.resultado.length} de 500` }) : ''}
    <div class="cp-soc-fim">${botaoSoc}</div>
    ${acompanhar(a)}`;
}

function acompanhar(a) {
  const pode = podeAlterar();
  const c = _concluir && _concluir.id === a.id ? _concluir : null;
  const hist = (Array.isArray(a.historico) ? a.historico : []).slice(-6).reverse();
  return `<div class="cp-sec" style="margin-top:14px"><div class="cp-sec-tit">Acompanhar a ação <span class="dir" style="color:var(--text-3)">prazo ${esc(P.dataBr(a.prazo))}${vencida(a) ? ' · vencida' : ''}</span></div>
    ${pode ? seg('soc-sit', P.SITUACOES.map(([k, t]) => [k, t]), c ? 'concluida' : a.situacao, { amb: false }) : ''}
    ${c ? `<div class="cp-grid2" style="margin-top:12px"><div><label class="cp-lbl">Data de conclusão</label><input class="cp-inp" type="date" data-cp="soc.data" value="${esc(c.data)}" max="${hoje()}"></div><div></div></div>
      <label class="cp-lbl" style="margin-top:10px">Resultado (como foi verificado que funcionou; até 500 letras)</label>
      <textarea class="cp-inp" data-cp="soc.resultado" maxlength="500" style="min-height:64px" placeholder="Ex.: nova medição em 25/10 deu 83 dB(A); resultado atingido">${esc(c.resultado)}</textarea>
      <div style="display:flex;gap:8px;margin-top:10px">${btn('Salvar conclusão', 'campo:soc-concluir', { cls: 'btn-amber' })}${btn('Cancelar', 'campo:soc-concluir-nao', { cls: 'btn-ghost' })}</div>` : ''}
    <div class="cp-ajuda">Ao mudar a situação, o GRID reescreve as linhas SITUAÇÃO e CONCLUSÃO do Como? e pede para atualizar no SOC.</div>
    ${hist.length ? `<div class="cp-soc-hist">${hist.map(h => `<div><span>${esc(new Date(h.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }))}</span>${esc(h.evento || '')}</div>`).join('')}</div>` : ''}</div>`;
}

function digitar(chave, valor) {
  if (!_concluir) return;
  if (chave === 'soc.data') _concluir.data = valor;
  if (chave === 'soc.resultado') _concluir.resultado = String(valor || '').slice(0, 500);
}

async function copiarTexto(texto) {
  try { await navigator.clipboard.writeText(texto); return true; } catch { /* segue */ }
  try {
    const t = document.createElement('textarea'); t.value = texto; t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select(); const ok = document.execCommand('copy'); t.remove(); if (ok) return true;
  } catch { /* segue */ }
  const p = ponte();
  p.abrirModal('Copiar', `<div class="cp-ajuda">O navegador não deixou copiar sozinho. O texto já está selecionado: aperte Ctrl + C.</div>
    <textarea id="cpSocCopiar" style="width:100%;min-height:180px;margin-top:8px;font:inherit">${esc(texto)}</textarea>`, `<button class="btn btn-outline" onclick="fecharModal()">Fechar</button>`);
  setTimeout(() => { const el = document.getElementById('cpSocCopiar'); el?.focus(); el?.select(); }, 60);
  return false;
}

async function salvar(a, patch, okMsg, redesenhar) {
  try {
    const novo = await D.gravarAcao(a, patch);
    _acoes = _acoes.map(x => x.id === a.id ? novo : x);
    /* v228 (PASSO-77): ação anual concluída → o banco cria a do próximo ciclo; desfeita a conclusão, o banco a tira. */
    if (a.recorrencia_meses && patch.situacao && patch.situacao !== a.situacao) {
      await carregar().catch(() => {});
      const prox = _acoes.find(x => x.anterior_id === novo.id);
      if (patch.situacao === 'concluida' && prox) okMsg = `${okMsg || ''} Ação anual: a do próximo ciclo já foi criada, com prazo ${P.dataBr(prox.prazo)}. Lance no SOC quando chegar a hora.`.trim();
    }
    if (okMsg) avisar(okMsg);
  } catch (e) {
    avisar(e.message || String(e), 'erro');
    await carregar().catch(() => {});
  }
  await redesenhar();
}

export async function acao(nome, valor, redesenhar) {
  if (!nome.startsWith('campo:soc-')) return false;
  const a = _acoes.find(x => x.id === _sel);
  const mover = (dir) => { const i = _acoes.findIndex(x => x.id === _sel); const n = _acoes[i + dir]; if (n) { _sel = n.id; _concluir = null; } };
  switch (nome) {
    case 'campo:soc-sel': _sel = valor; _concluir = null; await redesenhar(); rolarTopo(); return true;
    case 'campo:soc-ant': mover(-1); await redesenhar(); return true;
    case 'campo:soc-prox': mover(1); await redesenhar(); return true;
  }
  if (!a) return true;
  if (['campo:soc-salvei', 'campo:soc-sit', 'campo:soc-concluir'].includes(nome) && !podeAlterar()) { avisar('Seu perfil só vê o plano de ação.', 'erro'); return true; }
  switch (nome) {
    case 'campo:soc-copiar': {
      const v = valores(a)[valor]; if (!v) return true;
      const ok = await copiarTexto(v);
      if (ok) { _feitos.add(chaveF(a, valor)); avisar('Copiado. Cole no SOC.'); }
      redesenhar(); return true;
    }
    case 'campo:soc-feito': { const k = chaveF(a, valor); _feitos.has(k) ? _feitos.delete(k) : _feitos.add(k); redesenhar(); return true; }
    case 'campo:soc-salvei': {
      const [est] = estadoSoc(a);
      await salvar(a, { soc_versao: a.texto_versao }, est === 'atualizar' ? 'Marcado: o SOC está com o texto novo.' : `Ação ${a.numero} marcada como lançada no SOC.`, async () => {});
      const prox = _acoes.find(x => ['lancar', 'atualizar'].includes(estadoSoc(x)[0]));
      if (prox) _sel = prox.id;
      await redesenhar(); rolarTopo(); return true;
    }
    case 'campo:soc-sit': {
      if (valor === a.situacao && valor !== 'concluida') return true;
      if (valor === 'concluida') { _concluir = { id: a.id, data: a.data_conclusao || hoje(), resultado: a.resultado || '' }; redesenhar(); return true; }
      _concluir = null;
      if (valor === 'cancelada') {
        if (!await confirmar(`Cancelar a ação ${a.numero}? No SOC não existe "Cancelada": depois apague a ação lá.`)) return true;
      }
      const como = P.atualizarComo(a.como, { situacao: valor, desde: hoje(), prazo: a.prazo, resultado: valor === 'cancelada' ? a.resultado : '' });
      await salvar(a, { situacao: valor, data_conclusao: null, como: como.slice(0, 2500) }, `Situação: ${P.NOME_SIT[valor]}. Atualize o Como? no SOC.`, redesenhar);
      return true;
    }
    case 'campo:soc-concluir-nao': _concluir = null; redesenhar(); return true;
    case 'campo:soc-concluir': {
      const c = _concluir; if (!c) return true;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(c.data || '')) { avisar('Informe a data de conclusão.', 'erro'); return true; }
      if (c.data > hoje()) { avisar('A data de conclusão não pode ser depois de hoje.', 'erro'); return true; }
      if (!String(c.resultado || '').trim()) { avisar('Escreva o resultado: como foi verificado que a ação funcionou (NR-01, item 1.5.5.2.2).', 'erro'); return true; }
      const como = P.atualizarComo(a.como, { situacao: 'concluida', data_conclusao: c.data, resultado: c.resultado });
      _concluir = null;
      await salvar(a, { situacao: 'concluida', data_conclusao: c.data, resultado: c.resultado.trim(), como: como.slice(0, 2500) },
        `Ação ${a.numero} concluída. Atualize no SOC: Como?, Situação, Data de Conclusão e Resultado.`, redesenhar);
      return true;
    }
  }
  return true;
}
