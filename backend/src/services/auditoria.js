/* =============================================================
   services/auditoria.js — Trilha de auditoria
   Toda alteração feita pelo painel fica registrada: quem, o quê,
   quando. Gravada DENTRO da mesma transação da alteração — ou as
   duas coisas acontecem, ou nenhuma.
   ============================================================= */
const { db } = require('../db/conexao');
const { paraObjetos } = require('../utils/linhas');

async function registrar(conn, { usuarioId, acao, entidade, entidadeId, resumo }) {
  await conn.execute({
    sql: 'INSERT INTO auditoria (usuario_id, acao, entidade, entidade_id, resumo) VALUES (?, ?, ?, ?, ?)',
    args: [usuarioId ?? null, acao, entidade, entidadeId ?? null, String(resumo).slice(0, 400)],
  });
}

async function listarRecentes(limite = 50) {
  const rs = await db().execute({
    sql: `SELECT a.id, a.acao, a.entidade, a.entidade_id, a.resumo, a.instante,
                 u.nome AS usuario_nome, u.email AS usuario_email
            FROM auditoria a LEFT JOIN usuarios u ON u.id = a.usuario_id
           ORDER BY a.id DESC LIMIT ?`,
    args: [Math.min(Math.max(Number(limite) || 50, 1), 200)],
  });
  return paraObjetos(rs);
}

module.exports = { registrar, listarRecentes };
