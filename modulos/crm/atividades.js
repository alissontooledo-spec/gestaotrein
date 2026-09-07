/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/crm/atividades.js
   Toda atividade nasce ligada a um lead, contato ou conversa — é o que
   impede a agenda comercial de virar uma segunda lista de tarefas.

   05/09 (h17): duas visões, no mesmo padrão de Turmas e do Funil.
     • Quadro  — visão de operação: Atrasadas · Hoje · Próximos dias · Feitas.
       Arrastar entre as colunas reagenda (ou conclui, na última).
     • Lista   — visão de procura: busca por texto, filtro por responsável e
       por tipo. Antes esta tela não tinha filtro nenhum, e achar uma
       atividade específica dependia de rolar a página inteira.
   ══════════════════════════════════════════════════════════════════════════ */
import * as ui from '../../nucleo/ui.js';
import { icone } from '../../nucleo/icones.js';
import * as dados from '../../nucleo/dados.js';
import * as sessao from '../../nucleo/sessao.js';
import { avisoDemo } from './painel.js';

let _visao = 'quadro';        // 'quadro' | 'lista'
let _busca = '';
let _resp  = '';
let _tipo  = '';

const TIPOS = { ligacao:'Ligação', proposta:'Proposta', whatsapp:'WhatsApp',
                visita:'Visita', reuniao:'Reunião', email:'E-mail', tarefa:'Tarefa' };

const ICONE_TIPO = { ligacao:'phone', proposta:'doc', whatsapp:'chat',
                     visita:'building', reuniao:'users', email:'send', tarefa:'activity' };

export async function render() {
  const todas = await dados.listar('crm_atividades');
  const celular = sessao.ehCelular();
  const visao = celular ? 'lista' : _visao;

  const responsaveis = [...new Set(todas.map(a => a.responsavel).filter(Boolean))];
  const filtradas = todas.filter(a => {
    if (_resp && a.responsavel !== _resp) return false;
    if (_tipo && a.tipo !== _tipo) return false;
    if (_busca) {
      const t = _busca.toLowerCase();
      if (![a.titulo, a.sub, a.responsavel].some(v => (v || '').toLowerCase().includes(t))) return false;
    }
    return true;
  });

  const g = agrupar(filtradas);

  return `
  ${ui.topo({
    modulo:'CRM', moduloIcone:'activity', titulo:'Atividades',
    sub:`${g.hoje.length} para hoje · ${g.atrasadas.length} atrasadas`,
    acoes: celular ? [{ rotulo:'Nova atividade', icone:'plus', tipo:'pri', acao:'crm:nova-atividade' }] : [
      { rotulo: visao === 'quadro' ? 'Ver em lista' : 'Ver em quadro',
        icone: visao === 'quadro' ? 'grid' : 'activity', tipo:'sec', acao:'crm:visao-ativ' },
      { rotulo:'Nova atividade', icone:'plus', tipo:'pri', acao:'crm:nova-atividade' }
    ]
  })}

  ${ui.kpis([
    { rotulo:'Hoje',      icone:'calendar', valor: g.hoje.length },
    { rotulo:'Atrasadas', icone:'alert',    valor: g.atrasadas.length,
      nota: g.atrasadas.length ? 'Precisa de decisão' : '', notaTipo:'at', destaque: g.atrasadas.length > 0 },
    { rotulo:'Próximos dias',   icone:'clock', valor: g.proximas.length },
    { rotulo:'Concluídas no mês', icone:'check', valor: g.feitas.length }
  ])}

  ${ui.filtros({
    busca:{ id:'crmBuscaAtiv', valor:_busca, placeholder:'Buscar assunto, descrição ou responsável', acao:'crm:filtrar-ativ' },
    selects:[
      { id:'crmAtivResp', acao:'crm:ativ-resp', valor:_resp,
        opcoes:[{ v:'', r:'Todos os responsáveis' }, ...responsaveis.map(r => ({ v:r, r }))] },
      { id:'crmAtivTipo', acao:'crm:ativ-tipo', valor:_tipo,
        opcoes:[{ v:'', r:'Todos os tipos' }, ...Object.entries(TIPOS).map(([v,r]) => ({ v, r }))] }
    ]
  })}

  ${visao === 'quadro' ? quadro(g, sessao.usuario()?.nome || null) : listaCompleta(g)}
  ${dados.ehExemplo() ? avisoDemo() : ''}`;
}

/* ── Agrupamento ───────────────────────────────────────────────────────────
   Uma atividade cai em uma coluna só, e a ordem de teste importa: concluída
   vence tudo (uma tarefa feita ontem não é "atrasada"). */
function agrupar(todas) {
  const hoje0 = inicioDeHoje();
  const amanha = new Date(hoje0); amanha.setDate(amanha.getDate() + 1);
  const g = { atrasadas:[], hoje:[], proximas:[], feitas:[] };
  for (const a of todas) {
    if (a.concluida) { g.feitas.push(a); continue; }
    const q = a.quando ? new Date(a.quando) : null;
    if (!q)                 { g.proximas.push(a); continue; }   // sem data marcada
    if (q < hoje0)          { g.atrasadas.push(a); continue; }
    if (q < amanha)         { g.hoje.push(a); continue; }
    g.proximas.push(a);
  }
  const porData = (x, y) => new Date(x.quando || 0) - new Date(y.quando || 0);
  g.atrasadas.sort(porData); g.hoje.sort(porData); g.proximas.sort(porData);
  g.feitas.sort((x, y) => porData(y, x));
  return g;
}

/* ── Quadro ───────────────────────────────────────────────────────────────
   As colunas são estados de tempo, não etapas de processo: arrastar não muda
   um campo de status inexistente, muda a data de vencimento (ou conclui). */
const COLUNAS = [
  { id:'atrasadas', rotulo:'Atrasadas',     cor:'#B45309', vazio:'Nada atrasado' },
  { id:'hoje',      rotulo:'Hoje',          cor:'#1E2A4A', vazio:'Nada marcado para hoje' },
  { id:'proximas',  rotulo:'Próximos dias', cor:'#1D4ED8', vazio:'Nada agendado' },
  { id:'feitas',    rotulo:'Concluídas',    cor:'#059669', vazio:'Nenhuma concluída' }
];

function quadro(g, eu) {
  return `<div class="crm-kanban-wrap"><div class="crm-kanban" style="grid-template-columns:repeat(4,minmax(232px,1fr));min-width:960px">
    ${COLUNAS.map(c => {
      const itens = g[c.id];
      return `<div class="crm-kb-col">
        <div class="crm-kb-head" style="background:${fundo(c.cor)};border-bottom-color:${c.cor}">
          <i class="crm-kb-ponto" style="background:${c.cor}"></i>
          <span class="nome">${c.rotulo}</span><span class="tot">${itens.length}</span></div>
        <div class="crm-kb-body" data-solta-ativ="${c.id}">
          ${itens.map(a => cartao(a, eu)).join('') || `<div class="crm-kb-vazio">${c.vazio}</div>`}
        </div></div>`;
    }).join('')}
  </div></div>`;
}

const fundo = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},.08)`;
};

/* O cartao responde a duas perguntas que a versao anterior nao respondia:
   de que negocio se trata, e quem pediu. Uma atividade que o administrador
   abriu para o vendedor chegava sem remetente. */
const cartao = (a, eu) => `
  <div class="crm-ativ-card ${a.concluida ? 'feita' : ''}" draggable="true"
       data-ativ="${ui.esc(a.id)}" data-acao="crm:atividade:${ui.esc(a.id)}">
    <div class="crm-ativ-card-top">
      <span class="crm-ativ-ico">${icone(a.concluida ? 'check' : (ICONE_TIPO[a.tipo] || 'activity'), 'sm')}</span>
      <span class="crm-ativ-card-t">${ui.esc(a.titulo)}</span>
    </div>
    ${a.alvo_nome ? `<div class="crm-ativ-card-alvo">${icone({ Negócio:'funnel', Contato:'user', Empresa:'building' }[a.alvo_rotulo] || 'link','sm')} ${ui.esc(a.alvo_nome)}</div>` : ''}
    ${a.sub ? `<div class="crm-ativ-card-s">${ui.esc(a.sub)}</div>` : ''}
    <div class="crm-ativ-card-rod">
      <span class="crm-ativ-quem ${!a.responsavel ? 'sem' : (eu && a.responsavel === eu ? 'meu' : '')}">
        ${icone('user','sm')} ${ui.esc(a.responsavel || 'sem responsável')}</span>
      <span class="q">${a.quando ? ui.fmt.data(a.quando) + ' ' + ui.fmt.hora(a.quando) : 'sem data'}</span>
    </div>
    ${a.autor && a.autor !== a.responsavel
      ? `<div class="crm-ativ-card-autor">pedida por ${ui.esc(a.autor)}</div>` : ''}
  </div>`;

/* ── Lista ─────────────────────────────────────────────────────────────── */
function listaCompleta(g) {
  const bloco = (rotulo, itens, cor, atrasada) => itens.length ? `
    ${ui.secao(rotulo, { cor, contagem:`${itens.length}` })}
    ${ui.cartao(itens.map(a => linha(a, atrasada)).join(''), { plano:true, estilo:'margin-bottom:var(--sp-4)' })}` : '';

  const nada = !g.atrasadas.length && !g.hoje.length && !g.proximas.length && !g.feitas.length;
  if (nada) return ui.cartao(ui.vazio({ icone:'check', titulo:'Nenhuma atividade encontrada',
    sub:'Ajuste a busca ou os filtros acima, ou crie uma atividade a partir de um lead ou de uma conversa.' }), { plano:true });

  return `
    ${bloco('Atrasadas', g.atrasadas, 'var(--atencao-text)', true)}
    ${bloco(`Hoje · ${new Date().toLocaleDateString('pt-BR',{ weekday:'long', day:'numeric', month:'long' })}`, g.hoje, null, false)}
    ${bloco('Próximos dias', g.proximas, null, false)}
    ${bloco('Concluídas', g.feitas, null, false)}`;
}

function linha(a, atrasada) {
  const ic = ICONE_TIPO[a.tipo] || 'activity';
  const dias = Math.floor((inicioDeHoje() - new Date(a.quando)) / 86400000);
  return `<div class="crm-ativ clicavel" data-acao="crm:atividade:${ui.esc(a.id)}">
    <span class="crm-ativ-ico" style="${a.concluida ? 'background:var(--green-l);color:var(--green-text)' : atrasada ? 'background:var(--atencao-l);color:var(--atencao-text)' : ''}">
      ${icone(a.concluida ? 'check' : ic, 'sm')}</span>
    <div style="flex:1">
      <div class="crm-ativ-t" ${a.concluida ? 'style="color:var(--text-3)"' : ''}>${ui.esc(a.titulo)}</div>
      <div class="crm-ativ-s">${ui.esc(TIPOS[a.tipo] || '')}${a.alvo_nome ? ' · ' + ui.esc(a.alvo_nome) : ''}${a.responsavel ? ' · ' + ui.esc(a.responsavel) : ' · sem responsável'}${a.autor && a.autor !== a.responsavel ? ' · pedida por ' + ui.esc(a.autor) : ''}</div>
    </div>
    ${atrasada ? ui.selo(dias <= 1 ? '1 dia' : `${dias} dias`, 'atencao')
               : `<span class="crm-ativ-hora" ${a.concluida ? 'style="color:var(--text-3)"' : ''}>${ui.fmt.hora(a.quando)}</span>`}
    <button class="ds-icobtn crm-para-clique" data-acao="crm:concluir:${a.id}" title="${a.concluida ? 'Reabrir' : 'Concluir'}">${icone(a.concluida ? 'clock' : 'check','sm')}</button>
  </div>`;
}

const inicioDeHoje = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };

/* ── Arrastar entre colunas ────────────────────────────────────────────────
   Mesma mecanica do quadro do funil, com um destino diferente: aqui a coluna
   e uma data. Soltar em "Concluídas" conclui; soltar em "Hoje" reagenda para
   hoje; "Próximos dias" joga para amanha. "Atrasadas" nao recebe — ninguem
   agenda algo para o passado de proposito. */
export function depois() {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('.crm-kanban').forEach(q => {
    let arrastando = null;
    q.querySelectorAll('.crm-ativ-card[draggable="true"]').forEach(card => {
      card.addEventListener('dragstart', (ev) => {
        arrastando = card; card.classList.add('arrastando');
        ev.dataTransfer.effectAllowed = 'move';
        ev.dataTransfer.setData('text/plain', card.dataset.ativ || '');
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('arrastando');
        q.querySelectorAll('.crm-kb-body.sobre').forEach(b => b.classList.remove('sobre'));
        arrastando = null;
      });
    });
    q.querySelectorAll('.crm-kb-body[data-solta-ativ]').forEach(zona => {
      const destino = zona.dataset.soltaAtiv;
      if (destino === 'atrasadas') return;
      zona.addEventListener('dragover', (ev) => {
        if (!arrastando) return;
        ev.preventDefault(); ev.dataTransfer.dropEffect = 'move'; zona.classList.add('sobre');
      });
      zona.addEventListener('dragleave', (ev) => {
        if (!zona.contains(ev.relatedTarget)) zona.classList.remove('sobre');
      });
      zona.addEventListener('drop', async (ev) => {
        ev.preventDefault(); zona.classList.remove('sobre');
        const id = (arrastando?.dataset.ativ) || ev.dataTransfer.getData('text/plain');
        if (!id) return;
        zona.appendChild(arrastando);
        const GRID = (typeof window !== 'undefined') && window.GRID;
        if (GRID) await GRID.tratarAcao(`crm:reagendar:${id}:${destino}`);
      });
    });
  });
}

export function acao(nome, valor, redesenhar) {
  if (nome === 'crm:visao-ativ')   { _visao = _visao === 'quadro' ? 'lista' : 'quadro'; redesenhar(); return true; }
  if (nome === 'crm:filtrar-ativ') { _busca = valor || ''; redesenhar(); return true; }
  if (nome === 'crm:ativ-resp')    { _resp = valor || '';  redesenhar(); return true; }
  if (nome === 'crm:ativ-tipo')    { _tipo = valor || '';  redesenhar(); return true; }
  return false;
}
