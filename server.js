/* =============================================
   server.js — Saúde Acessível
   Backend com Express + Turso (SQLite na nuvem) + bcrypt + JWT
   ============================================= */

require('dotenv').config(); // lê o arquivo .env, se existir (não faz nada em produção)

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');
const { db, initDb } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Em produção, isso deve vir de uma variável de ambiente,
// NUNCA fique escrito direto no código-fonte.
const JWT_SECRET = process.env.JWT_SECRET || 'troque-este-segredo-antes-de-publicar';

app.use(express.json());          // entender JSON no corpo das requisições
app.use(cookieParser());          // ler cookies (onde vai morar o token)
app.use(express.static(path.join(__dirname, 'public'))); // serve index.html, app.js, etc.

// ── Helpers ──────────────────────────────────────
function criarToken(usuario) {
  // guardamos só o essencial dentro do token (nunca a senha!)
  return jwt.sign(
    { id: usuario.id, nome: usuario.nome, email: usuario.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function autenticar(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ erro: 'Não autenticado' });
  try {
    req.usuario = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ erro: 'Sessão inválida ou expirada' });
  }
}

// ── ROTA: Cadastro ───────────────────────────────
app.post('/api/registro', async (req, res) => {
  try {
    const { nome, email, senha } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({ erro: 'Preencha nome, email e senha.' });
    }
    if (senha.length < 6) {
      return res.status(400).json({ erro: 'A senha precisa ter pelo menos 6 caracteres.' });
    }

    const existente = await db.execute({
      sql: 'SELECT id FROM usuarios WHERE email = ?',
      args: [email]
    });
    if (existente.rows.length > 0) {
      return res.status(409).json({ erro: 'Já existe uma conta com este email.' });
    }

    // NUNCA salve a senha como texto puro. O bcrypt gera um "hash":
    // uma versão embaralhada e de mão única — dá pra conferir a senha
    // depois, mas não dá pra "desembaralhar" e descobrir o original.
    const senha_hash = await bcrypt.hash(senha, 10);

    const resultado = await db.execute({
      sql: 'INSERT INTO usuarios (nome, email, senha_hash) VALUES (?, ?, ?)',
      args: [nome, email, senha_hash]
    });

    const usuario = { id: Number(resultado.lastInsertRowid), nome, email };
    const token = criarToken(usuario);

    // httpOnly = o JavaScript do navegador não consegue ler esse cookie,
    // o que dificulta roubo de token via ataques de XSS.
    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    });

    res.status(201).json({ usuario });
  } catch (err) {
    console.error('Erro no /api/registro:', err);
    res.status(500).json({ erro: 'Erro interno ao criar conta.' });
  }
});

// ── ROTA: Login ──────────────────────────────────
app.post('/api/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) {
      return res.status(400).json({ erro: 'Informe email e senha.' });
    }

    const resultado = await db.execute({
      sql: 'SELECT * FROM usuarios WHERE email = ?',
      args: [email]
    });
    const usuario = resultado.rows[0];
    if (!usuario) {
      return res.status(401).json({ erro: 'Email ou senha incorretos.' });
    }

    const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaCorreta) {
      return res.status(401).json({ erro: 'Email ou senha incorretos.' });
    }

    const token = criarToken(usuario);
    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    });

    res.json({ usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email } });
  } catch (err) {
    console.error('Erro no /api/login:', err);
    res.status(500).json({ erro: 'Erro interno ao entrar.' });
  }
});

// ── ROTA: Quem é o usuário logado? ───────────────
app.get('/api/me', autenticar, (req, res) => {
  res.json({ usuario: req.usuario });
});

// ── ROTA: Logout ─────────────────────────────────
app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

// ── INICIALIZAÇÃO ────────────────────────────────
async function start() {
  await initDb(); // garante que a tabela "usuarios" existe antes de aceitar requisições
  app.listen(PORT, () => {
    console.log(`\n✅ Saúde Acessível rodando em http://localhost:${PORT}`);
    console.log(`   Tela de login: http://localhost:${PORT}/login.html\n`);
  });
}

start().catch(err => {
  console.error('❌ Falha ao iniciar o servidor:', err);
  process.exit(1);
});
