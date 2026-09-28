/* =============================================================
   scripts/testar-ia.js   →   npm run test:ia
   Confere que o motor JavaScript (public/ml) reproduz EXATAMENTE
   as previsões do modelo treinado em Python, frase por frase.
   ============================================================= */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const raiz = path.join(__dirname, '..');
const ctx = { window: {}, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(raiz, 'public/ml/modelo-ia.js'), 'utf8') +
  ';window.MODELO_IA = MODELO_IA;', ctx);
ctx.MODELO_IA = ctx.window.MODELO_IA;
vm.runInContext(fs.readFileSync(path.join(raiz, 'public/ml/sintomas-ia.js'), 'utf8'), ctx);

const { classificarSintomas, _iaInterno } = ctx.window;
const ref = JSON.parse(fs.readFileSync(path.join(raiz, 'ia/referencia_python.json'), 'utf8'));

let maxDif = 0;
const divergentes = [];
for (const c of ref.casos) {
  _iaInterno.probabilidades(c.texto).forEach((v, k) => { maxDif = Math.max(maxDif, Math.abs(v - c.proba[k])); });
  const r = classificarSintomas(c.texto);
  const decisao = r.length ? r[0].categoria : 'outro';
  if (decisao !== c.decisao) divergentes.push(`${c.texto}  (Python: ${c.decisao} | JS: ${decisao})`);
}

console.log(`Frases comparadas: ${ref.casos.length}`);
console.log(`Maior diferença de probabilidade: ${maxDif.toExponential(2)}`);
if (divergentes.length || maxDif > 1e-3) {
  console.error(`❌ ${divergentes.length} decisões divergentes:`);
  divergentes.forEach((d) => console.error('   ' + d));
  process.exit(1);
}
console.log('✅ JavaScript reproduz o modelo Python com fidelidade.');
const m = ctx.MODELO_IA.metricas;
console.log(`   Acurácia no teste cego: ${(m.acuracia_teste_c * 100).toFixed(1)}% | recall de urgência: ${(m.recall_urgencia_teste_c * 100).toFixed(0)}%`);
