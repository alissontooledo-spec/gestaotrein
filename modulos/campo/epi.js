/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/campo/epi.js — Entregas de EPI (Gestão de SST, v299, PASSO-97)
   Proposta aprovada em 04/11/2026: 08-Propostas-visuais/grid-proposta-etapa2-fechada-v299.html
   · EPI da empresa: cadastro pelo número do CA (base do Ministério, tabela epi_ca),
     tamanhos, quantidade opcional (com quantidade, o GRID dá baixa a cada entrega).
   · Entregar: qualquer EPI para qualquer pessoa, sem travas. O GHE só sugere (se houver
     avaliação), e o treinamento só informa (se a empresa tem o módulo Treinamentos).
   · Ficha da pessoa (FEPI): histórico de entregas, cada uma com a sua assinatura; o PDF
     é o relatório (NR-06, item 6.5.1.1) com QR.
   Funciona sozinho: não depende de avaliação de campo, de GHE nem do Laudomiro.
   ══════════════════════════════════════════════════════════════════════════ */

import { cliente } from '../../nucleo/dados.js';
import * as sessao from '../../nucleo/sessao.js';
import { esc, avisar, ponte, btn, nota, secTit, ligarTela, confirmar, docClienteTxt } from './comum.js';
import * as Docs from './laudomiro-docs.js';
import { episDe, numTxt } from './laudomiro-gerar.js';

const sb = () => { const c = cliente(); if (!c) throw new Error('Banco indisponível. Recarregue o sistema.'); return c; };
const org = () => sessao.orgId();
const semAc = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = (t) => semAc(t).replace(/[^a-z0-9]+/g, ' ').trim();
const hojeIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dataBr = (iso) => { if (!iso) return ''; const [a, m, d] = String(iso).slice(0, 10).split('-'); return d ? `${d}/${m}/${a}` : ''; };
const mesAno = (iso) => { if (!iso) return ''; const [a, m] = String(iso).slice(0, 10).split('-'); return `${m}/${a}`; };
const semTabela = (e) => /42P01|PGRST20[25]|does not exist|schema cache|could not find/i.test(`${e?.code || ''} ${e?.message || ''}`);
const MOTIVOS = { 1: 'Primeira entrega', 2: 'Troca por dano', 3: 'Desgaste', 4: 'Extravio', 5: 'Vencimento' };
const urlValidar = (c) => `https://www.toledolabs.com.br/validar.html?doc=${c}`;

/* EPI ligado a treinamento de NR (só informa; aparece se a empresa tem Treinamentos) */
const TREINO_EPI = [[/cinto|talabarte|trava.?queda|paraquedista|para-quedista/, 'NR-35', 'trabalho em altura'], [/isolante|eletricista|vestimenta.*arco/, 'NR-10', 'eletricidade']];

/* ── estado da tela ─────────────────────────────────────────────────────── */
let S = { cli: '', aba: 'pessoas', busca: '', clientes: null, base: undefined };
let P = null;   // tela da pessoa: { ids, pessoas, itens, linhas, entregas, ... }

async function clientes() {
  if (S.clientes) return S.clientes;
  const { data, error } = await sb().from('clientes').select('*').eq('org_id', org()).eq('ativo', true).order('nome').limit(3000);
  if (error) throw error;
  S.clientes = data || [];
  if (!S.cli && S.clientes.length === 1) S.cli = S.clientes[0].id;
  return S.clientes;
}
async function infoBase() {
  if (S.base !== undefined) return S.base;
  try { const { data } = await sb().from('epi_ca_info').select('data_arquivo,cas').maybeSingle(); S.base = data || null; } catch { S.base = null; }
  return S.base;
}
async function itensDaEmpresa(cliId) {
  const { data, error } = await sb().from('epi_itens').select('*').eq('org_id', org()).eq('cliente_id', cliId).eq('ativo', true).order('nome');
  if (error) throw error;
  const itens = data || [];
  const ids = itens.filter((i) => i.controla).map((i) => i.id);
  let saldos = [];
  if (ids.length) { const r = await sb().from('epi_saldos').select('item_id,tamanho,saldo').in('item_id', ids); if (!r.error) saldos = r.data || []; }
  itens.forEach((i) => { i.saldos = saldos.filter((s) => s.item_id === i.id); i.total = i.saldos.reduce((a, s) => a + s.saldo, 0); });
  return itens;
}
/** Situação do CA para mostrar: vencido pela data, ou a situação do Ministério */
function situacaoCa(validade, situacao) {
  if (!validade && !situacao) return null;
  const venc = validade && validade < hojeIso();
  const s = semAc(situacao);
  if (/cancel/.test(s)) return { k: 'r', t: 'CA cancelado' };
  if (/suspens/.test(s)) return { k: 'r', t: 'CA suspenso' };
  if (venc || /vencid/.test(s)) return { k: 'r', t: `CA vencido${validade ? ` em ${mesAno(validade)}` : ''}` };
  return { k: 'v', t: `Válido até ${mesAno(validade)}` };
}
const tagCa = (x) => (x ? `<span class="ep-tag ${x.k}">${esc(x.t)}</span>` : '<span class="ep-tag b">CA sem dados</span>');
async function buscarCa(ca) {
  const c = String(ca || '').replace(/\D/g, '');
  if (!c) return null;
  const { data, error } = await sb().from('epi_ca').select('*').eq('ca', c).maybeSingle();
  if (error) { if (semTabela(error)) return null; throw error; }
  return data;
}

/* ══ Tela principal: empresa → pessoas | EPI da empresa ═══════════════════ */
export async function render() {
  ligarTela({ digitar: (chave, valor) => {
    if (chave !== 'epi.busca') return;
    S.busca = valor; const b = norm(valor);
    document.querySelectorAll('[data-epb]').forEach((el) => { el.hidden = !!b && !el.dataset.epb.includes(b); });
  } });
  let cls;
  try { cls = await clientes(); } catch (e) { return nota(esc(e?.message || 'Não foi possível ler as empresas.'), 'red'); }
  const opts = `<option value="">Escolha a empresa</option>${cls.map((c) => `<option value="${c.id}"${c.id === S.cli ? ' selected' : ''}>${esc(c.nome)}</option>`).join('')}`;
  const topo = `<div class="cp-topo"><div class="cp-topo-txt"><div class="cp-topo-emp">Gestão de SST</div><div class="cp-topo-tit">Entregas de EPI</div>
      <div class="cp-topo-sub">Qualquer EPI para qualquer pessoa. A ficha de cada pessoa guarda as entregas e as assinaturas.</div></div></div>
    <div class="ep-barra"><label class="ep-sel"><small>Empresa</small><select data-acao="campo:epi-cli" aria-label="Empresa">${opts}</select></label>
      ${S.cli ? `<div class="ep-abas" role="tablist">${[['pessoas', 'Pessoas'], ['itens', 'EPI da empresa']].map(([k, r]) => `<button type="button" role="tab" aria-selected="${S.aba === k}" class="${S.aba === k ? 'on' : ''}" data-acao="campo:epi-aba:${k}">${r}</button>`).join('')}</div>` : ''}</div>`;
  if (!S.cli) return `${topo}${nota(cls.length ? 'Escolha a empresa para ver as pessoas e os EPI.' : 'Nenhuma empresa cliente ativa no GRID.')}`;
  try {
    return topo + (S.aba === 'itens' ? await telaItens() : await telaPessoas());
  } catch (e) {
    return topo + nota(semTabela(e) ? 'As entregas de EPI ainda não estão ligadas neste GRID (falta o PASSO-97 no banco).' : esc(e?.message || 'Não foi possível ler os dados.'), semTabela(e) ? 'warn' : 'red');
  }
}

async function telaPessoas() {
  const [{ data: col, error }, ent] = await Promise.all([
    sb().from('colaboradores').select('id,nome,cargo').eq('org_id', org()).eq('cliente_id', S.cli).order('nome').limit(3000),
    sb().from('epi_entregas').select('colaborador_id,entregue_em').eq('org_id', org()).eq('cliente_id', S.cli).is('cancelada_em', null).limit(20000),
  ]);
  if (error) throw error;
  if (ent.error && semTabela(ent.error)) throw ent.error;
  const resumo = new Map();
  (ent.data || []).forEach((e) => { const r = resumo.get(e.colaborador_id) || { n: 0, ult: '' }; r.n++; if (e.entregue_em > r.ult) r.ult = e.entregue_em; resumo.set(e.colaborador_id, r); });
  const pessoas = col || [];
  if (!pessoas.length) return nota('Esta empresa não tem colaboradores cadastrados no GRID.');
  const funcoes = [...new Set(pessoas.map((p) => String(p.cargo || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const b = norm(S.busca);
  return `<div class="ep-busca"><input type="search" class="cp-inp" data-cp="epi.busca" value="${esc(S.busca)}" placeholder="Buscar pessoa ou função" aria-label="Buscar pessoa ou função">
      ${funcoes.length ? `<label class="ep-sel"><small>Entregar para uma função inteira</small><select data-acao="campo:epi-funcao" aria-label="Entregar para uma função"><option value="">Escolha a função</option>${funcoes.map((f) => `<option value="${esc(f)}">${esc(f)} (${pessoas.filter((p) => String(p.cargo || '').trim() === f).length})</option>`).join('')}</select></label>` : ''}</div>
    <div class="ep-lista">${pessoas.map((p) => { const r = resumo.get(p.id); const k = norm(`${p.nome} ${p.cargo}`);
      return `<div class="ep-pes" data-epb="${esc(k)}"${b && !k.includes(b) ? ' hidden' : ''}><div><b>${esc(p.nome)}</b><small>${esc(p.cargo || 'Sem função cadastrada')}${r ? ` · ${r.n} ${r.n === 1 ? 'entrega' : 'entregas'}, última em ${dataBr(r.ult)}` : ' · nenhuma entrega'}</small></div>
        ${btn('Abrir', `ir:campo-epi-pessoa:${p.id}`, { cls: 'btn-outline btn-sm' })}</div>`; }).join('')}</div>`;
}

async function telaItens() {
  const [itens, base] = await Promise.all([itensDaEmpresa(S.cli), infoBase()]);
  const saldoTxt = (i) => {
    if (!i.controla) return '<span class="ep-mute">não controla</span>';
    const baixo = i.minimo != null && i.total < i.minimo;
    const t = (i.tamanhos || []).length ? i.tamanhos.map((tm) => `tam. ${esc(tm)}: ${i.saldos.find((s) => s.tamanho === tm)?.saldo ?? 0}`).join(' · ') : String(i.total);
    return baixo ? `<span class="ep-tag y">${t} · abaixo de ${i.minimo}</span>` : t;
  };
  return `<div class="ep-acoes-topo">${btn('Novo EPI', 'campo:epi-novo', { cls: 'btn-amber' })}
      <span class="ep-mute">${base?.data_arquivo ? `Base de CAs do Ministério do Trabalho de ${dataBr(base.data_arquivo)}` : 'Base de CAs do Ministério ainda não carregada: digite os dados do EPI.'}</span></div>
    ${itens.length ? `<div class="ep-tab"><table><thead><tr><th>EPI</th><th>CA</th><th>Situação do CA</th><th>Saldo</th><th><span class="sr-only">Ações</span></th></tr></thead><tbody>
      ${itens.map((i) => `<tr><td><b>${esc(i.nome)}</b>${i.fabricante ? `<small>${esc(i.fabricante)}</small>` : ''}</td><td>${esc(i.ca || '—')}</td><td>${i.ca ? tagCa(situacaoCa(i.validade, i.situacao)) : ''}</td><td>${saldoTxt(i)}</td>
        <td class="ep-bts">${i.controla ? btn('+ Entrada', `campo:epi-entrada:${i.id}`, { cls: 'btn-outline btn-sm' }) : ''}${btn('Editar', `campo:epi-editar:${i.id}`, { cls: 'btn-ghost btn-sm' })}</td></tr>`).join('')}
      </tbody></table></div>` : nota('Nenhum EPI cadastrado nesta empresa. Toque em "Novo EPI" e digite o número do CA.')}
    <p class="ep-mute">Quantidade é opcional: sem quantidade, o EPI fica só cadastrado. Com quantidade, cada entrega dá baixa no saldo.</p>`;
}

/* ── Cadastro do EPI (modal) ─────────────────────────────────────────────── */
function modalItem(item, redesenhar) {
  const p = ponte(), i = item || { ca: '', nome: '', tamanhos: [], controla: false, minimo: null, pede_serie: false };
  const novo = !item;
  p.abrirModal(novo ? 'Novo EPI' : `Editar · ${i.nome}`, `
    <div class="field"><label>Número do CA</label><div style="display:flex;gap:8px"><input type="text" id="epCa" inputmode="numeric" maxlength="7" value="${esc(i.ca)}" placeholder="Ex.: 28011" style="flex:1">
      <button type="button" class="btn btn-outline" onclick="window.__epBuscarCa()">Buscar</button></div><div id="epCaRes" class="ep-cares"></div></div>
    <div class="field"><label>Nome que a empresa usa *</label><input type="text" id="epNome" maxlength="120" value="${esc(i.nome)}" placeholder="Ex.: Luva isolante classe 0"></div>
    <div class="field"><label>Tamanhos (opcional, separe por vírgula)</label><input type="text" id="epTam" maxlength="120" value="${esc((i.tamanhos || []).join(', '))}" placeholder="Ex.: P, M, G ou 8, 9, 10" onchange="window.__epTam()"></div>
    ${novo ? `<div class="field"><label>Quantidade em estoque (opcional)</label><div id="epQtd"></div><small class="ep-mute">Em branco: o EPI fica só cadastrado, sem controle de saldo.</small></div>` : `<label class="ep-chk"><input type="checkbox" id="epCtrl"${i.controla ? ' checked' : ''}> Controlar quantidade (baixa a cada entrega)</label>`}
    <div class="field"><label>Avisar quando o saldo ficar abaixo de (opcional)</label><input type="number" id="epMin" min="0" value="${i.minimo ?? ''}"></div>
    <label class="ep-chk"><input type="checkbox" id="epSerie"${i.pede_serie ? ' checked' : ''}> Pedir o número de série na entrega (ex.: luva isolante)</label>
    ${novo ? '' : '<label class="ep-chk"><input type="checkbox" id="epInativo"> Desativar este EPI (sai da lista e da entrega; as entregas feitas continuam nas fichas)</label>'}`,
    p.botoes(novo ? 'Salvar EPI' : 'Salvar', 'epOk'));
  let dadosCa = item ? { equipamento: i.equipamento, fabricante: i.fabricante, validade: i.validade, situacao: i.situacao } : null;
  window.__epTam = () => {
    const box = document.getElementById('epQtd'); if (!box) return;
    const tams = String(document.getElementById('epTam')?.value || '').split(',').map((x) => x.trim()).filter(Boolean).slice(0, 20);
    box.innerHTML = tams.length ? `<div class="ep-qtam">${tams.map((t, k) => `<label><small>Tam. ${esc(t)}</small><input type="number" min="0" data-eptam="${k}"></label>`).join('')}</div>` : '<input type="number" min="0" id="epQ0" placeholder="Deixe em branco se não controla">';
  };
  window.__epBuscarCa = async () => {
    const res = document.getElementById('epCaRes'), ca = document.getElementById('epCa')?.value;
    if (!res) return;
    res.innerHTML = '<span class="ep-mute">Buscando...</span>';
    try {
      const d = await buscarCa(ca);
      if (!d) { res.innerHTML = '<span class="ep-mute">CA não encontrado na base do Ministério. Digite o nome e siga.</span>'; dadosCa = null; return; }
      dadosCa = d;
      const nomeEl = document.getElementById('epNome');
      if (nomeEl && !nomeEl.value.trim()) nomeEl.value = d.equipamento.charAt(0) + d.equipamento.slice(1).toLowerCase();
      if (/isolante/i.test(d.equipamento)) document.getElementById('epSerie').checked = true;
      res.innerHTML = `<div class="ep-caok ${situacaoCa(d.validade, d.situacao)?.k === 'r' ? 'no' : ''}"><b>${esc(d.equipamento)}</b><small>${esc(d.fabricante)}${d.marca ? ` · ${esc(d.marca)}` : ''}${d.referencia ? ` · Ref. ${esc(d.referencia)}` : ''}</small>
        <small>${tagCa(situacaoCa(d.validade, d.situacao))}${d.aprovado_para ? ` ${esc(d.aprovado_para.slice(0, 140))}` : ''}</small><small>Base do Ministério do Trabalho${S.base?.data_arquivo ? ` de ${dataBr(S.base.data_arquivo)}` : ''}</small></div>`;
    } catch { res.innerHTML = '<span class="ep-mute">Não foi possível consultar agora. Digite os dados e siga.</span>'; }
  };
  setTimeout(() => { window.__epTam(); if (i.ca) window.__epBuscarCa(); document.getElementById(i.ca ? 'epNome' : 'epCa')?.focus(); }, 80);
  p.aoConfirmar('epOk', async () => {
    const v = (id) => document.getElementById(id);
    const nome = v('epNome').value.trim(), ca = v('epCa').value.replace(/\D/g, '');
    if (nome.length < 2) { avisar('Escreva o nome do EPI.', 'erro'); return; }
    const tamanhos = String(v('epTam').value || '').split(',').map((x) => x.trim()).filter(Boolean).slice(0, 20);
    const minimo = v('epMin').value === '' ? null : Math.max(0, parseInt(v('epMin').value, 10) || 0);
    const qtds = novo ? (tamanhos.length ? tamanhos.map((t, k) => [t, parseInt(document.querySelector(`[data-eptam="${k}"]`)?.value, 10)]) : [['', parseInt(v('epQ0')?.value, 10)]]).filter(([, q]) => q > 0) : [];
    const controla = novo ? qtds.length > 0 : !!v('epCtrl')?.checked;
    const linha = { nome, ca, tamanhos, controla, minimo, pede_serie: !!v('epSerie').checked,
      equipamento: dadosCa?.equipamento || '', fabricante: dadosCa?.fabricante || '', validade: dadosCa?.validade || null, situacao: dadosCa?.situacao || '' };
    try {
      let id = item?.id;
      if (novo) {
        const { data, error } = await sb().from('epi_itens').insert({ ...linha, org_id: org(), cliente_id: S.cli }).select('id').single();
        if (error) throw error; id = data.id;
        if (qtds.length) {
          const { error: e2 } = await sb().from('epi_movimentos').insert(qtds.map(([t, q]) => ({ org_id: org(), item_id: id, tamanho: t, qtde: q, tipo: 'entrada', nota: 'saldo inicial' })));
          if (e2) throw e2;
        }
      } else {
        const { error } = await sb().from('epi_itens').update({ ...linha, ...(v('epInativo')?.checked ? { ativo: false } : {}) }).eq('id', id);
        if (error) throw error;
      }
      p.fecharModal(); avisar(novo ? 'EPI cadastrado.' : 'EPI alterado.'); redesenhar();
    } catch (e) { avisar(/42501|row-level/i.test(`${e?.code} ${e?.message}`) ? 'Seu perfil de acesso não permite cadastrar EPI.' : 'Não foi possível salvar o EPI.', 'erro'); }
  });
}
function modalEntrada(item, redesenhar) {
  const p = ponte();
  p.abrirModal(`Entrada · ${item.nome}`, `
    ${(item.tamanhos || []).length ? `<div class="ep-qtam">${item.tamanhos.map((t, k) => `<label><small>Tam. ${esc(t)}</small><input type="number" min="0" data-epent="${k}"></label>`).join('')}</div>` : '<div class="field"><label>Quantidade que chegou</label><input type="number" min="1" id="epEnt0"></div>'}
    <div class="field"><label>Nota fiscal ou observação (opcional)</label><input type="text" id="epEntNota" maxlength="120"></div>`, p.botoes('Lançar entrada', 'epEntOk'));
  p.aoConfirmar('epEntOk', async () => {
    const tams = (item.tamanhos || []).length ? item.tamanhos.map((t, k) => [t, parseInt(document.querySelector(`[data-epent="${k}"]`)?.value, 10)]) : [['', parseInt(document.getElementById('epEnt0')?.value, 10)]];
    const linhas = tams.filter(([, q]) => q > 0).map(([t, q]) => ({ org_id: org(), item_id: item.id, tamanho: t, qtde: q, tipo: 'entrada', nota: document.getElementById('epEntNota').value.trim().slice(0, 120) || null }));
    if (!linhas.length) { avisar('Informe a quantidade.', 'erro'); return; }
    const { error } = await sb().from('epi_movimentos').insert(linhas);
    if (error) { avisar('Não foi possível lançar a entrada.', 'erro'); return; }
    p.fecharModal(); avisar('Entrada lançada.'); redesenhar();
  });
}

/* ══ Tela da pessoa (ou de várias): ficha e entregar ══════════════════════ */
async function carregarPessoa(ids) {
  const { data: pes, error } = await sb().from('colaboradores').select('id,nome,cargo,cliente_id').eq('org_id', org()).in('id', ids);
  if (error) throw error;
  if (!pes?.length) throw new Error('Pessoa não encontrada.');
  const cliId = pes[0].cliente_id;
  S.cli = cliId;
  const cls = await clientes();
  const [itens, ent] = await Promise.all([itensDaEmpresa(cliId), ids.length === 1
    ? sb().from('epi_entregas').select('*').eq('colaborador_id', ids[0]).order('entregue_em', { ascending: false }).order('criado_em', { ascending: false }).limit(500) : Promise.resolve({ data: [] })]);
  if (ent.error) throw ent.error;
  P = { ids, pessoas: pes, cli: cls.find((c) => c.id === cliId) || { id: cliId, nome: '' }, itens, entregas: ent.data || [], linhas: P?.ids?.join() === ids.join() ? P.linhas : [], data: hojeIso(),
    entreguePor: sessao.usuario()?.nome || '', sugestoes: [], treinos: {}, cancId: '' };
  await Promise.all([sugestoesGhe(), treinosDaPessoa()]);
}
/** Com avaliação de campo concluída e GHE da função: os EPI do GHE como atalho. Sem isso, nada aparece. */
async function sugestoesGhe() {
  try {
    const funcao = norm(P.pessoas[0].cargo); if (!funcao) return;
    const { data: av } = await sb().from('campo_avaliacoes').select('id').eq('cliente_id', P.cli.id).eq('situacao', 'concluida').order('data_visita', { ascending: false }).limit(1);
    if (!av?.length) return;
    const { data: ghes } = await sb().from('campo_ghes').select('funcoes,riscos').eq('avaliacao_id', av[0].id);
    const nomes = new Set();
    (ghes || []).filter((g) => (g.funcoes || []).some((f) => norm(f) === funcao)).forEach((g) => (g.riscos || []).forEach((r) => episDe(r.epi).forEach((e) => nomes.add(e.nome))));
    P.sugestoes = [...nomes].slice(0, 12);
  } catch { /* sem sugestão */ }
}
/** Com o módulo Treinamentos: situação de NR-35 / NR-10 da pessoa (só informa) */
async function treinosDaPessoa() {
  if (!sessao.temModulo('treinamentos') || P.ids.length !== 1) return;
  try {
    const { data } = await sb().from('conformidade_status').select('data_vencimento,catalogo(nome,nrs)').eq('org_id', org()).eq('colaborador_id', P.ids[0]);
    (data || []).forEach((r) => {
      const txt = `${(r.catalogo?.nrs || []).join(' ')} ${r.catalogo?.nome || ''}`;
      TREINO_EPI.forEach(([, nr]) => { if (new RegExp(`NR[\\s-]?0?${nr.slice(3)}\\b`, 'i').test(txt)) { const v = r.data_vencimento || '9999-12-31'; if (!P.treinos[nr] || v > P.treinos[nr]) P.treinos[nr] = v; } });
    });
    P.treinosLidos = true;
  } catch { /* segue sem */ }
}
function avisoTreino(nome) {
  if (!P.treinosLidos) return '';
  for (const [rx, nr, area] of TREINO_EPI) {
    if (!rx.test(semAc(nome))) continue;
    const v = P.treinos[nr];
    if (!v) return `<span class="ep-tag y">Sem ${nr} (${area}) registrado no GRID</span>`;
    return v < hojeIso() ? `<span class="ep-tag y">${nr} vencido em ${dataBr(v)}</span>` : `<span class="ep-tag v">${nr} em dia</span>`;
  }
  return '';
}

export const pessoa = {
  async render(params = {}) {
    ligarTela({ digitar: digitarLinha, enter: (k, v) => { if (k === 'epi.add') window.GRID?.tratarAcao?.('campo:epi-add'); } });
    const ids = String(params.id || '').split(/[,~]/).filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 60);
    if (!ids.length) return nota('Pessoa não informada.', 'red');
    /* abrir a rota = dados novos; redesenhar (mesmo params) = mantém o que está sendo digitado */
    try { if (!P || P.ids.join() !== ids.join() || !params.__ep) { await carregarPessoa(ids); params.__ep = 1; } }
    catch (e) { return nota(semTabela(e) ? 'As entregas de EPI ainda não estão ligadas neste GRID (falta o PASSO-97 no banco).' : esc(e?.message || 'Não foi possível ler os dados.'), 'red'); }
    const um = P.ids.length === 1, p0 = P.pessoas[0];
    const topo = `<div class="cp-topo"><div class="cp-topo-txt"><div class="cp-topo-emp">${esc(P.cli.nome)}</div><div class="cp-topo-tit">${um ? esc(p0.nome) : `Entrega para ${P.pessoas.length} pessoas`}</div>
      <div class="cp-topo-sub">${um ? esc(p0.cargo || 'Sem função cadastrada') : esc(P.pessoas.map((x) => x.nome).join(', ')).slice(0, 220)}</div></div>
      ${btn('Voltar', 'ir:campo-epi', { cls: 'btn-ghost' })}</div>`;
    return `${topo}${um ? fichaHtml() : ''}${formHtml()}`;
  },
  acao,
};

function fichaHtml() {
  const ativas = P.entregas.filter((e) => !e.cancelada_em);
  const linha = (e) => `<div class="ep-ent${e.cancelada_em ? ' canc' : ''}"><div><b>${dataBr(e.entregue_em)} · ${esc(e.nome)}${e.ca ? ` · CA ${esc(e.ca)}` : ''}</b>
      <small>${[e.tamanho && `Tam. ${esc(e.tamanho)}`, `Qtde ${e.qtde}`, e.serie && `série ${esc(e.serie)}`, e.motivo && esc(MOTIVOS[e.motivo]), e.devolveu && 'devolveu o anterior', e.entregue_por_nome && `entregue por ${esc(e.entregue_por_nome)}`].filter(Boolean).join(' · ')}</small>
      ${e.cancelada_em ? `<small>Cancelada: ${esc(e.motivo_cancelamento || '')}</small>` : ''}</div>
      <div class="ep-ent-d">${e.cancelada_em ? '<span class="ep-tag r">Cancelada</span>' : e.forma === 'papel' ? '<span class="ep-tag b">Papel</span>' : '<span class="ep-tag v">Assinada</span>'}
      ${!e.cancelada_em ? `<button type="button" class="lq-lnk" data-acao="campo:epi-canc:${e.id}">Cancelar</button>` : ''}</div></div>
    ${P.cancId === e.id ? `<div class="ep-canc"><label class="ep-sel"><small>Motivo do cancelamento</small><input class="cp-inp" data-cp="epc.motivo" placeholder="Ex.: lançado na pessoa errada"></label>${btn('Cancelar a entrega', 'campo:epi-canc-ok', { cls: 'btn-navy btn-sm' })}${btn('Voltar', 'campo:epi-canc-fechar', { cls: 'btn-ghost btn-sm' })}</div>` : ''}`;
  return `${secTit(`Ficha de EPI · ${ativas.length} ${ativas.length === 1 ? 'entrega' : 'entregas'}`)}
    <div class="cp-sec ep-ficha">${P.entregas.length ? P.entregas.map(linha).join('') : '<p class="ep-mute">Nenhuma entrega ainda.</p>'}
      <div class="ep-ficha-bt">${btn('Baixar ficha (PDF)', 'campo:epi-ficha-pdf', { cls: 'btn-amber', travado: !ativas.length })}</div></div>`;
}

function formHtml() {
  const L = P.linhas;
  const opts = P.itens.map((i) => `<option value="${esc(i.nome)}${i.ca ? ` · CA ${esc(i.ca)}` : ''}"></option>`).join('');
  const sug = P.sugestoes.filter((s) => !L.some((l) => norm(l.nome) === norm(s)));
  const linha = (l, k) => {
    const it = P.itens.find((i) => i.id === l.item_id);
    const sit = l.ca ? situacaoCa(l.validade, l.situacao) : null;
    const saldo = it?.controla ? (it.tamanhos?.length ? (l.tamanho ? it.saldos.find((s) => s.tamanho === l.tamanho)?.saldo ?? 0 : null) : it.total) : null;
    return `<div class="ep-lin"><div class="ep-lin-t"><b>${esc(l.nome)}</b>${l.ca ? ` <span class="ep-mute">CA ${esc(l.ca)}</span>` : ''} ${l.ca ? tagCa(sit) : ''} ${avisoTreino(l.nome)}
        <button type="button" class="lq-ib" data-acao="campo:epi-tirar:${k}" aria-label="Tirar ${esc(l.nome)}">×</button></div>
      <div class="ep-lin-c">
        ${it?.tamanhos?.length ? `<label><small>Tamanho</small><select data-acao="campo:epi-tam:${k}"><option value="">—</option>${it.tamanhos.map((t) => `<option${t === l.tamanho ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>` : `<label><small>Tamanho</small><input class="cp-inp" data-cp="epl.${k}.tamanho" value="${esc(l.tamanho)}" maxlength="20"></label>`}
        <label><small>Qtde</small><input class="cp-inp" type="number" min="1" data-cp="epl.${k}.qtde" value="${l.qtde}"></label>
        <label><small>Motivo</small><select data-cp="epl.${k}.motivo"><option value="">—</option>${Object.entries(MOTIVOS).map(([v, r]) => `<option value="${v}"${String(l.motivo) === v ? ' selected' : ''}>${r}</option>`).join('')}</select></label>
        <label class="ep-chk"><input type="checkbox" data-cpk="epl.${k}.devolveu"${l.devolveu ? ' checked' : ''} onchange="window.__epChk(this)"> Devolveu o anterior</label>
        ${it?.pede_serie || l.serie ? `<label><small>Nº de série</small><input class="cp-inp" data-cp="epl.${k}.serie" value="${esc(l.serie || '')}" maxlength="60"></label>` : ''}
        ${!l.item_id ? `<label class="ep-chk"><input type="checkbox" data-cpk="epl.${k}.ca_conferido"${l.ca_conferido ? ' checked' : ''} onchange="window.__epChk(this)"> Conferi o CA</label>` : ''}
      </div>${saldo != null ? `<small class="ep-mute">Saldo${l.tamanho ? ` tam. ${esc(l.tamanho)}` : ''}: ${saldo}${saldo - (l.qtde || 1) < 0 ? ' · vai ficar negativo (lance a entrada depois)' : ` → ${saldo - (l.qtde || 1)}`}</small>` : ''}</div>`;
  };
  return `${secTit(P.ids.length === 1 ? 'Entregar EPI' : `Entregar o mesmo EPI para ${P.ids.length} pessoas`)}
    <div class="cp-sec ep-form">
      ${sug.length ? `<div class="ep-sug"><small>Sugestões do GHE da função (opcional):</small>${sug.map((s) => `<button type="button" class="ep-chip" data-acao="campo:epi-sug:${encodeURIComponent(s)}">+ ${esc(s)}</button>`).join('')}</div>` : ''}
      ${L.map(linha).join('')}
      <div class="ep-add"><input class="cp-inp" list="epLista" data-cp="epi.add" data-cp-enter="epi.add" placeholder="Nome do EPI ou nº do CA" aria-label="Adicionar EPI"><datalist id="epLista">${opts}</datalist>
        ${btn('Adicionar', 'campo:epi-add', { cls: 'btn-outline' })}</div>
      <div class="ep-rod"><label><small>Data da entrega</small><input class="cp-inp" type="date" data-cp="epi.data" value="${esc(P.data)}" max="${hojeIso()}"></label>
        <label><small>Entregue por</small><input class="cp-inp" data-cp="epi.por" value="${esc(P.entreguePor)}" maxlength="120"></label></div>
      <div class="ep-bts2">${btn(P.ids.length === 1 ? 'Assinar neste aparelho' : 'Colher as assinaturas neste aparelho', 'campo:epi-assinar', { cls: 'btn-navy', travado: !L.length })}
        ${btn('Só registrar (papel)', 'campo:epi-papel', { cls: 'btn-outline', travado: !L.length })}</div>
      <p class="ep-mute">Qualquer EPI para qualquer pessoa. Nada aqui bloqueia por função, GHE ou saldo.</p>
    </div>`;
}

let _add = '';
function digitarLinha(chave, valor) {
  if (chave === 'epi.add') { _add = valor; return; }
  if (chave === 'epi.data') { P.data = valor; return; }
  if (chave === 'epi.por') { P.entreguePor = String(valor).slice(0, 120); return; }
  if (chave === 'epc.motivo') { P.cancMotivo = valor; return; }
  const m = /^epl\.(\d+)\.(tamanho|qtde|motivo|serie)$/.exec(chave);
  if (!m || !P.linhas[+m[1]]) return;
  const l = P.linhas[+m[1]];
  if (m[2] === 'qtde') l.qtde = Math.max(1, Math.min(1000, parseInt(valor, 10) || 1));
  else if (m[2] === 'motivo') l.motivo = valor ? +valor : null;
  else l[m[2]] = String(valor).slice(0, m[2] === 'serie' ? 60 : 20);
}
window.__epChk = (el) => { const m = /^epl\.(\d+)\.(devolveu|ca_conferido)$/.exec(el.dataset.cpk || ''); if (m && P?.linhas[+m[1]]) P.linhas[+m[1]][m[2]] = el.checked; };

async function adicionar(texto) {
  const t = String(texto || '').trim(); if (t.length < 2) { avisar('Digite o nome do EPI ou o número do CA.', 'erro'); return false; }
  const caTxt = (/\bCA\s*(\d{3,7})\b/i.exec(t) || /^(\d{3,7})$/.exec(t))?.[1] || '';
  let it = P.itens.find((i) => (caTxt && i.ca === caTxt) || norm(i.nome) === norm(t.replace(/\s*·\s*CA.*$/i, '')));
  let l;
  if (it) l = { item_id: it.id, nome: it.nome, ca: it.ca, validade: it.validade, situacao: it.situacao, tamanho: '', qtde: 1, motivo: null, devolveu: false, serie: '', ca_conferido: !!it.ca };
  else if (caTxt) {
    const d = await buscarCa(caTxt).catch(() => null);
    l = { item_id: null, nome: d ? d.equipamento.charAt(0) + d.equipamento.slice(1).toLowerCase() : `EPI CA ${caTxt}`, ca: caTxt, validade: d?.validade || null, situacao: d?.situacao || '', tamanho: '', qtde: 1, motivo: null, devolveu: false, serie: '', ca_conferido: !!d };
  } else l = { item_id: null, nome: t.slice(0, 120), ca: '', validade: null, situacao: '', tamanho: '', qtde: 1, motivo: null, devolveu: false, serie: '', ca_conferido: false };
  P.linhas.push(l); _add = '';
  return true;
}

/* assinatura: aceite + dedo (mesma linguagem da OS) */
function colher(pessoaNome, itens) {
  return new Promise((ok) => {
    const p = ponte();
    if (typeof window._initCanvas !== 'function') { avisar('Não foi possível abrir a assinatura neste aparelho.', 'erro'); ok(null); return; }
    p.abrirModal(`Assinatura · ${pessoaNome}`, `<div class="lq-ass-m"><p><b>${esc(pessoaNome)}</b></p><ul>${itens.map((l) => `<li>${esc(l.nome)}${l.ca ? ` · CA ${esc(l.ca)}` : ''}${l.tamanho ? ` · tam. ${esc(l.tamanho)}` : ''} · ${l.qtde} un.</li>`).join('')}</ul>
      <p>Recebi gratuitamente os EPI acima, em perfeito estado, e fui orientado sobre o uso, o ajuste, a guarda, a higienização e a troca (NR-06, itens 6.5.1 e 6.7.2).</p>
      <label class="lq-ass-ok"><input type="checkbox" id="lqAceite"> Aceito assinar eletronicamente, neste aparelho.</label>
      <canvas id="canvasAssinatura" width="440" height="180" aria-label="Espaço para assinar com o dedo" style="border:2px solid var(--border);border-radius:var(--r-md);touch-action:none;width:100%;height:180px;display:block;background:#fff;cursor:crosshair"></canvas>
      <button type="button" class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="limparAssinatura()">Limpar</button></div>`,
      `<button class="btn btn-outline" onclick="window.__epAss(null)">Cancelar</button><button class="btn btn-navy" onclick="window.__epAss(1)">Confirmar assinatura</button>`);
    setTimeout(() => window._initCanvas(), 100);
    window.__epAss = (sim) => {
      if (!sim) { p.fecharModal(); ok(null); return; }
      if (!document.getElementById('lqAceite')?.checked) { avisar('Marque o aceite antes de assinar.', 'erro'); return; }
      const cv = document.getElementById('canvasAssinatura'); const px = cv?.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      if (!px || !px.some((v, k) => k % 4 === 3 && v > 0)) { avisar('Assine no espaço antes de confirmar.', 'erro'); return; }
      const png = cv.toDataURL('image/png'); p.fecharModal(); ok(png);
    };
  });
}

async function entregar(forma, redesenhar) {
  if (!P.linhas.length) { avisar('Adicione pelo menos um EPI.', 'erro'); return; }
  const itens = P.linhas.map((l) => ({ item_id: l.item_id, ca: l.ca, nome: l.nome, tamanho: l.tamanho, qtde: l.qtde, motivo: l.motivo, devolveu: l.motivo && l.motivo > 1 ? !!l.devolveu : null, serie: l.serie, ca_conferido: !!l.ca_conferido }));
  const aparelho = `${navigator.userAgentData?.platform || navigator.platform || ''} · ${String(navigator.userAgent || '').slice(0, 200)}`;
  let feitas = 0;
  for (const pes of P.pessoas) {
    let png = null;
    if (forma === 'aparelho') { png = await colher(pes.nome, P.linhas); if (!png) break; }
    const { error } = await sb().rpc('epi_entregar', { p_colaborador_id: pes.id, p_itens: itens, p_forma: forma, p_png: png, p_aparelho: forma === 'aparelho' ? aparelho : null, p_data: P.data || hojeIso(), p_entregue_por_nome: P.entreguePor || null, p_org_id: org() });
    if (error) { avisar(semTabela(error) ? 'As entregas de EPI ainda não estão ligadas neste GRID (falta o PASSO-97 no banco).' : /42501|permiss/i.test(`${error.code} ${error.message}`) ? 'Seu perfil de acesso não permite registrar entregas de EPI.' : `Não foi possível registrar a entrega de ${pes.nome}.`, 'erro'); break; }
    feitas++;
  }
  if (feitas) {
    avisar(feitas === 1 ? 'Entrega registrada na ficha.' : `Entregas registradas para ${feitas} pessoas.`);
    P.linhas = []; const ids = P.ids; P = null;
    if (ids.length === 1) { await carregarPessoa(ids); redesenhar(); } else window.GRID?.tratarAcao?.('ir:campo-epi');
  }
}

async function fichaPdf() {
  const pes = P.pessoas[0], ativas = P.entregas.filter((e) => !e.cancelada_em).sort((a, b) => String(a.entregue_em).localeCompare(String(b.entregue_em)) || String(a.criado_em).localeCompare(String(b.criado_em)));
  const { data: f, error } = await sb().rpc('epi_ficha', { p_colaborador_id: pes.id, p_org_id: org() });
  if (error || !f?.[0]) throw new Error('Não foi possível ler o número da ficha.');
  const fic = f[0];
  const lotes = [...new Set(ativas.filter((e) => e.forma !== 'papel').map((e) => e.lote))];
  const ass = new Map();
  for (let i = 0; i < lotes.length; i += 50) {
    const { data } = await sb().from('epi_assinaturas').select('lote,png').in('lote', lotes.slice(i, i + 50));
    (data || []).forEach((a) => ass.set(a.lote, a.png));
  }
  const png = typeof window.gerarQRCodeDataURL === 'function' ? await window.gerarQRCodeDataURL(urlValidar(fic.codigo)).catch(() => '') : '';
  const docTxt = docClienteTxt(P.cli, true);
  const num = numTxt('epi', fic.numero);
  const partes = [
    { t: 'cab', esq: P.cli.nome || '', titulo: 'FICHA DE ENTREGA DE EPI', norma: 'NR-06, item 6.5.1, alínea d', ctl: [`Nº ${num}`, 'Matrícula [preencher]', 'Admissão ___/___/______'], qr: { codigo: fic.codigo, png } },
    { t: 'faixa', itens: [['Empresa', P.cli.nome || ''], ...(docTxt ? [[docTxt.replace(/\s.*$/, ''), docTxt.replace(/^\S+\s/, '')]] : [])] },
    { t: 'grade', cols: 4, itens: [{ r: 'Colaborador', v: pes.nome, span: 2 }, { r: 'Função', v: pes.cargo || '', span: 2 }] },
    { t: 'h', x: 'Entregas · cada linha vale com a assinatura do trabalhador' },
    { t: 'tabela', alt: 8, cols: [{ t: 'Data', w: 0.1 }, { t: 'EPI', w: 0.24 }, { t: 'Tam.', w: 0.06, centro: true }, { t: 'Nº do CA', w: 0.09 }, { t: 'CA conferido', w: 0.08, centro: true }, { t: 'Qtde', w: 0.06, centro: true }, { t: 'Motivo', w: 0.07, centro: true }, { t: 'Entregue por', w: 0.12 }, { t: 'Assinatura', w: 0.18 }],
      linhas: ativas.map((e) => [dataBr(e.entregue_em), `${e.nome}${e.serie ? ` · série ${e.serie}` : ''}${e.devolveu ? ' · devolveu o anterior' : ''}`, e.tamanho || '', e.ca || '', e.ca_conferido ? 'sim' : '', String(e.qtde), e.motivo ? String(e.motivo) : '', e.entregue_por_nome || '',
        e.forma === 'papel' ? 'papel' : (ass.get(e.lote) ? { x: '', img: ass.get(e.lote) } : 'eletrônica')]), vazias: Math.max(2, 8 - ativas.length) },
    { t: 'nota', x: 'Motivo: 1 primeira entrega · 2 troca por dano · 3 desgaste · 4 extravio · 5 vencimento.' },
    { t: 'decl', x: 'Ao assinar cada linha, o trabalhador declara que recebeu gratuitamente o EPI daquela linha, em perfeito estado, e que foi orientado sobre o uso, o ajuste, a guarda, a higienização e a troca (NR-06, itens 6.5.1 e 6.7.2), e que deve usá-lo apenas para a finalidade a que se destina e avisar a empresa quando for danificado ou extraviado (NR-06, item 6.6.1).' },
    { t: 'nota', x: `Assinaturas eletrônicas colhidas no GRID com aceite do trabalhador, data, hora e aparelho; o resumo de cada entrega fica guardado. Relatório do sistema eletrônico de registro (NR-06, itens 6.5.1, alínea d, e 6.5.1.1). Conferir em toledolabs.com.br/validar.html, código ${fic.codigo}.` },
    { t: 'rod', x: `${num} · ${pes.nome}` },
  ];
  await Docs.baixarPartes('pdf', `Ficha de EPI ${num} ${pes.nome}`, [partes]);
}

/* ── ações ──────────────────────────────────────────────────────────────── */
export async function acao(nome, valor, redesenhar) {
  if (!nome.startsWith('campo:epi')) return false;
  try {
    if (nome === 'campo:epi-cli') { S.cli = valor || ''; S.busca = ''; redesenhar(); return true; }
    if (nome === 'campo:epi-aba') { S.aba = valor === 'itens' ? 'itens' : 'pessoas'; redesenhar(); return true; }
    if (nome === 'campo:epi-funcao') {
      if (!valor) return true;
      const { data } = await sb().from('colaboradores').select('id').eq('org_id', org()).eq('cliente_id', S.cli).eq('cargo', valor).limit(60);
      if (!data?.length) { avisar('Ninguém nesta função.', 'erro'); return true; }
      window.GRID?.tratarAcao?.(`ir:campo-epi-pessoa:${data.map((x) => x.id).join('~')}`); return true;
    }
    if (nome === 'campo:epi-novo') { modalItem(null, redesenhar); return true; }
    if (nome === 'campo:epi-editar' || nome === 'campo:epi-entrada') {
      const it = (await itensDaEmpresa(S.cli)).find((i) => i.id === valor); if (!it) return true;
      if (nome === 'campo:epi-editar') modalItem(it, redesenhar); else modalEntrada(it, redesenhar);
      return true;
    }
    if (!P) return true;
    if (nome === 'campo:epi-add') {
      const el = [...document.querySelectorAll('[data-cp="epi.add"]')].find((x) => x.getBoundingClientRect().width > 0);
      if (await adicionar(el?.value || _add)) redesenhar(); return true;
    }
    if (nome === 'campo:epi-sug') { await adicionar(decodeURIComponent(valor || '')); redesenhar(); return true; }
    if (nome === 'campo:epi-tam') { const [k, ...t] = String(valor).split(':'); if (P.linhas[+k]) P.linhas[+k].tamanho = t.join(':').slice(0, 20); redesenhar(); return true; }  // v299b
    if (nome === 'campo:epi-tirar') { P.linhas.splice(+valor, 1); redesenhar(); return true; }
    if (nome === 'campo:epi-assinar') { await entregar('aparelho', redesenhar); return true; }
    if (nome === 'campo:epi-papel') {
      if (!await confirmar('Registrar como entrega em papel? Guarde a ficha assinada à mão.')) return true;
      await entregar('papel', redesenhar); return true;
    }
    if (nome === 'campo:epi-canc') { P.cancId = valor; P.cancMotivo = ''; redesenhar(); return true; }
    if (nome === 'campo:epi-canc-fechar') { P.cancId = ''; redesenhar(); return true; }
    if (nome === 'campo:epi-canc-ok') {
      if (String(P.cancMotivo || '').trim().length < 3) { avisar('Escreva o motivo.', 'erro'); return true; }
      const { error } = await sb().rpc('epi_cancelar_entrega', { p_id: P.cancId, p_motivo: P.cancMotivo.trim(), p_org_id: org() });
      if (error) { avisar(/42501|admin/i.test(`${error.code} ${error.message}`) ? 'Só o administrador ou quem entregou pode cancelar.' : 'Não foi possível cancelar.', 'erro'); return true; }
      avisar('Entrega cancelada. O saldo voltou.'); const ids = P.ids; await carregarPessoa(ids); redesenhar(); return true;
    }
    if (nome === 'campo:epi-ficha-pdf') { await fichaPdf(); return true; }
  } catch (e) { avisar(e?.message || 'Não foi possível concluir.', 'erro'); }
  return true;
}
