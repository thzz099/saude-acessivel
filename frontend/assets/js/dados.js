/* =============================================================
   dados.js — Dados do portal, vindos do BANCO via API

   Antes, 257 linhas de dados ficavam fixas aqui (data.js).
   Agora tudo vem de GET /api/dados e é editado pelo painel admin.
   Quando o admin salva algo, o servidor avisa pelo canal de tempo
   real (/api/tempo-real) e a página busca os dados novos sozinha.
   ============================================================= */

// Variáveis globais lidas pelo app.js (preenchidas por carregarDados)
let POSTOS = [];
let CAMPANHAS = [];
let PROFISSIONAIS = [];
let HISTORICO = [];
let CALENDARIO_VACINAL = [];
let EVENTOS_CALENDARIO = [];
let AVISOS_GERAIS = [];

async function carregarDados() {
  const [rDados, rVacinas] = await Promise.all([fetch('/api/dados'), fetch('/api/me/vacinas')]);
  if (rDados.status === 401 || rVacinas.status === 401) {
    window.location.href = '/login';
    throw new Error('Sessão expirada');
  }
  if (!rDados.ok) throw new Error('Falha ao carregar dados (' + rDados.status + ')');
  const d = await rDados.json();
  POSTOS = d.unidades;
  CAMPANHAS = d.campanhas;
  PROFISSIONAIS = d.profissionais;
  CALENDARIO_VACINAL = d.calendarioVacinal;
  EVENTOS_CALENDARIO = d.eventos;
  AVISOS_GERAIS = d.avisos;
  HISTORICO = rVacinas.ok ? (await rVacinas.json()).vacinas : [];
  return d.versao;
}

/**
 * Abre o canal de tempo real. A cada alteração feita no painel,
 * chama aoAtualizar(). O navegador reconecta sozinho se cair.
 */
function conectarTempoReal(aoAtualizar) {
  if (!('EventSource' in window)) return null;
  const canal = new EventSource('/api/tempo-real');
  let espera = null;
  canal.addEventListener('atualizado', () => {
    // agrupa várias alterações seguidas numa única recarga
    clearTimeout(espera);
    espera = setTimeout(aoAtualizar, 300);
  });
  return canal;
}

// Índice de navegação da busca (é interface, não dado — fica no frontend)
const SEARCH_INDEX = [
  { label: "Postos Próximos",              page: "postos",        icon: "fas fa-map-marked-alt" },
  { label: "Vacinação — Campanhas",        page: "vacinacao",     icon: "fas fa-syringe" },
  { label: "Calendário Vacinal",           page: "vacinacao",     icon: "fas fa-calendar-check" },
  { label: "Meu Histórico Vacinal",        page: "vacinacao",     icon: "fas fa-history" },
  { label: "Profissionais Hoje",           page: "profissionais", icon: "fas fa-user-md" },
  { label: "Calendário da Saúde",          page: "calendario",    icon: "fas fa-calendar-alt" },
  { label: "Dentista",                     page: "profissionais", icon: "fas fa-tooth" },
  { label: "Pediatra",                     page: "profissionais", icon: "fas fa-baby" },
  { label: "Cardiologista",               page: "profissionais", icon: "fas fa-heartbeat" },
  { label: "Ginecologista",               page: "profissionais", icon: "fas fa-venus" },
  { label: "UPA 24 Horas",                page: "postos",        icon: "fas fa-ambulance" },
  { label: "Vacina Dengue 2026",          page: "vacinacao",     icon: "fas fa-syringe" },
  { label: "Vacina Gripe 2026",           page: "vacinacao",     icon: "fas fa-syringe" },
  { label: "Avisos",                      page: "home",          icon: "fas fa-bullhorn" },
  { label: "Horários de Hoje",            page: "home",          icon: "fas fa-clock" },
  { label: "UBS Centro Barra do Garças",  page: "postos",        icon: "fas fa-hospital" },
  { label: "CEM — Centro Especialidades", page: "postos",        icon: "fas fa-hospital" },
  { label: "Outubro Rosa",               page: "vacinacao",     icon: "fas fa-ribbon" },
  { label: "Novembro Azul",              page: "vacinacao",     icon: "fas fa-ribbon" },
  { label: "Multivacinação Infantil",    page: "vacinacao",     icon: "fas fa-baby" },
  { label: "HPV",                        page: "vacinacao",     icon: "fas fa-syringe" },
];
