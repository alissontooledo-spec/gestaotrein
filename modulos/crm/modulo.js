/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/crm/modulo.js
   Manifesto do módulo. É o único ponto de contato com a plataforma: a casca
   lê este arquivo, acrescenta os itens ao menu e nada mais.

   `mobile` é a decisão de escopo de celular aprovada em 03/09 — declarada
   aqui, no dado, e não no julgamento de quem escreve cada tela.
   `perfis` decide o que aparece no menu; a trava de verdade é a policy
   RESTRICTIVE no banco.
   ══════════════════════════════════════════════════════════════════════════ */

import acoes from './acoes.js';

export default {
  id: 'crm',
  /* Onde as acoes declaradas pelas telas viram escrita. A plataforma chama
     isto quando a propria tela nao tratou a acao. */
  acoes,
  nome: 'CRM',
  icone: 'funnel',
  css: './modulos/crm/crm.css',

  itens: [
    { id:'crm',             rotulo:'Painel comercial', icone:'trend',
      perfis:['administrador','comercial'], mobile:true,
      rota:() => import('./painel.js') },

    { id:'crm-conversas',   rotulo:'Conversas', icone:'chat',
      perfis:['administrador','comercial'], mobile:true,
      rota:() => import('./conversas.js') },

    { id:'crm-funil',       rotulo:'Funil de vendas', icone:'funnel',
      perfis:['administrador','comercial'], mobile:true,
      rota:() => import('./funil.js') },

    { id:'crm-contatos',    rotulo:'Contatos', icone:'user',
      perfis:['administrador','comercial'], mobile:true,
      rota:() => import('./contatos.js') },

    { id:'crm-atividades',  rotulo:'Atividades', icone:'activity',
      perfis:['administrador','comercial'], mobile:true,
      rota:() => import('./atividades.js') },

    { id:'crm-numeros',     rotulo:'WhatsApp', icone:'phone',
      perfis:['administrador'], mobile:false,
      textoDesktop:'Configurar equipe, horário de atendimento e mensagem de ausência é trabalho de mesa. No computador esta tela abre direto.',
      alternativa:{ rotulo:'Ver status dos números', acao:'ir:crm-numeros-status' },
      rota:() => import('./numeros.js') },

    { id:'crm-empresa',     rotulo:'Empresas', icone:'company',
      perfis:['administrador','comercial'], mobile:true,
      rota:() => import('./empresa.js') },

    /* Configuracao do funil: chega pelo botao no topo do Funil de vendas, nao
       pelo menu — e tela de ajuste, nao de trabalho diario. */
    { id:'crm-funis', rotulo:'Configuração do funil', icone:'settings', oculto:true,
      perfis:['administrador'], mobile:false,
      textoDesktop:'Criar funis, renomear etapas e definir cores é trabalho de mesa. No computador esta tela abre direto.',
      rota:() => import('./funis.js') },

    /* Ficha do lead: existe como rota, não como item de menu. */
    { id:'crm-lead', rotulo:'Lead', icone:'funnel', oculto:true,
      perfis:['administrador','comercial'], mobile:true,
      rota:() => import('./lead.js') }
  ],

  /* Contadores mostrados no menu e no bloco recolhido do módulo. */
  async contadores(dados) {
    try {
      const conversas = await dados.listar('crm_conversas');
      const naoLidas = conversas.filter(c => c.nao_lidas > 0).length;
      return naoLidas ? { 'crm-conversas': naoLidas } : {};
    } catch { return {}; }
  }
};
