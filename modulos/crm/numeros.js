/* GRID · modulos/crm/numeros.js — configuração dos números de WhatsApp
   Item de menu com mobile:false. No celular a plataforma mostra a tela
   "isto é do computador"; aqui fica a versão de mesa. */
import * as ui from '../../nucleo/ui.js';
import { icone } from '../../nucleo/icones.js';
import * as dados from '../../nucleo/dados.js';
import { avisoDemo } from './painel.js';

export async function render() {
  const caixas = await dados.listar('crm_caixas');
  const conectados = caixas.filter(c => c.estado === 'conectado');
  const fora = caixas.filter(c => c.estado === 'desconectado');

  return `
  ${ui.topo({
    modulo:'CRM · Configuração', moduloIcone:'phone', titulo:'Números de WhatsApp',
    sub:`${caixas.length} ${caixas.length === 1 ? 'número' : 'números'} · ${conectados.length} conectado${conectados.length === 1 ? '' : 's'}`,
    acoes:[
      { rotulo:'Horários', icone:'clock', tipo:'sec', acao:'crm:horarios' },
      { rotulo:'Respostas rápidas', icone:'chat', tipo:'sec', acao:'crm:respostas' },
      { rotulo:'Adicionar número', icone:'plus', tipo:'pri', acao:'crm:add-numero' }
    ]
  })}

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
  const estado = {
    conectado:     { selo:['Conectado','ok'],       ic:'chat',    cor:'' },
    desconectado:  { selo:['Desconectado','atencao'],ic:'wifioff', cor:'background:var(--atencao-l);color:var(--atencao)' },
    aguardando_qr: { selo:['Aguardando QR','atencao'],ic:'qr',     cor:'background:var(--atencao-l);color:var(--atencao)' }
  }[c.estado] || { selo:[c.estado,'neutro'], ic:'phone', cor:'' };

  return `
  <div class="crm-num-card" ${c.estado !== 'conectado' ? 'style="border-color:rgba(180,83,9,.35)"' : ''}>
    <div class="crm-num-top">
      <div class="crm-num-ico" style="${estado.cor}">${icone(estado.ic,'lg')}</div>
      <div style="flex:1;min-width:0">
        <div class="crm-num-nome">${ui.esc(c.nome)}</div>
        <div class="crm-num-fone">${ui.fmt.telefone(c.numero)}</div>
      </div>
      ${ui.selo(estado.selo[0], estado.selo[1], true)}
    </div>
    ${c.estado === 'aguardando_qr'
      ? `<div style="font-size:var(--fs-3);color:var(--text-3);line-height:1.6;margin:4px 0 12px">
           Número cadastrado, ainda não conectado. Leia o código no celular que usa este número para ativar a caixa.</div>
         <div class="crm-num-acoes">
           <button class="ds-btn pri sm" data-acao="crm:qr:${c.id}">Ler QR Code</button>
           <button class="ds-btn sec sm" data-acao="crm:remover:${c.id}">Remover</button></div>`
      : `${linha('Equipe com acesso', c.equipe?.length
            ? `<span class="crm-num-equipe">${c.equipe.slice(0,3).map(n => `<span class="crm-av">${ui.fmt.iniciais(n)}</span>`).join('')}
               ${c.equipe.length > 3 ? `<span class="crm-av" style="background:var(--gray-400)">+${c.equipe.length - 3}</span>` : ''}</span>`
            : '<span style="color:var(--text-3)">ninguém</span>')}
         ${linha('Atendimento', ui.esc(c.horario || '—'))}
         ${linha(c.estado === 'desconectado' ? 'Conversas na fila' : 'Conversas abertas',
                 `<span class="num" ${c.estado === 'desconectado' ? 'style="color:var(--atencao-text)"' : ''}>${c.abertas ?? 0}</span>`)}
         <div class="crm-num-acoes">
           ${c.estado === 'desconectado' ? `<button class="ds-btn pri sm" data-acao="crm:reconectar:${c.id}">Reconectar</button>` : ''}
           <button class="ds-btn sec sm" data-acao="crm:editar-numero:${c.id}">Editar</button>
           <button class="ds-btn sec sm" data-acao="crm:acesso:${c.id}">Quem acessa</button></div>`}
  </div>`;
}

const linha = (k, v) => `<div class="crm-num-linha"><span class="k">${k}</span><span class="v">${v}</span></div>`;

/* Modal de conexão — o passo a passo do QR Code. */
export function modalConectar(nome) {
  return {
    titulo:'Adicionar número de WhatsApp',
    corpo:`
      <div style="display:flex;gap:20px;align-items:center;flex-wrap:wrap">
        <div style="width:148px;height:148px;background:var(--surface);border:1px solid var(--border-2);border-radius:var(--r-md);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--navy)">
          ${icone('qr','lg')}</div>
        <div style="flex:1;min-width:200px">
          <div style="font-size:var(--fs-4);font-weight:700;color:var(--text-1);margin-bottom:10px">Caixa "${ui.esc(nome || 'nova')}"</div>
          <ol style="font-size:var(--fs-4);color:var(--text-2);line-height:1.8;padding-left:18px;margin:0">
            <li>Abra o WhatsApp no celular deste número</li>
            <li>Toque em <b>Aparelhos conectados</b></li>
            <li>Aponte a câmera para o código</li></ol>
          <div style="margin-top:12px;font-size:var(--fs-2);color:var(--text-3)">O código expira em 45 segundos e é gerado novamente sozinho.</div>
        </div>
      </div>
      ${ui.aviso({ titulo:'Use um número dedicado ao sistema',
        texto:'A conexão é feita como um aparelho conectado do WhatsApp, e o próprio WhatsApp pode encerrá-la.' })}`,
    rodape:'<button class="ds-btn sec" data-acao="fechar">Cancelar</button><button class="ds-btn pri" data-acao="crm:qr-lido">Já li o código</button>'
  };
}
