/* =============================================================
   routes/admin.routes.js — API do painel do administrador
   Todas as rotas exigem login + perfil ADMIN conferido no banco.

   Para cada entidade do catálogo (entidades.js) são criadas:
     GET    /api/admin/<entidade>        lista
     POST   /api/admin/<entidade>        cria
     PUT    /api/admin/<entidade>/:id    atualiza
     DELETE /api/admin/<entidade>/:id    exclui
   ============================================================= */
const express = require('express');
const { autenticar, exigirAdmin, exigirJson } = require('../middlewares/autenticacao');
const { assincrono } = require('../utils/assincrono');
const { ENTIDADES } = require('../services/entidades');
const repo = require('../services/repositorio');
const usuarios = require('../services/usuarios');
const auditoria = require('../services/auditoria');
const tempoReal = require('../services/tempoReal');

const router = express.Router();
router.use(autenticar, exigirAdmin, exigirJson);

function idDaRota(req, res, nome = 'id') {
  const id = Number(req.params[nome]);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ erro: 'Identificador inválido.' });
    return null;
  }
  return id;
}

// ── CRUD genérico ─────────────────────────────────────────────
for (const [nome, ent] of Object.entries(ENTIDADES)) {
  const rota = `/${nome.replace(/_/g, '-')}`; // calendario_vacinal → /calendario-vacinal

  router.get(rota, assincrono(async (req, res) => res.json(await repo.listar(ent))));

  router.post(rota, assincrono(async (req, res) => {
    res.status(201).json(await repo.criar(ent, req.body, req.usuario.id));
  }));

  router.put(`${rota}/:id`, assincrono(async (req, res) => {
    const id = idDaRota(req, res);
    if (id) res.json(await repo.atualizar(ent, id, req.body, req.usuario.id));
  }));

  router.delete(`${rota}/:id`, assincrono(async (req, res) => {
    const id = idDaRota(req, res);
    if (id) res.json(await repo.excluir(ent, id, req.usuario.id));
  }));
}

// ── Usuários e histórico vacinal ──────────────────────────────
router.get('/usuarios', assincrono(async (req, res) => {
  res.json(await usuarios.buscarUsuarios(req.query.busca));
}));

router.patch('/usuarios/:id/perfil', assincrono(async (req, res) => {
  const id = idDaRota(req, res);
  if (id) res.json(await usuarios.alterarPerfil(id, req.body && req.body.perfil, req.usuario.id));
}));

router.get('/usuarios/:id/vacinas', assincrono(async (req, res) => {
  const id = idDaRota(req, res);
  if (id) res.json(await usuarios.listarVacinas(id));
}));

router.post('/usuarios/:id/vacinas', assincrono(async (req, res) => {
  const id = idDaRota(req, res);
  if (id) res.status(201).json(await usuarios.registrarVacina(id, req.body, req.usuario.id));
}));

router.delete('/usuarios/:id/vacinas/:vacinaId', assincrono(async (req, res) => {
  const id = idDaRota(req, res);
  const vid = id && idDaRota(req, res, 'vacinaId');
  if (vid) res.json(await usuarios.excluirVacina(id, vid, req.usuario.id));
}));

// ── Visão geral ───────────────────────────────────────────────
router.get('/resumo', assincrono(async (req, res) => {
  res.json({ ...(await usuarios.resumo()), conectadosAgora: tempoReal.totalConectados() });
}));

router.get('/auditoria', assincrono(async (req, res) => {
  res.json(await auditoria.listarRecentes(req.query.limite));
}));

module.exports = router;
