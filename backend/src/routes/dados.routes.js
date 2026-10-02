/* =============================================================
   routes/dados.routes.js — Dados do portal + atualização em tempo real
   ============================================================= */
const express = require('express');
const { autenticar } = require('../middlewares/autenticacao');
const { assincrono } = require('../utils/assincrono');
const { buscarDadosPublicos } = require('../services/dadosPublicos');
const { historicoDoCidadao } = require('../services/usuarios');
const tempoReal = require('../services/tempoReal');

const router = express.Router();

// Tudo que o portal exibe, numa única chamada
router.get('/api/dados', autenticar, assincrono(async (req, res) => {
  res.json(await buscarDadosPublicos());
}));

// Histórico vacinal do PRÓPRIO usuário (id vem do token assinado, nunca do cliente)
router.get('/api/me/vacinas', autenticar, assincrono(async (req, res) => {
  res.json({ vacinas: await historicoDoCidadao(req.usuario.id) });
}));

// Canal de tempo real (Server-Sent Events)
router.get('/api/tempo-real', autenticar, (req, res) => tempoReal.conectar(req, res));

module.exports = router;
