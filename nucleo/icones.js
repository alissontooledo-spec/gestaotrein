/* ══════════════════════════════════════════════════════════════════════════
   GRID · nucleo/icones.js
   Família única de ícones do produto: traço 1.75, viewBox 24, pontas
   arredondadas — os mesmos parâmetros do conjunto que já existe no app.
   REGRA DO CONTRATO: nenhum emoji em elemento de interface. Emoji só em
   conteúdo escrito por pessoas (mensagem de WhatsApp, anotação).
   Tamanhos: 16 (ação inline), 18 (menu), 22 (destaque). Não criar um quarto.
   ══════════════════════════════════════════════════════════════════════════ */

const S='stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none"';
const svg=p=>`<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
export const ICO = {
  home:svg(`<path ${S} d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path ${S} d="M9 22V12h6v10"/>`),
  calendar:svg(`<rect ${S} x="3" y="5" width="18" height="16" rx="2"/><path ${S} d="M16 3v4M8 3v4M3 11h18"/>`),
  /* bloco simples — o mesmo desenho do ICONS do app. O predio com janelas
     e o `company`, logo abaixo. */
  building:svg(`<rect ${S} x="2" y="7" width="20" height="14" rx="2"/><path ${S} d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>`),
  /* `company` e o predio com janelas; `building` e o bloco simples. Duas
     telas falam de empresa — Clientes (treinamento) e Empresas (CRM) — e
     no mesmo menu elas nao podem ter o mesmo desenho. */
  company:svg(`<path ${S} d="M3 21h18M5 21V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v16M14 9h4a1 1 0 0 1 1 1v11M8 8h3M8 12h3M8 16h3"/>`),
  users:svg(`<path ${S} d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle ${S} cx="9.5" cy="7" r="4"/><path ${S} d="M22 21v-2a4 4 0 0 0-3-3.87"/>`),
  user:svg(`<path ${S} d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle ${S} cx="12" cy="7" r="4"/>`),
  book:svg(`<path ${S} d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path ${S} d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>`),
  shield:svg(`<path ${S} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path ${S} d="m9 12 2 2 4-4"/>`),
  chart:svg(`<path ${S} d="M3 21h18"/><path ${S} d="M6 21V11M11 21V5M16 21v-7M21 21v-4"/>`),
  team:svg(`<circle ${S} cx="9" cy="7" r="3.2"/><circle ${S} cx="17" cy="9" r="2.6"/><path ${S} d="M3 20v-1.5A4.5 4.5 0 0 1 7.5 14h3A4.5 4.5 0 0 1 15 18.5V20M17.5 14A3.5 3.5 0 0 1 21 17.5V19"/>`),
  chat:svg(`<path ${S} d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.9-.9L3 20.5l1.6-4.9A8.4 8.4 0 0 1 3.6 11 8.5 8.5 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z"/>`),
  funnel:svg(`<path ${S} d="M3 4.5h18l-7 8.2V20l-4 1.5v-8.8L3 4.5z"/>`),
  activity:svg(`<path ${S} d="M3 12h4l2.5-7 5 14L17 12h4"/>`),
  phone:svg(`<path ${S} d="M22 16.9v2.1a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2 3.2 2 2 0 0 1 4 1h2.1a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L7.5 8.6a16 16 0 0 0 6 6l1-1a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>`),
  check:svg(`<path ${S} d="M20 6 9 17l-5-5"/>`),
  clock:svg(`<circle ${S} cx="12" cy="12" r="9"/><path ${S} d="M12 7v5.2l3.2 1.9"/>`),
  alert:svg(`<path ${S} d="M10.3 3.9 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path ${S} d="M12 9v4M12 17h.01"/>`),
  doc:svg(`<path ${S} d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path ${S} d="M14 2v6h6M16 13H8M16 17H8"/>`),
  cap:svg(`<path ${S} d="M22 9 12 4 2 9l10 5 10-5Z"/><path ${S} d="M6 11.5V16c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-4.5"/>`),
  plus:svg(`<path ${S} d="M12 5v14M5 12h14"/>`),
  search:svg(`<circle ${S} cx="11" cy="11" r="7"/><path ${S} d="m20 20-3.5-3.5"/>`),
  filter:svg(`<path ${S} d="M3 5h18M7 12h10M10 19h4"/>`),
  more:svg(`<circle ${S} cx="5" cy="12" r="1"/><circle ${S} cx="12" cy="12" r="1"/><circle ${S} cx="19" cy="12" r="1"/>`),
  chevronright:svg(`<path ${S} d="m9 6 6 6-6 6"/>`),
  chevrondown:svg(`<path ${S} d="m6 9 6 6 6-6"/>`),
  back:svg(`<path ${S} d="M19 12H5M12 19l-7-7 7-7"/>`),
  /* prancheta (turma, protocolo) — nao confundir com `clip`, o clipe de
     papel usado em anexo. Ver o comentario gemeo no ICONS do app.html. */
  clipboard:svg(`<path ${S} d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect ${S} x="8" y="2" width="8" height="4" rx="1"/>`),
  clip:svg(`<path ${S} d="M21.4 11.1 12.3 20a5.5 5.5 0 0 1-7.8-7.8l9.2-9.1a3.7 3.7 0 0 1 5.2 5.2l-9.2 9.1a1.8 1.8 0 0 1-2.6-2.6l8.5-8.4"/>`),
  send:svg(`<path ${S} d="M4 12 21 4l-8 17-2.5-6.5L4 12Z"/>`),
  qr:svg(`<rect ${S} x="3" y="3" width="7" height="7" rx="1"/><rect ${S} x="14" y="3" width="7" height="7" rx="1"/><rect ${S} x="3" y="14" width="7" height="7" rx="1"/><path ${S} d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20h1"/>`),
  wifioff:svg(`<path ${S} d="M2 2l20 20"/><path ${S} d="M8.6 16.6a5 5 0 0 1 6.8 0M5 13.1a10 10 0 0 1 3.6-2.3M19 13.1a10 10 0 0 0-4-2.6M1.8 9.6a15 15 0 0 1 4.4-2.8M22.2 9.6a15 15 0 0 0-9.6-3M12 20h.01"/>`),
  inbox:svg(`<path ${S} d="M22 12h-6l-2 3h-4l-2-3H2"/><path ${S} d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1Z"/>`),
  trend:svg(`<path ${S} d="M22 7 13.5 15.5l-4-4L2 19"/><path ${S} d="M16 7h6v6"/>`),
  /* espelho vertical do `trend`. Existe porque o bloco "Por que perdemos"
     usava a seta de ALTA para falar de perda. */
  trenddown:svg(`<path ${S} d="M22 17 13.5 8.5l-4 4L2 5"/><path ${S} d="M16 17h6v-6"/>`),
  link:svg(`<path ${S} d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path ${S} d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>`),
  headset:svg(`<path ${S} d="M4 14v-2a8 8 0 1 1 16 0v2"/><path ${S} d="M20 15a2 2 0 0 1-2 2h-1v-5h1a2 2 0 0 1 2 2zM4 15a2 2 0 0 0 2 2h1v-5H6a2 2 0 0 0-2 2z"/><path ${S} d="M18 17v1a3 3 0 0 1-3 3h-3"/>`),
  tool:svg(`<path ${S} d="M14.7 6.3a4 4 0 0 0 5.3 5.3l-8 8a2.8 2.8 0 0 1-4-4l8-8Z"/><path ${S} d="M6 18h.01"/>`),
  settings:svg(`<circle ${S} cx="12" cy="12" r="3"/><path ${S} d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/>`),
  close:svg(`<path ${S} d="M18 6 6 18M6 6l12 12"/>`),
  info:svg(`<circle ${S} cx="12" cy="12" r="9"/><path ${S} d="M12 16v-4M12 8h.01"/>`),
  sortdown:svg(`<path ${S} d="M12 5v14M6 13l6 6 6-6"/>`),
  sortup:svg(`<path ${S} d="M12 19V5M6 11l6-6 6 6"/>`),
  monitor:svg(`<rect ${S} x="2" y="4" width="20" height="13" rx="2"/><path ${S} d="M8 21h8M12 17v4"/>`),
  grid:svg(`<rect ${S} x="3" y="3" width="7" height="7" rx="1.5"/><rect ${S} x="14" y="3" width="7" height="7" rx="1.5"/><rect ${S} x="3" y="14" width="7" height="7" rx="1.5"/><rect ${S} x="14" y="14" width="7" height="7" rx="1.5"/>`)
};

/* Devolve o HTML de um ícone. `tam`: 'sm' (16) | '' (18) | 'lg' (22). */
export function icone(nome, tam = '') {
  const svg = ICO[nome];
  if (!svg) return '';
  return `<span class="ico ${tam}" aria-hidden="true">${svg}</span>`;
}
