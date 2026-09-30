/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/campo/avaliacao.js — a avaliação da EMPRESA (centro de tudo)
   Daqui o técnico: traz a hierarquia do SOC, cria e abre os GHEs, vê as
   pendências e vai para a finalização. Concluída, vira a tela do documento
   (baixar PDF, nova revisão).
   ══════════════════════════════════════════════════════════════════════════ */

import * as D from './dados.js';
import * as P from './plano.js';
import { I, esc, ico, secTit, nota, topo, dataBr, quando, selo, ligarTela, avisar, confirmar, ponte, btn, acoes, carregarFotos, irPara,
  cabecalhoCelular } from './comum.js';
import { blocoEsperando, modalPendEmpresa } from './pendencias.js';
import { gerarEAnexar, baixarBlob, nomeArquivo } from './pdfgerar.js';

let _id = null, _ocupado = '', _progresso = '', _socAberto = false;

const idDe = (p) => String(p?.id || '').split('~')[0];

function cartaoGhe(g) {
  const st = D.gheCompleto(g);
  const [t, c] = st === 'ok' ? ['Completo', 'badge-green'] : st === 'pendente' ? ['Com pendência', 'badge-warn'] : ['A preencher', 'badge-blue'];
  const porCat = {};
  for (const r of g.riscos || []) porCat[r.categoria] = (porCat[r.categoria] || 0) + 1;
  const cats = Object.entries(porCat).map(([k, n]) => `<span class="cp-hub-cat">${esc(D.NOME_CATEGORIA[k] || k)} ${n}</span>`).join('');
  const pend = (g.riscos || []).filter(r => r.pendente).length;
  const set = (g.setores || []).join(', '), fun = (g.funcoes || []).join(', ');
  /* v222: progresso do GHE (riscos completos / total, sem psicossocial) */
  const rsv = (g.riscos || []).filter(r => !D.ehPsicossocial(r));
  const ok = rsv.filter(r => D.riscoCompleto(r) === 'ok').length;
  const pct = rsv.length ? Math.round(ok / rsv.length * 100) : 0;
  return `<div class="cp-hub-ghe cp-ghe-${st}" data-acao="ir:campo-ghe:${_id}~${g.id}">
    <div class="cp-hub-ghe-l1"><span class="cp-hub-ghe-nome">GHE ${esc(g.nome)}</span><span class="badge ${c}">${t}</span><span class="cp-rrow-ir" style="color:var(--text-3);display:flex;width:16px">${I.chevR}</span></div>
    <div class="cp-hub-ghe-meta">${set ? `<b>Setores:</b> ${esc(set)}<br>` : '<b>Setores:</b> a informar<br>'}${fun ? `<b>Funções:</b> ${esc(fun)}` : ''}</div>
    ${cats ? `<div class="cp-hub-cats">${cats}</div>` : `<div class="cp-hub-ghe-meta">Nenhum risco marcado ainda.</div>`}
    ${pend ? `<div class="cp-card-meta" style="color:var(--warn-text);font-weight:600">${I.relogio}<span>${pend} risco${pend > 1 ? 's' : ''} para completar depois</span></div>` : ''}
    ${(g.riscos || []).length > rsv.length ? `<div class="cp-hub-ghe-meta" style="color:var(--warn-text)">${(g.riscos || []).length - rsv.length} risco(s) psicossocial(is) do SOC neste GHE: abra o GHE, aba Riscos, e toque em Tirar do GHE.</div>` : ''}
    ${rsv.length ? `<div class="cp-ghe-prog"><div class="cp-pb"><i style="width:${pct}%"></i></div><span>${ok} de ${rsv.length} riscos</span></div>` : ''}
  </div>`;
}

function blocoSoc(d, cli, editavel, { semGhes = false } = {}) {
  const s = d.av.soc;
  if (!cli?.soc_codigo_empresa) {
    return `<div class="cp-sec"><div class="cp-sec-tit">Dados do SOC</div>${nota('Este cliente não tem o código da empresa no SOC. Com o código preenchido no cadastro de Clientes, dá para trazer setores, cargos e GHEs de lá.')}</div>`;
  }
  const usados = new Set(d.ghes.map(g => g.codigo_soc).filter(Boolean));
  const ghesSoc = (s?.ghes || []).filter(g => !usados.has(g.codigo || g.nome));
  const botao = editavel ? btn(_ocupado === 'soc' ? 'Buscando no SOC…' : (s ? 'Atualizar' : 'Trazer do SOC'), 'campo:soc',
    { cls: s ? 'btn-outline btn-sm' : 'btn-navy btn-sm', travado: !!_ocupado || !D.online() }) : '';
  if (!s) {
    return `<div class="cp-sec"><div class="cp-sec-tit">Dados do SOC</div>
      <div class="cp-soc-linha"><div class="t">Traga os setores, funções e GHEs desta empresa cadastrados no SOC. Eles aparecem como sugestão ao montar cada GHE.</div>${botao}</div></div>`;
  }
  /* v202: o técnico vê só o que é da empresa avaliada, em linguagem simples.
     Os avisos técnicos da busca ficam num "Detalhes" que só administrador e
     Provedor veem (pedido do Alisson, 27/09). */
  const nSet = (s.setores || []).filter(x => x.ativo !== false).length;
  const nCar = (s.cargos || []).filter(x => x.ativo !== false).length;
  const nGhe = (s.ghes || []).length;
  const stat = (n, t) => `<div class="cp-soc-stat"><b>${n}</b><span>${t}</span></div>`;
  const dicas = [];
  if (!nSet) dicas.push('O SOC não tem setores cadastrados para esta empresa. Digite os setores e funções ao montar cada GHE.');
  if (!nGhe) dicas.push('O SOC não tem GHE cadastrado para esta empresa. Crie os GHEs aqui, na visita.');
  const perfil = ponte().perfil?.() || '';
  const verDetalhes = ['administrador', 'provedor'].includes(perfil) && (s.avisos || []).length;
  return `<div class="cp-sec"><div class="cp-sec-tit">Dados do SOC <span class="dir">atualizado em ${esc(quando(s.gerado_em))}</span></div>
    <div class="cp-soc-linha"><div class="cp-soc-stats">${stat(nSet, nSet === 1 ? 'setor' : 'setores')}${stat(nCar, nCar === 1 ? 'função' : 'funções')}${stat(s.total_funcionarios ?? 0, (s.total_funcionarios ?? 0) === 1 ? 'funcionário' : 'funcionários')}${stat(nGhe, nGhe === 1 ? 'GHE' : 'GHEs')}</div>${botao}</div>
    ${dicas.length ? `<div class="cp-soc-dica">${dicas.map(esc).join('<br>')}</div>` : ''}
    ${verDetalhes ? `<details class="cp-soc-det"><summary>Detalhes da busca no SOC <small>só administrador vê</small></summary><ul>${s.avisos.map(a => `<li>${esc(a)}</li>`).join('')}</ul><div class="cp-ajuda">Código da empresa no SOC: ${esc(cli.soc_codigo_empresa)}</div></details>` : ''}
  </div>
  ${editavel && ghesSoc.length && !semGhes ? blocoGhesSoc(d, ghesSoc) : ''}`;
}

/* v205: GHEs que já existem no SOC — o técnico escolhe de qual partir. */
function blocoGhesSoc(d, ghesSoc) {
  const nm = D.nomesSoc(d.av.soc);
  const inativas = new Set((d.av.soc?.hierarquias || []).filter(h => h.ativa === false).map(h => `${h.unidade}|${h.setor}|${h.cargo}`));
  const uniq = (xs) => [...new Set(xs.filter(Boolean))];
  const todos = d.av.soc?.ghes || [];
  const cartao = (gs) => {
    const hs = (gs.hierarquias || []).filter(h => !inativas.has(`${h.unidade}|${h.setor}|${h.cargo}`));
    const set = uniq(hs.map(nm.setor)), fun = uniq(hs.map(nm.cargo));
    const rs = (gs.riscos || []).filter(r => !D.ehPsicossocial(r));   // v222: psicossocial fica fora
    const nPsi = (gs.riscos || []).length - rs.length;
    const datas = rs.map(r => r.medicao?.data).filter(Boolean);
    const ult = datas.sort((a, b) => dataOrd(b).localeCompare(dataOrd(a)))[0];
    const idx = todos.indexOf(gs);
    return `<div class="cp-ghe-soc">
      <div class="n">${esc(gs.codigo ? 'GHE ' + gs.codigo + ' · ' : '')}${esc(gs.nome || '')}</div>
      <div class="s">${set.length ? 'Setores: ' + esc(set.join(', ')) : 'Sem setor no SOC'}${fun.length ? ' · Funções: ' + esc(fun.join(', ')) : ''}</div>
      <div class="s">${rs.length ? `${rs.length} risco${rs.length === 1 ? '' : 's'}: ` + esc(rs.slice(0, 4).map(r => (r.codigo ? r.codigo + ' ' : '') + r.nome).join(', ')) + (rs.length > 4 ? '…' : '') : 'Sem risco caracterizado no SOC'}</div>
      ${nPsi ? `<div class="s" style="color:var(--text-3)">${nPsi} risco${nPsi === 1 ? '' : 's'} psicossocia${nPsi === 1 ? 'l' : 'is'} do SOC não ${nPsi === 1 ? 'entra' : 'entram'} (fora do escopo por enquanto)</div>` : ''}
      ${ult ? `<span class="cp-ghe-soc-med">Última medição: ${esc(ult)}</span>` : ''}
      <div style="margin-top:8px">${btn('Começar a partir deste GHE', `campo:soc-ghe:${idx}`, { cls: 'btn-navy btn-sm' })}</div></div>`;
  };
  return `<div class="cp-sec"><div class="cp-sec-tit">GHEs que já existem no SOC <span class="dir">${ghesSoc.length}</span></div>
    <div class="cp-ajuda" style="margin:0 0 10px">Escolha de qual GHE partir: ele entra na avaliação já com setores, funções, riscos e a última medição. Na visita, confira e altere só o que mudou.</div>
    ${ghesSoc.map(cartao).join('')}
    ${ghesSoc.length > 1 ? btn('Usar todos', 'campo:soc-ghes', { cls: 'btn-outline btn-sm' }) : ''}</div>`;
}
/* "15/04/2025" → "2025-04-15" para ordenar. */
const dataOrd = (t) => { const m = String(t || '').match(/^(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : String(t || ''); };
/* "Grau médio (20%)" / "20" → "20%" (graus da ficha). */
const grauSoc = (t) => { const m = String(t || '').match(/\b(10|20|40)\b/); return m ? m[1] + '%' : null; };

/* v222: a conferência de funcionários abre pelo quadro do topo (a seção antiga saiu). */

async function telaConcluida(d, cli, tec) {
  const r = d.av.resumo || {};
  const linhas = d.ghes.map(g => {
    const x = [];
    const rs = g.riscos || [];
    if (rs.some(k => k.ins === 'S')) x.push('insalubridade');
    if (rs.some(k => k.per === 'S')) x.push('periculosidade');
    if (rs.some(k => k.ae === 'S')) x.push('aposentadoria especial');
    return `<div class="cp-kv"><span>${esc(g.nome)}</span><b>${rs.length} risco${rs.length === 1 ? '' : 's'}${x.length ? ' · ' + x.join(', ') : ''}</b></div>`;
  }).join('');
  return `${topo(d, cli, { sub: `Visita em ${dataBr(d.av.data_visita)} · concluída em ${quando(d.av.concluida_em)} por ${tec?.nome || ''} · revisão ${d.av.revisao}` })}
  <div class="cp-2col"><div>
    <div class="cp-sec"><div class="cp-sec-tit">Documento</div>
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap"><span class="cp-rhead-ic" style="background:var(--gray-100);border-color:var(--border);color:var(--navy)">${I.doc}</span>
      <div style="flex:1;min-width:200px"><div style="font-size:14px;font-weight:700;color:var(--text-1)">Avaliação de Riscos Ambientais · ${esc(cli?.nome || '')}</div>
      <div style="font-size:12px;color:var(--text-3)">${r.ghes || d.ghes.length} GHEs · nº ${esc(d.av.numero || '')} · revisão ${d.av.revisao}</div></div>
      ${d.av.pdf_path ? btn(_ocupado === 'pdf' ? 'Baixando…' : 'Baixar PDF', 'campo:pdf-baixar', { cls: 'btn-amber', travado: !!_ocupado })
        : btn(_ocupado === 'pdf' ? 'Gerando…' : 'Gerar PDF', 'campo:pdf-gerar', { cls: 'btn-amber', travado: !!_ocupado || !D.online() })}</div>
      ${_progresso ? `<div class="cp-progresso">${esc(_progresso)}</div>` : ''}
      ${!d.av.pdf_path ? nota('A avaliação foi concluída, mas o PDF ainda não foi anexado. Toque em Gerar PDF (precisa de internet).', 'warn') : ''}</div>
    <div class="cp-sec"><div class="cp-sec-tit">GHEs</div>${linhas || '<div class="cp-ajuda">Sem GHE.</div>'}</div>
    ${D.temPlano() && (D.planoDe(d).acoes || []).length ? (() => { const c = P.contar(D.planoDe(d).acoes);
      return `<div class="cp-sec"><div class="cp-sec-tit">Plano de ação <span class="dir" style="color:var(--text-3)">${c.total} ${c.total === 1 ? 'ação' : 'ações'}</span></div>
        <div class="cp-kv"><span>Imediata · Alta · Média · Baixa</span><b>${c.imediata} · ${c.alta} · ${c.media} · ${c.baixa}</b></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">${btn('Lançar no SOC e acompanhar', `ir:campo-soc:${_id}`, { cls: 'btn-navy btn-sm' })}${btn('Ver o plano', `ir:campo-plano:${_id}`, { cls: 'btn-ghost btn-sm' })}</div></div>`; })() : ''}
    ${D.listaFuncionarios(d).length ? (() => { const rc = D.resumoConferencia(d); return `<div class="cp-sec"><div class="cp-sec-tit">Funcionários conferidos</div><div class="cp-kv"><span>No SOC</span><b>${rc.soc}</b></div><div class="cp-kv"><span>Saíram · mudaram · incluídos</span><b>${rc.saiu} · ${rc.mudou} · ${rc.incluidos}</b></div><div class="cp-kv"><span>Na empresa</span><b>${rc.naEmpresa}${rc.falta ? ` (${rc.falta} sem conferir)` : ''}</b></div>${btn('Ver lista', `ir:campo-funcionarios:${_id}`, { cls: 'btn-ghost btn-sm' })}</div>`; })() : ''}
    ${D.pendEmpresaAbertas(d).length ? `<div class="cp-sec"><div class="cp-sec-tit">Documentos que a empresa ainda vai enviar</div>${D.pendEmpresaAbertas(d).map(p => `<div class="cp-kv"><span>${esc(p.nome)}${p.detalhe ? ' · ' + esc(p.detalhe) : ''}</span><b>${p.prazo ? 'prometido para ' + esc(D.prazoInfo(p.prazo).txt) : ''}</b></div>`).join('')}<div class="cp-ajuda">Saem no PDF, na página de pendências.</div></div>` : ''}
    ${d.av.observacoes ? `<div class="cp-sec"><div class="cp-sec-tit">Observações</div><div style="font-size:13px;color:var(--text-2);white-space:pre-wrap">${esc(d.av.observacoes)}</div></div>` : ''}
  </div><div class="cp-lado" style="display:block"><div class="cp-sec"><div class="cp-sec-tit">Ações</div>
    ${D.podeAcao('nova_revisao') ? btn('Nova revisão', 'campo:revisao', { estilo: 'width:100%;margin-bottom:8px', travado: !!_ocupado || !D.online() }) : ''}
    ${btn('Voltar para a lista', 'ir:campo', { cls: 'btn-ghost', estilo: 'width:100%' })}
    ${nota('Avaliação concluída não se altera. <b>Nova revisão</b> cria uma cópia aberta (revisão ' + (d.av.revisao + 1) + ') e mantém esta no histórico.')}
</div></div></div>`;
}

export async function render(params) {
  _id = idDe(params);
  ligarTela(null);
  if (!_id) return nota('Nenhuma avaliação selecionada.');
  const d = await D.abrir(_id);
  const [clis, usus] = await Promise.all([D.clientesPorId([d.av.cliente_id]), D.usuariosPorId([d.av.tecnico_id])]);
  const cli = clis[d.av.cliente_id], tec = usus[d.av.tecnico_id];
  const hora = d.av.hora_inicio ? ' · ' + String(d.av.hora_inicio).slice(0, 5) : '';
  cabecalhoCelular(d, cli, `${dataBr(d.av.data_visita)}${hora} · ${tec?.nome || ''}`);
  if (d.av.situacao === 'concluida') return telaConcluida(d, cli, tec);

  const editavel = D.podeEditar(d);
  if (editavel) { try { D.normalizarMatriz(_id, (await D.catalogo()).matriz); } catch { /* sem catálogo no aparelho: acerta ao abrir o GHE */ } }   // v222
  if (editavel && D.temPlano()) { try { await D.atualizarPlano(_id); } catch (e) { console.warn('[campo] plano', e?.message); } }   // v223
  const pend = D.pendencias(d);
  const pronta = !pend.length && d.ghes.length && d.ghes.every(g => D.gheCompleto(g) === 'ok');
  const sitTxt = d.av.situacao === 'cancelada' ? selo('cancelada')
    : pronta ? '<b style="color:var(--green-text)">Pronta para concluir</b>' : selo(d.av.situacao);
  const s = d.av.soc;
  const semSoc = !s && !!cli?.soc_codigo_empresa;

  return `${topo(d, cli)}
    ${d.av.situacao === 'cancelada' ? nota('Esta visita foi cancelada na agenda. Para retomar, reative o compromisso na Agenda da Equipe.', 'red') : ''}
    ${d.av.revisao > 1 ? nota(`Revisão ${d.av.revisao} da avaliação ${esc(d.av.numero || '')}. Ao concluir, ela substitui a anterior.`) : ''}
    ${quadros(d)}
    ${blocoEsperando(d, editavel)}
    ${semSoc && editavel ? blocoSoc(d, cli, editavel) : ''}
    <div class="cp-sec-t2" id="cpGhes">GHEs desta empresa <span>${d.ghes.length}</span></div>
    ${d.ghes.map(cartaoGhe).join('') || nota('Nenhum GHE ainda. Comece por um GHE do SOC (abaixo) ou crie um para cada grupo de trabalhadores com a mesma exposição (ex.: Administrativo, Produção, Serviços Gerais).')}
    ${editavel ? blocoGhesSocResumo(d) : ''}
    ${editavel ? `<button type="button" class="cp-add-ghe" data-acao="campo:novo-ghe">${I.plus}Adicionar GHE</button>` : ''}
    ${pend.length ? `<div class="cp-sec" style="margin-top:12px"><div class="cp-sec-tit">Riscos para completar depois <span class="dir" style="color:var(--text-3)">${pend.length} aberto${pend.length > 1 ? 's' : ''}</span></div>
      ${pend.map(({ ghe, risco }) => `<div class="cp-pend" data-acao="ir:campo-ghe:${_id}~${ghe.id}~${risco.uid}" style="cursor:pointer"><span class="cp-pend-ic">${I.relogio}</span>
        <div><div class="cp-pend-t">${esc(D.NOME_CATEGORIA[risco.categoria] || '')} ${esc(risco.codigo || '')} · ${esc(risco.nome)}</div>
        <div class="cp-pend-s">GHE ${esc(ghe.nome)} · ${esc(risco.pendente.texto || (D.MOTIVOS_PENDENCIA.find(m => m[0] === risco.pendente.motivo) || [, 'Para depois'])[1])}</div></div>
        <span class="badge ${risco.pendente.quem === 'empresa' ? 'badge-blue' : 'badge-gray'} cp-pend-quem">${risco.pendente.quem === 'empresa' ? 'Empresa' : 'Técnico'}</span></div>`).join('')}
      <div class="cp-ajuda">Pendências não travam a visita: você sai da empresa, resolve depois e volta para concluir.</div></div>` : ''}
    <details class="cp-dobra-sec">
      <summary>Dados da visita e do SOC <small>${esc(d.av.acompanhante_nome ? 'acompanhante: ' + d.av.acompanhante_nome : 'acompanhante a informar')}</small></summary>
      <div class="cp-sec" style="margin:8px 0 0"><div class="cp-visita">
        <div>Data<b>${esc(dataBr(d.av.data_visita))}${esc(hora)}</b></div>
        <div>Técnico<b>${esc(tec?.nome || '')}</b></div>
        <div>Acompanhante<b>${esc(d.av.acompanhante_nome || 'a informar')}</b></div>
        <div>Situação<b>${sitTxt}</b></div></div></div>
      ${semSoc && editavel ? '' : blocoSoc(d, cli, editavel, { semGhes: true })}
    </details>
    ${acoes([btn('Voltar', 'ir:campo', { papel: 'cp-a-voltar' }),
      d.av.situacao !== 'cancelada' ? btn('Assinaturas e conclusão', `ir:campo-finalizar:${_id}`, { cls: 'btn-amber', papel: 'cp-a-prox', travado: !d.ghes.length }) : ''])}`;
}

/* v222: 4 quadros do topo — o que falta, com um toque cada. */
function quadros(d) {
  const rsv = d.ghes.flatMap(g => (g.riscos || []).filter(r => !D.ehPsicossocial(r)));
  const gOk = d.ghes.filter(g => D.gheCompleto(g) === 'ok').length;
  const conf = D.temConferencia(d) ? D.resumoConferencia(d) : null;
  const abertas = D.temPendEmpresa() ? D.pendEmpresaAbertas(d).length : 0;
  const nAss = (d.av.acompanhante_nome ? 1 : 0) + 1;
  const feitas = (d.av.acompanhante_nome && D.assinaturaDe(d, 'acomp').path ? 1 : 0) + (D.assinaturaDe(d, 'tec').path ? 1 : 0);
  const q = (cls, ic, num, rot, acao) => `<button type="button" class="cp-q ${cls}" ${acao ? `data-acao="${acao}"` : 'disabled'}><span class="cp-q-ic">${I[ic]}</span><span class="cp-q-tx"><b>${num}</b><span>${rot}</span></span></button>`;
  const gheTx = d.ghes.length ? `${gOk} de ${d.ghes.length}` : '0';
  const gheRot = d.ghes.length ? `${d.ghes.length === 1 ? 'GHE completo' : 'GHEs completos'}${rsv.length ? ` · ${rsv.filter(r => D.riscoCompleto(r) === 'ok').length}/${rsv.length} riscos` : ''}` : 'GHE criado';
  const confTx = conf && conf.soc ? `${conf.soc - conf.falta} de ${conf.soc}` : conf && conf.total ? String(conf.total) : '—';
  return `<div class="cp-qs">
    ${q(d.ghes.length && gOk === d.ghes.length ? 'ok' : 'az', 'predio', gheTx, gheRot, d.ghes.length === 1 ? `ir:campo-ghe:${_id}~${d.ghes[0].id}` : 'campo:ir-ghes')}
    ${conf ? q(conf.soc && !conf.falta ? 'ok' : 'az', 'pessoas', confTx, 'funcionários conferidos', `ir:campo-funcionarios:${_id}`) : ''}
    ${D.temPendEmpresa() ? q(abertas ? 'al' : 'ci', 'relogio', String(abertas), abertas > 1 ? 'itens esperando da empresa' : 'esperando da empresa', D.podeEditar(d) || abertas ? 'campo:pe-quadro' : '') : ''}
    ${D.temPlano() ? (() => { const pl = D.planoDe(d), n = (pl.acoes || []).length, rev = !!pl.revisado_em;
      return q(n && rev ? 'ok' : n ? 'al' : 'ci', 'doc', String(n), n ? (n === 1 ? 'ação no plano' : 'ações no plano') + (rev ? ' · revisado' : ' · revisar') : 'ações no plano', `ir:campo-plano:${_id}`); })() : ''}
    ${q(feitas === nAss ? 'ok' : 'ci', 'pen', `${feitas} de ${nAss}`, nAss === 1 ? 'assinatura' : 'assinaturas', `ir:campo-finalizar:${_id}`)}
  </div>`;
}

/* v222: GHEs do SOC ainda não usados — uma linha; "Ver" abre a lista. */
function blocoGhesSocResumo(d) {
  const s = d.av.soc; if (!s) return '';
  const usados = new Set(d.ghes.map(g => g.codigo_soc).filter(Boolean));
  const livres = (s.ghes || []).filter(g => !usados.has(g.codigo || g.nome));
  if (!livres.length) return '';
  const nomes = livres.slice(0, 3).map(g => g.nome || ('GHE ' + g.codigo)).join(', ') + (livres.length > 3 ? '…' : '');
  return `<div class="cp-soc-dob${_socAberto ? ' aberto' : ''}">
      <span class="cp-soc-dob-ic">${I.doc}</span>
      <div class="cp-soc-dob-tx"><b>${livres.length} ${livres.length === 1 ? 'GHE do SOC' : 'GHEs do SOC'}</b> ainda não ${livres.length === 1 ? 'usado' : 'usados'}<br><small>${esc(nomes)}</small></div>
      ${btn(_socAberto ? 'Fechar' : 'Ver', 'campo:soc-ver', { cls: _socAberto ? 'btn-outline btn-sm' : 'btn-navy btn-sm' })}</div>
    ${_socAberto ? blocoGhesSoc(d, livres) : ''}`;
}

export function depois() { carregarFotos(D.doc(_id)); }

function modalNovoGhe(d, redesenhar) {
  const p = ponte();
  const copias = d.ghes.map(g => `<option value="${g.id}">${esc(g.nome)}</option>`).join('');
  p.abrirModal('Novo GHE', `
    <div class="field"><label>Nome do GHE *</label><input type="text" id="cpNovoGhe" maxlength="120" placeholder="Ex.: Administrativo, Produção, Serviços Gerais"></div>
    ${copias ? `<div class="field"><label>Começar a partir de outro GHE (opcional)</label><select id="cpNovoGheCopia" style="width:100%;padding:11px 14px;border:1.5px solid var(--border);border-radius:var(--r-md);font-size:14px;font-family:inherit;background:var(--surface)"><option value="">Não, começar em branco</option>${copias}</select>
      <div style="font-size:11.5px;color:var(--text-3);margin-top:4px">Copia setores, funções, ambientes, riscos e treinamentos. Medições e pendências não são copiadas.</div></div>` : ''}`,
    p.botoes('Criar GHE', 'cpNovoGheOk'));
  p.aoConfirmar('cpNovoGheOk', async () => {
    const nome = document.getElementById('cpNovoGhe')?.value.trim();
    if (!nome) { avisar('Informe o nome do GHE.', 'erro'); return; }
    if (d.ghes.some(g => g.nome.toLowerCase() === nome.toLowerCase())) { avisar('Já existe um GHE com esse nome nesta avaliação.', 'erro'); return; }
    const origem = document.getElementById('cpNovoGheCopia')?.value;
    const g = origem ? D.copiarGhe(d.id, origem, nome) : D.novoGhe(d.id, { nome });
    p.fecharModal();
    if (g) irPara(`campo-ghe:${d.id}~${g.id}`); else redesenhar();
  });
}

/* GHEs do SOC → GHEs da avaliação (o técnico confere na visita). */
async function usarGhesDoSoc(d, soIdx = null) {
  const cat = await D.catalogo();
  const usados = new Set(d.ghes.map(g => g.codigo_soc).filter(Boolean));
  const nm = D.nomesSoc(d.av.soc);   /* v202: código → nome */
  /* v204: combinação inativa no SOC não entra no GHE. */
  const inativas = new Set((d.av.soc?.hierarquias || []).filter(h => h.ativa === false).map(h => `${h.unidade}|${h.setor}|${h.cargo}`));
  const ativasGhe = (gs) => (gs.hierarquias || []).filter(h => !inativas.has(`${h.unidade}|${h.setor}|${h.cargo}`));
  let n = 0;
  let ultimo = null;
  const todos = d.av.soc?.ghes || [];
  for (const gs of soIdx == null ? todos : [todos[soIdx]].filter(Boolean)) {
    const chave = gs.codigo || gs.nome;
    if (usados.has(chave)) continue;
    const uniq = (xs) => [...new Set(xs.filter(Boolean))];
    const riscos = (gs.riscos || []).filter(rs => !D.ehPsicossocial(rs)).map(rs => {
      /* v206: sem código (ou código fora do catálogo) → casa pelo nome */
      const c = (rs.codigo && cat.risco(rs.codigo)) || cat.riscoPorNome(rs.nome);
      return {
        uid: D.novoId(), codigo: c ? c.codigo : (rs.codigo || null), nome: c ? c.nome : rs.nome,
        categoria: c ? c.categoria : (rs.grupo || 'outro'), nao_listado: !c, ambiente: 'Todos',
        /* v205: caracterização vigente do SOC vem preenchida; as conclusões (ins/per/AE)
           ficam como dica "SOC:", quem decide é o técnico. */
        analise: rs.descricao || '', fonte: /^[\d\s,;.\-/|]*$/.test(rs.fonte || '') ? '' : rs.fonte, epc: rs.epc || '', medidas_adm: rs.medidas_adm || '',
        exposicao: rs.exposicao || null, probabilidade: null, severidade: null, classificacao: null,
        epi: rs.epi_ca || '', epi_eficaz: rs.epi_eficaz === true ? 'S' : rs.epi_eficaz === false ? 'N' : null,
        medicao: null, iluminacao: null, ins: null, per: null, ae: null, grau: null, pendente: null,
        soc: { ins: !!rs.insalubridade && !/n[aã]o informado/i.test(rs.insalubre_grau || ''), per: !!rs.periculosidade, ae: !!rs.aposentadoria, grau: grauSoc(rs.insalubre_grau),
               exposicao: rs.exposicao || null, medicao: rs.medicao || null }
      };
    });
    ultimo = D.novoGhe(d.id, { nome: gs.nome || ('GHE ' + gs.codigo), codigo_soc: chave,
      setores: uniq(ativasGhe(gs).map(nm.setor)), funcoes: uniq(ativasGhe(gs).map(nm.cargo)), riscos });
    n++;
  }
  return soIdx == null ? n : ultimo;
}

export async function acao(nome, valor, redesenhar) {
  const d = D.doc(_id);
  if (!d) return false;
  if (nome === 'campo:novo-ghe') { modalNovoGhe(d, redesenhar); return true; }
  /* v222 */
  if (nome === 'campo:soc-ver') { _socAberto = !_socAberto; redesenhar(); return true; }
  if (nome === 'campo:ir-ghes') { document.querySelectorAll('#cpGhes').forEach(el => { if (el.getBoundingClientRect().width) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }); return true; }
  if (nome === 'campo:pe-quadro') {
    const ab = D.pendEmpresaAbertas(d);
    if (ab.length) { document.querySelectorAll('#cpEsperando').forEach(el => { if (el.getBoundingClientRect().width) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }); return true; }
    if (D.podeEditar(d)) modalPendEmpresa(d, null, redesenhar);
    return true;
  }
  if (nome === 'campo:pe-novo') { modalPendEmpresa(d, null, redesenhar); return true; }
  if (nome === 'campo:pe-editar') { modalPendEmpresa(d, D.pendEmpresa(d).find(p => p.uid === valor) || null, redesenhar); return true; }
  if (nome === 'campo:pe-chegou') { D.resolverPendEmpresa(_id, valor); avisar('Marcado como recebido.'); redesenhar(); return true; }
  if (nome === 'campo:soc') {
    _ocupado = 'soc'; redesenhar();
    try {
      const s = await D.trazerDoSoc(_id);
      avisar(`SOC: ${(s.setores || []).length} setores, ${(s.cargos || []).length} cargos e ${(s.ghes || []).length} GHEs.`);
    } catch (e) { avisar(D.traduzirErro(e), 'erro'); }
    finally { _ocupado = ''; redesenhar(); }
    return true;
  }
  if (nome === 'campo:soc-ghe') {   /* v205: um GHE escolhido */
    const g = await usarGhesDoSoc(d, Number(valor));
    if (g) { avisar('GHE criado a partir do SOC. Confira na visita e altere o que mudou.'); irPara(`campo-ghe:${d.id}~${g.id}`); }
    else redesenhar();
    return true;
  }
  if (nome === 'campo:soc-ghes') {
    const n = await usarGhesDoSoc(d);
    avisar(n ? `${n} GHE${n > 1 ? 's criados' : ' criado'} a partir do SOC. Confira cada um na visita.` : 'Nenhum GHE novo no SOC.');
    redesenhar(); return true;
  }
  if (nome === 'campo:pdf-gerar' || nome === 'campo:pdf-baixar') {
    _ocupado = 'pdf'; _progresso = ''; redesenhar();
    try {
      const [clis] = await Promise.all([D.clientesPorId([d.av.cliente_id])]);
      if (nome === 'campo:pdf-baixar' && d.av.pdf_path) {
        const url = await D.linkPdf(d);
        if (!url) throw new Error('Não foi possível abrir o PDF.');
        window.open(url, '_blank');
      } else {
        const blob = await gerarEAnexar(_id, ({ etapa, atual, total }) => {
          _progresso = total ? `${etapa} (${atual} de ${total})` : etapa;
          document.querySelectorAll('.cp-progresso').forEach(el => { el.textContent = _progresso; });
        });
        baixarBlob(blob, nomeArquivo(D.doc(_id), clis[d.av.cliente_id]));
        avisar('PDF gerado e anexado à avaliação.');
      }
    } catch (e) { avisar(D.traduzirErro(e), 'erro'); }
    finally { _ocupado = ''; _progresso = ''; redesenhar(); }
    return true;
  }
  if (nome === 'campo:revisao') {
    if (!await confirmar('Criar a revisão ' + (d.av.revisao + 1) + ' desta avaliação? A atual fica guardada no histórico e a nova abre para edição.')) return true;
    try {
      const novo = await D.novaRevisao(_id);
      avisar('Revisão criada.');
      irPara(`campo-avaliacao:${novo}`);
    } catch (e) { avisar(D.traduzirErro(e), 'erro'); }
    return true;
  }
  return false;
}
