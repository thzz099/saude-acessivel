/* =============================================================
   utils/validacao.js — Validação de dados de entrada  [8][14]

   Cada entidade declara seus campos e regras. Só os campos
   declarados são lidos do corpo da requisição — qualquer outro
   (ex.: "perfil": "ADMIN", "excluido_em": ...) é ignorado.
   Isso é a proteção contra "mass assignment".
   ============================================================= */

class ErroValidacao extends Error {
  constructor(detalhes) {
    super('Dados inválidos.');
    this.status = 400;
    this.detalhes = detalhes; // { campo: 'mensagem' }
  }
}

class ErroNaoEncontrado extends Error {
  constructor(msg = 'Registro não encontrado.') {
    super(msg);
    this.status = 404;
  }
}

// Texto exibido no site não pode conter < ou > (defesa contra XSS armazenado;
// o frontend também escapa tudo ao exibir — duas camadas).
const RE_HTML = /[<>]/;
const RE_TELEFONE = /^[\d\s()+-]{8,20}$/;
const RE_COR = /^#[0-9a-fA-F]{6}$/;
const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

function dataValida(s) {
  if (typeof s !== 'string' || !RE_DATA.test(s)) return false;
  const [a, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

const vazio = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

/** Valida um valor conforme a regra. Retorna { valor } ou { erro }. */
function validarCampo(regra, bruto) {
  if (vazio(bruto)) {
    if (regra.obrigatorio) return { erro: 'Campo obrigatório.' };
    if (regra.tipo === 'booleano') return { valor: 0 };
    if (regra.tipo === 'lista' || regra.tipo === 'ids') return { valor: [] };
    if (regra.tipo === 'texto' || regra.tipo === 'telefone') return { valor: '' };
    return { valor: regra.padrao !== undefined ? regra.padrao : null };
  }

  switch (regra.tipo) {
    case 'texto': {
      if (typeof bruto !== 'string') return { erro: 'Deve ser texto.' };
      const v = bruto.trim().replace(/[ \t]+/g, ' ');
      if (RE_HTML.test(v)) return { erro: 'Não use os caracteres < ou >.' };
      if (regra.min && v.length < regra.min) return { erro: `Mínimo de ${regra.min} caracteres.` };
      if (regra.max && v.length > regra.max) return { erro: `Máximo de ${regra.max} caracteres.` };
      return { valor: v };
    }
    case 'telefone': {
      const v = String(bruto).trim();
      if (!RE_TELEFONE.test(v)) return { erro: 'Telefone inválido. Ex.: (66) 3401-0000' };
      return { valor: v };
    }
    case 'enum':
      if (!regra.valores.includes(bruto)) return { erro: `Valor inválido. Use: ${regra.valores.join(', ')}.` };
      return { valor: bruto };
    case 'numero': {
      const n = typeof bruto === 'number' ? bruto : Number(String(bruto).replace(',', '.'));
      if (!Number.isFinite(n)) return { erro: 'Deve ser um número.' };
      if (regra.min !== undefined && n < regra.min) return { erro: `Mínimo ${regra.min}.` };
      if (regra.max !== undefined && n > regra.max) return { erro: `Máximo ${regra.max}.` };
      return { valor: n };
    }
    case 'inteiro': {
      const n = Number(bruto);
      if (!Number.isInteger(n)) return { erro: 'Deve ser um número inteiro.' };
      if (regra.min !== undefined && n < regra.min) return { erro: `Mínimo ${regra.min}.` };
      if (regra.max !== undefined && n > regra.max) return { erro: `Máximo ${regra.max}.` };
      return { valor: n };
    }
    case 'booleano':
      if ([true, 1, '1', 'true', 'on'].includes(bruto)) return { valor: 1 };
      if ([false, 0, '0', 'false', 'off'].includes(bruto)) return { valor: 0 };
      return { erro: 'Deve ser sim ou não.' };
    case 'data':
      if (!dataValida(bruto)) return { erro: 'Data inválida (use AAAA-MM-DD).' };
      if (regra.naoFutura && bruto > new Date().toISOString().slice(0, 10)) return { erro: 'A data não pode estar no futuro.' };
      return { valor: bruto };
    case 'cor':
      if (typeof bruto !== 'string' || !RE_COR.test(bruto)) return { erro: 'Cor inválida (ex.: #0dbdad).' };
      return { valor: bruto.toLowerCase() };
    case 'icone': {
      if (typeof bruto !== 'string') return { erro: 'Ícone inválido.' };
      const v = bruto.trim();
      if (/[<>&"'`]/.test(v) || /[a-zA-Z0-9]/.test(v) || [...v].length > 4) return { erro: 'Use um emoji.' };
      return { valor: v };
    }
    case 'id': {
      const n = Number(bruto);
      if (!Number.isInteger(n) || n < 1) return { erro: 'Identificador inválido.' };
      return { valor: n };
    }
    case 'ids': {
      if (!Array.isArray(bruto)) return { erro: 'Deve ser uma lista.' };
      const ids = [...new Set(bruto.map(Number))];
      if (ids.some((n) => !Number.isInteger(n) || n < 1)) return { erro: 'Lista com identificador inválido.' };
      if (regra.maxItens && ids.length > regra.maxItens) return { erro: `Máximo de ${regra.maxItens} itens.` };
      return { valor: ids };
    }
    case 'lista': {
      const itens = Array.isArray(bruto) ? bruto : String(bruto).split(',');
      const limpos = [...new Set(itens.map((s) => String(s).trim().replace(/\s+/g, ' ')).filter(Boolean))];
      if (limpos.some((s) => RE_HTML.test(s))) return { erro: 'Não use os caracteres < ou >.' };
      if (limpos.some((s) => s.length > (regra.itemMax || 60))) return { erro: `Cada item com no máximo ${regra.itemMax || 60} caracteres.` };
      if (regra.maxItens && limpos.length > regra.maxItens) return { erro: `Máximo de ${regra.maxItens} itens.` };
      return { valor: limpos };
    }
    default:
      return { erro: 'Tipo de campo desconhecido.' };
  }
}

/**
 * Valida o corpo inteiro conforme o mapa de campos.
 * Só as chaves declaradas em `campos` são lidas.
 */
function validar(campos, corpo) {
  const entrada = corpo && typeof corpo === 'object' && !Array.isArray(corpo) ? corpo : {};
  const dados = {};
  const erros = {};
  for (const [nome, regra] of Object.entries(campos)) {
    const r = validarCampo(regra, entrada[nome]);
    if (r.erro) erros[nome] = r.erro;
    else dados[nome] = r.valor;
  }
  return { dados, erros };
}

module.exports = { validar, validarCampo, dataValida, ErroValidacao, ErroNaoEncontrado };
