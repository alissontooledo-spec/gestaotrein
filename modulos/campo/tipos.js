/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/campo/tipos.js — Tipos de documento (v222, PASSO-73)
   Os tipos do "O que falta a empresa enviar" (PGR, FISPQ, LTCAT...). O GRID
   traz um padrão; cada organização acrescenta, renomeia ou esconde os seus
   — pela tela, sem SQL (regra do Alisson para configurações, 26/09).
   Como funciona por baixo: o padrão tem org_id nulo e ninguém da organização
   o altera. Renomear ou esconder um tipo padrão grava uma linha COM o org_id
   da organização e o mesmo código, que passa a valer no lugar do padrão.
   Quem edita: administrador (e o Provedor). A trava de verdade é a RLS.
   Itens já lançados nas avaliações guardam o nome do dia: mudar aqui não
   altera avaliação antiga.
   ══════════════════════════════════════════════════════════════════════════ */

import { cliente } from '../../nucleo/dados.js';
import * as sessao from '../../nucleo/sessao.js';
import * as D from './dados.js';
import { esc, nota, ligarTela, avisar, confirmar, ponte, btn, secTit } from './comum.js';

const sb = () => cliente();
const orgId = () => sessao.orgId?.() || sessao.usuario()?.org_id || null;
const podeEditar = () => {
  const p = ponte();
  const perfil = p.perfil?.() || sessao.perfil?.();
  return ['administrador', 'provedor'].includes(perfil) && (p.pode ? p.pode('campo', 2) !== false : true);
};

async function lerTudo() {
  const { data, error } = await sb().from('campo_catalogo').select('id,org_id,tipo,codigo,nome,ordem,ativo')
    .eq('tipo', 'documento').order('ordem').range(0, 499);
  if (error) throw error;
  const org = orgId();
  const linhas = (data || []).filter(x => !x.org_id || x.org_id === org);
  const padrao = new Map(linhas.filter(x => !x.org_id).map(x => [x.codigo, x]));
  const meus = new Map(linhas.filter(x => x.org_id).map(x => [x.codigo, x]));
  const codigos = [...new Set([...padrao.keys(), ...meus.keys()])];
  return codigos.map(c => {
    const p = padrao.get(c), m = meus.get(c);
    const v = m || p;
    return { codigo: c, nome: v.nome, ordem: v.ordem ?? 0, ativo: v.ativo !== false,
      padrao: !!p, personalizado: !!(p && m), meu: m || null, doPadrao: p || null };
  }).sort((a, b) => (a.ativo === b.ativo ? 0 : a.ativo ? -1 : 1) || a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function render() {
  ligarTela(null);
  if (!D.temPendEmpresa()) return nota('Esta tela precisa do PASSO-73 no banco. Peça ao suporte do GRID.', 'warn');
  let tipos;
  try { tipos = await lerTudo(); }
  catch (e) {
    return /documento|check constraint|campo_catalogo_tipo_ck/i.test(String(e?.message || ''))
      ? nota('Esta tela precisa do PASSO-73 no banco. Peça ao suporte do GRID.', 'warn')
      : nota(esc(D.traduzirErro(e)), 'red');
  }
  const ed = podeEditar();
  const linha = (t) => `<div class="cp-tipo${t.ativo ? '' : ' off'}">
      <div class="cp-tipo-tx"><b>${esc(t.nome)}</b><small>${t.ativo ? '' : 'Escondido · '}${t.padrao ? (t.personalizado ? 'padrão do GRID, alterado pela sua empresa' : 'padrão do GRID') : 'criado pela sua empresa'}</small></div>
      ${ed ? `<div class="cp-tipo-bt">
        ${t.codigo === 'outro' ? '' : btn('Renomear', `campo:tp-ren:${t.codigo}`, { cls: 'btn-ghost btn-sm' })}
        ${btn(t.ativo ? 'Esconder' : 'Mostrar', `campo:tp-vis:${t.codigo}`, { cls: 'btn-outline btn-sm' })}
        ${!t.padrao ? btn('Apagar', `campo:tp-apagar:${t.codigo}`, { cls: 'btn-ghost btn-sm', estilo: 'color:var(--red)' }) : ''}
        ${t.personalizado ? btn('Voltar ao padrão', `campo:tp-padrao:${t.codigo}`, { cls: 'btn-ghost btn-sm' }) : ''}
      </div>` : ''}</div>`;
  return `
    <div class="cp-topo"><div class="cp-topo-txt"><div class="cp-topo-emp">Avaliação de Campo</div><div class="cp-topo-tit">Tipos de documento</div>
      <div class="cp-topo-sub">O que aparece em "O que falta a empresa enviar?". Avaliações já feitas não mudam.</div></div>
      ${ed ? btn('Novo tipo', 'campo:tp-novo', { cls: 'btn-amber' }) : ''}</div>
    ${ed ? '' : nota('Só o administrador altera esta lista.')}
    ${secTit(`${tipos.filter(t => t.ativo).length} em uso`)}
    <div class="cp-sec" style="padding:4px 14px">${tipos.map(linha).join('') || '<div class="cp-ajuda" style="padding:10px 0">Nenhum tipo.</div>'}</div>
    <div style="margin-top:6px">${btn('Voltar para as avaliações', 'ir:campo', { cls: 'btn-ghost' })}</div>`;
}

const slug = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30) || 'tipo';

function pedirNome(titulo, atual, aoSalvar) {
  const p = ponte();
  p.abrirModal(titulo, `<div class="field"><label>Nome do tipo *</label><input type="text" id="cpTpNome" maxlength="80" value="${esc(atual || '')}" placeholder="Ex.: ART do responsável técnico"></div>`,
    p.botoes('Salvar', 'cpTpOk'));
  setTimeout(() => document.getElementById('cpTpNome')?.focus(), 60);
  p.aoConfirmar('cpTpOk', async () => {
    const nome = document.getElementById('cpTpNome')?.value.trim();
    if (!nome) { avisar('Informe o nome.', 'erro'); return; }
    await aoSalvar(nome);
  });
}
async function gravar(q, okMsg, redesenhar) {
  const { data, error } = await q;
  if (error) { avisar(/duplicate|23505/.test(error.message + error.code) ? 'Já existe um tipo com esse nome.' : D.traduzirErro(error), 'erro'); return false; }
  if (Array.isArray(data) && !data.length) { avisar('Nada foi gravado: só o administrador altera esta lista.', 'erro'); return false; }
  ponte().fecharModal?.();
  avisar(okMsg);
  await D.catalogo({ fresco: true }).catch(() => {});
  redesenhar();
  return true;
}

export async function acao(nome, valor, redesenhar) {
  if (!nome.startsWith('campo:tp-')) return false;
  if (!podeEditar()) { avisar('Só o administrador altera esta lista.', 'erro'); return true; }
  const tipos = await lerTudo();
  const t = tipos.find(x => x.codigo === valor);
  const org = orgId();
  if (nome === 'campo:tp-novo') {
    pedirNome('Novo tipo de documento', '', async (n) => {
      if (tipos.some(x => x.nome.toLowerCase() === n.toLowerCase())) { avisar('Já existe um tipo com esse nome.', 'erro'); return; }
      let cod = slug(n); while (tipos.some(x => x.codigo === cod)) cod = cod.slice(0, 26) + '_' + Math.floor(Math.random() * 900 + 100);
      const ordem = Math.max(0, ...tipos.filter(x => x.codigo !== 'outro').map(x => x.ordem)) + 10;
      await gravar(sb().from('campo_catalogo').insert({ org_id: org, tipo: 'documento', codigo: cod, nome: n, ordem, ativo: true, dados: {} }).select('id'), 'Tipo criado.', redesenhar);
    });
    return true;
  }
  if (!t) return true;
  if (nome === 'campo:tp-ren') {
    pedirNome('Renomear tipo', t.nome, async (n) => {
      const q = t.meu
        ? sb().from('campo_catalogo').update({ nome: n }).eq('id', t.meu.id).select('id')
        : sb().from('campo_catalogo').insert({ org_id: org, tipo: 'documento', codigo: t.codigo, nome: n, ordem: t.ordem, ativo: t.ativo, dados: {} }).select('id');
      await gravar(q, 'Nome alterado.', redesenhar);
    });
    return true;
  }
  if (nome === 'campo:tp-vis') {
    const ativo = !t.ativo;
    const q = t.meu
      ? sb().from('campo_catalogo').update({ ativo }).eq('id', t.meu.id).select('id')
      : sb().from('campo_catalogo').insert({ org_id: org, tipo: 'documento', codigo: t.codigo, nome: t.nome, ordem: t.ordem, ativo, dados: {} }).select('id');
    await gravar(q, ativo ? 'O tipo voltou a aparecer.' : 'Tipo escondido. Ele não aparece mais para escolher.', redesenhar);
    return true;
  }
  if (nome === 'campo:tp-apagar' && t.meu && !t.padrao) {
    if (!await confirmar(`Apagar o tipo "${t.nome}"? Avaliações que já usaram continuam com o nome.`)) return true;
    await gravar(sb().from('campo_catalogo').delete().eq('id', t.meu.id).select('id'), 'Tipo apagado.', redesenhar);
    return true;
  }
  if (nome === 'campo:tp-padrao' && t.meu && t.padrao) {
    if (!await confirmar(`Voltar "${t.nome}" ao padrão do GRID ("${t.doPadrao.nome}")?`)) return true;
    await gravar(sb().from('campo_catalogo').delete().eq('id', t.meu.id).select('id'), 'Voltou ao padrão.', redesenhar);
    return true;
  }
  return true;
}
