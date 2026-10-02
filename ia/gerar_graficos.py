"""
gerar_graficos.py — Gráficos do treinamento da IA de triagem (SaúdeMap IA)

Gera, em ia/graficos/, imagens prontas para slides e relatório.
Tudo é calculado a partir dos arquivos reais do projeto:
  dataset_treino.csv, relatorio_metricas.json, comparacao_v1.json,
  ../frontend/assets/ml/modelo-ia.js (ou modelo-ia.js na pasta atual, no Colab)
"""
import csv
import json
import os
import re
from collections import Counter

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import FancyBboxPatch

os.makedirs("graficos", exist_ok=True)

VERDE = "#0A8F82"
VERDE2 = "#02C39A"
ESCURO = "#0B3D3D"
CINZA = "#9AA5A4"
VERMELHO = "#C0392B"
LARANJA = "#E67E22"
plt.rcParams.update({"font.size": 11, "axes.spines.top": False, "axes.spines.right": False,
                     "axes.titleweight": "bold", "axes.titlesize": 14})

NOMES = {"cardio": "Cardiologia", "clinico": "Clínico Geral", "dentista": "Odontologia",
         "gineco": "Ginecologia", "pediatra": "Pediatria", "urgencia": "Urgência",
         "outro": "Fora do escopo"}
COR_CLASSE = {"urgencia": VERMELHO, "outro": CINZA}

R = json.load(open("relatorio_metricas.json", encoding="utf-8"))
caminho_modelo = "../frontend/assets/ml/modelo-ia.js" if os.path.exists("../frontend/assets/ml/modelo-ia.js") else "modelo-ia.js"
src = open(caminho_modelo, encoding="utf-8").read()
M = json.loads(src[src.index("{"):src.rindex("}") + 1])


def salvar(fig, nome):
    fig.tight_layout()
    fig.savefig(f"graficos/{nome}", dpi=160, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    print("  ✓", nome)


# ═══════════ 01 — Dataset por classe ═══════════
linhas = list(csv.DictReader(open("dataset_treino.csv", encoding="utf-8")))
cont = Counter(l["categoria"] for l in linhas)
grupos = {}
for l in linhas:
    grupos.setdefault(l["categoria"], set()).add(l["grupo"])
ordem = sorted(cont, key=cont.get)
fig, ax = plt.subplots(figsize=(10, 5.2))
y = np.arange(len(ordem))
total = [cont[c] for c in ordem]
bases = [len(grupos[c]) for c in ordem]
ax.barh(y, total, color=[COR_CLASSE.get(c, VERDE) for c in ordem], alpha=0.35, label="total com variações (gírias, erros de digitação)")
ax.barh(y, bases, color=[COR_CLASSE.get(c, VERDE) for c in ordem], label="frases-base (sujeito × sintoma, trechos escritos à mão)")
for i, c in enumerate(ordem):
    ax.text(total[i] + 8, i, f"{total[i]}  ({bases[i]} base)", va="center", fontsize=10)
ax.set_yticks(y, [NOMES[c] for c in ordem])
ax.set_xlabel("quantidade de frases")
ax.set_xlim(0, max(total) * 1.28)
ax.set_title(f"Dataset de treino — {len(linhas):,} frases em 7 classes".replace(",", "."))
ax.legend(loc="lower right", frameon=False)
salvar(fig, "01_dataset_por_classe.png")

# ═══════════ 02 — Comparação de algoritmos ═══════════
cv = R["validacao_cruzada_agrupada"]
nomes = list(cv)
acc = [cv[n]["acuracia_media"] * 100 for n in nomes]
dp = [cv[n]["acuracia_desvio"] * 100 for n in nomes]
cores = [VERDE2 if "C=5" in n else (VERDE if "Logística" in n else CINZA) for n in nomes]
fig, ax = plt.subplots(figsize=(10, 5))
b = ax.bar(range(len(nomes)), acc, yerr=dp, capsize=6, color=cores, edgecolor="none")
for i, v in enumerate(acc):
    ax.text(i, v + dp[i] + 0.35, f"{v:.1f}%", ha="center", fontweight="bold")
ax.set_xticks(range(len(nomes)), [n.replace(" (", "\n(") for n in nomes])
ax.set_ylim(88, 100)
ax.set_ylabel("acurácia média (%)")
ax.set_title("Comparação de algoritmos — validação cruzada agrupada (5 folds)")
ax.text(0.99, 0.98, "barra preta = desvio padrão entre os folds\nverde-claro = modelo escolhido (dá probabilidades)",
        transform=ax.transAxes, ha="right", va="top", fontsize=9, color="#555")
salvar(fig, "02_comparacao_algoritmos.png")

# ═══════════ 03 — v1 x v2 ═══════════
if os.path.exists("comparacao_v1.json"):
    v1 = json.load(open("comparacao_v1.json", encoding="utf-8"))["teste_c"]
    v2 = R["teste_c_cego"]
    metricas = ["Acurácia geral", "Urgências detectadas"]
    val_v1 = [v1["acuracia"] * 100, v1["recall_urgencia"] * 100]
    val_v2 = [v2["acuracia"] * 100, v2["recall_urgencia"] * 100]
    fig, ax = plt.subplots(figsize=(9.5, 5.3))
    x = np.arange(2); w = 0.36
    ax.bar(x - w / 2, val_v1, w, color=CINZA, label="v1 — similaridade de cosseno, 82 frases")
    ax.bar(x + w / 2, val_v2, w, color=VERDE, label="v2 — Regressão Logística + sinais de alarme")
    for i in range(2):
        ax.text(x[i] - w / 2, val_v1[i] + 1.5, f"{val_v1[i]:.1f}%", ha="center", fontsize=13, fontweight="bold", color="#555")
        ax.text(x[i] + w / 2, val_v2[i] + 1.5, f"{val_v2[i]:.1f}%", ha="center", fontsize=13, fontweight="bold", color=VERDE)
    ax.set_xticks(x, metricas, fontsize=12)
    ax.set_ylim(0, 115); ax.set_ylabel("%")
    ax.set_title("IA antiga × IA nova — mesmo teste cego (70 frases)")
    ax.legend(loc="upper left", frameon=False)
    salvar(fig, "03_v1_vs_v2.png")


# ═══════════ 04 — Honestidade da medição ═══════════
dados = [("Teste A", R["teste_independente"]["acuracia_com_regras"] * 100, LARANJA,
          "usado para\ncorrigir dados\n→ CONTAMINADO"),
         ("Teste B", R["teste_b_cego"]["acuracia"] * 100, "#F1C40F",
          "regras vieram\ndepois dele\n→ PARCIAL"),
         ("Teste C", R["teste_c_cego"]["acuracia"] * 100, VERDE,
          "nunca usado\npara ajustar\n→ NÚMERO REAL")]
fig, ax = plt.subplots(figsize=(10, 5.6))
for i, (n, v, c, nota) in enumerate(dados):
    ax.bar(i, v, color=c, width=0.6)
    ax.text(i, v + 0.6, f"{v:.1f}%", ha="center", fontsize=15, fontweight="bold")
    ax.text(i, 81.3, nota, ha="center", va="bottom", fontsize=10, fontweight="bold",
            color=ESCURO if c == "#F1C40F" else "white")
ax.axhline(90, ls="--", color=ESCURO, lw=1)
ax.text(2.42, 90.3, "meta 90%", fontsize=9, color=ESCURO, ha="right")
ax.set_xticks(range(3), [d[0] for d in dados], fontsize=12)
ax.set_ylim(80, 102); ax.set_ylabel("acurácia (%)")
ax.set_title("Por que o número honesto é 91,4% e não 98,6%")
ax.text(0.0, -0.12, "atenção: o eixo começa em 80% para destacar a diferença", transform=ax.transAxes,
        fontsize=8.5, color="#777")
salvar(fig, "04_honestidade_dos_testes.png")

# ═══════════ 05 — O que a IA aprendeu (palavras mais fortes por classe) ═══════════
feats = M["features"]; coef = np.array(M["coef"]); classes = M["classes"]
fig, axs = plt.subplots(2, 4, figsize=(15, 7.5))
axs = axs.ravel()
for k, c in enumerate(classes):
    idx = [j for j, f in enumerate(feats) if f.startswith(("w:", "b:"))]
    top = sorted(idx, key=lambda j: coef[k][j], reverse=True)[:8][::-1]
    rot = [feats[j][2:].replace("_", " ") for j in top]
    axs[k].barh(range(len(top)), [coef[k][j] for j in top], color=COR_CLASSE.get(c, VERDE))
    axs[k].set_yticks(range(len(top)), rot, fontsize=10)
    axs[k].set_title(NOMES[c], fontsize=12)
    axs[k].tick_params(axis="x", labelsize=8)
axs[7].axis("off")
axs[7].text(0.0, 0.72, "Cada barra é o PESO que a IA dá\nà palavra. Ninguém escreveu essas\nregras: ela aprendeu dos exemplos.",
            fontsize=10.5, va="center", color=ESCURO)
axs[7].text(0.0, 0.25, "⚠ Vício encontrado: \"tô\", \"agora\",\n\"diz\", \"pai\" NÃO são sintomas.\n"
            "A IA aprendeu também o JEITO como\nas frases de treino foram escritas\n"
            "(shortcut learning). Remédio:\nfrases de pessoas reais.",
            fontsize=10.5, va="center", color=VERMELHO)
fig.suptitle("O que a IA aprendeu — palavras que mais pesam em cada classe", fontsize=15, fontweight="bold")
salvar(fig, "05_o_que_a_ia_aprendeu.png")

# ═══════════ 06 — Como a IA pensa (probabilidades) ═══════════
STOP = set(M["stopwords"]); IDX = {f: i for i, f in enumerate(feats)}
RE_AL = [re.compile(r) for r in M["sinaisAlarme"]]


def norm(t):
    import unicodedata
    t = unicodedata.normalize("NFD", t.lower())
    t = "".join(ch for ch in t if not ("\u0300" <= ch <= "\u036f"))
    return "".join(ch if ("a" <= ch <= "z" or "0" <= ch <= "9") else " " for ch in t).split()


def proba(texto):
    p = [w for w in norm(texto) if w not in STOP]
    f = ["w:" + w for w in p] + ["b:" + p[i] + "_" + p[i + 1] for i in range(len(p) - 1)]
    for w in p:
        s = " " + w + " "
        for n in (3, 4):
            f += ["c:" + s[i:i + n] for i in range(len(s) - n + 1)]
    cnt = Counter(IDX[x] for x in f if x in IDX)
    v = {j: (1 + np.log(tf)) * M["idf"][j] for j, tf in cnt.items()}
    nn = np.sqrt(sum(x * x for x in v.values())) or 1
    z = np.array(M["intercept"]) + sum(coef[:, j] * (x / nn) for j, x in v.items())
    e = np.exp(z - z.max()); return e / e.sum()


# ═══════════ 00 — Pipeline ═══════════
fig, ax = plt.subplots(figsize=(13, 4.2))
ax.set_xlim(0, 13); ax.set_ylim(0, 4.2); ax.axis("off")
etapas = [
    ("Texto\ndigitado", '"meu dente\ntá doendo"', ESCURO),
    ("Normalização", "minúsculas\nsem acento", VERDE),
    ("Features", "palavras + pares\n+ pedaços de letras", VERDE),
    ("TF-IDF", "peso de cada\nfeature", VERDE),
    ("Regressão\nLogística", "probabilidade\npor classe", VERDE),
    ("Camadas de\nsegurança", "alarme · urgência\n· abstenção", VERMELHO),
    ("Resultado", f"Odontologia\n{proba('meu dente tá doendo')[classes.index('dentista')]:.0%}", VERDE2),
]
larg, x0, gap = 1.55, 0.2, 0.28
for i, (titulo, sub, cor) in enumerate(etapas):
    x = x0 + i * (larg + gap)
    ax.add_patch(FancyBboxPatch((x, 1.5), larg, 1.7, boxstyle="round,pad=0.04,rounding_size=0.12",
                                fc=cor, ec="none"))
    ax.text(x + larg / 2, 2.75, titulo, ha="center", va="center", color="white", fontsize=11, fontweight="bold")
    ax.text(x + larg / 2, 1.95, sub, ha="center", va="center", color="white", fontsize=8.5)
    if i < len(etapas) - 1:
        ax.annotate("", xy=(x + larg + gap - 0.02, 2.35), xytext=(x + larg + 0.02, 2.35),
                    arrowprops=dict(arrowstyle="-|>", color=ESCURO, lw=1.6))
ax.text(6.5, 3.85, "Como a IA de triagem processa uma frase", ha="center", fontsize=15, fontweight="bold", color=ESCURO)
ax.text(6.5, 0.75, "Treinado em Python (scikit-learn / Google Colab)  →  pesos exportados  →  executado no navegador",
        ha="center", fontsize=10.5, color="#555")
ax.text(6.5, 0.3, "O texto do cidadão nunca sai do navegador (privacidade / LGPD)", ha="center", fontsize=9.5,
        color=VERDE, style="italic")
salvar(fig, "00_pipeline.png")


frases = ["meu bebê tá com febre", "dor de dnete forte", "dor no peito e falta de ar", "que horas abre o posto"]
fig, axs = plt.subplots(1, 4, figsize=(16, 4.6), sharey=True)
for ax, fr in zip(axs, frases):
    p = proba(fr) * 100
    ax.barh(range(len(classes)), p, color=[COR_CLASSE.get(c, VERDE) for c in classes])
    ax.set_yticks(range(len(classes)), [NOMES[c] for c in classes])
    ax.set_xlim(0, 105)
    for i, v in enumerate(p):
        if v >= 3:
            ax.text(v + 1.5, i, f"{v:.0f}%", va="center", fontsize=9)
    alarme = any(r.search(" ".join(norm(fr))) for r in RE_AL)
    top = classes[int(np.argmax(p))]
    if alarme or p[classes.index("urgencia")] >= M["limiarUrgencia"] * 100:
        dec, cor = "→ URGÊNCIA + SAMU 192", VERMELHO
    elif top == "outro" or p.max() < M["limiarAbstencao"] * 100:
        dec, cor = "→ não sugere nada", CINZA
    else:
        dec, cor = f"→ {NOMES[top]}", VERDE
    ax.set_title(f'"{fr}"\n{dec}', fontsize=11, color=cor)
fig.suptitle("Como a IA pensa — probabilidade de cada classe para 4 frases", fontsize=15, fontweight="bold")
salvar(fig, "06_como_a_ia_pensa.png")

# ═══════════ 07 — Curva de aprendizado ═══════════
try:
    import unicodedata  # noqa
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import accuracy_score
    from sklearn.model_selection import StratifiedGroupKFold

    def analisar(t):
        p = [w for w in norm(t) if w not in STOP]
        f = ["w:" + w for w in p] + ["b:" + p[i] + "_" + p[i + 1] for i in range(len(p) - 1)]
        for w in p:
            s = " " + w + " "
            for n in (3, 4):
                f += ["c:" + s[i:i + n] for i in range(len(s) - n + 1)]
        return f

    X = np.array([l["texto"] for l in linhas], dtype=object)
    y = np.array([l["categoria"] for l in linhas])
    g = np.array([int(l["grupo"]) for l in linhas])
    rng = np.random.default_rng(0)
    fracs = [0.1, 0.2, 0.35, 0.5, 0.75, 1.0]
    medias, desvios = [], []
    for fr in fracs:
        accs = []
        for tr, va in StratifiedGroupKFold(5, shuffle=True, random_state=1).split(X, y, g):
            grupos_tr = np.unique(g[tr])
            sel = set(rng.choice(grupos_tr, max(7, int(len(grupos_tr) * fr)), replace=False))
            tr2 = [i for i in tr if g[i] in sel]
            vec = TfidfVectorizer(analyzer=analisar, sublinear_tf=True, min_df=2)
            m = LogisticRegression(C=5, max_iter=3000).fit(vec.fit_transform(X[tr2]), y[tr2])
            accs.append(accuracy_score(y[va], m.predict(vec.transform(X[va]))))
        medias.append(np.mean(accs) * 100); desvios.append(np.std(accs) * 100)
        print(f"    curva: {fr:.0%} dos dados → {medias[-1]:.1f}%")
    n_fr = [int(len(X) * 0.8 * f) for f in fracs]  # cada fold treina com ~80% dos dados
    fig, ax = plt.subplots(figsize=(10, 5))
    ax.plot(n_fr, medias, "o-", color=VERDE, lw=2.5, ms=8)
    ax.fill_between(n_fr, np.array(medias) - desvios, np.array(medias) + desvios, color=VERDE, alpha=0.15)
    for x_, m_ in zip(n_fr, medias):
        ax.text(x_, m_ + 1.2, f"{m_:.1f}%", ha="center", fontsize=9.5)
    ax.set_xlabel("frases de treino"); ax.set_ylabel("acurácia na validação (%)")
    ax.set_ylim(min(medias) - 8, 100)
    ax.set_title("Curva de aprendizado — mais dados, IA melhor")
    ax.text(0.98, 0.06, "a curva ainda sobe no final:\nmais frases (principalmente REAIS)\nainda devem melhorar a IA",
            transform=ax.transAxes, ha="right", fontsize=9.5, color="#555")
    salvar(fig, "07_curva_de_aprendizado.png")
except Exception as e:
    print("  curva de aprendizado ignorada:", e)

# ═══════════ 08 — Matriz de confusão (cópia) ═══════════
if os.path.exists("matriz_confusao.png"):
    import shutil
    shutil.copy("matriz_confusao.png", "graficos/08_matriz_confusao.png")
    print("  ✓ 08_matriz_confusao.png")

print("\nGráficos em ia/graficos/")
