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
import { avisoDemo } from './painel.js';

let _aba = 'chats';           // 'chats' | 'fila' | 'contatos'
let _caixaAtiva = 'todas';
let _conversaAtiva = null;
let _busca = '';
let _verResolvidas = false;
/* 14/09: a ficha do contato deixou de ser coluna fixa e virou painel que
   abre por cima da conversa. Ela custava 272px permanentes de uma tela onde
   o que se faz é ler e escrever. Fechada por padrão. */
let _fichaAberta = false;

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

export async function render(params = {}) {
  const [caixas, conversas, contatos] = await Promise.all([
    dados.listar('crm_caixas'),
    dados.listar('crm_conversas'),
    dados.listar('crm_contatos')
  ]);

  const varios = caixas.length > 1;
  const daCaixa   = (c) => _caixaAtiva === 'todas' || c.caixa_id === _caixaAtiva;
  const resolvida = (c) => c.estado === 'resolvida';

  const minhas = conversas.filter(daCaixa);
  /* As três listas saem de UM critério só, e ele é o que a pessoa vê:
     tem responsável = está sendo atendida; não tem = está esperando alguém.
     `estado` não entra aqui de propósito — quem responde vira responsável
     (ver `enviarMensagem` em dados.js), então os dois nunca divergem. */
  const emAtendimento = minhas.filter(c => !resolvida(c) && c.responsavel);
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
  else                      lista = filtraConversas(emAtendimento);

  /* Qual conversa fica aberta à direita.
     Regra: continua aberta enquanto existir e pertencer à caixa selecionada —
     inclusive enquanto a pessoa navega pelos Contatos ou digita na busca, que
     é como qualquer atendimento funciona. Só duas coisas a fecham: ela ter
     sido resolvida (e não estarmos vendo as resolvidas) ou ter sumido. */
  if (params.conversa) _conversaAtiva = params.conversa;
  if (params.id)       _conversaAtiva = params.id;
  let atual = minhas.find(c => c.id === _conversaAtiva) || null;
  if (atual && resolvida(atual) && !_verResolvidas) atual = null;
  if (!atual && _aba !== 'contatos') atual = lista[0] || null;
  _conversaAtiva = atual ? atual.id : null;

  const contato = contatos.find(c => c.id === atual?.contato_id);
  /* Mensagens e lead vinculado: sempre da conversa aberta, nunca em bloco —
     mesmo motivo de `mensagensDaConversa` ser por-conversa em dados.js. */
  const msgs = atual ? await dados.mensagensDaConversa(atual.id) : [];
  const lead = atual?.lead_id ? await dados.obter('crm_leads', atual.lead_id).catch(() => null) : null;

  const listaContatos = contatos.filter(c => casaBusca(t, [c.nome, c.empresa, c.cargo, c.telefone]));

  return `
    <div class="crm-inbox ${varios ? '' : 'um-numero'} ${_fichaAberta ? 'com-ficha' : ''}">
      ${varios ? chipsCelular(caixas, conversas) : ''}
      ${varios ? trilhoCaixas(caixas, conversas) : ''}
      ${colunaLista({
        lista, listaContatos, caixas, varios,
        nChats: emAtendimento.length, nFila: naFila.length, nResolvidas: resolvidas.length
      })}
      <div class="crm-mob-sep">${icone('chevrondown','sm')} Ao tocar em uma conversa</div>
      ${atual ? colunaConversa(atual, caixas, varios, contato, msgs) : semConversa()}
      ${atual ? colunaContexto(atual, contato, lead) : ''}
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
function colunaLista({ lista, listaContatos, caixas, varios, nChats, nFila, nResolvidas }) {
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
    <div class="crm-col-body">
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

/* Estado de entrega. `enviarMensagem` grava 'pendente' e o gateway atualiza
   depois; por isso qualquer valor desconhecido conta como já enviada, e não
   como erro — errar para o lado de "saiu" é menos ruim do que alarmar à toa. */
function tiqueEntrega(m) {
  if (m.tipo !== 'enviada') return '';
  const s = String(m.status || '').toLowerCase();
  if (s === 'pendente')            return `<span class="crm-tique" title="Na fila — sai em instantes">◷</span>`;
  if (s === 'erro' || s === 'falha') return `<span class="crm-tique erro" title="Não foi possível enviar">!</span>`;
  return `<span class="crm-tique ok" title="Enviada">✓✓</span>`;
}

/* ── conversa ───────────────────────────────────────────────────────────── */
function colunaConversa(c, caixas, varios, contato, msgs) {
  const cx = caixas.find(x => x.id === c.caixa_id);
  let diaCorrente = null;
  const linhas = msgs.map(m => {
    const dia = rotuloDia(m.criado_em);
    const divisor = dia && dia !== diaCorrente ? `<div class="crm-dia">${ui.esc(dia)}</div>` : '';
    if (dia) diaCorrente = dia;
    const corpo = m.tipo === 'sistema'
      ? `<div class="crm-msg sis">${ui.esc(m.texto)}</div>`
      : `<div class="crm-msg ${m.tipo === 'enviada' ? 'env' : 'rec'}">
           ${m.autor ? `<div class="crm-msg-aut">${ui.esc(m.autor)}</div>` : ''}
           <div class="crm-msg-txt">${ui.esc(m.texto)}</div>
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
      <div class="crm-thread-ident">
        <div class="nome">${ui.esc(c.nome)}</div>
        <div class="meta"><span class="num">${ui.fmt.telefone(contato?.telefone || c.telefone)}</span></div>
      </div>
      <div class="crm-thread-selos">
        ${cx ? `<span class="crm-selo-cx">${ui.esc(cx.nome)}</span>` : ''}
        <span class="crm-selo-dono ${semDono ? 'sem' : ''}">${ui.esc(c.responsavel || 'Na fila')}</span>
      </div>
      <div class="crm-thread-acoes">
        ${semDono ? `<button class="ds-btn pri sm" data-acao="crm:assumir:${c.id}">${icone('user','sm')} Assumir</button>` : ''}
        <button class="ds-btn sec sm" data-acao="crm:vincular:${c.id}">${icone('funnel','sm')} Vincular</button>
        ${/* Resolver aparece mesmo sem dono: mensagem errada, propaganda ou
              engano se fecha de uma vez, sem a pessoa ter de assumir antes
              algo que não vai atender. Com dono, ele é a ação principal; sem
              dono, quem manda na tela é "Assumir". */''}
        <button class="ds-btn ${semDono ? 'sec' : 'pri'} sm" data-acao="crm:resolver:${c.id}">${icone('check','sm')} Resolver</button>
        <button class="ds-icobtn" data-acao="crm:ficha" title="Ficha do contato">${icone('user','sm')}</button>
      </div>
    </div>
    <div class="crm-thread-body">
      ${linhas}
      ${msgs.length ? '' : ui.vazio({ icone:'chat', titulo:'Sem mensagens nesta conversa',
        sub:'Escreva abaixo para mandar a primeira.' })}
    </div>
    <div class="crm-composer">
      <div class="crm-modelos" id="crmModelos" hidden>
        <button class="crm-modelo" data-acao="crm:modelo:proposta">${icone('doc','sm')} Enviar proposta</button>
        <button class="crm-modelo" data-acao="crm:modelo:datas">${icone('calendar','sm')} Sugerir datas</button>
        <button class="crm-modelo" data-acao="crm:modelo:certificado">${icone('cap','sm')} Certificado 2ª via</button>
      </div>
      <div class="crm-composer-box">
        <div class="crm-composer-icos">
          <button class="crm-cico" data-acao="crm:anexar" title="Anexar arquivo">${icone('clip','sm')}</button>
          <button class="crm-cico" data-acao="crm:modelos" title="Modelos de mensagem">${icone('chat','sm')}</button>
        </div>
        <textarea id="crmComposerTexto" rows="1" placeholder="Escreva a resposta"></textarea>
        <button class="crm-enviar" data-acao="crm:enviar:${c.id}" title="Enviar">${icone('send','sm')}</button>
      </div>
      <div class="crm-composer-dica"><kbd>Enter</kbd> envia · <kbd>Shift</kbd>+<kbd>Enter</kbd> quebra linha</div>
    </div>
  </div>`;
}

/* ── contexto do contato ────────────────────────────────────────────────── */
function colunaContexto(c, contato, lead) {
  return `
  <div class="crm-col crm-ctx">
    <div class="crm-ctx-topo">
      <span>Ficha do contato</span>
      <button class="ds-icobtn" data-acao="crm:ficha" title="Fechar">✕</button>
    </div>
    <div class="crm-ctx-bloco">
      <div class="crm-ctx-lbl">Contato</div>
      <div style="font-size:var(--fs-4);font-weight:700;color:var(--text-1)">${ui.esc(contato?.nome || c.nome)}</div>
      <div style="font-size:var(--fs-2);color:var(--text-3);margin-bottom:12px">${ui.esc(contato?.cargo || '')}</div>
      ${linhaCtx('Telefone', ui.fmt.telefone(contato?.telefone || c.telefone))}
      ${linhaCtx('Empresa', contato?.empresa || '—')}
      ${linhaCtx('Origem', contato?.origem || '—')}
      ${linhaCtx('Responsável', c.responsavel || 'Na fila, sem responsável')}
    </div>
    ${lead ? `<div class="crm-ctx-bloco">
      <div class="crm-ctx-lbl">Lead ativo</div>
      <div class="crm-lead-card" data-acao="ir:crm-lead:${lead.id}">
        <div class="crm-lead-emp">${ui.esc(lead.item || lead.treinamento || 'Negócio')}${lead.vagas ? ' — ' + lead.vagas + ' vagas' : ''}</div>
        <div class="crm-lead-meta"><span>${icone('funnel','sm')} Estágio: ${ui.esc(lead.estagio)}</span>
          <span>${icone('user','sm')} ${ui.esc(lead.responsavel || 'sem dono')}</span></div>
        <div class="crm-lead-rod"><span class="crm-lead-val">${ui.fmt.moeda(lead.valor)}</span></div>
      </div></div>` : ''}
  </div>`;
}

const linhaCtx = (k, v) => `<div class="crm-ctx-linha"><span class="k">${k}</span><span class="v">${ui.esc(v)}</span></div>`;

/* Troca de aba, de caixa e de conversa sem recarregar a tela inteira. */
export function acao(nome, valor, redesenhar) {
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
  if (nome === 'crm:conversa')        { _conversaAtiva = valor; redesenhar(); return true; }
  if (nome === 'crm:buscar-conversa') { _busca = valor || ''; redesenhar(); return true; }

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
  if (nome === 'crm:ficha') {
    _fichaAberta = !_fichaAberta;
    document.querySelectorAll('.crm-inbox').forEach(e => e.classList.toggle('com-ficha', _fichaAberta));
    return true;
  }
  if (nome === 'crm:modelos') {
    const cx = visivel('crmModelos');
    if (cx) cx.hidden = !cx.hidden;
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
        parecer quebrada. Vale para as duas cópias (computador e celular). */
  document.querySelectorAll('.crm-thread-body').forEach(t => { t.scrollTop = t.scrollHeight; });

  const campo = visivel('crmComposerTexto');
  if (!campo) return;

  /* 2. Cresce com o texto, até cerca de 5 linhas; daí em diante rola por
        dentro. O teto também está no CSS (max-height), para o campo nunca
        empurrar a conversa para fora da tela. */
  const crescer = () => {
    campo.style.height = 'auto';
    campo.style.height = Math.min(campo.scrollHeight, 132) + 'px';
  };
  campo.addEventListener('input', crescer);
  crescer();

  /* 3. Enter envia. `isComposing` cobre teclados com acentuação por composição;
        `keyCode 229` cobre parte dos teclados de Android, que não mandam
        `isComposing`. Enviar no meio de uma palavra sendo composta perde texto. */
  campo.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' || ev.shiftKey || ev.isComposing || ev.keyCode === 229) return;
    ev.preventDefault();
    const botao = [...document.querySelectorAll('.crm-enviar[data-acao^="crm:enviar:"]')]
      .find(b => b.getBoundingClientRect().width > 0);
    botao?.click();
  });

  ligarAtalhosGlobais();
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
    if (aberta) { aberta.hidden = true; return; }
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
