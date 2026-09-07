/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/crm/acoes.js
   Onde as acoes declaradas pelas telas viram escrita no banco.

   O modulo NAO conhece o app: ele pede modal, aviso e confirmacao pela ponte
   (GRID.ponte), que a casca preenche uma vez na entrada. E o que permite a
   mesma tela rodar dentro do app e no demo.html sem uma linha diferente.
   ══════════════════════════════════════════════════════════════════════════ */

import * as dados from '../../nucleo/dados.js';
import * as sessao from '../../nucleo/sessao.js';
import { ESTAGIOS } from '../../nucleo/estagios.js';

const esc = (v) => String(v ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const val = (id) => document.getElementById(id)?.value?.trim() ?? '';

const CAMPO = 'width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:var(--r-md);font-size:14px;font-family:inherit;background:var(--surface);color:var(--text-1);outline:none';
const ROTULO = 'display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:5px';
const linha = (rotulo, campo) => `<div style="margin-bottom:14px"><label style="${ROTULO}">${rotulo}</label>${campo}</div>`;
const duas  = (a, b) => `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">${a}${b}</div>`;

/* Um so tratador de erro para toda gravacao: a mensagem do banco e tecnica
   demais para a tela, mas esconder o erro e pior. Traduzimos o que sabemos
   traduzir e mostramos o resto como veio. */
function explicar(e) {
  const m = e?.message || String(e);
  if (/row-level security|violates row-level/i.test(m))
    return 'Você não tem permissão para isso — ou o módulo CRM foi desligado para esta organização.';
  if (/duplicate key/i.test(m)) return 'Já existe um registro igual.';
  /* As CHECK do banco chegam como texto tecnico ("violates check constraint
     crm_leads_vagas_check"). Traduzimos as que existem hoje; o resto continua
     aparecendo como veio, porque esconder o erro e pior. */
  if (/crm_leads_vagas_check/.test(m))   return 'A quantidade precisa ser maior que zero — ou pode ficar em branco.';
  if (/crm_leads_valor_check/.test(m))   return 'O valor não pode ser negativo.';
  if (/crm_leads_empresa_check/.test(m)) return 'O nome da empresa precisa ter entre 1 e 160 caracteres.';
  if (/crm_funil_etapas_funil_id_ordem_key/.test(m))
    return 'Duas etapas ficaram com a mesma posição. Recarregue a tela e tente reordenar de novo.';
  return m;
}

async function gravar(ponte, fn, redesenhar, sucesso) {
  try {
    await fn();
    ponte.fecharModal?.();
    ponte.avisar?.(sucesso, 'success');
    await redesenhar();
  } catch (e) {
    ponte.avisar?.(explicar(e), 'error');
  }
}

async function formLead(ponte, redesenhar, lead = null) {
  const [resps, cursos] = await Promise.all([dados.responsaveis(), dados.listar('catalogo')]);
  /* O rotulo do que se vende vem do funil, nao do codigo. Uma organizacao que
     vende servico ve "Serviço"; quem vende curso continua vendo "Treinamento".
     Sem isso o CRM so servia para quem vende treinamento — que era a critica. */
  let rotuloItem = 'Treinamento';
  try { rotuloItem = (await dados.funil())?.tipo_item || 'Treinamento'; } catch { /* modo exemplo */ }
  const opc = (lista, sel, rotuloVazio) =>
    `<option value="">${rotuloVazio}</option>` +
    lista.map(o => `<option value="${esc(o.id)}" ${String(o.id) === String(sel) ? 'selected' : ''}>${esc(o.nome)}</option>`).join('');

  ponte.abrirModal(lead ? 'Editar lead' : 'Novo lead', `
    ${linha('Empresa *', `<input id="crmF_empresa" style="${CAMPO}" value="${esc(lead?.empresa || '')}" placeholder="Nome da empresa">`)}
    ${duas(
      linha('Etapa', `<select id="crmF_estagio" style="${CAMPO}">${ESTAGIOS.map(e => `<option value="${e.id}" ${e.id === (lead?.estagio || 'novo') ? 'selected' : ''}>${esc(e.rotulo)}</option>`).join('')}</select>`),
      linha('Responsável', `<select id="crmF_resp" style="${CAMPO}">${opc(resps, lead?.responsavel_id, 'Sem responsável')}</select>`)
    )}
    ${linha('O que está sendo vendido', `<input id="crmF_titulo" style="${CAMPO}" value="${esc(lead?.titulo || '')}" placeholder="Ex.: ${esc(rotuloItem)} para a unidade de Joinville">`)}
    ${linha(`${esc(rotuloItem)} do catálogo`, `<select id="crmF_curso" style="${CAMPO}">${opc(cursos.filter(c => !c.arquivado), lead?.catalogo_id, 'Nenhum — usar o texto acima')}</select>`)}
    ${linha('Se está fora do catálogo', `<input id="crmF_livre" style="${CAMPO}" value="${esc(lead?.treinamento_livre || '')}" placeholder="Ex.: NR-12 Máquinas">`)}
    ${duas(
      linha('Quantidade', `<input id="crmF_vagas" type="number" min="1" style="${CAMPO}" value="${esc(lead?.vagas ?? '')}" placeholder="participantes, itens...">`),
      linha('Valor (R$)', `<input id="crmF_valor" type="number" min="0" step="0.01" style="${CAMPO}" value="${esc(lead?.valor ?? '')}">`)
    )}
    ${duas(
      linha('Origem', `<input id="crmF_origem" style="${CAMPO}" value="${esc(lead?.origem || '')}" placeholder="WhatsApp, Indicação, Site...">`),
      linha('Previsão de fechamento', `<input id="crmF_previsao" type="date" style="${CAMPO}" value="${esc(lead?.previsao || '')}">`)
    )}
    ${linha('Observações', `<textarea id="crmF_obs" rows="3" style="${CAMPO}">${esc(lead?.observacoes || '')}</textarea>`)}
  `, ponte.botoes('Salvar lead', 'crmSalvarLead'));

  ponte.aoConfirmar('crmSalvarLead', () => gravar(ponte, () => dados.salvarLead({
    id: lead?.id, empresa: val('crmF_empresa'), estagio: val('crmF_estagio'),
    titulo: val('crmF_titulo'),
    responsavel_id: val('crmF_resp') || null, catalogo_id: val('crmF_curso') || null,
    treinamento_livre: val('crmF_livre') || null, vagas: val('crmF_vagas'),
    valor: val('crmF_valor'), origem: val('crmF_origem'), observacoes: val('crmF_obs'),
    previsao: val('crmF_previsao') || null
  }), redesenhar, lead ? 'Lead atualizado.' : 'Lead criado.'));
}

/* Uma atividade e um combinado entre duas pessoas: quem pede e quem faz. O
   formulario mostra os dois lados — e por isso serve tanto para "me lembrar de
   ligar" quanto para "peca ao Diego que ligue". */
const TIPOS_ATIVIDADE = [['tarefa','Tarefa'],['ligacao','Ligação'],['email','E-mail'],
  ['reuniao','Reunião'],['visita','Visita'],['proposta','Proposta'],['whatsapp','WhatsApp']];

/* datetime-local nao aceita ISO com fuso: precisa de "AAAA-MM-DDTHH:MM" na hora
   local. Sem esta conversao, editar uma atividade abria o campo de data vazio e
   salvar apagava o vencimento — perder o horario de um compromisso e pior do
   que nao poder edita-lo. */
function paraCampoLocal(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

async function formAtividade(ponte, redesenhar, alvoLead = null, ativ = null) {
  const [resps, leads, contatos, clientes] = await Promise.all([
    dados.responsaveis(),
    dados.listar('crm_leads').catch(() => []),
    dados.listar('crm_contatos').catch(() => []),
    dados.clientes().catch(() => [])
  ]);
  const eu = sessao.usuario() || null;
  const editando = !!ativ;

  const opcResp = (sel) => `<option value="">Sem responsável</option>` +
    resps.map(r => `<option value="${esc(r.id)}" ${String(r.id) === String(sel) ? 'selected' : ''}>${esc(r.nome)}${eu && r.id === eu.id ? ' (você)' : ''}</option>`).join('');

  /* A que isto se refere. Um CRM padrao liga atividade a negocio, pessoa OU
     empresa — nem toda tarefa nasce de uma oportunidade, e uma organizacao que
     nao vende treinamento vive quase so de "ligar para a empresa X". O valor
     carrega o tipo junto ("lead:<id>") para nao precisar de dois campos. */
  const alvoSel = ativ?.alvo_tipo && ativ?.alvo_id ? `${ativ.alvo_tipo}:${ativ.alvo_id}`
                : (alvoLead ? `lead:${alvoLead}` : '');
  const grupo = (rotulo, itens, tipo, texto) => itens.length
    ? `<optgroup label="${rotulo}">${itens.slice(0, 300).map(i => {
        const v = `${tipo}:${i.id}`;
        return `<option value="${esc(v)}" ${v === alvoSel ? 'selected' : ''}>${esc(texto(i))}</option>`;
      }).join('')}</optgroup>` : '';

  const opcLead = () => `<option value="" ${alvoSel === '' ? 'selected' : ''}>Nenhum — atividade avulsa</option>`
    + grupo('Negócios em aberto', leads, 'lead',
        (l) => `${l.empresa}${(l.item || l.treinamento) ? ' — ' + (l.item || l.treinamento) : ''}`)
    + grupo('Pessoas', contatos, 'contato',
        (c) => `${c.nome}${c.empresa ? ' · ' + c.empresa : ''}`)
    + grupo('Empresas', clientes, 'cliente', (e) => e.nome);

  const rodapeInfo = editando ? `
    <div style="margin-top:4px;padding-top:12px;border-top:1px solid var(--border);
                font-size:12px;color:var(--text-3);line-height:1.7">
      ${ativ.autor ? `Criada por <b style="color:var(--text-2)">${esc(ativ.autor)}</b>` : 'Criada'}
      ${ativ.criado_em ? ' em ' + new Date(ativ.criado_em).toLocaleDateString('pt-BR') : ''}
      ${ativ.concluida ? ` · <b style="color:var(--green-text)">concluída em ${new Date(ativ.concluida_em).toLocaleDateString('pt-BR')}</b>` : ''}
    </div>` : '';

  ponte.abrirModal(editando ? 'Atividade' : 'Nova atividade', `
    ${linha('Assunto *', `<input id="crmA_assunto" style="${CAMPO}" value="${esc(ativ?.assunto || '')}" placeholder="Ligar para o cliente, enviar proposta...">`)}
    ${duas(
      linha('Tipo', `<select id="crmA_tipo" style="${CAMPO}">${
        TIPOS_ATIVIDADE.map(([v,r]) => `<option value="${v}" ${v === (ativ?.tipo || 'tarefa') ? 'selected' : ''}>${r}</option>`).join('')}</select>`),
      linha('Vence em', `<input id="crmA_venc" type="datetime-local" style="${CAMPO}" value="${paraCampoLocal(ativ?.vencimento)}">`)
    )}
    ${linha('Responsável — quem vai fazer', `<select id="crmA_resp" style="${CAMPO}">${opcResp(ativ?.responsavel_id)}</select>`)}
    ${linha('Relacionada a', `<select id="crmA_lead" style="${CAMPO}">${opcLead()}</select>`)}
    ${linha('Descrição', `<textarea id="crmA_desc" rows="3" style="${CAMPO}" placeholder="O que precisa ser feito, o que já foi combinado...">${esc(ativ?.descricao || '')}</textarea>`)}
    ${rodapeInfo}
  `, editando
      ? `<button class="btn btn-outline" id="crmExcluirAtividade" style="margin-right:auto;color:var(--red-text)">Excluir</button>
         <button class="btn btn-outline" id="crmConcluirAtividade">${ativ.concluida ? 'Reabrir' : 'Concluir'}</button>
         <button class="btn btn-navy" id="crmSalvarAtividade">Salvar</button>`
      : ponte.botoes('Salvar atividade', 'crmSalvarAtividade'));

  ponte.aoConfirmar('crmSalvarAtividade', () => gravar(ponte, () => dados.salvarAtividade({
    id: ativ?.id,
    assunto: val('crmA_assunto'), tipo: val('crmA_tipo'),
    vencimento: val('crmA_venc') || null, responsavel_id: val('crmA_resp') || null,
    descricao: val('crmA_desc') || null,
    alvo_tipo: val('crmA_lead') ? val('crmA_lead').split(':')[0] : null,
    alvo_id:   val('crmA_lead') ? val('crmA_lead').split(':')[1] : null
  }), redesenhar, editando ? 'Atividade atualizada.' : 'Atividade criada.'));

  if (editando) {
    ponte.aoConfirmar('crmConcluirAtividade', () => gravar(ponte,
      () => dados.concluirAtividade(ativ.id, !ativ.concluida), redesenhar,
      ativ.concluida ? 'Atividade reaberta.' : 'Atividade concluída.'));
    ponte.aoConfirmar('crmExcluirAtividade', async () => {
      const ok = await ponte.confirmar?.('Excluir esta atividade? Ela sai da lista e continua no histórico.');
      if (ok) await gravar(ponte, () => dados.excluirAtividade(ativ.id), redesenhar, 'Atividade excluída.');
    });
  }
}

async function formContato(ponte, redesenhar, contato = null) {
  const clientes = await dados.clientes();
  ponte.abrirModal(contato ? 'Editar contato' : 'Novo contato', `
    ${linha('Nome *', `<input id="crmC_nome" style="${CAMPO}" value="${esc(contato?.nome || '')}">`)}
    ${duas(
      linha('Cargo', `<input id="crmC_cargo" style="${CAMPO}" value="${esc(contato?.cargo || '')}">`),
      linha('Telefone', `<input id="crmC_tel" style="${CAMPO}" value="${esc(contato?.telefone || '')}" placeholder="(47) 99999-0000">`)
    )}
    ${linha('E-mail', `<input id="crmC_email" type="email" style="${CAMPO}" value="${esc(contato?.email || '')}">`)}
    ${linha('Empresa cliente', `<select id="crmC_cli" style="${CAMPO}"><option value="">Ainda não é cliente</option>${
      clientes.map(c => `<option value="${esc(c.id)}" ${String(c.id) === String(contato?.cliente_id) ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select>`)}
    ${linha('Origem', `<input id="crmC_origem" style="${CAMPO}" value="${esc(contato?.origem || '')}" placeholder="WhatsApp, Indicação...">`)}
  `, ponte.botoes(contato ? 'Salvar' : 'Salvar contato', 'crmSalvarContato'));

  ponte.aoConfirmar('crmSalvarContato', () => gravar(ponte, () => dados.salvarContato({
    id: contato?.id,
    nome: val('crmC_nome'), cargo: val('crmC_cargo'), telefone: val('crmC_tel'),
    email: val('crmC_email'), cliente_id: val('crmC_cli') || null, origem: val('crmC_origem')
  }), redesenhar, contato ? 'Contato atualizado.' : 'Contato criado.'));
}

/* ── Configuracao de funil e etapas (05/09, h17) ──────────────────────────
   A paleta e fechada de proposito: cor livre por etapa e o caminho mais curto
   para um quadro que parece um adesivo. Sete tons do proprio sistema bastam
   para diferenciar cinco colunas. */
const PALETA = [
  ['#1E2A4A','Navy'], ['#8B93A8','Cinza'], ['#B45309','Âmbar'],
  ['#1D4ED8','Azul'], ['#059669','Verde'], ['#6D28D9','Roxo'], ['#BE185D','Rosa']
];

const seletorDeCor = (sel) => `<div class="crm-cores">${PALETA.map(([hex, nome]) => `
  <label title="${nome}"><input type="radio" name="crmE_cor" value="${hex}" ${hex === (sel || '#1E2A4A') ? 'checked' : ''}>
  <span style="background:${hex}"></span></label>`).join('')}</div>`;

const corEscolhida = () => document.querySelector('input[name="crmE_cor"]:checked')?.value || null;

async function formFunil(ponte, redesenhar, funil = null) {
  ponte.abrirModal(funil ? 'Editar funil' : 'Novo funil', `
    ${linha('Nome do funil *', `<input id="crmU_nome" style="${CAMPO}" value="${esc(funil?.nome || '')}" placeholder="Ex.: Vendas de treinamento">`)}
    ${linha('O que este funil vende', `<input id="crmU_item" style="${CAMPO}" value="${esc(funil?.tipo_item || '')}" placeholder="Treinamento, serviço, equipamento...">`)}
    <div style="font-size:12px;color:var(--text-3);line-height:1.6">
      Este texto é só o rótulo que aparece no formulário do lead. Um funil novo já nasce com cinco
      etapas prontas, que você renomeia ou remove em seguida.</div>
  `, ponte.botoes(funil ? 'Salvar' : 'Criar funil', 'crmSalvarFunil'));

  ponte.aoConfirmar('crmSalvarFunil', () => gravar(ponte, () => dados.salvarFunil({
    id: funil?.id, nome: val('crmU_nome'), tipo_item: val('crmU_item')
  }), redesenhar, funil ? 'Funil atualizado.' : 'Funil criado com as etapas iniciais.'));
}

async function formEtapa(ponte, redesenhar, funilId, etapa = null) {
  ponte.abrirModal(etapa ? 'Editar etapa' : 'Nova etapa', `
    ${linha('Nome da etapa *', `<input id="crmE_nome" style="${CAMPO}" value="${esc(etapa?.nome || '')}" placeholder="Ex.: Orçamento enviado">`)}
    ${linha('Tipo', `<select id="crmE_tipo" style="${CAMPO}">${
      [['aberto','Em aberto — o negócio segue no funil'],
       ['ganho','Ganho — fecha o negócio'],
       ['perdido','Perdido — encerra sem venda']]
      .map(([v,r]) => `<option value="${v}" ${v === (etapa?.tipo || 'aberto') ? 'selected' : ''}>${r}</option>`).join('')}</select>`)}
    ${linha('Cor no quadro', seletorDeCor(etapa?.cor))}
    ${etapa ? `<div style="font-size:12px;color:var(--text-3);line-height:1.6">
      Identificador interno: <code>${esc(etapa.slug)}</code> — ele não muda, então renomear a etapa
      não move nenhum lead.</div>` : ''}
  `, ponte.botoes(etapa ? 'Salvar etapa' : 'Criar etapa', 'crmSalvarEtapa'));

  ponte.aoConfirmar('crmSalvarEtapa', () => gravar(ponte, () => dados.salvarEtapa({
    id: etapa?.id, funil_id: funilId, nome: val('crmE_nome'),
    tipo: val('crmE_tipo'), cor: corEscolhida(),
    ordem: etapa?.ordem
  }), redesenhar, etapa ? 'Etapa atualizada.' : 'Etapa criada.'));
}

/* Subir/descer: troca a posicao com a vizinha e regrava a ordem inteira. Com
   cinco a oito etapas, regravar tudo e mais simples e mais seguro do que
   calcular o par minimo — e o resultado nunca fica com ordem repetida. */
async function moverEtapa(ponte, redesenhar, funilId, etapaId, passo) {
  const f = await dados.funil(funilId);
  const ids = f.etapas.map(e => e.id);
  const i = ids.indexOf(etapaId);
  const j = i + passo;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  await gravar(ponte, () => dados.reordenarEtapas(funilId, ids), redesenhar, 'Ordem atualizada.');
}

/* ── O ponto de entrada que a plataforma chama ────────────────────────────
   Devolve `true` quando tratou. `false` faz a casca avisar que a acao ainda
   nao existe — melhor do que um clique que nao faz nada e nao diz por que. */
/* Tudo que so existe quando houver gateway de WhatsApp. Tratado aqui, e nao
   deixado cair no "acao desconhecida", para a mensagem ser a verdadeira: nao e
   um botao quebrado, e um recurso que ainda nao existe. */
/* ── REVISTO EM 05/09 (h17) ────────────────────────────────────────────────
   Esta lista ficou grande demais e passou a bloquear NAVEGACAO, nao so envio:
   trocar de caixa (`crm:caixa:`), abrir outra conversa (`crm:conversa:`) e
   buscar na lista (`crm:buscar-conversa`) sao leitura de dado ja carregado e
   nao dependem de gateway nenhum. Com elas aqui, a tela de Conversas respondia
   "depende do WhatsApp" a qualquer clique e parecia congelada.
   Ficam so as acoes que de fato precisam do gateway existir. */
const DEPENDE_WHATSAPP = ['crm:nova-conversa', 'crm:conversar:', 'crm:ligar:', 'crm:reconectar:',
  'crm:add-numero', 'crm:horarios', 'crm:respostas', 'crm:importar-contatos', 'crm:anexar',
  'crm:acesso:', 'crm:enviar', 'crm:qr', 'crm:modelo:', 'crm:resolver:', 'crm:vincular:',
  'crm:mais:', 'crm:editar-numero:', 'crm:qr-lido', 'crm:remover:'];

export default async function acoes(acao, { redesenhar }) {
  const ponte = (typeof window !== 'undefined' && window.__GRID_PONTE) || {};
  if (!ponte.abrirModal) return false;

  if (DEPENDE_WHATSAPP.some(p => acao === p || acao.startsWith(p))) {
    ponte.avisar?.('Esta parte depende da integração com WhatsApp, que ainda não foi construída.', 'error');
    return true;
  }
  const [, resto] = [acao.split(':')[0], acao.split(':').slice(1).join(':')];

  if (acao === 'crm:novo-lead')     { await formLead(ponte, redesenhar); return true; }
  if (acao === 'crm:nova-atividade'){ await formAtividade(ponte, redesenhar); return true; }
  if (acao.startsWith('crm:nova-atividade:')) { await formAtividade(ponte, redesenhar, resto.replace('nova-atividade:', '')); return true; }
  if (acao === 'crm:novo-contato')  { await formContato(ponte, redesenhar); return true; }

  if (acao.startsWith('crm:editar-lead:')) {
    const lead = await dados.obter('crm_leads', resto.replace('editar-lead:', ''));
    if (lead) await formLead(ponte, redesenhar, lead);
    return true;
  }

  // As telas aprovadas ja declaravam estes nomes; o tratador se adapta a elas,
  // e nao o contrario — mudar a tela para caber no codigo seria inverter quem
  // manda.
  if (acao.startsWith('crm:estagio:')) {
    const [id, slug] = resto.replace('estagio:', '').split(':');
    await gravar(ponte, () => dados.moverLead(id, slug), redesenhar, 'Lead movido.');
    return true;
  }

  /* Marcar ganho NÃO cria turma nem cliente.
     Decisão do Alisson em 05/09: quem cria a turma é o operador, na tela de
     Turmas. Automatizar aqui geraria turma sem instrutor, sem data e sem
     confirmação — e a venda também acontece fora do CRM, então o CRM não pode
     ser a única porta de entrada de turma. O que a tela faz é dizer o que
     acontece e apontar o caminho; quem decide é a pessoa.
     Detalhe em 05-Decisoes/2026-09-05-lead-ganho-nao-cria-turma.md */
  if (acao.startsWith('crm:ganho:')) {
    const id = resto.split(':')[1];
    const lead = await dados.obter('crm_leads', id).catch(() => null);
    ponte.abrirModal('Marcar como ganho', `
      <div style="font-size:14px;color:var(--text-2);line-height:1.7">
        <b style="color:var(--text-1)">${esc(lead?.empresa || 'Este negócio')}</b> vai para a etapa de ganho
        e sai do quadro de negociação.
      </div>
      <div style="margin-top:14px;padding:12px 14px;background:var(--gray-50);border-radius:var(--r-md);
                  font-size:13px;color:var(--text-2);line-height:1.65">
        <b style="color:var(--text-1)">A turma não é criada automaticamente.</b><br>
        Quem monta a turma é o operador, em Turmas — com instrutor, datas e participantes.
        O negócio fica registrado aqui como ganho, e o histórico da empresa mostra a venda.
      </div>
    `, `<button class="btn btn-outline" onclick="fecharModal()">Cancelar</button>
        <button class="btn btn-navy" id="crmConfirmarGanho">Marcar como ganho</button>`);
    ponte.aoConfirmar('crmConfirmarGanho', () => gravar(ponte,
      () => dados.moverLead(id, 'ganho'), redesenhar, 'Negócio ganho. A turma é criada em Turmas, quando você quiser.'));
    return true;
  }

  /* Perder pede o MOTIVO na hora. Perguntar depois nao funciona: ninguem volta
     para preencher, e uma taxa de perda sem motivo nao ensina nada. */
  if (acao.startsWith('crm:perdido:')) {
    const id = resto.split(':')[1];
    const motivos = await dados.motivosPerda().catch(() => []);
    if (!motivos.length) {
      const ok = await ponte.confirmar?.('Marcar como perdido? Ele continua no histórico.');
      if (ok) await gravar(ponte, () => dados.moverLead(id, 'perdido'), redesenhar, 'Negócio marcado como perdido.');
      return true;
    }
    ponte.abrirModal('Marcar como perdido', `
      ${linha('Motivo da perda *', `<select id="crmP_motivo" style="${CAMPO}">
        <option value="">Escolha um motivo</option>
        ${motivos.map(m => `<option value="${esc(m.id)}">${esc(m.nome)}</option>`).join('')}</select>`)}
      ${linha('O que aconteceu (opcional)', `<textarea id="crmP_obs" rows="3" style="${CAMPO}" placeholder="Detalhe que ajude a próxima negociação parecida"></textarea>`)}
      <div style="font-size:12px;color:var(--text-3);line-height:1.6">
        O negócio sai do quadro e continua no histórico da empresa. O motivo alimenta o relatório
        de perdas do painel.</div>
    `, ponte.botoes('Marcar como perdido', 'crmSalvarPerda'));
    ponte.aoConfirmar('crmSalvarPerda', () => {
      if (!val('crmP_motivo')) { ponte.avisar?.('Escolha o motivo da perda.', 'error'); return; }
      return gravar(ponte, () => dados.perderLead(id, {
        motivo_id: val('crmP_motivo'), observacao: val('crmP_obs') || null
      }), redesenhar, 'Negócio marcado como perdido.');
    });
    return true;
  }

  if (acao.startsWith('crm:excluir-lead:')) {
    const id = resto.replace('excluir-lead:', '');
    const ok = await ponte.confirmar?.('Excluir este lead? Ele sai da lista, mas continua no histórico e pode ser restaurado.');
    if (ok) await gravar(ponte, () => dados.excluirLead(id), redesenhar, 'Lead excluído.');
    return true;
  }

  /* Arrastar cartao no quadro. A tela ja moveu o cartao na hora; aqui e a
     gravacao — e o redesenho traz a verdade do banco de volta. */
  if (acao.startsWith('crm:mover-lead:')) {
    const [id, slug] = resto.replace('mover-lead:', '').split(':');
    await gravar(ponte, () => dados.moverLead(id, slug), redesenhar, 'Negócio movido.');
    return true;
  }

  if (acao === 'crm:novo-funil')          { await formFunil(ponte, redesenhar); return true; }
  if (acao.startsWith('crm:editar-funil:')) {
    const f = await dados.funil(resto.replace('editar-funil:', ''));
    await formFunil(ponte, redesenhar, f);
    return true;
  }
  if (acao.startsWith('crm:nova-etapa:'))  { await formEtapa(ponte, redesenhar, resto.replace('nova-etapa:', '')); return true; }
  if (acao.startsWith('crm:editar-etapa:')) {
    const [funilId, etapaId] = resto.replace('editar-etapa:', '').split(':');
    const f = await dados.funil(funilId);
    await formEtapa(ponte, redesenhar, funilId, f.etapas.find(e => e.id === etapaId));
    return true;
  }
  if (acao.startsWith('crm:subir-etapa:') || acao.startsWith('crm:descer-etapa:')) {
    const sobe = acao.startsWith('crm:subir-etapa:');
    const [funilId, etapaId] = resto.replace(sobe ? 'subir-etapa:' : 'descer-etapa:', '').split(':');
    await moverEtapa(ponte, redesenhar, funilId, etapaId, sobe ? -1 : 1);
    return true;
  }
  if (acao.startsWith('crm:remover-etapa:')) {
    const id = resto.replace('remover-etapa:', '');
    const ok = await ponte.confirmar?.('Remover esta etapa do funil? Ela sai do quadro, e o histórico dos leads que passaram por ela continua registrado.');
    if (ok) await gravar(ponte, () => dados.arquivarEtapa(id), redesenhar, 'Etapa removida do funil.');
    return true;
  }

  /* Clique numa linha de Contatos. Ate 05/09 caia em "acao nao esta pronta" —
     a lista inteira era decorativa. */
  if (acao.startsWith('crm:contato:')) {
    const c = await dados.obter('crm_contatos', resto.replace('contato:', ''));
    if (c) await formContato(ponte, redesenhar, c);
    else ponte.avisar?.('Contato não encontrado.', 'error');
    return true;
  }

  /* Clique no cartao/linha de uma atividade. Ate 05/09 nao existia: dava para
     criar e concluir, nunca abrir. */
  if (acao.startsWith('crm:atividade:')) {
    const a = await dados.obterAtividade(resto.replace('atividade:', ''));
    if (a) await formAtividade(ponte, redesenhar, null, a);
    else ponte.avisar?.('Atividade não encontrada.', 'error');
    return true;
  }

  if (acao.startsWith('crm:reagendar:')) {
    const [id, destino] = resto.replace('reagendar:', '').split(':');
    const msg = { feitas:'Atividade concluída.', hoje:'Reagendada para hoje.', proximas:'Reagendada para amanhã.' }[destino] || 'Atividade atualizada.';
    await gravar(ponte, () => dados.reagendarAtividade(id, destino), redesenhar, msg);
    return true;
  }

  if (acao.startsWith('crm:concluir:')) {
    await gravar(ponte, () => dados.concluirAtividade(resto.replace('concluir:', ''), true),
                 redesenhar, 'Atividade concluída.');
    return true;
  }

  return false;
}
