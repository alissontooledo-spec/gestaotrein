// Gerador do PDF da "Avaliação de Campo" (módulo campo).
// jsPDF 2.5.1 (recebido por parâmetro; no app vem de window.jspdf.jsPDF), A4 retrato, Helvetica.
// Regras: todo texto passa por pdfSafe; cores com spread; sem alfa/GState; sem HTML;
// quebra de página controlada (bloco de risco não é cortado se couber inteiro na página seguinte);
// cabeçalho em cada página e rodapé "página X de Y" no final; fotos carregadas uma a uma.

const PW = 210, PH = 297, ML = 14, MR = 14, MT = 14, MB = 18;
const CW = PW - ML - MR;          // largura útil (182 mm)
const YMAX = PH - MB;             // limite inferior do conteúdo (279 mm)
const PT = 0.3528;                // 1 pt em mm

const NAVY = [23, 37, 65], AMBAR = [245, 158, 11], VERDE = [24, 118, 80], VERM = [180, 49, 46];
const C1 = [65, 75, 99], C2 = [94, 103, 128], C3 = [139, 147, 168];
const LINHA = [227, 231, 240], FUNDO = [243, 245, 250], FUNDO2 = [249, 250, 252], BORDA2 = [191, 197, 210];
const VERDE_BG = [232, 247, 239], AMBAR_BG = [254, 245, 226], BRANCO = [255, 255, 255];
const BR70 = [185, 190, 198], BR85 = [220, 223, 227]; // branco com 70%/85% sobre navy (sem alfa)

const CATEGORIAS = {
  fisico: 'Físico', acidente: 'Acidente', operacao_perigosa: 'Operação perigosa',
  ergonomico: 'Ergonômico', quimico: 'Químico', biologico: 'Biológico', outro: 'Outro',
};
const CONCLUSOES = { fisico: ['ins', 'per', 'ae'], quimico: ['ins', 'per', 'ae'], operacao_perigosa: ['per', 'ae'], biologico: ['ins', 'ae'] };
const EXPOSICAO = { P: 'Permanente', E: 'Eventual', I: 'Intermitente' };
const PROBABILIDADE = { 1: 'Altamente improvável', 2: 'Improvável', 3: 'Pouco provável', 4: 'Provável', 5: 'Altamente provável' };
const SEVERIDADE = { 1: 'Lesão leve', 2: 'Lesão moderada', 3: 'Lesão grave', 4: 'Lesão gravíssima', 5: 'Lesão crítica ou fatal' };
const CLASSIF = { aceitavel: ['Aceitável', VERDE], toleravel: ['Tolerável', AMBAR], nao_aceitavel: ['Não aceitável', VERM] };
const SIGLA_CONC = { ins: 'Ins.', per: 'Per.', ae: 'AE' };
const SEP = ' · ';

// ---------- utilidades de formato ----------
function dataBR(v) {
  if (!v) return '';
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(v);
}
function dataHoraBR(v) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d)) return String(v);
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(d).map(x => [x.type, x.value]));
    return `${p.day}/${p.month}/${p.year} às ${p.hour}:${p.minute}`;
  } catch {
    const z = n => String(n).padStart(2, '0');
    return `${z(d.getDate())}/${z(d.getMonth() + 1)}/${d.getFullYear()} às ${z(d.getHours())}:${z(d.getMinutes())}`;
  }
}
const num = v => (typeof v === 'number' ? String(v).replace('.', ',') : (v ?? ''));
const hora = v => (v ? String(v).slice(0, 5) : '');
const vazio = v => v == null || String(v).trim() === '';
const lista = a => (Array.isArray(a) ? a.filter(x => !vazio(x)).join(', ') : (a ?? ''));

// =====================================================================
export async function gerarPdfAvaliacao(dados, { jsPDF, pdfSafe, aoProgresso } = {}) {
  if (!jsPDF) throw new Error('jsPDF não informado');
  if (typeof pdfSafe !== 'function') throw new Error('pdfSafe não informado');
  const progresso = (etapa, atual, total) => { try { aoProgresso?.({ etapa, atual, total }); } catch { /* ignora */ } };

  const org = dados.org || {}, av = dados.avaliacao || {}, cli = dados.cliente || {}, tec = dados.tecnico || {};
  const ghes = [...(dados.ghes || [])].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const fotos = dados.fotos || [];
  const catTrein = dados.treinamentos || {};
  const numero = av.numero || 'AC-sem-numero';
  const revisao = av.revisao ?? 1;

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  doc.setProperties({ title: `Avaliação de campo ${numero}`, subject: cli.nome || '', creator: 'GRID' });
  doc.setLineHeightFactor(1.15);

  // ---------- texto ----------
  const S = t => pdfSafe(t == null ? '' : String(t));
  const fonte = (size, bold = false, cor = NAVY) => { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...cor); };
  const lh = (size, f = 1.42) => size * PT * f;
  const base = (top, size, h) => top + (h - size * PT) / 2 + size * PT * 0.78; // linha de base centrada na altura h
  const quebrar = (t, w, size, bold = false) => { fonte(size, bold); return doc.splitTextToSize(S(t), w); };
  function escrever(linhas, x, top, size, bold, cor, opts = {}) {
    const h = opts.lh ?? lh(size);
    fonte(size, bold, cor);
    linhas.forEach((l, i) => doc.text(l, x, base(top + i * h, size, h), opts.align ? { align: opts.align } : undefined));
    return linhas.length * h;
  }
  function limitar(linhas, max, w, size, bold) {
    if (linhas.length <= max) return linhas;
    const r = linhas.slice(0, max);
    fonte(size, bold);
    let u = r[max - 1];
    while (u.length && doc.getTextWidth(u + '...') > w) u = u.slice(0, -1);
    r[max - 1] = u.replace(/\s+$/, '') + '...';
    return r;
  }

  // texto misto (negrito/cor na mesma linha): segs = [{t, b, c}] -> linhas de "runs"
  function rico(segs, w, size) {
    const linhas = [[]]; let lw = 0, espaco = null;
    const medir = (t, b) => { fonte(size, b); return doc.getTextWidth(t); };
    const push = (t, b, c) => {
      const l = linhas[linhas.length - 1], u = l[l.length - 1];
      if (u && u.b === b && u.c === c) u.t += t; else l.push({ t, b, c });
    };
    for (const sg of segs) {
      const t = S(sg.t); if (!t) continue;
      for (const tok of t.split(/(\s+)/)) {
        if (!tok) continue;
        if (/^\s+$/.test(tok)) { if (lw > 0) espaco = sg; continue; }
        let tw = medir(tok, !!sg.b);
        const sw = espaco ? medir(' ', !!espaco.b) : 0;
        if (lw > 0 && lw + sw + tw > w) { linhas.push([]); lw = 0; espaco = null; }
        else if (espaco) { push(' ', !!espaco.b, espaco.c || null); lw += sw; espaco = null; }
        let resto = tok;
        while (tw > w) { // palavra maior que a linha: corta por caractere
          let n = resto.length; while (n > 1 && medir(resto.slice(0, n), !!sg.b) > w - lw) n--;
          push(resto.slice(0, n), !!sg.b, sg.c || null); linhas.push([]); lw = 0;
          resto = resto.slice(n); tw = medir(resto, !!sg.b);
        }
        if (resto) { push(resto, !!sg.b, sg.c || null); lw += tw; }
      }
    }
    if (!linhas[linhas.length - 1].length && linhas.length > 1) linhas.pop();
    return linhas;
  }
  function escreverRico(linhas, x, top, size, corPadrao = C1, h = lh(size)) {
    linhas.forEach((runs, i) => {
      let cx = x; const y = base(top + i * h, size, h);
      for (const r of runs) { fonte(size, r.b, r.c || corPadrao); doc.text(r.t, cx, y); cx += doc.getTextWidth(r.t); }
    });
    return linhas.length * h;
  }

  // ---------- páginas ----------
  let y = MT, titulo = '', topo = MT;

  function cabecalhoInterno(tit) {
    fonte(8.5, true, C2);
    const linhaOrg = doc.splitTextToSize(S(`${org.nome || 'GRID'} · Avaliação de Riscos Ambientais · ${cli.nome || ''}`.toUpperCase()), CW - 48)[0];
    doc.text(linhaOrg, ML, MT + 3);
    fonte(14, true, NAVY);
    const suf = / \(continuação\)$/.test(tit) ? S(' (continuação)') : '';
    let t = S(suf ? tit.replace(/ \(continuação\)$/, '') : tit);
    if (doc.getTextWidth(t + suf) > CW - 48) { while (t.length > 3 && doc.getTextWidth(t + '...' + suf) > CW - 48) t = t.slice(0, -1); t = t.replace(/[\s,.;:-]+$/, '') + '...'; }
    doc.text(t + suf, ML, MT + 10);
    direita([{ t: 'Nº ', c: C2 }, { t: numero, b: true }], PW - MR, MT + 3, 8);
    direita([{ t: 'Revisão ', c: C2 }, { t: String(revisao), b: true }], PW - MR, MT + 7.4, 8);
    doc.setDrawColor(...NAVY); doc.setLineWidth(0.6); doc.line(ML, MT + 14, PW - MR, MT + 14);
    return MT + 14 + 5;
  }
  function direita(runs, xr, yb, size) {
    let w = 0; runs.forEach(r => { fonte(size, !!r.b); w += doc.getTextWidth(S(r.t)); });
    let x = xr - w;
    runs.forEach(r => { fonte(size, !!r.b, r.c || NAVY); doc.text(S(r.t), x, yb); x += doc.getTextWidth(S(r.t)); });
  }
  function novaPagina(tit) {
    doc.addPage(); titulo = tit; topo = y = cabecalhoInterno(tit);
  }
  const quebraContinua = () => novaPagina(/\(continuação\)$/.test(titulo) ? titulo : `${titulo} (continuação)`);
  function garantir(h) { if (y + h > YMAX) quebraContinua(); }
  const utilPagina = () => YMAX - topo;

  function h2(t, proximo = 12) {
    const h = 4 + lh(9) + 1.2 + 2;
    garantir(h + proximo);
    if (y > topo + 0.1) y += 4;
    escrever([S(t).toUpperCase()], ML, y, 9, true, NAVY);
    y += lh(9) + 1.2;
    doc.setDrawColor(...LINHA); doc.setLineWidth(0.25); doc.line(ML, y, PW - MR, y);
    y += 2;
  }
  function paragrafo(t, size = 8.3, cor = C1) {
    const linhas = quebrar(t, CW, size); const h = lh(size, 1.5);
    for (const l of linhas) { garantir(h); escrever([l], ML, y, size, false, cor, { lh: h }); y += h; }
  }

  // ---------- tabela ----------
  // cols: [{t, w (fração)}]; celula: texto ou {t, b, c}
  function tabela(cols, linhas, { cabecalho = true, kv = false, size = 8.3 } = {}) {
    const ws = cols.map(c => c.w * CW), px = 2, py = 1.5, hl = lh(size, 1.35), hs = 7.2;
    const cel = c => (c && typeof c === 'object' ? c : { t: c });
    const desenharCab = () => {
      const ls = cols.map((c, i) => quebrar(S(c.t).toUpperCase(), ws[i] - 2 * px, hs, true));
      const h = Math.max(...ls.map(l => l.length)) * lh(hs, 1.3) + 2 * py;
      let x = ML;
      ls.forEach((l, i) => {
        doc.setFillColor(...FUNDO); doc.rect(x, y, ws[i], h, 'F');
        doc.setDrawColor(...LINHA); doc.setLineWidth(0.25); doc.rect(x, y, ws[i], h, 'S');
        escrever(l, x + px, y + py, hs, true, C1, { lh: lh(hs, 1.3) }); x += ws[i];
      });
      y += h;
    };
    const hCab = cabecalho ? 2 * py + lh(hs, 1.3) : 0;
    garantir(hCab + hl + 2 * py);
    if (cabecalho) desenharCab();
    for (const linha of linhas) {
      const cs = linha.map(cel);
      const ls = cs.map((c, i) => quebrar(c.t ?? '', ws[i] - 2 * px, size, !!c.b));
      const h = Math.max(...ls.map(l => l.length)) * hl + 2 * py;
      if (y + h > YMAX) { quebraContinua(); if (cabecalho) desenharCab(); }
      let x = ML;
      cs.forEach((c, i) => {
        const k = kv && i === 0;
        if (k) { doc.setFillColor(...FUNDO2); doc.rect(x, y, ws[i], h, 'F'); }
        doc.setDrawColor(...LINHA); doc.setLineWidth(0.25); doc.rect(x, y, ws[i], h, 'S');
        escrever(ls[i], x + px, y + py, size, !!c.b, c.c || (k ? C2 : NAVY), { lh: hl });
        x += ws[i];
      });
      y += h;
    }
  }

  // ---------- fotos ----------
  const numeroFoto = new Map(); let contFoto = 0;
  const totalFotos = fotos.length; let fotosFeitas = 0;
  const pausa = () => new Promise(r => setTimeout(r, 0));

  async function desenharFoto(f, x, top, w, hImg) {
    doc.setFillColor(...FUNDO); doc.rect(x, top, w, hImg, 'F');
    let url = null;
    try { url = f.dataUrl || (typeof f.carregar === 'function' ? await f.carregar() : null); } catch { url = null; }
    if (url) {
      try {
        const fmt = /^data:image\/png/i.test(url) ? 'PNG' : 'JPEG';
        let iw = f.largura, ih = f.altura;
        if (!iw || !ih) { const p = doc.getImageProperties(url); iw = p.width; ih = p.height; }
        const k = Math.min(w / iw, hImg / ih), dw = iw * k, dh = ih * k;
        doc.addImage(url, fmt, x + (w - dw) / 2, top + (hImg - dh) / 2, dw, dh, `foto_${f.id}`, 'FAST');
      } catch { url = null; }
    }
    if (!url) { fonte(7.5, false, C3); doc.text(S('Foto indisponível'), x + w / 2, top + hImg / 2, { align: 'center' }); }
    url = null; // libera a referência antes da próxima foto
    fotosFeitas++; progresso('fotos', fotosFeitas, totalFotos);
    await pausa();
  }
  // devolve "peças" (uma por linha de fotos) para o motor de layout
  function pecasFotos(lista, x, w, porLinha, rotulo) {
    const gap = 3, cw = (w - gap * (porLinha - 1)) / porLinha, hImg = cw * 0.75, sz = 7, hlc = lh(7, 1.35);
    const pecas = [];
    for (let i = 0; i < lista.length; i += porLinha) {
      const grupo = lista.slice(i, i + porLinha);
      const legendas = grupo.map(f => {
        const segs = [{ t: `Foto ${numeroFoto.get(f)}`, b: true, c: NAVY }];
        if (!vazio(f.legenda)) segs.push({ t: `${SEP}${f.legenda}` });
        let ls = rico(segs, cw - 3, sz);
        if (ls.length > 3) { ls = ls.slice(0, 3); const u = ls[2]; u[u.length - 1] = { ...u[u.length - 1], t: u[u.length - 1].t.replace(/\s*\S{0,12}$/, '') + '...' }; }
        return ls;
      });
      const hCap = Math.max(...legendas.map(l => l.length)) * hlc + 2.4;
      const hRot = i === 0 && rotulo ? lh(6.6) + 1 : 0;
      pecas.push({
        h: hRot + hImg + hCap + gap,
        async draw(top) {
          if (hRot) { escrever([S(rotulo).toUpperCase()], x, top, 6.6, true, C2); top += hRot; }
          for (let j = 0; j < grupo.length; j++) {
            const fx = x + j * (cw + gap);
            await desenharFoto(grupo[j], fx, top, cw, hImg);
            escreverRico(legendas[j], fx + 1.5, top + hImg + 1.2, sz, C1, hlc);
            doc.setDrawColor(...LINHA); doc.setLineWidth(0.25); doc.roundedRect(fx, top, cw, hImg + hCap, 1.5, 1.5, 'S');
          }
        },
      });
    }
    return pecas;
  }
  async function gradeFotos(lista, porLinha = 3) {
    for (const p of pecasFotos(lista, ML, CW, porLinha)) {
      if (y + p.h > YMAX) quebraContinua();
      await p.draw(y); y += p.h;
    }
  }

  // ---------- motor de caixa (bloco de risco) ----------
  // cab(cont) -> {h, draw(top)}; pecas: [{h, draw(top), espaco?}]; junto = nº de peças que devem ficar com o cabeçalho
  async function caixa(cab, pecas, junto, padBaixo = 0) {
    const c0 = cab(false);
    const total = c0.h + pecas.reduce((s, p) => s + p.h, 0) + padBaixo;
    const minimo = c0.h + pecas.slice(0, junto).reduce((s, p) => s + p.h, 0) + (junto >= pecas.length ? padBaixo : 0);
    // o risco (e a 1ª linha de fotos) vai inteiro para a próxima página se não couber aqui mas couber lá;
    // as demais linhas de fotos podem continuar na página seguinte. Bloco maior que uma página: quebra por linha.
    if (y + minimo > YMAX) {
      if (minimo <= utilPagina() || YMAX - y < 45) quebraContinua();
    }
    let seg = y;
    const fechar = () => { doc.setDrawColor(...LINHA); doc.setLineWidth(0.3); doc.roundedRect(ML, seg, CW, y - seg, 2, 2, 'S'); };
    await c0.draw(y); y += c0.h;
    for (let i = 0; i < pecas.length; i++) {
      const p = pecas[i];
      if (y + p.h > YMAX - 0.5) {
        if (p.espaco) continue; // espaço vazio não justifica quebra
        fechar(); quebraContinua(); seg = y;
        const c1 = cab(true); await c1.draw(y); y += c1.h;
        if (p.espaco) continue;
      }
      await p.draw(y); y += p.h;
    }
    y += padBaixo; fechar(); y += 2.6;
  }

  // ---------- bloco de um risco ----------
  function cabecalhoRisco(r) {
    const cat = `${CATEGORIAS[r.categoria] || 'Outro'}${r.nao_listado ? ' (não listado)' : ''}${SEP}${r.ambiente || 'Todos'}`;
    return cont => {
      const x = ML + 3, iw = CW - 6;
      fonte(8, true); const cod = S(r.codigo || 'Novo'); const pw = doc.getTextWidth(cod) + 3.6;
      fonte(7.5); const catW = Math.min(doc.getTextWidth(S(cat)) + 0.5, 62);
      const catL = quebrar(cat, catW, 7.5);
      const nomeL = quebrar(cont ? `${r.nome} (continuação)` : r.nome, iw - pw - 3 - catW - 4, 10, true);
      const hc = Math.max(nomeL.length * lh(10, 1.25), catL.length * lh(7.5, 1.3), 4.6) + 3.4;
      return {
        h: hc + (cont ? 2 : 0), // na continuação, respiro antes do texto
        draw(top) {
          doc.setFillColor(...FUNDO); doc.roundedRect(ML, top, CW, hc, 2, 2, 'F'); doc.rect(ML, top + hc - 2.5, CW, 2.5, 'F');
          doc.setDrawColor(...LINHA); doc.setLineWidth(0.25); doc.line(ML, top + hc, ML + CW, top + hc);
          const my = top + hc / 2;
          doc.setFillColor(...NAVY); doc.roundedRect(x, my - 2.3, pw, 4.6, 0.8, 0.8, 'F');
          fonte(8, true, BRANCO); doc.text(cod, x + 1.8, my + 1.0);
          const nh = nomeL.length * lh(10, 1.25);
          escrever(nomeL, x + pw + 3, my - nh / 2, 10, true, NAVY, { lh: lh(10, 1.25) });
          const ch = catL.length * lh(7.5, 1.3);
          escrever(catL, ML + CW - 3, my - ch / 2, 7.5, false, C2, { lh: lh(7.5, 1.3), align: 'right' });
        },
      };
    };
  }

  function pecasRisco(r, fotosRisco) {
    const x = ML + 3, iw = CW - 6, sz = 8.3, hl = lh(sz, 1.42), pecas = [];
    const espaco = h => pecas.push({ h, espaco: true, draw() {} });
    espaco(2);
    const par = (rot, txt) => {
      if (vazio(txt)) return;
      for (const l of rico([{ t: `${rot}: `, b: true, c: NAVY }, { t: txt }], iw, sz)) pecas.push({ h: hl, draw: top => escreverRico([l], x, top, sz, C1, hl) });
      espaco(1.2);
    };
    par('Análise qualitativa', r.analise);
    par('Fonte geradora', r.fonte);
    par('EPC', r.epc);
    par('Medidas administrativas', r.medidas_adm);
    const destaque = (segs, fundo, borda) => {
      const ls = rico(segs, iw - 4, sz), h = ls.length * hl + 3;
      pecas.push({ h: h + 1.2, draw(top) {
        doc.setFillColor(...fundo); doc.roundedRect(x, top, iw, h, 1, 1, 'F');
        if (borda) { doc.setFillColor(...borda); doc.rect(x, top, 0.8, h, 'F'); }
        escreverRico(ls, x + 2, top + 1.5, sz, C1, hl);
      } });
    };
    const m = r.medicao;
    if (m && !vazio(m.resultado)) {
      const segs = [{ t: 'Medição: ', b: true, c: NAVY }, { t: `${num(m.resultado)} ${m.unidade || ''}`.trim(), b: true, c: NAVY }];
      if (!vazio(m.metodo)) segs.push({ t: `${SEP}${m.metodo}` });
      if (!vazio(m.limite)) segs.push({ t: `${SEP}limite ${num(m.limite)}${typeof m.limite === 'number' && m.unidade ? ' ' + m.unidade : ''}` });
      if (!vazio(m.data)) segs.push({ t: `${SEP}medido em ${dataBR(m.data)}` });
      if (m.situacao === 'abaixo') segs.push({ t: SEP }, { t: 'abaixo do limite', b: true, c: VERDE });
      if (m.situacao === 'acima') segs.push({ t: SEP }, { t: 'acima do limite', b: true, c: VERM });
      destaque(segs, FUNDO2);
    }
    const il = r.iluminacao;
    if (il && !vazio(il.nivel_encontrado)) {
      const segs = [{ t: 'Medição: ', b: true, c: NAVY }, { t: `nível encontrado ${num(il.nivel_encontrado)} lux`, b: true, c: NAVY }];
      if (!vazio(il.nivel_minimo)) segs.push({ t: `${SEP}nível mínimo ${num(il.nivel_minimo)} lux (NBR ISO/CIE 8995-1)` });
      if (!vazio(il.irc)) segs.push({ t: `${SEP}IRC ${num(il.irc)}` });
      if (!vazio(il.nivel_minimo)) {
        const ok = Number(il.nivel_encontrado) >= Number(il.nivel_minimo);
        segs.push({ t: SEP }, { t: ok ? 'atende ao mínimo' : 'abaixo do mínimo', b: true, c: ok ? VERDE : VERM });
      }
      destaque(segs, FUNDO2);
    }
    if (r.pendente) {
      const quem = r.pendente.quem === 'empresa' ? 'depende da empresa' : 'depende do técnico';
      destaque([{ t: 'Pendente: ', b: true, c: NAVY }, { t: `${r.pendente.texto || 'sem descrição'} (${quem})` }], AMBAR_BG, AMBAR);
    }
    espaco(0.8);

    // rodapé do risco (grade de conclusões)
    const conc = CONCLUSOES[r.categoria] || [];
    const cols = [
      { l: 'Exposição', w: 1.0, v: [{ t: r.exposicao ? `${r.exposicao} ${EXPOSICAO[r.exposicao] || ''}` : '-' }] },
      { l: 'Probabilidade', w: 1.2, v: [{ t: r.probabilidade ? `${r.probabilidade} ${PROBABILIDADE[r.probabilidade] || ''}` : '-' }] },
      { l: 'Severidade', w: 1.2, v: [{ t: r.severidade ? `${r.severidade} ${SEVERIDADE[r.severidade] || ''}` : '-' }] },
      { l: 'Classificação', w: 1.1, v: CLASSIF[r.classificacao] ? [{ t: CLASSIF[r.classificacao][0], b: true, c: CLASSIF[r.classificacao][1] }] : [{ t: '-' }] },
      { l: 'EPI (CA)', w: 1.45, v: [{ t: vazio(r.epi) ? '-' : r.epi }] },
      { l: 'EPI eficaz', w: 0.8, v: [{ t: r.epi_eficaz || '-' }] },
    ];
    if (conc.length) {
      const v = [];
      conc.forEach((k, i) => { if (i) v.push({ t: ' / ' }); const s = r[k]; v.push(s === 'S' ? { t: 'S', b: true, c: VERM } : { t: s || '-' }); });
      cols.push({ l: conc.map(k => SIGLA_CONC[k]).join('/'), w: 1.0, v });
      if (conc.includes('ins')) cols.push({ l: 'Grau', w: 0.65, v: [{ t: r.grau || '-' }] });
    }
    const tw = cols.reduce((s, c) => s + c.w, 0), pxc = 1.8;
    let cx = ML;
    const cels = cols.map(c => {
      const w = (c.w / tw) * CW, lab = quebrar(c.l.toUpperCase(), w - 2 * pxc, 6.2, false), val = rico(c.v, w - 2 * pxc, 7.8);
      const cel = { x: cx, w, lab, val }; cx += w; return cel;
    });
    const hLab = lh(6.2, 1.25), hVal = lh(7.8, 1.3);
    const hg = Math.max(...cels.map(c => c.lab.length * hLab + c.val.length * hVal)) + 2.6;
    pecas.push({ h: hg, draw(top) {
      doc.setDrawColor(...LINHA); doc.setLineWidth(0.25); doc.line(ML, top, ML + CW, top);
      cels.forEach((c, i) => {
        if (i) doc.line(c.x, top, c.x, top + hg);
        escrever(c.lab, c.x + pxc, top + 1.3, 6.2, false, C2, { lh: hLab });
        escreverRico(c.val, c.x + pxc, top + 1.3 + c.lab.length * hLab, 7.8, NAVY, hVal);
      });
    } });
    const nFixas = pecas.length;

    if (fotosRisco.length) {
      const fp = pecasFotos(fotosRisco, x, iw, 5, 'Evidências deste risco');
      pecas.push({ h: 2.4, draw(top) { doc.setDrawColor(...LINHA); doc.setLineWidth(0.25); doc.line(ML, top, ML + CW, top); } });
      fp[fp.length - 1].h -= 3 - 0.6; // último gap vira respiro menor
      pecas.push(...fp);
      return { pecas, junto: nFixas + 2 };
    }
    return { pecas, junto: nFixas };
  }

  // ---------- pré-cálculos ----------
  const fotosDoGhe = new Map(), fotosDoRisco = new Map(), fotosGerais = [];
  for (const g of ghes) fotosDoGhe.set(g.id, []);
  for (const f of fotos) {
    const g = ghes.find(x => x.id === f.ghe_id);
    if (!g) { fotosGerais.push(f); continue; }
    const r = f.alvo === 'risco' && f.alvo_uid ? (g.riscos || []).find(x => x.uid === f.alvo_uid) : null;
    if (r) { if (!fotosDoRisco.has(r)) fotosDoRisco.set(r, []); fotosDoRisco.get(r).push(f); }
    else fotosDoGhe.get(g.id).push(f);
  }
  for (const g of ghes) {
    for (const r of g.riscos || []) for (const f of fotosDoRisco.get(r) || []) numeroFoto.set(f, ++contFoto);
    for (const f of fotosDoGhe.get(g.id)) numeroFoto.set(f, ++contFoto);
  }
  for (const f of fotosGerais) numeroFoto.set(f, ++contFoto);

  const flagSim = (g, k) => (g.riscos || []).some(r => r[k] === 'S');
  const grauMax = g => (g.riscos || []).filter(r => r.ins === 'S' && r.grau).map(r => r.grau).sort((a, b) => parseInt(b) - parseInt(a))[0];
  const contCat = g => {
    const m = {}; for (const r of g.riscos || []) { const c = CATEGORIAS[r.categoria] || 'Outro'; m[c] = (m[c] || 0) + 1; }
    return Object.entries(m).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c, n]) => `${c} ${n}`).join(SEP) || 'Nenhum';
  };
  const menor = v => (v === true ? 'Proibido' : v === false ? 'Permitido' : 'Não informado');
  const nRiscos = ghes.reduce((s, g) => s + (g.riscos || []).length, 0);
  const nNaoAceit = ghes.reduce((s, g) => s + (g.riscos || []).filter(r => r.classificacao === 'nao_aceitavel').length, 0);
  const nTrein = ghes.reduce((s, g) => s + (g.treinamentos || []).length, 0);
  const papelTec = [tec.formacao, [tec.sigla_conselho, tec.conselho_classe && `${tec.conselho_classe}${tec.uf_registro ? '/' + tec.uf_registro : ''}`].filter(Boolean).join(' ')].filter(x => !vazio(x)).join(SEP);

  progresso('texto', 0, 1);

  // =================== CAPA ===================
  {
    fonte(9, true, C2); doc.text(S(`${org.nome || 'GRID'} · Segurança do Trabalho`.toUpperCase()), ML, MT + 3);
    fonte(15, true, NAVY); doc.text(S('Avaliação de Riscos Ambientais'), ML, MT + 10.5);
    fonte(8.5, false, C2); doc.text(S('Levantamento de campo por Grupo Homogêneo de Exposição (GHE)'), ML, MT + 15.5);
    doc.setFillColor(...AMBAR); doc.rect(ML, MT + 18, 26, 1.1, 'F');
    direita([{ t: 'Nº ', c: C2 }, { t: numero, b: true }], PW - MR, MT + 3, 8.5);
    direita([{ t: 'Revisão ', c: C2 }, { t: String(revisao), b: true }], PW - MR, MT + 8, 8.5);
    const sit = av.situacao === 'concluida' ? ['Concluída', VERDE_BG, VERDE] : av.situacao === 'cancelada' ? ['Cancelada', [251, 234, 233], VERM] : ['Em aberto', AMBAR_BG, [160, 98, 6]];
    fonte(7, true); const sw = doc.getTextWidth(S(sit[0])) + 4;
    doc.setFillColor(...sit[1]); doc.roundedRect(PW - MR - sw, MT + 10, sw, 4.2, 2.1, 2.1, 'F');
    fonte(7, true, sit[2]); doc.text(S(sit[0]), PW - MR - sw / 2, MT + 12.9, { align: 'center' });
    doc.setDrawColor(...NAVY); doc.setLineWidth(0.6); doc.line(ML, MT + 22.5, PW - MR, MT + 22.5);
    topo = y = MT + 22.5 + 3; titulo = 'Avaliação de Riscos Ambientais';

    h2('Empresa avaliada');
    const end = [cli.endereco, [cli.cidade, cli.uf].filter(Boolean).join('/')].filter(x => !vazio(x)).join(SEP);
    const visita = [dataBR(av.data_visita), av.hora_inicio ? `início às ${hora(av.hora_inicio)}` : ''].filter(Boolean).join(SEP);
    const linhasEmp = [
      ['Razão social', { t: cli.nome || '-', b: true }],
      ['CNPJ', cli.cnpj || '-'],
      ['Endereço', end || '-'],
      ['Data da visita', visita || '-'],
      ['Acompanhante', vazio(av.acompanhante_nome) ? 'Sem acompanhante' : [av.acompanhante_nome, av.acompanhante_cargo].filter(x => !vazio(x)).join(SEP)],
      ['Técnico responsável', [tec.nome, papelTec].filter(x => !vazio(x)).join(SEP) || '-'],
    ];
    if (av.concluida_em) linhasEmp.push(['Concluída em', dataHoraBR(av.concluida_em)]);
    tabela([{ t: '', w: 0.3 }, { t: '', w: 0.7 }], linhasEmp, { cabecalho: false, kv: true });

    h2('Resumo por GHE');
    const sim = (on, extra) => (on ? { t: `Sim${extra ? SEP + extra : ''}`, b: true, c: VERM } : 'Não');
    tabela(
      [{ t: 'GHE', w: 0.15 }, { t: 'Setores', w: 0.14 }, { t: 'Funções', w: 0.2 }, { t: 'Riscos encontrados', w: 0.19 },
        { t: 'Ins.', w: 0.09 }, { t: 'Per.', w: 0.07 }, { t: 'AE', w: 0.07 }, { t: 'Menor 18', w: 0.09 }],
      ghes.map(g => [{ t: g.nome, b: true }, lista(g.setores) || '-', lista(g.funcoes) || '-', contCat(g),
        sim(flagSim(g, 'ins'), grauMax(g)), sim(flagSim(g, 'per')), sim(flagSim(g, 'ae')),
        g.menor18 === true ? { t: 'Proibido', b: true, c: VERM } : menor(g.menor18)]),
      { size: 7.8 },
    );

    // quadros de resumo
    const quadros = [[ghes.length, 'GHEs avaliados'], [nRiscos, 'Riscos encontrados'], [nNaoAceit, 'Riscos não aceitáveis', nNaoAceit ? VERM : NAVY], [nTrein, 'Treinamentos indicados']];
    garantir(20); y += 4;
    const qw = (CW - 3 * 3) / 4;
    quadros.forEach(([n, rot, cor], i) => {
      const qx = ML + i * (qw + 3);
      doc.setDrawColor(...LINHA); doc.setLineWidth(0.25); doc.roundedRect(qx, y, qw, 14, 2, 2, 'S');
      fonte(14, true, cor || NAVY); doc.text(S(String(n)), qx + 3, y + 7);
      fonte(6.8, false, C2); doc.text(S(rot.toUpperCase()), qx + 3, y + 11.3);
    });
    y += 14;

    h2('Como ler este documento');
    paragrafo('Cada GHE tem uma seção própria com as atividades, os ambientes, os riscos encontrados e as medições. Cada risco traz a análise, a exposição, a probabilidade, a severidade, a classificação, o EPI e as conclusões legais que se aplicam à sua categoria; as fotos de evidência do risco aparecem logo abaixo dele e as fotos dos ambientes ficam no fim da seção do GHE. Depois vêm os treinamentos indicados por GHE, as observações, os documentos solicitados e as assinaturas.', 8, C1);
    y += 1.5;
    garantir(lh(8, 1.5));
    const leg = rico([{ t: 'Classificação do risco: ', b: true, c: NAVY }, { t: 'Aceitável', b: true, c: VERDE }, { t: SEP }, { t: 'Tolerável', b: true, c: AMBAR }, { t: SEP }, { t: 'Não aceitável', b: true, c: VERM }, { t: '  (resulta da probabilidade e da severidade).' }], CW, 8);
    for (const l of leg) { garantir(lh(8, 1.5)); escreverRico([l], ML, y, 8, C1, lh(8, 1.5)); y += lh(8, 1.5); }
  }

  // =================== SEÇÃO POR GHE ===================
  const legendaRiscos = 'Exposição: P permanente, E eventual, I intermitente · Probabilidade: 1 altamente improvável a 5 altamente provável · Severidade: 1 lesão leve a 5 lesão crítica ou fatal · EPI eficaz: S sim, N não, NA não se aplica, SNS sim, não suficiente · Ins./Per./AE = insalubridade, periculosidade, aposentadoria especial (só nas categorias em que se aplicam)';
  for (let gi = 0; gi < ghes.length; gi++) {
    const g = ghes[gi];
    novaPagina(`GHE ${g.nome}`);
    progresso('texto', gi + 1, ghes.length + 1);

    // faixa navy do GHE
    {
      const wDir = CW * 0.58 - 4;
      const set = (g.setores || []).length > 1 ? 'Setores' : 'Setor', fun = (g.funcoes || []).length > 1 ? 'Funções' : 'Função';
      const dir = [...quebrar(`${set}: ${lista(g.setores) || '-'}`, wDir, 8), ...quebrar(`${fun}: ${lista(g.funcoes) || '-'}`, wDir, 8)];
      const nomeL = quebrar(g.nome, CW * 0.42 - 6, 13, true);
      const hEsq = lh(7.6) + nomeL.length * lh(13, 1.2);
      const hDir = dir.length * lh(8, 1.35);
      const hc = Math.max(hEsq, hDir) + 5;
      doc.setFillColor(...NAVY); doc.roundedRect(ML, y, CW, hc, 2, 2, 'F');
      escrever([S(`GHE ${gi + 1} de ${ghes.length}`).toUpperCase()], ML + 4, y + 2.5, 7.6, false, BR70);
      escrever(nomeL, ML + 4, y + 2.5 + lh(7.6), 13, true, BRANCO, { lh: lh(13, 1.2) });
      escrever(dir, PW - MR - 4, y + hc - 2.5 - hDir, 8, false, BR85, { lh: lh(8, 1.35), align: 'right' });
      y += hc + 3;
    }
    tabela([{ t: '', w: 0.3 }, { t: '', w: 0.7 }], [
      ['Atividades', vazio(g.descricao) ? '-' : g.descricao],
      ['Atividade proibida para menor de 18', g.menor18 === true ? { t: 'Sim', b: true, c: VERM } : g.menor18 === false ? 'Não' : 'Não informado'],
      ...(g.codigo_soc ? [['Código no SOC', g.codigo_soc]] : []),
    ], { cabecalho: false, kv: true });

    // ambientes
    const ambs = g.ambientes || [];
    h2('Ambientes', 16);
    if (!ambs.length) paragrafo('Nenhum ambiente registrado neste GHE.', 8.3, C2);
    else {
      tabela(
        [{ t: 'Ambiente', w: 0.19 }, { t: 'Paredes', w: 0.135 }, { t: 'Piso', w: 0.125 }, { t: 'Forro', w: 0.11 }, { t: 'Teto', w: 0.13 }, { t: 'Iluminação', w: 0.15 }, { t: 'Ventilação', w: 0.16 }],
        ambs.map(a => [{ t: a.nome || '-', b: true }, lista(a.paredes) || '-', lista(a.piso) || '-', lista(a.forro) || '-', lista(a.teto_telhado) || '-', lista(a.iluminacao) || '-', lista(a.ventilacao) || '-']),
      );
      const obs = ambs.filter(a => !vazio(a.outro) || !vazio(a.observacao));
      if (obs.length) {
        y += 1.5;
        for (const a of obs) {
          const segs = [{ t: `${a.nome}: `, b: true, c: NAVY }];
          if (!vazio(a.outro)) segs.push({ t: a.outro + (vazio(a.observacao) ? '' : '. ') });
          if (!vazio(a.observacao)) segs.push({ t: a.observacao });
          for (const l of rico(segs, CW, 7.8)) { garantir(lh(7.8, 1.45)); escreverRico([l], ML, y, 7.8, C1, lh(7.8, 1.45)); y += lh(7.8, 1.45); }
        }
      }
    }

    // riscos
    const riscos = g.riscos || [];
    h2('Riscos encontrados e medições', 34);
    {
      const ls = quebrar(legendaRiscos, CW, 7); const h = lh(7, 1.4);
      escrever(ls, ML, y, 7, false, C2, { lh: h }); y += ls.length * h + 2.4;
    }
    if (!riscos.length) paragrafo('Nenhum risco encontrado neste GHE.', 8.3, C2);
    for (const r of riscos) {
      const { pecas, junto } = pecasRisco(r, fotosDoRisco.get(r) || []);
      await caixa(cabecalhoRisco(r), pecas, junto, 0);
    }

    // evidências do GHE (ambientes e gerais do GHE)
    const fg = fotosDoGhe.get(g.id);
    if (fg.length) {
      const primeira = pecasFotos(fg.slice(0, 4), ML, CW, 4)[0].h;
      h2('Evidências do GHE', primeira);
      await gradeFotos(fg, 4);
    }
  }

  // =================== TREINAMENTOS, OBSERVAÇÕES, ASSINATURAS ===================
  novaPagina('Treinamentos, observações e assinaturas');
  h2('Treinamentos necessários por GHE', 12);
  {
    const ws = [0.24 * CW, 0.12 * CW, 0.64 * CW], px = 2, py = 1.5, sz = 8.3, hl = lh(sz, 1.35), hs = 7.2;
    const cab = () => {
      const h = lh(hs, 1.3) + 2 * py; let x = ML;
      ['GHE', 'NR', 'Treinamento'].forEach((t, i) => {
        doc.setFillColor(...FUNDO); doc.rect(x, y, ws[i], h, 'F'); doc.setDrawColor(...LINHA); doc.setLineWidth(0.25); doc.rect(x, y, ws[i], h, 'S');
        escrever([S(t).toUpperCase()], x + px, y + py, hs, true, C1, { lh: lh(hs, 1.3) }); x += ws[i];
      });
      y += h;
    };
    garantir(20); cab();
    const nrNum = s => parseInt(String(s || '').replace(/\D/g, ''), 10) || 999;
    for (const g of ghes) {
      const itens = (g.treinamentos || []).map(c => ({ nr: catTrein[c]?.nr || '-', nome: catTrein[c]?.nome || c })).sort((a, b) => nrNum(a.nr) - nrNum(b.nr));
      if (!itens.length) itens.push({ nr: '-', nome: 'Nenhum treinamento indicado' });
      const rows = itens.map(it => { const a = quebrar(it.nr, ws[1] - 2 * px, sz), b = quebrar(it.nome, ws[2] - 2 * px, sz); return { a, b, h: Math.max(a.length, b.length) * hl + 2 * py }; });
      const nomeL = quebrar(g.nome, ws[0] - 2 * px, sz, true);
      const hNome = nomeL.length * hl + 2 * py;
      const hGrupo = Math.max(rows.reduce((s, r) => s + r.h, 0), hNome);
      if (y + hGrupo > YMAX && hGrupo <= utilPagina() - 10) { quebraContinua(); cab(); }
      let i = 0;
      while (i < rows.length) {
        // desenha o máximo de linhas do grupo que couber; nome do GHE ocupa a altura toda do trecho
        let j = i, h = 0;
        while (j < rows.length && y + h + rows[j].h <= YMAX) h += rows[j++].h;
        if (j === i) { quebraContinua(); cab(); continue; }
        if (j === rows.length) h = Math.max(h, i === 0 ? hNome : 0);
        doc.setDrawColor(...LINHA); doc.setLineWidth(0.25); doc.rect(ML, y, ws[0], h, 'S');
        escrever(i === 0 ? nomeL : quebrar(`${g.nome} (cont.)`, ws[0] - 2 * px, sz, true), ML + px, y + py, sz, true, NAVY, { lh: hl });
        let yy = y;
        for (let k = i; k < j; k++) {
          const rr = rows[k], hh = k === j - 1 ? y + h - yy : rr.h;
          doc.rect(ML + ws[0], yy, ws[1], hh, 'S'); doc.rect(ML + ws[0] + ws[1], yy, ws[2], hh, 'S');
          escrever(rr.a, ML + ws[0] + px, yy + py, sz, false, NAVY, { lh: hl });
          escrever(rr.b, ML + ws[0] + ws[1] + px, yy + py, sz, false, NAVY, { lh: hl });
          yy += rr.h;
        }
        y += h; i = j;
        if (i < rows.length) { quebraContinua(); cab(); }
      }
    }
  }

  h2('Observações gerais', 8);
  paragrafo(vazio(av.observacoes) ? 'Sem observações.' : av.observacoes, 8.3, vazio(av.observacoes) ? C2 : NAVY);
  h2('Documentos solicitados à empresa', 8);
  paragrafo(vazio(av.documentos) ? 'Nenhum documento solicitado.' : av.documentos, 8.3, vazio(av.documentos) ? C2 : NAVY);

  if (fotosGerais.length) {
    h2('Evidências gerais', pecasFotos(fotosGerais.slice(0, 4), ML, CW, 4)[0].h);
    await gradeFotos(fotosGerais, 4);
  }

  // assinaturas (bloco inteiro junto)
  {
    const assinantes = [];
    if (!vazio(av.acompanhante_nome)) assinantes.push({
      img: dados.assinaturas?.acomp, nome: av.acompanhante_nome,
      papel: ['Acompanhante', av.acompanhante_cargo].filter(x => !vazio(x)).join(SEP),
      quando: av.assinatura_acomp_em ? `Assinado em ${dataHoraBR(av.assinatura_acomp_em)}` : 'Sem assinatura registrada',
    });
    assinantes.push({
      img: dados.assinaturas?.tec, nome: tec.nome || 'Técnico responsável', papel: papelTec,
      quando: av.assinatura_tec_em ? `Assinado na conclusão em ${dataHoraBR(av.assinatura_tec_em)}` : 'Sem assinatura registrada',
    });
    const colW = (CW - 8) / 2, hImg = 18;
    const textos = assinantes.map(a => [
      ...quebrar(a.nome, colW, 8, true).map(t => ({ t, b: true, c: NAVY })),
      ...quebrar(a.papel, colW, 8).map(t => ({ t, c: C1 })),
      ...quebrar(a.quando, colW, 8).map(t => ({ t, c: C2 })),
    ]);
    const hTxt = Math.max(...textos.map(t => t.length)) * lh(8, 1.4);
    const hBloco = hImg + 1.5 + hTxt;
    h2('Assinaturas', hBloco + 4);
    y += 3;
    for (let i = 0; i < assinantes.length; i++) {
      const a = assinantes[i], x = ML + i * (colW + 8);
      if (a.img) {
        try {
          const fmt = /^data:image\/png/i.test(a.img) ? 'PNG' : 'JPEG';
          const p = doc.getImageProperties(a.img), k = Math.min(60 / p.width, (hImg - 2) / p.height);
          doc.addImage(a.img, fmt, x + 4, y + hImg - 1 - p.height * k, p.width * k, p.height * k, `assinatura_${i}`, 'FAST');
        } catch { /* assinatura ilegível: fica só a linha */ }
      }
      doc.setDrawColor(...NAVY); doc.setLineWidth(0.3); doc.line(x, y + hImg, x + colW, y + hImg);
      textos[i].forEach((l, j) => escrever([l.t], x, y + hImg + 1.5 + j * lh(8, 1.4), 8, !!l.b, l.c));
    }
    y += hBloco + 6;
  }
  {
    const nota = 'Documento gerado pelo GRID a partir do registro de campo. Depois de concluída, a avaliação não se altera; mudanças geram nova revisão e as anteriores ficam no histórico.';
    const ls = quebrar(nota, CW, 7.4); garantir(ls.length * lh(7.4, 1.5));
    escrever(ls, ML, y, 7.4, false, C2, { lh: lh(7.4, 1.5) }); y += ls.length * lh(7.4, 1.5);
  }

  // =================== RODAPÉ EM TODAS AS PÁGINAS ===================
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LINHA); doc.setLineWidth(0.25); doc.line(ML, PH - 12.5, PW - MR, PH - 12.5);
    fonte(7, false, C3);
    const esq = doc.splitTextToSize(S(`GRID · Avaliação de Campo · ${cli.nome || ''}`), CW - 70)[0];
    doc.text(esq, ML, PH - 8.6);
    doc.text(S(`${numero} · rev. ${revisao} · página ${p} de ${total}`), PW - MR, PH - 8.6, { align: 'right' });
  }
  progresso('final', 1, 1);

  if (typeof Blob !== 'undefined') return doc.output('blob');
  return doc.output('arraybuffer');
}
