/* =============================================================
   sintomas-ia.js — Motor de inferência da IA de triagem (v2)
   -------------------------------------------------------------
   O modelo é TREINADO em Python (ia/treinar_modelo.py, Google Colab)
   e seus pesos são exportados para modelo-ia.js (objeto MODELO_IA).
   Este arquivo só executa a previsão — replica exatamente o
   pré-processamento e a matemática do scikit-learn:

     texto → normalização → features (palavras, pares, n-gramas de letras)
           → TF-IDF (tf sublinear, L2) → Regressão Logística → softmax

   Camadas de decisão, em ordem de prioridade:
     1. Sinais de crise de saúde mental  → CVV 188 / SAMU 192
     2. Sinais de alarme (regras)        → urgência
     3. Probabilidade de urgência ≥ limiar → urgência (viés de segurança)
     4. Classe "outro" ou confiança baixa → não sugere nada (abstenção)
     5. Caso contrário → especialidade(s) mais provável(is)

   Privacidade: tudo roda no navegador. O texto digitado NUNCA é
   enviado ao servidor.
   ============================================================= */

(function () {
  if (typeof MODELO_IA === 'undefined') {
    console.error('modelo-ia.js não foi carregado — IA de triagem desativada.');
    window.classificarSintomas = () => [];
    window.detectarCrise = () => false;
    return;
  }

  const M = MODELO_IA;
  const STOP = new Set(M.stopwords);
  const INDICE = new Map(M.features.map((f, i) => [f, i]));
  const RE_ALARME = M.sinaisAlarme.map((r) => new RegExp(r));
  const RE_CRISE = M.sinaisCrise.map((r) => new RegExp(r));
  const I_URG = M.classes.indexOf('urgencia');
  const SUGESTAO_SECUNDARIA_MIN = 0.15;

  function normalizar(texto) {
    return String(texto).toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, ' ')
      .split(/\s+/).filter(Boolean);
  }

  function extrairFeatures(texto) {
    const p = normalizar(texto).filter((w) => !STOP.has(w));
    const f = p.map((w) => 'w:' + w);
    for (let i = 0; i < p.length - 1; i++) f.push('b:' + p[i] + '_' + p[i + 1]);
    for (const w of p) {
      const s = ' ' + w + ' ';
      for (const n of [3, 4]) {
        for (let i = 0; i <= s.length - n; i++) f.push('c:' + s.slice(i, i + n));
      }
    }
    return f;
  }

  // TF-IDF idêntico ao TfidfVectorizer(sublinear_tf=True, norm='l2')
  function vetorizar(texto) {
    const contagem = new Map();
    for (const f of extrairFeatures(texto)) {
      const j = INDICE.get(f);
      if (j !== undefined) contagem.set(j, (contagem.get(j) || 0) + 1);
    }
    const vet = new Map();
    let norma = 0;
    for (const [j, tf] of contagem) {
      const v = (1 + Math.log(tf)) * M.idf[j];
      vet.set(j, v);
      norma += v * v;
    }
    norma = Math.sqrt(norma);
    if (norma > 0) for (const [j, v] of vet) vet.set(j, v / norma);
    return vet;
  }

  function probabilidades(texto) {
    const x = vetorizar(texto);
    const z = M.classes.map((_, k) => {
      let s = M.intercept[k];
      for (const [j, v] of x) s += v * M.coef[k][j];
      return s;
    });
    const max = Math.max(...z);
    const e = z.map((v) => Math.exp(v - max));
    const soma = e.reduce((a, b) => a + b, 0);
    return e.map((v) => v / soma);
  }

  function detectarCrise(texto) {
    const t = normalizar(texto).join(' ');
    return RE_CRISE.some((r) => r.test(t));
  }

  /**
   * Retorna [] (abstenção), [{urgencia}] ou até 2 especialidades:
   *   [{ categoria, nome, compatibilidade }]
   */
  function classificarSintomas(texto) {
    const t = normalizar(texto).join(' ');
    if (t.length < 3) return [];

    const p = probabilidades(texto);

    if (RE_ALARME.some((r) => r.test(t)) || p[I_URG] >= M.limiarUrgencia) {
      return [{ categoria: 'urgencia', nome: M.nomes.urgencia, compatibilidade: p[I_URG] }];
    }

    const ranking = M.classes
      .map((c, k) => ({ categoria: c, nome: M.nomes[c], compatibilidade: p[k] }))
      .sort((a, b) => b.compatibilidade - a.compatibilidade);

    const top = ranking[0];
    if (top.categoria === 'outro' || top.compatibilidade < M.limiarAbstencao) return [];

    return ranking
      .filter((r) => r.categoria !== 'outro' && r.categoria !== 'urgencia')
      .filter((r, i) => i === 0 || r.compatibilidade >= SUGESTAO_SECUNDARIA_MIN)
      .slice(0, 2);
  }

  // expõe para app.js e para os testes
  window.classificarSintomas = classificarSintomas;
  window.detectarCrise = detectarCrise;
  window._iaInterno = { probabilidades, normalizar };
})();
