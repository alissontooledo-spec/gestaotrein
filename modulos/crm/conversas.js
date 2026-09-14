/* GRID · modulos/crm/conversas.js — caixa de entrada de WhatsApp */
import * as ui from '../../nucleo/ui.js';
import { icone } from '../../nucleo/icones.js';
import * as dados from '../../nucleo/dados.js';
import * as sessao from '../../nucleo/sessao.js';
import { avisoDemo } from './painel.js';

let _caixaAtiva = 'todas';
let _conversaAtiva = null;
let _busca = '';
let _filtro = 'todas';        // 'todas' | 'minhas' | 'sem-dono'
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

export async function render(params = {}) {
  const [caixas, conversas, contatos] = await Promise.all([
    dados.listar('crm_caixas'),
    dados.listar('crm_conversas'),
    dados.listar('crm_contatos')
  ]);

  const varios = caixas.length > 1;
  /* 05/09 (h17): a lista era so filtrada por caixa. Busca e os tres chips do
     topo existiam desenhados na tela, mas nao respondiam a clique nenhum —
     eram enfeite. Agora filtram de verdade. */
  const eu = sessao.usuario()?.nome || '';
  let lista = _caixaAtiva === 'todas' ? conversas : conversas.filter(c => c.caixa_id === _caixaAtiva);
  if (_filtro === 'minhas')   lista = lista.filter(c => c.responsavel && c.responsavel === eu);
  if (_filtro === 'sem-dono') lista = lista.filter(c => !c.responsavel);
  if (_busca) {
    const t = _busca.toLowerCase();
    lista = lista.filter(c => [c.nome, c.empresa, c.previa, c.telefone]
      .some(v => (v || '').toLowerCase().includes(t)));
  }
  _conversaAtiva = params.conversa || _conversaAtiva || lista[0]?.id;
  const atual   = conversas.find(c => c.id === _conversaAtiva) || lista[0];
  const contato = contatos.find(c => c.id === atual?.contato_id);
  /* Mensagens e lead vinculado: sempre da conversa aberta, nunca em bloco —
     mesmo motivo de `mensagensDaConversa` ser por-conversa em dados.js. */
  const msgs = atual ? await dados.mensagensDaConversa(atual.id) : [];
  const lead = atual?.lead_id ? await dados.obter('crm_leads', atual.lead_id).catch(() => null) : null;

  return `
    <div class="crm-inbox ${varios ? '' : 'um-numero'} ${_fichaAberta ? 'com-ficha' : ''}">
      ${varios ? chipsCelular(caixas, conversas) : ''}
      ${varios ? trilhoCaixas(caixas, conversas) : ''}
      ${colunaLista(lista, caixas, varios)}
      <div class="crm-mob-sep">${icone('chevrondown','sm')} Ao tocar em uma conversa</div>
      ${atual ? colunaConversa(atual, caixas, varios, contato, msgs) : ui.vazio({ icone:'inbox', titulo:'Nenhuma conversa' })}
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

/* ── lista de conversas ─────────────────────────────────────────────────── */
function colunaLista(lista, caixas, varios) {
  return `
  <div class="crm-col">
    <div class="crm-col-head">
      <div class="ds-busca" style="max-width:none;margin-bottom:10px">${icone('search','sm')}
        <input type="search" placeholder="Buscar conversa, contato ou telefone" value="${ui.esc(_busca)}" data-acao="crm:buscar-conversa"></div>
      <div style="display:flex;gap:5px;flex-wrap:wrap">
        ${[['todas', `Todas · ${lista.length}`], ['minhas','Minhas'], ['sem-dono','Sem responsável']]
          .map(([id, rot]) => `<span class="ds-selo ${_filtro === id ? '' : 'neutro'}"
            style="cursor:pointer${_filtro === id ? ';background:var(--navy);color:#fff' : ''}"
            data-acao="crm:filtro-conv:${id}">${rot}</span>`).join('')}
      </div>
    </div>
    <div class="crm-col-body">
      ${lista.map(c => {
        const cx = caixas.find(x => x.id === c.caixa_id);
        return `<div class="crm-conv ${c.id === _conversaAtiva ? 'ativa' : ''}" data-acao="crm:conversa:${c.id}">
          <div class="crm-conv-av" style="background:rgba(30,42,74,.08);color:var(--navy)">${ui.fmt.iniciais(c.nome)}</div>
          <div class="crm-conv-main">
            <div class="crm-conv-top"><span class="crm-conv-nome">${ui.esc(c.nome)}</span><span class="crm-conv-hora">${c.hora}</span></div>
            <div class="crm-conv-prev">${ui.esc(c.previa)}</div>
            <div class="crm-conv-meta">
              ${varios && cx ? `<span class="crm-tag-caixa"><i></i> ${ui.esc(cx.nome)}</span>` : ''}
              ${c.empresa ? ui.selo(c.empresa, 'neutro') : ''}
            </div>
          </div>
          ${c.nao_lidas ? `<span class="crm-conv-nao">${c.nao_lidas}</span>` : ''}
        </div>`; }).join('')}
    </div>
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
        <span class="crm-selo-dono ${c.responsavel ? '' : 'sem'}">${ui.esc(c.responsavel || 'Sem responsável')}</span>
      </div>
      <div class="crm-thread-acoes">
        <button class="ds-btn sec sm" data-acao="crm:vincular:${c.id}">${icone('funnel','sm')} Vincular</button>
        <button class="ds-btn pri sm" data-acao="crm:resolver:${c.id}">${icone('check','sm')} Resolver</button>
        <button class="ds-icobtn" data-acao="crm:ficha" title="Ficha do contato">${icone('user','sm')}</button>
      </div>
    </div>
    <div class="crm-thread-body">
      ${linhas}
      ${msgs.length ? '' : ui.vazio({ icone:'chat', titulo:'Sem mensagens nesta conversa' })}
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
      ${linhaCtx('Responsável', c.responsavel || 'Sem responsável')}
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

/* Troca de caixa e de conversa sem recarregar a tela inteira. */
export function acao(nome, valor, redesenhar) {
  if (nome === 'crm:caixa')           { _caixaAtiva = valor; redesenhar(); return true; }
  if (nome === 'crm:conversa')        { _conversaAtiva = valor; redesenhar(); return true; }
  if (nome === 'crm:buscar-conversa') { _busca = valor || ''; redesenhar(); return true; }
  if (nome === 'crm:filtro-conv')     { _filtro = valor || 'todas'; redesenhar(); return true; }

  /* ── 14/09 ──────────────────────────────────────────────────────────────
     As três abaixo mexem só no DOM, de propósito: `redesenhar()` remonta a
     tela e apagaria a resposta que a pessoa já digitou e ainda não enviou.
     Perder texto escrito é o tipo de defeito que faz desconfiar do sistema
     inteiro — então abrir a ficha ou pegar um modelo não redesenha nada. */
  if (nome === 'crm:ficha') {
    _fichaAberta = !_fichaAberta;
    document.querySelector('.crm-inbox')?.classList.toggle('com-ficha', _fichaAberta);
    return true;
  }
  if (nome === 'crm:modelos') {
    const cx = document.getElementById('crmModelos');
    if (cx) cx.hidden = !cx.hidden;
    return true;
  }
  if (nome === 'crm:modelo') {
    const campo = document.getElementById('crmComposerTexto');
    const texto = MODELOS[valor];
    if (campo && texto) {
      campo.value = campo.value.trim() ? campo.value.replace(/\s*$/, ' ') + texto : texto;
      campo.dispatchEvent(new Event('input'));
      campo.focus();
      campo.selectionStart = campo.selectionEnd = campo.value.length;
    }
    const cx = document.getElementById('crmModelos');
    if (cx) cx.hidden = true;
    return true;
  }
  return false;
}

/* ── Depois de desenhar ─────────────────────────────────────────────────────
   Duas coisas que não dá para expressar em HTML declarativo, e que eram as
   duas queixas do Alisson em 13/09: o campo de uma linha só que nunca crescia,
   e o Enter que não enviava. Roda a cada redesenho, sempre em elemento novo —
   por isso não há listener a remover. */
export function depois() {
  if (typeof document === 'undefined') return;
  const campo = document.getElementById('crmComposerTexto');
  if (!campo) return;

  /* Cresce com o texto, até cerca de 5 linhas; daí em diante rola por dentro.
     O teto também está no CSS (max-height), para o campo nunca empurrar a
     conversa para fora da tela. */
  const crescer = () => {
    campo.style.height = 'auto';
    campo.style.height = Math.min(campo.scrollHeight, 132) + 'px';
  };
  campo.addEventListener('input', crescer);
  crescer();

  campo.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' || ev.shiftKey || ev.isComposing) return;
    ev.preventDefault();
    document.querySelector('.crm-enviar[data-acao^="crm:enviar:"]')?.click();
  });
}
