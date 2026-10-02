/* =============================================
   login.js
   ============================================= */

// alterna entre "Entrar" e "Criar conta"
document.querySelectorAll('.login-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.login-form').forEach(f => f.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('form' + capitalize(tab.dataset.form)).classList.add('active');
    setMsg('');
  });
});

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function setMsg(texto, tipo) {
  const el = document.getElementById('loginMsg');
  el.textContent = texto;
  el.className = 'login-msg' + (tipo ? ' ' + tipo : '');
}

// ── LOGIN ────────────────────────────────────────
document.getElementById('formEntrar').addEventListener('submit', async (e) => {
  e.preventDefault();
  setMsg('Entrando...');

  const email = document.getElementById('loginEmail').value.trim();
  const senha = document.getElementById('loginSenha').value;

  try {
    const resp = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha, website: document.getElementById('hpLogin').value })
    });
    const data = await resp.json();

    if (!resp.ok) {
      setMsg(data.erro || 'Não foi possível entrar.', 'erro');
      return;
    }

    setMsg('Login realizado! Redirecionando...', 'sucesso');
    window.location.href = '/';
  } catch (err) {
    setMsg('Erro de conexão com o servidor.', 'erro');
  }
});

// ── CADASTRO ─────────────────────────────────────
document.getElementById('formCadastrar').addEventListener('submit', async (e) => {
  e.preventDefault();
  setMsg('Criando conta...');

  const nome = document.getElementById('regNome').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const senha = document.getElementById('regSenha').value;

  try {
    const resp = await fetch('/api/registro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, email, senha, website: document.getElementById('hpRegistro').value })
    });
    const data = await resp.json();

    if (!resp.ok) {
      setMsg(data.erro || 'Não foi possível criar a conta.', 'erro');
      return;
    }

    setMsg('Conta criada! Redirecionando...', 'sucesso');
    window.location.href = '/';
  } catch (err) {
    setMsg('Erro de conexão com o servidor.', 'erro');
  }
});
