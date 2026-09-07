/* GRID · modulos/crm/painel.js — Painel comercial */
import * as ui from '../../nucleo/ui.js';
import { icone } from '../../nucleo/icones.js';
import * as dados from '../../nucleo/dados.js';
import * as sessao from '../../nucleo/sessao.js';
import { ESTAGIOS, rotuloEstagio } from '../../nucleo/estagios.js';

export async function render() {
  const [leads, conversas, atividades, caixas] = await Promise.all([
    dados.listar('crm_leads'),
    dados.listar('crm_conversas'),
    dados.listar('crm_atividades'),
    dados.listar('crm_caixas')
  ]);

  const abertos     = leads.filter(l => l.estagio !== 'ganho');
  const ganhos      = leads.filter(l => l.estagio === 'ganho');
  const negociacao  = leads.filter(l => ['proposta','negociacao'].includes(l.estagio));
  const aguardando  = conversas.filter(c => c.nao_lidas > 0 || c.estado === 'aguardando');
  const parados     = abertos.filter(l => l.parado_desde && diasDesde(l.parado_desde) >= 7);
  const caixaFora   = caixas.filter(c => c.estado === 'desconectado');
  const hoje        = atividades.filter(a => éHoje(a.quando));

  const soma = (arr) => arr.reduce((s, l) => s + (l.valor || 0), 0);

  /* Previsao: so negocio aberto com data. E "perdemos por que": agrupamento
     dos negocios perdidos por motivo, do mais frequente para o menos. Os dois
     saem dos leads ja carregados — nenhuma consulta a mais no painel. */
  const hoje0 = ui.hojeLocal();
  const fimMes = new Date(hoje0.getFullYear(), hoje0.getMonth() + 1, 0);
  const comData = abertos.filter(l => l.previsao);
  const noMes = comData.filter(l => ui.dataLocal(l.previsao) <= fimMes);
  const previsao = {
    total: noMes.length, valor: soma(noMes),
    vencidos: comData.filter(l => ui.diasAte(l.previsao) < 0).length,
    semData: abertos.filter(l => !l.previsao).length
  };

  const porMotivo = new Map();
  for (const l of leads.filter(x => x.motivo_perda)) {
    const m = porMotivo.get(l.motivo_perda) || { nome: l.motivo_perda, n: 0, valor: 0 };
    m.n++; m.valor += (l.valor || 0);
    porMotivo.set(l.motivo_perda, m);
  }
  /* ── CORRIGIDO EM 06/09 (h48) ──────────────────────────────────────────
     Ordenava e desenhava a barra pela CONTAGEM. Em homologacao cada motivo
     tem exatamente um negocio perdido, entao todas as barras davam 100% —
     quatro barras cheias, do mesmo tamanho, dizendo nada. Pior: sugeriam que
     os quatro motivos pesam igual, quando um deles custou R$ 14.500 e os
     outros ~R$ 4.500 cada.
     O que a pessoa quer saber aqui e QUANTO se perdeu por motivo. A barra
     passa a ser proporcional ao valor, e a ordem tambem. */
  const perdas = [...porMotivo.values()].sort((a, b) => (b.valor || 0) - (a.valor || 0)).slice(0, 6);
  const perdaMaior = Math.max(1, ...perdas.map(m => m.valor || 0));
  const perdaTotal = perdas.reduce((t, m) => t + (m.valor || 0), 0);
  const perdaNegocios = perdas.reduce((t, m) => t + m.n, 0);

  return `
  ${ui.topo({
    modulo:'CRM', moduloIcone:'funnel',
    titulo:'Painel comercial',
    sub: `${dataLonga()} · ${aguardando.length} conversas aguardando e ${parados.length} propostas paradas`,
    acoes:[
      { rotulo:'Nova conversa', icone:'chat',  tipo:'sec', acao:'crm:nova-conversa' },
      { rotulo:'Novo lead',     icone:'plus',  tipo:'pri', acao:'crm:novo-lead' }
    ]
  })}

  ${ui.kpis([
    { rotulo:'Leads abertos',      icone:'funnel', valor: abertos.length,  nota:`Em ${new Set(abertos.map(l=>l.estagio)).size} estágios`, acao:'ir:crm-funil' },
    { rotulo:'Aguardando resposta',icone:'chat',   valor: aguardando.length, nota:'Precisa de resposta hoje', notaTipo:'at', destaque:true, acao:'ir:crm-conversas' },
    { rotulo:'Em negociação',      icone:'doc',    valor: ui.fmt.moeda(soma(negociacao)), nota:`${negociacao.length} propostas` },
    { rotulo:'Ganhos no mês',      icone:'check',  valor: ganhos.length, nota: ui.fmt.moeda(soma(ganhos)), notaTipo:'up' }
  ])}

  ${(aguardando.length || parados.length || caixaFora.length)
      /* ── BUG CORRIGIDO EM 05/09 (h17) ──────────────────────────────────
         Este cabecalho vinha com `link:{ acao:'' }`. Uma acao vazia nao e
         tratador nenhum: o clique caia no roteador e terminava na Home.
         O mockup aprovado nunca teve link aqui — quem leva a algum lugar sao
         os avisos abaixo, cada um com o seu proprio destino. */
      ? ui.secao('Requer decisão hoje', { contagem: `${aguardando.length + parados.length + caixaFora.length} itens` })
      : ''}

  ${ui.alertas([
    /* Passou a usar o MESMO componente da tela Inicio (05/09, h40). Antes eram
       tres caixas tintas seguidas — o formato que o Alisson chamou de brega, e
       com razao: fundo, borda, icone, texto e botao na mesma cor, tres vezes
       empilhados logo abaixo dos KPIs. Aqui a cor aparece uma vez por linha,
       num filete, e o numero sai do meio da frase. */
    ...(aguardando.length ? [{
      n: aguardando.length,
      unidade: aguardando.length === 1 ? 'conversa' : 'conversas',
      texto: 'sem resposta',
      sub: aguardando.slice(0, 3).map(c => ui.esc(c.nome)).join(' · ')
           + (aguardando.length > 3 ? ` · e mais ${aguardando.length - 3}` : ''),
      acao: 'Abrir', acaoDeclarada: 'ir:crm-conversas'
    }] : []),
    ...(parados.length ? [{
      n: parados.length,
      unidade: parados.length === 1 ? 'proposta parada' : 'propostas paradas',
      texto: `há mais de 7 dias · ${ui.fmt.moeda(soma(parados))}`,
      /* Aqui listava TODAS as propostas paradas com valor, num paragrafo so.
         Com 34 delas o aviso tomava metade da tela e ninguem lia nenhuma.
         Tres nomes, os de maior valor, e o resto vira contagem. */
      sub: [...parados].sort((a, b) => (b.valor || 0) - (a.valor || 0)).slice(0, 3)
             .map(l => `${ui.esc(l.empresa)} (${ui.fmt.moeda(l.valor)})`).join(' · ')
           + (parados.length > 3 ? ` · e mais ${parados.length - 3}` : ''),
      acao: 'Ver no funil', acaoDeclarada: 'ir:crm-funil'
    }] : []),
    /* Numero desconectado e o unico GRAVE do painel: enquanto durar, mensagem
       de cliente nao chega em ninguem. */
    ...caixaFora.map(c => ({
      grave: true,
      texto: `Número do <b>${ui.esc(c.nome)}</b> desconectado desde ${ui.esc(c.desde || 'hoje')}`,
      sub: 'As mensagens continuam sendo recebidas e entram na caixa ao reconectar',
      acao: 'Reconectar', acaoDeclarada: `crm:reconectar:${c.id}`
    }))
  ])}

  ${ui.secao('Funil e agenda', { link:{ rotulo:'Ver funil completo', acao:'ir:crm-funil' } })}
  <div class="home-2col">
    ${ui.cartao(`
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
        ${icone('funnel')}<span class="ds-card-titulo">Funil de ${mesAtual()}</span></div>
      ${barrasFunil(leads)}
      <div style="display:flex;gap:28px;margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">
        ${indicador(pctConversao(leads) + '%', 'Conversão')}
        ${indicador(ui.fmt.moeda(ganhos.length ? soma(ganhos)/ganhos.length : 0), 'Ticket médio')}
        ${indicador('11 dias', 'Ciclo médio')}
      </div>`)}

    ${ui.cartao(
      ui.cartaoTitulo('Atividades de hoje', 'activity', { rotulo:'Ver todas', acao:'ir:crm-atividades' }) +
      (hoje.length ? hoje.map(linhaAtividade).join('') : ui.vazio({ icone:'check', titulo:'Nada marcado para hoje' })),
      { plano:true })}
  </div>

  ${ui.secao('Previsão e perdas do mês')}
  <div class="home-2col">
    ${ui.cartao(`
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
        ${icone('calendar')}<span class="ds-card-titulo">Previsão de fechamento</span></div>
      ${previsao.total ? `
        <div style="display:flex;gap:28px;flex-wrap:wrap">
          ${indicador(ui.fmt.moeda(previsao.valor), 'Previsto até o fim do mês')}
          ${indicador(String(previsao.total), 'Negócios com data')}
          ${previsao.vencidos ? `<div><div class="num" style="font-size:var(--fs-6);font-weight:700;color:var(--atencao-text)">${previsao.vencidos}</div>
            <div style="font-size:var(--fs-2);color:var(--atencao-text);margin-top:2px">Com data vencida</div></div>` : ''}
        </div>
        ${previsao.semData ? `<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border);
          font-size:var(--fs-2);color:var(--text-3);line-height:1.6">
          ${previsao.semData} negócio${previsao.semData>1?'s':''} em aberto sem data de previsão — sem ela, o valor do funil não vira previsão de caixa.</div>` : ''}`
      : ui.vazio({ icone:'calendar', titulo:'Nenhum negócio com data de previsão',
                   sub:'Preencha "Previsão de fechamento" ao editar um negócio para o funil virar previsão de caixa.' })}`)}

    ${ui.cartao(
      ui.cartaoTitulo('Por que perdemos', 'trenddown') +
      (perdas.length
        ? `<div style="font-size:var(--fs-2);color:var(--text-3);margin:-2px 0 12px">
             ${ui.fmt.moeda(perdaTotal)} em ${perdaNegocios} ${perdaNegocios === 1 ? 'negócio' : 'negócios'}</div>
           <div style="display:flex;flex-direction:column;gap:11px">${perdas.map(m => `
            <div>
              <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:5px">
                <span style="font-size:var(--fs-2);color:var(--text-1);flex:1;min-width:0">${ui.esc(m.nome)}</span>
                <span class="num" style="font-size:var(--fs-2);font-weight:700;color:var(--text-1)">${ui.fmt.moeda(m.valor)}</span>
                <span class="num" style="font-size:var(--fs-1);color:var(--text-3);white-space:nowrap">${m.n} ${m.n === 1 ? 'negócio' : 'negócios'}</span>
              </div>
              <!-- Barra em vermelho cheio, 5px. Medido: sobre o trilho da barra o
                   vermelho a 45% dava 2,00:1 e nao se distinguia do fundo — um
                   grafico precisa de 3:1 para o traco valer alguma coisa. Cheio
                   da 4,05:1. E como a largura agora e proporcional, so a maior
                   perda ocupa a linha toda: a area colorida ficou MENOR que a
                   das quatro barras iguais de antes. -->
              <div style="height:5px;background:var(--gray-100);border-radius:3px;overflow:hidden">
                <div style="width:${Math.max(3, Math.round((m.valor || 0) / perdaMaior * 100))}%;height:5px;background:var(--red);border-radius:3px"></div>
              </div>
            </div>`).join('')}</div>`
        : ui.vazio({ icone:'check', titulo:'Nenhuma perda registrada com motivo',
                     sub:'Ao marcar um negócio como perdido, o motivo é pedido — e aparece aqui.' })),
      { plano:true })}
  </div>

  ${ui.secao('Conversas recentes', { link:{ rotulo:'Abrir caixa de entrada', acao:'ir:crm-conversas' } })}
  ${ui.lista(conversas.slice(0,3).map(c => ({
      titulo: `${c.empresa || c.nome}${c.empresa && c.nome !== c.empresa ? ' · ' + c.nome : ''}`,
      sub: c.previa,
      cor: corPorEstado(c.estado),
      acao: `crm:conversa:${c.id}`,
      fim: `${etiquetaCaixa(caixas, c.caixa_id)} ${ui.selo(rotuloEstado(c.estado), tipoEstado(c.estado))}
            <span class="num" style="font-size:var(--fs-2);color:var(--text-3);width:44px;text-align:right">${c.hora}</span>`
  })))}
  ${dados.ehExemplo() ? avisoDemo() : ''}`;
}

/* ── auxiliares ─────────────────────────────────────────────────────────── */
const indicador = (v, r) =>
  `<div><div class="num" style="font-size:var(--fs-6);font-weight:700;color:var(--navy)">${v}</div>
   <div style="font-size:var(--fs-2);color:var(--text-3);margin-top:2px">${r}</div></div>`;

function barrasFunil(leads) {
  const max = Math.max(...ESTAGIOS.map(e => leads.filter(l => l.estagio === e.id).length), 1);
  return `<div style="display:flex;flex-direction:column;gap:11px">${ESTAGIOS.map(e => {
    const n = leads.filter(l => l.estagio === e.id).length;
    return `<div style="display:flex;align-items:center;gap:10px">
      <span style="font-size:var(--fs-2);color:var(--text-2);width:108px">${e.rotulo}</span>
      <div style="flex:1;height:8px;background:var(--gray-100);border-radius:4px">
        <div style="width:${Math.round(n / max * 100)}%;height:8px;background:${e.cor};border-radius:4px"></div></div>
      <span class="num" style="font-size:var(--fs-2);color:var(--text-3);width:64px;text-align:right">${n} leads</span>
    </div>`; }).join('')}</div>`;
}

function linhaAtividade(a) {
  const ic = { ligacao:'phone', proposta:'doc', whatsapp:'chat', visita:'building' }[a.tipo] || 'activity';
  return `<div class="crm-ativ">
    <span class="crm-ativ-ico" ${a.concluida ? 'style="background:var(--green-l);color:var(--green-text)"' : ''}>${icone(a.concluida ? 'check' : ic, 'sm')}</span>
    <div style="flex:1"><div class="crm-ativ-t" ${a.concluida ? 'style="color:var(--text-3)"' : ''}>${ui.esc(a.titulo)}</div>
      <div class="crm-ativ-s">${ui.esc(a.sub || '')}</div></div>
    <span class="crm-ativ-hora" ${a.concluida ? 'style="color:var(--text-3)"' : ''}>${ui.fmt.hora(a.quando)}</span></div>`;
}

const etiquetaCaixa = (caixas, id) => {
  const c = caixas.find(x => x.id === id);
  return c ? `<span class="crm-tag-caixa"><i></i> ${ui.esc(c.nome)}</span>` : '';
};

const rotuloEstado = (e) => ({ aguardando:'Aguardando', respondida:'Respondida', sem_responsavel:'Sem responsável', na_fila:'Na fila', resolvida:'Resolvida' })[e] || e;
const tipoEstado   = (e) => ({ aguardando:'atencao', respondida:'ok', sem_responsavel:'atencao', na_fila:'atencao', resolvida:'ok' })[e] || 'neutro';
const corPorEstado = (e) => ({ resolvida:'#059669', na_fila:'#B45309' })[e] || '#1E2A4A';

const diasDesde = (d) => Math.floor((Date.now() - new Date(d)) / 86400000);
const éHoje = (d) => new Date(d).toDateString() === new Date().toDateString();
const dataLonga = () => new Date().toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long' });
const mesAtual  = () => new Date().toLocaleDateString('pt-BR', { month:'long' });
const pctConversao = (leads) => {
  const g = leads.filter(l => l.estagio === 'ganho').length;
  return leads.length ? Math.round(g / leads.length * 100) : 0;
};

export const avisoDemo = () => `
  <div class="ds-aviso info" style="margin-top:var(--sp-4)">
    ${icone('info','lg')}
    <div class="txt"><b>Modo demonstração</b>As telas estão rodando com dados de exemplo — o schema do CRM ainda não foi criado no banco. Nada aqui grava.</div>
  </div>`;
