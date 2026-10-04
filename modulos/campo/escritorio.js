/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/campo/escritorio.js — "Escritório" (v233, PASSO-78)
   Segunda etapa da visita em dois tempos, pensada para o computador: numa
   tela só, o que falta para concluir (esquerda), os riscos de todos os GHEs
   numa tabela (meio) e o plano de ação (direita). Clicar num risco abre a
   ficha dele; a conclusão continua em "Assinaturas e conclusão", com as
   mesmas travas de sempre. No celular as três partes ficam uma embaixo da
   outra. Quem trabalha aqui: o técnico da visita e o administrador.
   ══════════════════════════════════════════════════════════════════════════ */

import * as D from './dados.js';
import * as C from './coerencia.js';
import { I, esc, nota, topo, ligarTela, btn, acoes, dataBr, quando, irPara, cabecalhoCelular } from './comum.js';
import { pill } from './planotela.js';

let _id = null;
const EXP = Object.fromEntries(D.EXPOSICAO);

const chk = (ok, texto, st, acao) => `<div class="cp-check"${acao ? ` data-acao="${acao}" style="cursor:pointer"` : ''}>
  <span class="ic ${ok === true ? 'ok' : ok === 'ci' ? 'ci' : 'al'}">${ok === true ? I.check : ok === 'ci' ? I.relogio : I.alerta}</span><span>${texto}</span><span class="st"${ok === true ? ' style="color:var(--green-text)"' : ok === 'ci' ? '' : ' style="color:var(--warn-text)"'}>${st}</span></div>`;

/* Situação de cada risco para a tabela (o pior primeiro). */
export function estadoRisco(r) {
  if (r.pendente) return ['depois', 'para depois', 'cinza'];
  if (D.riscoCompleto(r) !== 'ok') return ['campo', 'falta a avaliação', 'red'];
  const sem = (D.CONCLUSOES[r.categoria] || []).filter(c => !['S', 'N'].includes(r[c]));
  if (sem.length) return ['conc', 'falta a conclusão', 'warn'];
  if (C.pendentes(r).length) return ['coer', 'coerência', 'warn'];
  return ['ok', 'ok', 'ok'];
}

export async function render(params) {
  _id = String(params?.id || '').split('~')[0];
  ligarTela(null);
  const d = await D.abrir(_id);
  if (d.av.situacao === 'concluida') { setTimeout(() => irPara(`campo-avaliacao:${_id}`), 0); return nota('Avaliação já concluída.'); }
  const [clis, usus, cat] = await Promise.all([D.clientesPorId([d.av.cliente_id]), D.usuariosPorId([d.av.tecnico_id]), D.catalogo().catch(() => ({}))]);
  const cli = clis[d.av.cliente_id], tec = usus[d.av.tecnico_id];
  const editavel = D.podeEditar(d);
  if (editavel && D.temPlano()) { try { await D.atualizarPlano(_id); } catch (e) { console.warn('[campo] plano', e?.message); } }
  cabecalhoCelular(d, cli, 'Escritório', { rotulo: 'Escritório' });

  const enc = D.visitaEncerrada(d);
  const linhaVisita = `Visita de ${dataBr(d.av.data_visita)} por ${tec?.nome || 'técnico'}${enc && D.encerradaEm(d) ? ` · encerrada em ${quando(D.encerradaEm(d))}` : ''}${d.av.numero ? ' · ' + d.av.numero : ''}`;

  /* ── riscos de todos os GHEs ── */
  const linhas = [];
  for (const g of d.ghes) for (const r of g.riscos || []) {
    if (D.ehPsicossocial(r)) continue;
    const [k, t, cor] = estadoRisco(r);
    const n = D.nivelDe(cat?.matriz, r.probabilidade, r.severidade);
    linhas.push({ g, r, k, t, cor, n });
  }
  const ordem = { campo: 0, conc: 1, coer: 2, depois: 3, ok: 4 };
  linhas.sort((a, b) => ordem[a.k] - ordem[b.k]);
  const cont = (k) => linhas.filter(x => x.k === k).length;
  const conclusoes = (r) => (D.CONCLUSOES[r.categoria] || []).map(c => `${{ ins: 'Ins', per: 'Per', ae: 'AE' }[c]} ${r[c] || '–'}`).join(' · ');
  const tabela = linhas.length ? `<div class="cp-esc-tb"><table class="cp-tabela cp-esc-tabela">
      <thead><tr><th>GHE</th><th>Risco</th><th>P×S</th><th>Nível</th><th>Conclusão</th><th>Situação</th></tr></thead>
      <tbody>${linhas.map(({ g, r, t, cor, n }) => `<tr class="cp-tr" data-acao="ir:campo-ghe:${_id}~${g.id}~${r.uid}">
        <td>${esc(g.nome)}</td><td class="cp-temp">${r.codigo ? `<small>${esc(r.codigo)}</small> ` : ''}${esc(r.nome)}${EXP[r.exposicao] ? `<span class="cp-esc-exp">${esc(EXP[r.exposicao])}</span>` : ''}</td>
        <td>${r.probabilidade && r.severidade ? `${r.probabilidade}×${r.severidade}` : '–'}</td>
        <td>${n ? `<span class="cp-esc-nv" style="--nv:${esc(n.cor || '#D2D7E1')}"><i></i>${esc(n.nome.replace(/^Risco /, ''))}</span>` : '–'}</td>
        <td class="cp-esc-conc">${esc(conclusoes(r)) || '–'}</td>
        <td><span class="cp-esc-st ${cor}">${esc(t)}</span></td></tr>`).join('')}</tbody></table></div>
      <div class="cp-esc-cel">${linhas.map(({ g, r, t, cor, n }) => `<button type="button" class="cp-esc-ri" data-acao="ir:campo-ghe:${_id}~${g.id}~${r.uid}">
        <span class="n">${esc(r.nome)}</span><span class="s">GHE ${esc(g.nome)}${n ? ' · ' + esc(n.nome.replace(/^Risco /, '')) : ''} · ${esc(conclusoes(r))}</span>
        <span class="cp-esc-st ${cor}">${esc(t)}</span></button>`).join('')}</div>`
    : nota('Nenhum risco ainda. Abra a avaliação para montar os GHEs.');

  /* ── o que falta para concluir ── */
  const pl = D.temPlano() ? D.planoDe(d) : {};
  const acoesPl = pl.acoes || [];
  const planoOk = !D.temPlano() || !acoesPl.length || !!pl.revisado_em;
  const temAssTec = !!D.assinaturaDe(d, 'tec').path;
  const temAssAc = !!D.assinaturaDe(d, 'acomp').path || !d.av.acompanhante_nome || !!D.motivoSemAssinatura(d);
  const esperando = D.temPendEmpresa() ? D.pendEmpresaAbertas(d) : [];
  const primeiro = (k) => linhas.find(x => x.k === k);
  const ir = (x) => x ? `ir:campo-ghe:${_id}~${x.g.id}~${x.r.uid}` : '';
  /* psicossociais ficam fora da tabela, mas se ainda estão no GHE travam a conclusão (mesma conta do Finalizar) */
  const psiUids = new Set(d.ghes.flatMap(g => (g.riscos || []).filter(r => D.ehPsicossocial(r)).map(r => r.uid)));
  const faltasSemTec = D.faltas(d, { semAssinaturaTec: true });
  const nPsi = new Set(faltasSemTec.filter(f => f.risco && psiUids.has(f.risco)).map(f => f.risco)).size;
  const tudoOk = !faltasSemTec.length && !nPsi && !cont('campo') && !cont('conc') && !cont('coer') && !cont('depois') && planoOk && temAssAc && d.ghes.length;
  const falta = `<div class="cp-sec"><div class="cp-sec-tit">Para concluir</div>
      ${D.temVisita() ? chk(enc ? true : 'al', 'Visita encerrada', enc ? 'feito' : 'em aberto', enc ? '' : `ir:campo-encerrar:${_id}`) : ''}
      ${chk(cont('campo') ? 'al' : true, 'Avaliação dos riscos', cont('campo') ? `${cont('campo')} a completar` : 'feito', ir(primeiro('campo')))}
      ${cont('depois') ? chk('al', 'Riscos para depois', `${cont('depois')} em aberto`, ir(primeiro('depois'))) : ''}
      ${chk(cont('conc') ? 'al' : true, 'Conclusões (ins., per., AE)', cont('conc') ? `${cont('conc')} a responder` : 'feito', ir(primeiro('conc')))}
      ${chk(cont('coer') ? 'al' : true, 'Avisos de coerência', cont('coer') ? `${cont('coer')} a corrigir ou justificar` : 'nenhum', ir(primeiro('coer')))}
      ${nPsi ? chk('al', 'Riscos psicossociais no GHE', `${nPsi} a tirar ou classificar`, `ir:campo-avaliacao:${_id}`) : ''}
      ${D.temPlano() ? chk(planoOk ? true : 'al', 'Plano de ação', !acoesPl.length ? 'nenhuma ação' : planoOk ? 'revisado' : 'revisar', `ir:campo-plano:${_id}`) : ''}
      ${chk(temAssAc ? true : 'al', 'Assinatura do acompanhante', D.assinaturaDe(d, 'acomp').path ? 'feita' : D.motivoSemAssinatura(d) ? 'não assinou (motivo registrado)' : d.av.acompanhante_nome ? 'falta' : 'sem acompanhante', temAssAc ? '' : `ir:campo-finalizar:${_id}`)}
      ${chk(temAssTec ? true : 'ci', 'Assinatura do técnico', temAssTec ? 'feita' : 'ao concluir', `ir:campo-finalizar:${_id}`)}
      ${esperando.length ? chk('ci', `Esperando da empresa: ${esc(esperando.map(p => p.nome).slice(0, 2).join(', '))}${esperando.length > 2 ? '…' : ''}`, 'não trava', '') : ''}
      <div style="margin-top:12px">${btn(tudoOk ? 'Assinar e concluir' : 'Assinaturas e conclusão', `ir:campo-finalizar:${_id}`, { cls: tudoOk ? 'btn-amber' : 'btn-outline', estilo: 'width:100%' })}</div>
      <div class="cp-ajuda" style="margin-top:6px">${tudoOk ? 'Tudo pronto: falta só a sua assinatura.' : 'O botão de concluir libera quando tudo acima estiver verde.'}</div></div>`;

  /* ── plano de ação ── */
  const c = { imediata: 0, alta: 0, media: 0, baixa: 0 };
  for (const a of acoesPl) if (a.prioridade in c) c[a.prioridade]++;
  const plano = D.temPlano() ? `<div class="cp-sec"><div class="cp-sec-tit">Plano de ação <span class="dir">${acoesPl.length} ${acoesPl.length === 1 ? 'ação' : 'ações'}</span></div>
      ${acoesPl.length ? `<div class="cp-esc-pri">${['imediata', 'alta', 'media', 'baixa'].filter(p => c[p]).map(p => `${pill(p)}<b>${c[p]}</b>`).join('')}</div>
        ${acoesPl.slice(0, 5).map(a => `<div class="cp-esc-ac" data-acao="ir:campo-plano:${_id}">${pill(a.prioridade)}<div><b>${esc(String(a.o_que || '').replace(/\s·\s*A-\d+$/, ''))}</b><small>${esc(a.toda_empresa ? 'Toda a empresa' : 'GHE ' + (a.ghe || a.ghe_nome || ''))}</small></div></div>`).join('')}
        ${acoesPl.length > 5 ? `<div class="cp-ajuda">+ ${acoesPl.length - 5} ${acoesPl.length - 5 === 1 ? 'ação' : 'ações'}</div>` : ''}`
        : '<div class="cp-ajuda">O plano é montado a partir dos riscos e do enquadramento (SESMT e CIPA).</div>'}
      <div style="margin-top:10px">${btn(planoOk || !acoesPl.length ? 'Abrir o plano' : 'Revisar o plano', `ir:campo-plano:${_id}`, { cls: planoOk ? 'btn-outline' : 'btn-navy', estilo: 'width:100%' })}</div></div>` : '';

  return `${topo(d, cli, { rotulo: 'Escritório', sub: linhaVisita })}
    ${!enc && D.temVisita() ? nota(`A visita ainda não foi encerrada. Dá para trabalhar aqui mesmo assim; para registrar o fim da visita, use ${btn('Encerrar a visita', `ir:campo-encerrar:${_id}`, { cls: 'btn-outline btn-sm' })}`, 'warn') : ''}
    ${!editavel ? nota('Seu perfil de acesso só consulta esta avaliação.', 'warn') : ''}
    <div class="cp-esc">
      <div class="cp-esc-a">${falta}${plano}</div>
      <div class="cp-esc-b"><div class="cp-sec"><div class="cp-sec-tit">Riscos da visita <span class="dir">${linhas.length}</span></div>${tabela}
        <div class="cp-ajuda" style="margin-top:8px">Clique num risco para abrir a ficha completa: análise, lesões, conclusões e a orientação do Laudomiro.</div></div></div>
    </div>
    ${acoes([btn('Voltar para a avaliação', `ir:campo-avaliacao:${_id}`, { papel: 'cp-a-voltar' }),
      btn(tudoOk ? 'Assinar e concluir' : 'Assinaturas e conclusão', `ir:campo-finalizar:${_id}`, { cls: 'btn-amber', papel: 'cp-a-prox' })])}`;
}
