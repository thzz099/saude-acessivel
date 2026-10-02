/* =============================================================
   routes/auth.routes.js — Cadastro, login, sessão e logout
   ============================================================= */
const express = require('express');
const bcrypt = require('bcryptjs');
const env = require('../config/env');
const { db } = require('../db/conexao');
const { paraObjetos } = require('../utils/linhas');
const { assincrono } = require('../utils/assincrono');
const { limiteLogin, limiteRegistro } = require('../middlewares/limites');
const {
  COOKIE_BASE, COOKIE_SESSAO, criarToken, autenticar, exigirJson,
} = require('../middlewares/autenticacao');

const router = express.Router();
const BCRYPT_CUSTO = 10;
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RE_NOME = /^[A-Za-zÀ-ÖØ-öø-ÿ' .-]{2,100}$/;

// [12] Honeypot: campo invisível que só robôs preenchem
const pareceBot = (req) => typeof (req.body && req.body.website) === 'string' && req.body.website.trim() !== '';

// Comparação com hash falso quando o email não existe: tempo de resposta igual
const HASH_FALSO = bcrypt.hashSync(`inexistente-${Date.now()}`, BCRYPT_CUSTO);

const ehAdminPorConfig = (email) => env.ADMIN_EMAILS.includes(String(email).toLowerCase());

router.post('/api/registro', limiteRegistro, exigirJson, assincrono(async (req, res) => {
  if (pareceBot(req)) return res.status(400).json({ erro: 'Requisição inválida.' });
  const { nome, email, senha } = req.body || {}; // [8] só estes 3 campos
  if (typeof nome !== 'string' || typeof email !== 'string' || typeof senha !== 'string') {
    return res.status(400).json({ erro: 'Preencha nome, email e senha.' });
  }
  const n = nome.trim().replace(/\s+/g, ' ');
  const e = email.trim().toLowerCase();
  if (!RE_NOME.test(n)) return res.status(400).json({ erro: 'Nome inválido. Use apenas letras (2 a 100 caracteres).' });
  if (e.length > 254 || !RE_EMAIL.test(e)) return res.status(400).json({ erro: 'Email inválido.' });
  if (senha.length < 8) return res.status(400).json({ erro: 'A senha precisa ter pelo menos 8 caracteres.' });
  if (Buffer.byteLength(senha, 'utf8') > 72) return res.status(400).json({ erro: 'A senha pode ter no máximo 72 caracteres.' });

  const existe = await db().execute({ sql: 'SELECT id FROM usuarios WHERE lower(email) = ? LIMIT 1', args: [e] });
  if (existe.rows.length) return res.status(409).json({ erro: 'Já existe uma conta com este email.' });

  const perfil = ehAdminPorConfig(e) ? 'ADMIN' : 'CIDADAO'; // perfil decidido pelo SERVIDOR
  const hash = await bcrypt.hash(senha, BCRYPT_CUSTO);       // [10]
  const r = await db().execute({
    sql: 'INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES (?, ?, ?, ?)',
    args: [n, e, hash, perfil],
  });
  const usuario = { id: Number(r.lastInsertRowid), nome: n, perfil };
  res.cookie('token', criarToken(usuario), COOKIE_SESSAO);
  res.status(201).json({ usuario: { nome: n, perfil } });
}));

router.post('/api/login', limiteLogin, exigirJson, assincrono(async (req, res) => {
  if (pareceBot(req)) return res.status(400).json({ erro: 'Requisição inválida.' });
  const { email, senha } = req.body || {};
  if (typeof email !== 'string' || typeof senha !== 'string' || !email.trim() || !senha) {
    return res.status(400).json({ erro: 'Informe email e senha.' });
  }
  if (email.length > 254 || Buffer.byteLength(senha, 'utf8') > 72) {
    return res.status(401).json({ erro: 'Email ou senha incorretos.' });
  }
  const e = email.trim().toLowerCase();
  const rs = await db().execute({
    sql: 'SELECT id, nome, senha_hash, perfil FROM usuarios WHERE lower(email) = ? LIMIT 1', args: [e],
  });
  const [u] = paraObjetos(rs);
  const ok = await bcrypt.compare(senha, u ? u.senha_hash : HASH_FALSO);
  if (!u || !ok) return res.status(401).json({ erro: 'Email ou senha incorretos.' }); // mesma mensagem

  let perfil = u.perfil || 'CIDADAO';
  if (perfil !== 'ADMIN' && ehAdminPorConfig(e)) {
    await db().execute({ sql: "UPDATE usuarios SET perfil = 'ADMIN' WHERE id = ?", args: [u.id] });
    perfil = 'ADMIN';
  }
  res.cookie('token', criarToken({ id: u.id, nome: u.nome }), COOKIE_SESSAO);
  res.json({ usuario: { nome: u.nome, perfil } });
}));

// Dados atuais do usuário (perfil vem do banco, não do token)
router.get('/api/me', autenticar, assincrono(async (req, res) => {
  const rs = await db().execute({ sql: 'SELECT nome, perfil FROM usuarios WHERE id = ?', args: [req.usuario.id] });
  const [u] = paraObjetos(rs);
  if (!u) {
    res.clearCookie('token', COOKIE_BASE);
    return res.status(401).json({ erro: 'Sessão inválida.' });
  }
  res.json({ usuario: { nome: u.nome, perfil: u.perfil } }); // [17] só o necessário
}));

router.post('/api/logout', (req, res) => {
  res.clearCookie('token', COOKIE_BASE);
  res.json({ ok: true });
});

module.exports = router;
