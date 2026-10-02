/* =============================================================
   services/entidades.js — Catálogo das entidades administráveis

   Cada entidade é declarada UMA vez: tabela, campos com regras,
   ordenação, tipo de exclusão e relacionamentos. O repositório
   genérico (repositorio.js) e as rotas do painel usam esta
   declaração — adicionar um campo novo é mexer só aqui (e no SQL).

   Segurança: nomes de tabela e coluna vêm SEMPRE daqui (código),
   nunca do usuário. Valores sempre vão por parâmetro (?).  [13]
   ============================================================= */
const { ErroValidacao } = require('../utils/validacao');

// Limites geográficos de Barra do Garças / Aragarças (evita coordenada digitada errada)
const LAT = { min: -16.5, max: -15.3 };
const LNG = { min: -53.0, max: -51.7 };

const ENTIDADES = {
  // ───────────────────────────── UNIDADES ─────────────────────────────
  unidades: {
    tabela: 'unidades',
    rotulo: 'Unidade',
    exclusaoLogica: true,
    ordem: 'nome',
    nomeExibicao: (r) => r.nome,
    campos: {
      nome:                { tipo: 'texto', obrigatorio: true, min: 3, max: 120 },
      status:              { tipo: 'enum', obrigatorio: true, valores: ['aberto', 'fechado', 'urgencia'] },
      endereco:            { tipo: 'texto', obrigatorio: true, min: 5, max: 200 },
      telefone:            { tipo: 'telefone' },
      horario:             { tipo: 'texto', obrigatorio: true, min: 3, max: 120 },
      latitude:            { tipo: 'numero', obrigatorio: true, ...LAT },
      longitude:           { tipo: 'numero', obrigatorio: true, ...LNG },
      observacao:          { tipo: 'texto', max: 300 },
      destacar_observacao: { tipo: 'booleano' },
      dados_oficiais:      { tipo: 'booleano' },
    },
    extras: {
      servicos: { tipo: 'lista', maxItens: 15, itemMax: 60 },
    },
    // Serviços ficam numa tabela própria (N:N)
    async carregarExtras(conn, linhas) {
      if (!linhas.length) return;
      const r = await conn.execute(
        'SELECT us.unidade_id AS uid, s.nome AS nome FROM unidade_servicos us ' +
        'JOIN servicos s ON s.id = us.servico_id ORDER BY s.nome');
      const mapa = {};
      for (const x of r.rows) (mapa[x.uid] = mapa[x.uid] || []).push(x.nome);
      for (const l of linhas) l.servicos = mapa[l.id] || [];
    },
    async salvarExtras(tx, id, extras) {
      await tx.execute({ sql: 'DELETE FROM unidade_servicos WHERE unidade_id = ?', args: [id] });
      for (const nome of extras.servicos) {
        await tx.execute({ sql: 'INSERT OR IGNORE INTO servicos (nome) VALUES (?)', args: [nome] });
        await tx.execute({
          sql: 'INSERT OR IGNORE INTO unidade_servicos (unidade_id, servico_id) SELECT ?, id FROM servicos WHERE nome = ?',
          args: [id, nome],
        });
      }
    },
  },

  // ─────────────────────────── PROFISSIONAIS ──────────────────────────
  profissionais: {
    tabela: 'profissionais',
    rotulo: 'Profissional',
    exclusaoLogica: true,
    ordem: 'nome',
    nomeExibicao: (r) => r.nome,
    campos: {
      nome:           { tipo: 'texto', obrigatorio: true, min: 3, max: 120 },
      especialidade:  { tipo: 'texto', obrigatorio: true, min: 3, max: 60 },
      categoria:      { tipo: 'enum', obrigatorio: true, valores: ['clinico', 'pediatra', 'dentista', 'cardio', 'gineco'] },
      horario:        { tipo: 'texto', obrigatorio: true, min: 3, max: 120 },
      unidade_id:     { tipo: 'id' },
      disponivel:     { tipo: 'booleano' },
      dados_oficiais: { tipo: 'booleano' },
    },
    async validarRelacoes(conn, dados) {
      if (dados.unidade_id == null) return;
      const r = await conn.execute({
        sql: 'SELECT id FROM unidades WHERE id = ? AND excluido_em IS NULL', args: [dados.unidade_id],
      });
      if (!r.rows.length) throw new ErroValidacao({ unidade_id: 'Unidade não encontrada.' });
    },
  },

  // ───────────────────────────── CAMPANHAS ────────────────────────────
  campanhas: {
    tabela: 'campanhas',
    rotulo: 'Campanha',
    exclusaoLogica: true,
    ordem: 'nome',
    nomeExibicao: (r) => r.nome,
    campos: {
      nome:           { tipo: 'texto', obrigatorio: true, min: 3, max: 120 },
      descricao:      { tipo: 'texto', obrigatorio: true, min: 10, max: 600 },
      icone:          { tipo: 'icone', padrao: '💉' },
      cor:            { tipo: 'cor', padrao: '#0dbdad' },
      cor_fundo:      { tipo: 'cor', padrao: '#e0f7f5' },
      permanente:     { tipo: 'booleano' },
      data_inicio:    { tipo: 'data' },
      data_fim:       { tipo: 'data' },
      todas_unidades: { tipo: 'booleano' },
    },
    extras: {
      unidade_ids: { tipo: 'ids', maxItens: 50 },
    },
    // Regra entre campos: permanente não tem datas; com prazo exige início ≤ fim
    ajustar(dados) {
      if (dados.permanente) {
        dados.data_inicio = null;
        dados.data_fim = null;
        return;
      }
      const erros = {};
      if (!dados.data_inicio) erros.data_inicio = 'Informe o início (ou marque como permanente).';
      if (!dados.data_fim) erros.data_fim = 'Informe o fim (ou marque como permanente).';
      if (dados.data_inicio && dados.data_fim && dados.data_inicio > dados.data_fim) {
        erros.data_fim = 'O fim deve ser depois do início.';
      }
      if (Object.keys(erros).length) throw new ErroValidacao(erros);
    },
    async validarRelacoes(conn, dados, extras) {
      const ids = extras.unidade_ids;
      if (!ids.length) return;
      const r = await conn.execute({
        sql: `SELECT id FROM unidades WHERE excluido_em IS NULL AND id IN (${ids.map(() => '?').join(',')})`,
        args: ids,
      });
      if (r.rows.length !== ids.length) throw new ErroValidacao({ unidade_ids: 'Alguma unidade selecionada não existe.' });
    },
    async carregarExtras(conn, linhas) {
      if (!linhas.length) return;
      const r = await conn.execute('SELECT campanha_id AS cid, unidade_id AS uid FROM campanha_unidades');
      const mapa = {};
      for (const x of r.rows) (mapa[x.cid] = mapa[x.cid] || []).push(Number(x.uid));
      for (const l of linhas) l.unidade_ids = mapa[l.id] || [];
    },
    async salvarExtras(tx, id, extras) {
      await tx.execute({ sql: 'DELETE FROM campanha_unidades WHERE campanha_id = ?', args: [id] });
      for (const uid of extras.unidade_ids) {
        await tx.execute({ sql: 'INSERT INTO campanha_unidades (campanha_id, unidade_id) VALUES (?, ?)', args: [id, uid] });
      }
    },
  },

  // ───────────────────────────── CALENDÁRIO ───────────────────────────
  eventos: {
    tabela: 'eventos',
    rotulo: 'Evento',
    exclusaoLogica: false,
    ordem: 'data, id',
    nomeExibicao: (r) => `${r.titulo} (${r.data})`,
    campos: {
      data:      { tipo: 'data', obrigatorio: true },
      titulo:    { tipo: 'texto', obrigatorio: true, min: 3, max: 120 },
      tipo:      { tipo: 'enum', obrigatorio: true, valores: ['campanha', 'feriado', 'evento'] },
      descricao: { tipo: 'texto', max: 500 },
    },
  },

  // ───────────────────────── CALENDÁRIO VACINAL ───────────────────────
  calendario_vacinal: {
    tabela: 'calendario_vacinal',
    rotulo: 'Item do calendário vacinal',
    exclusaoLogica: false,
    ordem: 'ordem, id',
    nomeExibicao: (r) => `${r.faixa} — ${r.vacina}`,
    campos: {
      faixa:      { tipo: 'texto', obrigatorio: true, min: 2, max: 60 },
      vacina:     { tipo: 'texto', obrigatorio: true, min: 2, max: 200 },
      doses:      { tipo: 'texto', obrigatorio: true, min: 1, max: 80 },
      observacao: { tipo: 'texto', max: 200 },
      ordem:      { tipo: 'inteiro', min: 0, max: 999, padrao: 0 },
    },
  },

  // ─────────────────────────────── AVISOS ─────────────────────────────
  avisos: {
    tabela: 'avisos',
    rotulo: 'Aviso',
    exclusaoLogica: false,
    ordem: 'ordem, id',
    nomeExibicao: (r) => r.texto.slice(0, 50),
    campos: {
      tipo:  { tipo: 'enum', obrigatorio: true, valores: ['info', 'warn', 'success'] },
      texto: { tipo: 'texto', obrigatorio: true, min: 5, max: 300 },
      ativo: { tipo: 'booleano' },
      ordem: { tipo: 'inteiro', min: 0, max: 999, padrao: 0 },
    },
  },
};

// Campos do registro de vacina aplicada (gerenciado pela tela de usuários)
const CAMPOS_VACINA = {
  vacina: { tipo: 'texto', obrigatorio: true, min: 2, max: 80 },
  data:   { tipo: 'data', obrigatorio: true, naoFutura: true },
  dose:   { tipo: 'texto', obrigatorio: true, min: 1, max: 40 },
  local:  { tipo: 'texto', obrigatorio: true, min: 2, max: 120 },
};

module.exports = { ENTIDADES, CAMPOS_VACINA };
