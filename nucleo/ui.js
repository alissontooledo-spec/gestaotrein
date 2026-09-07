/* ══════════════════════════════════════════════════════════════════════════
   GRID · nucleo/ui.js
   Os componentes canônicos do produto, como funções que devolvem HTML.
   Todo módulo desenha por aqui — nenhum módulo escreve no DOM direto.

   Por que devolver texto e não elemento: o app tem DOM duplo (desktop e
   celular recebem o mesmo HTML por setConteudo). Um módulo que devolve
   texto nunca cria o bug histórico nº 1 do projeto, que é guardar
   referência de elemento e mexer só na cópia visível.
   ══════════════════════════════════════════════════════════════════════════ */

import { icone } from './icones.js';

/* ── Texto seguro ───────────────────────────────────────────────────────── */
export const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/* ── Formatação ─────────────────────────────────────────────────────────── */
export const fmt = {
  moeda: (n) => 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
  data:  (d) => d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—',
  hora:  (d) => d ? new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '',
  /* CNPJ vem do banco em formatos diferentes: uns gravados com mascara
     ("44.444.444/0001-44"), outros so com barra e traco ("10002984/0001-56"),
     e os que a consulta da Receita devolve sao 14 digitos crus. A tela mostrava
     o que estivesse gravado, entao a mesma coluna tinha tres aparencias. Formata
     na exibicao; o que esta gravado nao muda. Se nao tiver 14 digitos, devolve
     como veio — inventar pontuacao em dado incompleto e pior do que mostrar cru. */
  cnpj: (v) => {
    const d = String(v || '').replace(/\D/g, '');
    if (d.length !== 14) return v || '';
    return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
  },
  telefone: (t) => {
    const s = String(t || '').replace(/\D/g, '');
    if (s.length === 13) return `+${s.slice(0,2)} ${s.slice(2,4)} ${s.slice(4,9)}-${s.slice(9)}`;
    if (s.length === 11) return `(${s.slice(0,2)}) ${s.slice(2,7)}-${s.slice(7)}`;
    return t || '';
  },
  // "há quanto tempo", em português, sem biblioteca
  desde: (d) => {
    if (!d) return '—';
    const dias = Math.floor((Date.now() - new Date(d)) / 86400000);
    if (dias <= 0) return 'hoje';
    if (dias === 1) return '1 dia';
    return `${dias} dias`;
  },
  iniciais: (nome) => String(nome || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase()
};

/* ── CORRIGIDO EM 05/09 (h26) ──────────────────────────────────────────────
   Uma data pura ("2026-09-03") virava `new Date(d + 'T12:00')` — meio-dia — e
   a diferenca para hoje 00:00 dava 1,5 dia, que `Math.round` transformava em
   1. Marcar previsao para dois dias atras mostrava "venceu há 1 dia".
   Data pura vira meia-noite local, e a diferenca passa a ser numero inteiro
   de dias. Um lugar so, porque a conta aparecia em quatro. */
export const dataLocal = (aaaammdd) => {
  if (!aaaammdd) return null;
  const [a, m, d] = String(aaaammdd).slice(0, 10).split('-').map(Number);
  if (!a || !m || !d) return null;
  return new Date(a, m - 1, d);          // meia-noite no fuso de quem olha
};

export const hojeLocal = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };

/* Dias inteiros entre uma data pura e hoje. Negativo = ja passou. */
export const diasAte = (aaaammdd) => {
  const d = dataLocal(aaaammdd);
  return d ? Math.round((d - hojeLocal()) / 86400000) : null;
};

/* ── Cabeçalho de tela ──────────────────────────────────────────────────────
   modulo → a linha de cima (some quando a organização tem um módulo só)   */
export function topo({ modulo, moduloIcone, titulo, sub, acoes = [], voltar }) {
  return `
  <div class="ds-topo">
    <div class="ds-topo-txt">
      ${voltar
        ? `<div class="ds-eyebrow"><span data-acao="${esc(voltar.acao)}" style="cursor:pointer;display:inline-flex;align-items:center;gap:5px">${icone('back','sm')} ${esc(voltar.rotulo)}</span></div>`
        : (modulo ? `<div class="ds-eyebrow">${icone(moduloIcone || 'grid','sm')} ${esc(modulo)}</div>` : '')}
      <div class="ds-titulo">${esc(titulo)}</div>
      ${sub ? `<div class="ds-sub">${esc(sub)}</div>` : ''}
    </div>
    ${acoes.length ? `<div class="ds-acoes">${acoes.map(botao).join('')}</div>` : ''}
  </div>`;
}

/* ── Botão ──────────────────────────────────────────────────────────────── */
export function botao({ rotulo, icone: ic, tipo = 'sec', acao, tamanho = '', largura }) {
  return `<button class="ds-btn ${tipo} ${tamanho}" ${acao ? `data-acao="${esc(acao)}"` : ''}
    ${largura ? `style="width:${largura};justify-content:center"` : ''}>${ic ? icone(ic, 'sm') : ''} ${esc(rotulo)}</button>`;
}

/* ── Indicadores ────────────────────────────────────────────────────────── */
export function kpis(itens) {
  return `<div class="ds-kpis">${itens.map(k => `
    <div class="ds-kpi ${k.destaque ? 'destaque' : ''}" ${k.acao ? `data-acao="${esc(k.acao)}" style="cursor:pointer"` : ''}>
      <div class="top">${icone(k.icone || 'grid','sm')}<span class="rot">${esc(k.rotulo)}</span></div>
      <div class="val">${esc(k.valor)}</div>
      ${k.nota ? `<div class="nota ${k.notaTipo || ''}">${esc(k.nota)}</div>` : ''}
    </div>`).join('')}</div>`;
}

/* ── Cabeçalho de seção ─────────────────────────────────────────────────── */
export function secao(rotulo, { link, cor, contagem } = {}) {
  /* `link` leva a algum lugar; `contagem` so informa. Link sem acao e ignorado
     de proposito: ate 05/09 um `acao:''` virava clique que terminava na Home
     (ver painel.js). Se nao ha destino, nao ha o que clicar. */
  const temDestino = link && link.acao;
  return `<div class="ds-sec"><span class="rot" ${cor ? `style="color:${cor}"` : ''}>${esc(rotulo)}</span>
    <div class="linha"></div>
    ${contagem ? `<span class="cnt">${esc(contagem)}</span>` : ''}
    ${temDestino ? `<span class="link" data-acao="${esc(link.acao)}">${esc(link.rotulo)}</span>` : ''}</div>`;
}

/* ── Aviso ──────────────────────────────────────────────────────────────────
   tipo: 'atencao' | 'erro' | 'info'. Atenção usa a cor própria de atenção,
   nunca o âmbar de marca — é a regra de cor da revisão de 03/09.           */
export function aviso({ tipo = 'atencao', icone: ic, titulo, texto, acao }) {
  /* Teto de tamanho no proprio componente: um aviso e para ser lido de
     relance, e uma tela que gera texto a partir de uma lista pode crescer sem
     que ninguem perceba (aconteceu: 34 propostas paradas listadas uma a uma
     ocupavam metade do painel). Se passar disto, corta com reticencias —
     e a tela que quiser mais detalhe usa um cartao, nao um aviso. */
  const t = String(texto || '');
  const cortado = t.length > 180 ? t.slice(0, 177).trimEnd() + '…' : t;
  return `<div class="ds-aviso ${tipo}">
    ${icone(ic || (tipo === 'erro' ? 'alert' : 'info'), 'lg')}
    <div class="txt"><b>${esc(titulo)}</b>${esc(cortado)}</div>
    ${acao ? botao({ ...acao, tipo: 'sec', tamanho: 'sm' }) : ''}
  </div>`;
}

/* ── Lista "Requer atenção" ─────────────────────────────────────────────────
   O MESMO componente da tela Início. Ele nao e reimplementado aqui: a casca
   passa o construtor pela ponte (`GRID.ponte.alertas`), porque o CSS e o HTML
   moram no app.html — a tela Inicio precisa deles mesmo sem modulo contratado,
   e o `design-system-aditivo.css` so e baixado quando ha modulo.

   A copia local existe so para o demo.html, que roda as telas fora do app e
   nao tem ponte. Se as duas divergirem, quem vale e a do app.html.

   Item: { grave, n, unidade, texto, sub, abaixo, acao, acaoHtml, extra } mais UM
   dos dois cliques: `acaoDeclarada` ("ir:crm-funil", o jeito do modulo) ou
   `aoClicar` (JS puro, o jeito da casca). Modulo usa sempre acaoDeclarada. */
export function alertas(itens) {
  const ponte = typeof window !== 'undefined' && window.__GRID_PONTE;
  if (ponte && typeof ponte.alertas === 'function') return ponte.alertas(itens);

  if (!itens || !itens.length) return '';
  const ordenados = [...itens].sort((a, b) => (a.grave ? 0 : 1) - (b.grave ? 0 : 1));
  const temColuna = ordenados.some((a) => a.n != null);
  const chev = icone('chevronright', 'sm');
  return `<div class="ds-alertas">${ordenados.map((a) => {
    const corpo = `<div class="tx">${a.unidade ? `<b>${esc(a.unidade)}</b> ` : ''}${a.texto}</div>`
      + (a.sub    ? `<div class="sub">${a.sub}</div>` : '')
      + (a.abaixo ? `<div class="abaixo">${a.abaixo}</div>` : '');
    const temBloco = !!(a.sub || a.abaixo);
    return `
    <div class="ds-alerta ${a.grave ? 'grave' : ''} ${(a.aoClicar || a.acaoDeclarada) ? 'clicavel' : ''} ${temBloco ? 'com-bloco' : ''}"${
      a.aoClicar ? ` onclick="${a.aoClicar}"` : a.acaoDeclarada ? ` data-acao="${esc(a.acaoDeclarada)}"` : ''}>
      <span class="fil"></span>
      ${temColuna ? `<span class="num">${a.n != null ? esc(a.n) : ''}</span>` : ''}
      ${temBloco ? `<div class="corpo">${corpo}</div>` : corpo}
      ${a.acaoHtml || (a.acao ? `<span class="ac">${esc(a.acao)}${chev}</span>` : '')}
      ${a.extra || ''}
    </div>`;
  }).join('')}</div>`;
}

/* ── Selo de estado ─────────────────────────────────────────────────────── */
export const selo = (rotulo, tipo = 'neutro', ponto = false) =>
  `<span class="ds-selo ${tipo}">${ponto ? '<i class="ponto"></i>' : ''}${esc(rotulo)}</span>`;

/* ── Barra de busca e filtros ───────────────────────────────────────────── */
export function filtros({ busca, selects = [], direita = '' }) {
  return `<div class="ds-filtros">
    ${busca ? `<div class="ds-busca">${icone('search','sm')}
      <input type="search" id="${esc(busca.id)}" placeholder="${esc(busca.placeholder || 'Buscar')}"
             value="${esc(busca.valor || '')}" data-acao="${esc(busca.acao || '')}"></div>` : ''}
    ${selects.map(s => `<select class="ds-select" id="${esc(s.id)}" ${s.acao ? `data-acao="${esc(s.acao)}"` : ''}>
      ${s.opcoes.map(o => {
        const v = o.v ?? o, r = o.r ?? o;
        /* `valor` reaplica a escolha depois do redesenho: a tela inteira e
           refeita a cada acao, e sem isto o filtro voltava para "Todos"
           sozinho — parecia que nao tinha filtrado. */
        return `<option value="${esc(v)}" ${s.valor != null && String(s.valor) === String(v) ? 'selected' : ''}>${esc(r)}</option>`;
      }).join('')}</select>`).join('')}
    ${direita ? `<div class="direita">${direita}</div>` : ''}
  </div>`;
}

/* ── Tabela de dados ────────────────────────────────────────────────────────
   O componente que o produto não tinha: cabeçalho ordenável, seleção em
   lote, dígitos alinhados. Colunas: {campo, rotulo, dir, largura, render}. */
export function tabela({ colunas, linhas, ordem, selecao = [], selecionavel = false, rodape = '', vazio: vz, acaoLinha }) {
  if (!linhas.length) return vazio(vz || { titulo: 'Nada por aqui ainda' });
  const cab = `<tr>
    ${selecionavel ? `<th class="chk"><span class="ds-chk ${selecao.length && selecao.length === linhas.length ? 'on' : ''}" data-acao="sel-todos"></span></th>` : ''}
    ${colunas.map(c => {
      const ativa = ordem && ordem.campo === c.campo;
      const seta  = ativa ? icone(ordem.desc ? 'sortdown' : 'sortup', 'sm') : icone('sortdown', 'sm');
      return `<th class="${c.dir ? 'dir' : ''} ${ativa ? 'ord' : ''}" data-acao="ordenar:${esc(c.campo)}">${esc(c.rotulo)} ${c.ordenavel === false ? '' : seta}</th>`;
    }).join('')}
  </tr>`;

  const corpo = linhas.map((l, i) => {
    const sel = selecao.includes(l.id);
    /* Linha clicavel. Ate 05/09 a tabela nao tinha isto: no computador, a tela
       de Contatos (que e tabela) nao abria contato nenhum, enquanto a versao de
       celular (que e lista) abria. O clique no checkbox de selecao nao conta —
       por isso a acao fica na <tr> e a celula do checkbox para a propagacao. */
    const acao = acaoLinha ? acaoLinha(l) : null;
    return `<tr class="${sel ? 'sel' : ''} ${acao ? 'clicavel' : ''}" data-id="${esc(l.id)}" ${acao ? `data-acao="${esc(acao)}"` : ''}>
      ${selecionavel ? `<td class="chk"><span class="ds-chk ${sel ? 'on' : ''}" data-acao="sel:${esc(l.id)}"></span></td>` : ''}
      ${colunas.map(c => `<td class="${c.dir ? 'dir' : ''}">${c.render ? c.render(l, i) : esc(l[c.campo])}</td>`).join('')}
    </tr>`;
  }).join('');

  const barra = selecao.length ? `<div class="ds-barra-sel">${icone('check','sm')} ${selecao.length} selecionado${selecao.length > 1 ? 's' : ''}
    <button class="ds-btn sm" style="margin-left:auto" data-acao="lote-responsavel">Atribuir responsável</button>
    <button class="ds-btn sm" data-acao="lote-estagio">Mover estágio</button></div>` : '';

  return `<div class="ds-tabela-wrap">${barra}
    <table class="ds-tabela"><thead>${cab}</thead><tbody>${corpo}</tbody></table>
    ${rodape}</div>`;
}

export function paginacao({ pagina = 1, paginas = 1, total = 0, rotulo = 'registros', porPagina = 20 }) {
  /* O texto dizia "Mostrando 20 de N" com 20 FIXO no código — mesmo quando a
     tela mostrava 25. Agora ele conta o que está de fato na página, incluindo
     a última, que quase nunca está cheia. E a numeração acompanha a página
     atual em vez de mostrar sempre 1-4: com 57 registros e a pessoa na página
     3, "1 2 3 4" sem destaque não diz onde ela está. */
  const primeiro = total === 0 ? 0 : (pagina - 1) * porPagina + 1;
  const ultimo   = Math.min(pagina * porPagina, total);

  const janela = [];
  const ini = Math.max(1, Math.min(pagina - 1, paginas - 3));
  for (let i = ini; i <= Math.min(paginas, ini + 3); i++) janela.push(i);

  const btn = (i, rot, ativo) => `<span class="${ativo ? 'on' : ''}" data-acao="pagina:${i}">${rot}</span>`;
  const p = [
    pagina > 1 ? btn(pagina - 1, icone('back','sm'), false) : '',
    ...janela.map(i => btn(i, String(i), i === pagina)),
    pagina < paginas ? btn(pagina + 1, icone('chevronright','sm'), false) : ''
  ].filter(Boolean);

  return `<div class="ds-tabela-rodape">
    <span>${total === 0 ? `Nenhum ${esc(rotulo).replace(/s$/, '')}`
      : `Mostrando ${primeiro}–${ultimo} de ${total} ${esc(rotulo)}`}</span>
    <div class="pag">${p.join('')}</div>
  </div>`;
}

/* ── Linha de lista ─────────────────────────────────────────────────────────
   Uma anatomia para o produto inteiro, no lugar das 6 cópias que existem.  */
export function lista(itens) {
  if (!itens.length) return vazio({ titulo: 'Nada por aqui ainda' });
  return `<div class="ds-card flat">${itens.map(i => `
    <div class="ds-linha" ${i.acao ? `data-acao="${esc(i.acao)}"` : ''}>
      ${i.avatar !== false ? `<span class="ds-av" ${i.cor ? `style="background:${i.cor}14;color:${i.cor}"` : ''}>${esc(i.iniciais || fmt.iniciais(i.titulo))}</span>` : ''}
      <div class="ds-linha-main">
        <div class="ds-linha-tit">${esc(i.titulo)}</div>
        ${i.sub ? `<div class="ds-linha-sub">${esc(i.sub)}</div>` : ''}
      </div>
      ${i.fim ? `<div class="ds-linha-fim">${i.fim}</div>` : ''}
    </div>`).join('')}</div>`;
}

/* ── Cartão ─────────────────────────────────────────────────────────────── */
export const cartao = (conteudo, { plano = false, estilo = '' } = {}) =>
  `<div class="ds-card ${plano ? 'flat' : ''}" ${estilo ? `style="${estilo}"` : ''}>${conteudo}</div>`;

export const cartaoTitulo = (titulo, ic, acao) =>
  `<div class="ds-card-head">${ic ? icone(ic) : ''}<span class="ds-card-titulo">${esc(titulo)}</span>
   ${acao ? botao({ ...acao, tipo: 'ghost', tamanho: 'sm' }) : ''}</div>`;

/* ── Estados ────────────────────────────────────────────────────────────── */
export const vazio = ({ icone: ic = 'inbox', titulo, sub }) =>
  `<div class="ds-so-pc"><div class="ic">${icone(ic,'lg')}</div><h4>${esc(titulo)}</h4>${sub ? `<p>${esc(sub)}</p>` : ''}</div>`;

export const carregando = (n = 5) =>
  `<div class="ds-card">${Array.from({ length: n }, (_, i) =>
    `<div class="ds-esqueleto" style="width:${[92, 74, 88, 61, 80][i % 5]}%"></div>`).join('')}</div>`;

/* Tela que só existe no computador (item de menu com mobile:false).
   Nunca esconder o item sem explicação e nunca deixar a tabela rolar. */
export const soComputador = ({ titulo, texto, alternativa }) =>
  `<div class="ds-so-pc"><div class="ic">${icone('monitor','lg')}</div>
    <h4>${esc(titulo)}</h4><p>${esc(texto)}</p>
    ${alternativa ? botao({ ...alternativa, tipo: 'pri' }) : ''}</div>`;

/* ── Erro visível ───────────────────────────────────────────────────────────
   Hoje o app tem 166 blocos catch e 5 que mostram algo ao usuário. Todo
   módulo novo usa isto: falha de rede nunca é silenciosa.                  */
export const erro = (msg, acao) =>
  aviso({ tipo: 'erro', icone: 'alert', titulo: 'Não foi possível carregar', texto: msg, acao });
