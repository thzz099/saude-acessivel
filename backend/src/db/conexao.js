/* =============================================================
   db/conexao.js — Cliente único do banco (Turso / libSQL)
   O cliente é criado na primeira utilização e reaproveitado
   em todas as requisições. Nos testes automatizados, um cliente
   SQLite local é injetado no lugar (usarClienteDeTeste).
   ============================================================= */
let cliente = null;

function db() {
  if (!cliente) {
    const { createClient } = require('@libsql/client');
    const env = require('../config/env');
    cliente = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
  }
  return cliente;
}

function usarClienteDeTeste(c) {
  cliente = c;
}

module.exports = { db, usarClienteDeTeste };
