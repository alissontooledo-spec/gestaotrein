// Gerador do PDF da "Avaliação de Campo" (módulo campo).
// v225 (proposta aprovada 30/09): "Relatório de Avaliação de Riscos Ocupacionais" com estrutura de
// documento técnico — 1 Objetivo, 2 Resumo, 3 Metodologia e critérios (NR-01 1.5.4.4.2.2), 4 Inventário
// de riscos por GHE (NR-01 1.5.7.3.2), 5 Plano de ação 5W2H, 6 Treinamentos e pendências, 7 Considerações,
// 8 Assinaturas e controle de revisões, Anexo A (critérios) e Anexo B (glossário). Sem nome/logo da
// organização. Insalubridade/periculosidade/AE saem como informação para o lançamento no SOC (não é laudo).
// Foto marcada como documento não entra (fica só no GRID; LGPD).
// jsPDF 2.5.1 (recebido por parâmetro; no app vem de window.jspdf.jsPDF), A4 retrato, Helvetica.
// Regras: todo texto passa por pdfSafe; cores com spread; sem alfa/GState; sem HTML;
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
  doc.setProperties({ title: `Relatório de Avaliação de Riscos Ocupacionais ${numero}`, subject: cli.nome || '', creator: 'GRID' });
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
    const linhaOrg = doc.splitTextToSize(S(`Relatório ${numero} · ${cli.nome || ''}`.toUpperCase()), CW - 48)[0];   // v225
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
        const segs = [{ t: `Foto ${f._num ?? numeroFoto.get(f)}`, b: true, c: NAVY }];
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
  if (treinLista.length && !temPlanoPdf) fazer.push({ t: 'Fazer os treinamentos indicados', d: `${plural(treinLista.length, 'treinamento', 'treinamentos')}, listados na seção 6 (quem precisa e por quê).`, prazo: ['até 90 dias', AMBAR_BG, AMAR_TXT] });
  if (documentos.length) fazer.push({ t: 'Enviar os documentos pedidos na visita', d: `${plural(documentos.length, 'documento', 'documentos')}, listados na seção 6.`, prazo: ['até 30 dias', VERDE_BG, VERDE] });
  if (mudancas.length) fazer.push({ t: 'Atualizar o cadastro de funcionários', d: `${plural(mudancas.length, 'mudança encontrada', 'mudanças encontradas')} na conferência com a empresa (seção 6).`, prazo: ['até 30 dias', VERDE_BG, VERDE] });

  progresso('texto', 0, 1);

  // =====================================================================
  // v225 — relatório com cara de documento técnico (proposta aprovada 30/09:
  // 08-Propostas-visuais/propostas-visuais-relatorio-profissional-v225.html).
  // Estrutura: 1 Objetivo · 2 Resumo · 3 Metodologia e critérios (NR-01
  // 1.5.4.4.2.2) · 4 Inventário por GHE (NR-01 1.5.7.3.2) · 5 Plano de ação ·
  // 6 Treinamentos e pendências · 7 Considerações · 8 Assinaturas e revisões ·
  // Anexo A critérios · Anexo B glossário. Sem nome/logo da organização no
  // cabeçalho (decisão do Alisson, 30/09).
  // =====================================================================
  const hexRgb = h => { const m = String(h || '').match(/^#?([0-9a-f]{6})$/i); if (!m) return [210, 215, 225]; const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const NIVEIS_PAD = [
    { codigo: 'irrelevante', nome: 'Risco Irrelevante', aceitabilidade: 'aceitavel', cor: '#7CB342', prioridade: null, prazo_dias: null },
    { codigo: 'baixo', nome: 'Risco Baixo', aceitabilidade: 'toleravel', cor: '#CDFF9A', prioridade: 'baixa', prazo_dias: 365 },
    { codigo: 'moderado', nome: 'Risco Moderado', aceitabilidade: 'toleravel', cor: '#FDE260', prioridade: 'media', prazo_dias: 120 },
    { codigo: 'alto', nome: 'Risco Alto', aceitabilidade: 'toleravel', cor: '#F3975B', prioridade: 'alta', prazo_dias: 60 },
    { codigo: 'critico', nome: 'Risco Crítico', aceitabilidade: 'nao_aceitavel', cor: '#E53935', prioridade: 'imediata', prazo_dias: 2 }];
  const MZ = dados.matriz && Array.isArray(dados.matriz.niveis) && Array.isArray(dados.matriz.grade) ? dados.matriz : null;
  const NIVEIS = (MZ?.niveis || NIVEIS_PAD).map(n => {
    const p = NIVEIS_PAD.find(x => x.codigo === n.codigo) || {};
    return { ...p, ...n, prioridade: 'prioridade' in n ? n.prioridade : p.prioridade, prazo_dias: n.prazo_dias ?? p.prazo_dias };
  });
  const nivelInfo = cod => NIVEIS.find(n => n.codigo === cod) || null;
  const nivelDoRisco = r => {
    if (r?.nivel?.codigo) return r.nivel.codigo;
    const p = Number(r?.probabilidade), s = Number(r?.severidade);
    if (MZ && p >= 1 && p <= 5 && s >= 1 && s <= 5) return MZ.grade[p - 1][s - 1];
    return null;
  };
  const curtoNivel = cod => String(nivelInfo(cod)?.nome || cod || '').replace(/^Risco\s+/i, '');
  const ORD_NIV = ['critico', 'alto', 'moderado', 'baixo', 'irrelevante'];
  const ACEIT_TXT = { aceitavel: 'Aceitável', toleravel: 'Tolerável', nao_aceitavel: 'Não aceitável' };
  const danosDe = typeof dados.danos === 'function' ? dados.danos : (r => r?.danos || '');
  const baseDe = typeof dados.baseLegal === 'function' ? dados.baseLegal : () => '';
  const normasDe = typeof dados.normasDe === 'function' ? dados.normasDe : () => [];
  const emitido = av.concluida_em || dados.emitidoEm || null;
  const regTec = (() => {
    const s = String(tec.sigla_conselho || '').trim().toUpperCase(), c = String(tec.conselho_classe || '').trim();
    if (!s && !c) return '';
    return `Registro ${s} nº ${c}${tec.uf_registro ? '/' + String(tec.uf_registro).trim().toUpperCase() : ''}`.replace(/\s+/g, ' ');
  })();
  const papelTecR = [tec.formacao, regTec].filter(x => !vazio(x)).join(SEP);
  const acompTxt = vazio(av.acompanhante_nome) ? 'Sem acompanhante' : String(av.acompanhante_nome).trim() + (vazio(av.acompanhante_cargo) ? '' : ` (${String(av.acompanhante_cargo).trim()})`);
  const nTrab = (() => {
    if (conf.length) { const soc = conf.filter(p => p.origem === 'soc'); return soc.length - soc.filter(p => p.situacao === 'saiu').length + conf.filter(p => p.origem === 'empresa').length; }
    return ghes.reduce((s0, g) => s0 + (pessoas(g) || 0), 0);
  })();
  const contaNivel = {}; for (const c of ORD_NIV) contaNivel[c] = 0;
  let semNivel = 0;
  for (const { r } of todos) { if (r.codigo === '1068') continue; const c = nivelDoRisco(r); if (c && contaNivel[c] != null) contaNivel[c]++; else semNivel++; }
  const pior = ORD_NIV.find(c => contaNivel[c] > 0) || null;
  const ehSemEpiRef = r => vazio(r.epi) || /^(n[aã]o se aplica|na|n\/a)$/i.test(String(r.epi).trim());
  const minus = t => { const s0 = String(t || '').trim(); return s0 ? s0[0].toLowerCase() + s0.slice(1) : s0; };

  // título de seção numerado (1, 2, 3...)
  function h2n(num, t, proximo = 12) {
    const h = 4 + lh(9) + 1.2 + 2;
    garantir(h + proximo);
    if (y > topo + 0.1) y += 4;
    doc.setFillColor(...NAVY); doc.roundedRect(ML, y + 0.3, 4.6, 4.6, 0.6, 0.6, 'F');
    fonte(7.4, true, BRANCO); doc.text(S(String(num)), ML + 2.3, y + 3.6, { align: 'center' });
    escrever([S(t).toUpperCase()], ML + 6.6, y, 9, true, NAVY);
    y += lh(9) + 1.2;
    doc.setDrawColor(...LINHA); doc.setLineWidth(0.25); doc.line(ML, y, PW - MR, y);
    y += 2;
  }
  // tabela técnica: cabeçalho azul; célula {t, b, c, sub, fill, fg, center}
  function tabelaQ(cols, linhas, { size = 7.6, subSize = 6.7, cabSize = 6.6 } = {}) {
    const ws = cols.map(c => c.w * CW), px = 1.8, py = 1.4, hl = lh(size, 1.32), hs = lh(subSize, 1.3);
    const cel = c => (c && typeof c === 'object' ? c : { t: c });
    const desenharCab = () => {
      const ls = cols.map((c, i) => quebrar(S(c.t).toUpperCase(), ws[i] - 2 * px, cabSize, true));
      const h = Math.max(...ls.map(l => l.length)) * lh(cabSize, 1.25) + 2 * py;
      let x = ML;
      doc.setFillColor(...NAVY); doc.rect(ML, y, CW, h, 'F');
      ls.forEach((l, i) => { escrever(l, x + px, y + py, cabSize, true, BRANCO, { lh: lh(cabSize, 1.25) }); x += ws[i]; });
      y += h;
    };
    garantir(2 * py + lh(cabSize, 1.25) + hl + 2 * py);
    desenharCab();
    for (const linha of linhas) {
      const cs = linha.map(cel);
      const blocos = cs.map((c, i) => {
        const w = ws[i] - 2 * px - (c.fill ? 1 : 0);
        return { t: vazio(c.t) ? [] : quebrar(c.t, w, size, !!c.b), s: vazio(c.sub) ? [] : quebrar(c.sub, w, subSize) };
      });
      const h = Math.max(...blocos.map(b => b.t.length * hl + b.s.length * hs)) + 2 * py;
      if (y + h > YMAX) { quebraContinua(); desenharCab(); }
      let x = ML;
      cs.forEach((c, i) => {
        const b = blocos[i];
        if (c.fill) {
          fonte(size, true); const tw = Math.min(ws[i] - 2 * px, Math.max(...b.t.map(l => doc.getTextWidth(l)), 4) + 2.4);
          doc.setFillColor(...c.fill); doc.roundedRect(x + px - 0.2, y + py - 0.3, tw, b.t.length * hl + 0.6, 0.6, 0.6, 'F');
          escrever(b.t, x + px + 1, y + py, size, true, c.fg || NAVY, { lh: hl });
        } else if (b.t.length) {
          if (c.center) escrever(b.t, x + ws[i] / 2, y + py, size, !!c.b, c.c || NAVY, { lh: hl, align: 'center' });
          else escrever(b.t, x + px, y + py, size, !!c.b, c.c || NAVY, { lh: hl });
        }
        if (b.s.length) escrever(b.s, x + px, y + py + b.t.length * hl + (c.fill ? 0.8 : 0), subSize, false, C2, { lh: hs });
        x += ws[i];
      });
      y += h;
      doc.setDrawColor(...LINHA); doc.setLineWidth(0.25); doc.line(ML, y, PW - MR, y);
    }
  }
  // tabela de identificação: linhas [[rótulo, valor, rótulo, valor]] ou [[rótulo, valor]] (linha inteira)
  function tabelaId(linhas) {
    const wk = 30, wv = (CW - 2 * wk) / 2, sz = 7.9, hl = lh(sz, 1.3);
    for (const ln of linhas) {
      const pares = ln.length === 2 ? [[ln[0], ln[1], CW - wk]] : [[ln[0], ln[1], wv], [ln[2], ln[3], wv]];
      const blocos = pares.map(([k, v, w]) => ({ k: quebrar(S(k).toUpperCase(), wk - 3, 6.1, true), v: quebrar(v || '-', w - 3, sz, k === 'Empresa avaliada'), w, bold: k === 'Empresa avaliada' }));
      const h = Math.max(...blocos.map(b => Math.max(b.k.length * lh(6.1, 1.25), b.v.length * hl))) + 2.8;
      garantir(h);
      let x = ML;
      for (const b of blocos) {
        doc.setFillColor(...FUNDO); doc.rect(x, y, wk, h, 'F');
        doc.setDrawColor(...LINHA); doc.setLineWidth(0.25); doc.rect(x, y, wk, h, 'S'); doc.rect(x + wk, y, b.w, h, 'S');
        escrever(b.k, x + 1.6, y + 1.5, 6.1, true, C2, { lh: lh(6.1, 1.25) });
        escrever(b.v, x + wk + 1.6, y + 1.4, sz, b.bold, NAVY, { lh: hl });
        x += wk + b.w;
      }
      y += h;
    }
  }

  // =================== PÁGINA 1 — IDENTIFICAÇÃO E RESUMO ===================
  {
    fonte(7.4, true, C2); doc.text(S('RELATÓRIO DE VISITA TÉCNICA · SEGURANÇA DO TRABALHO'), ML, MT + 3);
    // quadro do documento
    {
      const w = 50, h = 16, x = PW - MR - w, top = MT - 1;
      doc.setDrawColor(...BORDA2); doc.setLineWidth(0.3); doc.roundedRect(x, top, w, h, 1.5, 1.5, 'S');
      fonte(6.2, true, C2); doc.text(S('RELATÓRIO Nº'), x + w - 3, top + 4, { align: 'right' });
      fonte(11, true, NAVY); doc.text(S(numero), x + w - 3, top + 9, { align: 'right' });
      fonte(6.8, false, C2); doc.text(S(`Revisão ${revisao}${emitido ? ' · emitido em ' + dataBR(emitido) : ''}`), x + w - 3, top + 13.2, { align: 'right' });
      if (av.situacao !== 'concluida') pilula(av.situacao === 'cancelada' ? 'Cancelada' : 'Rascunho · não concluída', x + w, top + h + 1.5, AMBAR_BG, AMAR_TXT, 6.8);
    }
    fonte(15, true, NAVY); doc.text(S('Relatório de Avaliação de Riscos Ocupacionais'), ML, MT + 11.2);
    fonte(7.8, false, C2); doc.text(doc.splitTextToSize(S('Visita técnica de campo · levantamento para o Inventário de Riscos e o Plano de Ação do PGR (NR-01)'), CW - 56)[0], ML, MT + 16.3);
    doc.setDrawColor(...NAVY); doc.setLineWidth(0.6); doc.line(ML, MT + 21, PW - MR, MT + 21);
    topo = y = MT + 21 + 4; titulo = 'Relatório de Avaliação de Riscos Ocupacionais';

    const end = [cli.endereco, [cli.cidade, cli.uf].filter(Boolean).join('/')].filter(x => !vazio(x)).join(SEP);
    const visita = [dataBR(av.data_visita), av.hora_inicio ? `às ${hora(av.hora_inicio)}` : ''].filter(Boolean).join(', ');
    tabelaId([
      ['Empresa avaliada', cli.nome || '-', 'CNPJ', cli.cnpj || '-'],
      ['Endereço', end || '-'],
      ['Data da visita', visita || '-', 'Acompanhante', acompTxt],
      ['GHEs avaliados', `${ghes.length}${ghes.length ? ' (' + ghes.map(g => g.nome).join(', ') + ')' : ''}`, 'Trabalhadores', nTrab ? `${nTrab}${conf.length ? ' (conferido na visita)' : ''}` : 'Não informado'],
      ['Responsável técnico', [tec.nome, papelTecR].filter(x => !vazio(x)).join(SEP) || '-'],
    ]);

    h2n(1, 'Objetivo e escopo', 10);
    paragrafo('Identificar os perigos e avaliar os riscos ocupacionais dos grupos de trabalhadores (GHE) da empresa, nas condições observadas na data da visita, para alimentar o inventário de riscos e o plano de ação do Programa de Gerenciamento de Riscos (PGR), conforme a NR-01. Abrange os ambientes e atividades apresentados pela empresa durante a visita.', 8.1, C1);

    h2n(2, 'Resumo', 30);
    {
      const TIT = {
        critico: 'Resultado geral: há risco não aceitável — corrigir antes de continuar a atividade',
        alto: 'Resultado geral: há riscos altos — medidas complementares imediatas',
        moderado: 'Resultado geral: riscos toleráveis que pedem melhoria',
        baixo: 'Resultado geral: riscos toleráveis, sem necessidade de interromper atividades',
        irrelevante: 'Resultado geral: riscos aceitáveis, sem necessidade de interromper atividades'
      };
      const tit = pior ? TIT[pior] : nRiscos ? 'Resultado geral: riscos ainda sem classificação' : 'Resultado geral: nenhum risco identificado';
      const c = planoAcoes.length ? { imediata: 0, alta: 0, media: 0, baixa: 0 } : null;
      if (c) planoAcoes.forEach(a => { if (c[a.prioridade] != null) c[a.prioridade]++; });
      const partes = c ? [['imediata', 'imediata', 'imediatas'], ['alta', 'alta', 'altas'], ['media', 'média', 'médias'], ['baixa', 'baixa', 'baixas']].filter(([k]) => c[k]).map(([k, s1, p1]) => `${c[k]} de prioridade ${c[k] === 1 ? s1 : p1}`) : [];
      const txt = `Foram avaliados ${plural(todos.filter(x => x.r.codigo !== '1068').length, 'risco', 'riscos')} em ${plural(ghes.length, 'GHE', 'GHEs')}. `
        + (contaNivel.critico ? `${plural(contaNivel.critico, 'risco é Crítico', 'riscos são Críticos')} (não aceitável). ` : contaNivel.alto ? '' : 'Nenhum é Crítico ou Alto. ')
        + (contaNivel.alto ? `${plural(contaNivel.alto, 'risco é Alto', 'riscos são Altos')}. ` : '')
        + (semNivel ? `${plural(semNivel, 'risco ficou', 'riscos ficaram')} sem nível na matriz. ` : '')
        + (c ? `O plano de ação tem ${plural(planoAcoes.length, 'ação', 'ações')}${partes.length ? ': ' + partes.join(', ') : ''}.` : '');
      const cor = pior ? hexRgb(nivelInfo(pior)?.cor) : C3;
      const tl = quebrar(tit, CW - 8, 9.6, true), bl = quebrar(txt, CW - 8, 8.1);
      const h = tl.length * lh(9.6, 1.3) + bl.length * lh(8.1, 1.4) + 5;
      garantir(h);
      doc.setDrawColor(...BORDA2); doc.setLineWidth(0.3); doc.rect(ML, y, CW, h, 'S');
      doc.setFillColor(...cor); doc.rect(ML, y, 1.6, h, 'F');
      escrever(tl, ML + 5, y + 2.2, 9.6, true, NAVY, { lh: lh(9.6, 1.3) });
      escrever(bl, ML + 5, y + 2.2 + tl.length * lh(9.6, 1.3) + 0.6, 8.1, false, C1, { lh: lh(8.1, 1.4) });
      y += h + 2.5;
      // contagem por nível
      const qw = (CW - 4 * 2.5) / 5, hq = 11.5;
      garantir(hq + 2);
      ORD_NIV.forEach((cod, i) => {
        const x = ML + i * (qw + 2.5);
        doc.setDrawColor(...LINHA); doc.setLineWidth(0.3); doc.rect(x, y, qw, hq, 'S');
        doc.setFillColor(...hexRgb(nivelInfo(cod)?.cor)); doc.rect(x, y, qw, 1.3, 'F');
        fonte(13, true, NAVY); doc.text(S(String(contaNivel[cod])), x + 2.5, y + 7.3);
        fonte(6.4, true, C2); doc.text(S(curtoNivel(cod).toUpperCase()), x + 2.5, y + 10.2);
      });
      y += hq + 3;
    }
    // providências (ações do plano, por prioridade)
    if (planoAcoes.length) {
      const lista2 = planoAcoes.slice().sort((a, b) => (ORD_PRI[a.prioridade] ?? 9) - (ORD_PRI[b.prioridade] ?? 9));
      const MAXA = 8;
      tabelaQ([{ t: 'Ação', w: 0.09 }, { t: 'O que fazer', w: 0.61 }, { t: 'Prioridade', w: 0.14 }, { t: 'Prazo', w: 0.16 }],
        lista2.slice(0, MAXA).map(a => {
          const pr = PRI[a.prioridade] || PRI.media;
          return [{ t: a.numero, b: true }, { t: a.o_que_base || String(a.o_que || '').replace(/\s·\s*A-\d+$/, ''), sub: `${ondeAcao(a)}${a.risco ? SEP + a.risco : ''}` },
            { t: pr[0], fill: pr[1], fg: pr[2] }, dataBrPdf(a.prazo)];
        }), { size: 7.8 });
      if (lista2.length > MAXA) paragrafo(`E mais ${plural(lista2.length - MAXA, 'ação', 'ações')} no plano de ação (seção 5).`, 7.6, C2);
    } else if (fazer.length) {
      tabelaQ([{ t: 'O que fazer', w: 0.8 }, { t: 'Prazo', w: 0.2 }], fazer.slice(0, 8).map(f => [{ t: f.t, sub: f.d }, f.prazo[0]]), { size: 7.8 });
    }
    // em linguagem simples
    {
      const top3 = planoAcoes.slice().sort((a, b) => (ORD_PRI[a.prioridade] ?? 9) - (ORD_PRI[b.prioridade] ?? 9)).slice(0, 3);
      let t = contaNivel.critico ? `A empresa tem ${plural(contaNivel.critico, 'risco', 'riscos')} que ${contaNivel.critico === 1 ? 'exige' : 'exigem'} parar a atividade até a correção. ` : 'A empresa não tem risco que exija parar o trabalho. ';
      if (top3.length) t += 'Precisa: ' + top3.map((a, i) => `(${i + 1}) ${minus(a.o_que_base || '')} até ${dataBrPdf(a.prazo)}`).join('; ') + '. O detalhe de cada ação está no plano de ação (seção 5).';
      else t += 'Deve manter as medidas de prevenção atuais.';
      h2('Em linguagem simples', 10);
      paragrafo(t, 8.1, C1);
    }
  }

  // =================== 3 · METODOLOGIA E CRITÉRIOS ===================
  novaPagina('3 · Metodologia e critérios');
  {
    const temMed = todos.some(({ r }) => !vazio(r.medicao?.resultado) || !vazio(r.iluminacao?.nivel_encontrado));
    h2n(3, 'Como a avaliação foi feita', 20);
    const itens = [
      [['Inspeção no local', true], [' dos ambientes e das atividades, com o acompanhante indicado pela empresa.']],
      [['Análise qualitativa por GHE', true], [': perigo, fonte ou circunstância, possíveis lesões ou agravos, exposição (permanente, intermitente ou eventual) e medidas de prevenção existentes.']],
      ...(temMed ? [[['Leituras com instrumentos', true], [' para apoiar a análise. Leituras pontuais têm caráter indicativo (ver seção 7).']]] : []),
      [['Classificação pela matriz de risco', true], [': o nível de cada risco resulta da combinação da probabilidade com a severidade (NR-01, item 1.5.4.4.2).']],
      ...(conf.length ? [[['Conferência', true], [' do quadro de funcionários com o cadastro do SOC.']]] : []),
    ];
    for (const it of itens) {
      const ls = rico([{ t: '•  ' }, ...it.map(([t, b]) => ({ t, b: !!b, c: b ? NAVY : undefined }))], CW - 2, 8);
      for (const l of ls) { garantir(lh(8, 1.45)); escreverRico([l], ML + 1, y, 8, C1, lh(8, 1.45)); y += lh(8, 1.45); }
    }
    // instrumentos
    const medidos = [];
    ghes.forEach(g => (g.riscos || []).forEach(r => {
      const m = r.medicao || {}, il = r.iluminacao || {};
      if (!vazio(m.resultado)) medidos.push({ g, r, metodo: m.metodo, data: m.data });
      else if (!vazio(il.nivel_encontrado)) medidos.push({ g, r, metodo: il.metodo || 'Luxímetro', data: il.data });
    }));
    if (medidos.length) {
      h2('Instrumentos e métodos informados', 12);
      const carater = met => /dos[ií]metr/i.test(String(met || '')) ? 'Dosimetria' : 'Leitura pontual (indicativa)';
      tabelaQ([{ t: 'Agente · GHE', w: 0.3 }, { t: 'Equipamento / método', w: 0.36 }, { t: 'Data', w: 0.12 }, { t: 'Caráter', w: 0.22 }],
        medidos.map(x => [{ t: x.r.nome, b: true, sub: `GHE ${x.g.nome}` }, vazio(x.metodo) ? { t: 'não informado', c: C2 } : x.metodo, dataBR(x.data) || dataBR(av.data_visita), carater(x.metodo)]));
      paragrafo('Modelo, número de série e certificado de calibração dos instrumentos ficam com o responsável técnico e podem ser solicitados.', 7.2, C2);
    }
    // matriz
    h2('Matriz de risco (nível = probabilidade × severidade)', 44);
    {
      const cw = 14, ch = 6.4, gx = ML + 7, top = y + 4;
      fonte(6.4, true, C2);
      for (let s = 1; s <= 5; s++) doc.text(S(`S${s}`), gx + (s - 1) * (cw + 0.8) + cw / 2, top - 1, { align: 'center' });
      for (let pi = 5; pi >= 1; pi--) {
        const yy = top + (5 - pi) * (ch + 0.8);
        fonte(6.4, true, C2); doc.text(S(`P${pi}`), ML + 1, yy + ch / 2 + 1);
        for (let s = 1; s <= 5; s++) {
          const cod = MZ ? MZ.grade[pi - 1][s - 1] : null, n = nivelInfo(cod);
          doc.setFillColor(...hexRgb(n?.cor)); doc.rect(gx + (s - 1) * (cw + 0.8), yy, cw, ch, 'F');
          fonte(5.2, true, cod === 'critico' ? BRANCO : NAVY); doc.text(S(curtoNivel(cod)), gx + (s - 1) * (cw + 0.8) + cw / 2, yy + ch / 2 + 0.9, { align: 'center' });
        }
      }
      const hGrade = 5 * (ch + 0.8) + 4;
      const yTab = y; const xT = gx + 5 * (cw + 0.8) + 5, wT = PW - MR - xT;
      // tabela de níveis ao lado
      const PRIN = { imediata: 'Imediata', alta: 'Alta', media: 'Média', baixa: 'Baixa' };
      let yy = yTab;
      doc.setFillColor(...NAVY); doc.rect(xT, yy, wT, 5, 'F');
      fonte(6.2, true, BRANCO); doc.text(S('NÍVEL'), xT + 1.5, yy + 3.4); doc.text(S('ACEITABILIDADE'), xT + 24, yy + 3.4); doc.text(S('PRIORIDADE · PRAZO'), xT + wT - 1.5, yy + 3.4, { align: 'right' });
      yy += 5;
      for (const cod of ORD_NIV) {
        const n = nivelInfo(cod); if (!n) continue;
        const pz = n.prioridade ? `${PRIN[n.prioridade] || n.prioridade} · ${n.prazo_dias} dias` : 'Sem ação';
        const ac = quebrar(`${ACEIT_TXT[n.aceitabilidade] || ''}${cod === 'alto' ? ' com medidas complementares' : cod === 'critico' ? ': não iniciar nem continuar' : ''}`, wT - 24 - 30, 6.8);
        const h = Math.max(5.4, ac.length * lh(6.8, 1.3) + 2);
        doc.setFillColor(...hexRgb(n.cor)); doc.roundedRect(xT + 1, yy + 1, 19, 3.6, 0.5, 0.5, 'F');
        fonte(6.4, true, cod === 'critico' ? BRANCO : NAVY); doc.text(S(curtoNivel(cod)), xT + 2, yy + 3.6);
        escrever(ac, xT + 24, yy + 0.9, 6.8, false, C1, { lh: lh(6.8, 1.3) });
        fonte(6.8, false, NAVY); doc.text(S(pz), xT + wT - 1.5, yy + 3.6, { align: 'right' });
        yy += h; doc.setDrawColor(...LINHA); doc.setLineWidth(0.2); doc.line(xT, yy, xT + wT, yy);
      }
      y = Math.max(y + hGrade + ch, yy) + 2;
    }
    paragrafo('Probabilidade (P1 a P5): considera as medidas de prevenção existentes, o perfil de exposição e as exigências da atividade. Severidade (S1 a S5): vai de lesão leve e reversível até lesão crítica ou fatal. Os critérios completos estão no Anexo A (NR-01, item 1.5.4.4.2.2).', 7.8, C1);
    // referências normativas
    {
      const NOMES = { 'NR-01': 'NR-01 (Disposições gerais e gerenciamento de riscos ocupacionais)', 'NR-06': 'NR-06 (EPI)', 'NR-08': 'NR-08 (Edificações)', 'NR-09': 'NR-09 (Avaliação e controle das exposições ocupacionais)',
        'NR-10': 'NR-10 (Eletricidade)', 'NR-11': 'NR-11 (Transporte e movimentação de materiais)', 'NR-12': 'NR-12 (Máquinas e equipamentos)', 'NR-15': 'NR-15 (Atividades e operações insalubres)',
        'NR-16': 'NR-16 (Atividades e operações perigosas)', 'NR-17': 'NR-17 (Ergonomia)', 'NR-20': 'NR-20 (Inflamáveis e combustíveis)', 'NR-21': 'NR-21 (Trabalho a céu aberto)', 'NR-26': 'NR-26 (Sinalização e GHS)',
        'NR-32': 'NR-32 (Serviços de saúde)', 'NR-33': 'NR-33 (Espaços confinados)', 'NR-35': 'NR-35 (Trabalho em altura)', 'NHO 01': 'NHO 01 (Ruído · Fundacentro)', 'NHO 11': 'NHO 11 (Iluminação · Fundacentro)' };
      const set = new Set(['NR-01']);
      for (const { r } of todos) {
        if (r.codigo === '1068') continue;
        normasDe(baseDe(r)).forEach(n => set.add(n));
        if (!ehSemEpiRef(r)) set.add('NR-06');
        if ((CONCLUSOES[r.categoria] || []).length) { set.add('NR-15'); if ((CONCLUSOES[r.categoria] || []).includes('per')) set.add('NR-16'); }
      }
      for (const a of planoAcoes) normasDe(a.base_legal).forEach(n => set.add(n));
      const ord = [...set].sort((a, b) => (a.startsWith('NHO') - b.startsWith('NHO')) || a.localeCompare(b));
      const refs = ord.map(n => NOMES[n] || n);
      if (ghes.some(g => g.menor18 === true || g.menor18 === false)) refs.push('Decreto 6.481/2008 (Lista TIP · trabalho proibido a menores de 18 anos)');
      h2('Referências normativas', 10);
      paragrafo(refs.join(' · '), 7.8, C1);
    }
  }

  // =================== 4 · INVENTÁRIO DE RISCOS POR GHE ===================
  const EXPO_NOME = { P: 'Permanente', I: 'Intermitente', E: 'Eventual' };
  const EFIC = { S: 'eficaz', N: 'não eficaz', SNS: 'eficaz, mas não suficiente', NA: '' };
  const ehSemEpi = r => vazio(r.epi) || /^(n[aã]o se aplica|na|n\/a)$/i.test(String(r.epi).trim());
  const medidasTxt = r => {
    if (r.codigo === '1068') return 'Não se aplica';
    const m = [];
    if (!vazio(r.epc)) m.push(`EPC: ${r.epc}`);
    if (!ehSemEpi(r)) m.push(`EPI: ${r.epi}${EFIC[r.epi_eficaz] ? ` (${EFIC[r.epi_eficaz]})` : ''}`);
    if (util(r.medidas_adm)) m.push(r.medidas_adm);
    return m.length ? m.join('; ') : 'Nenhuma registrada';
  };
  const ambienteTxt = g => (g.ambientes || []).map(a => {
    const p = [['paredes', a.paredes], ['piso', a.piso], ['forro', a.forro], ['teto', a.teto_telhado], ['iluminação', a.iluminacao], ['ventilação', a.ventilacao]]
      .filter(([, v]) => !vazio(lista(v))).map(([l, v]) => `${l} ${lista(v).toLowerCase()}`);
    const extra = [a.outro, a.observacao].filter(x => !vazio(x)).join('. ');
    return `${a.nome ? a.nome + ': ' : ''}${p.join(', ')}${extra ? (p.length ? '. ' : '') + extra : ''}`;
  }).filter(Boolean).join(' | ');

  for (let gi = 0; gi < ghes.length; gi++) {
    const g = ghes[gi];
    novaPagina(`4 · Inventário de riscos · GHE ${gi + 1} de ${ghes.length} · ${g.nome}`);
    progresso('texto', gi + 1, ghes.length + 1);
    // quadro do GHE
    {
      const n = pessoas(g);
      const menor = g.menor18 === true ? 'Proibido (Lista TIP, Decreto 6.481/2008)' : g.menor18 === false ? 'Permitido (atividades fora da Lista TIP)' : 'Não informado';
      const cel4 = [['Setor', lista(g.setores) || '-'], ['Funções', lista(g.funcoes) || '-'], ['Trabalhadores', n ? String(n) : 'Não informado'], ['Menor de 18 anos', menor]];
      const w4 = (CW - 6) / 4;
      const b4 = cel4.map(([k, v]) => ({ k, v: quebrar(v, w4 - 2, 7.6) }));
      const cheias = [['Atividades', vazio(g.descricao) ? 'Não descritas pelo técnico.' : g.descricao], ['Ambiente', ambienteTxt(g) || 'Não descrito.']]
        .map(([k, v]) => ({ k, v: quebrar(v, CW - 6, 7.6) }));
      const hk = lh(6, 1.3), hv = lh(7.6, 1.35);
      const h = 3 + hk + Math.max(...b4.map(b => b.v.length)) * hv + cheias.reduce((s0, c) => s0 + 1.5 + hk + c.v.length * hv, 0) + 2.5;
      garantir(h);
      doc.setFillColor(247, 249, 252); doc.setDrawColor(...BORDA2); doc.setLineWidth(0.3); doc.rect(ML, y, CW, h, 'FD');
      let yy = y + 2.2;
      b4.forEach((b, i) => { const x = ML + 3 + i * w4; escrever([S(b.k).toUpperCase()], x, yy, 6, true, C2, { lh: hk }); escrever(b.v, x, yy + hk, 7.6, false, NAVY, { lh: hv }); });
      yy += hk + Math.max(...b4.map(b => b.v.length)) * hv + 1.5;
      for (const c of cheias) { escrever([S(c.k).toUpperCase()], ML + 3, yy, 6, true, C2, { lh: hk }); escrever(c.v, ML + 3, yy + hk, 7.6, false, vazio(g.descricao) && c.k === 'Atividades' ? C2 : NAVY, { lh: hv }); yy += hk + c.v.length * hv + 1.5; }
      y += h + 2;
    }
    const riscos = (g.riscos || []);
    h2('Quadro de riscos', 16);
    if (!riscos.length) paragrafo('Nenhum risco encontrado neste GHE.', 8, C2);
    else tabelaQ([{ t: 'Perigo / fator de risco', w: 0.155 }, { t: 'Fonte ou circunstância', w: 0.16 }, { t: 'Possíveis lesões ou agravos', w: 0.175 },
      { t: 'Exposição', w: 0.11 }, { t: 'Medidas existentes', w: 0.17 }, { t: 'P', w: 0.035 }, { t: 'S', w: 0.035 }, { t: 'Nível', w: 0.15 }],
      riscos.map(r => {
        const cod = nivelDoRisco(r), n = nivelInfo(cod), ac = acaoDoRisco.get(r.uid);
        return [
          { t: r.nome, b: true, sub: `${CATEGORIAS[r.categoria] || 'Outro'}${r.codigo ? ' · SOC ' + r.codigo : ''}${r.pendente ? ' · pendente' : ''}` },
          { t: vazio(r.fonte) ? '' : r.fonte, sub: vazio(r.analise) ? (vazio(r.fonte) ? '-' : '') : cortarTxt(r.analise, 180) },
          danosDe(r) || '-',
          EXPO_NOME[r.exposicao] || '-',
          medidasTxt(r),
          { t: r.probabilidade ? String(r.probabilidade) : '-', center: true },
          { t: r.severidade ? String(r.severidade) : '-', center: true },
          cod ? { t: curtoNivel(cod), fill: hexRgb(n?.cor), fg: cod === 'critico' ? BRANCO : NAVY, sub: ac ? `Ação ${ac.numero} do plano` : (ACEIT_TXT[n?.aceitabilidade] || '') } : { t: r.codigo === '1068' ? '-' : 'sem nível', c: C2 }
        ];
      }), { size: 7.3, subSize: 6.4 });
    const pend = riscos.filter(r => r.pendente);
    if (pend.length) { y += 1; for (const r of pend) paragrafo(`Ainda falta (${r.nome}): ${r.pendente.texto || 'sem descrição'} — ${r.pendente.quem === 'empresa' ? 'depende da empresa' : 'depende do técnico'}.`, 7.6, AMAR_TXT); }

    // leituras
    const lidos = riscos.filter(r => !vazio(r.medicao?.resultado) || !vazio(r.iluminacao?.nivel_encontrado));
    if (lidos.length) {
      h2('Leituras e medições', 14);
      tabelaQ([{ t: 'Agente', w: 0.15 }, { t: 'Resultado', w: 0.18 }, { t: 'Referência', w: 0.22 }, { t: 'Equipamento / método · data', w: 0.2 }, { t: 'Leitura', w: 0.25 }],
        lidos.map(r => {
          const il = r.iluminacao || {}, m = r.medicao || {};
          if (!vazio(il.nivel_encontrado) && vazio(m.resultado)) {
            const v = numTxt(il.nivel_encontrado), min = numTxt(il.nivel_minimo);
            return [{ t: r.nome, b: true }, { t: `${valorBr(il.nivel_encontrado)} lux`, b: true, sub: vazio(il.irc) ? '' : `IRC ${valorBr(il.irc)}` },
              min != null ? `mínimo para a tarefa: ${fmt(min)} lux (NHO 11)` : { t: 'mínimo da tarefa não informado (NHO 11)', c: C2 },
              `${il.metodo || 'Luxímetro'} · ${dataBR(il.data) || dataBR(av.data_visita)}`,
              min == null ? { t: 'A conferir com o mínimo da tarefa', c: AMAR_TXT } : v >= min ? { t: 'Atende ao mínimo', c: VERDE, b: true } : { t: 'Abaixo do mínimo', c: VERM, b: true }];
          }
          const un = m.unidade || '', res = numTxt(m.resultado), lim = numTxt(m.limite);
          const dos = /dos[ií]metr/i.test(String(m.metodo || ''));
          const acima = m.situacao === 'acima' || (res != null && lim != null && m.situacao !== 'abaixo' && res > lim);
          const refTxt = vazio(m.limite) ? { t: 'não informada', c: C2 } : String(m.limite).replace(/\s*·\s*/g, ' · ');
          const leit = dos ? { t: `Dosimetria · ${acima ? 'acima do limite' : 'abaixo do limite'}`, b: true, c: acima ? VERM : VERDE }
            : { t: `Leitura pontual (indicativa) · ${acima ? 'acima da referência: avaliar a exposição da jornada (NHO)' : 'abaixo da referência'}`, c: acima ? VERM : C1 };
          return [{ t: r.nome, b: true }, { t: `${valorBr(m.resultado)} ${un}`.trim(), b: true, sub: r.soc?.medicao?.valor ? `anterior: ${valorBr(r.soc.medicao.valor)} ${un}${r.soc.medicao.data ? ' em ' + r.soc.medicao.data : ''}` : '' },
            refTxt, `${vazio(m.metodo) ? 'não informado' : m.metodo} · ${dataBR(m.data) || dataBR(av.data_visita)}`, leit];
        }), { size: 7.3, subSize: 6.4 });
    }

    // conclusões indicativas (para o lançamento no SOC)
    const comConc = riscos.filter(r => (CONCLUSOES[r.categoria] || []).length);
    if (comConc.length) {
      const item = (k) => {
        const sim = comConc.filter(r => r[k] === 'S'), sem = comConc.filter(r => (CONCLUSOES[r.categoria] || []).includes(k) && !['S', 'N'].includes(r[k]));
        if (sim.length) return `indicada (${sim.map(r => r.nome + (k === 'ins' && r.grau ? ' ' + r.grau : '')).join(', ')})`;
        if (!comConc.some(r => (CONCLUSOES[r.categoria] || []).includes(k))) return 'não se aplica aos riscos deste GHE';
        return sem.length ? 'sem conclusão registrada' : 'não indicada';
      };
      const segs = [{ t: 'Informação para o lançamento no SOC (indicativo técnico, não é laudo). ', b: true, c: AMAR_TXT },
        { t: `Insalubridade: ${item('ins')}. Periculosidade: ${item('per')}. Aposentadoria especial: ${item('ae')}. ` },
        { t: 'A caracterização legal de insalubridade e periculosidade é feita por perícia de médico do trabalho ou engenheiro de segurança do trabalho (CLT, art. 195); a de aposentadoria especial, pelo LTCAT (Lei 8.213/1991, art. 58).', c: C2 }];
      const ls = rico(segs, CW - 6, 7.4), h = ls.length * lh(7.4, 1.4) + 3.4;
      garantir(h + 2); y += 2;
      doc.setFillColor(255, 250, 240); doc.setDrawColor(240, 201, 138); doc.setLineWidth(0.3); doc.rect(ML, y, CW, h, 'FD');
      escreverRico(ls, ML + 3, y + 1.7, 7.4, [107, 74, 14], lh(7.4, 1.4));
      y += h + 1;
    }

    // registro fotográfico do GHE (risco + GHE), com legenda
    const fr = [];
    for (const r of riscos) for (const f of fotosDoRisco.get(r) || []) fr.push({ ...f, _num: numeroFoto.get(f), legenda: [r.nome, f.legenda].filter(x => !vazio(x)).join(SEP) });
    for (const f of fotosDoGhe.get(g.id) || []) fr.push({ ...f, _num: numeroFoto.get(f), legenda: vazio(f.legenda) ? 'Visão geral do GHE' : f.legenda });
    if (fr.length) {
      const primeira = pecasFotos(fr.slice(0, 3), ML, CW, 3, null, 0.72)[0].h;
      h2('Registro fotográfico', primeira);
      await gradeFotos(fr, 3, 0.72);
    }
  }
  // =================== v223: PLANO DE AÇÃO (5W2H) ===================
  if (temPlanoPdf) {
    novaPagina('5 · Plano de ação (5W2H)');
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
        : `${a.nivel?.nome ? a.nivel.nome + (a.nivel.p ? ` (severidade ${a.nivel.s}, probabilidade ${a.nivel.p})` : '') + '. ' : ''}${cortarTxt(a.motivo, 260)}`;
      const como = (a.medidas || []).map((m, i) => `${i + 1}) ${m}`).join(' ');
      const linhas = [
        ['Onde', `${ondeAcao(a)}${a.risco ? SEP + a.risco : ''}${a.pessoas ? SEP + plural(a.pessoas, 'pessoa', 'pessoas') : ''}`],
        ['Por quê', porque],
        ['Como', cortarTxt(como, 700)],
        ['Quem · Quanto', `${a.quem || 'a definir pela empresa'}${SEP}${a.quanto != null && a.quanto !== '' ? 'R$ ' + Number(a.quanto).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'a orçar'}`],
        ['Acompanhamento', cortarTxt(a.acompanhamento, 220)],
        ['Meta', cortarTxt(a.meta, 200)],
        ['Aferição', cortarTxt(a.afericao, 200)]
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

  // =================== 6 · TREINAMENTOS, PENDÊNCIAS E REGISTROS ===================
  novaPagina('6 · Treinamentos, pendências e registros');
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
  if (dados.fotosDocumento > 0) paragrafo(`${plural(dados.fotosDocumento, 'foto de documento foi registrada', 'fotos de documentos foram registradas')} na visita e ${dados.fotosDocumento === 1 ? 'fica guardada' : 'ficam guardadas'} no GRID, fora deste relatório.`, 7.4, C2);

  // =================== 7 · CONSIDERAÇÕES, 8 · ASSINATURAS, REVISÕES ===================
  novaPagina('7 · Considerações técnicas e responsabilidade');
  h2n(7, 'Considerações técnicas e limitações', 20);
  {
    const lims = [
      'Este relatório registra as condições observadas na data da visita, nos ambientes e atividades apresentados pela empresa. Mudanças posteriores não estão cobertas.',
      'As leituras pontuais com instrumentos portáteis têm caráter indicativo e não substituem a avaliação quantitativa da exposição ocupacional pelas Normas de Higiene Ocupacional da Fundacentro (por exemplo, a dosimetria de ruído da NHO 01).',
      'As indicações sobre insalubridade, periculosidade e aposentadoria especial servem ao lançamento no SOC e não substituem o laudo pericial (CLT, art. 195) nem o LTCAT (Lei 8.213/1991, art. 58), que exigem médico do trabalho ou engenheiro de segurança do trabalho.',
      'A avaliação de riscos deve ser revista a cada dois anos ou antes, nas situações do item 1.5.4.4.6 da NR-01 (mudança de processo, acidente, medidas ineficazes, entre outras). O inventário deve ser mantido atualizado (item 1.5.7.3.3).',
      'Cabe à empresa implementar as ações do plano nos prazos indicados, acompanhar sua execução e aferir os resultados (NR-01, itens 1.5.5.2.1 e 1.5.5.2.2).',
    ];
    const hl2 = lh(8, 1.45);
    lims.forEach((t, i) => {
      const ls = quebrar(t, CW - 7, 8), h = ls.length * hl2 + 1.4;
      garantir(h);
      fonte(8, true, NAVY); doc.text(S(`${i + 1}.`), ML + 1, base(y, 8, hl2));
      escrever(ls, ML + 6, y, 8, false, C1, { lh: hl2 });
      y += h;
    });
  }

  // assinaturas (bloco inteiro junto)
  {
    const assinantes = [];
    assinantes.push({
      img: dados.assinaturas?.tec, nome: tec.nome || 'Técnico responsável', papel: papelTecR,
      quando: av.assinatura_tec_em ? `Assinado em ${dataHoraBR(av.assinatura_tec_em)}` : 'Sem assinatura registrada',
    });
    if (!vazio(av.acompanhante_nome)) assinantes.push({
      img: dados.assinaturas?.acomp, nome: String(av.acompanhante_nome).trim(),
      papel: [av.acompanhante_cargo, 'acompanhante pela empresa'].filter(x => !vazio(x)).map(x => String(x).trim()).join(SEP),
      quando: av.assinatura_acomp_em ? `Assinado em ${dataHoraBR(av.assinatura_acomp_em)}` : 'Sem assinatura registrada',
    });
    const colW = (CW - 10) / 2, hImg = 18;
    const textos = assinantes.map(a => [
      ...quebrar(a.nome, colW, 8.4, true).map(t => ({ t, b: true, c: NAVY })),
      ...quebrar(a.papel, colW, 7.6).map(t => ({ t, c: C1 })),
      ...quebrar(a.quando, colW, 7.2).map(t => ({ t, c: C2 })),
    ]);
    const decl = quebrar(`Declaramos que as informações deste relatório correspondem ao observado e ao informado pela empresa na visita de ${dataBR(av.data_visita) || '-'}.`, CW, 8);
    const hTxt = Math.max(...textos.map(t => t.length)) * lh(8, 1.4);
    const hBloco = decl.length * lh(8, 1.45) + 3 + hImg + 1.5 + hTxt;
    h2n(8, 'Conferência e assinaturas', hBloco + 4);
    escrever(decl, ML, y, 8, false, C1, { lh: lh(8, 1.45) }); y += decl.length * lh(8, 1.45) + 3;
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
    y += hImg + 1.5 + hTxt + 2;
  }

  // controle de revisões
  {
    const revs = (Array.isArray(dados.revisoes) && dados.revisoes.length ? dados.revisoes
      : [{ revisao, data: av.concluida_em, motivo: revisao === 1 ? 'Emissão inicial' : (av.motivo_revisao || 'Revisão (motivo não registrado)'), responsavel: tec.nome }])
      .slice().sort((a, b) => (a.revisao ?? 0) - (b.revisao ?? 0));
    h2('Controle de revisões', 14);
    tabelaQ([{ t: 'Rev.', w: 0.08 }, { t: 'Data', w: 0.15 }, { t: 'Motivo', w: 0.52 }, { t: 'Responsável', w: 0.25 }],
      revs.map(r => [{ t: String(r.revisao ?? '-'), b: true, center: true },
        r.data ? dataBR(String(r.data).slice(0, 10)) : { t: r.revisao === revisao ? 'em aberto' : '-', c: C2 },
        r.motivo || '-', r.responsavel || '-']), { size: 7.8 });
  }
  h2('Anexos', 8);
  paragrafo('A · Critérios de probabilidade e severidade da matriz de risco   ·   B · Palavras deste relatório (glossário)', 7.8, C1);
  {
    const nota = 'Documento gerado a partir do registro de campo no GRID. Depois de concluída, a avaliação não se altera; mudanças geram nova revisão e as anteriores ficam no histórico.';
    const ls = quebrar(nota, CW, 7.2); garantir(ls.length * lh(7.2, 1.5) + 3); y += 3;
    escrever(ls, ML, y, 7.2, false, C2, { lh: lh(7.2, 1.5) }); y += ls.length * lh(7.2, 1.5);
  }

  // =================== ANEXO A · CRITÉRIOS ===================
  {
    const M = MZ || {};
    const cp = M.criterios_prob, cs = M.criterios_sev;
    const ok = c => c && Array.isArray(c.colunas) && Array.isArray(c.linhas) && c.linhas.length;
    novaPagina('Anexo A · Critérios de probabilidade e severidade');
    paragrafo('Critérios usados para classificar cada risco na matriz (NR-01, item 1.5.4.4.2.2). A probabilidade considera as medidas de prevenção existentes, o perfil de exposição e as exigências da atividade; o nível adotado é o mais desfavorável entre os critérios que se aplicam.', 7.8, C1);
    if (ok(cp)) {
      h2('Probabilidade', 20);
      const n = cp.colunas.length, w0 = 0.12, wi = (1 - w0) / n;
      tabelaQ([{ t: 'Nível', w: w0 }, ...cp.colunas.map(t => ({ t, w: wi }))],
        cp.linhas.map((l, i) => [{ t: `P${i + 1}`, b: true, sub: PROBABILIDADE[i + 1] || '' }, ...l.map(t => t || '-')]), { size: 6.9, subSize: 6.2, cabSize: 6.1 });
    }
    if (ok(cs)) {
      h2('Severidade', 20);
      const n = cs.colunas.length, w0 = 0.12, wi = (1 - w0) / n;
      tabelaQ([{ t: 'Nível', w: w0 }, ...cs.colunas.map(t => ({ t, w: wi }))],
        cs.linhas.map((l, i) => [{ t: `S${i + 1}`, b: true, sub: SEVERIDADE[i + 1] || '' }, ...l.map(t => t || '-')]), { size: 6.9, subSize: 6.2, cabSize: 6.1 });
    }
    if (!ok(cp) && !ok(cs)) paragrafo('Critérios detalhados não cadastrados na matriz desta organização.', 7.8, C2);
    y += 2;
    paragrafo('LEO: limite de exposição ocupacional. PAINPSE: perda auditiva induzida por níveis de pressão sonora elevados. DORT: distúrbio osteomuscular relacionado ao trabalho.', 7, C2);
  }

  // =================== ANEXO B · GLOSSÁRIO ===================
  novaPagina('Anexo B · Palavras deste relatório');
  {
    const itens = [
      ['GHE', 'grupo homogêneo de exposição: trabalhadores com atividades e riscos parecidos.'],
      ['Perigo', 'o que pode causar dano (ex.: máquina, barulho, produto químico).'],
      ['Risco', 'a chance de o dano acontecer, combinada com a gravidade do dano.'],
      ['Probabilidade (P)', 'o quanto é provável o dano acontecer, de 1 (altamente improvável) a 5 (altamente provável).'],
      ['Severidade (S)', 'o quanto o dano seria grave, de 1 (lesão leve) a 5 (lesão crítica ou fatal).'],
      ['Nível de risco', 'resultado da matriz para P e S: Irrelevante, Baixo, Moderado, Alto ou Crítico.'],
      ['Exposição', 'permanente (toda a jornada), intermitente (de vez em quando) ou eventual (raramente).'],
      ['EPI', 'proteção usada pela pessoa (protetor auricular, luva, calçado).'],
      ['EPC', 'proteção coletiva, no ambiente (cabine fechada, exaustor, guarda-corpo).'],
      ['CA', 'número do Certificado de Aprovação do EPI no Ministério do Trabalho.'],
      ['dB(A)', 'unidade do barulho. lux: unidade da iluminação.'],
      ['Leitura pontual', 'medição rápida no momento da visita; indica, mas não mede a jornada inteira.'],
      ['Dosimetria', 'medição que acompanha o trabalhador durante a jornada (ex.: ruído pela NHO 01).'],
      ['Insalubridade', 'adicional no salário quando o agente passa do limite da NR-15. Caracterizada por laudo pericial.'],
      ['Periculosidade', 'adicional de 30% em atividades perigosas (NR-16). Caracterizada por laudo pericial.'],
      ['Aposentadoria especial', 'tempo de contribuição menor por exposição a agentes nocivos; comprovada pelo LTCAT.'],
      ['PGR', 'Programa de Gerenciamento de Riscos (NR-01): inventário de riscos e plano de ação.'],
      ['5W2H', 'forma de escrever cada ação: o quê, por quê, onde, quando, quem, como e quanto.'],
    ];
    const colW = (CW - 6) / 2, hl2 = lh(7.8, 1.4);
    const blocos = itens.map(([t, d]) => rico([{ t: `${t}: `, b: true, c: NAVY }, { t: d }], colW, 7.8));
    for (let i = 0; i < blocos.length; i += 2) {
      const h = Math.max(...blocos.slice(i, i + 2).map(b => b.length)) * hl2 + 1.6;
      garantir(h);
      blocos.slice(i, i + 2).forEach((b, j) => escreverRico(b, ML + j * (colW + 6), y, 7.8, C1, hl2));
      y += h;
    }
  }

  // =================== RODAPÉ EM TODAS AS PÁGINAS ===================
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LINHA); doc.setLineWidth(0.25); doc.line(ML, PH - 12.5, PW - MR, PH - 12.5);
    fonte(7, false, C3);
    const esq = doc.splitTextToSize(S(`Relatório de Avaliação de Riscos Ocupacionais · ${cli.nome || ''}`), CW - 70)[0];
    doc.text(esq, ML, PH - 8.6);
    doc.text(S(`${numero} · rev. ${revisao} · página ${p} de ${total}`), PW - MR, PH - 8.6, { align: 'right' });
  }
  progresso('final', 1, 1);

  if (typeof Blob !== 'undefined') return doc.output('blob');
  return doc.output('arraybuffer');
}
