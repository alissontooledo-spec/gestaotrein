/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/campo/lista.js — painel "Avaliações de campo"
   Uma linha por EMPRESA e visita (decisão de 26/09: o painel não é por GHE).
   A visita nasce na Agenda da Equipe (compromisso "Visita técnica"); aqui não
   existe tela de agendar, só o atalho para a agenda.
   Com internet, o painel também deixa no aparelho as avaliações em aberto do
   técnico, para ele poder abri-las depois sem sinal.

   v220 (proposta aprovada em 29/09, 08-Propostas-visuais/
   propostas-visuais-soc-turma-e-campo-v220.html, Parte 2):
   · dois modos de ver: Quadro (colunas por situação) e Lista (tabela). A
     escolha fica guardada no aparelho;
   · uma avaliação = um cartão: as revisões do mesmo número (grupo_id) viram
     um cartão só, da revisão MAIS RECENTE (regra que já existe: a revisão
     nova substitui a anterior quando é concluída). Os contadores contam
     avaliações, não revisões;
   · abre sem filtro (antes abria em "Em aberto" e ficava vazia quando tudo
     estava concluído);
   · sem arrastar cartões: a situação muda pelo trabalho feito na avaliação.
   ══════════════════════════════════════════════════════════════════════════ */

import * as sessao from '../../nucleo/sessao.js';
import * as D from './dados.js';
import { I, esc, ico, nota, fmtCnpj, selo, ligarTela, avisar } from './comum.js';

const CHAVE_MODO = 'grid:campo:modo';
const COLUNAS = [
  ['agendada', 'Agendadas', 'Nenhuma visita agendada.'],
  ['em_andamento', 'Em andamento', 'Nenhuma avaliação em andamento.'],
  ['aguardando', 'Aguardando informações', 'Nada esperando o cliente.'],
  ['concluida', 'Concluídas', 'Nenhuma avaliação concluída.']
];
const MAX_CONCLUIDAS_QUADRO = 5;
const MAX_LINHAS_LISTA = 150;

let _busca = '', _sit = '', _tec = '';
let _modo = lerModo();
let _colCel = '';            // coluna aberta no celular (vazio = automático)
let _preparando = false;

function lerModo() {
  try { const v = localStorage.getItem(CHAVE_MODO); return v === 'lista' ? 'lista' : 'quadro'; }
  catch { return 'quadro'; }
}
function guardarModo(m) { try { localStorage.setItem(CHAVE_MODO, m); } catch { /* aparelho sem armazenamento: só não lembra */ } }

const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;
const aberta = (a) => !['concluida', 'cancelada'].includes(a.situacao);
const hojeIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/* "Hoje · 14:00", "Amanhã · 14:00", "29/09 · 15:00" (ano só quando não é o atual). */
function quandoVisita(data, hora) {
  if (!data) return 'Sem data';
  const iso = String(data).slice(0, 10);
  const [a, m, d] = iso.split('-');
  const hoje = hojeIso();
  const am = new Date(); am.setDate(am.getDate() + 1);
  const amanha = `${am.getFullYear()}-${String(am.getMonth() + 1).padStart(2, '0')}-${String(am.getDate()).padStart(2, '0')}`;
  const dia = iso === hoje ? 'Hoje' : iso === amanha ? 'Amanhã' : `${d}/${m}${a !== hoje.slice(0, 4) ? '/' + a.slice(2) : ''}`;
  return hora ? `${dia} · ${String(hora).slice(0, 5)}` : dia;
}
const atrasada = (a) => a.situacao === 'agendada' && a.data_visita && String(a.data_visita).slice(0, 10) < hojeIso();

function iniciais(nome) {
  const p = String(nome || '').trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  return ((p[0][0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}

/* Uma avaliação por número: agrupa as revisões (grupo_id; sem grupo, a
   própria linha) e fica com a revisão mais recente. */
export function agruparRevisoes(lista) {
  const grupos = new Map();
  for (const a of lista) {
    const k = a.grupo_id || a.id;
    const g = grupos.get(k);
    if (!g) { grupos.set(k, { ...a, _revisoes: 1 }); continue; }
    const n = g._revisoes + 1;
    const maisNova = (Number(a.revisao) || 0) > (Number(g.revisao) || 0)
      || ((Number(a.revisao) || 0) === (Number(g.revisao) || 0) && String(a.criado_em || '') > String(g.criado_em || ''));
    grupos.set(k, maisNova ? { ...a, _revisoes: n } : { ...g, _revisoes: n });
  }
  return [...grupos.values()];
}

/* Texto do levantamento e progresso (mesma regra do cartão da v207). */
function levantamento(a) {
  const r = a.resumo || {};
  const pendencias = r.pendencias || [];
  const nG = r.ghes || 0, nR = r.riscos || 0;
  const feitos = r.riscos_ok ?? null;
  const out = { resumo: '', barra: null, pct: null, status: '', tom: '' };
  if (a.situacao === 'concluida') {
    out.resumo = nG ? `${plural(nG, 'GHE', 'GHEs')} · ${plural(nR, 'risco', 'riscos')}` : 'Concluída';
    if (!a.pdf_path) { out.status = 'PDF a gerar'; out.tom = 'cinza'; }
  } else if (a.situacao === 'cancelada') {
    out.resumo = 'Visita cancelada na agenda';
  } else if (!nG) {
    out.resumo = a.situacao === 'agendada' ? 'GHEs definidos na visita' : 'GHEs a definir';
  } else {
    if (feitos != null && nR) {
      out.pct = Math.round(feitos / nR * 100);
      out.barra = `<b>${feitos} de ${nR}</b> ${nR === 1 ? 'risco' : 'riscos'} · ${plural(nG, 'GHE', 'GHEs')}`;
    } else {
      out.resumo = `${plural(nG, 'GHE', 'GHEs')} · ${plural(nR, 'risco', 'riscos')}`;
    }
    if (a.situacao === 'aguardando' || pendencias.length) {
      if (pendencias.length) {
        out.status = `${plural(pendencias.length, 'pendência', 'pendências')}: ${pendencias.map(p => p.texto || p.nome).filter(Boolean).slice(0, 2).join(', ')}`;
        out.tom = 'laranja';
      }
    } else if (a.situacao === 'em_andamento') {
      const falta = [];
      if (feitos != null && nR - feitos > 0) falta.push(plural(nR - feitos, 'risco', 'riscos'));
      if (!a.assinatura_tec_path) falta.push('as assinaturas');
      const soUmRisco = falta.length === 1 && feitos != null && nR - feitos === 1;
      out.status = falta.length ? `${soUmRisco ? 'Falta' : 'Faltam'} ${falta.join(' e ')}` : 'Pronta para concluir';
      out.tom = 'amb';
    }
  }
  if (a._pendente) { out.status = `${a._pendente} alteração(ões) ainda neste aparelho`; out.tom = 'nuvem'; }
  return out;
}

function botoes(a, compacto) {
  const lst = a.situacao === 'agendada' ? [['Iniciar', 'btn-amber', `ir:campo-avaliacao:${a.id}`]]
    : a.situacao === 'em_andamento' ? [['Continuar', 'btn-amber', `ir:campo-avaliacao:${a.id}`]]
    : a.situacao === 'aguardando' ? [['Abrir', 'btn-outline', `ir:campo-avaliacao:${a.id}`]]
    : a.situacao === 'concluida'
      ? [...(a.pdf_path ? [['PDF', 'btn-outline', `campo:pdf-lista:${a.id}`]] : []), ...(compacto ? [] : [['Abrir', 'btn-outline', `ir:campo-avaliacao:${a.id}`]])]
      : compacto ? [] : [['Abrir', 'btn-outline', `ir:campo-avaliacao:${a.id}`]];
  return lst.map(([t, c, ac]) => `<button type="button" class="btn ${c} btn-sm" data-acao="${ac}">${t}</button>`).join('');
}

const etiquetaRevisao = (a) => (Number(a.revisao) || 1) > 1 ? `<span class="cp-rev">revisão ${Number(a.revisao)}</span>` : '';

function cartaoQuadro(a, cli, tec) {
  const lv = levantamento(a);
  const linhaData = atrasada(a)
    ? `<div class="cp-cd-l atr">${I.relogio}<span>Era para ${esc(quandoVisita(a.data_visita, a.hora_inicio))}</span></div>`
    : `<div class="cp-cd-l">${I.cal}<span>${esc(quandoVisita(a.data_visita, a.hora_inicio))}</span></div>`;
  const prog = lv.barra
    ? `<div class="cp-pb"><i style="width:${lv.pct}%"></i></div><div class="cp-pl"><span>${lv.barra}</span><b>${lv.pct}%</b></div>`
    : a.situacao === 'aguardando' ? `<div class="cp-pb"><i style="width:100%"></i></div>` + (lv.resumo ? `<div class="cp-cd-l">${I.emp}<span>${esc(lv.resumo)}</span></div>` : '')
    : lv.resumo ? `<div class="cp-cd-l">${I.emp}<span>${esc(lv.resumo)}</span></div>` : '';
  return `<div class="cp-cd ${esc(a.situacao)}" data-acao="ir:campo-avaliacao:${a.id}">
    <div class="cp-cd-t"><span>${esc(a.numero || 'Sem número')}</span>${etiquetaRevisao(a)}</div>
    <div class="cp-cd-n">${esc(cli?.nome || 'Empresa')}</div>
    ${linhaData}${prog}
    ${lv.status ? `<div class="cp-cd-s ${lv.tom}">${lv.tom === 'nuvem' ? I.nuvem : ''}<span>${esc(lv.status)}</span></div>` : ''}
    <div class="cp-cd-f"><span class="cp-avt">${esc(iniciais(tec?.nome))}</span><span class="cp-cd-tec">${esc(tec?.nome || 'Técnico')}</span>${botoes(a, true)}</div>
  </div>`;
}

function linhaLista(a, cli, tec) {
  const lv = levantamento(a);
  const lev = lv.barra
    ? `<div class="cp-tbar"><div class="cp-pb"><i style="width:${lv.pct}%"></i></div><small>${lv.pct}%</small></div><div class="cp-tsub">${lv.barra}</div>`
    : `<span>${esc(lv.resumo)}</span>`;
  const st = lv.status ? `<div class="cp-tsub ${lv.tom}">${esc(lv.status)}</div>` : '';
  const quando = atrasada(a) ? `<span class="cp-atr">Era para ${esc(quandoVisita(a.data_visita, a.hora_inicio))}</span>` : esc(quandoVisita(a.data_visita, a.hora_inicio));
  return `<tr class="cp-tr ${esc(a.situacao)}" data-acao="ir:campo-avaliacao:${a.id}">
    <td class="cp-tn">${esc(a.numero || 'Sem número')}${etiquetaRevisao(a)}</td>
    <td><div class="cp-temp">${esc(cli?.nome || 'Empresa')}</div>${cli?.cnpj ? `<div class="cp-tsub">CNPJ ${esc(fmtCnpj(cli.cnpj))}</div>` : ''}</td>
    <td class="cp-tq">${quando}</td>
    <td>${esc(tec?.nome || '')}</td>
    <td>${selo(a.situacao)}</td>
    <td class="cp-tlev">${lev}${st}</td>
    <td><div class="cp-tac">${botoes(a, false)}</div></td>
  </tr>`;
}

/* No celular a Lista vira cartões curtos. */
function cartaoCelularLista(a, cli) {
  const lv = levantamento(a);
  const resumo = lv.barra ? `${lv.pct}% dos riscos` : lv.resumo;
  return `<div class="cp-cd ${esc(a.situacao)}" data-acao="ir:campo-avaliacao:${a.id}">
    <div class="cp-cd-t"><span>${esc(a.numero || 'Sem número')}</span>${etiquetaRevisao(a)}<span class="cp-cd-selo">${selo(a.situacao)}</span></div>
    <div class="cp-cd-n">${esc(cli?.nome || 'Empresa')}</div>
    <div class="cp-cd-l ${atrasada(a) ? 'atr' : ''}"><span>${atrasada(a) ? 'Era para ' : ''}${esc(quandoVisita(a.data_visita, a.hora_inicio))}${resumo ? ' · ' + esc(resumo) : ''}</span></div>
  </div>`;
}

const ordemAbertas = (a, b) => String(a.data_visita || '9999').localeCompare(String(b.data_visita || '9999')) || String(a.hora_inicio || '').localeCompare(String(b.hora_inicio || ''));
const ordemFechadas = (a, b) => String(b.concluida_em || b.data_visita || '').localeCompare(String(a.concluida_em || a.data_visita || ''));

export async function render() {
  ligarTela(null);
  D.pedirArmazenamentoPersistente();
  let res;
  try { res = await D.listarAvaliacoes(); }
  catch (e) { return `<div class="empty-state" style="padding:40px 16px;text-align:center">${esc(D.traduzirErro(e))}<div style="margin-top:12px"><button class="btn btn-outline" data-acao="recarregar">Tentar de novo</button></div></div>`; }
  const { lista: cruas, offline } = res;
  const lista = agruparRevisoes(cruas);
  const [clis, usus] = await Promise.all([
    D.clientesPorId(lista.map(a => a.cliente_id)).catch(() => ({})),
    D.usuariosPorId(lista.map(a => a.tecnico_id)).catch(() => ({}))
  ]);
  const perfil = sessao.perfil();
  const gestor = ['administrador', 'comercial'].includes(perfil) || perfil === 'provedor';

  /* Contadores: avaliações (não revisões), sem os filtros de busca/técnico.
     v220: "Concluídas" conta todas (antes: só as do ano), para o número de
     cima bater com o da coluna que ele abre. */
  const n = (s) => lista.filter(a => a.situacao === s).length;

  const q = _busca.trim().toLowerCase();
  const qNum = q.replace(/\D/g, '');
  const base = lista.filter(a => {
    if (_tec && a.tecnico_id !== _tec) return false;
    if (!q) return true;
    const c = clis[a.cliente_id] || {};
    return String(c.nome || '').toLowerCase().includes(q) || (qNum.length >= 3 && String(c.cnpj || '').replace(/\D/g, '').includes(qNum))
      || String(a.numero || '').toLowerCase().includes(q);
  });
  const doSit = (s) => base.filter(a => a.situacao === s);

  const tecnicos = [...new Set(lista.map(a => a.tecnico_id).filter(Boolean))].map(id => [id, usus[id]?.nome || 'Técnico']).sort((a, b) => a[1].localeCompare(b[1]));

  const vazioTxt = gestor
    ? 'Nenhuma avaliação por aqui. Para marcar uma visita, abra a Agenda da Equipe e crie um compromisso do tipo Visita técnica, com o cliente e o técnico.'
    : 'Nenhuma visita marcada para você. Quando o escritório marcar uma Visita técnica na agenda, ela aparece aqui.';

  const kc = (sit, ic, num, rot) => `<button type="button" class="cp-kc k-${sit}${_sit === sit ? ' on' : ''}" data-acao="campo:sit:${_sit === sit ? '' : sit}" aria-pressed="${_sit === sit}">
      <span class="cp-kc-ic">${I[ic]}</span><span class="cp-kc-tx"><b>${num}</b><span>${rot}</span></span></button>`;

  const seg = `<div class="cp-modo" role="group" aria-label="Forma de ver">
      <button type="button" class="${_modo === 'quadro' ? 'on' : ''}" data-acao="campo:modo:quadro" aria-pressed="${_modo === 'quadro'}">Quadro</button>
      <button type="button" class="${_modo === 'lista' ? 'on' : ''}" data-acao="campo:modo:lista" aria-pressed="${_modo === 'lista'}">Lista</button></div>`;

  const topo = `
    ${offline ? nota('Sem internet. Aparecem só as avaliações já abertas neste aparelho; o que você fizer fica guardado e é enviado quando a conexão voltar.', 'warn') : ''}
    <div class="cp-kcs">${kc('agendada', 'cal', n('agendada'), 'Agendadas')}${kc('em_andamento', 'pen', n('em_andamento'), 'Em andamento')}${kc('aguardando', 'relogio', n('aguardando'), 'Aguardando informações')}${kc('concluida', 'check', n('concluida'), 'Concluídas')}</div>
    <div class="turmas-filtros cp-filtros">
      <div class="turmas-busca"><span style="position:absolute;left:11px;top:50%;transform:translateY(-50%);width:15px;height:15px;color:var(--text-3)">${I.busca}</span>
        <input type="search" id="cpBuscaLista" data-acao="campo:busca" value="${esc(_busca)}" placeholder="Buscar empresa, CNPJ ou número..."></div>
      ${_modo === 'lista' ? `<select class="turmas-filtro-select" data-acao="campo:sit">
        ${[['', 'Todas as situações'], ['abertas', 'Em aberto'], ['agendada', 'Agendadas'], ['em_andamento', 'Em andamento'], ['aguardando', 'Aguardando informações'], ['concluida', 'Concluídas'], ['cancelada', 'Canceladas']]
          .map(([v, l]) => `<option value="${v}" ${v === _sit ? 'selected' : ''}>${l}</option>`).join('')}
      </select>` : ''}
      ${gestor && tecnicos.length > 1 ? `<select class="turmas-filtro-select" data-acao="campo:tec"><option value="">Todos os técnicos</option>${tecnicos.map(([id, nome]) => `<option value="${id}" ${id === _tec ? 'selected' : ''}>${esc(nome)}</option>`).join('')}</select>` : ''}
      ${seg}
      ${gestor ? `<div class="turmas-filtros-cta">${window.__GRID_PONTE?.modoSuporte?.() ? '<button type="button" class="btn btn-outline" data-acao="ir:campo-catalogo">Catálogo da ficha</button>' : ''}<button type="button" class="btn btn-amber" data-acao="ir:agendaequipe">${ico('plus')}Agendar visita</button></div>` : ''}
    </div>`;

  if (!lista.length) return topo + nota(esc(vazioTxt));

  return topo + (_modo === 'lista' ? corpoLista() : corpoQuadro());

  /* ── Quadro ───────────────────────────────────────────────────────────── */
  function corpoQuadro() {
    const cols = COLUNAS.map(([sit, rot, vazio]) => {
      let itens = doSit(sit).sort(sit === 'concluida' ? ordemFechadas : ordemAbertas);
      const total = itens.length;
      let mais = '';
      if (sit === 'concluida' && total > MAX_CONCLUIDAS_QUADRO) {
        itens = itens.slice(0, MAX_CONCLUIDAS_QUADRO);
        mais = `<button type="button" class="btn btn-ghost btn-sm cp-col-mais" data-acao="campo:ver-concluidas">Ver todas as concluídas (${total})</button>`;
      }
      return { sit, rot, total, html: itens.length
        ? itens.map(a => cartaoQuadro(a, clis[a.cliente_id], usus[a.tecnico_id])).join('') + mais
        : `<div class="cp-col-vazio">${esc(q || _tec ? 'Nada com esses filtros.' : vazio)}${sit === 'agendada' && gestor && !q && !_tec ? '<br>Marque pela Agenda da Equipe, tipo Visita técnica.' : ''}</div>` };
    });
    const visiveis = _sit ? cols.filter(c => c.sit === _sit) : cols;
    /* No celular: uma coluna por vez. Abre na primeira que tiver algo. */
    const celular = _sit || (cols.find(c => c.sit === _colCel) ? _colCel : (cols.find(c => c.total)?.sit || 'agendada'));
    const abas = `<div class="cp-abas">${cols.map(c => `<button type="button" class="${c.sit === celular ? 'on' : ''}" data-acao="campo:col:${c.sit}">${esc(c.rot === 'Aguardando informações' ? 'Aguardando' : c.rot)} ${c.total}</button>`).join('')}</div>`;
    const filtroAviso = _sit ? `<div class="cp-filtro-ativo">Mostrando só: <b>${esc(cols.find(c => c.sit === _sit)?.rot || '')}</b><button type="button" class="btn btn-ghost btn-sm" data-acao="campo:sit:">Mostrar todas</button></div>` : '';
    const canceladas = doSit('cancelada').length;
    return `${filtroAviso}${_sit ? '' : abas}
      <div class="cp-kb${_sit ? ' um' : ''}">${visiveis.map(c => `<section class="cp-col k-${c.sit}${c.sit === celular ? ' cel-on' : ''}">
        <div class="cp-col-h"><i></i><span>${esc(c.rot)}</span><em>${c.total}</em></div>${c.html}</section>`).join('')}</div>
      ${canceladas ? `<div class="cp-rodape-nota">${plural(canceladas, 'visita cancelada', 'visitas canceladas')} fora do quadro. <button type="button" class="btn btn-ghost btn-sm" data-acao="campo:ver-canceladas">Ver na lista</button></div>` : ''}`;
  }

  /* ── Lista ────────────────────────────────────────────────────────────── */
  function corpoLista() {
    const filtrada = base.filter(a => !_sit ? true : _sit === 'abertas' ? aberta(a) : a.situacao === _sit);
    const blocos = [
      ['Em aberto', filtrada.filter(aberta).sort(ordemAbertas)],
      ['Concluídas', filtrada.filter(a => a.situacao === 'concluida').sort(ordemFechadas)],
      ['Canceladas', filtrada.filter(a => a.situacao === 'cancelada').sort(ordemFechadas)]
    ].filter(([, l]) => l.length);
    if (!blocos.length) return nota('Nenhuma avaliação com esses filtros.');
    let restante = MAX_LINHAS_LISTA, cortadas = 0;
    const partes = blocos.map(([t, l]) => {
      const vis = l.slice(0, Math.max(0, restante)); restante -= vis.length; cortadas += l.length - vis.length;
      return [t, l.length, vis];
    }).filter(([, , v]) => v.length);
    const tabela = `<div class="cp-tb"><table class="cp-tabela">
      <thead><tr><th>Número</th><th>Empresa</th><th>Visita</th><th>Técnico</th><th>Situação</th><th>Levantamento</th><th aria-label="Ações"></th></tr></thead>
      <tbody>${partes.map(([t, tot, v]) => `<tr class="cp-grp"><td colspan="7">${esc(t)} · ${tot}</td></tr>${v.map(a => linhaLista(a, clis[a.cliente_id], usus[a.tecnico_id])).join('')}`).join('')}</tbody></table></div>`;
    const cel = `<div class="cp-lista-cel">${partes.map(([t, tot, v]) => `<div class="cp-grp-cel">${esc(t)} · ${tot}</div>${v.map(a => cartaoCelularLista(a, clis[a.cliente_id])).join('')}`).join('')}</div>`;
    return tabela + cel + (cortadas ? nota(`Mostrando as ${MAX_LINHAS_LISTA} primeiras. Use a busca ou os filtros para achar as outras ${cortadas}.`) : '');
  }
}

/* Deixa no aparelho o catálogo e as avaliações em aberto do técnico. */
export function depois() {
  if (_preparando || !D.online()) return;
  _preparando = true;
  (async () => {
    try {
      await D.catalogo({ fresco: true });
      const { lista } = await D.listarAvaliacoes();
      const eu = sessao.usuario()?.id;
      const minhas = lista.filter(a => a.tecnico_id === eu && ['agendada', 'em_andamento', 'aguardando'].includes(a.situacao)).slice(0, 30);
      for (const a of minhas) { try { await D.abrir(a.id); } catch { /* segue */ } }
    } catch (e) { console.warn('[campo] preparação para uso sem internet:', e?.message); }
    finally { setTimeout(() => { _preparando = false; }, 60000); }
  })();
}

const SITS = ['', 'abertas', 'agendada', 'em_andamento', 'aguardando', 'concluida', 'cancelada'];

export async function acao(nome, valor, redesenhar) {
  if (nome === 'campo:busca') { _busca = valor || ''; redesenhar(); return true; }
  if (nome === 'campo:sit') {
    _sit = SITS.includes(valor || '') ? (valor || '') : '';
    /* "Em aberto" e "Canceladas" não são colunas do quadro: só na lista. */
    if (_modo === 'quadro' && (_sit === 'abertas' || _sit === 'cancelada')) _sit = '';
    redesenhar(); return true;
  }
  if (nome === 'campo:tec') { _tec = valor || ''; redesenhar(); return true; }
  if (nome === 'campo:modo') {
    _modo = valor === 'lista' ? 'lista' : 'quadro'; guardarModo(_modo);
    if (_modo === 'quadro' && (_sit === 'abertas' || _sit === 'cancelada')) _sit = '';
    redesenhar(); return true;
  }
  if (nome === 'campo:col') { _colCel = valor || ''; redesenhar(); return true; }
  if (nome === 'campo:ver-concluidas') { _modo = 'lista'; _sit = 'concluida'; redesenhar(); return true; }
  if (nome === 'campo:ver-canceladas') { _modo = 'lista'; _sit = 'cancelada'; redesenhar(); return true; }
  if (nome === 'campo:pdf-lista') {   /* v207: atalho para o PDF da concluída */
    try {
      const url = await D.linkPdfPorId(valor);
      if (!url) throw new Error('O PDF desta avaliação ainda não foi gerado.');
      window.open(url, '_blank');
    } catch (e) { avisar(D.traduzirErro(e), 'erro'); }
    return true;
  }
  return false;
}
