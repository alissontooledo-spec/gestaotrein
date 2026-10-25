/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/dossie/dossie.js — Dossiê para fiscalização (v282)
   Junta num PDF o que o GRID registrou de uma empresa cliente (ou de um
   colaborador). Dois modos (parecer do engenheiro de segurança, 24/10/2026):
   ▸ "Para entregar ao fiscal": só evidências (treinamentos registrados com
     datas e evidência, riscos por GHE da última visita, certificados).
   ▸ "Conferência interna": a mesma base mais a situação de cada treinamento,
     o que foi indicado na visita e não tem registro, o plano de ação e o que
     falta. Não é para entregar: aponta irregularidades.
   Tudo é lido com o login da pessoa (mesmas regras do banco) e montado no
   aparelho. Nada é gravado. CPF sai mascarado no dossiê. Os certificados
   juntados no fim trazem o CPF completo (o painel avisa).
   ══════════════════════════════════════════════════════════════════════════ */

const DIAS_ALERTA = 30;
const MAX_CERT = 60;     // certificados juntados no fim (arquivos grandes travam o celular)
const LOTE = 150;        // ids por consulta .in()

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const dataBr = (iso) => { if (!iso) return ''; const [a, m, d] = String(iso).slice(0, 10).split('-'); return d && m && a ? `${d}/${m}/${a}` : ''; };
const nrDe = (t) => { const m = String(t || '').match(/\bNR[\s-]?0?(\d{1,2})\b/i); return m ? `NR-${m[1].padStart(2, '0')}` : null; };
export const mascararCpf = (cpf) => { const d = String(cpf || '').replace(/\D/g, ''); return d.length === 11 ? `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**` : ''; };

/* Situação pela data de vencimento registrada. */
export function situacao(venc, hoje = new Date()) {
  if (!venc) return 'semvalidade';
  const h = new Date(hoje); h.setHours(0, 0, 0, 0);
  const d = Math.round((new Date(String(venc).slice(0, 10) + 'T00:00:00') - h) / 864e5);
  return d < 0 ? 'vencido' : d <= DIAS_ALERTA ? 'vence' : 'emdia';
}
export const ROTULO = {
  vencido: 'Vencido', vence: `Vence em até ${DIAS_ALERTA} dias`, emdia: 'Dentro da validade', semregistro: 'Sem registro',
  conferir: 'Conferir', naomapeado: 'Exigência não mapeada', semvalidade: 'Sem validade cadastrada', naoaplica: 'Não se aplica',
};
const ORDEM = { vencido: 0, semregistro: 1, conferir: 2, vence: 3, semvalidade: 4, emdia: 5, naoaplica: 6, naomapeado: 7 };
/* Marcações de Conformidade. Só "não se aplica" muda a situação. As outras (renovação agendada,
   empresa não contratou...) são decisões de gestão: a situação continua pela data e a marcação vai como nota. */
const MARCACAO = {
  renovacao_agendada: 'renovação agendada', renovacao_dispensada: 'renovação dispensada', nao_se_aplica: 'não se aplica',
  desligado: 'funcionário desligado', empresa_nao_contratou: 'empresa não contratou', aguardando_decisao: 'aguardando decisão do cliente',
};

/* ── Leitura dos dados (com o login da pessoa) ─────────────────────────── */
const semTabela = (e) => /42P01|does not exist|schema cache/i.test(`${e?.code || ''} ${e?.message || ''}`);
async function lerTudo(q) {
  const out = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await q().range(de, de + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}
async function porLotes(ids, q) {
  const out = [];
  for (let i = 0; i < ids.length; i += LOTE) out.push(...await lerTudo(() => q(ids.slice(i, i + LOTE))));
  return out;
}
/* Tabela do módulo Campo: se a organização não tem o módulo, segue sem. Outro erro para tudo (não vira "ausência"). */
async function campo(p) {
  const { data, error } = await p;
  if (error) { if (semTabela(error)) return null; throw new Error('Não foi possível ler a avaliação de campo. Confira a internet e tente de novo.'); }
  return data || [];
}

export async function carregar(sb, orgId, clienteId) {
  const { data: cli, error: e1 } = await sb.from('clientes').select('id,nome,cnpj,cnae,cnae_descricao').eq('id', clienteId).eq('org_id', orgId).maybeSingle();
  if (e1) throw e1;
  if (!cli) throw new Error('Empresa não encontrada.');
  const colabs = await lerTudo(() => sb.from('colaboradores').select('id,nome,cpf,cargo,cliente_id').eq('org_id', orgId).eq('cliente_id', clienteId).order('nome').order('id'));
  const ids = colabs.map((c) => c.id);
  // Pelo colaborador (não pelo cliente da turma: a turma pode ser de outra empresa ou sem empresa).
  const [conf, docs] = await Promise.all([
    porLotes(ids, (l) => sb.from('conformidade_status').select('id,colaborador_id,catalogo_id,turma_id,data_conclusao,data_vencimento,status_excecao,motivo_excecao,origem,instituicao_externa,catalogo(id,nome,nrs)')
      .eq('org_id', orgId).in('colaborador_id', l).order('id')),
    porLotes(ids, (l) => sb.from('documentos').select('id,turma_id,colaborador_id,arquivo_path,codigo_validacao,gerado_em')
      .eq('org_id', orgId).eq('tipo', 'certificado_individual').is('revogado_em', null).in('colaborador_id', l).order('id')),
  ]);
  // v284: OS e fichas de EPI com entrega registrada (PASSO-92). Sem a tabela, segue sem.
  let entregas = [];
  try { entregas = await porLotes(ids, (l) => sb.from('doc_entregas').select('id,colaborador_id,tipo,entregue_em').in('colaborador_id', l).order('id')); }
  catch (e) { if (!semTabela(e)) throw new Error('Não foi possível ler as entregas de OS e de ficha de EPI. Confira a internet e tente de novo.'); }
  // Última visita concluída (Avaliação de Campo): riscos por GHE, treinamentos indicados e plano de ação.
  let visita = null, ghes = [], acoes = [], catTrein = new Map(), semCampo = false;
  const av = await campo(sb.from('campo_avaliacoes').select('id,numero,data_visita,situacao,grupo_id')
    .eq('cliente_id', clienteId).eq('situacao', 'concluida').order('data_visita', { ascending: false }).limit(1));
  if (av === null) semCampo = true;
  visita = av?.[0] || null;
  if (visita) {
    const [g, a, c] = await Promise.all([
      campo(sb.from('campo_ghes').select('id,ordem,nome,setores,funcoes,riscos,treinamentos').eq('avaliacao_id', visita.id).order('ordem')),
      campo(sb.from('campo_acoes').select('id,numero,o_que,quem,prazo,situacao,ghe_nome,toda_empresa,grupo_id,removida_em,data_conclusao').eq('cliente_id', clienteId).order('prazo', { ascending: true, nullsFirst: false })),
      campo(sb.from('campo_catalogo').select('codigo,nome,categoria,org_id,ativo').eq('tipo', 'treinamento')),
    ]);
    ghes = g || [];
    acoes = (a || []).filter((x) => !x.removida_em && x.situacao !== 'cancelada' && (!x.grupo_id || x.grupo_id === visita.grupo_id));
    // o item da própria organização vale mais que o global com o mesmo código
    (c || []).filter((t) => t.ativo !== false).sort((x, y) => (x.org_id ? 1 : 0) - (y.org_id ? 1 : 0)).forEach((t) => catTrein.set(String(t.codigo), t));
  }
  return { cli, colabs, conf, docs, visita, ghes, acoes, catTrein, semCampo, entregas };
}

/* ── Montagem: situação por trabalhador ────────────────────────────────── */
export function montar(D, { colaboradorId = null, cargo = '', hoje = new Date() } = {}) {
  const nrDoCurso = (cat) => (Array.isArray(cat?.nrs) && cat.nrs[0] ? nrDe(cat.nrs[0]) : null) || nrDe(cat?.nome);
  const trein = (cod) => { const t = D.catTrein.get(String(cod)); return { nr: nrDe(t?.categoria) || nrDe(t?.nome) || nrDe(cod), nome: t?.nome || String(cod) }; };
  // função → todos os GHE em que ela aparece
  const ghesPorFuncao = new Map();
  D.ghes.forEach((g) => (g.funcoes || []).forEach((f) => { const k = norm(f); if (!ghesPorFuncao.has(k)) ghesPorFuncao.set(k, []); ghesPorFuncao.get(k).push(g); }));
  const certPor = new Map(); D.docs.forEach((d) => { if (!certPor.has(d.colaborador_id)) certPor.set(d.colaborador_id, []); certPor.get(d.colaborador_id).push(d); });
  const confPor = new Map(); D.conf.forEach((r) => { if (!confPor.has(r.colaborador_id)) confPor.set(r.colaborador_id, []); confPor.get(r.colaborador_id).push(r); });

  let lista = D.colabs;
  if (colaboradorId) lista = D.colabs.filter((c) => c.id === colaboradorId);
  else if (cargo) lista = lista.filter((c) => norm(c.cargo) === norm(cargo));
  // quem está marcado como desligado em todos os treinamentos não entra
  if (!colaboradorId) lista = lista.filter((c) => { const r = confPor.get(c.id) || []; return !r.length || r.some((x) => x.status_excecao !== 'desligado'); });

  const pessoas = lista.map((c) => {
    const funcao = c.cargo || '';
    const gs = ghesPorFuncao.get(norm(funcao)) || [];
    const certs = certPor.get(c.id) || [];
    const anexos = [];
    const linhas = (confPor.get(c.id) || []).filter((r) => r.status_excecao !== 'desligado').map((r) => {
      const sit = r.status_excecao === 'nao_se_aplica' ? 'naoaplica' : situacao(r.data_vencimento, hoje);
      const cert = r.turma_id ? certs.find((d) => d.turma_id === r.turma_id) : null;
      if (cert && sit !== 'naoaplica') anexos.push({ ...cert, curso: r.catalogo?.nome || '', conclusao: r.data_conclusao });
      const evid = r.origem === 'externo' ? `Externo${r.instituicao_externa ? ': ' + r.instituicao_externa : ''}`
        : cert ? `Certificado GRID ${String(cert.codigo_validacao || '').slice(0, 8).toUpperCase()}`.trim()
          : r.turma_id ? 'Turma registrada no GRID' : 'Registro sem turma vinculada';
      if (sit === 'naoaplica') return { curso: r.catalogo?.nome || 'Treinamento', nr: nrDoCurso(r.catalogo), conclusao: null, vencimento: null, sit, evid: `Marcado como não se aplica${r.motivo_excecao ? ` (${r.motivo_excecao})` : ''}`, nota: '', registro: false };
      const nota = r.status_excecao && r.status_excecao !== 'nao_se_aplica' ? `Marcação: ${MARCACAO[r.status_excecao] || r.status_excecao}${r.motivo_excecao ? ` (${r.motivo_excecao})` : ''}` : '';
      return { curso: r.catalogo?.nome || 'Treinamento', nr: nrDoCurso(r.catalogo), conclusao: r.data_conclusao, vencimento: r.data_vencimento, sit, evid, nota, registro: true };
    });
    // Treinamentos indicados na visita para os GHE da função, sem registro do mesmo NR.
    if (gs.length) {
      const feitos = new Set(linhas.map((l) => l.nr).filter(Boolean));   // "não se aplica" também cobre a exigência (decisão registrada)
      const vistos = new Set();
      gs.forEach((g) => (g.treinamentos || []).forEach((cod) => {
        const t = trein(cod), k = t.nr || `x:${norm(t.nome)}`;
        if (vistos.has(k)) return; vistos.add(k);
        if (!t.nr) linhas.push({ curso: t.nome, nr: null, sit: 'conferir', evid: `Indicado na visita ${D.visita?.numero || ''}`.trim(), nota: 'Sem NR no catálogo da visita. Conferir pelo nome.' });
        else if (!feitos.has(t.nr)) linhas.push({ curso: `${t.nr}, ${t.nome}`, nr: t.nr, sit: 'semregistro', evid: `Indicado na visita ${D.visita?.numero || ''}`.trim(), nota: '' });
      }));
    } else linhas.push({ curso: 'Treinamentos exigidos para a função', nr: null, sit: 'naomapeado', evid: D.visita ? 'Função fora dos GHE da visita' : 'Sem visita técnica concluída', nota: '' });
    linhas.sort((a, b) => ORDEM[a.sit] - ORDEM[b.sit] || String(a.curso).localeCompare(String(b.curso), 'pt-BR'));
    // v284: a última entrega de cada tipo
    const ult = {}; (D.entregas || []).filter((e) => e.colaborador_id === c.id).forEach((e) => { if (!ult[e.tipo] || e.entregue_em > ult[e.tipo]) ult[e.tipo] = e.entregue_em; });
    return { id: c.id, nome: c.nome, cpf: mascararCpf(c.cpf), funcao, ghe: gs.map((g) => g.nome).join(', '), linhas, anexos, entregas: ult };
  });

  const cont = { emdia: 0, vence: 0, vencido: 0, semregistro: 0, conferir: 0, naomapeado: 0, naoaplica: 0, semvalidade: 0 };
  let registros = 0;
  pessoas.forEach((p) => p.linhas.forEach((l) => { cont[l.sit]++; if (l.registro) registros++; }));
  const semGhe = pessoas.filter((p) => !p.ghe).length;
  const porNr = new Map();
  pessoas.forEach((p) => p.linhas.filter((l) => l.sit === 'vencido' || l.sit === 'semregistro').forEach((l) => { const k = l.nr || l.curso; porNr.set(k, (porNr.get(k) || 0) + 1); }));
  const atencao = [...porNr.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${k}: ${n} ${n === 1 ? 'treinamento vencido ou sem registro' : 'treinamentos vencidos ou sem registro'}`);
  // O que falta: fatos, sem instrução de sistema (vai para conferência interna)
  const lacunas = [];
  if (D.semCampo) lacunas.push('A organização não usa a Avaliação de Campo no GRID. Riscos por GHE e treinamentos exigidos por função não aparecem neste dossiê.');
  else if (!D.visita) lacunas.push('Não há visita técnica concluída no GRID para esta empresa. Riscos por GHE e treinamentos exigidos por função não aparecem neste dossiê.');
  else if (semGhe) lacunas.push(`${semGhe} ${semGhe === 1 ? 'trabalhador tem função' : 'trabalhadores têm função'} fora dos GHE da visita ${D.visita.numero || ''}. A exigência de treinamento deles não foi mapeada.`);
  if (cont.vencido) lacunas.push(`${cont.vencido} ${cont.vencido === 1 ? 'treinamento vencido' : 'treinamentos vencidos'} sem reciclagem registrada.`);
  if (cont.semregistro) lacunas.push(`${cont.semregistro} ${cont.semregistro === 1 ? 'treinamento indicado' : 'treinamentos indicados'} na visita ${D.visita?.numero || ''} sem registro no GRID.`);
  if (cont.conferir) lacunas.push(`${cont.conferir} ${cont.conferir === 1 ? 'treinamento indicado' : 'treinamentos indicados'} na visita sem NR no catálogo. Conferir pelo nome.`);
  if (cont.semvalidade) lacunas.push(`${cont.semvalidade} ${cont.semvalidade === 1 ? 'registro sem validade cadastrada' : 'registros sem validade cadastrada'}.`);
  const comEntrega = pessoas.filter((p) => Object.keys(p.entregas || {}).length).length;
  if (comEntrega) lacunas.push(`OS e fichas de EPI aparecem só quando a entrega foi registrada no GRID (${comEntrega} de ${pessoas.length} ${pessoas.length === 1 ? 'trabalhador' : 'trabalhadores'}). Não fazem parte deste dossiê: ASO, PCMSO e PGR.`);
  else lacunas.push('Não fazem parte deste dossiê: ficha de EPI, ASO, PCMSO, PGR e ciência da ordem de serviço.');
  return { pessoas, cont, registros, semGhe, atencao, lacunas, anexos: pessoas.flatMap((p) => p.anexos.map((a) => ({ ...a, nome: p.nome }))) };
}

/* ── PDF ────────────────────────────────────────────────────────────────── */
const COR = { navy: [23, 37, 65], txt: [31, 42, 61], mute: [100, 116, 139], linha: [226, 232, 240], ambar: [245, 158, 11], verde: [22, 163, 74], verm: [220, 38, 38] };
const VERMELHO = new Set(['vencido', 'semregistro']);
function marcador(doc, sit, x, y) {   // forma própria para cada situação (não depende só de cor)
  doc.setLineWidth(0.35);
  if (sit === 'emdia') { doc.setFillColor(...COR.verde); doc.circle(x, y, 1.1, 'F'); }
  else if (sit === 'vence') { doc.setDrawColor(...COR.ambar); doc.setFillColor(...COR.ambar); doc.circle(x, y, 1.1, 'S'); doc.rect(x - 1.1, y - 1.1, 1.1, 2.2, 'F'); }
  else if (sit === 'vencido') { doc.setDrawColor(...COR.verm); doc.setLineWidth(0.5); doc.line(x - 1, y - 1, x + 1, y + 1); doc.line(x - 1, y + 1, x + 1, y - 1); }
  else if (sit === 'semregistro') { doc.setDrawColor(...COR.verm); doc.circle(x, y, 1.1, 'S'); }
  else if (sit === 'naoaplica' || sit === 'semvalidade') { doc.setDrawColor(...COR.mute); doc.rect(x - 1, y - 1, 2, 2, 'S'); }
  else { doc.setDrawColor(...COR.mute); doc.lines([[1.15, 1.15], [-1.15, 1.15], [-1.15, -1.15], [1.15, -1.15]], x, y - 1.15, [1, 1], 'S', true); }
}

export async function gerarPdf(D, R, { jsPDF, safe, usuario, escopo, interno, anexados = null }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  const M = 18, W = 210, L = W - 2 * M, FIM = 297 - 26;
  const agora = new Date(), quando = `${agora.toLocaleDateString('pt-BR')} ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  const s = (t) => safe(String(t ?? ''));
  const fonte = (tam, neg = false, c = COR.txt) => { doc.setFont('helvetica', neg ? 'bold' : 'normal'); doc.setFontSize(tam); doc.setTextColor(...c); };
  let y = 22, aoVirar = null;
  const novaPagina = () => { doc.addPage(); y = 24; aoVirar?.(); };
  const cabe = (h) => { if (y + h > FIM) novaPagina(); };
  const texto = (t, { tam = 10, neg = false, c = COR.txt, alt = 4.8, x = M, larg = L } = {}) => {
    fonte(tam, neg, c);
    doc.splitTextToSize(s(t), larg).forEach((ln) => { cabe(alt); doc.text(ln, x, y); y += alt; });
  };
  let nSec = 0;
  const secao = (t) => { aoVirar = null; cabe(18); y += 5; fonte(13, true, COR.navy); doc.text(s(`${++nSec}. ${t}`), M, y); y += 7; };
  /* tabela simples: colunas [{t, w}], linhas de textos; quebra de página repete o nome e o cabeçalho */
  const tabela = (cols, linhas, { tam = 8.5, titulo = null, aoLinha = null } = {}) => {
    const xs = []; cols.reduce((x, c) => { xs.push(x); return x + c.w; }, M);
    const cab = () => { fonte(7.8, true, COR.mute); cols.forEach((c, i) => doc.text(s(c.t), xs[i], y)); y += 2; doc.setDrawColor(...COR.linha); doc.setLineWidth(0.3); doc.line(M, y, M + L, y); y += 4; };
    aoVirar = () => { if (titulo) { fonte(9, true, COR.navy); doc.text(s(`${titulo} (continuação)`), M, y); y += 5; } cab(); };
    cab();
    linhas.forEach((ln, idx) => {
      fonte(tam); const partes = ln.map((v, i) => doc.splitTextToSize(s(v ?? ''), cols[i].w - 3));
      const h = Math.max(...partes.map((p) => p.length)) * 3.7 + 2.2;
      cabe(h);
      partes.forEach((p, i) => { const st = aoLinha?.(idx, i, doc, xs[i], y) || {}; fonte(tam, !!st.neg, st.c || COR.txt); doc.text(p, xs[i] + (st.dx || 0), y); });
      y += h; doc.setDrawColor(...COR.linha); doc.setLineWidth(0.15); doc.line(M, y - 3.2, M + L, y - 3.2);
    });
    aoVirar = null;
  };

  // Página 1: identificação
  fonte(9, false, COR.mute); doc.text(s(interno ? 'Dossiê para fiscalização, conferência interna' : 'Dossiê para fiscalização'), M, y); y += 9;
  fonte(20, true, COR.navy); doc.splitTextToSize(s(D.cli.nome), L).forEach((ln) => { doc.text(ln, M, y); y += 8; });
  y += 1;
  [D.cli.cnpj ? `CNPJ ${D.cli.cnpj}` : '', D.cli.cnae ? `CNAE ${D.cli.cnae}${D.cli.cnae_descricao ? ', ' + D.cli.cnae_descricao : ''}` : '',
    `Abrangência: ${escopo}`, `Emitido em ${quando} por ${usuario?.nome || 'usuário do GRID'}`].filter(Boolean).forEach((l) => texto(l, { tam: 10, c: COR.mute, alt: 5 }));
  if (interno) { y += 2; texto('Documento de conferência interna. Aponta pendências. Para entregar ao fiscal, gere o modo "Para entregar ao fiscal".', { tam: 9, neg: true, c: COR.verm, alt: 4.6 }); }

  // Resumo
  secao('Resumo');
  texto(`${R.pessoas.length} ${R.pessoas.length === 1 ? 'trabalhador' : 'trabalhadores'}, ${R.registros} ${R.registros === 1 ? 'treinamento registrado' : 'treinamentos registrados'}. ${D.visita ? `Última visita técnica concluída: ${D.visita.numero || ''} em ${dataBr(D.visita.data_visita)}.` : 'Sem visita técnica concluída no GRID.'}`, { tam: 10, alt: 5 });
  if (interno) {
    y += 4;
    const itens = [['emdia', 'Dentro da validade'], ['vence', `Vence em ${DIAS_ALERTA} dias`], ['vencido', 'Vencido'], ['semregistro', 'Sem registro'], ['naomapeado', 'Não mapeado']];
    const col = L / itens.length;
    cabe(30); texto('Treinamentos por situação', { tam: 8.5, c: COR.mute, alt: 6 });
    itens.forEach(([k, t], i) => {
      const x = M + i * col;
      fonte(18, true, VERMELHO.has(k) ? COR.verm : COR.navy); doc.text(String(R.cont[k]), x, y + 4);
      marcador(doc, k, x + 1.2, y + 9.2); fonte(7.5, false, COR.mute); doc.text(doc.splitTextToSize(s(t), col - 6), x + 4, y + 10);
    });
    y += 17;
    const total = itens.reduce((a, [k]) => a + R.cont[k], 0) || 1;
    let bx = M; const barCor = { emdia: COR.verde, vence: COR.ambar, vencido: COR.verm, semregistro: [252, 165, 165], naomapeado: [203, 213, 225] };
    itens.forEach(([k]) => { const w = L * R.cont[k] / total; if (w > 0) { doc.setFillColor(...barCor[k]); doc.rect(bx, y, w, 2, 'F'); bx += w; } });
    y += 8;
    if (R.atencao.length) { texto('Pontos de atenção', { tam: 10.5, neg: true, c: COR.navy, alt: 6 }); R.atencao.forEach((a, i) => texto(`${i + 1}. ${a}`, { tam: 10 })); }
  }

  // Capacitação
  secao('Capacitação por trabalhador');
  texto(interno ? `Situação pela data de vencimento registrada. "Vence em ${DIAS_ALERTA} dias" conta a partir da emissão. "Sem registro" é treinamento indicado na visita técnica para o GHE da função sem registro do mesmo NR no GRID (a correspondência é feita pelo número da NR).`
    : 'Treinamentos registrados no GRID, com datas de conclusão e de vencimento e a evidência de cada um.', { tam: 8.5, c: COR.mute, alt: 4 });
  y += 2;
  R.pessoas.forEach((p) => {
    const linhas = interno ? p.linhas : p.linhas.filter((l) => l.registro);
    cabe(30); y += 3;
    fonte(11, true, COR.navy); doc.text(s(p.nome), M, y); y += 5;
    texto([p.cpf, p.funcao, p.ghe ? `GHE ${p.ghe}` : ''].filter(Boolean).join('   '), { tam: 8.5, c: COR.mute, alt: 5.5 });
    const ent = [['ordem_servico', 'Ordem de Serviço entregue em'], ['ficha_epi', 'Ficha de EPI entregue em']].filter(([k]) => p.entregas?.[k]).map(([k, r]) => `${r} ${dataBr(p.entregas[k])}`);
    if (ent.length) texto(`${ent.join('. ')}.`, { tam: 8.5, c: COR.txt, alt: 5 });   // v284
    if (!linhas.length) { texto('Nenhum treinamento registrado no GRID.', { tam: 9, c: COR.mute }); return; }
    const cols = interno ? [{ t: 'Treinamento', w: 62 }, { t: 'Conclusão', w: 20 }, { t: 'Vencimento', w: 20 }, { t: 'Situação', w: 34 }, { t: 'Evidência', w: 38 }]
      : [{ t: 'Treinamento', w: 76 }, { t: 'Conclusão', w: 22 }, { t: 'Vencimento', w: 22 }, { t: 'Evidência', w: 54 }];
    tabela(cols, linhas.map((l) => {
      const ev = l.nota && interno ? `${l.evid}. ${l.nota}` : l.evid;   // marcação de gestão só na conferência interna
      return interno ? [l.curso, dataBr(l.conclusao), dataBr(l.vencimento), ROTULO[l.sit], ev] : [l.curso, dataBr(l.conclusao), dataBr(l.vencimento), ev];
    }), {
      titulo: p.nome,
      aoLinha: interno ? (idx, i, d, x, yy) => {
        if (i !== 3) return null;
        const sit = linhas[idx].sit; marcador(d, sit, x + 1.1, yy - 1);
        return { dx: 3.6, neg: VERMELHO.has(sit), c: VERMELHO.has(sit) ? COR.verm : COR.txt };
      } : null,
    });
  });

  // Riscos por GHE (e plano de ação no modo interno)
  secao(interno ? 'Riscos por GHE e plano de ação' : 'Riscos por GHE');
  if (!D.visita) texto(D.semCampo ? 'A organização não usa a Avaliação de Campo no GRID.' : 'Não há visita técnica concluída no GRID para esta empresa.', { tam: 10, c: COR.mute });
  else {
    texto(`Visita técnica ${D.visita.numero || ''} de ${dataBr(D.visita.data_visita)}. Dados de apoio, não substituem o inventário de riscos do PGR da empresa.`, { tam: 8.5, c: COR.mute, alt: 4 });
    D.ghes.forEach((g) => {
      cabe(22); y += 3; texto(`GHE ${g.nome}`, { tam: 10.5, neg: true, c: COR.navy, alt: 5 });
      if ((g.funcoes || []).length) texto(`Funções: ${g.funcoes.join(', ')}`, { tam: 8.5, c: COR.mute, alt: 5 });
      const rs = g.riscos || [];
      if (rs.length) tabela([{ t: 'Risco', w: 120 }, { t: 'Tipo', w: 54 }], rs.map((r) => [r.nome || r.codigo || 'Risco', r.categoria || '']), { titulo: `GHE ${g.nome}` });
    });
    if (interno) {
      cabe(22); y += 4; texto('Plano de ação', { tam: 10.5, neg: true, c: COR.navy, alt: 5 });
      const SIT = { pendente: 'Pendente', em_andamento: 'Em andamento', concluida: 'Concluída' };
      const hj = new Date(); hj.setHours(0, 0, 0, 0);
      const atrasada = (a) => a.situacao !== 'concluida' && a.prazo && new Date(String(a.prazo).slice(0, 10) + 'T00:00:00') < hj;
      if (D.acoes.length) tabela([{ t: 'Ação', w: 78 }, { t: 'Responsável', w: 36 }, { t: 'Prazo', w: 22 }, { t: 'Situação', w: 38 }],
        D.acoes.map((a) => [String(a.o_que || '').replace(/\s·\s*A-\d+$/, ''), a.quem || '', dataBr(a.prazo), atrasada(a) ? 'Atrasada' : (SIT[a.situacao] || a.situacao || '')]),
        { titulo: 'Plano de ação', aoLinha: (idx, i, d, x, yy) => (i === 3 && atrasada(D.acoes[idx]) ? (marcador(d, 'vencido', x + 1.1, yy - 1), { dx: 3.6, neg: true, c: COR.verm }) : null) });
      else texto('Sem plano de ação lançado para esta empresa.', { tam: 9, c: COR.mute });
    }
  }

  if (interno) { secao('O que falta'); R.lacunas.forEach((l, i) => texto(`${i + 1}. ${l}`, { tam: 10, alt: 5 })); }

  if (anexados) {
    secao('Certificados anexados');
    texto(`${anexados.ok} de ${anexados.total} ${anexados.total === 1 ? 'certificado anexado' : 'certificados anexados'} a seguir${anexados.total > anexados.ok ? '. Os que faltam não puderam ser lidos ou passaram do limite deste dossiê.' : '.'} Cada um pode ser conferido pelo código de validação em toledolabs.com.br/validar.html.`, { tam: 9, c: COR.mute, alt: 4.4 });
    if (anexados.lista.length) tabela([{ t: 'Trabalhador', w: 58 }, { t: 'Treinamento', w: 64 }, { t: 'Conclusão', w: 22 }, { t: 'Código', w: 30 }],
      anexados.lista.map((a) => [a.nome, a.curso, dataBr(a.conclusao), String(a.codigo_validacao || '').slice(0, 8).toUpperCase()]));
  }

  // Fio âmbar, cabeçalho e rodapé de todas as páginas
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFillColor(...COR.ambar); doc.rect(0, 0, W, 1.5, 'F');
    if (i > 1) { fonte(8, false, COR.mute); doc.text(s(D.cli.nome).slice(0, 80), M, 12); doc.text(s(`Emitido em ${quando}`), W - M, 12, { align: 'right' }); }
    doc.setDrawColor(...COR.linha); doc.setLineWidth(0.2); doc.line(M, 297 - 20, W - M, 297 - 20);
    fonte(7, false, COR.mute);
    doc.text(s('Compilação das evidências registradas no GRID. Não substitui PGR, PCMSO, ASO, LTCAT, ficha de EPI assinada nem a análise de profissional habilitado.'), M, 297 - 15.5);
    doc.text(s(`Situação calculada com os dados informados até ${quando}. Ausência no GRID não significa ausência na empresa.`), M, 297 - 11.5);
    doc.text(s(`Página ${i} de ${n}`), W - M, 297 - 7.5, { align: 'right' });
  }
  return doc.output('arraybuffer');
}

/* Baixa os certificados (só o da turma que vale hoje para cada treinamento). */
async function lerCertificados(sb, anexos, aoProgresso) {
  const lidos = [];
  for (const [i, c] of anexos.slice(0, MAX_CERT).entries()) {
    aoProgresso?.(`Lendo certificados (${i + 1} de ${Math.min(anexos.length, MAX_CERT)})`);
    if (!c.arquivo_path) continue;
    try {
      const { data, error } = await sb.storage.from('documentos').download(c.arquivo_path);
      if (!error && data) lidos.push({ ...c, bytes: await data.arrayBuffer() });
    } catch { /* certificado com problema: segue sem ele */ }
  }
  return lidos;
}
/* Confere quais abrem (sem montar o arquivo final). */
async function quaisAbrem(lidos) {
  const { PDFDocument } = window.PDFLib;
  const ok = [];
  for (const c of lidos) { try { await PDFDocument.load(c.bytes, { ignoreEncryption: true }); ok.push(c); } catch { /* corrompido */ } }
  return ok;
}
async function juntar(base, lidos) {
  const { PDFDocument } = window.PDFLib;
  const out = await PDFDocument.load(base);
  for (const c of lidos) {
    try {
      const src = await PDFDocument.load(c.bytes, { ignoreEncryption: true });
      (await out.copyPages(src, src.getPageIndices())).forEach((p) => out.addPage(p));
    } catch { /* já conferido em quaisAbrem */ }
  }
  return out.save();
}

/* ── Painel ─────────────────────────────────────────────────────────────── */
const CSS = `
.dsx-fundo{position:fixed;inset:0;background:rgba(16,24,44,.35);z-index:900}
.dsx{position:fixed;top:0;right:0;bottom:0;width:min(480px,100vw);background:#fff;z-index:901;display:flex;flex-direction:column;box-shadow:-12px 0 32px rgba(16,24,44,.16);font-family:inherit;color:#1F2A3D}
.dsx-h{display:flex;gap:12px;align-items:flex-start;padding:20px 22px 14px;border-bottom:1px solid #E8ECF2}
.dsx-h h3{margin:0;font-size:18px;font-weight:700;color:#172541;letter-spacing:-.2px;outline:0}
.dsx-h p{margin:4px 0 0;font-size:13px;line-height:1.45;color:#64748B}
.dsx-x{margin-left:auto;width:36px;height:36px;border:1px solid #E2E8F0;border-radius:10px;background:#fff;color:#64748B;cursor:pointer;font-size:18px;line-height:1;flex:none}
.dsx-c{flex:1;overflow:auto;padding:18px 22px 24px}
.dsx-g{margin:0 0 16px}
.dsx-g>b{display:block;font-size:13px;font-weight:600;color:#64748B;margin-bottom:4px}
.dsx-op{display:flex;align-items:flex-start;gap:10px;padding:8px 0;font-size:14.5px;cursor:pointer;line-height:1.35}
.dsx-op input{width:18px;height:18px;accent-color:#172541;margin:1px 0 0;flex:none}
.dsx-op small{display:block;font-size:12.5px;color:#64748B;margin-top:2px}
.dsx select{width:calc(100% - 28px);height:44px;margin:4px 0 0 28px;border:1px solid #D5DBE6;border-radius:10px;padding:0 12px;font:inherit;font-size:14.5px;color:#172541;background:#fff}
.dsx-pv{border-top:1px solid #E8ECF2;padding-top:16px}
.dsx-pv>p{margin:0 0 10px;font-size:14px;color:#1F2A3D}
.dsx-n{display:grid;grid-template-columns:14px 32px 1fr 14px 32px 1fr;gap:10px 8px;align-items:center;margin:0;padding:0;list-style:none;font-size:14px}
.dsx-n b{font-size:16px;color:#172541;font-variant-numeric:tabular-nums}
.dsx-n b.r{color:#B91C1C}
.dsx-m{width:10px;height:10px;display:inline-block;position:relative}
.dsx-m.emdia{border-radius:50%;background:#16A34A}
.dsx-m.vence{border-radius:50%;border:2px solid #F59E0B;background:linear-gradient(90deg,#F59E0B 50%,transparent 50%)}
.dsx-m.vencido::before,.dsx-m.vencido::after{content:'';position:absolute;left:4px;top:-1px;width:2px;height:12px;background:#DC2626;transform:rotate(45deg)}
.dsx-m.vencido::after{transform:rotate(-45deg)}
.dsx-m.semregistro{border-radius:50%;border:2px solid #DC2626}
.dsx-m.naomapeado{border:2px solid #94A3B8;transform:rotate(45deg) scale(.85)}
.dsx-av{margin:14px 0 0;font-size:13px;line-height:1.5;color:#B45309}
.dsx-dica{margin:14px 0 0;padding:0;list-style:none;font-size:13px;line-height:1.5;color:#64748B}
.dsx-dica li{margin:0 0 4px}
.dsx-f{display:flex;gap:10px;justify-content:flex-end;padding:14px 22px calc(14px + env(safe-area-inset-bottom,0px));border-top:1px solid #E8ECF2;background:#fff}
.dsx-f .btn{min-height:42px}
.dsx-car{font-size:14px;color:#64748B;padding:30px 0}
@media(max-width:700px){.dsx{width:100vw}.dsx-f .btn{flex:1;min-height:46px}.dsx-n{grid-template-columns:14px 32px 1fr}}
`;
let _estilo = false;
export async function abrir({ sb, usuario, clienteId, colaboradorId = null, garantirJsPDF, garantirPdfLib, pdfSafe, avisar }) {
  if (!_estilo) { const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); _estilo = true; }
  document.querySelectorAll('.dsx,.dsx-fundo').forEach((e) => e.remove());
  const volta = document.activeElement;
  const fundo = document.createElement('div'); fundo.className = 'dsx-fundo';
  const p = document.createElement('aside'); p.className = 'dsx'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-modal', 'true'); p.setAttribute('aria-labelledby', 'dsxTit');
  document.body.append(fundo, p);
  const fechar = () => { fundo.remove(); p.remove(); document.removeEventListener('keydown', tecla); volta?.focus?.(); };
  const tecla = (e) => {
    if (e.key === 'Escape') fechar();
    if (e.key === 'Tab') {   // o foco fica dentro do painel
      const f = [p.querySelector('#dsxTit'), ...p.querySelectorAll('button,input,select')].filter((x) => x && !x.disabled && !x.hidden);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  };
  document.addEventListener('keydown', tecla); fundo.onclick = fechar;
  p.innerHTML = `<div class="dsx-h"><div><h3 id="dsxTit" tabindex="-1">Dossiê para fiscalização</h3><p>Reúne o que o GRID registrou desta empresa. Confira antes de entregar.</p></div><button type="button" class="dsx-x" aria-label="Fechar">×</button></div><div class="dsx-c"><div class="dsx-car" role="status">Montando a prévia…</div></div>`;
  p.querySelector('.dsx-x').onclick = fechar;
  p.querySelector('#dsxTit').focus();
  let D;
  try { D = await carregar(sb, usuario.org_id, clienteId); }
  catch (e) { p.querySelector('.dsx-c').innerHTML = `<div class="dsx-car">Não foi possível ler os dados agora. ${esc(e?.message || '')}</div>`; return; }
  const colab = colaboradorId ? D.colabs.find((c) => c.id === colaboradorId) : null;
  const cargos = [...new Set(D.colabs.map((c) => c.cargo).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const st = { esc: colab ? 'so' : 'emp', cargo: cargos[0] || '', interno: false, juntar: false };
  const conta = () => montar(D, { colaboradorId: st.esc === 'so' ? colab?.id : null, cargo: st.esc === 'cargo' ? st.cargo : '' });
  const corpo = p.querySelector('.dsx-c');
  corpo.innerHTML = `
    <div class="dsx-g"><b>Para quem</b>
      <label class="dsx-op"><input type="radio" name="dsxModo" value="fiscal" checked><span>Para entregar ao fiscal<small>Só as evidências: treinamentos com datas, riscos por GHE e certificados.</small></span></label>
      <label class="dsx-op"><input type="radio" name="dsxModo" value="interno"><span>Conferência interna<small>Inclui a situação de cada treinamento, o plano de ação e o que falta. Não entregue ao fiscal.</small></span></label>
    </div>
    <div class="dsx-g"><b>Abrangência</b>
      <label class="dsx-op"><input type="radio" name="dsxEsc" value="emp" ${st.esc === 'emp' ? 'checked' : ''}> Empresa inteira</label>
      ${cargos.length > 1 ? `<label class="dsx-op"><input type="radio" name="dsxEsc" value="cargo"> Por cargo</label><select id="dsxCargo" hidden aria-label="Cargo">${cargos.map((c) => `<option>${esc(c)}</option>`).join('')}</select>` : ''}
      ${colab ? `<label class="dsx-op"><input type="radio" name="dsxEsc" value="so" checked> Somente ${esc(colab.nome)}</label>` : ''}
    </div>
    <div class="dsx-g"><label class="dsx-op"><input type="checkbox" id="dsxJuntar"><span id="dsxJuntarT"></span></label></div>
    <div class="dsx-pv" id="dsxPv"></div>`;
  const pv = corpo.querySelector('#dsxPv'), sel = corpo.querySelector('#dsxCargo'), cj = corpo.querySelector('#dsxJuntar');
  const previa = () => {
    const R = conta(), n = R.anexos.length;
    if (sel) sel.hidden = st.esc !== 'cargo';
    corpo.querySelector('#dsxJuntarT').innerHTML = `Juntar os certificados emitidos no GRID (${n})<small>${n > MAX_CERT ? `Até ${MAX_CERT} por dossiê. ` : ''}O certificado traz o CPF completo do trabalhador.</small>`;
    cj.disabled = !n; if (!n) { cj.checked = false; st.juntar = false; }
    pv.innerHTML = `<b style="display:block;font-size:13px;font-weight:600;color:#64748B;margin-bottom:8px">Prévia</b>
      <p>${R.pessoas.length} ${R.pessoas.length === 1 ? 'trabalhador' : 'trabalhadores'}, ${R.registros} ${R.registros === 1 ? 'treinamento registrado' : 'treinamentos registrados'}${D.visita ? `. Visita ${esc(D.visita.numero || '')} de ${dataBr(D.visita.data_visita)}` : '. Sem visita técnica concluída'}.</p>
      <p style="font-size:13px;color:#64748B;margin:0 0 8px">Treinamentos por situação</p>
      <ul class="dsx-n">${[['emdia', 'dentro da validade'], ['vence', `vencem em até ${DIAS_ALERTA} dias`], ['vencido', 'vencidos'], ['semregistro', 'sem registro'], ['naomapeado', 'não mapeados']]
        .map(([k, t]) => `<li style="display:contents"><span class="dsx-m ${k}"></span><b class="${k === 'vencido' || k === 'semregistro' ? 'r' : ''}">${R.cont[k]}</b><span>${t}</span></li>`).join('')}</ul>
      ${R.semGhe && D.visita ? `<p class="dsx-av">${R.semGhe} ${R.semGhe === 1 ? 'trabalhador sem GHE' : 'trabalhadores sem GHE'}. Para eles a exigência aparece como não mapeada.</p>` : ''}
      ${R.cont.vencido || R.cont.semregistro || (R.semGhe && D.visita) ? `<ul class="dsx-dica">${R.cont.vencido ? '<li>Vencidos: agende a reciclagem em Turmas.</li>' : ''}${R.cont.semregistro ? '<li>Sem registro: registre o treinamento feito fora do GRID na ficha do colaborador ou agende a turma.</li>' : ''}${R.semGhe && D.visita ? '<li>Sem GHE: inclua a função no GHE da Avaliação de Campo ou corrija o cargo no cadastro.</li>' : ''}</ul>` : ''}`;
    return R;
  };
  corpo.querySelectorAll('input[name="dsxModo"]').forEach((r) => { r.onchange = () => { st.interno = r.value === 'interno'; }; });
  corpo.querySelectorAll('input[name="dsxEsc"]').forEach((r) => { r.onchange = () => { st.esc = r.value; previa(); }; });
  if (sel) sel.onchange = () => { st.cargo = sel.value; previa(); };
  cj.onchange = () => { st.juntar = cj.checked; };
  previa();
  const pe = document.createElement('div'); pe.className = 'dsx-f';
  pe.innerHTML = '<button type="button" class="btn btn-outline">Cancelar</button><button type="button" class="btn btn-primary">Gerar PDF</button>';
  p.appendChild(pe);
  const [bCanc, bGerar] = pe.querySelectorAll('button');
  bCanc.onclick = fechar;
  bGerar.onclick = async () => {
    const R = conta();
    bGerar.disabled = true; bGerar.textContent = 'Montando o dossiê…';
    try {
      await garantirJsPDF();
      const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
      const escopo = st.esc === 'so' ? `somente ${colab.nome}` : st.esc === 'cargo' ? `cargo ${st.cargo}` : 'empresa inteira';
      const opc = { jsPDF, safe: pdfSafe, usuario, escopo, interno: st.interno };
      let bytes, info = '';
      if (st.juntar && R.anexos.length) {
        await garantirPdfLib();
        const lidos = await quaisAbrem(await lerCertificados(sb, R.anexos, (t) => { bGerar.textContent = t; }));
        bGerar.textContent = 'Juntando os certificados…';
        const base = await gerarPdf(D, R, { ...opc, anexados: { ok: lidos.length, total: R.anexos.length, lista: lidos } });
        bytes = await juntar(base, lidos);
        info = ` com ${lidos.length} de ${R.anexos.length} ${R.anexos.length === 1 ? 'certificado' : 'certificados'}`;
      } else bytes = await gerarPdf(D, R, opc);
      const nome = `Dossie-${st.interno ? 'conferencia-' : ''}${norm(st.esc === 'so' ? colab.nome : D.cli.nome).replace(/[^a-z0-9]+/g, '-').slice(0, 40)}-${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`;
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      const a = document.createElement('a'); a.href = url; a.download = nome; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 4000);
      avisar?.(`Dossiê baixado${info}.`);
      bGerar.textContent = 'Gerar de novo';
    } catch (e) {
      avisar?.(`Não foi possível gerar o dossiê. ${e?.message || ''}`, 'error');
      bGerar.textContent = 'Gerar PDF';
    } finally { bGerar.disabled = false; }
  };
}
