/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/campo/funcionarios.js — conferência dos funcionários (v203)
   O técnico lê a lista do SOC com o acompanhante e marca, pessoa por pessoa:
   confere, saiu ou mudou de setor/função. Pode incluir quem não está no SOC.
   Nada volta para o SOC: o PDF traz a lista do que mudou para o escritório
   atualizar lá. Funciona sem internet, como o resto da visita.
   LGPD: guarda só nome, código no SOC, setor e função.
   ══════════════════════════════════════════════════════════════════════════ */

import * as D from './dados.js';
import { redesenhar as redesenharTela } from '../../nucleo/navegacao.js';
import { esc, nota, topo, ligarTela, avisar, confirmar, ponte, btn, acoes, irPara, cabecalhoCelular } from './comum.js';

let _id = null;
let _filtro = null;          // 'falta' | 'todos' | 'mudancas'
let _busca = '';

const idDe = (params) => String(params?.id || '').split('~')[0];
const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const pessoa = (d, pid) => D.listaFuncionarios(d).find(p => p.id === pid) || null;
const ehMudanca = (p) => p.origem === 'empresa' || p.situacao === 'saiu' || p.situacao === 'mudou';

/* Setores e funções conhecidos (SOC + GHEs + lista), para as sugestões. */
function conhecidos(d) {
  const set = new Set(), fun = new Set();
  const nm = D.nomesSoc(d.av.soc);
  /* v204: só combinações ATIVAS no SOC (cargo inativo confunde o técnico). */
  for (const h of (d.av.soc?.hierarquias || []).filter(x => x.ativa !== false)) { if (nm.setor(h)) set.add(nm.setor(h)); if (nm.cargo(h)) fun.add(nm.cargo(h)); }
  for (const g of d.ghes || []) { (g.setores || []).forEach(x => set.add(x)); (g.funcoes || []).forEach(x => fun.add(x)); }
  for (const p of D.listaFuncionarios(d)) { [p.setor, p.novo_setor].forEach(x => x && set.add(x)); [p.funcao, p.nova_funcao].forEach(x => x && fun.add(x)); }
  const ord = (s) => [...s].filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  return { setores: ord(set), funcoes: ord(fun) };
}

function linha(p, trav) {
  const on = (v) => p.situacao === v ? ' on-' + v : '';
  const seg = p.origem === 'soc' && !trav
    ? `<div class="cp-fun-seg"><button type="button" class="${on('confere')}" data-acao="campo:fun-sit:${p.id}~confere">Confere</button><button type="button" class="${on('saiu')}" data-acao="campo:fun-sit:${p.id}~saiu">Saiu</button><button type="button" class="${on('mudou')}" data-acao="campo:fun-sit:${p.id}~mudou">Mudou</button></div>`
    : '';
  const estado = trav && p.origem === 'soc'
    ? `<span class="cp-fun-est ${p.situacao || 'nada'}">${({ confere: 'Confere', saiu: 'Saiu', mudou: 'Mudou' })[p.situacao] || 'Não conferido'}</span>` : '';
  return `<div class="cp-fun ${p.situacao === 'saiu' ? 'saiu' : ''}" data-cp-fun="${esc(norm(p.nome))}">
    <div class="cp-fun-topo"><div style="min-width:0;flex:1"><div class="cp-fun-n">${esc(p.nome)}${p.origem === 'empresa' ? '<span class="cp-fun-novo">Não está no SOC</span>' : ''}</div>
      <div class="cp-fun-s">${esc([p.setor, p.funcao].filter(Boolean).join(' · ') || 'Sem setor/função')}</div></div>${estado}</div>
    ${seg}
    ${p.situacao === 'mudou' ? `<div class="cp-fun-muda" ${trav ? '' : `data-acao="campo:fun-mudou:${p.id}"`}>Agora: <b>${esc([p.novo_setor, p.nova_funcao].filter(Boolean).join(' · ') || 'informar')}</b>${trav ? '' : ' · <u>alterar</u>'}</div>` : ''}
    ${p.origem === 'empresa' && !trav ? `<div style="margin-top:6px;display:flex;gap:14px"><span class="cp-fun-link" data-acao="campo:fun-editar:${p.id}">Alterar</span><span class="cp-fun-link" style="color:var(--red)" data-acao="campo:fun-remover:${p.id}">Remover</span></div>` : ''}
  </div>`;
}

export async function render(params) {
  const novo = idDe(params);
  if (novo !== _id) { _filtro = null; _busca = ''; }
  _id = novo;
  if (!_id) return nota('Nenhuma avaliação selecionada.');
  const d = await D.abrir(_id);
  ligarTela({ digitar });
  const cli = (await D.clientesPorId([d.av.cliente_id]))[d.av.cliente_id];
  const voltar = btn('Voltar para a avaliação', `ir:campo-avaliacao:${_id}`, { papel: 'cp-a-voltar' });
  if (!D.temConferencia(d)) {
    return `${topo(d, cli, { rotulo: 'Conferir funcionários' })}${nota('A conferência de funcionários ainda não está ligada no banco (falta o PASSO-68). Fale com o administrador.', 'warn')}${acoes([voltar])}`;
  }
  const trav = !D.podeEditar(d);
  const lista = D.listaFuncionarios(d);
  const r = D.resumoConferencia(d);
  cabecalhoCelular(d, cli, `${r.soc} no SOC · ${r.soc - r.falta} conferidos · ${r.saiu} saíram · ${r.mudou} mudaram`, { titulo: 'Conferir funcionários', rotulo: cli?.nome || 'Avaliação de campo' });   // v222
  if (!_filtro) _filtro = r.falta ? 'falta' : 'todos';
  const nMud = lista.filter(ehMudanca).length;
  const vis = lista.filter(p => _filtro === 'todos' ? true : _filtro === 'falta' ? (p.origem === 'soc' && !p.situacao) : ehMudanca(p));
  /* Agrupa por setor · função de origem (a ordem da folha da empresa). */
  const grupos = new Map();
  for (const p of vis) {
    const k = [p.setor, p.funcao].filter(Boolean).join(' · ') || 'Sem setor/função';
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(p);
  }
  const blocos = [...grupos.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR')).map(([k, ps]) =>
    `<div class="cp-fun-grupo">${esc(k)} <span>${ps.length}</span></div>${ps.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(p => linha(p, trav)).join('')}`).join('');
  const chip = (f, t, n) => `<span class="cp-fun-chip ${_filtro === f ? 'on' : ''}" data-acao="campo:fun-filtro:${f}">${t} · ${n}</span>`;
  const vazio = !lista.length ? nota(d.av.soc ? 'O SOC não trouxe funcionários ativos desta empresa. Inclua os funcionários informados pela empresa.' : 'Traga os dados do SOC na avaliação para ter a lista, ou inclua os funcionários informados pela empresa.')
    : !vis.length ? nota(_filtro === 'falta' ? 'Todos já foram conferidos.' : 'Nenhuma mudança até agora.') : '';
  return `${topo(d, cli, { rotulo: 'Conferir funcionários', sub: `${r.soc} no SOC · ${r.confere} ${r.confere === 1 ? 'confere' : 'conferem'} · ${r.saiu} ${r.saiu === 1 ? 'saiu' : 'saíram'} · ${r.mudou} ${r.mudou === 1 ? 'mudou' : 'mudaram'} · ${r.incluidos} ${r.incluidos === 1 ? 'incluído' : 'incluídos'}` })}
    ${trav ? '' : `<div class="cp-ajuda" style="margin:0 2px 10px">Leia a lista com o acompanhante. Marque quem confere, quem saiu da empresa e quem mudou de setor ou função. Nada é alterado no SOC: as mudanças saem no PDF para o escritório atualizar.</div>`}
    ${lista.length ? `<div class="cp-fun-chips">${chip('falta', 'Falta conferir', r.falta)}${chip('todos', 'Todos', lista.length)}${chip('mudancas', 'Mudanças', nMud)}</div>
      ${lista.length > 8 ? `<input class="cp-inp cp-fun-busca" type="search" data-cp="busca" placeholder="Procurar pelo nome" value="${esc(_busca)}" autocomplete="off">` : ''}` : ''}
    ${vazio}${blocos}
    ${trav ? '' : `<div class="cp-fun-rodape">${btn('+ Funcionário que não está no SOC', 'campo:fun-incluir', { cls: 'btn-outline', estilo: 'border-style:dashed;width:100%' })}
      ${r.falta ? btn(`Todos os que faltam conferem (${r.falta})`, 'campo:fun-todos', { cls: 'btn-outline', estilo: 'width:100%' }) : ''}</div>`}
    ${acoes([voltar])}`;
}

export function depois() { filtrarBusca(); }

function digitar(chave, valor) {
  if (chave !== 'busca') return;
  _busca = valor;
  filtrarBusca();
}
function filtrarBusca() {
  const q = norm(_busca).trim();
  document.querySelectorAll('[data-cp-fun]').forEach(el => { el.style.display = !q || el.dataset.cpFun.includes(q) ? '' : 'none'; });
}

/* Modal com escolha de setor e função (sugestões + digitar). */
function modalSetorFuncao({ titulo, sub, nome = null, setor = '', funcao = '', botao }, aoSalvar) {
  const p = ponte();
  const d = D.doc(_id);
  const { setores, funcoes } = conhecidos(d);
  const chips = (campo, xs, atual) => xs.length ? `<div class="cp-fun-opts">${xs.map(x =>
    `<span class="cp-fun-opt ${x === atual ? 'on' : ''}" data-v="${esc(x)}" onclick="var i=document.getElementById('${campo}');i.value=this.dataset.v;this.parentNode.querySelectorAll('.cp-fun-opt').forEach(function(e){e.classList.remove('on')});this.classList.add('on')">${esc(x)}</span>`).join('')}</div>` : '';
  p.abrirModal(titulo, `
    ${sub ? `<div style="font-size:12.5px;color:var(--text-3);margin:-4px 0 10px">${esc(sub)}</div>` : ''}
    ${nome !== null ? `<div class="field"><label>Nome *</label><input type="text" id="cpFunNome" maxlength="200" value="${esc(nome)}" autocomplete="off"></div>` : ''}
    <div class="field"><label>Setor</label>${chips('cpFunSetor', setores, setor)}<input type="text" id="cpFunSetor" maxlength="200" value="${esc(setor)}" placeholder="Digite ou toque numa sugestão" autocomplete="off"></div>
    <div class="field"><label>Função</label>${chips('cpFunFuncao', funcoes, funcao)}<input type="text" id="cpFunFuncao" maxlength="200" value="${esc(funcao)}" placeholder="Digite ou toque numa sugestão" autocomplete="off"></div>`,
    p.botoes(botao || 'Salvar', 'cpFunOk'));
  p.aoConfirmar('cpFunOk', () => {
    const v = (idEl) => (document.getElementById(idEl)?.value || '').trim().toUpperCase();
    const n = nome !== null ? v('cpFunNome') : null;
    const s = v('cpFunSetor'), f = v('cpFunFuncao');
    if (nome !== null && !n) { avisar('Informe o nome do funcionário.', 'erro'); return; }
    if (!s && !f) { avisar('Informe o setor ou a função.', 'erro'); return; }
    p.fecharModal();
    aoSalvar({ nome: n, setor: s, funcao: f });
    redesenharTela();
  });
}

export async function acao(nome, valor, redesenhar) {
  const d = D.doc(_id);
  if (!d) return false;
  const [a1, a2] = String(valor ?? '').split('~');
  switch (nome) {
    case 'campo:fun-filtro': _filtro = a1; redesenhar(); return true;
    case 'campo:fun-sit': {
      const p = pessoa(d, a1); if (!p) return true;
      if (a2 === 'mudou') {
        modalSetorFuncao({ titulo: 'Mudou de setor ou função', sub: p.nome, setor: p.novo_setor || p.setor || '', funcao: p.nova_funcao || p.funcao || '' },
          ({ setor, funcao }) => D.alterarFuncionarios(_id, l => { const x = l.find(y => y.id === p.id); Object.assign(x, { situacao: 'mudou', novo_setor: setor || null, nova_funcao: funcao || null }); }));
        return true;
      }
      /* Tocar de novo no que já está marcado desmarca. */
      D.alterarFuncionarios(_id, l => { const x = l.find(y => y.id === p.id); const nova = x.situacao === a2 ? null : a2; Object.assign(x, { situacao: nova, novo_setor: null, nova_funcao: null }); });
      redesenhar(); return true;
    }
    case 'campo:fun-mudou': {
      const p = pessoa(d, a1); if (!p) return true;
      modalSetorFuncao({ titulo: 'Mudou de setor ou função', sub: p.nome, setor: p.novo_setor || '', funcao: p.nova_funcao || '' },
        ({ setor, funcao }) => D.alterarFuncionarios(_id, l => { const x = l.find(y => y.id === p.id); Object.assign(x, { novo_setor: setor || null, nova_funcao: funcao || null }); }));
      return true;
    }
    case 'campo:fun-incluir':
      modalSetorFuncao({ titulo: 'Funcionário que não está no SOC', nome: '', botao: 'Incluir' },
        ({ nome: n, setor, funcao }) => { D.alterarFuncionarios(_id, l => { l.push({ id: 'e' + D.novoId(), codigo: null, nome: n, setor: setor || null, funcao: funcao || null, origem: 'empresa', situacao: 'confere', novo_setor: null, nova_funcao: null }); }); avisar('Funcionário incluído.'); });
      return true;
    case 'campo:fun-editar': {
      const p = pessoa(d, a1); if (!p) return true;
      modalSetorFuncao({ titulo: 'Alterar funcionário', nome: p.nome, setor: p.setor || '', funcao: p.funcao || '' },
        ({ nome: n, setor, funcao }) => D.alterarFuncionarios(_id, l => { const x = l.find(y => y.id === p.id); Object.assign(x, { nome: n, setor: setor || null, funcao: funcao || null }); }));
      return true;
    }
    case 'campo:fun-remover': {
      const p = pessoa(d, a1); if (!p) return true;
      if (!await confirmar(`Remover ${p.nome} da lista?`)) return true;
      D.alterarFuncionarios(_id, l => { const i = l.findIndex(y => y.id === p.id); if (i >= 0) l.splice(i, 1); });
      redesenhar(); return true;
    }
    case 'campo:fun-todos': {
      const n = D.resumoConferencia(d).falta;
      if (!await confirmar(`Marcar os ${n} que faltam como "confere"? Confira antes com o acompanhante.`)) return true;
      D.alterarFuncionarios(_id, l => { for (const x of l) if (x.origem === 'soc' && !x.situacao) x.situacao = 'confere'; });
      _filtro = 'todos';
      redesenhar(); return true;
    }
  }
  return false;
}
