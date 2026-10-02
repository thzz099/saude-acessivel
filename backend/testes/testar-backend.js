/* =============================================================
   testes/testar-backend.js   →   npm run test:backend   (Node 22+)

   Testa a camada de dados de verdade: tabelas, carga inicial,
   cadastro/edição/exclusão, validação, auditoria, transações e
   histórico vacinal — num banco SQLite em memória.
   ============================================================= */
process.removeAllListeners('warning'); // silencia o aviso "SQLite é experimental"
const assert = require('node:assert/strict');
const { criarClienteSQLite } = require('./cliente-sqlite');
const { usarClienteDeTeste } = require('../src/db/conexao');

const cliente = criarClienteSQLite();
usarClienteDeTeste(cliente);

const { migrar, promoverAdmins } = require('../src/db/migracoes');
const { semear } = require('../src/db/seed');
const repo = require('../src/services/repositorio');
const { ENTIDADES } = require('../src/services/entidades');
const { buscarDadosPublicos } = require('../src/services/dadosPublicos');
const usuarios = require('../src/services/usuarios');
const auditoria = require('../src/services/auditoria');
const tempoReal = require('../src/services/tempoReal');

let ok = 0;
let falhas = 0;
async function teste(nome, fn) {
  try {
    await fn();
    ok++;
    console.log(`  ✅ ${nome}`);
  } catch (e) {
    falhas++;
    console.log(`  ❌ ${nome}\n     ${e.message}`);
  }
}
const sql = async (s, args = []) => (await cliente.execute({ sql: s, args })).rows;
const contar = async (t, where = '1=1') => Number((await sql(`SELECT COUNT(*) AS n FROM ${t} WHERE ${where}`))[0].n);
async function esperaErroValidacao(fn, campo) {
  try { await fn(); } catch (e) {
    assert.equal(e.status, 400, `esperava erro 400, veio: ${e.message}`);
    if (campo) assert.ok(e.detalhes[campo], `esperava erro no campo "${campo}", veio: ${JSON.stringify(e.detalhes)}`);
    return e;
  }
  throw new Error('deveria ter recusado, mas aceitou');
}

const UNIDADE_OK = {
  nome: 'UBS Teste', status: 'aberto', endereco: 'Rua das Flores, 100', telefone: '(66) 3401-0000',
  horario: 'Seg–Sex: 7h–17h', latitude: -15.89, longitude: -52.25, observacao: '', destacar_observacao: false,
  dados_oficiais: true, servicos: ['Vacinação', 'Clínico Geral'],
};

(async () => {
  console.log('\n▶ Banco e carga inicial');
  await teste('cria as 13 tabelas e roda de novo sem erro', async () => {
    await migrar();
    await migrar();
    const t = await sql("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    assert.equal(t.length, 13);
  });
  await teste('carga inicial grava os dados que antes eram fixos no data.js', async () => {
    const r = await semear();
    assert.equal(r.aplicada, true);
    assert.deepEqual(
      [await contar('unidades'), await contar('profissionais'), await contar('campanhas'),
       await contar('eventos'), await contar('calendario_vacinal'), await contar('avisos')],
      [7, 12, 6, 36, 14, 1]);
    assert.ok((await contar('servicos')) > 5);
  });
  await teste('carga inicial roda só UMA vez (não duplica e não ressuscita dados apagados)', async () => {
    await cliente.execute('DELETE FROM avisos');
    const r = await semear();
    assert.equal(r.aplicada, false);
    assert.equal(await contar('avisos'), 0);
    assert.equal(await contar('unidades'), 7);
    await cliente.execute("INSERT INTO avisos (tipo, texto) VALUES ('info', 'Aviso restaurado para os testes')");
  });
  await teste('todos os profissionais e campanhas ficaram ligados a unidades existentes', async () => {
    assert.equal(await contar('profissionais', 'unidade_id IS NULL'), 0);
    assert.ok((await contar('campanha_unidades')) > 0);
  });

  console.log('\n▶ Dados públicos (o que o portal recebe)');
  await teste('mantém o formato que o frontend usava', async () => {
    const d = await buscarDadosPublicos();
    const u = d.unidades.find((x) => x.nome === 'UBS Centro');
    assert.ok(u && typeof u.lat === 'number' && Array.isArray(u.servicos) && u.servicos.length);
    const p = d.profissionais[0];
    assert.ok(p.oficial === true && p.posto && p.init.length >= 1);
    const perm = d.campanhas.find((c) => c.nome.startsWith('Hepatite'));
    assert.equal(perm.inicio, 'Permanente');
    const gripe = d.campanhas.find((c) => c.nome.includes('Gripe'));
    assert.match(gripe.inicio, /^\d{2}\/\d{2}\/\d{4}$/);
    assert.ok(d.campanhas.some((c) => c.postos[0] === 'Todos os postos'));
    assert.equal(d.avisos[0].icone, 'fa-info-circle');
  });

  console.log('\n▶ Cadastro, edição e exclusão (painel admin)');
  await cliente.execute("INSERT INTO usuarios (nome, email, senha_hash) VALUES ('Admin Teste', 'Admin@Teste.com', 'x')");
  await cliente.execute("INSERT INTO usuarios (nome, email, senha_hash) VALUES ('Maria Cidadã', 'maria@teste.com', 'x')");
  const ADMIN = 1;
  const MARIA = 2;

  await teste('ADMIN_EMAILS promove o usuário (sem diferenciar maiúsculas)', async () => {
    assert.equal(await promoverAdmins(['admin@teste.com']), 1);
    assert.equal((await sql('SELECT perfil FROM usuarios WHERE id = ?', [ADMIN]))[0].perfil, 'ADMIN');
  });

  let novaId;
  await teste('cria unidade com serviços e registra auditoria', async () => {
    const u = await repo.criar(ENTIDADES.unidades, UNIDADE_OK, ADMIN);
    novaId = u.id;
    assert.deepEqual([...u.servicos].sort(), ['Clínico Geral', 'Vacinação']);
    const a = await sql("SELECT * FROM auditoria WHERE acao = 'CRIAR' AND entidade = 'unidades'");
    assert.equal(a.length, 1);
    assert.equal(Number(a[0].usuario_id), ADMIN);
  });
  await teste('[8] ignora campos não permitidos (mass assignment)', async () => {
    const u = await repo.criar(ENTIDADES.unidades, { ...UNIDADE_OK, nome: 'UBS Intrusa', excluido_em: '2020-01-01', id: 999, perfil: 'ADMIN' }, ADMIN);
    assert.notEqual(u.id, 999);
    assert.equal(u.excluido_em, null);
    await repo.excluir(ENTIDADES.unidades, u.id, ADMIN);
  });
  await teste('[14] recusa HTML no texto (proteção contra XSS armazenado)', () =>
    esperaErroValidacao(() => repo.criar(ENTIDADES.unidades, { ...UNIDADE_OK, nome: '<img src=x onerror=alert(1)>' }, ADMIN), 'nome'));
  await teste('[14] recusa coordenada fora de Barra do Garças', () =>
    esperaErroValidacao(() => repo.criar(ENTIDADES.unidades, { ...UNIDADE_OK, latitude: -23.5 }, ADMIN), 'latitude'));
  await teste('[14] recusa status inexistente e campo obrigatório vazio', async () => {
    const e = await esperaErroValidacao(() => repo.criar(ENTIDADES.unidades, { ...UNIDADE_OK, status: 'lotado', endereco: '' }, ADMIN));
    assert.ok(e.detalhes.status && e.detalhes.endereco);
  });
  await teste('atualiza e a auditoria descreve o que mudou', async () => {
    await repo.atualizar(ENTIDADES.unidades, novaId, { ...UNIDADE_OK, status: 'fechado' }, ADMIN);
    const [a] = await sql("SELECT resumo FROM auditoria WHERE acao = 'ATUALIZAR' ORDER BY id DESC LIMIT 1");
    assert.match(a.resumo, /status: aberto → fechado/);
  });
  await teste('atualizar registro inexistente → 404', async () => {
    try { await repo.atualizar(ENTIDADES.unidades, 9999, UNIDADE_OK, ADMIN); throw new Error('aceitou'); }
    catch (e) { assert.equal(e.status, 404); }
  });

  await teste('profissional: recusa unidade inexistente', () =>
    esperaErroValidacao(() => repo.criar(ENTIDADES.profissionais, {
      nome: 'Dr. Fulano', especialidade: 'Clínico Geral', categoria: 'clinico', horario: 'Seg 8h', unidade_id: 9999, disponivel: true,
    }, ADMIN), 'unidade_id'));
  let profId;
  await teste('profissional: cria ligado à nova unidade', async () => {
    const p = await repo.criar(ENTIDADES.profissionais, {
      nome: 'Dr. Fulano de Tal', especialidade: 'Clínico Geral', categoria: 'clinico', horario: 'Seg–Sex 8h–12h', unidade_id: novaId, disponivel: true,
    }, ADMIN);
    profId = p.id;
    const d = await buscarDadosPublicos();
    assert.equal(d.profissionais.find((x) => x.id === profId).posto, 'UBS Teste');
  });
  await teste('exclusão lógica: unidade some do site mas continua no banco', async () => {
    await repo.excluir(ENTIDADES.unidades, novaId, ADMIN);
    assert.equal(await contar('unidades', `id = ${novaId}`), 1);
    const lista = await repo.listar(ENTIDADES.unidades);
    assert.ok(!lista.some((u) => u.id === novaId));
    const d = await buscarDadosPublicos();
    assert.ok(!d.unidades.some((u) => u.id === novaId));
    assert.equal(d.profissionais.find((x) => x.id === profId).posto, 'Unidade a definir');
  });

  console.log('\n▶ Campanhas (regras entre campos)');
  const CAMP = { nome: 'Campanha Teste', descricao: 'Descrição suficientemente longa', icone: '💉', cor: '#123abc', cor_fundo: '#ffffff' };
  await teste('com prazo exige início e fim', () =>
    esperaErroValidacao(() => repo.criar(ENTIDADES.campanhas, { ...CAMP, permanente: false }, ADMIN), 'data_inicio'));
  await teste('fim antes do início é recusado', () =>
    esperaErroValidacao(() => repo.criar(ENTIDADES.campanhas, { ...CAMP, data_inicio: '2026-10-10', data_fim: '2026-10-01' }, ADMIN), 'data_fim'));
  await teste('data impossível (31/02) é recusada', () =>
    esperaErroValidacao(() => repo.criar(ENTIDADES.campanhas, { ...CAMP, data_inicio: '2026-02-31', data_fim: '2026-03-10' }, ADMIN), 'data_inicio'));
  await teste('cor e ícone inválidos são recusados', async () => {
    const e = await esperaErroValidacao(() => repo.criar(ENTIDADES.campanhas, { ...CAMP, permanente: true, cor: 'red;x', icone: 'abc' }, ADMIN));
    assert.ok(e.detalhes.cor && e.detalhes.icone);
  });
  await teste('permanente descarta as datas e liga unidades', async () => {
    const c = await repo.criar(ENTIDADES.campanhas, { ...CAMP, permanente: true, data_inicio: '2026-01-01', data_fim: '2026-02-01', unidade_ids: [1, 2] }, ADMIN);
    assert.equal(c.data_inicio, null);
    assert.deepEqual(c.unidade_ids.sort(), [1, 2]);
    const d = await buscarDadosPublicos();
    assert.equal(d.campanhas.find((x) => x.id === c.id).postos.length, 2);
  });

  console.log('\n▶ Calendário e avisos');
  await teste('evento: cria, aparece no site e exclui de verdade', async () => {
    const e = await repo.criar(ENTIDADES.eventos, { data: '2026-12-20', titulo: 'Mutirão de vacinação', tipo: 'campanha', descricao: 'Na UBS Centro' }, ADMIN);
    assert.ok((await buscarDadosPublicos()).eventos.some((x) => x.id === e.id));
    await repo.excluir(ENTIDADES.eventos, e.id, ADMIN);
    assert.equal(await contar('eventos', `id = ${e.id}`), 0);
  });
  await teste('aviso inativo não aparece no site', async () => {
    const a = await repo.criar(ENTIDADES.avisos, { tipo: 'warn', texto: 'Aviso desativado de teste', ativo: false, ordem: 5 }, ADMIN);
    assert.ok(!(await buscarDadosPublicos()).avisos.some((x) => x.texto === a.texto));
  });

  console.log('\n▶ Usuários e histórico vacinal');
  await teste('busca trata % e _ como texto (sem curinga)', async () => {
    assert.equal((await usuarios.buscarUsuarios('%')).length, 0);
    assert.equal((await usuarios.buscarUsuarios('maria')).length, 1);
  });
  await teste('admin não pode tirar o próprio perfil (evita ficar sem admin)', () =>
    esperaErroValidacao(() => usuarios.alterarPerfil(ADMIN, 'CIDADAO', ADMIN), 'perfil'));
  await teste('alterar perfil de outro usuário é auditado', async () => {
    await usuarios.alterarPerfil(MARIA, 'ADMIN', ADMIN);
    await usuarios.alterarPerfil(MARIA, 'CIDADAO', ADMIN);
    assert.equal(await contar('auditoria', "acao = 'ALTERAR_PERFIL'"), 2);
  });
  await teste('vacina com data no futuro é recusada', () =>
    esperaErroValidacao(() => usuarios.registrarVacina(MARIA, { vacina: 'Gripe', data: '2999-01-01', dose: 'Única', local: 'UBS Centro' }, ADMIN), 'data'));
  let vacId;
  await teste('cada cidadão vê só o próprio histórico, no formato do portal', async () => {
    const v = await usuarios.registrarVacina(MARIA, { vacina: 'Influenza 2026', data: '2026-04-16', dose: '1× ao ano', local: 'UBS Centro' }, ADMIN);
    vacId = v.id;
    const h = await usuarios.historicoDoCidadao(MARIA);
    assert.deepEqual(h[0], { vacina: 'Influenza 2026', data: '16/04/2026', posto: 'UBS Centro', dose: '1× ao ano' });
    assert.equal((await usuarios.historicoDoCidadao(ADMIN)).length, 0);
  });
  await teste('não exclui vacina passando o id de outro usuário', async () => {
    try { await usuarios.excluirVacina(ADMIN, vacId, ADMIN); throw new Error('aceitou'); }
    catch (e) { assert.equal(e.status, 404); }
    await usuarios.excluirVacina(MARIA, vacId, ADMIN);
    assert.equal(await contar('vacinas_aplicadas'), 0);
  });

  console.log('\n▶ Integridade');
  await teste('transação: se a auditoria falhar, a alteração é desfeita', async () => {
    const antes = await contar('unidades');
    const original = auditoria.registrar;
    auditoria.registrar = async () => { throw new Error('falha simulada'); };
    try { await repo.criar(ENTIDADES.unidades, { ...UNIDADE_OK, nome: 'UBS Fantasma' }, ADMIN); } catch { /* esperado */ }
    auditoria.registrar = original;
    assert.equal(await contar('unidades'), antes);
    assert.equal(await contar('unidades', "nome = 'UBS Fantasma'"), 0);
  });
  await teste('tempo real: mudança gera nova versão e o portal recebe dados novos', async () => {
    const v1 = (await buscarDadosPublicos()).versao;
    await new Promise((r) => setTimeout(r, 5));
    tempoReal.notificarMudanca('unidades');
    const v2 = (await buscarDadosPublicos()).versao;
    assert.notEqual(v1, v2);
  });
  await teste('auditoria lista as ações com nome de quem fez', async () => {
    const a = await auditoria.listarRecentes(5);
    assert.equal(a.length, 5);
    assert.equal(a[0].usuario_nome, 'Admin Teste');
  });
  await teste('resumo do painel conta os registros', async () => {
    const r = await usuarios.resumo();
    assert.equal(r.unidades, 7);
    assert.equal(r.administradores, 1);
  });

  console.log(`\n${falhas ? '❌' : '✅'} ${ok} testes passaram, ${falhas} falharam.\n`);
  process.exit(falhas ? 1 : 0);
})();
