/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/campo/laudomiro-docs.js — baixar em Word e PDF (v281)
   Ordem de serviço, roteiro do DDS, linha do plano de ação e memória de cálculo
   do ruído. Tudo é montado no aparelho: o texto não sai do GRID.
   Word: .docx de verdade (OOXML mínimo num ZIP sem compressão), abre no Word,
   no Google Docs e no LibreOffice. Nas respostas (DDS, linha do plano) os campos
   entre colchetes saem em amarelo; nos documentos de campo (v295) viram linha em branco.
   PDF: jsPDF 2.5.1 (o mesmo do app), A4, Helvetica.
   ══════════════════════════════════════════════════════════════════════════ */

import { pdfSafe, baixarBlob } from './pdfgerar.js';

/* ── Texto → blocos ─────────────────────────────────────────────────────── */
/** Linhas em MAIÚSCULAS viram título, "- x" vira item de lista, o resto é parágrafo. */
export function blocos(texto) {
  const out = [];
  String(texto || '').replace(/\r/g, '').split('\n').forEach((l) => {
    const t = l.trim();
    if (!t) { out.push({ tipo: 'espaco' }); return; }
    if (t.length > 3 && /\p{Lu}/u.test(t) && t === t.toUpperCase() && !/^\[/.test(t)) { out.push({ tipo: 'h', texto: t.replace(/:$/, '') }); return; }
    const li = t.match(/^(?:[-•*]|\d+[.)])\s+(.*)$/);
    if (li) { out.push({ tipo: 'li', texto: li[1], num: /^\d/.test(t) ? t.match(/^\d+/)[0] : null }); return; }
    out.push({ tipo: 'p', texto: t });
  });
  // sem espaço duplicado, nem no começo, nem no fim
  return out.filter((b, i, a) => b.tipo !== 'espaco' || (i > 0 && i < a.length - 1 && a[i - 1].tipo !== 'espaco'));
}

const hoje = () => new Date().toLocaleDateString('pt-BR');
export const nomeArquivo = (titulo, ext) => `${String(titulo || 'documento').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50)}-${hoje().replace(/\//g, '-')}.${ext}`;

/* ── ZIP sem compressão (para o .docx) ─────────────────────────────────── */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zip(arquivos) {
  const enc = new TextEncoder(), partes = [], central = [];
  let pos = 0;
  const u16 = (v) => [v & 255, (v >>> 8) & 255], u32 = (v) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
  for (const [nome, conteudo] of arquivos) {
    const n = enc.encode(nome), d = conteudo instanceof Uint8Array ? conteudo : enc.encode(conteudo), c = crc32(d);
    const cab = [...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(c), ...u32(d.length), ...u32(d.length), ...u16(n.length), ...u16(0)];
    partes.push(new Uint8Array(cab), n, d);
    central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(c), ...u32(d.length), ...u32(d.length), ...u16(n.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(pos)]), n);
    pos += cab.length + n.length + d.length;
  }
  const tamCentral = central.reduce((s, x) => s + x.length, 0);
  const fim = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(arquivos.length), ...u16(arquivos.length), ...u32(tamCentral), ...u32(pos), ...u16(0)]);
  return new Blob([...partes, ...central, fim], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

/* ── Word ───────────────────────────────────────────────────────────────── */
const xml = (s) => String(s ?? '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFE\uFFFF]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Texto com [campos] em amarelo. */
function runs(texto, { negrito = false, tam = 22, cor = '1F2A3D' } = {}) {
  const rPr = (extra = '') => `<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>${negrito ? '<w:b/>' : ''}<w:color w:val="${cor}"/><w:sz w:val="${tam}"/>${extra}</w:rPr>`;
  return String(texto).split(/(\[[^\]]{1,80}\])/).filter(Boolean).map((p) =>
    `<w:r>${rPr(/^\[.*\]$/.test(p) ? '<w:highlight w:val="yellow"/>' : '')}<w:t xml:space="preserve">${xml(p)}</w:t></w:r>`).join('');
}
const par = (conteudo, { antes = 0, depois = 120, recuo = 0, alinhar = '' } = {}) =>
  `<w:p><w:pPr><w:spacing w:before="${antes}" w:after="${depois}" w:line="300" w:lineRule="auto"/>${recuo ? `<w:ind w:left="${recuo}" w:hanging="240"/>` : ''}${alinhar ? `<w:jc w:val="${alinhar}"/>` : ''}</w:pPr>${conteudo}</w:p>`;

export function docxBlob({ titulo, subtitulo = '', texto, nota = '' }) {
  const corpo = [
    par(runs(titulo, { negrito: true, tam: 32, cor: '172541' }), { depois: 60 }),
    subtitulo ? par(runs(subtitulo, { tam: 20, cor: '64748B' }), { depois: 240 }) : '',
    ...blocos(texto).map((b) => b.tipo === 'h' ? par(runs(b.texto, { negrito: true, tam: 22, cor: '172541' }), { antes: 200, depois: 80 })
      : b.tipo === 'li' ? par(runs(`${b.num ? b.num + '.' : '•'} ${b.texto}`), { depois: 60, recuo: 360 })
        : b.tipo === 'espaco' ? par('', { depois: 0 })
          : par(runs(b.texto))),
    nota ? par(runs(nota, { tam: 17, cor: '64748B' }), { antes: 360 }) : '',
  ].join('');
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${corpo}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  return zip([
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'],
    ['word/document.xml', doc],
  ]);
}

/* ── PDF ────────────────────────────────────────────────────────────────── */
export async function pdfBlob({ titulo, subtitulo = '', texto, nota = '' }) {
  const ponte = window.__GRID_PONTE || {};
  if (ponte.garantirJsPDF) await ponte.garantirJsPDF();
  const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
  if (!jsPDF) throw new Error('O gerador de PDF não carregou. Confira a internet e tente de novo.');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  const M = 20, L = 210 - 2 * M, FIM = 297 - 22;
  let y = 24;
  const cor = (hex) => doc.setTextColor(parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16));
  const pagina = (h) => { if (y + h > FIM) { doc.addPage(); y = 22; } };
  const escrever = (t, { tam = 10.5, negrito = false, hex = '1F2A3D', recuo = 0, alt = 5.2, marcador = '' } = {}) => {
    doc.setFont('helvetica', negrito ? 'bold' : 'normal'); doc.setFontSize(tam); cor(hex);
    const linhas = doc.splitTextToSize(pdfSafe(t), L - recuo);
    linhas.forEach((ln, k) => {
      pagina(alt);
      if (k === 0 && marcador) doc.text(pdfSafe(marcador), M + recuo - 4.5, y);
      doc.text(ln, M + recuo, y); y += alt;
    });
  };
  escrever(titulo, { tam: 16, negrito: true, hex: '172541', alt: 7 });
  if (subtitulo) { y += 0.5; escrever(subtitulo, { tam: 9.5, hex: '64748B', alt: 4.6 }); }
  y += 3; doc.setDrawColor(245, 158, 11); doc.setLineWidth(0.6); doc.line(M, y, M + 18, y); y += 7;
  blocos(texto).forEach((b) => {
    if (b.tipo === 'espaco') { y += 2.5; return; }
    if (b.tipo === 'h') { pagina(12); y += 2; escrever(b.texto, { tam: 10.5, negrito: true, hex: '172541' }); y += 1; return; }
    if (b.tipo === 'li') { escrever(b.texto, { recuo: 5, marcador: b.num ? `${b.num}.` : '-' }); y += 0.8; return; }
    escrever(b.texto); y += 1.2;
  });
  if (nota) { y += 5; escrever(nota, { tam: 8.5, hex: '64748B', alt: 4.2 }); }
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); cor('8A94A6');
    doc.text(pdfSafe(`GRID, Laudomiro. Gerado em ${hoje()}.`), M, 297 - 12);
    doc.text(pdfSafe(`Página ${i} de ${total}`), 210 - M, 297 - 12, { align: 'right' });
  }
  return doc.output('blob');
}

export async function baixar(formato, dados) {
  const blob = formato === 'pdf' ? await pdfBlob(dados) : docxBlob(dados);
  baixarBlob(blob, nomeArquivo(dados.titulo, formato === 'pdf' ? 'pdf' : 'docx'));
}

/* ══════════════════════════════════════════════════════════════════════════
   v295: documentos de campo em formulário (OS, ficha de EPI, PT, APR, checklist,
   procedimento). Proposta aprovada em 04/11/2026:
   08-Propostas-visuais/grid-proposta-documentos-padrao-v2.html.
   · Cabeçalho padrão: empresa | título e norma | Nº, revisão, data, páginas.
   · Nada em amarelo: [preencher] vira linha em branco para escrever à mão
     (em célula de tabela, a célula fica vazia).
   · "[ ]" vira caixinha de marcar. Pensado para imprimir em preto e branco.
   · Um arquivo pode ter vários documentos (um por pessoa). Cada um começa em
     página nova e conta as próprias páginas ("Pág. 1/2" da folha da pessoa).
   Partes de cada documento:
     { t:'cab', esq, titulo, norma, ctl:[4 textos] }   (o 4º é trocado por "Pág. 1 de N")
     { t:'faixa', itens:[[rótulo, valor]] }   { t:'grade', cols:4, itens:[{ r, v, span }] }
     { t:'h', x }  { t:'p', x }  { t:'li', x }  { t:'nota', x }  { t:'decl', x }
     { t:'tabela', cols:[{ t, w, centro }], linhas:[[texto | { x, neg }]], vazias, alt }
     { t:'assin', blocos:[{ titulo, linhas:[...] }] }   { t:'rod', x }  (rodapé deste documento)
   ══════════════════════════════════════════════════════════════════════════ */
export const RODAPE_GRID = () => `Gerado com apoio do GRID em ${hoje()}. Conferência e responsabilidade de quem assina.`;
const RODAPE_CURTO = () => `Gerado com apoio do GRID em ${hoje()}`;
const CAMPO = /\[(?! \])[^\]]{1,80}\]/g;            // [preencher], [preencher com ...]
const LINHA = '_______________';
/** Texto corrido: campo para preencher vira linha. */
const emLinha = (t) => String(t ?? '').replace(CAMPO, LINHA);
/** Célula: campo para preencher fica vazio. */
const emCelula = (t) => String(t ?? '').replace(CAMPO, '').replace(/\s{2,}/g, ' ').trim();
const celTxt = (c) => (c && typeof c === 'object' ? c.x : c) ?? '';
const celNeg = (c) => !!(c && typeof c === 'object' && c.neg);
/** Quantos campos [preencher] o documento deixa para escrever à mão (para a tela de conferência). */
export function camposAMao(partes) {
  let n = 0;
  const conta = (t) => { n += (String(t ?? '').match(CAMPO) || []).length; };
  (partes || []).forEach((b) => {
    if (b.t === 'grade') b.itens.forEach((i) => { if (!String(i.v ?? '').trim() || CAMPO.test(String(i.v))) n++; CAMPO.lastIndex = 0; });
    else if (b.t === 'faixa') b.itens.forEach(([, v]) => conta(v));
    else if (b.t === 'p' || b.t === 'li') conta(b.x);
  });
  return n;
}

/* ── Word ───────────────────────────────────────────────────────────────── */
const FONTE = '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>';
function runsF(texto, { neg = false, tam = 18, cor = '000000', sub = false } = {}) {
  const rPr = (simb) => `<w:rPr>${simb ? '<w:rFonts w:ascii="Segoe UI Symbol" w:hAnsi="Segoe UI Symbol"/>' : FONTE}${neg ? '<w:b/>' : ''}${sub ? '<w:u w:val="single"/>' : ''}<w:color w:val="${cor}"/><w:sz w:val="${tam}"/></w:rPr>`;
  return String(texto).split(/(\[ \])/).filter((p) => p !== '').map((p) => p === '[ ]'
    ? `<w:r>${rPr(true)}<w:t xml:space="preserve">☐</w:t></w:r>`
    : `<w:r>${rPr(false)}<w:t xml:space="preserve">${xml(p)}</w:t></w:r>`).join('');
}
const parF = (conteudo, { antes = 0, depois = 60, alinhar = '', recuo = 0, linha = 240 } = {}) =>
  `<w:p><w:pPr><w:spacing w:before="${antes}" w:after="${depois}" w:line="${linha}" w:lineRule="auto"/>${recuo ? `<w:ind w:left="${recuo}" w:hanging="200"/>` : ''}${alinhar ? `<w:jc w:val="${alinhar}"/>` : ''}</w:pPr>${conteudo}</w:p>`;
const campoW = (instr) => `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ${instr} </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:rPr>${FONTE}<w:sz w:val="17"/></w:rPr><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>`;
const bordasW = (cor = '000000', sz = 6) => `<w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((b) => `<w:${b} w:val="single" w:sz="${sz}" w:space="0" w:color="${cor}"/>`).join('')}</w:tblBorders>`;
const tcW = (w, conteudo, { fundo = '', span = 1, vAlign = '' } = {}) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${span > 1 ? `<w:gridSpan w:val="${span}"/>` : ''}${fundo ? `<w:shd w:val="clear" w:color="auto" w:fill="${fundo}"/>` : ''}${vAlign ? `<w:vAlign w:val="${vAlign}"/>` : ''}</w:tcPr>${conteudo}</w:tc>`;
const tblW = (ws, linhas, { bordas = bordasW() } = {}) => `<w:tbl><w:tblPr><w:tblW w:w="${LARG}" w:type="dxa"/>${bordas}<w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${ws.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${linhas.join('')}</w:tbl>`;
const LARG = 10204;   // A4 com margens de 850 twips (1,5 cm)

let _totalW = 'SECTIONPAGES';   // um documento só: NUMPAGES (o LibreOffice não conta SECTIONPAGES)
const _qrW = [];   // imagens do QR deste arquivo: { rid, bytes }
const bytesDeDataUrl = (u) => { const b = atob(String(u).split(',')[1] || ''); const a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; };
function imagemW(rid, n, mm) {
  const e = Math.round(mm * 36000);
  return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${e}" cy="${e}"/><wp:docPr id="${n}" name="QR ${n}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${n}" name="qr${n}.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${e}" cy="${e}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}
function cabW(b) {
  if (b.qr?.png) {   // v296: 4ª coluna com o QR de autenticidade
    const n = _qrW.length + 1, rid = `rIdQ${n}`;
    _qrW.push({ rid, bytes: bytesDeDataUrl(b.qr.png) });
    const ws = [1900, LARG - 1900 - 2100 - 1300, 2100, 1300];
    const ctl = (b.ctl || []).slice(0, 3).map((x) => parF(runsF(emLinha(x), { tam: 16 }), { depois: 20 })).join('')
      + parF(`${runsF('Pág. 1 de ', { tam: 16 })}${campoW(_totalW)}`, { depois: 0 });
    return tblW(ws, [`<w:tr>${tcW(ws[0], parF(runsF(b.esq || '', { neg: true, tam: 20 }), { alinhar: 'center', depois: 0 }), { vAlign: 'center' })}${tcW(ws[1], parF(runsF(b.titulo, { neg: true, tam: 24 }), { alinhar: 'center', depois: 20 }) + (b.norma ? parF(runsF(b.norma, { tam: 16 }), { alinhar: 'center', depois: 0 }) : ''), { vAlign: 'center' })}${tcW(ws[2], ctl)}${tcW(ws[3], parF(imagemW(rid, n, 17), { alinhar: 'center', depois: 0 }) + parF(runsF(`Validar: ${b.qr.codigo}`, { tam: 12 }), { alinhar: 'center', depois: 0 }), { vAlign: 'center' })}</w:tr>`]);
  }
  const ws = [2100, LARG - 2100 - 2300, 2300];
  const ctl = (b.ctl || []).slice(0, 3).map((x) => parF(runsF(emLinha(x), { tam: 16 }), { depois: 20 })).join('')
    + parF(`${runsF('Pág. 1 de ', { tam: 16 })}${campoW(_totalW)}`, { depois: 0 });
  return tblW(ws, [`<w:tr>${tcW(ws[0], parF(runsF(b.esq || '', { neg: true, tam: 20 }), { alinhar: 'center', depois: 0 }), { vAlign: 'center' })}${tcW(ws[1], parF(runsF(b.titulo, { neg: true, tam: 24 }), { alinhar: 'center', depois: 20 }) + (b.norma ? parF(runsF(b.norma, { tam: 16 }), { alinhar: 'center', depois: 0 }) : ''), { vAlign: 'center' })}${tcW(ws[2], ctl)}</w:tr>`]);
}
function faixaW(b) { return tblW([LARG], [`<w:tr>${tcW(LARG, parF(b.itens.map(([r, v]) => `${runsF(`${r}: `, { neg: true, tam: 17 })}${runsF(`${emLinha(v)}     `, { tam: 17 })}`).join(''), { depois: 0 }))}</w:tr>`]); }
function gradeW(b) {
  const n = b.cols || 4, w1 = Math.floor(LARG / n), linhas = [];
  let atual = [], usado = 0;
  b.itens.forEach((i) => {
    const sp = Math.min(n, i.span || 1);
    if (usado + sp > n) { linhas.push(atual); atual = []; usado = 0; }
    atual.push(tcW(w1 * sp, parF(runsF(String(i.r).toUpperCase(), { tam: 13, cor: '444444' }), { depois: 0 }) + parF(runsF(emCelula(i.v) || ' ', { tam: 18 }), { depois: 0 }), { span: sp }));
    usado += sp;
  });
  if (atual.length) linhas.push(atual);
  return tblW(Array(n).fill(w1), linhas.map((l) => `<w:tr><w:trPr><w:trHeight w:val="520"/></w:trPr>${l.join('')}</w:tr>`));
}
function tabelaW(b) {
  const ws = b.cols.map((c) => Math.round(c.w * LARG));
  const alt = Math.round((b.alt || 6.4) * 56.7);
  const cel = (c, i, cab) => tcW(ws[i], parF(runsF(cab ? c : emCelula(celTxt(c)) || ' ', { neg: cab || celNeg(c), sub: celNeg(c) && /VENCID/.test(celTxt(c)), tam: cab ? 15 : 16 }), { depois: 0, alinhar: b.cols[i].centro ? 'center' : '' }), { fundo: cab ? 'EFEFEF' : '', vAlign: 'center' });
  const todas = [...b.linhas, ...Array.from({ length: b.vazias || 0 }, () => b.cols.map(() => ''))];
  return tblW(ws, [`<w:tr><w:trPr><w:tblHeader/></w:trPr>${b.cols.map((c, i) => cel(c.t, i, true)).join('')}</w:tr>`,
    ...todas.map((l) => `<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="${alt}"/></w:trPr>${l.map((c, i) => cel(c, i, false)).join('')}</w:tr>`)]);
}
function hW(x) {
  return `<w:p><w:pPr><w:spacing w:before="160" w:after="60"/><w:pBdr><w:left w:val="single" w:sz="24" w:space="4" w:color="000000"/></w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="E8E8E8"/></w:pPr>${runsF(String(x).toUpperCase(), { neg: true, tam: 17 })}</w:p>`;
}
function assinW(b) {
  const n = b.blocos.length, gap = 400, w = Math.floor((LARG - gap * (n - 1)) / n), ws = [];
  b.blocos.forEach((_, i) => { if (i) ws.push(gap); ws.push(w); });
  const cel = (bl) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/><w:tcBorders><w:top w:val="single" w:sz="8" w:space="0" w:color="000000"/></w:tcBorders></w:tcPr>${parF(runsF(bl.titulo, { neg: true, tam: 17 }), { depois: 20 })}${(bl.linhas || []).map((l) => parF(runsF(emLinha(l), { tam: 16 }), { depois: 20 })).join('')}${parF(runsF('Assinatura', { tam: 15, cor: '444444' }), { antes: 200, depois: 0 })}</w:tc>`;
  const vazio = `<w:tc><w:tcPr><w:tcW w:w="${gap}" w:type="dxa"/></w:tcPr>${parF('', { depois: 0 })}</w:tc>`;
  return parF('', { antes: 480, depois: 0 }) + `<w:tbl><w:tblPr><w:tblW w:w="${LARG}" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${ws.map((x) => `<w:gridCol w:w="${x}"/>`).join('')}</w:tblGrid><w:tr>${b.blocos.map(cel).join(vazio)}</w:tr></w:tbl>`;
}
function footerW(rod) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:pBdr><w:top w:val="single" w:sz="6" w:space="2" w:color="000000"/></w:pBdr><w:tabs><w:tab w:val="right" w:pos="${LARG}"/></w:tabs><w:spacing w:after="0"/></w:pPr>${runsF(String(rod || '').slice(0, 70), { tam: 14 })}<w:r><w:tab/></w:r>${runsF(`${RODAPE_CURTO()}   ·   `, { tam: 13, cor: '555555' })}${runsF('Pág. ', { tam: 14 })}${campoW('PAGE')}${runsF('/', { tam: 14 })}${campoW(_totalW)}</w:p></w:ftr>`;
}
export function docxPartes(documentos) {
  const footers = [];
  _qrW.length = 0;
  _totalW = documentos.length > 1 ? 'SECTIONPAGES' : 'NUMPAGES';
  const corpo = documentos.map((partes, di) => {
    const rod = partes.find((b) => b.t === 'rod')?.x || '';
    footers.push(footerW(rod));
    const miolo = partes.map((b) => {
      if (b.t === 'cab') return cabW(b);
      if (b.t === 'faixa') return faixaW(b);
      if (b.t === 'grade') return parF('', { depois: 0, linha: 120 }) + gradeW(b);
      if (b.t === 'h') return hW(b.x);
      if (b.t === 'li') return parF(runsF(`•  ${emLinha(b.x)}`, { tam: 18 }), { depois: 20, recuo: 300 });
      if (b.t === 'tabela') return tabelaW(b) + parF('', { depois: 0, linha: 120 });
      if (b.t === 'decl') return tblW([LARG], [`<w:tr>${tcW(LARG, parF(runsF(emLinha(b.x), { tam: 18 }), { depois: 0 }))}</w:tr>`]);
      if (b.t === 'assin') return assinW(b);
      if (b.t === 'nota') return parF(runsF(emLinha(b.x), { tam: 15, cor: '444444' }), { antes: 60, depois: 40 });
      if (b.t === 'rod') return '';
      if (b.t === 'titulo') return parF(runsF(b.x, { neg: true, tam: 26 }), { depois: 40 }) + (b.sub ? parF(runsF(b.sub, { tam: 17 }), { depois: 120 }) : '');
      return parF(runsF(emLinha(b.x || ''), { tam: 18 }), { depois: 40 });
    }).join('');
    const sect = `<w:sectPr><w:footerReference w:type="default" r:id="rIdF${di + 1}"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="850" w:right="850" w:bottom="850" w:left="850" w:header="400" w:footer="400" w:gutter="0"/><w:pgNumType w:start="1"/></w:sectPr>`;
    return di < documentos.length - 1 ? `${miolo}<w:p><w:pPr>${sect}</w:pPr></w:p>` : `${miolo}${sect}`;
  }).join('');
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${corpo}</w:body></w:document>`;
  return zip([
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>${footers.map((_, i) => `<Override PartName="/word/footer${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>`).join('')}</Types>`],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'],
    ['word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${footers.map((_, i) => `<Relationship Id="rIdF${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer${i + 1}.xml"/>`).join('')}${_qrW.map((q, i) => `<Relationship Id="${q.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/qr${i + 1}.png"/>`).join('')}</Relationships>`],
    ['word/document.xml', doc],
    ...footers.map((f, i) => [`word/footer${i + 1}.xml`, f]),
    ..._qrW.map((q, i) => [`word/media/qr${i + 1}.png`, q.bytes]),
  ]);
}

/* ── PDF ────────────────────────────────────────────────────────────────── */
export async function pdfPartes(documentos) {
  const ponte = window.__GRID_PONTE || {};
  if (ponte.garantirJsPDF) await ponte.garantirJsPDF();
  if (!documentos?.length) throw new Error('Não há documento para gerar. Escolha a função ou a pessoa.');
  const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
  if (!jsPDF) throw new Error('O gerador de PDF não carregou. Confira a internet e tente de novo.');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  const M = 14, L = 210 - 2 * M, FIM = 297 - 17, PRETO = () => { doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.25); };
  let y = M, repetir = null, docAtual = null;
  const fonte = (tam, neg = false, cinza = false) => { doc.setFont('helvetica', neg ? 'bold' : 'normal'); doc.setFontSize(tam); doc.setTextColor(cinza ? 68 : 0, cinza ? 68 : 0, cinza ? 68 : 0); };
  const S = (t) => pdfSafe(t);
  const continua = () => {   // página nova dentro do mesmo documento
    doc.addPage(); y = M;
    if (docAtual?.titulo) { fonte(7.5, true, true); doc.text(S(`${docAtual.titulo} · continuação`), M, y + 3); PRETO(); doc.line(M, y + 4.6, M + L, y + 4.6); y += 8; }
    repetir?.();
  };
  const cabe = (h) => { if (y + h > FIM) continua(); };
  /* uma linha com caixinhas "[ ]" desenhadas */
  const linhaCx = (ln, x, yy) => {
    let cx = x;
    String(ln).split(/(\[ \])/).filter((p) => p !== '').forEach((p) => {
      if (p === '[ ]') { const s = doc.getFontSize() * 0.3; PRETO(); doc.rect(cx + 0.3, yy - s, s, s, 'S'); cx += s + 1.4; return; }
      doc.text(p, cx, yy); cx += doc.getTextWidth(p);
    });
  };
  // y é sempre o TOPO do que vem a seguir: a linha de base fica uma altura de letra abaixo
  const escrever = (t, { tam = 9, neg = false, cinza = false, recuo = 0, alt = 4.3, marcador = '', largura = L } = {}) => {
    fonte(tam, neg, cinza);
    const asc = tam * 0.3528 * 0.78;
    doc.splitTextToSize(S(emLinha(t)), largura - recuo).forEach((ln, k) => {
      if (y + asc + 1 > FIM) continua();
      const base = y + asc;
      if (k === 0 && marcador) doc.text(marcador, M + recuo - 3.5, base);
      linhaCx(ln, M + recuo, base); y += alt;
    });
    y += Math.max(0, alt * 0.12);
  };
  const caixa = (x, yy, w, h, fundo) => { PRETO(); if (fundo) { doc.setFillColor(fundo, fundo, fundo); doc.rect(x, yy, w, h, 'FD'); } else doc.rect(x, yy, w, h, 'S'); };
  const pagsCab = [];   // onde escrever "Pág. 1 de N" quando o documento terminar
  const cab = (b) => {
    const wq = b.qr?.png ? 24 : 0;   // v296: 4ª coluna com o QR de autenticidade
    const w1 = 40, w3 = 44, w2 = L - w1 - w3 - wq, h = 23, x2 = M + w1, x3 = x2 + w2;
    caixa(M, y, w1, h); caixa(x2, y, w2, h); caixa(x3, y, w3, h);
    if (wq) {
      const x4 = x3 + w3; caixa(x4, y, wq, h);
      try { doc.addImage(b.qr.png, 'PNG', x4 + (wq - 16.5) / 2, y + 1.6, 16.5, 16.5); } catch { /* sem a imagem, fica o código */ }
      fonte(6.2); doc.text(S(`Validar: ${b.qr.codigo}`), x4 + wq / 2, y + h - 1.8, { align: 'center' });
    }
    fonte(9.5, true); const le = doc.splitTextToSize(S(b.esq || ''), w1 - 4).slice(0, 4);
    le.forEach((l, i) => doc.text(l, M + w1 / 2, y + h / 2 - (le.length - 1) * 2 + i * 4 + 1, { align: 'center' }));
    fonte(11.5, true); const lt = doc.splitTextToSize(S(b.titulo), w2 - 6).slice(0, 3);
    const yt = y + h / 2 - (lt.length - 1) * 2.4 - (b.norma ? 1.6 : -1);
    lt.forEach((l, i) => doc.text(l, x2 + w2 / 2, yt + i * 4.8, { align: 'center' }));
    if (b.norma) { fonte(7.8); doc.text(S(b.norma), x2 + w2 / 2, yt + lt.length * 4.8 + 0.6, { align: 'center' }); }
    const ctl = [...(b.ctl || []).slice(0, 3), 'Pág. 1 de 1'];
    ctl.forEach((c, i) => { const yy = y + i * (h / 4); if (i) { PRETO(); doc.line(x3, yy, x3 + w3, yy); } fonte(8); doc.text(S(String(c).replace(CAMPO, '__________')), x3 + 2, yy + h / 8 + 1.3); });
    pagsCab.push({ pag: doc.getNumberOfPages(), x: x3 + 2, y: y + 3 * (h / 4) + h / 8 + 1.3, w: w3 - 3, doc: docAtual });
    y += h;
  };
  const faixa = (b) => {
    const pos = []; let cx = M + 2, lin = 0;
    b.itens.forEach(([r, v]) => {
      fonte(8.4, true); const lr = S(`${r}: `), wr = doc.getTextWidth(lr);
      fonte(8.4); let lv = S(emLinha(v)); const max = L - 4 - wr;
      if (doc.getTextWidth(lv) > max) lv = doc.splitTextToSize(lv, max)[0];
      const w = wr + doc.getTextWidth(lv);
      if (cx > M + 2 && cx + w > M + L - 2) { lin++; cx = M + 2; }
      pos.push({ lr, lv, x: cx, wr, lin }); cx += w + 7;
    });
    const h = (lin + 1) * 3.9 + 2.6;
    caixa(M, y, L, h);
    pos.forEach((q) => { const yy = y + 4 + q.lin * 3.9; fonte(8.4, true); doc.text(q.lr, q.x, yy); fonte(8.4); doc.text(q.lv, q.x + q.wr, yy); });
    y += h;
  };
  const grade = (b) => {
    const n = b.cols || 4, w1 = L / n, linhas = []; let atual = [], usado = 0;
    b.itens.forEach((i) => { const sp = Math.min(n, i.span || 1); if (usado + sp > n) { linhas.push(atual); atual = []; usado = 0; } atual.push({ ...i, sp, x: usado }); usado += sp; });
    if (atual.length) linhas.push(atual);
    y += 2.5;
    linhas.forEach((ln) => {
      fonte(9); const alturas = ln.map((c) => doc.splitTextToSize(S(emCelula(c.v)), c.sp * w1 - 4).length);
      const h = Math.max(9.6, 6.2 + Math.max(...alturas) * 3.9);
      cabe(h);
      ln.forEach((c) => {
        const x = M + c.x * w1, w = c.sp * w1; caixa(x, y, w, h);
        fonte(6.4, false, true); doc.text(S(String(c.r).toUpperCase()), x + 1.8, y + 3.2);
        fonte(9); doc.splitTextToSize(S(emCelula(c.v)), w - 4).forEach((l, k) => linhaCx(l, x + 1.8, y + 7.3 + k * 3.9));
      });
      y += h;
    });
  };
  const h = (x, junto = 0) => {
    cabe(15 + junto); y += 2.6;
    doc.setFillColor(232, 232, 232); doc.rect(M, y, L, 5.6, 'F'); doc.setFillColor(0, 0, 0); doc.rect(M, y, 1.3, 5.6, 'F');
    fonte(8.1, true); doc.text(S(String(x).toUpperCase()), M + 3.6, y + 3.95); y += 6.8;
  };
  const tabela = (b) => {
    const ws = b.cols.map((c) => c.w * L), xs = []; ws.reduce((x, w) => { xs.push(x); return x + w; }, M);
    const pad = 1.4, alt = 3.4, minH = b.alt || 6.4;
    const cabT = () => {
      fonte(7.3, true);
      const ls = b.cols.map((c, i) => doc.splitTextToSize(S(c.t), ws[i] - 2 * pad));
      const hh = Math.max(...ls.map((l) => l.length)) * alt + 2 * pad;
      cabe(hh + minH);
      ls.forEach((l, i) => { caixa(xs[i], y, ws[i], hh, 240); fonte(7.3, true); l.forEach((t, k) => doc.text(t, b.cols[i].centro ? xs[i] + ws[i] / 2 : xs[i] + pad, y + pad + 2.6 + k * alt, b.cols[i].centro ? { align: 'center' } : undefined)); });
      y += hh;
    };
    const todas = [...b.linhas, ...Array.from({ length: b.vazias || 0 }, () => b.cols.map(() => ''))];
    cabe(10 + Math.min(todas.length, 4) * minH);   // o título da tabela não fica sozinho no fim da folha
    cabT(); repetir = cabT;
    todas.forEach((l) => {
      fonte(7.9);
      const ls = l.map((c, i) => { fonte(7.9, celNeg(c)); return doc.splitTextToSize(S(emCelula(celTxt(c))), ws[i] - 2 * pad).slice(0, 40); });
      const hh = Math.max(minH, Math.max(...ls.map((q) => q.length)) * alt + 2 * pad);
      if (y + hh > FIM) continua();
      ls.forEach((q, i) => {
        caixa(xs[i], y, ws[i], hh);
        if (l[i] && typeof l[i] === 'object' && l[i].img) {   // v297: assinatura colhida no celular
          const ih = Math.min(hh - 1.2, 7), iw = Math.min(ws[i] - 2, ih * 3);
          try { doc.addImage(l[i].img, 'PNG', xs[i] + (ws[i] - iw) / 2, y + (hh - ih) / 2, iw, ih); } catch { /* segue sem a imagem */ }
        }
        fonte(7.9, celNeg(l[i]));
        q.forEach((t, k) => {
          const yy = y + pad + 2.5 + k * alt;
          if (b.cols[i].centro) { const tw = String(t).split(/(\[ \])/).filter((p) => p !== '').reduce((s, p) => s + (p === '[ ]' ? doc.getFontSize() * 0.3 + 1.4 : doc.getTextWidth(p)), 0); linhaCx(t, xs[i] + (ws[i] - tw) / 2, yy); }
          else linhaCx(t, xs[i] + pad, yy);
          if (celNeg(l[i]) && /VENCID/.test(t)) { doc.setLineWidth(0.2); doc.line(xs[i] + pad, yy + 0.6, xs[i] + pad + doc.getTextWidth(t), yy + 0.6); }
        });
      });
      y += hh;
    });
    repetir = null; y += 2.2;
  };
  const decl = (x, junto = 0) => {
    fonte(8.6); const ls = doc.splitTextToSize(S(emLinha(x)), L - 5), hh = ls.length * 3.9 + 3.4;
    cabe(hh + 2 + junto);   // a declaração não se separa das assinaturas
    y += 1.5; caixa(M, y, L, hh); ls.forEach((l, i) => linhaCx(l, M + 2.5, y + 4.4 + i * 3.9)); y += hh + 1;
  };
  const assin = (b) => {
    const n = b.blocos.length, gap = 10, w = (L - gap * (n - 1)) / n;
    const hh = 12 + 8 + Math.max(...b.blocos.map((bl) => (bl.linhas || []).length)) * 4 + 6;
    cabe(hh); y += 12;
    b.blocos.forEach((bl, i) => {
      const x = M + i * (w + gap);
      if (bl.img) { try { doc.addImage(bl.img, 'PNG', x + 2, y - 11, 30, 10); } catch { /* segue sem a imagem */ } }   // v297
      PRETO(); doc.line(x, y, x + w, y);
      fonte(8.4, true); doc.splitTextToSize(S(bl.titulo), w).slice(0, 2).forEach((l, k) => doc.text(l, x, y + 4 + k * 3.8));
      const y0 = y + 4 + Math.min(2, doc.splitTextToSize(S(bl.titulo), w).length) * 3.8;
      fonte(7.8); (bl.linhas || []).forEach((l, k) => doc.text(S(emLinha(l)), x, y0 + k * 4));
      fonte(7.2, false, true); doc.text(S('Assinatura'), x, y0 + (bl.linhas || []).length * 4 + 1.5);
    });
    y += hh - 12;
  };
  const inicio = [];   // primeira página de cada documento
  documentos.forEach((partes, di) => {
    if (di > 0) doc.addPage();
    y = M; repetir = null;
    const c = partes.find((b) => b.t === 'cab');
    docAtual = { titulo: c?.titulo || partes.find((b) => b.t === 'titulo')?.x || '', rod: partes.find((b) => b.t === 'rod')?.x || '' };
    inicio.push({ pag: doc.getNumberOfPages(), doc: docAtual });
    partes.forEach((b, bi) => {
      if (b.t === 'cab') return cab(b);
      if (b.t === 'faixa') return faixa(b);
      if (b.t === 'grade') return grade(b);
      if (b.t === 'h') { const a = partes[bi + 1]; return h(b.x, a?.t === 'tabela' ? 10 + Math.min(4, a.linhas.length + (a.vazias || 0)) * (a.alt || 6.4) : 0); }   // título não fica sozinho no fim da folha
      if (b.t === 'li') { escrever(b.x, { recuo: 4.5, marcador: '-', tam: 8.6, alt: 3.9 }); return; }
      if (b.t === 'tabela') return tabela(b);
      if (b.t === 'decl') { const a = partes[bi + 1]; return decl(b.x, a?.t === 'assin' ? 20 + Math.max(...a.blocos.map((bl) => (bl.linhas || []).length)) * 4 + 6 : 0); }
      if (b.t === 'assin') return assin(b);
      if (b.t === 'nota') { y += 0.8; escrever(b.x, { tam: 7.6, cinza: true, alt: 3.5 }); return; }
      if (b.t === 'rod') return;
      if (b.t === 'titulo') { escrever(b.x, { tam: 13, neg: true, alt: 6 }); if (b.sub) escrever(b.sub, { tam: 8.5, alt: 4 }); y += 3; return; }
      escrever(b.x || '', { tam: 8.6, alt: 3.95 }); y += 0.6;
    });
  });
  // páginas de cada documento (a pessoa conta só as folhas dela)
  const total = doc.getNumberOfPages();
  inicio.forEach((d, i) => { d.fim = (inicio[i + 1]?.pag || total + 1) - 1; d.n = d.fim - d.pag + 1; });
  for (let p = 1; p <= total; p++) {
    const d = [...inicio].reverse().find((x) => x.pag <= p);
    doc.setPage(p); PRETO(); doc.line(M, 297 - 12.5, M + L, 297 - 12.5);
    const pg = `Pág. ${p - d.pag + 1}/${d.n}`;
    fonte(7.2); const wPg = doc.getTextWidth(S(pg)); doc.text(S(pg), M + L, 297 - 9, { align: 'right' });
    fonte(6.6, false, true); const ger = S(RODAPE_CURTO()), wGer = doc.getTextWidth(ger); doc.text(ger, M + L - wPg - 5, 297 - 9, { align: 'right' });
    fonte(7.2); const maxR = L - wPg - wGer - 12; let rod = S(d?.doc.rod || '');
    if (doc.getTextWidth(rod) > maxR) { while (rod.length > 4 && doc.getTextWidth(`${rod}...`) > maxR) rod = rod.slice(0, -1); rod = `${rod.trim()}...`; }
    doc.text(rod, M, 297 - 9);
  }
  pagsCab.forEach((pc) => { const d = inicio.find((x) => x.pag === pc.pag); if (!d) return; doc.setPage(pc.pag); doc.setFillColor(255, 255, 255); doc.rect(pc.x - 0.5, pc.y - 3.2, pc.w, 4.4, 'F'); fonte(8); doc.text(S(`Pág. 1 de ${d.n}`), pc.x, pc.y); });
  return doc.output('blob');
}

export async function baixarPartes(formato, titulo, documentos) {
  const blob = formato === 'pdf' ? await pdfPartes(documentos) : docxPartes(documentos);
  baixarBlob(blob, nomeArquivo(titulo, formato === 'pdf' ? 'pdf' : 'docx'));
}
