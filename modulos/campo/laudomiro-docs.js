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
