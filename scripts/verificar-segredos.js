/* =============================================================
   scripts/verificar-segredos.js   →   npm run check:secrets
   [2][3][15] Varre o projeto procurando segredos que não deveriam
   estar no código (tokens, URLs de banco, chaves). Rode ANTES de
   todo git push. Sai com código 1 se encontrar algo.
   ============================================================= */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const IGNORAR = new Set(['node_modules', '.git', '.env']);
const EXTENSOES = new Set(['.js', '.html', '.css', '.json', '.md', '.yml', '.txt', '.bat', '.example', '']);

const PADROES = [
  { nome: 'URL real de banco Turso',  re: /libsql:\/\/(?!seu-banco)[a-z0-9-]+\.turso\.io/i },
  { nome: 'Token JWT/Turso',          re: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/ },
  { nome: 'JWT_SECRET com valor',     re: /JWT_SECRET\s*=\s*['"]?[A-Za-z0-9]{16,}/ },
  { nome: 'AUTH_TOKEN com valor',     re: /AUTH_TOKEN\s*=\s*['"]?(?!cole_aqui)[A-Za-z0-9._-]{20,}/ },
  { nome: 'Chave privada',            re: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/ },
  { nome: 'Segredo padrão no código', re: /process\.env\.[A-Z_]+\s*\|\|\s*['"][^'"]{8,}['"]/ },
];

const achados = [];
function varrer(dir) {
  for (const nome of fs.readdirSync(dir)) {
    if (IGNORAR.has(nome)) continue;
    const full = path.join(dir, nome);
    const st = fs.statSync(full);
    if (st.isDirectory()) { varrer(full); continue; }
    if (!EXTENSOES.has(path.extname(nome)) || st.size > 2_000_000) continue;
    if (full === __filename) continue;
    const linhas = fs.readFileSync(full, 'utf8').split('\n');
    linhas.forEach((linha, i) => {
      for (const p of PADROES) {
        if (p.re.test(linha)) achados.push({ arq: path.relative(RAIZ, full), linha: i + 1, tipo: p.nome });
      }
    });
  }
}
varrer(RAIZ);

// [3] Separação de camadas: o frontend é enviado ao navegador, então NADA
// do servidor pode estar nele; e o backend não deve conter páginas/estilos.
function listar(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).flatMap((n) => {
    const f = path.join(dir, n);
    return fs.statSync(f).isDirectory() ? listar(f) : [f];
  });
}
for (const f of listar(path.join(RAIZ, 'frontend'))) {
  if (!/\.(js|html|css)$/.test(f)) continue;
  const txt = fs.readFileSync(f, 'utf8');
  if (/process\.env|TURSO_|JWT_SECRET|createClient\(|require\(['"]/.test(txt)) {
    achados.push({ arq: path.relative(RAIZ, f), linha: '-', tipo: 'Código de servidor/segredo dentro do FRONTEND' });
  }
}
for (const f of listar(path.join(RAIZ, 'backend'))) {
  if (/\.(html|css)$/.test(f)) {
    achados.push({ arq: path.relative(RAIZ, f), linha: '-', tipo: 'Página/estilo dentro do BACKEND (deveria estar no frontend)' });
  }
}

if (!fs.existsSync(path.join(RAIZ, '.gitignore')) ||
    !/^\.env$/m.test(fs.readFileSync(path.join(RAIZ, '.gitignore'), 'utf8'))) {
  achados.push({ arq: '.gitignore', linha: '-', tipo: '.env NÃO está no .gitignore' });
}

if (achados.length) {
  console.error('\n❌ Possíveis segredos encontrados:\n');
  achados.forEach((a) => console.error(`   ${a.arq}:${a.linha}  →  ${a.tipo}`));
  console.error('\n   Remova antes de fazer git push.\n');
  process.exit(1);
}
console.log('✅ Nenhum segredo no código e camadas separadas (backend ≠ frontend).');
