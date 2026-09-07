/* ══════════════════════════════════════════════════════════════════════════
   GRID · nucleo/config.js
   Decide em qual ambiente o app está rodando — pelo endereço, não por um
   arquivo trocado na hora de publicar. Isso importa porque o erro clássico
   de ambiente é publicar em produção um arquivo que ficou apontando para
   homologação (ou pior, o contrário).

   A chave `anon` do Supabase é pública por desenho: ela vai no navegador em
   qualquer cenário e quem protege os dados é a RLS. A chave `service_role`
   NUNCA aparece aqui nem em nenhum arquivo do front — é requisito
   permanente do projeto (05-Decisoes/2026-08-21-requisito-obrigatorio-
   protecao-credenciais.md).
   ══════════════════════════════════════════════════════════════════════════ */

const AMBIENTES = {
  producao: {
    id: 'producao',
    rotulo: 'Produção',
    hosts: ['toledolabs.com.br', 'www.toledolabs.com.br'],
    supabaseUrl: '',      // ← preencher com a URL do projeto de produção
    supabaseAnon: '',     // ← preencher com a chave anon (pública) de produção
    banner: false
  },
  homologacao: {
    id: 'homologacao',
    rotulo: 'Homologação',
    hosts: ['homolog.toledolabs.com.br'],
    supabaseUrl: '',      // ← projeto Supabase separado, dados fictícios
    supabaseAnon: '',
    banner: true
  },
  local: {
    id: 'local',
    rotulo: 'Local',
    hosts: ['localhost', '127.0.0.1'],
    supabaseUrl: '',      // normalmente o mesmo de homologação
    supabaseAnon: '',
    banner: true
  }
};

function detectar() {
  const host = (typeof location !== 'undefined' ? location.hostname : '').toLowerCase();
  for (const amb of Object.values(AMBIENTES)) if (amb.hosts.includes(host)) return amb;
  /* Endereço desconhecido: trata como homologação. Falha para o lado seguro —
     um ambiente novo nunca fala com o banco de produção por engano. */
  return { ...AMBIENTES.homologacao, id: 'desconhecido', rotulo: 'Ambiente não identificado' };
}

export const AMBIENTE = detectar();
export const ehProducao = () => AMBIENTE.id === 'producao';

/* Faixa de aviso — some por completo em produção. Serve para que ninguém
   trabalhe de verdade em homologação achando que é produção, e vice-versa. */
export function mostrarFaixaDeAmbiente() {
  if (!AMBIENTE.banner || typeof document === 'undefined') return;
  if (document.getElementById('faixaAmbiente')) return;

  const faixa = document.createElement('div');
  faixa.id = 'faixaAmbiente';
  faixa.setAttribute('role', 'status');
  faixa.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:99999',
    'background:#B45309', 'color:#fff', 'text-align:center',
    'font:700 12px/1.6 "Plus Jakarta Sans",system-ui,sans-serif',
    'letter-spacing:.06em', 'text-transform:uppercase', 'padding:5px 12px',
    'box-shadow:0 1px 6px rgba(0,0,0,.25)'
  ].join(';');
  faixa.textContent = `${AMBIENTE.rotulo} · dados fictícios · não é o sistema do cliente`;
  document.body.appendChild(faixa);
  document.documentElement.style.setProperty('--faixa-ambiente-h', '28px');
  document.body.style.paddingTop = '28px';
}
