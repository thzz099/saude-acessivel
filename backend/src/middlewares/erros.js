/* middlewares/erros.js — [15] Tratamento de erros sem vazar detalhes internos */
// eslint-disable-next-line no-unused-vars
function tratarErros(err, req, res, next) {
  if (res.headersSent) return next(err);
  if (err.type === 'entity.too.large') return res.status(413).json({ erro: 'Requisição grande demais.' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ erro: 'JSON inválido.' });
  if (err.status === 400 && err.detalhes) {
    return res.status(400).json({ erro: 'Verifique os campos destacados.', detalhes: err.detalhes });
  }
  if (err.status === 404) return res.status(404).json({ erro: err.message });
  if (/constraint/i.test(err.message || '') || String(err.code || '').includes('CONSTRAINT')) {
    return res.status(400).json({ erro: 'Os dados violam uma regra do banco (valor inválido ou duplicado).' });
  }
  console.error(`[erro] ${req.method} ${req.originalUrl}: ${err.message}`); // nunca loga o corpo (senhas)
  return res.status(500).json({ erro: 'Erro interno. Tente novamente.' });
}
module.exports = { tratarErros };
