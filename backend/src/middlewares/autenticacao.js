/* =============================================================
   middlewares/autenticacao.js — Sessão, autenticação e autorização
   [6] auth no servidor · [7] restrição por perfil · [9] cookies
   ============================================================= */
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { db } = require('../db/conexao');

// [9] Cookie: HttpOnly (JS não lê), Secure em produção, SameSite contra CSRF
const COOKIE_BASE = { httpOnly: true, secure: env.IS_PROD, sameSite: 'lax', path: '/' };
const COOKIE_SESSAO = { ...COOKIE_BASE, maxAge: 7 * 24 * 60 * 60 * 1000 };

function criarToken(u) {
  // [17] token mínimo: sem email, sem nada sensível (JWT é legível, não cifrado)
  return jwt.sign({ sub: String(u.id), nome: u.nome }, env.JWT_SECRET, { expiresIn: '7d', algorithm: 'HS256' });
}

function lerSessao(req) {
  const token = req.cookies && req.cookies.token;
  if (!token) return null;
  try {
    return jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }); // algoritmo fixo
  } catch {
    return null;
  }
}

function autenticar(req, res, next) {
  const s = lerSessao(req);
  if (!s) return res.status(401).json({ erro: 'Não autenticado.' });
  req.usuario = { id: Number(s.sub), nome: s.nome };
  next();
}

/** Busca o perfil ATUAL no banco (não confia no token: admin rebaixado perde acesso na hora). */
async function perfilAtual(usuarioId) {
  const rs = await db().execute({ sql: 'SELECT perfil FROM usuarios WHERE id = ?', args: [usuarioId] });
  return rs.rows.length ? rs.rows[0].perfil : null;
}

async function exigirAdmin(req, res, next) {
  try {
    if ((await perfilAtual(req.usuario.id)) !== 'ADMIN') {
      return res.status(403).json({ erro: 'Acesso restrito a administradores.' });
    }
    next();
  } catch (e) {
    next(e);
  }
}

function exigirJson(req, res, next) {
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && !req.is('application/json')) {
    return res.status(415).json({ erro: 'Content-Type deve ser application/json.' });
  }
  next();
}

module.exports = {
  COOKIE_BASE, COOKIE_SESSAO, criarToken, lerSessao, autenticar, exigirAdmin, exigirJson, perfilAtual,
};
