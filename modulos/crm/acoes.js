/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/crm/acoes.js
   Onde as acoes declaradas pelas telas viram escrita no banco.

   O modulo NAO conhece o app: ele pede modal, aviso e confirmacao pela ponte
   (GRID.ponte), que a casca preenche uma vez na entrada. E o que permite a
   mesma tela rodar dentro do app e no demo.html sem uma linha diferente.
   ══════════════════════════════════════════════════════════════════════════ */

import * as dados from '../../nucleo/dados.js';
import * as sessao from '../../nucleo/sessao.js';
import * as navegacao from '../../nucleo/navegacao.js';
import { ESTAGIOS } from '../../nucleo/estagios.js';

const esc = (v) => String(v ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ── 14/09 ──────────────────────────────────────────────────────────────────
   A casca desenha a mesma tela duas vezes (corpo de computador e corpo de
   celular) e esconde uma por CSS. Todo `id` existe em duplicata, e
   `getElementById` devolve sempre a de computador — invisível no celular.
   Consequência real: no celular, qualquer formulário deste arquivo lia campo
   vazio, e o envio de mensagem respondia "Escreva uma mensagem antes de
   enviar" com a mensagem escrita na tela. Ler sempre a cópia visível. */
const elVisivel = (id) => {
  const todos = [...document.querySelectorAll(`[id="${id}"]`)];
  return todos.find(e => e.getBoundingClientRect().width > 0) || todos[0] || null;
};
const val = (id) => elVisivel(id)?.value?.trim() ?? '';

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

/* Devolve `true` se gravou. Quem chama precisa saber: limpar o campo de
   mensagem depois de um envio que FALHOU apaga o texto da pessoa e não envia
   nada — o pior dos dois mundos. */
async function gravar(ponte, fn, redesenhar, sucesso) {
  try {
    await fn();
    ponte.fecharModal?.();
    ponte.avisar?.(sucesso, 'success');
    await redesenhar();
    return true;
  } catch (e) {
    ponte.avisar?.(explicar(e), 'error');
    return false;
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

/* ── Abrir a conversa recém-criada ─────────────────────────────────────────
   Duas situações, e as duas precisam terminar com a conversa na frente da
   pessoa:
     · já estou na tela de Conversas (cliquei num contato pela aba Contatos)
       → basta avisar a tela qual conversa abrir e redesenhar;
     · estou na tela de Contatos do CRM → é navegação de verdade.
   O `import('./conversas.js')` devolve a MESMA instância que a plataforma
   carregou (mesmo caminho relativo, sem `?v=`) — é o que permite mexer no
   estado da tela daqui. Repetir a lição do h16: caminho diferente seria um
   segundo módulo, com estado próprio, e nada funcionaria. */
async function abrirAConversa(id, redesenhar) {
  try {
    const tela = await import('./conversas.js');
    tela.abrirConversa?.(id);
  } catch { /* sem a tela carregada, a navegação abaixo resolve sozinha */ }

  if (navegacao.rotaAtual?.() === 'crm-conversas') { await redesenhar(); return; }
  await navegacao.tratarAcao('ir:crm-conversas:' + id);
}

/* Por qual número falar. Com uma caixa só — que é o caso de hoje — não há
   pergunta a fazer. Com várias, prefere uma conectada e DIZ qual usou, em vez
   de escolher em silêncio: quem tem dois números precisa saber por qual o
   cliente vai ver a mensagem chegando. Escolha explícita existe em "Criar
   novo". */
async function caixaParaFalar(ponte) {
  const caixas = await dados.listar('crm_caixas').catch(() => []);
  if (!caixas.length) {
    ponte.avisar?.('Nenhum número de WhatsApp cadastrado ainda. Cadastre um em CRM → WhatsApp.', 'error');
    return null;
  }
  const escolhida = caixas.find(c => c.estado === 'conectado') || caixas[0];
  if (caixas.length > 1) ponte.avisar?.(`Falando pelo número "${escolhida.nome}".`, 'success');
  return escolhida;
}

/* ── O ponto de entrada que a plataforma chama ────────────────────────────
   Devolve `true` quando tratou. `false` faz a casca avisar que a acao ainda
   nao existe — melhor do que um clique que nao faz nada e nao diz por que. */
/* Tudo que so existe quando houver gateway de WhatsApp. Tratado aqui, e nao
   deixado cair no "acao desconhecida", para a mensagem ser a verdadeira: nao e
   um botao quebrado, e um recurso que ainda nao existe. */
/* ── REVISTO EM 13/09 ──────────────────────────────────────────────────────
   PASSO-37/PASSO-40 e o gateway em VPS ligaram de verdade: criar caixa
   (`crm:add-numero`), enviar mensagem (`crm:enviar:`) e marcar conversa como
   resolvida (`crm:resolver:`) agora escrevem no banco de verdade — saem
   daqui e ganham tratador proprio logo abaixo. `crm:qr-lido` so fecha um
   modal local, nunca dependeu de gateway nenhum. `crm:qr` virou `crm:qr:`
   para bloquear so a acao real "ver a imagem do QR Code", que ainda nao foi
   construida (o modal de conexao hoje mostra um icone decorativo, nao o QR
   de verdade — ver 05-Decisoes, pendencia de UI separada).
   ── REVISTO EM 14/09, depois de uma auditoria ação por ação ──────────────
   A lista estava MENTINDO em oito das catorze entradas. "Vincular a um
   negócio" não tem nada a ver com WhatsApp — e era o que o Alisson clicava
   quando recebia a mensagem de que dependia da integração. Editar o nome de
   um número, ver quem tem acesso, definir horário de atendimento: nada disso
   passa pelo gateway. `crm:mais:` nem existe mais como botão em tela alguma.

   Agora são duas listas, porque são dois motivos diferentes, e dizer o motivo
   errado é pior do que não dizer nada:
     · DEPENDE_WHATSAPP — falta capacidade no gateway.
     · NAO_CONSTRUIDO  — a tela ainda não foi feita, e é só isso.
   Quem saiu das duas listas ganhou tratador de verdade logo abaixo.

   ── REVISTO DE NOVO EM 14/09 (madrugada) ─────────────────────────────────
   `crm:nova-conversa` e `crm:conversar:` SAÍRAM da lista, e a justificativa
   que estava escrita aqui — "exige janela de 24h e modelo aprovado" — estava
   errada. Essa regra é da API PAGA do WhatsApp (a Cloud API da Meta). O nosso
   gateway não usa essa API: ele entra como um aparelho conectado de um
   WhatsApp comum, e um WhatsApp comum puxa assunto com quem quiser, como
   qualquer vendedor faz no celular. Eu apliquei a regra da API paga a uma
   conexão que não é ela, e isso bloqueou por semanas a função que o Alisson
   mais sentia falta.

   O que continua verdade, e por isso fica: MÍDIA. O gateway hoje só manda
   texto (`sendMessage({ text })` em index.js, na VPS); anexar arquivo exige
   subir o arquivo para algum lugar e ensinar o gateway a enviá-lo. É
   trabalho de verdade, não trava de política.

   Cuidado de operação que vale registrar: WhatsApp comum não tem trava, mas
   tem antispam. Puxar assunto com um cliente de cada vez é o uso normal;
   disparo em massa para quem nunca falou com a gente é o caminho mais curto
   para o número do cliente ser bloqueado. A tela permite um de cada vez, de
   propósito — não existe "enviar para todos". */
/* ── 15/09: a lista esvaziou ───────────────────────────────────────────────
   `crm:anexar` era o último morador. O gateway aprendeu a enviar arquivo e a
   guardar o que chega (PASSO-44 + index.js da VPS), então a trava deixou de
   ter razão de existir.

   A lista fica, vazia, de propósito: ela é o lugar certo para uma
   funcionalidade que a tela desenha mas o gateway ainda não faz. O erro que
   ela evita é o pior de todos — botão que promete e não cumpre. */
const DEPENDE_WHATSAPP = [];

/* ── 14/09 (madrugada), segunda revisão ────────────────────────────────────
   Cinco entradas saíram desta lista e ganharam tratador de verdade logo
   abaixo: `crm:acesso:`, `crm:qr:`, `crm:reconectar:`, `crm:editar-numero:` e
   `crm:remover:`.

   O motivo: o número da TOLEDO SST caiu às 07:08, o Alisson clicou em
   "Reconectar" e recebeu "esta tela ainda não foi construída". Não havia
   caminho de volta pela interface — o WhatsApp do cliente ficaria fora do ar
   até alguém rodar SQL na mão. Um botão desenhado na tela, em destaque, que
   responde que não existe, é pior do que botão nenhum: ele promete uma saída
   que não está lá. Estado pendente não pode morar num botão principal.

   Continuam aqui só as três que de fato não têm tela nenhuma por trás, e
   nenhuma delas bloqueia operação. */
const NAO_CONSTRUIDO = ['crm:respostas', 'crm:importar-contatos', 'crm:horarios'];

export default async function acoes(acao, { redesenhar }) {
  const ponte = (typeof window !== 'undefined' && window.__GRID_PONTE) || {};
  if (!ponte.abrirModal) return false;

  if (DEPENDE_WHATSAPP.some(p => acao === p || acao.startsWith(p))) {
    ponte.avisar?.('Enviar arquivo ainda não está pronto: o gateway do WhatsApp hoje só envia texto. Está na fila de entregas.', 'error');
    return true;
  }
  if (NAO_CONSTRUIDO.some(p => acao === p || acao.startsWith(p))) {
    ponte.avisar?.('Esta tela ainda não foi construída.', 'error');
    return true;
  }
  const [, resto] = [acao.split(':')[0], acao.split(':').slice(1).join(':')];

  /* Ligar para o contato: o próprio aparelho resolve. Estava bloqueado como
     se dependesse do gateway, e nunca dependeu. */
  if (acao.startsWith('crm:ligar:')) {
    const tel = String(resto.replace('ligar:', '')).replace(/\D/g, '');
    if (!tel) { ponte.avisar?.('Este contato não tem telefone cadastrado.', 'error'); return true; }
    window.open(`tel:+${tel.length > 11 ? tel : '55' + tel}`, '_self');
    return true;
  }

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

  /* Sobra do modal de conexão antigo, que foi substituído pelo QR de verdade
     (`crm:qr:`, acima). Fica tratado para um clique guardado em algum lugar
     não virar "ação desconhecida". */
  if (acao === 'crm:qr-lido') { ponte.fecharModal?.(); return true; }

  /* Cria a linha da caixa em crm_caixas. O gateway descobre o numero novo
     sozinho, em ate 30s (PASSO-40) — nao ha QR de verdade para mostrar aqui
     ainda (pendencia de UI separada), entao o aviso deixa isso claro. */
  if (acao === 'crm:add-numero') {
    ponte.abrirModal('Adicionar número de WhatsApp', `
      ${linha('Nome desta caixa *', `<input id="crmN_nome" style="${CAMPO}" placeholder="Ex.: Comercial, Financeiro, Filial Joinville">`)}
      ${linha('Horário de atendimento (opcional)', `<input id="crmN_horario" style="${CAMPO}" placeholder="Ex.: Seg a sex · 08h-18h">`)}
      <div style="font-size:12px;color:var(--text-3);line-height:1.6">
        Depois de criar, o número aparece em "WhatsApp" como aguardando conexão. O gateway detecta o
        número novo sozinho em até 30 segundos.</div>
    `, ponte.botoes('Criar', 'crmCriarCaixa'));

    ponte.aoConfirmar('crmCriarCaixa', () => gravar(ponte, async () => {
      const nome = val('crmN_nome');
      if (!nome) throw new Error('Dê um nome para este número.');
      await dados.criarCaixaWhatsapp({ nome, horario: val('crmN_horario') || null });
    }, redesenhar, 'Número criado. Assim que o gateway conectar, ele aparece como conectado em WhatsApp.'));
    return true;
  }

  /* ══════════════════════════════════════════════════════════════════════
     CONFIGURAÇÃO DO NÚMERO DE WHATSAPP (14/09)
     Tudo aqui é escrita em `crm_caixas`. Ninguém entra na VPS: o gateway lê
     essa tabela a cada 30 segundos e obedece — é o desenho do PASSO-40.
     ══════════════════════════════════════════════════════════════════════ */

  /* Reconectar = desligar e religar a caixa, com a espera no meio.
     Por que em dois tempos, e não num clique só: o gateway só percebe a
     mudança na descoberta seguinte, que roda a cada 30 segundos. Religar
     antes disso não encerra sessão nenhuma — ele nem chegou a ver que a
     caixa saiu do ar, e o "reconectar" não reconectaria nada.

     A espera é visível e o botão só libera no fim. Se esta janela for fechada
     no meio, o número fica desligado — e a tela de Números passa a mostrar um
     aviso vermelho com "Religar agora", que é um clique. Não existe caminho
     sem saída. */
  if (acao.startsWith('crm:reconectar:')) {
    const id = resto.replace('reconectar:', '');
    const ESPERA = 35; // 30s da descoberta + folga

    ponte.abrirModal('Reconectar número', `
      <div style="font-size:14px;color:var(--text-2);line-height:1.7">
        Vou desligar e religar este número. É o mesmo que reiniciar a conexão dele com o WhatsApp.
      </div>
      <div style="margin-top:14px;padding:12px 14px;background:var(--gray-50);border-radius:var(--r-md);
                  font-size:13px;color:var(--text-2);line-height:1.65">
        <b style="color:var(--text-1)">O que acontece:</b><br>
        1. O número é desligado agora.<br>
        2. O servidor leva até 30 segundos para encerrar a sessão antiga.<br>
        3. Você clica em <b>Religar agora</b> e ele abre uma conexão nova.<br><br>
        Nenhuma conversa é apagada. As mensagens que chegarem nesse meio tempo entram assim que voltar.
      </div>
      <div id="crmReconectarEstado" style="margin-top:14px;font-size:14px;font-weight:700;color:var(--amber-text, var(--atencao-text))"></div>
    `, ponte.botoes('Religar agora', 'crmReligarAgora'));

    const mostrar = (t) => { const e = document.getElementById('crmReconectarEstado'); if (e) e.textContent = t; };
    const botao = () => document.getElementById('crmReligarAgora');
    if (botao()) botao().disabled = true;

    try {
      await dados.definirCaixaAtiva(id, false);
    } catch (e) {
      ponte.avisar?.(explicar(e), 'error');
      ponte.fecharModal?.();
      return true;
    }

    let resta = ESPERA;
    mostrar(`Número desligado. Aguarde ${resta} segundos…`);
    const relogio = setInterval(() => {
      resta -= 1;
      if (resta > 0) { mostrar(`Número desligado. Aguarde ${resta} segundos…`); return; }
      clearInterval(relogio);
      mostrar('Pronto. Clique em "Religar agora".');
      if (botao()) botao().disabled = false;
    }, 1000);

    ponte.aoConfirmar('crmReligarAgora', async () => {
      clearInterval(relogio);
      await gravar(ponte, () => dados.definirCaixaAtiva(id, true), redesenhar,
        'Número religado. Em até 30 segundos ele aparece como conectado — ou pede um QR Code novo.');
    });
    return true;
  }

  /* Religar direto: para quem já está desligado (inclusive se a janela de
     reconectar foi fechada no meio do caminho). */
  if (acao.startsWith('crm:religar:')) {
    const id = resto.replace('religar:', '');
    await gravar(ponte, () => dados.definirCaixaAtiva(id, true), redesenhar,
      'Número religado. Em até 30 segundos ele aparece como conectado — ou pede um QR Code novo.');
    return true;
  }

  /* Desligar. NÃO apaga: `ativa = false`. Apagar a linha levaria junto, por
     cascata, todas as conversas e mensagens daquele número. */
  if (acao.startsWith('crm:remover:')) {
    const id = resto.replace('remover:', '');
    const ok = await ponte.confirmar?.(
      'Desligar este número? Nenhuma mensagem entra nem sai por ele enquanto estiver desligado. '
      + 'As conversas e o histórico continuam guardados, e você pode religar quando quiser.');
    if (ok) await gravar(ponte, () => dados.definirCaixaAtiva(id, false), redesenhar, 'Número desligado.');
    return true;
  }

  if (acao.startsWith('crm:editar-numero:')) {
    const id = resto.replace('editar-numero:', '');
    const caixa = await dados.obter('crm_caixas', id).catch(() => null);
    if (!caixa) { ponte.avisar?.('Número não encontrado.', 'error'); return true; }

    ponte.abrirModal('Editar número', `
      ${linha('Nome deste número *', `<input id="crmE_nome" style="${CAMPO}" value="${esc(caixa.nome || '')}" placeholder="Ex.: Comercial, Financeiro, Filial Joinville">`)}
      ${linha('Horário de atendimento', `<input id="crmE_horario" style="${CAMPO}" value="${esc(caixa.horario || '')}" placeholder="Ex.: Seg a sex · 08h-18h">`)}
      <div style="font-size:12px;color:var(--text-3);line-height:1.6">
        O número de telefone em si não se edita aqui: ele é definido no pareamento, quando o WhatsApp
        do aparelho lê o QR Code. Para trocar de telefone, desligue este número e conecte outro.</div>
    `, ponte.botoes('Salvar', 'crmSalvarCaixa'));

    ponte.aoConfirmar('crmSalvarCaixa', () => gravar(ponte,
      () => dados.salvarCaixa({ id, nome: val('crmE_nome'), horario: val('crmE_horario') }),
      redesenhar, 'Número atualizado.'));
    return true;
  }

  /* Quem acessa. Lista vazia = todos da organização veem, que é o
     comportamento de hoje — e o texto na tela diz isso, em vez de deixar a
     pessoa adivinhar o que "ninguém" significava. */
  if (acao.startsWith('crm:acesso:')) {
    const id = resto.replace('acesso:', '');
    const [caixa, pessoas] = await Promise.all([
      dados.obter('crm_caixas', id).catch(() => null),
      dados.responsaveis().catch(() => [])
    ]);
    if (!caixa) { ponte.avisar?.('Número não encontrado.', 'error'); return true; }
    const atuais = new Set(caixa.equipe || []);

    ponte.abrirModal('Quem acessa este número', `
      <div style="font-size:13px;color:var(--text-2);line-height:1.65;margin-bottom:14px">
        Marque quem deve atender por <b>${esc(caixa.nome)}</b>.
        <b style="color:var(--text-1)">Sem ninguém marcado, todos da organização veem as conversas</b> — que é como está hoje.
      </div>
      <div style="max-height:280px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--r-md);padding:6px">
        ${pessoas.length ? pessoas.map(p => `
          <label style="display:flex;gap:10px;align-items:center;padding:9px 10px;border-radius:var(--r-sm);cursor:pointer;font-size:14px;color:var(--text-1)">
            <input type="checkbox" class="crmAcessoPessoa" value="${esc(p.id)}" ${atuais.has(p.id) ? 'checked' : ''}>
            <span>${esc(p.nome)}</span>
          </label>`).join('')
        : '<div style="padding:12px;font-size:13px;color:var(--text-3)">Nenhum usuário encontrado nesta organização.</div>'}
      </div>
    `, ponte.botoes('Salvar', 'crmSalvarAcesso'));

    ponte.aoConfirmar('crmSalvarAcesso', () => {
      const ids = [...document.querySelectorAll('.crmAcessoPessoa')]
        .filter(e => e.checked).map(e => e.value);
      return gravar(ponte, () => dados.definirEquipeCaixa(id, ids), redesenhar,
        ids.length ? 'Equipe atualizada.' : 'Acesso liberado para todos da organização.');
    });
    return true;
  }

  /* O QR Code de verdade. O texto do código já vinha sendo gravado em
     `crm_caixas.gateway_qr` pelo gateway desde 13/09 — o que faltava era a
     tela mostrar. Até hoje o único jeito de pegar o código era rodar SQL ou
     abrir o log da VPS. */
  if (acao.startsWith('crm:qr:')) {
    const id = resto.replace('qr:', '');
    const caixa = await dados.obter('crm_caixas', id).catch(() => null);
    if (!caixa) { ponte.avisar?.('Número não encontrado.', 'error'); return true; }
    const tela = await import('./numeros.js');
    const m = tela.modalQR(caixa);
    ponte.abrirModal(m.titulo, m.corpo,
      '<button class="btn btn-outline" onclick="fecharModal()">Fechar</button>');
    /* Desenhar depois de abrir: a imagem depende de uma biblioteca que a
       casca carrega sob demanda, e esperar por ela antes de abrir deixaria o
       clique sem resposta por um tempo. */
    tela.pintarQR(caixa.gateway_qr);
    /* O código do WhatsApp morre em segundos. Sem este acompanhamento a
       pessoa precisa fechar e abrir a janela até pegar um válido — foi o que
       aconteceu com o Alisson em 14/09 — e, depois de escanear, a tela não
       dizia que tinha conectado. Agora a janela busca código novo sozinha e
       fecha quando a conexão entra. */
    tela.acompanharQR(id, (c) => {
      ponte.fecharModal?.();
      ponte.avisar?.(`Conectado! O número ${c.numero || ''} está pronto para enviar e receber.`.replace('  ', ' '), 'success');
      redesenhar();
    });
    return true;
  }

  /* ── Começar uma conversa (14/09, madrugada) ────────────────────────────
     Duas portas para a mesma coisa, porque são dois jeitos de pensar:
       · `crm:conversar:<contatoId>` — "quero falar com o Ricardo": veio da
         agenda, o número já está cadastrado.
       · `crm:nova-conversa`         — "quero falar com este número": ainda
         não está na agenda.
     As duas terminam em `dados.iniciarConversa`, que é procura-ou-cria: o
     mesmo número, chamado duas vezes, cai sempre na MESMA conversa, e não em
     duas linhas com o histórico partido no meio. */
  if (acao.startsWith('crm:conversar:')) {
    const contatoId = resto.replace('conversar:', '');
    const contato = await dados.obter('crm_contatos', contatoId).catch(() => null);
    if (!contato) { ponte.avisar?.('Contato não encontrado.', 'error'); return true; }
    if (!contato.telefone) {
      ponte.avisar?.(`${contato.nome} não tem telefone cadastrado. Abra o contato e informe o número.`, 'error');
      return true;
    }
    const caixa = await caixaParaFalar(ponte);
    if (!caixa) return true;
    try {
      const r = await dados.iniciarConversa({
        caixaId: caixa.id, telefone: contato.telefone,
        nome: contato.nome, contatoId: contato.id
      });
      await abrirAConversa(r.id, redesenhar);
    } catch (e) { ponte.avisar?.(explicar(e), 'error'); }
    return true;
  }

  if (acao === 'crm:nova-conversa') {
    const caixas = await dados.listar('crm_caixas').catch(() => []);
    if (!caixas.length) {
      ponte.avisar?.('Nenhum número de WhatsApp cadastrado ainda. Cadastre um em CRM → WhatsApp.', 'error');
      return true;
    }
    ponte.abrirModal('Nova conversa', `
      ${linha('Número de WhatsApp *', `<input id="crmNC_fone" style="${CAMPO}" placeholder="(47) 99999-0000" inputmode="tel">`)}
      ${linha('Nome (opcional)', `<input id="crmNC_nome" style="${CAMPO}" placeholder="Como esta pessoa aparece na lista">`)}
      ${caixas.length > 1 ? linha('Falar por qual número', `<select id="crmNC_caixa" style="${CAMPO}">${
        caixas.map(c => `<option value="${esc(c.id)}">${esc(c.nome)}${c.numero ? ' · ' + esc(c.numero) : ''}</option>`).join('')}</select>`) : ''}
      <label style="display:flex;gap:8px;align-items:flex-start;font-size:13px;color:var(--text-2);line-height:1.5;margin-bottom:14px">
        <input type="checkbox" id="crmNC_salvar" checked style="margin-top:2px">
        <span>Salvar também na agenda de Contatos (só funciona se você preencher o nome)</span></label>
      <div style="font-size:12px;color:var(--text-3);line-height:1.6">
        Se já existir conversa com este número, ela é aberta em vez de duplicada.
        Se o número não tiver WhatsApp, a mensagem fica marcada com erro na conversa.</div>
    `, ponte.botoes('Abrir conversa', 'crmCriarConversa'));

    ponte.aoConfirmar('crmCriarConversa', async () => {
      try {
        const fone = val('crmNC_fone');
        const nome = val('crmNC_nome');
        const caixaId = caixas.length > 1 ? val('crmNC_caixa') : caixas[0].id;
        const querSalvar = !!elVisivel('crmNC_salvar')?.checked;

        let contatoId = null;
        /* 25/09: se a agenda falhar, a pessoa precisa SABER. Antes o erro era
           engolido (`.catch(() => null)`): a conversa abria, o contato não
           era salvo, e depois ninguém o achava na agenda — uma das causas do
           "criei o contato e ele não aparece". Continua certo não impedir a
           conversa: a agenda é comodidade, a conversa é o que foi pedido. */
        let avisoAgenda = '';
        if (querSalvar && nome) {
          try {
            const c = await dados.salvarContato({ nome, telefone: fone, origem: 'WhatsApp' });
            contatoId = c?.id || null;
          } catch (e) {
            avisoAgenda = `O contato NÃO foi salvo na agenda: ${explicar(e)}`;
          }
        } else if (querSalvar && !nome) {
          avisoAgenda = 'O contato não foi salvo na agenda porque ficou sem nome.';
        }

        const r = await dados.iniciarConversa({ caixaId, telefone: fone, nome, contatoId });
        ponte.fecharModal?.();
        const abriu = r.temHistorico ? 'Já existia uma conversa com este número — abri ela.' : 'Conversa aberta. Escreva a primeira mensagem.';
        if (avisoAgenda) ponte.avisar?.(`${abriu} ${avisoAgenda}`, 'error');
        else ponte.avisar?.(abriu, 'success');
        await abrirAConversa(r.id, redesenhar);
      } catch (e) {
        ponte.avisar?.(explicar(e), 'error');
      }
    });
    return true;
  }

  /* Assumir: tira da Fila e põe em Chats, no nome de quem clicou. */
  if (acao.startsWith('crm:assumir:')) {
    const id = resto.replace('assumir:', '');
    await gravar(ponte, () => dados.assumirConversa(id), redesenhar, 'Conversa assumida — ela está agora em Chats.');
    return true;
  }

  /* Envia a mensagem digitada no composer da conversa aberta.
     O campo só é limpo quando a gravação deu certo. Se o envio falhar, o
     texto continua lá para a pessoa tentar de novo — antes ele era apagado
     de qualquer jeito, inclusive no erro. */
  /* ── Anexar arquivo (15/09) ──────────────────────────────────────────────
     O arquivo sobe primeiro e só depois vira mensagem. Podia ser ao contrário
     — mensagem primeiro, arquivo depois —, e aí uma internet que cai no meio
     deixaria na conversa uma mensagem apontando para um arquivo que não
     existe. Preferi o risco inverso: arquivo órfão na área de armazenamento,
     que não estraga conversa nenhuma. */
  if (acao.startsWith('crm:anexar:')) {
    const conversaId = resto.replace('anexar:', '');
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip';
    input.onchange = async () => {
      const arquivo = input.files?.[0];
      if (!arquivo) return;
      try {
        ponte.avisar?.(`Enviando ${arquivo.name}...`, 'success');
        const anexo = await dados.subirArquivoWhatsapp(conversaId, arquivo);
        const legenda = val('crmComposerTexto');
        await dados.enviarMensagem(conversaId, legenda, anexo);
        const campo = elVisivel('crmComposerTexto');
        if (campo) { campo.value = ''; campo.style.height = 'auto'; }
        ponte.avisar?.('Arquivo na fila de envio.', 'success');
        redesenhar();
      } catch (e) {
        ponte.avisar?.(e?.message || 'Não foi possível enviar o arquivo.', 'error');
      }
    };
    input.click();
    return true;
  }

  /* ── Gravar áudio (15/09) ────────────────────────────────────────────────
     Um clique começa, outro termina e envia. Sem "segure para falar": em
     computador, segurar o botão por trinta segundos é desconfortável, e no
     celular a tela apaga.

     O navegador grava em opus dentro de um envelope webm — o WhatsApp espera
     opus dentro de ogg. Na prática os aparelhos tocam assim mesmo; se algum
     não tocar, o conserto é converter na VPS (ffmpeg), não aqui. */
  if (acao.startsWith('crm:gravar:')) {
    const conversaId = resto.replace('gravar:', '');
    const botao = elVisivel('crmMic');

    if (window.__crmGravador?.state === 'recording') {
      window.__crmGravador.stop();
      return true;
    }
    try {
      const fluxo = await navigator.mediaDevices.getUserMedia({ audio: true });
      const gravador = new MediaRecorder(fluxo);
      const pedacos = [];
      const inicio = Date.now();
      window.__crmGravador = gravador;

      gravador.ondataavailable = (e) => { if (e.data?.size) pedacos.push(e.data); };
      gravador.onstop = async () => {
        fluxo.getTracks().forEach(t => t.stop());
        window.__crmGravador = null;
        if (botao) { botao.classList.remove('gravando'); botao.title = 'Gravar áudio'; }
        const segundos = Math.round((Date.now() - inicio) / 1000);
        if (segundos < 1) { ponte.avisar?.('Gravação curta demais.', 'error'); return; }
        try {
          const blob = new Blob(pedacos, { type: gravador.mimeType || 'audio/webm' });
          const arquivo = new File([blob], `audio-${Date.now()}.webm`, { type: blob.type });
          const anexo = await dados.subirArquivoWhatsapp(conversaId, arquivo);
          await dados.enviarMensagem(conversaId, null, { ...anexo, tipo: 'audio', duracao: segundos });
          ponte.avisar?.('Áudio na fila de envio.', 'success');
          redesenhar();
        } catch (e) {
          ponte.avisar?.(e?.message || 'Não foi possível enviar o áudio.', 'error');
        }
      };
      gravador.start();
      if (botao) { botao.classList.add('gravando'); botao.title = 'Clique para parar e enviar'; }
      ponte.avisar?.('Gravando... clique no microfone de novo para enviar.', 'success');
    } catch (e) {
      ponte.avisar?.('Não consegui acessar o microfone. Verifique a permissão do navegador.', 'error');
    }
    return true;
  }

  if (acao.startsWith('crm:enviar:')) {
    const conversaId = resto.replace('enviar:', '');
    const texto = val('crmComposerTexto');
    if (!texto) { ponte.avisar?.('Escreva uma mensagem antes de enviar.', 'error'); return true; }
    const ok = await gravar(ponte, () => dados.enviarMensagem(conversaId, texto), redesenhar, 'Mensagem enviada.');
    if (ok) {
      const campo = elVisivel('crmComposerTexto');
      if (campo) { campo.value = ''; campo.style.height = 'auto'; }
    }
    return true;
  }

  /* Vincular a conversa a um negócio do funil. Nunca dependeu do WhatsApp:
     `crm_conversas.lead_id` já existe, já é lido e já desenha o cartão "Lead
     ativo" na ficha. Só faltava o caminho de ida. */
  if (acao.startsWith('crm:vincular:')) {
    const conversaId = resto.replace('vincular:', '');
    const leads = await dados.listar('crm_leads').catch(() => []);
    if (!leads.length) {
      ponte.avisar?.('Nenhum negócio no funil ainda. Crie um lead primeiro, em Funil de vendas.', 'error');
      return true;
    }
    const rotulo = (l) => `${l.empresa}${(l.item || l.treinamento) ? ' — ' + (l.item || l.treinamento) : ''}`;
    ponte.abrirModal('Vincular a um negócio', `
      ${linha('Negócio', `<select id="crmV_lead" style="${CAMPO}">
        <option value="">Sem vínculo</option>
        ${leads.map(l => `<option value="${esc(l.id)}">${esc(rotulo(l))}</option>`).join('')}</select>`)}
      <div style="font-size:12px;color:var(--text-3);line-height:1.6">
        Vinculado, o negócio aparece na ficha do contato, ao lado da conversa — e o histórico da
        conversa fica ligado à venda.</div>
    `, ponte.botoes('Vincular', 'crmVincular'));
    ponte.aoConfirmar('crmVincular', () => gravar(ponte,
      () => dados.vincularConversaLead(conversaId, val('crmV_lead') || null),
      redesenhar, val('crmV_lead') ? 'Conversa vinculada ao negócio.' : 'Vínculo removido.'));
    return true;
  }

  /* Marca a conversa como resolvida. */
  if (acao.startsWith('crm:resolver:')) {
    const id = resto.replace('resolver:', '');
    await gravar(ponte, () => dados.resolverConversa(id), redesenhar, 'Conversa marcada como resolvida.');
    return true;
  }

  return false;
}
