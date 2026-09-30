/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/campo/acoes.js — Planos de ação de todas as empresas (v223)
   O que falta lançar no SOC, o que precisa ser atualizado lá e o que vence
   nos próximos 15 dias ou já venceu. Tocar numa ação abre a tela de lançar
   no SOC daquela avaliação (soc.js).
   Técnico vê só as ações das avaliações dele (regra do banco, PASSO-74).
   ══════════════════════════════════════════════════════════════════════════ */

import * as D from './dados.js';
import * as P from './plano.js';
import { I, esc, nota, ligarTela, btn } from './comum.js';
import { pill } from './planotela.js';
import { estadoSoc, vencida } from './soc.js';

let _filtro = 'lancar', _busca = '';

const FILTROS = [
  ['lancar', 'A lançar no SOC'], ['atualizar', 'Atualizar no SOC'], ['vencendo', 'Vencem em 15 dias'],
  ['vencidas', 'Vencidas'], ['abertas', 'Em aberto'], ['concluidas', 'Concluídas'], ['todas', 'Todas']
];

export async function render() {
  ligarTela(null);
  let lista;
  try { lista = await D.listarAcoes(); }
  catch (e) { return nota(esc(D.traduzirErro(e)), 'red'); }
  if (!D.temTabelaAcoes()) return nota('O plano de ação precisa do PASSO-74 no banco. Peça ao suporte do GRID.', 'warn');
  const clis = await D.clientesPorId(lista.map(a => a.cliente_id));
  const h = P.hojeIso(), lim = P.somarDias(h, 15);
  const aberta = (a) => ['pendente', 'em_andamento'].includes(a.situacao) && !a.removida_em;
  const teste = {
    lancar: a => estadoSoc(a)[0] === 'lancar' && a.situacao !== 'cancelada',
    atualizar: a => ['atualizar'].includes(estadoSoc(a)[0]) || (a.removida_em && a.soc_versao > 0 && a.situacao !== 'concluida'),
    vencendo: a => aberta(a) && a.prazo && a.prazo >= h && a.prazo <= lim,
    vencidas: a => aberta(a) && vencida(a),
    abertas: a => aberta(a),
    concluidas: a => a.situacao === 'concluida',
    todas: () => true
  };
  const n = Object.fromEntries(FILTROS.map(([k]) => [k, lista.filter(teste[k]).length]));
  const b = _busca.trim().toLowerCase();
  const vis = lista.filter(teste[_filtro]).filter(a => !b || [clis[a.cliente_id]?.nome, a.o_que, a.ghe_nome, a.numero].some(x => String(x || '').toLowerCase().includes(b)));
  const porCli = new Map();
  for (const a of vis) { const k = a.cliente_id; if (!porCli.has(k)) porCli.set(k, []); porCli.get(k).push(a); }
  const grupos = [...porCli.entries()].sort((x, y) => String(clis[x[0]]?.nome || '').localeCompare(String(clis[y[0]]?.nome || ''), 'pt-BR'));

  const linha = (a) => { const [, t, c] = estadoSoc(a);
    return `<button type="button" class="cp-ac-lin" data-acao="ir:campo-soc:${a.avaliacao_id}~${esc(a.numero || '')}">
      <span class="n">${esc(a.numero || '')}</span>
      <span class="tx"><b>${esc(String(a.o_que || '').replace(/\s·\s*A-\d+$/, ''))}</b><small>${esc(a.toda_empresa ? 'Toda a empresa' : 'GHE ' + (a.ghe_nome || ''))}</small></span>
      <span class="st">${pill(a.prioridade)}<span class="cp-sit ${c}">${esc(t)}</span></span>
      <span class="pz${vencida(a) ? ' venc' : ''}">${a.situacao === 'concluida' ? 'concluída ' + esc(P.dataBr(a.data_conclusao)) : 'até ' + esc(P.dataBr(a.prazo))}</span></button>`; };

  return `<div class="cp-topo"><div class="cp-topo-txt"><div class="cp-topo-emp">Avaliação de Campo</div><div class="cp-topo-tit">Planos de ação</div>
      <div class="cp-topo-sub">O que lançar no SOC e o que acompanhar, de todas as empresas.</div></div>${btn('Voltar para as avaliações', 'ir:campo', { cls: 'btn-ghost' })}</div>
    <div class="cp-ac-filtros">${FILTROS.map(([k, t]) => `<button type="button" class="${k === _filtro ? 'on' : ''}${(k === 'vencidas' || k === 'atualizar') && n[k] ? ' al' : ''}" data-acao="campo:ac-filtro:${k}">${esc(t)} <b>${n[k]}</b></button>`).join('')}</div>
    <div class="turmas-busca" style="margin:0 0 12px"><span style="position:absolute;left:11px;top:50%;transform:translateY(-50%);width:15px;height:15px;color:var(--text-3)">${I.busca}</span>
      <input type="search" id="cpBuscaAcoes" data-acao="campo:ac-busca" value="${esc(_busca)}" placeholder="Buscar empresa, ação ou GHE..."></div>
    ${grupos.length ? grupos.map(([cid, as]) => `<div class="cp-sec cp-ac-grupo"><div class="cp-sec-tit">${esc(clis[cid]?.nome || 'Empresa')} <span class="dir" style="color:var(--text-3)">${as.length}</span></div>${as.map(linha).join('')}</div>`).join('')
      : nota(lista.length ? 'Nenhuma ação neste filtro.' : 'Ainda não há plano de ação lançado. Ele aparece aqui quando uma avaliação com plano é concluída.')}`;
}

export async function acao(nome, valor, redesenhar) {
  if (nome === 'campo:ac-filtro') { _filtro = valor; redesenhar(); return true; }
  if (nome === 'campo:ac-busca') { _busca = valor || ''; redesenhar(); return true; }
  return false;
}
