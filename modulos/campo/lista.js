/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/campo/lista.js — painel "Avaliações de campo"
   Uma linha por EMPRESA e visita (decisão de 26/09: o painel não é por GHE).
   A visita nasce na Agenda da Equipe (compromisso "Visita técnica"); aqui não
   existe tela de agendar, só o atalho para a agenda.
   Com internet, o painel também deixa no aparelho as avaliações em aberto do
   técnico, para ele poder abri-las depois sem sinal.
   ══════════════════════════════════════════════════════════════════════════ */

import * as sessao from '../../nucleo/sessao.js';
import * as D from './dados.js';
import { I, esc, ico, secTit, nota, dataCurta, fmtCnpj, selo, ligarTela } from './comum.js';

let _busca = '', _sit = 'abertas', _tec = '';
let _preparando = false;

const kpi = (ic, n, l, cor) => `<div class="turmas-kpi"><div style="color:var(--text-3);width:14px;height:14px">${I[ic]}</div><div style="font-size:18px;font-weight:800;color:${cor || 'var(--navy)'};margin-top:4px">${n}</div><div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.03em;color:var(--text-3)">${l}</div></div>`;
const PROG = { agendada: 0, em_andamento: 45, aguardando: 75, concluida: 100, cancelada: 0 };

function cartao(a, cli, tec) {
  const r = a.resumo || {};
  const pend = (r.pendencias || []).length;
  const aberta = !['concluida', 'cancelada'].includes(a.situacao);
  const botao = a.situacao === 'agendada' ? ['Iniciar', 'btn-amber'] : aberta ? ['Continuar', 'btn-amber'] : ['Abrir', 'btn-outline'];
  const ghes = r.ghes ? `${r.ghes} GHE${r.ghes > 1 ? 's' : ''} · ${r.riscos || 0} risco${r.riscos === 1 ? '' : 's'}` : 'GHEs a definir na visita';
  let linhaPend = '';
  if (a._pendente) linhaPend = `<div class="cp-card-meta" style="color:var(--warn-text);font-weight:600">${I.nuvem}<span>${a._pendente} alteração(ões) ainda neste aparelho</span></div>`;
  else if (pend) linhaPend = `<div class="cp-card-meta" style="color:var(--warn-text);font-weight:600">${I.relogio}<span>${pend} pendência${pend > 1 ? 's' : ''}: ${esc((r.pendencias || []).map(p => p.texto || p.nome).filter(Boolean).slice(0, 2).join(', '))}</span></div>`;
  else if (a.situacao === 'concluida') linhaPend = `<div class="cp-card-meta">${I.doc}<span>${esc(a.numero || '')} · revisão ${a.revisao}${a.pdf_path ? ' · PDF pronto' : ' · PDF a gerar'}</span></div>`;
  return `<div class="cp-card" data-acao="ir:campo-avaliacao:${a.id}">
    <span class="cp-card-st">${selo(a.situacao)}</span>
    <div class="cp-card-ghe">${cli?.cnpj ? 'CNPJ ' + esc(fmtCnpj(cli.cnpj)) : '&nbsp;'}</div>
    <div class="cp-card-tit">${esc(cli?.nome || 'Empresa')}</div>
    <div class="cp-card-meta">${I.cal}<span>${esc(dataCurta(a.data_visita, a.hora_inicio))}</span></div>
    <div class="cp-card-meta">${I.user}<span>${esc(tec?.nome || '')}</span></div>
    <div class="cp-card-meta">${I.pasta}<span>${esc(ghes)}</span></div>
    ${linhaPend}
    <div class="cp-card-prog"><div class="bar"><i class="${a.situacao === 'concluida' ? 'ok' : ''}" style="width:${PROG[a.situacao] ?? 0}%"></i></div></div>
    <div class="cp-card-acoes"><button type="button" class="btn ${botao[1]} btn-sm" data-acao="ir:campo-avaliacao:${a.id}">${botao[0]}</button></div>
  </div>`;
}

export async function render() {
  ligarTela(null);
  D.pedirArmazenamentoPersistente();
  let res;
  try { res = await D.listarAvaliacoes(); }
  catch (e) { return `<div class="empty-state" style="padding:40px 16px;text-align:center">${esc(D.traduzirErro(e))}<div style="margin-top:12px"><button class="btn btn-outline" data-acao="recarregar">Tentar de novo</button></div></div>`; }
  const { lista, offline } = res;
  const [clis, usus] = await Promise.all([
    D.clientesPorId(lista.map(a => a.cliente_id)).catch(() => ({})),
    D.usuariosPorId(lista.map(a => a.tecnico_id)).catch(() => ({}))
  ]);
  const perfil = sessao.perfil();
  const gestor = ['administrador', 'comercial'].includes(perfil) || perfil === 'provedor';
  const ano = String(new Date().getFullYear());

  const n = (s) => lista.filter(a => a.situacao === s).length;
  const concluidasAno = lista.filter(a => a.situacao === 'concluida' && String(a.concluida_em || '').startsWith(ano)).length;

  const q = _busca.trim().toLowerCase();
  const qNum = q.replace(/\D/g, '');
  const filtrada = lista.filter(a => {
    if (_sit === 'abertas' && ['concluida', 'cancelada'].includes(a.situacao)) return false;
    if (_sit !== 'abertas' && _sit !== 'todas' && a.situacao !== _sit) return false;
    if (_tec && a.tecnico_id !== _tec) return false;
    if (!q) return true;
    const c = clis[a.cliente_id] || {};
    return String(c.nome || '').toLowerCase().includes(q) || (qNum.length >= 3 && String(c.cnpj || '').replace(/\D/g, '').includes(qNum))
      || String(a.numero || '').toLowerCase().includes(q);
  });
  const abertas = filtrada.filter(a => !['concluida', 'cancelada'].includes(a.situacao))
    .sort((a, b) => String(a.data_visita).localeCompare(String(b.data_visita)) || String(a.hora_inicio || '').localeCompare(String(b.hora_inicio || '')));
  const fechadas = filtrada.filter(a => ['concluida', 'cancelada'].includes(a.situacao))
    .sort((a, b) => String(b.concluida_em || b.data_visita).localeCompare(String(a.concluida_em || a.data_visita)));

  const tecnicos = [...new Set(lista.map(a => a.tecnico_id))].map(id => [id, usus[id]?.nome || 'Técnico']).sort((a, b) => a[1].localeCompare(b[1]));

  const vazioTxt = gestor
    ? 'Nenhuma avaliação por aqui. Para marcar uma visita, abra a Agenda da Equipe e crie um compromisso do tipo Visita técnica, com o cliente e o técnico.'
    : 'Nenhuma visita marcada para você. Quando o escritório marcar uma Visita técnica na agenda, ela aparece aqui.';

  return `
    ${offline ? nota('Sem internet. Aparecem só as avaliações já abertas neste aparelho; o que você fizer fica guardado e é enviado quando a conexão voltar.', 'warn') : ''}
    <div class="turmas-kpis">${kpi('cal', n('agendada'), 'Agendadas')}${kpi('pen', n('em_andamento'), 'Em andamento', 'var(--warn)')}${kpi('relogio', n('aguardando'), 'Aguardando informações', 'var(--warn)')}${kpi('check', concluidasAno, 'Concluídas no ano', 'var(--green)')}</div>
    <div class="turmas-filtros">
      <div class="turmas-busca"><span style="position:absolute;left:11px;top:50%;transform:translateY(-50%);width:15px;height:15px;color:var(--text-3)">${I.busca}</span>
        <input type="search" id="cpBuscaLista" data-acao="campo:busca" value="${esc(_busca)}" placeholder="Buscar empresa, CNPJ ou número..."></div>
      <select class="turmas-filtro-select" data-acao="campo:sit">
        ${[['abertas', 'Em aberto'], ['todas', 'Todas as situações'], ['agendada', 'Agendadas'], ['em_andamento', 'Em andamento'], ['aguardando', 'Aguardando informações'], ['concluida', 'Concluídas'], ['cancelada', 'Canceladas']]
          .map(([v, l]) => `<option value="${v}" ${v === _sit ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
      ${gestor && tecnicos.length > 1 ? `<select class="turmas-filtro-select" data-acao="campo:tec"><option value="">Todos os técnicos</option>${tecnicos.map(([id, nome]) => `<option value="${id}" ${id === _tec ? 'selected' : ''}>${esc(nome)}</option>`).join('')}</select>` : ''}
      ${gestor ? `<div class="turmas-filtros-cta">${window.__GRID_PONTE?.modoSuporte?.() ? '<button type="button" class="btn btn-outline" data-acao="ir:campo-catalogo">Catálogo da ficha</button>' : ''}<button type="button" class="btn btn-amber" data-acao="ir:agendaequipe">${ico('plus')}Agendar visita</button></div>` : ''}
    </div>
    ${!lista.length ? nota(esc(vazioTxt)) : ''}
    ${abertas.length ? secTit('Em aberto') + `<div class="cp-lista">${abertas.map(a => cartao(a, clis[a.cliente_id], usus[a.tecnico_id])).join('')}</div>` : ''}
    ${fechadas.length ? secTit(_sit === 'cancelada' ? 'Canceladas' : 'Concluídas', 'var(--green)') + `<div class="cp-lista">${fechadas.slice(0, 60).map(a => cartao(a, clis[a.cliente_id], usus[a.tecnico_id])).join('')}</div>` : ''}
    ${lista.length && !abertas.length && !fechadas.length ? nota('Nenhuma avaliação com esses filtros.') : ''}
    ${lista.length && _sit === 'abertas' && !fechadas.length ? `<div style="text-align:center;margin:14px 0"><button type="button" class="btn btn-ghost btn-sm" data-acao="campo:sit:concluida">Ver concluídas</button></div>` : ''}
  `;
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

export async function acao(nome, valor, redesenhar) {
  if (nome === 'campo:busca') { _busca = valor || ''; redesenhar(); return true; }
  if (nome === 'campo:sit') { _sit = valor || 'abertas'; redesenhar(); return true; }
  if (nome === 'campo:tec') { _tec = valor || ''; redesenhar(); return true; }
  return false;
}
