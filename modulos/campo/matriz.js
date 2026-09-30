/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/campo/matriz.js — Matriz de risco (v222, PASSO-73)
   O nível do risco sai de Probabilidade × Severidade e define a
   classificação (aceitável / tolerável / não aceitável). O técnico não
   escolhe mais a classificação à mão (decisão do Alisson, 29/09, depois de
   comparar com a matriz do SOC).
   O padrão do GRID é a matriz do SOC (5x5). A organização pode ter a sua:
   o administrador muda aqui e o GRID grava uma linha da organização
   (campo_catalogo, tipo 'matriz', código 'padrao'), que vale no lugar do
   padrão. "Voltar ao padrão" apaga essa linha. Nada por SQL.
   Avaliações concluídas não mudam; as em aberto são recalculadas ao abrir.
   ══════════════════════════════════════════════════════════════════════════ */

import { cliente } from '../../nucleo/dados.js';
import * as sessao from '../../nucleo/sessao.js';
import * as D from './dados.js';
import { esc, nota, ligarTela, avisar, confirmar, ponte, btn, secTit, inp, area, seg } from './comum.js';

const sb = () => cliente();
const orgId = () => sessao.orgId?.() || sessao.usuario()?.org_id || null;
const podeEditar = () => {
  const p = ponte();
  const perfil = p.perfil?.() || sessao.perfil?.();
  return ['administrador', 'provedor'].includes(perfil) && (p.pode ? p.pode('campo', 2) !== false : true);
};
const ACEIT = [['aceitavel', 'Aceitável'], ['toleravel', 'Tolerável'], ['nao_aceitavel', 'Não aceitável']];
const clone = (x) => JSON.parse(JSON.stringify(x));

let _m = null, _linhaOrg = null, _temPadrao = false, _mudou = false;

async function ler() {
  const { data, error } = await sb().from('campo_catalogo').select('id,org_id,tipo,codigo,nome,dados')
    .eq('tipo', 'matriz').eq('codigo', 'padrao').range(0, 50);
  if (error) throw error;
  const org = orgId();
  const linhas = (data || []).filter(x => !x.org_id || x.org_id === org);
  _linhaOrg = linhas.find(x => x.org_id) || null;
  const padrao = linhas.find(x => !x.org_id);
  _temPadrao = !!padrao;
  return clone((_linhaOrg?.dados?.grade ? _linhaOrg.dados : null) || padrao?.dados || D.MATRIZ_PADRAO);
}

export async function render() {
  ligarTela({ digitar });
  if (!_m || !_mudou) {
    try { _m = await ler(); _mudou = false; }
    catch (e) {
      return /matriz|check constraint|campo_catalogo_tipo_ck/i.test(String(e?.message || ''))
        ? nota('Esta tela precisa do PASSO-73 no banco. Peça ao suporte do GRID.', 'warn')
        : nota(esc(D.traduzirErro(e)), 'red');
    }
  }
  const ed = podeEditar();
  const nv = (cod) => _m.niveis.find(n => n.codigo === cod) || { nome: cod, cor: '#D2D7E1' };
  const curto = (t) => String(t || '').replace(/^Risco\s+/i, '');
  const grade = `<div class="cp-mz-wrap"><table class="cp-mz">
    <thead><tr><th class="cp-mz-eixo">Probabilidade ↓ · Severidade →</th>${D.SEVERIDADE.map(([k, t]) => `<th><b>${k}</b><span>${esc(t)}</span></th>`).join('')}</tr></thead>
    <tbody>${D.PROBABILIDADE.map(([p, tp], i) => `<tr><th><b>${p}</b><span>${esc(tp)}</span></th>${_m.grade[i].map((cod, j) => {
      const n = nv(cod);
      return `<td><button type="button" class="cp-mz-c" style="--nv:${esc(n.cor || '#D2D7E1')}" ${ed ? `data-acao="campo:mz-casa:${i}:${j}"` : 'disabled'}>${esc(curto(n.nome))}</button></td>`;
    }).join('')}</tr>`).join('')}</tbody></table></div>`;
  const niveis = _m.niveis.map((n, k) => `<div class="cp-mz-nv">
      <div class="cp-mz-nv-h"><i style="background:${esc(n.cor || '#D2D7E1')}"></i>${ed ? inp(`nv.${k}.nome`, n.nome, { ph: 'Nome do nível' }) : `<b>${esc(n.nome)}</b>`}</div>
      <label class="cp-lbl">Aceitabilidade</label>${seg(`mz-aceit:${k}`, ACEIT, n.aceitabilidade, { travado: !ed })}
      <label class="cp-lbl" style="margin-top:10px">Ação (sai no PDF quando o técnico não escreve outra)</label>${area(`nv.${k}.acao`, n.acao, { travado: !ed, alto: 60 })}
    </div>`).join('');
  return `
    <div class="cp-topo"><div class="cp-topo-txt"><div class="cp-topo-emp">Avaliação de Campo</div><div class="cp-topo-tit">Matriz de risco</div>
      <div class="cp-topo-sub">${_linhaOrg ? 'Matriz da sua empresa' : 'Padrão do GRID (igual à matriz 5x5 do SOC)'} · o nível sai de Probabilidade × Severidade e define a classificação.</div></div>
      ${ed ? btn(_mudou ? 'Salvar alterações' : 'Salvo', 'campo:mz-salvar', { cls: 'btn-amber', travado: !_mudou }) : ''}</div>
    ${ed ? '' : nota('Só o administrador altera a matriz.')}
    ${_mudou ? nota('Há alterações ainda não salvas.', 'warn') : ''}
    ${secTit('Nível de risco (toque numa casa para trocar)')}
    <div class="cp-sec">${grade}</div>
    ${secTit('Níveis')}
    <div class="cp-sec">${niveis}</div>
    ${nota('Vale a partir de agora. Avaliações concluídas não mudam; nas avaliações em aberto, o nível de cada risco é recalculado quando a avaliação é aberta.')}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 18px">
      ${btn('Voltar para as avaliações', 'ir:campo', { cls: 'btn-ghost' })}
      ${ed && _mudou ? btn('Descartar alterações', 'campo:mz-descartar', { cls: 'btn-outline' }) : ''}
      ${ed && _linhaOrg && _temPadrao ? btn('Voltar ao padrão do GRID', 'campo:mz-padrao', { cls: 'btn-outline' }) : ''}
    </div>`;
}

function digitar(chave, valor) {
  const m = /^nv\.(\d+)\.(nome|acao)$/.exec(chave); if (!m || !_m) return;
  const n = _m.niveis[Number(m[1])]; if (!n) return;
  n[m[2]] = valor;
  if (!_mudou) { _mudou = true; document.querySelectorAll('[data-acao="campo:mz-salvar"]').forEach(b => { b.disabled = false; b.style.opacity = ''; b.textContent = 'Salvar alterações'; b.setAttribute('data-acao', 'campo:mz-salvar'); }); }
}

function escolherNivel(i, j, redesenhar) {
  const p = ponte();
  p.abrirModal(`Probabilidade ${i + 1} × Severidade ${j + 1}`, `<div class="cp-mz-esc">${_m.niveis.map(n => `
    <button type="button" class="cp-mz-c${_m.grade[i][j] === n.codigo ? ' on' : ''}" style="--nv:${esc(n.cor || '#D2D7E1')}" data-cp-nv="${esc(n.codigo)}">${esc(n.nome)}</button>`).join('')}</div>`,
    `<button class="btn btn-outline" onclick="fecharModal()">Cancelar</button>`);
  setTimeout(() => document.querySelectorAll('[data-cp-nv]').forEach(b => {
    b.onclick = () => { _m.grade[i][j] = b.dataset.cpNv; _mudou = true; p.fecharModal(); redesenhar(); };
  }), 30);
}

export async function acao(nome, valor, redesenhar) {
  if (!nome.startsWith('campo:mz-')) return false;
  if (!podeEditar()) { avisar('Só o administrador altera a matriz.', 'erro'); return true; }
  if (nome === 'campo:mz-casa') { const [i, j] = valor.split(':').map(Number); escolherNivel(i, j, redesenhar); return true; }
  if (nome === 'campo:mz-aceit') {
    const [k, v] = valor.split(':'); const n = _m.niveis[Number(k)];
    if (n && ACEIT.some(([a]) => a === v)) { n.aceitabilidade = v; _mudou = true; }
    redesenhar(); return true;
  }
  if (nome === 'campo:mz-descartar') { _m = null; redesenhar(); return true; }
  if (nome === 'campo:mz-salvar') {
    if (_m.niveis.some(n => !String(n.nome || '').trim())) { avisar('Todo nível precisa de nome.', 'erro'); return true; }
    const dados = clone(_m);
    const q = _linhaOrg
      ? sb().from('campo_catalogo').update({ dados, nome: 'Matriz da organização' }).eq('id', _linhaOrg.id).select('id')
      : sb().from('campo_catalogo').insert({ org_id: orgId(), tipo: 'matriz', codigo: 'padrao', nome: 'Matriz da organização', ordem: 0, ativo: true, dados }).select('id');
    const { data, error } = await q;
    if (error || !data?.length) { avisar(error ? D.traduzirErro(error) : 'Nada foi gravado: só o administrador altera a matriz.', 'erro'); return true; }
    avisar('Matriz salva. Vale para as avaliações a partir de agora.');
    await D.catalogo({ fresco: true }).catch(() => {});
    _m = null; redesenhar(); return true;
  }
  if (nome === 'campo:mz-padrao' && _linhaOrg) {
    if (!await confirmar('Voltar para a matriz padrão do GRID (igual à do SOC)? A matriz da sua empresa será apagada.')) return true;
    const { error } = await sb().from('campo_catalogo').delete().eq('id', _linhaOrg.id);
    if (error) { avisar(D.traduzirErro(error), 'erro'); return true; }
    avisar('Voltou à matriz padrão.');
    await D.catalogo({ fresco: true }).catch(() => {});
    _m = null; redesenhar(); return true;
  }
  return true;
}
