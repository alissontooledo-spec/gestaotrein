/* ══════════════════════════════════════════════════════════════════════════
   GRID · nucleo/estagios.js
   As etapas do funil corrente, na ordem.

   Em modo exemplo valem os valores abaixo. Em modo banco, dados.carregarEtapas()
   carrega de crm_funil_etapas e substitui — mantendo a MESMA forma
   ({id, rotulo, tipo, cor}), para nenhuma tela precisar mudar. O `id` e o
   `slug` da etapa, que e estavel: a organizacao pode renomear "Proposta" sem
   quebrar comparacao nenhuma.

   ── CORRIGIDO EM 05/09 (h17) ───────────────────────────────────────────────
   Ate o h16 este arquivo declarava so {id, rotulo, tipo}, enquanto funil.js
   lia `e.cor` e `e.fundo` — que existiam num OUTRO array, dentro de
   modulos/crm/exemplo.js, que nao era o importado. Todo cabecalho de coluna do
   quadro saia com `background:undefined`. A cor agora mora aqui, com a etapa,
   e vem do banco quando a organizacao configura a dela.
   ══════════════════════════════════════════════════════════════════════════ */

/* Paleta das etapas — deliberadamente contida: o quadro tem cinco colunas lado
   a lado, e cinco cores fortes competindo e exatamente o "carregado" que a
   revisao de 05/09 esta corrigindo. Cor cheia so onde ela significa alguma
   coisa: proposta (pede acao) e ganho (resultado). */
export const CORES = {
  navy:   '#1E2A4A',
  cinza:  '#8B93A8',
  ambar:  '#B45309',
  azul:   '#1D4ED8',
  verde:  '#059669',
  roxo:   '#6D28D9',
  rosa:   '#BE185D'
};

/* Fundo derivado da cor, sempre discreto. Aceita hex (#RRGGBB) e devolve rgba
   com 8% — uma faixa de identificacao, nao um bloco de cor. */
export function fundoDe(cor) {
  const c = String(cor || CORES.navy).trim();
  if (!/^#[0-9a-f]{6}$/i.test(c)) return 'rgba(30,42,74,.06)';
  const n = parseInt(c.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},.08)`;
}

/* Cor do TEXTO de cabecalho de etapa: sempre navy.
   Tentamos usar a propria cor da etapa e a medicao reprovou 3 das 5 colunas em
   AA — cinza #8B93A8 sobre fundo de 8% da mesma cor da 2,39:1. A cor da etapa
   identifica pela borda e pelo ponto; o texto usa o tom que passa em todas.
   Mantida exportada porque telas ainda a importam. */
export const textoDe = () => CORES.navy;

export const ESTAGIOS = [
  { id:'novo',       rotulo:'Novo',          tipo:'aberto',  cor:CORES.navy  },
  { id:'contato',    rotulo:'Contato feito', tipo:'aberto',  cor:CORES.cinza },
  { id:'proposta',   rotulo:'Proposta',      tipo:'aberto',  cor:CORES.ambar },
  { id:'negociacao', rotulo:'Negociação',    tipo:'aberto',  cor:CORES.azul  },
  { id:'ganho',      rotulo:'Ganho',         tipo:'ganho',   cor:CORES.verde },
  { id:'perdido',    rotulo:'Perdido',       tipo:'perdido', cor:CORES.cinza }
];

export const rotuloEstagio = (id) => (ESTAGIOS.find(e => e.id === id) || {}).rotulo || id;
export const etapa = (id) => ESTAGIOS.find(e => e.id === id) || null;
export const corEtapa = (id) => (etapa(id) || {}).cor || CORES.navy;

/* Etapas em que um lead esta "vivo" — usado por toda tela que separa pipeline
   de resultado. Antes cada tela reimplementava isso com uma lista de slugs
   escrita na mao ('proposta','negociacao'), que quebrava assim que a
   organizacao criasse uma etapa nova. */
export const abertas   = () => ESTAGIOS.filter(e => e.tipo === 'aberto');
export const ehAberta  = (id) => (etapa(id) || {}).tipo === 'aberto';
export const ehGanho   = (id) => (etapa(id) || {}).tipo === 'ganho';
export const ehPerdido = (id) => (etapa(id) || {}).tipo === 'perdido';

/* O funil a que as etapas acima pertencem — a organizacao pode ter mais de um.
   Guardado aqui porque quem troca de funil (funil.js) e quem grava
   (dados.salvarLead) precisam concordar sobre qual esta aberto. */
let _funilCorrente = null;
export const funilCorrente = () => _funilCorrente;
export const definirFunilCorrente = (f) => { _funilCorrente = f || null; };

/* Substitui o conteudo NO LUGAR (splice, nao reatribuicao): os modulos
   importam a referencia do array, entao trocar o objeto nao chegaria neles. */
export function definir(lista) {
  if (!Array.isArray(lista) || !lista.length) return;
  ESTAGIOS.splice(0, ESTAGIOS.length, ...lista.map(e => ({
    id: e.id, rotulo: e.rotulo, tipo: e.tipo || 'aberto', cor: e.cor || CORES.navy
  })));
}
