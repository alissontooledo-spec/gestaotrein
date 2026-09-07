/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/crm/empresa.js — ficha da empresa (05/09, h24)

   A tela que responde "o que já aconteceu com este cliente?", que era a maior
   lacuna do modelo: o histórico comercial existia espalhado entre negócios,
   contatos e atividades, e nada o juntava sob a empresa — que é a âncora de um
   CRM B2B, porque a pessoa troca de emprego e a conta permanece.

   Sem tabela nova: junta pelo vínculo formal (`cliente_id`) e pelo nome, para
   que o histórico anterior à conversão não fique invisível.
   ══════════════════════════════════════════════════════════════════════════ */
import * as ui from '../../nucleo/ui.js';
import { icone } from '../../nucleo/icones.js';
import * as dados from '../../nucleo/dados.js';
import { rotuloEstagio, etapa, ehGanho, ehAberta } from '../../nucleo/estagios.js';

export async function render(params = {}) {
  if (dados.ehExemplo()) {
    return `${ui.topo({ voltar:{ rotulo:'Funil de vendas', acao:'ir:crm-funil' }, titulo:'Empresas' })}
      ${ui.vazio({ icone:'company', titulo:'Disponível com o banco ligado',
        sub:'A ficha da empresa reúne negócios, contatos e atividades da conta — precisa dos dados reais.' })}`;
  }

  if (!params.id) return listaDeEmpresas();

  const f = await dados.fichaEmpresa(params.id);
  if (!f) return ui.vazio({ titulo:'Empresa não encontrada', sub:'Ela pode ter sido removida.' });

  const { cliente, negocios, contatos, atividades, resumo } = f;
  const abertos = negocios.filter(n => ehAberta(n.estagio));

  return `
  ${ui.topo({
    voltar:{ rotulo:'Empresas', acao:'ir:crm-empresa' },
    titulo: cliente.nome,
    sub: [cliente.naoCadastrada ? 'Ainda não cadastrada em Clientes' : (cliente.cnpj ? 'CNPJ ' + ui.esc(ui.fmt.cnpj(cliente.cnpj)) : 'sem CNPJ'),
          cliente.cidade || null,
          resumo.primeiroContato ? 'primeiro negócio em ' + ui.fmt.data(resumo.primeiroContato) : null]
         .filter(Boolean).join(' · '),
    acoes:[{ rotulo:'Novo negócio', icone:'plus', tipo:'pri', acao:'crm:novo-lead' }]
  })}

  ${ui.kpis([
    { rotulo:'Em aberto',  icone:'funnel', valor: ui.fmt.moeda(resumo.valorAberto), nota:`${resumo.abertos} negócio${resumo.abertos===1?'':'s'}` },
    { rotulo:'Já comprou', icone:'check',  valor: ui.fmt.moeda(resumo.valorGanho),  nota:`${resumo.ganhos} fechado${resumo.ganhos===1?'':'s'}`, notaTipo:'up' },
    { rotulo:'Perdidos',   icone:'close',  valor: String(resumo.perdidos), nota: resumo.valorPerdido ? ui.fmt.moeda(resumo.valorPerdido) : '' },
    { rotulo:'Conversão',  icone:'trend',  valor: resumo.conversao == null ? '—' : resumo.conversao + '%',
      nota: resumo.conversao == null ? 'sem negócio fechado ainda' : 'dos negócios decididos' }
  ])}

  <div class="home-2col" style="grid-template-columns:minmax(0,1.6fr) minmax(0,1fr)">
    <div style="display:flex;flex-direction:column;gap:12px">
      ${ui.cartao(ui.cartaoTitulo(`Negócios (${negocios.length})`, 'funnel') +
        (negocios.length ? listaNegocios(negocios) :
          ui.vazio({ icone:'funnel', titulo:'Nenhum negócio registrado' })), { plano:true })}

      ${ui.cartao(ui.cartaoTitulo(`Atividades (${atividades.length})`, 'activity') +
        (atividades.length ? atividades.slice(0, 12).map(itemAtividade).join('') :
          ui.vazio({ icone:'activity', titulo:'Nenhuma atividade registrada' })), { plano:true })}
    </div>

    <div style="display:flex;flex-direction:column;gap:12px">
      ${ui.cartao(`<div class="ds-card-titulo" style="margin-bottom:12px">Dados da empresa</div>
        ${dado('Razão social', cliente.nome)}
        ${dado('CNPJ', ui.fmt.cnpj(cliente.cnpj))}
        ${dado('Cidade', cliente.cidade)}
        ${dado('Telefone', cliente.telefone ? ui.fmt.telefone(cliente.telefone) : null)}
        ${dado('E-mail', cliente.email)}`)}

      ${ui.cartao(ui.cartaoTitulo(`Pessoas (${contatos.length})`, 'users',
          { rotulo:'Novo', icone:'plus', acao:'crm:novo-contato' }) +
        (contatos.length ? contatos.map(c => `
          <div class="crm-ativ clicavel" data-acao="crm:contato:${ui.esc(c.id)}">
            <span class="crm-ativ-ico">${ui.fmt.iniciais(c.nome)}</span>
            <div style="flex:1">
              <div class="crm-ativ-t">${ui.esc(c.nome)}</div>
              <div class="crm-ativ-s">${ui.esc(c.cargo || 'Sem cargo')}${c.telefone ? ' · ' + ui.fmt.telefone(c.telefone) : ''}</div>
            </div></div>`).join('')
          : ui.vazio({ icone:'user', titulo:'Nenhuma pessoa cadastrada' })), { plano:true })}

      ${cliente.naoCadastrada ? ui.aviso({ tipo:'info', icone:'company',
          titulo:'Empresa ainda não cadastrada em Clientes',
          texto:'O histórico comercial aparece aqui pelo nome. O cadastro é feito em Clientes, no Treinamentos — o CRM não cria empresa sozinho.' }) : ''}

      ${abertos.length ? ui.aviso({ tipo:'info', icone:'info',
          titulo:`${abertos.length} negócio${abertos.length>1?'s':''} em aberto`,
          texto:'Vale olhar o histórico antes de falar com o cliente.' }) : ''}
    </div>
  </div>`;
}

/* ── Lista de empresas ─────────────────────────────────────────────────────
   Uma lista de conta em CRM precisa aguentar centenas de linhas. A primeira
   versao rolava a pagina inteira e nao tinha busca — util com 7 empresas,
   inutil com 700. Agora: busca por nome e CNPJ, filtro por situacao, ordenacao
   por qualquer coluna e paginacao de 25.

   A busca ignora acento e pontuacao dos dois lados: procurar "sao joao" acha
   "São João", e digitar "44444444" acha "44.444.444/0001-44" — ninguem digita
   CNPJ com pontuacao para procurar. */
const chaveBusca = (t) => String(t || '').toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

async function listaDeEmpresas() {
  const todas = await dados.empresasDoCrm();

  let lista = todas;
  if (_situacao === 'abertos')  lista = lista.filter(e => e.abertos > 0);
  if (_situacao === 'clientes') lista = lista.filter(e => e.ganhos > 0);
  if (_situacao === 'sem-cnpj') lista = lista.filter(e => !e.cnpj && !e.naoCadastrada);
  if (_situacao === 'nao-cadastradas') lista = lista.filter(e => e.naoCadastrada);
  /* Faltava aplicar: o filtro de cidade tinha estado, tinha select e tinha
     tratador — e não filtrava. Achado testando com "Joinville" e vendo o total
     continuar em 57. Declarar o estado não é implementar o filtro. */
  if (_cidade) lista = lista.filter(e => e.cidade === _cidade);
  if (_busca) {
    const t = chaveBusca(_busca);
    lista = lista.filter(e => chaveBusca(e.nome).includes(t) || chaveBusca(e.cnpj).includes(t)
                           || chaveBusca(e.cidade).includes(t));
  }

  const dir = _ordem.desc ? -1 : 1;
  lista = [...lista].sort((a, b) => {
    const x = a[_ordem.campo], y = b[_ordem.campo];
    if (typeof x === 'number' || typeof y === 'number') return ((x || 0) - (y || 0)) * dir;
    return String(x || '').localeCompare(String(y || ''), 'pt-BR') * dir;
  });

  const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
  const pagina = Math.min(_pagina, paginas);
  const naPagina = lista.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  const cidades = [...new Set(todas.map(e => e.cidade).filter(Boolean))].sort();
  /* Cidade so existe em quem esta cadastrado em `clientes`. Como a maior parte
     da lista sao contas que ainda nao foram cadastradas, filtrar por cidade
     esconde essas contas sem dizer por que — a pessoa conclui que Joinville tem
     2 empresas quando tem 2 CADASTRADAS. O aviso diz quantas ficaram de fora. */
  const semCidade = todas.filter(e => !e.cidade).length;

  return `
  ${ui.topo({ modulo:'CRM', moduloIcone:'building', titulo:'Empresas',
    sub: `${todas.length} ${todas.length === 1 ? 'empresa' : 'empresas'} com negócio registrado`,
    acoes:[{ rotulo:'Novo negócio', icone:'plus', tipo:'pri', acao:'crm:novo-lead' }] })}

  ${ui.kpis([
    { rotulo:'Empresas',        icone:'company', valor: todas.length },
    { rotulo:'Com negócio aberto', icone:'funnel', valor: todas.filter(e => e.abertos > 0).length },
    { rotulo:'Já compraram',    icone:'check',    valor: todas.filter(e => e.ganhos > 0).length },
    { rotulo:'Valor em carteira', icone:'trend',  valor: ui.fmt.moeda(todas.reduce((s,e) => s + (e.valor||0), 0)) }
  ])}

  ${ui.filtros({
    busca:{ id:'crmBuscaEmpresa', valor:_busca, placeholder:'Buscar por nome, CNPJ ou cidade', acao:'crm:buscar-empresa' },
    selects:[
      { id:'crmEmpSituacao', acao:'crm:emp-situacao', valor:_situacao, opcoes:[
        { v:'', r:'Todas as empresas' },
        { v:'abertos',  r:'Com negócio em aberto' },
        { v:'clientes', r:'Que já compraram' },
        { v:'sem-cnpj',    r:'Sem CNPJ cadastrado' },
        { v:'nao-cadastradas', r:'Ainda não cadastradas em Clientes' }
      ] },
      { id:'crmEmpCidade', acao:'crm:emp-cidade', valor:_cidade,
        opcoes:[{ v:'', r:'Todas as cidades' }, ...cidades.map(c => ({ v:c, r:c }))] }
    ]
  })}

  ${_cidade && semCidade ? ui.aviso({ tipo:'info', icone:'info',
    titulo:'Filtro de cidade alcança só empresas cadastradas',
    texto:`${semCidade} ${semCidade === 1 ? 'conta ainda não cadastrada em Clientes ficou' : 'contas ainda não cadastradas em Clientes ficaram'} de fora: cidade só existe no cadastro.` }) : ''}

  ${lista.length ? ui.tabela({
    ordem: _ordem,
    acaoLinha: (e) => `ir:crm-empresa:${e.chaveConta}`,
    colunas:[
      { campo:'nome', rotulo:'Empresa',
        render:(e) => `<div class="prim">${ui.esc(e.nome)}</div>
          <div class="sub">${e.naoCadastrada
            ? '<span style="color:var(--text-3)">ainda não cadastrada em Clientes</span>'
            : (e.cnpj ? 'CNPJ ' + ui.esc(ui.fmt.cnpj(e.cnpj)) : 'sem CNPJ') + (e.cidade ? ' · ' + ui.esc(e.cidade) : '')}</div>` },
      { campo:'abertos', rotulo:'Em aberto', dir:true,
        render:(e) => e.abertos ? `<span class="prim">${e.abertos}</span>` : `<span style="color:var(--text-3)">—</span>` },
      { campo:'ganhos', rotulo:'Fechados', dir:true,
        render:(e) => e.ganhos ? ui.selo(String(e.ganhos), 'ok') : `<span style="color:var(--text-3)">—</span>` },
      { campo:'valor', rotulo:'Valor total', dir:true,
        render:(e) => `<span class="prim">${ui.fmt.moeda(e.valor)}</span>` },
      { campo:'ultimo', rotulo:'Último movimento', dir:true,
        render:(e) => e.ultimo ? ui.fmt.desde(e.ultimo) : '—' }
    ],
    linhas: naPagina,
    rodape: ui.paginacao({ pagina, paginas, total: lista.length, porPagina: POR_PAGINA, rotulo:'empresas' })
  }) : ui.vazio({ icone:'company',
      titulo: _busca || _situacao || _cidade ? 'Nenhuma empresa encontrada' : 'Nenhuma empresa com negócio',
      sub: _busca || _situacao || _cidade
        ? 'Ajuste a busca ou os filtros acima.'
        : 'As empresas aparecem aqui quando um negócio é criado para elas.' })}`;
}

/* Estado da lista. Mora no módulo porque a tela é redesenhada inteira a cada
   ação — sem isto, buscar apagaria a ordenação e vice-versa. */
const POR_PAGINA = 25;
let _busca = '', _situacao = '', _cidade = '', _pagina = 1;
let _ordem = { campo:'valor', desc:true };

export function acao(nome, valor, redesenhar) {
  if (nome === 'crm:buscar-empresa') { _busca = valor || ''; _pagina = 1; redesenhar(); return true; }
  if (nome === 'crm:emp-situacao')   { _situacao = valor || ''; _pagina = 1; redesenhar(); return true; }
  if (nome === 'crm:emp-cidade')     { _cidade = valor || ''; _pagina = 1; redesenhar(); return true; }
  if (nome === 'pagina')  { _pagina = Number(valor) || 1; redesenhar(); return true; }
  if (nome === 'ordenar') { _ordem = { campo: valor, desc: !(_ordem.campo === valor && _ordem.desc) }; _pagina = 1; redesenhar(); return true; }
  return false;
}

/* ── Pedaços ─────────────────────────────────────────────────────────────── */
const listaNegocios = (negocios) => [...negocios]
  .sort((a,b) => new Date(b.criado_em || 0) - new Date(a.criado_em || 0))
  .map(n => {
    const cor = (etapa(n.estagio) || {}).cor || '#1E2A4A';
    return `<div class="crm-ativ clicavel" data-acao="ir:crm-lead:${ui.esc(n.id)}">
      <span class="crm-ativ-ico" style="background:${cor}14;color:${cor}">${icone(ehGanho(n.estagio) ? 'check' : 'funnel','sm')}</span>
      <div style="flex:1;min-width:0">
        <div class="crm-ativ-t">${ui.esc(n.item || n.treinamento || 'Negócio sem descrição')}</div>
        <div class="crm-ativ-s">${ui.esc(rotuloEstagio(n.estagio))}${n.responsavel ? ' · ' + ui.esc(n.responsavel) : ''}${
          n.motivo_perda ? ' · perdido: ' + ui.esc(n.motivo_perda) : ''}</div>
      </div>
      <span class="crm-lead-val">${ui.fmt.moeda(n.valor)}</span></div>`;
  }).join('');

const itemAtividade = (a) => `<div class="crm-ativ clicavel" data-acao="crm:atividade:${ui.esc(a.id)}">
  <span class="crm-ativ-ico" ${a.concluida ? 'style="background:var(--green-l);color:var(--green-text)"' : ''}>
    ${icone(a.concluida ? 'check' : 'clock','sm')}</span>
  <div style="flex:1"><div class="crm-ativ-t" ${a.concluida ? 'style="color:var(--text-3)"' : ''}>${ui.esc(a.titulo)}</div>
    <div class="crm-ativ-s">${ui.esc(a.responsavel || 'sem responsável')}</div></div>
  <span class="crm-ativ-hora">${ui.fmt.data(a.quando)}</span></div>`;

const dado = (k, v) => v ? `<div class="crm-ctx-linha"><span class="k">${k}</span><span class="v">${ui.esc(v)}</span></div>` : '';
