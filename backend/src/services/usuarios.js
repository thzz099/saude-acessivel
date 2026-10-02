/* =============================================================
   services/usuarios.js — Gestão de usuários e histórico vacinal
   ============================================================= */
const { db } = require('../db/conexao');
const { paraObjetos } = require('../utils/linhas');
const { validar, ErroValidacao, ErroNaoEncontrado } = require('../utils/validacao');
const { CAMPOS_VACINA } = require('./entidades');
const auditoria = require('./auditoria');
const { emTransacao } = require('./repositorio');
const { isoParaBR } = require('./dadosPublicos');

async function obterUsuario(id) {
  const rs = await db().execute({
    sql: 'SELECT id, nome, email, perfil, criado_em FROM usuarios WHERE id = ?', args: [id],
  });
  const [u] = paraObjetos(rs);
  if (!u) throw new ErroNaoEncontrado('Usuário não encontrado.');
  return u;
}

async function buscarUsuarios(termo) {
  const t = String(termo || '').trim().toLowerCase().slice(0, 80);
  // escapa curingas do LIKE para o termo ser tratado como texto literal
  const padrao = `%${t.replace(/[\\%_]/g, (c) => '\\' + c)}%`;
  const rs = await db().execute({
    sql: `SELECT id, nome, email, perfil, criado_em FROM usuarios
           WHERE lower(nome) LIKE ? ESCAPE '\\' OR lower(email) LIKE ? ESCAPE '\\'
           ORDER BY nome LIMIT 50`,
    args: [padrao, padrao],
  });
  return paraObjetos(rs);
}

async function alterarPerfil(alvoId, perfil, adminId) {
  if (!['CIDADAO', 'ADMIN'].includes(perfil)) throw new ErroValidacao({ perfil: 'Perfil inválido.' });
  if (Number(alvoId) === Number(adminId)) {
    throw new ErroValidacao({ perfil: 'Você não pode alterar o seu próprio perfil (evita ficar sem administrador).' });
  }
  const alvo = await obterUsuario(alvoId);
  return emTransacao(async (tx) => {
    await tx.execute({ sql: 'UPDATE usuarios SET perfil = ? WHERE id = ?', args: [perfil, alvoId] });
    await auditoria.registrar(tx, {
      usuarioId: adminId, acao: 'ALTERAR_PERFIL', entidade: 'usuarios', entidadeId: Number(alvoId),
      resumo: `Perfil de ${alvo.nome} (${alvo.email}): ${alvo.perfil} → ${perfil}`,
    });
    return { ...alvo, perfil };
  });
}

async function listarVacinas(usuarioId) {
  const rs = await db().execute({
    sql: 'SELECT id, vacina, data, dose, local FROM vacinas_aplicadas WHERE usuario_id = ? ORDER BY data DESC, id DESC',
    args: [usuarioId],
  });
  return paraObjetos(rs);
}

/** Formato usado pela aba "Meu Histórico" do portal. */
async function historicoDoCidadao(usuarioId) {
  return (await listarVacinas(usuarioId)).map((v) => ({
    vacina: v.vacina, data: isoParaBR(v.data), posto: v.local, dose: v.dose,
  }));
}

async function registrarVacina(usuarioId, corpo, adminId) {
  const alvo = await obterUsuario(usuarioId);
  const { dados, erros } = validar(CAMPOS_VACINA, corpo);
  if (Object.keys(erros).length) throw new ErroValidacao(erros);
  return emTransacao(async (tx) => {
    const rs = await tx.execute({
      sql: 'INSERT INTO vacinas_aplicadas (usuario_id, vacina, data, dose, local, registrado_por) VALUES (?, ?, ?, ?, ?, ?)',
      args: [usuarioId, dados.vacina, dados.data, dados.dose, dados.local, adminId],
    });
    const id = Number(rs.lastInsertRowid);
    await auditoria.registrar(tx, {
      usuarioId: adminId, acao: 'CRIAR', entidade: 'vacinas_aplicadas', entidadeId: id,
      resumo: `Vacina registrada para ${alvo.nome}: ${dados.vacina} (${dados.dose}) em ${dados.data}`,
    });
    return { id, ...dados };
  }, 'vacinas_aplicadas');
}

async function excluirVacina(usuarioId, vacinaId, adminId) {
  return emTransacao(async (tx) => {
    const rs = await tx.execute({
      sql: 'SELECT v.vacina, v.data, u.nome FROM vacinas_aplicadas v JOIN usuarios u ON u.id = v.usuario_id WHERE v.id = ? AND v.usuario_id = ?',
      args: [vacinaId, usuarioId],
    });
    const [v] = paraObjetos(rs);
    if (!v) throw new ErroNaoEncontrado('Registro de vacina não encontrado.');
    await tx.execute({ sql: 'DELETE FROM vacinas_aplicadas WHERE id = ?', args: [vacinaId] });
    await auditoria.registrar(tx, {
      usuarioId: adminId, acao: 'EXCLUIR', entidade: 'vacinas_aplicadas', entidadeId: Number(vacinaId),
      resumo: `Vacina removida de ${v.nome}: ${v.vacina} em ${v.data}`,
    });
    return { id: Number(vacinaId), excluido: true };
  }, 'vacinas_aplicadas');
}

async function resumo() {
  const [u, p, c, e, a, v] = await db().batch([
    'SELECT COUNT(*) AS n FROM unidades WHERE excluido_em IS NULL',
    'SELECT COUNT(*) AS n FROM profissionais WHERE excluido_em IS NULL',
    'SELECT COUNT(*) AS n FROM campanhas WHERE excluido_em IS NULL',
    'SELECT COUNT(*) AS n FROM eventos',
    'SELECT COUNT(*) AS n, SUM(perfil = \'ADMIN\') AS admins FROM usuarios',
    'SELECT COUNT(*) AS n FROM vacinas_aplicadas',
  ], 'read');
  const n = (rs, col = 'n') => Number(paraObjetos(rs)[0][col] || 0);
  return {
    unidades: n(u), profissionais: n(p), campanhas: n(c), eventos: n(e),
    usuarios: n(a), administradores: n(a, 'admins'), vacinasRegistradas: n(v),
  };
}

module.exports = {
  obterUsuario, buscarUsuarios, alterarPerfil, listarVacinas, historicoDoCidadao,
  registrarVacina, excluirVacina, resumo,
};
