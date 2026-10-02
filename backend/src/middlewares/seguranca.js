/* =============================================================
   middlewares/seguranca.js — Cabeçalhos e proteções de transporte
   [18] security headers · [19] HTTPS · CSRF por verificação de origem
   ============================================================= */
const helmet = require('helmet');
const env = require('../config/env');

// [19] Em produção, qualquer acesso via http:// vira https://
function forcarHttps(req, res, next) {
  if (req.secure) return next();
  return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
}

// [18] Helmet + Content-Security-Policy ajustada ao que o site usa
const cabecalhos = helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://cdnjs.cloudflare.com'],
      scriptSrcAttr: ["'none'"],                       // bloqueia onclick="..." inline
      styleSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com', 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
      imgSrc: ["'self'", 'data:', 'https://*.tile.openstreetmap.org', 'https://cdnjs.cloudflare.com'],
      connectSrc: ["'self'", 'https://router.project-osrm.org'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],                      // anti-clickjacking
      upgradeInsecureRequests: env.IS_PROD ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,                    // tiles do OSM não enviam CORP
  hsts: env.IS_PROD ? { maxAge: 31536000, includeSubDomains: true } : false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
});

function permissoes(req, res, next) {
  res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=(), payment=()');
  next();
}

/**
 * Proteção extra contra CSRF: requisições que ALTERAM dados vindas de
 * outro site são recusadas (além do cookie SameSite e do JSON obrigatório).
 */
function verificarOrigem(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origem = req.get('origin');
  if (!origem) return next();
  try {
    if (new URL(origem).host === req.get('host')) return next();
  } catch { /* origem malformada */ }
  return res.status(403).json({ erro: 'Origem não permitida.' });
}

module.exports = { forcarHttps, cabecalhos, permissoes, verificarOrigem };
