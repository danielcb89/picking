// ════════════════════════════════════════════════════════════════
// app.js — Orquestación: arranque, procesado y navegación
// Depende de: state.js, data.js, map.js, views.js
// Cargado el último.
// ════════════════════════════════════════════════════════════════


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

    setP(100, '¡Listo!');
    setTimeout(showApp, 300);

  } catch (err) {
    alert('Error: ' + err.message);
    document.getElementById('startBtn').disabled = false;
    console.error(err);
  }
}


// ── INICIALIZACIÓN DE LA APP ─────────────────────────────────────

function showApp() {
  document.getElementById('uploadScreen').style.display = 'none';
  document.getElementById('app').style.display = 'block';

  // Mercado en el subtítulo del logo
  const store = STORE_FILES[selectedStore];
  document.getElementById('headerStoreName').textContent =
    selectedStore + ' · ' + store.nombre;

  // Rellenar pills de la cabecera
  document.getElementById('hLocsC').textContent  = STATS.total_locs_c.toLocaleString();
  document.getElementById('hLocsA').textContent  = STATS.total_locs_a.toLocaleString();
  document.getElementById('hArts').textContent   = STATS.total_arts.toLocaleString();
  document.getElementById('hConLoc').textContent = STATS.arts_with_loc.toLocaleString();
  document.getElementById('hHeavy').textContent    = STATS.heavy_count.toLocaleString();
  document.getElementById('hNoLoc').textContent  = STATS.no_loc_high.toLocaleString();

  // Generar tabs de layout (solo si hay más de uno)
  const tabsEl = document.getElementById('layoutTabs');
  if (LAYOUTS.length > 1) {
    tabsEl.innerHTML = LAYOUTS.map((l, i) =>
      `<button class="layout-tab${i === 0 ? ' act' : ''}"
         onclick="switchLayout(${i})">${l.nombre}</button>`
    ).join('');
    tabsEl.style.display = '';
  } else {
    tabsEl.innerHTML = '';
    tabsEl.style.display = 'none';
  }

  // Aplicar configuración inicial
  freeThreshold = CFG.espLibre;

  // Renderizar todas las vistas (el mapa es la activa por defecto)
  renderLayoutMap(0);
  renderPesados();
  renderLibre();
  renderBye();

  // Preparar tabla de artículos
  filteredArts = [...ARTS];
  sortArtsData();
}


// ── CAMBIO DE LAYOUT ────────────────────────────────────────────

function switchLayout(idx) {
  currentLayout = idx;

  // Actualizar tab activa
  document.querySelectorAll('.layout-tab').forEach((btn, i) =>
    btn.classList.toggle('act', i === idx)
  );

  // Limpiar búsqueda y re-renderizar
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
  // Sincronizar botones activos y displays con CFG actual
  ['rotacion','pesado','topN','topNHigh','espLibre'].forEach(key => {
    const val = CFG[key];
    // Actualizar display
    const disp = document.getElementById('disp-' + key);
    if (disp) disp.textContent = val;
    // Marcar botón activo
    document.querySelectorAll(`.cfg-opt[data-cfg="${key}"]`).forEach(btn => {
      btn.classList.toggle('act', parseInt(btn.getAttribute('data-val')) === val);
    });
    // Limpiar input personalizado
    const inp = document.getElementById('custom-' + key);
    if (inp) inp.value = '';
  });
}

function setCfgOpt(btn) {
  const key = btn.getAttribute('data-cfg');
  const val = parseInt(btn.getAttribute('data-val'));
  CFG[key] = val;
  // Actualizar botones activos de este grupo
  document.querySelectorAll(`.cfg-opt[data-cfg="${key}"]`).forEach(b =>
    b.classList.toggle('act', b === btn)
  );
  // Limpiar input personalizado
  const inp = document.getElementById('custom-' + key);
  if (inp) inp.value = '';
  // Actualizar display
  const disp = document.getElementById('disp-' + key);
  if (disp) disp.textContent = val;
}

function setCfgCustom(key, raw) {
  const val = parseInt(raw);
  if (isNaN(val) || val < 0) return;
  CFG[key] = val;
  // Desmarcar todos los botones de este grupo
  document.querySelectorAll(`.cfg-opt[data-cfg="${key}"]`).forEach(b => b.classList.remove('act'));
  // Actualizar display
  const disp = document.getElementById('disp-' + key);
  if (disp) disp.textContent = val;
}

function applyConfig() {
  // Recalcular alertas y top rotación con nuevos valores
  calcAlerts();
  buildMaps();
  // Re-renderizar todo
  freeThreshold = CFG.espLibre;
  renderLayoutMap(currentLayout);
  renderPesados();
  renderLibre();
  renderBye();
  // Actualizar pill cabecera
  document.getElementById('hHeavy').textContent   = STATS.heavy_count.toLocaleString();
  document.getElementById('hNoLoc').textContent = STATS.no_loc_high.toLocaleString();
  // Feedback visual
  const btn = document.querySelector('.cfg-btn-apply');
  const orig = btn.textContent;
  btn.textContent = '✓ Aplicado';
  btn.style.background = 'linear-gradient(180deg,#2e7d32 0%,#1b5e20 100%)';
  setTimeout(() => {
    btn.textContent = orig;
    btn.style.background = '';
  }, 1800);
}

function resetConfig() {
  CFG = { ...CFG_DEFAULTS };
  renderConfigPanel();
  // No aplica automáticamente — el usuario debe pulsar Aplicar
}
