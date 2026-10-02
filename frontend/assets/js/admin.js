/* =============================================================
   admin.js — Painel do administrador

   Orientado por configuração: cada entidade (unidades, campanhas...)
   declara campos e colunas em ENTIDADES, e o MESMO código gera a
   tabela, o formulário, a validação e a exclusão de todas.

   Segurança: todo dado vindo do banco passa por esc() antes de ir
   para o HTML. Os botões usam addEventListener (a CSP bloqueia
   onclick="..."). A permissão real é conferida no servidor.
   ============================================================= */
'use strict';

// ════════════════════════ UTILIDADES ════════════════════════
const $ = (sel, raiz = document) => raiz.querySelector(sel);
const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const dataBR = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—');
const dataHoraBR = (s) => {
  if (!s) return '';
  const d = new Date(String(s).replace(' ', 'T') + 'Z'); // o banco grava em UTC
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};
const hojeISO = () => {                      // data LOCAL (toISOString daria o dia seguinte após 21h no Brasil)
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

let timerToast;
function toast(msg, ms = 2800) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(timerToast);
  timerToast = setTimeout(() => t.classList.remove('show'), ms);
}

/** Chamada à API. Lança erro com .status e .detalhes (erros por campo). */
async function api(metodo, url, corpo) {
  const opcoes = { method: metodo, headers: {} };
  if (corpo !== undefined) {
    opcoes.headers['Content-Type'] = 'application/json';
    opcoes.body = JSON.stringify(corpo);
  }
  const r = await fetch(url, opcoes);
  if (r.status === 401) { window.location.href = '/login'; throw new Error('Sessão expirada.'); }
  let dados = null;
  try { dados = await r.json(); } catch { /* resposta sem corpo */ }
  if (!r.ok) {
    const e = new Error((dados && dados.erro) || `Erro ${r.status}`);
    e.status = r.status;
    e.detalhes = dados && dados.detalhes;
    throw e;
  }
  return dados;
}

// ════════════════════════ RÓTULOS ════════════════════════
const STATUS = { aberto: ['Aberto', 'verde'], fechado: ['Fechado', 'vermelho'], urgencia: ['Urgência 24h', 'laranja'] };
const CATEGORIAS = { clinico: 'Clínico Geral', pediatra: 'Pediatria', dentista: 'Odontologia', cardio: 'Cardiologia', gineco: 'Ginecologia' };
const TIPOS_EVENTO = { evento: ['Evento', 'azul'], campanha: ['Campanha', 'verde'], feriado: ['Feriado', 'laranja'] };
const TIPOS_AVISO = { info: ['Informação', 'azul'], warn: ['Atenção', 'laranja'], success: ['Positivo', 'verde'] };
const ACOES = { CRIAR: ['Criou', 'verde'], ATUALIZAR: ['Editou', 'azul'], EXCLUIR: ['Excluiu', 'vermelho'], ALTERAR_PERFIL: ['Perfil', 'laranja'] };

const selo = (par) => `<span class="selo ${par[1]}">${esc(par[0])}</span>`;
const simNao = (v) => (v ? '<span class="selo verde">Sim</span>' : '<span class="selo cinza">Não</span>');
const opcoesDe = (mapa) => Object.entries(mapa).map(([v, t]) => [v, Array.isArray(t) ? t[0] : t]);

let unidadesCache = [];
const nomeUnidade = (id) => (unidadesCache.find((u) => u.id === Number(id)) || {}).nome || '—';
async function carregarUnidades() {
  unidadesCache = await api('GET', '/api/admin/unidades');
}

// ════════════════════════ CONFIGURAÇÃO DAS ENTIDADES ════════════════════════
const ENTIDADES = {
  unidades: {
    titulo: 'Unidades de saúde', icone: 'fa-hospital', rota: '/api/admin/unidades', singular: 'unidade', feminino: true,
    exclusaoLogica: true,
    descricao: 'UBS, UPA e hospital. As coordenadas definem o ponto no mapa e o cálculo de distância até o cidadão.',
    nome: (r) => r.nome,
    colunas: [
      ['Nome', (r) => `<strong>${esc(r.nome)}</strong>${r.dados_oficiais ? ' <span class="selo azul">oficial</span>' : ''}`],
      ['Situação', (r) => selo(STATUS[r.status] || [r.status, 'cinza'])],
      ['Telefone', (r) => esc(r.telefone || '—')],
      ['Serviços', (r) => esc((r.servicos || []).length)],
    ],
    padrao: { status: 'aberto', servicos: [] },
    campos: [
      { nome: 'nome', rotulo: 'Nome', tipo: 'texto', obrig: true, max: 120, largo: true },
      { nome: 'status', rotulo: 'Situação', tipo: 'select', obrig: true, opcoes: opcoesDe(STATUS) },
      { nome: 'telefone', rotulo: 'Telefone', tipo: 'texto', max: 20, placeholder: '(66) 3401-0000' },
      { nome: 'endereco', rotulo: 'Endereço', tipo: 'texto', obrig: true, max: 200, largo: true },
      { nome: 'horario', rotulo: 'Horário de funcionamento', tipo: 'texto', obrig: true, max: 120, largo: true, placeholder: 'Seg–Sex: 7h–11h e 13h–17h' },
      { nome: 'latitude', rotulo: 'Latitude', tipo: 'numero', obrig: true, passo: 'any', placeholder: '-15.8909', ajuda: 'Google Maps: botão direito no local → o 1º número.' },
      { nome: 'longitude', rotulo: 'Longitude', tipo: 'numero', obrig: true, passo: 'any', placeholder: '-52.2572', ajuda: 'O 2º número.' },
      { nome: 'servicos', rotulo: 'Serviços oferecidos', tipo: 'tags', largo: true, placeholder: 'Clínico Geral, Vacinação, Pré-natal', ajuda: 'Separe por vírgula.' },
      { nome: 'observacao', rotulo: 'Observação', tipo: 'textarea', max: 300, largo: true },
      { nome: 'destacar_observacao', rotulo: 'Destacar a observação no card (aviso laranja)', tipo: 'check', largo: true },
      { nome: 'dados_oficiais', rotulo: 'Dados confirmados pela Secretaria de Saúde', tipo: 'check', largo: true },
    ],
  },

  profissionais: {
    titulo: 'Profissionais', icone: 'fa-user-md', rota: '/api/admin/profissionais', singular: 'profissional',
    exclusaoLogica: true, precisaUnidades: true,
    descricao: 'Equipe exibida na aba Profissionais e no quadro "Horários de Hoje". A categoria liga o profissional ao filtro e à IA de triagem.',
    nome: (r) => r.nome,
    colunas: [
      ['Nome', (r) => `<strong>${esc(r.nome)}</strong>${r.dados_oficiais ? ' <span class="selo azul">oficial</span>' : ''}`],
      ['Especialidade', (r) => esc(r.especialidade)],
      ['Unidade', (r) => esc(nomeUnidade(r.unidade_id))],
      ['Disponível', (r) => simNao(r.disponivel)],
    ],
    padrao: { categoria: 'clinico', disponivel: true },
    campos: [
      { nome: 'nome', rotulo: 'Nome', tipo: 'texto', obrig: true, max: 120, largo: true, placeholder: 'Dra. Maria da Silva' },
      { nome: 'especialidade', rotulo: 'Especialidade (como aparece no site)', tipo: 'texto', obrig: true, max: 60, placeholder: 'Clínico Geral' },
      { nome: 'categoria', rotulo: 'Categoria', tipo: 'select', obrig: true, opcoes: opcoesDe(CATEGORIAS), ajuda: 'Usada pelo filtro e pela IA de triagem.' },
      { nome: 'horario', rotulo: 'Horário de atendimento', tipo: 'texto', obrig: true, max: 120, largo: true, placeholder: 'Seg–Sex: 7h–11h / 13h–17h' },
      { nome: 'unidade_id', rotulo: 'Unidade onde atende', tipo: 'unidade', largo: true },
      { nome: 'disponivel', rotulo: 'Disponível (aparece em "Horários de Hoje")', tipo: 'check', largo: true },
      { nome: 'dados_oficiais', rotulo: 'Dados confirmados pela Secretaria de Saúde', tipo: 'check', largo: true },
    ],
  },

  campanhas: {
    titulo: 'Campanhas de vacinação', icone: 'fa-syringe', rota: '/api/admin/campanhas', singular: 'campanha', feminino: true,
    exclusaoLogica: true, precisaUnidades: true,
    descricao: 'A situação (ativa, em breve, encerrada) é calculada sozinha pela data. Campanhas vigentes aparecem nos avisos da página inicial.',
    nome: (r) => r.nome,
    colunas: [
      ['Campanha', (r) => `${esc(r.icone)} <strong>${esc(r.nome)}</strong>`],
      ['Período', (r) => (r.permanente ? '<span class="selo azul">Permanente</span>' : `${dataBR(r.data_inicio)} → ${dataBR(r.data_fim)}`)],
      ['Unidades', (r) => (r.todas_unidades ? 'Todas' : esc((r.unidade_ids || []).length))],
    ],
    padrao: { icone: '💉', cor: '#0dbdad', cor_fundo: '#e0f7f5', unidade_ids: [] },
    campos: [
      { nome: 'nome', rotulo: 'Nome', tipo: 'texto', obrig: true, max: 120, largo: true },
      { nome: 'descricao', rotulo: 'Descrição (público-alvo, doses...)', tipo: 'textarea', obrig: true, max: 600, largo: true },
      { nome: 'icone', rotulo: 'Ícone (emoji)', tipo: 'texto', max: 4, placeholder: '💉' },
      { nome: 'cor', rotulo: 'Cor', tipo: 'cor' },
      { nome: 'cor_fundo', rotulo: 'Cor de fundo do cartão', tipo: 'cor' },
      { nome: 'permanente', rotulo: 'Campanha permanente (sem data de término)', tipo: 'check', largo: true },
      { nome: 'data_inicio', rotulo: 'Início', tipo: 'data' },
      { nome: 'data_fim', rotulo: 'Fim', tipo: 'data' },
      { nome: 'todas_unidades', rotulo: 'Disponível em todas as unidades', tipo: 'check', largo: true },
      { nome: 'unidade_ids', rotulo: 'Unidades participantes', tipo: 'unidades', largo: true },
    ],
  },

  eventos: {
    titulo: 'Calendário da saúde', icone: 'fa-calendar-alt', rota: '/api/admin/eventos', singular: 'evento',
    exclusaoLogica: false,
    descricao: 'Eventos, campanhas e feriados exibidos no calendário do portal.',
    nome: (r) => r.titulo,
    colunas: [
      ['Data', (r) => dataBR(r.data)],
      ['Título', (r) => `<strong>${esc(r.titulo)}</strong>`],
      ['Tipo', (r) => selo(TIPOS_EVENTO[r.tipo] || [r.tipo, 'cinza'])],
    ],
    padrao: { tipo: 'evento' },
    campos: [
      { nome: 'data', rotulo: 'Data', tipo: 'data', obrig: true },
      { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', obrig: true, opcoes: opcoesDe(TIPOS_EVENTO) },
      { nome: 'titulo', rotulo: 'Título', tipo: 'texto', obrig: true, max: 120, largo: true },
      { nome: 'descricao', rotulo: 'Descrição', tipo: 'textarea', max: 500, largo: true },
    ],
  },

  calendario_vacinal: {
    titulo: 'Calendário vacinal', icone: 'fa-calendar-check', rota: '/api/admin/calendario-vacinal', singular: 'item',
    exclusaoLogica: false,
    descricao: 'Vacinas recomendadas por faixa etária (aba Vacinação → Calendário Vacinal). A "ordem" define a sequência na tela.',
    nome: (r) => `${r.faixa} — ${r.vacina}`,
    colunas: [
      ['Ordem', (r) => esc(r.ordem)],
      ['Faixa etária', (r) => `<strong>${esc(r.faixa)}</strong>`],
      ['Vacina', (r) => `<div class="texto-curto">${esc(r.vacina)}</div>`],
      ['Doses', (r) => esc(r.doses)],
    ],
    padrao: { ordem: 0 },
    campos: [
      { nome: 'faixa', rotulo: 'Faixa etária', tipo: 'texto', obrig: true, max: 60, placeholder: 'Ao nascer' },
      { nome: 'ordem', rotulo: 'Ordem', tipo: 'numero', passo: '1' },
      { nome: 'vacina', rotulo: 'Vacina(s)', tipo: 'texto', obrig: true, max: 200, largo: true },
      { nome: 'doses', rotulo: 'Doses', tipo: 'texto', obrig: true, max: 80, largo: true },
      { nome: 'observacao', rotulo: 'Observação', tipo: 'textarea', max: 200, largo: true },
    ],
  },

  avisos: {
    titulo: 'Avisos da página inicial', icone: 'fa-bullhorn', rota: '/api/admin/avisos', singular: 'aviso',
    exclusaoLogica: false,
    descricao: 'Avisos fixos. (As campanhas vigentes já aparecem sozinhas como aviso, não precisa cadastrar aqui.)',
    nome: (r) => r.texto.slice(0, 40),
    colunas: [
      ['Tipo', (r) => selo(TIPOS_AVISO[r.tipo] || [r.tipo, 'cinza'])],
      ['Texto', (r) => `<div class="texto-curto">${esc(r.texto)}</div>`],
      ['Ativo', (r) => simNao(r.ativo)],
    ],
    padrao: { tipo: 'info', ativo: true, ordem: 0 },
    campos: [
      { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', obrig: true, opcoes: opcoesDe(TIPOS_AVISO) },
      { nome: 'ordem', rotulo: 'Ordem', tipo: 'numero', passo: '1' },
      { nome: 'texto', rotulo: 'Texto', tipo: 'textarea', obrig: true, max: 300, largo: true },
      { nome: 'ativo', rotulo: 'Ativo (aparece no site)', tipo: 'check', largo: true },
    ],
  },
};

const MENU = [
  ['visao', 'Visão geral', 'fa-chart-pie'],
  ...Object.entries(ENTIDADES).map(([k, e]) => [k, e.titulo, e.icone]),
  ['usuarios', 'Usuários e vacinas', 'fa-users'],
];

// ════════════════════════ JANELA (MODAL) ════════════════════════
function abrirModal(titulo, html) {
  $('#modalTitulo').textContent = titulo;
  $('#modalCorpo').innerHTML = html;
  $('#modalFundo').hidden = false;
  const primeiro = $('#modalCorpo').querySelector('input:not([type=hidden]):not([disabled]), select, textarea');
  if (primeiro) primeiro.focus();
}
function fecharModal() {
  $('#modalFundo').hidden = true;
  $('#modalCorpo').innerHTML = '';
}

// ════════════════════════ FORMULÁRIO ════════════════════════
function htmlCampo(c, valor) {
  const id = `f_${c.nome}`;
  const classes = `form-campo${c.largo ? ' largo' : ''}${c.tipo === 'check' ? ' form-check' : ''}`;
  const rotulo = `<label for="${id}">${esc(c.rotulo)}${c.obrig ? ' <span class="obrig">*</span>' : ''}</label>`;
  const ajuda = c.ajuda ? `<span class="ajuda">${esc(c.ajuda)}</span>` : '';
  const erro = `<span class="erro-campo" data-erro="${c.nome}"></span>`;
  const max = c.max ? ` maxlength="${c.max}"` : '';
  const ph = c.placeholder ? ` placeholder="${esc(c.placeholder)}"` : '';
  const req = c.obrig ? ' required' : '';
  let entrada;

  switch (c.tipo) {
    case 'textarea':
      entrada = `<textarea id="${id}" name="${c.nome}"${max}${ph}${req}>${esc(valor)}</textarea>`; break;
    case 'numero':
      entrada = `<input type="number" id="${id}" name="${c.nome}" step="${c.passo || '1'}" value="${esc(valor)}"${ph}${req}>`; break;
    case 'data':
      entrada = `<input type="date" id="${id}" name="${c.nome}" value="${esc(valor || '')}"${req}>`; break;
    case 'cor':
      entrada = `<input type="color" id="${id}" name="${c.nome}" value="${esc(valor || '#0dbdad')}">`; break;
    case 'tags':
      entrada = `<input type="text" id="${id}" name="${c.nome}" value="${esc((valor || []).join(', '))}"${ph}>`; break;
    case 'select':
      entrada = `<select id="${id}" name="${c.nome}"${req}>${c.opcoes.map(([v, t]) =>
        `<option value="${esc(v)}"${String(valor) === v ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`; break;
    case 'unidade':
      entrada = `<select id="${id}" name="${c.nome}"><option value="">— A definir —</option>${unidadesCache.map((u) =>
        `<option value="${u.id}"${Number(valor) === u.id ? ' selected' : ''}>${esc(u.nome)}</option>`).join('')}</select>`; break;
    case 'unidades': {
      const marcadas = (valor || []).map(Number);
      entrada = `<div class="lista-checks" id="${id}">${unidadesCache.map((u) =>
        `<label><input type="checkbox" data-grupo="${c.nome}" value="${u.id}"${marcadas.includes(u.id) ? ' checked' : ''}> ${esc(u.nome)}</label>`
      ).join('') || '<span class="ajuda">Cadastre unidades primeiro.</span>'}</div>`;
      return `<div class="${classes}"><label>${esc(c.rotulo)}</label>${entrada}${erro}</div>`;
    }
    case 'check':
      return `<div class="${classes}"><input type="checkbox" id="${id}" name="${c.nome}"${valor ? ' checked' : ''}>${rotulo}${erro}</div>`;
    default:
      entrada = `<input type="text" id="${id}" name="${c.nome}" value="${esc(valor)}"${max}${ph}${req}>`;
  }
  return `<div class="${classes}">${rotulo}${entrada}${ajuda}${erro}</div>`;
}

function coletar(ent, form) {
  const dados = {};
  for (const c of ent.campos) {
    const el = form.querySelector(`#f_${c.nome}`);
    if (c.tipo === 'check') dados[c.nome] = el.checked;
    else if (c.tipo === 'unidades') dados[c.nome] = [...form.querySelectorAll(`input[data-grupo="${c.nome}"]:checked`)].map((i) => Number(i.value));
    else if (c.tipo === 'unidade') dados[c.nome] = el.value ? Number(el.value) : null;
    else dados[c.nome] = el.value;
  }
  return dados;
}

function mostrarErros(form, erro) {
  form.querySelectorAll('.erro-campo').forEach((s) => { s.textContent = ''; });
  form.querySelectorAll('.com-erro').forEach((d) => d.classList.remove('com-erro'));
  const geral = form.querySelector('.form-erro-geral');
  geral.hidden = false;
  geral.textContent = erro.message;
  for (const [campo, msg] of Object.entries(erro.detalhes || {})) {
    const span = form.querySelector(`[data-erro="${campo}"]`);
    if (span) {
      span.textContent = msg;
      span.parentElement.classList.add('com-erro');
    }
  }
}

/** Comportamentos dinâmicos de campos (ex.: permanente desativa as datas). */
function ligarComportamentos(chave, form) {
  if (chave !== 'campanhas') return;
  const perm = form.querySelector('#f_permanente');
  const todas = form.querySelector('#f_todas_unidades');
  const atualizar = () => {
    form.querySelector('#f_data_inicio').disabled = perm.checked;
    form.querySelector('#f_data_fim').disabled = perm.checked;
    form.querySelector('#f_unidade_ids').classList.toggle('desativada', todas.checked);
  };
  perm.addEventListener('change', atualizar);
  todas.addEventListener('change', atualizar);
  atualizar();
}

function abrirFormulario(chave, registro) {
  const ent = ENTIDADES[chave];
  const base = registro || ent.padrao || {};
  abrirModal(registro ? `Editar ${ent.singular}` : `Nov${ent.feminino ? 'a' : 'o'} ${ent.singular}`, `
    <form id="formEntidade" novalidate>
      <div class="form-erro-geral" hidden></div>
      <div class="form-grade">${ent.campos.map((c) => htmlCampo(c, base[c.nome])).join('')}</div>
      <div class="form-rodape">
        <button type="button" class="btn-admin secundario" data-fechar>Cancelar</button>
        <button type="submit" class="btn-admin primario"><i class="fas fa-check"></i> Salvar</button>
      </div>
    </form>`);
  const form = $('#formEntidade');
  ligarComportamentos(chave, form);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const botao = form.querySelector('[type=submit]');
    botao.disabled = true;
    try {
      const dados = coletar(ent, form);
      if (registro) await api('PUT', `${ent.rota}/${registro.id}`, dados);
      else await api('POST', ent.rota, dados);
      fecharModal();
      toast('✅ Salvo! O site já foi atualizado.');
      await recarregarLista();
    } catch (erro) {
      mostrarErros(form, erro);
      botao.disabled = false;
    }
  });
}

function confirmarExclusao(chave, registro) {
  const ent = ENTIDADES[chave];
  abrirModal('Confirmar exclusão', `
    <div class="confirmar-exclusao">
      <p>Excluir <strong>${esc(ent.nome(registro))}</strong>?</p>
      <p>${ent.exclusaoLogica
        ? 'O registro sai do site imediatamente, mas continua guardado no banco e na auditoria.'
        : '<strong>Esta ação não pode ser desfeita.</strong> Fica registrada na auditoria.'}</p>
      <p>Para confirmar, digite <strong>EXCLUIR</strong>:</p>
      <input type="text" id="textoConfirmacao" autocomplete="off">
      <div class="form-rodape">
        <button type="button" class="btn-admin secundario" data-fechar>Cancelar</button>
        <button type="button" class="btn-admin perigo" id="btnConfirmarExclusao" disabled><i class="fas fa-trash"></i> Excluir</button>
      </div>
    </div>`);
  const btn = $('#btnConfirmarExclusao');
  $('#textoConfirmacao').addEventListener('input', (e) => {
    btn.disabled = e.target.value.trim().toUpperCase() !== 'EXCLUIR';
  });
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      await api('DELETE', `${ent.rota}/${registro.id}`);
      fecharModal();
      toast('🗑️ Excluído. O site já foi atualizado.');
      await recarregarLista();
    } catch (erro) {
      toast(`❌ ${erro.message}`, 4000);
      btn.disabled = false;
    }
  });
}

// ════════════════════════ LISTAGEM DE ENTIDADES ════════════════════════
const estado = { aba: null, linhas: [], filtro: '' };

function cabecalhoSecao(titulo, icone, descricao, acoes = '') {
  return `<div class="secao-topo">
    <div><h1><i class="fas ${icone}"></i> ${esc(titulo)}</h1><p>${esc(descricao)}</p></div>
    <div class="secao-acoes">${acoes}</div>
  </div>`;
}

function desenharLinhas() {
  const ent = ENTIDADES[estado.aba];
  const corpo = $('#corpoTabela');
  if (!ent || !corpo) return;
  const f = estado.filtro.toLowerCase();
  const linhas = f ? estado.linhas.filter((r) => JSON.stringify(r).toLowerCase().includes(f)) : estado.linhas;
  corpo.innerHTML = linhas.length
    ? linhas.map((r) => `<tr>
        ${ent.colunas.map(([, fmt]) => `<td>${fmt(r)}</td>`).join('')}
        <td class="col-acoes">
          <button class="btn-icone" data-editar="${r.id}" title="Editar" aria-label="Editar"><i class="fas fa-pen"></i></button>
          <button class="btn-icone perigo" data-excluir="${r.id}" title="Excluir" aria-label="Excluir"><i class="fas fa-trash"></i></button>
        </td></tr>`).join('')
    : `<tr><td class="vazio" colspan="${ent.colunas.length + 1}">${f ? 'Nada encontrado para essa busca.' : 'Nenhum registro ainda. Clique em "Novo" para cadastrar.'}</td></tr>`;
}

async function recarregarLista() {
  const ent = ENTIDADES[estado.aba];
  if (!ent) return;
  if (ent.precisaUnidades) await carregarUnidades();
  estado.linhas = await api('GET', ent.rota);
  desenharLinhas();
}

async function abrirEntidade(chave) {
  const ent = ENTIDADES[chave];
  estado.filtro = '';
  $('#conteudo').innerHTML = cabecalhoSecao(ent.titulo, ent.icone, ent.descricao, `
      <input type="search" class="campo-busca" id="campoBusca" placeholder="Buscar..." aria-label="Buscar">
      <button class="btn-admin primario" id="btnNovo"><i class="fas fa-plus"></i> Novo</button>`) + `
    <div class="tabela-wrap"><table class="tabela">
      <thead><tr>${ent.colunas.map(([t]) => `<th>${esc(t)}</th>`).join('')}<th class="col-acoes">Ações</th></tr></thead>
      <tbody id="corpoTabela"><tr><td class="vazio" colspan="${ent.colunas.length + 1}">Carregando...</td></tr></tbody>
    </table></div>`;

  $('#btnNovo').addEventListener('click', () => abrirFormulario(chave, null));
  $('#campoBusca').addEventListener('input', (e) => { estado.filtro = e.target.value; desenharLinhas(); });
  $('#corpoTabela').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const id = Number(b.dataset.editar || b.dataset.excluir);
    const registro = estado.linhas.find((r) => r.id === id);
    if (!registro) return;
    if (b.dataset.editar) abrirFormulario(chave, registro);
    else confirmarExclusao(chave, registro);
  });
  await recarregarLista();
}

// ════════════════════════ VISÃO GERAL ════════════════════════
async function abrirVisaoGeral() {
  $('#conteudo').innerHTML = cabecalhoSecao('Visão geral', 'fa-chart-pie',
    'Resumo do sistema e últimas alterações feitas no painel.') + '<p>Carregando...</p>';
  const [r, aud] = await Promise.all([api('GET', '/api/admin/resumo'), api('GET', '/api/admin/auditoria?limite=30')]);
  const cartoes = [
    ['fa-hospital', r.unidades, 'Unidades de saúde'],
    ['fa-user-md', r.profissionais, 'Profissionais'],
    ['fa-syringe', r.campanhas, 'Campanhas'],
    ['fa-calendar-alt', r.eventos, 'Eventos no calendário'],
    ['fa-users', r.usuarios, 'Usuários cadastrados'],
    ['fa-user-shield', r.administradores, 'Administradores'],
    ['fa-notes-medical', r.vacinasRegistradas, 'Vacinas registradas'],
    ['fa-signal', r.conectadosAgora, 'Páginas abertas agora'],
  ];
  $('#conteudo').innerHTML = cabecalhoSecao('Visão geral', 'fa-chart-pie',
    'Resumo do sistema e últimas alterações feitas no painel.') + `
    <div class="cartoes">${cartoes.map(([i, n, t]) =>
      `<div class="cartao"><i class="fas ${i}"></i><div class="numero">${esc(n)}</div><div class="rotulo">${esc(t)}</div></div>`).join('')}
    </div>
    <h2 class="subtitulo"><i class="fas fa-clipboard-list"></i> Auditoria — últimas alterações</h2>
    <div class="tabela-wrap"><table class="tabela">
      <thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>O que mudou</th></tr></thead>
      <tbody>${aud.length ? aud.map((a) => `<tr>
        <td style="white-space:nowrap">${esc(dataHoraBR(a.instante))}</td>
        <td>${esc(a.usuario_nome || 'sistema')}</td>
        <td>${selo(ACOES[a.acao] || [a.acao, 'cinza'])}</td>
        <td>${esc(a.resumo)}</td></tr>`).join('')
        : '<tr><td class="vazio" colspan="4">Nenhuma alteração registrada ainda.</td></tr>'}</tbody>
    </table></div>`;
}

// ════════════════════════ USUÁRIOS E VACINAS ════════════════════════
let usuariosLista = [];

async function buscarEDesenharUsuarios(termo) {
  usuariosLista = await api('GET', `/api/admin/usuarios?busca=${encodeURIComponent(termo || '')}`);
  $('#corpoUsuarios').innerHTML = usuariosLista.length ? usuariosLista.map((u) => `<tr>
      <td><strong>${esc(u.nome)}</strong></td>
      <td>${esc(u.email)}</td>
      <td>${u.perfil === 'ADMIN' ? '<span class="selo laranja">Administrador</span>' : '<span class="selo cinza">Cidadão</span>'}</td>
      <td>${esc(dataBR(u.criado_em))}</td>
      <td class="col-acoes">
        <button class="btn-admin secundario" data-vacinas="${u.id}"><i class="fas fa-notes-medical"></i> Vacinas</button>
        <button class="btn-icone" data-perfil="${u.id}" title="${u.perfil === 'ADMIN' ? 'Remover administrador' : 'Tornar administrador'}">
          <i class="fas ${u.perfil === 'ADMIN' ? 'fa-user-minus' : 'fa-user-shield'}"></i></button>
      </td></tr>`).join('')
    : '<tr><td class="vazio" colspan="5">Nenhum usuário encontrado.</td></tr>';
}

async function abrirUsuarios() {
  $('#conteudo').innerHTML = cabecalhoSecao('Usuários e vacinas', 'fa-users',
    'Registre as vacinas aplicadas em cada cidadão (aparecem na aba "Meu Histórico" dele) e gerencie administradores.',
    '<input type="search" class="campo-busca" id="buscaUsuario" placeholder="Buscar por nome ou email..." aria-label="Buscar usuário">') + `
    <div class="tabela-wrap"><table class="tabela">
      <thead><tr><th>Nome</th><th>Email</th><th>Perfil</th><th>Cadastro</th><th class="col-acoes">Ações</th></tr></thead>
      <tbody id="corpoUsuarios"><tr><td class="vazio" colspan="5">Carregando...</td></tr></tbody>
    </table></div>`;

  let espera;
  $('#buscaUsuario').addEventListener('input', (e) => {
    clearTimeout(espera);
    espera = setTimeout(() => buscarEDesenharUsuarios(e.target.value), 300);
  });
  $('#corpoUsuarios').addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const u = usuariosLista.find((x) => x.id === Number(b.dataset.vacinas || b.dataset.perfil));
    if (!u) return;
    if (b.dataset.vacinas) return abrirVacinas(u);
    const novo = u.perfil === 'ADMIN' ? 'CIDADAO' : 'ADMIN';
    const msg = novo === 'ADMIN'
      ? `Tornar ${u.nome} administrador? Ele poderá alterar todo o conteúdo do site.`
      : `Remover o acesso de administrador de ${u.nome}?`;
    if (!window.confirm(msg)) return;
    try {
      await api('PATCH', `/api/admin/usuarios/${u.id}/perfil`, { perfil: novo });
      toast('✅ Perfil atualizado.');
      buscarEDesenharUsuarios($('#buscaUsuario').value);
    } catch (erro) {
      toast(`❌ ${erro.message}${erro.detalhes && erro.detalhes.perfil ? ' ' + erro.detalhes.perfil : ''}`, 5000);
    }
  });
  await buscarEDesenharUsuarios('');
}

async function abrirVacinas(usuario) {
  abrirModal(`Histórico vacinal — ${usuario.nome}`, `
    <div class="tabela-wrap" style="box-shadow:none;border:1px solid var(--border);margin-bottom:18px">
      <table class="tabela"><thead><tr><th>Data</th><th>Vacina</th><th>Dose</th><th>Local</th><th></th></tr></thead>
      <tbody id="corpoVacinas"><tr><td class="vazio" colspan="5">Carregando...</td></tr></tbody></table>
    </div>
    <form id="formVacina" novalidate>
      <h3 class="subtitulo" style="margin-top:0">Registrar vacina aplicada</h3>
      <div class="form-erro-geral" hidden></div>
      <div class="form-grade">
        ${htmlCampo({ nome: 'vacina', rotulo: 'Vacina', tipo: 'texto', obrig: true, max: 80, placeholder: 'Influenza 2026' }, '')}
        ${htmlCampo({ nome: 'data', rotulo: 'Data da aplicação', tipo: 'data', obrig: true }, hojeISO())}
        ${htmlCampo({ nome: 'dose', rotulo: 'Dose', tipo: 'texto', obrig: true, max: 40, placeholder: '1ª dose' }, '')}
        ${htmlCampo({ nome: 'local', rotulo: 'Local', tipo: 'texto', obrig: true, max: 120, placeholder: 'UBS Centro' }, '')}
      </div>
      <div class="form-rodape"><button type="submit" class="btn-admin primario"><i class="fas fa-plus"></i> Registrar</button></div>
    </form>`);

  const desenhar = async () => {
    const lista = await api('GET', `/api/admin/usuarios/${usuario.id}/vacinas`);
    $('#corpoVacinas').innerHTML = lista.length ? lista.map((v) => `<tr>
        <td>${esc(dataBR(v.data))}</td><td>${esc(v.vacina)}</td><td>${esc(v.dose)}</td><td>${esc(v.local)}</td>
        <td class="col-acoes"><button class="btn-icone perigo" data-remover="${v.id}" title="Remover" aria-label="Remover"><i class="fas fa-trash"></i></button></td>
      </tr>`).join('') : '<tr><td class="vazio" colspan="5">Nenhuma vacina registrada.</td></tr>';
  };
  $('#f_data').max = hojeISO();
  $('#corpoVacinas').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-remover]');
    if (!b || !window.confirm('Remover este registro de vacina?')) return;
    try {
      await api('DELETE', `/api/admin/usuarios/${usuario.id}/vacinas/${b.dataset.remover}`);
      toast('Registro removido.');
      await desenhar();
    } catch (erro) { toast(`❌ ${erro.message}`, 4000); }
  });
  const form = $('#formVacina');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dados = Object.fromEntries(['vacina', 'data', 'dose', 'local'].map((k) => [k, form.querySelector(`#f_${k}`).value]));
    try {
      await api('POST', `/api/admin/usuarios/${usuario.id}/vacinas`, dados);
      toast(`✅ Vacina registrada. Já aparece no histórico de ${usuario.nome.split(' ')[0]}.`);
      form.reset();
      $('#f_data').value = hojeISO();
      form.querySelector('.form-erro-geral').hidden = true;
      await desenhar();
    } catch (erro) { mostrarErros(form, erro); }
  });
  await desenhar();
}

// ════════════════════════ NAVEGAÇÃO ════════════════════════
async function abrirAba(chave) {
  if (!MENU.some(([k]) => k === chave)) chave = 'visao';
  estado.aba = chave;
  document.querySelectorAll('#adminMenu button').forEach((b) => b.classList.toggle('ativo', b.dataset.aba === chave));
  if (window.location.hash !== `#${chave}`) window.history.replaceState(null, '', `#${chave}`);
  try {
    if (chave === 'visao') await abrirVisaoGeral();
    else if (chave === 'usuarios') await abrirUsuarios();
    else await abrirEntidade(chave);
  } catch (erro) {
    $('#conteudo').innerHTML = `<div class="form-erro-geral">Não foi possível carregar: ${esc(erro.message)}</div>`;
  }
}

// ════════════════════════ TEMPO REAL ════════════════════════
function conectarTempoReal() {
  if (!('EventSource' in window)) return;
  const ind = $('#indicadorTempoReal');
  const canal = new EventSource('/api/tempo-real');
  canal.onopen = () => { ind.className = 'indicador-tempo-real on'; ind.querySelector('.texto').textContent = 'Tempo real ativo'; };
  canal.onerror = () => { ind.className = 'indicador-tempo-real off'; ind.querySelector('.texto').textContent = 'Reconectando...'; };
  let espera;
  canal.addEventListener('atualizado', (ev) => {
    let entidade = '';
    try { entidade = JSON.parse(ev.data).entidade; } catch { /* ignora */ }
    // atualiza a tela atual se ela mostra o que mudou (ex.: outro admin editando)
    const afeta = estado.aba === entidade || estado.aba === 'visao' ||
      (entidade === 'unidades' && ['profissionais', 'campanhas'].includes(estado.aba));
    if (!afeta || !$('#modalFundo').hidden) return;
    clearTimeout(espera);
    espera = setTimeout(() => (estado.aba === 'visao' ? abrirVisaoGeral() : recarregarLista()).catch(() => {}), 400);
  });
}

// ════════════════════════ INÍCIO ════════════════════════
(async function iniciar() {
  try {
    const { usuario } = await api('GET', '/api/me');
    if (usuario.perfil !== 'ADMIN') { window.location.href = '/'; return; }
    $('#adminNome').textContent = usuario.nome.split(' ')[0];
  } catch { return; }

  $('#adminMenu').innerHTML = MENU.map(([k, t, i]) =>
    `<button type="button" data-aba="${k}"><i class="fas ${i}"></i> ${esc(t)}</button>`).join('');
  $('#adminMenu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-aba]');
    if (b) abrirAba(b.dataset.aba);
  });

  // fechar janela: botão ×, "Cancelar", clique fora ou tecla Esc
  $('#modalFechar').addEventListener('click', fecharModal);
  $('#modalFundo').addEventListener('click', (e) => {
    if (e.target.id === 'modalFundo' || e.target.closest('[data-fechar]')) fecharModal();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#modalFundo').hidden) fecharModal(); });

  $('#btnSair').addEventListener('click', async (e) => {
    e.preventDefault();
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login';
  });

  conectarTempoReal();
  await abrirAba(window.location.hash.slice(1) || 'visao');
}());
