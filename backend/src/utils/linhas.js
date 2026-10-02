/* utils/linhas.js — Converte o resultado do banco em objetos simples. */
function paraObjetos(rs) {
  return rs.rows.map((row) => Object.fromEntries(rs.columns.map((c) => [c, row[c]])));
}
module.exports = { paraObjetos };
