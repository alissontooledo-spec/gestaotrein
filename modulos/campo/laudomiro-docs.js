/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/campo/laudomiro-docs.js — baixar em Word e PDF (v281)
   Ordem de serviço, roteiro do DDS, linha do plano de ação e memória de cálculo
   do ruído. Tudo é montado no aparelho: o texto não sai do GRID.
   Word: .docx de verdade (OOXML mínimo num ZIP sem compressão), abre no Word,
   no Google Docs e no LibreOffice. Campos entre colchetes saem marcados em
   amarelo para a pessoa preencher.
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
    const n = enc.encode(nome), d = enc.encode(conteudo), c = crc32(d);
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
   v284: documento em partes (Ordem de Serviço, Ficha de EPI). Um arquivo pode
   ter vários documentos, um por pessoa, cada um começando em página nova.
   Partes: { t:'titulo', x, sub } { t:'campos', itens:[[rótulo, valor]] } { t:'h', x }
   { t:'p', x } { t:'li', x } { t:'tabela', cols:[{ t, w }], linhas:[[...]], vazias }
   { t:'assin', nomes:[...] } { t:'nota', x } { t:'quebra' }
   w das colunas: fração da largura (soma 1). [campos] saem marcados em amarelo.
   ══════════════════════════════════════════════════════════════════════════ */
export const RODAPE_GRID = () => `Gerado com apoio do GRID em ${hoje()}. Conferência e responsabilidade de quem assina.`;
const LARG_TW = 9638;   // A4 menos as margens, em twips
const borda = (cor = 'B8C2D1') => `<w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((b) => `<w:${b} w:val="single" w:sz="4" w:space="0" w:color="${cor}"/>`).join('')}</w:tblBorders>`;
function celula(texto, w, { negrito = false, fundo = '', tam = 16 } = {}) {
  return `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${fundo ? `<w:shd w:val="clear" w:color="auto" w:fill="${fundo}"/>` : ''}</w:tcPr>${par(runs(texto || ' ', { negrito, tam }), { depois: 0 })}</w:tc>`;
}
function tabelaDocx(cols, linhas, vazias = 0) {
  const ws = cols.map((c) => Math.round(c.w * LARG_TW));
  const linha = (cel, cab = false) => `<w:tr>${cab ? '<w:trPr><w:tblHeader/></w:trPr>' : '<w:trPr><w:trHeight w:val="400"/></w:trPr>'}${cel.map((x, i) => celula(x, ws[i], cab ? { negrito: true, fundo: 'EEF2F8', tam: 17 } : {})).join('')}</w:tr>`;
  const todas = [...linhas, ...Array.from({ length: vazias }, () => cols.map(() => ''))];
  return `<w:tbl><w:tblPr><w:tblW w:w="${LARG_TW}" w:type="dxa"/>${borda()}<w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${ws.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${linha(cols.map((c) => c.t), true)}${todas.map((l) => linha(l)).join('')}</w:tbl>${par('', { depois: 0 })}`;
}
function assinDocx(nomes) {
  const w = Math.round((LARG_TW - 300 * (nomes.length - 1)) / nomes.length);   // n assinaturas e n-1 espaços de 300
  const cel = (n) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/><w:tcBorders><w:top w:val="single" w:sz="6" w:space="0" w:color="64748B"/></w:tcBorders></w:tcPr>${par(runs(n, { tam: 17, cor: '475569' }), { depois: 0, alinhar: 'center' })}</w:tc>`;
  const vazio = `<w:tc><w:tcPr><w:tcW w:w="300" w:type="dxa"/></w:tcPr>${par('', { depois: 0 })}</w:tc>`;
  return `${par('', { antes: 200, depois: 0 })}<w:tbl><w:tblPr><w:tblW w:w="${LARG_TW}" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${nomes.map(() => `<w:gridCol w:w="${w}"/>`).join('<w:gridCol w:w="300"/>')}</w:tblGrid><w:tr>${nomes.map(cel).join(vazio)}</w:tr></w:tbl>`;
}
export function docxPartes(documentos) {
  const corpo = documentos.map((partes, di) => partes.map((b) => {
    if (b.t === 'titulo') return par(runs(b.x, { negrito: true, tam: 30, cor: '172541' }), { depois: 40 }) + (b.sub ? par(runs(b.sub, { tam: 18, cor: '64748B' }), { depois: 200 }) : '');
    if (b.t === 'campos') return b.itens.map(([r, v]) => par(`<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:color w:val="172541"/><w:sz w:val="19"/></w:rPr><w:t xml:space="preserve">${xml(r)}: </w:t></w:r>${runs(v || '[preencher]', { tam: 19 })}`, { depois: 0 })).join('') + par('', { depois: 40 });
    if (b.t === 'h') return par(runs(b.x, { negrito: true, tam: 19, cor: '172541' }), { antes: 140, depois: 40 });
    if (b.t === 'li') return par(runs(`• ${b.x}`, { tam: 17 }), { depois: 0, recuo: 360 });
    if (b.t === 'tabela') return tabelaDocx(b.cols, b.linhas, b.vazias || 0);
    if (b.t === 'assin') return assinDocx(b.nomes);
    if (b.t === 'nota') return par(runs(b.x, { tam: 16, cor: '64748B' }), { antes: 240 });
    return par(runs(b.x || '', { tam: 17 }), { depois: 40 });
  }).join('') + par(runs(RODAPE_GRID(), { tam: 15, cor: '8A94A6' }), { antes: 240 }) + (di < documentos.length - 1 ? '<w:p><w:r><w:br w:type="page"/></w:r></w:p>' : '')).join('')
    .replace(/w:line="300"/g, 'w:line="240"');   // entrelinha menor: cada documento cabe numa folha
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${corpo}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  return zip([
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'],
    ['word/document.xml', doc],
  ]);
}

export async function pdfPartes(documentos) {
  const ponte = window.__GRID_PONTE || {};
  if (ponte.garantirJsPDF) await ponte.garantirJsPDF();
  const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
  if (!jsPDF) throw new Error('O gerador de PDF não carregou. Confira a internet e tente de novo.');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  const M = 18, L = 210 - 2 * M, FIM = 297 - 20;
  let y = 22, cabecalhoTabela = null;
  const cor = (hex) => doc.setTextColor(parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16));
  const fonte = (tam, neg = false, hex = '1F2A3D') => { doc.setFont('helvetica', neg ? 'bold' : 'normal'); doc.setFontSize(tam); cor(hex); };
  const virar = () => { doc.addPage(); y = 20; cabecalhoTabela?.(); };
  const cabe = (h) => { if (y + h > FIM) virar(); };
  /* uma linha com [campos] em amarelo */
  const linhaMarcada = (ln, x, yy) => {
    let cx = x;
    String(ln).split(/(\[[^\]]{1,80}\])/).filter(Boolean).forEach((pedaco) => {
      const w = doc.getTextWidth(pedaco);
      if (/^\[.*\]$/.test(pedaco)) { doc.setFillColor(253, 230, 138); doc.rect(cx - 0.4, yy - doc.getFontSize() * 0.29, w + 0.8, doc.getFontSize() * 0.4, 'F'); }
      doc.text(pedaco, cx, yy); cx += w;
    });
  };
  const escrever = (t, { tam = 10, neg = false, hex = '1F2A3D', recuo = 0, alt = 4.9, marcador = '' } = {}) => {
    fonte(tam, neg, hex);
    doc.splitTextToSize(pdfSafe(t), L - recuo).forEach((ln, k) => {
      cabe(alt);
      if (k === 0 && marcador) doc.text(marcador, M + recuo - 4, y);
      linhaMarcada(ln, M + recuo, y); y += alt;
    });
  };
  const tabela = (cols, linhas, vazias = 0) => {
    const ws = cols.map((c) => c.w * L), xs = []; ws.reduce((x, w) => { xs.push(x); return x + w; }, M);
    const pad = 1.3, alt = 3.5;
    const cab = () => {
      fonte(7.6, true, '172541');
      const ls = cols.map((c, i) => doc.splitTextToSize(pdfSafe(c.t), ws[i] - 2 * pad));
      const h = Math.max(...ls.map((l) => l.length)) * alt + 2 * pad;
      cabe(h + 6);
      doc.setFillColor(238, 242, 248); doc.rect(M, y, L, h, 'F');
      doc.setDrawColor(184, 194, 209); doc.setLineWidth(0.2);
      ls.forEach((l, i) => { doc.rect(xs[i], y, ws[i], h, 'S'); l.forEach((t, k) => doc.text(t, xs[i] + pad, y + pad + 2.9 + k * alt)); });
      y += h;
    };
    cab(); cabecalhoTabela = cab;
    const todas = [...linhas, ...Array.from({ length: vazias }, () => cols.map(() => ''))];
    todas.forEach((l) => {
      fonte(8.1);
      const maxL = Math.floor((FIM - 40) / alt);   // célula maior que uma folha: corta e avisa com reticências
      const ls = l.map((x, i) => { const q = doc.splitTextToSize(pdfSafe(x || ''), ws[i] - 2 * pad); return q.length > maxL ? [...q.slice(0, maxL - 1), '...'] : q; });
      const h = Math.max(6.2, Math.max(...ls.map((q) => q.length)) * alt + 2 * pad);
      if (y + h > FIM) virar();
      doc.setDrawColor(184, 194, 209); doc.setLineWidth(0.2);
      ls.forEach((q, i) => { doc.rect(xs[i], y, ws[i], h, 'S'); fonte(8.1); q.forEach((t, k) => linhaMarcada(t, xs[i] + pad, y + pad + 2.6 + k * alt)); });
      y += h;
    });
    cabecalhoTabela = null; y += 4;
  };
  documentos.forEach((partes, di) => {
    if (di > 0) { doc.addPage(); y = 22; }
    partes.forEach((b) => {
      if (b.t === 'titulo') { escrever(b.x, { tam: 13.5, neg: true, hex: '172541', alt: 6 }); if (b.sub) escrever(b.sub, { tam: 9, hex: '64748B', alt: 4.4 }); y += 1.5; doc.setDrawColor(245, 158, 11); doc.setLineWidth(0.6); doc.line(M, y, M + 16, y); y += 6; return; }
      if (b.t === 'campos') { b.itens.forEach(([r, v]) => { fonte(9, true, '172541'); const rw = doc.getTextWidth(pdfSafe(r + ': ')); cabe(5); doc.text(pdfSafe(r + ': '), M, y); fonte(9); const ls = doc.splitTextToSize(pdfSafe(v || '[preencher]'), L - rw); ls.forEach((ln, k) => { if (k) cabe(4.4); linhaMarcada(ln, M + (k ? 0 : rw), y); y += 4.4; }); }); y += 1.5; return; }
      if (b.t === 'h') { cabe(12); y += 1.6; escrever(b.x, { tam: 9, neg: true, hex: '172541', alt: 4.3 }); y += 0.3; return; }
      if (b.t === 'li') { escrever(b.x, { recuo: 5, marcador: '-', tam: 8.7, alt: 4 }); y += 0.2; return; }
      if (b.t === 'tabela') { tabela(b.cols, b.linhas, b.vazias || 0); return; }
      if (b.t === 'assin') { cabe(20); y += 13; const w = (L - 10 * (b.nomes.length - 1)) / b.nomes.length; doc.setDrawColor(100, 116, 139); doc.setLineWidth(0.3); b.nomes.forEach((n, i) => { const x = M + i * (w + 10); doc.line(x, y, x + w, y); fonte(8.5, false, '475569'); doc.text(pdfSafe(n), x + w / 2, y + 4, { align: 'center' }); }); y += 9; return; }
      if (b.t === 'nota') { y += 2; escrever(b.x, { tam: 8.2, hex: '64748B', alt: 4 }); return; }
      escrever(b.x || '', { tam: 8.8, alt: 4.1 }); y += 0.5;
    });
  });
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i); fonte(7.6, false, '8A94A6');
    doc.text(pdfSafe(RODAPE_GRID()), M, 297 - 10);
    doc.text(pdfSafe(`Página ${i} de ${total}`), 210 - M, 297 - 10, { align: 'right' });
  }
  return doc.output('blob');
}

export async function baixarPartes(formato, titulo, documentos) {
  const blob = formato === 'pdf' ? await pdfPartes(documentos) : docxPartes(documentos);
  baixarBlob(blob, nomeArquivo(titulo, formato === 'pdf' ? 'pdf' : 'docx'));
}
