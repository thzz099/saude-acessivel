/* =============================================================
   db/migracoes.js — Prepara o banco a cada inicialização
   1. Cria as tabelas que ainda não existem (schema.sql)
   2. Ajusta bancos antigos (ex.: coluna "perfil" da v2)
   3. Promove a administrador os emails de ADMIN_EMAILS
   ============================================================= */
const fs = require('fs');
const path = require('path');
const { db } = require('./conexao');

async function migrar() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await db().executeMultiple(sql);

  // Bancos criados antes da v2 não têm a coluna "perfil"
  const colunas = await db().execute('PRAGMA table_info(usuarios)');
  if (!colunas.rows.some((c) => c.name === 'perfil')) {
    await db().execute("ALTER TABLE usuarios ADD COLUMN perfil TEXT NOT NULL DEFAULT 'CIDADAO'");
    console.log('ℹ️  Migração: coluna "perfil" adicionada em usuarios.');
  }
}

async function promoverAdmins(emails) {
  if (!emails.length) return 0;
  const rs = await db().execute({
    sql: `UPDATE usuarios SET perfil = 'ADMIN'
           WHERE lower(email) IN (${emails.map(() => '?').join(',')}) AND perfil <> 'ADMIN'`,
    args: emails,
  });
  if (rs.rowsAffected) console.log(`ℹ️  ${rs.rowsAffected} usuário(s) promovido(s) a administrador (ADMIN_EMAILS).`);
  return rs.rowsAffected;
}

module.exports = { migrar, promoverAdmins };
