/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/crm/funil.js — quadro e tabela de leads

   Tres mudancas de 05/09 (h17), todas vindas da revisao critica:
     • O quadro aceita ARRASTAR o cartao entre etapas (antes so o botao "Mover
       para" dentro da ficha do lead movia um negocio).
     • A organizacao pode ter MAIS DE UM FUNIL, e o seletor do topo troca entre
       eles. Cada funil e um processo comercial proprio.
     • O texto do cartao deixou de ser "empresa — treinamento (N vagas)". Quem
       vende treinamento continua vendo o curso; quem vende outra coisa ve o
       que escreveu. O CRM parou de presumir o que a empresa vende.

   No celular o quadro nao e exibido: cinco colunas pedem 1.200px. A tela abre
   na lista.
   ══════════════════════════════════════════════════════════════════════════ */
import * as ui from '../../nucleo/ui.js';
import { icone } from '../../nucleo/icones.js';
import * as dados from '../../nucleo/dados.js';
import * as sessao from '../../nucleo/sessao.js';
import { ESTAGIOS, rotuloEstagio, etapa, fundoDe, ehAberta, ehGanho } from '../../nucleo/estagios.js';
import { avisoDemo } from './painel.js';

let _busca = '';
let _resp = '';                              // filtro de responsável
let _origem = '';                            // filtro de origem
let _visao = 'quadro';                       // 'quadro' | 'tabela'
let _ordem = { campo:'valor', desc:true };
let _selecao = [];
let _funis = [];

export async function render() {
  // Os funis so existem em modo banco; em demonstracao a lista vem vazia e o
  // seletor simplesmente nao aparece — nenhuma tela precisa saber disso.
  try { _funis = await dados.listarFunis(); } catch { _funis = []; }

  let leads = await dados.listar('crm_leads');
  // A busca cobre o que a pessoa tem na cabeca quando procura um negocio:
  // empresa, o que esta sendo vendido, responsavel e origem.
  /* Os dois selects abaixo existiam desde a primeira versao e nao filtravam
     nada — `ui.filtros` os desenhava sem acao. Escolher "Marina Alves" e a
     lista continuar igual e o tipo de detalhe que faz o sistema parecer
     enfeite. Agora filtram, e a escolha sobrevive ao redesenho. */
  const todosResp   = [...new Set(leads.map(l => l.responsavel).filter(Boolean))].sort();
  const todasOrigens = [...new Set(leads.map(l => l.origem).filter(Boolean))].sort();
  if (_resp)   leads = leads.filter(l => l.responsavel === _resp);
  if (_origem) leads = leads.filter(l => l.origem === _origem);
  if (_busca) {
    const t = _busca.toLowerCase();
    leads = leads.filter(l => [l.empresa, l.item || l.treinamento, l.responsavel, l.origem]
      .some(v => (v || '').toLowerCase().includes(t)));
  }
  const celular = sessao.ehCelular();
  const visao = celular ? 'lista' : _visao;

  const abertos    = leads.filter(l => ehAberta(l.estagio));
  const ganhos     = leads.filter(l => ehGanho(l.estagio));
  // "Em negociacao" era uma lista de slugs escrita na mao ('proposta',
  // 'negociacao') — que quebra assim que a organizacao renomeia ou cria etapa.
  // Agora e a metade final das etapas abertas, seja qual for o nome delas.
  const meio       = ESTAGIOS.filter(ehAbertaE).slice(Math.ceil(ESTAGIOS.filter(ehAbertaE).length / 2)).map(e => e.id);
  const negociacao = leads.filter(l => meio.includes(l.estagio));
  const soma = (a) => a.reduce((s,l) => s + (l.valor||0), 0);
  const admin = sessao.perfil() === 'administrador';

  /* Previsao do mes corrente, calculada sobre os leads ja carregados — sem
     consulta nova. So conta negocio aberto: previsao de negocio ganho e
     historia, nao previsao. */
  const hoje0 = ui.hojeLocal();
  const fimMes = new Date(hoje0.getFullYear(), hoje0.getMonth() + 1, 0);
  const comData = abertos.filter(l => l.previsao);
  const noMes = comData.filter(l => ui.dataLocal(l.previsao) <= fimMes);
  const previsaoMes = { total: noMes.length, valor: soma(noMes),
                        vencidos: comData.filter(l => ui.diasAte(l.previsao) < 0).length };

  const acoes = celular
    ? [{ rotulo:'Novo lead', icone:'plus', tipo:'pri', acao:'crm:novo-lead' }]
    : [
        ...(admin ? [{ rotulo:'Configurar funil', icone:'settings', tipo:'sec', acao:'ir:crm-funis' }] : []),
        { rotulo: visao === 'quadro' ? 'Ver em tabela' : 'Ver em quadro',
          icone: visao === 'quadro' ? 'grid' : 'funnel', tipo:'sec', acao:'crm:visao' },
        { rotulo:'Novo lead', icone:'plus', tipo:'pri', acao:'crm:novo-lead' }
      ];

  return `
  ${ui.topo({
    modulo:'CRM', moduloIcone:'funnel',
    titulo: visao === 'tabela' ? 'Leads' : 'Funil de vendas',
    sub: `${abertos.length} abertos · ${ui.fmt.moeda(soma(negociacao))} em negociação`,
    acoes
  })}

  ${seletorDeFunis()}

  ${ui.kpis([
    { rotulo:'Abertos',       icone:'funnel', valor: abertos.length },
    { rotulo:'Em negociação', icone:'doc',    valor: ui.fmt.moeda(soma(negociacao)), nota:`${negociacao.length} negócios` },
    { rotulo:'Ganhos no mês', icone:'check',  valor: ganhos.length, nota: ui.fmt.moeda(soma(ganhos)), notaTipo:'up' },
    { rotulo:'Conversão',     icone:'trend',  valor: (leads.length ? Math.round(ganhos.length/leads.length*100) : 0) + '%' },
    ...(previsaoMes.total ? [{ rotulo:'Previsto para o mês', icone:'calendar',
        valor: ui.fmt.moeda(previsaoMes.valor), nota:`${previsaoMes.total} negócios com data`,
        notaTipo: previsaoMes.vencidos ? 'at' : '' }] : [])
  ])}

  ${ui.filtros({
    busca:{ id:'crmBuscaLead', valor:_busca, placeholder:'Buscar empresa, contato ou negócio', acao:'crm:filtrar-leads' },
    selects:[
      { id:'crmFiltroResp', acao:'crm:filtro-resp', valor:_resp,
        opcoes:[{ v:'', r:'Todos os responsáveis' }, ...todosResp.map(x => ({ v:x, r:x }))] },
      { id:'crmFiltroOrigem', acao:'crm:filtro-origem', valor:_origem,
        opcoes:[{ v:'', r:'Todas as origens' }, ...todasOrigens.map(x => ({ v:x, r:x }))] }
    ]
  })}

  ${visao === 'quadro' ? quadro(leads) : visao === 'tabela' ? tabela(leads) : listaCelular(leads)}
  ${dados.ehExemplo() ? avisoDemo() : ''}`;
}

const ehAbertaE = (e) => e.tipo === 'aberto';

/* ── Seletor de funis ──────────────────────────────────────────────────────
   So aparece com mais de um funil: com um so, um seletor de uma opcao e ruido
   puro — mesma regra que o menu em blocos ja usa para modulo unico. */
function seletorDeFunis() {
  if (_funis.length < 2) return '';
  const atual = dados.funilCorrenteId();
  return `<div class="crm-funis-trilho">
    ${_funis.map(f => `<span class="crm-funil-chip ${f.id === atual ? 'ativo' : ''}"
      data-acao="crm:funil:${f.id}">${ui.esc(f.nome)}${f.padrao ? ' <i class="pad" title="Funil padrão"></i>' : ''}</span>`).join('')}
  </div>`;
}

/* ── Quadro ────────────────────────────────────────────────────────────────
   Colunas: etapas abertas + a de ganho. "Perdido" fica fora do quadro de
   proposito — e uma coluna que so cresce, e o lugar de olhar para negocio
   perdido e a tabela, com filtro e periodo. */
function quadro(leads) {
  const colunas = ESTAGIOS.filter(e => e.tipo !== 'perdido');
  return `<div class="crm-kanban-wrap"><div class="crm-kanban" style="grid-template-columns:repeat(${colunas.length},minmax(232px,1fr));min-width:${colunas.length*240}px">
    ${colunas.map(e => {
      const doEstagio = leads.filter(l => l.estagio === e.id);
      const total = doEstagio.reduce((s,l) => s + (l.valor||0), 0);
      return `<div class="crm-kb-col" data-etapa="${ui.esc(e.id)}">
        <div class="crm-kb-head" style="background:${fundoDe(e.cor)};border-bottom-color:${e.cor}">
          <i class="crm-kb-ponto" style="background:${e.cor}"></i>
          <span class="nome">${ui.esc(e.rotulo)}</span>
          <span class="tot">${doEstagio.length}${total ? ' · ' + ui.fmt.moeda(total) : ''}</span></div>
        <div class="crm-kb-body" data-solta="${ui.esc(e.id)}">
          ${doEstagio.map(cartaoLead).join('') || `<div class="crm-kb-vazio">Arraste um negócio para cá</div>`}
        </div>
      </div>`; }).join('')}
  </div></div>`;
}

const cartaoLead = (l) => `
  <div class="crm-lead-card" draggable="true" data-lead="${ui.esc(l.id)}"
       data-acao="ir:crm-lead:${l.id}" ${ehGanho(l.estagio) ? 'style="border-left:3px solid var(--green)"' : ''}>
    <div class="crm-lead-emp">${ui.esc(l.empresa)}${(l.item || l.treinamento) ? ' — ' + ui.esc(l.item || l.treinamento) : ''}</div>
    <div class="crm-lead-meta">
      <span>${icone(l.origem?.includes('WhatsApp') ? 'chat' : 'link','sm')} ${ui.esc(l.origem || '—')}</span>
      <span>${icone('user','sm')} ${ui.esc(l.responsavel || 'Sem dono')}</span>
    </div>
    <div class="crm-lead-rod">
      <span class="crm-lead-val">${ui.fmt.moeda(l.valor)}</span>
      ${etiquetaLead(l)}
    </div>
    ${previsaoNoCartao(l)}
  </div>`;

/* A previsao so aparece quando existe — e ganha cor quando o prazo chegou.
   Um negocio com data marcada que ja passou e a informacao mais acionavel do
   quadro: e onde o comercial esta se enganando sobre o proprio mes. */
function previsaoNoCartao(l) {
  if (!l.previsao || ehGanho(l.estagio)) return '';
  const d = ui.dataLocal(l.previsao);
  const dias = ui.diasAte(l.previsao);
  const estado = dias < 0 ? 'vencida' : dias <= 3 ? 'perto' : '';
  const texto = dias < 0 ? `Previsão venceu há ${Math.abs(dias)} dia${Math.abs(dias)>1?'s':''}`
              : dias === 0 ? 'Previsão para hoje'
              : dias === 1 ? 'Previsão para amanhã'
              : `Previsão ${d.toLocaleDateString('pt-BR',{ day:'2-digit', month:'2-digit' })}`;
  return `<div class="crm-lead-prev ${estado}">${icone('calendar','sm')} ${texto}</div>`;
}

function etiquetaLead(l) {
  if (ehGanho(l.estagio))    return ui.selo('Ganho', 'ok');
  if (!l.responsavel)        return ui.selo('Sem dono', 'neutro');
  const dias = l.parado_desde ? Math.floor((Date.now() - new Date(l.parado_desde)) / 86400000) : 0;
  if (dias >= 7) return ui.selo('Parado', 'atencao');
  return '';
}

function tabela(leads) {
  const linhas = [...leads].sort((a,b) => _ordem.desc ? b[_ordem.campo] - a[_ordem.campo] : a[_ordem.campo] - b[_ordem.campo]);
  return ui.tabela({
    selecionavel: true, selecao: _selecao, ordem: _ordem,
    colunas: [
      { campo:'empresa', rotulo:'Empresa e negócio',
        render:(l) => `<div class="prim">${ui.esc(l.empresa)}</div><div class="sub">${ui.esc(l.item || l.treinamento || '—')}${l.vagas ? ' · ' + l.vagas + ' vagas' : ''}</div>` },
      { campo:'estagio', rotulo:'Etapa',
        render:(l) => ui.selo(rotuloEstagio(l.estagio), ehGanho(l.estagio) ? 'ok' : ehAberta(l.estagio) ? 'neutro' : 'neutro') },
      { campo:'responsavel', rotulo:'Responsável', render:(l) => ui.esc(l.responsavel || '—') },
      { campo:'origem', rotulo:'Origem', render:(l) => ui.esc(l.origem || '—') },
      { campo:'valor', rotulo:'Valor', dir:true, render:(l) => `<span class="prim">${ui.fmt.moeda(l.valor)}</span>` },
      { campo:'previsao', rotulo:'Previsão', dir:true, render:(l) => {
          if (!l.previsao) return `<span style="color:var(--text-3)">—</span>`;
          const txt = ui.dataLocal(l.previsao).toLocaleDateString('pt-BR',{ day:'2-digit', month:'2-digit' });
          return ui.diasAte(l.previsao) < 0 && ehAberta(l.estagio)
            ? `<span style="color:var(--atencao-text);font-weight:600">${txt}</span>` : txt;
        } },
      { campo:'parado_desde', rotulo:'Parado há', dir:true, render:(l) => {
          if (!ehAberta(l.estagio)) return '—';
          const d = l.parado_desde ? Math.floor((Date.now() - new Date(l.parado_desde)) / 86400000) : 0;
          return d >= 7 ? `<span style="color:var(--atencao-text);font-weight:600">${d} dias</span>` : (d ? `${d} dias` : 'hoje');
        } }
    ],
    linhas,
    rodape: ui.paginacao({ pagina:1, paginas:1, total: linhas.length, porPagina: linhas.length, rotulo:'leads' })
  });
}

const listaCelular = (leads) => ui.lista([...leads]
  .sort((a,b) => b.valor - a.valor)
  .map(l => ({
    titulo: `${l.empresa}${(l.item || l.treinamento) ? ' — ' + (l.item || l.treinamento) : ''}`,
    sub: `${rotuloEstagio(l.estagio)} · ${l.responsavel || 'sem dono'}`,
    cor: (etapa(l.estagio) || {}).cor || '#1E2A4A',
    acao: `ir:crm-lead:${l.id}`,
    fim: `<span class="crm-lead-val">${ui.fmt.moeda(l.valor)}</span>`
  })));

/* ── Arrastar e soltar ─────────────────────────────────────────────────────
   Sem biblioteca: a API nativa de drag do HTML resolve, e uma dependencia
   externa entraria no caminho critico de uma tela que ja carrega devagar.

   `depois()` e chamado pela plataforma depois de cada render — e o unico lugar
   onde este modulo toca no DOM. Os ouvintes sao presos ao container recem
   desenhado; como a tela inteira e redesenhada a cada acao, nada sobrevive
   para vazar.                                                              */
export function depois() {
  if (typeof document === 'undefined') return;
  const quadros = document.querySelectorAll('.crm-kanban');
  quadros.forEach(q => {
    let arrastando = null;

    q.querySelectorAll('.crm-lead-card[draggable="true"]').forEach(card => {
      card.addEventListener('dragstart', (ev) => {
        arrastando = card;
        card.classList.add('arrastando');
        ev.dataTransfer.effectAllowed = 'move';
        // Firefox so inicia o arrasto se algo for escrito no dataTransfer.
        ev.dataTransfer.setData('text/plain', card.dataset.lead || '');
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('arrastando');
        q.querySelectorAll('.crm-kb-body.sobre').forEach(b => b.classList.remove('sobre'));
        arrastando = null;
      });
    });

    q.querySelectorAll('.crm-kb-body[data-solta]').forEach(zona => {
      zona.addEventListener('dragover', (ev) => {
        if (!arrastando) return;
        ev.preventDefault();                       // sem isto o "drop" nao dispara
        ev.dataTransfer.dropEffect = 'move';
        zona.classList.add('sobre');
      });
      zona.addEventListener('dragleave', (ev) => {
        if (!zona.contains(ev.relatedTarget)) zona.classList.remove('sobre');
      });
      zona.addEventListener('drop', async (ev) => {
        ev.preventDefault();
        zona.classList.remove('sobre');
        const id = (arrastando?.dataset.lead) || ev.dataTransfer.getData('text/plain');
        const destino = zona.dataset.solta;
        if (!id || !destino) return;
        const origem = arrastando?.closest('.crm-kb-body')?.dataset.solta;
        if (origem === destino) return;            // soltou onde ja estava
        // O cartao vai para a coluna nova antes da resposta do banco: a
        // gravacao e rapida, e ver o cartao voltar sozinho e pior do que
        // esperar. Se falhar, o redesenho devolve a verdade do banco.
        zona.appendChild(arrastando);
        const GRID = (typeof window !== 'undefined') && window.GRID;
        if (GRID) await GRID.tratarAcao(`crm:mover-lead:${id}:${destino}`);
      });
    });
  });
}

export function acao(nome, valor, redesenhar) {
  if (nome === 'crm:filtrar-leads') { _busca = valor || ''; redesenhar(); return true; }
  if (nome === 'crm:filtro-resp')   { _resp = valor || '';   redesenhar(); return true; }
  if (nome === 'crm:filtro-origem') { _origem = valor || ''; redesenhar(); return true; }
  if (nome === 'crm:visao') { _visao = _visao === 'quadro' ? 'tabela' : 'quadro'; redesenhar(); return true; }
  if (nome === 'crm:funil') {
    // Trocar de funil recarrega as etapas: toda tela compara estagio contra
    // ESTAGIOS, que passa a ser o do funil escolhido.
    dados.usarFunil(valor).then(() => redesenhar()).catch(() => redesenhar());
    return true;
  }
  if (nome === 'ordenar')   { _ordem = { campo: valor, desc: !(_ordem.campo === valor && _ordem.desc) }; redesenhar(); return true; }
  if (nome === 'sel')       { _selecao = _selecao.includes(valor) ? _selecao.filter(x => x !== valor) : [..._selecao, valor]; redesenhar(); return true; }
  return false;
}
