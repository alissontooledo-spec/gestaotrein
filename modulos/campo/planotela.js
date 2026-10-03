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
import { cnaeBr, normCnae, LIMITE_SESMT, LIMITE_CIPA } from './enquadramento.js';
import { redesenhar as redesenharTela } from '../../nucleo/navegacao.js';
import { I, esc, nota, ligarTela, avisar, confirmar, ponte, btn, acoes, seg, inp, area, irPara, cabecalhoCelular, topo, rolarTopo } from './comum.js';

let _id = null, _aberta = null, _ctx = null, _clienteLido = null;

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
  ligarTela({ digitar, enter: enterEnq });
  if (!_id) return nota('Nenhuma avaliação selecionada.');
  const d = await D.abrir(_id);
  const [clis] = await Promise.all([D.clientesPorId([d.av.cliente_id], { fresco: _clienteLido !== _id })]);   // v228: CNAE atualizado ao abrir (enquadramento)
  _clienteLido = _id;
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
  const blocoAep = temErgo && !ed ? `<div class="cp-sec cp-pa-aep"><div class="cp-kv" style="border:0;padding:0"><span>Avaliação Ergonômica Preliminar (AEP) registrada</span><em style="font-style:normal;font-weight:700;color:var(--text-1)">${pl.aep === 'S' ? 'Sim' : pl.aep === 'N' ? 'Não' : 'Não respondido (plano pediu a AEP)'}</em></div></div>`   // v228: travada, só leitura
    : temErgo ? `<div class="cp-sec cp-pa-aep"><div class="cp-lbl" style="margin:0 0 8px">A empresa tem Avaliação Ergonômica Preliminar (AEP) registrada?</div>
      ${seg('pa-aep', [['S', 'Sim'], ['N', 'Não']], pl.aep, { travado: !ed })}
      <div class="cp-ajuda">${pl.aep === 'S' ? 'As medidas ergonômicas saem da AEP da empresa. Se forem insuficientes, o plano pede a AET.'
        : pl.aep === 'N' ? 'O plano pede primeiro a AEP (NR-17, item 17.3.1). As medidas ergonômicas vêm depois dela.'
        : 'Sem resposta, o GRID considera que a empresa não tem AEP e pede para fazê-la primeiro.'}</div></div>` : '';
  const blocoEnq = enquadramentoHtml(_ctx?.enq, ed);
  const cartoes = lista.map(a => cartao(a, ed)).join('') || nota(d.ghes.length
    ? 'Nenhuma ação: todos os riscos avaliados estão no nível Irrelevante e não há treinamento marcado. Se precisar, crie uma ação.'
    : 'Cadastre os GHEs e os riscos primeiro. O plano sai deles.');
  const disp = (pl.dispensadas || []);
  const blocoDisp = disp.length ? `<details class="cp-dobra-sec"><summary>Tiradas do plano <small>${disp.length}</small></summary>
      <div class="cp-sec" style="margin:8px 0 0">${disp.map(x => `<div class="cp-kv"><span><b>${esc(x.numero || '')}</b> ${esc(x.o_que || '')}<br><small style="color:var(--text-3)">Motivo: ${esc(x.motivo || '')}</small></span>
        ${ed ? btn('Voltar ao plano', `campo:pa-voltar:${x.chave}`, { cls: 'btn-ghost btn-sm' }) : ''}</div>`).join('')}</div></details>` : '';

  return `${cabec}
    ${blocoAep}
    ${blocoEnq}
    <div class="cp-sec-t2">Ações <span>${lista.length}</span></div>
    ${cartoes}
    ${ed ? `<button type="button" class="cp-add-ghe" data-acao="campo:pa-nova">${I.plus}Nova ação</button>` : ''}
    ${blocoDisp}
    ${acoes([btn('Voltar', `ir:campo-avaliacao:${_id}`, { papel: 'cp-a-voltar' }),
      ed && lista.length ? btn(pl.revisado_em ? 'Plano revisado' : 'Revisei o plano', 'campo:pa-revisei', { cls: 'btn-amber', papel: 'cp-a-prox', travado: !!pl.revisado_em || lista.some(a => P.excede(a).por_que || P.excede(a).como) }) : ''])}`;
}

/* ── v228: enquadramento da empresa (SESMT e CIPA) ───────────────────────── */
const plur = (n, s, p) => `${n} ${n === 1 ? s : p}`;
const FONTE_EF = { conferencia: 'SOC, conferidos na visita', soc: 'SOC', informado: 'informado na visita' };
function resultadoEnq(e) {
  if (e?.sem_cadastro) return `<div class="cp-enq-res nd"><b>Cadastro da empresa fora deste aparelho</b>Sem internet, o GRID não tem o CNAE desta empresa. O enquadramento aparece quando a conexão voltar; as ações já criadas continuam no plano.</div>`;
  if (!e?.grau?.valor) return `<div class="cp-enq-res nd"><b>Não foi possível enquadrar</b>${e?.cnae ? `O CNAE ${esc(cnaeBr(e.cnae))} não está no Anexo I da NR-04. Confira o cadastro da empresa.` : 'A empresa não tem CNAE no cadastro. Informe o CNAE principal acima ou complete o cadastro do cliente.'}</div>`;
  if (e.empregados === null) return `<div class="cp-enq-res nd"><b>Falta o número de funcionários</b>Traga a hierarquia do SOC (Dados do SOC) ou informe o número de empregados acima.</div>`;
  const g = e.grau.valor, s = e.sesmt, c = e.cipa;
  const ds = s.dimensionamento;
  const sesmt = s.estado === 'obrigatorio'
    ? `<div class="cp-enq-res ok"><b>SESMT: obrigatório</b>${plur(s.base, 'trabalhador', 'trabalhadores')}${e.terceiros ? ` (${e.empregados} + ${e.terceiros} de contratadas)` : ''}, faixa de ${esc(ds.faixa)}, grau ${g}: ${esc(ds.profissionais.map(p => `${p.qtd} ${p.profissional}${p.parcial ? ' (tempo parcial)' : ''}`).join(', '))}. Registrar no gov.br (NR-04, item 4.6.1).</div>`
    : `<div class="cp-enq-res nd"><b>SESMT: não obrigatório</b>Grau ${g} exige a partir de ${LIMITE_SESMT[g]} trabalhadores${ds?.falta ? `. Faltam ${ds.falta}` : ''}.</div>`;
  const dc = c.dimensionamento;
  const cipa = {
    cipa: () => `<div class="cp-enq-res bl"><b>CIPA: obrigatória, ${plur(dc.efetivos, 'efetivo', 'efetivos')} e ${plur(dc.suplentes, 'suplente', 'suplentes')}</b>Faixa de ${esc(dc.faixa)} empregados (NR-05, Quadro I). Treinamento mínimo: ${c.horas_treinamento} h.</div>`,
    nomeado: () => `<div class="cp-enq-res am"><b>CIPA: não obrigatória, nomear representante</b>Grau ${g} só tem CIPA a partir de ${LIMITE_CIPA[g]} empregados. Abaixo disso, se não for atendido por SESMT, a organização nomeia um representante entre os empregados, todo ano (NR-05, itens 5.4.13 e 5.4.14). Treinamento: ${c.horas_treinamento} h, pode ser a distância.</div>`,
    sesmt_faz: () => `<div class="cp-enq-res nd"><b>CIPA: o SESMT faz o papel</b>Fora do Quadro I da NR-05 e atendido por SESMT: o SESMT desempenha as atribuições da CIPA (item 5.4.13.1).</div>`,
    mei: () => `<div class="cp-enq-res nd"><b>CIPA: MEI dispensado</b>O MEI não precisa nomear representante (NR-05, item 5.4.13.2).</div>`,
    indefinido: () => `<div class="cp-enq-res nd"><b>CIPA: sem empregados</b>Sem empregados no estabelecimento, não há CIPA nem representante.</div>`
  }[c.estado]();
  return sesmt + cipa;
}
function perguntasEnq(e, ed) {
  if (!e?.grau?.valor || e.empregados === null) return '';
  const r = e.resp || {};
  const q = (chave, texto, val) => `<div class="cp-lbl" style="margin:12px 0 6px">${texto}</div>${seg('pa-enq-' + chave, P.RESP_ENQ, val, { travado: !ed })}`;
  let h = '';
  if (e.sesmt.estado === 'obrigatorio') h += q('sesmt', 'O SESMT está constituído e registrado no gov.br?', r.sesmt);
  if (e.cipa.estado === 'cipa') h += q('cipa', 'A CIPA está constituída e com mandato em dia?', r.cipa);
  if (e.cipa.estado === 'nomeado') h += q('nomeado', 'Há representante nomeado neste ano?', r.nomeado);
  const falta = (e.sesmt.estado === 'obrigatorio' && !r.sesmt) || (e.cipa.estado === 'cipa' && !r.cipa) || (e.cipa.estado === 'nomeado' && !r.nomeado);
  if (h && falta) h += `<div class="cp-ajuda">Responda para o plano incluir a ação de toda a empresa.</div>`;
  return h;
}
/* Avaliação travada (concluída): só leitura, sem botões apagados nem pedido de resposta. */
const RESP_TXT = { S: 'Sim', N: 'Não', '?': 'Não sei' };
function enquadramentoLeitura(e) {
  const r = e.resp || {};
  const kv = (rot, val) => `<div class="cp-kv"><span>${esc(rot)}</span><em>${val}</em></div>`;
  const g = e.grau;
  const ef = e.efetivo || {};
  let h = kv('CNAE principal', e.cnae ? `${esc(cnaeBr(e.cnae))}${g.principal ? ` · <span class="cp-enq-gr">${g.principal}</span> ${esc({ 1: 'Leve', 2: 'Médio', 3: 'Alto', 4: 'Altíssimo' }[g.principal])}` : ''}` : 'não informado');
  h += kv(`Funcionários${ef.fonte ? ' (' + (FONTE_EF[ef.fonte] || 'SOC') + ')' : ''}`, ef.total ?? 'não informado');
  if (r.preponderante) h += kv('Atividade que ocupa mais trabalhadores', `${esc(cnaeBr(r.preponderante))} · grau ${g.preponderante || '-'}`);
  if (r.terceiros) h += kv('Contratadas de forma não eventual', r.terceiros === 'S' ? `Sim${r.n_terceiros ? ' · ' + esc(r.n_terceiros) + ' trabalhadores' : ''}` : 'Não');
  const perg = [];
  if (e.sesmt.estado === 'obrigatorio') perg.push(['O SESMT está constituído e registrado?', r.sesmt]);
  if (e.cipa.estado === 'cipa') perg.push(['A CIPA está constituída e com mandato em dia?', r.cipa]);
  if (e.cipa.estado === 'nomeado') perg.push(['Há representante nomeado neste ano?', r.nomeado]);
  const resp = perg.filter(([, v]) => v).map(([q, v]) => kv(q, RESP_TXT[v] || v)).join('');
  const semResp = perg.length && !perg.some(([, v]) => v);
  return `<div class="cp-sec cp-enq"><div class="cp-lbl" style="margin:0 0 8px">Enquadramento da empresa · SESMT e CIPA</div>
      ${h}
      <div class="cp-lbl" style="margin:14px 0 2px">Resultado</div>
      <div data-cp-enq-res>${resultadoEnq(e)}</div>
      ${resp ? `<div style="margin-top:10px">${resp}</div>` : ''}
      ${semResp ? `<div class="cp-ajuda" style="margin-top:8px">Esta avaliação foi concluída sem as respostas do enquadramento. As ações de SESMT e CIPA entram numa nova revisão.</div>` : ''}
      <div class="cp-ajuda" style="margin-top:8px">Indicativo, pelo Anexo I da NR-04 e o Quadro I da NR-05.</div></div>`;
}
function enquadramentoHtml(e, ed) {
  if (!e) return '';
  if (e.sem_cadastro) return `<div class="cp-sec cp-enq"><div class="cp-lbl" style="margin:0 0 8px">Enquadramento da empresa · SESMT e CIPA</div>${resultadoEnq(e)}</div>`;
  if (!ed) return e.grau?.valor || e.cnae ? enquadramentoLeitura(e) : '';
  const r = e.resp || {};
  const t = !ed;
  const campoNum = (chave, valor, ph) => `<input class="cp-inp cp-enq-num" type="text" inputmode="numeric" data-cp="${chave}" data-cp-enter="${chave}" value="${esc(valor ?? '')}" placeholder="${esc(ph)}"${t ? ' readonly' : ''}>`;
  const g = e.grau;
  const linhaCnae = e.cnae_do_cadastro && g.principal
    ? `<div class="cp-kv"><span>CNAE principal</span><em>${esc(cnaeBr(e.cnae))} · <span class="cp-enq-gr">${g.principal}</span> ${esc({ 1: 'Leve', 2: 'Médio', 3: 'Alto', 4: 'Altíssimo' }[g.principal])}</em></div>`
    : `<div class="cp-lbl" style="margin:0 0 6px">CNAE principal da empresa (7 números)</div>${campoNum('enq.cnae', r.cnae || '', 'Ex.: 4120400')}${e.cnae && !e.cnae_do_cadastro ? '' : e.cnae ? `<div class="cp-ajuda">O CNAE do cadastro (${esc(cnaeBr(e.cnae))}) não está no Anexo I da NR-04. Confira e informe o correto.</div>` : ''}`;
  const cands = [{ codigo: e.cnae, gr: g.principal, principal: true }, ...(g.secundarias_maiores || [])].filter(x => x.codigo && x.gr);
  const prep = (g.secundarias_maiores || []).length || r.preponderante
    ? `<div class="cp-lbl" style="margin:12px 0 6px">Qual atividade ocupa mais trabalhadores?</div>
       ${seg('pa-enq-prep', cands.map(x => [x.principal ? '' : normCnae(x.codigo), `${cnaeBr(x.codigo)} · grau ${x.gr}${x.principal ? ' (principal)' : ''}`]), r.preponderante || '', { amb: false, travado: t })}
       <div class="cp-ajuda">Vale o maior grau entre a atividade principal e a que ocupa mais trabalhadores (NR-04, item 4.5.1).</div>` : '';
  const ef = e.efetivo || {};
  const linhaEf = ef.total !== null && ef.fonte !== 'informado'
    ? `<div class="cp-kv"><span>Funcionários (${FONTE_EF[ef.fonte] || 'SOC'})</span><em>${ef.total}</em></div>`
    : `<div class="cp-lbl" style="margin:12px 0 6px">Número de empregados no estabelecimento</div>${campoNum('enq.empregados', r.empregados ?? '', ef.fonte === 'informado' ? '' : 'O SOC não trouxe')}`;
  const unid = (ef.unidades || []).length > 1
    ? nota(`O SOC tem ${ef.unidades.length} unidades com funcionários (${esc(ef.unidades.map(u => `${u.nome}: ${u.total}`).join('; '))}). O enquadramento é por estabelecimento (CNPJ): se forem CNPJs diferentes, confira cada um.`, 'warn') : '';
  const ter = `<div class="cp-lbl" style="margin:12px 0 6px">Há trabalhadores de contratadas aqui, de forma não eventual?</div>${seg('pa-enq-ter', [['S', 'Sim'], ['N', 'Não']], r.terceiros, { travado: t })}
    ${r.terceiros === 'S' ? `<div class="cp-kv" style="margin-top:8px"><span>Trabalhadores das contratadas</span><em>${campoNum('enq.n_terceiros', r.n_terceiros ?? '', '0')}</em></div>` : ''}`;
  return `<div class="cp-sec cp-enq"><div class="cp-lbl" style="margin:0 0 8px">Enquadramento da empresa · SESMT e CIPA</div>
      ${linhaCnae}${linhaEf}${unid}${prep}${ter}
      <div class="cp-lbl" style="margin:14px 0 2px">Resultado</div>
      <div data-cp-enq-res>${resultadoEnq(e)}</div>
      ${perguntasEnq(e, ed)}
      <div class="cp-ajuda" style="margin-top:8px">Indicativo, pelo Anexo I da NR-04 e o Quadro I da NR-05. O técnico confirma.</div></div>`;
}

function cartao(a, ed) {
  const aberto = a.chave === _aberta;
  const sub = a.origem === 'risco'
    ? `GHE ${a.ghe} · ${a.risco}${a.nivel?.nome ? ' · ' + a.nivel.nome.replace(/^Risco\s+/i, '') + (a.nivel.p ? ` (S${a.nivel.s} · P${a.nivel.p})` : '') : ''}`
    : a.origem === 'treinamento' ? `${a.toda_empresa ? 'Toda a empresa' : 'GHE ' + a.ghe} · ${(a.trein || []).length} treinamento${(a.trein || []).length === 1 ? '' : 's'}${a.pessoas ? ' · ' + a.pessoas + ' pessoas' : ''}`
    : a.origem === 'aep' ? `${a.toda_empresa ? 'Toda a empresa' : 'GHE ' + a.ghe} · Ergonomia (NR-17)`
    : a.origem === 'obrigacao' ? `Toda a empresa · ${{ sesmt: 'SESMT (NR-04)', cipa: 'CIPA (NR-05)', nomeado: 'Representante nomeado (NR-05)' }[a.obrig] || 'Obrigação da empresa'}${a.recorrencia_meses ? ' · todo ano' : ''}`
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
  if (String(chave).startsWith('enq.')) { digitarEnq(chave.slice(4), valor); return; }
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

/* v228: números do enquadramento. Grava enquanto digita e atualiza o resultado; as ações
   aparecem quando a tela é redesenhada (Enter ou qualquer toque nas perguntas). */
const ENQ_NUM = { n_terceiros: 6, empregados: 6, cnae: 7 };
async function digitarEnq(k, valor) {
  if (!(k in ENQ_NUM) || !_id) return;
  const dig = String(valor || '').replace(/\D/g, '').slice(0, ENQ_NUM[k]);
  const v = dig === '' ? null : (k === 'cnae' ? dig : Number(dig));
  const vv = k === 'cnae' && v && v.length < 7 ? null : v;   // CNAE incompleto não vale (apagar também limpa)
  D.alterarPlano(_id, pl => { pl.enq = { ...(pl.enq || {}), [k]: vv }; });
  try { const r = await D.atualizarPlano(_id); _ctx = r?.ctx || _ctx; } catch { return; }
  document.querySelectorAll('[data-cp-enq-res]').forEach(el => { el.innerHTML = resultadoEnq(_ctx?.enq); });
  document.querySelectorAll('[data-acao="campo:pa-revisei"]').forEach(b => { b.textContent = 'Revisei o plano'; });
}
async function enterEnq(chave, valor) { if (String(chave).startsWith('enq.')) { await digitarEnq(chave.slice(4), valor); redesenharTela(); } }

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
    case 'campo:pa-enq-ter': case 'campo:pa-enq-sesmt': case 'campo:pa-enq-cipa': case 'campo:pa-enq-nomeado': {
      const k = { 'campo:pa-enq-ter': 'terceiros', 'campo:pa-enq-sesmt': 'sesmt', 'campo:pa-enq-cipa': 'cipa', 'campo:pa-enq-nomeado': 'nomeado' }[nome];
      const ok = k === 'terceiros' ? ['S', 'N'] : ['S', 'N', '?'];
      if (ok.includes(valor)) { D.alterarPlano(_id, pl => { const e = { ...(pl.enq || {}) }; e[k] = e[k] === valor ? null : valor; pl.enq = e; }); await D.atualizarPlano(_id); }
      redesenhar(); return true;
    }
    case 'campo:pa-enq-prep':
      D.alterarPlano(_id, pl => { pl.enq = { ...(pl.enq || {}), preponderante: /^\d{7}$/.test(String(valor)) ? String(valor) : null }; });
      await D.atualizarPlano(_id); redesenhar(); return true;
    case 'campo:pa-prio': if (P.NOME_PRIO[valor]) mexer(it => P.editar(it, 'prioridade', valor, _ctx)); redesenhar(); return true;
    case 'campo:pa-cat': mexer(it => P.editar(it, 'categoria', it.categoria === valor ? null : valor, _ctx)); redesenhar(); return true;
    case 'campo:pa-rel': mexer(it => { const s = new Set(it.relatorios || []); s.has(valor) ? s.delete(valor) : s.add(valor);
      P.editar(it, 'relatorios', P.RELATORIOS_SOC.filter(x => s.has(x)), _ctx); }); redesenhar(); return true;
    case 'campo:pa-revisei': {
      const pl = D.planoDe(d);
      if ((pl.acoes || []).some(a => !String(a.o_que_base || '').trim() || !a.prazo)) { avisar('Toda ação precisa de "O quê?" e de prazo.', 'erro'); return true; }
      if (_ctx?.enq && !_ctx.enq.sem_cadastro) {   // v228: guarda o que entrou no enquadramento
        const cli = (await D.clientesPorId([d.av.cliente_id]))[d.av.cliente_id];
        D.alterarPlano(_id, p2 => { p2.enq = { ...(p2.enq || {}), foto: P.fotoEnquadramento(_ctx.enq, cli) }; });
      }
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
