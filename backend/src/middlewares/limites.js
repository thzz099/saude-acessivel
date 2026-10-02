/* middlewares/limites.js — [11] Rate limit (limite de requisições por IP) */
const rateLimit = require('express-rate-limit');

const mensagem = { erro: 'Muitas requisições. Aguarde alguns minutos e tente novamente.' };
const base = { standardHeaders: 'draft-7', legacyHeaders: false, message: mensagem };

// Dimensionado para uma sala de aula inteira na mesma rede
const limiteGeralApi = rateLimit({ ...base, windowMs: 15 * 60 * 1000, limit: 1000 });
// Só tentativas de login FALHAS contam
const limiteLogin = rateLimit({ ...base, windowMs: 15 * 60 * 1000, limit: 20, skipSuccessfulRequests: true });
const limiteRegistro = rateLimit({ ...base, windowMs: 60 * 60 * 1000, limit: 30 });

module.exports = { limiteGeralApi, limiteLogin, limiteRegistro };
