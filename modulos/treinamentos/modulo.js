/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/treinamentos/modulo.js
   Manifesto do módulo que JÁ EXISTE. Neste momento ele apenas descreve as
   telas — o código delas continua dentro do app.html e é aberto pelo
   roteador atual (`irPara`). Nada foi movido.

   Quando uma tela for extraída (etapa C do plano de organização de
   arquivos), troca-se `legado:true` por uma função `rota:() => import(...)`.
   Uma tela por vez, sem parar o sistema.
   ══════════════════════════════════════════════════════════════════════════ */

const legado = (id) => ({ legado: true, rota: async () => ({ render: async () => { window.irPara?.(id); return ''; } }) });

export default {
  id: 'treinamentos',
  nome: 'Treinamentos',
  icone: 'cap',

  itens: [
    { id:'turmas',        rotulo:'Turmas',                icone:'book',     perfis:['administrador','comercial'], mobile:true,  ...legado('turmas') },
    { id:'agendaequipe',  rotulo:'Agenda dos Instrutores',icone:'calendar', perfis:['administrador','comercial'], mobile:true,  ...legado('agendaequipe') },
    { id:'clientes',      rotulo:'Clientes',              icone:'building', perfis:['administrador','comercial'], mobile:true,  ...legado('clientes') },
    { id:'colaboradores', rotulo:'Colaboradores',         icone:'users',    perfis:['administrador','comercial'], mobile:false,
      textoDesktop:'A lista de colaboradores é usada para importar, comparar e corrigir cadastro — trabalho de mesa.', ...legado('colaboradores') },
    { id:'catalogo',      rotulo:'Catálogo',              icone:'book',     perfis:['administrador'],             mobile:false, ...legado('catalogo') },
    { id:'conformidade',  rotulo:'Conformidade',          icone:'shield',   perfis:['administrador','comercial'], mobile:false, ...legado('conformidade') },
    { id:'relatorios',    rotulo:'Relatórios',            icone:'chart',    perfis:['administrador','comercial'], mobile:false, ...legado('relatorios') }
  ]
};
