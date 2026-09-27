/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/campo/catalogo.js — catálogo de riscos e treinamentos
   Os códigos da ficha mudam com o tempo (decisão de 26/09): aqui se edita
   código, nome, categoria e se o item aparece para o técnico. Só o Provedor
   grava (RLS do PASSO-64) — por isso a tela só abre em Modo Suporte.
   Avaliações já feitas guardam o código e o nome do dia: mudar aqui não
   altera documento antigo.
   ══════════════════════════════════════════════════════════════════════════ */

import { cliente } from '../../nucleo/dados.js';
import * as D from './dados.js';
import { esc, nota, ligarTela, avisar, ponte, btn, secTit } from './comum.js';

let _tipo = 'risco', _busca = '';
const sb = () => cliente();
const podeEditar = () => !!ponte().modoSuporte?.();

async function lerTudo() {
  const { data, error } = await sb().from('campo_catalogo').select('id,org_id,tipo,codigo,nome,categoria,ordem,dados,ativo')
    .is('org_id', null).order('tipo').order('ordem').range(0, 1999);
  if (error) throw error;
  return data || [];
}

export async function render() {
  ligarTela(null);
  if (!podeEditar()) return nota('O catálogo é editado pelo Provedor, em Modo Suporte. Peça ao suporte do GRID para mudar um código ou nome.', 'warn');
  const todos = await lerTudo();
  const q = _busca.trim().toLowerCase();
  const lista = todos.filter(x => x.tipo === _tipo && (!q || x.codigo.toLowerCase().includes(q) || x.nome.toLowerCase().includes(q) || String(x.categoria || '').toLowerCase().includes(q)));
  const cat = (x) => _tipo === 'risco' ? (D.NOME_CATEGORIA[x.categoria] || x.categoria) : (x.categoria || '');
  return `
    <div class="cp-topo"><div class="cp-topo-txt"><div class="cp-topo-emp">Avaliação de Campo</div><div class="cp-topo-tit">Catálogo da ficha</div>
      <div class="cp-topo-sub">Vale para todas as organizações. Documentos já concluídos não mudam.</div></div></div>
    <div class="turmas-filtros">
      <div class="turmas-busca"><input type="search" id="cpBuscaCat" data-acao="campo:cat-busca" value="${esc(_busca)}" placeholder="Buscar código ou nome..."></div>
      <select class="turmas-filtro-select" data-acao="campo:cat-tipo">
        ${[['risco', 'Riscos'], ['treinamento', 'Treinamentos'], ['ambiente', 'Opções de ambiente']].map(([v, l]) => `<option value="${v}" ${v === _tipo ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
      <div class="turmas-filtros-cta">${btn('Novo item', 'campo:cat-novo', { cls: 'btn-amber' })}</div>
    </div>
    ${secTit(`${lista.length} itens`)}
    <div class="cp-sec" style="padding:4px 14px">${lista.map(x => `<div class="cp-kv" data-acao="campo:cat-editar:${x.id}" style="cursor:pointer;min-height:40px;align-items:center">
      <span><b style="color:var(--text-1)">${esc(x.codigo)}</b> · ${esc(x.nome)}${x.ativo ? '' : ' <span class="badge badge-gray">oculto</span>'}</span><b>${esc(cat(x))}</b></div>`).join('') || '<div class="cp-ajuda" style="padding:10px 0">Nada encontrado.</div>'}</div>`;
}

function modal(item, redesenhar) {
  const p = ponte();
  const cats = _tipo === 'risco' ? [...D.CATEGORIAS, ['outro', 'Outros']] : _tipo === 'ambiente' ? D.GRUPOS_AMBIENTE : null;
  const est = 'width:100%;padding:11px 14px;border:1.5px solid var(--border);border-radius:var(--r-md);font-size:14px;font-family:inherit;background:var(--surface)';
  p.abrirModal(item ? 'Editar item do catálogo' : 'Novo item do catálogo', `
    <div class="field"><label>Código *</label><input type="text" id="cpCatCod" maxlength="20" value="${esc(item?.codigo || '')}"></div>
    <div class="field"><label>Nome *</label><input type="text" id="cpCatNome" maxlength="200" value="${esc(item?.nome || '')}"></div>
    <div class="field"><label>${_tipo === 'treinamento' ? 'NR (ex.: NR-35)' : 'Categoria'} *</label>${cats
      ? `<select id="cpCatCat" style="${est}">${cats.map(([k, l]) => `<option value="${k}" ${k === item?.categoria ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`
      : `<input type="text" id="cpCatCat" maxlength="20" value="${esc(item?.categoria || '')}">`}</div>
    <div class="field"><label>Ordem na lista</label><input type="number" id="cpCatOrdem" value="${item?.ordem ?? 999}"></div>
    <label style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" id="cpCatAtivo" ${item?.ativo === false ? '' : 'checked'}> Aparece para o técnico</label>`,
    p.botoes('Salvar', 'cpCatOk'));
  p.aoConfirmar('cpCatOk', async () => {
    const v = (id) => document.getElementById(id)?.value.trim();
    const reg = { codigo: v('cpCatCod'), nome: v('cpCatNome'), categoria: v('cpCatCat') || null, ordem: Number(v('cpCatOrdem')) || 0, ativo: !!document.getElementById('cpCatAtivo')?.checked };
    if (!reg.codigo || !reg.nome) { avisar('Código e nome são obrigatórios.', 'erro'); return; }
    const q = item
      ? sb().from('campo_catalogo').update({ ...reg, atualizado_em: new Date().toISOString() }).eq('id', item.id).select('id')
      : sb().from('campo_catalogo').insert({ ...reg, org_id: null, tipo: _tipo, dados: _tipo === 'risco' ? { colunas_conclusao: D.CONCLUSOES[reg.categoria] || [], padrao: {} } : {} }).select('id');
    const { data, error } = await q;
    if (error) { avisar(/duplicate|23505/.test(error.message + error.code) ? 'Já existe um item com esse código.' : D.traduzirErro(error), 'erro'); return; }
    if (!data?.length) { avisar('Nada foi gravado: só o Provedor edita o catálogo.', 'erro'); return; }
    p.fecharModal(); avisar('Catálogo atualizado.');
    await D.catalogo({ fresco: true }).catch(() => {});
    redesenhar();
  });
}

export async function acao(nome, valor, redesenhar) {
  if (nome === 'campo:cat-busca') { _busca = valor || ''; redesenhar(); return true; }
  if (nome === 'campo:cat-tipo') { _tipo = valor || 'risco'; redesenhar(); return true; }
  if (nome === 'campo:cat-novo') { modal(null, redesenhar); return true; }
  if (nome === 'campo:cat-editar') {
    const todos = await lerTudo();
    modal(todos.find(x => x.id === valor), redesenhar); return true;
  }
  return false;
}
