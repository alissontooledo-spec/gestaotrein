/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/campo/finalizar.js — fechamento da avaliação da empresa
   Acompanhante, observações, documentos, fotos gerais e assinaturas.
   A assinatura do acompanhante pode ser colhida na visita mesmo com
   pendência; a do técnico libera quando não falta mais nada. Concluir exige
   internet: o banco confere tudo, dá o número e trava. Em seguida o PDF é
   gerado no aparelho e anexado.
   ══════════════════════════════════════════════════════════════════════════ */

import * as D from './dados.js';
import { redesenhar as redesenharTela } from '../../nucleo/navegacao.js';
import { I, esc, nota, topo, inp, area, fotos, carregarFotos, legendarFoto, ligarTela, avisar, confirmar,
  btn, acoes, colherAssinatura, dataBr, quando, irPara } from './comum.js';
import { gerarEAnexar, baixarBlob, nomeArquivo } from './pdfgerar.js';

let _id = null, _ocupado = false, _progresso = '';

const chk = (texto, tipo, st, cor, acao) => `<div class="cp-check"${acao ? ` data-acao="${acao}" style="cursor:pointer"` : ''}><span class="ic ${tipo}">${tipo === 'ok' ? I.check : I.alerta}</span><span>${texto}</span><span class="st" style="color:${cor}">${st}</span></div>`;

function registroTec(t) {
  const reg = [t?.sigla_conselho, t?.conselho_classe].filter(Boolean).join(' ');
  return [t?.formacao, reg ? reg + (t?.uf_registro ? '/' + t.uf_registro : '') : ''].filter(Boolean).join(' · ');
}

export async function render(params) {
  _id = String(params?.id || '').split('~')[0];
  const d = await D.abrir(_id);
  if (d.av.situacao === 'concluida') { setTimeout(() => irPara(`campo-avaliacao:${_id}`), 0); return nota('Avaliação já concluída.'); }
  ligarTela({ digitar, foto });
  const [clis, usus] = await Promise.all([D.clientesPorId([d.av.cliente_id]), D.usuariosPorId([d.av.tecnico_id])]);
  const cli = clis[d.av.cliente_id], tec = usus[d.av.tecnico_id];
  const trav = !D.podeEditar(d);

  const semTec = D.faltas(d, { semAssinaturaTec: true }).filter(f => !f.assinatura);
  const todas = D.faltas(d);
  const linhasGhe = d.ghes.map(g => {
    const st = D.gheCompleto(g);
    const nPend = (g.riscos || []).filter(r => r.pendente).length;
    const nFazer = (g.riscos || []).filter(r => D.riscoCompleto(r) === 'fazer').length;
    const [t, c, cor] = st === 'ok' ? ['Completo', 'ok', 'var(--green-text)'] : nPend ? [`${nPend} para depois`, 'al', 'var(--warn-text)'] : [nFazer ? `${nFazer} a preencher` : 'A preencher', 'al', 'var(--warn-text)'];
    return chk(`GHE ${esc(g.nome)} · ${(g.riscos || []).length} riscos`, c, t, cor, `ir:campo-ghe:${_id}~${g.id}`);
  }).join('');
  const conclusoesFaltando = semTec.filter(f => /insalubridade|periculosidade|aposentadoria/.test(f.texto));
  const temRegistro = !!(tec?.sigla_conselho && tec?.conselho_classe);

  const aAcomp = D.assinaturaDe(d, 'acomp'), aTec = D.assinaturaDe(d, 'tec');
  const areaAssin = (quem, a, livre, textoLivre, textoTravado) => a.path
    ? `<div class="cp-assin-area feita ${trav ? '' : 'clicavel'}" data-cp-assin="${quem}" ${trav ? '' : `data-acao="campo:assinar:${quem}"`}><span style="font-size:11px;font-weight:500;color:var(--text-3)">${esc(quando(a.em))}${trav ? '' : ' · tocar para refazer'}</span></div>`
    : `<div class="cp-assin-area ${livre ? 'clicavel' : ''}" ${livre ? `data-acao="campo:assinar:${quem}"` : 'style="opacity:.6"'}>${I.pen}${livre ? textoLivre : textoTravado}</div>`;

  return `${topo(d, cli, { rotulo: 'Finalizar avaliação', sub: `${dataBr(d.av.data_visita)} · ${tec?.nome || ''}` })}
    <div class="cp-sec"><div class="cp-sec-tit">Situação</div>
      ${linhasGhe || chk('Nenhum GHE cadastrado', 'al', 'Falta', 'var(--warn-text)', `ir:campo-avaliacao:${_id}`)}
      ${chk('Registro profissional do técnico', temRegistro ? 'ok' : 'al', temRegistro ? esc(`${tec.sigla_conselho} ${tec.conselho_classe}${tec.uf_registro ? '/' + tec.uf_registro : ''}`) : 'Não cadastrado', temRegistro ? 'var(--green-text)' : 'var(--warn-text)')}
      ${!temRegistro ? nota('O registro (conselho e número) do técnico sai no documento. Peça ao administrador para preencher em Equipe.', 'warn') : ''}
      ${D.pendencias(d).length ? nota('Pode colher a assinatura do acompanhante agora. Você conclui a avaliação quando as pendências forem resolvidas.', 'warn') : ''}
      ${!D.pendencias(d).length && conclusoesFaltando.length ? nota(`Faltam conclusões (insalubridade, periculosidade ou aposentadoria especial) em ${conclusoesFaltando.length} risco${conclusoesFaltando.length > 1 ? 's' : ''}. Toque no GHE para completar.`, 'warn') : ''}
      ${semTec.length && !D.pendencias(d).length && !conclusoesFaltando.length ? `<div class="cp-ajuda" style="margin-top:8px">${semTec.slice(0, 6).map(f => esc(f.texto)).join('<br>')}</div>` : ''}</div>
    <div class="cp-sec"><div class="cp-sec-tit">Informações gerais da avaliação</div>
      <label class="cp-lbl">Acompanhante (nome e cargo)</label>
      <div class="cp-grid2">${inp('av.acompanhante_nome', d.av.acompanhante_nome, { ph: 'Nome de quem acompanhou', travado: trav })}${inp('av.acompanhante_cargo', d.av.acompanhante_cargo, { ph: 'Cargo', travado: trav })}</div>
      <label class="cp-lbl" style="margin-top:12px">Observações gerais</label>${area('av.observacoes', d.av.observacoes, { ph: 'O que vale para a empresa toda.', travado: trav })}
      <label class="cp-lbl" style="margin-top:12px">Documentos recebidos ou pedidos à empresa</label>${area('av.documentos', d.av.documentos, { ph: 'Ex.: FISPQ do desinfetante (pedida), PGR vigente (recebido)', travado: trav, alto: 60 })}</div>
    <div class="cp-sec"><div class="cp-sec-tit">Fotos gerais</div>
      ${fotos(d, f => f.alvo === 'geral', { chave: 'geral:', travado: trav })}</div>
    <div class="cp-sec"><div class="cp-sec-tit">Assinaturas</div><div class="cp-assins">
      <div class="cp-assin"><div class="cp-assin-quem">Acompanhante ${aAcomp.path ? '<span class="badge badge-green">Assinada</span>' : ''}</div>
        <div class="cp-assin-nome">${esc(d.av.acompanhante_nome || 'Nome a informar')}</div><div class="cp-assin-sub">${esc(d.av.acompanhante_cargo || 'Assina na visita, mesmo com pendência')}</div>
        ${areaAssin('acomp', aAcomp, !trav && !!d.av.acompanhante_nome, 'Tocar para assinar', 'Informe o nome do acompanhante acima')}</div>
      <div class="cp-assin"><div class="cp-assin-quem">Técnico responsável ${aTec.path ? '<span class="badge badge-green">Assinada</span>' : '<span class="badge badge-gray">Ao concluir</span>'}</div>
        <div class="cp-assin-nome">${esc(tec?.nome || '')}</div><div class="cp-assin-sub">${esc(registroTec(tec))}</div>
        ${areaAssin('tec', aTec, !trav && !semTec.length, 'Tocar para assinar', 'Libera quando não faltar mais nada')}</div></div></div>
    ${_progresso ? nota(esc(_progresso)) : ''}
    ${!D.online() ? nota('Sem internet agora. Tudo fica guardado neste aparelho; para concluir é preciso conexão.', 'warn') : ''}
    ${acoes([btn('Voltar', `ir:campo-avaliacao:${_id}`, { papel: 'cp-a-voltar' }),
      btn(_ocupado ? 'Concluindo…' : 'Concluir avaliação', 'campo:concluir', { cls: 'btn-amber', papel: 'cp-a-prox', travado: trav || _ocupado || todas.length > 0 || !D.online() })])}`;
}

export async function depois() {
  const d = D.doc(_id); if (!d) return;
  carregarFotos(d);
  for (const quem of ['acomp', 'tec']) {
    const a = D.assinaturaDe(d, quem); if (!a.path) continue;
    const url = await D.dataUrlArquivo(a.path).catch(() => null);
    if (!url) continue;
    document.querySelectorAll(`[data-cp-assin="${quem}"]`).forEach(el => { if (!el.querySelector('img')) el.insertAdjacentHTML('afterbegin', `<img src="${url}" alt="Assinatura">`); });
  }
}

const CAMPOS = { 'av.acompanhante_nome': 'acompanhante_nome', 'av.acompanhante_cargo': 'acompanhante_cargo', 'av.observacoes': 'observacoes', 'av.documentos': 'documentos' };
function digitar(chave, valor) {
  const c = CAMPOS[chave]; if (!c) return;
  const antes = !!D.doc(_id)?.av.acompanhante_nome;
  D.alterarAv(_id, { [c]: valor });
  /* O nome do acompanhante libera a área de assinatura dele. */
  if (c === 'acompanhante_nome' && antes !== !!valor.trim()) {
    clearTimeout(digitar._t); digitar._t = setTimeout(() => redesenharTela(), 600);
  }
}
async function foto(chave, arquivos) {
  for (const f of arquivos) await D.adicionarFoto(_id, { ghe_id: null, alvo: 'geral', alvo_uid: null }, f);
  avisar(arquivos.length > 1 ? `${arquivos.length} fotos guardadas.` : 'Foto guardada.');
  redesenharTela();
}

export async function acao(nome, valor, redesenhar) {
  const d = D.doc(_id); if (!d) return false;
  if (nome === 'campo:assinar') {
    const quem = valor === 'tec' ? 'tec' : 'acomp';
    const [usus] = await Promise.all([D.usuariosPorId([d.av.tecnico_id])]);
    const tec = usus[d.av.tecnico_id];
    colherAssinatura(quem === 'tec'
      ? { titulo: 'Assinatura do técnico', nome: tec?.nome, sub: registroTec(tec) }
      : { titulo: 'Assinatura do acompanhante', nome: d.av.acompanhante_nome, sub: d.av.acompanhante_cargo },
      async (blob) => { await D.guardarAssinatura(_id, quem, blob); avisar('Assinatura guardada.'); redesenharTela(); });
    return true;
  }
  if (nome === 'campo:concluir') {
    if (!await confirmar('Concluir a avaliação? Depois de concluída ela não pode mais ser alterada (mudança vira nova revisão). O PDF será gerado em seguida.')) return true;
    _ocupado = true; _progresso = 'Enviando e conferindo a avaliação…'; redesenhar();
    try {
      await D.concluir(_id);
    } catch (e) {
      _ocupado = false; _progresso = ''; redesenhar();
      avisar(D.traduzirErro(e), 'erro');
      return true;
    }
    try {
      _progresso = 'Gerando o PDF…'; redesenhar();
      const clis = await D.clientesPorId([d.av.cliente_id]);
      const blob = await gerarEAnexar(_id, ({ etapa, atual, total }) => {
        _progresso = total ? `Gerando o PDF: ${etapa} (${atual} de ${total})` : `Gerando o PDF: ${etapa}`;
      });
      baixarBlob(blob, nomeArquivo(D.doc(_id), clis[d.av.cliente_id]));
      avisar('Avaliação concluída e PDF anexado.');
    } catch (e) {
      avisar('Avaliação concluída, mas o PDF não foi gerado: ' + D.traduzirErro(e) + ' Gere de novo na tela da avaliação.', 'erro');
    } finally {
      _ocupado = false; _progresso = '';
      irPara(`campo-avaliacao:${_id}`);
    }
    return true;
  }
  if (nome === 'campo:foto-apagar') { if (await confirmar('Apagar esta foto?')) { D.apagarFoto(_id, valor); redesenhar(); } return true; }
  if (nome === 'campo:foto-legenda') { if (D.podeEditar(d)) legendarFoto(d, valor, redesenhar); return true; }
  return false;
}
