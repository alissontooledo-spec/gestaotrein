/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/campo/pendencias.js — "O que falta a empresa enviar" (v222)
   Pedido do Alisson depois da visita na ZEHN BIER (29/09): marcar o que a
   empresa ainda vai mandar (PGR, FISPQ, laudo...). Com item em aberto a
   avaliação vai para "Aguardando informações" (o banco decide, PASSO-73).
   • tipo escolhido com um toque (tipos editáveis pelo administrador, tela
     "Tipos de documento"); detalhe, prazo prometido e risco ligado opcionais;
   • vários itens por avaliação; cada um: Editar · Chegou · Remover;
   • o que chegou fica no histórico (resolvido_em), não some.
   Usado pela tela da avaliação e pelo quadro (lista.js).
   ══════════════════════════════════════════════════════════════════════════ */

import * as D from './dados.js';
import { I, esc, avisar, confirmar, ponte, btn } from './comum.js';

/* Bloco "Esperando da empresa" (tela da avaliação). */
export function blocoEsperando(d, editavel) {
  if (!D.temPendEmpresa()) return '';
  const ab = D.pendEmpresaAbertas(d);
  if (!ab.length) {
    return editavel ? `<button type="button" class="cp-falta" data-acao="campo:pe-novo">${I.relogio}<span>Falta algo da empresa?<small>Marque o que a empresa ainda vai enviar. A avaliação vai para "Aguardando informações".</small></span></button>` : '';
  }
  return `<div class="cp-esperando" id="cpEsperando">
    <div class="cp-esperando-t">${I.relogio}<span>Esperando da empresa</span><em>${ab.length}</em></div>
    ${ab.map(p => {
      const pz = D.prazoInfo(p.prazo);
      return `<div class="cp-esp-it">
        <div class="cp-esp-tx"><b>${esc(p.nome || 'Documento')}</b>${p.detalhe ? `<span>${esc(p.detalhe)}</span>` : ''}
          ${p.risco_nome ? `<span class="cp-esp-r">Risco: ${esc(p.risco_nome)}</span>` : ''}
          ${pz.txt ? `<span class="cp-esp-pz${pz.vencido ? ' venc' : ''}">${pz.vencido ? 'Prazo vencido · era' : 'Prometido para'} ${esc(pz.txt)}</span>` : ''}</div>
        ${editavel ? `<div class="cp-esp-bt">${btn('Chegou', `campo:pe-chegou:${p.uid}`, { cls: 'btn-outline btn-sm' })}${btn('Editar', `campo:pe-editar:${p.uid}`, { cls: 'btn-ghost btn-sm' })}</div>` : ''}
      </div>`;
    }).join('')}
    ${editavel ? `<button type="button" class="cp-esp-mais" data-acao="campo:pe-novo">${I.plus}Outro item</button>` : ''}
  </div>`;
}

/* Janela de marcar/editar. `aposSalvar` roda depois de gravar (o quadro usa
   para enviar ao banco e redesenhar a lista). */
export async function modalPendEmpresa(d, item, redesenhar, { riscoUid = null, gheId = null, aposSalvar = null } = {}) {
  const p = ponte();
  if (!p.abrirModal) return;
  let tipos = [];
  try { tipos = (await D.catalogo()).documentos || []; } catch { /* sem catálogo: padrão */ }
  if (!tipos.length) tipos = D.TIPOS_DOC_PADRAO.map(([codigo, nome]) => ({ codigo, nome }));
  /* tipo que saiu do catálogo depois de lançado continua escolhível ao editar */
  if (item?.tipo && !tipos.some(t => t.codigo === item.tipo)) tipos = [...tipos, { codigo: item.tipo, nome: item.nome }];
  let escolhido = item?.tipo || '';
  const riscos = d.ghes.flatMap(g => (g.riscos || []).filter(r => !D.ehPsicossocial(r)).map(r => ({ g, r })));
  const rSel = item?.risco_uid || riscoUid || '';
  const est = 'width:100%;padding:11px 14px;border:1.5px solid var(--border);border-radius:var(--r-md);font-size:14px;font-family:inherit;background:var(--surface)';
  const admin = ['administrador', 'provedor'].includes(p.perfil?.() || '');
  p.abrirModal(item ? 'Editar o que falta' : 'O que falta a empresa enviar?', `
    <div class="cp-ajuda" style="margin:0 0 10px">A avaliação vai para "Aguardando informações" no quadro até você marcar que chegou.</div>
    <div class="cp-pe-chips" id="cpPeChips">${tipos.map(t => `<button type="button" class="cp-opt${t.codigo === escolhido ? ' on' : ''}" data-cp-tipo="${esc(t.codigo)}"><span class="cx">${I.check}</span>${esc(t.nome)}</button>`).join('')}</div>
    ${admin ? `<div class="cp-ajuda" style="margin:6px 0 0">Faltou um tipo? O administrador edita a lista em Avaliações de campo · Tipos de documento.</div>` : ''}
    <div class="field" style="margin-top:12px"><label>Detalhe (opcional)</label><input type="text" id="cpPeDet" maxlength="300" value="${esc(item?.tipo === 'outro' ? item?.nome : (item?.detalhe || ''))}" placeholder="Ex.: FISPQ do detergente alcalino da lavadora"></div>
    <div class="field"><label>Prometido para (opcional)</label><input type="date" id="cpPePrazo" value="${esc(item?.prazo || '')}" style="${est}"></div>
    ${riscos.length ? `<div class="field"><label>Ligado a um risco? (opcional)</label><select id="cpPeRisco" style="${est}">
      <option value="">Não · vale para a avaliação toda</option>
      ${riscos.map(({ g, r }) => `<option value="${esc(g.id + '|' + r.uid)}" ${r.uid === rSel ? 'selected' : ''}>${esc(`GHE ${g.nome} · ${r.codigo ? r.codigo + ' ' : ''}${r.nome}`)}</option>`).join('')}</select></div>` : ''}
    ${item ? `<button type="button" class="btn btn-ghost btn-sm" id="cpPeRem" style="color:var(--red);padding-left:0">Remover este item</button>` : ''}`,
    p.botoes(item ? 'Salvar' : 'Marcar como aguardando', 'cpPeOk'));
  /* a casca põe o cursor no 1º campo ao abrir; no celular isso sobe o teclado
     por cima dos tipos — tira o cursor (o técnico toca no tipo primeiro). */
  setTimeout(() => { if (window.innerWidth < 768 && document.activeElement?.id === 'cpPeDet') document.activeElement.blur(); }, 160);
  setTimeout(() => {
    document.querySelectorAll('#cpPeChips [data-cp-tipo]').forEach(b => {
      b.onclick = () => {
        escolhido = b.dataset.cpTipo;
        document.querySelectorAll('#cpPeChips [data-cp-tipo]').forEach(x => x.classList.toggle('on', x === b));
        if (escolhido === 'outro') document.getElementById('cpPeDet')?.focus();
      };
    });
    const rem = document.getElementById('cpPeRem');
    if (rem && item) rem.onclick = async () => {
      if (!await confirmar(`Remover "${item.nome}" da lista? Use isto só para item lançado por engano; quando o documento chegar, toque em Chegou.`)) return;
      D.removerPendEmpresa(d.id, item.uid);
      p.fecharModal(); avisar('Item removido.');
      if (aposSalvar) await aposSalvar(); else redesenhar();
    };
  }, 30);
  p.aoConfirmar('cpPeOk', async () => {
    if (!escolhido) { avisar('Escolha o que falta (toque num dos tipos).', 'erro'); return; }
    const detalhe = document.getElementById('cpPeDet')?.value.trim() || '';
    if (escolhido === 'outro' && !detalhe) { avisar('Em "Outro", escreva no detalhe o que falta.', 'erro'); return; }
    const prazo = document.getElementById('cpPePrazo')?.value || null;
    const [gid, ruid] = String(document.getElementById('cpPeRisco')?.value || (gheId && riscoUid ? gheId + '|' + riscoUid : '')).split('|');
    const rr = ruid ? riscos.find(x => x.r.uid === ruid) : null;
    const t = tipos.find(x => x.codigo === escolhido);
    const dados = { tipo: escolhido, nome: escolhido === 'outro' && detalhe ? detalhe.slice(0, 80) : (t?.nome || escolhido),
      detalhe: escolhido === 'outro' ? '' : detalhe, prazo, ghe_id: rr ? gid : null, risco_uid: rr ? ruid : null,
      risco_nome: rr ? `${rr.r.codigo ? rr.r.codigo + ' ' : ''}${rr.r.nome}` : null };
    if (item) D.alterarPendEmpresa(d.id, item.uid, dados); else D.adicionarPendEmpresa(d.id, dados);
    p.fecharModal();
    avisar(item ? 'Item atualizado.' : 'Marcado. A avaliação está aguardando a empresa.');
    if (aposSalvar) await aposSalvar(); else redesenhar();
  });
}
