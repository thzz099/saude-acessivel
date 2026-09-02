/* =============================================
   auth.js
   Roda em toda página "protegida" (index.html).
   1) Pergunta ao servidor "quem está logado?" (via cookie)
   2) Se ninguém está logado -> manda para login.html
   3) Se está logado -> preenche nome/avatar no header
   ============================================= */

(async function checarAutenticacao() {
  try {
    const resp = await fetch('/api/me');

    if (!resp.ok) {
      window.location.href = 'login.html';
      return;
    }

    const { usuario } = await resp.json();

    const nomeEl = document.getElementById('userNome');
    const avatarEl = document.getElementById('userAvatar');
    if (nomeEl) nomeEl.textContent = 'Bem-vindo, ' + usuario.nome.split(' ')[0];
    if (avatarEl) avatarEl.textContent = usuario.nome.charAt(0).toUpperCase();

    // mesmas informações, versão mobile
    const nomeMobileEl = document.getElementById('userNomeMobile');
    const avatarMobileEl = document.getElementById('userAvatarMobile');
    if (nomeMobileEl) nomeMobileEl.textContent = 'Bem-vindo, ' + usuario.nome.split(' ')[0];
    if (avatarMobileEl) avatarMobileEl.textContent = usuario.nome.charAt(0).toUpperCase();

  } catch (err) {
    // servidor fora do ar, sem internet, etc.
    window.location.href = 'login.html';
  }
})();

// botão "Sair" (versão desktop e versão mobile)
document.addEventListener('DOMContentLoaded', () => {
  async function sair(e) {
    e.preventDefault();
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = 'login.html';
  }
  const btnSair = document.getElementById('btnSair');
  if (btnSair) btnSair.addEventListener('click', sair);

  const btnSairMobile = document.getElementById('btnSairMobile');
  if (btnSairMobile) btnSairMobile.addEventListener('click', sair);
});
