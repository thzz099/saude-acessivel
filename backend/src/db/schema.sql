-- =============================================================
-- schema.sql — Banco de dados do SaúdeMap IA (Turso / libSQL / SQLite)
--
-- Executado a cada inicialização. "IF NOT EXISTS" torna seguro rodar
-- de novo: tabelas existentes não são alteradas nem apagadas.
--
-- Convenções:
--   * datas no formato ISO (AAAA-MM-DD) — ordenam certo como texto
--   * booleanos como INTEGER 0/1 (SQLite não tem tipo booleano)
--   * excluido_em preenchido = registro "na lixeira" (exclusão lógica,
--     some do site mas continua no banco e na auditoria)
--   * CHECK = regra garantida pelo próprio banco, mesmo se o código errar
-- =============================================================

-- ─────────────── Usuários ───────────────
CREATE TABLE IF NOT EXISTS usuarios (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nome        TEXT    NOT NULL,
  email       TEXT    NOT NULL UNIQUE,
  senha_hash  TEXT    NOT NULL,
  perfil      TEXT    NOT NULL DEFAULT 'CIDADAO' CHECK (perfil IN ('CIDADAO', 'ADMIN')),
  criado_em   TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_usuarios_email_lower ON usuarios (lower(email));

-- ─────────────── Unidades de saúde (UBS, UPA, hospital) ───────────────
CREATE TABLE IF NOT EXISTS unidades (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  nome                TEXT    NOT NULL,
  status              TEXT    NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'fechado', 'urgencia')),
  endereco            TEXT    NOT NULL,
  telefone            TEXT    NOT NULL DEFAULT '',
  horario             TEXT    NOT NULL,
  latitude            REAL    NOT NULL CHECK (latitude  BETWEEN -90  AND 90),
  longitude           REAL    NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  observacao          TEXT    NOT NULL DEFAULT '',
  destacar_observacao INTEGER NOT NULL DEFAULT 0 CHECK (destacar_observacao IN (0, 1)),
  dados_oficiais      INTEGER NOT NULL DEFAULT 0 CHECK (dados_oficiais IN (0, 1)),
  criado_em           TEXT    NOT NULL DEFAULT (datetime('now')),
  atualizado_em       TEXT    NOT NULL DEFAULT (datetime('now')),
  excluido_em         TEXT
);

-- ─────────────── Serviços (Vacinação, Pré-natal...) — N:N com unidades ───────────────
CREATE TABLE IF NOT EXISTS servicos (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT    NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS unidade_servicos (
  unidade_id INTEGER NOT NULL REFERENCES unidades (id),
  servico_id INTEGER NOT NULL REFERENCES servicos (id),
  PRIMARY KEY (unidade_id, servico_id)
);

-- ─────────────── Profissionais ───────────────
CREATE TABLE IF NOT EXISTS profissionais (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  nome           TEXT    NOT NULL,
  especialidade  TEXT    NOT NULL,
  categoria      TEXT    NOT NULL CHECK (categoria IN ('clinico', 'pediatra', 'dentista', 'cardio', 'gineco')),
  horario        TEXT    NOT NULL,
  unidade_id     INTEGER REFERENCES unidades (id),
  disponivel     INTEGER NOT NULL DEFAULT 1 CHECK (disponivel IN (0, 1)),
  dados_oficiais INTEGER NOT NULL DEFAULT 0 CHECK (dados_oficiais IN (0, 1)),
  criado_em      TEXT    NOT NULL DEFAULT (datetime('now')),
  atualizado_em  TEXT    NOT NULL DEFAULT (datetime('now')),
  excluido_em    TEXT
);
CREATE INDEX IF NOT EXISTS ix_profissionais_unidade ON profissionais (unidade_id);

-- ─────────────── Campanhas de vacinação — N:N com unidades ───────────────
CREATE TABLE IF NOT EXISTS campanhas (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  nome           TEXT    NOT NULL,
  descricao      TEXT    NOT NULL,
  icone          TEXT    NOT NULL DEFAULT '💉',
  cor            TEXT    NOT NULL DEFAULT '#0dbdad' CHECK (cor       GLOB '#[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]'),
  cor_fundo      TEXT    NOT NULL DEFAULT '#e0f7f5' CHECK (cor_fundo GLOB '#[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]'),
  permanente     INTEGER NOT NULL DEFAULT 0 CHECK (permanente IN (0, 1)),
  data_inicio    TEXT,
  data_fim       TEXT,
  todas_unidades INTEGER NOT NULL DEFAULT 0 CHECK (todas_unidades IN (0, 1)),
  criado_em      TEXT    NOT NULL DEFAULT (datetime('now')),
  atualizado_em  TEXT    NOT NULL DEFAULT (datetime('now')),
  excluido_em    TEXT,
  -- campanha permanente não tem datas, campanha com prazo precisa de início ≤ fim
  CHECK ((permanente = 1 AND data_inicio IS NULL AND data_fim IS NULL)
      OR (permanente = 0 AND data_inicio IS NOT NULL AND data_fim IS NOT NULL AND data_inicio <= data_fim))
);
CREATE TABLE IF NOT EXISTS campanha_unidades (
  campanha_id INTEGER NOT NULL REFERENCES campanhas (id),
  unidade_id  INTEGER NOT NULL REFERENCES unidades (id),
  PRIMARY KEY (campanha_id, unidade_id)
);

-- ─────────────── Calendário da saúde (eventos, feriados) ───────────────
CREATE TABLE IF NOT EXISTS eventos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  data          TEXT    NOT NULL,
  titulo        TEXT    NOT NULL,
  tipo          TEXT    NOT NULL CHECK (tipo IN ('campanha', 'feriado', 'evento')),
  descricao     TEXT    NOT NULL DEFAULT '',
  criado_em     TEXT    NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_eventos_data ON eventos (data);

-- ─────────────── Calendário vacinal (por faixa etária) ───────────────
CREATE TABLE IF NOT EXISTS calendario_vacinal (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  faixa         TEXT    NOT NULL,
  vacina        TEXT    NOT NULL,
  doses         TEXT    NOT NULL,
  observacao    TEXT    NOT NULL DEFAULT '',
  ordem         INTEGER NOT NULL DEFAULT 0,
  criado_em     TEXT    NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─────────────── Avisos da página inicial ───────────────
CREATE TABLE IF NOT EXISTS avisos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo          TEXT    NOT NULL DEFAULT 'info' CHECK (tipo IN ('info', 'warn', 'success')),
  texto         TEXT    NOT NULL,
  ativo         INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  ordem         INTEGER NOT NULL DEFAULT 0,
  criado_em     TEXT    NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─────────────── Vacinas aplicadas (histórico vacinal de cada cidadão) ───────────────
CREATE TABLE IF NOT EXISTS vacinas_aplicadas (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id     INTEGER NOT NULL REFERENCES usuarios (id),
  vacina         TEXT    NOT NULL,
  data           TEXT    NOT NULL,
  dose           TEXT    NOT NULL,
  local          TEXT    NOT NULL,
  registrado_por INTEGER REFERENCES usuarios (id),
  criado_em      TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_vacinas_usuario ON vacinas_aplicadas (usuario_id, data);

-- ─────────────── Auditoria (quem alterou o quê, e quando) ───────────────
CREATE TABLE IF NOT EXISTS auditoria (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id  INTEGER REFERENCES usuarios (id),
  acao        TEXT    NOT NULL CHECK (acao IN ('CRIAR', 'ATUALIZAR', 'EXCLUIR', 'ALTERAR_PERFIL')),
  entidade    TEXT    NOT NULL,
  entidade_id INTEGER,
  resumo      TEXT    NOT NULL,
  instante    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_auditoria_instante ON auditoria (instante);

-- ─────────────── Controle interno (ex.: carga inicial já aplicada) ───────────────
CREATE TABLE IF NOT EXISTS metadados (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);
