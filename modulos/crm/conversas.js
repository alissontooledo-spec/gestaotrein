/* GRID · modulos/crm/conversas.js — caixa de entrada de WhatsApp */
import * as ui from '../../nucleo/ui.js';
import { icone } from '../../nucleo/icones.js';
import * as dados from '../../nucleo/dados.js';
import * as sessao from '../../nucleo/sessao.js';
import { EXEMPLO } from './exemplo.js';
import { avisoDemo } from './painel.js';

let _caixaAtiva = 'todas';
let _conversaAtiva = null;
let _busca = '';
let _filtro = 'todas';        // 'todas' | 'minhas' | 'sem-dono'

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

  return `
    <div class="crm-inbox ${varios ? '' : 'um-numero'}">
      ${varios ? chipsCelular(caixas, conversas) : ''}
      ${varios ? trilhoCaixas(caixas, conversas) : ''}
      ${colunaLista(lista, caixas, varios)}
      <div class="crm-mob-sep">${icone('chevrondown','sm')} Ao tocar em uma conversa</div>
      ${atual ? colunaConversa(atual, caixas, varios) : ui.vazio({ icone:'inbox', titulo:'Nenhuma conversa' })}
      ${atual ? colunaContexto(atual, contato) : ''}
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

/* ── conversa ───────────────────────────────────────────────────────────── */
function colunaConversa(c, caixas, varios) {
  const cx = caixas.find(x => x.id === c.caixa_id);
  const msgs = EXEMPLO.crm_mensagens[c.id] || [];
  return `
  <div class="crm-col crm-thread">
    <div class="crm-thread-head">
      <div class="crm-conv-av" style="background:rgba(30,42,74,.08);color:var(--navy);width:34px;height:34px">${ui.fmt.iniciais(c.nome)}</div>
      <div class="crm-thread-ident">
        <div class="nome">${ui.esc(c.nome)}</div>
        <div class="meta"><span class="num">${ui.fmt.telefone(EXEMPLO.crm_contatos.find(x => x.id === c.contato_id)?.telefone)}</span>
          ${varios && cx ? `<span class="crm-tag-caixa"><i></i> ${ui.esc(cx.nome)}</span>` : ''}</div>
      </div>
      <div class="crm-thread-acoes">
        <button class="ds-btn sec sm" data-acao="crm:vincular:${c.id}">${icone('funnel','sm')} Vincular</button>
        <button class="ds-btn pri sm" data-acao="crm:resolver:${c.id}">${icone('check','sm')} Resolver</button>
        <button class="ds-icobtn" data-acao="crm:mais:${c.id}">${icone('more','sm')}</button>
      </div>
    </div>
    <div class="crm-thread-body">
      <div class="crm-dia">Hoje</div>
      ${msgs.map(m => m.tipo === 'sistema'
        ? `<div class="crm-msg sis">${m.texto}</div>`
        : `<div class="crm-msg ${m.tipo === 'enviada' ? 'env' : 'rec'}">
             ${m.autor ? `<div class="crm-msg-aut">${ui.esc(m.autor)}</div>` : ''}
             ${ui.esc(m.texto)}<span class="h">${m.hora || ''}</span></div>`).join('')}
      ${msgs.length ? '' : ui.vazio({ icone:'chat', titulo:'Sem mensagens nesta conversa' })}
    </div>
    <div class="crm-composer">
      <div class="crm-atalhos">
        <span class="crm-atalho" data-acao="crm:modelo:proposta">${icone('doc','sm')} Enviar proposta</span>
        <span class="crm-atalho" data-acao="crm:modelo:datas">${icone('calendar','sm')} Sugerir datas</span>
        <span class="crm-atalho" data-acao="crm:modelo:certificado">${icone('cap','sm')} Certificado 2ª via</span>
      </div>
      <div class="crm-composer-box">
        <button class="ds-icobtn" style="border:none" data-acao="crm:anexar">${icone('clip','sm')}</button>
        <input type="text" placeholder="Escreva a resposta" data-acao="crm:digitar">
        <button class="ds-icobtn pri" data-acao="crm:enviar:${c.id}">${icone('send','sm')}</button>
      </div>
    </div>
  </div>`;
}

/* ── contexto do contato ────────────────────────────────────────────────── */
function colunaContexto(c, contato) {
  const lead = EXEMPLO.crm_leads.find(l => l.id === c.lead_id);
  const trein = contato?.cliente_id ? EXEMPLO.treinamentos_por_cliente[contato.cliente_id] : null;
  return `
  <div class="crm-col crm-ctx">
    <div class="crm-ctx-bloco">
      <div class="crm-ctx-lbl">Contato</div>
      <div style="font-size:var(--fs-4);font-weight:700;color:var(--text-1)">${ui.esc(contato?.nome || c.nome)}</div>
      <div style="font-size:var(--fs-2);color:var(--text-3);margin-bottom:12px">${ui.esc(contato?.cargo || '')}</div>
      ${linhaCtx('Telefone', ui.fmt.telefone(contato?.telefone))}
      ${linhaCtx('Empresa', contato?.empresa || '—')}
      ${linhaCtx('Origem', contato?.origem || '—')}
      ${linhaCtx('Responsável', c.responsavel || 'Sem responsável')}
    </div>
    ${lead ? `<div class="crm-ctx-bloco">
      <div class="crm-ctx-lbl">Lead ativo</div>
      <div class="crm-lead-card" data-acao="ir:crm-lead:${lead.id}">
        <div class="crm-lead-emp">${ui.esc(lead.treinamento)} — ${lead.vagas} vagas</div>
        <div class="crm-lead-meta"><span>${icone('funnel','sm')} Estágio: ${ui.esc(lead.estagio)}</span>
          <span>${icone('user','sm')} ${ui.esc(lead.responsavel || 'sem dono')}</span></div>
        <div class="crm-lead-rod"><span class="crm-lead-val">${ui.fmt.moeda(lead.valor)}</span></div>
      </div></div>` : ''}
    ${trein ? `<div class="crm-ctx-bloco">
      <div class="crm-ctx-lbl">No módulo de Treinamentos</div>
      <div class="crm-ctx-cross">
        <div class="t">${icone('cap','sm')} Já é cliente</div>
        <div class="l">${trein.turmas} turmas realizadas · última ${ui.esc(trein.ultima)}<br>
          ${trein.proxima ? `Próxima turma: ${ui.esc(trein.proxima)}<br>` : ''}Conformidade: ${trein.conformidade}%</div>
      </div>
      <button class="ds-btn sec" style="width:100%;margin-top:10px;justify-content:center" data-acao="ir:clientes:${contato.cliente_id}">Abrir ficha do cliente</button>
    </div>` : ''}
  </div>`;
}

const linhaCtx = (k, v) => `<div class="crm-ctx-linha"><span class="k">${k}</span><span class="v">${ui.esc(v)}</span></div>`;

/* Troca de caixa e de conversa sem recarregar a tela inteira. */
export function acao(nome, valor, redesenhar) {
  if (nome === 'crm:caixa')           { _caixaAtiva = valor; redesenhar(); return true; }
  if (nome === 'crm:conversa')        { _conversaAtiva = valor; redesenhar(); return true; }
  if (nome === 'crm:buscar-conversa') { _busca = valor || ''; redesenhar(); return true; }
  if (nome === 'crm:filtro-conv')     { _filtro = valor || 'todas'; redesenhar(); return true; }
  return false;
}
