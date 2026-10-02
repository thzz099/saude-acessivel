/* =============================================================
   routes/paginas.routes.js — Entrega das páginas do frontend
   [6] O servidor decide quem pode ver cada página:
     /login  → público
     /       → só com sessão válida
     /admin  → só administrador (perfil conferido no banco)
   CSS, JS e imagens ficam em /assets (sem dado sensível).
   ============================================================= */
const express = require('express');
const path = require('path');
const { lerSessao, perfilAtual } = require('../middlewares/autenticacao');
const { assincrono } = require('../utils/assincrono');

const router = express.Router();
const PAGINAS = path.resolve(__dirname, '../../../frontend/paginas');
const ASSETS = path.resolve(__dirname, '../../../frontend/assets');

const semCache = (res) => res.set('Cache-Control', 'no-store');

router.get(['/', '/index.html'], (req, res) => {
  if (!lerSessao(req)) return res.redirect(302, '/login');
  semCache(res);
  res.sendFile(path.join(PAGINAS, 'index.html'));
});

router.get(['/login', '/login.html'], (req, res) => {
  if (lerSessao(req)) return res.redirect(302, '/');
  res.sendFile(path.join(PAGINAS, 'login.html'));
});

router.get(['/admin', '/admin.html'], assincrono(async (req, res) => {
  const s = lerSessao(req);
  if (!s) return res.redirect(302, '/login');
  if ((await perfilAtual(Number(s.sub))) !== 'ADMIN') return res.redirect(302, '/');
  semCache(res);
  res.sendFile(path.join(PAGINAS, 'admin.html'));
}));

router.use('/assets', express.static(ASSETS, { index: false, dotfiles: 'deny' }));

module.exports = router;
