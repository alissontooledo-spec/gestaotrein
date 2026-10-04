/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/campo/encerrar.js — "Encerrar a visita" (v233, PASSO-78)
   Visita em dois tempos (proposta aprovada em 03/10): na empresa o técnico
   registra o que precisa dos olhos dele e encerra a visita com a assinatura
   do acompanhante (ou o motivo de não ter). A avaliação vai para "Falta o
   escritório"; textos, plano, assinatura do técnico e conclusão ficam para o
   computador (escritorio.js). Funciona sem internet: envia quando voltar.
   ══════════════════════════════════════════════════════════════════════════ */

import * as D from './dados.js';
import { estadoRisco } from './escritorio.js';
import { redesenhar as redesenharTela } from '../../nucleo/navegacao.js';
import { I, esc, nota, topo, inp, ligarTela, avisar, btn, acoes, colherAssinatura, dataBr, quando, irPara, cabecalhoCelular } from './comum.js';

let _id = null, _semAss = false, _motivo = '', _ocupado = false;

const linha = (ok, texto, st, acao) => `<div class="cp-check"${acao ? ` data-acao="${acao}" style="cursor:pointer"` : ''}>
  <span class="ic ${ok === true ? 'ok' : ok === 'ci' ? 'ci' : 'al'}">${ok === true ? I.check : ok === 'ci' ? I.relogio : I.alerta}</span><span>${texto}</span><span class="st">${st}</span></div>`;

/* O que fica para o escritório (para mostrar antes de encerrar). */
export function paraOEscritorio(d) {
  /* mesma conta da tela Escritório (psicossociais à parte) */
  const rs = d.ghes.flatMap(g => (g.riscos || []).filter(r => !D.ehPsicossocial(r)));
  const est = rs.map(r => estadoRisco(r)[0]);
  const conc = est.filter(k => k === 'conc').length, coer = est.filter(k => k === 'coer').length;
  const pl = D.temPlano() ? D.planoDe(d) : {};
  const nPl = (pl.acoes || []).length;
  const itens = [];
  if (conc) itens.push([`Conclusões (insalubridade, periculosidade, aposentadoria) em ${conc} risco${conc > 1 ? 's' : ''}`, 'conc']);
  if (coer) itens.push([`${coer} aviso${coer > 1 ? 's' : ''} de coerência da classificação`, 'coer']);
  const psiUids = new Set(d.ghes.flatMap(g => (g.riscos || []).filter(r => D.ehPsicossocial(r)).map(r => r.uid)));
  const nPsi = new Set(D.faltas(d, { semAssinaturaTec: true }).filter(f => f.risco && psiUids.has(f.risco)).map(f => f.risco)).size;
  if (nPsi) itens.push([`Riscos psicossociais no GHE: tirar ou classificar (${nPsi})`, 'psi']);
  if (D.temPlano() && nPl && !pl.revisado_em) itens.push([`Revisar o plano de ação (${nPl} ${nPl === 1 ? 'ação' : 'ações'})`, 'plano']);
  if (!D.assinaturaDe(d, 'tec').path) itens.push(['Assinatura do técnico e conclusão', 'tec']);
  itens.push(['PDF e lançamento no SOC', 'pdf']);
  return itens;
}

export async function render(params) {
  const novo = String(params?.id || '').split('~')[0];
  if (novo !== _id) { _semAss = false; _motivo = ''; _ocupado = false; }
  _id = novo;
  const d = await D.abrir(_id);
  if (d.av.situacao === 'concluida') { setTimeout(() => irPara(`campo-avaliacao:${_id}`), 0); return nota('Avaliação já concluída.'); }
  ligarTela({ digitar });
  const [clis, usus] = await Promise.all([D.clientesPorId([d.av.cliente_id]), D.usuariosPorId([d.av.tecnico_id])]);
  const cli = clis[d.av.cliente_id], tec = usus[d.av.tecnico_id];
  cabecalhoCelular(d, cli, 'Encerrar a visita');
  const trav = !D.podeEditar(d);
  if (D.visitaEncerrada(d)) {
    return `${topo(d, cli, { rotulo: 'Encerrar a visita', sub: `${dataBr(d.av.data_visita)} · ${tec?.nome || ''}` })}
      ${nota(`Esta visita já foi encerrada${D.encerradaEm(d) ? ' em ' + esc(quando(D.encerradaEm(d))) : ''}. O que falta é feito no escritório.`)}
      ${acoes([btn('Voltar', `ir:campo-avaliacao:${_id}`, { papel: 'cp-a-voltar' }), btn('Abrir o escritório', `ir:campo-escritorio:${_id}`, { cls: 'btn-amber', papel: 'cp-a-prox' })])}`;
  }
  if (!_motivo) _motivo = D.motivoSemAssinatura(d);
  if (_motivo) _semAss = true;

  const rs = d.ghes.flatMap(g => (g.riscos || []).filter(r => !D.ehPsicossocial(r)));
  const rOk = rs.filter(r => D.riscoCompleto(r) === 'ok').length;
  const rDepois = rs.filter(r => r.pendente).length;
  const conf = D.temConferencia(d) ? D.resumoConferencia(d) : null;
  const nFotos = (d.fotos || []).length;
  const esperando = D.temPendEmpresa() ? D.pendEmpresaAbertas(d).length : 0;
  const aAcomp = D.assinaturaDe(d, 'acomp');
  const temAss = !!aAcomp.path;
  const faltaEnc = D.faltaParaEncerrar(d, _semAss ? _motivo : '');
  const primeiroFazer = d.ghes.find(g => (g.riscos || []).some(r => D.riscoCompleto(r) === 'fazer'));

  const feito = `<div class="cp-sec"><div class="cp-sec-tit">Feito na visita</div>
      ${linha(d.ghes.length ? true : false, `${d.ghes.length} ${d.ghes.length === 1 ? 'GHE' : 'GHEs'}`, d.ghes.length ? '' : 'Falta', d.ghes.length ? '' : `ir:campo-avaliacao:${_id}`)}
      ${rs.length ? linha(rOk === rs.length ? true : 'al', `Riscos vistos: ${rOk} de ${rs.length}${rDepois ? ` · ${rDepois} para depois` : ''}`,
        rOk === rs.length ? '' : 'completar', rOk === rs.length || !primeiroFazer ? '' : `ir:campo-ghe:${_id}~${primeiroFazer.id}`) : ''}
      ${conf && conf.soc ? linha(conf.falta ? 'al' : true, `Funcionários conferidos: ${conf.soc - conf.falta} de ${conf.soc}`, conf.falta ? 'conferir' : '', conf.falta ? `ir:campo-funcionarios:${_id}` : '') : ''}
      ${linha(nFotos ? true : 'ci', `${nFotos} ${nFotos === 1 ? 'foto' : 'fotos'}`, '')}
      ${D.temPendEmpresa() ? linha(true, esperando ? `${esperando} ${esperando === 1 ? 'item' : 'itens'} que a empresa vai enviar` : 'Nada a receber da empresa', '') : ''}
      ${rOk < rs.length ? `<div class="cp-ajuda" style="margin-top:6px">Pode encerrar assim mesmo: o que faltar nos riscos fica para o escritório.</div>` : ''}</div>`;

  const esc_ = paraOEscritorio(d);
  const escritorio = `<div class="cp-sec cp-enc-esc"><div class="cp-sec-tit">Fica para o escritório <span class="dir">${esc_.length} ${esc_.length === 1 ? 'item' : 'itens'}</span></div>
      ${esc_.map(([t]) => `<div class="cp-enc-li">${I.doc}<span>${esc(t)}</span></div>`).join('')}</div>`;

  const assinatura = temAss
    ? `<div class="cp-assin-area feita ${trav ? '' : 'clicavel'}" data-cp-assin="acomp" ${trav ? '' : 'data-acao="campo:enc-assinar"'}><span style="font-size:11px;font-weight:500;color:var(--text-3)">${esc(quando(aAcomp.em))}${trav ? '' : ' · tocar para refazer'}</span></div>`
    : `<div class="cp-assin-area ${!trav && d.av.acompanhante_nome ? 'clicavel' : ''}" data-cp-area="acomp" ${!trav && d.av.acompanhante_nome ? 'data-acao="campo:enc-assinar"' : 'style="opacity:.6"'}>${I.pen}<span>${d.av.acompanhante_nome ? 'Assinar aqui com o dedo' : 'Informe o nome do acompanhante acima'}</span></div>`;
  const acomp = `<div class="cp-sec"><div class="cp-sec-tit">Acompanhante</div>
      <div class="cp-grid2">${inp('av.acompanhante_nome', d.av.acompanhante_nome, { ph: 'Nome de quem acompanhou', travado: trav })}${inp('av.acompanhante_cargo', d.av.acompanhante_cargo, { ph: 'Cargo', travado: trav })}</div>
      ${_semAss && !temAss ? '' : `<div style="margin-top:12px">${assinatura}</div>`}
      ${temAss ? '' : `<div class="cp-enc-sem"><span class="cp-opt${_semAss ? ' on' : ''}" ${trav ? '' : 'data-acao="campo:enc-sem"'}><span class="cx">${I.check}</span>O acompanhante não vai assinar</span></div>
        ${_semAss ? `<div class="cp-enc-mot"><div class="cp-lbl">Por quê? <span class="obr">*</span> <span style="font-weight:500;color:var(--text-3)">(sai no relatório)</span></div>
          <div class="cp-opts">${D.MOTIVOS_SEM_ASSINATURA.map(m => `<span class="cp-opt${_motivo === m ? ' on' : ''}" data-acao="campo:enc-mot:${esc(m)}"><span class="cx">${I.check}</span>${esc(m)}</span>`).join('')}</div>
          ${inp('enc.motivo', D.MOTIVOS_SEM_ASSINATURA.includes(_motivo) ? '' : _motivo, { ph: 'Ou escreva o motivo', travado: trav })}</div>` : ''}`}</div>`;

  return `${topo(d, cli, { rotulo: 'Encerrar a visita', sub: `${dataBr(d.av.data_visita)} · ${tec?.nome || ''}` })}
    <div class="cp-enc">${feito}${escritorio}</div>
    ${acomp}
    ${nota('A avaliação vai para <b>Falta o escritório</b>. Sem internet, ela é enviada quando a conexão voltar. Quem preferir pode concluir tudo aqui mesmo, em Assinaturas e conclusão.')}
    <div data-cp-enc-falta>${faltaEnc.length && !trav ? `<div class="cp-ajuda" style="color:var(--warn-text);font-weight:600">${esc(faltaEnc.join(' '))}</div>` : ''}</div>
    ${acoes([btn('Voltar', `ir:campo-avaliacao:${_id}`, { papel: 'cp-a-voltar' }),
      btn(_ocupado ? 'Encerrando…' : 'Encerrar a visita', 'campo:enc-ok', { cls: 'btn-amber', papel: 'cp-a-prox', travado: trav || _ocupado || faltaEnc.length > 0 })])}`;
}

export async function depois() {
  const d = D.doc(_id); if (!d) return;
  const a = D.assinaturaDe(d, 'acomp'); if (!a.path) return;
  const url = await D.dataUrlArquivo(a.path).catch(() => null);
  if (!url) return;
  document.querySelectorAll('[data-cp-assin="acomp"]').forEach(el => { if (!el.querySelector('img')) el.insertAdjacentHTML('afterbegin', `<img src="${url}" alt="Assinatura">`); });
}

function digitar(chave, valor) {
  if (chave === 'av.acompanhante_nome' || chave === 'av.acompanhante_cargo') {
    D.alterarAv(_id, { [chave.slice(3)]: valor });
    if (chave === 'av.acompanhante_nome') {
      const tem = !!String(valor || '').trim();
      document.querySelectorAll('[data-cp-area="acomp"]').forEach(el => {
        el.classList.toggle('clicavel', tem); el.style.opacity = tem ? '' : '.6';
        if (tem) el.setAttribute('data-acao', 'campo:enc-assinar'); else el.removeAttribute('data-acao');
        const t = el.querySelector('span'); if (t) t.textContent = tem ? 'Assinar aqui com o dedo' : 'Informe o nome do acompanhante acima';
      });
    }
    return;
  }
  if (chave === 'enc.motivo') {
    _motivo = String(valor || '');
    pintarBotao();
  }
}
/* Libera o botão sem redesenhar (o teclado do celular não fecha). */
function pintarBotao() {
  const d = D.doc(_id); if (!d) return;
  const falta = D.faltaParaEncerrar(d, _semAss ? _motivo : '');
  document.querySelectorAll('[data-acao="campo:enc-ok"], .cp-a-prox').forEach(b => {
    if (!/Encerrar/.test(b.textContent)) return;
    b.disabled = falta.length > 0; b.style.opacity = falta.length ? '.5' : '';
    if (falta.length) b.removeAttribute('data-acao'); else b.setAttribute('data-acao', 'campo:enc-ok');
  });
  document.querySelectorAll('[data-cp-enc-falta]').forEach(el => { el.innerHTML = falta.length ? `<div class="cp-ajuda" style="color:var(--warn-text);font-weight:600">${esc(falta.join(' '))}</div>` : ''; });
}

export async function acao(nome, valor, redesenhar) {
  const d = D.doc(_id); if (!d) return false;
  if (nome === 'campo:enc-assinar') {
    colherAssinatura({ titulo: 'Assinatura do acompanhante', nome: d.av.acompanhante_nome, sub: d.av.acompanhante_cargo },
      async (blob) => { await D.guardarAssinatura(_id, 'acomp', blob); _semAss = false; avisar('Assinatura guardada.'); redesenharTela(); });
    return true;
  }
  if (nome === 'campo:enc-sem') { _semAss = !_semAss; if (!_semAss) _motivo = ''; redesenhar(); return true; }
  if (nome === 'campo:enc-mot') { _motivo = _motivo === valor ? '' : valor; redesenhar(); return true; }
  if (nome === 'campo:enc-ok') {
    _ocupado = true; redesenhar();
    try {
      await D.encerrarVisita(_id, _semAss ? _motivo : '');
      avisar(D.online() ? 'Visita encerrada. A avaliação está em "Falta o escritório".' : 'Visita encerrada neste aparelho. Ela é enviada quando a internet voltar.');
      _semAss = false; _motivo = '';
      irPara(`campo-avaliacao:${_id}`);
    } catch (e) { avisar(D.traduzirErro(e), 'erro'); }
    finally { _ocupado = false; }
    return true;
  }
  return false;
}
