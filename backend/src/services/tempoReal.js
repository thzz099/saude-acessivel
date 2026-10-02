/* =============================================================
   services/tempoReal.js — Atualização em tempo real (Server-Sent Events)

   Cada página aberta mantém uma conexão leve com o servidor
   (EventSource, nativo do navegador). Quando o admin salva algo,
   o servidor avisa todas as páginas, que buscam os dados novos.
   Sem biblioteca extra e sem recarregar a página.
   ============================================================= */
const MAX_CONEXOES = 500;          // proteção contra esgotar o servidor
const INTERVALO_PING_MS = 25000;   // mantém a conexão viva atrás de proxies

const clientes = new Set();
let versao = Date.now();

function versaoAtual() {
  return versao;
}

function conectar(req, res) {
  if (clientes.size >= MAX_CONEXOES) {
    return res.status(503).json({ erro: 'Servidor ocupado. Tente novamente em instantes.' });
  }
  res.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write('retry: 5000\n');                         // reconecta em 5 s se cair
  res.write(`event: versao\ndata: ${versao}\n\n`);

  clientes.add(res);
  const ping = setInterval(() => res.write(': ping\n\n'), INTERVALO_PING_MS);
  req.on('close', () => {
    clearInterval(ping);
    clientes.delete(res);
  });
}

/** Chamado depois de qualquer alteração no painel. */
function notificarMudanca(entidade) {
  versao = Math.max(Date.now(), versao + 1); // sempre cresce, mesmo com 2 mudanças no mesmo ms
  const msg = `event: atualizado\ndata: ${JSON.stringify({ versao, entidade })}\n\n`;
  for (const c of clientes) {
    try { c.write(msg); } catch { clientes.delete(c); }
  }
}

const totalConectados = () => clientes.size;

module.exports = { conectar, notificarMudanca, versaoAtual, totalConectados };
