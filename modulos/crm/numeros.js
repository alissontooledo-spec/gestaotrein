/* GRID · modulos/crm/numeros.js — configuração dos números de WhatsApp
   Item de menu com mobile:false. No celular a plataforma mostra a tela
   "isto é do computador"; aqui fica a versão de mesa.

   ── 14/09/2026 ────────────────────────────────────────────────────────────
   Esta tela tinha cinco botões desenhados que respondiam "esta tela ainda não
   foi construída": Reconectar, Editar, Quem acessa, Remover e Ler QR Code.
   No dia em que o número caiu às 07:08, o Alisson clicou em Reconectar e não
   havia caminho de volta pela interface — só por SQL. Botão que está na tela
   e não faz nada não é pendência: é botão quebrado. Agora os cinco funcionam.

   Como "Reconectar" funciona sem ninguém entrar na VPS: o gateway pergunta ao
   banco, a cada 30 segundos, quais caixas estão ativas. Desligar e religar a
   caixa faz ele encerrar a sessão e abrir uma nova — que é exatamente o que
   "reconectar" significa. O desenho do PASSO-40 já previa isto; faltava o
   botão.                                                                     */
import * as ui from '../../nucleo/ui.js';
import { icone } from '../../nucleo/icones.js';
import * as dados from '../../nucleo/dados.js';
import * as navegacao from '../../nucleo/navegacao.js';
import { avisoDemo } from './painel.js';

/* O QR Code expira em segundos e o gateway emite outro enquanto ninguém
   parear. Acima disto, o que está no banco não serve mais para escanear. */
const QR_VALIDO_SEGUNDOS = 120;

export const qrAindaVale = (c) => !!c.gateway_qr && !!c.gateway_qr_em
  && (Date.now() - new Date(c.gateway_qr_em).getTime()) < QR_VALIDO_SEGUNDOS * 1000;

/* ── Quem manda é o QR, não o `estado` (14/09, achado com dado real) ───────
   O `estado` da caixa oscila: quando o gateway emite um QR, ele grava
   `aguardando_qr`; sete segundos depois o ciclo de sincronia grava
   `desconectado` por cima, porque para o gateway "não conectado" é
   desconectado. As duas escritas brigam, e quem olha a tela vê "Desconectado"
   mesmo com um código esperando leitura.

   Na prática isso mandava a pessoa para o botão ERRADO: "Reconectar" não
   resolve sessão deslogada — só a leitura do QR resolve. Então a tela decide
   pelo fato que não oscila: existe um código esperando? Então é isso que
   precisa ser feito, diga o `estado` o que disser.
   (A briga entre as duas escritas também foi corrigida na Edge Function
   `whatsapp-gateway-sync`, para o banco parar de se contradizer.) */
const precisaQR = (c) => c.ativa !== false && (c.estado === 'aguardando_qr' || !!c.gateway_qr);

export async function render() {
  const caixas = await dados.listar('crm_caixas');
  const conectados = caixas.filter(c => c.estado === 'conectado' && c.ativa !== false);
  /* "Caiu" é só quem caiu mesmo: com QR pendente, o caminho é escanear, e
     oferecer "Reconectar" seria mandar a pessoa para o lugar errado. */
  const fora       = caixas.filter(c => c.estado === 'desconectado' && c.ativa !== false && !precisaQR(c));
  const esperandoQR = caixas.filter(precisaQR);
  const desligadas = caixas.filter(c => c.ativa === false);

  return `
  <div id="crmNumerosVivo" hidden></div>
  ${ui.topo({
    modulo:'CRM · Configuração', moduloIcone:'phone', titulo:'Números de WhatsApp',
    sub:`${caixas.length} ${caixas.length === 1 ? 'número' : 'números'} · ${conectados.length} conectado${conectados.length === 1 ? '' : 's'}`,
    /* "Horários" e "Respostas rápidas" saíram daqui em 14/09. Os dois eram
       botões que respondiam "esta tela ainda não foi construída" — a mesma
       promessa vazia que o "Reconectar" fazia. O horário de atendimento já se
       edita em cada número, no botão Editar; respostas rápidas configuráveis
       dependem de tabela nova e voltam ao cabeçalho quando existirem de fato. */
    /* 26/09: "Respostas rápidas" voltou — agora existe de fato (PASSO-56). */
    acoes:[
      { rotulo:'Respostas rápidas', icone:'chat', tipo:'sec', acao:'ir:crm-respostas' },
      { rotulo:'Adicionar número', icone:'plus', tipo:'pri', acao:'crm:add-numero' }
    ]
  })}

  ${/* Caixa desligada é o estado mais perigoso da tela: nada entra, nada sai,
       e é fácil esquecer que foi você quem desligou. Por isso o aviso vem
       antes de tudo e traz o botão de religar junto. */''}
  ${desligadas.map(c => ui.aviso({
    icone:'wifioff', titulo:`O número "${c.nome}" está DESLIGADO`,
    texto:'Enquanto estiver desligado, nenhuma mensagem entra nem sai por ele. As conversas antigas continuam guardadas.',
    acao:{ rotulo:'Religar agora', acao:`crm:religar:${c.id}` } })).join('')}

  ${/* Sessão deslogada no aparelho é o caso mais comum de queda, e o único
       jeito de sair dele é escanear o código de novo. O aviso leva direto
       para lá, em vez de oferecer um "Reconectar" que não resolveria. */''}
  ${esperandoQR.map(c => ui.aviso({
    icone:'qr', titulo:`O número "${c.nome}" precisa ser conectado de novo`,
    texto: c.ultimo_erro
      ? c.ultimo_erro
      : 'Leia o QR Code no celular deste número para voltar a enviar e receber mensagens.',
    acao:{ rotulo:'Ler QR Code', acao:`crm:qr:${c.id}` } })).join('')}

  ${fora.map(c => ui.aviso({
    icone:'wifioff', titulo:`O número do ${c.nome} caiu às ${c.desde || 'pouco tempo atrás'}`,
    texto:'As mensagens continuam sendo recebidas e entram na caixa assim que a conexão voltar',
    acao:{ rotulo:'Reconectar', acao:`crm:reconectar:${c.id}` } })).join('')}

  <div class="crm-num-grid">${caixas.map(cartao).join('')}</div>

  ${caixas.length === 1 ? ui.cartao(`
    <div style="font-size:var(--fs-4);color:var(--text-2);line-height:1.7">
      <b style="color:var(--text-1)">Esta organização usa um número só.</b> A caixa de entrada mostra as conversas direto, sem o
      trilho de caixas — e nada muda no dia em que ela adicionar o segundo número: o trilho aparece sozinho, com as conversas
      antigas já atribuídas ao número atual.</div>`,
    { estilo:'margin-top:var(--sp-4);border-left:2px solid var(--amber)' }) : ''}
  ${dados.ehExemplo() ? avisoDemo() : ''}`;
}

function cartao(c) {
  const desligada = c.ativa === false;
  const querQR = precisaQR(c);
  const estado = desligada
    ? { selo:['Desligado','neutro'], ic:'wifioff', cor:'background:var(--gray-100);color:var(--text-3)' }
    : querQR
    ? { selo:['Aguardando QR','atencao'], ic:'qr', cor:'background:var(--atencao-l);color:var(--atencao)' }
    : ({
        conectado:     { selo:['Conectado','ok'],         ic:'chat',    cor:'' },
        desconectado:  { selo:['Desconectado','atencao'],  ic:'wifioff', cor:'background:var(--atencao-l);color:var(--atencao)' },
        aguardando_qr: { selo:['Aguardando QR','atencao'], ic:'qr',      cor:'background:var(--atencao-l);color:var(--atencao)' }
      }[c.estado] || { selo:[c.estado, 'neutro'], ic:'phone', cor:'' });

  return `
  <div class="crm-num-card" ${c.estado !== 'conectado' || desligada ? 'style="border-color:rgba(180,83,9,.35)"' : ''}>
    <div class="crm-num-top">
      <div class="crm-num-ico" style="${estado.cor}">${icone(estado.ic,'lg')}</div>
      <div style="flex:1;min-width:0">
        <div class="crm-num-nome">${ui.esc(c.nome)}</div>
        <div class="crm-num-fone">${c.numero ? ui.fmt.telefone(c.numero) : 'número ainda não pareado'}</div>
      </div>
      ${ui.selo(estado.selo[0], estado.selo[1], true)}
    </div>

    ${/* A última reclamação da sessão vem do gateway (crm_caixas.ultimo_erro).
         Mostrar aqui evita ter de abrir o log da VPS para saber o que houve —
         que era o único jeito até hoje. */''}
    ${c.ultimo_erro ? `<div class="crm-num-erro">${icone('alert','sm')} ${ui.esc(c.ultimo_erro)}</div>` : ''}

    ${desligada
      ? `<div style="font-size:var(--fs-3);color:var(--text-3);line-height:1.6;margin:4px 0 12px">
           Número desligado. Nada entra nem sai por ele até você religar.</div>
         <div class="crm-num-acoes">
           <button class="ds-btn pri sm" data-acao="crm:religar:${c.id}">Religar</button>
           <button class="ds-btn sec sm" data-acao="crm:editar-numero:${c.id}">Editar</button></div>`

      : querQR
      ? `<div style="font-size:var(--fs-3);color:var(--text-3);line-height:1.6;margin:4px 0 12px">
           ${qrAindaVale(c)
             ? 'Código pronto para leitura. Abra o WhatsApp no celular deste número e escaneie.'
             : 'Número cadastrado, ainda não conectado. O servidor emite um código novo a cada 30 segundos — clique abaixo para ver o mais recente.'}</div>
         <div class="crm-num-acoes">
           <button class="ds-btn pri sm" data-acao="crm:qr:${c.id}">Ler QR Code</button>
           <button class="ds-btn sec sm" data-acao="crm:editar-numero:${c.id}">Editar</button>
           <button class="ds-btn sec sm" data-acao="crm:remover:${c.id}">Desligar</button></div>`

      : `${linha('Equipe com acesso', c.equipe?.length
            ? `<span class="crm-num-equipe">${c.equipe.slice(0,3).map(n => `<span class="crm-av">${ui.fmt.iniciais(n)}</span>`).join('')}
               ${c.equipe.length > 3 ? `<span class="crm-av" style="background:var(--gray-400)">+${c.equipe.length - 3}</span>` : ''}</span>`
            : '<span style="color:var(--text-3)">todos da organização</span>')}
         ${linha('Atendimento', ui.esc(c.horario || '—'))}
         ${linha(c.estado === 'desconectado' ? 'Conversas na fila' : 'Conversas abertas',
                 `<span class="num" ${c.estado === 'desconectado' ? 'style="color:var(--atencao-text)"' : ''}>${c.abertas ?? 0}</span>`)}
         <div class="crm-num-acoes">
           ${c.estado === 'desconectado' ? `<button class="ds-btn pri sm" data-acao="crm:reconectar:${c.id}">Reconectar</button>` : ''}
           <button class="ds-btn sec sm" data-acao="crm:editar-numero:${c.id}">Editar</button>
           <button class="ds-btn sec sm" data-acao="crm:acesso:${c.id}">Quem acessa</button>
           <button class="ds-btn sec sm" data-acao="crm:remover:${c.id}">Desligar</button></div>`}
  </div>`;
}

const linha = (k, v) => `<div class="crm-num-linha"><span class="k">${k}</span><span class="v">${v}</span></div>`;

/* ── Modal do QR Code ──────────────────────────────────────────────────────
   O `gateway_qr` guardado no banco é o TEXTO do código que o WhatsApp manda,
   não uma imagem. Quem desenha a imagem é o `gerarQRCodeDataURL` que já existe
   na casca (usado nos certificados desde julho) — por isso o corpo é montado
   em duas etapas: o modal abre na hora, com um lugar reservado, e a imagem
   entra quando fica pronta.

   Se a função da casca não existir (demonstração fora do app), o modal
   explica em vez de mostrar um quadrado vazio. */
export function modalQR(caixa) {
  const valido = qrAindaVale(caixa);
  const idade = caixa.gateway_qr_em
    ? Math.round((Date.now() - new Date(caixa.gateway_qr_em).getTime()) / 1000)
    : null;

  return {
    titulo: 'Conectar número de WhatsApp',
    corpo: `
    <div style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap">
      <div id="crmQRAlvo" style="width:188px;height:188px;background:#fff;border:1px solid var(--border-2);border-radius:var(--r-md);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--text-3);font-size:12px;text-align:center;padding:10px">
        ${caixa.gateway_qr ? 'Desenhando o código…' : 'Esperando o servidor emitir um código…'}
      </div>
      <div style="flex:1;min-width:220px">
        <div style="font-size:var(--fs-4);font-weight:700;color:var(--text-1);margin-bottom:10px">${ui.esc(caixa.nome)}</div>
        <ol style="font-size:var(--fs-4);color:var(--text-2);line-height:1.8;padding-left:18px;margin:0">
          <li>Abra o WhatsApp no celular <b>deste número</b></li>
          <li>Toque nos três pontinhos e depois em <b>Aparelhos conectados</b></li>
          <li>Toque em <b>Conectar um aparelho</b></li>
          <li>Aponte a câmera para o código ao lado</li>
        </ol>
        ${/* 14/09, segunda rodada: o código do WhatsApp expira em segundos, e
             a primeira versão desta janela mostrava uma FOTO dele. Enquanto a
             pessoa pegava o celular, o código já tinha morrido — o Alisson
             precisou fechar e abrir a janela para conseguir ler. Agora a
             janela se atualiza sozinha e avisa quando conectar. */''}
        <div id="crmQRIdade" style="margin-top:12px;font-size:var(--fs-2);color:var(--text-3);line-height:1.6">
          ${caixa.gateway_qr
            ? (valido ? `Código gerado há ${idade} segundos.` : 'Buscando um código novo…')
            : 'O servidor emite um código a cada 30 segundos.'}
        </div>
        <div style="margin-top:8px;font-size:var(--fs-2);color:var(--text-3);line-height:1.6;display:flex;align-items:center;gap:7px">
          <span class="crm-qr-pulso"></span>
          Esta janela se atualiza sozinha: o código novo aparece aqui e, assim que você escanear, ela fecha.
        </div>
      </div>
    </div>
    ${ui.aviso({ titulo:'Use um número dedicado ao sistema',
      texto:'A conexão é feita como um aparelho conectado do WhatsApp, e o próprio WhatsApp pode encerrá-la se o aparelho principal ficar muito tempo offline.' })}`
  };
}

/* ── A janela do QR fica viva enquanto estiver aberta ──────────────────────
   Duas coisas que a primeira versão não fazia, e que fizeram o Alisson penar:

   1. O código do WhatsApp expira em segundos e o gateway emite outro. Mostrar
      uma foto dele obrigava a fechar e abrir a janela até pegar um válido.
   2. Depois de escanear com sucesso, a tela continuava dizendo "Aguardando
      QR", porque nada relia o banco. Quem conectou não tinha como saber que
      tinha dado certo.

   Agora a janela pergunta ao banco de 4 em 4 segundos: se veio código novo,
   redesenha; se a caixa conectou, avisa e fecha. Para sozinha quando a janela
   é fechada (o alvo some do DOM) ou depois de LIMITE_MINUTOS — nenhum laço
   fica rodando para sempre numa aba esquecida. */
const LIMITE_MINUTOS = 5;

export function acompanharQR(caixaId, aoConectar) {
  if (typeof document === 'undefined') return () => {};
  let ultimoQR = null;
  let fim = Date.now() + LIMITE_MINUTOS * 60_000;

  const timer = setInterval(async () => {
    const alvo = document.getElementById('crmQRAlvo');
    if (!alvo || Date.now() > fim) { clearInterval(timer); return; }

    let c = null;
    try { c = await dados.obter('crm_caixas', caixaId); } catch { return; }
    if (!c) return;

    if (c.estado === 'conectado') {
      clearInterval(timer);
      aoConectar?.(c);
      return;
    }

    if (c.gateway_qr && c.gateway_qr !== ultimoQR) {
      ultimoQR = c.gateway_qr;
      pintarQR(c.gateway_qr);
    }

    const idade = c.gateway_qr_em
      ? Math.round((Date.now() - new Date(c.gateway_qr_em).getTime()) / 1000) : null;
    const legenda = document.getElementById('crmQRIdade');
    if (legenda) {
      legenda.textContent = idade == null
        ? 'O servidor emite um código a cada 30 segundos.'
        : idade < 60
          ? `Código gerado há ${idade} segundos.`
          : 'Buscando um código novo…';
    }
  }, 4000);

  return () => clearInterval(timer);
}

/* ── A própria TELA também se atualiza sozinha ─────────────────────────────
   O segundo sintoma que o Alisson relatou: ele escaneou o código, o WhatsApp
   conectou no celular, e a tela continuou dizendo "Aguardando QR". Não era
   defeito de conexão — era a tela, que desenhava uma vez e nunca mais olhava
   o banco. Quem conectou ficava sem saber que tinha dado certo.

   Regras para isto não virar um problema novo:
   · Só vigia quando há algo fora do ar. Número conectado não gera consulta
     nenhuma — não faz sentido ficar perguntando ao banco o que não muda.
   · Não redesenha com uma janela deste módulo aberta: redesenhar por baixo
     de um formulário tira o foco de quem está digitando.
   · Um temporizador só, sempre. `depois()` roda a cada redesenho, então a
     primeira coisa que ele faz é apagar o anterior. */
let _timerTela = null;

export function depois() {
  if (typeof document === 'undefined') return;
  if (_timerTela) { clearInterval(_timerTela); _timerTela = null; }

  const algoForaDoAr = document.querySelector(
    '[data-acao^="crm:qr:"], [data-acao^="crm:reconectar:"], [data-acao^="crm:religar:"]');
  if (!algoForaDoAr) return;

  const janelaAberta = () => !!(
    document.getElementById('crmQRAlvo') ||        // QR Code
    document.getElementById('crmE_nome') ||        // Editar
    document.getElementById('crmReconectarEstado') || // Reconectar
    document.querySelector('.crmAcessoPessoa'));   // Quem acessa

  _timerTela = setInterval(async () => {
    /* ── 18/09: a conferência de rota sozinha não bastava ─────────────────
       `navegacao.rotaAtual()` só é atualizado dentro de `_GRID.abrir()`, e as
       telas próprias da casca — Início, Turmas, Agenda, Conta — são desenhadas
       pelo `switch` do `irPara()` em app.html sem passar por lá. Sair desta
       tela para o Início deixava `rotaAtual()` devolvendo 'crm-numeros' para
       sempre: o temporizador não morria e, oito segundos depois, a tela de
       Números se pintava POR CIMA da tela inicial.

       Aqui o estrago era raro porque este temporizador só existe quando há
       número fora do ar. Mas "raro" quer dizer exatamente nos dias em que
       algo está errado — que é quando a pessoa mais circula pelo sistema.

       A sentinela não depende de `rotaAtual`: `setConteudo` troca o
       `innerHTML` das duas cascas, então o elemento some no instante em que
       qualquer outra tela é desenhada. Mesmo conserto em `conversas.js`. */
    if (!document.getElementById('crmNumerosVivo')
        || navegacao.rotaAtual?.() !== 'crm-numeros') {
      clearInterval(_timerTela); _timerTela = null; return;
    }
    if (janelaAberta()) return; // a janela do QR tem o próprio acompanhamento
    try { await navegacao.redesenhar(); } catch { /* tela trocou no meio */ }
  }, 8000);
}

/* Desenha a imagem do QR dentro do modal já aberto. Chamado por acoes.js logo
   depois de abrir. Silencioso em caso de falha: o modal continua útil com as
   instruções escritas. */
export async function pintarQR(textoQR) {
  if (typeof document === 'undefined') return;
  const alvo = document.getElementById('crmQRAlvo');
  if (!alvo || !textoQR) return;
  try {
    if (typeof window.gerarQRCodeDataURL !== 'function') {
      alvo.textContent = 'Não foi possível desenhar o código nesta tela.';
      return;
    }
    const dataUrl = await window.gerarQRCodeDataURL(textoQR);
    alvo.innerHTML = `<img src="${dataUrl}" alt="QR Code de conexão" style="width:100%;height:100%;object-fit:contain">`;
  } catch {
    alvo.textContent = 'Não foi possível desenhar o código. Feche e abra de novo.';
  }
}
