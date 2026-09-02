/* =============================================
   sintomas-ia.js
   ---------------------------------------------
   Um classificador de texto bem simples, mas que
   usa uma técnica clássica de Machine Learning:

   1) TF-IDF  → transforma cada frase em um vetor
      de números que representa "quais palavras
      importam mais nela".
   2) Similaridade de cosseno → mede o quão
      parecidos dois vetores são (0 = nada a ver,
      1 = idênticos).

   Treinamos com frases de exemplo de cada
   especialidade. Quando o usuário digita um
   sintoma, comparamos com todas as frases de
   treino e vemos qual especialidade "vence".

   Não precisa de nenhuma biblioteca externa —
   dá pra entender e reescrever cada linha.
   ============================================= */

const DADOS_TREINO = [
  { categoria: 'dentista', texto: 'dor de dente forte latejante' },
  { categoria: 'dentista', texto: 'gengiva inflamada sangrando' },
  { categoria: 'dentista', texto: 'dente quebrado caiu restauração' },
  { categoria: 'dentista', texto: 'dor ao mastigar sensibilidade no dente' },
  { categoria: 'dentista', texto: 'mau hálito placa bacteriana cárie' },
  { categoria: 'dentista', texto: 'siso nascendo inflamado dói pra abrir a boca' },
  { categoria: 'dentista', texto: 'quero limpeza dental e avaliação de canal' },
  { categoria: 'dentista', texto: 'aparelho ortodôntico soltou machucando a boca' },
  { categoria: 'dentista', texto: 'dente furado buraco no dente doendo' },
  { categoria: 'dentista', texto: 'boca inchada abscesso perto do dente' },
  { categoria: 'dentista', texto: 'quebrei um dente jogando bola' },
  { categoria: 'dentista', texto: 'quero avaliação odontológica de rotina' },
  { categoria: 'dentista', texto: 'sangramento na gengiva ao escovar os dentes' },
  { categoria: 'dentista', texto: 'nascimento do dente do siso doendo muito' },

  { categoria: 'pediatra', texto: 'bebê com febre alta chorando muito' },
  { categoria: 'pediatra', texto: 'criança com tosse e coriza' },
  { categoria: 'pediatra', texto: 'recém nascido não quer mamar' },
  { categoria: 'pediatra', texto: 'meu filho está com diarreia e vômito' },
  { categoria: 'pediatra', texto: 'caderneta de vacinação da criança atrasada' },
  { categoria: 'pediatra', texto: 'criança com manchas vermelhas na pele alergia' },
  { categoria: 'pediatra', texto: 'bebê chorando muito sem parar cólica' },
  { categoria: 'pediatra', texto: 'acompanhamento de crescimento e peso do bebê' },
  { categoria: 'pediatra', texto: 'meu filho caiu machucou o braço quero levar no médico infantil' },
  { categoria: 'pediatra', texto: 'consulta de rotina para recém nascido' },
  { categoria: 'pediatra', texto: 'criança com dor de ouvido chorando à noite' },
  { categoria: 'pediatra', texto: 'meu bebê está com assadura muito forte' },
  { categoria: 'pediatra', texto: 'filho com alergia de pele coçando muito' },
  { categoria: 'pediatra', texto: 'quero levar minha filha no médico de criança' },

  { categoria: 'cardio', texto: 'dor no peito aperto falta de ar' },
  { categoria: 'cardio', texto: 'palpitação coração acelerado batendo forte' },
  { categoria: 'cardio', texto: 'pressão alta tontura dor de cabeça' },
  { categoria: 'cardio', texto: 'inchaço nas pernas cansaço ao subir escada' },
  { categoria: 'cardio', texto: 'histórico familiar de infarto quero exame de coração' },
  { categoria: 'cardio', texto: 'colesterol alto quero acompanhamento cardiológico' },
  { categoria: 'cardio', texto: 'falta de ar ao fazer esforço físico leve' },
  { categoria: 'cardio', texto: 'quero fazer um eletrocardiograma de rotina' },
  { categoria: 'cardio', texto: 'sinto o coração disparado sem motivo' },
  { categoria: 'cardio', texto: 'pressão descontrolada preciso de acompanhamento' },
  { categoria: 'cardio', texto: 'quero avaliar minha saúde do coração' },
  { categoria: 'cardio', texto: 'sinto formigamento no braço esquerdo e peito apertado' },
  { categoria: 'cardio', texto: 'tontura e coração acelerado depois de esforço' },

  { categoria: 'gineco', texto: 'atraso menstrual quero fazer exame' },
  { categoria: 'gineco', texto: 'dor pélvica cólica forte fora do período' },
  { categoria: 'gineco', texto: 'gravidez pré natal acompanhamento gestante' },
  { categoria: 'gineco', texto: 'exame preventivo papanicolau consulta ginecológica' },
  { categoria: 'gineco', texto: 'corrimento coceira incômodo íntimo' },
  { categoria: 'gineco', texto: 'quero começar a tomar anticoncepcional' },
  { categoria: 'gineco', texto: 'sangramento fora do período menstrual' },
  { categoria: 'gineco', texto: 'dor durante a relação íntima' },
  { categoria: 'gineco', texto: 'quero fazer teste de gravidez' },
  { categoria: 'gineco', texto: 'menstruação muito irregular todo mês' },
  { categoria: 'gineco', texto: 'quero orientação sobre planejamento familiar' },
  { categoria: 'gineco', texto: 'dor forte na parte de baixo da barriga mulher' },
  { categoria: 'gineco', texto: 'consulta ginecologista rotina anual' },

  { categoria: 'clinico', texto: 'dor de cabeça febre corpo cansado' },
  { categoria: 'clinico', texto: 'gripe resfriado tosse garganta inflamada' },
  { categoria: 'clinico', texto: 'check up geral exame de rotina' },
  { categoria: 'clinico', texto: 'dor nas costas mal estar geral' },
  { categoria: 'clinico', texto: 'quero uma consulta clínica geral' },
  { categoria: 'clinico', texto: 'dor de garganta espirro nariz entupido' },
  { categoria: 'clinico', texto: 'quero renovar receita de remédio de pressão' },
  { categoria: 'clinico', texto: 'exame de sangue de rotina check up anual' },
  { categoria: 'clinico', texto: 'dor no corpo todo febre baixa cansaço' },
  { categoria: 'clinico', texto: 'tosse seca persistente há vários dias' },
  { categoria: 'clinico', texto: 'estou gripado com dor de cabeça e febre' },
  { categoria: 'clinico', texto: 'preciso de atestado médico simples' },
  { categoria: 'clinico', texto: 'sinusite nariz entupido dor no rosto' },
  { categoria: 'clinico', texto: 'diabetes preciso renovar receita de remédio' },
  { categoria: 'clinico', texto: 'dor muscular cansaço geral sem energia' },

  // sintomas de alarme → encaminhar para urgência, não para agendamento comum
  { categoria: 'urgencia', texto: 'dor no peito muito forte não consigo respirar' },
  { categoria: 'urgencia', texto: 'sangramento intenso que não para' },
  { categoria: 'urgencia', texto: 'desmaiei perdi a consciência' },
  { categoria: 'urgencia', texto: 'sofri um acidente batida forte' },
  { categoria: 'urgencia', texto: 'convulsão crise que não passa' },
  { categoria: 'urgencia', texto: 'engasgado não consegue respirar de jeito nenhum' },
  { categoria: 'urgencia', texto: 'queimadura grave ferimento profundo' },
  { categoria: 'urgencia', texto: 'fratura osso quebrado deformidade visível' },
  { categoria: 'urgencia', texto: 'acidente de moto muito grave preciso de socorro' },
  { categoria: 'urgencia', texto: 'criança engoliu produto de limpeza envenenamento' },
  { categoria: 'urgencia', texto: 'corte profundo sangrando muito não estanca' },
  { categoria: 'urgencia', texto: 'pessoa caiu inconsciente não responde' },
  { categoria: 'urgencia', texto: 'reação alérgica grave garganta fechando' }
];

const NOME_ESPECIALIDADE = {
  dentista: 'Odontologia',
  pediatra: 'Pediatria',
  cardio: 'Cardiologia',
  gineco: 'Ginecologia',
  clinico: 'Clínico Geral',
  urgencia: 'Urgência / Emergência'
};

// abaixo desse valor, a IA prefere "não saber" a arriscar um palpite ruim.
// (testei bastante: frases sem relação com sintomas costumam ficar
// abaixo de 0.40 por puro acaso de palavras comuns; matches reais
// costumam passar de 0.50)
const LIMIAR_MINIMO = 0.45;

// ── pré-processamento de texto ───────────────────
const STOPWORDS = new Set(['de','da','do','com','em','para','no','na','um','uma','e','o','a','os','as','meu','minha','está','estou','muito','oi','ola','quero','sobre','informação','informacao','posto','favor','por','quero','saber','gostaria']);

function tokenizar(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(t => t && !STOPWORDS.has(t));
}

// ── construção do vocabulário e do IDF ───────────
const docsTokenizados = DADOS_TREINO.map(d => tokenizar(d.texto));
const vocabulario = [...new Set(docsTokenizados.flat())];

function calcularIDF(docs, vocab) {
  const idf = {};
  vocab.forEach(termo => {
    const docsComTermo = docs.filter(doc => doc.includes(termo)).length;
    idf[termo] = Math.log((docs.length + 1) / (docsComTermo + 1)) + 1;
  });
  return idf;
}
const IDF = calcularIDF(docsTokenizados, vocabulario);

function vetorTFIDF(tokens) {
  const tf = {};
  tokens.forEach(t => { tf[t] = (tf[t] || 0) + 1; });
  return vocabulario.map(termo => (tf[termo] || 0) * IDF[termo]);
}

const VETORES_TREINO = docsTokenizados.map(vetorTFIDF);

function similaridadeCosseno(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Recebe um texto livre de sintomas e devolve um ranking
 * das especialidades mais prováveis, com um score de
 * compatibilidade (0–1). Não é uma probabilidade estatística
 * de verdade — é o quão parecido o texto é com as frases de
 * treino daquela especialidade.
 */
function classificarSintomas(textoUsuario) {
  const tokens = tokenizar(textoUsuario);
  if (!tokens.length) return [];

  const vetorUsuario = vetorTFIDF(tokens);

  const pontuacaoPorCategoria = {};
  VETORES_TREINO.forEach((vetorTreino, i) => {
    const categoria = DADOS_TREINO[i].categoria;
    const score = similaridadeCosseno(vetorUsuario, vetorTreino);
    pontuacaoPorCategoria[categoria] = Math.max(pontuacaoPorCategoria[categoria] || 0, score);
  });

  return Object.entries(pontuacaoPorCategoria)
    .map(([categoria, score]) => ({
      categoria,
      nome: NOME_ESPECIALIDADE[categoria],
      compatibilidade: score
    }))
    .sort((a, b) => b.compatibilidade - a.compatibilidade)
    .filter(r => r.compatibilidade >= LIMIAR_MINIMO);
}
