/* ══════════════════════════════════════════════════════════════════════════
   GRID · nucleo/plataforma.js
   O objeto que os módulos enxergam. É a única superfície de contato entre
   um módulo e o resto do sistema — se algo não está aqui, o módulo não pode
   usar. Isso é de propósito.

   Uso dentro do app.html (script clássico, sem virar módulo):
     const { GRID } = await import('./nucleo/plataforma.js?v=' + APP_BUILD);
   ══════════════════════════════════════════════════════════════════════════ */

import * as ui        from './ui.js';
import * as sessao    from './sessao.js';
import * as dados     from './dados.js';
import * as navegacao from './navegacao.js';
import { ICO, icone } from './icones.js';

export const GRID = {
  versao: '1.0.0',
  ui, sessao, dados, navegacao,
  icones: { ICO, icone },

  /* Carrega os módulos contratados. Tolerante por desenho: se a consulta
     falhar, nenhum módulo é registrado e o app segue exatamente como hoje. */
  async carregarModulos(ids, build = 'dev') {
    const carregados = [];
    for (const id of ids) {
      try {
        const mod = (await import(`../modulos/${id}/modulo.js?v=${build}`)).default;
        navegacao.registrar(mod);
        carregados.push(mod);
      } catch (e) {
        console.warn(`[GRID] módulo "${id}" não carregou:`, e?.message);
      }
    }
    return carregados;
  },

  /* Ponto único de entrada do roteador: devolve false quando a rota não
     pertence a nenhum módulo, e aí o app segue com o switch que já tem. */
  async abrir(rota, params) { return navegacao.abrir(rota, params); },

  /* Onde os módulos desenham. A casca passa o próprio container aqui uma vez;
     sem isso, navegacao.abrir() não teria onde escrever. */
  definirContainer(el) { navegacao.definirContainer(el); },

  /* Traduz uma ação declarada por uma tela em comportamento. Devolve false
     quando ninguém respondeu — a casca avisa, em vez de fingir que fez. */
  async tratarAcao(acao) { return navegacao.tratarAcao(acao); },

  /* A casca informa como navegar e como abrir modal/aviso. Sem isto, o módulo
     teria que conhecer o app por dentro — que é exatamente o que a plataforma
     existe para evitar. */
  aoNavegar(fn) { navegacao.aoNavegar(fn); },
  ponte: {},
  definirPonte(p) { Object.assign(this.ponte, p); if (typeof window !== 'undefined') window.__GRID_PONTE = this.ponte; },

  /* Os módulos carregados, na ordem em que entraram. A casca usa para montar
     um bloco de menu por módulo. */
  modulos() { return navegacao.registrados(); },

  /* Itens de menu de todos os módulos carregados, já filtrados pelo perfil e
     pelo que faz sentido no aparelho atual. A casca acrescenta ao menu dela;
     quem decide o que existe continua sendo o manifesto de cada módulo. */
  itensDeMenu(perfil) {
    const fora = [];
    for (const mod of navegacao.registrados()) {
      for (const item of (mod.itens || [])) {
        if (item.oculto) continue;                        // rotas de detalhe
        if (item.perfis && !item.perfis.includes(perfil)) continue;
        fora.push({ id: item.id, rotulo: item.rotulo, icone: item.icone, modulo: mod.id });
      }
    }
    return fora;
  }
};

if (typeof window !== 'undefined') window.GRID = GRID;
export default GRID;
