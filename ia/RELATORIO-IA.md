# IA de Triagem — Relatório Técnico

## Resultado

| Métrica | Valor |
|---|---|
| **Acurácia no teste cego (C)** | **91,4%** |
| **Recall de urgência** | **100%** — nenhuma urgência perdida |
| Falsos alarmes de urgência | 2 em 60 frases não urgentes |
| Validação cruzada agrupada (5 folds) | 96,0% ± 0,7 |
| Classes | 7 |
| Frases de treino | 3.808 (de 1.313 frases-base) |
| Frases de teste | 280 (A: 140, B: 70, C: 70) |

**Meta do cronograma: ≥ 90% → atingida.**

---

## O que a IA faz

Recebe o que o cidadão digita ("meu dente tá latejando", "bebê com febre") e indica a especialidade:

| Classe | Exemplo |
|---|---|
| Odontologia | dente, gengiva, siso, canal, aparelho |
| Pediatria | criança/bebê + sintoma geral, puericultura |
| Clínico Geral | gripe, dor nas costas, infecção urinária, receita, check-up |
| Cardiologia | pressão alta, colesterol, palpitação, exames do coração |
| Ginecologia | menstruação, corrimento, pré-natal, preventivo, mama |
| **Urgência** | desmaio, AVC, convulsão, sangramento, acidente, envenenamento |
| Fora do escopo | "que horas abre o posto", "bom dia" → não sugere nada |

Ela **indica especialidade, não diagnostica doença**. É o mesmo papel da recepção de uma UBS: "isso é com o dentista", "isso é com o pediatra", "isso é emergência".

---

## Como funciona

```
texto digitado
   │
   ▼
normalização ─ minúsculas, sem acento, sem pontuação
   │
   ▼
features ─ palavras + pares de palavras + pedaços de 3–4 letras
   │         (os pedaços dão tolerância a erro: "dnete" ≈ "dente")
   ▼
TF-IDF ─ peso de cada feature (palavra rara e específica pesa mais)
   │
   ▼
Regressão Logística ─ probabilidade para cada uma das 7 classes
   │
   ▼
camadas de decisão:
   1. sinal de crise de saúde mental?   → CVV 188 / SAMU 192
   2. sinal de alarme (regra)?          → URGÊNCIA
   3. P(urgência) ≥ 25%?                → URGÊNCIA
   4. "fora do escopo" ou confiança < 40% → não sugere nada
   5. senão                              → especialidade mais provável
```

### Por que Regressão Logística e não SVM?

| Algoritmo | Validação cruzada |
|---|---|
| SVM Linear | 96,1% |
| **Regressão Logística** | **96,0%** |
| Naive Bayes | 92,8% |

O SVM ficou 0,1 ponto à frente — diferença dentro da margem de variação. A Regressão Logística foi escolhida porque **produz probabilidades**, e as camadas 3 e 4 dependem delas ("urgência com 25%", "confiança abaixo de 40%"). O SVM só dá um placar sem escala.

### Por que regras por cima do modelo?

Porque o modelo sozinho errou de um jeito inaceitável. Na primeira avaliação:

- "A criança bebeu água sanitária" → **Pediatria, 99% de certeza**
- "Meu marido caiu e está desacordado" → **Odontologia** (a palavra "caiu" aparece em "restauração caiu")

Em saúde, mandar uma emergência para consulta agendada é o pior erro possível. Protocolos de triagem hospitalar (como o de Manchester) resolvem isso com **discriminadores**: sinais que, se presentes, classificam como urgente independentemente do resto. A camada de sinais de alarme faz exatamente isso — 49 padrões como inconsciência, convulsão, AVC, sangramento intenso, envenenamento, trauma e picada venenosa.

As mesmas regras ficam dentro do arquivo do modelo, então Python e JavaScript usam exatamente os mesmos padrões.

### Viés de segurança

A regra "P(urgência) ≥ 25% → urgência" faz o sistema errar de propósito para o lado seguro. Um alarme falso manda alguém para a UPA sem necessidade — incômodo. Uma urgência perdida pode custar uma vida. Os dois falsos alarmes do teste C foram:
- "meu filho bateu a boca e o dente ficou mole" (era dentista)
- "minhas pernas incham muito" (era cardio)

**Comportamento conhecido e mantido:** mencionar "infarto" ou "AVC" no histórico ("meu pai já teve infarto") dispara alerta. É excesso de cautela deliberado.

---

## Metodologia de avaliação

A parte mais importante deste relatório. É fácil conseguir 99% de acurácia medindo errado.

### Problema 1: variações da mesma frase

O dataset tem variações da mesma frase-base ("to com dor de dente", "tô com dor de dnete desde ontem"). Numa validação cruzada comum, uma variação cai no treino e outra no teste — o modelo "reconhece" em vez de "entender", e a nota infla.

**Solução:** validação cruzada **agrupada** (`StratifiedGroupKFold`). Cada frase guarda o id da sua frase-base, e todas as variações ficam sempre do mesmo lado.

### Problema 2: ajustar olhando o teste

Se você corrige os dados olhando os erros do teste, o teste deixa de medir generalização — o modelo passa a "conhecer" o teste. Isso aconteceu aqui, e os números mostram:

| Conjunto | Quando foi escrito | Usado para ajustar? | Acurácia |
|---|---|---|---|
| A | Antes do 1º treino | **Sim** — corrigi lacunas olhando os erros dele | 98,6% ← inflado |
| B | Antes das correções dos dados | Em parte — as regras vieram depois | 95,7% |
| **C** | **Antes das regras de alarme** | **Nunca** | **91,4% ← o real** |

A queda de 98,6% para 91,4% **não é o modelo piorando** — é a medição ficando honesta. O número que representa o desempenho em frases novas é o do teste C.

### Problema 3: vazamento

O script verifica se alguma frase de teste existe no treino (após normalização). Na primeira versão havia 4 vazamentos — foram substituídos. Versão final: **zero**.

---

## Desempenho por classe (teste C)

| Classe | Precisão | Recall | F1 |
|---|---|---|---|
| Pediatria | 1,00 | 1,00 | 1,00 |
| Fora do escopo | 1,00 | 1,00 | 1,00 |
| **Urgência** | 0,83 | **1,00** | 0,91 |
| Ginecologia | 0,90 | 0,90 | 0,90 |
| Odontologia | 1,00 | 0,80 | 0,89 |
| Cardiologia | 1,00 | 0,80 | 0,89 |
| Clínico Geral | 0,75 | 0,90 | 0,82 |

- **Recall** = das frases que eram da classe, quantas a IA acertou.
- **Precisão** = das vezes que a IA disse aquela classe, quantas estavam certas.
- Para urgência, o que importa é o **recall** (não perder nenhuma). A precisão menor (0,83) é o custo dos alarmes falsos — aceito conscientemente.

### Erros no teste C

| Frase | Correto | IA disse | Análise |
|---|---|---|---|
| meu filho bateu a boca e o dente ficou mole | Odontologia | Urgência | "bateu" + criança → cautela. Erro seguro |
| minhas pernas incham muito | Cardiologia | Urgência | Erro seguro |
| estou com a boca inchada e dor no molar | Odontologia | Clínico | "molar" não estava no treino |
| já coloquei stent e preciso de retorno | Cardiologia | Clínico | "stent" não estava no treino |
| estou grávida e com enjoo | Ginecologia | Clínico | Ambíguo — clínico também atende |
| sinto enjoo toda manhã e não estou grávida | Clínico | Ginecologia | A negação "não estou grávida" não é entendida |

O último revela um limite real da técnica: TF-IDF enxerga palavras, não gramática. "Não estou grávida" e "estou grávida" têm quase as mesmas features.

---

## Comparação com a IA anterior (v1)

A v1 (similaridade de cosseno sobre 82 frases) foi avaliada **nos mesmos testes cegos**:

| | v1 | v2 |
|---|---|---|
| Acurácia — teste C | 48,6% | **91,4%** |
| Urgências detectadas — teste C | 30% | **100%** |
| Acurácia — teste B | 41,4% | **95,7%** |
| Urgências detectadas — teste B | 0% | **100%** |

Exemplos de urgências que a v1 perdeu: "a criança caiu da escada e não acorda" (sem sugestão), "meu avô está desmaiado no chão" (pediatria), "fui picado por uma cobra no sítio" (sem sugestão).

---

## Vício encontrado: shortcut learning

O gráfico `graficos/05_o_que_a_ia_aprendeu.png` mostra as palavras de maior peso em cada classe. Várias **não são sintomas**:

| Classe | Palavras fortes que são vício | De onde vieram |
|---|---|---|
| Clínico Geral | tô, avô, pai, irmão | sujeitos das frases ("meu pai está com...") |
| Pediatria | tá, anda, acordou | verbos das frases ("meu filho anda com...") |
| Urgência | agora, faço, rápido, socorro | prefixos/sufixos da aumentação |
| Fora do escopo | diz, pergunta | prefixos ("me diz...", "uma pergunta...") |

A IA aprendeu os sintomas **e também o jeito como as frases de treino foram montadas**. Como os testes foram escritos pelo mesmo autor, com estilo parecido, esse vício não aparece nas métricas — mas vai aparecer com pessoas reais.

**Correções possíveis:**
1. **Frases reais** (o remédio principal — ver próximo passo recomendado)
2. Usar os mesmos sujeitos, verbos e prefixos em **todas** as classes, para que deixem de diferenciar
3. Tratar palavras como "tô", "tá", "agora" como stopwords

A descoberta só foi possível porque o modelo é **interpretável**: dá para abrir e ver o peso de cada palavra. Isso é uma vantagem da Regressão Logística sobre modelos de caixa-preta.

---

## Gráficos

Gerados por `python gerar_graficos.py` em `graficos/`:

| Arquivo | Mostra |
|---|---|
| `00_pipeline.png` | Caminho de uma frase pela IA |
| `01_dataset_por_classe.png` | Tamanho do dataset por classe |
| `02_comparacao_algoritmos.png` | Os 4 algoritmos testados |
| `03_v1_vs_v2.png` | IA antiga × nova no mesmo teste cego |
| `04_honestidade_dos_testes.png` | Por que 91,4% e não 98,6% |
| `05_o_que_a_ia_aprendeu.png` | Palavras de maior peso + o vício encontrado |
| `06_como_a_ia_pensa.png` | Probabilidades para 4 frases de exemplo |
| `07_curva_de_aprendizado.png` | Acurácia × quantidade de dados |
| `08_matriz_confusao.png` | Acertos e erros no teste C |

---

## Arquivos

| Arquivo | O que é |
|---|---|
| `gerar_dataset.py` | Monta o dataset de treino (frases-base + variações) |
| `dataset_treino.csv` | 3.808 frases geradas |
| `dataset_teste.csv` / `_b` / `_c` | Os três conjuntos de teste |
| `treinar_modelo.py` | Treina, avalia, gera matriz e exporta |
| `SaudeMap_Treinamento_IA.ipynb` | **Notebook do Google Colab** — mesmo pipeline |
| `relatorio_metricas.json` | Todos os números |
| `matriz_confusao.png` | Matriz do teste C |
| `referencia_python.json` | Previsões do Python, usadas para conferir o JS |
| `../frontend/assets/ml/modelo-ia.js` | Pesos exportados (usado pelo site) |
| `../frontend/assets/ml/sintomas-ia.js` | Motor de previsão no navegador |

### Retreinar

**No Colab:** abra o `.ipynb` no Google Colab → *Ambiente de execução → Executar tudo* → baixe o `modelo-ia.js` → substitua em `frontend/assets/ml/`.

**No computador (Python + scikit-learn):**
```
cd ia
python gerar_dataset.py
python treinar_modelo.py
```
O script já grava o modelo em `frontend/assets/ml/` sozinho. Depois:
```
npm run test:ia
```
Confere, frase por frase, se o JavaScript dá o mesmo resultado do Python. Resultado atual: 280 frases, 0 divergências, diferença máxima de probabilidade 0,00004.

---

## Privacidade

O modelo roda **inteiramente no navegador**. O texto que o cidadão digita **nunca é enviado ao servidor** e não fica registrado em lugar nenhum. Relevante para a LGPD: descrição de sintoma é dado de saúde, categoria sensível.

---

## Limitações — leia antes de apresentar

1. **Shortcut learning** — a IA aprendeu parte do estilo das frases de treino (ver seção acima).
2. **O teste foi escrito por quem construiu o modelo.** Mesmo o teste C tem o "vocabulário do autor". Pessoas reais escrevem de formas que eu não previ. **A acurácia real com usuários provavelmente é menor que 91%.**
3. **Negação não é entendida** ("não estou grávida").
4. **Vocabulário limitado a 7 classes.** Dermatologia, ortopedia, psiquiatria etc. caem em Clínico Geral — o que é correto no SUS (clínico é a porta de entrada), mas não é especialização.
5. **Dataset sintético.** As frases foram escritas e variadas por programa, não coletadas de pacientes reais.
6. **Não é dispositivo médico.** O site exibe "Sugestão automática, não substitui avaliação médica" — e isso não é formalidade.

### Próximo passo recomendado (semana 10 do cronograma)

**Coletar 100–200 frases reais.** Peça para colegas, familiares, pessoas na fila da UBS: *"escreva como você descreveria esse problema de saúde para alguém"*. Classifique à mão, rode como teste D. Esse será o número mais confiável de todo o projeto — e é um ótimo dado para mostrar à Secretaria de Saúde.
