/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/crm/funis.js — configuração de funis e etapas (05/09, h17)

   A tela que faltava para o CRM deixar de ser "o funil de quem vende
   treinamento". A organizacao cria os proprios funis, nomeia e ordena as
   proprias etapas e escolhe a cor de cada uma.

   Duas regras que a tela protege:
     • O `slug` da etapa nunca muda depois de criada — e ele que os leads
       guardam. Renomear "Proposta" para "Orçamento enviado" nao move lead
       nenhum, e comparacao nenhuma quebra.
     • Etapa com lead dentro nao e removida. A mensagem diz quantos leads
       precisam sair antes — em vez de recusar sem explicar.
   ══════════════════════════════════════════════════════════════════════════ */
import * as ui from '../../nucleo/ui.js';
import { icone } from '../../nucleo/icones.js';
import * as dados from '../../nucleo/dados.js';
import { fundoDe } from '../../nucleo/estagios.js';

export async function render(params = {}) {
  if (dados.ehExemplo()) {
    return `${ui.topo({ voltar:{ rotulo:'Funil de vendas', acao:'ir:crm-funil' },
        titulo:'Configuração do funil' })}
      ${ui.vazio({ icone:'settings', titulo:'Disponível com o banco ligado',
        sub:'Em modo demonstração as etapas são fixas. Com o CRM ligado ao banco, esta tela cria funis, etapas e cores próprios da organização.' })}`;
  }

  const funis = await dados.listarFunis();
  const atualId = params.id || dados.funilCorrenteId() || funis[0]?.id;
  const funil = atualId ? await dados.funil(atualId) : null;

  return `
  ${ui.topo({
    voltar:{ rotulo:'Funil de vendas', acao:'ir:crm-funil' },
    titulo:'Configuração do funil',
    sub:'Cada funil é um processo comercial próprio — com etapas, ordem e cores da sua organização',
    acoes:[{ rotulo:'Novo funil', icone:'plus', tipo:'pri', acao:'crm:novo-funil' }]
  })}

  <div class="crm-cfg">
    <div>
      ${ui.secao('Funis', { contagem: `${funis.length}` })}
      <div class="crm-cfg-funis">
        ${funis.map(f => `
          <div class="crm-cfg-funil ${f.id === atualId ? 'ativo' : ''}" data-acao="ir:crm-funis:${f.id}">
            <div class="n">${ui.esc(f.nome)}</div>
            <div class="s">${f.padrao ? 'Padrão da organização' : (f.tipo_item ? ui.esc(f.tipo_item) : 'Funil adicional')}</div>
          </div>`).join('')}
      </div>
      ${funis.length === 1 ? `<div class="crm-cfg-dica">
        Um segundo funil serve quando o processo é outro de verdade — vender um curso e vender
        um serviço recorrente têm etapas diferentes. Enquanto o processo for o mesmo, um funil só
        é mais fácil de operar.</div>` : ''}
    </div>

    <div>
      ${funil ? `
        ${ui.secao(`Etapas de ${funil.nome}`, { contagem: `${funil.etapas.length}` })}
        ${ui.cartao(`
          <div class="crm-etapas">
            ${funil.etapas.map((e, i) => linhaEtapa(e, i, funil)).join('') ||
              ui.vazio({ icone:'funnel', titulo:'Nenhuma etapa', sub:'Crie a primeira etapa deste funil.' })}
          </div>
          <div class="crm-etapas-rod">
            <button class="ds-btn sec sm" data-acao="crm:nova-etapa:${funil.id}">${icone('plus','sm')} Nova etapa</button>
            <span class="crm-cfg-nota">A ordem das etapas é a ordem das colunas no quadro.</span>
          </div>`, { plano:true })}

        ${ui.aviso({ tipo:'info', icone:'info',
          titulo:'Renomear etapa não move nenhum lead',
          texto:'O identificador interno da etapa é fixo desde a criação. Trocar o nome muda só o que aparece na tela.' })}
      ` : ui.vazio({ icone:'funnel', titulo:'Nenhum funil configurado',
                     sub:'Crie o primeiro funil desta organização.' })}
    </div>
  </div>`;
}

function linhaEtapa(e, i, funil) {
  const tipo = { aberto:'Em aberto', ganho:'Ganho', perdido:'Perdido' }[e.tipo] || e.tipo;
  const cor = e.cor || '#1E2A4A';
  return `<div class="crm-etapa">
    <span class="crm-etapa-cor" style="background:${fundoDe(cor)};border-color:${cor}"><i style="background:${cor}"></i></span>
    <div class="crm-etapa-txt">
      <div class="n">${ui.esc(e.nome)}</div>
      <div class="s">${tipo} · identificador <code>${ui.esc(e.slug)}</code></div>
    </div>
    <div class="crm-etapa-acoes">
      <button class="ds-icobtn" title="Subir"  ${i === 0 ? 'disabled' : ''} data-acao="crm:subir-etapa:${funil.id}:${e.id}">${icone('sortup','sm')}</button>
      <button class="ds-icobtn" title="Descer" ${i === funil.etapas.length - 1 ? 'disabled' : ''} data-acao="crm:descer-etapa:${funil.id}:${e.id}">${icone('sortdown','sm')}</button>
      <button class="ds-icobtn" title="Editar" data-acao="crm:editar-etapa:${funil.id}:${e.id}">${icone('tool','sm')}</button>
      <button class="ds-icobtn" title="Remover" data-acao="crm:remover-etapa:${e.id}">${icone('close','sm')}</button>
    </div>
  </div>`;
}
