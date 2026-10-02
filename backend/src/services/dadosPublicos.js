/* =============================================================
   services/dadosPublicos.js — Dados exibidos no portal do cidadão

   Busca tudo em UMA ida ao banco (batch) e entrega no formato que
   o frontend já usava. Resultado fica em cache até alguma alteração
   no painel (a versão muda e o cache é descartado).
   ============================================================= */
const { db } = require('../db/conexao');
const { paraObjetos } = require('../utils/linhas');
const { versaoAtual } = require('./tempoReal');

let cache = null; // { versao, dados }

const isoParaBR = (s) => (s ? s.split('-').reverse().join('/') : '');
const ICONE_AVISO = { info: 'fa-info-circle', warn: 'fa-exclamation-triangle', success: 'fa-check-circle' };

function iniciais(nome) {
  const partes = String(nome).replace(/^(dr[aª]?\.?|dr[ºo]\.?)\s+/i, '').split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (partes[0][0] + ultima).toUpperCase();
}

async function buscarDadosPublicos() {
  const versao = versaoAtual();
  if (cache && cache.versao === versao) return cache.dados;

  const [rsU, rsS, rsP, rsC, rsCU, rsE, rsV, rsA] = await db().batch([
    'SELECT * FROM unidades WHERE excluido_em IS NULL ORDER BY id',
    `SELECT us.unidade_id AS uid, s.nome AS nome FROM unidade_servicos us
       JOIN servicos s ON s.id = us.servico_id ORDER BY s.nome`,
    `SELECT p.*, u.nome AS unidade_nome FROM profissionais p
       LEFT JOIN unidades u ON u.id = p.unidade_id AND u.excluido_em IS NULL
      WHERE p.excluido_em IS NULL ORDER BY p.dados_oficiais DESC, p.nome`,
    'SELECT * FROM campanhas WHERE excluido_em IS NULL ORDER BY id',
    `SELECT cu.campanha_id AS cid, u.nome AS nome FROM campanha_unidades cu
       JOIN unidades u ON u.id = cu.unidade_id AND u.excluido_em IS NULL ORDER BY u.nome`,
    'SELECT * FROM eventos ORDER BY data, id',
    'SELECT * FROM calendario_vacinal ORDER BY ordem, id',
    'SELECT * FROM avisos WHERE ativo = 1 ORDER BY ordem, id',
  ], 'read');

  const servicosPor = {};
  for (const r of paraObjetos(rsS)) (servicosPor[r.uid] = servicosPor[r.uid] || []).push(r.nome);
  const unidadesPor = {};
  for (const r of paraObjetos(rsCU)) (unidadesPor[r.cid] = unidadesPor[r.cid] || []).push(r.nome);

  const dados = {
    versao,
    unidades: paraObjetos(rsU).map((u) => ({
      id: Number(u.id), nome: u.nome, status: u.status, endereco: u.endereco,
      telefone: u.telefone, horario: u.horario, servicos: servicosPor[u.id] || [],
      lat: Number(u.latitude), lng: Number(u.longitude),
      obs: u.observacao, aviso: Boolean(u.destacar_observacao) && u.observacao !== '',
      oficial: Boolean(u.dados_oficiais),
    })),
    profissionais: paraObjetos(rsP).map((p) => ({
      id: Number(p.id), nome: p.nome, esp: p.especialidade, categoria: p.categoria,
      horario: p.horario, posto: p.unidade_nome || 'Unidade a definir',
      disponivel: Boolean(p.disponivel), oficial: Boolean(p.dados_oficiais), init: iniciais(p.nome),
    })),
    campanhas: paraObjetos(rsC).map((c) => ({
      id: Number(c.id), nome: c.nome, desc: c.descricao, icone: c.icone, cor: c.cor, corBg: c.cor_fundo,
      inicio: c.permanente ? 'Permanente' : isoParaBR(c.data_inicio),
      fim: c.permanente ? 'Permanente' : isoParaBR(c.data_fim),
      postos: c.todas_unidades ? ['Todos os postos'] : (unidadesPor[c.id] || []),
    })),
    eventos: paraObjetos(rsE).map((e) => ({ id: Number(e.id), data: e.data, titulo: e.titulo, tipo: e.tipo, desc: e.descricao })),
    calendarioVacinal: paraObjetos(rsV).map((v) => ({ faixa: v.faixa, vacina: v.vacina, doses: v.doses, obs: v.observacao })),
    avisos: paraObjetos(rsA).map((a) => ({ tipo: a.tipo, icone: ICONE_AVISO[a.tipo], texto: a.texto })),
  };

  cache = { versao, dados };
  return dados;
}

module.exports = { buscarDadosPublicos, iniciais, isoParaBR };
