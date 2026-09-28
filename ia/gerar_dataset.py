"""
gerar_dataset.py — Construção do corpus de treino da IA de triagem (SaúdeMap IA)

Estratégia:
  1. Frases-base escritas à mão por categoria (sintomas + sujeitos + contextos)
  2. Combinação controlada sujeito × sintoma × complemento
  3. Aumentação: gírias ("tô", "tá", "mt"), erros de digitação, complementos de tempo
  4. Cada frase carrega um "grupo" (id da frase-base) — usado na validação cruzada
     agrupada, para que variações da MESMA frase nunca caiam em treino e validação
     ao mesmo tempo (isso inflaria artificialmente a acurácia).

Critério clínico adotado (segurança do paciente):
  - Dor no peito LEVE/crônica, pressão, colesterol, palpitação  -> cardio
  - Dor no peito FORTE/súbita, com suor, irradiando pro braço,
    falta de ar em repouso, sinais de AVC, desmaio, sangramento  -> urgencia
  - Na dúvida entre cardio e urgência, a regra de segurança do
    classificador favorece urgência (ver treinar_modelo.py).
"""
import csv
import random

random.seed(42)

# ───────────────────────────── DENTISTA ─────────────────────────────
DENT_SINT = [
    "dor de dente", "dor no dente", "dente doendo", "dor forte no dente", "dente latejando",
    "gengiva inflamada", "gengiva sangrando", "gengiva inchada", "sangramento na gengiva",
    "dente quebrado", "dente lascado", "dente mole", "dente trincado", "carie no dente",
    "buraco no dente", "dente furado", "dente sensivel ao gelado", "sensibilidade nos dentes",
    "dor ao mastigar", "siso nascendo", "siso inflamado", "dente do siso doendo",
    "abscesso no dente", "rosto inchado por causa do dente", "canal inflamado",
    "restauracao caiu", "obturacao caiu", "aparelho machucando a boca", "aparelho ortodontico soltou",
    "dentadura machucando", "protese dentaria solta", "mau halito forte", "tartaro nos dentes",
    "dente escurecido", "dor no dente quando bebo agua gelada", "dente de leite mole doendo",
    "dor de dente que nao passa com remedio", "pus na gengiva", "bolinha na gengiva",
    "dor na gengiva perto do siso", "dente amarelado e dolorido", "gengiva retraida",
]
DENT_EXTRA = [
    "preciso fazer limpeza nos dentes", "quero arrancar um dente", "preciso extrair um dente",
    "preciso fazer canal", "quero consultar um dentista", "avaliacao odontologica",
    "tratamento dentario", "quero fazer restauracao", "consulta com dentista para meu filho",
]
DENT_SUJ = ["", "estou com", "to com", "tenho", "sinto", "estou sentindo", "acordei com",
            "meu filho esta com", "minha mae esta com", "meu marido esta com"]

# ───────────────────────────── PEDIATRA ─────────────────────────────
PED_SUJ = ["meu bebe", "minha bebe", "meu filho", "minha filha", "meu nenem", "a crianca",
           "meu filho de 2 anos", "minha filha de 4 anos", "meu menino", "minha menina",
           "o recem nascido", "meu bebe de 6 meses", "minha crianca", "meu filho pequeno",
           "o nenem", "meu sobrinho de 3 anos"]
PED_VERBO = ["esta com", "ta com", "anda com", "acordou com", "tem", "apareceu com"]
PED_SINT = [
    "febre", "febre alta", "tosse", "tosse com catarro", "catarro", "nariz escorrendo", "coriza",
    "diarreia", "vomito", "manchas vermelhas na pele", "bolinhas pelo corpo", "catapora",
    "assadura", "dor de ouvido", "dor de barriga", "colica", "garganta inflamada", "piolho",
    "lombriga", "alergia na pele", "brotoeja", "chiado no peito", "olho vermelho", "conjuntivite",
    "pouco apetite", "muita moleza", "ranho", "gripe", "resfriado", "sapinho na boca",
    "caxumba", "dor de garganta", "virose", "febre e tosse", "diarreia e vomito",
]
PED_FRASES = [
    "meu bebe nao quer mamar", "o bebe chora sem parar", "minha filha nao quer comer nada",
    "consulta de rotina do bebe", "acompanhamento do crescimento do meu filho",
    "pesar e medir o bebe", "puericultura do recem nascido", "as vacinas da crianca estao atrasadas",
    "teste do pezinho", "meu filho nao esta ganhando peso", "o nenem esta vomitando depois de mamar",
    "meu filho reclama de dor na barriga toda manha", "minha filha coca muito a cabeca",
    "o bebe esta com o umbigo vermelho", "meu filho molha a cama a noite",
    "preciso de pediatra para meu filho", "consulta com pediatra", "minha crianca vive gripada",
    "o bebe dorme demais e esta molinho", "meu filho tem bronquite",
]

# ───────────────────────────── CLÍNICO ──────────────────────────────
CLIN_SUJ = ["", "estou com", "to com", "eu estou com", "sinto", "tenho", "acordei com",
            "estou sentindo", "meu marido esta com", "minha esposa esta com", "minha mae esta com",
            "meu pai esta com", "minha avo esta com", "meu irmao esta com", "faz dias que estou com"]
CLIN_SINT = [
    "febre", "gripe", "resfriado", "tosse seca", "tosse com catarro", "dor de garganta",
    "garganta inflamada", "nariz entupido", "sinusite", "dor de cabeca", "enxaqueca",
    "dor no corpo", "dor nas costas", "dor lombar", "dor na coluna", "dor de barriga",
    "diarreia", "vomito", "enjoo", "azia", "gastrite", "queimacao no estomago",
    "ardencia ao urinar", "infeccao urinaria", "dor ao fazer xixi", "tontura", "cansaco",
    "fraqueza", "insonia", "dor no joelho", "dor no ombro", "dor muscular", "alergia",
    "coceira no corpo", "micose", "unha encravada", "dor de ouvido", "conjuntivite",
    "glicose alta", "anemia", "prisao de ventre", "hemorroida", "dor nas juntas",
    "febre e dor no corpo", "mal estar", "dor no pe", "espinha inflamada", "virose",
    "tosse que nao passa", "catarro no peito", "dor no punho", "labirintite", "rinite",
]
CLIN_FRASES = [
    "preciso renovar minha receita", "quero pedir exame de sangue", "quero fazer um check up",
    "exame de rotina", "preciso de atestado medico", "consulta de rotina", "preciso de encaminhamento para especialista",
    "quero mostrar resultado de exame", "preciso de receita do remedio de diabetes",
    "quero consultar com clinico geral", "tenho diabetes e preciso de acompanhamento",
    "meu remedio de tireoide acabou", "quero fazer exame de urina", "preciso trocar meu remedio",
    "quero avaliar minha saude em geral", "estou me sentindo fraco e sem energia",
    "estou emagrecendo sem motivo", "machuquei o pe jogando bola", "torci o tornozelo",
    "cortei o dedo e esta inflamado", "fui picado por inseto e inchou", "estou com a imunidade baixa",
]

# ───────────────────────────── CARDIO ───────────────────────────────
CARD_SUJ = ["", "tenho", "estou com", "sinto", "meu pai tem", "minha mae tem", "meu avo tem",
            "estou tendo", "ando com", "faz tempo que tenho"]
CARD_SINT = [
    "pressao alta", "hipertensao", "pressao descontrolada", "pressao subindo toda hora",
    "colesterol alto", "triglicerides alto", "palpitacao", "coracao acelerado",
    "coracao disparando as vezes", "batedeira no coracao", "arritmia", "coracao batendo fora do ritmo",
    "cansaco ao subir escada", "falta de ar quando faco esforco", "inchaco nos pes e tornozelos",
    "pernas inchadas no fim do dia", "sopro no coracao", "dor leve no peito quando faco esforco",
    "aperto leve no peito quando caminho rapido", "coracao grande", "insuficiencia cardiaca",
    "pressao alta mesmo tomando remedio", "tontura quando a pressao sobe",
]
CARD_FRASES = [
    "quero fazer eletrocardiograma", "preciso fazer ecocardiograma", "quero fazer teste ergometrico",
    "tenho historico de infarto na familia", "ja tive infarto e preciso de acompanhamento",
    "uso marcapasso e preciso de revisao", "quero fazer um check up do coracao",
    "preciso de avaliacao cardiologica", "quero saber meu risco cardiaco",
    "preciso de cardiologista", "consulta com cardiologista", "controle da pressao arterial",
    "meu remedio de pressao nao esta fazendo efeito", "quero medir minha pressao",
    "o medico pediu exame do coracao", "tenho colesterol alto e quero tratar",
    "sinto o coracao pular uma batida de vez em quando", "meu coracao acelera quando deito",
]

# ───────────────────────────── GINECO ───────────────────────────────
GIN_SUJ = ["", "estou com", "tenho", "to com", "sinto", "estou tendo", "minha esposa esta com",
           "minha filha adolescente esta com", "faz um mes que estou com"]
GIN_SINT = [
    "atraso menstrual", "menstruacao atrasada", "menstruacao irregular", "colica menstrual forte",
    "menstruacao muito forte", "sangramento fora da menstruacao", "corrimento", "corrimento com cheiro forte",
    "coceira intima", "ardencia intima", "candidiase", "dor na relacao", "caroco no seio",
    "nodulo na mama", "dor no seio", "calorao da menopausa", "ovario policistico", "mioma",
    "infeccao vaginal", "endometriose", "tpm muito forte", "corrimento amarelado",
    "menstruacao que nao para", "sangramento depois da relacao", "dor no pe da barriga na menstruacao",
    "coceira na vagina", "secrecao no bico do seio",
]
GIN_FRASES = [
    "quero fazer exame preventivo", "preciso fazer papanicolau", "consulta ginecologica",
    "quero comecar a tomar anticoncepcional", "quero trocar de anticoncepcional", "quero colocar diu",
    "quero fazer teste de gravidez", "acho que estou gravida", "preciso fazer pre natal",
    "estou gravida e preciso de acompanhamento", "quero fazer mamografia", "estou entrando na menopausa",
    "orientacao sobre planejamento familiar", "preciso de ginecologista", "consulta com ginecologista",
    "a menstruacao nao desceu esse mes", "minha menstruacao atrasou duas semanas",
    "gravida de 3 meses e quero acompanhamento", "quero fazer ultrassom transvaginal",
]

# ───────────────────────────── URGÊNCIA ─────────────────────────────
URG_FRASES = [
    "dor no peito muito forte", "dor no peito que nao passa", "aperto no peito com suor frio",
    "dor no peito que vai para o braco esquerdo", "dor no peito e braco formigando",
    "falta de ar muito forte", "nao consigo respirar", "estou sufocando", "ele desmaiou",
    "desmaiei agora", "perdeu a consciencia", "ela nao acorda", "esta tendo convulsao",
    "teve uma convulsao", "ficou com a boca torta de repente", "um lado do corpo paralisou",
    "fala enrolada de repente", "perdeu a forca no braco de repente", "sangramento que nao para",
    "esta sangrando muito", "vomitando sangue", "corte profundo sangrando", "sofri acidente de moto",
    "acidente de carro grave", "foi atropelado", "caiu do telhado", "bateu a cabeca muito forte",
    "fratura exposta", "osso aparecendo na perna", "queimadura grave", "queimou com oleo quente",
    "engoliu veneno", "tomou remedio demais", "crianca engoliu produto de limpeza",
    "picada de cobra", "picada de escorpiao", "reacao alergica grave", "garganta fechando",
    "rosto e labios inchando depois do remedio", "engasgado sem conseguir respirar", "quase se afogou",
    "levou choque eletrico", "bebe com febre muito alta e convulsao", "bebe ficou roxo",
    "bebe nao esta respirando direito", "gravida sangrando muito", "a bolsa estourou",
    "contracoes muito fortes gravida", "dor de cabeca subita muito forte a pior da vida",
    "desmaiou e bateu a cabeca", "labios roxos e falta de ar", "suor frio e dor no peito",
    "pressao muito alta com dor no peito e visao turva", "confusao mental de repente",
    "levou uma facada", "levou um tiro", "sangue saindo pelo ouvido depois da queda",
    "dor na barriga insuportavel e barriga dura", "febre alta com manchas roxas no corpo",
    "infarto", "acho que estou tendo um infarto", "acho que ele esta tendo um avc", "avc",
    "parada cardiaca", "desmaio com dor no peito",
]
URG_PREF = ["", "", "", "socorro ", "urgente ", "me ajuda ", "rapido ", "emergencia "]
URG_SUF = ["", "", "", " agora", " o que eu faco", " de repente", " rapido"]

# ───────────────────────────── OUTRO ────────────────────────────────
OUTRO_FRASES = [
    "bom dia", "boa tarde", "boa noite", "oi", "ola", "obrigado", "obrigada", "valeu", "teste",
    "testando", "qual o horario de funcionamento", "que horas abre o posto", "que horas fecha a ubs",
    "onde fica o posto de saude", "endereco da ubs centro", "telefone do posto", "como faco para marcar consulta",
    "como agendar atendimento", "como tirar cartao do sus", "quais vacinas estao disponiveis",
    "quando comeca a campanha de vacinacao", "tem vacina da gripe", "o posto abre sabado",
    "quem e o medico de hoje", "lista de medicos", "como funciona o site", "esqueci minha senha",
    "quero trocar minha senha", "como sair da conta", "asdfgh", "kkkkkk", "aaaaa", "qualquer coisa",
    "nada", "sim", "nao", "ok", "futebol", "receita de bolo", "previsao do tempo",
    "quero falar com a secretaria de saude", "quero fazer uma reclamacao", "quero fazer um elogio",
    "onde fica a farmacia popular", "como chegar no hospital municipal", "o posto atende hoje",
    "precisa de agendamento", "quanto custa a consulta", "aceita cartao do sus",
    "qual o numero do samu", "horario da vacinacao", "posto mais perto de mim", "mapa dos postos",
    "calendario de vacinacao", "noticias da saude", "quem desenvolveu esse site", "como me cadastrar",
    "onde vejo meu historico de vacinas", "tem estacionamento no posto", "posso levar acompanhante",
    "hello", "tudo bem", "quero saber sobre a campanha de hpv", "que dia e hoje", "abc123",
    "o site esta lento", "nao consigo entrar", "atualizar meus dados", "fila do posto esta grande",
]
OUTRO_PREF = ["", "", "por favor ", "gostaria de saber ", "me diz ", "uma pergunta "]


# ─────────── Lacunas de cobertura identificadas na 1ª avaliação ───────────
# (a) Emergência com CRIANÇA deve ser urgência, não pediatria
URG_CRIANCA_SUJ = ["meu filho", "minha filha", "o bebe", "a crianca", "meu nenem", "minha bebe",
                   "meu filho pequeno", "a nenem"]
URG_CRIANCA_EVT = ["engoliu produto de limpeza", "bebeu agua sanitaria", "tomou veneno", "ficou roxo",
                   "nao esta respirando", "esta engasgado", "esta convulsionando", "caiu e bateu a cabeca forte",
                   "desmaiou", "nao acorda", "se queimou feio", "engoliu uma pilha", "bebeu querosene",
                   "esta com os labios roxos", "tomou os remedios da avo", "caiu na piscina",
                   "esta mole e nao reage", "engoliu uma bala e sufocou"]
# (b) Picadas, mordidas e envenenamentos
URG_ANIMAL = ["picado por escorpiao", "escorpiao me picou", "mordida de cobra", "cobra me mordeu",
              "picada de aranha marrom", "abelha picou e estou inchando todo", "fui picado por varias abelhas",
              "cachorro mordeu e esta sangrando muito", "comi planta venenosa", "bebi veneno por engano"]
# (c) "nao consigo X" que NÃO é urgência
CLIN_NAO_CONSIGO = ["tenho dificuldade para dormir", "nao consigo pegar no sono", "acordo varias vezes a noite",
                    "nao consigo parar de espirrar", "nao consigo emagrecer", "nao durmo bem faz tempo"]
# (d) Frases de agradecimento / pedido de ajuda com o site
OUTRO_AJUDA = ["muito obrigado", "agradeco a ajuda", "preciso de ajuda com o cadastro", "ajuda para usar o site",
               "obrigado pela atencao", "valeu pela informacao", "me ajuda a achar o posto", "ajuda com a senha"]
# (e) "peito" no sentido de mama e sangramento ginecológico comum
GIN_EXTRA = ["caroco no peito", "bolinha no seio", "nodulo no peito", "achei uma bolinha na mama",
             "sangramento fora do periodo", "sangrando fora do ciclo", "escape menstrual",
             "sangramento entre as menstruacoes", "peito dolorido perto da menstruacao"]
# (f) Clínico com palavras que colidiam com cardio ("quando ando", "faco")
CLIN_EXTRA = ["arde para urinar", "xixi ardendo", "dor ao urinar", "urina com ardor", "dor no joelho quando caminho",
              "dor na perna quando ando", "dor no quadril ao andar", "garganta doendo", "doi a garganta para engolir",
              "check up geral com pressao normal", "exame geral de saude"]
DENT_EXTRA2 = ["acho que tenho carie", "carie doendo", "carie no dente de tras"]
CARD_EXTRA = ["fazer eletro", "exame eletro do coracao", "pedir um eletro", "fazer eco do coracao"]

# ───────────────────── Aumentação (gírias e erros) ─────────────────────
GIRIAS = [(" esta ", " ta "), (" estou ", " to "), (" muito ", " mt "), (" para ", " pra "),
          (" voce ", " vc "), (" porque ", " pq "), (" nao ", " n "), (" tambem ", " tb ")]
TEMPO = ["", "", "", " desde ontem", " faz tres dias", " ha uma semana", " desde cedo",
         " faz dias", " toda noite"]
EDUC = ["", "", "", "", "doutor ", "por favor ", "boa tarde ", "oi "]


def gírias(t):
    t = f" {t} "
    for a, b in GIRIAS:
        if a in t and random.random() < 0.5:
            t = t.replace(a, b)
    return t.strip()


def erro_digitacao(t):
    palavras = t.split()
    cand = [i for i, w in enumerate(palavras) if len(w) >= 5]
    if not cand:
        return t
    i = random.choice(cand)
    w = palavras[i]
    j = random.randrange(1, len(w) - 1)
    op = random.choice(["apaga", "duplica", "troca"])
    if op == "apaga":
        w = w[:j] + w[j + 1:]
    elif op == "duplica":
        w = w[:j] + w[j] + w[j:]
    else:
        w = w[:j - 1] + w[j] + w[j - 1] + w[j + 1:]
    palavras[i] = w
    return " ".join(palavras)


def variar(base, n):
    """Gera n variações de uma frase-base (a própria base incluída)."""
    out = {base}
    tentativas = 0
    while len(out) < n and tentativas < n * 10:
        tentativas += 1
        t = base
        if random.random() < 0.35:
            t = random.choice(EDUC) + t
        if random.random() < 0.35:
            t = t + random.choice(TEMPO)
        t = gírias(t)
        if random.random() < 0.30:
            t = erro_digitacao(t)
        out.add(" ".join(t.split()))
    return list(out)


def combinar(sujeitos, sintomas):
    frases = []
    for s in sintomas:
        for suj in random.sample(sujeitos, min(4, len(sujeitos))):
            frases.append(f"{suj} {s}".strip())
    return frases


linhas = []
grupo_id = 0


def adicionar(categoria, bases, n_var):
    global grupo_id
    for b in bases:
        grupo_id += 1
        for v in variar(b, n_var):
            linhas.append((v, categoria, grupo_id))


adicionar("dentista", combinar(DENT_SUJ, DENT_SINT) + DENT_EXTRA, 3)
ped_bases = []
for s in PED_SINT:
    for suj in random.sample(PED_SUJ, 4):
        ped_bases.append(f"{suj} {random.choice(PED_VERBO)} {s}")
adicionar("pediatra", ped_bases + PED_FRASES, 3)
adicionar("clinico", combinar(CLIN_SUJ, CLIN_SINT) + CLIN_FRASES, 2)
adicionar("cardio", combinar(CARD_SUJ, CARD_SINT) + CARD_FRASES, 4)
adicionar("gineco", combinar(GIN_SUJ, GIN_SINT) + GIN_FRASES, 3)

urg_bases = []
for f in URG_FRASES:
    for _ in range(3):
        urg_bases.append((random.choice(URG_PREF) + f + random.choice(URG_SUF)).strip())
adicionar("urgencia", list(dict.fromkeys(urg_bases)), 3)

outro_bases = list(dict.fromkeys((random.choice(OUTRO_PREF) + f).strip()
                                 for f in OUTRO_FRASES for _ in range(3)))
adicionar("outro", outro_bases, 3)


urg_cri = [f"{s} {e}" for s in URG_CRIANCA_SUJ for e in random.sample(URG_CRIANCA_EVT, 6)]
adicionar("urgencia", urg_cri + URG_ANIMAL, 3)
adicionar("clinico", combinar(CLIN_SUJ, CLIN_EXTRA) + CLIN_NAO_CONSIGO, 3)
adicionar("outro", OUTRO_AJUDA, 3)
adicionar("gineco", combinar(GIN_SUJ, GIN_EXTRA), 3)
adicionar("dentista", DENT_EXTRA2, 3)
adicionar("cardio", CARD_EXTRA, 3)

# remove duplicatas exatas mantendo a primeira ocorrência
vistos, final = set(), []
for t, c, g in linhas:
    if t not in vistos:
        vistos.add(t)
        final.append((t, c, g))

with open("dataset_treino.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["texto", "categoria", "grupo"])
    w.writerows(final)

from collections import Counter
print(f"Total: {len(final)} frases | {grupo_id} frases-base")
for c, n in sorted(Counter(c for _, c, _ in final).items()):
    print(f"  {c:10s} {n}")
