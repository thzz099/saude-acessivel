/* =============================================================
   server.js — Ponto de entrada: prepara o banco e inicia o servidor
   ============================================================= */
const env = require('./config/env');
const { migrar, promoverAdmins } = require('./db/migracoes');
const { semear } = require('./db/seed');
const app = require('./app');

async function iniciar() {
  await migrar();                         // cria/atualiza tabelas
  await semear();                         // carga inicial (só na 1ª vez)
  await promoverAdmins(env.ADMIN_EMAILS); // emails de ADMIN_EMAILS viram admin
  app.listen(env.PORT, () => {
    console.log(`\n✅ SaúdeMap IA rodando em http://localhost:${env.PORT} (${env.IS_PROD ? 'produção' : 'desenvolvimento'})`);
    console.log(`   Portal: http://localhost:${env.PORT}/   ·   Admin: http://localhost:${env.PORT}/admin\n`);
  });
}

iniciar().catch((err) => {
  console.error('❌ Falha ao iniciar o servidor:', err.message);
  process.exit(1);
});
