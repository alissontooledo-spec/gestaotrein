/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/campo/pdfgerar.js — monta os dados e gera o PDF da avaliação
   O PDF é feito no aparelho (jsPDF 2.5.1, o mesmo do app) e anexado UMA vez à
   avaliação concluída. O texto passa por um pdfSafe próprio: o do app tira
   acentos e corta em 400 letras, o que estragaria um laudo.
   ══════════════════════════════════════════════════════════════════════════ */

import * as D from './dados.js';
import * as sessao from '../../nucleo/sessao.js';
import { gerarPdfAvaliacao } from './pdf.js';
import * as P from './plano.js';

const WINANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');
export function pdfSafe(t) {
  return String(t ?? '')
    .normalize('NFC')
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—―−]/g, '-')
    .replace(/…/g, '...')
    .replace(/[•●◦▪▸►‣⁃]/g, '-')
    .replace(/[  -   ]/g, ' ')
    .replace(/[\r\t]/g, ' ')
    .replace(/[​-‍﻿]/g, '')
    .split('').filter(c => { const n = c.charCodeAt(0); return (n >= 32 && n <= 126) || n === 10 || (n >= 160 && n <= 255) || WINANSI_EXTRA.has(c); }).join('');
}

const nomeTreinamento = (t) => String(t?.nome || '').replace(/^NR\s?\d+\s*-\s*/i, '').trim();

export async function montarDados(d) {
  const ponte = window.__GRID_PONTE || {};
  const cat = await D.catalogo();
  const clis = await D.clientesPorId([d.av.cliente_id]);
  const usus = await D.usuariosPorId([d.av.tecnico_id]);
  const cli = clis[d.av.cliente_id] || {};
  const tec = usus[d.av.tecnico_id] || {};
  const treinamentos = {};
  for (const g of d.ghes) for (const c of g.treinamentos || []) {
    const t = cat.treinamento(c);
    treinamentos[c] = { nr: t?.categoria || '', nome: nomeTreinamento(t) || c };
  }
  /* v225: revisões (controle de revisões), matriz e textos padrão do engenheiro. */
  const revs = await D.revisoes(d.av.grupo_id).catch(() => []);
  const nomes = await D.usuariosPorId(revs.flatMap(r => [r.concluida_por, r.tecnico_id])).catch(() => ({}));
  const revisoes = (revs.length ? revs : [d.av]).filter(r => r.situacao !== 'cancelada' || r.id === d.av.id).map(r => ({
    revisao: r.revisao, data: r.concluida_em || (r.id === d.av.id ? d.av.concluida_em : null),
    motivo: r.revisao === 1 ? 'Emissão inicial' : (r.motivo_revisao || (r.id === d.av.id ? d.av.motivo_revisao : '') || 'Revisão (motivo não registrado)'),
    responsavel: nomes[r.concluida_por]?.nome || nomes[r.tecnico_id]?.nome || tec.nome || '' })).filter(r => r.revisao <= d.av.revisao);
  const assin = async (quem) => { const a = D.assinaturaDe(d, quem); return a.path ? D.dataUrlArquivo(a.path).catch(() => null) : null; };
  return {
    org: { nome: sessao.usuario()?.org || '' },
    avaliacao: d.av,
    cliente: {
      nome: cli.nome, cnpj: fmtCnpj(cli.cnpj),
      endereco: [cli.logradouro || cli.endereco, cli.numero, cli.bairro].filter(Boolean).join(', '),
      cidade: cli.cidade, uf: cli.uf
    },
    tecnico: { nome: tec.nome, formacao: tec.formacao, sigla_conselho: tec.sigla_conselho, conselho_classe: tec.conselho_classe, uf_registro: tec.uf_registro },
    ghes: d.ghes,
    fotos: d.fotos.filter(f => !f.documento).map(f => ({ ...f, carregar: () => D.dataUrlFoto(f) })),   // v225: foto de documento não sai
    fotosDocumento: d.fotos.filter(f => f.documento).length,
    matriz: cat.matriz,
    danos: (r) => P.danosDe(r, cat),
    baseLegal: (r) => P.baseLegalRisco(r, cat),
    normasDe: P.normasDe,
    revisoes,
    emitidoEm: new Date().toISOString(),
    assinaturas: { acomp: await assin('acomp'), tec: await assin('tec') },
    treinamentos
  };
}
function fmtCnpj(v) {
  const s = String(v || '').replace(/\D/g, '');
  return s.length === 14 ? `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5, 8)}/${s.slice(8, 12)}-${s.slice(12)}` : (v || '');
}

export async function gerarBlob(d, aoProgresso) {
  const ponte = window.__GRID_PONTE || {};
  if (ponte.garantirJsPDF) await ponte.garantirJsPDF();
  const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
  if (!jsPDF) throw new Error('O gerador de PDF não carregou. Confira a internet e tente de novo.');
  const dados = await montarDados(d);
  const saida = await gerarPdfAvaliacao(dados, { jsPDF, pdfSafe, aoProgresso });
  return saida instanceof Blob ? saida : new Blob([saida], { type: 'application/pdf' });
}

/* Gera, anexa à avaliação e devolve o blob (para baixar na hora). */
export async function gerarEAnexar(id, aoProgresso) {
  const d = D.doc(id) || await D.abrir(id);
  if (d.av.situacao !== 'concluida') throw new Error('O PDF oficial sai depois de a avaliação ser concluída.');
  const blob = await gerarBlob(d, aoProgresso);
  if (!d.av.pdf_path) await D.anexarPdf(id, blob);
  return blob;
}

export function baixarBlob(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
}
export const nomeArquivo = (d, cli) =>
  `Avaliacao-de-campo-${(d.av.numero || 'rascunho')}-rev${d.av.revisao}-${String(cli?.nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').slice(0, 40)}.pdf`;
