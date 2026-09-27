/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/campo/ghe.js — um GHE, em 4 passos
     1 Identificação · 2 Ambientes · 3 Riscos (com o risco aberto) · 4 Treinamentos
   Tudo grava no aparelho na hora (sem botão salvar) e sobe sozinho quando há
   internet. A conclusão (ins./per./AE) é opcional em campo: só é exigida ao
   concluir a avaliação (decisão de 26/09).
   Rota: campo-ghe, id = "<avaliacao>~<ghe>[~<uid do risco>]"
   ══════════════════════════════════════════════════════════════════════════ */

import * as D from './dados.js';
import { redesenhar as redesenharTela } from '../../nucleo/navegacao.js';
import { I, esc, ico, nota, topo, seg, opt, inp, area, fotos, carregarFotos, legendarFoto, ligarTela, avisar, confirmar,
  ponte, btn, acoes, valorVisivel, irPara, ICONE_CAT } from './comum.js';

const PASSOS = ['Identificação', 'Ambientes', 'Riscos', 'Treinamentos'];
let _av = null, _gid = null, _risco = null, _amb = null, _busca = '', _treinTodos = false;
const _passo = new Map();              // gid → passo
const _catAbertas = new Map();         // gid → Set(categorias abertas)
let _cat = null;

const doc = () => D.doc(_av);
const ghe = () => D.ghe(_av, _gid);
const passo = () => _passo.get(_gid) || 1;
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

/* ── Etapas ─────────────────────────────────────────────────────────────── */
function etapas(g) {
  const p = passo();
  const pend = (g.riscos || []).some(r => r.pendente);
  const estado = (i) => i === p ? 'atual' : (i === 3 && pend ? 'pend' : (i < p ? 'feito' : ''));
  return `<div class="cp-steps">${PASSOS.map((t, k) => `<div class="cp-step ${estado(k + 1)}" data-acao="campo:passo:${k + 1}"><span class="n">${estado(k + 1) === 'feito' ? `<span style="width:12px;height:12px;display:flex">${I.check}</span>` : k + 1}</span><span class="l">${t}</span></div>`).join('')}</div>
    <div class="cp-steps-m"><div class="cp-steps-m-row"><span class="cp-steps-m-tit">${PASSOS[p - 1]}</span><span class="cp-steps-m-n">Passo ${p} de 4</span></div>
    <div class="cp-steps-m-bar" style="--n:4">${PASSOS.map((_, k) => `<i class="${estado(k + 1)}" data-acao="campo:passo:${k + 1}"></i>`).join('')}</div></div>`;
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
  const grupo = (k, t) => `<div class="cp-grupo"><div class="cp-grupo-tit">${t} <small>marque todos que houver</small></div><div class="cp-opts">${
    _cat.opcoes(k).map(o => opt(`amb-opt:${k}:${o}`, o, (a[k] || []).includes(o), trav)).join('')}</div></div>`;
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
function passo3(d, g, trav) {
  const q = _busca.trim().toLowerCase();
  const abertas = _catAbertas.get(g.id) || new Set((g.riscos || []).map(r => r.categoria));
  _catAbertas.set(g.id, abertas);
  const cats = [...D.CATEGORIAS, ['outro', 'Outros']];
  const blocos = cats.map(([k, nomeCat]) => {
    const meus = (g.riscos || []).filter(r => r.categoria === k);
    const doCat = _cat.riscos.filter(c => c.categoria === k && !meus.some(r => r.codigo === c.codigo));
    const casa = (cod, nome) => !q || String(cod || '').includes(q) || String(nome).toLowerCase().includes(q);
    const linhasMeus = meus.filter(r => casa(r.codigo, r.nome)).map(r => linhaRisco(r.codigo, r.nome, r, trav));
    const linhasCat = trav ? [] : doCat.filter(c => casa(c.codigo, c.nome)).map(c => linhaRisco(c.codigo, c.nome, null, trav));
    if (q && !linhasMeus.length && !linhasCat.length) return '';
    if (!q && k === 'outro' && !meus.length && trav) return '';
    const aberta = q || abertas.has(k);
    const nPend = meus.filter(r => r.pendente).length;
    const sub = meus.length ? `${meus.length} encontrado${meus.length > 1 ? 's' : ''}${nPend ? ` · ${nPend} para depois` : ''}` : 'nenhum encontrado';
    return `<div class="cp-cat${aberta ? ' aberta' : ''}"><div class="cp-cat-head" data-acao="campo:cat:${k}"><span class="cp-cat-ic">${I[ICONE_CAT[k]] || I.alerta}</span>
      <div><div class="cp-cat-nome">${esc(nomeCat)}</div><div class="cp-cat-sub">${sub}</div></div><span class="cp-cat-chev">${aberta ? I.chevU : I.chevD}</span></div>
      ${aberta ? linhasMeus.join('') + linhasCat.join('') : ''}</div>`;
  }).join('');
  return `<div class="cp-cat-busca"><span>${I.busca}</span><input type="search" id="cpBuscaRisco" data-acao="campo:busca-risco" value="${esc(_busca)}" placeholder="Buscar risco por código ou nome..."></div>
    ${trav ? '' : nota('Toque nos riscos que você <b>encontrou</b> neste GHE. Cada risco tocado abre para preencher.')}
    <div style="height:10px"></div>${blocos || nota('Nenhum risco com essa busca.')}
    ${trav ? '' : `<button type="button" class="cp-add" data-acao="campo:nao-listado">${I.plus}Adicionar risco não listado</button>`}`;
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
  /* v205: última medição do SOC como referência para a de hoje. */
  const refMed = r.soc?.medicao?.valor ? `<div class="cp-soc-ref"><b>Última medição no SOC:</b> ${esc(r.soc.medicao.valor)}${r.soc.medicao.unidade ? ' ' + esc(r.soc.medicao.unidade) : ''}${r.soc.medicao.data ? ' em ' + esc(r.soc.medicao.data) : ''}. Registre abaixo a de hoje (ou deixe em branco se não medir).</div>` : '';
  const expoSoc = r.soc?.exposicao ? `<span class="cp-padrao">SOC: ${esc((D.EXPOSICAO.find(([k]) => k === r.soc.exposicao) || [, ''])[1])}</span>` : '';

  const pendBox = r.pendente ? `<div class="cp-depois"><div class="cp-sec-tit">${ico('relogio')}Completar depois</div>
      <div class="cp-opts" style="margin-bottom:10px">${D.MOTIVOS_PENDENCIA.map(([k, l]) => opt(`pend-motivo:${k}`, l, r.pendente.motivo === k, trav)).join('')}</div>
      <label class="cp-lbl">O que falta</label>${area('r.pend.texto', r.pendente.texto, { ph: 'Ex.: FISPQ do desinfetante que a empresa vai enviar por e-mail', travado: trav, alto: 64 })}
      <label class="cp-lbl" style="margin-top:10px">Quem vai resolver</label>${seg('pend-quem', [['empresa', 'A empresa'], ['tecnico', 'Eu (técnico)']], r.pendente.quem, { travado: trav })}
      <div class="cp-ajuda">Aparece nas pendências da avaliação. O que você já sabe pode ser preenchido agora.</div>
      ${trav ? '' : `<div style="margin-top:10px">${btn('Já resolvi, tirar das pendências', 'campo:pend-off', { cls: 'btn-outline btn-sm' })}</div>`}</div>`
    : (trav ? '' : `<div style="margin:0 0 12px">${btn(ico('relogio') + ' Não dá para completar agora · deixar para depois', 'campo:pend-on', { cls: 'btn-outline', estilo: 'width:100%;min-height:44px' })}</div>`);

  const blocoMedicao = temMedicao(r) ? `<div class="cp-sec"><div class="cp-sec-tit">Medição <span class="dir" style="color:var(--text-3)">se houver</span></div>
      ${refMed}
      <div class="cp-grid3"><div><label class="cp-lbl">Resultado</label>${inp('r.med.resultado', med.resultado, { ph: 'Ex.: 82,4', travado: trav, modo: 'decimal' })}</div>
        <div><label class="cp-lbl">Unidade</label>${inp('r.med.unidade', med.unidade, { ph: 'Ex.: dB(A)', travado: trav })}</div>
        <div><label class="cp-lbl">Limite de referência</label>${inp('r.med.limite', med.limite, { ph: 'Ex.: 85 dB(A) · NR-15 Anexo 1', travado: trav })}</div></div>
      <div class="cp-grid2" style="margin-top:12px"><div><label class="cp-lbl">Equipamento / método</label>${inp('r.med.metodo', med.metodo, { ph: 'Ex.: Dosímetro · NHO 01', travado: trav })}</div>
        <div><label class="cp-lbl">Data da medição</label>${inp('r.med.data', med.data, { tipo: 'date', travado: trav })}</div></div>
      <label class="cp-lbl" style="margin-top:12px">Resultado em relação ao limite</label>${seg('med-sit', [['abaixo', 'Abaixo do limite'], ['acima', 'Acima do limite']], med.situacao, { travado: trav })}</div>` : '';
  const blocoIlu = ehIluminacao(r) ? `<div class="cp-sec"><div class="cp-sec-tit">Iluminância (NHO 11)</div>
      ${temMedicao(r) ? '' : refMed}
      <div class="cp-grid3"><div><label class="cp-lbl">Nível encontrado (lux)</label>${inp('r.ilu.nivel_encontrado', ilu.nivel_encontrado, { travado: trav, modo: 'decimal' })}</div>
        <div><label class="cp-lbl">Nível mínimo (lux)</label>${inp('r.ilu.nivel_minimo', ilu.nivel_minimo, { travado: trav, modo: 'decimal' })}</div>
        <div><label class="cp-lbl">IRC</label>${inp('r.ilu.irc', ilu.irc, { travado: trav, modo: 'decimal' })}</div></div></div>` : '';

  const conc = cols.length ? `<div class="cp-sec"><div class="cp-sec-tit">Conclusão <span class="dir" style="color:var(--text-3)">pode ficar para o escritório</span></div>
      <div class="cp-conc">${cols.map(k => `<div class="cp-conc-it"><div class="t">${nomeConc[k]}${pad[k] ? `<span class="cp-padrao">padrão da ficha: ${esc(pad[k])}</span>` : ''}${socDica(k)}</div>
        ${seg('r:' + k, [['S', 'Sim'], ['N', 'Não']], r[k], { travado: trav })}
        ${k === 'ins' && r.ins === 'S' ? `<div class="cp-seg-leg">Grau</div>${seg('r:grau', graus.map(x => [x, x]), r.grau, { travado: trav })}` : ''}</div>`).join('')}</div>
      ${!trav && cols.some(k => pad[k]) ? `<div style="margin-top:10px">${btn('Usar o padrão da ficha', 'campo:padrao', { cls: 'btn-ghost btn-sm' })}</div>` : ''}
      <div class="cp-ajuda">Se depender de documento (ex.: FISPQ), deixe em branco. Só é exigido para concluir a avaliação.</div></div>` : '';

  const principal = `
    <div class="cp-sec"><div class="cp-rhead"><span class="cp-rhead-ic">${I[ICONE_CAT[r.categoria]] || I.alerta}</span><div>
      <div class="cp-rhead-cod">${r.codigo ? 'CÓDIGO ' + esc(r.codigo) + ' · ' : ''}GHE ${esc(g.nome).toUpperCase()}</div>
      <div class="cp-rhead-nome">${esc(r.nome)}</div><div class="cp-rhead-tags">${tags.join('')}</div></div></div></div>
    ${pendBox}
    <div class="cp-sec"><div class="cp-sec-tit">Onde e como</div>
      ${(g.ambientes || []).length > 1 ? `<label class="cp-lbl">Ambiente</label><select class="cp-inp" data-acao="campo:r-amb"${trav ? ' disabled' : ''}>${ambientes.map(([v, l]) => `<option value="${esc(v)}" ${v === (r.ambiente || 'Todos') ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select><div style="height:12px"></div>` : ''}
      <label class="cp-lbl">Análise qualitativa</label>${area('r.analise', r.analise, { ph: 'Como a exposição acontece: atividade, frequência, duração.', travado: trav })}
      <div class="cp-grid2" style="margin-top:12px"><div><label class="cp-lbl">Fonte geradora / produto</label>${inp('r.fonte', r.fonte, { travado: trav })}</div>
        <div><label class="cp-lbl">EPC existente</label>${inp('r.epc', r.epc, { travado: trav })}</div></div>
      <label class="cp-lbl" style="margin-top:12px">Medidas administrativas / recomendações</label>${area('r.medidas_adm', r.medidas_adm, { travado: trav, alto: 60 })}</div>
    ${blocoMedicao}${blocoIlu}
    <div class="cp-sec"><div class="cp-sec-tit">Avaliação</div>
      <label class="cp-lbl">Exposição <span class="obr">*</span>${expoSoc}</label>${seg('r:exposicao', D.EXPOSICAO.map(([k, l]) => [k, l]), r.exposicao, { travado: trav })}
      <div class="cp-grid2" style="margin-top:14px"><div><label class="cp-lbl">Probabilidade <span class="obr">*</span></label>${seg('r:probabilidade', D.PROBABILIDADE.map(([k]) => [k, k]), r.probabilidade, { travado: trav })}${legenda(D.PROBABILIDADE, r.probabilidade)}</div>
        <div><label class="cp-lbl">Severidade <span class="obr">*</span></label>${seg('r:severidade', D.SEVERIDADE.map(([k]) => [k, k]), r.severidade, { travado: trav })}${legenda(D.SEVERIDADE, r.severidade)}</div></div>
      <label class="cp-lbl" style="margin-top:14px">Classificação do risco <span class="obr">*</span></label>${seg('r:classificacao', D.CLASSIFICACAO, r.classificacao, { travado: trav })}
      <div class="cp-grid2" style="margin-top:14px"><div><label class="cp-lbl">EPI (e CA)</label>${inp('r.epi', r.epi, { ph: 'Ex.: Protetor auricular · CA 12345', travado: trav })}</div>
        <div><label class="cp-lbl">EPI eficaz?</label>${seg('r:epi_eficaz', D.EFICAZ.map(([k]) => [k, k]), r.epi_eficaz, { travado: trav })}${legenda(D.EFICAZ, r.epi_eficaz)}</div></div></div>
    ${conc}
    <div class="cp-sec"><div class="cp-sec-tit">Evidências</div>
      ${fotos(d, f => f.ghe_id === g.id && f.alvo === 'risco' && f.alvo_uid === r.uid, { chave: 'risco:' + r.uid, travado: trav })}
      <div class="cp-ajuda">Fotos que comprovam o que foi visto (fonte, EPI, rótulo do produto, medidor).</div></div>
    ${trav ? '' : `<div class="cp-risco-rem">${btn(ico('lixo') + ' Tirar este risco do GHE', 'campo:risco-rem', { cls: 'btn-ghost btn-sm', estilo: 'color:var(--red)' })}</div>`}`;

  const lado = `<div class="cp-lado">
    <div class="cp-sec"><div class="cp-sec-tit">GHE ${esc(g.nome)}</div><div class="cp-kv"><span>Setores</span><b>${esc((g.setores || []).join(', ') || '-')}</b></div><div class="cp-kv"><span>Funções</span><b>${(g.funcoes || []).length}</b></div><div class="cp-kv"><span>Ambientes</span><b>${(g.ambientes || []).length}</b></div></div>
    <div class="cp-sec"><div class="cp-sec-tit">Riscos encontrados</div>${(g.riscos || []).map(x => {
      const e = D.riscoCompleto(x);
      return `<div class="cp-mini-r ${x.uid === r.uid ? 'atual' : ''}" data-acao="campo:risco-abrir:${x.uid}" style="cursor:pointer"><span class="ic ${e === 'ok' ? 'ok' : 'al'}">${e === 'ok' ? I.check : I.alerta}</span>${esc((x.codigo ? x.codigo + ' ' : '') + x.nome)}</div>`;
    }).join('')}</div></div>`;
  const idx = (g.riscos || []).findIndex(x => x.uid === r.uid);
  const temProx = idx >= 0 && idx < (g.riscos || []).length - 1;
  return `<div class="cp-2col"><div>${principal}</div>${lado}</div>
    ${acoes([btn('Voltar aos riscos', 'campo:risco-fechar', { papel: 'cp-a-voltar' }), btn(temProx ? 'Próximo risco' : 'Pronto', temProx ? 'campo:risco-prox' : 'campo:risco-fechar', { cls: 'btn-amber', papel: 'cp-a-prox' })])}`;
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
  if (av !== _av || gid !== _gid) { _busca = ''; _treinTodos = false; _amb = null; _risco = null; }
  _av = av; _gid = gid;
  if (ruid) { _risco = ruid; _passo.set(gid, 3); params.id = `${av}~${gid}`; }
  const d = await D.abrir(_av);
  _cat = await D.catalogo();
  const g = ghe();
  if (!g) return `${nota('Este GHE não existe mais nesta avaliação.', 'warn')}<div style="margin-top:12px">${btn('Voltar para a avaliação', `ir:campo-avaliacao:${_av}`)}</div>`;
  ligarTela({ digitar, foto, enter });
  const clis = await D.clientesPorId([d.av.cliente_id]);
  const cli = clis[d.av.cliente_id];
  const trav = !D.podeEditar(d);
  const p = passo();
  const r = p === 3 ? risco() : null;
  if (p === 3 && _risco && !r) _risco = null;

  let corpo;
  if (r) corpo = riscoAberto(d, g, r, trav);
  else {
    corpo = p === 1 ? passo1(d, g, trav) : p === 2 ? passo2(d, g, trav) : p === 3 ? passo3(d, g, trav) : passo4(d, g, trav);
    corpo += acoes([
      btn(p === 1 ? 'Voltar' : 'Anterior', p === 1 ? `ir:campo-avaliacao:${_av}` : `campo:passo:${p - 1}`, { papel: 'cp-a-voltar' }),
      p < 4 ? btn('Próximo', `campo:passo:${p + 1}`, { cls: 'btn-amber', papel: 'cp-a-prox' }) : btn('Concluir GHE', 'campo:fim', { cls: 'btn-amber', papel: 'cp-a-prox' })
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
  if (chave.startsWith('r.med.')) return altR(r => { r.medicao = { ...(r.medicao || {}), [chave.slice(6)]: v }; });
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

export async function acao(nome, valor, redesenhar) {
  const d = doc(); const g = ghe();
  if (!d || !g) return false;
  const [a1, ...resto] = String(valor ?? '').split(':');
  const a2 = resto.join(':');
  const rolarTopo = () => { try { document.getElementById('mainBody')?.scrollTo?.(0, 0); window.scrollTo(0, 0); } catch { /* ok */ } };

  switch (nome) {
    case 'campo:passo': { const n = Math.min(4, Math.max(1, Number(a1) || 1)); _passo.set(_gid, n); _risco = null;
      if (n === 2 && !(g.ambientes || []).length && D.podeEditar(d)) altG(x => { x.ambientes = [ambVazio()]; });   // v202
      redesenhar(); rolarTopo(); return true; }
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
    case 'campo:amb-opt': altA(a => { a[a1] = a[a1] || []; const i = a[a1].indexOf(a2); if (i >= 0) a[a1].splice(i, 1); else a[a1].push(a2); }); redesenhar(); return true;
    /* riscos */
    case 'campo:cat': { const s = _catAbertas.get(_gid) || new Set(); s.has(a1) ? s.delete(a1) : s.add(a1); _catAbertas.set(_gid, s); redesenhar(); return true; }
    case 'campo:busca-risco': _busca = valor || ''; redesenhar(); return true;
    case 'campo:risco-add': {
      const c = _cat.risco(a1); if (!c) return true;
      if (g.riscos.some(r => r.codigo === c.codigo)) { _risco = g.riscos.find(r => r.codigo === c.codigo).uid; redesenhar(); return true; }
      const r = novoRisco(c);
      altG(x => { x.riscos.push(r); });
      (_catAbertas.get(_gid) || new Set()).add(c.categoria);
      _risco = r.uid; _busca = ''; redesenhar(); rolarTopo(); return true;
    }
    case 'campo:risco-abrir': _risco = a1; _passo.set(_gid, 3); redesenhar(); rolarTopo(); return true;
    case 'campo:risco-fechar': _risco = null; redesenhar(); return true;
    case 'campo:risco-prox': {
      const i = g.riscos.findIndex(r => r.uid === _risco);
      _risco = g.riscos[i + 1]?.uid || null; redesenhar(); rolarTopo(); return true;
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
      altR(r => { const v = num ? Number(a2) : a2; r[a1] = (String(r[a1]) === String(v)) ? null : v; if (a1 === 'ins' && r.ins !== 'S') r.grau = null; });
      redesenhar(); return true;
    }
    case 'campo:r-amb': altR(r => { r.ambiente = valor || 'Todos'; }); return true;
    case 'campo:med-sit': altR(r => { const m = r.medicao || {}; r.medicao = { ...m, situacao: m.situacao === a1 ? null : a1 }; }); redesenhar(); return true;
    case 'campo:padrao': {
      altR(r => { const c = _cat.risco(r.codigo); const pad = c?.dados?.padrao || {}; for (const k of colunasConclusao(r)) if (pad[k] && !r[k]) r[k] = pad[k]; });
      redesenhar(); return true;
    }
    case 'campo:pend-on': altR(r => { r.pendente = { motivo: 'documento_empresa', texto: '', quem: 'empresa' }; }); redesenhar(); return true;
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
