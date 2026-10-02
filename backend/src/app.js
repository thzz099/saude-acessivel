/* =============================================================
   app.js — Monta a aplicação Express (sem iniciar o servidor)
   Ordem: transporte → cabeçalhos → corpo → API → páginas → erros
   ============================================================= */
const express = require('express');
const cookieParser = require('cookie-parser');
const env = require('./config/env');
const { forcarHttps, cabecalhos, permissoes, verificarOrigem } = require('./middlewares/seguranca');
const { limiteGeralApi } = require('./middlewares/limites');
const { tratarErros } = require('./middlewares/erros');

const app = express();
app.set('trust proxy', 1);          // Render fica atrás de proxy (IP real e HTTPS)
app.disable('x-powered-by');        // [15] não anunciar a tecnologia

if (env.IS_PROD) app.use(forcarHttps);
app.use(cabecalhos, permissoes);
app.use(express.json({ limit: '20kb' }));   // [16] sem upload; corpo pequeno
app.use(cookieParser());

app.use('/api', limiteGeralApi, verificarOrigem, (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use(require('./routes/auth.routes'));
app.use(require('./routes/dados.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api', (req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

app.use(require('./routes/paginas.routes'));
app.use((req, res) => res.status(404).send('Página não encontrada. <a href="/">Voltar ao início</a>'));
app.use(tratarErros);

module.exports = app;
