/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/campo/avaliacao.js — a avaliação da EMPRESA (centro de tudo)
   Daqui o técnico: traz a hierarquia do SOC, cria e abre os GHEs, vê as
   pendências e vai para a finalização. Concluída, vira a tela do documento
   (baixar PDF, nova revisão).
   ══════════════════════════════════════════════════════════════════════════ */

import * as D from './dados.js';
import { I, esc, ico, secTit, nota, topo, dataBr, quando, selo, ligarTela, avisar, confirmar, ponte, btn, acoes, carregarFotos, irPara } from './comum.js';
import { gerarEAnexar, baixarBlob, nomeArquivo } from './pdfgerar.js';

let _id = null, _ocupado = '', _progresso = '';

const idDe = (p) => String(p?.id || '').split('~')[0];

function cartaoGhe(g) {
  const st = D.gheCompleto(g);
  const [t, c] = st === 'ok' ? ['Completo', 'badge-green'] : st === 'pendente' ? ['Com pendência', 'badge-warn'] : ['A preencher', 'badge-blue'];
  const porCat = {};
  for (const r of g.riscos || []) porCat[r.categoria] = (porCat[r.categoria] || 0) + 1;
  const cats = Object.entries(porCat).map(([k, n]) => `<span class="cp-hub-cat">${esc(D.NOME_CATEGORIA[k] || k)} ${n}</span>`).join('');
  const pend = (g.riscos || []).filter(r => r.pendente).length;
  const set = (g.setores || []).join(', '), fun = (g.funcoes || []).join(', ');
  return `<div class="cp-hub-ghe" data-acao="ir:campo-ghe:${_id}~${g.id}">
    <div class="cp-hub-ghe-l1"><span class="cp-hub-ghe-nome">GHE ${esc(g.nome)}</span><span class="badge ${c}">${t}</span><span class="cp-rrow-ir" style="color:var(--text-3);display:flex;width:16px">${I.chevR}</span></div>
    <div class="cp-hub-ghe-meta">${set ? `<b>Setores:</b> ${esc(set)}<br>` : '<b>Setores:</b> a informar<br>'}${fun ? `<b>Funções:</b> ${esc(fun)}` : ''}</div>
    ${cats ? `<div class="cp-hub-cats">${cats}</div>` : `<div class="cp-hub-ghe-meta">Nenhum risco marcado ainda.</div>`}
    ${pend ? `<div class="cp-card-meta" style="color:var(--warn-text);font-weight:600">${I.relogio}<span>${pend} risco${pend > 1 ? 's' : ''} para completar depois</span></div>` : ''}
  </div>`;
}

function blocoSoc(d, cli, editavel) {
  const s = d.av.soc;
  if (!cli?.soc_codigo_empresa) {
    return `<div class="cp-sec"><div class="cp-sec-tit">Dados do SOC</div>${nota('Este cliente não tem o código da empresa no SOC. Com o código preenchido no cadastro de Clientes, dá para trazer setores, cargos e GHEs de lá.')}</div>`;
  }
  const usados = new Set(d.ghes.map(g => g.codigo_soc).filter(Boolean));
  const ghesSoc = (s?.ghes || []).filter(g => !usados.has(g.codigo || g.nome));
  const resumo = s ? `<b>${(s.setores || []).filter(x => x.ativo !== false).length}</b> setores, <b>${(s.cargos || []).filter(x => x.ativo !== false).length}</b> cargos, <b>${s.total_funcionarios ?? 0}</b> funcionários e <b>${(s.ghes || []).length}</b> GHEs no SOC · trazido em ${esc(quando(s.gerado_em))}` : 'Traga os setores, cargos e GHEs cadastrados no SOC para esta empresa. Setores e cargos aparecem como sugestão ao montar cada GHE, mesmo os que ainda não têm funcionário.';
  return `<div class="cp-sec"><div class="cp-sec-tit">Dados do SOC <span class="dir" style="color:var(--text-3)">código ${esc(cli.soc_codigo_empresa)}</span></div>
    <div class="cp-soc-linha"><div class="t">${resumo}</div>
      ${editavel && D.podeAcao('trazer_soc') ? btn(_ocupado === 'soc' ? 'Buscando no SOC…' : (s ? 'Atualizar' : 'Trazer do SOC'), 'campo:soc', { cls: s ? 'btn-outline btn-sm' : 'btn-navy btn-sm', travado: !!_ocupado || !D.online() }) : ''}</div>
    ${(s?.avisos || []).length ? nota(esc(s.avisos.join(' ')), 'warn') : ''}
    ${editavel && ghesSoc.length ? `<div style="margin-top:10px">${btn(`Usar ${ghesSoc.length === 1 ? 'o GHE' : 'os ' + ghesSoc.length + ' GHEs'} do SOC`, 'campo:soc-ghes', { cls: 'btn-outline btn-sm' })}
      <div class="cp-ajuda">Cria um GHE para cada GHE ativo do SOC, com setores, funções e os riscos já caracterizados lá. Você confere e completa na visita.</div></div>` : ''}
  </div>`;
}

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
  if (d.av.situacao === 'concluida') return telaConcluida(d, cli, tec);

  const editavel = D.podeEditar(d);
  const pend = D.pendencias(d);
  const pronta = !pend.length && d.ghes.length && d.ghes.every(g => D.gheCompleto(g) === 'ok');
  const sitTxt = d.av.situacao === 'cancelada' ? selo('cancelada')
    : pronta ? '<b style="color:var(--green-text)">Pronta para concluir</b>' : selo(d.av.situacao);

  return `${topo(d, cli)}
    ${d.av.situacao === 'cancelada' ? nota('Esta visita foi cancelada na agenda. Para retomar, reative o compromisso na Agenda da Equipe.', 'red') : ''}
    ${d.av.revisao > 1 ? nota(`Revisão ${d.av.revisao} da avaliação ${esc(d.av.numero || '')}. Ao concluir, ela substitui a anterior.`) : ''}
    <div class="cp-sec"><div class="cp-visita">
      <div>Data<b>${esc(dataBr(d.av.data_visita))}${d.av.hora_inicio ? ' · ' + esc(String(d.av.hora_inicio).slice(0, 5)) : ''}</b></div>
      <div>Técnico<b>${esc(tec?.nome || '')}</b></div>
      <div>Acompanhante<b>${esc(d.av.acompanhante_nome || 'a informar')}</b></div>
      <div>Situação<b>${sitTxt}</b></div></div></div>
    ${blocoSoc(d, cli, editavel)}
    ${secTit('GHEs desta empresa')}
    ${d.ghes.map(cartaoGhe).join('') || nota('Nenhum GHE ainda. Crie um GHE para cada grupo de trabalhadores com a mesma exposição (ex.: Administrativo, Produção, Serviços Gerais).')}
    ${editavel ? `<button type="button" class="cp-add-ghe" data-acao="campo:novo-ghe">${I.plus}Adicionar GHE</button>` : ''}
    ${pend.length ? `<div class="cp-sec"><div class="cp-sec-tit">Pendências para concluir <span class="dir" style="color:var(--text-3)">${pend.length} aberta${pend.length > 1 ? 's' : ''}</span></div>
      ${pend.map(({ ghe, risco }) => `<div class="cp-pend" data-acao="ir:campo-ghe:${_id}~${ghe.id}~${risco.uid}" style="cursor:pointer"><span class="cp-pend-ic">${I.relogio}</span>
        <div><div class="cp-pend-t">${esc(D.NOME_CATEGORIA[risco.categoria] || '')} ${esc(risco.codigo || '')} · ${esc(risco.nome)}</div>
        <div class="cp-pend-s">GHE ${esc(ghe.nome)} · ${esc(risco.pendente.texto || (D.MOTIVOS_PENDENCIA.find(m => m[0] === risco.pendente.motivo) || [, 'Para depois'])[1])}</div></div>
        <span class="badge ${risco.pendente.quem === 'empresa' ? 'badge-blue' : 'badge-gray'} cp-pend-quem">${risco.pendente.quem === 'empresa' ? 'Empresa' : 'Técnico'}</span></div>`).join('')}
      <div class="cp-ajuda">Pendências não travam a visita: você sai da empresa, resolve depois e volta para concluir.</div></div>` : ''}
    ${acoes([btn('Voltar', 'ir:campo', { papel: 'cp-a-voltar' }),
      d.av.situacao !== 'cancelada' ? btn('Finalizar avaliação', `ir:campo-finalizar:${_id}`, { cls: 'btn-amber', papel: 'cp-a-prox', travado: !d.ghes.length }) : ''])}`;
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
async function usarGhesDoSoc(d) {
  const cat = await D.catalogo();
  const usados = new Set(d.ghes.map(g => g.codigo_soc).filter(Boolean));
  let n = 0;
  for (const gs of d.av.soc?.ghes || []) {
    const chave = gs.codigo || gs.nome;
    if (usados.has(chave)) continue;
    const uniq = (xs) => [...new Set(xs.filter(Boolean))];
    const riscos = (gs.riscos || []).map(rs => {
      const c = cat.risco(rs.codigo);
      return {
        uid: D.novoId(), codigo: c ? c.codigo : (rs.codigo || null), nome: c ? c.nome : rs.nome,
        categoria: c ? c.categoria : (rs.grupo || 'outro'), nao_listado: !c, ambiente: 'Todos',
        analise: '', fonte: rs.fonte || '', epc: '', medidas_adm: '', exposicao: null, probabilidade: null, severidade: null, classificacao: null,
        epi: rs.epi_ca || '', epi_eficaz: rs.epi_eficaz === true ? 'S' : rs.epi_eficaz === false ? 'N' : null,
        medicao: null, iluminacao: null, ins: null, per: null, ae: null, grau: null, pendente: null,
        soc: { ins: !!rs.insalubridade, per: !!rs.periculosidade }
      };
    });
    D.novoGhe(d.id, { nome: gs.nome || ('GHE ' + gs.codigo), codigo_soc: chave,
      setores: uniq((gs.hierarquias || []).map(h => h.setor)), funcoes: uniq((gs.hierarquias || []).map(h => h.cargo)), riscos });
    n++;
  }
  return n;
}

export async function acao(nome, valor, redesenhar) {
  const d = D.doc(_id);
  if (!d) return false;
  if (nome === 'campo:novo-ghe') { modalNovoGhe(d, redesenhar); return true; }
  if (nome === 'campo:soc') {
    _ocupado = 'soc'; redesenhar();
    try {
      const s = await D.trazerDoSoc(_id);
      avisar(`SOC: ${(s.setores || []).length} setores, ${(s.cargos || []).length} cargos e ${(s.ghes || []).length} GHEs.`);
    } catch (e) { avisar(D.traduzirErro(e), 'erro'); }
    finally { _ocupado = ''; redesenhar(); }
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
