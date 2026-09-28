# Segurança — SaúdeMap IA

Checklist de 20 itens aplicado ao sistema. Os números `[n]` aparecem nos comentários do código (`server.js`, `database.js`) para rastrear onde cada controle está.

**Legenda:** ✅ implementado · ⚙️ implementado, exige ação sua · ➖ não se aplica (com equivalente)

---

## Resumo

| # | Item | Status | Onde |
|---|---|---|---|
| 1 | Esconder API keys | ✅ | `server.js`, `database.js` — segredos só via `.env` |
| 2 | Limpar secrets do git | ⚙️ | **Trocar as credenciais** (ver abaixo) + `npm run check:secrets` |
| 3 | Chave do banco fora do frontend | ✅ | Banco acessado só pelo servidor; scanner verifica `public/` |
| 4 | Ativar RLS | ➖ | Turso não tem RLS; equivalente na aplicação |
| 5 | Criptografia de dados | ✅ | TLS em trânsito, hash de senha, minimização de dados |
| 6 | Auth no servidor | ✅ | Portal em `private/`, só entregue com sessão válida |
| 7 | Restringir acessos | ✅ | Coluna `perfil` + middleware `exigirPerfil('ADMIN')` |
| 8 | Bloquear mass assignment | ✅ | Whitelist de campos; `perfil` definido pelo servidor |
| 9 | Proteger cookies | ✅ | `HttpOnly` + `Secure` + `SameSite=Lax` |
| 10 | Hash nas senhas | ✅ | bcrypt, custo 10, sal aleatório |
| 11 | Rate limit | ✅ | Geral, login e cadastro com limites separados |
| 12 | Bot protection | ✅ | Honeypot + rate limit |
| 13 | Queries parametrizadas | ✅ | Todas as consultas com `?` |
| 14 | Validação de inputs | ✅ | Tipo, formato, tamanho, Content-Type |
| 15 | Vazamento de conteúdo | ✅ | Erros genéricos, XSS corrigido, headers ocultos |
| 16 | Restringir uploads | ➖ | Não há upload; corpo limitado a 10 KB |
| 17 | Enxugar respostas da API | ✅ | Só `nome` e `perfil` saem; token sem email |
| 18 | Security headers | ✅ | Helmet + CSP sob medida + Permissions-Policy |
| 19 | Forçar HTTPS | ✅ | Redirecionamento 301 + HSTS em produção |
| 20 | Scan de dependências | ⚙️ | `npm audit` + Dependabot — **rodar após instalar** |

---

## ⚠️ AÇÕES OBRIGATÓRIAS ANTES DO PRÓXIMO DEPLOY

A ordem importa. Se fizer o `git push` antes do passo 2, o site **cai** no Render — o servidor agora se recusa a iniciar sem um `JWT_SECRET` forte (é proposital).

### Passo 1 — Gerar um JWT_SECRET novo
```
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```
Copie o resultado (96 caracteres).

### Passo 2 — Atualizar no Render ANTES do push
Painel do Render → seu serviço → **Environment** → edite `JWT_SECRET` → cole o valor novo → **Save**.

Aproveite e adicione `NODE_ENV` = `production`.

### Passo 3 — Trocar o token do Turso (item 2)
O histórico do projeto teve um commit chamado "Delete .env" — então pode ter existido um `.env` no GitHub em algum momento. **Apagar o arquivo não apaga o histórico**: quem tiver o link do commit antigo ainda consegue ver. A única correção real é **invalidar a credencial**:

1. `app.turso.tech` → seu banco → gere um **novo token**
2. Revogue/delete o token antigo no mesmo painel
3. Atualize `TURSO_AUTH_TOKEN` no Render **e** no seu `.env` local

> Isso também desloga todo mundo (o segredo mudou). É esperado.

### Passo 4 — Atualizar o `.env` local
Com o `JWT_SECRET` e o `TURSO_AUTH_TOKEN` novos.

### Passo 5 — Instalar e verificar
```
npm install
npm run verificar
```
O `verificar` roda o scanner de segredos, o teste da IA e o `npm audit`. **Me mande a saída do `npm audit`** — daqui eu não consigo rodar (sem acesso ao registro do npm).

### Passo 6 — Só então o push
```
git add .
git commit -m "Checklist de seguranca e IA de triagem v2"
git push
```

---

## Detalhamento por item

### 1 — Esconder API keys
- `JWT_SECRET`, `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` existem **só** em variável de ambiente.
- **Corrigido:** antes havia `process.env.JWT_SECRET || '...'`. Esse valor padrão estava no GitHub — qualquer pessoa podia forjar sessão de qualquer usuário se a variável faltasse. Agora o servidor **se recusa a iniciar** sem um segredo de pelo menos 32 caracteres.
- O banco também falha alto se faltar credencial, em vez de subir quebrado.

### 2 — Limpar secrets do git
- `.gitignore` bloqueia `.env` e `.env.*` (exceto `.env.example`).
- `npm run check:secrets` varre o projeto procurando URL real do Turso, tokens JWT, segredos com valor e o padrão `process.env.X || 'valor'`. Sai com erro se achar algo. **Rode antes de todo push.**
- Testado: detecta o `JWT_SECRET` padrão da versão antiga.
- Credenciais possivelmente expostas no passado: **trocar** (passos 1–3 acima).

### 3 — Chave do banco fora do frontend
- Só o `server.js`/`database.js` falam com o Turso. O navegador nunca vê URL nem token do banco.
- O scanner confirma que `public/` e `private/` não contêm `process.env`, `TURSO_`, `JWT_SECRET` nem `createClient`.

### 4 — RLS (Row Level Security)
- RLS é recurso do PostgreSQL/Supabase. **O Turso (libSQL/SQLite) não tem.**
- Equivalente aplicado na camada da aplicação: o banco só é acessado pelo servidor, e toda leitura de dado do usuário parte do `id` que está no token **assinado** — nunca de um id enviado pelo cliente. Hoje o único dado por usuário é a própria conta.
- Se um dia migrar para PostgreSQL, ativar RLS de verdade é o caminho.

### 5 — Criptografia de dados
- **Em trânsito:** HTTPS forçado (item 19) e conexão com o Turso via TLS.
- **Senhas:** hash bcrypt (item 10) — não é reversível.
- **Minimização:** o sistema **não armazena** dado sensível. O texto digitado na IA de triagem roda 100% no navegador e **nunca chega ao servidor**. A localização GPS também não sai do navegador.
- **Em repouso:** depende do provedor (Turso). Se no futuro guardar dado de saúde, cifrar o campo com AES-256-GCM e chave em variável de ambiente.

### 6 — Autenticação no servidor
- **Antes:** `index.html` ficava em `public/` e era entregue a qualquer um; só o JavaScript do navegador redirecionava pro login — dava pra ver a página com o JS desligado.
- **Agora:** o portal está em `private/index.html`. A rota `/` verifica o token **no servidor** e redireciona para `/login.html` se não houver sessão válida.
- `jwt.verify` fixa o algoritmo `HS256` (evita ataque de troca de algoritmo).

### 7 — Restringir acessos
- Coluna `perfil` (`CIDADAO` | `ADMIN`) com `CHECK` no banco. Migração automática: contas existentes viram `CIDADAO`.
- Middleware `exigirPerfil('ADMIN')`. Exemplo em uso: `GET /api/admin/resumo`.
- Para promover alguém a admin: só direto no banco (painel do Turso → SQL):
  `UPDATE usuarios SET perfil = 'ADMIN' WHERE email = 'seu@email.com';`
  Não existe rota pública que altere perfil — de propósito.

### 8 — Mass assignment
- O cadastro lê **somente** `nome`, `email` e `senha`. Um `"perfil": "ADMIN"` enviado no corpo é ignorado.
- O `perfil` é sempre definido pelo servidor como `CIDADAO`.
- Nenhuma rota faz `INSERT`/`UPDATE` espalhando `req.body` direto.

### 9 — Cookies
| Atributo | Valor | Protege contra |
|---|---|---|
| `HttpOnly` | sim | Roubo de sessão por XSS (JS não lê o cookie) |
| `Secure` | sim em produção | Envio por HTTP sem criptografia |
| `SameSite` | `Lax` | CSRF |
| `Max-Age` | 7 dias | Sessão eterna |

O logout limpa o cookie com os mesmos atributos (senão alguns navegadores não apagam).

### 10 — Hash de senha
- **Troca de biblioteca:** `bcrypt` (nativa) → `bcryptjs` (JavaScript puro). Motivo: a nativa precisava compilar C++ na instalação — foi a causa do erro de build no Render e dos avisos `node-pre-gyp`, `tar`, `npmlog` que apareciam no `npm install`. A `bcryptjs` tem **zero dependências** e é compatível com os hashes já salvos: ninguém precisa recadastrar.
- Senha mínima: 8 caracteres. Máxima: 72 bytes (o bcrypt ignora o que passa disso — melhor recusar do que truncar em silêncio).
- Login com email inexistente também roda uma comparação bcrypt (contra um hash falso): o tempo de resposta fica igual, então não dá pra descobrir emails cadastrados cronometrando.

### 11 — Rate limit
| Onde | Limite | Janela | Observação |
|---|---|---|---|
| Toda `/api` | 300 | 15 min | Proteção geral |
| Login | 20 | 15 min | **Só tentativas falhas contam** |
| Cadastro | 30 | 1 hora | |

Os limites são por IP. Foram dimensionados pensando numa **sala de aula inteira na mesma rede** testando junto — não vai bloquear a turma na apresentação.

### 12 — Bot protection
- **Honeypot:** campo invisível `website` nos formulários. Humano não vê, bot preenche → requisição recusada.
- Somado ao rate limit.
- Upgrade possível: Cloudflare Turnstile (captcha gratuito e sem quebra-cabeça) — exige criar chaves no painel da Cloudflare.

### 13 — Queries parametrizadas
Todas as consultas usam `?` com `args`. Nenhuma concatena texto do usuário:
```js
db.execute({ sql: 'SELECT ... WHERE lower(email) = ?', args: [email] })
```

### 14 — Validação de inputs
- **Tipo:** todo campo precisa ser `string` (bloqueia `{"email": {...}}`).
- **Nome:** 2–100 caracteres, só letras, espaço, apóstrofo, hífen.
- **Email:** formato válido, até 254 caracteres, normalizado para minúsculas.
- **Senha:** 8 a 72 bytes.
- **Content-Type:** rotas POST exigem `application/json` (bônus: formulários de outros sites não conseguem enviar JSON sem permissão → reforço contra CSRF).
- Índice único em `lower(email)`: `Maria@x.com` e `maria@x.com` não viram duas contas.
- No frontend: `maxlength` nos campos e na busca.

### 15 — Vazamento de conteúdo
- **XSS corrigido:** o texto digitado na busca ia direto pro `innerHTML`. Digitar `<img src=x onerror=alert(1)>` executaria script. Agora passa por `escapeHtml()`.
- **Erros genéricos:** o cliente recebe "Erro interno"; detalhes só no log do servidor. Nunca envia stack trace, nome de tabela ou versão de biblioteca. O log nunca registra corpo da requisição (senhas).
- `X-Powered-By` removido (não anuncia que é Express).
- Respostas da API com `Cache-Control: no-store`.
- `express.static` com `dotfiles: 'deny'` (não serve `.env` nem outros arquivos ocultos por acidente).

### 16 — Uploads
- O sistema **não tem upload**. Corpo JSON limitado a **10 KB** — requisição maior recebe 413.
- Se um dia tiver upload (ex.: foto da carteira de vacina): validar tipo pelo conteúdo real (não pela extensão), limitar tamanho, renomear o arquivo e nunca servir da mesma origem.

### 17 — Respostas enxutas
- `/api/me`, login e cadastro retornam só `{ nome, perfil }`.
- O token JWT não carrega mais o email (o conteúdo do JWT é legível por quem tem o token — é codificado, não cifrado).

### 18 — Security headers
Via Helmet, com CSP ajustada para o que o site realmente usa (Leaflet, Font Awesome, Google Fonts, OpenStreetMap, OSRM):

| Header | Efeito |
|---|---|
| `Content-Security-Policy` | Só executa script do próprio site e do cdnjs. Bloqueia `onclick="..."` inline |
| `frame-ancestors 'none'` | Ninguém coloca o site dentro de um iframe (clickjacking) |
| `Strict-Transport-Security` | Navegador passa a usar só HTTPS (produção) |
| `X-Content-Type-Options: nosniff` | Navegador não "adivinha" tipo de arquivo |
| `Referrer-Policy` | Não vaza URL completa para outros sites |
| `Permissions-Policy` | Geolocalização só no próprio site; câmera e microfone bloqueados |

Para a CSP funcionar, os 6 botões dos cards de posto (`onclick="..."`) foram reescritos com `data-action` e um único listener.

### 19 — HTTPS
Em produção, qualquer acesso via `http://` recebe redirecionamento 301 para `https://`, mais HSTS de 1 ano. `trust proxy` configurado porque o Render fica atrás de um proxy.

### 20 — Scan de dependências
- `npm run audit` — verifica vulnerabilidades conhecidas.
- `.github/dependabot.yml` — o GitHub checa toda semana e abre Pull Request automático quando alguma biblioteca tiver falha.
- Versões mínimas atualizadas: `express` 4.21.2 (corrige falhas de `path-to-regexp` e `res.redirect`), `cookie-parser` 1.4.7 (corrige falha na lib `cookie`).
- A troca `bcrypt` → `bcryptjs` elimina a árvore `node-pre-gyp`/`tar`/`glob` que gerava os avisos antigos.
- **Pendente:** eu não consigo rodar o `npm audit` daqui. As 2 vulnerabilidades (1 alta, 1 crítica) que apareceram na sua instalação de julho provavelmente vinham dessas dependências — mas só a saída do `npm audit` confirma.

---

## Limitações que continuam (honestidade)

| Limitação | Risco | Caminho |
|---|---|---|
| Token não pode ser revogado antes de expirar | Token roubado vale até 7 dias | Lista de revogação por `jti` |
| Rate limit em memória | Reinício do servidor zera contadores | Store em Redis (produção real) |
| Cadastro revela se email já existe (409) | Enumeração de contas, mitigada pelo rate limit | Fluxo de confirmação por email |
| `style-src 'unsafe-inline'` na CSP | Baixo (injeção de CSS) | Mover estilos inline para classes |
| Serviço de rotas (OSRM) sem SLA | Mapa cai para linha reta | Provedor pago em produção |
