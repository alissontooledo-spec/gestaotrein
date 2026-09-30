// Gerador do PDF da "Avaliação de Campo" (módulo campo).
// v208 (proposta aprovada 27/09): relatório para leigo — resultado geral em cores, "o que a empresa
// precisa fazer", uma frase por risco, medição numa barra até o limite, fotos em 2 colunas e glossário.
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
    const linhaOrg = doc.splitTextToSize(S(`Avaliação de riscos · ${cli.nome || ''}`.toUpperCase()), CW - 48)[0];
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
  function pecasFotos(lista, x, w, porLinha, rotulo, razao = 0.75) {
    const gap = 3, cw = (w - gap * (porLinha - 1)) / porLinha, hImg = cw * razao, sz = 7, hlc = lh(7, 1.35);
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
  async function gradeFotos(lista, porLinha = 3, razao = 0.75) {
    for (const p of pecasFotos(lista, ML, CW, porLinha, null, razao)) {
      if (y + p.h > YMAX) quebraContinua();
      await p.draw(y); y += p.h;
    }
  }

  // ---------- motor de caixa (bloco de risco) ----------
  // cab(cont) -> {h, draw(top)}; pecas: [{h, draw(top), espaco?}]; junto = nº de peças que devem ficar com o cabeçalho
  async function caixa(cab, pecas, junto, padBaixo = 0, faixa = null) {
    const c0 = cab(false);
    const total = c0.h + pecas.reduce((s, p) => s + p.h, 0) + padBaixo;
    const minimo = c0.h + pecas.slice(0, junto).reduce((s, p) => s + p.h, 0) + (junto >= pecas.length ? padBaixo : 0);
    // o risco (e a 1ª linha de fotos) vai inteiro para a próxima página se não couber aqui mas couber lá;
    // as demais linhas de fotos podem continuar na página seguinte. Bloco maior que uma página: quebra por linha.
    if (y + minimo > YMAX) {
      if (minimo <= utilPagina() || YMAX - y < 45) quebraContinua();
    }
    let seg = y;
    const fechar = () => {
      doc.setDrawColor(...LINHA); doc.setLineWidth(0.3); doc.roundedRect(ML, seg, CW, y - seg, 2, 2, 'S');
      if (faixa) { doc.setFillColor(...faixa); doc.rect(ML, seg + 0.4, 1.6, Math.max(0, y - seg - 0.8), 'F'); }   // v208: cor da situação
    };
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

  // =====================================================================
  // v208 — relatório para leigo
  // =====================================================================
  const AMAR = [217, 138, 4], AMAR_TXT = [138, 90, 0], VERM_BG = [251, 234, 233], AZUL = [29, 78, 216];
  const BAR_V = [191, 232, 210], BAR_A = [253, 227, 167], BAR_R = [249, 195, 192], CINZA = [183, 192, 209];
  const ST = {
    V: { nome: 'Sob controle', fundo: VERDE_BG, cor: VERDE, faixa: VERDE, fazer: 'manter as medidas atuais' },
    A: { nome: 'Atenção', fundo: AMBAR_BG, cor: AMAR_TXT, faixa: AMAR, fazer: 'melhorar no prazo' },
    R: { nome: 'Ação imediata', fundo: VERM_BG, cor: VERM, faixa: VERM, fazer: 'corrigir antes de continuar' },
  };
  const stRisco = r => (r.classificacao === 'nao_aceitavel' ? 'R' : r.classificacao === 'toleravel' ? 'A' : r.classificacao === 'aceitavel' ? 'V' : null);
  const stPior = rs => (rs.some(r => stRisco(r) === 'R') ? 'R' : rs.some(r => stRisco(r) === 'A') ? 'A' : rs.length ? 'V' : null);
  const EXPO_TXT = { P: 'durante toda a jornada', I: 'de vez em quando', E: 'raramente' };
  const PROB_TXT = { 1: 'muito baixa', 2: 'baixa', 3: 'possível', 4: 'alta', 5: 'muito alta' };
  const SEV_TXT = { 1: 'leve', 2: 'moderada', 3: 'grave', 4: 'gravíssima', 5: 'crítica ou fatal' };
  const NOME_CONC = { ins: 'Insalubridade', per: 'Periculosidade', ae: 'Aposentadoria especial' };
  /* nível de ação (a partir dele, "atenção") — o limite vem da medição */
  const ACAO = { '460': 80, '466': 0.5, '1001': 9.1, '534': 2.5 };
  const util = t => !vazio(t) && !/^nada a acrescentar\.?$/i.test(String(t).trim());
  const numTxt = v => { const m = String(v ?? '').replace(/\s/g, '').match(/-?\d+(?:[.,]\d+)?/); return m ? Number(m[0].replace(',', '.')) : null; };
  const fmt = n => String(Math.round(n * 100) / 100).replace('.', ',');
  const valorBr = v => { const n = numTxt(v); return n == null ? String(v ?? '') : String(v).trim().match(/^-?\d+(?:[.,]\d+)?$/) ? fmt(n) : String(v); };
  const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;
  const nomeGrupo = g => `Grupo ${g.nome}`;

  function pilula(t, xr, top, fundo, cor, size = 7, alinhar = 'direita') {
    fonte(size, true); const w = doc.getTextWidth(S(t)) + 5, h = 4.6;
    const x = alinhar === 'direita' ? xr - w : xr;
    doc.setFillColor(...fundo); doc.roundedRect(x, top, w, h, 2.3, 2.3, 'F');
    fonte(size, true, cor); doc.text(S(t), x + w / 2, top + h / 2 + size * PT * 0.36, { align: 'center' });
    return w;
  }
  function circulo(cx, cy, r, cor) { doc.setFillColor(...cor); doc.circle(cx, cy, r, 'F'); }

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

  const todos = ghes.flatMap(g => (g.riscos || []).map(r => ({ g, r })));
  const nRiscos = todos.length;
  const conta = k => todos.filter(x => stRisco(x.r) === k).length;
  const nV = conta('V'), nA = conta('A'), nR = conta('R');
  const geral = nR ? 'R' : nA ? 'A' : 'V';
  const flagSim = (g, k) => (g.riscos || []).some(r => r[k] === 'S');
  const grauMax = g => (g.riscos || []).filter(r => r.ins === 'S' && r.grau).map(r => r.grau).sort((a, b) => parseInt(b) - parseInt(a))[0];
  const pessoas = g => {
    const sg = (av.soc?.ghes || []).find(x => g.codigo_soc && (x.codigo === g.codigo_soc || x.nome === g.codigo_soc));
    return sg?.total_funcionarios || 0;
  };
  const papelTec = [tec.formacao, [tec.sigla_conselho, tec.conselho_classe && `${tec.conselho_classe}${tec.uf_registro ? '/' + tec.uf_registro : ''}`].filter(Boolean).join(' ')].filter(x => !vazio(x)).join(SEP);
  // treinamentos agrupados (quem precisa)
  const trein = new Map();
  for (const g of ghes) for (const c of g.treinamentos || []) {
    if (!trein.has(c)) trein.set(c, { nr: catTrein[c]?.nr || '', nome: catTrein[c]?.nome || c, grupos: [] });
    trein.get(c).grupos.push(g.nome);
  }
  const nrNum = s => parseInt(String(s || '').replace(/\D/g, ''), 10) || 999;
  const treinLista = [...trein.values()].sort((a, b) => nrNum(a.nr) - nrNum(b.nr) || a.nome.localeCompare(b.nome, 'pt-BR'));
  /* v222: o que a empresa ainda não enviou (lista estruturada, PASSO-73) vem primeiro. */
  const dataBrPdf = (v) => { const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };
  const pendEmp = (Array.isArray(av.pendencias_empresa) ? av.pendencias_empresa : []).filter(p => p && !p.resolvido_em)
    .map(p => `${p.nome || 'Documento'}${p.detalhe ? ': ' + p.detalhe : ''}${p.risco_nome ? ` (risco ${p.risco_nome})` : ''}${p.prazo ? ` · prometido para ${dataBrPdf(p.prazo)}` : ''}`);
  const documentos = [...pendEmp, ...String(av.documentos || '').split(/\n|;/).map(t => t.replace(/^\s*[-•*\d.)]+\s*/, '').trim()).filter(Boolean)];
  const conf = Array.isArray(av.funcionarios?.lista) ? av.funcionarios.lista : [];
  const mudancas = conf.filter(p => p.origem === 'empresa' || p.situacao === 'saiu' || p.situacao === 'mudou');
  /* v223: plano de ação 5W2H (PASSO-74). Avaliação sem plano (antes da v223) usa o resumo antigo. */
  const ORD_PRI = { imediata: 0, alta: 1, media: 2, baixa: 3 };
  const PRI = { imediata: ['Imediata', VERM_BG, VERM], alta: ['Alta', [253, 229, 210], [154, 52, 18]], media: ['Média', AMBAR_BG, AMAR_TXT], baixa: ['Baixa', VERDE_BG, VERDE] };
  const planoAcoes = (Array.isArray(av.plano?.acoes) ? av.plano.acoes : []).slice()
    .sort((a, b) => (parseInt(String(a.numero).replace(/\D/g, '')) || 0) - (parseInt(String(b.numero).replace(/\D/g, '')) || 0));
  const temPlanoPdf = planoAcoes.length > 0;
  const acaoDoRisco = new Map(planoAcoes.filter(a => a.risco_uid).map(a => [a.risco_uid, a]));
  const ondeAcao = a => a.toda_empresa ? 'Toda a empresa' : `Grupo ${a.ghe || ''}`;
  const cortarTxt = (t, n) => { const x = String(t ?? '').replace(/\s+/g, ' ').trim(); return x.length <= n ? x : x.slice(0, n - 1).replace(/\s+\S*$/, '') + '...'; };

  // "O que a empresa precisa fazer"
  const fazer = [];
  for (const k of ['R', 'A']) for (const { g, r } of todos.filter(x => stRisco(x.r) === k)) {
    fazer.push({
      t: `${nomeGrupo(g)}: ${k === 'R' ? 'corrigir' : 'melhorar o controle de'} ${r.nome}`,
      d: util(r.medidas_adm) ? r.medidas_adm : k === 'R' ? 'Corrigir antes de continuar a atividade.' : 'Reforçar as medidas de controle deste risco.',
      prazo: k === 'R' ? ['imediato', VERM_BG, VERM] : ['até 90 dias', AMBAR_BG, AMAR_TXT],
    });
  }
  for (const { g, r } of todos) {
    if (stRisco(r) === 'V' && r.medicao?.situacao === 'acima') fazer.push({ t: `${nomeGrupo(g)}: rever ${r.nome}`, d: 'A medição de hoje ficou acima do limite da lei.', prazo: ['imediato', VERM_BG, VERM] });
  }
  if (temPlanoPdf) {
    fazer.length = 0;
    for (const a of planoAcoes.slice().sort((x, y) => (ORD_PRI[x.prioridade] ?? 9) - (ORD_PRI[y.prioridade] ?? 9))) {
      const pr = PRI[a.prioridade] || PRI.media;
      fazer.push({ t: `${a.numero} · ${a.o_que_base || String(a.o_que || '').replace(/\s·\s*A-\d+$/, '')}`,
        d: `${ondeAcao(a)}${a.risco ? SEP + a.risco : ''}${a.quem ? SEP + 'responsável: ' + a.quem : ''}`,
        prazo: [`${pr[0]} · até ${dataBrPdf(a.prazo)}`, pr[1], pr[2]] });
    }
  }
  if (treinLista.length && !temPlanoPdf) fazer.push({ t: 'Fazer os treinamentos indicados', d: `${plural(treinLista.length, 'treinamento', 'treinamentos')}, listados na última página (quem precisa e por quê).`, prazo: ['até 90 dias', AMBAR_BG, AMAR_TXT] });
  if (documentos.length) fazer.push({ t: 'Enviar os documentos pedidos na visita', d: `${plural(documentos.length, 'documento', 'documentos')}, listados na última página.`, prazo: ['até 30 dias', VERDE_BG, VERDE] });
  if (mudancas.length) fazer.push({ t: 'Atualizar o cadastro de funcionários', d: `${plural(mudancas.length, 'mudança encontrada', 'mudanças encontradas')} na conferência com a empresa (última página).`, prazo: ['até 30 dias', VERDE_BG, VERDE] });

  progresso('texto', 0, 1);

  // =================== PÁGINA 1 — RESULTADO ===================
  {
    fonte(8.5, true, C2); doc.text(S('SEGURANÇA DO TRABALHO'), ML, MT + 3);
    fonte(17, true, NAVY); doc.text(S('Avaliação de Riscos no Trabalho'), ML, MT + 11);
    fonte(9, false, C2); doc.text(S('Resultado da visita técnica, explicado em linguagem simples'), ML, MT + 16.5);
    doc.setFillColor(...AMBAR); doc.rect(ML, MT + 19, 26, 1.1, 'F');
    direita([{ t: 'Nº ', c: C2 }, { t: numero, b: true }], PW - MR, MT + 3, 8.5);
    direita([{ t: 'Revisão ', c: C2 }, { t: String(revisao), b: true }], PW - MR, MT + 8, 8.5);
    const sit = av.situacao === 'concluida' ? ['Concluída', VERDE_BG, VERDE] : av.situacao === 'cancelada' ? ['Cancelada', VERM_BG, VERM] : ['Em aberto', AMBAR_BG, AMAR_TXT];
    pilula(sit[0], PW - MR, MT + 10.2, sit[1], sit[2], 7);
    doc.setDrawColor(...NAVY); doc.setLineWidth(0.6); doc.line(ML, MT + 23, PW - MR, MT + 23);
    topo = y = MT + 23 + 4; titulo = 'Avaliação de Riscos no Trabalho';

    // empresa
    {
      const end = [cli.endereco, [cli.cidade, cli.uf].filter(Boolean).join('/')].filter(x => !vazio(x)).join(SEP);
      const visita = [dataBR(av.data_visita), av.hora_inicio ? `às ${hora(av.hora_inicio)}` : ''].filter(Boolean).join(', ');
      const itens = [
        ['Empresa avaliada', cli.nome || '-', true], ['CNPJ', cli.cnpj || '-'],
        ['Endereço', end || '-'], ['Data da visita', visita || '-'],
        ['Quem acompanhou', vazio(av.acompanhante_nome) ? 'Sem acompanhante' : av.acompanhante_nome + (vazio(av.acompanhante_cargo) ? '' : ` (${av.acompanhante_cargo})`)],
        ['Técnico responsável', [tec.nome, papelTec].filter(x => !vazio(x)).join(SEP) || '-'],
      ];
      const colW = (CW - 8 - 6) / 2, hLab = lh(6.4, 1.3), hVal = lh(8.6, 1.3);
      const blocos = itens.map(([l, v, b]) => ({ l, v: quebrar(v, colW, 8.6, !!b).slice(0, 2), b }));
      const linhas = [];
      for (let i = 0; i < blocos.length; i += 2) linhas.push(Math.max(...blocos.slice(i, i + 2).map(x => hLab + x.v.length * hVal)) + 1.4);
      const h = linhas.reduce((s, x) => s + x, 0) + 4.4;
      doc.setFillColor(246, 248, 251); doc.roundedRect(ML, y, CW, h, 2, 2, 'F');
      let yy = y + 2.6;
      linhas.forEach((hl2, i) => {
        blocos.slice(i * 2, i * 2 + 2).forEach((bk, j) => {
          const x = ML + 4 + j * (colW + 6);
          escrever([S(bk.l).toUpperCase()], x, yy, 6.4, false, C2, { lh: hLab });
          escrever(bk.v, x, yy + hLab, 8.6, !!bk.b, NAVY, { lh: hVal });
        });
        yy += hl2;
      });
      y += h + 4;
    }

    // resultado geral
    {
      const st = ST[geral];
      const titulo2 = nRiscos === 0 ? 'Resultado geral: nenhum risco encontrado' : geral === 'R' ? 'Resultado geral: exige ação imediata' : geral === 'A' ? 'Resultado geral: pede atenção' : 'Resultado geral: sob controle';
      const segs = [{ t: 'Avaliamos ' }, { t: plural(ghes.length, 'grupo de trabalhadores', 'grupos de trabalhadores'), b: true, c: NAVY }, { t: ' e encontramos ' }, { t: plural(nRiscos, 'risco', 'riscos'), b: true, c: NAVY }, { t: '. ' }];
      if (nR) segs.push({ t: `${nR === 1 ? '1 exige' : nR + ' exigem'} ação imediata`, b: true, c: VERM }, { t: '. ' });
      else if (nRiscos) segs.push({ t: 'Nenhum exige parar o trabalho. ' });
      if (nA) segs.push({ t: `${nA === 1 ? '1 precisa' : nA + ' precisam'} de melhoria`, b: true, c: NAVY }, { t: ' nos próximos meses' + (nV ? '; ' : '.') });
      if (nV) segs.push({ t: nA || nR ? `${nV === 1 ? 'o outro está' : `os outros ${nV} estão`} sob controle com as medidas atuais.` : `${nV === 1 ? 'Ele está' : `Todos os ${nV} estão`} sob controle com as medidas atuais.` });
      const ls = rico(segs, CW - 30, 9.2), hl2 = lh(9.2, 1.45);
      const h = Math.max(lh(12.5) + ls.length * hl2 + 6, 22);
      doc.setFillColor(...st.fundo); doc.roundedRect(ML, y, CW, h, 3, 3, 'F');
      circulo(ML + 11, y + h / 2, 6.2, st.faixa);
      fonte(15, true, BRANCO); doc.text(S(geral === 'V' ? 'OK' : '!'), ML + 11, y + h / 2 + 1.9, { align: 'center' });
      escrever([S(titulo2)], ML + 22, y + 3, 12.5, true, NAVY);
      escreverRico(ls, ML + 22, y + 3 + lh(12.5), 9.2, C1, hl2);
      y += h + 3;
    }
    // contadores
    {
      const qw = (CW - 6) / 3, h = 15;
      [[nV, 'Sob controle', 'manter como está', 'V'], [nA, 'Atenção', temPlanoPdf ? 'prazos no plano de ação' : 'melhorar em até 90 dias', 'A'], [nR, 'Ação imediata', 'corrigir antes de continuar', 'R']].forEach(([n, t, d, k], i) => {
        const x = ML + i * (qw + 3), st = ST[k];
        doc.setDrawColor(...LINHA); doc.setLineWidth(0.3); doc.roundedRect(x, y, qw, h, 2, 2, 'S');
        doc.setFillColor(...st.faixa); doc.rect(x, y + 0.4, 1.4, h - 0.8, 'F');
        fonte(16, true, k === 'A' ? AMAR_TXT : st.cor); doc.text(S(String(n)), x + 5, y + 7.2);
        fonte(8.4, false, C1); doc.text(S(t), x + 5, y + 11);
        fonte(6.8, false, C2); doc.text(S(d), x + 5, y + 13.8);
      });
      y += h + 1;
    }

    // o que a empresa precisa fazer
    h2('O que a empresa precisa fazer', 14);
    if (!fazer.length) paragrafo('Manter as medidas atuais. Nenhuma ação nova é necessária neste momento.', 8.8, VERDE);
    const MAX = 8;
    fazer.slice(0, MAX).forEach((it, i) => {
      const wTxt = CW - 9 - 26;
      const tl = quebrar(it.t, wTxt, 9, true), dl = quebrar(it.d, wTxt, 8).slice(0, 2);
      const h = tl.length * lh(9, 1.35) + dl.length * lh(8, 1.35) + 3.2;
      garantir(h);
      circulo(ML + 2.8, y + 3.6, 2.6, NAVY);
      fonte(7.5, true, BRANCO); doc.text(S(String(i + 1)), ML + 2.8, y + 4.6, { align: 'center' });
      escrever(tl, ML + 9, y + 1.4, 9, true, NAVY, { lh: lh(9, 1.35) });
      escrever(dl, ML + 9, y + 1.4 + tl.length * lh(9, 1.35), 8, false, C2, { lh: lh(8, 1.35) });
      pilula(it.prazo[0], PW - MR, y + 1.6, it.prazo[1], it.prazo[2], 7);
      y += h;
      doc.setDrawColor(238, 241, 246); doc.setLineWidth(0.25); doc.line(ML, y, PW - MR, y);
    });
    if (fazer.length > MAX) paragrafo(temPlanoPdf ? `E mais ${fazer.length - MAX} ${fazer.length - MAX === 1 ? 'ação' : 'ações'}, na página Plano de ação.` : `E mais ${fazer.length - MAX} itens, detalhados nas páginas de cada grupo.`, 8, C2);

    // resumo por grupo
    h2('Resumo por grupo de trabalhadores', 30);
    {
      const colW = (CW - 4) / 2;
      const cartoes = ghes.map(g => {
        const rs = g.riscos || [], k = stPior(rs), n = pessoas(g);
        const quem = [lista(g.funcoes) || lista(g.setores) || '-', n ? plural(n, 'pessoa', 'pessoas') : ''].filter(Boolean).join(SEP);
        const ql = quebrar(quem, colW - 8, 7.8).slice(0, 2);
        const nomeL = quebrar(g.nome, colW - 34, 10.5, true).slice(0, 2);
        const partes = [['V', 'sob controle'], ['A', 'atenção'], ['R', 'ação imediata']].map(([kk, t]) => [rs.filter(r => stRisco(r) === kk).length, t]).filter(([q]) => q).map(([q, t]) => `${q} ${t}`);
        const leis = [
          ['Insalubridade', flagSim(g, 'ins') ? `Sim${grauMax(g) ? ' (' + grauMax(g) + ')' : ''}` : 'Não', flagSim(g, 'ins')],
          ['Periculosidade', flagSim(g, 'per') ? 'Sim' : 'Não', flagSim(g, 'per')],
          ['Aposentadoria especial', flagSim(g, 'ae') ? 'Sim' : 'Não', flagSim(g, 'ae')],
          ['Menor de 18', g.menor18 === true ? 'Proibido' : g.menor18 === false ? 'Permitido' : 'Não informado', g.menor18 === true],
        ];
        const h = 3 + nomeL.length * lh(10.5, 1.25) + ql.length * lh(7.8, 1.35) + 6 + 2 * lh(7.4, 1.5) + 4;
        return { g, k, ql, nomeL, partes, leis, h, rs };
      });
      for (let i = 0; i < cartoes.length; i += 2) {
        const par = cartoes.slice(i, i + 2), h = Math.max(...par.map(c => c.h));
        garantir(h + 3);
        par.forEach((c, j) => {
          const x = ML + j * (colW + 4); let yy = y + 3;
          doc.setDrawColor(...LINHA); doc.setLineWidth(0.3); doc.roundedRect(x, y, colW, h, 2.4, 2.4, 'S');
          escrever(c.nomeL, x + 4, yy, 10.5, true, NAVY, { lh: lh(10.5, 1.25) });
          if (c.k) pilula(ST[c.k].nome, x + colW - 3, yy, ST[c.k].fundo, ST[c.k].cor, 7);
          yy += c.nomeL.length * lh(10.5, 1.25);
          escrever(c.ql, x + 4, yy, 7.8, false, C2, { lh: lh(7.8, 1.35) }); yy += c.ql.length * lh(7.8, 1.35) + 1;
          let dx = x + 4.8;
          for (const r of c.rs.slice(0, 14)) { const kk = stRisco(r); circulo(dx, yy + 1.8, 1.4, kk ? ST[kk].faixa : CINZA); dx += 4; }
          fonte(7.2, false, C2); doc.text(S(c.rs.length ? `${plural(c.rs.length, 'risco', 'riscos')}: ${c.partes.join(', ') || 'a classificar'}` : 'Nenhum risco encontrado'), dx + 1, yy + 2.8);
          yy += 5;
          doc.setDrawColor(238, 241, 246); doc.line(x + 4, yy, x + colW - 4, yy); yy += 1.2;
          c.leis.forEach(([l, v, alerta], n) => {
            const cx = x + 4 + (n % 2) * ((colW - 8) / 2), cy = yy + Math.floor(n / 2) * lh(7.4, 1.5);
            escreverRico([[{ t: S(`${l}: `), b: false, c: C1 }, { t: S(v), b: true, c: alerta ? VERM : NAVY }]], cx, cy, 7.4, C1, lh(7.4, 1.5));
          });
        });
        y += h + 3;
      }
    }
    // legenda das cores
    {
      garantir(8);
      let x = ML; const yy = y + 3;
      fonte(7.6, true, NAVY); doc.text(S('Cores:'), x, yy + 1); x += doc.getTextWidth(S('Cores:')) + 3;
      for (const k of ['V', 'A', 'R']) {
        circulo(x + 1.5, yy, 1.6, ST[k].faixa); x += 4.5;
        const t = `${ST[k].nome} — ${ST[k].fazer}`;
        fonte(7.4, false, C1); doc.text(S(t), x, yy + 1); x += doc.getTextWidth(S(t)) + 5;
      }
      y += 7;
    }
  }

  // =================== UM GRUPO (GHE) POR PÁGINA ===================
  function medicaoPeca(r, x, w) {
    const m = r.medicao || {}, il = r.iluminacao || {};
    const ehIlu = !vazio(il.nivel_encontrado), temMed = !vazio(m.resultado);
    if (!ehIlu && !temMed) return null;
    let hoje, un, lim, acao = null, esquerda, direitaTxt, invertida = false;
    if (ehIlu) {
      hoje = numTxt(il.nivel_encontrado); un = 'lux'; lim = numTxt(il.nivel_minimo); invertida = true;
      esquerda = [{ t: `Medição de hoje: ${valorBr(il.nivel_encontrado)} lux`, b: true, c: NAVY }];
      if (!vazio(il.irc)) esquerda.push({ t: ` (IRC ${valorBr(il.irc)})` });
      direitaTxt = lim != null ? [{ t: 'mínimo recomendado: ' }, { t: `${fmt(lim)} lux`, b: true, c: NAVY }] : [];
    } else {
      hoje = numTxt(m.resultado); un = m.unidade || ''; lim = numTxt(m.limite); acao = ACAO[String(r.codigo)] ?? null;
      if (acao != null && lim != null && acao >= lim) acao = null;
      esquerda = [{ t: `Medição de hoje: ${valorBr(m.resultado)} ${un}`.trim(), b: true, c: NAVY }];
      if (r.soc?.medicao?.valor) esquerda.push({ t: ` · na visita anterior${r.soc.medicao.data ? ` (${r.soc.medicao.data})` : ''}: ${valorBr(r.soc.medicao.valor)} ${un}`.trimEnd() });
      if (!vazio(m.metodo)) esquerda.push({ t: `${SEP}${m.metodo}` });
      direitaTxt = lim != null ? [...(acao != null ? [{ t: `atenção a partir de ${fmt(acao)}${SEP}` }] : []), { t: 'limite da lei: ' }, { t: `${fmt(lim)} ${un}`.trim(), b: true, c: NAVY }]
        : !vazio(m.limite) ? [{ t: `limite: ${m.limite}` }] : [];
    }
    const barra = hoje != null && lim != null && lim > 0;
    fonte(8.2); const wDir = direitaTxt.reduce((s, r2) => { fonte(8.2, !!r2.b); return s + doc.getTextWidth(S(r2.t)); }, 0);
    const le = rico(esquerda, w - 6 - (wDir ? wDir + 4 : 0), 8.2);
    const hTop = le.length * lh(8.2, 1.35);
    const h = 3 + hTop + (barra ? 10 : 1) + 1;
    return {
      h: h + 1.6,
      draw(top) {
        doc.setDrawColor(...LINHA); doc.setLineWidth(0.3); doc.roundedRect(x, top, w, h, 1.5, 1.5, 'S');
        escreverRico(le, x + 3, top + 2, 8.2, C1, lh(8.2, 1.35));
        if (wDir) escreverRico([direitaTxt.map(r2 => ({ ...r2, t: S(r2.t) }))], x + w - 3 - wDir, top + 2, 8.2, C1, lh(8.2, 1.35));
        if (!barra) return;
        const bx = x + 3, bw = w - 6, by = top + 3 + hTop + 1.2, bh = 2.8;
        const max = invertida ? Math.max(lim * 1.6, hoje * 1.1) : Math.max(lim * 1.1, hoje * 1.05);
        const px = v => bx + Math.max(0, Math.min(1, v / max)) * bw;
        if (invertida) {
          doc.setFillColor(...BAR_A); doc.rect(bx, by, px(lim) - bx, bh, 'F');
          doc.setFillColor(...BAR_V); doc.rect(px(lim), by, bx + bw - px(lim), bh, 'F');
        } else {
          doc.setFillColor(...BAR_V); doc.rect(bx, by, (acao != null ? px(acao) : px(lim)) - bx, bh, 'F');
          if (acao != null) { doc.setFillColor(...BAR_A); doc.rect(px(acao), by, px(lim) - px(acao), bh, 'F'); }
          doc.setFillColor(...BAR_R); doc.rect(px(lim), by, bx + bw - px(lim), bh, 'F');
        }
        doc.setFillColor(...NAVY); doc.rect(px(hoje) - 0.6, by - 1.1, 1.2, bh + 2.2, 'F');
        fonte(6.8, false, C2);
        const yl = by + bh + 3.2;
        doc.text('0', bx, yl);
        const limTxt = `${fmt(lim)} ${invertida ? 'mínimo' : 'limite'}`;
        const wl = doc.getTextWidth(S(limTxt)), xl = Math.min(px(lim) - wl / 2, bx + bw - wl);
        doc.text(S(limTxt), xl, yl);
        const hjTxt = `hoje ${fmt(hoje)}`, wh = doc.getTextWidth(S(hjTxt));
        let xh = Math.max(bx + 4, px(hoje) - wh / 2);
        if (xh + wh > xl - 2 && xh < xl + wl + 2) xh = px(hoje) < px(lim) ? xl - wh - 2 : xl + wl + 2;
        if (xh >= bx + 3 && xh + wh <= bx + bw) { fonte(6.8, true, NAVY); doc.text(S(hjTxt), xh, yl); }
      },
    };
  }

  function cabRisco(r) {
    const k = stRisco(r), cat = `${CATEGORIAS[r.categoria] || 'Outro'}${r.nao_listado ? ' (não listado)' : ''}`.toUpperCase();
    return cont => {
      const x = ML + 5, iw = CW - 9;
      fonte(7, true); const pw = k ? doc.getTextWidth(S(ST[k].nome)) + 5 : 0;
      fonte(7); const cw = doc.getTextWidth(S(cat));
      const nomeL = quebrar(cont ? `${r.nome} (continuação)` : r.nome, iw - pw - cw - 8, 10.5, true);
      const hc = nomeL.length * lh(10.5, 1.25) + 3.4;
      return {
        h: hc,
        draw(top) {
          escrever(nomeL, x, top + 2.2, 10.5, true, NAVY, { lh: lh(10.5, 1.25) });
          let xr = ML + CW - 3;
          if (k) xr -= pilula(ST[k].nome, xr, top + 2.2, ST[k].fundo, ST[k].cor, 7) + 3;
          fonte(7, false, C2); doc.text(S(cat), xr, top + 5.4, { align: 'right' });
        },
      };
    };
  }

  function pecasRiscoLeigo(r, fotosRisco) {
    const x = ML + 5, iw = CW - 9, sz = 8.6, hl = lh(sz, 1.45), pecas = [];
    const espaco = h => pecas.push({ h, espaco: true, draw() {} });
    const linhas = (segs, size = sz, cor = C1) => { for (const l of rico(segs, iw, size)) pecas.push({ h: lh(size, 1.45), draw: top => escreverRico([l], x, top, size, cor, lh(size, 1.45)) }); };
    // frase simples
    const f = [];
    if (r.exposicao) f.push({ t: 'Exposição ' }, { t: `${EXPO_TXT[r.exposicao] || ''} (${(EXPOSICAO[r.exposicao] || '').toLowerCase()})`, b: true, c: NAVY }, { t: '. ' });
    if (r.probabilidade) f.push({ t: 'Chance de causar dano: ' }, { t: PROB_TXT[r.probabilidade] || '', b: true, c: NAVY }, { t: r.severidade ? '; ' : '. ' });
    if (r.severidade) f.push({ t: 'se acontecer, lesão ' }, { t: SEV_TXT[r.severidade] || '', b: true, c: NAVY }, { t: '. ' });
    /* v222: nível pela matriz de risco (P × S) */
    if (r.nivel?.nome) f.push({ t: 'Nível de risco pela matriz: ' }, { t: `${r.nivel.nome}${CLASSIF[r.nivel.aceitabilidade] ? ' (' + CLASSIF[r.nivel.aceitabilidade][0].toLowerCase() + ')' : ''}`, b: true, c: NAVY }, { t: '. ' });
    const sitMed = r.medicao?.situacao || (r.iluminacao?.nivel_minimo && !vazio(r.iluminacao?.nivel_encontrado) ? (Number(r.iluminacao.nivel_encontrado) >= Number(r.iluminacao.nivel_minimo) ? 'atende' : 'abaixo_min') : null);
    if (sitMed === 'abaixo') f.push({ t: 'O nível medido está ' }, { t: 'abaixo do limite', b: true, c: VERDE }, { t: ' da lei.' });
    if (sitMed === 'acima') f.push({ t: 'O nível medido está ' }, { t: 'acima do limite', b: true, c: VERM }, { t: ' da lei.' });
    if (sitMed === 'atende') f.push({ t: 'A iluminação ' }, { t: 'atende ao mínimo', b: true, c: VERDE }, { t: ' recomendado.' });
    if (sitMed === 'abaixo_min') f.push({ t: 'A iluminação está ' }, { t: 'abaixo do mínimo', b: true, c: VERM }, { t: ' recomendado.' });
    if (f.length) linhas(f);
    if (!vazio(r.analise)) linhas([{ t: 'Como acontece: ', b: true, c: NAVY }, { t: r.analise }]);
    if (!vazio(r.fonte)) linhas([{ t: 'Vem de: ', b: true, c: NAVY }, { t: r.fonte }]);
    espaco(1.2);
    const med = medicaoPeca(r, x, iw); if (med) pecas.push(med);
    const destaque = (segs, fundo, borda) => {
      const ls = rico(segs, iw - 5, 8.4), h = ls.length * lh(8.4, 1.45) + 3;
      pecas.push({ h: h + 1.6, draw(top) {
        doc.setFillColor(...fundo); doc.roundedRect(x, top, iw, h, 1.2, 1.2, 'F');
        if (borda) { doc.setFillColor(...borda); doc.rect(x, top, 0.8, h, 'F'); }
        escreverRico(ls, x + 2.5, top + 1.5, 8.4, C1, lh(8.4, 1.45));
      } });
    };
    const k = stRisco(r);
    const acR = acaoDoRisco.get(r.uid);
    if (acR) {
      const pr = PRI[acR.prioridade] || PRI.media;
      destaque([{ t: 'O que fazer: ', b: true, c: NAVY }, { t: `${acR.o_que_base || ''}. ` }, { t: `Ação ${acR.numero} do plano de ação`, b: true, c: NAVY },
        { t: ` · prioridade ${pr[0].toLowerCase()} · até ${dataBrPdf(acR.prazo)}.` }], acR.prioridade === 'imediata' ? VERM_BG : acR.prioridade === 'baixa' ? VERDE_BG : AMBAR_BG);
    } else if (k === 'R' || k === 'A' || util(r.medidas_adm)) {
      const txt = util(r.medidas_adm) ? r.medidas_adm : util(r.nivel?.acao) ? r.nivel.acao : k === 'R' ? 'Corrigir antes de continuar a atividade.' : 'Reforçar as medidas de controle deste risco no prazo de até 90 dias.';
      destaque([{ t: 'O que fazer: ', b: true, c: NAVY }, { t: txt }], k === 'V' ? VERDE_BG : k === 'R' ? VERM_BG : AMBAR_BG);
    }
    const prot = [];
    if (!vazio(r.epc)) prot.push({ t: r.epc });
    if (!vazio(r.epi) && !/^n[aã]o se aplica$/i.test(String(r.epi).trim())) {
      if (prot.length) prot.push({ t: '; ' });
      prot.push({ t: r.epi });
      const ef = { S: 'funciona', N: 'não funciona bem', SNS: 'funciona, mas não é suficiente' }[r.epi_eficaz];
      if (ef) prot.push({ t: ' — ' }, { t: ef, b: true, c: r.epi_eficaz === 'S' ? VERDE : VERM });
    }
    if (prot.length) linhas([{ t: 'Proteções que já existem: ', b: true, c: NAVY }, ...prot], 8.4);
    if (r.pendente) {
      const quem = r.pendente.quem === 'empresa' ? 'depende da empresa' : 'depende do técnico';
      destaque([{ t: 'Ainda falta: ', b: true, c: NAVY }, { t: `${r.pendente.texto || 'sem descrição'} (${quem})` }], AMBAR_BG, AMBAR);
    }
    const conc = CONCLUSOES[r.categoria] || [];
    if (conc.length) {
      const segs = [];
      conc.forEach((kk, i) => {
        if (i) segs.push({ t: '     ' });
        const v = r[kk] === 'S' ? `Sim${kk === 'ins' && r.grau ? ` (${r.grau})` : ''}` : r[kk] === 'N' ? 'Não' : '-';
        segs.push({ t: `${NOME_CONC[kk]}: `, c: C2 }, { t: v, b: true, c: r[kk] === 'S' ? VERM : NAVY });
      });
      pecas.push({ h: 1.6, draw(top) { doc.setDrawColor(238, 241, 246); doc.setLineWidth(0.25); doc.line(x, top + 0.8, x + iw, top + 0.8); } });
      linhas(segs, 7.8);
    }
    espaco(1.4);
    const nFixas = pecas.length;
    if (fotosRisco.length) {
      const fp = pecasFotos(fotosRisco, x, iw, 3, 'Fotos deste risco', 0.62);
      fp[fp.length - 1].h -= 2.4;
      pecas.push(...fp);
      return { pecas, junto: nFixas + 1 };
    }
    return { pecas, junto: nFixas };
  }

  for (let gi = 0; gi < ghes.length; gi++) {
    const g = ghes[gi];
    novaPagina(`Grupo ${gi + 1} de ${ghes.length} · ${g.nome}`);
    progresso('texto', gi + 1, ghes.length + 1);
    // quem, o que faz, onde
    {
      const n = pessoas(g);
      const quem = `${lista(g.funcoes) || '-'}${(g.setores || []).length ? ` (setor${g.setores.length > 1 ? 'es' : ''} ${lista(g.setores)})` : ''}${n ? SEP + plural(n, 'pessoa', 'pessoas') : ''}`;
      const ondeAmb = (g.ambientes || []).map(a => {
        const p = [['paredes', a.paredes], ['piso', a.piso], ['forro', a.forro], ['teto', a.teto_telhado], ['iluminação', a.iluminacao], ['ventilação', a.ventilacao]]
          .filter(([, v]) => !vazio(lista(v))).map(([l, v]) => `${l} ${lista(v).toLowerCase()}`);
        const extra = [a.outro, a.observacao].filter(x => !vazio(x)).join('. ');
        return `${a.nome || g.nome}${p.length ? ': ' + p.join(', ') : ''}${extra ? '. ' + extra : ''}`;
      });
      const segs = [[{ t: 'Quem está neste grupo: ', b: true, c: NAVY }, { t: quem }]];
      if (!vazio(g.descricao)) segs.push([{ t: 'O que fazem: ', b: true, c: NAVY }, { t: g.descricao }]);
      if (ondeAmb.length) segs.push([{ t: 'Onde: ', b: true, c: NAVY }, { t: ondeAmb.join(' | ') }]);
      const w = CW - 8, hl2 = lh(8.6, 1.45);
      const ls = segs.flatMap(sg => rico(sg, w, 8.6));
      const nota = gi === 0 ? quebrar('"Grupo" (no SOC chamado de GHE) é o conjunto de trabalhadores que fazem atividades parecidas e ficam expostos aos mesmos riscos. Por isso a avaliação vale para todos eles.', w, 7.6) : [];
      const h = ls.length * hl2 + (nota.length ? nota.length * lh(7.6, 1.4) + 1.5 : 0) + 5;
      garantir(h);
      doc.setFillColor(246, 248, 251); doc.roundedRect(ML, y, CW, h, 2, 2, 'F');
      escreverRico(ls, ML + 4, y + 2.5, 8.6, C1, hl2);
      if (nota.length) escrever(nota, ML + 4, y + 2.5 + ls.length * hl2 + 1.5, 7.6, false, C2, { lh: lh(7.6, 1.4) });
      y += h + 4;
    }
    const riscos = g.riscos || [];
    if (!riscos.length) paragrafo('Nenhum risco encontrado neste grupo.', 8.6, C2);
    for (const r of riscos) {
      const { pecas, junto } = pecasRiscoLeigo(r, fotosDoRisco.get(r) || []);
      const k = stRisco(r);
      await caixa(cabRisco(r), pecas, junto, 0, k ? ST[k].faixa : CINZA);
      y += 0.6;
    }
    if (g.menor18 === true) paragrafo('Proibido para menores de 18 anos neste grupo (Decreto 6.481/2008 — Lista TIP).', 7.8, VERM);
    const fg = fotosDoGhe.get(g.id);
    if (fg.length) {
      const primeira = pecasFotos(fg.slice(0, 3), ML, CW, 3, null, 0.66)[0].h;
      h2('Fotos da visita', primeira);
      await gradeFotos(fg, 3, 0.66);
    }
  }

  // =================== v223: PLANO DE AÇÃO (5W2H) ===================
  if (temPlanoPdf) {
    novaPagina('Plano de ação (5W2H)');
    paragrafo('Cada ação diz o que fazer, por quê, como, quem, onde, quando e quanto custa, como pede a NR-01 (itens 1.5.5.2.1 e 1.5.5.2.2: medidas, cronograma, acompanhamento e aferição dos resultados). A prioridade vem do nível de risco da matriz.', 8.3, C1);
    y += 1.5;
    {
      const c = { imediata: 0, alta: 0, media: 0, baixa: 0 }; planoAcoes.forEach(a => { if (c[a.prioridade] != null) c[a.prioridade]++; });
      const qw = (CW - 9) / 4, h = 12.5;
      garantir(h + 3);
      ['imediata', 'alta', 'media', 'baixa'].forEach((k, i) => {
        const x = ML + i * (qw + 3), pr = PRI[k];
        doc.setDrawColor(...LINHA); doc.setLineWidth(0.3); doc.roundedRect(x, y, qw, h, 2, 2, 'S');
        doc.setFillColor(...pr[2]); doc.rect(x, y + 0.4, 1.4, h - 0.8, 'F');
        fonte(15, true, pr[2]); doc.text(S(String(c[k])), x + 5, y + 7);
        fonte(7.8, false, C1); doc.text(S(pr[0] + (c[k] === 1 ? ' · 1 ação' : '')), x + 5, y + 10.6);
      });
      y += h + 3;
    }
    const wK = 27, wT = CW - wK - 6, szT = 8.1, hlT = lh(8.1, 1.38);
    for (const a of planoAcoes) {
      const pr = PRI[a.prioridade] || PRI.media;
      const porque = a.origem === 'treinamento'
        ? (a.trein || []).map(t => `${t.nr ? t.nr + ' ' : ''}${t.nome} (${t.motivo})`).join('; ')
        : `${a.nivel?.nome ? a.nivel.nome + (a.nivel.p ? ` (probabilidade ${a.nivel.p} x severidade ${a.nivel.s})` : '') + '. ' : ''}${cortarTxt(a.motivo, 260)}`;
      const como = (a.medidas || []).map((m, i) => `${i + 1}) ${m}`).join(' ');
      const linhas = [
        ['Onde', `${ondeAcao(a)}${a.risco ? SEP + a.risco : ''}${a.pessoas ? SEP + plural(a.pessoas, 'pessoa', 'pessoas') : ''}`],
        ['Por quê', porque],
        ['Como', cortarTxt(como, 700)],
        ['Quem · Quanto', `${a.quem || 'a definir pela empresa'}${SEP}${a.quanto != null && a.quanto !== '' ? 'R$ ' + Number(a.quanto).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'a orçar'}`],
        ['Acompanhamento', cortarTxt(a.acompanhamento, 220)],
        ['Resultado esperado', cortarTxt(a.afericao, 260)]
      ].filter(([, t]) => !vazio(t)).map(([k, t]) => [k, quebrar(t, wT, szT)]);
      const tit = quebrar(`${a.numero} · ${a.o_que_base || ''}`, CW - 58, 9, true);
      const hCab = Math.max(7, tit.length * lh(9, 1.3) + 3);
      const hCorpo = linhas.reduce((s0, [, ls]) => s0 + ls.length * hlT + 1.2, 0) + 2;
      garantir(hCab + Math.min(hCorpo, 40));
      if (y + hCab + hCorpo > YMAX) quebraContinua();
      const top = y;
      doc.setFillColor(...FUNDO); doc.rect(ML, top, CW, hCab, 'F');
      pilula(pr[0], ML + 2.5, top + (hCab - 4.6) / 2, pr[1], pr[2], 7, 'esquerda');
      escrever(tit, ML + 22, top + 1.6, 9, true, NAVY, { lh: lh(9, 1.3) });
      fonte(7.8, true, C1); doc.text(S(`até ${dataBrPdf(a.prazo)}`), PW - MR - 2.5, top + hCab / 2 + 1.2, { align: 'right' });
      y = top + hCab + 1;
      for (const [k, ls] of linhas) {
        escrever([S(k)], ML + 2.5, y, 7.6, true, C2, { lh: hlT });
        escrever(ls, ML + wK + 3, y, szT, false, NAVY, { lh: hlT });
        y += ls.length * hlT + 1.2;
      }
      y += 1;
      doc.setDrawColor(...LINHA); doc.setLineWidth(0.3); doc.roundedRect(ML, top, CW, y - top, 1.5, 1.5, 'S');
      doc.setFillColor(...pr[2]); doc.rect(ML, top + 0.3, 1.2, y - top - 0.6, 'F');
      y += 2.6;
    }
    paragrafo('Situação de cada ação, data de conclusão e resultado são registrados no acompanhamento do plano (GRID e SOC).', 7.6, C2);
  }

  // =================== TREINAMENTOS, PENDÊNCIAS E ASSINATURAS ===================
  novaPagina('Treinamentos, pendências e assinaturas');
  h2(temPlanoPdf ? 'Treinamentos pedidos nesta avaliação' : 'Treinamentos que a empresa precisa oferecer', 12);
  const acoesTrein = planoAcoes.filter(a => a.origem === 'treinamento' && (a.trein || []).length);
  if (acoesTrein.length) {
    const funcoesDe = a => { if (a.toda_empresa) return 'Toda a empresa'; const g = ghes.find(x => x.id === a.ghe_id || x.nome === a.ghe); return `Grupo ${a.ghe}${g && lista(g.funcoes) ? ': ' + lista(g.funcoes) : ''}`; };
    tabela([{ t: 'Treinamento', w: 0.3 }, { t: 'Quem precisa', w: 0.28 }, { t: 'Por quê', w: 0.24 }, { t: 'Até quando', w: 0.18 }],
      acoesTrein.flatMap(a => (a.trein || []).map(t => [
        { t: `${t.nome}${t.nr ? ' (' + t.nr + ')' : ''}`, b: true },
        `${funcoesDe(a)}${a.pessoas ? SEP + plural(a.pessoas, 'pessoa', 'pessoas') : ''}`,
        t.motivo || '-',
        `${dataBrPdf(a.prazo)} · ${(PRI[a.prioridade] || PRI.media)[0].toLowerCase()} (ação ${a.numero})`])),
      { size: 8.2 });
    paragrafo('O prazo acompanha o risco mais grave que motivou o treinamento. Carga horária, conteúdo e reciclagem seguem a NR de cada treinamento.', 7.6, C2);
  } else if (!treinLista.length) paragrafo('Nenhum treinamento indicado nesta visita.', 8.6, C2);
  else tabela([{ t: 'Quem precisa', w: 0.3 }, { t: 'Treinamento', w: 0.45 }, { t: 'Por quê', w: 0.25 }],
    treinLista.map(t => [
      { t: t.grupos.length === ghes.length && ghes.length > 1 ? 'Todos os grupos' : t.grupos.map(n => `Grupo ${n}`).join(', '), b: true },
      t.nome, t.nr ? `Exigido pela ${String(t.nr).replace(/^NR\s?/i, 'NR-').replace(/NR--/, 'NR-')}` : '-']),
    { size: 8.4 });

  h2('Documentos que a empresa precisa enviar', 8);
  if (!documentos.length) paragrafo('Nenhum documento pedido.', 8.6, C2);
  for (const d0 of documentos) {
    const ls = quebrar(d0, CW - 7, 8.6), h = ls.length * lh(8.6, 1.5) + 0.8;
    garantir(h);
    doc.setDrawColor(...C2); doc.setLineWidth(0.3); doc.roundedRect(ML, y + 1.1, 3.2, 3.2, 0.5, 0.5, 'S');
    escrever(ls, ML + 6, y, 8.6, false, NAVY, { lh: lh(8.6, 1.5) }); y += h;
  }

  h2('Observações do técnico', 8);
  paragrafo(vazio(av.observacoes) ? 'Sem observações.' : av.observacoes, 8.6, vazio(av.observacoes) ? C2 : NAVY);

  // v203: conferência do quadro de funcionários (LGPD: só nomes de quem saiu, mudou ou foi incluído)
  if (conf.length) {
    const soc = conf.filter(p => p.origem === 'soc');
    const n = (sit) => soc.filter(p => p.situacao === sit).length;
    const inc = conf.filter(p => p.origem === 'empresa');
    const falta = soc.filter(p => !p.situacao).length;
    h2('Conferência do quadro de funcionários', 16);
    const com = vazio(av.acompanhante_nome) ? 'a empresa' : av.acompanhante_nome;
    const total = soc.length - n('saiu') + inc.length;
    const segs = [{ t: `A lista de funcionários foi conferida com ${com} na visita. ` }, { t: plural(total, 'pessoa', 'pessoas'), b: true, c: NAVY }, { t: ` hoje na empresa: ${n('confere')} conferem com o cadastro` }];
    if (n('saiu')) segs.push({ t: ', ' }, { t: `${n('saiu')} ${n('saiu') === 1 ? 'saiu' : 'saíram'}`, b: true, c: NAVY });
    if (n('mudou')) segs.push({ t: ', ' }, { t: `${n('mudou')} ${n('mudou') === 1 ? 'mudou' : 'mudaram'} de setor ou função`, b: true, c: NAVY });
    if (inc.length) segs.push({ t: ' e ' }, { t: `${inc.length} ${inc.length === 1 ? 'foi incluída' : 'foram incluídas'}`, b: true, c: NAVY });
    segs.push({ t: '.' });
    if (falta) segs.push({ t: ` Conferência parcial: ${plural(falta, 'pessoa', 'pessoas')} sem conferir.` });
    for (const l of rico(segs, CW, 8.6)) { garantir(lh(8.6, 1.5)); escreverRico([l], ML, y, 8.6, C1, lh(8.6, 1.5)); y += lh(8.6, 1.5); }
    if (mudancas.length) {
      y += 1.5;
      const ond = (s, f2) => [s, f2].filter(x => !vazio(x)).join(SEP) || '-';
      tabela([{ t: 'Funcionário', w: 0.34 }, { t: 'No cadastro (SOC)', w: 0.3 }, { t: 'Como está hoje', w: 0.36 }],
        [...mudancas].sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR')).map(p => [
          { t: p.nome || '-', b: true },
          p.origem === 'empresa' ? { t: 'Não consta', c: C2 } : ond(p.setor, p.funcao),
          p.situacao === 'saiu' ? { t: 'Não trabalha mais na empresa', b: true, c: VERM }
            : p.origem === 'empresa' ? ond(p.setor, p.funcao) : ond(p.novo_setor || p.setor, p.nova_funcao || p.funcao)]),
        { size: 8 });
    }
  }

  if (fotosGerais.length) {
    h2('Outras fotos da visita', pecasFotos(fotosGerais.slice(0, 3), ML, CW, 3, null, 0.66)[0].h);
    await gradeFotos(fotosGerais, 3, 0.66);
  }

  // glossário
  {
    const itens = [
      ['Grupo (GHE)', 'trabalhadores com atividades e riscos parecidos.'],
      ['EPI', 'proteção usada pela pessoa (protetor auricular, luva, calçado).'],
      ['EPC', 'proteção coletiva, no ambiente (cabine fechada, exaustor, guarda-corpo).'],
      ['CA', 'número do Certificado de Aprovação do EPI no Ministério do Trabalho.'],
      ['dB(A)', 'unidade do barulho. lux: unidade da iluminação.'],
      ['Insalubridade', 'adicional no salário quando o risco passa do limite da lei (NR-15).'],
      ['Periculosidade', 'adicional de 30% em atividades perigosas (NR-16).'],
      ['Aposentadoria especial', 'tempo de contribuição menor por exposição a agentes nocivos.'],
    ];
    const colW = (CW - 6) / 2, hl2 = lh(7.8, 1.4);
    const blocos = itens.map(([t, d]) => rico([{ t: `${t}: `, b: true, c: NAVY }, { t: d }], colW, 7.8));
    const alturas = [];
    for (let i = 0; i < blocos.length; i += 2) alturas.push(Math.max(...blocos.slice(i, i + 2).map(b => b.length)) * hl2 + 1);
    h2('Palavras deste relatório', alturas.reduce((s, h) => s + h, 0));
    for (let i = 0; i < blocos.length; i += 2) {
      garantir(alturas[i / 2]);
      blocos.slice(i, i + 2).forEach((b, j) => escreverRico(b, ML + j * (colW + 6), y, 7.8, C1, hl2));
      y += alturas[i / 2];
    }
  }

  {
    const nota = 'Documento gerado a partir do registro de campo. Depois de concluída, a avaliação não se altera; mudanças geram nova revisão e as anteriores ficam no histórico.';
    const ls = quebrar(nota, CW, 7.4); garantir(ls.length * lh(7.4, 1.5)); y += 3;
    escrever(ls, ML, y, 7.4, false, C2, { lh: lh(7.4, 1.5) }); y += ls.length * lh(7.4, 1.5);
  }
  // assinaturas (bloco inteiro junto)
  {
    const assinantes = [];
    assinantes.push({
      img: dados.assinaturas?.tec, nome: tec.nome || 'Técnico responsável', papel: papelTec,
      quando: av.assinatura_tec_em ? `Assinado em ${dataHoraBR(av.assinatura_tec_em)}` : 'Sem assinatura registrada',
    });
    if (!vazio(av.acompanhante_nome)) assinantes.push({
      img: dados.assinaturas?.acomp, nome: av.acompanhante_nome,
      papel: ['Acompanhante pela empresa', av.acompanhante_cargo].filter(x => !vazio(x)).join(SEP),
      quando: av.assinatura_acomp_em ? `Assinado em ${dataHoraBR(av.assinatura_acomp_em)}` : 'Sem assinatura registrada',
    });
    const colW = (CW - 10) / 2, hImg = 18;
    const textos = assinantes.map(a => [
      ...quebrar(a.nome, colW, 8.4, true).map(t => ({ t, b: true, c: NAVY })),
      ...quebrar(a.papel, colW, 7.6).map(t => ({ t, c: C1 })),
      ...quebrar(a.quando, colW, 7.2).map(t => ({ t, c: C2 })),
    ]);
    const hTxt = Math.max(...textos.map(t => t.length)) * lh(8, 1.4);
    const hBloco = hImg + 1.5 + hTxt;
    h2('Assinaturas', hBloco + 4);
    y += 3;
    for (let i = 0; i < assinantes.length; i++) {
      const a = assinantes[i], x = ML + i * (colW + 10);
      if (a.img) {
        try {
          const fmtI = /^data:image\/png/i.test(a.img) ? 'PNG' : 'JPEG';
          const p = doc.getImageProperties(a.img), k = Math.min(60 / p.width, (hImg - 2) / p.height);
          doc.addImage(a.img, fmtI, x + (colW - p.width * k) / 2, y + hImg - 1 - p.height * k, p.width * k, p.height * k, `assinatura_${i}`, 'FAST');
        } catch { /* assinatura ilegível: fica só a linha */ }
      }
      doc.setDrawColor(...NAVY); doc.setLineWidth(0.3); doc.line(x, y + hImg, x + colW, y + hImg);
      textos[i].forEach((l, j) => escrever([l.t], x + colW / 2, y + hImg + 1.5 + j * lh(8, 1.4), l.b ? 8.4 : 7.4, !!l.b, l.c, { align: 'center' }));
    }
    y += hBloco + 6;
  }

  // =================== RODAPÉ EM TODAS AS PÁGINAS ===================
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LINHA); doc.setLineWidth(0.25); doc.line(ML, PH - 12.5, PW - MR, PH - 12.5);
    fonte(7, false, C3);
    const esq = doc.splitTextToSize(S(`Avaliação de Riscos no Trabalho · ${cli.nome || ''}`), CW - 70)[0];
    doc.text(esq, ML, PH - 8.6);
    doc.text(S(`${numero} · rev. ${revisao} · página ${p} de ${total}`), PW - MR, PH - 8.6, { align: 'right' });
  }
  progresso('final', 1, 1);

  if (typeof Blob !== 'undefined') return doc.output('blob');
  return doc.output('arraybuffer');
}
