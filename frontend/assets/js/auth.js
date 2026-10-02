/* =============================================================
   auth.js — Identifica o usuário logado no portal
   A proteção de verdade é feita no SERVIDOR (a página nem é
   entregue sem sessão). Aqui só preenchemos nome, mostramos o
   link do painel para administradores e tratamos o "Sair".
   ============================================================= */
(async function identificarUsuario() {
  try {
    const resp = await fetch('/api/me');
    if (!resp.ok) { window.location.href = '/login'; return; }
    const { usuario } = await resp.json();
    const primeiroNome = usuario.nome.split(' ')[0];
    const inicial = usuario.nome.charAt(0).toUpperCase();

    for (const id of ['userNome', 'userNomeMobile']) {
      const el = document.getElementById(id);
      if (el) el.textContent = 'Bem-vindo, ' + primeiroNome;
    }
    for (const id of ['userAvatar', 'userAvatarMobile']) {
      const el = document.getElementById(id);
      if (el) el.textContent = inicial;
    }
    if (usuario.perfil === 'ADMIN') {
      document.querySelectorAll('.link-admin').forEach((el) => { el.hidden = false; });
    }
  } catch {
    window.location.href = '/login';
  }
})();

document.addEventListener('DOMContentLoaded', () => {
  async function sair(e) {
    e.preventDefault();
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login';
  }
  for (const id of ['btnSair', 'btnSairMobile']) {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', sair);
  }
});
