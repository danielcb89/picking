// ════════════════════════════════════════════════════════════════
// app.js — Orquestación: arranque, procesado y navegación
// ════════════════════════════════════════════════════════════════

const CACHE_KEY = 'gp_cache_v1';

function saveToCache() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ selectedStore, ARTS, ts: Date.now() }));
  } catch(e) {
    console.warn('Cache no disponible:', e.message);
  }
}

async function loadFromCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (!d.selectedStore || !d.ARTS?.length) return false;
    selectedStore = d.selectedStore;
    ARTS          = d.ARTS;
    const ubRows  = await fetchStoreFile();
    processUbicaciones(ubRows);
    calcAlerts();
    buildMaps();
    return true;
  } catch(e) {
    localStorage.removeItem(CACHE_KEY);
    return false;
  }
}

function cambiarTienda() {
  localStorage.removeItem(CACHE_KEY);
  location.reload();
}

window.addEventListener('DOMContentLoaded', async () => {
  if (await loadFromCache()) showApp();
});


// ── PROCESADO PRINCIPAL ──────────────────────────────────────────

async function startProcessing() {
  document.getElementById('startBtn').disabled = true;
  document.getElementById('upProg').style.display = 'block';

  function setP(pct, msg) {
    document.getElementById('progBar').style.width = pct + '%';
    document.getElementById('progMsg').textContent = msg;
  }

  try {
    setP(10,  'Leyendo artículos...');
    const artRows = await readFile(rawFile1);

    setP(30,  'Cargando ubicaciones ' + selectedStore + '...');
    const ubRows  = await fetchStoreFile();

    setP(50,  'Procesando artículos...');
    processArticles(artRows);

    setP(70,  'Procesando ubicaciones...');
    processUbicaciones(ubRows);

    setP(85,  'Calculando alertas...');
    calcAlerts();

    setP(95,  'Construyendo mapa...');
    buildMaps();

    setP(98,  'Guardando sesión...');
    saveToCache();

    setP(100, '¡Listo!');
    setTimeout(showApp, 300);

  } catch (err) {
    alert('Error: ' + err.message);
    document.getElementById('startBtn').disabled = false;
  }
}


// ── INICIALIZACIÓN DE LA APP ─────────────────────────────────────

function showApp() {
  document.getElementById('uploadScreen').style.display = 'none';
  document.getElementById('app').style.display = 'block';

  const store = STORE_FILES[selectedStore];
  document.getElementById('headerStoreName').textContent = selectedStore + ' · ' + store.nombre;

  document.getElementById('hLocsC').textContent  = STATS.total_locs_c.toLocaleString();
  document.getElementById('hLocsA').textContent  = STATS.total_locs_a.toLocaleString();
  document.getElementById('hConLoc').textContent = STATS.arts_with_loc.toLocaleString();

  const tabsEl = document.getElementById('layoutTabs');
  if (LAYOUTS.length > 1) {
    tabsEl.innerHTML = LAYOUTS.map((l, i) =>
      `<button class="layout-tab${i === 0 ? ' act' : ''}" onclick="switchLayout(${i})">${l.nombre}</button>`
    ).join('');
    tabsEl.style.display = '';
  } else {
    tabsEl.innerHTML = '';
    tabsEl.style.display = 'none';
  }

  freeThreshold = CFG.espLibre;
  renderPesados();
  renderLibre();
  renderBye();
  filteredArts = [...ARTS];
  sortArtsData();

  // Renderizar mapa cuando el contenedor tenga tamaño real
  const mapArea = document.getElementById('mapCont')?.parentElement;
  if (mapArea && typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver((entries) => {
      if (entries[0].contentRect.height > 50) {
        ro.disconnect();
        renderLayoutMap(0);
      }
    });
    ro.observe(mapArea);
  } else {
    requestAnimationFrame(() => requestAnimationFrame(() => renderLayoutMap(0)));
  }
}


// ── CAMBIO DE LAYOUT ────────────────────────────────────────────

function switchLayout(idx) {
  currentLayout = idx;
  document.querySelectorAll('.layout-tab').forEach((btn, i) =>
    btn.classList.toggle('act', i === idx)
  );
  clearMapHighlight();
  renderLayoutMap(idx);
}


// ── NAVEGACIÓN ───────────────────────────────────────────────────

const VIEWS = ['mapa', 'arts', 'libre', 'bye', 'pesados', 'ajustes'];

function gotoView(v) {
  VIEWS.forEach(x => {
    document.getElementById('p-' + x).classList.toggle('act', x === v);
    document.getElementById('n-' + x).classList.toggle('act', x === v);
  });
  document.getElementById('sb-arts').style.display  = v === 'arts'  ? 'block' : 'none';
  document.getElementById('sb-libre').style.display = v === 'libre' ? 'block' : 'none';
  if (v === 'arts')    renderArtsTable();
  if (v === 'ajustes') renderConfigPanel();
}


// ── CONFIGURACIÓN ────────────────────────────────────────────────

function renderConfigPanel() {
  ['rotacion','pesado','topN','topNHigh','espLibre'].forEach(key => {
    const val = CFG[key];
    const disp = document.getElementById('disp-' + key);
    if (disp) disp.textContent = val;
    document.querySelectorAll(`.cfg-opt[data-cfg="${key}"]`).forEach(btn => {
      btn.classList.toggle('act', parseInt(btn.getAttribute('data-val')) === val);
    });
    const inp = document.getElementById('custom-' + key);
    if (inp) inp.value = '';
  });
}

function setCfgOpt(btn) {
  const key = btn.getAttribute('data-cfg');
  const val = parseInt(btn.getAttribute('data-val'));
  CFG[key] = val;
  document.querySelectorAll(`.cfg-opt[data-cfg="${key}"]`).forEach(b =>
    b.classList.toggle('act', b === btn)
  );
  const inp = document.getElementById('custom-' + key);
  if (inp) inp.value = '';
  const disp = document.getElementById('disp-' + key);
  if (disp) disp.textContent = val;
}

function setCfgCustom(key, raw) {
  const val = parseInt(raw);
  if (isNaN(val) || val < 0) return;
  CFG[key] = val;
  document.querySelectorAll(`.cfg-opt[data-cfg="${key}"]`).forEach(b => b.classList.remove('act'));
  const disp = document.getElementById('disp-' + key);
  if (disp) disp.textContent = val;
}

function applyConfig() {
  calcAlerts();
  buildMaps();
  freeThreshold = CFG.espLibre;
  renderLayoutMap(currentLayout);
  renderPesados();
  renderLibre();
  renderBye();
  const btn = document.querySelector('.cfg-btn-apply');
  const orig = btn.textContent;
  btn.textContent = '✓ Aplicado';
  btn.style.background = 'linear-gradient(180deg,#2e7d32 0%,#1b5e20 100%)';
  setTimeout(() => { btn.textContent = orig; btn.style.background = ''; }, 1800);
}

function resetConfig() {
  CFG = { ...CFG_DEFAULTS };
  renderConfigPanel();
}
