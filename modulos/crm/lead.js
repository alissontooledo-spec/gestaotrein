/* GRID · modulos/crm/lead.js — ficha do lead */
import * as ui from '../../nucleo/ui.js';
import { icone } from '../../nucleo/icones.js';
import * as dados from '../../nucleo/dados.js';
import { ESTAGIOS, rotuloEstagio, ehGanho } from '../../nucleo/estagios.js';
import { EXEMPLO } from './exemplo.js';

export async function render(params = {}) {
  // Sem id na rota nao ha lead: abrir o primeiro do arquivo de demonstracao
  // dentro do app mostraria um lead que nao existe no banco.
  const id = params.id;
  if (!id) return ui.vazio({ titulo:'Nenhum lead selecionado', sub:'Abra um lead pelo funil de vendas.' });
  const lead = await dados.obter('crm_leads', id);
  if (!lead) return ui.vazio({ titulo:'Lead não encontrado', sub:'Ele pode ter sido removido ou pertencer a outra organização.' });

  const contato    = lead.contato_id ? await dados.obter('crm_contatos', lead.contato_id) : null;
  const atividades = (await dados.listar('crm_atividades')).filter(a => a.lead_id === id);
  const historico  = await dados.historicoLead(id).catch(() => []);
  // Historico de treinamentos do cliente: vira da integracao entre os modulos
  // (Etapa 5 do plano). Ate la nao ha o que mostrar, e o bloco simplesmente
  // nao aparece — melhor do que exibir numero inventado ao lado de dado real.
  const trein      = dados.ehExemplo() && contato?.cliente_id ? EXEMPLO.treinamentos_por_cliente[contato.cliente_id] : null;
  const iAtual     = ESTAGIOS.findIndex(e => e.id === lead.estagio);

  return `
  ${ui.topo({
    voltar:{ rotulo:'Funil de vendas', acao:'ir:crm-funil' },
    titulo:`${lead.empresa} — ${lead.treinamento} (${lead.vagas} vagas)`,
    sub:`Responsável ${lead.responsavel || 'não definido'} · ${ui.fmt.moeda(lead.valor)}`,
    acoes:[
      { rotulo:'Editar', icone:'tool', tipo:'sec', acao:`crm:editar-lead:${id}` },
      { rotulo:'Marcar perdido', tipo:'sec', acao:`crm:perdido:${id}` },
      { rotulo:'Marcar ganho', icone:'check', tipo:'pri', acao:`crm:ganho:${id}` }
    ]
  })}

  ${ui.cartao(`
    <div class="crm-steps">${ESTAGIOS.map((e, i) => `
      <div class="crm-step ${i < iAtual ? 'ok' : i === iAtual ? 'now' : ''}">
        <div class="b"></div><div class="t">${e.rotulo}</div></div>`).join('')}</div>
    <div style="display:flex;align-items:center;gap:8px;margin-top:16px;padding-top:14px;border-top:1px solid var(--border);flex-wrap:wrap">
      <span style="font-size:var(--fs-2);color:var(--text-3)">Mover para</span>
      ${ESTAGIOS.filter((e,i) => i > iAtual).map(e =>
        `<button class="ds-btn sec sm" data-acao="crm:estagio:${id}:${e.id}">${e.rotulo}</button>`).join('')}
    </div>`, { estilo:'margin-bottom:var(--sp-4)' })}

  <div class="home-2col" style="grid-template-columns:minmax(0,1.5fr) minmax(0,1fr)">
    <div style="display:flex;flex-direction:column;gap:12px">
      ${ui.cartao(ui.cartaoTitulo('Linha do tempo','activity') + linhaTempo(historico, lead), { plano:true })}
      ${ui.cartao(
        ui.cartaoTitulo('Atividades','calendar',{ rotulo:'Nova', icone:'plus', acao:`crm:nova-atividade:${id}` }) +
        (atividades.length ? atividades.map(itemAtividade).join('') : ui.vazio({ icone:'calendar', titulo:'Nenhuma atividade marcada' })),
        { plano:true })}
      ${ui.cartao(`<div class="ds-card-titulo" style="margin-bottom:8px">Anotações</div>
        <div style="font-size:var(--fs-4);color:var(--text-2);line-height:1.7;max-width:66ch">
          ${ui.esc(lead.anotacoes || 'Sem anotações neste lead.')}</div>`)}
    </div>

    <div style="display:flex;flex-direction:column;gap:12px">
      ${ui.cartao(`<div class="ds-card-titulo" style="margin-bottom:12px">Dados do negócio</div>
        ${lead.cliente_id
          ? `<div class="crm-ctx-linha"><span class="k">Empresa</span>
               <span class="v"><span class="crm-link" data-acao="ir:crm-empresa:${ui.esc(lead.cliente_id)}">${ui.esc(lead.empresa)} ${icone('chevronright','sm')}</span></span></div>`
          : dado('Empresa', lead.empresa)}
        ${lead.previsao ? dado('Previsão de fechamento', ui.dataLocal(lead.previsao).toLocaleDateString('pt-BR')) : ''}
        ${lead.motivo_perda ? dado('Motivo da perda', lead.motivo_perda) : ''}
        ${lead.motivo_perda_obs ? dado('Detalhe da perda', lead.motivo_perda_obs) : ''}
        ${dado('Contato', contato?.nome || '—')}
        ${dado('Cargo', contato?.cargo || '—')}
        ${dado('Telefone', ui.fmt.telefone(contato?.telefone))}
        ${dado('Origem', lead.origem)}
        ${dado('Treinamento', lead.treinamento)}
        ${dado('Participantes', lead.vagas)}`)}

      ${contato ? ui.cartao(`<div class="ds-card-titulo" style="margin-bottom:8px">Conversa</div>
        <div style="font-size:var(--fs-3);color:var(--text-2);line-height:1.65;margin-bottom:12px">
          Fale com ${ui.esc(contato.nome)} pelo mesmo número que iniciou o atendimento.</div>
        <button class="ds-btn sec" style="width:100%;justify-content:center" data-acao="ir:crm-conversas">${icone('chat','sm')} Abrir conversa</button>`) : ''}

      ${ehGanho(lead.estagio) ? ui.cartao(`
        <div class="ds-card-titulo" style="margin-bottom:8px">Próximo passo</div>
        <div style="font-size:var(--fs-3);color:var(--text-2);line-height:1.65;margin-bottom:12px">
          Este negócio está ganho. A turma <b>não</b> é criada pelo CRM — quem monta é o operador,
          em Turmas, com instrutor, datas e participantes.</div>
        <button class="ds-btn sec" style="width:100%;justify-content:center" data-acao="ir:turmas">
          ${icone('clipboard','sm')} Abrir Turmas</button>`) : ''}

      ${trein ? ui.cartao(`<div class="ds-card-titulo" style="margin-bottom:10px">No módulo de Treinamentos</div>
        <div class="crm-ctx-cross"><div class="t">${icone('cap','sm')} Já é cliente cadastrado</div>
          <div class="l">${trein.turmas} turmas realizadas${trein.proxima ? ` · próxima em ${trein.proxima}` : ''}<br>Conformidade: ${trein.conformidade}%</div></div>
        <div style="display:flex;flex-direction:column;gap:6px;margin-top:12px">
          <button class="ds-btn sec" style="justify-content:center" data-acao="ir:clientes:${contato.cliente_id}">Abrir ficha do cliente</button>
          <button class="ds-btn sec" style="justify-content:center" data-acao="ir:turmas:${contato.cliente_id}">Ver turmas da empresa</button>
        </div>`) : ''}
    </div>
  </div>`;
}

const dado = (k, v) => `<div class="crm-ctx-linha"><span class="k">${k}</span><span class="v">${ui.esc(v)}</span></div>`;

/* ── CORRIGIDO EM 05/09 (h23) ──────────────────────────────────────────────
   Esta funcao mostrava uma linha do tempo INVENTADA: tres eventos com datas
   escritas no codigo ('2026-09-03T09:58'), incluindo um "Proposta enviada" que
   aparecia em todo lead — inclusive nos que nunca receberam proposta. O banco
   registra a trilha de verdade desde a Fase A, por gatilho, em
   crm_lead_historico: quem mudou, o que mudou, de que valor para qual e quando.
   Agora a tela mostra isso. Onde nao ha registro, nao ha evento — melhor uma
   linha do tempo curta e verdadeira do que uma longa e inventada. */
const EVENTO = {
  criado:   { ic:'plus',  cor:'var(--gray-100)', t:'Negócio criado' },
  etapa:    { ic:'funnel',cor:'var(--blue-l)',   t:'Mudou de etapa' },
  alterado: { ic:'tool',  cor:'var(--amber-l)',  t:'Alteração' },
  ganho:    { ic:'check', cor:'var(--green-l)',  t:'Marcado como ganho' },
  perdido:  { ic:'close', cor:'var(--red-l)',    t:'Marcado como perdido' },
  excluido: { ic:'close', cor:'var(--red-l)',    t:'Excluído' },
  convertido:{ ic:'building', cor:'var(--green-l)', t:'Virou cliente' }
};

const ROTULO_CAMPO = { valor:'Valor', etapa:'Etapa', responsavel_id:'Responsável',
                       empresa:'Empresa', titulo:'Negócio', vagas:'Quantidade' };

function linhaTempo(historico, lead) {
  if (!historico.length) {
    return ui.vazio({ icone:'activity', titulo:'Sem histórico registrado',
      sub:'As mudanças de etapa, valor e responsável deste negócio aparecem aqui a partir de agora.' });
  }

  return historico.map(h => {
    const e = EVENTO[h.acao] || { ic:'activity', cor:'var(--gray-100)', t: h.acao };
    /* Evento de criacao nao tem campo — e o rotulo saia como o texto "null:"
       na frente do nome da empresa. Sem campo, mostra so o valor. */
    const campo = h.campo ? (ROTULO_CAMPO[h.campo] || h.campo) : null;
    /* "de X para Y" so quando os dois lados existem: metade da frase e pior
       que nenhuma. Valor vem como texto do banco e volta a ser dinheiro aqui. */
    const fmtLado = (v) => h.campo === 'valor' && v != null && v !== '' ? ui.fmt.moeda(v) : v;
    const comCampo = (txt) => campo ? `${campo}: ${txt}` : txt;
    const detalhe = (h.de && h.para) ? comCampo(`${fmtLado(h.de)} → ${fmtLado(h.para)}`)
                  : (h.para ? comCampo(String(fmtLado(h.para))) : (campo || ''));
    return `<div class="crm-ativ">
      <span class="crm-ativ-ico" style="background:${e.cor}">${icone(e.ic,'sm')}</span>
      <div style="flex:1">
        <div class="crm-ativ-t">${ui.esc(e.t)}</div>
        <div class="crm-ativ-s">${ui.esc(detalhe)}${h.autor ? ' · ' + ui.esc(h.autor) : ''}</div>
      </div>
      <span class="crm-ativ-hora" title="${ui.esc(new Date(h.quando).toLocaleString('pt-BR'))}">
        ${ui.fmt.data(h.quando)} ${ui.fmt.hora(h.quando)}</span></div>`;
  }).join('');
}

const itemAtividade = (a) => `<div class="crm-ativ">
  <span class="crm-ativ-ico" ${a.concluida ? 'style="background:var(--green-l);color:var(--green-text)"' : ''}>${icone(a.concluida ? 'check' : 'clock','sm')}</span>
  <div style="flex:1"><div class="crm-ativ-t" ${a.concluida ? 'style="color:var(--text-3)"' : ''}>${ui.esc(a.titulo)}</div>
    <div class="crm-ativ-s">${ui.esc(a.responsavel || '')}</div></div>
  <span class="crm-ativ-hora">${ui.fmt.data(a.quando)}</span></div>`;
