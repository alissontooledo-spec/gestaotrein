/* GRID · modulos/crm/conversas.js — atendimento de WhatsApp
   ───────────────────────────────────────────────────────────────────────────
   14/09 (madrugada) — reorganizada em TRÊS ABAS, no modelo que o Alisson usa
   no Digisac e pediu para copiar:

     · Chats    — conversas que alguém já assumiu (em atendimento)
     · Fila     — conversas sem responsável, numeradas por ordem de espera
     · Contatos — a agenda inteira + "Criar novo", que é por onde se PUXA
                  assunto com alguém que ainda não escreveu

   Os quatro chips antigos (Abertas/Minhas/Sem responsável/Resolvidas) diziam
   a mesma coisa de um jeito que só quem construiu entendia. Quem atende
   precisa de três perguntas: o que estou atendendo, o que está esperando, e
   com quem eu quero falar. É isso e nada mais.

   "Resolvidas" não sumiu: virou o botão de filtro ao lado da busca, que é
   onde o Digisac também guarda o que não é do dia a dia.                    */
import * as ui from '../../nucleo/ui.js';
import { icone } from '../../nucleo/icones.js';
import * as dados from '../../nucleo/dados.js';
import * as navegacao from '../../nucleo/navegacao.js';
import * as sessao from '../../nucleo/sessao.js';
import { avisoDemo } from './painel.js';

/* ── 18/09: a tela se atualiza sozinha ──────────────────────────────────────
   Até aqui, mensagem que chegava só aparecia se a pessoa trocasse de aba ou
   recarregasse. Quem atende WhatsApp fica com a tela aberta o dia inteiro —
   e ficava respondendo com atraso sem saber que havia atraso.

   Dez segundos é o intervalo. Não é arbitrário: o gateway roda um ciclo a
   cada ~30s, então nada chega mais rápido do que isso de qualquer forma;
   dez segundos garante que a mensagem apareça no primeiro ciclo depois de
   existir, sem multiplicar consultas ao banco à toa.

   As travas estão em `ligarAtualizacaoAutomatica()`, e cada uma existe por um
   motivo específico — leia lá antes de mexer no intervalo. */
const INTERVALO_ATUALIZACAO = 10000;
let _timerTela = null;
let _rolagemAntes = null;   // onde cada conversa estava rolada, antes do redesenho
let _rascunhoAntes = null;  // o que estava escrito no campo, antes do redesenho
let _naoLidasDaAberta = 0;  // quantas não-lidas a conversa aberta ainda carrega
let _emAtualizacaoAutomatica = false; // este redesenho foi pedido pelo temporizador?
let _abertaDeProposito = null;        // id da conversa que a pessoa CLICOU

let _aba = 'chats';           // 'chats' | 'fila' | 'contatos'
let _caixaAtiva = 'todas';
let _conversaAtiva = null;
let _busca = '';
let _verResolvidas = false;
/* 14/09: a ficha do contato deixou de ser coluna fixa e virou painel que
   abre por cima da conversa. Ela custava 272px permanentes de uma tela onde
   o que se faz é ler e escrever. Fechada por padrão. */
let _fichaAberta = false;
/* 26/09 (v196): a ficha virou painel de EDIÇÃO do contato. O que foi
   digitado nela e ainda não salvo atravessa o redesenho (automático ou não),
   do mesmo jeito que o rascunho da mensagem. */
let _fichaRascunho = null;

/* ── 26/09: atender em equipe ─────────────────────────────────────────────
   `_dono`: na aba Chats, "Minhas" mostra só as conversas de quem está usando;
   "Todas", as da equipe. Fica lembrado neste navegador (é preferência de uma
   pessoa, não da empresa). O Provedor em Modo Suporte começa em "Todas" —
   ele não atende conversa de cliente, e "Minhas" seria sempre vazio.
   `_modo`: o campo de baixo responde ao cliente ou grava nota interna.
   Troca de conversa volta para "Responder": nota escrita na conversa errada
   é só incômodo, mas resposta que a pessoa achava ser nota vai para o
   cliente — por isso o modo nunca atravessa de uma conversa para outra. */
const CHAVE_DONO = 'grid.crm.conversas.dono';
let _dono = (() => {
  try { const v = localStorage.getItem(CHAVE_DONO); if (v === 'minhas' || v === 'todas') return v; } catch { /* navegador sem armazenamento */ }
  return sessao.perfil() === 'provedor' ? 'todas' : 'minhas';
})();
let _modo = 'responder';
let _modoDaConversa = null;
let _respostas = [];

/* Modelos de resposta. Ficam aqui, e não no banco, porque hoje são texto
   fixo — quando virarem configuráveis por organização, viram tabela e esta
   constante sai. O atalho insere no campo; quem envia continua sendo a
   pessoa. */
const MODELOS = {
  proposta: 'Olá! Já estou montando sua proposta e te envio ainda hoje.',
  datas: 'Tenho estas datas disponíveis para a turma: ',
  certificado: 'Claro! Me confirme o nome completo e o CPF do participante que eu emito a 2ª via do certificado.'
};

/* ── Elemento que está REALMENTE na tela ────────────────────────────────────
   A casca desenha a mesma tela duas vezes — um corpo de computador e um de
   celular — e esconde a que não vale por CSS. Então todo `id` existe em
   duplicata, e `getElementById` devolve sempre a primeira, a de computador.
   No celular isso significa escrever numa caixa invisível: o texto digitado
   nunca chegava ao envio, e "Escreva uma mensagem antes de enviar" aparecia
   com a mensagem escrita na tela. Mesmo critério de largura que a casca usa
   para decidir onde devolver o foco. */
function visivel(id) {
  const todos = [...document.querySelectorAll(`[id="${id}"]`)];
  return todos.find(e => e.getBoundingClientRect().width > 0) || todos[0] || null;
}

const casaBusca = (t, campos) => !t || campos.some(v => (v || '').toLowerCase().includes(t));

/* ── Quem rola, afinal ──────────────────────────────────────────────────────
   No computador quem rola é a lista de mensagens (`.crm-thread-body`). No
   CELULAR não: o CSS dá `overflow:visible` a ela dentro de
   `@media(max-width:767px)`, e quem rola é a casca do app (`#mobileBody`).

   A primeira versão fotografava só `.crm-thread-body`. No computador
   funcionava; no celular — que é onde se atende WhatsApp — `scrollTop` era
   sempre 0, e como a casca troca o `innerHTML` a cada redesenho, o navegador
   jogava a pessoa para o topo da página a cada dez segundos, no meio da
   leitura. Por isso as duas cascas entram na lista. */
/* A chave é `#id` para as cascas (que sobrevivem ao redesenho, só o conteúdo
   delas muda) e a POSIÇÃO para as listas de mensagens (que são elementos
   novos a cada redesenho — guardar a referência daria um elemento morto). */
function rolaveis() {
  const lista = [...document.querySelectorAll('.crm-thread-body')]
    .map((el, i) => ({ chave: i, el }));
  for (const id of ['mainBody', 'mobileBody']) {
    const el = document.getElementById(id);
    if (el) lista.push({ chave: '#' + id, el });
  }
  return lista;
}

/* ── 25/09: a lista da esquerda guarda a posição em QUALQUER redesenho ─────
   O Alisson abria o 30º da Fila e a lista voltava para o topo: todo clique
   numa conversa reconstrói a tela inteira, e a lista nasce de novo rolada
   no zero. Com 48 esperando, atender em ordem virava rolar tudo de novo a
   cada conversa.

   Não entra em `rolaveis()` de propósito. Lá a regra é "sem foto, vai para o
   fim", que é a certa para as mensagens (conversa abre na última) e errada
   para uma lista. E lá a foto só é tirada no redesenho do temporizador; aqui
   ela precisa valer também para o clique, que é justamente o caso relatado.

   A foto só é devolvida se a tela continua mostrando a MESMA lista (mesma
   aba, caixa, busca e filtro de resolvidas). Trocou de aba, é outra lista:
   começa do topo, como deve. */
let _chaveListaNaTela = null;
let _rolagemLista = null;

const chaveDaLista = () =>
  [_verResolvidas ? 'resolvidas' : _aba, _caixaAtiva, _busca.trim().toLowerCase()].join('|');

function fotografarLista() {
  const topos = [...document.querySelectorAll('.crm-lista-rolavel')].map(el => el.scrollTop);
  _rolagemLista = topos.length ? { chave: _chaveListaNaTela, topos } : null;
  _chaveListaNaTela = chaveDaLista();
}

function devolverLista() {
  const foto = _rolagemLista;
  _rolagemLista = null;
  if (!foto || foto.chave !== _chaveListaNaTela) return;
  document.querySelectorAll('.crm-lista-rolavel')
    .forEach((el, i) => { if (foto.topos[i]) el.scrollTop = foto.topos[i]; });
}

function fotografarRolagem() {
  return rolaveis().map(({ chave, el }) => ({
    chave,
    topo: el.scrollTop,
    /* 80px de folga: ninguém para a rolagem no pixel exato do fim, e quem
       está a um dedo do fim quer continuar acompanhando. */
    noFim: (el.scrollHeight - el.scrollTop - el.clientHeight) < 80
  }));
}

function devolverRolagem() {
  const antes = _rolagemAntes;
  _rolagemAntes = null;
  for (const { chave, el } of rolaveis()) {
    const foto = antes?.find(f => f.chave === chave);
    /* Sem foto (primeira pintura, ou redesenho que não veio do temporizador)
       ou estando no fim: vai para a mensagem mais nova. É o comportamento de
       sempre, e é o certo — a conversa abre na última mensagem. */
    if (!foto || foto.noFim) el.scrollTop = el.scrollHeight;
    else el.scrollTop = foto.topo;
  }
}

export async function render(params = {}) {
  const [caixas, conversas, contatos, respostas] = await Promise.all([
    dados.listar('crm_caixas'),
    dados.listar('crm_conversas'),
    dados.listar('crm_contatos'),
    /* Falhar aqui não pode derrubar a tela: sem respostas rápidas, a pessoa
       continua atendendo — só o "/" fica vazio. */
    dados.respostasRapidas?.().catch(() => []) ?? []
  ]);
  _respostas = respostas || [];

  const varios = caixas.length > 1;
  const daCaixa   = (c) => _caixaAtiva === 'todas' || c.caixa_id === _caixaAtiva;
  const resolvida = (c) => c.estado === 'resolvida';

  const minhas = conversas.filter(daCaixa);
  /* As três listas saem de UM critério só, e ele é o que a pessoa vê:
     tem responsável = está sendo atendida; não tem = está esperando alguém.
     `estado` não entra aqui de propósito — quem responde vira responsável
     (ver `enviarMensagem` em dados.js), então os dois nunca divergem. */
  const emAtendimento = minhas.filter(c => !resolvida(c) && c.responsavel);
  /* 26/09: "Minhas" compara pelo id da pessoa; o nome só entra quando não há
     id (dados de demonstração). */
  const eu = sessao.usuario() || {};
  const ehMinha = (c) => (c.responsavel_id && eu.id) ? c.responsavel_id === eu.id : (!!c.responsavel && c.responsavel === eu.nome);
  const minhasEmAtendimento = emAtendimento.filter(ehMinha);
  /* Fila: quem espera há mais tempo aparece em primeiro, como qualquer fila
     do mundo. A lista geral vem ordenada da mais recente para a mais antiga,
     então aqui ela é invertida. */
  const naFila = minhas.filter(c => !resolvida(c) && !c.responsavel).slice().reverse();
  const resolvidas = minhas.filter(resolvida);

  const t = _busca.trim().toLowerCase();
  const filtraConversas = (l) => l.filter(c => casaBusca(t, [c.nome, c.empresa, c.previa, c.telefone]));

  let lista;
  if (_verResolvidas)       lista = filtraConversas(resolvidas);
  else if (_aba === 'fila') lista = filtraConversas(naFila);
  else                      lista = filtraConversas(_dono === 'minhas' ? minhasEmAtendimento : emAtendimento);

  /* Qual conversa fica aberta à direita.
     Regra: continua aberta enquanto existir e pertencer à caixa selecionada —
     inclusive enquanto a pessoa navega pelos Contatos ou digita na busca, que
     é como qualquer atendimento funciona. Só duas coisas a fecham: ela ter
     sido resolvida (e não estarmos vendo as resolvidas) ou ter sumido. */
  /* 26/09 (v196) — DEFEITO CORRIGIDO: o `id` que chega pela navegação
     (ex.: botão de conversa na tela Contatos → "ir:crm-conversas:<id>")
     ficava guardado em `_paramsAtuais` e voltava em TODO redesenho. Quem
     entrava por ali não conseguia abrir outra conversa: o clique trocava e o
     redesenho seguinte (ou o automático, dez segundos depois) puxava de volta.
     O pedido vale uma vez; depois quem manda é o clique. */
  if (params.conversa) { _conversaAtiva = params.conversa; params.conversa = null; }
  if (params.id)       { _conversaAtiva = params.id;       params.id = null; }
  let atual = minhas.find(c => c.id === _conversaAtiva) || null;
  if (atual && resolvida(atual) && !_verResolvidas) atual = null;
  if (!atual && _aba !== 'contatos') atual = lista[0] || null;
  _conversaAtiva = atual ? atual.id : null;
  if (_modoDaConversa !== _conversaAtiva) { _modo = 'responder'; _modoDaConversa = _conversaAtiva; }

  /* 18/09: quantas não-lidas a conversa ABERTA ainda carrega.
     `depois()` usa isto para zerar o contador — ver `marcarAbertaComoLida()`.
     Fica guardado aqui porque `depois()` não recebe os dados, só o DOM. */
  _naoLidasDaAberta = atual?.nao_lidas || 0;

  const contato = contatos.find(c => c.id === atual?.contato_id);
  /* Mensagens e lead vinculado: sempre da conversa aberta, nunca em bloco —
     mesmo motivo de `mensagensDaConversa` ser por-conversa em dados.js. */
  const msgs = atual ? await dados.mensagensDaConversa(atual.id) : [];
  const lead = atual?.lead_id ? await dados.obter('crm_leads', atual.lead_id).catch(() => null) : null;

  const listaContatos = contatos.filter(c => casaBusca(t, [c.nome, c.empresa, c.cargo, c.telefone]));

  /* Ficha do contato: empresas, negócios e atividades só são lidos com ela
     ABERTA. A tela se redesenha a cada dez segundos; buscar isso sempre, para
     um painel fechado, seria trabalho à toa. */
  let extraFicha = null;
  if (_fichaAberta && atual) {
    const [clientes, leadsContato, ativs] = await Promise.all([
      dados.clientes().catch(() => []),
      contato ? dados.listar('crm_leads', { contato_id: contato.id, funil_id: null }).catch(() => []) : [],
      dados.listar('crm_atividades').catch(() => [])
    ]);
    const atividades = ativs
      .filter(a => !a.concluida && (
        (contato && a.alvo_tipo === 'contato' && a.alvo_id === contato.id) ||
        (atual.lead_id && a.lead_id === atual.lead_id)))
      .sort((a, b) => String(a.quando || '9').localeCompare(String(b.quando || '9')))
      .slice(0, 4);
    const etiquetasOrg = [...new Set(contatos.flatMap(k => k.etiquetas || []))].sort((a, b) => a.localeCompare(b));
    extraFicha = { clientes, leads: leadsContato, atividades, etiquetasOrg, contatos };
  }

  /* ── A fotografia é tirada AQUI, e não no temporizador ────────────────────
     Escrita primeiro lá, antes do `await`. Errado, e `navegacao.js` já
     documenta exatamente esse erro (h38): `render()` consulta o banco e leva
     centenas de milissegundos, e nesse intervalo a pessoa continua digitando
     na tela ANTIGA. A foto tirada antes do await é uma foto velha — devolvê-la
     depois faria o campo voltar algumas letras atrás a cada dez segundos.

     Aqui é o último instante síncrono antes de a casca trocar o HTML: o que
     está na tela agora é o que vai ser devolvido. */
  if (_emAtualizacaoAutomatica) {
    _emAtualizacaoAutomatica = false;
    const campoAgora = visivel('crmComposerTexto');
    _rascunhoAntes = campoAgora ? { conversa: _conversaAtiva, texto: campoAgora.value } : null;
    _rolagemAntes = fotografarRolagem();
  }
  fotografarLista();
  if (fichaSuja()) {
    const f = fichaVisivel();
    _fichaRascunho = { conversa: f.dataset.conversa, contato: f.dataset.contato || '', valores: lerFicha() };
  }

  return `
    <div class="crm-inbox wa ${varios ? '' : 'um-numero'} ${_fichaAberta ? 'com-ficha' : ''}"
         id="crmConversasVivo">
      ${varios ? chipsCelular(caixas, conversas) : ''}
      ${varios ? trilhoCaixas(caixas, conversas) : ''}
      ${colunaLista({
        lista, listaContatos, caixas, varios,
        nChats: emAtendimento.length, nFila: naFila.length, nResolvidas: resolvidas.length,
        nMinhas: minhasEmAtendimento.length
      })}
      <div class="crm-mob-sep">${icone('chevrondown','sm')} Ao tocar em uma conversa</div>
      ${atual ? colunaConversa(atual, caixas, varios, contato, msgs) : semConversa()}
      ${atual ? colunaContexto(atual, contato, lead, extraFicha, caixas) : ''}
    </div>
    ${dados.ehExemplo() ? avisoDemo() : ''}`;
}

/* ── trilho de caixas (só com mais de um número) ────────────────────────── */
function trilhoCaixas(caixas, conversas) {
  const naoLidas = (id) => conversas.filter(c => (id === 'todas' || c.caixa_id === id) && c.nao_lidas > 0).length;
  const linha = (id, nome, ic, cor) => `
    <div class="crm-caixa ${_caixaAtiva === id ? 'ativa' : ''}" data-acao="crm:caixa:${id}">
      <span ${cor ? `style="color:${cor}"` : ''}>${icone(ic,'sm')}</span>
      <span class="crm-caixa-nome">${ui.esc(nome)}</span>
      <span class="crm-caixa-n ${naoLidas(id) ? '' : 'zero'}">${naoLidas(id)}</span>
    </div>`;

  const unidades = caixas.filter(c => /filial|unidade/i.test(c.nome));
  const setores  = caixas.filter(c => !unidades.includes(c));
  const ic = (c) => c.estado === 'desconectado' ? 'wifioff' : c.estado === 'aguardando_qr' ? 'qr' : 'chat';
  const cor = (c) => c.estado === 'conectado' ? '' : 'var(--atencao)';

  return `
    <div class="crm-col crm-caixas">
      <div class="crm-col-head"><div class="crm-col-lbl">Caixas</div></div>
      <div class="crm-col-body" style="padding:8px 0">
        ${linha('todas','Todas','inbox')}
        ${setores.map(c => linha(c.id, c.nome, ic(c), cor(c))).join('')}
        ${unidades.length ? `<div style="margin:14px 12px 8px;padding-top:12px;border-top:1px solid var(--border)">
          <div class="crm-col-lbl">Unidades</div></div>
          ${unidades.map(c => linha(c.id, c.nome, ic(c), cor(c))).join('')}` : ''}
        <div style="padding:14px 12px"><div style="font-size:var(--fs-2);color:var(--text-3);line-height:1.6">
          O ícone de sinal cortado indica número desconectado; o de QR, número aguardando leitura do código.</div></div>
      </div>
    </div>`;
}

function chipsCelular(caixas, conversas) {
  const n = (id) => conversas.filter(c => (id === 'todas' || c.caixa_id === id) && c.nao_lidas > 0).length;
  return `<div class="crm-mob-caixas">
    <span class="crm-mob-caixa ${_caixaAtiva === 'todas' ? 'ativa' : ''}" data-acao="crm:caixa:todas">Todas ${n('todas') ? `<span class="n">${n('todas')}</span>` : ''}</span>
    ${caixas.map(c => `<span class="crm-mob-caixa ${_caixaAtiva === c.id ? 'ativa' : ''}" data-acao="crm:caixa:${c.id}">${ui.esc(c.nome)} ${n(c.id) ? `<span class="n">${n(c.id)}</span>` : ''}</span>`).join('')}
  </div>`;
}

/* ── coluna da esquerda: busca, abas e a lista da aba ───────────────────── */
function colunaLista({ lista, listaContatos, caixas, varios, nChats, nFila, nResolvidas, nMinhas = 0 }) {
  const aba = (id, rotulo, ic, n) => `
    <button class="crm-aba ${_aba === id && !_verResolvidas ? 'ativa' : ''}" data-acao="crm:aba:${id}">
      ${icone(ic,'sm')}<span>${rotulo}</span>${n ? `<span class="crm-aba-n">${n}</span>` : ''}
    </button>`;

  return `
  <div class="crm-col">
    <div class="crm-col-head">
      <div class="crm-busca-linha">
        <div class="ds-busca" style="max-width:none;margin:0;flex:1">${icone('search','sm')}
          <input type="search" placeholder="Pesquisar por nome ou número" value="${ui.esc(_busca)}" data-acao="crm:buscar-conversa"></div>
        <button class="crm-filtro ${_verResolvidas ? 'ativo' : ''}" data-acao="crm:ver-resolvidas"
          title="${_verResolvidas ? 'Voltar para as conversas abertas' : 'Ver conversas resolvidas'}">${icone('filter','sm')}</button>
      </div>
      <div class="crm-abas">
        ${aba('chats','Chats','chat', nChats)}
        ${aba('fila','Fila','inbox', nFila)}
        ${aba('contatos','Contatos','users', 0)}
      </div>
      ${_verResolvidas ? `<div class="crm-aviso-filtro">
        ${icone('check','sm')} Mostrando ${nResolvidas} resolvida${nResolvidas === 1 ? '' : 's'} ·
        <span data-acao="crm:ver-resolvidas" style="cursor:pointer;text-decoration:underline">voltar</span></div>` : ''}
    </div>
    ${_aba === 'chats' && !_verResolvidas ? `
    <div class="crm-dono">
      <span class="crm-mob-caixa ${_dono === 'minhas' ? 'ativa' : ''}" data-acao="crm:dono:minhas">Minhas <span class="n">${nMinhas}</span></span>
      <span class="crm-mob-caixa ${_dono === 'todas' ? 'ativa' : ''}" data-acao="crm:dono:todas">Todas <span class="n">${nChats}</span></span>
    </div>` : ''}
    <div class="crm-col-body crm-lista-rolavel">
      ${_aba === 'contatos' && !_verResolvidas ? listaDeContatos(listaContatos) : listaDeConversas(lista, caixas, varios)}
    </div>
  </div>`;
}

function listaDeConversas(lista, caixas, varios) {
  if (!lista.length) return vazioDaLista();
  const naFila = _aba === 'fila' && !_verResolvidas;
  return lista.map((c, i) => {
    const cx = caixas.find(x => x.id === c.caixa_id);
    return `<div class="crm-conv ${c.id === _conversaAtiva ? 'ativa' : ''}" data-acao="crm:conversa:${c.id}">
      ${naFila ? `<span class="crm-fila-pos" title="Posição na fila">${i + 1}</span>` : ''}
      <div class="crm-conv-av" style="background:rgba(30,42,74,.08);color:var(--navy)">${ui.fmt.iniciais(c.nome)}</div>
      <div class="crm-conv-main">
        <div class="crm-conv-top"><span class="crm-conv-nome">${ui.esc(c.nome)}</span><span class="crm-conv-hora">${c.hora}</span></div>
        <div class="crm-conv-prev">${ui.esc(c.previa)}</div>
        <div class="crm-conv-meta">
          ${c.estado === 'resolvida' ? `<span class="crm-tag-resolvida">${icone('check','sm')} Resolvida</span>` : ''}
          ${varios && cx ? `<span class="crm-tag-caixa"><i></i> ${ui.esc(cx.nome)}</span>` : ''}
          ${c.empresa ? ui.selo(c.empresa, 'neutro') : ''}
          ${!naFila && c.responsavel ? `<span class="crm-tag-dono">${ui.esc(c.responsavel)}</span>` : ''}
        </div>
      </div>
      ${c.nao_lidas ? `<span class="crm-conv-nao">${c.nao_lidas}</span>` : ''}
    </div>`;
  }).join('');
}

/* ── Contatos: a agenda, e o caminho para puxar assunto ────────────────────
   Esta aba é a resposta para "não tem botão de chamar uma conversa nova".
   Clicar num contato abre a conversa com ele — criando-a, se ainda não
   existir. "Criar novo" é para quem ainda não está na agenda. */
function listaDeContatos(contatos) {
  const criar = `
    <div class="crm-criar" data-acao="crm:nova-conversa">
      <span>Criar novo</span>
      <span class="crm-criar-mais">${icone('plus','sm')}</span>
    </div>`;

  if (!contatos.length) {
    return criar + ui.vazio(_busca
      ? { icone:'search', titulo:`Nenhum contato para "${_busca}"`,
          sub:'Use "Criar novo" para falar com um número que ainda não está na agenda.' }
      : { icone:'users', titulo:'Nenhum contato cadastrado',
          sub:'Use "Criar novo" para começar uma conversa por número.' });
  }

  return criar + contatos.map(c => `
    <div class="crm-conv" data-acao="crm:conversar:${c.id}">
      <div class="crm-conv-av" style="background:rgba(30,42,74,.08);color:var(--navy)">${ui.fmt.iniciais(c.nome)}</div>
      <div class="crm-conv-main">
        <div class="crm-conv-top"><span class="crm-conv-nome">${ui.esc(c.nome)}</span></div>
        <div class="crm-conv-prev">${c.telefone ? ui.fmt.telefone(c.telefone) : 'sem telefone cadastrado'}${c.empresa ? ' · ' + ui.esc(c.empresa) : ''}</div>
      </div>
      <span class="crm-conv-ir" title="Abrir conversa">${icone('chat','sm')}</span>
    </div>`).join('');
}

/* Tela vazia com a razão certa — a lista vazia precisa dizer POR QUE está
   vazia, senão parece defeito. */
function vazioDaLista() {
  if (_busca) return ui.vazio({ icone:'search', titulo:`Nada encontrado para "${_busca}"`,
    sub:'Tente outro nome, telefone ou trecho da mensagem.' });
  if (_verResolvidas) return ui.vazio({ icone:'check', titulo:'Nenhuma conversa resolvida ainda' });
  if (_aba === 'fila') return ui.vazio({ icone:'inbox', titulo:'Fila vazia',
    sub:'Ninguém esperando. Quando chegar mensagem de alguém novo, ela entra aqui.' });
  if (_dono === 'minhas') return ui.vazio({ icone:'chat', titulo:'Nenhuma conversa com você agora',
    sub:'As da equipe estão em "Todas". O que chega fica na Fila até alguém assumir.' });
  return ui.vazio({ icone:'chat', titulo:'Nenhuma conversa em atendimento',
    sub:'O que chega fica em Fila até alguém assumir. Para puxar assunto, use a aba Contatos.' });
}

function semConversa() {
  return `<div class="crm-col crm-thread crm-thread-vazia">
    ${ui.vazio({ icone:'chat', titulo:'Selecione uma conversa',
      sub:'Escolha alguém na lista ao lado — ou abra a aba Contatos para começar uma conversa nova.' })}
  </div>`;
}

/* ── divisor de dia ─────────────────────────────────────────────────────────
   Até 13/09 a tela escrevia "Hoje" fixo acima de tudo — mensagem de semana
   passada aparecia como se fosse de agora. Informação errada na tela é pior
   do que informação nenhuma. */
function rotuloDia(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const mesmoDia = (a, b) => a.toDateString() === b.toDateString();
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);
  if (mesmoDia(d, hoje))  return 'Hoje';
  if (mesmoDia(d, ontem)) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
}

/* ── Estado de entrega, dito com honestidade (14/09, 2ª correção) ──────────
   Isto mostrava ✓✓ — os dois tiques do WhatsApp, que para qualquer pessoa
   significam "chegou no celular da outra pessoa". E não é isso que a gente
   sabe. O que a gente sabe é que o WhatsApp ACEITOU a mensagem do gateway;
   se ela foi entregue de verdade, ninguém aqui confirmou.

   A diferença apareceu no pior jeito possível: o Alisson mandou "oi", a tela
   mostrou ✓✓, e a mensagem não chegou no outro celular dele. A tela estava
   prometendo mais do que o sistema tinha como garantir.

   Agora é um tique só, com o texto certo. No dia em que o gateway passar a
   ouvir a confirmação de entrega do WhatsApp (`messages.update`), aí sim
   caberá o segundo tique — e ele vai querer dizer alguma coisa.

   25/09 (PASSO-54): esse dia chegou. O gateway ouve `messages.update` e o
   banco só grava "entregue"/"lida" quando o WhatsApp confirma. As mensagens
   antigas que tinham "entregue" sem confirmação voltaram para "ok" no próprio
   PASSO-54 — o ✓✓ daqui em diante é sempre verdade. */
function tiqueEntrega(m) {
  if (m.tipo !== 'enviada') return '';
  const s = String(m.status || '').toLowerCase();
  if (s === 'pendente') return `<span class="crm-tique" title="Na fila — sai em instantes">◷</span>`;
  if (s === 'erro' || s === 'falha' || s === 'falhou') {
    return `<span class="crm-tique erro" title="${ui.esc(m.erro || 'Não foi possível enviar')}">!</span>`;
  }
  if (s === 'lida')     return `<span class="crm-tique lida" title="Lida pelo cliente">✓✓</span>`;
  if (s === 'entregue') return `<span class="crm-tique ok" title="Entregue no celular do cliente">✓✓</span>`;
  return `<span class="crm-tique ok" title="Enviada ao WhatsApp">✓</span>`;
}

/* ── anexos (15/09) ───────────────────────────────────────────────────────
   Foto abre, áudio toca, documento baixa. Cada família precisa do seu próprio
   elemento: um PDF dentro de <img> não mostra nada, e um áudio como link
   obriga a baixar para ouvir uma frase de oito segundos.

   Quando o endereço temporário não veio (`url` nula), o anexo aparece assim
   mesmo, com o nome e sem o link. Sumir com a mensagem porque o arquivo não
   pôde ser liberado seria repetir, do lado da tela, o defeito que passamos o
   dia consertando do lado do gateway. */
function tamanhoLegivel(bytes) {
  if (!bytes) return '';
  return bytes >= 1048576
    ? `${(bytes / 1048576).toFixed(1).replace('.', ',')} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function anexoNaBolha(a) {
  const nome = ui.esc(a.nome || 'arquivo');
  if (!a.url) {
    return `<div class="crm-anexo-erro">${icone('clip','sm')} ${nome}
      <span>não foi possível abrir este arquivo agora</span></div>`;
  }
  if (a.tipo === 'imagem') {
    return `<a class="crm-anexo-img" href="${ui.esc(a.url)}" target="_blank" rel="noopener"
              title="Abrir imagem"><img src="${ui.esc(a.url)}" alt="${nome}" loading="lazy"></a>`;
  }
  if (a.tipo === 'audio') {
    return `<audio class="crm-anexo-audio" controls preload="none" src="${ui.esc(a.url)}"></audio>`;
  }
  if (a.tipo === 'video') {
    return `<video class="crm-anexo-video" controls preload="metadata" src="${ui.esc(a.url)}"></video>`;
  }
  return `<a class="crm-anexo-doc" href="${ui.esc(a.url)}" target="_blank" rel="noopener" download="${nome}">
    ${icone('doc','sm')}<span class="n">${nome}</span><span class="t">${tamanhoLegivel(a.bytes)}</span></a>`;
}

/* ── conversa ───────────────────────────────────────────────────────────── */
function colunaConversa(c, caixas, varios, contato, msgs) {
  const cx = caixas.find(x => x.id === c.caixa_id);
  let diaCorrente = null;
  const linhas = msgs.map(m => {
    const dia = rotuloDia(m.criado_em);
    const divisor = dia && dia !== diaCorrente ? `<div class="crm-dia">${ui.esc(dia)}</div>` : '';
    if (dia) diaCorrente = dia;
    /* 26/09: nota interna — só a equipe vê, nunca foi para o cliente. */
    if (m.tipo === 'nota') return divisor + `
      <div class="crm-msg nota">
        <div class="crm-msg-aut">${icone('clipboard','sm')} Nota interna${m.autor ? ' · ' + ui.esc(m.autor) : ''}</div>
        <div class="crm-msg-txt">${ui.esc(m.texto || '')}</div>
        <span class="h">${m.hora || ''}</span></div>`;
    const corpo = m.tipo === 'sistema'
      ? `<div class="crm-msg sis">${ui.esc(m.texto)}</div>`
      : `<div class="crm-msg ${m.tipo === 'enviada' ? 'env' : 'rec'}">
           ${m.autor ? `<div class="crm-msg-aut">${ui.esc(m.autor)}</div>`
             /* 25/09: resposta dada pelo celular do número, trazida pela VPS.
                Sem autor no GRID — o rótulo diz de onde veio. */
             : m.peloCelular ? `<div class="crm-msg-aut">Pelo celular</div>` : ''}
           ${m.midia ? anexoNaBolha(m.midia) : ''}
           ${m.texto ? `<div class="crm-msg-txt">${ui.esc(m.texto)}</div>` : ''}
           ${/* O motivo da falha fica VISÍVEL na mensagem, não escondido num
                title que só aparece com o mouse parado em cima. Quem precisa
                dessa informação normalmente está no celular, onde title não
                existe. */''}
           ${m.erro ? `<div class="crm-msg-erro">${ui.esc(m.erro)}</div>` : ''}
           <span class="h">${m.hora || ''}${tiqueEntrega(m)}</span></div>`;
    return divisor + corpo;
  }).join('');

  /* Sem responsável = está na fila. O botão de assumir vem primeiro, porque é
     a única coisa que faz sentido fazer antes de responder. Responder também
     assume (ver dados.enviarMensagem) — o botão existe para quem quer marcar
     que pegou sem responder na hora. */
  const semDono = !c.responsavel;

  return `
  <div class="crm-col crm-thread">
    <div class="crm-thread-head">
      <div class="crm-conv-av" style="background:rgba(30,42,74,.08);color:var(--navy);width:34px;height:34px">${ui.fmt.iniciais(c.nome)}</div>
      ${/* 26/09: número, caixa e responsável numa linha só, embaixo do nome.
            Eram selos soltos no meio do topo, disputando espaço com os botões. */''}
      <div class="crm-thread-ident">
        <div class="nome">${ui.esc(c.nome)}</div>
        <div class="meta"><span class="num">${ui.fmt.telefone(contato?.telefone || c.telefone)}</span>
          ${cx ? `<span class="sep">•</span><span>${ui.esc(cx.nome)}</span>` : ''}
          <span class="sep">•</span>${semDono
            ? `<span style="color:var(--amber-text);font-weight:700">Na fila</span>`
            : `<span class="dono">com ${ui.esc(c.responsavel)}</span>`}</div>
      </div>
      <div class="crm-thread-acoes">
        ${semDono ? `<button class="ds-btn pri sm" data-acao="crm:assumir:${c.id}">${icone('user','sm')} Assumir</button>` : ''}
        <button class="ds-btn sec sm" data-acao="crm:transferir:${c.id}">${icone('team','sm')} Transferir</button>
        ${/* 26/09 (v196): Vincular saiu daqui e foi para a ficha do contato,
              na parte "Negócio" — é dado do relacionamento com a pessoa, não
              uma ação do atendimento. */''}
        ${/* Resolver aparece mesmo sem dono: mensagem errada, propaganda ou
              engano se fecha de uma vez, sem a pessoa ter de assumir antes
              algo que não vai atender. Com dono, ele é a ação principal; sem
              dono, quem manda na tela é "Assumir". */''}
        <button class="ds-btn ${semDono ? 'sec' : 'pri'} sm" data-acao="crm:resolver:${c.id}">${icone('check','sm')} Resolver</button>
        <button class="ds-btn sec sm crm-btn-ficha ${_fichaAberta ? 'ativo' : ''}" data-acao="crm:ficha"
          title="Ver e editar a ficha do contato">${icone('user','sm')} Contato</button>
      </div>
    </div>
    <div class="crm-thread-body">
      ${msgs.temMaisAntigas ? `<div class="crm-dia">Mostrando as 500 mensagens mais recentes</div>` : ''}
      ${linhas}
      ${msgs.length ? '' : ui.vazio({ icone:'chat', titulo:'Sem mensagens nesta conversa',
        sub:'Escreva abaixo para mandar a primeira.' })}
    </div>
    ${composer(c, contato)}
  </div>`;
}

/* ── campo de baixo: responder ou nota interna (26/09) ──────────────────────
   Os dois modos vivem no MESMO campo, trocados por duas abas. O modo nota
   pinta a caixa de âmbar, tira anexo/áudio/respostas (nota é texto para a
   equipe) e troca o botão de enviar pelo de salvar nota — é o botão que
   decide para onde o texto vai, e o Enter aperta o botão visível.

   O primeiro nome do contato fica no próprio elemento (`data-nome`): é ele
   que substitui {nome} quando uma resposta rápida entra no campo. */
function primeiroNome(nome) {
  const n = String(nome || '').trim();
  if (!n || /^[+\d\s().-]+$/.test(n)) return '';   // sem nome, só telefone
  return n.split(/\s+/)[0];
}

function menuRespostas() {
  const itens = _respostas.map(r => `
    <button class="crm-modelo resp" data-acao="crm:resposta:${ui.esc(r.id)}"
            data-busca="${ui.esc((r.atalho + ' ' + r.titulo).toLowerCase())}" data-atalho="${ui.esc(r.atalho)}">
      ${icone('doc','sm')} ${ui.esc(r.titulo)} <span class="atalho">/${ui.esc(r.atalho)}</span>
      <span class="prev">${ui.esc(r.texto)}</span></button>`).join('');
  return `
    <div class="crm-modelos respostas" id="crmModelos" hidden>
      ${itens || `<div class="crm-modelo" style="cursor:default;color:var(--text-3)">Nenhuma resposta rápida cadastrada.</div>`}
      <button class="crm-modelo" data-acao="ir:crm-respostas" style="color:var(--text-3);font-weight:600">${icone('settings','sm')} Gerenciar respostas rápidas</button>
    </div>`;
}

function composer(c, contato) {
  const nota = _modo === 'nota';
  return `
    <div class="crm-composer ${nota ? 'em-nota' : ''}" data-nome="${ui.esc(primeiroNome(contato?.nome || c.nome))}">
      ${menuRespostas()}
      <div class="crm-modo">
        <button class="${nota ? '' : 'ativa'}" data-acao="crm:modo:responder">Responder</button>
        <button class="${nota ? 'ativa nota' : ''}" data-acao="crm:modo:nota">Nota interna</button>
      </div>
      <div class="crm-composer-box">
        <div class="crm-composer-icos" ${nota ? 'hidden' : ''}>
          <button class="crm-cico" data-acao="crm:anexar:${c.id}" title="Anexar arquivo">${icone('clip','sm')}</button>
          <button class="crm-cico" id="crmMic" data-acao="crm:gravar:${c.id}" title="Gravar áudio">${icone('mic','sm')}</button>
          <button class="crm-cico" data-acao="crm:modelos" title="Respostas rápidas (ou digite /)">${icone('chat','sm')}</button>
        </div>
        <textarea id="crmComposerTexto" rows="1"
          placeholder="${textoCampo(nota)}"></textarea>
        <button class="crm-enviar" data-acao="${nota ? 'crm:nota:' : 'crm:enviar:'}${c.id}" data-id="${c.id}"
          title="${nota ? 'Salvar nota' : 'Enviar'}">${icone('send','sm')}</button>
      </div>
      <div class="crm-anexo-pendente" id="crmAnexoPendente" hidden></div>
      <div class="crm-composer-dica" ${nota ? '' : 'hidden'}>A nota fica na conversa para a equipe. <b>Não é enviada ao cliente.</b></div>
    </div>`;
}

/* Texto de apoio do campo. No celular cabe pouco: frase curta, como no WhatsApp. */
function textoCampo(nota) {
  if (sessao.ehCelular()) return nota ? 'Nota só para a equipe' : 'Mensagem';
  return nota ? 'Só a equipe vê. O cliente não recebe.' : 'Escreva a resposta · / para respostas rápidas';
}

/* Troca o modo sem redesenhar: redesenhar apagaria o que já foi digitado. */
function aplicarModo() {
  const nota = _modo === 'nota';
  document.querySelectorAll('.crm-composer').forEach(el => {
    el.classList.toggle('em-nota', nota);
    const [bResp, bNota] = el.querySelectorAll('.crm-modo button');
    if (bResp && bNota) {
      bResp.className = nota ? '' : 'ativa';
      bNota.className = nota ? 'ativa nota' : '';
    }
    const icos = el.querySelector('.crm-composer-icos'); if (icos) icos.hidden = nota;
    const dica = el.querySelector('.crm-composer-dica'); if (dica) dica.hidden = !nota;
    const campo = el.querySelector('textarea');
    if (campo) campo.placeholder = textoCampo(nota);
    const bot = el.querySelector('.crm-enviar');
    if (bot) {
      bot.dataset.acao = (nota ? 'crm:nota:' : 'crm:enviar:') + bot.dataset.id;
      bot.title = nota ? 'Salvar nota' : 'Enviar';
    }
    const menu = el.querySelector('.crm-modelos'); if (menu && nota) menu.hidden = true;
  });
}

/* ── o "/" das respostas rápidas ────────────────────────────────────────────
   Digitou "/" no começo do campo: abre o menu que já existia (o dos modelos),
   filtrando pelo atalho ou pelo título enquanto a pessoa digita. Setas
   escolhem, Enter ou Tab colocam o texto no campo — NÃO envia; a pessoa
   confere e envia. Esc fecha. */
function filtrarRespostas(campo) {
  const menu = campo.closest('.crm-composer')?.querySelector('.crm-modelos');
  if (!menu || _modo === 'nota') return false;
  const m = campo.value.match(/^\/([^\s]*)$/);
  if (!m) {
    if (menu.dataset.pelaBarra) { menu.hidden = true; delete menu.dataset.pelaBarra; }
    return false;
  }
  const termo = m[1].toLowerCase();
  const itens = [...menu.querySelectorAll('.crm-modelo.resp')];
  let primeiro = null;
  itens.forEach(b => {
    const ok = !termo || b.dataset.atalho.startsWith(termo) || b.dataset.busca.includes(termo);
    b.hidden = !ok;
    b.classList.remove('foco');
    if (ok && !primeiro) primeiro = b;
  });
  primeiro?.classList.add('foco');
  menu.hidden = false;
  menu.dataset.pelaBarra = '1';
  return true;
}

function moverFoco(menu, passo) {
  const vis = [...menu.querySelectorAll('.crm-modelo.resp')].filter(b => !b.hidden);
  if (!vis.length) return;
  const i = vis.findIndex(b => b.classList.contains('foco'));
  vis.forEach(b => b.classList.remove('foco'));
  const alvo = vis[(i + passo + vis.length) % vis.length];
  alvo.classList.add('foco');
  alvo.scrollIntoView({ block: 'nearest' });
}

/* ── Ficha do contato (v196, 26/09) ────────────────────────────────────────
   Painel ao lado da conversa para CONSULTAR E EDITAR o contato sem sair do
   atendimento. Não existe "cadastro da conversa": a ficha lê e grava a mesma
   linha de `contatos` que a tela Contatos usa (dados.salvarContato), então o
   que muda aqui aparece lá, e vice-versa.

   Os campos usam `name`, não `id`: a tela existe em duas cópias (computador
   e celular), e `id` repetido é a armadilha já documentada em acoes.js.
   Quem lê os valores é `lerFicha()`, sempre na cópia visível. */
function colunaContexto(c, contato, lead, x, caixas = []) {
  const ex = x || { clientes: [], leads: [], atividades: [], etiquetasOrg: [], contatos: [] };
  const cx = caixas.find(k => k.id === c.caixa_id);
  const nomeTela = contato?.nome || c.nome;
  const campo = (rotulo, html, extra = '') =>
    `<label class="crm-fc-campo ${extra}"><span>${rotulo}</span>${html}</label>`;
  const inp = (name, valor, attrs = '') =>
    `<input name="${name}" value="${ui.esc(valor || '')}" ${attrs}>`;

  const topo = `
    <div class="crm-ctx-topo">
      <span>Ficha do contato</span>
      <button class="ds-icobtn" data-acao="crm:ficha" title="Fechar">${icone('close','sm')}</button>
    </div>`;

  /* Conversa sem contato: depois do PASSO-57 é raro (só quando a empresa
     falou primeiro e o cliente ainda não respondeu). Cadastra ou liga a um
     contato que já existe — sem sair da conversa. */
  if (!contato) {
    const opcoes = (ex.contatos || []).slice(0, 500).map(k =>
      `<option value="${ui.esc(k.id)}">${ui.esc(k.nome)}${k.empresa ? ' · ' + ui.esc(k.empresa) : ''}${k.telefone ? ' · ' + ui.esc(ui.fmt.telefone(k.telefone)) : ''}</option>`).join('');
    return `
    <div class="crm-col crm-ctx crm-ficha" data-conversa="${ui.esc(c.id)}" data-contato="">
      ${topo}
      <div class="crm-ficha-rolo">
        <div class="crm-ctx-bloco">
          <div class="crm-fc-aviso">${icone('user','sm')} Esta conversa ainda não tem contato cadastrado.</div>
          ${campo('Nome *', inp('nome', c.nome_exibicao || (c.nome !== c.telefone ? c.nome : ''), 'maxlength="120" placeholder="Nome da pessoa"'))}
          ${campo('Telefone', inp('telefone', telefoneDaAgenda(c.telefone), 'placeholder="(47) 99999-0000"'))}
          ${campo('E-mail', inp('email', '', 'type="email" placeholder="nome@empresa.com.br"'))}
          ${campo('Empresa', seletorEmpresa(ex.clientes, null))}
          <input type="hidden" name="origem" value="WhatsApp">
          <button class="ds-btn pri sm crm-fc-largo" data-acao="crm:ficha-cadastrar:${ui.esc(c.id)}">${icone('plus','sm')} Cadastrar contato</button>
        </div>
        <div class="crm-ctx-bloco">
          <div class="crm-ctx-lbl">Ou ligar a um contato que já existe</div>
          ${campo('Contato', `<select name="existente"><option value="">Escolha…</option>${opcoes}</select>`)}
          <button class="ds-btn sec sm crm-fc-largo" data-acao="crm:ficha-ligar:${ui.esc(c.id)}">Ligar a esta conversa</button>
        </div>
        ${blocoAtendimento(c, cx)}
      </div>
    </div>`;
  }

  const etq = (contato.etiquetas || []);
  const zapDiferente = !!c.telefone && !!contato.telefone
    && String(contato.telefone).replace(/\D/g, '').slice(-8) !== String(c.telefone).replace(/\D/g, '').slice(-8);

  return `
  <div class="crm-col crm-ctx crm-ficha" data-conversa="${ui.esc(c.id)}" data-contato="${ui.esc(contato.id)}">
    ${topo}
    <div class="crm-ficha-rolo">
      <div class="crm-fc-cab">
        <div class="av">${ui.fmt.iniciais(nomeTela)}</div>
        <div class="id">
          <div class="n">${ui.esc(nomeTela)}</div>
          <div class="s">${ui.esc([contato.cargo, contato.empresa].filter(Boolean).join(' · ') || 'Sem cargo e sem empresa')}</div>
          <div class="selos">
            ${ui.selo(contato.cliente_id ? 'Cliente' : 'Lead', contato.cliente_id ? 'ok' : 'info')}
            ${contato.automatico ? ui.selo('Cadastrado pelo WhatsApp', 'neutro') : ''}
          </div>
        </div>
      </div>

      <div class="crm-ctx-bloco">
        <div class="crm-ctx-lbl">Dados do contato</div>
        ${campo('Nome *', inp('nome', contato.nome, 'maxlength="120"'))}
        <div class="crm-fc-duas">
          ${campo('Cargo', inp('cargo', contato.cargo, 'placeholder="Ex.: Compras"'))}
          ${campo('Telefone', inp('telefone', contato.telefone ? ui.fmt.telefone(contato.telefone) : '', 'placeholder="(47) 99999-0000"'))}
        </div>
        ${zapDiferente ? `<div class="crm-fc-dica">Esta conversa é pelo WhatsApp ${ui.esc(ui.fmt.telefone(c.telefone))}. O telefone acima é o da agenda.</div>` : ''}
        ${campo('E-mail', inp('email', contato.email, 'type="email" placeholder="nome@empresa.com.br"'))}
        <div class="crm-fc-duas">
          ${campo('Empresa', seletorEmpresa(ex.clientes, contato.cliente_id))}
          ${campo('Origem', inp('origem', contato.origem, 'placeholder="WhatsApp, Indicação..."'))}
        </div>
        ${campo('Etiquetas', `
          <div class="crm-etq" data-etq>
            ${etq.map((e, i) => chipEtiqueta(e, i)).join('')}
            <input class="crm-etq-novo" name="etq_novo" list="crmEtqSugestoes" maxlength="30"
              placeholder="${etq.length ? '+ etiqueta' : 'Digite e tecle Enter'}">
          </div>
          <datalist id="crmEtqSugestoes">${(ex.etiquetasOrg || []).map(e => `<option value="${ui.esc(e)}">`).join('')}</datalist>`, 'etq')}
        ${campo('Observações', `<textarea name="observacoes" rows="3" maxlength="4000"
          placeholder="O que a equipe precisa saber sobre esta pessoa">${ui.esc(contato.observacoes || '')}</textarea>`)}
      </div>

      ${blocoAtendimento(c, cx)}
      ${blocoNegocio(c, contato, lead, ex.leads)}
      ${blocoAtividades(contato, ex.atividades)}

      <div class="crm-fc-pe">
        <button class="crm-fc-link" data-acao="ir:crm-contatos:${ui.esc(contato.id)}">${icone('user','sm')} Ver na tela Contatos</button>
        <button class="crm-fc-link" data-acao="crm:ficha-trocar:${ui.esc(c.id)}">Não é esta pessoa? Trocar contato</button>
      </div>
    </div>
    <div class="crm-fc-salvar" hidden>
      <span>Alterações não salvas</span>
      <button class="ds-btn sec sm" data-acao="crm:ficha-descartar">Descartar</button>
      <button class="ds-btn pri sm" data-acao="crm:ficha-salvar:${ui.esc(contato.id)}">${icone('check','sm')} Salvar</button>
    </div>
  </div>`;
}

/* Mesmo formato que o PASSO-57 grava no cadastro automático: celular que o
   WhatsApp manda sem o nono dígito ganha o 9, e o DDI 55 sai. */
function telefoneDaAgenda(t) {
  let d = String(t || '').replace(/\D/g, '');
  if (/^55\d{2}[6-9]\d{7}$/.test(d)) d = d.slice(0, 4) + '9' + d.slice(4);
  if (/^55\d{11}$/.test(d)) return `(${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (/^55\d{10}$/.test(d)) return `(${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  return d ? '+' + d : '';
}

const chipEtiqueta = (e, i) =>
  `<span class="crm-etq-chip" data-v="${ui.esc(e)}">${ui.esc(e)}<button type="button" data-acao="crm:etq-tirar:${i}" title="Tirar etiqueta">${icone('close','sm')}</button></span>`;

function seletorEmpresa(clientes, sel) {
  return `<select name="cliente_id"><option value="">Ainda não é cliente</option>${
    (clientes || []).map(e => `<option value="${ui.esc(e.id)}" ${String(e.id) === String(sel) ? 'selected' : ''}>${ui.esc(e.nome)}</option>`).join('')}</select>`;
}

function blocoAtendimento(c, cx) {
  return `
    <div class="crm-ctx-bloco">
      <div class="crm-ctx-lbl">Atendimento</div>
      <div class="crm-fc-linha">
        <span class="k">Responsável</span>
        <span class="v">${c.responsavel ? ui.esc(c.responsavel) : '<span style="color:var(--amber-text)">Na fila</span>'}</span>
        <button class="crm-fc-link" data-acao="crm:transferir:${ui.esc(c.id)}">Transferir</button>
      </div>
      <div class="crm-fc-linha"><span class="k">Número</span><span class="v">${ui.esc(cx?.nome || '—')}</span></div>
      <div class="crm-fc-linha"><span class="k">WhatsApp</span><span class="v num">${ui.esc(ui.fmt.telefone(c.telefone))}</span></div>
    </div>`;
}

function blocoNegocio(c, contato, lead, leads) {
  const outros = (leads || []).filter(l => l.id !== lead?.id && !['perdido'].includes(l.estagio));
  const cartao = lead ? `
      <div class="crm-lead-card crm-fc-lead" data-acao="ir:crm-lead:${ui.esc(lead.id)}">
        <div class="crm-lead-emp">${ui.esc(lead.item || lead.treinamento || lead.empresa || 'Negócio')}${lead.vagas ? ' — ' + lead.vagas + ' vagas' : ''}</div>
        <div class="crm-lead-meta"><span>${icone('funnel','sm')} ${ui.esc(lead.empresa || '')} · ${ui.esc(lead.estagio || '')}</span>
          <span>${icone('user','sm')} ${ui.esc(lead.responsavel || 'sem responsável')}</span></div>
        <div class="crm-lead-rod"><span class="crm-lead-val">${ui.fmt.moeda(lead.valor)}</span></div>
      </div>
      <div class="crm-fc-acoes">
        <button class="crm-fc-link" data-acao="crm:vincular:${ui.esc(c.id)}">Trocar negócio</button>
        <button class="crm-fc-link" data-acao="crm:ficha-desvincular-lead:${ui.esc(c.id)}">Desvincular</button>
      </div>` : `
      <div class="crm-fc-vazio">Nenhum negócio ligado a esta conversa.</div>
      <div class="crm-fc-acoes">
        <button class="ds-btn sec sm" data-acao="crm:vincular:${ui.esc(c.id)}">${icone('funnel','sm')} Vincular negócio</button>
        <button class="ds-btn sec sm" data-acao="crm:ficha-novo-negocio:${ui.esc(c.id)}">${icone('plus','sm')} Novo negócio</button>
      </div>`;
  return `
    <div class="crm-ctx-bloco">
      <div class="crm-ctx-lbl">Negócio</div>
      ${cartao}
      ${outros.length ? `<div class="crm-fc-sub">Outros negócios de ${ui.esc((contato.nome || '').split(' ')[0])}</div>
        ${outros.slice(0, 4).map(l => `<button class="crm-fc-item" data-acao="ir:crm-lead:${ui.esc(l.id)}">
          <span>${ui.esc(l.item || l.treinamento || l.empresa)}</span><span class="k">${ui.esc(l.estagio || '')} · ${ui.fmt.moeda(l.valor)}</span></button>`).join('')}` : ''}
    </div>`;
}

function blocoAtividades(contato, atividades) {
  const quando = (a) => a.quando ? `${ui.fmt.data(a.quando)} ${ui.fmt.hora(a.quando)}` : 'sem data';
  return `
    <div class="crm-ctx-bloco">
      <div class="crm-ctx-lbl">Próximas atividades</div>
      ${(atividades || []).length ? atividades.map(a => `
        <button class="crm-fc-item" data-acao="crm:atividade:${ui.esc(a.id)}">
          <span>${ui.esc(a.titulo || a.assunto || 'Atividade')}</span>
          <span class="k">${quando(a)}${a.responsavel ? ' · ' + ui.esc(a.responsavel) : ''}</span>
        </button>`).join('') : `<div class="crm-fc-vazio">Nada agendado com esta pessoa.</div>`}
      <div class="crm-fc-acoes">
        <button class="ds-btn sec sm" data-acao="crm:nova-atividade-contato:${ui.esc(contato.id)}">${icone('plus','sm')} Nova atividade</button>
      </div>
    </div>`;
}

/* ── Leitura e estado da ficha (usados também por acoes.js) ─────────────── */
/* `offsetParent` não serve aqui: no celular a ficha é `position:fixed`, e
   elemento fixo sempre tem offsetParent nulo. `getClientRects()` só vem vazio
   quando a cópia está com display:none (a outra casca). */
const naTela = (el) => !!el && el.getClientRects().length > 0;
export function fichaVisivel() {
  if (typeof document === 'undefined') return null;
  return [...document.querySelectorAll('.crm-ficha')].find(naTela) || null;
}
export const fichaSuja = () => fichaVisivel()?.dataset.suja === '1';

export function lerFicha() {
  const f = fichaVisivel();
  if (!f) return null;
  const v = (n) => (f.querySelector(`[name="${n}"]`)?.value ?? '').trim();
  const etiquetas = [...f.querySelectorAll('.crm-etq-chip')].map(x => x.dataset.v);
  const pendente = v('etq_novo');           // digitou e não teclou Enter: entra assim mesmo
  if (pendente && !etiquetas.some(e => e.toLowerCase() === pendente.toLowerCase())) etiquetas.push(pendente);
  return { nome: v('nome'), cargo: v('cargo'), telefone: v('telefone'), email: v('email'),
           cliente_id: v('cliente_id') || null, origem: v('origem'), observacoes: v('observacoes'),
           etiquetas, existente: v('existente') || null };
}

function marcarSuja(f, suja = true) {
  if (!f) return;
  f.dataset.suja = suja ? '1' : '0';
  const barra = f.querySelector('.crm-fc-salvar');
  if (barra) barra.hidden = !suja;
}
/* Depois de salvar: a ficha deixa de estar "suja" ANTES do redesenho, senão
   a foto do redesenho devolveria os campos e a barra de salvar voltaria. */
export function marcarFichaLimpa() {
  document.querySelectorAll('.crm-ficha').forEach(f => marcarSuja(f, false));
  _fichaRascunho = null;
}
/* O próximo desenho guarda rascunho da mensagem e rolagem, como o automático. */
export function preservarNoProximoDesenho() { _emAtualizacaoAutomatica = true; }

function adicionarEtiqueta(f, texto) {
  const t = String(texto || '').replace(/\s+/g, ' ').trim().slice(0, 30);
  if (!t) return;
  const caixa = f.querySelector('[data-etq]');
  const atuais = [...caixa.querySelectorAll('.crm-etq-chip')].map(x => x.dataset.v.toLowerCase());
  if (atuais.includes(t.toLowerCase())) return;
  if (atuais.length >= 12) { (window.__GRID_PONTE?.avisar || (() => {}))('Até 12 etiquetas por contato.', 'error'); return; }
  const novo = caixa.querySelector('.crm-etq-novo');
  novo.insertAdjacentHTML('beforebegin', chipEtiqueta(t, atuais.length));
  renumerarEtiquetas(caixa);
  marcarSuja(f);
}
function renumerarEtiquetas(caixa) {
  caixa.querySelectorAll('.crm-etq-chip button').forEach((b, i) => { b.dataset.acao = `crm:etq-tirar:${i}`; });
}

/* Liga os eventos da ficha. Roda a cada desenho (o HTML é novo a cada vez). */
function ligarFicha() {
  document.querySelectorAll('.crm-ficha').forEach(f => {
    // devolve o que foi digitado e não salvo, se for a mesma conversa e o mesmo contato
    if (_fichaRascunho && naTela(f)
        && _fichaRascunho.conversa === f.dataset.conversa && _fichaRascunho.contato === (f.dataset.contato || '')) {
      const r = _fichaRascunho.valores || {};
      for (const k of ['nome','cargo','telefone','email','cliente_id','origem','observacoes','existente']) {
        const el = f.querySelector(`[name="${k}"]`);
        if (el && r[k] != null) el.value = r[k];
      }
      const caixa = f.querySelector('[data-etq]');
      if (caixa && Array.isArray(r.etiquetas)) {
        caixa.querySelectorAll('.crm-etq-chip').forEach(x => x.remove());
        const novo = caixa.querySelector('.crm-etq-novo');
        r.etiquetas.forEach((e, i) => novo.insertAdjacentHTML('beforebegin', chipEtiqueta(e, i)));
      }
      marcarSuja(f);
    }
    f.addEventListener('input', (ev) => {
      if (ev.target.name === 'etq_novo' || ev.target.name === 'existente') return;
      marcarSuja(f);
    });
    f.addEventListener('change', (ev) => {
      if (ev.target.name === 'existente') return;
      if (ev.target.name === 'etq_novo') { adicionarEtiqueta(f, ev.target.value); ev.target.value = ''; return; }
      marcarSuja(f);
    });
    const novo = f.querySelector('.crm-etq-novo');
    novo?.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ',') {
        ev.preventDefault();
        adicionarEtiqueta(f, novo.value);
        novo.value = '';
      } else if (ev.key === 'Backspace' && !novo.value) {
        const ult = [...f.querySelectorAll('.crm-etq-chip')].pop();
        if (ult) { ult.remove(); marcarSuja(f); }
      }
    });
  });
  _fichaRascunho = null;
}


/* Troca de aba, de caixa e de conversa sem recarregar a tela inteira. */
const confirmarDescarte = async () => {
  const ponte = (typeof window !== 'undefined' && window.__GRID_PONTE) || {};
  return ponte.confirmar ? !!(await ponte.confirmar('A ficha do contato tem alterações que não foram salvas. Sair sem salvar?')) : true;
};
const SAI_DA_FICHA = ['crm:conversa', 'crm:aba', 'crm:caixa', 'crm:dono', 'crm:ver-resolvidas'];

export async function acao(nome, valor, redesenhar) {
  if (SAI_DA_FICHA.includes(nome) && fichaSuja()) {
    if (!(await confirmarDescarte())) return true;
    marcarFichaLimpa();
  }
  if (nome === 'crm:aba') {
    _aba = valor || 'chats';
    /* Trocar de aba desliga o filtro de resolvidas: os dois disputam a mesma
       lista, e deixar o filtro ligado ao trocar de aba faz a aba nova parecer
       quebrada. */
    _verResolvidas = false;
    redesenhar();
    return true;
  }
  if (nome === 'crm:ver-resolvidas')  { _verResolvidas = !_verResolvidas; redesenhar(); return true; }
  if (nome === 'crm:caixa')           { _caixaAtiva = valor; redesenhar(); return true; }
  if (nome === 'crm:conversa')        { _conversaAtiva = valor; _abertaDeProposito = valor; redesenhar(); return true; }
  if (nome === 'crm:buscar-conversa') { _busca = valor || ''; redesenhar(); return true; }

  /* 26/09 — Minhas | Todas. Lembrado neste navegador. */
  if (nome === 'crm:dono') {
    _dono = valor === 'todas' ? 'todas' : 'minhas';
    try { localStorage.setItem(CHAVE_DONO, _dono); } catch { /* sem armazenamento: vale só nesta visita */ }
    redesenhar();
    return true;
  }
  /* 26/09 — Responder | Nota interna, sem redesenhar (não perde o que foi digitado). */
  if (nome === 'crm:modo') {
    _modo = valor === 'nota' ? 'nota' : 'responder';
    _modoDaConversa = _conversaAtiva;
    aplicarModo();
    visivel('crmComposerTexto')?.focus();
    return true;
  }
  /* 26/09 — escolheu uma resposta rápida (pelo "/" ou pela lista). Se a
     pessoa digitou o atalho, ele é trocado pelo texto; senão, o texto entra
     no fim do que já estava escrito. {nome} vira o primeiro nome do contato. */
  if (nome === 'crm:resposta') {
    const campo = visivel('crmComposerTexto');
    const r = _respostas.find(x => String(x.id) === String(valor));
    if (campo && r) {
      const pnome = campo.closest('.crm-composer')?.dataset.nome || '';
      let texto = r.texto.replace(/\{nome\}/gi, pnome);
      if (!pnome) texto = texto.replace(/\s+([,!.?;:])/g, '$1').replace(/^[\s,]+/, '');
      if (/^\/[^\s]*$/.test(campo.value)) campo.value = texto;
      else campo.value = campo.value.trim() ? campo.value.replace(/\s*$/, ' ') + texto : texto;
      campo.dispatchEvent(new Event('input'));
      campo.focus();
      campo.selectionStart = campo.selectionEnd = campo.value.length;
    }
    const cx = visivel('crmModelos');
    if (cx) { cx.hidden = true; delete cx.dataset.pelaBarra; }
    return true;
  }

  /* Compatibilidade: os chips antigos sumiram da tela, mas um clique guardado
     em algum lugar não pode virar "ação desconhecida". */
  if (nome === 'crm:filtro-conv') {
    _verResolvidas = valor === 'resolvidas';
    _aba = valor === 'sem-dono' ? 'fila' : 'chats';
    redesenhar();
    return true;
  }

  /* ── 14/09 ──────────────────────────────────────────────────────────────
     As três abaixo mexem só no DOM, de propósito: `redesenhar()` remonta a
     tela e apagaria a resposta que a pessoa já digitou e ainda não enviou.
     Perder texto escrito é o tipo de defeito que faz desconfiar do sistema
     inteiro — então abrir a ficha ou pegar um modelo não redesenha nada. */
  /* 26/09 (v196): a ficha agora busca empresas, negócios e atividades —
     abrir precisa de um desenho. Ele guarda o rascunho da mensagem e a
     rolagem (preservarNoProximoDesenho), então nada do que estava escrito se
     perde. Fechar continua só no DOM. */
  if (nome === 'crm:ficha') {
    if (_fichaAberta) {
      if (fichaSuja() && !(await confirmarDescarte())) return true;
      _fichaAberta = false;
      _fichaRascunho = null;
      document.querySelectorAll('.crm-inbox').forEach(e => e.classList.remove('com-ficha'));
      document.querySelectorAll('.crm-btn-ficha').forEach(b => b.classList.remove('ativo'));
      document.querySelectorAll('.crm-ficha').forEach(f => { f.dataset.suja = '0'; });
      return true;
    }
    _fichaAberta = true;
    preservarNoProximoDesenho();
    await redesenhar();
    return true;
  }
  if (nome === 'crm:ficha-descartar') {
    marcarFichaLimpa();
    preservarNoProximoDesenho();
    await redesenhar();
    return true;
  }
  if (nome === 'crm:etq-tirar') {
    const f = fichaVisivel();
    const chip = f?.querySelectorAll('.crm-etq-chip')[Number(valor)];
    if (chip) {
      const caixa = chip.parentElement;
      chip.remove();
      renumerarEtiquetas(caixa);
      marcarSuja(f);
    }
    return true;
  }
  if (nome === 'crm:modelos') {
    const cx = visivel('crmModelos');
    if (cx) {
      cx.querySelectorAll('.crm-modelo').forEach(b => { b.hidden = false; b.classList.remove('foco'); });
      delete cx.dataset.pelaBarra;
      cx.hidden = !cx.hidden;
    }
    return true;
  }
  if (nome === 'crm:modelo') {
    const campo = visivel('crmComposerTexto');
    const texto = MODELOS[valor];
    if (campo && texto) {
      campo.value = campo.value.trim() ? campo.value.replace(/\s*$/, ' ') + texto : texto;
      campo.dispatchEvent(new Event('input'));
      campo.focus();
      campo.selectionStart = campo.selectionEnd = campo.value.length;
    }
    const cx = visivel('crmModelos');
    if (cx) cx.hidden = true;
    return true;
  }
  return false;
}

/* Chamado por acoes.js depois de criar/encontrar a conversa a partir de um
   contato ou de um número digitado: deixa a tela pronta para mostrá-la. Sem
   isto, a conversa nova nasceria fora da aba aberta e a pessoa clicaria sem
   ver nada acontecer. */
export function abrirConversa(id) {
  _conversaAtiva = id;
  _abertaDeProposito = id;
  _aba = 'chats';
  _verResolvidas = false;
  _busca = '';
}

/* ── Depois de desenhar ─────────────────────────────────────────────────────
   Duas coisas que não dá para expressar em HTML declarativo, e que eram as
   duas queixas do Alisson em 13/09: o campo de uma linha só que nunca crescia,
   e o Enter que não enviava. Roda a cada redesenho, sempre em elemento novo —
   por isso não há listener a remover. */
export function depois() {
  if (typeof document === 'undefined') return;

  /* 1. A conversa abre na mensagem MAIS NOVA. Sem isto a tela abria no topo,
        na mensagem mais antiga, e depois de enviar voltava para lá — a própria
        resposta recém-enviada ficava fora da vista. É o que mais fazia a tela
        parecer quebrada. Vale para as duas cópias (computador e celular).

        18/09: com a tela se atualizando sozinha, esta linha sozinha virava um
        defeito. A cada dez segundos ela puxaria a pessoa de volta para o fim
        da conversa no meio da leitura do histórico — e um sistema que rouba
        a rolagem é insuportável de usar. Agora: quem estava no fim continua
        no fim (é lá que a mensagem nova aparece); quem tinha subido para ler
        fica exatamente onde estava. */
  ligarAjusteDeAltura();
  ajustarAltura();      // antes de devolver a rolagem: a altura muda onde é "o fim"
  ligarFicha();
  devolverRolagem();
  devolverLista();

  const campo = visivel('crmComposerTexto');

  /* 2. O rascunho atravessa o redesenho automático.
        `redesenhar()` já devolve o texto do campo que estava EM FOCO (ver
        `_guardarFoco` em navegacao.js). Só que ninguém digita sem parar:
        escreve meia frase, olha o histórico, volta. Nesse intervalo o campo
        perde o foco, e sem estas três linhas o rascunho sumiria sozinho a
        cada dez segundos — o pior tipo de defeito, porque a pessoa culpa a
        própria memória antes de culpar o sistema.

        A conferência de `conversa` importa: restaurar o rascunho de uma
        conversa dentro de outra seria mandar a frase para a pessoa errada. */
  if (campo && _rascunhoAntes && _rascunhoAntes.conversa === _conversaAtiva
      && _rascunhoAntes.texto && !campo.value) {
    campo.value = _rascunhoAntes.texto;
  }
  _rascunhoAntes = null;

  marcarAbertaComoLida();
  ligarAtualizacaoAutomatica();

  if (!campo) return;

  /* 2. Cresce com o texto, até cerca de 5 linhas; daí em diante rola por
        dentro. O teto também está no CSS (max-height), para o campo nunca
        empurrar a conversa para fora da tela. */
  const crescer = () => {
    campo.style.height = 'auto';
    campo.style.height = Math.min(campo.scrollHeight, 132) + 'px';
  };
  campo.addEventListener('input', crescer);
  campo.addEventListener('input', () => filtrarRespostas(campo));
  crescer();

  /* 3. Enter envia. `isComposing` cobre teclados com acentuação por composição;
        `keyCode 229` cobre parte dos teclados de Android, que não mandam
        `isComposing`. Enviar no meio de uma palavra sendo composta perde texto. */
  campo.addEventListener('keydown', (ev) => {
    /* 26/09: com o menu do "/" aberto, as setas escolhem e Enter/Tab
       colocam a resposta no campo — nunca enviam. */
    const menu = campo.closest('.crm-composer')?.querySelector('.crm-modelos');
    if (menu && !menu.hidden && menu.dataset.pelaBarra) {
      if (ev.key === 'ArrowDown') { ev.preventDefault(); moverFoco(menu, 1); return; }
      if (ev.key === 'ArrowUp')   { ev.preventDefault(); moverFoco(menu, -1); return; }
      if ((ev.key === 'Enter' && !ev.shiftKey) || ev.key === 'Tab') {
        const foco = menu.querySelector('.crm-modelo.resp.foco:not([hidden])');
        if (foco) { ev.preventDefault(); foco.click(); return; }
      }
    }
    if (ev.key !== 'Enter' || ev.shiftKey || ev.isComposing || ev.keyCode === 229) return;
    ev.preventDefault();
    /* O botão decide o destino: "enviar" (cliente) ou "nota" (equipe). */
    const botao = [...document.querySelectorAll('.crm-enviar[data-acao^="crm:enviar:"], .crm-enviar[data-acao^="crm:nota:"]')]
      .find(b => b.getBoundingClientRect().width > 0);
    botao?.click();
  });

  ligarAtalhosGlobais();
}

/* ── Conversa aberta na tela é conversa lida (18/09) ────────────────────────
   Até hoje `nao_lidas` só zerava ao RESOLVER a conversa. Passava despercebido
   porque a tela não se atualizava: a pessoa abria, respondia, resolvia.

   Com a atualização automática isso viraria um defeito visível todo dia: você
   fica com a conversa aberta, as mensagens vão chegando na sua frente, e o
   contador ao lado dela sobe para 3, 4, 5 — "não lidas" que você está lendo
   naquele instante. Contador que mente é contador que a pessoa aprende a
   ignorar, e aí ele não serve para mais nada.

   Três condições, todas necessárias:
   · há conversa aberta e ela ainda tem não-lidas — senão não há o que gravar;
   · a aba está na frente — GRID aberto atrás do WhatsApp não é alguém lendo;
   · a gravação é solta (sem `await`) e o erro é engolido. Falhar em zerar um
     contador não pode atrapalhar quem está atendendo; na pior das hipóteses
     ele zera dez segundos depois, na batida seguinte. */
function marcarAbertaComoLida() {
  if (!_conversaAtiva || _naoLidasDaAberta <= 0) return;
  if (typeof document !== 'undefined' && document.hidden) return;
  /* `render()` abre a PRIMEIRA da lista quando nada está selecionado. Sem
     esta trava, só entrar em Conversas já zeraria o contador de uma conversa
     que ninguém olhou — e no celular ela nem está visível, fica abaixo da
     lista. Zerar contador de mensagem não lida que a pessoa não leu é perder
     a mensagem.

     Guarda o ID e não um sim/não: se a conversa escolhida for resolvida e a
     tela cair de volta na primeira da lista, um sim/não continuaria valendo
     e zeraria a errada. */
  if (_abertaDeProposito !== _conversaAtiva) return;
  const id = _conversaAtiva;
  _naoLidasDaAberta = 0;   // antes da chamada: impede duas gravações do mesmo
  dados.marcarConversaLida?.(id)?.catch?.(() => { /* tenta de novo no próximo ciclo */ });
}

/* ── A atualização automática (18/09) ───────────────────────────────────────
   Mesmo desenho da tela de Números: UM temporizador, religado a cada
   redesenho (por isso a primeira linha apaga o anterior — dois temporizadores
   vivos dobrariam as consultas e ninguém notaria).

   Quatro travas. Nenhuma é preciosismo:

   · SAIU DA TELA — o temporizador morre. Continuar consultando o banco de uma
     tela que ninguém está vendo é gastar o banco do cliente de graça.

   · ABA NO FUNDO — pula a vez, sem morrer. O celular com o GRID aberto atrás
     do WhatsApp não precisa consultar nada; quando voltar para a frente, a
     primeira batida já traz tudo.

   · JANELA ABERTA POR CIMA — pula a vez. Redesenhar por baixo de um modal ou
     da caixa de modelos tira o chão de quem está no meio de uma escolha.

   · O QUE ESTÁ ESCRITO E ONDE A PESSOA ESTÁ LENDO são fotografados aqui,
     imediatamente antes de trocar o HTML, e devolvidos em `depois()`.
     Fotografar aqui e não num lugar guardado entre ciclos é o que evita o
     erro clássico: a mensagem é enviada, `acoes.js` limpa o campo, e um
     rascunho velho guardado em outro lugar reapareceria por cima. Aqui a
     foto e o uso acontecem no mesmo ciclo — não existe foto velha. */
function ligarAtualizacaoAutomatica() {
  if (typeof document === 'undefined') return;
  if (_timerTela) { clearInterval(_timerTela); _timerTela = null; }

  const janelaAberta = () => !!(
    /* Gravando áudio: o redesenho troca o botão do microfone por um novo, sem
       a classe `gravando`. A gravação continuaria (o gravador mora em
       `window`), mas o botão voltaria a parecer desligado — e a pessoa
       clicaria de novo achando que não tinha começado, o que PARA e envia um
       áudio pela metade. */
    window.__crmGravador?.state === 'recording' ||
    document.querySelector('.crm-modelos:not([hidden])') ||      // caixa de modelos
    /* 26/09 (v196): editando a ficha do contato. O rascunho sobreviveria ao
       redesenho, mas o cursor e a seleção não — e o campo piscaria no meio
       da digitação. Espera a pessoa salvar ou sair do campo. */
    fichaSuja() || document.activeElement?.closest?.('.crm-ficha') ||
    (document.getElementById('modalOverlay')?.style.display || 'none') !== 'none'
  );

  _timerTela = setInterval(async () => {
    /* ── POR QUE DUAS CONFERÊNCIAS E NÃO SÓ A ROTA ────────────────────────
       `navegacao.rotaAtual()` sozinha NÃO basta, e isso quase virou um
       defeito feio. As telas próprias da casca — Início, Turmas, Agenda,
       Conta — são desenhadas pelo `switch` do `irPara()` em app.html e nunca
       passam por `_GRID.abrir()`, que é o único lugar onde `_rotaAtual` é
       atualizado. Resultado: sair de Conversas para o Início deixava
       `rotaAtual()` devolvendo 'crm-conversas' para sempre, o temporizador
       nunca morria, e dez segundos depois as Conversas se pintavam POR CIMA
       da tela inicial. E de novo a cada dez segundos.

       A sentinela resolve sem depender disso: `setConteudo` troca o
       `innerHTML` das duas cascas, então o elemento raiz desta tela some no
       instante em que qualquer outra é desenhada — inclusive as da casca.

       (A causa de fundo — `_rotaAtual` não ser limpo ao ir para tela própria
       da casca — está anotada no changelog de 18/09. `numeros.js` tem o mesmo
       problema, e recebeu a mesma sentinela.) */
    if (!document.getElementById('crmConversasVivo')
        || navegacao.rotaAtual?.() !== 'crm-conversas') {
      clearInterval(_timerTela); _timerTela = null; return;
    }
    if (document.hidden) return;   // aba no fundo: pula a vez, sem morrer
    if (janelaAberta()) return;    // não redesenha por baixo do que está aberto

    /* A fotografia do rascunho e da rolagem NÃO é tirada aqui — é tirada no
       fim de `render()`, depois das consultas ao banco. Ver o comentário lá:
       tirar antes do `await` devolvia texto velho. Aqui só se avisa que o
       redesenho é automático. */
    _emAtualizacaoAutomatica = true;

    try {
      await navegacao.redesenhar();
    } catch {
      _emAtualizacaoAutomatica = false;
      _rolagemAntes = null;
      _rascunhoAntes = null;
    }

    /* A tela pode ter trocado durante o `await`. Se trocou, as fotos não
       pertencem a desenho nenhum, e ficariam guardadas para serem aplicadas
       quando a pessoa voltasse às Conversas — colando um rascunho antigo num
       campo novo. Em condições normais `depois()` já as consumiu e estas
       linhas não fazem nada. */
    if (navegacao.rotaAtual?.() !== 'crm-conversas') {
      _emAtualizacaoAutomatica = false;
      _rolagemAntes = null;
      _rascunhoAntes = null;
    }
  }, INTERVALO_ATUALIZACAO);
}

/* ── Altura da tela ─────────────────────────────────────────────────────────
   26/09: a caixa tinha altura fixa no CSS (100vh - 230px, mínimo 520). O 230
   era um chute sobre o tamanho do topo do app; em tela de 900px de altura
   sobravam ~100px vazios embaixo, e em notebook de 700px a caixa passava da
   tela. Aqui a caixa ocupa exatamente o que sobra na área de conteúdo, até
   a margem de baixo que o app já tem. Só no computador: no celular a tela
   rola inteira (height:auto no CSS). O CSS continua como reserva. */
function ajustarAltura() {
  if (typeof document === 'undefined') return;
  const caixa = [...document.querySelectorAll('.crm-inbox')].find(e => e.offsetParent);
  if (!caixa) return;
  if (sessao.ehCelular()) { caixa.style.height = ''; return; }
  let rolo = caixa.parentElement;
  while (rolo && rolo !== document.body && !/(auto|scroll)/.test(getComputedStyle(rolo).overflowY)) {
    rolo = rolo.parentElement;
  }
  if (!rolo || rolo === document.body) return;
  const topo = caixa.getBoundingClientRect().top - rolo.getBoundingClientRect().top + rolo.scrollTop;
  const folgaBaixo = parseFloat(getComputedStyle(rolo).paddingBottom) || 0;
  const livre = Math.round(rolo.clientHeight - topo - folgaBaixo);
  caixa.style.height = Math.max(440, livre) + 'px';
}

let _alturaLigada = false;
function ligarAjusteDeAltura() {
  if (_alturaLigada || typeof window === 'undefined') return;
  _alturaLigada = true;
  let pendente = false;
  window.addEventListener('resize', () => {
    if (pendente) return;
    pendente = true;
    requestAnimationFrame(() => { pendente = false; ajustarAltura(); });
  });
}

/* ── Fechar o que está por cima ─────────────────────────────────────────────
   A caixa de modelos e a ficha do contato abrem por cima da conversa. Se só
   fecham pelo mesmo botão que as abriu, quem não descobre isso fica com a
   coisa presa na tela — foi exatamente o que aconteceu. Esc e clique fora
   fecham, como em qualquer lugar.

   Registrado UMA vez: `depois()` roda a cada redesenho, e re-registrar
   empilharia um listener por redesenho. */
let _globaisLigados = false;
function ligarAtalhosGlobais() {
  if (_globaisLigados || typeof document === 'undefined') return;
  _globaisLigados = true;

  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    const aberta = document.querySelector('.crm-modelos:not([hidden])');
    if (aberta) { aberta.hidden = true; delete aberta.dataset.pelaBarra; return; }
    if (_fichaAberta) {
      _fichaAberta = false;
      document.querySelectorAll('.crm-inbox').forEach(e => e.classList.remove('com-ficha'));
    }
  });

  document.addEventListener('click', (ev) => {
    const aberta = document.querySelector('.crm-modelos:not([hidden])');
    if (!aberta) return;
    if (aberta.contains(ev.target)) return;
    if (ev.target.closest?.('[data-acao="crm:modelos"]')) return;  // o próprio botão alterna
    aberta.hidden = true;
  });
}
