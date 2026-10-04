/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/campo/coerencia.js — alertas de coerência da classificação (v226)
   Proposta aprovada em 30/09: 08-Propostas-visuais/propostas-visuais-alertas-coerencia-v226.html
   O GRID confere se a probabilidade (P) e a severidade (S) escolhidas combinam com o
   que o próprio técnico registrou no risco, pelos critérios do Anexo A da matriz.
   Avisa, não decide: o técnico corrige ou justifica (r.justif_ps). Para concluir,
   todo aviso precisa estar corrigido ou justificado (R6 é só informativo).
   Parecer do engenheiro de segurança (regras R1 a R6). Sem SQL: tudo no JSON do risco.
   ══════════════════════════════════════════════════════════════════════════ */

const vazio = (t) => !String(t ?? '').trim() || /^(na|n\/a|-|não se aplica|nao se aplica|nada a acrescentar\.?)$/i.test(String(t).trim());
const numTxt = (v) => { const m = String(v ?? '').replace(/\s/g, '').match(/-?\d+(?:[.,]\d+)?/); return m ? Number(m[0].replace(',', '.')) : null; };
const fmt = (n) => String(Math.round(n)).replace('.', ',');

/* Limites conhecidos (os mesmos da tela de medição). */
const REF = { '460': { un: 'dB(A)', lim: 85 }, '466': { un: 'm/s²', lim: 1.1 }, '1001': { un: 'm/s1,75', lim: 21 }, '534': { un: 'm/s²', lim: 5 } };
/* R4 — severidade mínima por agente (Anexo A, exemplos de severidade). PENDENTE: revisão do engenheiro no 1º mês. */
export const SEV_MINIMA = {
  '460': [4, 'ruído contínuo pode causar perda auditiva irreversível (PAINPSE)'],
  '461': [4, 'ruído de impacto pode causar perda auditiva irreversível (PAINPSE)'],
  '553': [4, 'máquinas fora da NR-12 podem causar amputação'],
  '540': [5, 'queda de altura pode ser fatal'],
  '562': [5, 'espaço confinado pode ser fatal (asfixia, intoxicação)'],
  '541': [5, 'choque elétrico pode ser fatal']
};
/* Faixas do perfil de exposição do Anexo A (percentual do limite). */
function pDaExposicao(pct) { return pct < 10 ? 1 : pct < 50 ? 2 : pct <= 100 ? 3 : pct <= 500 ? 4 : 5; }

/* Percentual do limite da leitura (null se não der para calcular). Ruído contínuo: dose pela NHO 01 (85 dB(A), q = 3). */
export function percentualDoLimite(r) {
  const m = r?.medicao || {};
  const res = numTxt(m.resultado); if (res == null) return null;
  const cod = String(r.codigo || '');
  const un = String(m.unidade || REF[cod]?.un || '');
  if (cod === '461') return null;                       // impacto: pico, sem dose
  if (/db/i.test(un) || cod === '460') {
    if (cod !== '460' && !/db\s*\(?a/i.test(un)) return null;
    return 100 * Math.pow(2, (res - 85) / 3);
  }
  const lim = numTxt(m.limite) ?? REF[cod]?.lim ?? null;
  return lim && lim > 0 ? 100 * res / lim : null;
}

/* v234 (decisão do Alisson, 04/10): "Nada a acrescentar" (como o SOC registra) quer dizer que as
   medidas existentes continuam como estão; não é "sem medida". Se mudou, o técnico informa. */
const nadaAcrescentar = (t) => /^nada a acrescentar\.?$/i.test(String(t ?? '').trim());
const semMedida = (r) => vazio(r.epc) && vazio(r.epi) && vazio(r.medidas_adm) && ![r.epc, r.epi, r.medidas_adm].some(nadaAcrescentar);

/* Lista os avisos do risco: [{id, texto, info}] (info = só informativo, não pede justificativa). */
export function alertas(r) {
  const out = [];
  if (!r || r.pendente || String(r.codigo) === '1068') return out;
  const p = Number(r.probabilidade), s = Number(r.severidade);
  if (!(p >= 1 && p <= 5 && s >= 1 && s <= 5)) return out;
  if (p <= 2 && semMedida(r))
    out.push({ id: 'R1', texto: `P${p} pressupõe medidas existentes e eficientes, e este risco não tem nenhuma medida registrada (EPC, EPI ou administrativa). Pelo Anexo A, medidas inexistentes = P5. Registre as medidas que a empresa tem ou reveja a probabilidade.` });
  if (p <= 2 && !vazio(r.epi) && ['N', 'SNS'].includes(r.epi_eficaz))
    out.push({ id: 'R2', texto: `EPI ${r.epi_eficaz === 'N' ? 'não eficaz' : 'não suficiente'} é deficiência da medida: pelo Anexo A, P3 (pequenas deficiências) ou P4 (desvios significativos), e não P${p}.` });
  const pct = percentualDoLimite(r);
  if (pct != null) {
    const pMin = pDaExposicao(pct);
    if (p < pMin) out.push({ id: 'R3', texto: `A leitura corresponde a ${fmt(pct)}% do limite${String(r.codigo) === '460' ? ' (dose pela NHO 01)' : ''}. Pelo perfil de exposição do Anexo A, isso indica P${pMin} ou mais. A leitura pontual é indicativa: confirme ou justifique.` });
  }
  const sm = SEV_MINIMA[String(r.codigo || '')];
  if (sm && s < sm[0]) out.push({ id: 'R4', texto: `Severidade mínima para este agente: S${sm[0]} (${sm[1]}). Está S${s}.` });
  const il = r.iluminacao || {};
  const enc = numTxt(il.nivel_encontrado), min = numTxt(il.nivel_minimo);
  if (enc != null && min != null && enc < min && p <= 2)
    out.push({ id: 'R5', texto: `A iluminância medida (${fmt(enc)} lux) está abaixo do mínimo da tarefa (${fmt(min)} lux): a medida existente é inadequada para P${p}.` });
  const acima = r.medicao?.situacao === 'acima' || (pct != null && pct > 100);
  if (acima && r.ins === 'N')
    out.push({ id: 'R6', info: true, texto: 'Leitura acima do limite e insalubridade marcada "Não". Leitura pontual não caracteriza insalubridade, mas confira a informação que vai para o SOC.' });
  return out;
}

/* Avisos que ainda pedem ação: não informativos e não cobertos pela justificativa. */
export function pendentes(r) {
  const j = r?.justif_ps;
  const cobertos = new Set(j && String(j.texto || '').trim() ? (j.regras || []) : []);
  return alertas(r).filter(a => !a.info && !cobertos.has(a.id));
}
export const justificado = (r) => !!(r?.justif_ps && String(r.justif_ps.texto || '').trim() && alertas(r).some(a => !a.info) && !pendentes(r).length);
