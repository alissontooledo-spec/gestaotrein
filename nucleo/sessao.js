/* ══════════════════════════════════════════════════════════════════════════
   GRID · nucleo/sessao.js
   Quem está usando, de qual organização, e quais módulos ela contratou.
   Duas origens possíveis:
     • dentro do app.html  → lê o `usuarioAtual` que já existe
     • fora dele (demo)    → usa o objeto passado em iniciar()
   ══════════════════════════════════════════════════════════════════════════ */

let _estado = { usuario: null, modulos: [], demo: false };

export function iniciar({ usuario, modulos = [], demo = false }) {
  _estado = { usuario, modulos, demo };
}

/* Dentro do app real: puxa do escopo global existente, sem alterá-lo. */
export function adotarDoApp() {
  const u = (typeof window !== 'undefined') ? window.usuarioAtual : null;
  if (!u) return false;
  _estado.usuario = { id: u.id, nome: u.nome, perfil: u.perfil, org_id: u.org_id, org: u.orgNome };
  return true;
}

export const usuario  = () => _estado.usuario;
export const perfil   = () => _estado.usuario?.perfil || null;
export const orgId    = () => _estado.usuario?.org_id || null;
export const emDemo   = () => _estado.demo;

/* Módulos contratados. A trava de verdade é a policy RESTRICTIVE no banco;
   isto aqui só decide o que aparece no menu. */
export const modulos    = () => _estado.modulos;
export const temModulo  = (id) => _estado.modulos.includes(id);
export function definirModulos(lista) { _estado.modulos = Array.isArray(lista) ? lista : []; }

/* Consulta tolerante: qualquer erro devolve lista vazia e o app segue como
   hoje. É o mesmo padrão já usado com sucesso na entrega de ART. */
export async function carregarModulos(sb, org) {
  try {
    const { data, error } = await sb.from('organizacoes_modulos')
      .select('modulo').eq('org_id', org).eq('ativo', true);
    if (error) throw error;
    _estado.modulos = (data || []).map(r => r.modulo);
  } catch (e) {
    _estado.modulos = [];               // falha fechada: nenhum módulo extra
  }
  return _estado.modulos;
}

/* Celular: uma única fonte de verdade para a decisão de escopo móvel.
   `forcar` existe para a página de demonstração, que mostra uma moldura
   estreita dentro de uma janela larga. No app real fica nulo. */
let _forcarCelular = null;
export const definirCelular = (v) => { _forcarCelular = v; };
export const ehCelular = () => _forcarCelular !== null
  ? !!_forcarCelular
  : (typeof window !== 'undefined' && window.matchMedia('(max-width:767px)').matches);
