/* =============================================
   SAÚDE ACESSÍVEL — app.js  (Barra do Garças/MT)
   ============================================= */

// ── DATAS: calcula status real das campanhas (não fica desatualizado) ──
function parseDataBR(str) {
  if (!str || str.toLowerCase() === 'permanente') return null;
  const [d, m, y] = str.split('/').map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d, 23, 59, 59); // fim do dia
}

function calcularStatusCampanha(c) {
  const hoje = new Date();
  const inicio = parseDataBR(c.inicio);
  const fim = parseDataBR(c.fim);
  if (fim && hoje > fim) return 'encerrada';
  if (inicio && hoje < inicio) return 'breve';
  return 'ativa';
}

// ── NAVIGATION ──────────────────────────────────
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

  const target = document.getElementById('page-' + pageId);
  if (target) target.classList.add('active');

  document.querySelectorAll('[data-page="' + pageId + '"]').forEach(l => l.classList.add('active'));

  // close mobile nav
  document.getElementById('mobileNav').classList.remove('open');
}

// nav links (header + mobile)
document.querySelectorAll('.nav-link[data-page]').forEach(link => {
  link.addEventListener('click', function(e) {
    e.preventDefault();
    showPage(this.dataset.page);
  });
});

// quick cards on home
document.querySelectorAll('.qcard[data-target]').forEach(card => {
  card.addEventListener('click', function() {
    showPage(this.dataset.target);
  });
});

// hamburger
document.getElementById('hamburger').addEventListener('click', function() {
  document.getElementById('mobileNav').classList.toggle('open');
});

// ── TOAST ───────────────────────────────────────
function showToast(msg, duration = 2800) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

// ── GEOLOCALIZAÇÃO REAL ──────────────────────────
// Estado global: null enquanto não pedimos, ou {lat, lng} depois que o usuário autoriza
let userCoords = null;

// Fórmula de Haversine: distância (em km) entre dois pontos na superfície da Terra
function distanciaKm(lat1, lng1, lat2, lng2) {
  const R = 6371; // raio médio da Terra em km
  const toRad = deg => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatarDistancia(km) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

function pedirGeolocalizacao() {
  const statusEl = document.getElementById('geoStatus');
  if (!navigator.geolocation) {
    statusEl.textContent = 'Seu navegador não suporta geolocalização.';
    return;
  }
  statusEl.textContent = 'Buscando sua localização...';
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      statusEl.innerHTML = '<i class="fas fa-check-circle" style="color:#27ae60"></i> Localização ativada — postos ordenados por distância real';
      renderPostos(document.querySelector('.filter-btn.active')?.dataset.filter || 'all');
      // já mostra o trajeto até o posto mais próximo automaticamente
      const maisProximo = getPostoMaisProximo();
      if (maisProximo) mostrarRotaMapa(maisProximo.id);
    },
    (err) => {
      const msgs = {
        1: 'Permissão negada. Ative a localização nas configurações do navegador para ver distâncias reais.',
        2: 'Não foi possível obter sua localização agora.',
        3: 'A busca por localização demorou demais. Tente de novo.'
      };
      statusEl.textContent = msgs[err.code] || 'Não foi possível obter sua localização.';
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

document.getElementById('btnGeoloc')?.addEventListener('click', pedirGeolocalizacao);

function getPostoMaisProximo() {
  if (!userCoords || !POSTOS.length) return null;
  return [...POSTOS].sort((a, b) =>
    distanciaKm(userCoords.lat, userCoords.lng, a.lat, a.lng) -
    distanciaKm(userCoords.lat, userCoords.lng, b.lat, b.lng)
  )[0];
}

// ── MINI MAPA COM TRAJETO (Leaflet + OSRM) ──────
let rotaMap = null;
let rotaLayerGroup = null;

function inicializarMiniMapaSeNecessario() {
  if (rotaMap) return;
  rotaMap = L.map('miniMapa', { zoomControl: true, attributionControl: true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(rotaMap);
  rotaLayerGroup = L.layerGroup().addTo(rotaMap);
}

async function mostrarRotaMapa(postoId) {
  if (!userCoords) {
    showToast('Ative sua localização primeiro para ver o trajeto.');
    pedirGeolocalizacao();
    return;
  }
  const p = POSTOS.find(x => x.id === postoId);
  if (!p) return;

  document.getElementById('miniMapaPlaceholder').style.display = 'none';
  const wrap = document.getElementById('miniMapaWrap');
  wrap.style.display = 'block';
  document.getElementById('miniMapaDestino').textContent = p.nome;
  document.getElementById('miniMapaDist').textContent =
    formatarDistancia(distanciaKm(userCoords.lat, userCoords.lng, p.lat, p.lng)) + ' em linha reta';

  inicializarMiniMapaSeNecessario();
  setTimeout(() => rotaMap.invalidateSize(), 50); // garante render correto se estava escondido

  rotaLayerGroup.clearLayers();

  const origem = [userCoords.lat, userCoords.lng];
  const destino = [p.lat, p.lng];

  const iconUsuario = L.divIcon({
    className: '', html: '<div class="pin-usuario"></div>', iconSize: [18, 18], iconAnchor: [9, 9]
  });
  const iconPosto = L.divIcon({
    className: '', html: '<div class="pin-posto"><i class="fas fa-hospital"></i></div>', iconSize: [30, 30], iconAnchor: [15, 28]
  });
  L.marker(origem, { icon: iconUsuario }).addTo(rotaLayerGroup).bindPopup('Você está aqui');
  L.marker(destino, { icon: iconPosto }).addTo(rotaLayerGroup).bindPopup(p.nome);

  // tenta buscar o trajeto real de carro via OSRM (serviço público gratuito de roteamento)
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${userCoords.lng},${userCoords.lat};${p.lng},${p.lat}?overview=full&geometries=geojson`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();

    if (data.code === 'Ok' && data.routes?.[0]?.geometry?.coordinates?.length) {
      const coordsLatLng = data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
      L.polyline(coordsLatLng, { color: '#1a73e8', weight: 5, opacity: 0.85 }).addTo(rotaLayerGroup);
      const km = (data.routes[0].distance / 1000).toFixed(1);
      const min = Math.round(data.routes[0].duration / 60);
      document.getElementById('miniMapaDist').textContent = `${km} km de carro · ~${min} min`;
    } else {
      throw new Error('Resposta sem rota válida: ' + data.code);
    }
  } catch (e) {
    console.error('Roteamento OSRM indisponível, usando linha reta como alternativa:', e);
    // fallback: se o serviço de roteamento estiver fora do ar, desenha uma linha reta tracejada
    L.polyline([origem, destino], { color: '#1a73e8', weight: 4, opacity: 0.7, dashArray: '8 8' }).addTo(rotaLayerGroup);
    document.getElementById('miniMapaDist').textContent =
      formatarDistancia(distanciaKm(userCoords.lat, userCoords.lng, p.lat, p.lng)) + ' em linha reta (rota por ruas indisponível no momento)';
  }

  rotaMap.fitBounds(L.latLngBounds([origem, destino]), { padding: [40, 40] });
  wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── POSTOS ──────────────────────────────────────
const statusLabel = { aberto: 'Aberto', fechado: 'Fechado', urgencia: 'Urgência 24h' };
const statusColor = { aberto: '#27ae60', fechado: '#e74c3c', urgencia: '#e67e22' };

function buildPostoCard(p, isNearest = false) {
  const aviso = p.aviso ? `<div class="posto-aviso"><i class="fas fa-exclamation-triangle"></i> ${p.obs}</div>` : '';
  const distTxt = userCoords
    ? formatarDistancia(distanciaKm(userCoords.lat, userCoords.lng, p.lat, p.lng))
    : 'ative a localização';
  const nearestBadge = isNearest ? `<span class="tag-nearest"><i class="fas fa-star"></i> Mais próximo</span>` : '';
  return `
    <div class="posto-card${isNearest ? ' posto-nearest' : ''}" data-id="${p.id}" data-status="${p.status}">
      <div class="posto-header">
        <div>
          <h3 class="posto-nome">${p.nome}</h3>
          <div class="posto-dist"><i class="fas fa-location-arrow"></i> ${distTxt} ${nearestBadge}</div>
        </div>
        <span class="status-badge" style="background:${statusColor[p.status]}20;color:${statusColor[p.status]};border:1.5px solid ${statusColor[p.status]}40">
          <i class="fas fa-circle" style="font-size:0.55rem"></i> ${statusLabel[p.status]}
        </span>
      </div>
      <div class="posto-info"><i class="fas fa-map-marker-alt"></i> ${p.endereco}</div>
      <div class="posto-info"><i class="fas fa-clock"></i> ${p.horario}</div>
      <div class="posto-tags">
        ${p.servicos.slice(0,3).map(s => `<span class="tag">${s}</span>`).join('')}
        ${p.servicos.length > 3 ? `<span class="tag tag-more">+${p.servicos.length - 3}</span>` : ''}
      </div>
      ${aviso}
      <div class="posto-actions">
        <button class="btn btn-primary btn-sm" onclick="openPostoModal(${p.id})"><i class="fas fa-info-circle"></i> Detalhes</button>
        <button class="btn btn-outline btn-sm" onclick="mostrarRotaMapa(${p.id})"><i class="fas fa-route"></i> Ver Rota</button>
        <button class="btn btn-outline btn-sm" onclick="goMaps(${p.id})"><i class="fas fa-directions"></i> Como Chegar</button>
        <button class="btn btn-outline btn-sm" onclick="callPosto('${p.telefone}')"><i class="fas fa-phone"></i> Ligar</button>
      </div>
    </div>`;
}

function renderPostos(filter = 'all') {
  const grid = document.getElementById('postosGrid');
  let filtered = filter === 'all' ? [...POSTOS] : POSTOS.filter(p => p.status === filter);

  let nearestId = null;
  if (userCoords) {
    filtered.forEach(p => { p._dist = distanciaKm(userCoords.lat, userCoords.lng, p.lat, p.lng); });
    filtered.sort((a, b) => a._dist - b._dist);
    if (filtered.length) nearestId = filtered[0].id;
  }

  grid.innerHTML = filtered.map(p => buildPostoCard(p, p.id === nearestId)).join('');
}

// filter buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    renderPostos(this.dataset.filter);
  });
});

function goMaps(id) {
  const p = POSTOS.find(x => x.id === id);
  if (!p) return;
  const url = `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
  window.open(url, '_blank');
}

function callPosto(tel) {
  if (!tel) { showToast('Telefone não disponível — confirme com a Secretaria de Saúde.'); return; }
  const clean = tel.replace(/\D/g, '');
  window.open('tel:' + clean);
  showToast('📞 Ligando para ' + tel);
}

// ── MODAL POSTO ─────────────────────────────────
function openPostoModal(id) {
  const p = POSTOS.find(x => x.id === id);
  if (!p) return;
  const overlay = document.getElementById('modalOverlay');
  const content = document.getElementById('modalContent');

  const avisoHtml = p.obs ? `
    <div class="modal-section">
      <h4><i class="fas fa-info-circle"></i> Observação</h4>
      <div class="modal-row" style="background:var(--orange-light);border-radius:8px;padding:10px 14px;color:#c0650e;">
        <i class="fas fa-exclamation-triangle" style="color:#e67e22"></i> ${p.obs}
      </div>
    </div>` : '';

  content.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px">
      <div style="width:48px;height:48px;border-radius:12px;background:${statusColor[p.status]}15;display:flex;align-items:center;justify-content:center">
        <i class="fas fa-hospital" style="color:${statusColor[p.status]};font-size:1.4rem"></i>
      </div>
      <div>
        <div class="modal-title">${p.nome}</div>
        <span class="status-badge" style="background:${statusColor[p.status]}20;color:${statusColor[p.status]};border:1.5px solid ${statusColor[p.status]}40;font-size:0.75rem;padding:3px 10px;border-radius:12px;font-weight:700">
          <i class="fas fa-circle" style="font-size:0.5rem"></i> ${statusLabel[p.status]}
        </span>
      </div>
    </div>
    <div class="modal-section">
      <h4><i class="fas fa-map-marker-alt"></i> Localização & Contato</h4>
      <div class="modal-row"><i class="fas fa-map-marker-alt"></i> ${p.endereco}</div>
      <div class="modal-row"><i class="fas fa-phone"></i> ${p.telefone || 'Telefone a confirmar'}</div>
      <div class="modal-row"><i class="fas fa-location-arrow"></i> ${userCoords ? formatarDistancia(distanciaKm(userCoords.lat, userCoords.lng, p.lat, p.lng)) + ' de distância' : 'ative a localização para ver a distância'}</div>
    </div>
    <div class="modal-section">
      <h4><i class="fas fa-clock"></i> Horário de Funcionamento</h4>
      <div class="modal-row"><i class="fas fa-clock"></i> ${p.horario}</div>
    </div>
    <div class="modal-section">
      <h4><i class="fas fa-stethoscope"></i> Serviços Disponíveis</h4>
      <div class="modal-tags">${p.servicos.map(s => `<span class="tag">${s}</span>`).join('')}</div>
    </div>
    ${avisoHtml}
    <button class="modal-btn" onclick="goMaps(${p.id})"><i class="fas fa-directions"></i> Como Chegar no Google Maps</button>
    <button class="modal-btn secondary" style="margin-top:8px" onclick="callPosto('${p.telefone}')"><i class="fas fa-phone"></i> Ligar para o Posto</button>
  `;

  overlay.classList.add('open');
}

document.getElementById('modalClose').addEventListener('click', () => {
  document.getElementById('modalOverlay').classList.remove('open');
});
document.getElementById('modalOverlay').addEventListener('click', function(e) {
  if (e.target === this) this.classList.remove('open');
});

// ── AVISOS DA HOME (gerados a partir das datas reais) ──
function renderAvisos() {
  const hoje = new Date();

  // só campanhas em andamento ou prestes a começar — encerradas somem sozinhas
  const campanhasRelevantes = CAMPANHAS
    .map(c => ({ ...c, statusCalc: calcularStatusCampanha(c) }))
    .filter(c => c.statusCalc === 'ativa' || c.statusCalc === 'breve')
    .sort((a, b) => {
      // ativas primeiro; dentro do mesmo grupo, quem termina mais perto aparece primeiro
      if (a.statusCalc !== b.statusCalc) return a.statusCalc === 'ativa' ? -1 : 1;
      const fimA = parseDataBR(a.fim) || new Date(9999, 0, 1);
      const fimB = parseDataBR(b.fim) || new Date(9999, 0, 1);
      return fimA - fimB;
    });

  const avisosCampanhas = campanhasRelevantes.map(c => {
    const classe = c.statusCalc === 'breve' ? 'info' : 'success';
    const icone = c.statusCalc === 'breve' ? 'fa-clock' : 'fa-syringe';
    const periodo = c.inicio === 'Permanente' ? 'disponível o ano todo' : `${c.inicio}–${c.fim}`;
    const prefixo = c.statusCalc === 'breve' ? 'Em breve: ' : '';
    return `<div class="aviso ${classe}"><i class="fas ${icone}"></i><span>${prefixo}<strong>${c.nome}</strong> (${periodo}). ${c.desc}</span></div>`;
  });

  const avisosFixos = AVISOS_GERAIS.map(a =>
    `<div class="aviso ${a.tipo}"><i class="fas ${a.icone}"></i><span>${a.texto}</span></div>`
  );

  const todos = [...avisosCampanhas, ...avisosFixos];
  document.getElementById('avisoList').innerHTML = todos.length
    ? todos.join('')
    : '<div class="aviso info"><i class="fas fa-info-circle"></i><span>Nenhum aviso no momento.</span></div>';
}

// ── VACINAÇÃO ───────────────────────────────────
function buildCampanhaCard(c) {
  const status = calcularStatusCampanha(c);
  const statusClass = { ativa: 'status-ativa', breve: 'status-breve', encerrada: 'status-encerrada' }[status] || '';
  const statusTxt   = { ativa: '✅ Ativa', breve: '🔜 Em breve', encerrada: '🔴 Encerrada' }[status] || '';
  return `
    <div class="campanha-card${status === 'encerrada' ? ' campanha-encerrada' : ''}">
      <div class="campanha-banner" style="background:${c.corBg}">
        <span style="font-size:2.4rem">${c.icone}</span>
      </div>
      <div class="campanha-body">
        <h3>${c.nome}</h3>
        <p>${c.desc}</p>
        <p style="margin-top:8px;font-size:0.78rem;color:var(--teal-dark)"><i class="fas fa-map-marker-alt"></i> ${c.postos.join(', ')}</p>
        <div class="campanha-meta">
          <span class="status-pill ${statusClass}">${statusTxt}</span>
          <span class="vacina-date">${c.inicio} → ${c.fim}</span>
        </div>
      </div>
    </div>`;
}

function buildCalVacinalRow(v) {
  return `
    <div class="cal-vacinal-row">
      <span class="faixa-etaria">${v.faixa}</span>
      <div style="flex:1">
        <div class="vacina-nome">${v.vacina}</div>
        <div class="vacina-doses">${v.doses}</div>
      </div>
      ${v.obs ? `<div class="vacina-obs"><i class="fas fa-info-circle" style="color:var(--teal)"></i> ${v.obs}</div>` : ''}
    </div>`;
}

function buildHistoricoCard(h) {
  return `
    <div class="hist-card">
      <div class="hist-check"><i class="fas fa-check"></i></div>
      <div class="hist-info">
        <h4>${h.vacina}</h4>
        <p><i class="fas fa-calendar-alt"></i> ${h.data} &nbsp;|&nbsp; <i class="fas fa-map-marker-alt"></i> ${h.posto} &nbsp;|&nbsp; ${h.dose}</p>
      </div>
    </div>`;
}

// tabs
document.querySelectorAll('.vtab').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.vtab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.vtab-content').forEach(c => c.classList.remove('active'));
    this.classList.add('active');
    document.getElementById('vtab-' + this.dataset.vtab).classList.add('active');
  });
});

// ── PROFISSIONAIS ────────────────────────────────
const espColor = { clinico: '#3b82f6', pediatra: '#0dbdad', dentista: '#8e44ad', cardio: '#e74c3c', gineco: '#e67e22' };

function buildProfCard(p) {
  const color = espColor[p.categoria] || '#3b82f6';
  const badge = p.disponivel
    ? `<span class="badge-disponivel"><i class="fas fa-circle" style="font-size:0.5rem"></i> Disponível</span>`
    : `<span class="badge-indisponivel"><i class="fas fa-circle" style="font-size:0.5rem"></i> Indisponível</span>`;
  const oficialTag = p.oficial
    ? `<span class="tag-oficial"><i class="fas fa-shield-check"></i> Confirmado pela Secretaria</span>` : '';
  return `
    <div class="prof-card">
      <div class="prof-avatar" style="border-color:${color}30;color:${color}">${p.init}</div>
      <div class="prof-name">${p.nome}</div>
      <div class="prof-esp" style="color:${color}">${p.esp}</div>
      <div class="prof-horario"><i class="fas fa-clock"></i> ${p.horario}</div>
      <div class="prof-posto"><i class="fas fa-map-marker-alt"></i> ${p.posto}</div>
      ${badge}
      ${oficialTag}
    </div>`;
}

function renderProfissionais(esp = 'todos') {
  const grid = document.getElementById('profGrid');
  const filtered = esp === 'todos' ? PROFISSIONAIS : PROFISSIONAIS.filter(p => p.categoria === esp);
  grid.innerHTML = filtered.map(buildProfCard).join('');
}

document.querySelectorAll('.esp-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.esp-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    renderProfissionais(this.dataset.esp);
  });
});

// ── CALENDÁRIO ──────────────────────────────────
const _today = new Date();
let calYear = _today.getFullYear(), calMonth = _today.getMonth();

const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const tipoColor = { campanha: '#0dbdad', feriado: '#e67e22', evento: '#3b82f6' };

function renderCalendario() {
  const title = document.getElementById('calTitle');
  title.textContent = monthNames[calMonth] + ' ' + calYear;

  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';

  // day headers
  ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].forEach(d => {
    const el = document.createElement('div');
    el.className = 'cal-day-name';
    el.textContent = d;
    grid.appendChild(el);
  });

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const prevDays = new Date(calYear, calMonth, 0).getDate();

  // prev month filler
  for (let i = firstDay - 1; i >= 0; i--) {
    const el = document.createElement('div');
    el.className = 'cal-day other-month';
    el.innerHTML = `<span class="day-num">${prevDays - i}</span>`;
    grid.appendChild(el);
  }

  const today = new Date();

  for (let d = 1; d <= daysInMonth; d++) {
    const el = document.createElement('div');
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = today.getFullYear() === calYear && today.getMonth() === calMonth && today.getDate() === d;
    el.className = 'cal-day' + (isToday ? ' today' : '');
    el.dataset.date = dateStr;

    const events = EVENTOS_CALENDARIO.filter(e => e.data === dateStr);
    const dots = events.map(e => `<div class="day-dot" style="background:${tipoColor[e.tipo] || '#888'}"></div>`).join('');

    el.innerHTML = `<span class="day-num">${d}</span><div class="day-dots">${dots}</div>`;
    el.addEventListener('click', () => openCalModal(dateStr));
    if (events.length) el.style.cursor = 'pointer';
    grid.appendChild(el);
  }

  // show all events for the month by default
  showCalEvents(null);
}

function showCalEvents(dateFilter) {
  const container = document.getElementById('calEvents');
  const events = dateFilter
    ? EVENTOS_CALENDARIO.filter(e => e.data === dateFilter)
    : EVENTOS_CALENDARIO.filter(e => {
        const [y, m] = e.data.split('-').map(Number);
        return y === calYear && m === calMonth + 1;
      }).sort((a, b) => a.data.localeCompare(b.data));

  if (!events.length) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:12px 0">Nenhum evento neste dia.</p>';
    return;
  }

  const label = dateFilter ? `Eventos em ${dateFilter.split('-').reverse().join('/')}` : `Eventos em ${monthNames[calMonth]}`;
  container.innerHTML = `<h3>${label}</h3>` + events.map(e => `
    <div class="event-row">
      <div class="event-dot-wrap">
        <div class="event-dot-big" style="background:${tipoColor[e.tipo] || '#888'}"></div>
      </div>
      <div>
        <div class="event-title">${e.titulo}</div>
        <div class="event-date">${e.data.split('-').reverse().join('/')}</div>
        <div class="event-desc">${e.desc}</div>
      </div>
    </div>`).join('');
}

document.getElementById('prevMonth').addEventListener('click', () => {
  calMonth--;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendario();
});
document.getElementById('nextMonth').addEventListener('click', () => {
  calMonth++;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  renderCalendario();
});

// ── SEARCH ──────────────────────────────────────
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');

// ── SUGESTÃO POR IA (quando não há match exato) ──
function renderSugestaoIA(query) {
  if (typeof classificarSintomas !== 'function') return false;

  const resultados = classificarSintomas(query);
  if (!resultados.length) return false;

  const top = resultados[0];

  // sintoma de alarme → não sugerir agendamento, mandar pra urgência
  if (top.categoria === 'urgencia') {
    searchResults.innerHTML = `
      <div class="ia-urgencia">
        <div class="ia-urgencia-header"><i class="fas fa-triangle-exclamation"></i> Isso pode ser urgente</div>
        <p>Pelos sintomas descritos, procure atendimento imediato. Não espere por agendamento.</p>
        <button class="btn btn-primary btn-sm" id="btnIrUpa"><i class="fas fa-hospital"></i> Ver UPA 24h mais próxima</button>
      </div>`;
    searchResults.classList.add('open');
    document.getElementById('btnIrUpa').addEventListener('click', () => {
      showPage('postos');
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      const btn = document.querySelector('.filter-btn[data-filter="urgencia"]');
      if (btn) btn.classList.add('active');
      renderPostos('urgencia');
      searchInput.value = '';
      searchResults.classList.remove('open');
    });
    return true;
  }

  const sugestoes = resultados.filter(r => r.categoria !== 'urgencia').slice(0, 2);
  if (!sugestoes.length) return false;

  searchResults.innerHTML = `
    <div class="ia-sugestao-header"><i class="fas fa-robot"></i> IA de triagem: não achamos "${query}" no menu, mas pelos sintomas você provavelmente precisa de:</div>
    ${sugestoes.map(s => `
      <div class="search-result-item ia-item" data-categoria="${s.categoria}">
        <i class="fas fa-user-md"></i>
        <span>${s.nome} <small>(${Math.round(s.compatibilidade * 100)}% de compatibilidade)</small></span>
      </div>`).join('')}
    <div class="ia-disclaimer"><i class="fas fa-circle-info"></i> Sugestão automática, não substitui avaliação médica.</div>
  `;
  searchResults.classList.add('open');

  searchResults.querySelectorAll('.ia-item').forEach(item => {
    item.addEventListener('click', function() {
      showPage('profissionais');
      document.querySelectorAll('.esp-btn').forEach(b => b.classList.remove('active'));
      const btn = document.querySelector(`.esp-btn[data-esp="${this.dataset.categoria}"]`);
      if (btn) btn.classList.add('active');
      renderProfissionais(this.dataset.categoria);
      searchInput.value = '';
      searchResults.classList.remove('open');
    });
  });

  return true;
}

searchInput.addEventListener('input', function() {
  const q = this.value.trim().toLowerCase();
  if (!q) { searchResults.classList.remove('open'); return; }

  const matches = SEARCH_INDEX.filter(item => item.label.toLowerCase().includes(q));
  if (!matches.length) {
    if (!renderSugestaoIA(q)) searchResults.classList.remove('open');
    return;
  }

  searchResults.innerHTML = matches.map(item => `
    <div class="search-result-item" data-page="${item.page}">
      <i class="${item.icon}"></i>
      <span>${item.label}</span>
    </div>`).join('');

  searchResults.classList.add('open');

  searchResults.querySelectorAll('.search-result-item').forEach(item => {
    item.addEventListener('click', function() {
      showPage(this.dataset.page);
      searchInput.value = '';
      searchResults.classList.remove('open');
    });
  });
});

document.addEventListener('click', function(e) {
  if (!e.target.closest('.search-bar-wrap')) {
    searchResults.classList.remove('open');
  }
});

document.querySelector('.btn-search').addEventListener('click', function() {
  const q = searchInput.value.trim().toLowerCase();
  if (!q) return;
  const match = SEARCH_INDEX.find(item => item.label.toLowerCase().includes(q));
  if (match) {
    showPage(match.page);
    searchInput.value = '';
    searchResults.classList.remove('open');
  } else if (!renderSugestaoIA(q)) {
    showToast('Nenhum resultado encontrado para "' + searchInput.value + '"');
  }
});

// ── EXTRA CSS FOR CARDS (injected) ──────────────
const extraCSS = `
.posto-card {
  background: var(--surface); border-radius: var(--radius);
  box-shadow: var(--shadow); padding: 20px;
  transition: transform 0.2s, box-shadow 0.2s;
}
.posto-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-md); }
.posto-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; gap: 10px; }
.posto-nome { font-family: 'Nunito', sans-serif; font-weight: 700; font-size: 1rem; margin-bottom: 2px; }
.posto-dist { font-size: 0.78rem; color: var(--teal); font-weight: 600; }
.status-badge { font-size: 0.72rem; font-weight: 700; padding: 4px 10px; border-radius: 12px; display: flex; align-items: center; gap: 5px; white-space: nowrap; flex-shrink: 0; }
.posto-info { font-size: 0.82rem; color: var(--text-muted); margin-bottom: 5px; display: flex; align-items: center; gap: 7px; }
.posto-info i { color: var(--teal); width: 14px; }
.posto-tags { display: flex; flex-wrap: wrap; gap: 5px; margin: 10px 0; }
.tag { background: var(--teal-light); color: var(--teal-dark); font-size: 0.72rem; font-weight: 600; padding: 3px 10px; border-radius: 10px; }
.tag-more { background: var(--bg); color: var(--text-muted); }
.posto-aviso { background: var(--orange-light); border-radius: 8px; padding: 8px 12px; font-size: 0.78rem; color: #c0650e; display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.posto-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
.btn-sm { padding: 7px 12px !important; font-size: 0.8rem !important; }
.postos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 18px; margin-bottom: 24px; }
.page-header { margin-bottom: 24px; }
.page-header h1 { font-family: 'Nunito', sans-serif; font-size: 1.6rem; font-weight: 800; margin-bottom: 4px; display: flex; align-items: center; gap: 10px; }
.page-header h1 i { color: var(--teal); }
.page-header p { color: var(--text-muted); font-size: 0.9rem; }
.filter-bar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
.filter-btn { padding: 8px 18px; border-radius: 20px; border: 2px solid var(--border); background: var(--surface); font-family: inherit; font-size: 0.85rem; font-weight: 600; color: var(--text-muted); cursor: pointer; transition: all 0.2s; }
.filter-btn:hover { border-color: var(--teal); color: var(--teal); }
.filter-btn.active { background: var(--teal); color: #fff; border-color: var(--teal); }
.esp-filter { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
.esp-btn { padding: 8px 18px; border-radius: 20px; border: 2px solid var(--border); background: var(--surface); font-family: inherit; font-size: 0.85rem; font-weight: 600; color: var(--text-muted); cursor: pointer; transition: all 0.2s; }
.esp-btn:hover { border-color: var(--teal); color: var(--teal); }
.esp-btn.active { background: var(--teal); color: #fff; border-color: var(--teal); }
.ia-sugestao-header { padding: 10px 14px; font-size: 0.78rem; color: var(--text-muted); font-weight: 600; border-bottom: 1px solid var(--border); }
.ia-item small { color: var(--teal-dark); font-weight: 600; }
.ia-disclaimer { padding: 8px 14px; font-size: 0.7rem; color: var(--text-muted); border-top: 1px solid var(--border); display: flex; align-items: center; gap: 6px; }
.ia-urgencia { padding: 16px; }
.ia-urgencia-header { color: #c0392b; font-weight: 800; font-size: 0.9rem; display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.ia-urgencia p { font-size: 0.82rem; color: var(--text-muted); margin-bottom: 12px; }
.search-hint { font-size: 0.76rem; color: var(--teal-dark); font-weight: 600; margin-top: 8px; display: flex; align-items: center; gap: 6px; padding-left: 4px; }
.tag-oficial { display: inline-flex; align-items: center; gap: 4px; margin-top: 6px; background: #e6f7ee; color: #1a7f4e; font-size: 0.68rem; font-weight: 800; padding: 3px 8px; border-radius: 10px; }
`;

const styleEl = document.createElement('style');
styleEl.textContent = extraCSS;
document.head.appendChild(styleEl);

// ── MODAL CALENDÁRIO ────────────────────────────
function openCalModal(dateStr) {
  const events = EVENTOS_CALENDARIO.filter(e => e.data === dateStr);
  const [year, month, day] = dateStr.split('-');
  const dateDisplay = `${day}/${month}/${year}`;

  const overlay = document.getElementById('modalOverlay');
  const content = document.getElementById('modalContent');

  const tipoLabel = { campanha: 'Campanha', feriado: 'Feriado', evento: 'Evento' };
  const tipoIcon  = { campanha: 'fas fa-syringe', feriado: 'fas fa-flag', evento: 'fas fa-star' };
  const tipoColor2 = { campanha: '#0dbdad', feriado: '#e67e22', evento: '#3b82f6' };

  if (!events.length) {
    content.innerHTML = `
      <div style="text-align:center;padding:20px 0">
        <div style="font-size:3rem;margin-bottom:12px">📅</div>
        <div class="modal-title" style="margin-bottom:8px">${dateDisplay}</div>
        <p style="color:var(--text-muted);font-size:0.9rem">Nenhum evento registrado para este dia.</p>
      </div>`;
  } else {
    const dayNames = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
    const d = new Date(dateStr + 'T12:00:00');
    const dayName = dayNames[d.getDay()];

    content.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
        <div style="width:52px;height:52px;border-radius:12px;background:var(--teal-light);display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0">
          <span style="font-size:1.3rem;font-weight:800;color:var(--teal-dark);line-height:1">${day}</span>
          <span style="font-size:0.62rem;font-weight:700;color:var(--teal);text-transform:uppercase">${new Date(dateStr+'T12:00:00').toLocaleString('pt-BR',{month:'short'})}</span>
        </div>
        <div>
          <div class="modal-title" style="font-size:1.1rem;margin-bottom:2px">${dayName}, ${dateDisplay}</div>
          <span style="font-size:0.78rem;color:var(--teal-dark);font-weight:600">${events.length} evento${events.length > 1 ? 's' : ''} neste dia</span>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px">
        ${events.map(e => `
          <div style="border-radius:10px;border:1.5px solid ${tipoColor2[e.tipo]}30;background:${tipoColor2[e.tipo]}08;padding:14px 16px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
              <div style="width:28px;height:28px;border-radius:8px;background:${tipoColor2[e.tipo]}20;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                <i class="${tipoIcon[e.tipo]}" style="color:${tipoColor2[e.tipo]};font-size:0.75rem"></i>
              </div>
              <div>
                <div style="font-weight:700;font-size:0.9rem;line-height:1.2">${e.titulo}</div>
                <span style="font-size:0.68rem;font-weight:700;color:${tipoColor2[e.tipo]};text-transform:uppercase;letter-spacing:0.04em">${tipoLabel[e.tipo]}</span>
              </div>
            </div>
            <p style="font-size:0.82rem;color:var(--text-muted);line-height:1.55;margin:0">${e.desc}</p>
          </div>`).join('')}
      </div>`;
  }

  overlay.classList.add('open');
}

// ── RELÓGIO EM TEMPO REAL ────────────────────────
function startRealtimeClock() {
  const clockEl = document.getElementById('realtimeClock');
  if (!clockEl) return;

  function tick() {
    const now = new Date();
    const days = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
    const months = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
    const dayName = days[now.getDay()];
    const date = `${String(now.getDate()).padStart(2,'0')} ${months[now.getMonth()]} ${now.getFullYear()}`;
    const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
    clockEl.innerHTML = `<i class="fas fa-clock"></i> ${dayName}, ${date} &nbsp;&middot;&nbsp; <strong>${time}</strong>`;
  }

  tick();
  setInterval(tick, 1000);
}

function injectClockElement() {
  const horariosCard = document.querySelector('.horarios-card h3');
  if (!horariosCard) return;
  const clockDiv = document.createElement('div');
  clockDiv.id = 'realtimeClock';
  clockDiv.style.cssText = 'font-size:0.78rem;color:var(--teal-dark);font-weight:600;margin-top:6px;margin-bottom:2px;letter-spacing:0.01em;';
  horariosCard.insertAdjacentElement('afterend', clockDiv);
  startRealtimeClock();
}

// ── INIT ────────────────────────────────────────
function init() {
  renderPostos('all');
  document.getElementById('campanhasGrid').innerHTML = CAMPANHAS.map(buildCampanhaCard).join('');
  document.getElementById('calVacinal').innerHTML = CALENDARIO_VACINAL.map(buildCalVacinalRow).join('');
  document.getElementById('historicoCards').innerHTML = HISTORICO.map(buildHistoricoCard).join('');
  renderProfissionais('todos');
  renderCalendario();
  renderAvisos();
  injectClockElement();
}

init();