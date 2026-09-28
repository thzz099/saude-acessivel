/* =============================================================
   server.js — SaúdeMap IA (versão endurecida)
   Os números [n] nos comentários correspondem ao checklist de
   segurança do projeto (ver SEGURANCA.md).
   ============================================================= */

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');
const { db, initDb } = require('./database');

const IS_PROD = process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER);
const PORT = process.env.PORT || 3000;
const BCRYPT_CUSTO = 10;

// ── [1] [2] Segredos SOMENTE via variável de ambiente ─────────────
// Sem valor padrão no código: se faltar, o servidor se recusa a subir.
// (Antes havia um segredo padrão escrito aqui — qualquer um que lesse o
//  GitHub poderia forjar sessões. Falhar alto é melhor que rodar inseguro.)
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('❌ JWT_SECRET ausente ou curto demais (mínimo 32 caracteres).');
  console.error("   Gere um com: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"");
  process.exit(1);
}

const app = express();
app.set('trust proxy', 1);        // Render fica atrás de proxy: necessário p/ IP real e detecção de HTTPS
app.disable('x-powered-by');      // [15] não anunciar a tecnologia do servidor

// ── [19] Forçar HTTPS em produção ─────────────────────────────────
if (IS_PROD) {
  app.use((req, res, next) => {
    if (req.secure) return next();
    return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
  });
}

// ── [18] Security headers (Helmet + CSP sob medida) ───────────────
app.use(helmet({
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
      upgradeInsecureRequests: IS_PROD ? [] : null,    // em localhost (http) quebraria as chamadas
    },
  },
  crossOriginEmbedderPolicy: false,                    // tiles do OSM não enviam cabeçalho CORP
  hsts: IS_PROD ? { maxAge: 31536000, includeSubDomains: true } : false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
app.use((req, res, next) => {
  // geolocalização só na própria origem; câmera/microfone negados
  res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=(), payment=()');
  next();
});

// ── [16] Sem uploads: corpo JSON limitado a 10 KB ─────────────────
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// ── [11] Rate limit ───────────────────────────────────────────────
const msgLimite = { erro: 'Muitas requisições. Aguarde alguns minutos e tente novamente.' };
const limiteGeralApi = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 300,
  standardHeaders: 'draft-7', legacyHeaders: false, message: msgLimite,
});
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 20,
  skipSuccessfulRequests: true,          // só tentativas FALHAS contam (turma na mesma rede não é bloqueada)
  standardHeaders: 'draft-7', legacyHeaders: false, message: msgLimite,
});
const limiteRegistro = rateLimit({
  windowMs: 60 * 60 * 1000, limit: 30,
  standardHeaders: 'draft-7', legacyHeaders: false, message: msgLimite,
});
app.use('/api', limiteGeralApi);
app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

// ── [9] Cookie de sessão protegido ────────────────────────────────
const COOKIE_BASE = { httpOnly: true, secure: IS_PROD, sameSite: 'lax', path: '/' };
const COOKIE_SESSAO = { ...COOKIE_BASE, maxAge: 7 * 24 * 60 * 60 * 1000 };

// ── Helpers de sessão ─────────────────────────────────────────────
function criarToken(u) {
  // [17] token mínimo: sem email, sem nada sensível (payload JWT é legível, não cifrado)
  return jwt.sign({ sub: String(u.id), nome: u.nome, perfil: u.perfil },
    JWT_SECRET, { expiresIn: '7d', algorithm: 'HS256' });
}
function lerSessao(req) {
  const token = req.cookies && req.cookies.token;
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }); // fixa o algoritmo (evita "alg confusion")
  } catch {
    return null;
  }
}
// [6] Autenticação verificada no SERVIDOR
function autenticar(req, res, next) {
  const s = lerSessao(req);
  if (!s) return res.status(401).json({ erro: 'Não autenticado.' });
  req.usuario = s;
  next();
}
// [7] Restrição de acesso por perfil
function exigirPerfil(...perfis) {
  return (req, res, next) =>
    perfis.includes(req.usuario && req.usuario.perfil)
      ? next()
      : res.status(403).json({ erro: 'Acesso negado.' });
}
// [17] Só o necessário sai na resposta
const publico = (u) => ({ nome: u.nome, perfil: u.perfil });

// ── [14] Validação de entrada ─────────────────────────────────────
function exigirJson(req, res, next) {
  if (!req.is('application/json')) {
    return res.status(415).json({ erro: 'Content-Type deve ser application/json.' });
  }
  next();
}
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RE_NOME = /^[A-Za-zÀ-ÖØ-öø-ÿ' .-]{2,100}$/;

function validarRegistro(body) {
  // [8] Anti mass assignment: só estes 3 campos são lidos.
  // Um "perfil":"ADMIN" enviado no corpo é simplesmente ignorado.
  const { nome, email, senha } = body || {};
  if (typeof nome !== 'string' || typeof email !== 'string' || typeof senha !== 'string') {
    return { erro: 'Preencha nome, email e senha.' };
  }
  const n = nome.trim().replace(/\s+/g, ' ');
  const e = email.trim().toLowerCase();
  if (!RE_NOME.test(n)) return { erro: 'Nome inválido. Use apenas letras (2 a 100 caracteres).' };
  if (e.length > 254 || !RE_EMAIL.test(e)) return { erro: 'Email inválido.' };
  if (senha.length < 8) return { erro: 'A senha precisa ter pelo menos 8 caracteres.' };
  // bcrypt ignora tudo além de 72 bytes — melhor recusar do que truncar em silêncio
  if (Buffer.byteLength(senha, 'utf8') > 72) return { erro: 'A senha pode ter no máximo 72 caracteres.' };
  return { dados: { nome: n, email: e, senha } };
}

// ── [12] Bot protection: honeypot ─────────────────────────────────
const pareceBot = (req) =>
  typeof (req.body && req.body.website) === 'string' && req.body.website.trim() !== '';

// Hash falso para comparar quando o email não existe: o tempo de resposta fica
// igual nos dois casos, impedindo descobrir emails cadastrados pelo cronômetro.
const HASH_FALSO = bcrypt.hashSync('usuario-inexistente-' + Date.now(), BCRYPT_CUSTO);

// ── ROTAS DE API ──────────────────────────────────────────────────
app.post('/api/registro', limiteRegistro, exigirJson, async (req, res, next) => {
  try {
    if (pareceBot(req)) return res.status(400).json({ erro: 'Requisição inválida.' });
    const v = validarRegistro(req.body);
    if (v.erro) return res.status(400).json({ erro: v.erro });
    const { nome, email, senha } = v.dados;

    // [13] Query parametrizada
    const existe = await db.execute({
      sql: 'SELECT id FROM usuarios WHERE lower(email) = ? LIMIT 1',
      args: [email],
    });
    if (existe.rows.length) return res.status(409).json({ erro: 'Já existe uma conta com este email.' });

    // [10] Hash de senha (bcrypt, sal aleatório embutido)
    const senhaHash = await bcrypt.hash(senha, BCRYPT_CUSTO);
    const r = await db.execute({
      sql: 'INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES (?, ?, ?, ?)',
      args: [nome, email, senhaHash, 'CIDADAO'],   // perfil definido pelo SERVIDOR, nunca pelo cliente
    });

    const usuario = { id: Number(r.lastInsertRowid), nome, perfil: 'CIDADAO' };
    res.cookie('token', criarToken(usuario), COOKIE_SESSAO);
    res.status(201).json({ usuario: publico(usuario) });
  } catch (err) { next(err); }
});

app.post('/api/login', limiteLogin, exigirJson, async (req, res, next) => {
  try {
    if (pareceBot(req)) return res.status(400).json({ erro: 'Requisição inválida.' });
    const { email, senha } = req.body || {};
    if (typeof email !== 'string' || typeof senha !== 'string' || !email.trim() || !senha) {
      return res.status(400).json({ erro: 'Informe email e senha.' });
    }
    if (email.length > 254 || Buffer.byteLength(senha, 'utf8') > 72) {
      return res.status(401).json({ erro: 'Email ou senha incorretos.' });
    }

    const r = await db.execute({
      sql: 'SELECT id, nome, senha_hash, perfil FROM usuarios WHERE lower(email) = ? LIMIT 1',
      args: [email.trim().toLowerCase()],
    });
    const u = r.rows[0];
    const ok = await bcrypt.compare(senha, u ? u.senha_hash : HASH_FALSO);

    // Mesma mensagem nos dois casos: não revela se o email existe
    if (!u || !ok) return res.status(401).json({ erro: 'Email ou senha incorretos.' });

    const usuario = { id: Number(u.id), nome: u.nome, perfil: u.perfil || 'CIDADAO' };
    res.cookie('token', criarToken(usuario), COOKIE_SESSAO);
    res.json({ usuario: publico(usuario) });
  } catch (err) { next(err); }
});

app.get('/api/me', autenticar, (req, res) => {
  res.json({ usuario: publico(req.usuario) });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('token', COOKIE_BASE);
  res.json({ ok: true });
});

// [7] Exemplo de rota restrita a administradores
app.get('/api/admin/resumo', autenticar, exigirPerfil('ADMIN'), async (req, res, next) => {
  try {
    const r = await db.execute('SELECT COUNT(*) AS total FROM usuarios');
    res.json({ usuariosCadastrados: Number(r.rows[0].total) });
  } catch (err) { next(err); }
});

app.use('/api', (req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

// ── [6] Páginas protegidas NO SERVIDOR ────────────────────────────
// O portal fica em /private e só é entregue a quem tem sessão válida.
const PAGINA_PORTAL = path.join(__dirname, 'private', 'index.html');
app.get(['/', '/index.html'], (req, res) => {
  if (!lerSessao(req)) return res.redirect(302, '/login.html');
  res.set('Cache-Control', 'no-store');
  res.sendFile(PAGINA_PORTAL);
});
app.get('/login.html', (req, res, next) => {
  if (lerSessao(req)) return res.redirect(302, '/');
  next();
});

app.use(express.static(path.join(__dirname, 'public'), { index: false, dotfiles: 'deny' }));

// ── [15] Tratamento de erro sem vazamento ─────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ erro: 'Requisição grande demais.' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ erro: 'JSON inválido.' });
  console.error(`[erro] ${req.method} ${req.originalUrl}: ${err.message}`); // nunca loga corpo/senha
  res.status(500).json({ erro: 'Erro interno. Tente novamente.' });      // nunca envia stack ao cliente
});

// ── Inicialização ─────────────────────────────────────────────────
async function start() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`\n✅ SaúdeMap IA rodando em http://localhost:${PORT} (${IS_PROD ? 'produção' : 'desenvolvimento'})`);
    console.log(`   Tela de login: http://localhost:${PORT}/login.html\n`);
  });
}
start().catch((err) => {
  console.error('❌ Falha ao iniciar o servidor:', err.message);
  process.exit(1);
});
