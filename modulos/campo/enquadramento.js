/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/campo/enquadramento.js — Enquadramento de SESMT (NR-04) e CIPA (NR-05)
   A partir do CNAE da empresa (grau de risco, Anexo I da NR-04) e do número de
   funcionários que vem do SOC, diz: se precisa de SESMT e com quem; se precisa
   de CIPA (e quantos integrantes), de representante nomeado, ou se o SESMT faz o
   papel da CIPA. Módulo sem dependências (roda no navegador e nos testes em node).

   Fontes (PDF oficial conferido em 03/10/2026, fichas do Laudomiro):
     • Anexo I da NR-04 (CNAE → GR): 673 classes, texto oficial "atualizada 2023"
       (Portaria MTP 2.318/2022). O Anexo I está em revisão pelo MTE (consulta
       pública 2026): trocar a tabela quando sair a nova redação.
     • Anexo II da NR-04 (SESMT), itens 4.4 e 4.5 · Quadro I e itens 5.4.13, 5.7.4 da NR-05.
   O resultado é INDICATIVO: o técnico confirma. Não afirma obrigação sem dado
   (sem CNAE ou sem nº de funcionários o estado é "indefinido").
   ══════════════════════════════════════════════════════════════════════════ */

/* Classe CNAE (5 dígitos) + grau de risco. Ex.: "471132" = classe 47113 → GR 2. */
const ANEXO_I = '011133,011213,011303,011483,011563,011643,011993,012113,012293,013183,013263,013343,013423,013513,013933,014153,014233,015123,015213,015393,015473,015553,015983,016103,016283,016363,017093,021013,022094,023063,031163,031243,032133,032213,050034,060004,071034,072194,072274,072354,072434,072514,072944,081004,089164,089244,089324,089914,091064,099044,101123,101213,101393,102013,103173,103253,103333,104143,104223,104313,105113,105203,105383,106193,106273,106353,106433,106513,106603,106943,107163,107243,108133,108213,109113,109293,109373,109453,109533,109613,109963,111193,111273,111353,112163,112243,121073,122043,131113,131203,131383,131463,132193,132273,132353,133083,134053,135113,135293,135373,135453,135963,141182,141262,141342,141422,142152,142232,151063,152112,152972,153193,153273,153353,153943,154083,161023,162183,162263,162343,162933,171093,172143,172223,173112,173202,173382,174192,174272,174942,181133,181213,181303,182113,182293,183003,191013,192173,192253,193143,193223,201183,201263,201343,201423,201933,202153,202233,202913,203123,203213,203393,204013,205173,205253,206143,206223,206312,207113,207203,207383,209163,209244,209323,209413,209913,211063,212113,212203,212383,221113,221293,221963,222183,222263,222343,222933,231173,231253,231923,232064,233034,234194,234273,234944,239153,239234,239913,241134,241214,242114,242294,242374,242454,243184,243934,244154,244234,244314,244914,245124,245214,251104,251283,251363,252173,252253,253144,253224,253904,254113,254203,254383,255014,259183,259264,259343,259933,261083,262133,262213,263113,263293,264003,265153,265233,266043,267013,268093,271043,272103,272283,273173,273253,273333,274063,275113,275973,279023,281193,281273,281353,281433,281513,282163,282243,282323,282413,282593,282913,283133,283213,283303,284023,285183,285263,285343,285423,286153,286233,286313,286403,286583,286663,286913,291073,292043,293013,294173,294253,294333,294413,294503,294923,295063,301133,301213,303183,303263,304153,304233,305043,309113,309203,309973,310123,310213,310393,310472,321163,321243,322053,323023,324003,325073,329143,329223,329903,331123,331213,331393,331473,331553,331633,331713,331983,332103,332953,351153,351233,351313,351403,352043,353013,360063,370113,370293,381143,381223,382113,382203,383193,383273,383943,390053,411071,412043,421114,421204,421383,422194,422274,422354,429104,429284,429953,431184,431264,431343,431933,432153,432233,432913,433043,439164,439913,451112,451292,452003,453072,454122,454212,454393,461172,461252,461332,461412,461502,461682,461762,461842,461922,462142,462222,462312,463112,463202,463382,463462,463542,463622,463712,463972,464192,464272,464352,464432,464512,464602,464782,464942,465163,465243,466133,466213,466303,466483,466563,466993,467113,467293,467373,467453,467963,468183,468263,468343,468423,468513,468693,468773,468933,469152,469232,469312,471132,471212,471302,472112,472293,472372,472452,472962,473183,473263,474152,474231,474312,474402,475121,475211,475391,475471,475551,475631,475711,475981,476101,476281,476361,477172,477251,477331,477411,478141,478221,478311,478493,478572,478901,479032,491163,491243,492133,492213,492303,492483,492993,493023,494003,495073,501143,501223,502113,502203,503013,509123,509983,511113,511293,512003,513073,521173,521253,522143,522223,522313,522903,523113,523203,523973,524013,525083,531052,532022,551082,559062,561122,561212,562012,581153,581233,581313,581913,582123,582213,582393,582983,591112,591202,591382,591462,592012,601012,602172,602252,611082,612052,613022,614182,614262,614342,619062,620152,620232,620312,620402,620912,631192,631942,639172,639922,641071,642121,642211,642391,642471,643101,643281,643361,643441,643521,643611,643791,643871,644091,645061,646111,646201,646381,647011,649131,649211,649301,649991,651111,651201,652011,653081,654131,654211,655021,661181,661261,661341,661931,662151,662231,662911,663041,681021,682181,682261,691171,691251,692061,701071,702041,711111,711201,711971,712012,721002,722072,731141,731221,731901,732031,741021,742002,749011,750013,771101,771951,772171,772251,772331,772921,773141,773221,773311,773901,774031,781081,782051,783021,791121,791211,799021,801113,801293,802003,803073,811172,811252,812143,812223,812903,813031,821131,821992,822022,823002,829112,829202,829972,841161,841241,841321,842131,842211,842301,842481,842561,843021,851122,851212,851392,852012,853172,853252,853332,854142,854222,855032,859112,859292,859372,859962,861013,862163,862243,863053,864023,865002,866071,869091,871151,871231,872041,873011,880061,900192,900272,900351,910152,910232,910312,920031,931151,931232,931312,931912,932122,932982,941111,941201,942011,943081,949101,949281,949361,949951,951183,951263,952153,952913,960172,960252,960332,960922,970052,990081';
const TAB_GR = (() => { const m = new Map(); for (const x of ANEXO_I.split(',')) m.set(x.slice(0, 5), Number(x.slice(5))); return m; })();
export const TOTAL_CLASSES_ANEXO_I = TAB_GR.size;
export const NOME_GR = { 1: 'Leve', 2: 'Médio', 3: 'Alto', 4: 'Altíssimo' };

const soDigitos = (v) => String(v ?? '').replace(/\D/g, '');
/* O CNAE do cadastro (BrasilAPI) é a subclasse, 7 números ("4711302"). A BrasilAPI manda como
   NÚMERO e perde o zero da frente ("0710301" vira 710301): com 6 números, volta o zero. */
export function normCnae(cnae) { const d = soDigitos(cnae); return d.length === 6 ? '0' + d : d; }
/* O Anexo I é por classe (5 primeiros números). */
export function classeCnae(cnae) { const d = normCnae(cnae); return d.length >= 5 ? d.slice(0, 5) : ''; }
export function grauDoCnae(cnae) { return TAB_GR.get(classeCnae(cnae)) || null; }
export function cnaeBr(cnae) { const d = normCnae(cnae); return d.length >= 5 ? `${d.slice(0, 2)}.${d.slice(2, 4)}-${d[4]}${d.length >= 7 ? '/' + d.slice(5, 7) : ''}` : String(cnae || ''); }

/* ── Anexo II da NR-04: SESMT ──────────────────────────────────────────────
   Colunas: 50-100 | 101-250 | 251-500 | 501-1.000 | 1.001-2.000 | 2.001-3.500 | 3.501-5.000 | >5.000 (por grupo)
   '*' = tempo parcial (mín. 3 h) · '***' = pode ser enfermeiro do trabalho em tempo parcial no lugar. */
export const FAIXAS_SESMT = [[50, 100], [101, 250], [251, 500], [501, 1000], [1001, 2000], [2001, 3500], [3501, 5000]];
export const PROFISSIONAIS = ['Técnico de Segurança do Trabalho', 'Engenheiro de Segurança do Trabalho', 'Auxiliar/Técnico de Enfermagem do Trabalho', 'Enfermeiro do Trabalho', 'Médico do Trabalho'];
const SESMT = {
  1: [['', '', '', '1', '1', '1', '2', '1'], ['', '', '', '', '', '1*', '1', '1*'], ['', '', '', '', '', '1***', '1', '1'], ['', '', '', '', '', '', '1*', ''], ['', '', '', '', '1*', '1*', '1', '1*']],
  2: [['', '', '', '1', '1', '2', '5', '1'], ['', '', '', '', '1*', '1', '1', '1*'], ['', '', '', '', '1***', '1***', '1', '1'], ['', '', '', '', '', '', '1', ''], ['', '', '', '', '1*', '1', '1', '1']],
  3: [['', '1', '2', '3', '4', '6', '8', '3'], ['', '', '', '1*', '1', '1', '2', '1'], ['', '', '', '', '1***', '1', '1', '1'], ['', '', '', '', '', '1', '1', ''], ['', '', '', '1*', '1', '1', '2', '1']],
  4: [['1', '2', '3', '4', '5', '8', '10', '3'], ['', '1*', '1*', '1', '1', '2', '3', '1'], ['', '', '', '1***', '1***', '1', '1', '1'], ['', '', '', '', '', '1', '1', ''], ['', '1*', '1*', '1', '1', '2', '3', '1']]
};
const celula = (s) => { if (!s) return null; return { qtd: parseInt(s, 10), parcial: s.includes('*'), ou_enfermeiro: s.includes('***') }; };
/* Menor efetivo que obriga SESMT em cada grau (Anexo II). */
export const LIMITE_SESMT = { 1: 501, 2: 501, 3: 101, 4: 50 };

/* Dimensionamento do SESMT para `n` trabalhadores (empregados + terceiros não eventuais) no grau `gr`. */
export function dimensionarSesmt(gr, n) {
  if (!SESMT[gr] || !(n >= 0)) return { obrigatorio: false, faixa: null, profissionais: [] };
  if (n < LIMITE_SESMT[gr]) return { obrigatorio: false, faixa: null, profissionais: [], falta: LIMITE_SESMT[gr] - n };
  let col = FAIXAS_SESMT.findIndex(([a, b]) => n >= a && n <= b);
  let extra = 0;
  if (n > 5000) { col = 6; const exc = n - 5000; extra = Math.floor(exc / 4000) + (exc % 4000 > 2000 ? 1 : 0); }
  const profissionais = [];
  SESMT[gr].forEach((linha, i) => {
    const base = celula(linha[col]);
    const grupo = extra ? celula(linha[7]) : null;
    const qtd = (base?.qtd || 0) + (grupo ? grupo.qtd * extra : 0);
    if (qtd > 0) {
      /* tempo parcial só quando TODA a parcela é parcial (base e, acima de 5.000, também o grupo) */
      const parcial = (base ? base.parcial : true) && (grupo ? grupo.parcial : true);
      profissionais.push({ profissional: PROFISSIONAIS[i], qtd, parcial, ou_enfermeiro: !!(base?.ou_enfermeiro || grupo?.ou_enfermeiro) });
    }
  });
  const f = n > 5000 ? 'acima de 5.000' : `${FAIXAS_SESMT[col][0].toLocaleString('pt-BR')} a ${FAIXAS_SESMT[col][1].toLocaleString('pt-BR')}`;
  return { obrigatorio: true, faixa: f, profissionais, grupos_acima_5000: extra };
}

/* ── Quadro I da NR-05: CIPA ─────────────────────────────────────────────── */
export const FAIXAS_CIPA = [[20, 29], [30, 50], [51, 80], [81, 100], [101, 120], [121, 140], [141, 300], [301, 500], [501, 1000], [1001, 2500], [2501, 5000], [5001, 10000]];
const CIPA = {
  1: { ef: [0, 0, 0, 1, 1, 1, 1, 2, 4, 5, 6, 8], su: [0, 0, 0, 1, 1, 1, 1, 2, 3, 4, 5, 6], mais: [1, 1] },
  2: { ef: [0, 0, 1, 1, 2, 2, 3, 4, 5, 6, 8, 10], su: [0, 0, 1, 1, 1, 1, 2, 3, 4, 5, 6, 8], mais: [1, 1] },
  3: { ef: [1, 1, 2, 2, 2, 3, 4, 5, 6, 8, 10, 12], su: [1, 1, 1, 1, 1, 2, 2, 4, 4, 6, 8, 8], mais: [2, 2] },
  4: { ef: [1, 2, 3, 3, 4, 4, 4, 5, 6, 9, 11, 13], su: [1, 1, 2, 2, 2, 2, 3, 4, 5, 7, 8, 10], mais: [2, 2] }
};
/* Horas mínimas do treinamento da CIPA e do representante nomeado (NR-05, 5.7.4). */
export const HORAS_TREINO_CIPA = { 1: 8, 2: 12, 3: 16, 4: 20 };
export const LIMITE_CIPA = { 1: 81, 2: 51, 3: 20, 4: 20 };

export function dimensionarCipa(gr, n) {
  const t = CIPA[gr];
  if (!t || !(n >= 0)) return null;
  if (n < LIMITE_CIPA[gr]) return null;
  if (n > 10000) { const g = Math.floor((n - 10000) / 2500); return { faixa: 'acima de 10.000', efetivos: t.ef[11] + g * t.mais[0], suplentes: t.su[11] + g * t.mais[1], aproximado: true }; }
  const i = FAIXAS_CIPA.findIndex(([a, b]) => n >= a && n <= b);
  if (i < 0 || !t.ef[i]) return null;
  return { faixa: `${FAIXAS_CIPA[i][0].toLocaleString('pt-BR')} a ${FAIXAS_CIPA[i][1].toLocaleString('pt-BR')}`, efetivos: t.ef[i], suplentes: t.su[i] };
}

/* ── Enquadramento ───────────────────────────────────────────────────────────
   entrada:
     cnae            CNAE principal do CNPJ (atividade econômica principal, NR-04 4.5.1.1)
     cnaesSecundarios [{codigo, descricao}] — só para avisar quando algum tem grau maior
     preponderante   CNAE da atividade que ocupa mais trabalhadores (4.5.1.2), se o técnico informou
     empregados      nº de empregados do estabelecimento (SOC, conferido na visita)
     terceiros       nº de trabalhadores de contratadas, de forma NÃO eventual, nas dependências (4.5.2)
     mei             true se a empresa é MEI (dispensada de nomear representante, 5.4.13.2)
   saída: { grau, sesmt, cipa, avisos[] } — `estado` de cada parte:
     sesmt.estado: 'obrigatorio' | 'nao' | 'indefinido'
     cipa.estado : 'cipa' | 'nomeado' | 'sesmt_faz' | 'mei' | 'indefinido'                              */
export function enquadrar({ cnae, cnaesSecundarios = [], preponderante = null, empregados = null, terceiros = 0, mei = false } = {}) {
  const avisos = [];
  const grPrincipal = grauDoCnae(cnae);
  const grPrep = preponderante ? grauDoCnae(preponderante) : null;
  let grau = null, origem = null;
  if (grPrincipal) { grau = grPrincipal; origem = 'principal'; }
  if (grPrep && (!grau || grPrep > grau)) { grau = grPrep; origem = 'preponderante'; }
  /* secundárias de grau maior que a PRINCIPAL (não que o final): a escolhida continua na lista da tela */
  const secMaiores = (cnaesSecundarios || []).map(c => ({ codigo: normCnae(c.codigo), descricao: c.descricao || '', gr: grauDoCnae(c.codigo) })).filter(c => c.gr && grPrincipal && c.gr > grPrincipal);
  if (!cnae) avisos.push('A empresa não tem CNAE cadastrado: sem ele não dá para saber o grau de risco.');
  else if (!grPrincipal) avisos.push(`O CNAE ${cnaeBr(cnae)} não foi encontrado no Anexo I da NR-04: confira o cadastro.`);
  if (grau && !preponderante && secMaiores.length) avisos.push(`A empresa tem atividade secundária de grau maior (${secMaiores.slice(0, 3).map(c => `${cnaeBr(c.codigo)} · GR ${c.gr}`).join('; ')}). Se ela ocupar o maior número de trabalhadores, é ela que vale (NR-04, 4.5.1.2): informe a atividade preponderante.`);

  const nEmp = Number.isFinite(Number(empregados)) && empregados !== null && empregados !== '' ? Math.max(0, Math.trunc(Number(empregados))) : null;
  const nTer = Math.max(0, Math.trunc(Number(terceiros) || 0));
  const base = nEmp === null ? null : nEmp + nTer;
  if (nEmp === null) avisos.push('Sem o número de funcionários (SOC): traga a hierarquia do SOC ou informe o efetivo.');

  const sesmt = { estado: 'indefinido', base, dimensionamento: null };
  const cipa = { estado: 'indefinido', dimensionamento: null, horas_treinamento: grau ? HORAS_TREINO_CIPA[grau] : null };
  if (grau && base !== null) {
    const ds = dimensionarSesmt(grau, base);
    sesmt.dimensionamento = ds;
    sesmt.estado = ds.obrigatorio ? 'obrigatorio' : 'nao';
    /* CIPA: conta só empregados do estabelecimento (5.4.1); terceiros têm regra própria (5.8). */
    const dc = dimensionarCipa(grau, nEmp);
    cipa.dimensionamento = dc;
    if (dc) cipa.estado = 'cipa';
    else if (mei) cipa.estado = 'mei';
    else if (sesmt.estado === 'obrigatorio') cipa.estado = 'sesmt_faz';
    else cipa.estado = nEmp > 0 ? 'nomeado' : 'indefinido';
    if (nTer > 0 && sesmt.estado === 'nao') avisos.push(`Com os ${nTer} terceiros não eventuais o total é ${base}; mesmo assim fica abaixo do mínimo do SESMT (${LIMITE_SESMT[grau]}).`);
    if (grau && ds.falta && ds.falta <= 10) avisos.push(`Faltam ${ds.falta} trabalhadores para o SESMT passar a ser obrigatório: acompanhe o efetivo.`);
    if (!dc && !mei && cipa.estado === 'nomeado' && LIMITE_CIPA[grau] - nEmp <= 5) avisos.push(`Faltam ${LIMITE_CIPA[grau] - nEmp} empregados para a CIPA passar a ser obrigatória.`);
  }
  avisos.push('Enquadramento por estabelecimento (CNPJ). Se a empresa tem mais de um estabelecimento no SOC, confira o efetivo de cada um; NR-04 4.4 admite SESMT regionalizado, estadual ou compartilhado.');
  return { grau: { valor: grau, nome: grau ? NOME_GR[grau] : null, origem, principal: grPrincipal, preponderante: grPrep, secundarias_maiores: secMaiores }, empregados: nEmp, terceiros: nTer, sesmt, cipa, avisos };
}

/* Texto curto para a ficha e para o plano. */
export function resumoEnquadramento(e) {
  if (!e?.grau?.valor) return 'Sem CNAE válido: não foi possível enquadrar.';
  const g = `Grau de risco ${e.grau.valor} (${e.grau.nome}${e.grau.origem === 'preponderante' ? ', atividade preponderante' : ''})`;
  if (e.empregados === null) return `${g} · sem número de funcionários.`;
  const s = e.sesmt.estado === 'obrigatorio'
    ? 'SESMT obrigatório: ' + e.sesmt.dimensionamento.profissionais.map(p => `${p.qtd} ${p.profissional}${p.parcial ? ' (tempo parcial)' : ''}`).join(', ')
    : 'sem SESMT';
  const c = { cipa: () => { const { efetivos: ef, suplentes: su } = e.cipa.dimensionamento; return `CIPA com ${ef} ${ef === 1 ? 'efetivo' : 'efetivos'} e ${su} ${su === 1 ? 'suplente' : 'suplentes'}`; }, nomeado: () => 'representante nomeado (NR-05, 5.4.13)', sesmt_faz: () => 'o SESMT desempenha as atribuições da CIPA (5.4.13.1)', mei: () => 'MEI dispensado de nomear (5.4.13.2)', indefinido: () => 'CIPA a definir' }[e.cipa.estado]();
  return `${g} · ${e.empregados} empregados${e.terceiros ? ` + ${e.terceiros} terceiros` : ''} · ${s} · ${c}.`;
}
