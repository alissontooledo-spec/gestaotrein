/* GRID · modulos/crm/respostas.js — respostas rápidas (26/09/2026)
   ───────────────────────────────────────────────────────────────────────────
   Cada empresa cadastra as suas; na conversa, digitar "/" abre a lista.
   Uma empresa nova começa com as três que antes eram fixas no código
   (crm_respostas_listar cria sozinha na primeira abertura). As escritas
   passam por acoes.js (crm:nova-resposta, crm:editar-resposta:, crm:excluir-
   resposta:), como todo o resto do módulo. */
import * as ui from '../../nucleo/ui.js';
import { icone } from '../../nucleo/icones.js';
import * as dados from '../../nucleo/dados.js';
import * as sessao from '../../nucleo/sessao.js';
import { avisoDemo } from './painel.js';

export async function render() {
  const lista = await dados.respostasRapidas({ fresco: true });
  const celular = sessao.ehCelular();
  /* Administrador chega pela tela WhatsApp; comercial, pela conversa. O
     "voltar" leva de volta para onde cada um veio. */
  const voltar = sessao.perfil() === 'administrador'
    ? { rotulo:'Números de WhatsApp', acao:'ir:crm-numeros' }
    : { rotulo:'Conversas', acao:'ir:crm-conversas' };

  return `
  ${ui.topo({
    modulo:'CRM · Configuração', moduloIcone:'chat', titulo:'Respostas rápidas',
    sub:`${lista.length} ${lista.length === 1 ? 'resposta' : 'respostas'} · digite / na conversa para usar`,
    voltar,
    acoes:[{ rotulo: celular ? 'Nova' : 'Nova resposta', icone:'plus', tipo:'pri', acao:'crm:nova-resposta' }]
  })}
  ${lista.length ? (celular ? listaCelular(lista) : tabela(lista)) : ui.vazio({
    icone:'chat', titulo:'Nenhuma resposta rápida',
    sub:'Crie a primeira em "Nova resposta". Na conversa, ela aparece ao digitar /.' })}
  ${dados.ehExemplo() ? avisoDemo() : ''}`;
}

function tabela(lista) {
  return ui.tabela({
    colunas:[
      { campo:'atalho', rotulo:'Atalho', ordenavel:false,
        render:(r) => `<span class="num" style="font-weight:700;color:var(--navy)">/${ui.esc(r.atalho)}</span>` },
      { campo:'titulo', rotulo:'Título', ordenavel:false, render:(r) => `<div class="prim">${ui.esc(r.titulo)}</div>` },
      { campo:'texto', rotulo:'Texto', ordenavel:false,
        render:(r) => `<span style="color:var(--text-2);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${ui.esc(r.texto)}</span>` },
      { campo:'acoes', rotulo:'', ordenavel:false, dir:true,
        render:(r) => `<span style="white-space:nowrap">
          <button class="ds-icobtn" title="Editar" data-acao="crm:editar-resposta:${ui.esc(r.id)}">${icone('tool','sm')}</button>
          <button class="ds-icobtn" title="Excluir" data-acao="crm:excluir-resposta:${ui.esc(r.id)}">${icone('close','sm')}</button></span>` }
    ],
    linhas: lista,
    acaoLinha: (r) => `crm:editar-resposta:${r.id}`
  });
}

const listaCelular = (lista) => ui.lista(lista.map(r => ({
  titulo: r.titulo, sub: `/${r.atalho} · ${r.texto}`, avatar: false,
  acao: `crm:editar-resposta:${r.id}`,
  fim: `<button class="ds-icobtn" title="Excluir" data-acao="crm:excluir-resposta:${ui.esc(r.id)}">${icone('close','sm')}</button>`
})));
