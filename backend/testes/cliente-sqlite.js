/* =============================================================
   testes/cliente-sqlite.js — Imitação do cliente Turso para testes

   Implementa a mesma interface do @libsql/client (execute, batch,
   executeMultiple, transaction) em cima do SQLite embutido no Node
   (node:sqlite, Node 22+). Assim os testes rodam no banco de verdade,
   em memória, sem internet e sem tocar no banco de produção.
   ============================================================= */
const { DatabaseSync } = require('node:sqlite');

function criarClienteSQLite(caminho = ':memory:') {
  const banco = new DatabaseSync(caminho);

  function executar(stmt) {
    const { sql, args = [] } = typeof stmt === 'string' ? { sql: stmt } : stmt;
    for (const a of args) {
      if (a === undefined || typeof a === 'boolean' || (typeof a === 'object' && a !== null)) {
        throw new TypeError(`Parâmetro SQL inválido (${typeof a}) em: ${sql.slice(0, 60)}`);
      }
    }
    const prep = banco.prepare(sql);
    if (/^\s*(SELECT|PRAGMA|WITH)\b/i.test(sql)) {
      const rows = prep.all(...args);
      return { rows, columns: rows.length ? Object.keys(rows[0]) : [], rowsAffected: 0, lastInsertRowid: undefined };
    }
    const r = prep.run(...args);
    return { rows: [], columns: [], rowsAffected: Number(r.changes), lastInsertRowid: r.lastInsertRowid };
  }

  return {
    async execute(stmt) { return executar(stmt); },
    async executeMultiple(sql) { banco.exec(sql); },
    async batch(stmts) {
      banco.exec('BEGIN');
      try {
        const res = stmts.map(executar);
        banco.exec('COMMIT');
        return res;
      } catch (e) {
        banco.exec('ROLLBACK');
        throw e;
      }
    },
    async transaction() {
      banco.exec('BEGIN');
      let aberta = true;
      return {
        async execute(stmt) { return executar(stmt); },
        async commit() { banco.exec('COMMIT'); aberta = false; },
        async rollback() { if (aberta) { banco.exec('ROLLBACK'); aberta = false; } },
        close() {},
      };
    },
    _banco: banco,
  };
}

module.exports = { criarClienteSQLite };
