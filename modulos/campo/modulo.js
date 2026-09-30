/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/campo/modulo.js — Avaliação de Campo (v198, 26/09/2026)
   Digitaliza a "Ficha de Análise de Riscos Ambientais". Uma avaliação por
   empresa e visita, com N GHEs dentro. A visita é marcada na Agenda da Equipe
   (compromisso "Visita técnica"); o banco cria a avaliação sozinho.
   Técnico = perfil Instrutor. Administrador e comercial acompanham e também
   podem preencher. A trava de verdade é a RLS (PASSO-64).
   ══════════════════════════════════════════════════════════════════════════ */

import * as D from './dados.js';

const TODOS = ['administrador', 'comercial', 'instrutor'];

export default {
  id: 'campo',
  nome: 'Avaliação de Campo',
  icone: 'clipboard',
  css: './modulos/campo/campo.css',

  itens: [
    { id: 'campo', rotulo: 'Avaliações de campo', icone: 'clipboard', perfis: TODOS, mobile: true,
      rota: () => import('./lista.js') },
    { id: 'campo-avaliacao', rotulo: 'Avaliação de campo', icone: 'clipboard', oculto: true, perfis: TODOS, mobile: true,
      rota: () => import('./avaliacao.js') },
    { id: 'campo-ghe', rotulo: 'GHE', icone: 'clipboard', oculto: true, perfis: TODOS, mobile: true,
      rota: () => import('./ghe.js') },
    { id: 'campo-finalizar', rotulo: 'Finalizar avaliação', icone: 'clipboard', oculto: true, perfis: TODOS, mobile: true,
      rota: () => import('./finalizar.js') },
    /* v203: conferência dos funcionários com a empresa. */
    { id: 'campo-funcionarios', rotulo: 'Conferir funcionários', icone: 'clipboard', oculto: true, perfis: TODOS, mobile: true,
      rota: () => import('./funcionarios.js') },
    /* v222: tipos do "O que falta a empresa enviar" — o administrador edita (PASSO-73). */
    { id: 'campo-tipos', rotulo: 'Tipos de documento', icone: 'clipboard', oculto: true, perfis: ['administrador'], mobile: true,
      rota: () => import('./tipos.js') },
    { id: 'campo-matriz', rotulo: 'Matriz de risco', icone: 'clipboard', oculto: true, perfis: ['administrador'], mobile: true,
      rota: () => import('./matriz.js') },
    /* v223: plano de ação 5W2H para o SOC (PASSO-74). */
    { id: 'campo-plano', rotulo: 'Plano de ação', icone: 'clipboard', oculto: true, perfis: TODOS, mobile: true,
      rota: () => import('./planotela.js') },
    { id: 'campo-soc', rotulo: 'Lançar no SOC', icone: 'clipboard', oculto: true, perfis: TODOS, mobile: true,
      rota: () => import('./soc.js') },
    { id: 'campo-acoes', rotulo: 'Planos de ação', icone: 'clipboard', oculto: true, perfis: TODOS, mobile: true,
      rota: () => import('./acoes.js') },
    /* Catálogo da ficha: só abre de verdade em Modo Suporte (Provedor). */
    { id: 'campo-catalogo', rotulo: 'Catálogo da ficha', icone: 'book', oculto: true, perfis: ['administrador'], mobile: false,
      textoDesktop: 'Editar o catálogo da ficha é trabalho de mesa. No computador esta tela abre direto.',
      rota: () => import('./catalogo.js') }
  ],

  /* Ações que valem em qualquer tela do módulo. */
  async acoes(acao, ctx) {
    if (acao === 'campo:enviar') {
      const id = String(ctx?.params?.id || '').split('~')[0];
      if (!id) return true;
      try { await D.sincronizar(id); window.__GRID_PONTE?.avisar?.('Alterações enviadas.'); }
      catch (e) { window.__GRID_PONTE?.avisar?.(D.traduzirErro(e), 'error'); }
      ctx.redesenhar?.();
      return true;
    }
    return false;
  }
};
