/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/campo/ghe.js — um GHE, em 4 passos
     1 Identificação · 2 Ambientes · 3 Riscos (com o risco aberto) · 4 Treinamentos
   Tudo grava no aparelho na hora (sem botão salvar) e sobe sozinho quando há
   internet. A conclusão (ins./per./AE) é opcional em campo: só é exigida ao
   concluir a avaliação (decisão de 26/09).
   Rota: campo-ghe, id = "<avaliacao>~<ghe>[~<uid do risco>]"
   ══════════════════════════════════════════════════════════════════════════ */

import * as D from './dados.js';
import * as P from './plano.js';
import { redesenhar as redesenharTela } from '../../nucleo/navegacao.js';
import { I, esc, ico, nota, topo, seg, opt, inp, area, fotos, carregarFotos, legendarFoto, ligarTela, avisar, confirmar,
  ponte, btn, acoes, valorVisivel, irPara, ICONE_CAT, cabecalhoCelular, rolarTopo } from './comum.js';
import { modalPendEmpresa } from './pendencias.js';
import * as LM from './laudomiro.js';
import * as C from './coerencia.js';
import * as sessao from '../../nucleo/sessao.js';

const PASSOS = ['Identificação', 'Ambientes', 'Riscos', 'Treinamentos'];
let _av = null, _gid = null, _risco = null, _amb = null, _busca = '', _treinTodos = false;
/* v222: o catálogo só aparece quando o técnico pede (Adicionar risco); partes
   do risco aberto ficam recolhidas até tocar (chave "uid:med", "uid:det"...). */
let _addRisco = false;
let _ambAberto = new Map();   // v230: grupo do ambiente aberto (um por vez)
const _abertos = new Set();
const _passo = new Map();              // gid → passo
const _catAbertas = new Map();         // gid → Set(categorias abertas)
let _cat = null;

const doc = () => D.doc(_av);
const ghe = () => D.ghe(_av, _gid);
/* v222: GHE que veio do SOC abre direto em Riscos (setores e funções já vieram). */
const passo = () => _passo.get(_gid) || (ghe()?.codigo_soc ? 3 : 1);
const visiveis = (g) => (g?.riscos || []).filter(r => !D.ehPsicossocial(r));
const risco = () => (ghe()?.riscos || []).find(r => r.uid === _risco) || null;
const amb = () => (ghe()?.ambientes || []).find(a => a.uid === _amb) || null;
const altG = (fn) => D.alterarGhe(_av, _gid, fn);
const altR = (fn) => altG(g => { const r = g.riscos.find(x => x.uid === _risco); if (r) fn(r); });
const altA = (fn) => altG(g => { const a = g.ambientes.find(x => x.uid === _amb); if (a) fn(a); });
/* v202: ambiente sem nome = o ambiente do próprio GHE (mostra o nome do GHE). */
const nomeAmb = (g, a) => a?.nome || g?.nome || '';
const ambVazio = () => ({ uid: D.novoId(), nome: '', paredes: [], piso: [], forro: [], teto_telhado: [], iluminacao: [], ventilacao: [], outro: '', observacao: '' });

const colunasConclusao = (r) => {
  if (!r.nao_listado) { const c = _cat?.risco(r.codigo); if (Array.isArray(c?.dados?.colunas_conclusao)) return c.dados.colunas_conclusao; }
  return D.CONCLUSOES[r.categoria] || [];
};
const temMedicao = (r) => ['fisico', 'quimico'].includes(r.categoria);
const ehIluminacao = (r) => r.codigo === '537' || _cat?.risco(r.codigo)?.dados?.tipo_especial === 'iluminacao';

/* ── v207: medição (quadro SOC × hoje) ─────────────────────────────────── */
/* Unidade e limite de tolerância já conhecidos (o técnico pode alterar). */
const REF_MED = {
  '460': { un: 'dB(A)', lim: 85, acao: 80, ref: 'NR-15 Anexo 1' },
  '461': { un: 'dB(C)', lim: 120, ref: 'NR-15 Anexo 2' },
  '466': { un: 'm/s²', lim: 1.1, acao: 0.5, ref: 'NR-15 Anexo 8' },
  '1001': { un: 'm/s¹,⁷⁵', lim: 21, acao: 9.1, ref: 'NR-15 Anexo 8' },
  '534': { un: 'm/s²', lim: 5, acao: 2.5, ref: 'NR-15 Anexo 8' }
};
let _medEditar = false, _medRisco = null;
const refMedicao = (r) => REF_MED[String(r?.codigo || '')] || null;
export const numMed = (v) => { const m = String(v ?? '').replace(/\s/g, '').match(/-?\d+(?:[.,]\d+)?/); return m ? Number(m[0].replace(',', '.')) : null; };
export const fmtNum = (n) => n == null ? '' : String(Math.round(n * 100) / 100).replace('.', ',');
const limTexto = (ref) => ref ? `${fmtNum(ref.lim)} ${ref.un} · ${ref.ref}` : '';
function tempoDesde(dataBrTxt) {
  const m = String(dataBrTxt || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (!m) return '';
  const ini = new Date(+m[3], +m[2] - 1, +m[1]), hoje = new Date();
  let meses = (hoje.getFullYear() - ini.getFullYear()) * 12 + hoje.getMonth() - ini.getMonth() - (hoje.getDate() < ini.getDate() ? 1 : 0);
  if (meses < 1) return 'há menos de 1 mês';
  const a = Math.floor(meses / 12), mm = meses % 12;
  return 'há ' + [a ? `${a} ano${a > 1 ? 's' : ''}` : '', mm ? `${mm} ${mm > 1 ? 'meses' : 'mês'}` : ''].filter(Boolean).join(' e ');
}
/* Número de hoje × SOC × limite → etiquetas. */
function comparacaoMed(hoje, soc, lim, un) {
  if (hoje == null) return '';
  const out = [];
  if (soc != null) {
    const dif = Math.round((hoje - soc) * 100) / 100;
    out.push(dif === 0 ? `<span class="cp-pill azul">Igual à última</span>`
      : `<span class="cp-pill ${dif > 0 ? 'amb' : 'ok'}">${dif > 0 ? '▲' : '▼'} ${fmtNum(Math.abs(dif))} ${esc(un)} ${dif > 0 ? 'acima' : 'abaixo'} da última</span>`);
  }
  if (lim) out.push(hoje > lim ? `<span class="cp-pill ver">Acima do limite · ${Math.round(hoje / lim * 100)}% dos ${fmtNum(lim)} ${esc(un)}</span>`
    : `<span class="cp-pill ok">Abaixo do limite · ${Math.round(hoje / lim * 100)}% dos ${fmtNum(lim)} ${esc(un)}</span>`);
  return out.join('');
}
const posBarra = (v, lim) => `${Math.max(0, Math.min(100, v / (lim * 1.1) * 100)).toFixed(1)}%`;
function caixaSoc(sm, un, lim, ref, hoje) {
  const v = numMed(sm.valor);
  const barra = lim && v != null ? `<div class="cp-med-barra" style="--lim:${(100 / 1.1).toFixed(1)}%;--acao:${ref?.acao && lim === ref.lim ? (ref.acao / (lim * 1.1) * 100).toFixed(1) : (100 / 1.1).toFixed(1)}%">
      <i style="left:${posBarra(v, lim)}"></i><i class="hj" data-cp-med-mk style="left:${hoje != null ? posBarra(hoje, lim) : '0'};${hoje != null ? '' : 'display:none'}"></i></div>
      <div class="cp-med-esc"><span>0</span><span style="left:${(100 / 1.1).toFixed(1)}%">${fmtNum(lim)} limite</span></div>
      <span class="cp-pill ${v > lim ? 'ver' : 'ok'}">${v > lim ? 'Acima' : 'Abaixo'} do limite (${fmtNum(lim)} ${esc(un)})</span>` : '';
  return `<div class="cp-med-soc"><div class="cp-med-t azul">${I.relogio || ''}Última no SOC</div>
    <div class="cp-med-v">${esc(v != null ? fmtNum(v) : sm.valor)}<small>${esc(un)}</small></div>
    ${sm.data ? `<div class="cp-med-d">em <b>${esc(sm.data)}</b>${tempoDesde(sm.data) ? ' · ' + tempoDesde(sm.data) : ''}</div>` : ''}
    ${barra}</div>`;
}
/* Ao digitar o resultado: etiquetas e marcador sem redesenhar a tela. */
function pintarComparacao(r) {
  const med = r.medicao || {}, ref = refMedicao(r);
  const un = med.unidade || r.soc?.medicao?.unidade || ref?.un || '';
  const lim = numMed(med.limite) ?? ref?.lim ?? null;
  const hoje = numMed(med.resultado), soc = numMed(r.soc?.medicao?.valor);
  document.querySelectorAll('[data-cp-med-comp]').forEach(el => { el.innerHTML = comparacaoMed(hoje, soc, lim, un); });
  document.querySelectorAll('[data-cp-med-mk]').forEach(el => { if (hoje != null && lim) { el.style.left = posBarra(hoje, lim); el.style.display = ''; } else el.style.display = 'none'; });
  document.querySelectorAll('[data-acao^="campo:med-sit:"]').forEach(el => el.classList.toggle('on', el.dataset.acao === 'campo:med-sit:' + (med.situacao || '')));
  if (med.data) document.querySelectorAll('[data-cp="r.med.data"]').forEach(el => { if (!el.value) el.value = med.data; });
}

/* ── v222: abas no lugar das etapas (com o que tem em cada uma) ─────────── */
function etapas(g) {
  const p = passo();
  const rs = visiveis(g);
  const ok = rs.filter(r => D.riscoCompleto(r) === 'ok').length;
  const pend = rs.some(r => r.pendente);
  const ambOk = (g.ambientes || []).some(a => D.GRUPOS_AMBIENTE.some(([k]) => (a[k] || []).length));
  const sub = [
    `${(g.setores || []).length} ${(g.setores || []).length === 1 ? 'setor' : 'setores'}`,
    ambOk ? 'preenchido' : 'a preencher',
    rs.length ? `${ok} de ${rs.length}${pend ? ' · pend.' : ''}` : 'nenhum',
    `${(g.treinamentos || []).length} marcado${(g.treinamentos || []).length === 1 ? '' : 's'}`
  ];
  const cls = (k) => [k + 1 === p ? 'on' : '', k === 2 && pend ? 'pend' : '', k === 2 && rs.length && ok === rs.length ? 'ok' : ''].filter(Boolean).join(' ');
  return `<div class="cp-abas-ghe" role="tablist">${PASSOS.map((t, k) => `<button type="button" role="tab" aria-selected="${k + 1 === p}" class="${cls(k)}" data-acao="campo:passo:${k + 1}">
    <span class="l">${['Setores', 'Ambiente', 'Riscos', 'Treinam.'][k]}</span><small>${esc(sub[k])}</small></button>`).join('')}</div>`;
}
const topoGhe = (d, g, cli) => topo(d, cli, { rotulo: 'GHE · ' + (cli?.nome || ''), sub: '' }).replace(
  `<div class="cp-topo-tit">${esc(cli?.nome || 'Empresa')}</div>`, `<div class="cp-topo-tit">GHE ${esc(g.nome)}</div>`);

/* ── Passo 1: identificação ─────────────────────────────────────────────── */
function tags(tipo, lista, sugestoes, travado) {
  const nomeCampo = tipo === 'setor' ? 'setores' : 'funcoes';
  const sug = sugestoes.filter(s => !lista.some(x => x.toLowerCase() === s.nome.toLowerCase()));
  return `<div class="cp-tags">${lista.map((t, i) => `<span class="cp-tag">${esc(t)}${travado ? '' : `<span class="x" data-acao="campo:tag-rem:${nomeCampo}:${i}">${I.x}</span>`}</span>`).join('') || `<span style="font-size:12.5px;color:var(--text-3);padding:6px">Nenhum ainda</span>`}</div>
    ${travado ? '' : `<div class="cp-tags-add"><input class="cp-inp" data-cp-enter="${tipo}" placeholder="${tipo === 'setor' ? 'Novo setor' : 'Nova função'}">${btn('Adicionar', `campo:tag-add:${tipo}`)}</div>`}
    ${sug.length && !travado ? `<div class="cp-sug"><span class="cp-sug-lbl">Do SOC</span>${sug.slice(0, 40).map(s => `<span class="cp-sug-it" data-acao="campo:sug:${nomeCampo}:${esc(s.nome)}">${esc(s.nome)}${s.n != null ? ` <small>${s.n}</small>` : ''}</span>`).join('')}</div>` : ''}`;
}
function sugestoesSoc(d, g) {
  const s = d.av.soc;
  const pessoas = D.pessoasAtuais(d);   /* v203: conferência com a empresa */
  if (!s && !pessoas) return { setores: [], funcoes: [] };
  const nm = D.nomesSoc(s);   /* v202: código → nome */
  let hs = (s?.hierarquias || []).filter(h => h.ativa !== false)
    .map(h => ({ setor: nm.setor(h), cargo: nm.cargo(h), funcionarios: h.funcionarios || 0 }));
  /* Com a lista conferida, a contagem vem dela (quem saiu não conta, quem mudou
     conta no lugar novo, incluídos contam). Setores e funções do SOC sem
     ninguém continuam aparecendo, com zero. */
  if (pessoas) hs = [...hs.map(h => ({ ...h, funcionarios: 0 })), ...pessoas.map(p => ({ setor: p.setor, cargo: p.funcao, funcionarios: 1 }))];
  const cont = (campo, filtro = () => true) => {
    const m = new Map();
    for (const h of hs.filter(filtro)) m.set(h[campo], (m.get(h[campo]) || 0) + h.funcionarios);
    return [...m.entries()].filter(([n]) => n).map(([nome, n]) => ({ nome, n })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  };
  const setores = cont('setor');
  /* Funções: dos setores já escolhidos; sem setor escolhido, todas. */
  const sel = new Set((g.setores || []).map(x => x.toLowerCase()));
  const funcoes = cont('cargo', h => !sel.size || sel.has(String(h.setor).toLowerCase()));
  return { setores, funcoes };
}
function passo1(d, g, trav) {
  const sug = sugestoesSoc(d, g);
  const faixaSoc = g.codigo_soc && !trav ? `<div class="cp-faixa-soc">Este GHE veio do SOC (caracterização vigente). Confira com o acompanhante e altere só o que mudou.</div>` : '';
  return `${faixaSoc}<div class="cp-sec"><div class="cp-sec-tit">GHE</div>
      <label class="cp-lbl">Nome do GHE <span class="obr">*</span></label>${inp('g.nome', g.nome, { travado: trav })}
      ${g.codigo_soc ? `<div class="cp-ajuda">Veio do SOC (GHE ${esc(g.codigo_soc)}).</div>` : ''}</div>
    <div class="cp-sec"><div class="cp-sec-tit">Setores e funções</div>
      <label class="cp-lbl">Setores <span class="obr">*</span></label>${tags('setor', g.setores || [], sug.setores, trav)}
      <label class="cp-lbl" style="margin-top:14px">Funções</label>${tags('funcao', g.funcoes || [], sug.funcoes, trav)}
      ${d.av.soc || D.pessoasAtuais(d) ? `<div class="cp-ajuda">${D.pessoasAtuais(d) ? 'Os números ao lado das sugestões são quantos funcionários há naquele setor ou função, pela conferência com a empresa.' : 'Os números ao lado das sugestões são quantos funcionários o SOC tem naquele setor ou função.'} Setores e funções sem ninguém também aparecem.</div>` : ''}</div>
    <div class="cp-sec"><div class="cp-sec-tit">Atividade proibida para menor de 18 anos?</div>${seg('menor', [['S', 'Sim'], ['N', 'Não']], g.menor18 === true ? 'S' : g.menor18 === false ? 'N' : '', { travado: trav })}</div>
    <div class="cp-sec"><div class="cp-sec-tit">Descrição das atividades</div>${area('g.descricao', g.descricao, { ph: 'O que as pessoas deste GHE fazem no dia a dia. Dica: use o microfone do teclado para ditar.', travado: trav })}</div>
    ${trav ? '' : `<div style="margin:4px 0 14px">${btn(ico('lixo') + ' Excluir este GHE', 'campo:ghe-apagar', { cls: 'btn-ghost btn-sm', estilo: 'color:var(--red)' })}</div>`}`;
}

/* ── Passo 2: ambientes ─────────────────────────────────────────────────── */
function passo2(d, g, trav) {
  /* v202: um GHE tem, na maioria das vezes, UM ambiente — que é o próprio GHE.
     Então não se pede nome: o ambiente leva o nome do GHE. Só quando o técnico
     diz que há mais de um ambiente é que aparecem as abas e o nome de cada um. */
  const lista = g.ambientes || [];
  if (!_amb || !lista.some(a => a.uid === _amb)) _amb = lista[0]?.uid || null;
  const a = amb();
  if (!a) return nota(trav ? 'Nenhum ambiente registrado neste GHE.' : 'Carregando o ambiente…');
  const varios = lista.length > 1;
  const pills = varios ? `<div class="cp-amb-lista">${lista.map(x => `<span class="cp-amb-pill ${x.uid === _amb ? 'on' : ''}" data-acao="campo:amb-sel:${x.uid}">${(D.GRUPOS_AMBIENTE.some(([k]) => (x[k] || []).length)) ? `<span class="ok">${I.check}</span>` : ''}${esc(nomeAmb(g, x))}</span>`).join('')}
    ${trav ? '' : `<span class="cp-amb-pill" data-acao="campo:amb-novo"><span style="display:flex">${I.plus}</span>Outro ambiente</span>`}</div>` : '';
  /* v230: grupos recolhidos com o resumo do que foi marcado; abre um por vez (antes eram 2,6 telas de caixinhas). */
  const chaveAmb = `${g.id}:${a.uid}`;
  if (!_ambAberto.has(chaveAmb)) _ambAberto.set(chaveAmb, (D.GRUPOS_AMBIENTE.find(([k]) => !(a[k] || []).length) || [null])[0]);
  const aberto = _ambAberto.get(chaveAmb);
  const grupo = (k, t) => {
    const sel = a[k] || [];
    const on = aberto === k;
    return `<div class="cp-grupo cp-amb-g${on ? ' aberto' : ''}"><button type="button" class="cp-amb-gh" data-acao="campo:amb-grupo:${k}">
        <span class="cp-amb-gt">${t}</span><span class="cp-amb-gr${sel.length ? ' ok' : ''}">${sel.length ? esc(sel.join(', ')) : 'nada marcado'}</span><span class="cp-amb-gc">${I.chevD}</span></button>
      ${on ? `<div class="cp-opts">${_cat.opcoes(k).map(o => opt(`amb-opt:${k}:${o}`, o, sel.includes(o), trav)).join('')}</div>` : ''}</div>`;
  };
  return `${pills}
    ${varios ? `<div class="cp-sec"><div class="cp-sec-tit">Nome deste ambiente</div>${inp('a.nome', a.nome, { ph: g.nome, travado: trav })}</div>` : ''}
    <div class="cp-sec"><div class="cp-sec-tit">${varios ? 'Descrição do ambiente' : `Ambiente de trabalho do GHE ${esc(g.nome)}`}</div>
      ${D.GRUPOS_AMBIENTE.map(([k, t]) => grupo(k, t)).join('')}
      <div class="cp-grupo"><div class="cp-grupo-tit">Outro <small>se não estiver na lista</small></div>${inp('a.outro', a.outro, { ph: 'Ex.: exaustor no teto', travado: trav })}</div></div>
    <div class="cp-sec"><div class="cp-sec-tit">Observações e fotos</div>${area('a.observacao', a.observacao, { ph: 'Opcional', travado: trav })}
      <div style="margin-top:10px">${fotos(d, f => f.ghe_id === g.id && f.alvo === 'ambiente' && f.alvo_uid === a.uid, { chave: 'ambiente:' + a.uid, travado: trav })}</div></div>
    ${trav ? '' : varios
      ? `<div style="margin:4px 0 14px">${btn(ico('lixo') + ' Excluir este ambiente', 'campo:amb-apagar', { cls: 'btn-ghost btn-sm', estilo: 'color:var(--red)' })}</div>`
      : `<div style="margin:4px 0 14px">${btn(I.plus + ' Este GHE trabalha em mais de um ambiente', 'campo:amb-novo', { cls: 'btn-ghost btn-sm' })}</div>`}`;
}

/* ── Passo 3: riscos ────────────────────────────────────────────────────── */
function estadoTxt(r) {
  const e = D.riscoCompleto(r);
  return e === 'ok' ? ['Completo', 'var(--green-text)'] : e === 'pendente' ? ['Para depois', 'var(--warn-text)'] : ['Preencher', 'var(--warn-text)'];
}
function linhaRisco(cod, nome, r, trav) {
  const est = r ? estadoTxt(r) : null;
  const pend = r?.pendente;
  const cls = r ? (pend ? ' on pendente' : ' on') : '';
  const alvo = r ? `campo:risco-abrir:${r.uid}` : (trav ? '' : `campo:risco-add:${cod}`);
  return `<div class="cp-rrow${cls}" ${alvo ? `data-acao="${alvo}"` : ''}><span class="cx">${pend ? I.relogio : I.check}</span>
    <div class="cp-rrow-txt"><div class="cp-rrow-nome">${cod ? `<b>${esc(cod)}</b>` : ''}${esc(nome)}</div></div>
    ${est ? `<span class="cp-rrow-est" style="color:${est[1]}">${est[0]}</span><span class="cp-rrow-ir">${I.chevR}</span>` : ''}</div>`;
}
/* v222: primeiro, SÓ os riscos deste GHE, em lista de conferência. O
   catálogo inteiro aparece quando o técnico toca em "Adicionar risco". */
function passo3(d, g, trav) {
  if (_addRisco && !trav) return catalogoRiscos(d, g, trav);
  const rs = visiveis(g);
  const psi = (g.riscos || []).length - rs.length;
  const cartao = (r) => {
    const e = D.riscoCompleto(r);
    const soc = r.soc ? resumoSoc(r) : '';
    const conf = r.conferido?.como;
    const estado = e === 'ok' ? `<span class="badge badge-green">${conf === 'confere' ? 'Confere' : 'Completo'}</span>`
      : e === 'pendente' ? '<span class="badge badge-warn">Falta info</span>'
      : conf === 'mudou' ? '<span class="badge badge-warn">Mudou</span>'
      : conf === 'confere' ? '<span class="badge badge-blue">Falta avaliar</span>' : '';
    const faltaAval = e === 'fazer' && conf === 'confere';
    return `<div class="cp-rl ${e === 'ok' ? 'feito' : e === 'pendente' ? 'pend' : ''}">
      <div class="cp-rl-l1" data-acao="campo:risco-abrir:${r.uid}"><span class="cp-rl-cod">${esc(r.codigo || '—')}</span><span class="cp-rl-nome">${esc(r.nome)}</span>${estado}<span class="cp-rl-ir">${I.chevR}</span></div>
      ${soc ? `<div class="cp-rl-s">${soc}</div>` : ''}
      ${e === 'pendente' && r.pendente?.texto ? `<div class="cp-rl-s" style="color:var(--warn-text)">${esc(r.pendente.texto)}</div>` : ''}
      ${!trav && !conf && e === 'fazer' ? `<div class="cp-tri">
          <button type="button" data-acao="campo:rc-confere:${r.uid}">Confere</button>
          <button type="button" data-acao="campo:rc-mudou:${r.uid}">Mudou</button>
          <button type="button" data-acao="campo:rc-falta:${r.uid}">Falta info</button></div>` : ''}
      ${!trav && faltaAval ? avaliacaoRapida(r) : ''}
    </div>`;
  };
  const nOk = rs.filter(r => D.riscoCompleto(r) === 'ok').length;
  return `${psi ? `<div class="cp-soc-dob" style="margin-bottom:10px"><div class="cp-soc-dob-tx">${psi} risco${psi === 1 ? '' : 's'} psicossocia${psi === 1 ? 'l' : 'is'} neste GHE <b>não ${psi === 1 ? 'entra' : 'entram'}</b> na avaliação (fora do escopo por enquanto).</div>${trav ? '' : btn('Tirar do GHE', 'campo:psi-tirar', { cls: 'btn-outline btn-sm' })}</div>` : ''}
    ${rs.length ? `<div class="cp-sec-t2">Riscos deste GHE <span>${nOk} de ${rs.length}</span></div>
      ${!trav && rs.some(r => !r.conferido && D.riscoCompleto(r) === 'fazer') ? `<div class="cp-ajuda" style="margin:-4px 0 8px"><b>Confere</b> se está igual ao que você vê, <b>Mudou</b> para alterar, <b>Falta info</b> se depende de algo.</div>` : ''}
      ${rs.map(cartao).join('')}`
      : nota(trav ? 'Nenhum risco neste GHE.' : 'Nenhum risco ainda. Toque em Adicionar risco encontrado.')}
    ${trav ? '' : `<button type="button" class="cp-add" data-acao="campo:add-modo" style="margin-top:10px">${I.plus}Adicionar risco encontrado</button>`}`;
}
/* O que já se sabe do risco (SOC ou preenchido), em uma linha. */
function resumoSoc(r) {
  const ex = (D.EXPOSICAO.find(([k]) => k === (r.exposicao || r.soc?.exposicao)) || [, ''])[1];
  const m = r.soc?.medicao;
  const med = m?.valor ? `última medição ${m.valor}${m.unidade ? ' ' + m.unidade : ''}${m.data ? ' em ' + m.data : ''}` : '';
  const partes = [ex && ex.toLowerCase(), r.fonte && 'fonte: ' + r.fonte, r.epi && 'EPI: ' + r.epi, med].filter(Boolean);
  return partes.length ? `<b>SOC:</b> ${esc(partes.join(' · '))}` : '';
}
/* Depois do "Confere": o SOC não tem probabilidade nem severidade — o técnico
   escolhe ali mesmo, sem abrir o risco; o nível e a classificação saem da matriz. */
function avaliacaoRapida(r) {
  const q = (campo, ops) => `<div class="cp-rq-seg">${ops.map(([v, l]) => `<button type="button" class="${String(r[campo] ?? '') === String(v) ? 'on' : ''}" data-acao="campo:rq:${r.uid}:${campo}:${v}">${esc(l)}</button>`).join('')}</div>`;
  const leg = (lista, v) => { const x = lista.find(([k]) => String(k) === String(v ?? '')); return x ? `<div class="cp-rq-leg">${esc(x[1])}</div>` : ''; };
  return `<div class="cp-rq">
    ${!r.exposicao ? `<div class="cp-rq-l">Exposição</div>${q('exposicao', D.EXPOSICAO)}` : ''}
    <div class="cp-rq-2"><div><div class="cp-rq-l">Probabilidade ${ajudaCrit('prob')}</div>${q('probabilidade', D.PROBABILIDADE.map(([k]) => [k, k]))}${leg(D.PROBABILIDADE, r.probabilidade)}</div>
      <div><div class="cp-rq-l">Severidade ${ajudaCrit('sev')}</div>${q('severidade', D.SEVERIDADE.map(([k]) => [k, k]))}${leg(D.SEVERIDADE, r.severidade)}</div></div>
    ${caixaNivel(r)}</div>`;
}
/* v222: nível de risco pela matriz (P × S) — o técnico não escolhe a classificação. */
const NOME_ACEIT = { aceitavel: 'Aceitável', toleravel: 'Tolerável', nao_aceitavel: 'Não aceitável' };
function caixaNivel(r, trav = false) {
  const n = D.nivelDe(_cat?.matriz, r.probabilidade, r.severidade);
  if (!n) return `<div class="cp-nivel vazio">Nível de risco: escolha a probabilidade e a severidade.</div>`;
  return `<div class="cp-nivel" style="--nv:${esc(n.cor || '#D2D7E1')}"><i></i><div><b>${esc(n.nome)}</b><span>${esc(NOME_ACEIT[n.aceitabilidade] || '')} · pela matriz de risco</span></div></div>${blocoCoerencia(r, trav)}`;
}
/* v226: alertas de coerência da classificação (coerencia.js). Avisa, não decide. */
function blocoCoerencia(r, trav) {
  const todos = C.alertas(r); if (!todos.length) return '';
  const pend = C.pendentes(r), infos = todos.filter(a => a.info), j = r.justif_ps;
  const li = (a) => `<li><b>${esc(a.id)}</b> · ${esc(a.texto)}</li>`;
  let h = '';
  if (pend.length) h += `<div class="cp-coer"><b>Confira a classificação</b><ul>${pend.map(li).join('')}</ul>
    ${trav ? '' : `<div class="cp-coer-bts">${pend.some(a => a.id === 'R1') ? btn('Registrar medidas', `campo:coer-med:${r.uid}`, { cls: 'btn-outline btn-sm' }) : ''}${btn('Manter e justificar', `campo:coer-just:${r.uid}`, { cls: 'btn-amber btn-sm' })}</div>`}</div>`;
  else if (C.justificado(r)) h += `<div class="cp-coer ok"><b>Classificação justificada</b> ${esc(j.texto)}<span class="cp-coer-q">${esc([j.por, j.em ? new Date(j.em).toLocaleDateString('pt-BR') : ''].filter(Boolean).join(' · '))}</span>
    ${trav ? '' : btn('Editar', `campo:coer-just:${r.uid}`, { cls: 'btn-ghost btn-sm' })}</div>`;
  if (infos.length) h += `<div class="cp-coer info">${infos.map(a => esc(a.texto)).join('<br>')}</div>`;
  return h;
}
function modalJustificar(uid) {
  const g = D.doc(_av)?.ghes.find(x => x.id === _gid); const r = g?.riscos.find(x => x.uid === uid); if (!r) return;
  const al = C.alertas(r).filter(a => !a.info);
  const p = ponte();
  p.abrirModal('Manter a classificação', `<div style="font-size:13px;color:var(--text-2);margin-bottom:10px">${al.map(a => `<div style="margin-bottom:6px"><b>${esc(a.id)}</b> · ${esc(a.texto)}</div>`).join('')}</div>
    <div class="field"><label>Por que P${esc(r.probabilidade)} e S${esc(r.severidade)} estão corretos aqui? (fica registrado e sai no relatório)</label>
    <textarea id="cpCoerTxt" rows="3" maxlength="300" style="width:100%;padding:11px 14px;border:1.5px solid var(--border);border-radius:var(--r-md);font:inherit">${esc(r.justif_ps?.texto || '')}</textarea></div>`,
    p.botoes('Salvar justificativa', 'cpCoerOk'));
  setTimeout(() => document.getElementById('cpCoerTxt')?.focus(), 60);
  p.aoConfirmar('cpCoerOk', () => {
    const t = document.getElementById('cpCoerTxt')?.value.trim() || '';
    if (t.length < 10) { avisar('Escreva a justificativa (pelo menos 10 letras).', 'erro'); return; }
    const u = sessao.usuario() || {};
    altG(x => { const rr = x.riscos.find(y => y.uid === uid); if (rr) rr.justif_ps = { texto: t.slice(0, 300), regras: C.alertas(rr).filter(a => !a.info).map(a => a.id), por: u.nome || '', por_id: u.id || null, em: new Date().toISOString() }; });
    p.fecharModal(); avisar('Justificativa registrada.'); redesenharTela();
  });
}
const ajudaCrit = (k) => `<button type="button" class="cp-ajuda-bt" data-acao="campo:crit:${k}" aria-label="Ver os critérios">?</button>`;
function modalCriterios(k) {
  const p = ponte(); const M = _cat?.matriz || D.MATRIZ_PADRAO;
  const c = k === 'prob' ? M.criterios_prob : M.criterios_sev;
  const nomes = k === 'prob' ? D.PROBABILIDADE : D.SEVERIDADE;
  if (!c?.linhas?.length) return;
  p.abrirModal(k === 'prob' ? 'Probabilidade: como escolher' : 'Severidade: como escolher', `<div class="cp-crit">${c.linhas.map((l, i) => `
    <div class="cp-crit-it"><div class="cp-crit-n"><b>${i + 1}</b> ${esc((nomes[i] || [])[1] || '')}</div>
      ${l.map((t, j) => t ? `<div class="cp-crit-l"><span>${esc(c.colunas?.[j] || '')}</span>${esc(t)}</div>` : '').join('')}</div>`).join('')}</div>`,
    `<button class="btn btn-navy" onclick="fecharModal()">Fechar</button>`);
}

/* Catálogo completo (modo "Adicionar risco"). */
function catalogoRiscos(d, g, trav) {
  const q = _busca.trim().toLowerCase();
  const abertas = _catAbertas.get(g.id) || new Set();
  _catAbertas.set(g.id, abertas);
  const cats = [...D.CATEGORIAS, ['outro', 'Outros']];
  const blocos = cats.map(([k, nomeCat]) => {
    const meus = visiveis(g).filter(r => r.categoria === k);
    const doCat = _cat.riscos.filter(c => c.categoria === k && !D.ehPsicossocial(c) && !meus.some(r => r.codigo === c.codigo));
    const casa = (cod, nome) => !q || String(cod || '').includes(q) || String(nome).toLowerCase().includes(q);
    const linhasMeus = meus.filter(r => casa(r.codigo, r.nome)).map(r => linhaRisco(r.codigo, r.nome, r, trav));
    const linhasCat = doCat.filter(c => casa(c.codigo, c.nome)).map(c => linhaRisco(c.codigo, c.nome, null, trav));
    if (q && !linhasMeus.length && !linhasCat.length) return '';
    const aberta = q || abertas.has(k);
    const sub = meus.length ? `${meus.length} já neste GHE` : `${doCat.length} no catálogo`;
    return `<div class="cp-cat${aberta ? ' aberta' : ''}"><div class="cp-cat-head" data-acao="campo:cat:${k}"><span class="cp-cat-ic">${I[ICONE_CAT[k]] || I.alerta}</span>
      <div><div class="cp-cat-nome">${esc(nomeCat)}</div><div class="cp-cat-sub">${sub}</div></div><span class="cp-cat-chev">${aberta ? I.chevU : I.chevD}</span></div>
      ${aberta ? linhasMeus.join('') + linhasCat.join('') : ''}</div>`;
  }).join('');
  return `<div class="cp-add-topo"><b>Adicionar risco encontrado</b>${btn('Fechar catálogo', 'campo:add-modo', { cls: 'btn-outline btn-sm' })}</div>
    <div class="cp-cat-busca"><span>${I.busca}</span><input type="search" id="cpBuscaRisco" data-acao="campo:busca-risco" value="${esc(_busca)}" placeholder="Buscar risco por código ou nome..."></div>
    ${nota('Toque no risco que você <b>encontrou</b> neste GHE: ele entra no GHE e abre para preencher.')}
    <div style="height:10px"></div>${blocos || nota('Nenhum risco com essa busca.')}
    <button type="button" class="cp-add" data-acao="campo:nao-listado">${I.plus}Adicionar risco não listado</button>`;
}

/* Risco aberto */
function legenda(lista, v) { const x = lista.find(([k]) => String(k) === String(v ?? '')); return x ? `<div class="cp-leg-sel">${esc(x[1])}</div>` : ''; }
function riscoAberto(d, g, r, trav) {
  const c = r.nao_listado ? null : _cat.risco(r.codigo);
  const pad = c?.dados?.padrao || {};
  const cols = colunasConclusao(r);
  const tags = [`<span class="badge badge-navy">${esc(D.NOME_CATEGORIA[r.categoria] || 'Outro')}</span>`];
  if (r.pendente) tags.push('<span class="badge badge-warn">Para depois</span>');
  if (r.nao_listado) tags.push('<span class="badge badge-gray">Não listado</span>');
  if (c?.dados?.observacao_impressa) tags.push(`<span class="badge badge-gray">${esc(c.dados.observacao_impressa)}</span>`);
  const ambientes = [['Todos', 'Todos os ambientes'], ...(g.ambientes || []).map(a => [nomeAmb(g, a), nomeAmb(g, a)])];
  const med = r.medicao || {}, ilu = r.iluminacao || {};
  const nomeConc = { ins: 'Insalubridade', per: 'Periculosidade', ae: 'Aposentadoria especial' };
  const graus = ['10%', '20%', '40%'];
  const socDica = (k) => r.soc && (k === 'ins' || k === 'per' || (k === 'ae' && 'ae' in r.soc)) ? `<span class="cp-padrao">SOC: ${r.soc[k] ? 'S' : 'N'}${k === 'ins' && r.soc.ins && r.soc.grau ? ' · ' + r.soc.grau : ''}</span>` : '';
  const expoSoc = r.soc?.exposicao ? `<span class="cp-padrao">SOC: ${esc((D.EXPOSICAO.find(([k]) => k === r.soc.exposicao) || [, ''])[1])}</span>` : '';

  const pendBox = r.pendente ? `<div class="cp-depois"><div class="cp-sec-tit">${ico('relogio')}Completar depois</div>
      <div class="cp-opts" style="margin-bottom:10px">${D.MOTIVOS_PENDENCIA.map(([k, l]) => opt(`pend-motivo:${k}`, l, r.pendente.motivo === k, trav)).join('')}</div>
      <label class="cp-lbl">O que falta</label>${area('r.pend.texto', r.pendente.texto, { ph: 'Ex.: FISPQ do desinfetante que a empresa vai enviar por e-mail', travado: trav, alto: 64 })}
      <label class="cp-lbl" style="margin-top:10px">Quem vai resolver</label>${seg('pend-quem', [['empresa', 'A empresa'], ['tecnico', 'Eu (técnico)']], r.pendente.quem, { travado: trav })}
      <div class="cp-ajuda">Aparece nas pendências da avaliação. O que você já sabe pode ser preenchido agora.</div>
      ${!trav && D.temPendEmpresa() && r.pendente.quem === 'empresa' && !D.pendEmpresaAbertas(d).some(p => p.risco_uid === r.uid)
        ? `<div style="margin-top:8px">${btn(ico('plus') + ' Pôr na lista do que a empresa vai enviar', 'campo:pe-risco', { cls: 'btn-ghost btn-sm' })}</div>` : ''}
      ${trav ? '' : `<div style="margin-top:10px">${btn('Já resolvi, tirar das pendências', 'campo:pend-off', { cls: 'btn-outline btn-sm' })}</div>`}</div>`
    : (trav ? '' : `<div style="margin:0 0 12px">${btn(ico('relogio') + ' Não dá para completar agora · deixar para depois', 'campo:pend-on', { cls: 'btn-outline', estilo: 'width:100%;min-height:44px' })}</div>`);

  /* v207: quadro "Última no SOC" × "Medição de hoje" (proposta aprovada 27/09). */
  const refM = refMedicao(r);
  const socM = r.soc?.medicao?.valor ? r.soc.medicao : null;
  const unEf = med.unidade || socM?.unidade || refM?.un || '';
  const limEf = numMed(med.limite) ?? refM?.lim ?? null;
  const hojeN = numMed(med.resultado);
  const padraoUL = refM && !_medEditar && (!med.unidade || med.unidade === refM.un) && (!med.limite || med.limite === limTexto(refM));
  const blocoMedicao = temMedicao(r) ? `<div class="cp-sec"><div class="cp-sec-tit">Medição <span class="dir" style="color:var(--text-3)">se houver</span></div>
      <div class="cp-med${socM ? '' : ' so-hoje'}">
        ${socM ? caixaSoc(socM, unEf, limEf, refM, hojeN) : ''}
        <div class="cp-med-hoje"><div class="cp-med-t">Medição de hoje</div>
          <div class="cp-med-big"><div><label class="cp-lbl">Resultado</label>${inp('r.med.resultado', med.resultado, { ph: socM ? '—' : 'Ex.: 82,4', travado: trav, modo: 'decimal' })}</div>${unEf ? `<span class="un">${esc(unEf)}</span>` : ''}</div>
          <div class="cp-med-comp" data-cp-med-comp>${comparacaoMed(hojeN, numMed(socM?.valor), limEf, unEf)}</div>
          <div class="cp-grid2" style="margin-top:12px"><div><label class="cp-lbl">Equipamento / método</label>${inp('r.med.metodo', med.metodo, { ph: 'Ex.: Dosímetro · NHO 01', travado: trav })}</div>
            <div><label class="cp-lbl">Data da medição</label>${inp('r.med.data', med.data, { tipo: 'date', travado: trav })}</div></div>
          ${padraoUL ? `<button type="button" class="cp-med-mais" ${trav ? 'disabled' : 'data-acao="campo:med-editar"'}>Unidade e limite: ${esc(refM.un)} · ${esc(limTexto(refM))} ${trav ? '' : '<span>(alterar)</span>'}</button>`
            : `<div class="cp-grid2" style="margin-top:12px"><div><label class="cp-lbl">Unidade</label>${inp('r.med.unidade', med.unidade, { ph: 'Ex.: dB(A)', travado: trav })}</div>
            <div><label class="cp-lbl">Limite de referência</label>${inp('r.med.limite', med.limite, { ph: 'Ex.: 85 dB(A) · NR-15 Anexo 1', travado: trav })}</div></div>`}
          <label class="cp-lbl" style="margin-top:12px">Resultado em relação ao limite</label>${seg('med-sit', [['abaixo', 'Abaixo do limite'], ['acima', 'Acima do limite']], med.situacao, { travado: trav })}
        </div></div></div>` : '';
  const blocoIlu = ehIluminacao(r) ? `<div class="cp-sec"><div class="cp-sec-tit">Iluminância (NHO 11)</div>
      ${!temMedicao(r) && socM ? `<div class="cp-med" style="margin-bottom:12px">${caixaSoc(socM, socM.unidade || 'lux', null, null, null)}<div class="cp-ajuda" style="align-self:center">Referência da última medição no SOC. Registre ao lado a de hoje.</div></div>` : ''}
      <div class="cp-grid3"><div><label class="cp-lbl">Nível encontrado (lux)</label>${inp('r.ilu.nivel_encontrado', ilu.nivel_encontrado, { travado: trav, modo: 'decimal' })}</div>
        <div><label class="cp-lbl">Nível mínimo (lux)</label>${inp('r.ilu.nivel_minimo', ilu.nivel_minimo, { travado: trav, modo: 'decimal' })}</div>
        <div><label class="cp-lbl">IRC</label>${inp('r.ilu.irc', ilu.irc, { travado: trav, modo: 'decimal' })}</div></div></div>` : '';

  /* v232: o Laudomiro mostra o que a base diz do agente, sem marcar nada. */
  const agLm = ['quimico', 'fisico', 'biologico', 'operacao_perigosa'].includes(r.categoria) ? LM.doRisco(r.nome, r.categoria) : null;
  const conc = cols.length ? `<div class="cp-sec"><div class="cp-sec-tit">Conclusão <span class="dir" style="color:var(--text-3)">pode ficar para o escritório</span></div>
      ${agLm ? LM.dicaRiscoHtml(agLm, r.medicao, { aplicar: !trav && cols.length > 0 }) : ''}
      <div class="cp-conc">${cols.map(k => `<div class="cp-conc-it"><div class="t">${nomeConc[k]}${pad[k] ? `<span class="cp-padrao">padrão da ficha: ${esc(pad[k])}</span>` : ''}${socDica(k)}</div>
        ${seg('r:' + k, [['S', 'Sim'], ['N', 'Não']], r[k], { travado: trav })}
        ${k === 'ins' && r.ins === 'S' ? `<div class="cp-seg-leg">Grau</div>${seg('r:grau', graus.map(x => [x, x]), r.grau, { travado: trav })}` : ''}</div>`).join('')}</div>
      ${!trav && cols.some(k => pad[k]) ? `<div style="margin-top:10px">${btn('Usar o padrão da ficha', 'campo:padrao', { cls: 'btn-ghost btn-sm' })}</div>` : ''}
      <div class="cp-ajuda">Se depender de documento (ex.: FISPQ), deixe em branco. Só é exigido para concluir a avaliação.</div></div>` : '';

  /* ── v222: risco aberto compacto ─────────────────────────────────────────
     1º o que é obrigatório e costuma mudar na visita (avaliação de hoje);
     o que veio do SOC aparece resumido, com Editar; medição, fotos e
     conclusão ficam recolhidas até tocar. Setas passam de um risco a outro. */
  const lista = visiveis(g);
  const pos = lista.findIndex(x => x.uid === r.uid);
  const ab = (k) => _abertos.has(`${r.uid}:${k}`);
  const dobra = (k, titulo, resumo, corpo, abrirSempre = false) => (abrirSempre || ab(k))
    ? `<div class="cp-sec"><div class="cp-sec-tit">${titulo}${abrirSempre ? '' : `<span class="dir"><button type="button" class="cp-link" data-acao="campo:dobra:${k}">Recolher</button></span>`}</div>${corpo}</div>`
    : `<button type="button" class="cp-dobra" data-acao="campo:dobra:${k}"><span>${titulo}</span><small>${resumo}</small>${I.chevD}</button>`;
  const nFotos = d.fotos.filter(f => f.ghe_id === g.id && f.alvo === 'risco' && f.alvo_uid === r.uid).length;
  const kvs = [['Análise', r.analise], ['Fonte', r.fonte], ['EPC', r.epc], ['EPI', r.epi],
    ['EPI eficaz', (D.EFICAZ.find(([k]) => k === r.epi_eficaz) || [, ''])[1]], ['Medidas', r.medidas_adm]];
  const temDet = kvs.some(([, v]) => String(v || '').trim());
  const editarDet = !temDet || ab('det');
  const danosPad = P.danosPadrao(r, _cat);   // v225: NR-01 1.5.7.3.2 d
  const detEditavel = `
      ${(g.ambientes || []).length > 1 ? `<label class="cp-lbl">Ambiente</label><select class="cp-inp" data-acao="campo:r-amb"${trav ? ' disabled' : ''}>${ambientes.map(([v, l]) => `<option value="${esc(v)}" ${v === (r.ambiente || 'Todos') ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select><div style="height:12px"></div>` : ''}
      <label class="cp-lbl">Análise qualitativa</label>${area('r.analise', r.analise, { ph: 'Como a exposição acontece: atividade, frequência, duração.', travado: trav })}
      <div class="cp-grid2" style="margin-top:12px"><div><label class="cp-lbl">Fonte geradora / produto</label>${inp('r.fonte', r.fonte, { travado: trav })}</div>
        <div><label class="cp-lbl">EPC existente</label>${inp('r.epc', r.epc, { travado: trav })}</div></div>
      <div class="cp-grid2" style="margin-top:12px"><div><label class="cp-lbl">EPI (e CA)</label>${inp('r.epi', r.epi, { ph: 'Ex.: Protetor auricular · CA 12345', travado: trav })}</div>
        <div><label class="cp-lbl">EPI eficaz?</label>${seg('r:epi_eficaz', D.EFICAZ.map(([k]) => [k, k]), r.epi_eficaz, { travado: trav })}${legenda(D.EFICAZ, r.epi_eficaz)}</div></div>
      <label class="cp-lbl" style="margin-top:12px">Medidas administrativas / recomendações</label>${area('r.medidas_adm', r.medidas_adm, { travado: trav, alto: 60 })}
      <label class="cp-lbl" style="margin-top:12px">Possíveis lesões ou agravos à saúde <span style="font-weight:500;color:var(--text-3)">(sai no relatório)</span></label>${area('r.danos', r.danos, { ph: danosPad || 'Ex.: cortes, fraturas, perda auditiva…', travado: trav, alto: 48 })}
      ${danosPad ? `<div class="cp-ajuda">Em branco, sai o texto padrão: ${esc(danosPad)}.</div>` : ''}`;
  const detResumo = `${[...kvs, ['Lesões', r.danos || (danosPad ? danosPad + ' (padrão)' : '')]].filter(([, v]) => String(v || '').trim()).map(([k, v]) => `<div class="cp-kv cp-kv-l"><span>${k}</span><b>${esc(v)}</b></div>`).join('')}
      ${trav ? '' : `<div style="margin-top:8px">${btn('Editar', 'campo:dobra:det', { cls: 'btn-outline btn-sm' })}</div>`}`;
  const medResumo = r.medicao?.resultado ? `hoje ${esc(r.medicao.resultado)} ${esc(r.medicao.unidade || '')}${r.medicao.situacao ? ' · ' + (r.medicao.situacao === 'acima' ? 'acima do limite' : 'abaixo do limite') : ''}`
    : r.soc?.medicao?.valor ? `última no SOC: ${esc(r.soc.medicao.valor)} ${esc(r.soc.medicao.unidade || '')}` : 'se houver';
  const concResumo = cols.map(k => r[k] ? `${{ ins: 'Insalub.', per: 'Pericul.', ae: 'AE' }[k]} ${r[k]}` : '').filter(Boolean).join(' · ') || 'pode ficar para o escritório';
  const concResumoLm = agLm ? ` · Laudomiro: ${esc(LM.insal(agLm).v.toLowerCase())}, aposentadoria ${esc(LM.apos(agLm).v.toLowerCase())}` : '';

  const principal = `
    ${lista.length > 1 ? `<div class="cp-rnav">
      <button type="button" class="cp-rnav-b" ${pos > 0 ? `data-acao="campo:risco-abrir:${lista[pos - 1].uid}"` : 'disabled'} aria-label="Risco anterior">${I.chevL}</button>
      <span>Risco ${pos + 1} de ${lista.length}</span>
      <button type="button" class="cp-rnav-b" ${pos >= 0 && pos < lista.length - 1 ? `data-acao="campo:risco-abrir:${lista[pos + 1].uid}"` : 'disabled'} aria-label="Próximo risco">${I.chevR}</button></div>` : ''}
    <div class="cp-sec cp-rhead-sec"><div class="cp-rhead"><span class="cp-rhead-ic">${I[ICONE_CAT[r.categoria]] || I.alerta}</span><div>
      <div class="cp-rhead-cod">${r.codigo ? 'CÓDIGO ' + esc(r.codigo) + ' · ' : ''}GHE ${esc(g.nome).toUpperCase()}</div>
      <div class="cp-rhead-nome">${esc(r.nome)}</div><div class="cp-rhead-tags">${tags.join('')}</div></div></div></div>
    ${r.pendente ? pendBox : ''}
    <div class="cp-sec"><div class="cp-sec-tit">Avaliação de hoje</div>
      <label class="cp-lbl">Exposição <span class="obr">*</span>${expoSoc}</label>${seg('r:exposicao', D.EXPOSICAO.map(([k, l]) => [k, l]), r.exposicao, { travado: trav })}
      <div class="cp-grid2" style="margin-top:14px"><div><label class="cp-lbl">Probabilidade <span class="obr">*</span> ${ajudaCrit('prob')}</label>${seg('r:probabilidade', D.PROBABILIDADE.map(([k]) => [k, k]), r.probabilidade, { travado: trav })}${legenda(D.PROBABILIDADE, r.probabilidade)}</div>
        <div><label class="cp-lbl">Severidade <span class="obr">*</span> ${ajudaCrit('sev')}</label>${seg('r:severidade', D.SEVERIDADE.map(([k]) => [k, k]), r.severidade, { travado: trav })}${legenda(D.SEVERIDADE, r.severidade)}</div></div>
      <div style="margin-top:14px">${caixaNivel(r, trav)}</div></div>
    ${editarDet
      ? `<div class="cp-sec"><div class="cp-sec-tit">Onde e como${temDet && !trav ? `<span class="dir"><button type="button" class="cp-link" data-acao="campo:dobra:det">Recolher</button></span>` : ''}</div>${detEditavel}</div>`
      : `<div class="cp-sec"><div class="cp-sec-tit">${r.soc ? 'Como está no SOC' : 'Onde e como'}</div>${detResumo}</div>`}
    ${temMedicao(r) ? dobra('med', 'Medição', medResumo, blocoMedicao.replace(/^<div class="cp-sec"><div class="cp-sec-tit">Medição <span class="dir" style="color:var\(--text-3\)">se houver<\/span><\/div>/, '').replace(/<\/div>$/, '')) : ''}
    ${blocoIlu ? dobra('ilu', 'Iluminância (NHO 11)', ilu.nivel_encontrado ? `hoje ${esc(ilu.nivel_encontrado)} lux` : (r.soc?.medicao?.valor ? `última no SOC: ${esc(r.soc.medicao.valor)}` : 'se houver'),
        blocoIlu.replace(/^<div class="cp-sec"><div class="cp-sec-tit">Iluminância \(NHO 11\)<\/div>/, '').replace(/<\/div>$/, '')) : ''}
    ${cols.length ? dobra('conc', 'Conclusão (insalub., pericul., AE)', concResumo + concResumoLm,
        conc.replace(/^<div class="cp-sec"><div class="cp-sec-tit">Conclusão <span class="dir" style="color:var\(--text-3\)">pode ficar para o escritório<\/span><\/div>/, '').replace(/<\/div>$/, '')) : ''}
    ${dobra('fotos', 'Fotos e evidências', nFotos ? `${nFotos} foto${nFotos === 1 ? '' : 's'}` : 'nenhuma · tocar para abrir',
        `${fotos(d, f => f.ghe_id === g.id && f.alvo === 'risco' && f.alvo_uid === r.uid, { chave: 'risco:' + r.uid, travado: trav })}
        <div class="cp-ajuda">Fotos que comprovam o que foi visto (fonte, EPI, rótulo do produto, medidor).</div>`, nFotos > 0)}
    ${trav ? '' : `<div class="cp-risco-rem">${btn(ico('lixo') + ' Tirar este risco do GHE', 'campo:risco-rem', { cls: 'btn-ghost btn-sm', estilo: 'color:var(--red)' })}</div>`}`;

  const lado = `<div class="cp-lado">
    <div class="cp-sec"><div class="cp-sec-tit">GHE ${esc(g.nome)}</div><div class="cp-kv"><span>Setores</span><b>${esc((g.setores || []).join(', ') || '-')}</b></div><div class="cp-kv"><span>Funções</span><b>${(g.funcoes || []).length}</b></div><div class="cp-kv"><span>Ambientes</span><b>${(g.ambientes || []).length}</b></div></div>
    <div class="cp-sec"><div class="cp-sec-tit">Riscos encontrados</div>${lista.map(x => {
      const e = D.riscoCompleto(x);
      return `<div class="cp-mini-r ${x.uid === r.uid ? 'atual' : ''}" data-acao="campo:risco-abrir:${x.uid}" style="cursor:pointer"><span class="ic ${e === 'ok' ? 'ok' : 'al'}">${e === 'ok' ? I.check : I.alerta}</span>${esc((x.codigo ? x.codigo + ' ' : '') + x.nome)}</div>`;
    }).join('')}</div></div>`;
  const temProx = pos >= 0 && pos < lista.length - 1;
  return `<div class="cp-2col"><div>${principal}</div>${lado}</div>
    ${acoes([btn('Voltar', 'campo:risco-fechar', { papel: 'cp-a-voltar' }),
      !trav && !r.pendente ? btn('Falta info', 'campo:pend-on', { papel: 'cp-a-salvar' }) : '',
      btn(temProx ? 'Próximo risco' : 'Pronto', temProx ? 'campo:risco-prox' : 'campo:risco-fechar', { cls: 'btn-amber', papel: 'cp-a-prox' })])}`;
}

/* ── Passo 4: treinamentos ──────────────────────────────────────────────── */
function passo4(d, g, trav) {
  const marcados = new Set(g.treinamentos || []);
  const sugNr = new Set();
  for (const r of g.riscos || []) {
    if (D.SUGESTAO_TREINAMENTO[r.codigo]) sugNr.add(D.SUGESTAO_TREINAMENTO[r.codigo]);
    if (r.epi && !/^(na|não se aplica|nao se aplica|-)$/i.test(String(r.epi).trim())) sugNr.add('NR-06');
  }
  const porNr = new Map();
  for (const t of _cat.treinamentos) { const k = t.categoria || 'Outros'; if (!porNr.has(k)) porNr.set(k, []); porNr.get(k).push(t); }
  const nome = (t) => String(t.nome).replace(/^NR\s?\d+\s*-\s*/i, '');
  const mostrar = [...porNr.entries()].filter(([nr, ts]) => _treinTodos || nr === 'NR-01' || sugNr.has(nr) || ts.some(t => marcados.has(t.codigo)));
  const escondidos = [...porNr.keys()].filter(nr => !mostrar.some(([k]) => k === nr));
  return `<div class="cp-sec"><div class="cp-sec-tit">Treinamentos necessários para este GHE <span class="dir" style="color:var(--text-3)">${marcados.size} marcado${marcados.size === 1 ? '' : 's'}</span></div>
    ${sugNr.size ? nota(`Sugeridos pelos riscos encontrados: <b>${[...sugNr].sort().join(', ')}</b>. Confirme tocando.`) : ''}
    ${mostrar.map(([nr, ts]) => `<div class="cp-grupo"><div class="cp-grupo-tit">${esc(nr)}${sugNr.has(nr) ? ' <small>sugerido</small>' : ''}</div><div class="cp-opts">${ts.map(t => opt(`trein:${t.codigo}`, nome(t), marcados.has(t.codigo), trav)).join('')}</div></div>`).join('')}
    ${escondidos.length ? `<div class="cp-grupo"><div class="cp-grupo-tit" style="color:var(--text-3)">${esc(escondidos.join(' · '))}</div>${btn('Mostrar todos os treinamentos', 'campo:trein-todos', { cls: 'btn-ghost btn-sm' })}</div>` : ''}
  </div>`;
}

/* ══ Tela ═══════════════════════════════════════════════════════════════════ */
export async function render(params) {
  const [av, gid, ruid] = String(params?.id || '').split('~');
  if (av !== _av || gid !== _gid) { _busca = ''; _treinTodos = false; _amb = null; _risco = null; _addRisco = false; }
  _av = av; _gid = gid;
  if (ruid) { _risco = ruid; _passo.set(gid, 3); params.id = `${av}~${gid}`; }
  const d = await D.abrir(_av);
  _cat = await D.catalogo();
  const g = ghe();
  if (!g) return `${nota('Este GHE não existe mais nesta avaliação.', 'warn')}<div style="margin-top:12px">${btn('Voltar para a avaliação', `ir:campo-avaliacao:${_av}`)}</div>`;
  ligarTela({ digitar, foto, enter });
  D.normalizarMatriz(_av, _cat.matriz);   // v222: riscos feitos antes da matriz
  const clis = await D.clientesPorId([d.av.cliente_id]);
  const cli = clis[d.av.cliente_id];
  cabecalhoCelular(d, cli, g.codigo_soc ? `veio do SOC (GHE ${g.codigo_soc})` : '', { titulo: 'GHE ' + g.nome, rotulo: cli?.nome || 'Avaliação de campo' });
  const trav = !D.podeEditar(d);
  const p = passo();
  const r = p === 3 ? risco() : null;
  if (p === 3 && _risco && !r) _risco = null;
  if (_medRisco !== _risco) { _medRisco = _risco; _medEditar = false; }   // v207

  let corpo;
  if (r) corpo = riscoAberto(d, g, r, trav);
  else {
    corpo = p === 1 ? passo1(d, g, trav) : p === 2 ? passo2(d, g, trav) : p === 3 ? passo3(d, g, trav) : passo4(d, g, trav);
    corpo += acoes([
      btn(p === 1 ? 'Voltar' : 'Anterior', p === 1 ? `ir:campo-avaliacao:${_av}` : `campo:passo:${p - 1}`, { papel: 'cp-a-voltar' }),
      p < 4 ? btn(`Próximo: ${['Ambiente', 'Riscos', 'Treinamentos'][p - 1]}`, `campo:passo:${p + 1}`, { cls: 'btn-amber', papel: 'cp-a-prox' }) : btn('Concluir GHE', 'campo:fim', { cls: 'btn-amber', papel: 'cp-a-prox' })
    ]);
  }
  return `${topoGhe(d, g, cli)}${trav ? nota('Avaliação concluída: só leitura.') : ''}${etapas(g)}${corpo}`;
}
export function depois() { carregarFotos(doc()); }

/* Digitação: grava direto no dado, sem redesenhar. */
function digitar(chave, valor) {
  const v = valor;
  if (chave === 'g.nome') return altG(g => { g.nome = v; });
  if (chave === 'g.descricao') return altG(g => { g.descricao = v; });
  if (chave.startsWith('a.')) return altA(a => { a[chave.slice(2)] = v; });
  if (chave === 'r.pend.texto') return altR(r => { if (r.pendente) r.pendente.texto = v; });
  if (chave.startsWith('r.med.')) {
    altR(r => {
      const m = { ...(r.medicao || {}), [chave.slice(6)]: v };
      /* v207: ao digitar o resultado, completa unidade, limite, data e a situação (se o técnico não escolheu). */
      if (chave === 'r.med.resultado' && numMed(v) != null) {
        const ref = refMedicao(r);
        if (ref && !m.unidade) m.unidade = ref.un;
        if (ref && !m.limite) m.limite = limTexto(ref);
        if (!m.data) { const h = new Date(); m.data = `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`; }
        const lim = numMed(m.limite) ?? ref?.lim;
        if (lim && (!m.situacao || m.sit_auto)) { m.situacao = numMed(v) > lim ? 'acima' : 'abaixo'; m.sit_auto = true; }
      }
      if (chave === 'r.med.limite' && m.sit_auto && numMed(m.resultado) != null && numMed(v)) m.situacao = numMed(m.resultado) > numMed(v) ? 'acima' : 'abaixo';
      r.medicao = m;
    });
    const r = risco(); if (r) pintarComparacao(r);
    return;
  }
  if (chave.startsWith('r.ilu.')) return altR(r => { r.iluminacao = { ...(r.iluminacao || {}), [chave.slice(6)]: v }; });
  if (chave.startsWith('r.')) return altR(r => { r[chave.slice(2)] = v; });
}
function enter(tipo, valor) { adicionarTag(tipo, valor); }
function adicionarTag(tipo, valor) {
  const campo = tipo === 'setor' ? 'setores' : 'funcoes';
  const t = String(valor || '').trim();
  if (!t) return;
  altG(g => { g[campo] = g[campo] || []; if (!g[campo].some(x => x.toLowerCase() === t.toLowerCase())) g[campo].push(t); });
  redesenharTela();
  setTimeout(() => { const el = [...document.querySelectorAll(`[data-cp-enter="${tipo}"]`)].find(c => c.getBoundingClientRect().width > 0); el?.focus(); }, 50);
}
async function foto(chave, arquivos) {
  const [alvo, uid] = chave.split(':');
  for (const f of arquivos) await D.adicionarFoto(_av, { ghe_id: _gid, alvo, alvo_uid: uid }, f);
  avisar(arquivos.length > 1 ? `${arquivos.length} fotos guardadas.` : 'Foto guardada.');
  redesenharTela();
}

/* v222: depois de "Falta info", o cursor vai direto para "O que falta". */
function focarPendencia() {
  setTimeout(() => { const el = [...document.querySelectorAll('[data-cp="r.pend.texto"]')].find(c => c.getBoundingClientRect().width > 0); el?.focus(); }, 60);
}

function novoRisco(c) {
  const pad = c.dados?.padrao || {};
  return { uid: D.novoId(), codigo: c.codigo, nome: c.nome, categoria: c.categoria, nao_listado: false, ambiente: 'Todos',
    analise: '', fonte: '', epc: '', medidas_adm: '', exposicao: null, probabilidade: null, severidade: null, classificacao: null,
    epi: pad.epi === 'NA' ? 'Não se aplica' : (pad.epi || ''), epi_eficaz: pad.eficaz || null,
    medicao: null, iluminacao: null, ins: null, per: null, ae: null, grau: null, pendente: null };
}

function modalNaoListado() {
  const p = ponte();
  p.abrirModal('Risco não listado', `
    <div class="field"><label>Nome do risco *</label><input type="text" id="cpNlNome" maxlength="160" placeholder="Ex.: Vibração de corpo inteiro em empilhadeira"></div>
    <div class="field"><label>Categoria *</label><select id="cpNlCat" style="width:100%;padding:11px 14px;border:1.5px solid var(--border);border-radius:var(--r-md);font-size:14px;font-family:inherit;background:var(--surface)">
      ${D.CATEGORIAS.map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select></div>
    <div class="field"><label>Código (se souber)</label><input type="text" id="cpNlCod" maxlength="20" placeholder="Opcional"></div>`,
    p.botoes('Adicionar', 'cpNlOk'));
  p.aoConfirmar('cpNlOk', async () => {
    const nome = document.getElementById('cpNlNome')?.value.trim();
    if (!nome) { avisar('Informe o nome do risco.', 'erro'); return; }
    const categoria = document.getElementById('cpNlCat')?.value || 'acidente';
    const codigo = document.getElementById('cpNlCod')?.value.trim() || null;
    const r = { ...novoRisco({ codigo, nome, categoria, dados: {} }), nao_listado: true, epi: '', epi_eficaz: null };
    altG(g => { g.riscos.push(r); });
    _risco = r.uid;
    p.fecharModal(); redesenharTela();
  });
}

/* v239: "Aplicar ao risco" — preenche a Conclusão com o que o Laudomiro concluiu.
   Só as colunas que o risco tem (ins/per/ae); o técnico confere e pode mudar. */
function aplicarLaudomiro(id, redesenhar) {
  const a = LM.porId(id); const d = doc(); const g = ghe();
  const r = g?.riscos.find(x => x.uid === _risco);
  if (!a || !d || !r || !D.podeEditar(d)) return;
  const cols = colunasConclusao(r);
  const sg = LM.sugestao(a, r.medicao || {});
  const mudou = [];
  altR(rr => { for (const k of cols) if (sg.valores[k]) { rr[k] = sg.valores[k]; mudou.push(k); }
    if (cols.includes('ins')) { if (rr.ins === 'S' && sg.valores.grau) rr.grau = sg.valores.grau; if (rr.ins !== 'S') rr.grau = null; } });
  redesenhar();
  const nomes = { ins: 'insalubridade', per: 'periculosidade', ae: 'aposentadoria' };
  avisar(mudou.length ? `Conclusão preenchida pelo Laudomiro (${mudou.map(k => nomes[k]).join(', ')}). Confira antes de concluir.${sg.falta ? ' ' + sg.falta : ''}` : (sg.falta || 'Nada a preencher para este risco.'));
}

export async function acao(nome, valor, redesenhar) {
  if (nome === 'campo:lm-ficha') {
    const a = LM.porId(valor); if (!a) return true;
    const p = ponte();
    const podeAplicar = (() => { const dd = doc(), gg = ghe(), rr = gg?.riscos.find(x => x.uid === _risco); return !!(dd && rr && D.podeEditar(dd) && colunasConclusao(rr).length); })();
    window.__lmAplicar = (id) => aplicarLaudomiro(id, redesenhar);   // v239: o botão do modal chama de fora do módulo
    p.abrirModal('Laudomiro', LM.fichaHtml(a, { compacta: true }),
      `<button class="btn btn-outline" onclick="fecharModal()">Fechar</button>
       ${podeAplicar ? `<button class="btn lmx-btn-am" onclick="fecharModal();window.__lmAplicar&&window.__lmAplicar('${esc(a.id)}')">Aplicar ao risco</button>` : ''}
       <button class="btn btn-navy" onclick="fecharModal();window.GRID&&window.GRID.tratarAcao('ir:campo-agentes:${esc(a.id)}')">Abrir a ficha completa</button>`);
    return true;
  }
  if (nome === 'campo:lm-aplicar') { aplicarLaudomiro(valor, redesenhar); return true; }
  const d = doc(); const g = ghe();
  if (!d || !g) return false;
  const [a1, ...resto] = String(valor ?? '').split(':');
  const a2 = resto.join(':');
  /* v222: o celular rola dentro de #mobileBody, e o redesenho precisa terminar
     antes de voltar ao topo (antes o passo novo abria no meio da tela). */
  const redesenharTopo = async () => { await redesenhar(); rolarTopo(); };

  switch (nome) {
    case 'campo:passo': { const n = Math.min(4, Math.max(1, Number(a1) || 1)); _passo.set(_gid, n); _risco = null;
      if (n === 2 && !(g.ambientes || []).length && D.podeEditar(d)) altG(x => { x.ambientes = [ambVazio()]; });   // v202
      _addRisco = false; await redesenharTopo(); return true; }
    case 'campo:fim': irPara(`campo-avaliacao:${_av}`); return true;
    case 'campo:menor': altG(x => { const v = a1 === 'S' ? true : false; x.menor18 = (x.menor18 === v) ? null : v; }); redesenhar(); return true;
    case 'campo:tag-add': adicionarTag(a1, valorVisivel(`[data-cp-enter="${a1}"]`)); return true;
    case 'campo:tag-rem': altG(x => { x[a1].splice(Number(a2), 1); }); redesenhar(); return true;
    case 'campo:sug': altG(x => { x[a1] = x[a1] || []; if (!x[a1].includes(a2)) x[a1].push(a2); }); redesenhar(); return true;
    case 'campo:ghe-apagar':
      if (!await confirmar(`Excluir o GHE ${g.nome}, com os riscos e fotos dele?`)) return true;
      D.apagarGhe(_av, _gid); irPara(`campo-avaliacao:${_av}`); return true;
    /* ambientes */
    case 'campo:amb-sel': _amb = a1; redesenhar(); return true;
    case 'campo:amb-grupo': { const k = `${_gid}:${_amb}`; _ambAberto.set(k, _ambAberto.get(k) === a1 ? null : a1); redesenhar(); return true; }   // v230
    case 'campo:amb-novo': {
      const n = { ...ambVazio(), nome: 'Ambiente ' + ((g.ambientes || []).length + 1) };
      altG(x => { x.ambientes = x.ambientes || []; if (!x.ambientes.length) x.ambientes.push(ambVazio()); x.ambientes.push(n); }); _amb = n.uid; redesenhar(); return true;
    }
    case 'campo:amb-apagar': {
      const a = amb(); if (!a) return true;
      if (!await confirmar(`Excluir o ambiente ${nomeAmb(g, a)}?`)) return true;
      altG(x => { x.ambientes = x.ambientes.filter(y => y.uid !== a.uid); for (const r of x.riscos) if (r.ambiente === nomeAmb(g, a)) r.ambiente = 'Todos'; });
      for (const f of d.fotos.filter(f => f.alvo === 'ambiente' && f.alvo_uid === a.uid)) D.apagarFoto(_av, f.id);
      _amb = null; redesenhar(); return true;
    }
    case 'campo:amb-opt': {
      let marcou = false;
      altA(a => { a[a1] = a[a1] || []; const i = a[a1].indexOf(a2); if (i >= 0) a[a1].splice(i, 1); else { a[a1].push(a2); marcou = true; } });
      /* v234: marcou num grupo → abre sozinho o próximo grupo ainda vazio (o anterior fica com o resumo) */
      if (marcou) { const at = amb(); const ks = D.GRUPOS_AMBIENTE.map(([k]) => k); const i = ks.indexOf(a1);
        const prox = [...ks.slice(i + 1), ...ks.slice(0, i)].find(k => !(at?.[k] || []).length);
        if (at) _ambAberto.set(`${_gid}:${at.uid}`, prox || null); }
      redesenhar(); return true;
    }
    /* riscos */
    case 'campo:cat': { const s = _catAbertas.get(_gid) || new Set(); s.has(a1) ? s.delete(a1) : s.add(a1); _catAbertas.set(_gid, s); redesenhar(); return true; }
    case 'campo:busca-risco': _busca = valor || ''; redesenhar(); return true;
    case 'campo:risco-add': {
      const c = _cat.risco(a1); if (!c) return true;
      if (g.riscos.some(r => r.codigo === c.codigo)) { _risco = g.riscos.find(r => r.codigo === c.codigo).uid; redesenhar(); return true; }
      const r = novoRisco(c);
      altG(x => { x.riscos.push(r); });
      (_catAbertas.get(_gid) || new Set()).add(c.categoria);
      _risco = r.uid; _busca = ''; _addRisco = false; await redesenharTopo(); return true;
    }
    case 'campo:risco-abrir': _risco = a1; _passo.set(_gid, 3); _addRisco = false; await redesenharTopo(); return true;
    case 'campo:risco-fechar': _risco = null; await redesenharTopo(); return true;
    case 'campo:risco-prox': {
      const l = visiveis(g); const i = l.findIndex(r => r.uid === _risco);
      _risco = l[i + 1]?.uid || null; await redesenharTopo(); return true;
    }
    /* v222: conferência rápida na lista de riscos */
    case 'campo:add-modo': _addRisco = !_addRisco; _busca = ''; await redesenharTopo(); return true;
    case 'campo:rc-confere': D.marcarConferido(_av, _gid, a1, 'confere'); redesenhar(); return true;
    case 'campo:rc-mudou': D.marcarConferido(_av, _gid, a1, 'mudou'); _risco = a1; _abertos.add(`${a1}:det`); await redesenharTopo(); return true;
    case 'campo:rc-falta':
      altG(x => { const r = x.riscos.find(y => y.uid === a1); if (r) r.pendente = { motivo: 'documento_empresa', texto: '', quem: 'empresa' }; });
      _risco = a1; await redesenharTopo(); focarPendencia(); return true;
    case 'campo:rq': {
      const [uid, campo, v] = [a1, ...a2.split(':')];
      if (!['exposicao', 'probabilidade', 'severidade'].includes(campo)) return true;
      altG(x => { const r = x.riscos.find(y => y.uid === uid); if (!r) return; const val = ['probabilidade', 'severidade'].includes(campo) ? Number(v) : v; r[campo] = String(r[campo]) === String(val) ? null : val; D.aplicarMatriz(r, _cat?.matriz); });
      redesenhar(); return true;
    }
    case 'campo:crit': modalCriterios(a1); return true;
    case 'campo:coer-med': _risco = a1; _passo.set(_gid, 3); _addRisco = false; _abertos.add(`${a1}:det`); await redesenharTopo(); return true;
    case 'campo:coer-just': if (D.podeEditar(d)) modalJustificar(a1); return true;
    case 'campo:dobra': { const k = `${_risco}:${a1}`; _abertos.has(k) ? _abertos.delete(k) : _abertos.add(k); redesenhar(); return true; }
    case 'campo:psi-tirar': {
      const n = (g.riscos || []).filter(r => D.ehPsicossocial(r)).length;
      if (!n || !await confirmar(`Tirar ${n === 1 ? 'o risco psicossocial' : `os ${n} riscos psicossociais`} deste GHE? A avaliação psicossocial fica fora por enquanto; eles continuam no SOC.`)) return true;
      altG(x => { x.riscos = x.riscos.filter(r => !D.ehPsicossocial(r)); });
      avisar(n === 1 ? 'Risco psicossocial retirado do GHE.' : `${n} riscos psicossociais retirados do GHE.`);
      redesenhar(); return true;
    }
    case 'campo:pe-risco': {
      const r = risco(); if (!r) return true;
      modalPendEmpresa(d, null, redesenhar, { riscoUid: r.uid, gheId: g.id });
      return true;
    }
    case 'campo:risco-rem': {
      const r = risco(); if (!r) return true;
      if (!await confirmar(`Tirar o risco ${r.codigo ? r.codigo + ' ' : ''}${r.nome} deste GHE?`)) return true;
      altG(x => { x.riscos = x.riscos.filter(y => y.uid !== r.uid); });
      for (const f of d.fotos.filter(f => f.alvo === 'risco' && f.alvo_uid === r.uid)) D.apagarFoto(_av, f.id);
      _risco = null; redesenhar(); return true;
    }
    case 'campo:nao-listado': modalNaoListado(); return true;
    case 'campo:r': {
      const num = ['probabilidade', 'severidade'].includes(a1);
      if (a1 === 'classificacao') return true;   // v222: a classificação vem da matriz
      altR(r => { const v = num ? Number(a2) : a2; r[a1] = (String(r[a1]) === String(v)) ? null : v; if (a1 === 'ins' && r.ins !== 'S') r.grau = null; if (num) D.aplicarMatriz(r, _cat?.matriz); });
      redesenhar(); return true;
    }
    case 'campo:r-amb': altR(r => { r.ambiente = valor || 'Todos'; }); return true;
    case 'campo:med-sit': altR(r => { const m = r.medicao || {}; r.medicao = { ...m, situacao: m.situacao === a1 ? null : a1, sit_auto: false }; }); redesenhar(); return true;
    case 'campo:med-editar': _medEditar = true; redesenhar(); return true;
    case 'campo:padrao': {
      altR(r => { const c = _cat.risco(r.codigo); const pad = c?.dados?.padrao || {}; for (const k of colunasConclusao(r)) if (pad[k] && !r[k]) r[k] = pad[k]; });
      redesenhar(); return true;
    }
    case 'campo:pend-on': altR(r => { r.pendente = { motivo: 'documento_empresa', texto: '', quem: 'empresa' }; }); await redesenharTopo(); focarPendencia(); return true;
    case 'campo:pend-off': altR(r => { r.pendente = null; }); redesenhar(); return true;
    case 'campo:pend-motivo': altR(r => { if (r.pendente) { r.pendente.motivo = a1; if (a1 === 'estudar' || a1 === 'medicao') r.pendente.quem = 'tecnico'; } }); redesenhar(); return true;
    case 'campo:pend-quem': altR(r => { if (r.pendente) r.pendente.quem = a1; }); redesenhar(); return true;
    /* treinamentos */
    case 'campo:trein': altG(x => { x.treinamentos = x.treinamentos || []; const i = x.treinamentos.indexOf(a1); if (i >= 0) x.treinamentos.splice(i, 1); else x.treinamentos.push(a1); }); redesenhar(); return true;
    case 'campo:trein-todos': _treinTodos = true; redesenhar(); return true;
    /* fotos */
    case 'campo:foto-apagar': if (await confirmar('Apagar esta foto?')) { D.apagarFoto(_av, a1); redesenhar(); } return true;
    case 'campo:foto-legenda': if (D.podeEditar(d)) legendarFoto(d, a1, redesenhar); return true;
  }
  return false;
}
