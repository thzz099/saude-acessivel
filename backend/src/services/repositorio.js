/* =============================================================
   services/repositorio.js — CRUD genérico das entidades

   Operações: listar, obter, criar, atualizar, excluir.
   Toda escrita roda numa TRANSAÇÃO junto com a auditoria.
   Nomes de tabela/coluna vêm do catálogo (entidades.js);
   valores sempre por parâmetro (?) — nunca concatenados.  [13]
   ============================================================= */
const { db } = require('../db/conexao');
const { paraObjetos } = require('../utils/linhas');
const { validar, ErroValidacao, ErroNaoEncontrado } = require('../utils/validacao');
const auditoria = require('./auditoria');
const { notificarMudanca } = require('./tempoReal');

const filtroAtivos = (ent) => (ent.exclusaoLogica ? 'excluido_em IS NULL' : '1 = 1');

async function listar(ent) {
  const rs = await db().execute(`SELECT * FROM ${ent.tabela} WHERE ${filtroAtivos(ent)} ORDER BY ${ent.ordem}`);
  const linhas = paraObjetos(rs);
  if (ent.carregarExtras) await ent.carregarExtras(db(), linhas);
  return linhas;
}

async function obter(ent, id, conn = db()) {
  const rs = await conn.execute({
    sql: `SELECT * FROM ${ent.tabela} WHERE id = ? AND ${filtroAtivos(ent)}`,
    args: [id],
  });
  const [linha] = paraObjetos(rs);
  if (!linha) throw new ErroNaoEncontrado(`${ent.rotulo} não encontrado(a).`);
  if (ent.carregarExtras) await ent.carregarExtras(conn, [linha]);
  return linha;
}

/** Valida campos + extras + regras entre campos. Lança ErroValidacao. */
async function prepararDados(ent, corpo) {
  const { dados, erros } = validar(ent.campos, corpo);
  const r2 = ent.extras ? validar(ent.extras, corpo) : { dados: {}, erros: {} };
  const todosErros = { ...erros, ...r2.erros };
  if (Object.keys(todosErros).length) throw new ErroValidacao(todosErros);
  if (ent.ajustar) ent.ajustar(dados);
  if (ent.validarRelacoes) await ent.validarRelacoes(db(), dados, r2.dados);
  return { dados, extras: r2.dados };
}

/**
 * Executa fn numa transação. Se der certo e `entidadeAlterada` for
 * informada, avisa o tempo real (o cache do portal é renovado e as
 * páginas abertas atualizam). Fica aqui para nenhuma rota esquecer.
 */
async function emTransacao(fn, entidadeAlterada) {
  const tx = await db().transaction('write');
  try {
    const resultado = await fn(tx);
    await tx.commit();
    if (entidadeAlterada) notificarMudanca(entidadeAlterada);
    return resultado;
  } catch (e) {
    try { await tx.rollback(); } catch { /* transação já encerrada */ }
    throw e;
  } finally {
    if (tx.close) tx.close();
  }
}

async function criar(ent, corpo, usuarioId) {
  const { dados, extras } = await prepararDados(ent, corpo);
  const colunas = Object.keys(dados);
  return emTransacao(async (tx) => {
    const rs = await tx.execute({
      sql: `INSERT INTO ${ent.tabela} (${colunas.join(', ')}) VALUES (${colunas.map(() => '?').join(', ')})`,
      args: colunas.map((c) => dados[c]),
    });
    const id = Number(rs.lastInsertRowid);
    if (ent.salvarExtras) await ent.salvarExtras(tx, id, extras);
    await auditoria.registrar(tx, {
      usuarioId, acao: 'CRIAR', entidade: ent.tabela, entidadeId: id,
      resumo: `${ent.rotulo} criado(a): ${ent.nomeExibicao({ ...dados, id })}`,
    });
    return obter(ent, id, tx);
  }, ent.tabela);
}

async function atualizar(ent, id, corpo, usuarioId) {
  const { dados, extras } = await prepararDados(ent, corpo);
  const colunas = Object.keys(dados);
  return emTransacao(async (tx) => {
    const antes = await obter(ent, id, tx);
    await tx.execute({
      sql: `UPDATE ${ent.tabela} SET ${colunas.map((c) => `${c} = ?`).join(', ')}, atualizado_em = datetime('now')
             WHERE id = ? AND ${filtroAtivos(ent)}`,
      args: [...colunas.map((c) => dados[c]), id],
    });
    if (ent.salvarExtras) await ent.salvarExtras(tx, id, extras);

    // Resumo legível do que mudou (ex.: status: aberto → fechado)
    const mudancas = colunas
      .filter((c) => String(antes[c] ?? '') !== String(dados[c] ?? ''))
      .map((c) => `${c}: ${String(antes[c] ?? '—').slice(0, 30)} → ${String(dados[c] ?? '—').slice(0, 30)}`);
    for (const [k, v] of Object.entries(extras)) {
      if (JSON.stringify([...(antes[k] || [])].sort()) !== JSON.stringify([...v].sort())) mudancas.push(`${k} alterado(s)`);
    }
    await auditoria.registrar(tx, {
      usuarioId, acao: 'ATUALIZAR', entidade: ent.tabela, entidadeId: id,
      resumo: `${ent.rotulo} atualizado(a): ${ent.nomeExibicao(antes)}` +
        (mudancas.length ? ` (${mudancas.join('; ')})` : ' (sem mudanças)'),
    });
    return obter(ent, id, tx);
  }, ent.tabela);
}

async function excluir(ent, id, usuarioId) {
  return emTransacao(async (tx) => {
    const antes = await obter(ent, id, tx);
    if (ent.exclusaoLogica) {
      // Exclusão lógica: some do site, mas o registro e o histórico ficam
      await tx.execute({ sql: `UPDATE ${ent.tabela} SET excluido_em = datetime('now') WHERE id = ?`, args: [id] });
    } else {
      await tx.execute({ sql: `DELETE FROM ${ent.tabela} WHERE id = ?`, args: [id] });
    }
    await auditoria.registrar(tx, {
      usuarioId, acao: 'EXCLUIR', entidade: ent.tabela, entidadeId: id,
      resumo: `${ent.rotulo} excluído(a): ${ent.nomeExibicao(antes)}`,
    });
    return { id, excluido: true };
  }, ent.tabela);
}

module.exports = { listar, obter, criar, atualizar, excluir, emTransacao };
