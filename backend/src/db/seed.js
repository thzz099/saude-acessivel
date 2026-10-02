/* =============================================================
   db/seed.js — Carga inicial dos dados (roda UMA vez na vida do banco)

   Os dados que antes ficavam fixos no data.js agora vêm de
   dados-iniciais.json e são gravados no banco na primeira
   inicialização. Depois disso, tudo é gerenciado pelo painel.

   A tabela "metadados" guarda que a carga já foi feita — assim,
   se o admin apagar todos os avisos, eles NÃO voltam no próximo
   reinício do servidor.
   ============================================================= */
const { db } = require('./conexao');
const DADOS = require('./dados-iniciais.json');

const CHAVE = 'carga_inicial';

async function contar(tabela) {
  const rs = await db().execute(`SELECT COUNT(*) AS n FROM ${tabela}`);
  return Number(rs.rows[0].n);
}

async function semear() {
  const marca = await db().execute({ sql: 'SELECT valor FROM metadados WHERE chave = ?', args: [CHAVE] });
  if (marca.rows.length) return { aplicada: false };

  const feito = {};

  // Unidades + serviços (ids explícitos para ligar os serviços no mesmo lote)
  if ((await contar('unidades')) === 0) {
    const st = [];
    DADOS.unidades.forEach((u, i) => {
      const id = i + 1;
      st.push({
        sql: `INSERT INTO unidades (id, nome, status, endereco, telefone, horario, latitude, longitude,
                                    observacao, destacar_observacao, dados_oficiais)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [id, u.nome, u.status, u.endereco, u.telefone, u.horario, u.latitude, u.longitude,
               u.observacao, u.destacar_observacao, u.dados_oficiais],
      });
      for (const s of u.servicos) {
        st.push({ sql: 'INSERT OR IGNORE INTO servicos (nome) VALUES (?)', args: [s] });
        st.push({
          sql: 'INSERT OR IGNORE INTO unidade_servicos (unidade_id, servico_id) SELECT ?, id FROM servicos WHERE nome = ?',
          args: [id, s],
        });
      }
    });
    await db().batch(st, 'write');
    feito.unidades = DADOS.unidades.length;
  }

  // nome da unidade → id (para ligar profissionais e campanhas)
  const rsU = await db().execute('SELECT id, nome FROM unidades WHERE excluido_em IS NULL');
  const idDa = Object.fromEntries(rsU.rows.map((r) => [r.nome, Number(r.id)]));

  if ((await contar('profissionais')) === 0) {
    await db().batch(DADOS.profissionais.map((p) => ({
      sql: `INSERT INTO profissionais (nome, especialidade, categoria, horario, unidade_id, disponivel, dados_oficiais)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [p.nome, p.especialidade, p.categoria, p.horario, idDa[p.unidade] ?? null, p.disponivel, p.dados_oficiais],
    })), 'write');
    feito.profissionais = DADOS.profissionais.length;
  }

  if ((await contar('campanhas')) === 0) {
    const st = [];
    DADOS.campanhas.forEach((c, i) => {
      const id = i + 1;
      st.push({
        sql: `INSERT INTO campanhas (id, nome, descricao, icone, cor, cor_fundo, permanente, data_inicio, data_fim, todas_unidades)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [id, c.nome, c.descricao, c.icone, c.cor, c.cor_fundo, c.permanente, c.data_inicio, c.data_fim, c.todas_unidades],
      });
      for (const nome of c.unidades) {
        if (idDa[nome]) st.push({ sql: 'INSERT INTO campanha_unidades (campanha_id, unidade_id) VALUES (?, ?)', args: [id, idDa[nome]] });
      }
    });
    await db().batch(st, 'write');
    feito.campanhas = DADOS.campanhas.length;
  }

  const simples = [
    ['eventos', 'INSERT INTO eventos (data, titulo, tipo, descricao) VALUES (?, ?, ?, ?)',
      (e) => [e.data, e.titulo, e.tipo, e.descricao]],
    ['calendario_vacinal', 'INSERT INTO calendario_vacinal (faixa, vacina, doses, observacao, ordem) VALUES (?, ?, ?, ?, ?)',
      (v) => [v.faixa, v.vacina, v.doses, v.observacao, v.ordem]],
    ['avisos', 'INSERT INTO avisos (tipo, texto, ativo, ordem) VALUES (?, ?, ?, ?)',
      (a) => [a.tipo, a.texto, a.ativo, a.ordem]],
  ];
  for (const [tabela, sql, args] of simples) {
    if ((await contar(tabela)) === 0) {
      await db().batch(DADOS[tabela].map((x) => ({ sql, args: args(x) })), 'write');
      feito[tabela] = DADOS[tabela].length;
    }
  }

  await db().execute({
    sql: "INSERT INTO metadados (chave, valor) VALUES (?, datetime('now'))", args: [CHAVE],
  });
  console.log('ℹ️  Carga inicial aplicada:', JSON.stringify(feito));
  return { aplicada: true, feito };
}

module.exports = { semear };
