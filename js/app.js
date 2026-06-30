// ════════════════════════════════════════════════════════════════
// app.js — Orquestación: arranque, procesado y navegación
// ════════════════════════════════════════════════════════════════

const CACHE_KEY = 'gp_cache_v1';

// ── IndexedDB helpers (sin límite de tamaño) ─────────────────────
function _idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('picking_ikea', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('cache');
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}
async function _idbSet(key, value) {
  const db = await _idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('cache', 'readwrite');
    tx.objectStore('cache').put(value, key);
    tx.oncomplete = resolve;
    tx.onerror    = e => reject(e.target.error);
  });
}
async function _idbGet(key) {
  const db = await _idbOpen();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('cache', 'readonly');
    const req = tx.objectStore('cache').get(key);
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}
async function _idbDel(key) {
  const db = await _idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('cache', 'readwrite');
    tx.objectStore('cache').delete(key);
    tx.oncomplete = resolve;
    tx.onerror    = e => reject(e.target.error);
  });
}

async function saveToCache() {
  try {
    await _idbSet(CACHE_KEY, { selectedStore, ARTS, ts: Date.now() });
  } catch(e) {
    console.warn('Cache no guardado:', e.message);
  }
}

async function loadFromCache() {
  try {
    const d = await _idbGet(CACHE_KEY);
    console.log('[cache] idb get:', d ? `store=${d.selectedStore} arts=${d.ARTS?.length}` : 'vacío');
    if (!d?.selectedStore || !d.ARTS?.length) return false;
    selectedStore = d.selectedStore;
    ARTS          = d.ARTS;
    ARTS.forEach(a => {
      if (a.es) a.es = new Date(a.es);
      if (a.ss) a.ss = new Date(a.ss);
    });
    console.log('[cache] fetchStoreFile...');
    const ubRows = await fetchStoreFile();
    console.log('[cache] ubRows:', ubRows?.length);
    processUbicaciones(ubRows);
    calcAlerts();
    buildMaps();
    return true;
  } catch(e) {
    console.error('[cache] error en loadFromCache:', e);
    await _idbDel(CACHE_KEY).catch(() => {});
    return false;
  }
}

async function saveToCache() {
  try {
    await _idbSet(CACHE_KEY, { selectedStore, ARTS, ts: Date.now() });
    console.log('[cache] guardado en idb, arts:', ARTS.length);
  } catch(e) {
    console.warn('[cache] error guardando:', e.message);
  }
}

async function cambiarTienda() {
  // ponytail: solo borra el caché de datos, no la sesión de usuario
  await _idbDel(CACHE_KEY).catch(() => {});
  document.getElementById('app').style.display          = 'none';
  document.getElementById('uploadScreen').style.display = '';
}


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
    // ponytail: validar columnas mínimas antes de procesar
    if (!artRows.length) throw new Error('El archivo de artículos está vacío.');
    const firstRow = artRows[0];
    const keys = Object.keys(firstRow).map(k => k.toLowerCase());
    const hasArtcod = keys.some(k => ['artcod','codigo','cod','article','item'].includes(k));
    const hasDescr = keys.some(k => ['descr','description','descripcion','desc','nombre'].includes(k));
    if (!hasArtcod || !hasDescr) throw new Error(`El archivo no tiene el formato correcto. Columnas encontradas: ${Object.keys(firstRow).join(', ')}`);
    processArticles(artRows);

    setP(70,  'Procesando ubicaciones...');
    processUbicaciones(ubRows);

    setP(85,  'Calculando alertas...');
    calcAlerts();

    setP(95,  'Construyendo mapa...');
    buildMaps();

    setP(98,  'Guardando sesión...');
    // ponytail: solo guardar si hay artículos válidos con código
    if (ARTS.length > 0) {
      await saveToCache();
      savePreferences(selectedStore, 'mapa', CFG);
    }

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
  filterArts();

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

const VIEWS = ['mapa', 'arts', 'libre', 'bye', 'pesados'];

function gotoView(v) {
  document.getElementById('p-artdetail')?.classList.remove('act');
  VIEWS.forEach(x => {
    document.getElementById('p-' + x).classList.toggle('act', x === v);
    document.getElementById('n-' + x).classList.toggle('act', x === v);
  });
  document.getElementById('sb-arts').style.display    = v === 'arts'    ? 'block' : 'none';
  document.getElementById('sb-libre').style.display   = v === 'libre'   ? 'block' : 'none';
  document.getElementById('sb-bye').style.display     = v === 'bye'     ? 'block' : 'none';
  document.getElementById('sb-pesados').style.display = v === 'pesados' ? 'block' : 'none';
  if (v === 'arts') { renderArtsCards(); renderArtsTable(); }
  if (v === 'mapa') {
    // Si había un shelf inline abierto, cerrarlo antes de renderizar el mapa
    if (document.getElementById('shelfInline')?.style.display !== 'none') closeShelfDetail();
    renderLayoutMap(currentLayout);
  }
  savePreferences(selectedStore, v, CFG);
}


// ── CONFIGURACIÓN ────────────────────────────────────────────────

function stepCfg(key, delta) {
  CFG[key] = Math.max(1, Math.min(50, (CFG[key] || 5) + delta));
  const disp = document.getElementById('disp-' + key);
  if (disp) disp.textContent = CFG[key];
  calcAlerts();
  buildMaps();
  renderLayoutMap(currentLayout);
  savePreferences(selectedStore, 'mapa', CFG);
}
