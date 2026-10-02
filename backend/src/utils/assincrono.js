/* utils/assincrono.js — Encaminha erros de rotas async para o tratador de erros do Express. */
const assincrono = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
module.exports = { assincrono };
