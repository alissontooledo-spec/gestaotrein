/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/campo/planotela.js — Plano de ação da avaliação (v223)
   Tela do técnico (celular): o GRID monta as ações a partir dos riscos e dos
   treinamentos; o técnico confere, ajusta o que quiser e toca em "Revisei o
   plano" (sem isso o banco não deixa concluir — PASSO-74). Funciona sem
   internet, junto com a avaliação.
   Cada campo que o técnico muda fica marcado como dele: o GRID não
   sobrescreve mais, mesmo que o risco mude depois.
   ══════════════════════════════════════════════════════════════════════════ */

import * as D from './dados.js';
import * as P from './plano.js';
import { I, esc, nota, ligarTela, avisar, confirmar, ponte, btn, acoes, seg, inp, area, irPara, cabecalhoCelular, topo, rolarTopo } from './comum.js';

let _id = null, _aberta = null, _ctx = null;

export const PRI_CLS = { imediata: 'p-im', alta: 'p-al', media: 'p-me', baixa: 'p-ba' };
export const pill = (prio) => `<span class="cp-pri ${PRI_CLS[prio] || ''}">${esc(P.NOME_PRIO[prio] || prio || '')}</span>`;
const acaoAberta = (d) => (D.planoDe(d).acoes || []).find(a => a.chave === _aberta) || null;
const cont = (n, max) => `<span class="cp-pa-cont${n > max ? ' mais' : ''}">${n.toLocaleString('pt-BR')} de ${max.toLocaleString('pt-BR')}</span>`;

export function resumoPrioridades(acoesLista) {
  const c = P.contar(acoesLista);
  return `<div class="cp-pa-res">${P.PRIORIDADES.map(([k, t]) => `<div class="${PRI_CLS[k]}"><b>${c[k]}</b><span>${esc(t)}</span></div>`).join('')}</div>`;
}

export async function render(params) {
  _id = String(params?.id || '').split('~')[0];
  const foco = String(params?.id || '').split('~')[1];
  if (foco) _aberta = foco;
  ligarTela({ digitar });
  if (!_id) return nota('Nenhuma avaliação selecionada.');
  const d = await D.abrir(_id);
  const [clis] = await Promise.all([D.clientesPorId([d.av.cliente_id])]);
  const cli = clis[d.av.cliente_id];
  cabecalhoCelular(d, cli, 'Plano de ação');
  if (!D.temPlano()) return nota('O plano de ação precisa do PASSO-74 no banco. Peça ao suporte do GRID.', 'warn');

  let r;
  try { r = await D.atualizarPlano(_id); }
  catch (e) { return nota(esc('Não foi possível montar o plano: ' + D.traduzirErro(e)), 'red'); }
  _ctx = r.ctx;
  const pl = r.plano || {};
  const lista = pl.acoes || [];
  const ed = D.podeEditar(d);
  const concluida = d.av.situacao === 'concluida';
  if (_aberta && !lista.some(a => a.chave === _aberta)) _aberta = null;

  const cabec = `${topo(d, cli, { rotulo: 'Plano de ação 5W2H', sub: 'Pronto para copiar no SOC · GRO › Plano de ação' })}
    ${resumoPrioridades(lista)}
    ${concluida ? nota(`Avaliação concluída: o plano foi para o acompanhamento. ${btn('Lançar no SOC e acompanhar', `ir:campo-soc:${_id}`, { cls: 'btn-navy btn-sm' })}`)
      : pl.revisado_em ? `<div class="cp-pa-ok">${I.check}<span>Plano revisado em ${esc(new Date(pl.revisado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }))}. Se mudar algo, revise de novo.</span></div>`
      : lista.length ? nota('Confira as ações e toque em <b>Revisei o plano</b>. Sem isso não dá para concluir a avaliação.', 'warn') : ''}
    ${r.semNivel.length ? nota(`${r.semNivel.length === 1 ? 'Um risco ainda não tem' : r.semNivel.length + ' riscos ainda não têm'} probabilidade e severidade, e por isso não ${r.semNivel.length === 1 ? 'entra' : 'entram'} no plano: ${esc(r.semNivel.slice(0, 4).map(x => `${x.risco} (GHE ${x.ghe})`).join(', '))}${r.semNivel.length > 4 ? '…' : ''}.`, 'warn') : ''}`;

  /* v225 (engenheiro): a empresa tem AEP (NR-17)? Sem AEP, o plano pede para fazê-la primeiro. */
  const temErgo = d.ghes.some(g => (g.riscos || []).some(x => x.categoria === 'ergonomico' && x.codigo !== '1068'));
  const blocoAep = temErgo ? `<div class="cp-sec cp-pa-aep"><div class="cp-lbl" style="margin:0 0 8px">A empresa tem Avaliação Ergonômica Preliminar (AEP) registrada?</div>
      ${seg('pa-aep', [['S', 'Sim'], ['N', 'Não']], pl.aep, { travado: !ed })}
      <div class="cp-ajuda">${pl.aep === 'S' ? 'As medidas ergonômicas saem da AEP da empresa. Se forem insuficientes, o plano pede a AET.'
        : pl.aep === 'N' ? 'O plano pede primeiro a AEP (NR-17, item 17.3.1). As medidas ergonômicas vêm depois dela.'
        : 'Sem resposta, o GRID considera que a empresa não tem AEP e pede para fazê-la primeiro.'}</div></div>` : '';
  const cartoes = lista.map(a => cartao(a, ed)).join('') || nota(d.ghes.length
    ? 'Nenhuma ação: todos os riscos avaliados estão no nível Irrelevante e não há treinamento marcado. Se precisar, crie uma ação.'
    : 'Cadastre os GHEs e os riscos primeiro. O plano sai deles.');
  const disp = (pl.dispensadas || []);
  const blocoDisp = disp.length ? `<details class="cp-dobra-sec"><summary>Tiradas do plano <small>${disp.length}</small></summary>
      <div class="cp-sec" style="margin:8px 0 0">${disp.map(x => `<div class="cp-kv"><span><b>${esc(x.numero || '')}</b> ${esc(x.o_que || '')}<br><small style="color:var(--text-3)">Motivo: ${esc(x.motivo || '')}</small></span>
        ${ed ? btn('Voltar ao plano', `campo:pa-voltar:${x.chave}`, { cls: 'btn-ghost btn-sm' }) : ''}</div>`).join('')}</div></details>` : '';

  return `${cabec}
    ${blocoAep}
    <div class="cp-sec-t2">Ações <span>${lista.length}</span></div>
    ${cartoes}
    ${ed ? `<button type="button" class="cp-add-ghe" data-acao="campo:pa-nova">${I.plus}Nova ação</button>` : ''}
    ${blocoDisp}
    ${acoes([btn('Voltar', `ir:campo-avaliacao:${_id}`, { papel: 'cp-a-voltar' }),
      ed && lista.length ? btn(pl.revisado_em ? 'Plano revisado' : 'Revisei o plano', 'campo:pa-revisei', { cls: 'btn-amber', papel: 'cp-a-prox', travado: !!pl.revisado_em || lista.some(a => P.excede(a).por_que || P.excede(a).como) }) : ''])}`;
}

function cartao(a, ed) {
  const aberto = a.chave === _aberta;
  const sub = a.origem === 'risco'
    ? `GHE ${a.ghe} · ${a.risco}${a.nivel?.nome ? ' · ' + a.nivel.nome.replace(/^Risco\s+/i, '') + (a.nivel.p ? ` (S${a.nivel.s} · P${a.nivel.p})` : '') : ''}`
    : a.origem === 'treinamento' ? `${a.toda_empresa ? 'Toda a empresa' : 'GHE ' + a.ghe} · ${(a.trein || []).length} treinamento${(a.trein || []).length === 1 ? '' : 's'}${a.pessoas ? ' · ' + a.pessoas + ' pessoas' : ''}`
    : a.origem === 'aep' ? `${a.toda_empresa ? 'Toda a empresa' : 'GHE ' + a.ghe} · Ergonomia (NR-17)`
    : `${a.ghe ? 'GHE ' + a.ghe : 'Toda a empresa'} · escrita por você`;
  const ex = P.excede(a);
  const avisos = [a.orfa ? 'O risco desta ação saiu da avaliação. Tire do plano ou mantenha.' : '',
    ex.por_que || ex.como ? 'Texto maior que o limite do SOC (2.500 letras). Encurte o motivo ou as medidas.' : ''].filter(Boolean);
  const head = `<button type="button" class="cp-pa-card-h" data-acao="campo:pa-abrir:${esc(a.chave)}">
      <span class="l1">${pill(a.prioridade)}<span class="n">${esc(a.numero || '')} · até ${esc(P.dataBr(a.prazo))}</span>${(a.editados || []).length && a.origem !== 'manual' ? '<span class="cp-pa-ed">alterada por você</span>' : ''}</span>
      <b>${esc(a.o_que_base || 'Sem título')}</b><small>${esc(sub)}</small>
      ${avisos.map(t => `<span class="cp-pa-aviso">${I.alerta}${esc(t)}</span>`).join('')}
      <span class="chev">${aberto ? I.chevD : I.chevD}</span></button>`;
  if (!aberto) return `<div class="cp-pa-card">${head}</div>`;
  const t = !ed;
  const num = a.numero ? ` · ${a.numero}` : '';
  const q = a.quanto != null && a.quanto !== '' ? P.fmtQuanto(a.quanto) : '';
  const corpo = `<div class="cp-pa-corpo">
      <label class="cp-lbl">O quê? <span data-pa-cont="o_que">${cont((a.o_que_base || '').length + num.length, P.LIMITE.o_que)}</span></label>${inp('pa.o_que_base', a.o_que_base, { travado: t })}
      <div class="cp-grid2" style="margin-top:12px">
        <div><label class="cp-lbl">Prioridade</label>${seg('pa-prio', P.PRIORIDADES, a.prioridade, { amb: false, travado: t })}</div>
        <div><label class="cp-lbl">Quando? (prazo)</label>${inp('pa.prazo', a.prazo, { tipo: 'date', travado: t })}</div></div>
      <div class="cp-grid2" style="margin-top:12px">
        <div><label class="cp-lbl">Quem? (responsável na empresa)</label>${inp('pa.quem', a.quem, { ph: 'Nome e cargo', travado: t })}</div>
        <div><label class="cp-lbl">Quanto? (R$, se souber)</label>${inp('pa.quanto', q, { ph: '0,00', travado: t, modo: 'decimal' })}</div></div>
      <label class="cp-lbl" style="margin-top:12px">Motivo (vai no Por quê?)</label>${area('pa.motivo', a.motivo, { travado: t, alto: 96 })}
      <label class="cp-lbl" style="margin-top:12px">Meta</label>${area('pa.meta', a.meta, { travado: t, alto: 64 })}
      <label class="cp-lbl" style="margin-top:12px">Medidas (uma por linha, na ordem: coletiva, administrativa, EPI)</label>${area('pa.medidas', (a.medidas || []).join('\n'), { travado: t, alto: 120 })}
      <label class="cp-lbl" style="margin-top:12px">Acompanhamento</label>${area('pa.acompanhamento', a.acompanhamento, { travado: t, alto: 64 })}
      <label class="cp-lbl" style="margin-top:12px">Aferição do resultado (como saber que funcionou)</label>${area('pa.afericao', a.afericao, { travado: t, alto: 64 })}
      <label class="cp-lbl" style="margin-top:12px">Base legal</label>${inp('pa.base_legal', a.base_legal, { travado: t })}
      <label class="cp-lbl" style="margin-top:12px">Categoria no SOC</label>${seg('pa-cat', P.CATEGORIAS_SOC.map(c => [c, c]), a.categoria, { amb: false, travado: t })}
      <label class="cp-lbl" style="margin-top:12px">Exibir no relatório</label>
      <div class="cp-opts">${P.RELATORIOS_SOC.map(rr => `<span class="cp-opt${(a.relatorios || []).includes(rr) ? ' on' : ''}" ${t ? '' : `data-acao="campo:pa-rel:${rr}"`}><span class="cx">${I.check}</span>${rr}</span>`).join('')}</div>
      <details class="cp-pa-prev"><summary>Ver como fica no SOC</summary>
        <div class="cp-pa-prev-t">Por quê? <span data-pa-cont="por_que">${cont((a.por_que || '').length, P.LIMITE.texto)}</span></div><pre data-pa-prev="por_que">${esc(a.por_que || '')}</pre>
        <div class="cp-pa-prev-t">Como? <span data-pa-cont="como">${cont((a.como || '').length, P.LIMITE.texto)}</span></div><pre data-pa-prev="como">${esc(a.como || '')}</pre></details>
      ${ed ? `<div class="cp-pa-bts">
        ${(a.editados || []).length && a.origem !== 'manual' ? btn('Voltar ao texto do GRID', `campo:pa-restaurar:${a.chave}`, { cls: 'btn-ghost btn-sm' }) : ''}
        ${btn(a.origem === 'manual' ? 'Apagar ação' : 'Tirar do plano', `campo:pa-tirar:${a.chave}`, { cls: 'btn-ghost btn-sm', estilo: 'color:var(--red)' })}
        ${btn('Fechar', `campo:pa-abrir:${a.chave}`, { cls: 'btn-outline btn-sm' })}</div>` : ''}
    </div>`;
  return `<div class="cp-pa-card aberto">${head}${corpo}</div>`;
}

/* Digitação: grava no item aberto e atualiza contadores e prévia sem redesenhar. */
const CAMPO = { 'pa.o_que_base': 'o_que_base', 'pa.prazo': 'prazo', 'pa.quem': 'quem', 'pa.quanto': 'quanto', 'pa.motivo': 'motivo',
  'pa.meta': 'meta', 'pa.medidas': 'medidas', 'pa.acompanhamento': 'acompanhamento', 'pa.afericao': 'afericao', 'pa.base_legal': 'base_legal' };
function digitar(chave, valor) {
  const campo = CAMPO[chave]; if (!campo || !_aberta || !_ctx) return;
  let v = valor;
  if (campo === 'medidas') v = String(valor || '').split('\n').map(x => x.trim()).filter(Boolean);
  if (campo === 'quanto') { v = P.lerQuanto(valor); if (v === undefined) return; }   // número incompleto: espera
  if (campo === 'prazo' && !/^\d{4}-\d{2}-\d{2}$/.test(String(valor || ''))) return;
  if (campo === 'quem') v = String(valor || '').slice(0, P.LIMITE.quem);
  let it = null;
  D.alterarPlano(_id, (pl) => { it = pl.acoes.find(a => a.chave === _aberta); if (it) P.editar(it, campo, v, _ctx); });
  if (!it) return;
  const num = it.numero ? ` · ${it.numero}` : '';
  const put = (k, n, max) => document.querySelectorAll(`[data-pa-cont="${k}"]`).forEach(el => { el.innerHTML = cont(n, max); });
  put('o_que', (it.o_que_base || '').length + num.length, P.LIMITE.o_que);
  put('por_que', it.por_que.length, P.LIMITE.texto); put('como', it.como.length, P.LIMITE.texto);
  document.querySelectorAll('[data-pa-prev="por_que"]').forEach(el => { el.textContent = it.por_que; });
  document.querySelectorAll('[data-pa-prev="como"]').forEach(el => { el.textContent = it.como; });
  document.querySelectorAll('[data-acao="campo:pa-revisei"]').forEach(b => { b.textContent = 'Revisei o plano'; });
}

function pedirTexto(titulo, rotulo, aoSalvar, { ph = '', obrig = true } = {}) {
  const p = ponte();
  p.abrirModal(titulo, `<div class="field"><label>${esc(rotulo)}</label><textarea id="cpPaTxt" rows="3" maxlength="300" placeholder="${esc(ph)}" style="width:100%;padding:11px 14px;border:1.5px solid var(--border);border-radius:var(--r-md);font:inherit"></textarea></div>`,
    p.botoes('Confirmar', 'cpPaOk'));
  setTimeout(() => document.getElementById('cpPaTxt')?.focus(), 60);
  p.aoConfirmar('cpPaOk', async () => {
    const v = document.getElementById('cpPaTxt')?.value.trim() || '';
    if (obrig && !v) { avisar('Escreva o motivo.', 'erro'); return; }
    p.fecharModal(); await aoSalvar(v);
  });
}

export async function acao(nome, valor, redesenhar) {
  if (!nome.startsWith('campo:pa-')) return false;
  const d = D.doc(_id); if (!d) return true;
  const ed = D.podeEditar(d);
  const redesenharTopo = async () => { await redesenhar(); rolarTopo(); };
  if (nome === 'campo:pa-abrir') { _aberta = _aberta === valor ? null : valor; await redesenhar();
    setTimeout(() => { const el = [...document.querySelectorAll('.cp-pa-card.aberto')].find(c => c.getBoundingClientRect().width > 0); el?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }); }, 40);
    return true; }
  if (!ed) { avisar('Esta avaliação não pode mais ser alterada.', 'erro'); return true; }
  const mexer = (fn) => D.alterarPlano(_id, (pl) => { const it = pl.acoes.find(a => a.chave === _aberta); if (it) fn(it, pl); });
  switch (nome) {
    case 'campo:pa-aep':
      if (['S', 'N'].includes(valor)) { D.alterarPlano(_id, pl => { pl.aep = pl.aep === valor ? null : valor; }); await D.atualizarPlano(_id); }
      redesenhar(); return true;
    case 'campo:pa-prio': if (P.NOME_PRIO[valor]) mexer(it => P.editar(it, 'prioridade', valor, _ctx)); redesenhar(); return true;
    case 'campo:pa-cat': mexer(it => P.editar(it, 'categoria', it.categoria === valor ? null : valor, _ctx)); redesenhar(); return true;
    case 'campo:pa-rel': mexer(it => { const s = new Set(it.relatorios || []); s.has(valor) ? s.delete(valor) : s.add(valor);
      P.editar(it, 'relatorios', P.RELATORIOS_SOC.filter(x => s.has(x)), _ctx); }); redesenhar(); return true;
    case 'campo:pa-revisei': {
      const pl = D.planoDe(d);
      if ((pl.acoes || []).some(a => !String(a.o_que_base || '').trim() || !a.prazo)) { avisar('Toda ação precisa de "O quê?" e de prazo.', 'erro'); return true; }
      D.marcarPlanoRevisado(_id); avisar('Plano revisado. Já dá para concluir a avaliação.'); _aberta = null; redesenharTopo(); return true;
    }
    case 'campo:pa-restaurar':
      if (!await confirmar('Voltar esta ação ao texto que o GRID monta sozinho? O que você mudou nela se perde.')) return true;
      D.alterarPlano(_id, pl => { const it = pl.acoes.find(a => a.chave === valor); if (it) it.editados = []; });
      await D.atualizarPlano(_id); redesenhar(); return true;
    case 'campo:pa-tirar': {
      const it = (D.planoDe(d).acoes || []).find(a => a.chave === valor); if (!it) return true;
      if (it.origem === 'manual') {
        if (!await confirmar(`Apagar a ação ${it.numero}?`)) return true;
        D.alterarPlano(_id, pl => { pl.acoes = pl.acoes.filter(a => a.chave !== valor); });
        _aberta = null; redesenhar(); return true;
      }
      pedirTexto(`Tirar a ação ${it.numero} do plano`, 'Por que esta ação não é necessária? (fica registrado)', async (motivo) => {
        D.alterarPlano(_id, pl => {
          pl.acoes = pl.acoes.filter(a => a.chave !== valor);
          pl.dispensadas = [...(pl.dispensadas || []).filter(x => x.chave !== valor),
            { chave: valor, numero: it.numero, o_que: it.o_que_base, motivo, em: new Date().toISOString() }];
        });
        _aberta = null; avisar('Ação tirada do plano.'); redesenhar();
      }, { ph: 'Ex.: medida já implantada e comprovada no PGR vigente' });
      return true;
    }
    case 'campo:pa-voltar':
      D.alterarPlano(_id, pl => { pl.dispensadas = (pl.dispensadas || []).filter(x => x.chave !== valor); });
      await D.atualizarPlano(_id); avisar('A ação voltou ao plano.'); redesenhar(); return true;
    case 'campo:pa-nova': {
      const p = ponte();
      const ops = d.ghes.map(g => `<option value="${esc(g.id)}">GHE ${esc(g.nome)}</option>`).join('');
      p.abrirModal('Nova ação', `<div class="field"><label>O quê? *</label><input type="text" id="cpPaNovaOq" maxlength="90" placeholder="Ex.: Instalar corrimão na escada do depósito"></div>
        <div class="field"><label>Onde?</label><select id="cpPaNovaGhe" style="width:100%;padding:11px 14px;border:1.5px solid var(--border);border-radius:var(--r-md);font:inherit;background:var(--surface)"><option value="">Toda a empresa</option>${ops}</select></div>`,
        p.botoes('Criar ação', 'cpPaNovaOk'));
      setTimeout(() => document.getElementById('cpPaNovaOq')?.focus(), 60);
      p.aoConfirmar('cpPaNovaOk', async () => {
        const oq = document.getElementById('cpPaNovaOq')?.value.trim();
        if (!oq) { avisar('Escreva o que precisa ser feito.', 'erro'); return; }
        const g = d.ghes.find(x => x.id === document.getElementById('cpPaNovaGhe')?.value);
        let nova = null;
        D.alterarPlano(_id, pl => {
          nova = P.novaManual(pl, _ctx, { uid: D.novoId(), ghe_id: g?.id, ghe: g?.nome || '', ghe_soc: g?.codigo_soc || null,
            unidade: g ? _ctx.unidade(g) : '', pessoas: g ? _ctx.pessoas(g) : 0 });
          nova.o_que_base = oq; P.compor(nova, _ctx);
          pl.acoes.push(nova);
        });
        p.fecharModal(); _aberta = nova?.chave || null; redesenhar();
      });
      return true;
    }
  }
  return true;
}
