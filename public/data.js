// Fontes: Google Places (endereço, telefone, coordenadas, horário) — verificado em ago/2026.
// Serviços oferecidos por posto ainda são estimativas típicas de UBS — confirmar com a Secretaria.
// Fonte primária: site oficial da Prefeitura (barradogarcas.mt.gov.br/Prefeitura/UBS), ago/2026.
// Coordenadas (lat/lng): Google Places, por aproximação de endereço/bairro — a Prefeitura não publica coordenadas.
const POSTOS = [
  {
    id: 1, nome: "UBS Centro", status: "aberto",
    endereco: "Rua 1º de Maio, s/nº — Centro (em frente ao Correios), Barra do Garças/MT",
    telefone: "(66) 99224-1972", // WhatsApp oficial da unidade
    horario: "Seg–Sex: 7h–11h e 13h–17h",
    servicos: ["Clínico Geral","Enfermagem","Vacinação","Pré-natal"],
    lat: -15.8909938, lng: -52.2572800,
    obs: "Dados oficiais (Prefeitura): coordenadora Enfª. Danielle Carmo Pitaluga Araujo; médica Drª Claúdia Fernanda Bueno da Silva.",
    aviso: false
  },
  {
    id: 2, nome: "UBS Anchieta", status: "aberto",
    endereco: "Av. Anchieta, s/nº — Anchieta, Barra do Garças/MT",
    telefone: "(66) 99263-1663", // WhatsApp oficial da unidade
    horario: "Seg–Sex: 7h–11h e 13h–17h",
    servicos: ["Clínico Geral","Vacinação","Enfermagem","Pediatria"],
    lat: -15.8798443, lng: -52.2316507,
    obs: "Dados oficiais (Prefeitura): coordenadora Enfª. Lorena Carvalho Adorno; médica Drª Elis Daiana Ferreira Soares.",
    aviso: false
  },
  {
    id: 3, nome: "UPA Barra do Garças", status: "urgencia",
    endereco: "Barra do Garças/MT (região central)",
    telefone: "(66) 3401-9163",
    horario: "24 horas — 7 dias por semana",
    servicos: ["Urgência/Emergência","Raio-X","Laboratório","Observação","Medicação","Suturas"],
    lat: -15.8761533, lng: -52.2988380,
    obs: "Endereço e telefone via Google Places — a confirmar oficialmente. Atendimento contínuo, levar documento e cartão SUS.",
    aviso: true
  },
  {
    id: 4, nome: "UBS São Benedito", status: "aberto",
    endereco: "R. Moreira Cabral, 59 — São Sebastião, Barra do Garças/MT",
    telefone: "(66) 99269-6006", // WhatsApp oficial da unidade
    horario: "Seg–Sex: 7h–11h e 13h–17h",
    servicos: ["Clínico Geral","Enfermagem","Curativos","Tele Enfermeiro"],
    lat: -15.8999351, lng: -52.2630006,
    obs: "Telefone confirmado oficialmente. Nome da médica responsável a confirmar com a Secretaria.",
    aviso: false
  },
  {
    id: 5, nome: "Hospital Municipal Milton Pessoa Morbeck", status: "urgencia",
    endereco: "Tv. Mal. Rondon, 2897 — Jardim Mariano, Barra do Garças/MT",
    telefone: "(66) 3401-2363",
    horario: "24 horas — 7 dias por semana",
    servicos: ["Urgência/Emergência","Maternidade","Internação","Cirurgia"],
    lat: -15.8837480, lng: -52.2470280,
    obs: "Endereço e telefone via Google Places — a confirmar oficialmente. Referência para partos e internações da região.",
    aviso: true
  },
  {
    id: 6, nome: "UBS Jardim Araguaia", status: "aberto",
    endereco: "Jardim Araguaia (COAHB), Barra do Garças/MT",
    telefone: "(66) 99263-7286", // WhatsApp oficial da unidade
    horario: "Seg–Sex: 7h–11h e 13h–17h",
    servicos: ["Clínico Geral","Vacinação","Enfermagem"],
    lat: -15.8690522, lng: -52.2756467,
    obs: "Telefone confirmado oficialmente. Nome do(a) médico(a) responsável a confirmar com a Secretaria.",
    aviso: false
  },
  {
    id: 7, nome: "UBS Jardim Nova Barra II", status: "aberto",
    endereco: "Rua Itapajós, Qd 517, lotes 20-23 — Nova Barra, Barra do Garças/MT",
    telefone: "(66) 99262-4719", // WhatsApp oficial da unidade
    horario: "Seg–Sex: 7h–11h e 13h–17h",
    servicos: ["Clínico Geral","Enfermagem","Pré-natal"],
    lat: -15.8918552, lng: -52.3087539,
    obs: "Dados oficiais (Prefeitura): coordenadora Enfª. Eduarda Carolina Mota Vasconcelos; médico Drº Arthur Rezende Silva.",
    aviso: false
  },
];

// Datas oficiais: Ministério da Saúde / SES-MT (fontes: gov.br/saude, SES-MT) — verificado ago/2026
const CAMPANHAS = [
  {
    id: 1, nome: "Vacinação contra Dengue (Qdenga)",
    icone: "🦟", cor: "#f39c12", corBg: "#fffbea",
    desc: "Vacina Qdenga para adolescentes de 10 a 14 anos, incorporada ao SUS em 2026. Expansão para 15–59 anos prevista para o 2º semestre, começando pelos profissionais de saúde.",
    status: "ativa", inicio: "Permanente", fim: "Permanente",
    postos: ["UBS Centro","UBS Anchieta","UBS Jardim Araguaia"]
  },
  {
    id: 2, nome: "Vacinação Contra Gripe 2026",
    icone: "🤧", cor: "#3b82f6", corBg: "#e8f4fd",
    desc: "Campanha nacional de vacinação contra influenza. Prioritários: idosos (60+), gestantes, crianças de 6 meses a 6 anos e trabalhadores da saúde.",
    status: "ativa", inicio: "28/03/2026", fim: "30/05/2026",
    postos: ["UBS Centro","UBS São Benedito","UBS Anchieta","UBS Jardim Nova Barra II"]
  },
  {
    id: 3, nome: "Multivacinação 2026",
    icone: "👶", cor: "#27ae60", corBg: "#eafaf1",
    desc: "Atualização da caderneta vacinal, incluindo a nova Pneumocócica 20-valente. Vacinação seletiva — leve a caderneta de vacinação.",
    status: "ativa", inicio: "03/08/2026", fim: "01/09/2026",
    postos: ["Todos os postos"]
  },
  {
    id: 4, nome: "Hepatite B — Adultos",
    icone: "💉", cor: "#8e44ad", corBg: "#f5eef8",
    desc: "Imunização contra hepatite B para adultos que ainda não completaram o esquema vacinal de 3 doses. Disponível durante todo o ano nos postos.",
    status: "ativa", inicio: "Permanente", fim: "Permanente",
    postos: ["UBS Centro","UBS São Benedito","UBS Jardim Nova Barra II"]
  },
  {
    id: 5, nome: "Vacina BCG Neonatal",
    icone: "🍼", cor: "#0dbdad", corBg: "#e0f7f5",
    desc: "Aplicação da BCG em recém-nascidos. Realizada na maternidade ou no posto nas primeiras 24h de vida. Obrigatória pelo calendário nacional de vacinação.",
    status: "ativa", inicio: "Permanente", fim: "Permanente",
    postos: ["UBS Centro","Hospital Municipal Milton Pessoa Morbeck","UBS Anchieta"]
  },
  {
    id: 6, nome: "HPV — Meninas e Meninos",
    icone: "🎀", cor: "#e74c3c", corBg: "#fdecea",
    desc: "Vacina HPV quadrivalente para meninas (9–14 anos) e meninos (11–14 anos). Duas doses com intervalo de 6 meses. Disponível durante o ano letivo nas UBS.",
    status: "ativa", inicio: "01/02/2026", fim: "31/10/2026",
    postos: ["UBS Centro","UBS Jardim Araguaia","UBS São Benedito"]
  },
];

const CALENDARIO_VACINAL = [
  { faixa: "Ao nascer",  vacina: "BCG + Hepatite B",                                           doses: "Dose única + 1ª dose",     obs: "Aplicar na maternidade" },
  { faixa: "2 meses",    vacina: "Pentavalente + VIP + Pneumocócica 10V + Rotavírus",           doses: "1ª dose",                   obs: "" },
  { faixa: "3 meses",    vacina: "Meningocócica C",                                             doses: "1ª dose",                   obs: "" },
  { faixa: "4 meses",    vacina: "Pentavalente + VIP + Pneumocócica 10V + Rotavírus",           doses: "2ª dose",                   obs: "" },
  { faixa: "5 meses",    vacina: "Meningocócica C",                                             doses: "2ª dose",                   obs: "" },
  { faixa: "6 meses",    vacina: "Pentavalente + VIP + Hepatite B + Influenza",                 doses: "3ª dose + 1ª dose anual",   obs: "Influenza: dose semestral para crianças até 6 anos" },
  { faixa: "9 meses",    vacina: "Febre Amarela",                                               doses: "Dose única",                obs: "Reforço aos 4 anos — Região endêmica MT" },
  { faixa: "12 meses",   vacina: "Tríplice viral (SCR) + Pneumocócica 10V + Meningocócica C",  doses: "1ª dose / Reforço",         obs: "" },
  { faixa: "15 meses",   vacina: "DTP + VOP + Varicela + Hepatite A + SCR 2ª dose",            doses: "1º reforço / Doses",        obs: "" },
  { faixa: "4 anos",     vacina: "DTP + VOP + Febre Amarela",                                  doses: "2º reforço / Reforço",      obs: "" },
  { faixa: "9–14 anos",  vacina: "HPV Quadrivalente",                                          doses: "2 doses (intervalo 6 meses)", obs: "Meninas 9–14 / Meninos 11–14 anos" },
  { faixa: "Adultos",    vacina: "dT + Hepatite B + Febre Amarela",                            doses: "Conforme caderneta",        obs: "MT é área endêmica — verificar reforço Febre Amarela" },
  { faixa: "Gestantes",  vacina: "dTpa + Hepatite B + Influenza",                              doses: "Obrigatórias",              obs: "A partir do 5º mês — disponível nas UBS e no Hospital Municipal" },
  { faixa: "Idosos 60+", vacina: "Influenza anual + Pneumocócica 23V + Herpes Zóster",        doses: "1× ao ano",                 obs: "Campanha gripe 2026: 28/03 a 30/05 — prioridade Barra do Garças" },
];

const HISTORICO = [
  { vacina: "BCG",            data: "15/03/2000", posto: "Maternidade Municipal Barra do Garças", dose: "Dose única" },
  { vacina: "Hepatite B",     data: "15/03/2000", posto: "UBS Centro",                            dose: "1ª dose" },
  { vacina: "Pentavalente",   data: "10/05/2000", posto: "UBS Centro",                            dose: "1ª dose" },
  { vacina: "Tríplice Viral", data: "20/03/2001", posto: "UBS Jardim Araguaia",                   dose: "1ª dose" },
  { vacina: "Febre Amarela",  data: "05/02/2020", posto: "UBS Centro",                            dose: "Dose única" },
  { vacina: "dT",             data: "12/08/2022", posto: "UBS São Benedito",                      dose: "Reforço" },
  { vacina: "Covid-19",       data: "14/04/2021", posto: "Drive-thru Ginásio Municipal BG",       dose: "1ª dose" },
  { vacina: "Covid-19",       data: "09/06/2021", posto: "Drive-thru Ginásio Municipal BG",       dose: "2ª dose" },
  { vacina: "Covid-19 Bivalente", data: "10/01/2023", posto: "UBS Centro",                        dose: "Dose de reforço" },
  { vacina: "Influenza 2025", data: "22/04/2025", posto: "UBS São Benedito",                      dose: "1× ao ano" },
  { vacina: "Influenza 2026", data: "16/04/2026", posto: "UBS Centro",                            dose: "1× ao ano" },
];

// Nomes de profissionais e horários ainda são ILUSTRATIVOS — pendente de lista oficial da
// Secretaria de Saúde. Os postos referenciados abaixo já são os reais e verificados.
// As 3 primeiras entradas são OFICIAIS (Prefeitura de Barra do Garças, abr/2026).
// As demais são ILUSTRATIVAS — nomes/horários de especialistas ainda pendentes de
// confirmação com a Secretaria de Saúde (a rede de UBS's tem contrato só para Clínico Geral).
const PROFISSIONAIS = [
  { nome: "Drª Claúdia Fernanda Bueno da Silva", esp: "Clínico Geral", categoria: "clinico",  horario: "Seg–Sex: 7h–11h / 13h–17h", posto: "UBS Centro",             disponivel: true, init: "CB", oficial: true },
  { nome: "Drª Elis Daiana Ferreira Soares",     esp: "Clínico Geral", categoria: "clinico",  horario: "Seg–Sex: 7h–11h / 13h–17h", posto: "UBS Anchieta",           disponivel: true, init: "EF", oficial: true },
  { nome: "Drº Arthur Rezende Silva",            esp: "Clínico Geral", categoria: "clinico",  horario: "Seg–Sex: 7h–11h / 13h–17h", posto: "UBS Jardim Nova Barra II", disponivel: true, init: "AR", oficial: true },

  { nome: "Dra. Ana Lima",        esp: "Pediatra",       categoria: "pediatra", horario: "Seg/Qua/Sex: 14h–18h (a confirmar)",  posto: "UBS Jardim Araguaia",  disponivel: true,  init: "AL" },
  { nome: "Dr. Carlos Souza",     esp: "Dentista",       categoria: "dentista", horario: "Seg–Sex: 8h–12h (a confirmar)",       posto: "UBS Centro",           disponivel: true,  init: "CS" },
  { nome: "Dra. Fernanda Costa",  esp: "Cardiologista",  categoria: "cardio",   horario: "Ter/Qui: 9h–12h (a confirmar)",       posto: "Hospital Municipal (a confirmar)", disponivel: true,  init: "FC" },
  { nome: "Dra. Patrícia Rocha",  esp: "Ginecologista",  categoria: "gineco",   horario: "Ter/Qui: 7h–12h (a confirmar)",       posto: "Hospital Municipal (a confirmar)", disponivel: true,  init: "PR" },
  { nome: "Dra. Juliana Torres",  esp: "Pediatra",       categoria: "pediatra", horario: "Seg/Qua/Sex: 8h–12h (a confirmar)",   posto: "UBS Centro",           disponivel: true,  init: "JT" },
  { nome: "Dr. Marcos Vieira",    esp: "Dentista",       categoria: "dentista", horario: "Ter/Qui/Sex: 8h–12h (a confirmar)",   posto: "UBS Jardim Araguaia",  disponivel: false, init: "MV" },
  { nome: "Dr. Thiago Batista",   esp: "Cardiologista",  categoria: "cardio",   horario: "Seg/Qua: 9h–13h (a confirmar)",       posto: "Hospital Municipal (a confirmar)", disponivel: true,  init: "TB" },
  { nome: "Dra. Camila Nunes",    esp: "Ginecologista",  categoria: "gineco",   horario: "Seg/Qua/Sex: 13h–17h (a confirmar)",  posto: "UBS Jardim Araguaia",  disponivel: true,  init: "CN" },
  { nome: "Dr. Eduardo Pires",    esp: "Dentista",       categoria: "dentista", horario: "Seg–Sex: 13h–17h (a confirmar)",      posto: "UBS São Benedito",     disponivel: true,  init: "EP" },
];

// Avisos fixos, sem data de expiração — sempre aparecem na home
const AVISOS_GERAIS = [
  { tipo: 'info', icone: 'fa-info-circle', texto: 'Atendimento no CEM é exclusivo por encaminhamento das UBS de Barra do Garças.' }
];

// Eventos reais de saúde pública 2026
const EVENTOS_CALENDARIO = [
  // Maio 2026
  { data: "2026-05-12", titulo: "Dia Internacional da Enfermagem",        tipo: "evento",   desc: "Comemoração do Dia Internacional da Enfermagem em todos os postos de Barra do Garças." },
  { data: "2026-05-14", titulo: "Campanha Gripe em andamento",            tipo: "campanha", desc: "Vacinação contra influenza 2026 em andamento. Prioritários: idosos 60+, gestantes e crianças até 6 anos." },
  { data: "2026-05-20", titulo: "Dia Mundial da Hipertensão",             tipo: "evento",   desc: "Medição gratuita de pressão arterial em todas as UBS de Barra do Garças. Sem agendamento." },
  { data: "2026-05-21", titulo: "Dia Nacional da Hipertensão",            tipo: "evento",   desc: "Ações de conscientização sobre hipertensão arterial. Palestras na UBS Centro e UBS Novo Horizonte." },
  { data: "2026-05-25", titulo: "Dia do Orgulho Autista — MT",            tipo: "evento",   desc: "Evento de conscientização sobre autismo. Informações sobre serviços especializados no CEM." },
  { data: "2026-05-30", titulo: "Dia Nacional da Esclerose Múltipla",     tipo: "evento",   desc: "Conscientização sobre EM. Fale com seu médico no CEM sobre sintomas e diagnóstico precoce." },
  { data: "2026-05-31", titulo: "Dia Mundial Sem Tabaco",                 tipo: "evento",   desc: "OMS — Ações de conscientização em todos os postos. Apoio para cessação do tabagismo disponível no CEM." },
  { data: "2026-05-30", titulo: "Encerramento Campanha Gripe 2026",       tipo: "campanha", desc: "Último dia da campanha de vacinação contra influenza 2026." },

  // Junho 2026
  { data: "2026-06-04", titulo: "Feriado — Corpus Christi",               tipo: "feriado",  desc: "Postos de saúde fechados. UPA 24h funciona normalmente." },
  { data: "2026-06-05", titulo: "Dia Mundial do Meio Ambiente",           tipo: "evento",   desc: "Ações sobre saúde ambiental e prevenção de doenças transmitidas por vetores em Barra do Garças." },
  { data: "2026-06-08", titulo: "Início Multivacinação Infantil 2026",    tipo: "campanha", desc: "Atualização do cartão vacinal para crianças de 0 a 5 anos. Todos os postos de Barra do Garças. Sem agendamento." },
  { data: "2026-06-12", titulo: "Dia dos Namorados — Ação de Saúde",     tipo: "evento",   desc: "Distribuição de preservativos e material informativo sobre ISTs nas UBS. Testagem rápida disponível." },
  { data: "2026-06-21", titulo: "Dia Nacional da Saúde Pública",         tipo: "evento",   desc: "Comemorações e atividades educativas nas unidades de saúde de Barra do Garças." },
  { data: "2026-06-26", titulo: "Encerramento Multivacinação Infantil",  tipo: "campanha", desc: "Último dia para atualização do cartão vacinal infantil 2026." },
  { data: "2026-06-27", titulo: "Dia Nacional de Prevenção às DSTs",     tipo: "evento",   desc: "Testagem rápida para HIV, sífilis e hepatites disponível gratuitamente nas UBS." },

  // Julho 2026
  { data: "2026-07-04", titulo: "Independência do Mato Grosso",          tipo: "feriado",  desc: "Postos de saúde fechados. UPA 24h funciona normalmente." },
  { data: "2026-07-28", titulo: "Dia Mundial da Hepatite",               tipo: "evento",   desc: "Testagem gratuita para hepatites B e C. Vacinação disponível nas UBS de Barra do Garças." },

  // Agosto 2026
  { data: "2026-08-01", titulo: "Início Agosto Dourado",                 tipo: "campanha", desc: "Campanha de incentivo ao aleitamento materno. Ações nas UBS e no CEM durante todo o mês." },
  { data: "2026-08-09", titulo: "Dia Nacional da Saúde",                 tipo: "evento",   desc: "Ações de saúde preventiva em todas as UBS. Aferição de PA, glicemia e IMC gratuitos." },
  { data: "2026-08-31", titulo: "Encerramento Agosto Dourado",           tipo: "campanha", desc: "Último dia da campanha de aleitamento materno 2026." },

  // Setembro 2026
  { data: "2026-09-07", titulo: "Feriado — Independência do Brasil",     tipo: "feriado",  desc: "Postos de saúde fechados. UPA 24h funciona normalmente." },
  { data: "2026-09-21", titulo: "Dia Mundial da Doença de Alzheimer",    tipo: "evento",   desc: "Conscientização e informações sobre diagnóstico precoce. Atendimento neurológico via encaminhamento no CEM." },
  { data: "2026-09-28", titulo: "Dia Mundial do Coração",                tipo: "evento",   desc: "Medição gratuita de pressão arterial e glicemia. Palestras sobre saúde cardiovascular na UBS Centro." },

  // Outubro 2026
  { data: "2026-10-01", titulo: "Dia Internacional do Idoso",            tipo: "evento",   desc: "Ações especiais para a terceira idade. Vacinação e aferição de PA gratuitas em todos os postos." },
  { data: "2026-10-02", titulo: "Feriado — Eleições Municipais 2026",    tipo: "feriado",  desc: "Postos de saúde fechados. UPA 24h funciona normalmente." },
  { data: "2026-10-12", titulo: "Feriado — N. Sra. Aparecida",          tipo: "feriado",  desc: "Postos de saúde fechados. UPA 24h funciona normalmente." },
  { data: "2026-10-01", titulo: "Início Outubro Rosa",                   tipo: "campanha", desc: "Campanha de prevenção ao câncer de mama. Mamografias e exames preventivos no CEM — agendar via UBS." },
  { data: "2026-10-31", titulo: "Encerramento Outubro Rosa",             tipo: "campanha", desc: "Último dia do Outubro Rosa 2026." },

  // Novembro 2026
  { data: "2026-11-02", titulo: "Feriado — Finados",                     tipo: "feriado",  desc: "Postos de saúde fechados. UPA 24h funciona normalmente." },
  { data: "2026-11-15", titulo: "Feriado — Proclamação da República",   tipo: "feriado",  desc: "Postos de saúde fechados. UPA 24h funciona normalmente." },
  { data: "2026-11-01", titulo: "Início Novembro Azul",                  tipo: "campanha", desc: "Campanha de prevenção ao câncer de próstata. Exames e informações disponíveis no CEM via encaminhamento." },
  { data: "2026-11-14", titulo: "Dia Mundial do Diabetes",               tipo: "evento",   desc: "Testagem gratuita de glicemia em todas as UBS de Barra do Garças. Sem agendamento." },
  { data: "2026-11-20", titulo: "Dia da Consciência Negra",             tipo: "evento",   desc: "Ações de saúde da população negra. Informações sobre doenças com maior prevalência na comunidade." },

  // Dezembro 2026
  { data: "2026-12-01", titulo: "Dia Mundial da AIDS",                   tipo: "evento",   desc: "Testagem rápida para HIV e sífilis gratuita nas UBS. Distribuição de preservativos e material informativo." },
  { data: "2026-12-08", titulo: "Feriado — N. Sra. da Conceição",      tipo: "feriado",  desc: "Postos de saúde fechados. UPA 24h funciona normalmente." },
  { data: "2026-12-25", titulo: "Feriado — Natal",                       tipo: "feriado",  desc: "Postos de saúde fechados. UPA 24h funciona normalmente." },
];

const SEARCH_INDEX = [
  { label: "Postos Próximos",              page: "postos",        icon: "fas fa-map-marked-alt" },
  { label: "Vacinação — Campanhas",        page: "vacinacao",     icon: "fas fa-syringe" },
  { label: "Calendário Vacinal",           page: "vacinacao",     icon: "fas fa-calendar-check" },
  { label: "Meu Histórico Vacinal",        page: "vacinacao",     icon: "fas fa-history" },
  { label: "Profissionais Hoje",           page: "profissionais", icon: "fas fa-user-md" },
  { label: "Calendário da Saúde",          page: "calendario",    icon: "fas fa-calendar-alt" },
  { label: "Dentista",                     page: "profissionais", icon: "fas fa-tooth" },
  { label: "Pediatra",                     page: "profissionais", icon: "fas fa-baby" },
  { label: "Cardiologista",               page: "profissionais", icon: "fas fa-heartbeat" },
  { label: "Ginecologista",               page: "profissionais", icon: "fas fa-venus" },
  { label: "UPA 24 Horas",                page: "postos",        icon: "fas fa-ambulance" },
  { label: "Vacina Dengue 2026",          page: "vacinacao",     icon: "fas fa-syringe" },
  { label: "Vacina Gripe 2026",           page: "vacinacao",     icon: "fas fa-syringe" },
  { label: "Avisos",                      page: "home",          icon: "fas fa-bullhorn" },
  { label: "Horários de Hoje",            page: "home",          icon: "fas fa-clock" },
  { label: "UBS Centro Barra do Garças",  page: "postos",        icon: "fas fa-hospital" },
  { label: "CEM — Centro Especialidades", page: "postos",        icon: "fas fa-hospital" },
  { label: "Outubro Rosa",               page: "vacinacao",     icon: "fas fa-ribbon" },
  { label: "Novembro Azul",              page: "vacinacao",     icon: "fas fa-ribbon" },
  { label: "Multivacinação Infantil",    page: "vacinacao",     icon: "fas fa-baby" },
  { label: "HPV",                        page: "vacinacao",     icon: "fas fa-syringe" },
];