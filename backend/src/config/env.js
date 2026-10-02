/* =============================================================
   config/env.js — Leitura e validação das variáveis de ambiente
   [1][2] Segredos existem SOMENTE aqui (vindos do .env ou do Render).
   Se faltar algo essencial, o servidor se recusa a iniciar.
   ============================================================= */
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

function falhar(msg) {
  console.error(`❌ ${msg}`);
  console.error('   Configure no arquivo .env (modelo em .env.example) ou no painel do Render.');
  process.exit(1);
}

const env = {
  IS_PROD: process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER),
  PORT: Number(process.env.PORT) || 3000,
  JWT_SECRET: process.env.JWT_SECRET,
  TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
  TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
  // Emails promovidos automaticamente a administrador (separados por vírgula)
  ADMIN_EMAILS: (process.env.ADMIN_EMAILS || '')
    .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),
};

if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
  falhar('JWT_SECRET ausente ou curto demais (mínimo 32 caracteres).');
}
if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN) {
  falhar('TURSO_DATABASE_URL e/ou TURSO_AUTH_TOKEN ausentes.');
}

module.exports = env;
