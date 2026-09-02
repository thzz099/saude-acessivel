# Guia: Login com banco de dados + IA no Saúde Acessível

## 1. Por que seu site atual não pode ter login "sozinho"

Hoje seu projeto é só **HTML + CSS + JS que roda no navegador**. Isso é ótimo para
mostrar conteúdo, mas tem um problema: **tudo que roda no navegador pode ser visto
e alterado pelo usuário**. Se você guardasse senhas ali, qualquer pessoa com o
DevTools aberto conseguiria ver ou burlar o login.

Por isso login de verdade sempre tem duas partes novas:

- **Backend** (servidor): um programa que roda em outra máquina, recebe email/senha,
  confere se está certo e decide se libera o acesso. O usuário nunca vê o código dele.
- **Banco de dados**: onde ficam guardados os usuários cadastrados (nome, email,
  senha "embaralhada").

Eu montei isso com **Node.js + Express** (servidor) e **SQLite** (banco de dados —
um banco que vive dentro de um único arquivo, sem precisar instalar nada separado).

## 2. Estrutura de pastas criada

```
saude-acessivel/
├── server.js          ← o servidor (rotas de login/cadastro)
├── database.js         ← cria o banco SQLite e a tabela de usuários
├── package.json        ← lista de dependências
├── db/
│   └── saude.db         ← o banco de dados (criado automaticamente)
└── public/              ← tudo que o navegador enxerga
    ├── index.html        ← seu site (agora protegido por login)
    ├── login.html         ← tela de login/cadastro
    ├── login.css
    ├── login.js
    ├── auth.js            ← verifica se o usuário está logado
    ├── app.js             ← seu app.js original + integração da IA
    ├── data.js            ← seus dados originais (sem alteração)
    ├── style.css
    └── ml/
        └── sintomas-ia.js  ← o classificador de IA
```

## 3. Como rodar na sua máquina

Você precisa ter o [Node.js](https://nodejs.org) instalado (versão 18+).

```bash
cd saude-acessivel
npm install        # baixa express, sqlite, bcrypt, jwt...
node server.js
```

Depois acesse `http://localhost:3000/login.html` no navegador. Crie uma conta,
faça login, e você será redirecionado para `index.html` — se tentar abrir
`index.html` sem estar logado, ele te manda de volta para o login.

## 4. Como o login funciona, passo a passo

### Cadastro (`POST /api/registro`)
1. O navegador manda `{ nome, email, senha }` para o servidor.
2. O servidor confere se o email já existe.
3. A senha **nunca** é salva como texto puro. Ela passa pelo `bcrypt`, que gera um
   "hash" — uma sequência embaralhada e **impossível de reverter**. Mesmo se alguém
   roubar o banco de dados, não consegue descobrir a senha original.
4. O usuário é salvo no SQLite.
5. O servidor gera um **token JWT** (um "crachá" digital assinado) e manda de volta
   dentro de um cookie `httpOnly` — isso significa que nem o JavaScript do seu
   próprio site consegue ler esse cookie, só o navegador o envia automaticamente
   em cada requisição. Isso dificulta roubo de sessão.

### Login (`POST /api/login`)
Mesma ideia: busca o usuário pelo email, usa `bcrypt.compare()` para conferir a
senha contra o hash salvo, e devolve o mesmo tipo de cookie.

### Verificação (`GET /api/me`)
Toda vez que `index.html` carrega, o `auth.js` pergunta ao servidor "quem está
logado?". O servidor lê o cookie, confere a assinatura do JWT e responde com os
dados do usuário — ou `401` se não houver sessão válida, e aí o `auth.js` redireciona
para `login.html`.

### Logout (`POST /api/logout`)
Simplesmente apaga o cookie.

## 5. Limitações que você deve saber (para evoluir depois)

- **Isso é proteção no front-end.** Um usuário técnico ainda consegue ver o HTML de
  `index.html` sem estar logado (o navegador baixa o arquivo antes do JS rodar).
  Para proteção "de verdade" em nível de página, o próximo passo seria servir
  `index.html` dinamicamente pelo próprio servidor e só entregá-lo se o cookie for
  válido.
- Troque o `JWT_SECRET` em `server.js` por uma variável de ambiente antes de colocar
  em produção, e sirva o site com HTTPS (senão o cookie pode ser interceptado).
- Para produção real, SQLite é ok até um volume médio de usuários; se o site crescer
  muito, migre para PostgreSQL (a lógica do código muda pouco).

## 6. A parte de Machine Learning

Adicionei uma IA simples de **classificação de texto**: o usuário digita um sintoma
na busca (ex: "dor no peito") e, se não achar nada no índice normal, a IA sugere a
especialidade médica mais provável (ex: Cardiologia), com uma porcentagem de
confiança — clicando, ele já vai para a página de Profissionais filtrada.

### Como funciona (arquivo `public/ml/sintomas-ia.js`)

Usei duas técnicas clássicas de ML para texto, **implementadas do zero, sem
biblioteca nenhuma**, para você entender cada passo:

1. **TF-IDF (Term Frequency – Inverse Document Frequency)**: transforma cada frase
   em uma lista de números. Cada posição da lista representa uma palavra do
   vocabulário, e o valor mostra o quão "importante" aquela palavra é na frase —
   palavras raras e específicas (como "papanicolau") pesam mais que palavras comuns
   (como "dor", que aparece em quase tudo).
2. **Similaridade de cosseno**: mede o ângulo entre dois desses vetores de números.
   Quanto mais parecido o "padrão de palavras" de duas frases, mais próximo de 1.

O arquivo treina esses vetores com ~25 frases de exemplo (5 por especialidade:
Odontologia, Pediatria, Cardiologia, Ginecologia, Clínico Geral). Quando você digita
algo novo, ele compara com todas as frases de treino e retorna a especialidade mais
parecida.

### Por que essa abordagem (e não uma rede neural)?

Para um projeto desse tamanho, TF-IDF + cosseno já é **Machine Learning de verdade**
(é a base de motores de busca antigos e de muitos sistemas de recomendação), roda
instantaneamente no navegador, sem servidor de IA, sem custo, e sem depender de
internet. É also fácil de entender e expandir: basta adicionar mais frases em
`DADOS_TREINO`.

### Como melhorar isso no futuro

- **Mais dados de treino** = melhor precisão. Hoje são só 5 frases por categoria.
- **TensorFlow.js**: se quiser um modelo de rede neural de verdade rodando no
  navegador (ex: para reconhecer imagens de carteirinha de vacinação, prever
  horários de pico nos postos, etc.), a Anthropic/Google mantêm essa biblioteca
  pronta para uso em JS puro.
- **IA generativa via API**: para algo mais sofisticado (ex: um chat de triagem que
  conversa com o paciente), você chamaria a API da Anthropic a partir do seu
  `server.js` — nunca direto do navegador, para não expor sua chave de API.

## 7. Testando rapidamente

```bash
# criar um usuário de teste via terminal (opcional, o site já faz isso)
curl -X POST http://localhost:3000/api/registro \
  -H "Content-Type: application/json" \
  -d '{"nome":"Maria Teste","email":"maria@teste.com","senha":"123456"}'
```

Na busca do site, teste digitar frases como:
- "dor no peito e falta de ar" → deve sugerir Cardiologia
- "meu bebê está com febre" → deve sugerir Pediatria
- "atraso menstrual" → deve sugerir Ginecologia
- "dor no peito muito forte não consigo respirar" → deve mostrar o alerta de urgência

## 8. Deploy (Render) + banco de dados permanente (Turso)

Depois de testar localmente, o site foi colocado no ar no **Render** (hospedagem
gratuita do servidor). Só que o plano grátis do Render apaga o disco local toda
vez que o servidor "dorme" por inatividade — inviável pra um banco SQLite comum.

A solução: trocar o SQLite local pelo **Turso**, um banco compatível com SQLite
mas hospedado na nuvem, com plano gratuito permanente (sem prazo de expiração).

### Passo a passo

1. Crie conta em **https://turso.tech** (dá pra entrar com GitHub)
2. No painel (app.turso.tech), clique em **"Create Database"**, dê um nome
   (ex: `saude-acessivel`) e escolha a região mais próxima
3. Depois de criado, clique no banco → aba **"Connect"** — você vai ver:
   - Uma **URL** parecida com `libsql://saude-acessivel-seuusuario.turso.io`
   - Um botão pra gerar um **Auth Token** (token de acesso)
4. Crie um arquivo `.env` na raiz do projeto (copie o `.env.example` e preencha):

```
TURSO_DATABASE_URL=libsql://saude-acessivel-seuusuario.turso.io
TURSO_AUTH_TOKEN=seu-token-aqui
JWT_SECRET=uma-string-aleatoria-grande
```

5. Rode `npm install` de novo (agora instala `@libsql/client` e `dotenv` no
   lugar do `better-sqlite3`) e teste local com `node server.js`
6. No painel do **Render**, vá em Environment e adicione as mesmas 3 variáveis
   (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `JWT_SECRET`)
7. Suba as mudanças pro GitHub (`git add .`, `git commit`, `git push`) — o
   Render faz o redeploy automaticamente

Depois disso, as contas de usuário passam a sobreviver a reinícios, deploys e
períodos de inatividade — porque não vivem mais dentro do servidor, vivem no
Turso.
