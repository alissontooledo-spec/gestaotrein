/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/crm/exemplo.js
   Dados de demonstração — existem só enquanto o schema do CRM não foi
   criado. Quando as tabelas existirem, `dados.iniciar({origem:'banco'})`
   passa a valer e este arquivo deixa de ser carregado. Ele está separado
   justamente para que ninguém confunda demonstração com dado real.
   ══════════════════════════════════════════════════════════════════════════ */

export const EXEMPLO = {
  crm_caixas: [
    { id:'cx1', nome:'Comercial',       numero:'4732221090', estado:'conectado',   abertas:3, equipe:['Marina Alves','Diego Ramos','Luana Pires','Caio Serra'], horario:'Seg a sex · 08h-18h' },
    { id:'cx2', nome:'Atendimento',     numero:'4732221091', estado:'conectado',   abertas:2, equipe:['Luana Pires','Caio Serra'], horario:'Seg a sex · 08h-18h' },
    { id:'cx3', nome:'Financeiro',      numero:'4732221092', estado:'desconectado',abertas:2, equipe:['Fabio Costa'], horario:'Seg a sex · 09h-17h', desde:'07:20' },
    { id:'cx4', nome:'Suporte',         numero:'4732221093', estado:'conectado',   abertas:0, equipe:['Tais Souza'], horario:'Seg a sex · 09h-17h' },
    { id:'cx5', nome:'Filial Joinville',numero:'4731114400', estado:'conectado',   abertas:0, equipe:['Rita Bento','Ana Nery'], horario:'Seg a sex · 08h-17h' },
    { id:'cx6', nome:'Filial Curitiba', numero:'4135552020', estado:'aguardando_qr',abertas:0, equipe:[], horario:'—' }
  ],

  crm_contatos: [
    { id:'c1', nome:'Ricardo Souza',  cargo:'Coordenador de SST',   empresa:'Metalúrgica Souza',   telefone:'5547998124477', origem:'WhatsApp · Comercial', situacao:'lead',    ultimo:'2026-09-03T09:52', cliente_id:'cli1' },
    { id:'c2', nome:'Paula Andrade',  cargo:'Gerente administrativa',empresa:'Construtora Vale',   telefone:'5547996772210', origem:'WhatsApp · Comercial', situacao:'proposta',ultimo:'2026-09-03T09:12', cliente_id:null },
    { id:'c3', nome:'João Batista',   cargo:'Motorista',            empresa:'Transportes Lima',    telefone:'5547981239987', origem:'WhatsApp · Atendimento',situacao:'cliente', ultimo:'2026-09-03T08:55', cliente_id:'cli2' },
    { id:'c4', nome:'Carla Bianchi',  cargo:'Diretora',             empresa:'Alimentos Delta',     telefone:'5547992017788', origem:'Indicação',            situacao:'lead',    ultimo:'2026-09-02T16:20', cliente_id:null },
    { id:'c5', nome:'Marcos Cardoso', cargo:'',                     empresa:null,                  telefone:'5541994501122', origem:'WhatsApp · Comercial', situacao:'novo',    ultimo:'2026-09-01T10:05', cliente_id:null }
  ],

  crm_leads: [
    { id:'l1', empresa:'Construtora Vale',    treinamento:'NR-10', vagas:12, estagio:'proposta',   valor:18400, responsavel:'Marina Alves', origem:'WhatsApp · Comercial',  parado_desde:'2026-08-26', contato_id:'c2' },
    { id:'l2', empresa:'Indústria Norte',     treinamento:'NR-35', vagas:20, estagio:'ganho',      valor:14800, responsavel:'Marina Alves', origem:'Indicação',             parado_desde:null,          contato_id:null, virou_cliente:'2026-09-01' },
    { id:'l3', empresa:'Alimentos Delta',     treinamento:'Brigada de incêndio', vagas:8, estagio:'negociacao', valor:12500, responsavel:'Marina Alves', origem:'WhatsApp · Comercial', parado_desde:'2026-09-02', contato_id:'c4' },
    { id:'l4', empresa:'Cerâmica Bela Vista', treinamento:'NR-12', vagas:8,  estagio:'negociacao', valor:10200, responsavel:'Diego Ramos',  origem:'Site',                  parado_desde:'2026-08-31', contato_id:null },
    { id:'l5', empresa:'Frigorífico Boa Vista',treinamento:'NR-33',vagas:6,  estagio:'proposta',   valor:9900,  responsavel:'Diego Ramos',  origem:'WhatsApp · Financeiro', parado_desde:'2026-08-25', contato_id:null },
    { id:'l6', empresa:'Metalúrgica Souza',   treinamento:'NR-35', vagas:12, estagio:'proposta',   valor:9600,  responsavel:'Marina Alves', origem:'WhatsApp · Comercial',  parado_desde:'2026-09-03', contato_id:'c1' },
    { id:'l7', empresa:'Log Transportes',     treinamento:'NR-11', vagas:15, estagio:'ganho',      valor:8900,  responsavel:'Diego Ramos',  origem:'Indicação',             parado_desde:null,          contato_id:null, virou_cliente:'2026-08-28' },
    { id:'l8', empresa:'Têxtil Andrade',      treinamento:'NR-12', vagas:10, estagio:'novo',       valor:7200,  responsavel:'Diego Ramos',  origem:'Site',                  parado_desde:'2026-09-01', contato_id:null },
    { id:'l9', empresa:'Transportes Lima',    treinamento:'NR-20', vagas:9,  estagio:'contato',    valor:6400,  responsavel:'Marina Alves', origem:'WhatsApp · Atendimento',parado_desde:'2026-09-02', contato_id:'c3' },
    { id:'l10',empresa:'Madeireira Pinho',    treinamento:'NR-11', vagas:7,  estagio:'contato',    valor:5200,  responsavel:'Diego Ramos',  origem:'Ligação',               parado_desde:'2026-09-01', contato_id:null },
    { id:'l11',empresa:'Marcos Cardoso',      treinamento:'NR-33', vagas:5,  estagio:'novo',       valor:4800,  responsavel:null,           origem:'WhatsApp · Comercial',  parado_desde:'2026-09-01', contato_id:'c5' },
    { id:'l12',empresa:'Auto Peças Kruger',   treinamento:'NR-12', vagas:4,  estagio:'novo',       valor:3100,  responsavel:'Marina Alves', origem:'Indicação',             parado_desde:'2026-09-02', contato_id:null }
  ],

  crm_conversas: [
    { id:'v1', contato_id:'c1', caixa_id:'cx1', nome:'Ricardo Souza',  empresa:'Metalúrgica Souza',   previa:'Pode sim, manda por aqui mesmo',              hora:'09:41', nao_lidas:2, estado:'aguardando',    responsavel:'Marina Alves', lead_id:'l6' },
    { id:'v2', contato_id:'c2', caixa_id:'cx1', nome:'Paula Andrade',  empresa:'Construtora Vale',    previa:'Perfeito, pode emitir a proposta',            hora:'09:12', nao_lidas:0, estado:'respondida',    responsavel:'Marina Alves', lead_id:'l1' },
    { id:'v3', contato_id:'c3', caixa_id:'cx2', nome:'João Batista',   empresa:'Transportes Lima',    previa:'Preciso da 2ª via do certificado',            hora:'08:55', nao_lidas:1, estado:'sem_responsavel',responsavel:null,          lead_id:null },
    { id:'v4', contato_id:null, caixa_id:'cx3', nome:'Frigorífico Boa Vista', empresa:'Frigorífico Boa Vista', previa:'O boleto de agosto venceu ontem', hora:'ontem', nao_lidas:0, estado:'na_fila',      responsavel:null,          lead_id:'l5' },
    { id:'v5', contato_id:'c4', caixa_id:'cx2', nome:'Alimentos Delta',empresa:'Alimentos Delta',     previa:'Obrigado pelo atendimento!',                  hora:'ontem', nao_lidas:0, estado:'resolvida',     responsavel:'Luana Pires', lead_id:'l3' },
    { id:'v6', contato_id:'c5', caixa_id:'cx1', nome:'Marcos Cardoso', empresa:null,                  previa:'Bom dia, gostaria de saber sobre NR-33',      hora:'seg',   nao_lidas:0, estado:'aguardando',    responsavel:null,          lead_id:'l11' }
  ],

  crm_mensagens: {
    v1: [
      { tipo:'sistema', texto:'Recebida no número <b>Comercial</b> e atribuída a Marina Alves' },
      { tipo:'recebida', texto:'Bom dia! Vocês fazem NR-35 para 12 pessoas?', hora:'09:41' },
      { tipo:'recebida', texto:'É para a nossa unidade de Joinville, precisamos ainda este mês', hora:'09:41' },
      { tipo:'enviada', autor:'Marina Alves', texto:'Bom dia, Ricardo! Fazemos sim — NR-35 com carga de 8 horas, presencial na sua unidade.', hora:'09:44' },
      { tipo:'enviada', autor:'Marina Alves', texto:'Para 12 participantes consigo agendar já para a semana do dia 15. Posso montar a proposta?', hora:'09:44' },
      { tipo:'recebida', texto:'Pode sim, manda por aqui mesmo', hora:'09:52' },
      { tipo:'sistema', texto:'Lead <b>Metalúrgica Souza · NR-35 (12 vagas)</b> criado a partir desta conversa' }
    ]
  },

  crm_atividades: [
    { id:'a1', titulo:'Ligar para Ricardo — Metalúrgica Souza', sub:'Retomar proposta de NR-35', tipo:'ligacao',  quando:'2026-09-03T09:30', responsavel:'Marina Alves', concluida:false, lead_id:'l6' },
    { id:'a2', titulo:'Enviar proposta — Construtora Vale',     sub:'12 vagas de NR-10 · R$ 18.400', tipo:'proposta', quando:'2026-09-03T11:00', responsavel:'Marina Alves', concluida:false, lead_id:'l1' },
    { id:'a3', titulo:'Responder Transportes Lima',             sub:'2ª via de certificado',     tipo:'whatsapp', quando:'2026-09-03T08:55', responsavel:'Marina Alves', concluida:true,  lead_id:null },
    { id:'a4', titulo:'Visita técnica — Alimentos Delta',       sub:'Levantamento para brigada', tipo:'visita',   quando:'2026-09-03T15:00', responsavel:'Diego Ramos',  concluida:false, lead_id:'l3' },
    { id:'a5', titulo:'Retornar ligação — Madeireira Pinho',    sub:'Lead em Contato feito',     tipo:'ligacao',  quando:'2026-09-01T10:00', responsavel:'Diego Ramos',  concluida:false, lead_id:'l10' },
    { id:'a6', titulo:'Cobrar retorno da proposta — Construtora Vale', sub:'Proposta enviada em 26/08', tipo:'proposta', quando:'2026-08-26T10:00', responsavel:'Marina Alves', concluida:false, lead_id:'l1' },
    { id:'a7', titulo:'Responder Frigorífico Boa Vista',        sub:'Conversa na caixa Financeiro', tipo:'whatsapp', quando:'2026-09-02T09:00', responsavel:null, concluida:false, lead_id:'l5' }
  ],

  /* Contexto vindo do módulo de Treinamentos — só existe quando a
     organização tem os dois módulos. */
  treinamentos_por_cliente: {
    cli1: { turmas:3, ultima:'NR-10 em 12/06', proxima:'18/09', conformidade:92 },
    cli2: { turmas:1, ultima:'NR-20 em 02/05', proxima:null,    conformidade:78 }
  }
};

export const ESTAGIOS = [
  { id:'novo',       rotulo:'Novo',            cor:'var(--navy)',        fundo:'rgba(30,42,74,.06)' },
  { id:'contato',    rotulo:'Contato feito',   cor:'rgba(30,42,74,.55)', fundo:'rgba(30,42,74,.045)' },
  { id:'proposta',   rotulo:'Proposta enviada',cor:'var(--amber)',       fundo:'rgba(245,158,11,.12)' },
  { id:'negociacao', rotulo:'Negociação',      cor:'rgba(30,42,74,.35)', fundo:'rgba(30,42,74,.045)' },
  { id:'ganho',      rotulo:'Ganho',           cor:'var(--green)',       fundo:'rgba(5,150,105,.1)' }
];

export const rotuloEstagio = (id) => (ESTAGIOS.find(e => e.id === id) || {}).rotulo || id;
