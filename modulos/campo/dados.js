/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/campo/dados.js — Avaliação de Campo (v198, 26/09/2026)
   Camada de dados do módulo. O técnico trabalha no celular, muitas vezes SEM
   internet. Por isso:
     • tudo o que ele faz vai primeiro para o aparelho (IndexedDB 'grid_campo');
     • o envio para o banco acontece sozinho quando há sinal, em ordem:
       fotos e assinaturas (arquivo + linha) → GHEs → avaliação;
     • cada linha leva a `edicao` que o aparelho conhece. Se outro aparelho
       gravou antes, o banco responde CAMPO_CONFLITO e a pessoa decide qual
       versão fica — nada é sobrescrito em silêncio.
   Regras de negócio (conclusão, trava, número, situação, resumo) moram no
   banco (PASSO-64). Aqui só existe o espelho delas para mostrar na tela o que
   falta antes de tentar concluir.
   ══════════════════════════════════════════════════════════════════════════ */

import * as sessao from '../../nucleo/sessao.js';
import * as P from './plano.js';
import { cliente as clienteBanco } from '../../nucleo/dados.js';

const sb = () => {
  const c = clienteBanco();
  if (!c) throw new Error('Banco indisponível. Recarregue o sistema.');
  return c;
};
const ponte = () => (typeof window !== 'undefined' && window.__GRID_PONTE) || {};
export const online = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false);
export const novoId = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); }));

/* ── Listas fixas (decisões do Alisson, 26/09) ──────────────────────────── */
export const EXPOSICAO = [['P', 'Permanente'], ['E', 'Eventual'], ['I', 'Intermitente']];
export const PROBABILIDADE = [[1, 'Altamente improvável'], [2, 'Improvável'], [3, 'Pouco provável'], [4, 'Provável'], [5, 'Altamente provável']];
export const SEVERIDADE = [[1, 'Lesão leve'], [2, 'Lesão moderada'], [3, 'Lesão grave'], [4, 'Lesão gravíssima'], [5, 'Lesão crítica ou fatal']];
export const CLASSIFICACAO = [['aceitavel', 'Aceitável'], ['toleravel', 'Tolerável'], ['nao_aceitavel', 'Não aceitável']];
export const EFICAZ = [['S', 'Sim'], ['N', 'Não'], ['NA', 'Não se aplica'], ['SNS', 'Sim, não suficiente']];
export const CATEGORIAS = [
  ['fisico', 'Físicos'], ['acidente', 'Acidentes'], ['operacao_perigosa', 'Operações perigosas'],
  ['ergonomico', 'Ergonômicos'], ['quimico', 'Químicos'], ['biologico', 'Biológicos']
];
export const NOME_CATEGORIA = { fisico: 'Físico', acidente: 'Acidente', operacao_perigosa: 'Operação perigosa',
  ergonomico: 'Ergonômico', quimico: 'Químico', biologico: 'Biológico', outro: 'Outro' };
/* Colunas de conclusão que a ficha admite em cada categoria (igual ao banco). */
export const CONCLUSOES = { fisico: ['ins', 'per', 'ae'], quimico: ['ins', 'per', 'ae'],
  operacao_perigosa: ['per', 'ae'], biologico: ['ins', 'ae'], acidente: [], ergonomico: [], outro: [] };
export const GRUPOS_AMBIENTE = [['paredes', 'Paredes'], ['piso', 'Piso'], ['forro', 'Forro'],
  ['teto_telhado', 'Teto / telhado'], ['iluminacao', 'Iluminação'], ['ventilacao', 'Ventilação']];
export const MOTIVOS_PENDENCIA = [['documento_empresa', 'Aguardando documento da empresa'], ['estudar', 'Preciso estudar'],
  ['medicao', 'Medição a fazer'], ['outro', 'Outro']];
export const SITUACAO = {
  agendada: ['Agendada', 'badge-blue'], em_andamento: ['Em andamento', 'badge-warn'],
  aguardando: ['Aguardando informações', 'badge-warn'], concluida: ['Concluída', 'badge-green'],
  cancelada: ['Cancelada', 'badge-gray']
};
/* v222: matriz de risco padrão — a mesma do SOC (matriz 8, 5x5, lida em 29/09,
   01-Requisitos/avaliacao-campo/2026-09-29-matriz-de-risco-soc.md). O nível sai
   de Probabilidade × Severidade (grade[p-1][s-1]) e define a classificação.
   A organização pode ter a sua (tela Matriz de risco, PASSO-73). */
export const MATRIZ_PADRAO = {"nome": "Matriz 5x5 (padrão SOC)", "niveis": [{"codigo": "irrelevante", "nome": "Risco Irrelevante", "aceitabilidade": "aceitavel", "cor": "#7CB342", "acao": "Nenhum controle adicional é necessário."}, {"codigo": "baixo", "nome": "Risco Baixo", "aceitabilidade": "toleravel", "cor": "#CDFF9A", "acao": "Nenhum controle adicional é necessário. Pode-se considerar outra solução ou aperfeiçoar os controles existentes. Inspeção das medidas de prevenção existentes é necessária."}, {"codigo": "moderado", "nome": "Risco Moderado", "aceitabilidade": "toleravel", "cor": "#FDE260", "acao": "Desenvolver estudos para reduzir o nível de risco, reavaliando as medidas de prevenção existentes e implantando medidas adicionais, se tecnicamente possível e viável. Inspecionar as medidas existentes em intervalo pré-definido. Monitoramento ambiental e vigilância em saúde são obrigatórios."}, {"codigo": "alto", "nome": "Risco Alto", "aceitabilidade": "toleravel", "cor": "#F3975B", "acao": "Trabalhos em andamento só devem continuar com medidas administrativas e individuais complementares e supervisão competente. Desenvolver estudos para reduzir o nível de risco, com reavaliação após as ações."}, {"codigo": "critico", "nome": "Risco Crítico", "aceitabilidade": "nao_aceitavel", "cor": "#E53935", "acao": "O trabalho não deve ser iniciado ou continuado até que o risco seja reduzido por ação corretiva. Reavaliar depois da ação. Se não for possível reduzir o risco, o trabalho deve permanecer proibido."}], "grade": [["irrelevante", "baixo", "baixo", "baixo", "moderado"], ["baixo", "baixo", "moderado", "moderado", "moderado"], ["baixo", "moderado", "moderado", "moderado", "alto"], ["moderado", "moderado", "alto", "alto", "critico"], ["moderado", "alto", "alto", "critico", "critico"]], "criterios_prob": {"colunas": ["Requisitos de NRs x medidas de prevenção implementadas (alíneas a e b)", "Perfil de exposição x NR-09 (alínea d)", "Exigências da atividade (alínea c)"], "linhas": [["As medidas de controle existentes representam a melhor tecnologia ou prática de controle possível e há garantias de que sejam mantidas em longo prazo.", "Exposição estimada inferior a 10% do LEO (E < 10% LEO).", "O controle representa a melhor tecnologia ou prática de controle disponível e há garantias de que sejam mantidas em longo prazo."], ["As medidas de controle existentes estão em conformidade com as NRs, eficientes e há garantias de que sejam mantidas em longo prazo.", "Exposição estimada entre 10% e 50% do LEO.", "As medidas de controle existentes estão em conformidade com as NRs, eficientes e há garantias de que sejam mantidas em longo prazo."], ["As medidas de controle existentes são adequadas, mas apresentam pequenas deficiências ou desvios mitigados por medidas administrativas e individuais, ou não há garantias de que sejam mantidas em longo prazo.", "Exposição estimada entre 50% e 100% do LEO (nível de ação).", "As medidas de controle existentes são adequadas, mas apresentam pequenas deficiências ou desvios mitigados por medidas administrativas e individuais, ou não há garantias de que sejam mantidas em longo prazo."], ["As medidas de controle existentes apresentam desvios ou problemas significativos. A eficiência é duvidosa e não há garantias de manutenção adequada.", "Exposição estimada acima do LEO e até 500% do LEO.", "As medidas de controle existentes apresentam desvios ou problemas significativos. A eficiência é duvidosa e não há garantias de manutenção adequada."], ["Medidas de controle inexistentes ou reconhecidamente inadequadas.", "Exposição estimada acima de 500% do LEO (superexposição).", "Medidas de controle inexistentes ou reconhecidamente inadequadas."]]}, "criterios_sev": {"colunas": ["Característica da lesão ou agravo", "Capacidade funcional", "Afastamento médico", "Exemplos"], "linhas": [["Lesão, sinal ou sintoma leve, com efeitos reversíveis.", "Não limita a capacidade funcional.", "Tratamento médico sem afastamento superior a um dia.", "Ferimentos superficiais, pequenos cortes e contusões, irritação dos olhos por poeira, dor de cabeça, desconforto temporário."], ["Lesão ou agravo moderado, com efeitos reversíveis.", "Não limita a capacidade funcional.", "Tratamento médico; pode haver afastamento de até 15 dias.", "Lacerações, queimaduras, entorses, fraturas de bom prognóstico, dermatite, asma, DORT em fase aguda."], ["Lesão ou agravo grave, com efeitos reversíveis.", "Pode limitar a capacidade funcional.", "Tratamento médico; pode haver afastamento superior a 15 dias.", "Lacerações, queimaduras, entorses, fraturas de bom prognóstico, dermatite, asma, DORT em fase aguda."], ["Lesão ou agravo grave, com efeitos irreversíveis.", "Limita a capacidade funcional, mas não totalmente.", "Tratamento médico; pode haver afastamento.", "PAINPSE (perda auditiva por ruído), amputação de segmentos, DORT crônicos."], ["Lesão ou agravo crítico ou fatal.", "Limita totalmente a capacidade funcional ou pode causar morte.", "Tratamento médico; pode haver afastamento.", "Amputação de membros, fraturas de mau prognóstico, envenenamento, câncer ocupacional, pneumoconiose, doenças agudas fatais."]]}};
const matrizValida = (m) => !!m && Array.isArray(m.grade) && m.grade.length === 5 && m.grade.every(l => Array.isArray(l) && l.length === 5)
  && Array.isArray(m.niveis) && m.niveis.length && m.grade.flat().every(c => m.niveis.some(n => n.codigo === c));
/* Nível da matriz para P e S (1 a 5). null se faltar um dos dois. */
export function nivelDe(m, p, s) {
  const M = matrizValida(m) ? m : MATRIZ_PADRAO;
  const pi = Number(p), si = Number(s);
  if (!(pi >= 1 && pi <= 5 && si >= 1 && si <= 5)) return null;
  const cod = M.grade[pi - 1][si - 1];
  return M.niveis.find(n => n.codigo === cod) || null;
}
/* Grava no risco o nível e a classificação que a matriz dá (o técnico não escolhe). */
export function aplicarMatriz(r, m) {
  if (!r || r.codigo === '1068') return false;
  const n = nivelDe(m, r.probabilidade, r.severidade);
  const novo = n ? { codigo: n.codigo, nome: n.nome, aceitabilidade: n.aceitabilidade, acao: n.acao || '', cor: n.cor || '' } : null;
  const classif = n ? n.aceitabilidade : (r.probabilidade && r.severidade ? r.classificacao : null);
  const mudou = JSON.stringify(r.nivel || null) !== JSON.stringify(novo) || (r.classificacao ?? null) !== (classif ?? null);
  if (mudou) { r.nivel = novo; r.classificacao = classif; }
  return mudou;
}
/* Acerta, numa avaliação aberta, os riscos que já têm P e S mas ficaram com
   nível/classificação diferente da matriz (feitos antes da v222). */
export function normalizarMatriz(id, m) {
  const d = _docs.get(id); if (!d || !podeEditar(d)) return 0;
  let n = 0;
  for (const g of d.ghes) {
    const copia = JSON.parse(JSON.stringify(g.riscos || []));
    if (copia.some(r => aplicarMatriz(r, m))) { alterarGhe(id, g.id, x => { x.riscos.forEach(r => aplicarMatriz(r, m)); }); n++; }
  }
  return n;
}

/* v222: tipos padrão do "O que falta a empresa enviar" (os mesmos do PASSO-73). */
export const TIPOS_DOC_PADRAO = [['pgr', 'PGR vigente'], ['fispq', 'FISPQ de produto'], ['ltcat', 'LTCAT / laudo'],
  ['lista_funcionarios', 'Lista de funcionários'], ['planta', 'Planta / layout'], ['outro', 'Outro']];
/* v222: avaliação psicossocial fica fora por enquanto (decisão de 26/09, reforçada em 29/09):
   risco psicossocial do SOC não entra no GHE. */
export const ehPsicossocial = (r) => /psicossoc/.test(normNome(r?.nome || ''));

/* Treinamento sugerido pelo risco encontrado (sugestão; só marca se o técnico tocar). */
export const SUGESTAO_TREINAMENTO = { '540': 'NR-35', '562': 'NR-33', '541': 'NR-10', '1053': 'NR-11', '1022': 'NR-11',
  '553': 'NR-12', '434': 'NR-20', '542': 'NR-20', '1057': 'NR-32', '543': 'NR-26', '1079': 'NR-26', '819': 'NR-26',
  '1012': 'NR-26', '1013': 'NR-26', '1014': 'NR-26', '1011': 'NR-26' };

/* ══ IndexedDB ═════════════════════════════════════════════════════════════
   Banco próprio do módulo, separado da fila da execução de turma (que guarda
   presença e assinatura de certificado — não se mexe nela).              */
const DB_NOME = 'grid_campo', DB_VERSAO = 1;
let _db = null;
function banco() {
  if (_db) return Promise.resolve(_db);
  return new Promise((ok, falha) => {
    const r = indexedDB.open(DB_NOME, DB_VERSAO);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('docs')) d.createObjectStore('docs', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('blobs')) d.createObjectStore('blobs');
      if (!d.objectStoreNames.contains('cache')) d.createObjectStore('cache');
    };
    r.onsuccess = () => { _db = r.result; ok(_db); };
    r.onerror = () => falha(r.error);
  });
}
async function idb(store, modo, fn) {
  const d = await banco();
  return new Promise((ok, falha) => {
    const tx = d.transaction(store, modo);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => ok(req?.result);
    tx.onerror = () => falha(tx.error);
    tx.onabort = () => falha(tx.error);
  });
}
const idbGet = (s, k) => idb(s, 'readonly', st => st.get(k)).catch(() => null);
const idbPut = (s, v, k) => idb(s, 'readwrite', st => (k === undefined ? st.put(v) : st.put(v, k)));
const idbDel = (s, k) => idb(s, 'readwrite', st => st.delete(k));
const idbTodos = (s) => idb(s, 'readonly', st => st.getAll()).catch(() => []);

/* Pede ao navegador para não apagar os dados do aparelho sozinho (iPhone e
   alguns Android limpam o armazenamento de site pouco usado). */
export async function pedirArmazenamentoPersistente() {
  try { if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist(); } catch { /* ok */ }
}

/* ══ Catálogo (riscos, treinamentos, opções de ambiente) ═══════════════════ */
let _catalogo = null;
export async function catalogo({ fresco = false } = {}) {
  if (_catalogo && !fresco) return _catalogo;
  if (online()) {
    try {
      const { data, error } = await sb().from('campo_catalogo')
        .select('id,org_id,tipo,codigo,nome,categoria,ordem,dados,ativo')
        .order('tipo').order('ordem').range(0, 2999);   // v222: inativos também (a org esconde um padrão com ativo = false)
      if (error) throw error;
      _catalogo = montarCatalogo(data || []);
      await idbPut('cache', data || [], 'catalogo');
      return _catalogo;
    } catch (e) { console.warn('[campo] catálogo do banco falhou, usando o do aparelho', e?.message); }
  }
  const guardado = await idbGet('cache', 'catalogo');
  if (!guardado) throw new Error('O catálogo de riscos ainda não está neste aparelho. Abra o módulo uma vez com internet.');
  _catalogo = montarCatalogo(guardado);
  return _catalogo;
}
/* v206: semelhança de nomes (igual à Edge Function soc-campo): 1 = igual; ≥ 0,6 = mesmo risco. */
export const normNome = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim();
const _PARADAS = new Set(['de', 'do', 'da', 'dos', 'das', 'e', 'ou', 'com', 'em', 'a', 'o', 'os', 'as',
  'para', 'por', 'no', 'na', 'nos', 'nas', 'ao', 'aos', 'um', 'uma']);
const _radicais = (v) => new Set(normNome(v).split(' ').filter(t => t.length >= 2 && !_PARADAS.has(t)).map(t => t.slice(0, 5)));
export function semelhanca(nomeSoc, nomeAlvo) {
  const a = normNome(nomeSoc), b = normNome(nomeAlvo);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const ta = _radicais(a), tb = _radicais(b);
  if (!ta.size || !tb.size) return 0;
  let comum = 0;
  for (const t of ta) if (tb.has(t)) comum++;
  return 0.7 * (comum / tb.size) + 0.3 * (comum / ta.size);
}
export function melhorPorNome(nome, lista, nomeDe, minimo = 0.6) {
  let melhor = null, nota = 0;
  for (const x of lista) {
    const s = semelhanca(nome, nomeDe(x));
    if (s >= minimo && (!melhor || s > nota)) { melhor = x; nota = s; }
  }
  return melhor;
}

function montarCatalogo(linhas) {
  /* Item da organização (org_id preenchido) vence o padrão GRID de mesmo código. */
  const por = (tipo) => {
    const m = new Map();
    for (const l of linhas.filter(x => x.tipo === tipo).sort((a, b) => (a.org_id ? 1 : 0) - (b.org_id ? 1 : 0))) m.set(l.codigo, l);
    return [...m.values()].filter(l => l.ativo !== false).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  };
  const riscos = por('risco'), treinamentos = por('treinamento'), ambiente = por('ambiente');
  /* v222: tipos do "O que falta a empresa enviar" (PASSO-73). Sem o PASSO-73
     no banco a lista vem vazia e a tela usa TIPOS_DOC_PADRAO. */
  const documentos = por('documento');
  const mz = por('matriz').find(x => x.codigo === 'padrao');
  const matriz = matrizValida(mz?.dados) ? mz.dados : MATRIZ_PADRAO;
  return {
    riscos, treinamentos, ambiente, matriz,
    documentos: documentos.length ? documentos : TIPOS_DOC_PADRAO.map(([codigo, nome], i) => ({ codigo, nome, ordem: i })),
    risco: (cod) => riscos.find(r => r.codigo === String(cod)) || null,
    /* v206: o SOC às vezes manda o risco só com o nome ("ILUMINÂNCIA" × "Iluminação"). */
    riscoPorNome: (nome) => melhorPorNome(nome, riscos, r => r.nome),
    treinamento: (cod) => treinamentos.find(t => t.codigo === cod) || null,
    opcoes: (grupo) => ambiente.filter(a => a.categoria === grupo).map(a => a.nome)
  };
}

/* ══ Documento local de uma avaliação ══════════════════════════════════════
   { id, av, ghes:[], fotos:[], base:{ av:edicao, ghes:{id:edicao} },
     sujo:{ av:bool, ghes:{id:true}, apagados:[id], fotosNovas:{id:true},
            fotosLegenda:{id:true}, fotosApagadas:[id], arquivos:[{campo,blobId,em}] },
     atualizadoLocal, enviadoEm }                                            */
const _docs = new Map();
const _ouvintes = new Set();
export const aoMudarSync = (fn) => { _ouvintes.add(fn); return () => _ouvintes.delete(fn); };
const avisarSync = (id) => _ouvintes.forEach(fn => { try { fn(id); } catch { /* ok */ } });

const docVazio = (av) => ({ id: av.id, av, ghes: [], fotos: [], base: { av: av.edicao ?? 0, ghes: {} },
  sujo: { av: false, ghes: {}, apagados: [], fotosNovas: {}, fotosLegenda: {}, fotosApagadas: [], arquivos: [] },
  atualizadoLocal: null, enviadoEm: null, erroEnvio: null });

export const temPendencia = (doc) => !!doc && (doc.sujo.av || Object.keys(doc.sujo.ghes).length || doc.sujo.apagados.length
  || Object.keys(doc.sujo.fotosNovas).length || Object.keys(doc.sujo.fotosLegenda).length
  || doc.sujo.fotosApagadas.length || doc.sujo.arquivos.length);
export const qtdPendente = (doc) => !doc ? 0 : (doc.sujo.av ? 1 : 0) + Object.keys(doc.sujo.ghes).length + doc.sujo.apagados.length
  + Object.keys(doc.sujo.fotosNovas).length + Object.keys(doc.sujo.fotosLegenda).length + doc.sujo.fotosApagadas.length + doc.sujo.arquivos.length;

const SEL_AV_BASE = 'id,org_id,numero,cliente_id,compromisso_id,tecnico_id,data_visita,hora_inicio,situacao,acompanhante_nome,acompanhante_cargo,observacoes,documentos,assinatura_acomp_path,assinatura_acomp_em,assinatura_tec_path,assinatura_tec_em,concluida_em,concluida_por,pdf_path,revisao,grupo_id,revisao_de,edicao,resumo,soc,criado_em,atualizado_em';
/* Colunas que dependem de um PASSO: se o banco ainda não tem a coluna, o app
   segue como antes — lê sem ela e esconde a parte da tela que a usa.
   v203: funcionarios (PASSO-68) · v222: pendencias_empresa (PASSO-73). */
const _COLS_OPC = { funcionarios: null, pendencias_empresa: null, plano: null };   // null = ainda não sabe · v223: plano (PASSO-74)
const selAv = () => SEL_AV_BASE + Object.entries(_COLS_OPC).filter(([, v]) => v !== false).map(([k]) => ',' + k).join('');
let SEL_AV = selAv();
let _temConf = null;   // espelho de _COLS_OPC.funcionarios (nome antigo, usado abaixo)
const faltaColuna = (e) => {
  const m = String(e?.message || '') + ' ' + String(e?.code || '');
  if (!/(column|coluna|42703|does not exist|schema cache)/i.test(m)) return null;
  return Object.keys(_COLS_OPC).find(k => _COLS_OPC[k] !== false && new RegExp(k, 'i').test(m)) || null;
};
async function lerAv(fn) {
  let r = await fn(SEL_AV);
  for (let i = 0; i < 3 && r.error; i++) {
    const col = faltaColuna(r.error);
    if (!col) break;
    _COLS_OPC[col] = false; SEL_AV = selAv(); r = await fn(SEL_AV);
  }
  if (!r.error) for (const k of Object.keys(_COLS_OPC)) if (_COLS_OPC[k] === null) _COLS_OPC[k] = true;
  _temConf = _COLS_OPC.funcionarios;
  return r;
}
/* v222: o banco já tem a coluna do "O que falta a empresa enviar"? */
export const temPendEmpresa = () => _COLS_OPC.pendencias_empresa !== false;
/* v223: o banco já tem o plano de ação (PASSO-74)? */
export const temPlano = () => _COLS_OPC.plano !== false;
const SEL_GHE = 'id,avaliacao_id,org_id,ordem,nome,codigo_soc,setores,funcoes,menor18,descricao,ambientes,riscos,treinamentos,edicao,criado_em,atualizado_em';
const SEL_FOTO = 'id,avaliacao_id,ghe_id,alvo,alvo_uid,legenda,storage_path,largura,altura,tirada_em,criado_em';

/* Lista para o painel: do banco quando há internet; senão, o que está no aparelho. */
export async function listarAvaliacoes() {
  const locais = await idbTodos('docs');
  if (!online()) return { lista: locais.map(d => ({ ...d.av, _local: true, _pendente: qtdPendente(d) })), offline: true };
  const lerTudo = async () => {
    const tudo = [];
    for (let de = 0; ; de += 1000) {
      const { data, error } = await lerAv(sel => sb().from('campo_avaliacoes').select(sel)
        .order('data_visita', { ascending: false }).order('id').range(de, de + 999));
      if (error) throw error;
      tudo.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    return tudo;
  };
  const lista = await lerTudo();
  const porId = new Map(locais.map(d => [d.id, d]));
  return { lista: lista.map(a => {
    const d = porId.get(a.id);
    return d && temPendencia(d) ? { ...a, ...d.av, _pendente: qtdPendente(d) } : a;
  }), offline: false };
}

/* Empresas e pessoas que aparecem nas telas (com cópia no aparelho). */
export async function clientesPorId(ids) {
  const uniq = [...new Set(ids.filter(Boolean))];
  const guard = (await idbGet('cache', 'clientes')) || {};
  const faltam = uniq.filter(i => !guard[i]);
  if (faltam.length && online()) {
    for (let i = 0; i < faltam.length; i += 200) {
      const { data } = await sb().from('clientes')
        .select('id,nome,cnpj,logradouro,numero,bairro,cidade,uf,endereco,soc_codigo_empresa').in('id', faltam.slice(i, i + 200));
      for (const c of data || []) guard[c.id] = c;
    }
    await idbPut('cache', guard, 'clientes');
  }
  return guard;
}
export async function usuariosPorId(ids) {
  const uniq = [...new Set(ids.filter(Boolean))];
  const guard = (await idbGet('cache', 'usuarios')) || {};
  const faltam = uniq.filter(i => !guard[i]);
  if (faltam.length && online()) {
    const { data } = await sb().from('usuarios')
      .select('id,nome,formacao,sigla_conselho,conselho_classe,uf_registro').in('id', faltam);
    for (const u of data || []) guard[u.id] = u;
    await idbPut('cache', guard, 'usuarios');
  }
  return guard;
}

/* Abre uma avaliação: a cópia do aparelho vale enquanto tiver algo a enviar;
   sem nada pendente e com internet, busca a versão do banco. */
export async function abrir(id, { fresco = false } = {}) {
  let doc = _docs.get(id) || await idbGet('docs', id);
  if (doc && !doc.sujo.arquivos) doc.sujo.arquivos = [];
  const podeBuscar = online() && (!doc || !temPendencia(doc) || fresco);
  if (podeBuscar) {
    try {
      const serv = await baixar(id);
      if (!doc || !temPendencia(doc)) doc = serv;
    } catch (e) {
      if (!doc) throw e;
      console.warn('[campo] usando a cópia do aparelho:', e?.message);
    }
  }
  if (!doc) throw new Error('Esta avaliação ainda não foi aberta neste aparelho. Abra uma vez com internet antes de ir a campo.');
  _docs.set(id, doc);
  await idbPut('docs', doc);
  return doc;
}
async function baixar(id) {
  const { data: av, error } = await lerAv(sel => sb().from('campo_avaliacoes').select(sel).eq('id', id).maybeSingle());
  if (error) throw error;
  if (!av) throw new Error('Avaliação não encontrada ou sem permissão para abrir.');
  const [{ data: ghes, error: e2 }, { data: fotos, error: e3 }] = await Promise.all([
    sb().from('campo_ghes').select(SEL_GHE).eq('avaliacao_id', id).order('ordem').order('criado_em'),
    sb().from('campo_fotos').select(SEL_FOTO).eq('avaliacao_id', id).order('criado_em')
  ]);
  if (e2) throw e2; if (e3) throw e3;
  const doc = docVazio(av);
  doc.ghes = ghes || [];
  doc.fotos = fotos || [];
  for (const g of doc.ghes) doc.base.ghes[g.id] = g.edicao ?? 0;
  doc.enviadoEm = new Date().toISOString();
  /* Mantém em cache os dados que a tela e o PDF usam offline. */
  await clientesPorId([av.cliente_id]);
  await usuariosPorId([av.tecnico_id]);
  return doc;
}

export const doc = (id) => _docs.get(id) || null;
export const podeEditar = (d) => !!d && !['concluida', 'cancelada'].includes(d.av.situacao)
  && (ponte().pode ? ponte().pode('campo', 2) !== false : true);   // v200: perfil de acesso "só vê"
/* v200: ações especiais do perfil de acesso (sem a função na casca = liberado). */
export const podeAcao = (a) => (ponte().podeAcao ? ponte().podeAcao(a) !== false : true);

/* ── Gravação local (sempre) + envio (quando der) ────────────────────────── */
const _timers = new Map();
function guardar(d) {
  d.atualizadoLocal = new Date().toISOString();
  _docs.set(d.id, d);
  clearTimeout(_timers.get('g' + d.id));
  _timers.set('g' + d.id, setTimeout(() => idbPut('docs', d).catch(e => console.error('[campo] não gravou no aparelho', e)), 300));
  clearTimeout(_timers.get('s' + d.id));
  _timers.set('s' + d.id, setTimeout(() => sincronizar(d.id).catch(() => { /* aviso já sai na tela */ }), 4000));
  avisarSync(d.id);
}
export async function guardarAgora(id) {
  const d = _docs.get(id); if (!d) return;
  clearTimeout(_timers.get('g' + id));
  await idbPut('docs', d);
}

export function alterarAv(id, patch) {
  const d = _docs.get(id); if (!d || !podeEditar(d)) return;
  Object.assign(d.av, patch);
  d.sujo.av = true;
  guardar(d);
}
export function ghe(id, gheId) { return _docs.get(id)?.ghes.find(g => g.id === gheId) || null; }
export function alterarGhe(id, gheId, fn) {
  const d = _docs.get(id); if (!d || !podeEditar(d)) return null;
  const g = d.ghes.find(x => x.id === gheId); if (!g) return null;
  fn(g);
  d.sujo.ghes[gheId] = true;
  guardar(d);
  return g;
}
export function novoGhe(id, dados = {}) {
  const d = _docs.get(id); if (!d || !podeEditar(d)) return null;
  const g = { id: novoId(), avaliacao_id: id, ordem: d.ghes.length, nome: dados.nome || 'Novo GHE', codigo_soc: dados.codigo_soc || null,
    setores: dados.setores || [], funcoes: dados.funcoes || [], menor18: null, descricao: dados.descricao || '',
    ambientes: dados.ambientes || [], riscos: dados.riscos || [], treinamentos: dados.treinamentos || [], _novo: true };
  d.ghes.push(g);
  d.sujo.ghes[g.id] = true;
  if (d.av.situacao === 'agendada') d.av.situacao = 'em_andamento';   // espelho; o banco confirma
  guardar(d);
  return g;
}
export function copiarGhe(id, origemId, nome) {
  const o = ghe(id, origemId); if (!o) return null;
  const limpaMedicao = (r) => ({ ...r, uid: novoId(), medicao: null, iluminacao: null, pendente: null });
  return novoGhe(id, { nome, setores: [...o.setores], funcoes: [...o.funcoes], descricao: o.descricao,
    ambientes: (o.ambientes || []).map(a => ({ ...a, uid: novoId() })), riscos: (o.riscos || []).map(limpaMedicao),
    treinamentos: [...(o.treinamentos || [])] });
}
export function apagarGhe(id, gheId) {
  const d = _docs.get(id); if (!d || !podeEditar(d)) return;
  const g = d.ghes.find(x => x.id === gheId); if (!g) return;
  d.ghes = d.ghes.filter(x => x.id !== gheId);
  delete d.sujo.ghes[gheId];
  if (!g._novo) d.sujo.apagados.push(gheId);
  for (const f of d.fotos.filter(f => f.ghe_id === gheId)) apagarFotoInterno(d, f.id);
  guardar(d);
}

/* ── Fotos e assinaturas ─────────────────────────────────────────────────── */
export async function comprimirImagem(arquivo, max = 1600, qualidade = 0.75) {
  const bmp = await (window.createImageBitmap ? createImageBitmap(arquivo).catch(() => null) : null);
  let largura, altura, desenhar;
  if (bmp) { largura = bmp.width; altura = bmp.height; desenhar = (ctx, w, h) => ctx.drawImage(bmp, 0, 0, w, h); }
  else {
    const url = URL.createObjectURL(arquivo);
    const img = await new Promise((ok, f) => { const i = new Image(); i.onload = () => ok(i); i.onerror = f; i.src = url; });
    largura = img.naturalWidth; altura = img.naturalHeight; desenhar = (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const esc = Math.min(1, max / Math.max(largura, altura));
  const w = Math.round(largura * esc), h = Math.round(altura * esc);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  desenhar(cv.getContext('2d'), w, h);
  try { bmp?.close?.(); } catch { /* ok */ }
  const blob = await new Promise(ok => cv.toBlob(ok, 'image/jpeg', qualidade));
  return { blob, largura: w, altura: h };
}
export async function adicionarFoto(id, { ghe_id = null, alvo = 'geral', alvo_uid = null, legenda = '' }, arquivo) {
  const d = _docs.get(id); if (!d || !podeEditar(d)) return null;
  const { blob, largura, altura } = await comprimirImagem(arquivo);
  const fid = novoId();
  await idbPut('blobs', blob, fid);
  const f = { id: fid, avaliacao_id: id, ghe_id, alvo, alvo_uid, legenda, storage_path: `${d.av.org_id}/${d.av.grupo_id}/${fid}.jpg`,
    largura, altura, tirada_em: new Date().toISOString(), _local: true };
  d.fotos.push(f);
  d.sujo.fotosNovas[fid] = true;
  guardar(d);
  return f;
}
export function legendarFoto(id, fotoId, legenda) {
  const d = _docs.get(id); if (!d || !podeEditar(d)) return;
  const f = d.fotos.find(x => x.id === fotoId); if (!f) return;
  f.legenda = legenda;
  if (!d.sujo.fotosNovas[fotoId]) d.sujo.fotosLegenda[fotoId] = true;
  guardar(d);
}
function apagarFotoInterno(d, fotoId) {
  const f = d.fotos.find(x => x.id === fotoId); if (!f) return;
  d.fotos = d.fotos.filter(x => x.id !== fotoId);
  if (d.sujo.fotosNovas[fotoId]) { delete d.sujo.fotosNovas[fotoId]; idbDel('blobs', fotoId).catch(() => {}); }
  else d.sujo.fotosApagadas.push(fotoId);
  delete d.sujo.fotosLegenda[fotoId];
}
export function apagarFoto(id, fotoId) {
  const d = _docs.get(id); if (!d || !podeEditar(d)) return;
  apagarFotoInterno(d, fotoId);
  guardar(d);
}
const _urls = new Map();
/* Endereço para mostrar a foto: do aparelho se ainda não subiu; senão, link
   assinado do banco (vale 1 h) e, uma vez baixada, guardada no aparelho. */
export async function urlFoto(f) {
  if (_urls.has(f.id)) return _urls.get(f.id);
  const local = await idbGet('blobs', f.id);
  if (local) { const u = URL.createObjectURL(local); _urls.set(f.id, u); return u; }
  if (!online()) return null;
  const { data } = await sb().storage.from('campo').createSignedUrl(f.storage_path, 3600);
  if (data?.signedUrl) _urls.set(f.id, data.signedUrl);
  return data?.signedUrl || null;
}
/* Imagem como dataURL JPEG pequena (para o PDF). */
export async function dataUrlFoto(f, max = 1024) {
  let blob = await idbGet('blobs', f.id);
  if (!blob) {
    const { data, error } = await sb().storage.from('campo').download(f.storage_path);
    if (error) throw error;
    blob = data;
  }
  const r = await comprimirImagem(blob, max, 0.72);
  return await new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(r.blob); });
}
export async function dataUrlArquivo(path) {
  if (!path) return null;
  const local = await idbGet('blobs', 'arq:' + path);
  const blob = local || (await sb().storage.from('campo').download(path)).data;
  if (!blob) return null;
  return await new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(blob); });
}
/* Assinatura: guarda o desenho no aparelho e marca para subir. O caminho só
   vai para a avaliação depois que o arquivo estiver no banco. */
export async function guardarAssinatura(id, quem, blob) {
  const d = _docs.get(id); if (!d || !podeEditar(d)) return;
  const path = `${d.av.org_id}/${d.av.grupo_id}/assinatura-${quem}-${Date.now()}.png`;
  await idbPut('blobs', blob, 'arq:' + path);
  const em = new Date().toISOString();
  d.sujo.arquivos = d.sujo.arquivos.filter(a => a.campo !== quem);
  d.sujo.arquivos.push({ campo: quem, path, em });
  d.av['_assinatura_' + quem + '_local'] = path;
  d.av['_assinatura_' + quem + '_local_em'] = em;
  guardar(d);
}
export const assinaturaDe = (d, quem) => ({
  path: d.av['_assinatura_' + quem + '_local'] || d.av[quem === 'tec' ? 'assinatura_tec_path' : 'assinatura_acomp_path'],
  em: d.av['_assinatura_' + quem + '_local_em'] || d.av[quem === 'tec' ? 'assinatura_tec_em' : 'assinatura_acomp_em']
});

/* ══ Envio para o banco ═════════════════════════════════════════════════════ */
const _enviando = new Map();
const ehConflito = (e) => /CAMPO_CONFLITO/.test(e?.message || '');
const CAMPOS_AV = ['acompanhante_nome', 'acompanhante_cargo', 'observacoes', 'documentos', 'soc', 'funcionarios', 'pendencias_empresa', 'plano'];
const CAMPOS_GHE = ['ordem', 'nome', 'codigo_soc', 'setores', 'funcoes', 'menor18', 'descricao', 'ambientes', 'riscos', 'treinamentos'];

export function sincronizar(id) {
  if (_enviando.has(id)) return _enviando.get(id);
  const p = _sincronizar(id).finally(() => _enviando.delete(id));
  _enviando.set(id, p);
  return p;
}
async function _sincronizar(id) {
  const d = _docs.get(id) || await idbGet('docs', id);
  if (!d || !temPendencia(d)) return { ok: true, nada: true };
  if (!online()) { d.erroEnvio = null; avisarSync(id); return { ok: false, offline: true }; }
  _docs.set(id, d);
  try {
    /* 1. Arquivos de fotos novas e as linhas delas */
    for (const fid of Object.keys(d.sujo.fotosNovas)) {
      const f = d.fotos.find(x => x.id === fid);
      if (!f) { delete d.sujo.fotosNovas[fid]; continue; }
      if (f.ghe_id && d.sujo.ghes[f.ghe_id] && d.ghes.find(g => g.id === f.ghe_id)?._novo) {
        await enviarGhe(d, f.ghe_id);        // a foto aponta para o GHE: ele sobe antes
      }
      const blob = await idbGet('blobs', fid);
      if (blob) {
        const { error } = await sb().storage.from('campo').upload(f.storage_path, blob, { contentType: 'image/jpeg', upsert: false });
        if (error && !/exist|duplicate|409/i.test(error.message || '')) throw error;
      }
      const linha = { id: f.id, avaliacao_id: id, ghe_id: f.ghe_id, alvo: f.alvo, alvo_uid: f.alvo_uid, legenda: f.legenda || null,
        storage_path: f.storage_path, largura: f.largura, altura: f.altura, tirada_em: f.tirada_em };
      const { error: e2 } = await sb().from('campo_fotos').insert(linha);
      if (e2 && !/duplicate key|23505/.test((e2.message || '') + (e2.code || ''))) throw e2;
      delete f._local;
      delete d.sujo.fotosNovas[fid];
      await idbPut('docs', d);
    }
    for (const fid of Object.keys(d.sujo.fotosLegenda)) {
      const f = d.fotos.find(x => x.id === fid);
      if (f) { const { error } = await sb().from('campo_fotos').update({ legenda: f.legenda || null }).eq('id', fid); if (error) throw error; }
      delete d.sujo.fotosLegenda[fid];
    }
    for (const fid of [...d.sujo.fotosApagadas]) {
      const { error } = await sb().from('campo_fotos').delete().eq('id', fid);
      if (error) throw error;
      d.sujo.fotosApagadas = d.sujo.fotosApagadas.filter(x => x !== fid);
    }
    /* 2. GHEs */
    for (const gid of [...d.sujo.apagados]) {
      const { error } = await sb().from('campo_ghes').delete().eq('id', gid);
      if (error) throw error;
      d.sujo.apagados = d.sujo.apagados.filter(x => x !== gid);
    }
    for (const gid of Object.keys(d.sujo.ghes)) await enviarGhe(d, gid);
    /* 3. Assinaturas (arquivo primeiro; o caminho vai junto com a avaliação) */
    const patchArq = {};
    for (const a of [...d.sujo.arquivos]) {
      const blob = await idbGet('blobs', 'arq:' + a.path);
      if (blob) {
        const { error } = await sb().storage.from('campo').upload(a.path, blob, { contentType: 'image/png', upsert: false });
        if (error && !/exist|duplicate|409/i.test(error.message || '')) throw error;
      }
      patchArq[a.campo === 'tec' ? 'assinatura_tec_path' : 'assinatura_acomp_path'] = a.path;
      patchArq[a.campo === 'tec' ? 'assinatura_tec_em' : 'assinatura_acomp_em'] = a.em;
    }
    /* 4. Avaliação */
    if (d.sujo.av || Object.keys(patchArq).length) {
      const patch = { ...patchArq };
      for (const c of CAMPOS_AV) if (c in d.av && _COLS_OPC[c] !== false) patch[c] = d.av[c] ?? (c === 'pendencias_empresa' ? [] : c === 'plano' ? {} : null);
      await gravarAv(d, patch);
      for (const a of d.sujo.arquivos) { delete d.av['_assinatura_' + a.campo + '_local']; delete d.av['_assinatura_' + a.campo + '_local_em']; }
      d.sujo.arquivos = [];
      d.sujo.av = false;
    }
    /* O banco recalcula situação e resumo: traz de volta. */
    const { data: av } = await sb().from('campo_avaliacoes').select(SEL_AV).eq('id', id).maybeSingle();
    if (av) { const locais = pegarLocais(d.av); d.av = { ...av, ...locais }; d.base.av = av.edicao; }
    d.enviadoEm = new Date().toISOString();
    d.erroEnvio = null;
    await idbPut('docs', d);
    avisarSync(id);
    return { ok: true };
  } catch (e) {
    d.erroEnvio = traduzirErro(e);
    await idbPut('docs', d).catch(() => {});
    avisarSync(id);
    throw e;
  }
}
const pegarLocais = (av) => Object.fromEntries(Object.entries(av).filter(([k]) => k.startsWith('_assinatura_')));

async function gravarAv(d, patch, tentativa = 0) {
  const { data, error } = await sb().from('campo_avaliacoes').update({ ...patch, edicao: d.base.av })
    .eq('id', d.id).select('id,edicao').maybeSingle();
  if (error) {
    if (ehConflito(error) && tentativa === 0) {
      const resolver = await resolverConflito('a avaliação', async () => {
        const { data: s } = await sb().from('campo_avaliacoes').select(SEL_AV).eq('id', d.id).maybeSingle();
        return s;
      });
      if (resolver.manter) { d.base.av = resolver.servidor.edicao; return gravarAv(d, patch, 1); }
      d.av = { ...resolver.servidor }; d.base.av = resolver.servidor.edicao; d.sujo.av = false;
      return;
    }
    throw error;
  }
  if (!data) throw new Error('A avaliação não foi gravada (sem permissão, ou o módulo está desligado).');
  d.base.av = data.edicao;
}
async function enviarGhe(d, gid, tentativa = 0) {
  const g = d.ghes.find(x => x.id === gid);
  if (!g) { delete d.sujo.ghes[gid]; return; }
  const linha = {}; for (const c of CAMPOS_GHE) linha[c] = g[c] ?? (Array.isArray(g[c]) ? [] : null);
  linha.setores = g.setores || []; linha.funcoes = g.funcoes || [];
  linha.ambientes = g.ambientes || []; linha.riscos = g.riscos || []; linha.treinamentos = g.treinamentos || [];
  if (g._novo) {
    const { data, error } = await sb().from('campo_ghes').insert({ id: g.id, avaliacao_id: d.id, ...linha }).select('id,edicao').maybeSingle();
    if (error && /duplicate key|23505/.test((error.message || '') + (error.code || ''))) { delete g._novo; return enviarGhe(d, gid, tentativa); }
    if (error) throw error;
    delete g._novo; d.base.ghes[gid] = data?.edicao ?? 0;
  } else {
    const { data, error } = await sb().from('campo_ghes').update({ ...linha, edicao: d.base.ghes[gid] ?? g.edicao ?? 0 })
      .eq('id', gid).select('id,edicao').maybeSingle();
    if (error) {
      if (ehConflito(error) && tentativa === 0) {
        const r = await resolverConflito(`o GHE ${g.nome}`, async () => {
          const { data: s } = await sb().from('campo_ghes').select(SEL_GHE).eq('id', gid).maybeSingle();
          return s;
        });
        if (r.manter) { d.base.ghes[gid] = r.servidor.edicao; return enviarGhe(d, gid, 1); }
        Object.assign(g, r.servidor); d.base.ghes[gid] = r.servidor.edicao; delete d.sujo.ghes[gid];
        return;
      }
      throw error;
    }
    if (!data) throw new Error(`O GHE ${g.nome} não foi gravado (sem permissão, ou a avaliação já foi concluída).`);
    d.base.ghes[gid] = data.edicao;
  }
  delete d.sujo.ghes[gid];
  await idbPut('docs', d);
}
async function resolverConflito(oque, lerServidor) {
  const servidor = await lerServidor();
  if (!servidor) throw new Error(`Não foi possível ler ${oque} no banco.`);
  const quando = servidor.atualizado_em ? new Date(servidor.atualizado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'há pouco';
  const conf = ponte().confirmar;
  const manter = conf
    ? await conf(`${oque[0].toUpperCase() + oque.slice(1)} foi alterado em outro aparelho (${quando}). Ficar com o que está NESTE aparelho? Se escolher Cancelar, vale a versão do outro aparelho.`)
    : true;
  return { manter: !!manter, servidor };
}

export function traduzirErro(e) {
  const m = String(e?.message || e || '');
  if (/Failed to fetch|NetworkError|network|Load failed/i.test(m)) return 'Sem conexão. As alterações continuam guardadas neste aparelho.';
  if (/row-level security|permission denied|42501/i.test(m)) return 'Sem permissão para gravar (confira o perfil e se o módulo está ligado).';
  return m.replace(/^CAMPO_[A-Z_]+:?\s*/, '');
}

/* ══ Situação, faltas e conclusão ══════════════════════════════════════════ */
export function pendencias(d) {
  const out = [];
  for (const g of d.ghes) for (const r of g.riscos || []) if (r.pendente) out.push({ ghe: g, risco: r });
  return out;
}
/* Espelho das regras do banco (_campo_faltas). O banco é quem decide. */
export function faltas(d, { semAssinaturaTec = false } = {}) {
  const f = [];
  if (!d.ghes.length) f.push({ texto: 'Cadastrar pelo menos um GHE' });
  for (const g of d.ghes) for (const r of g.riscos || []) {
    const rot = `GHE ${g.nome} · ${r.codigo ? r.codigo + ' ' : ''}${r.nome}`;
    if (r.pendente) { f.push({ texto: `${rot}: está para depois`, ghe: g.id, risco: r.uid }); continue; }
    if (r.codigo === '1068') continue;
    const sem = [];
    if (!['P', 'E', 'I'].includes(r.exposicao)) sem.push('exposição');
    if (!(r.probabilidade >= 1 && r.probabilidade <= 5)) sem.push('probabilidade');
    if (!(r.severidade >= 1 && r.severidade <= 5)) sem.push('severidade');
    if (!['aceitavel', 'toleravel', 'nao_aceitavel'].includes(r.classificacao)) sem.push('classificação');
    for (const c of CONCLUSOES[r.categoria] || []) if (!['S', 'N'].includes(r[c])) sem.push({ ins: 'insalubridade', per: 'periculosidade', ae: 'aposentadoria especial' }[c]);
    if (sem.length) f.push({ texto: `${rot}: falta ${sem.join(', ')}`, ghe: g.id, risco: r.uid });
  }
  if (d.av.acompanhante_nome && !assinaturaDe(d, 'acomp').path) f.push({ texto: `Assinatura do acompanhante (${d.av.acompanhante_nome})`, assinatura: 'acomp' });
  if (!semAssinaturaTec && !assinaturaDe(d, 'tec').path) f.push({ texto: 'Assinatura do técnico', assinatura: 'tec' });
  return f;
}
export function riscoCompleto(r) {
  if (r.pendente) return 'pendente';
  if (r.codigo === '1068') return 'ok';
  const okBase = ['P', 'E', 'I'].includes(r.exposicao) && r.probabilidade && r.severidade && r.classificacao;
  return okBase ? 'ok' : 'fazer';
}
export function gheCompleto(g) {
  const rs = g.riscos || [];
  if (!g.nome || !(g.setores || []).length) return 'fazer';
  if (rs.some(r => r.pendente)) return 'pendente';
  if (!rs.length || rs.some(r => riscoCompleto(r) !== 'ok')) return 'fazer';
  return 'ok';
}

/* ── v222: "O que falta a empresa enviar" (PASSO-73) ───────────────────────
   av.pendencias_empresa = [{ uid, tipo, nome, detalhe, prazo (AAAA-MM-DD),
     ghe_id, risco_uid, risco_nome, criado_em, resolvido_em }]
   Item sem resolvido_em = em aberto → a avaliação vai para "Aguardando
   informações" (o banco decide; aqui só o espelho para a tela). */
export const pendEmpresa = (d) => Array.isArray(d?.av?.pendencias_empresa) ? d.av.pendencias_empresa : [];
export const pendEmpresaAbertas = (d) => pendEmpresa(d).filter(p => p && !p.resolvido_em);
function espelharSituacao(d) {
  if (['concluida', 'cancelada'].includes(d.av.situacao)) return;
  const aguardando = pendEmpresaAbertas(d).length > 0 || pendencias(d).length > 0;
  d.av.situacao = aguardando ? 'aguardando' : (d.ghes.length ? 'em_andamento' : 'agendada');
}
function mudarPendEmpresa(id, fn) {
  const d = _docs.get(id); if (!d || !podeEditar(d) || !temPendEmpresa()) return null;
  const lista = pendEmpresa(d).map(p => ({ ...p }));
  const r = fn(lista);
  alterarAv(id, { pendencias_empresa: lista });
  espelharSituacao(d);
  return r;
}
export function adicionarPendEmpresa(id, item) {
  return mudarPendEmpresa(id, (l) => { const p = { uid: novoId(), criado_em: new Date().toISOString(), resolvido_em: null, ...item }; l.push(p); return p; });
}
export function alterarPendEmpresa(id, uid, patch) {
  return mudarPendEmpresa(id, (l) => { const p = l.find(x => x.uid === uid); if (p) Object.assign(p, patch); return p; });
}
export const resolverPendEmpresa = (id, uid) => alterarPendEmpresa(id, uid, { resolvido_em: new Date().toISOString() });
export function removerPendEmpresa(id, uid) {
  return mudarPendEmpresa(id, (l) => { const i = l.findIndex(x => x.uid === uid); if (i >= 0) l.splice(i, 1); });
}
/* "03/10" e se já passou do prazo. */
export function prazoInfo(prazo) {
  if (!prazo) return { txt: '', vencido: false };
  const [a, m, dd] = String(prazo).slice(0, 10).split('-');
  const h = new Date(); const hoje = `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
  return { txt: `${dd}/${m}${a !== hoje.slice(0, 4) ? '/' + a : ''}`, vencido: String(prazo).slice(0, 10) < hoje };
}

/* ── v222: conferência rápida de um risco que veio do SOC ──────────────────
   r.conferido = { como: 'confere' | 'mudou', em }  (informativo; quem decide
   se o risco está completo continua sendo riscoCompleto / o banco). */
export function marcarConferido(id, gheId, uid, como) {
  return alterarGhe(id, gheId, g => {
    const r = (g.riscos || []).find(x => x.uid === uid); if (!r) return;
    r.conferido = { como, em: new Date().toISOString() };
    if (como === 'confere' && r.soc?.exposicao && !r.exposicao) r.exposicao = r.soc.exposicao;
  });
}

/* Concluir: exige internet (o banco confere tudo e dá o número). */
export async function concluir(id) {
  const d = _docs.get(id);
  if (!online()) throw new Error('Para concluir é preciso internet: o banco confere a avaliação e dá o número dela.');
  await sincronizar(id);
  const { data, error } = await sb().from('campo_avaliacoes').update({ situacao: 'concluida', edicao: d.base.av })
    .eq('id', id).select(SEL_AV).maybeSingle();
  if (error) throw new Error(traduzirErro(error));
  if (!data) throw new Error('A avaliação não foi concluída (sem permissão).');
  d.av = data; d.base.av = data.edicao;
  await idbPut('docs', d);
  avisarSync(id);
  return data;
}
export async function anexarPdf(id, blob) {
  const d = _docs.get(id);
  const nome = `${(d.av.numero || 'avaliacao').replace(/[^A-Za-z0-9-]/g, '')}-rev${d.av.revisao}.pdf`;
  const path = `${d.av.org_id}/${d.av.grupo_id}/${nome}`;
  const { error } = await sb().storage.from('campo').upload(path, blob, { contentType: 'application/pdf', upsert: false });
  if (error && !/exist|duplicate|409/i.test(error.message || '')) throw error;
  const { data, error: e2 } = await sb().from('campo_avaliacoes').update({ pdf_path: path, edicao: d.base.av })
    .eq('id', id).select(SEL_AV).maybeSingle();
  if (e2) throw new Error(traduzirErro(e2));
  if (data) { d.av = data; d.base.av = data.edicao; await idbPut('docs', d); }
  return path;
}
export async function linkPdf(d) {
  if (!d.av.pdf_path) return null;
  const { data } = await sb().storage.from('campo').createSignedUrl(d.av.pdf_path, 600, { download: true });
  return data?.signedUrl || null;
}
/* v207: link do PDF a partir da lista (sem abrir a avaliação). */
export async function linkPdfPorId(id) {
  const { data: av, error } = await sb().from('campo_avaliacoes').select('pdf_path').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!av?.pdf_path) return null;
  const { data } = await sb().storage.from('campo').createSignedUrl(av.pdf_path, 600, { download: true });
  return data?.signedUrl || null;
}
export async function novaRevisao(id) {
  const { data, error } = await sb().rpc('campo_nova_revisao', { p_id: id });
  if (error) throw new Error(traduzirErro(error));
  return data;
}

/* ══ SOC: hierarquia da empresa-cliente ════════════════════════════════════ */
/* v202: as hierarquias do SOC guardam CÓDIGOS de setor e cargo (unidade|setor|cargo);
   os nomes estão em soc.setores / soc.cargos. Tudo que mostra setor ou função ao
   técnico passa por aqui — antes a tela mostrava "1", "2" em vez do nome. */
export function nomesSoc(soc) {
  const set = new Map((soc?.setores || []).map(x => [`${x.unidade}|${x.codigo}`, x.nome]));
  const car = new Map((soc?.cargos || []).map(x => [`${x.unidade}|${x.setor}|${x.codigo}`, x.nome]));
  return {
    setor: h => set.get(`${h.unidade}|${h.setor}`) || (h.setor ? `Setor ${h.setor}` : ''),
    cargo: h => car.get(`${h.unidade}|${h.setor}|${h.cargo}`) || (h.cargo ? `Função ${h.cargo}` : ''),
  };
}

export async function trazerDoSoc(id) {
  const d = _docs.get(id);
  if (!online()) throw new Error('Para buscar no SOC é preciso internet.');
  const { data, error } = await sb().functions.invoke('soc-campo', {
    body: { acao: 'hierarquia_cliente', cliente_id: d.av.cliente_id, orgId: sessao.orgId() } });
  if (error) {
    let msg = error.message;
    try { const corpo = await error.context?.json?.(); if (corpo?.error) msg = corpo.error; } catch { /* ok */ }
    throw new Error(msg || 'O SOC não respondeu.');
  }
  if (data?.error) throw new Error(data.error);
  /* LGPD: a avaliação guarda só o que o técnico usa (setores, cargos, GHEs e
     quantas pessoas há em cada um). Nome de funcionário não fica gravado. */
  const { funcionarios = [], ...resto } = data || {};
  const foto = { ...resto, total_funcionarios: funcionarios.length,
    ghes: (resto.ghes || []).map(({ funcionarios: f = [], ...g }) => ({ ...g, total_funcionarios: f.length })) };
  const patch = { soc: foto };
  /* v203: com a conferência ligada, a lista de funcionários (só nome, código,
     setor e função) fica na avaliação para o técnico conferir com a empresa.
     O que já foi conferido é mantido ao atualizar do SOC. */
  if (temConferencia(d)) patch.funcionarios = mesclarFuncionariosSoc(d.av.funcionarios, funcionarios, nomesSoc(resto));
  alterarAv(id, patch);
  await guardarAgora(id);
  return foto;
}

/* ── v203: conferência dos funcionários com a empresa ─────────────────────
   av.funcionarios = { lista: [{ id, codigo, nome, setor, funcao, origem:'soc'|'empresa',
                                  situacao: null|'confere'|'saiu'|'mudou', novo_setor, nova_funcao }],
                        conferido_em }
   LGPD: só nome, código no SOC, setor e função. */
export const temConferencia = (d) => !!d && _temConf !== false && ('funcionarios' in (d.av || {}) || _temConf === true);
export const listaFuncionarios = (d) => (d?.av?.funcionarios?.lista || []);
export function mesclarFuncionariosSoc(atual, doSoc, nm) {
  const antes = new Map((atual?.lista || []).filter(p => p.origem === 'soc' && p.codigo).map(p => [String(p.codigo), p]));
  const lista = [];
  const vistos = new Set();
  for (const f of doSoc || []) {
    const codigo = String(f.codigo || '');
    if (!codigo || vistos.has(codigo)) continue;
    vistos.add(codigo);
    const velho = antes.get(codigo) || {};
    lista.push({ id: 's' + codigo, codigo, nome: String(f.nome || '').trim(),
      setor: nm.setor(f), funcao: nm.cargo(f), origem: 'soc',
      situacao: velho.situacao || null, novo_setor: velho.novo_setor || null, nova_funcao: velho.nova_funcao || null });
  }
  for (const p of atual?.lista || []) if (p.origem === 'empresa') lista.push(p);
  return { ...(atual || {}), lista };
}
export function alterarFuncionarios(id, fn) {
  const d = _docs.get(id); if (!d || !podeEditar(d) || !temConferencia(d)) return;
  const f = { ...(d.av.funcionarios || {}) };
  f.lista = (f.lista || []).map(p => ({ ...p }));
  fn(f.lista);
  f.conferido_em = new Date().toISOString();
  alterarAv(id, { funcionarios: f });
}
export function resumoConferencia(d) {
  const l = listaFuncionarios(d);
  const soc = l.filter(p => p.origem === 'soc');
  const r = { total: l.length, soc: soc.length, confere: 0, saiu: 0, mudou: 0, falta: 0,
              incluidos: l.filter(p => p.origem === 'empresa').length };
  for (const p of soc) { if (p.situacao === 'confere') r.confere++; else if (p.situacao === 'saiu') r.saiu++; else if (p.situacao === 'mudou') r.mudou++; else r.falta++; }
  r.naEmpresa = r.soc - r.saiu + r.incluidos;
  return r;
}
/* Onde cada pessoa está hoje (para a contagem dos GHEs). null = sem lista. */
export function pessoasAtuais(d) {
  const l = listaFuncionarios(d);
  if (!l.length) return null;
  return l.filter(p => p.situacao !== 'saiu').map(p => p.situacao === 'mudou'
    ? { setor: p.novo_setor || p.setor, funcao: p.nova_funcao || p.funcao }
    : { setor: p.setor, funcao: p.funcao });
}

/* ══ v223: plano de ação 5W2H para o SOC (PASSO-74) ═══════════════════════
   O plano mora na avaliação (av.plano) enquanto ela está aberta — funciona
   sem internet e trava junto quando a avaliação é concluída. Na conclusão o
   banco cria uma linha por ação em campo_acoes, onde o operador marca
   "lançada no SOC" e acompanha a situação. Regras em plano.js.          */
export const planoDe = (d) => (d?.av?.plano && typeof d.av.plano === 'object' ? d.av.plano : {});
export async function contextoPlano(d) {
  const cat = await catalogo();
  const usus = await usuariosPorId([d.av.tecnico_id]).catch(() => ({}));
  return P.contexto(d, cat, { tecnico: usus?.[d.av.tecnico_id]?.nome || '' });
}
/* Recalcula as sugestões e mescla com o que o técnico já mexeu. Grava só se mudou. */
export async function atualizarPlano(id) {
  const d = _docs.get(id); if (!d) return null;
  const ctx = await contextoPlano(d);
  const { itens, semNivel } = P.sugerir(d, ctx);
  if (!podeEditar(d) || !temPlano()) return { plano: planoDe(d), semNivel, ctx, mudou: false };
  const { plano, mudou } = P.mesclar(planoDe(d), itens, ctx);
  if (mudou) alterarAv(id, { plano });
  return { plano: mudou ? plano : planoDe(d), semNivel, ctx, mudou };
}
/* Altera o plano (fn recebe uma cópia). Qualquer mudança pede nova revisão do técnico. */
export function alterarPlano(id, fn, { manterRevisado = false } = {}) {
  const d = _docs.get(id); if (!d || !podeEditar(d) || !temPlano()) return null;
  const pl = JSON.parse(JSON.stringify(planoDe(d)));
  pl.acoes = pl.acoes || [];
  const r = fn(pl);
  if (!manterRevisado) { delete pl.revisado_em; delete pl.revisado_por; }
  alterarAv(id, { plano: pl });
  return r;
}
export function marcarPlanoRevisado(id) {
  return alterarPlano(id, (pl) => { pl.revisado_em = new Date().toISOString(); pl.revisado_por = sessao.usuario()?.id || null; }, { manterRevisado: true });
}
export const planoRevisado = (d) => !!planoDe(d).revisado_em;

/* Ações já lançadas (depois da conclusão). */
let _temAcoes = null;
export const temTabelaAcoes = () => _temAcoes !== false;
const semTabela = (e) => /campo_acoes|relation .* does not exist|42P01|schema cache/i.test(String(e?.message || '') + String(e?.code || ''));
export async function listarAcoes({ grupoId = null, clienteId = null } = {}) {
  if (!online()) throw new Error('Para ver o plano de ação lançado é preciso internet.');
  const tudo = [];
  for (let de = 0; ; de += 1000) {
    let q = sb().from('campo_acoes').select('*');
    if (grupoId) q = q.eq('grupo_id', grupoId);
    if (clienteId) q = q.eq('cliente_id', clienteId);
    const { data, error } = await q.order('prazo', { ascending: true, nullsFirst: false }).order('numero').range(de, de + 999);
    if (error) { if (semTabela(error)) { _temAcoes = false; return []; } throw error; }
    _temAcoes = true;
    tudo.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return tudo;
}
export async function gravarAcao(a, patch) {
  const { data, error } = await sb().from('campo_acoes').update({ ...patch, edicao: a.edicao }).eq('id', a.id).select('*').maybeSingle();
  if (error) throw new Error(ehConflito(error) ? 'Outra pessoa alterou esta ação agora há pouco. A tela foi recarregada; confira e faça de novo.' : traduzirErro(error));
  if (!data) throw new Error('Nada foi gravado (sem permissão para alterar o plano de ação).');
  return data;
}

/* Envia tudo que estiver pendente quando a internet voltar. */
if (typeof window !== 'undefined' && !window.__campoOnline) {
  window.__campoOnline = true;
  window.addEventListener('online', async () => {
    for (const d of await idbTodos('docs')) if (temPendencia(d)) sincronizar(d.id).catch(() => {});
  });
}
