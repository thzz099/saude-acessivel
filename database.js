/* =============================================================
   database.js — conexão com o Turso (libSQL, compatível com SQLite)
   ============================================================= */

const { createClient } = require('@libsql/client');

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

// [1] Credenciais do banco só existem no servidor (nunca no /public)
if (!url || !authToken) {
  console.error('❌ TURSO_DATABASE_URL e/ou TURSO_AUTH_TOKEN ausentes.');
  console.error('   Crie o arquivo .env (modelo em .env.example) ou configure no painel do Render.');
  process.exit(1);
}

// Cliente único por processo (reaproveita a conexão em todas as requisições)
const db = createClient({ url, authToken });

async function initDb() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      nome       TEXT NOT NULL,
      email      TEXT NOT NULL UNIQUE,
      senha_hash TEXT NOT NULL,
      perfil     TEXT NOT NULL DEFAULT 'CIDADAO' CHECK (perfil IN ('CIDADAO','ADMIN')),
      criado_em  TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Migração: bancos criados antes da coluna "perfil" (o seu, em produção)
  const colunas = await db.execute('PRAGMA table_info(usuarios)');
  if (!colunas.rows.some((c) => c.name === 'perfil')) {
    await db.execute("ALTER TABLE usuarios ADD COLUMN perfil TEXT NOT NULL DEFAULT 'CIDADAO'");
    console.log('ℹ️  Migração aplicada: coluna "perfil" adicionada (usuários existentes = CIDADAO).');
  }

  // Unicidade de email ignorando maiúsculas/minúsculas
  await db.execute('CREATE UNIQUE INDEX IF NOT EXISTS ux_usuarios_email_lower ON usuarios (lower(email))');
}

module.exports = { db, initDb };
