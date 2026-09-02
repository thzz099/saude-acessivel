/* =============================================
   database.js
   ---------------------------------------------
   Antes usávamos better-sqlite3 (um arquivo local,
   apagado sempre que o servidor gratuito "dormia").

   Agora usamos o Turso: um banco compatível com
   SQLite, mas que vive na nuvem — os dados
   continuam existindo mesmo se o servidor reiniciar.

   A API muda pouco: em vez de `db.prepare(sql).get()`
   (síncrono), usamos `db.execute({sql, args})`
   (assíncrono, com `await`).
   ============================================= */

const { createClient } = require('@libsql/client');

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.warn(
    '⚠️  TURSO_DATABASE_URL não definida. Crie um arquivo .env (veja .env.example) ' +
    'ou configure as variáveis de ambiente no seu provedor de hospedagem.'
  );
}

const db = createClient({ url, authToken });

async function initDb() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      senha_hash TEXT NOT NULL,
      criado_em TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

module.exports = { db, initDb };
