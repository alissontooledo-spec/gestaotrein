/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/campo/laudomiro-calc.js — calculadora de dose de ruído (v281)
   NR-15, Anexo 1 (ruído contínuo ou intermitente), conferido no texto oficial
   em 24/10/2026 (base do Laudomiro, FONTE-nr-15-anexo-01):
   - Quadro: nível em dB(A) e máxima exposição diária permissível
   - item 4: nível intermediário usa o limite do nível imediatamente mais elevado
   - item 5 e 7: acima de 115 dB(A) sem proteção adequada não é permitido (risco grave e iminente)
   - item 6: soma C1/T1 + ... + Cn/Tn; passou de 1, está acima do limite de tolerância
   NR-09, item 9.6.1, alínea c: nível de ação para ruído = metade da dose.
   Mesma regra da ficha "Ruído contínuo" (v241, parecer aprovado em 09/10/2026): de 80 a 85 dB(A) o nível
   não entra na soma da NR-15, mas conta para o nível de ação (q = 5: tempo/8 h × 2^((L-85)/5)).
   NR-15, item 15.4.1, alínea b: neutralização pelo EPI é avaliada à parte.
   Conta feita no aparelho. Não gasta pergunta e não sai do GRID.
   ══════════════════════════════════════════════════════════════════════════ */

/** [nível dB(A), máxima exposição diária em minutos] */
export const QUADRO = [
  [85, 480], [86, 420], [87, 360], [88, 300], [89, 270], [90, 240], [91, 210], [92, 180],
  [93, 160], [94, 135], [95, 120], [96, 105], [98, 75], [100, 60], [102, 45], [104, 35],
  [105, 30], [106, 25], [108, 20], [110, 15], [112, 10], [114, 8], [115, 7],
];

/** Lê "87,5" ou "87.5". Devolve número ou NaN. */
export function lerNumero(x) {
  const s = String(x ?? '').trim().replace(/\s/g, '').replace(',', '.');
  return s === '' || !/^\d+(\.\d+)?$/.test(s) ? NaN : Number(s);
}

/** Linha do Quadro que vale para o nível (item 4). null abaixo de 85, 'acima' acima de 115. */
export function linhaDoQuadro(nivel) {
  if (!(nivel >= 85)) return null;
  if (nivel > 115) return 'acima';
  return QUADRO.find(([n]) => n >= nivel - 1e-9);
}

export const num = (x, casas) => x.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
export const nivelTxt = (n) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} dB(A)`;
const minTxt = (m) => (Number.isInteger(m) ? String(m) : num(m, 1));
export function duracao(min) {
  const t = Math.round(min), h = Math.floor(t / 60), m = t - h * 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/**
 * linhas: [{ nivel, horas, minutos }] (texto ou número).
 * Devolve { itens, erros, dose, tempo, acimaAcao, acimaLT, acima115 }.
 */
export function calcular(linhas) {
  const itens = [], erros = [];
  (linhas || []).forEach((l, i) => {
    const vazio = [l.nivel, l.horas, l.minutos].every((v) => String(v ?? '').trim() === '');
    if (vazio) return;
    const nivel = lerNumero(l.nivel);
    const h = String(l.horas ?? '').trim() === '' ? 0 : lerNumero(l.horas);
    const m = String(l.minutos ?? '').trim() === '' ? 0 : lerNumero(l.minutos);
    if (!Number.isFinite(nivel) || nivel < 30 || nivel > 160) { erros.push({ i, campo: 'nivel', msg: 'Nível entre 30 e 160 dB(A).' }); return; }
    const min = Math.round((h * 60 + m) * 10) / 10;
    if (!Number.isFinite(h) || !Number.isFinite(m) || h > 24 || (m >= 60 && h > 0) || min > 1440) { erros.push({ i, campo: 'tempo', msg: 'Tempo de um período: até 24 horas, com minutos de 0 a 59.' }); return; }
    if (min <= 0) { erros.push({ i, campo: 'tempo', msg: 'Informe o tempo de exposição.' }); return; }
    const ref = linhaDoQuadro(nivel);
    if (ref === null) itens.push({ i, nivel, min, tipo: nivel >= 80 ? 'acao' : 'abaixo', fracao: 0, acao: nivel >= 80 ? (min / 480) * Math.pow(2, (nivel - 85) / 5) : 0 });
    else if (ref === 'acima') itens.push({ i, nivel, min, tipo: 'acima', fracao: null });
    else itens.push({ i, nivel, min, tipo: ref[0] === nivel ? 'quadro' : 'intermediario', ref: ref[0], limite: ref[1], fracao: min / ref[1] });
  });
  const tempo = itens.reduce((s, x) => s + x.min, 0);
  const dose = Math.round(itens.reduce((s, x) => s + (x.fracao || 0), 0) * 1e9) / 1e9;  // 0,5 + 0,5 dá 1, não 1,0000001
  const doseAcao = Math.round((dose + itens.reduce((s, x) => s + (x.acao || 0), 0)) * 1e9) / 1e9;
  const acima115 = itens.some((x) => x.tipo === 'acima');
  return { itens, erros, tempo, dose, doseAcao, acimaAcao: doseAcao > 0.5, acimaLT: dose > 1 || acima115, acima115 };
}

/** Frase do resultado (sem travessão e sem ponto e vírgula). */
export function conclusao(r) {
  if (r.erros?.length) return { nivel: 'erro', titulo: `Confira o período ${r.erros[0].i + 1}`, texto: `${r.erros[0].msg} O resultado só sai com todos os períodos certos.` };
  if (r.acima115) return { nivel: 'lt', titulo: 'Acima de 115 dB(A)', texto: `Exposição acima de 115 dB(A) sem proteção adequada não é permitida e oferece risco grave e iminente (NR-15, Anexo 1, itens 5 e 7).${r.dose > 1 ? ' A soma das frações dos outros períodos também passou de 1 (item 6).' : ''}` };
  if (r.dose > 1) return { nivel: 'lt', titulo: 'Acima do limite de tolerância', texto: 'A soma das frações passou de 1. A exposição está acima do limite de tolerância (NR-15, Anexo 1, item 6).' };
  if (r.doseAcao > 0.5) return { nivel: 'acao', titulo: 'Acima do nível de ação', texto: `Dentro do limite de tolerância, mas acima do nível de ação, que é a metade da dose (NR-09, item 9.6.1, alínea c)${r.doseAcao !== r.dose ? `. Para o nível de ação a dose é ${num(r.doseAcao * 100, 1)}%, porque os períodos de 80 a 85 dB(A) também contam` : ''}. Acima dele devem ser feitas ações de controle sistemático (item 9.6.1.2).` };
  return { nivel: 'ok', titulo: 'Abaixo do nível de ação', texto: 'A dose não passa da metade do limite. Está abaixo do nível de ação (NR-09, item 9.6.1, alínea c).' };
}

/** Avisos sobre o tempo total (mesma regra da ficha Ruído contínuo). */
export function avisos(r) {
  if (r.tempo > 720) return [`Confira as horas: o total informado é ${duracao(r.tempo)} por dia.`];
  if (r.tempo < 480 && !r.acima115) return [`O restante da jornada (até 8 h) foi considerado abaixo de 80 dB(A), sem entrar em nenhuma das contas.`];
  return [];
}

/** Memória de cálculo em texto, para copiar, PDF ou Word. */
export function memoria(r) {
  const lin = [];
  lin.push('PERÍODOS MEDIDOS');
  r.itens.forEach((x) => {
    const base = `${x.i + 1}. ${nivelTxt(x.nivel)} durante ${duracao(x.min)}.`;
    if (x.tipo === 'abaixo') lin.push(`${base} Abaixo de 80 dB(A): não entra na soma da NR-15 nem no nível de ação.`);
    else if (x.tipo === 'acao') lin.push(`${base} De 80 a 85 dB(A): não entra na soma da NR-15. Conta só para o nível de ação: ${minTxt(x.min)} ÷ 480 × 2^((${x.nivel.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} - 85) ÷ 5) = ${num(x.acao, 3)}`);
    else if (x.tipo === 'acima') lin.push(`${base} Acima de 115 dB(A): não há limite no Quadro. Exposição não permitida sem proteção adequada (itens 5 e 7).`);
    else {
      const qual = x.tipo === 'intermediario' ? ` Nível intermediário: vale o limite de ${x.ref} dB(A), o imediatamente mais elevado (item 4).` : '';
      lin.push(`${base}${qual} Limite do Quadro: ${duracao(x.limite)} (${x.limite} min). Fração: ${minTxt(x.min)} ÷ ${x.limite} = ${num(x.fracao, 3)}`);
    }
  });
  lin.push('');
  lin.push('DOSE');
  const parcelas = r.itens.filter((x) => x.fracao > 0).map((x) => num(x.fracao, 3));
  lin.push(parcelas.length > 1 ? `Dose = ${parcelas.join(' + ')} = ${num(r.dose, 3)} (${num(r.dose * 100, 1)}%)`
    : parcelas.length ? `Dose = ${num(r.dose, 3)} (${num(r.dose * 100, 1)}%)` : 'Dose = 0 (nenhum período a partir de 85 dB(A))');
  if (r.doseAcao !== r.dose) lin.push(`Dose para o nível de ação (inclui 80 a 85 dB(A)) = ${num(r.doseAcao, 3)} (${num(r.doseAcao * 100, 1)}%)`);
  lin.push(`Tempo total informado: ${duracao(r.tempo)}.`);
  avisos(r).forEach((a) => lin.push(a));
  lin.push('');
  const c = conclusao(r);
  lin.push('RESULTADO');
  lin.push(`${c.titulo}. ${c.texto}`);
  lin.push('');
  lin.push('OBSERVAÇÕES');
  lin.push('- Conta pela NR-15, Anexo 1, item 6: soma de C ÷ T de cada período, com T do Quadro do Anexo 1.');
  lin.push('- O protetor auricular não entra nesta conta. A neutralização pelo EPI é avaliada à parte (NR-15, item 15.4.1, alínea b).');
  lin.push('- Para aposentadoria especial valem as regras do INSS (Decreto 3.048/1999, Anexo IV, e IN 128/2022), com limite e método que dependem do período. Esta conta não substitui o LTCAT.');
  return lin.join('\n');
}
