"""
treinar_modelo.py — Treino, avaliação e exportação da IA de triagem (SaúdeMap IA)

Roda igual localmente ou no Google Colab. Saídas:
  - modelo-ia.js              pesos do modelo, carregado pelo site
  - relatorio_metricas.json   números da avaliação
  - matriz_confusao.png       matriz de confusão no conjunto de teste
"""
import csv
import json
import math
import unicodedata
from collections import Counter

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.naive_bayes import ComplementNB
from sklearn.svm import LinearSVC

# ═════════════ PRÉ-PROCESSAMENTO (replicado idêntico no JavaScript) ═════════════
STOPWORDS = {
    "de", "da", "do", "das", "dos", "a", "o", "as", "os", "e", "em", "no", "na", "nos", "nas",
    "um", "uma", "uns", "umas", "com", "por", "pra", "para", "que", "eu", "me", "meu", "minha",
    "meus", "minhas", "se", "ja", "la", "aqui", "isso", "isto", "esse", "essa", "ele", "ela",
}


def normalizar(texto):
    t = unicodedata.normalize("NFD", texto.lower())
    t = "".join(ch for ch in t if not ("\u0300" <= ch <= "\u036f"))
    t = "".join(ch if ("a" <= ch <= "z" or "0" <= ch <= "9") else " " for ch in t)
    return t.split()


def analisar(texto):
    """Palavras + pares de palavras + trigramas/quadrigramas de caracteres.
    Os n-gramas de caracteres dão robustez a erro de digitação ('dentee', 'febr')."""
    palavras = [w for w in normalizar(texto) if w not in STOPWORDS]
    feats = ["w:" + w for w in palavras]
    feats += ["b:" + palavras[i] + "_" + palavras[i + 1] for i in range(len(palavras) - 1)]
    for w in palavras:
        p = " " + w + " "
        for n in (3, 4):
            for i in range(len(p) - n + 1):
                feats.append("c:" + p[i:i + n])
    return feats



# ═════════════ SINAIS DE ALARME (camada de regras sobre o modelo) ═════════════
# Inspirado nos discriminadores de protocolos de triagem (ex.: Manchester):
# se qualquer sinal aparecer, é URGÊNCIA — independente do que o modelo disse.
# Aplicados ao texto normalizado (minúsculo, sem acento). Sintaxe compatível
# com RegExp do JavaScript: o MESMO conjunto é exportado para o site.
SINAIS_ALARME = [
    r"\bdesmai", r"\bdesacordad", r"\binconscien", r"\bnao (acorda|reage|responde)\b",
    r"\bperdeu a consciencia", r"\bconvuls",
    r"\bnao\b[a-z ]{0,25}\brespir", r"\bparou de respirar", r"\bsufoc", r"\bengasg",
    r"\binfarto", r"\bavc\b", r"\bderrame\b", r"\bparada cardiaca",
    r"\bboca torta", r"\bfala (enrolad|embolad)", r"\b(lado do corpo|braco) (paralis|mole|dormente)",
    r"\bacidente\b", r"\batropelad", r"\bbateram o carro", r"\bbatida de (carro|moto)", r"\bcapot",
    r"\bfacada", r"\besfaquead", r"\btiro\b", r"\bbalead",
    r"\bsangr[a-z]* (muito|demais|sem parar)", r"\bsangue nao (para|estanca)", r"\bhemorragia",
    r"\bvomitando sangue",
    r"\bveneno", r"\benvenen", r"\bagua sanitaria", r"\bsoda caustica", r"\bquerosene", r"\boverdose",
    r"\btomou (muito|muitos|um monte de|todos os|remedio de adulto)", r"\bremedio[a-z ]{0,20}por engano",
    r"\b(picad|mordid)[oa]s? (de|por) (uma )?(cobra|escorpiao|aranha)", r"\bcobra (me )?mord",
    r"\bescorpiao (me )?pic",
    r"\bqueimadura (grave|no corpo)", r"\bqueim[a-z]* (com oleo|com agua fervendo|feio)",
    r"\b(bebe|labios|boca) (ficou |esta |ta )?rox", r"\bficou rox",
    r"\bbolsa (estourou|rompeu)", r"\bestourou a bolsa",
    r"\bdor no peito (muito forte|forte|fortissima|apertando|insuportavel)", r"\baperto no peito com suor",
    r"\bgarganta fechando", r"\bcaiu (de|do|da) (altura|telhado|laje|escada|moto)", r"\bbateu a cabeca",
]
# Crise de saúde mental: não vai para a UPA — mostra CVV 188 e SAMU 192.
SINAIS_CRISE = [
    r"\bme matar", r"\bsuicid", r"\btirar (a )?minha (propria )?vida", r"\bnao quero mais viver",
    r"\bquero morrer", r"\bacabar com (a )?minha vida", r"\bme (cortar|machucar)\b",
]
import re
_RE_ALARME = [re.compile(x) for x in SINAIS_ALARME]


def sinal_alarme(texto):
    t = " ".join(normalizar(texto))
    return any(r.search(t) for r in _RE_ALARME)


def novo_vetorizador():
    return TfidfVectorizer(analyzer=analisar, sublinear_tf=True, min_df=2, norm="l2")


# ═════════════ DADOS ═════════════
def ler(caminho, com_grupo):
    with open(caminho, encoding="utf-8") as f:
        r = list(csv.DictReader(f))
    X = [x["texto"] for x in r]
    y = [x["categoria"] for x in r]
    g = [int(x["grupo"]) for x in r] if com_grupo else None
    return X, y, g


X_tr, y_tr, g_tr = ler("dataset_treino.csv", True)
X_te, y_te, _ = ler("dataset_teste.csv", False)
X_te_orig = list(X_te)

# Vazamento: nenhuma frase de teste pode existir no treino (após normalização)
norm_tr = {" ".join(normalizar(t)) for t in X_tr}
vazadas = [t for t in X_te if " ".join(normalizar(t)) in norm_tr]
print(f"Treino: {len(X_tr)} frases | Teste: {len(X_te)} frases | Vazamento treino→teste: {len(vazadas)}")
if vazadas:
    print("  ATENÇÃO — frases de teste presentes no treino:", vazadas)

CLASSES = sorted(set(y_tr))
NOMES = {"cardio": "Cardiologia", "clinico": "Clínico Geral", "dentista": "Odontologia",
         "gineco": "Ginecologia", "pediatra": "Pediatria", "urgencia": "Urgência / Emergência",
         "outro": "Fora do escopo"}

# ═════════════ COMPARAÇÃO DE ALGORITMOS (validação cruzada AGRUPADA) ═════════════
# StratifiedGroupKFold: variações da mesma frase-base ficam SEMPRE no mesmo fold.
cv = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=42)
candidatos = {
    "Regressão Logística (C=5)": lambda: LogisticRegression(C=5, max_iter=3000),
    "Regressão Logística (C=20)": lambda: LogisticRegression(C=20, max_iter=3000),
    "SVM Linear": lambda: LinearSVC(C=1.0),
    "Naive Bayes (Complement)": lambda: ComplementNB(alpha=0.3),
}
Xa, ya, ga = np.array(X_tr, dtype=object), np.array(y_tr), np.array(g_tr)
resultados_cv = {}
print("\nValidação cruzada agrupada (5 folds):")
for nome, fabrica in candidatos.items():
    accs, f1s = [], []
    for tr_idx, va_idx in cv.split(Xa, ya, ga):
        vec = novo_vetorizador()
        Xtr_v = vec.fit_transform(Xa[tr_idx])
        mdl = fabrica().fit(Xtr_v, ya[tr_idx])
        pred = mdl.predict(vec.transform(Xa[va_idx]))
        accs.append(accuracy_score(ya[va_idx], pred))
        f1s.append(f1_score(ya[va_idx], pred, average="macro"))
    resultados_cv[nome] = {"acuracia_media": float(np.mean(accs)), "acuracia_desvio": float(np.std(accs)),
                           "f1_macro_media": float(np.mean(f1s))}
    print(f"  {nome:28s} acurácia {np.mean(accs):.3f} ± {np.std(accs):.3f} | F1 macro {np.mean(f1s):.3f}")

# ═════════════ MODELO FINAL ═════════════
# Escolha: Regressão Logística — produz PROBABILIDADES calibradas (necessárias para
# a regra de abstenção e a regra de segurança de urgência) e é exportável como
# uma simples multiplicação de matrizes no JavaScript.
C_FINAL = 20 if resultados_cv["Regressão Logística (C=20)"]["f1_macro_media"] >= \
               resultados_cv["Regressão Logística (C=5)"]["f1_macro_media"] else 5
vec = novo_vetorizador()
Xtr_v = vec.fit_transform(X_tr)
modelo = LogisticRegression(C=C_FINAL, max_iter=3000).fit(Xtr_v, y_tr)
classes = list(modelo.classes_)
P_te = modelo.predict_proba(vec.transform(X_te))

# ═════════════ REGRAS DE DECISÃO ═════════════
LIMIAR_ABSTENCAO = 0.40   # confiança mínima para sugerir algo
LIMIAR_URGENCIA = 0.25    # regra de segurança: urgência vence mesmo sem ser a mais provável
i_urg, i_out = classes.index("urgencia"), classes.index("outro")


def decidir(p, texto):
    if sinal_alarme(texto):
        return "urgencia"
    if p[i_urg] >= LIMIAR_URGENCIA:
        return "urgencia"
    top = int(np.argmax(p))
    if classes[top] == "outro" or p[top] < LIMIAR_ABSTENCAO:
        return "outro"
    return classes[top]


pred_bruto = [classes[int(np.argmax(p))] for p in P_te]
pred_final = [decidir(p, t) for p, t in zip(P_te, X_te)]

acc_bruta = accuracy_score(y_te, pred_bruto)
acc_final = accuracy_score(y_te, pred_final)
rel = classification_report(y_te, pred_final, labels=classes, output_dict=True, zero_division=0)

urg_reais = [i for i, c in enumerate(y_te) if c == "urgencia"]
recall_urg = sum(pred_final[i] == "urgencia" for i in urg_reais) / len(urg_reais)
falsos_alarmes = sum(1 for i, c in enumerate(y_te) if c != "urgencia" and pred_final[i] == "urgencia")
urg_perdida = [X_te[i] for i in urg_reais if pred_final[i] != "urgencia"]

print(f"\nModelo final: Regressão Logística C={C_FINAL} | {len(vec.vocabulary_)} features")
print(f"Teste independente ({len(X_te)} frases):")
print(f"  acurácia (só argmax)          {acc_bruta:.3f}")
print(f"  acurácia (com regras)         {acc_final:.3f}")
print(f"  recall de URGÊNCIA            {recall_urg:.3f}  (urgências perdidas: {len(urg_perdida)})")
print(f"  falsos alarmes de urgência    {falsos_alarmes}")
print("\n" + classification_report(y_te, pred_final, labels=classes, zero_division=0))

erros = [(X_te[i], y_te[i], pred_final[i], float(P_te[i].max()))
         for i in range(len(X_te)) if y_te[i] != pred_final[i]]
print("Erros no teste:")
for t, real, prev, conf in erros:
    print(f"  [{real} → {prev} ({conf:.2f})] {t}")


# ═════════════ TESTE B (escrito antes das correções, nunca usado para ajustes) ═════════════
X_b, y_b, _ = ler("dataset_teste_b.csv", False)
vaz_b = [t for t in X_b if " ".join(normalizar(t)) in norm_tr]
P_b = modelo.predict_proba(vec.transform(X_b))
pred_b = [decidir(p, t) for p, t in zip(P_b, X_b)]
acc_b = accuracy_score(y_b, pred_b)
urg_b = [i for i, c in enumerate(y_b) if c == "urgencia"]
recall_urg_b = sum(pred_b[i] == "urgencia" for i in urg_b) / len(urg_b)
alarmes_b = sum(1 for i, c in enumerate(y_b) if c != "urgencia" and pred_b[i] == "urgencia")
print(f"\nTESTE B — {len(X_b)} frases (vazamento: {len(vaz_b)})")
print(f"  acurácia                      {acc_b:.3f}")
print(f"  recall de URGÊNCIA            {recall_urg_b:.3f}")
print(f"  falsos alarmes de urgência    {alarmes_b}")
erros_b = [(X_b[i], y_b[i], pred_b[i], float(P_b[i].max())) for i in range(len(X_b)) if y_b[i] != pred_b[i]]
for t, real, prev, conf in erros_b:
    print(f"  [{real} → {prev} ({conf:.2f})] {t}")


# ═════════════ TESTE C (cego — escrito ANTES dos sinais de alarme) ═════════════
X_c, y_c, _ = ler("dataset_teste_c.csv", False)
vaz_c = [t for t in X_c if " ".join(normalizar(t)) in norm_tr]
P_c = modelo.predict_proba(vec.transform(X_c))
pred_c = [decidir(p, t) for p, t in zip(P_c, X_c)]
acc_c = accuracy_score(y_c, pred_c)
urg_c = [i for i, c in enumerate(y_c) if c == "urgencia"]
recall_urg_c = sum(pred_c[i] == "urgencia" for i in urg_c) / len(urg_c)
alarmes_c = sum(1 for i, c in enumerate(y_c) if c != "urgencia" and pred_c[i] == "urgencia")
rel_c = classification_report(y_c, pred_c, labels=classes, output_dict=True, zero_division=0)
print(f"\nTESTE C (CEGO) — {len(X_c)} frases (vazamento: {len(vaz_c)})")
print(f"  acurácia                      {acc_c:.3f}")
print(f"  recall de URGÊNCIA            {recall_urg_c:.3f}")
print(f"  falsos alarmes de urgência    {alarmes_c}")
erros_c = [(X_c[i], y_c[i], pred_c[i], float(P_c[i].max())) for i in range(len(X_c)) if y_c[i] != pred_c[i]]
for t, real, prev, conf in erros_c:
    print(f"  [{real} → {prev} ({conf:.2f})] {t}")

# Sanidade: sinais de alarme não podem disparar em frases NÃO urgentes do treino
fp_regras = [t for t, c in zip(X_tr, y_tr) if c != "urgencia" and sinal_alarme(t)]
cob_regras = sum(sinal_alarme(t) for t, c in zip(X_tr, y_tr) if c == "urgencia") / y_tr.count("urgencia")
print(f"\nSinais de alarme no treino: cobrem {cob_regras:.1%} das urgências | "
      f"disparos indevidos: {len(fp_regras)} de {len(X_tr) - y_tr.count('urgencia')}")
for t in fp_regras[:10]:
    print("   indevido:", t)

# Matriz de confusão é do teste C (o número honesto)
y_cm, pred_cm, acc_cm = y_c, pred_c, acc_c

# ═════════════ MATRIZ DE CONFUSÃO ═════════════
cm = confusion_matrix(y_cm, pred_cm, labels=classes)
try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    fig, ax = plt.subplots(figsize=(7.5, 6.5))
    ax.imshow(cm, cmap="Greens")
    rot = [NOMES[c].split(" /")[0] for c in classes]
    ax.set_xticks(range(len(classes)), rot, rotation=40, ha="right")
    ax.set_yticks(range(len(classes)), rot)
    for i in range(len(classes)):
        for j in range(len(classes)):
            ax.text(j, i, cm[i, j], ha="center", va="center",
                    color="white" if cm[i, j] > cm.max() / 2 else "black", fontsize=11)
    ax.set_xlabel("Previsto pela IA")
    ax.set_ylabel("Categoria correta")
    ax.set_title(f"Matriz de confusão — teste C (cego, {len(X_c)} frases)\nacurácia {acc_cm:.1%}")
    fig.tight_layout()
    fig.savefig("matriz_confusao.png", dpi=150)
    print("\nmatriz_confusao.png salva")
except Exception as e:
    print("matplotlib indisponível:", e)

# ═════════════ EXPORTAÇÃO PARA JAVASCRIPT ═════════════
vocab = vec.vocabulary_
idf = vec.idf_
coef, intercept = modelo.coef_, modelo.intercept_
ordem = sorted(vocab, key=vocab.get)            # features na ordem do índice
exp = {
    "versao": "2.0",
    "algoritmo": f"TF-IDF (palavras + bigramas + char 3-4) + Regressão Logística C={C_FINAL}",
    "classes": classes,
    "nomes": {c: NOMES[c] for c in classes},
    "stopwords": sorted(STOPWORDS),
    "limiarAbstencao": LIMIAR_ABSTENCAO,
    "limiarUrgencia": LIMIAR_URGENCIA,
    "sinaisAlarme": SINAIS_ALARME,
    "sinaisCrise": SINAIS_CRISE,
    "features": ordem,
    "idf": [round(float(idf[vocab[f]]), 5) for f in ordem],
    "coef": [[round(float(coef[k][vocab[f]]), 4) for f in ordem] for k in range(len(classes))],
    "intercept": [round(float(b), 5) for b in intercept],
    "metricas": {"acuracia_teste": round(acc_final, 4), "recall_urgencia": round(recall_urg, 4),
                 "acuracia_teste_b": round(acc_b, 4), "acuracia_teste_c": round(acc_c, 4),
                 "recall_urgencia_teste_c": round(recall_urg_c, 4), "frases_treino": len(X_tr), "frases_teste": len(X_te) + len(X_b)},
}
conteudo_js = ("/* Gerado automaticamente por ia/treinar_modelo.py — NÃO editar à mão. */\n"
               "const MODELO_IA = " + json.dumps(exp, ensure_ascii=False, separators=(",", ":")) + ";\n")
import os
destinos = ["modelo-ia.js"] + (["../frontend/assets/ml/modelo-ia.js"] if os.path.isdir("../frontend/assets/ml") else [])
for d in destinos:
    with open(d, "w", encoding="utf-8") as f:
        f.write(conteudo_js)
print("modelo exportado para:", destinos)

# probabilidades de referência para conferir a implementação JS
X_ref = [x for x in (X_te_orig + X_b + X_c)]
P_ref = modelo.predict_proba(vec.transform(X_ref))
referencia = [{"texto": t, "proba": [round(float(x), 6) for x in p], "decisao": decidir(p, t)}
              for t, p in zip(X_ref, P_ref)]
with open("referencia_python.json", "w", encoding="utf-8") as f:
    json.dump({"classes": classes, "casos": referencia}, f, ensure_ascii=False)

with open("relatorio_metricas.json", "w", encoding="utf-8") as f:
    json.dump({
        "dataset": {"treino": len(X_tr), "teste": len(X_te), "vazamento": len(vazadas),
                    "por_classe_treino": dict(Counter(y_tr)), "por_classe_teste_a": dict(Counter(y_te)), "teste_b": len(X_b), "teste_c": len(X_c)},
        "validacao_cruzada_agrupada": resultados_cv,
        "modelo_final": {"algoritmo": exp["algoritmo"], "n_features": len(ordem)},
        "teste_c_cego": {"frases": len(X_c), "acuracia": acc_c, "recall_urgencia": recall_urg_c,
                         "falsos_alarmes_urgencia": alarmes_c, "por_classe": rel_c,
                         "erros": [{"texto": t, "correto": r, "previsto": p, "confianca": c} for t, r, p, c in erros_c]},
        "sinais_alarme": {"cobertura_urgencias_treino": cob_regras, "disparos_indevidos_treino": len(fp_regras)},
        "teste_b_cego": {"frases": len(X_b), "acuracia": acc_b, "recall_urgencia": recall_urg_b,
                         "falsos_alarmes_urgencia": alarmes_b,
                         "erros": [{"texto": t, "correto": r, "previsto": p, "confianca": c} for t, r, p, c in erros_b]},
        "teste_independente": {"acuracia_argmax": acc_bruta, "acuracia_com_regras": acc_final,
                               "recall_urgencia": recall_urg, "falsos_alarmes_urgencia": falsos_alarmes,
                               "urgencias_perdidas": urg_perdida, "por_classe": rel},
        "matriz_confusao_teste_c": {"classes": classes, "valores": cm.tolist()},
        "erros": [{"texto": t, "correto": r, "previsto": p, "confianca": c} for t, r, p, c in erros],
    }, f, ensure_ascii=False, indent=2)

import os
print(f"modelo-ia.js: {os.path.getsize('modelo-ia.js') / 1024:.0f} KB")
