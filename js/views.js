// ════════════════════════════════════════════════════════════════
// views.js — Renderizado de las vistas: Artículos, Revisar, Libre
// Depende de: state.js
// ════════════════════════════════════════════════════════════════


// ── BÚSQUEDA MULTI-TÉRMINO ────────────────────────────────────────
// El * actúa como AND: "lack*60x60" → el registro debe contener "lack" Y "60x60"
// Cada término se busca en todos los campos que se pasen como array de strings.
// Uso: matchTerms('lack*60x60', [a.i, a.d, a.lc, a.la])
function matchTerms(raw, fields) {
  if (!raw) return true;
  const terms = raw.split('*').map(t => t.trim()).filter(Boolean);
  if (!terms.length) return true;
  const haystack = fields.map(f => (f || '').toLowerCase()).join(' ');
  return terms.every(t => haystack.includes(t));
}

function pcls(p) {
  return { CRÍTICA: 'b-rd', ALTA: 'b-rd', MEDIA: 'b-yw', OK: 'b-gn' }[p] || 'b-gy';
}
function wcls(w) {
  return { 'Muy voluminoso':'b-rd', 'Voluminoso':'b-or', 'Estándar':'b-yw', 'Compacto':'b-gn', 'Muy compacto':'b-bl' }[w] || 'b-gy';
}
function pcls_w(p) {
  return { 'Muy pesado':'b-rd', 'Pesado':'b-or', 'Medio':'b-yw', 'Ligero':'b-gn', 'Muy ligero':'b-bl' }[p] || 'b-gy';
}


// ── ORDENACIÓN GENÉRICA POR ENCABEZADO (Artículos, Revisar, Libre) ──

// Ordena un array por una propiedad, ascendente ('a') o descendente ('d').
// Los valores null/undefined se tratan como "menores que todo".
function sortArrBy(arr, key, dir) {
  return [...arr].sort((a, b) => {
    let va = a[key], vb = b[key];
    if (va === null || va === undefined) va = -Infinity;
    if (vb === null || vb === undefined) vb = -Infinity;
    if (typeof va === 'string') { va = va.toLowerCase(); vb = vb.toLowerCase(); }
    if (va < vb) return dir === 'a' ? -1 : 1;
    if (va > vb) return dir === 'a' ?  1 : -1;
    return 0;
  });
}

// Genera un <th> clicable. Primer clic en una columna nueva → ascendente.
// Clic repetido sobre la misma columna → alterna asc/desc.
function th(name, key, label) {
  const st = sortStates[name];
  const arrow = st.k === key ? (st.d === 'a' ? ' ▲' : ' ▼') : '';
  return `<th onclick="sortTable('${name}','${key}')" style="cursor:pointer;user-select:none">${label}${arrow}</th>`;
}

// Maneja el clic: actualiza el estado de orden de la tabla y la re-renderiza.
function sortTable(name, key) {
  const st = sortStates[name];
  if (st.k === key) st.d = (st.d === 'a' ? 'd' : 'a');
  else { st.k = key; st.d = 'a'; }

  if (name === 'arts') {
    sortK = key; sortD = st.d;
    sortArtsData();
    renderArtsTable();
  } else if (name === 'pesados') {
    renderPesadosTable();
  } else if (name === 'bye') {
    renderByeTable();
  } else {
    renderLibreTable();
  }
}


// ── ARTÍCULOS ────────────────────────────────────────────────────

// Modo de visualización de ventas: 'mes' | 'sem' | 'ano'
let ventaMode = 'mes';

// Devuelve el valor de ventas del artículo según el modo activo
function ventaVal(a) {
  if (ventaMode === 'sem') return a.sw ?? a.s;   // semuds (campo sw)
  if (ventaMode === 'ano') return a.sa ?? a.s;   // anouds (campo sa)
  return a.s;                                     // antuds / mes (por defecto)
}

// Labels según modo
const VENTA_LABELS = { mes: 'Vta/mes', sem: 'Vta/sem', ano: 'Vta/año' };
const VMIN_LABELS  = { mes: 'Venta mín (uds/mes)', sem: 'Venta mín (uds/sem)', ano: 'Venta mín (uds/año)' };

// Clave de campo real según modo activo
function ventaKey() {
  if (ventaMode === 'sem') return 'sw';
  if (ventaMode === 'ano') return 'sa';
  return 's';
}

function setVentaMode(mode) {
  ventaMode = mode;
  const lbl = document.getElementById('fVminLabel');
  if (lbl) lbl.textContent = VMIN_LABELS[mode] || VMIN_LABELS.mes;
  // Resetear ordenación a la columna de ventas del modo activo
  const k = ventaKey();
  sortK = k; sortD = 'd';
  sortStates.arts = { k, d: 'd' };
  filterArts();
}

let _activeArtsCard = null;

const LOC_LABELS  = { '':'Todos', con:'Con picking (alguno)', sin:'Sin picking (ninguno)', central:'Picking Central', aux:'Picking Auxiliar', ambos:'En ambos' };
const SURT_LABELS = { '':'Todos', S:'En surtido', NS:'Fuera surtido' };
const MODE_LABELS = { mes:'Mensual', sem:'Semanal', ano:'Anual' };
const REPO_LABELS = { muy_alta:'Repo muy alta', alta:'Repo alta', media:'Repo media', optima:'Repo óptima' };

// Función única de filtrado — usada tanto por filterArts como por el conteo de tarjetas
function computeArts(f) {
  const vKey = f.ventaMode === 'sem' ? 'sw' : f.ventaMode === 'ano' ? 'sa' : 's';
  const vmin = f.vmin || 0;
  return ARTS.filter(a => {
    const vta = a[vKey] || 0;
    if (vta < vmin)                              return false;
    if (f.loc === 'con'     && !a.lc && !a.la)  return false;
    if (f.loc === 'sin'     && (a.lc || a.la))  return false;
    if (f.loc === 'central' && (!a.lc || a.la)) return false;
    if (f.loc === 'aux'     && (!a.la || a.lc)) return false;
    if (f.loc === 'ambos'   && !(a.lc && a.la)) return false;
    if (f.surt && a.a !== f.surt)               return false;
    if (f.vol  && a.wc !== f.vol)               return false;
    if (f.peso && a.pc !== f.peso)              return false;
    if (f.repo) {
      const mx = (a.mx || 0) + (a.mxa || 0);
      if (!mx) return false;
      const pct = mx / (vta || 1);
      if (f.repo === 'muy_alta' && pct >= 0.25) return false;
      if (f.repo === 'alta'     && pct >= 0.50) return false;
      if (f.repo === 'media'    && pct >= 0.75) return false;
      if (f.repo === 'optima'   && pct <  1.00) return false;
    }
    return true;
  });
}

function renderArtsCards() {
  const cards = CFG.artsCards || [];
  const addBtn = cards.length < 10
    ? `<div class="card card-add" onclick="openAddArtsCard()" title="Nueva tarjeta">＋</div>` : '';
  const el = document.getElementById('artsCards');
  if (!el) return;
  el.innerHTML = cards.map(c => {
    const f = c.filters;
    const count = computeArts(f).length;
    const chips = [];
    if (f.vmin)      chips.push(`≥${f.vmin} ${MODE_LABELS[f.ventaMode]||'Mensual'}`);
    if (f.loc)       chips.push(LOC_LABELS[f.loc] || f.loc);
    if (f.surt)      chips.push(SURT_LABELS[f.surt] || f.surt);
    if (f.vol)       chips.push(f.vol);
    if (f.peso)      chips.push(f.peso);
    if (f.repo)      chips.push(REPO_LABELS[f.repo] || f.repo);
    const isAct = _activeArtsCard === c.id;
    return `<div class="card card-click${isAct?' act-card':''}" onclick="applyArtsCard('${c.id}')">
      <div class="clbl">${c.icon||''} ${c.name}</div>
      <div class="cval" style="color:var(--b2)">${count}</div>
      <div class="csub">${chips.join(' · ') || 'Todos los artículos'}</div>
      <button class="card-del-btn" onclick="event.stopPropagation();deleteArtsCard('${c.id}')">🗑</button>
    </div>`;
  }).join('') + addBtn;
}

function openAddArtsCard() {
  const f = {
    vmin: parseFloat(document.getElementById('fVmin')?.value) || 0,
    ventaMode,
    loc:  document.getElementById('fLoc2')?.value  || '',
    surt: document.getElementById('fSurt')?.value  || '',
    repo: document.getElementById('fRepo')?.value  || '',
    vol:  document.getElementById('fVol')?.value   || '',
    peso: document.getElementById('fPeso')?.value  || '',
  };
  const dup = (CFG.artsCards || []).find(c =>
    c.filters.vmin      === f.vmin &&
    c.filters.ventaMode === f.ventaMode &&
    c.filters.loc       === f.loc &&
    c.filters.surt      === f.surt &&
    c.filters.repo      === f.repo &&
    c.filters.vol       === f.vol &&
    c.filters.peso      === f.peso
  );
  if (dup) { showToast(`Ya existe "${dup.name}" con estos filtros`); return; }
  _cardMode  = 'arts';
  _lcardIcon = _LCARD_ICONS[0];
  document.getElementById('lcardName').value = '';
  document.getElementById('lcardIcons').innerHTML = _LCARD_ICONS.map(ic =>
    `<button class="lcard-icon-btn${ic === _lcardIcon ? ' sel' : ''}" onclick="selectLcardIcon('${ic}')">${ic}</button>`
  ).join('');
  document.getElementById('libreCardModal').style.display = 'flex';
}

function deleteArtsCard(id) {
  showConfirm('¿Eliminar esta tarjeta?', () => {
    CFG.artsCards = (CFG.artsCards || []).filter(c => c.id !== id);
    if (_activeArtsCard === id) _activeArtsCard = null;
    savePreferences(selectedStore, 'arts', CFG);
    renderArtsCards();
  });
}

function applyArtsCard(id) {
  const c = (CFG.artsCards || []).find(x => x.id === id);
  if (!c) return;
  _activeArtsCard = id;
  const f = c.filters;
  const vminEl = document.getElementById('fVmin');
  if (vminEl) vminEl.value = f.vmin || 0;
  setCselValue('fLoc2',      f.loc  || '');
  setCselValue('fSurt',      f.surt || '');
  setCselValue('fRepo',      f.repo || '');
  setCselValue('fVol',       f.vol  || '');
  setCselValue('fPeso',      f.peso || '');
  setCselValue('fVentaMode', f.ventaMode || 'mes');
  ventaMode = f.ventaMode || 'mes';
  const lbl = document.getElementById('fVminLabel');
  if (lbl) lbl.textContent = VMIN_LABELS[ventaMode] || VMIN_LABELS.mes;
  filterArts();
}

function filterArts() {
  const q = (document.getElementById('sbox') || { value: '' }).value.toLowerCase();
  const f = {
    vmin:      parseFloat(document.getElementById('fVmin')?.value) || 0,
    ventaMode,
    loc:       document.getElementById('fLoc2')?.value  || '',
    surt:      document.getElementById('fSurt')?.value  || '',
    repo:      document.getElementById('fRepo')?.value  || '',
    vol:       document.getElementById('fVol')?.value   || '',
    peso:      document.getElementById('fPeso')?.value  || '',
  };
  filteredArts = computeArts(f).filter(a =>
    !q || matchTerms(q, [a.i, a.d, a.lc, a.la])
  );

  sortArtsData();
  curPage = 1;
  renderArtsCards();
  renderArtsTable();
}

function sortArtsData() {
  filteredArts = sortArrBy(filteredArts, sortK, sortD);
}

function renderArtsTable() {
  const total = filteredArts.length;
  const pages = Math.ceil(total / PAGE) || 1;
  const slice = filteredArts.slice((curPage - 1) * PAGE, curPage * PAGE);

  document.getElementById('rowcnt').textContent = total.toLocaleString() + ' artículos';

  const fmtDate = d => d ? d.toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit', year:'2-digit' }) : '—';

  const rows = slice.map(a => {
    const vta = ventaVal(a);
    const locC = a.lc
      ? `<span style="color:var(--b2)">${a.lc}</span> <span style="font-size:9px;color:var(--mu)">${a.mx || '—'}/${a.mn || '—'}</span>`
      : `<span style="color:var(--mu);font-style:italic">—</span>`;
    const locA = a.la
      ? `<span style="color:var(--aux-lbl)">${a.la}</span> <span style="font-size:9px;color:var(--mu)">${a.mxa || '—'}/${a.mna || '—'}</span>`
      : `<span style="color:var(--mu);font-style:italic">—</span>`;

    // Inicio venta — destacar novedades (< 90 días) sin localización
    const hoy     = new Date();
    const esNuevo = a.ss && !a.lc && !a.la && (hoy - a.ss) < 90 * 86400000;
    const ssStr   = a.ss
      ? `<span style="color:${esNuevo ? 'var(--gn)' : 'var(--tx)'};font-weight:${esNuevo ? '700' : '400'}">${fmtDate(a.ss)}${esNuevo ? ' 🆕' : ''}</span>`
      : `<span style="color:var(--mu)">—</span>`;

    // Fin venta — destacar próximos a caducar (< 60 días) en naranja
    const proxFin  = a.es && (a.es - hoy) < 60 * 86400000 && a.es > hoy;
    const caducado = a.es && a.es < hoy;
    const esStr    = a.es
      ? `<span style="color:${caducado ? 'var(--mu)' : proxFin ? 'var(--or)' : 'var(--tx)'}">${fmtDate(a.es)}</span>`
      : `<span style="color:var(--mu)">—</span>`;

    return `<tr class="row-clickable" onclick="openArtDetail('${a.i}')">
      <td style="color:var(--b2);font-weight:600">${a.i}</td>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis">${a.d}</td>
      <td><span class="badge ${a.a === 'S' ? 'b-gn' : a.a === 'NS' ? 'b-gy' : 'b-bl'}">${a.a || '—'}</span></td>
      <td style="font-weight:700;color:${vta >= CFG.rotacion ? 'var(--gn)' : vta > 0 ? 'var(--tx)' : 'var(--mu)'}">${vta}</td>
      <td>${a.pl}</td>
      <td><span class="badge ${wcls(a.wc)}">${a.wc}</span></td>
      <td><span class="badge ${pcls_w(a.pc)}">${a.pc}</span></td>
      <td style="color:var(--mu);font-size:11px">${a.pe > 0 ? a.pe + ' kg' : '—'}</td>
      <td>${a.vo > 0 ? a.vo + ' dm³' : '—'}</td>
      <td>${a.md || '<span style="color:var(--rd)">⚠ 0</span>'}</td>
      <td>${locC}</td>
      <td>${locA}</td>
      <td>${ssStr}</td>
      <td>${esStr}</td>
    </tr>`;
  }).join('');

  const vtaLabel = VENTA_LABELS[ventaMode] || 'Vta/mes';
  document.getElementById('artsTbl').innerHTML = `<table>
    <thead><tr>
      ${th('arts','i','Código')}${th('arts','d','Descripción')}${th('arts','a','Surtido')}${th('arts', ventaKey(), vtaLabel)}
      ${th('arts','pl','Pallet')}${th('arts','wc','Volumen')}${th('arts','pc','Peso')}${th('arts','pe','kg')}${th('arts','vo','Vol')}${th('arts','md','MDQ')}
      ${th('arts','lc','Loc Central (max/min)')}${th('arts','la','Loc Aux1 (max/min)')}
      ${th('arts','ss','Inicio venta')}${th('arts','es','Fin venta')}
    </tr></thead>
    <tbody>${rows || '<tr><td colspan="13" style="text-align:center;color:var(--mu);padding:28px">Sin resultados</td></tr>'}</tbody>
  </table>`;

  document.getElementById('pagInfo').textContent = `Pág. ${curPage}/${pages} · ${total.toLocaleString()}`;

  // Botones de paginación
  const btns = document.getElementById('pagBtns');
  btns.innerHTML = '';
  const add = (lbl, pg, dis, act) => {
    const b = document.createElement('button');
    b.className   = 'pbtn' + (act ? ' act' : '');
    b.textContent = lbl;
    b.disabled    = dis;
    b.onclick     = () => { curPage = pg; renderArtsTable(); };
    btns.appendChild(b);
  };
  add('«', 1,          curPage === 1,     false);
  add('‹', curPage - 1, curPage === 1,     false);
  for (let pg = Math.max(1, curPage - 2); pg <= Math.min(pages, curPage + 2); pg++)
    add(pg, pg, false, pg === curPage);
  add('›', curPage + 1, curPage === pages, false);
  add('»', pages,       curPage === pages, false);
}

function resetFilters() {
  ['fVmin', 'fLoc2', 'fSurt', 'fRepo', 'fVol', 'fPeso', 'sbox', 'fVentaMode'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === 'fVmin') el.value = '0';
    else if (id === 'fVentaMode') el.value = 'mes';
    else el.value = '';
  });
  ventaMode = 'mes';
  const lbl = document.getElementById('fVminLabel');
  if (lbl) lbl.textContent = VMIN_LABELS.mes;
  filteredArts = [...ARTS];
  sortArtsData();
  curPage = 1;
  renderArtsTable();
}

function exportArts() {
  const fmtDate = d => d ? d.toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit', year:'2-digit' }) : '';
  const vtaLabel = VENTA_LABELS[ventaMode] || 'Vta/mes';
  const hdr  = ['Código','Descripción','Surtido', vtaLabel,'Pallet','Volumen','Clase peso','Peso kg','Vol dm3',
                 'MDQ','Loc Central','Max Central','Min Central','Loc Aux1','Max Aux1','Min Aux1','Inicio venta','Fin venta'];
  const rows = filteredArts.map(a => [a.i, a.d, a.a, ventaVal(a), a.pl, a.wc, a.pc, a.pe, a.vo, a.md,
                                       a.lc, a.mx, a.mn, a.la, a.mxa, a.mna, fmtDate(a.ss), fmtDate(a.es)]);
  csvDownload('wms_articulos', hdr, rows);
}


// ── REVISAR LOCALIZACIÓN ─────────────────────────────────────────

let _activePesadosCard = null;

function computePesados(almacen, pesoMin, rotMin) {
  return HEAVY.filter(b => {
    if (almacen && b.almacen !== almacen) return false;
    if (pesoMin  && b.pe < pesoMin)       return false;
    if (rotMin   && b.s  < rotMin)        return false;
    return true;
  });
}

function setPesadosAlmacen(val)  { pesadosAlmacen = val;           _activePesadosCard = null; renderPesados(); }
function setPesadosPesoMin(val)  { pesadosPesoMin = Number(val)||0; _activePesadosCard = null; renderPesados(); }
function setPesadosRotMin(val)   { pesadosRotMin  = Number(val)||0; _activePesadosCard = null; renderPesados(); }

function filterPesados(q) {
  pesadosSearch = (q || '').trim().toLowerCase();
  renderPesadosTable();
}

function renderPesadosCards() {
  const cards = CFG.pesadosCards || [];
  const addBtn = cards.length < 10
    ? `<div class="card card-add" onclick="openAddPesadosCard()" title="Nueva tarjeta">＋</div>` : '';
  document.getElementById('pesadosCards').innerHTML =
    cards.map(c => {
      const data = computePesados(c.filters.almacen, c.filters.pesoMin, c.filters.rotMin);
      const pk   = data.filter(b => b.lt === 'picking').length;
      const isAct = _activePesadosCard === c.id;
      const chips = [];
      if (c.filters.almacen) chips.push(c.filters.almacen === 'CENTRAL' ? 'Central' : 'Aux1');
      if (c.filters.pesoMin) chips.push(`≥${c.filters.pesoMin}kg`);
      if (c.filters.rotMin)  chips.push(`≥${c.filters.rotMin}/mes`);
      return `<div class="card card-click${isAct ? ' act-card' : ''}" onclick="applyPesadosCard('${c.id}')">
        <div class="clbl">${c.icon || ''} ${c.name}</div>
        <div class="cval" style="color:var(--or)">${data.length}</div>
        <div class="csub">${chips.length ? chips.join(' · ') : `>${CFG.pesado}kg sin suelo`} · ${pk} picking</div>
        <button class="card-del-btn" onclick="event.stopPropagation();deletePesadosCard('${c.id}')">🗑</button>
      </div>`;
    }).join('') + addBtn;
}

function openAddPesadosCard() {
  const dup = (CFG.pesadosCards || []).find(c =>
    c.filters.almacen === pesadosAlmacen &&
    c.filters.pesoMin === pesadosPesoMin &&
    c.filters.rotMin  === pesadosRotMin
  );
  if (dup) { showToast(`Ya existe "${dup.name}" con estos filtros`); return; }
  _cardMode  = 'pesados';
  _lcardIcon = _LCARD_ICONS[0];
  document.getElementById('lcardName').value = '';
  document.getElementById('lcardIcons').innerHTML = _LCARD_ICONS.map(ic =>
    `<button class="lcard-icon-btn${ic === _lcardIcon ? ' sel' : ''}" onclick="selectLcardIcon('${ic}')">${ic}</button>`
  ).join('');
  document.getElementById('libreCardModal').style.display = 'flex';
}

function deletePesadosCard(id) {
  showConfirm('¿Eliminar esta tarjeta?', () => {
    CFG.pesadosCards = (CFG.pesadosCards || []).filter(c => c.id !== id);
    if (_activePesadosCard === id) _activePesadosCard = null;
    savePreferences(selectedStore, 'pesados', CFG);
    renderPesadosCards();
  });
}

function _syncPesadosUI() {
  setCselValue('pesadosAlmacenSel', pesadosAlmacen);
  // slider de peso
  const rng = document.getElementById('pesadosPesoRange');
  const val = document.getElementById('pesadosPesoVal');
  const lbl = document.getElementById('pesadosPesoCselVal');
  if (rng) { rng.value = pesadosPesoMin; rng.style.setProperty('--pct', (pesadosPesoMin / 60 * 100) + '%'); }
  if (val) val.textContent = pesadosPesoMin + ' kg';
  if (lbl) lbl.textContent = pesadosPesoMin > 0 ? '≥' + pesadosPesoMin + ' kg' : '0 kg (sin filtro)';
  // input de rotación
  const rotInp = document.getElementById('pesadosRotInput');
  if (rotInp) rotInp.value = pesadosRotMin || '';
}

function applyPesadosCard(id) {
  const c = (CFG.pesadosCards || []).find(x => x.id === id);
  if (!c) return;
  _activePesadosCard = id;
  pesadosAlmacen = c.filters.almacen || '';
  pesadosPesoMin = c.filters.pesoMin || 0;
  pesadosRotMin  = c.filters.rotMin  || 0;
  _syncPesadosUI();
  renderPesadosCards();
  renderPesadosTable();
}

function renderPesados() {
  renderPesadosCards();

  if (!document.getElementById('pesadosSearchInput')) {
    document.getElementById('pesadosToolbar').innerHTML = `
      <input class="sbox" id="pesadosSearchInput" type="text"
        placeholder="Buscar artículo, código, localización..."
        oninput="filterPesados(this.value)">
      <span class="rowcnt-lbl" id="pesadosCount"></span>
      <button class="btn-exp" onclick="exportPesados()">↓ CSV</button>`;
  }

  renderPesadosTable();
}

function renderPesadosTable() {
  const base = computePesados(pesadosAlmacen, pesadosPesoMin, pesadosRotMin);

  const filtered = pesadosSearch
    ? sortArrBy(base, sortStates.pesados.k, sortStates.pesados.d)
        .filter(b => matchTerms(pesadosSearch, [b.i, b.d, b.loc]))
    : sortArrBy(base, sortStates.pesados.k, sortStates.pesados.d);

  const cnt = document.getElementById('pesadosCount');
  if (cnt) cnt.textContent = filtered.length.toLocaleString() + ' registros';

  const rows = filtered.map(b => `<tr class="row-clickable" onclick="openArtDetail('${b.i}')">
    <td style="color:${b.almacen === 'AUXILIAR1' ? 'var(--aux-lbl)' : 'var(--b2)'};font-weight:600">${b.loc}</td>
    <td><span class="badge ${b.almacen === 'AUXILIAR1' ? 'b-pu' : 'b-bl'}">${b.almacen === 'AUXILIAR1' ? 'Aux1' : 'Central'}</span></td>
    <td><span class="badge ${b.lt === 'picking' ? 'b-yw' : 'b-or'}">${b.lt}</span></td>
    <td>${b.i}</td>
    <td style="max-width:190px;overflow:hidden;text-overflow:ellipsis">${b.d}</td>
    <td style="color:var(--or);font-weight:700">${b.pe} kg</td>
    <td style="color:${b.s >= CFG.rotacion ? 'var(--gn)' : 'var(--tx)'};font-weight:700">${b.s}</td>
    <td><span class="badge b-or">Mover a .0.0</span></td>
  </tr>`).join('');

  document.getElementById('pesadosTbl').innerHTML = `<table>
    <thead><tr>
      ${th('pesados','loc','Localización')}${th('pesados','almacen','Almacén')}${th('pesados','lt','Tipo')}${th('pesados','i','Artículo')}
      ${th('pesados','d','Descripción')}${th('pesados','pe','Peso')}${th('pesados','s','Vta/mes')}<th>Acción</th>
    </tr></thead>
    <tbody>${rows || '<tr><td colspan="8" style="text-align:center;color:var(--gn);padding:28px">✓ Sin localizaciones a revisar</td></tr>'}</tbody>
  </table>`;
}


// ── PICKING LIBRE / ESPACIO DISPONIBLE ───────────────────────────

// Filtra LIBRE_ALL según umbral, almacén y tipo de posición.
// type: '' | 'picking' | 'suelo' | 'suelo-pallet' (suelo con al menos 1 pallet libre)
function computeLibre(threshold, almacen, type) {
  const maxUsedPct = 100 - threshold;
  return LIBRE_ALL.filter(l => {
    if (almacen && l.almacen !== almacen) return false;
    if (type === 'suelo-pallet') {
      if (l.lt !== 'suelo' || !(l.palletsFree > 0)) return false;
    } else if (type) {
      if (l.lt !== type) return false;
    }
    if (l.pctUsado === null) return !l.arts.length;
    return l.pctUsado <= maxUsedPct;
  });
}

function setFreeThreshold(val) {
  freeThreshold = parseInt(val);
  _activeLibreCard = null;
  renderLibre();
}

function setFreeAlmacen(val) {
  freeAlmacen = val;
  _activeLibreCard = null;
  renderLibre();
}

function setFreeType(val) {
  freeType = val;
  _activeLibreCard = null;
  renderLibre();
}

function setFreePalet(val) {
  freePalet = val;
  _activeLibreCard = null;
  // ponytail: freePalet no filtra aún — dato no disponible en LIBRE_ALL
  renderLibreCards();
}

function filterLibre(q) {
  libreSearch = (q || '').trim().toLowerCase();
  renderLibreTable();
}

// ── Helpers de UI: toast y confirm modal ─────────────────────────
let _confirmCallback = null;
let _toastTimer      = null;

function showToast(msg) {
  const toast = document.getElementById('appToast');
  toast.querySelector('.app-toast-inner').textContent = msg;
  toast.style.display = 'block';
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { toast.style.display = 'none'; }, 3500);
}

function showConfirm(msg, onConfirm, title = '¿Eliminar?') {
  document.getElementById('appConfirmTitle').textContent = title;
  document.getElementById('appConfirmMsg').textContent   = msg;
  _confirmCallback = onConfirm;
  const ok = document.getElementById('appConfirmOk');
  ok.onclick = () => { closeAppConfirm(); onConfirm(); };
  document.getElementById('appConfirm').style.display = 'flex';
}

function closeAppConfirm() {
  document.getElementById('appConfirm').style.display = 'none';
  _confirmCallback = null;
}

// ── Estado local de tarjetas personalizadas ──────────────────────
let _activeLibreCard = null;
let _lcardIcon       = '📦';

const _LCARD_ICONS = ['📦','🏷️','🟢','🔵','🟡','🟠','🔴','⭐','🏆','📊','🔍','🚀','⚡','🎯','📋','🧊'];

function renderLibreCards() {
  const cards = (CFG.libreCards || []).map(card => {
    const f     = card.filters;
    const count = computeLibre(f.threshold, f.almacen, f.type).length;
    const chips = [`≥${f.threshold}% libre`];
    if (f.almacen) chips.push(f.almacen === 'AUXILIAR1' ? 'Aux1' : 'Central');
    if (f.type)    chips.push(f.type === 'suelo-pallet' ? 'Suelo + pallet libre' : f.type);
    if (f.palet)   chips.push(f.palet);
    const isAct = _activeLibreCard === card.id;
    return `<div class="card card-click${isAct ? ' act-card' : ''}" style="position:relative" onclick="applyLibreCard('${card.id}')">
      <button class="card-del-btn" title="Eliminar tarjeta" onclick="event.stopPropagation();deleteLibreCard('${card.id}')">×</button>
      <div class="clbl">${card.icon} ${card.name}</div>
      <div class="cval" style="color:var(--gn)">${count}</div>
      <div class="csub">${chips.join(' · ')}</div>
    </div>`;
  }).join('');

  const addBtn = (CFG.libreCards || []).length < 10
    ? `<div class="card-add" onclick="openAddLibreCard()"><div>+</div><div style="font-size:11px;margin-top:3px">Nueva tarjeta</div></div>`
    : '';
  document.getElementById('libreCards').innerHTML = cards + addBtn;
}

function renderLibre() {
  renderLibreCards();
  if (!document.getElementById('libreSearchInput')) {
    document.getElementById('libreToolbar').innerHTML = `
      <input class="sbox" id="libreSearchInput" type="text"
        placeholder="Buscar localización, almacén, tipo..."
        oninput="filterLibre(this.value)">
      <span class="rowcnt-lbl" id="libreCount"></span>
      <button class="btn-exp" onclick="exportLibre()">↓ CSV</button>`;
  }
  renderLibreTable();
}

// ── Tarjetas personalizadas: crear, aplicar, eliminar ────────────

function openAddLibreCard() {
  const current = { threshold: freeThreshold, almacen: freeAlmacen, type: freeType, palet: freePalet };
  const dup = (CFG.libreCards || []).find(c =>
    c.filters.threshold === current.threshold &&
    c.filters.almacen   === current.almacen   &&
    c.filters.type      === current.type      &&
    c.filters.palet     === current.palet
  );
  if (dup) {
    showToast(`Ya existe una tarjeta con estos filtros: "${dup.icon} ${dup.name}"`);
    return;
  }
  _lcardIcon = _LCARD_ICONS[0];
  document.getElementById('lcardName').value = '';
  document.getElementById('lcardIcons').innerHTML = _LCARD_ICONS.map(ic =>
    `<button class="lcard-icon-btn${ic === _lcardIcon ? ' sel' : ''}" onclick="selectLcardIcon('${ic}')">${ic}</button>`
  ).join('');
  document.getElementById('libreCardModal').style.display = 'flex';
  setTimeout(() => document.getElementById('lcardName').focus(), 50);
}

function selectLcardIcon(icon) {
  _lcardIcon = icon;
  document.querySelectorAll('.lcard-icon-btn').forEach(b =>
    b.classList.toggle('sel', b.textContent === icon)
  );
}

function closeLibreCardModal() {
  document.getElementById('libreCardModal').style.display = 'none';
}

function confirmLibreCard() {
  const name = (document.getElementById('lcardName').value || '').trim();
  if (!name) { document.getElementById('lcardName').focus(); return; }
  const id = Date.now().toString();
  if (_cardMode === 'bye') {
    CFG.byeCards = [...(CFG.byeCards || []), {
      id, name, icon: _lcardIcon,
      filters: { almacen: byeAlmacen, stock: byeStock, pv: byePV, dateFrom: byeDateFrom, dateTo: byeDateTo }
    }];
    savePreferences(selectedStore, 'bye', CFG);
    closeLibreCardModal(); renderByeCards();
  } else if (_cardMode === 'arts') {
    CFG.artsCards = [...(CFG.artsCards || []), {
      id, name, icon: _lcardIcon,
      filters: {
        vmin: parseFloat(document.getElementById('fVmin')?.value) || 0,
        ventaMode,
        loc:  document.getElementById('fLoc2')?.value  || '',
        surt: document.getElementById('fSurt')?.value  || '',
        repo: document.getElementById('fRepo')?.value  || '',
        vol:  document.getElementById('fVol')?.value   || '',
        peso: document.getElementById('fPeso')?.value  || '',
      }
    }];
    savePreferences(selectedStore, 'arts', CFG);
    closeLibreCardModal(); renderArtsCards();
  } else if (_cardMode === 'pesados') {
    CFG.pesadosCards = [...(CFG.pesadosCards || []), {
      id, name, icon: _lcardIcon,
      filters: { almacen: pesadosAlmacen, pesoMin: pesadosPesoMin, rotMin: pesadosRotMin }
    }];
    savePreferences(selectedStore, 'pesados', CFG);
    closeLibreCardModal(); renderPesadosCards();
  } else {
    CFG.libreCards = [...(CFG.libreCards || []), {
      id, name, icon: _lcardIcon,
      filters: { threshold: freeThreshold, almacen: freeAlmacen, type: freeType, palet: freePalet }
    }];
    savePreferences(selectedStore, 'libre', CFG);
    closeLibreCardModal(); renderLibreCards();
  }
}

function deleteLibreCard(id) {
  const card = (CFG.libreCards || []).find(c => c.id === id);
  if (!card) return;
  showConfirm(
    `Se eliminará "${card.icon} ${card.name}". Esta acción no se puede deshacer.`,
    () => {
      CFG.libreCards = (CFG.libreCards || []).filter(c => c.id !== id);
      if (_activeLibreCard === id) _activeLibreCard = null;
      savePreferences(selectedStore, 'libre', CFG);
      renderLibreCards();
    }
  );
}

function applyLibreCard(id) {
  const card = (CFG.libreCards || []).find(c => c.id === id);
  if (!card) return;
  const f      = card.filters;
  freeThreshold    = f.threshold;
  freeAlmacen      = f.almacen  || '';
  freeType         = f.type     || '';
  freePalet        = f.palet    || '';
  _activeLibreCard = id;
  // Sincronizar sidebar visualmente
  const _r  = document.getElementById('freeThresholdRange');
  const _v  = document.getElementById('freeThresholdVal');
  const _cv = document.getElementById('freeThresholdCselVal');
  if (_r)  { _r.value = f.threshold; _r.style.setProperty('--pct', f.threshold + '%'); }
  if (_v)  _v.textContent  = f.threshold + '%';
  if (_cv) _cv.textContent = f.threshold + '% libre';
  setCselValue('freeAlmacenSel',   freeAlmacen);
  setCselValue('freeTypeSel',      freeType);
  setCselValue('freePaletSel',     freePalet);
  renderLibre();
}

function renderLibreTable() {
  const list        = computeLibre(freeThreshold, freeAlmacen, freeType);
  const withDerived = list.map(f => ({ ...f, pctLibre: f.pctUsado === null ? null : 100 - f.pctUsado }));

  const filtered = libreSearch
    ? withDerived.filter(f => matchTerms(libreSearch, [f.c, f.almacen, f.lt]))
    : withDerived;

  const cnt = document.getElementById('libreCount');
  if (cnt) cnt.textContent = filtered.length.toLocaleString() + ' registros';

  const rows = sortArrBy(filtered, sortStates.libre.k, sortStates.libre.d)
    .map(f => {
      const vacio   = !f.arts.length;
      const pctU    = f.pctUsado === null ? null : Math.round(f.pctUsado);
      const pctL    = f.pctLibre === null ? null : Math.round(f.pctLibre);
      const pctUTxt = pctU === null ? '—' : pctU + '%';
      const pctLTxt = pctL === null ? '—' : pctL + '%';
      const volTxt  = f.volOcup === null ? '—' : Math.round(f.volOcup) + ' dm³';
      const capTxt  = f.capDm3  === null ? '—' : Math.round(f.capDm3)  + ' dm³';
      const palletTxt = f.lt === 'suelo' && f.palletsFree !== null
        ? (f.palletsFree > 0
            ? `<span class="badge b-teal">🟦 ${f.palletsFree}/${PALLETS_POR_SUELO} libres</span>`
            : `<span class="badge b-gy">0/${PALLETS_POR_SUELO}</span>`)
        : '—';
      const estado  = vacio
        ? '<span class="badge b-gn">✓ Vacío</span>'
        : `<span class="badge b-bl">◐ ${f.arts.length} art. · ${pctLTxt} libre</span>`;
      return `<tr class="row-clickable" onclick="openShelfFromView('libre',${f.p},${f.e},'${f.almacen}')">
        <td style="color:${f.almacen === 'AUXILIAR1' ? 'var(--aux-lbl)' : 'var(--b2)'};font-weight:600">${f.c}</td>
        <td><span class="badge ${f.almacen === 'AUXILIAR1' ? 'b-pu' : 'b-bl'}">${f.almacen === 'AUXILIAR1' ? 'Aux1' : 'Central'}</span></td>
        <td>P${f.p}</td>
        <td>E${f.e}</td>
        <td><span class="badge ${f.lt === 'suelo' ? 'b-bl' : 'b-gn'}">${f.lt}</span></td>
        <td>${capTxt}</td>
        <td>${volTxt}</td>
        <td style="font-weight:700;color:${pctU !== null && pctU > 0 ? 'var(--tx)' : 'var(--mu)'}">${pctUTxt}</td>
        <td style="font-weight:700;color:var(--gn)">${pctLTxt}</td>
        <td>${palletTxt}</td>
        <td>${estado}</td>
      </tr>`;
    }).join('');

  document.getElementById('libreTbl').innerHTML = `<table>
    <thead><tr>
      ${th('libre','c','Localización')}${th('libre','almacen','Almacén')}${th('libre','p','Pasillo')}${th('libre','e','Estantería')}
      ${th('libre','lt','Tipo')}${th('libre','capDm3','Cap. (dm³)')}${th('libre','volOcup','Vol. ocupado (máx repos.)')}
      ${th('libre','pctUsado','% Ocupado<span class="help-ico left-align" data-tip="Volumen que ocuparían los artículos de esa posición si estuvieran repuestos al máximo, respecto a la capacidad real de la localización." onclick="event.stopPropagation()">?</span>')}${th('libre','pctLibre','% Libre')}${th('libre','palletsFree','Pallets libres')}<th>Estado</th>
    </tr></thead>
    <tbody>${rows || '<tr><td colspan="11" style="text-align:center;color:var(--mu);padding:28px">Sin ubicaciones con espacio disponible para este umbral</td></tr>'}</tbody>
  </table>`;
}


// ── BYE BYE (artículos NS con localización asignada) ─────────────

function fmtDate(d) {
  if (!d) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function resolveDateSentinel(val) {
  if (!val) return null;
  const d = new Date();
  if (val === 'TODAY-1') { d.setDate(d.getDate() - 1); return d; }
  if (val === 'TODAY+1') { d.setDate(d.getDate() + 1); return d; }
  if (val === 'TODAY')   { return d; }
  return new Date(val);
}

function _updateByeDateBtns() {
  const map = { 'From': { ayer:'byeFromAyer', man:'byeFromManana', val: byeDateFrom },
                'To':   { ayer:'byeToAyer',   man:'byeToManana',   val: byeDateTo   }};
  Object.values(map).forEach(({ ayer, man, val }) => {
    document.getElementById(ayer)?.classList.toggle('btn-fecha-act', val === 'TODAY-1');
    document.getElementById(man) ?.classList.toggle('btn-fecha-act', val === 'TODAY+1');
  });
}

function _showSentinelLabel(which, sentinel) {
  const label = sentinel === 'TODAY-1' ? 'Ayer' : 'Mañana';
  document.getElementById('bye' + which + 'Input').style.display      = 'none';
  document.getElementById('bye' + which + 'Label').style.display      = 'flex';
  document.getElementById('bye' + which + 'LabelText').textContent    = label;
}

function clearByeDate(which) {
  if (which === 'From') { byeDateFrom = ''; } else { byeDateTo = ''; }
  const input = document.getElementById('bye' + which + 'Input');
  const lbl   = document.getElementById('bye' + which + 'Label');
  if (input) { input.style.display = ''; input.value = ''; }
  if (lbl)   lbl.style.display = 'none';
  _activeByeCard = null;
  _updateByeDateBtns();
  renderBye();
}

function setByeDate(which, sentinel) {
  if (which === 'From') { byeDateFrom = sentinel; } else { byeDateTo = sentinel; }
  _showSentinelLabel(which, sentinel);
  _activeByeCard = null;
  _updateByeDateBtns();
  renderBye();
}

function computeBye(almacen, stock, pv, dateFrom, dateTo) {
  const from = resolveDateSentinel(dateFrom);
  const to   = resolveDateSentinel(dateTo);
  return BYE.filter(b => {
    if (almacen && b.almacen !== almacen) return false;
    if (stock === 'con' && !(b.st > 0))   return false;
    if (stock === 'sin' &&   b.st > 0)    return false;
    if (pv    === 'con' && !(b.pv > 0))   return false;
    if (pv    === 'sin' &&   b.pv > 0)    return false;
    if (from && b.endsale && b.endsale < from) return false;
    if (to   && b.endsale) {
      const toEnd = new Date(to); toEnd.setHours(23, 59, 59);
      if (b.endsale > toEnd) return false;
    }
    return true;
  });
}

function setByeAlmacen(val) { byeAlmacen = val; _activeByeCard = null; renderBye(); }
function setByeStock(val)   { byeStock   = val; _activeByeCard = null; renderBye(); }
function setByePV(val)      { byePV      = val; _activeByeCard = null; renderBye(); }
function setByeDateFrom(val) {
  byeDateFrom = val || '';
  document.getElementById('byeFromLabel').style.display = 'none';
  document.getElementById('byeFromInput').style.display = '';
  _activeByeCard = null; _updateByeDateBtns(); renderBye();
}
function setByeDateTo(val) {
  byeDateTo = val || '';
  document.getElementById('byeToLabel').style.display = 'none';
  document.getElementById('byeToInput').style.display = '';
  _activeByeCard = null; _updateByeDateBtns(); renderBye();
}

function filterBye(q) {
  byeSearch = (q || '').trim().toLowerCase();
  renderByeTable();
}

// ── Tarjetas personalizadas Bye ───────────────────────────────────
let _activeByeCard = null;
let _cardMode      = 'libre'; // 'libre' | 'bye' — controla qué guardar al confirmar modal

function renderByeCards() {
  const cards = (CFG.byeCards || []).map(card => {
    const f     = card.filters;
    const count = computeBye(f.almacen, f.stock, f.pv, f.dateFrom, f.dateTo).length;
    const chips = [];
    if (f.almacen)  chips.push(f.almacen === 'AUXILIAR1' ? 'Aux1' : 'Central');
    if (f.stock)    chips.push(f.stock === 'con' ? 'Con stock' : 'Sin stock');
    if (f.pv)       chips.push(f.pv    === 'con' ? 'Con PV'    : 'Sin PV');
    const dateLabel = v => v === 'TODAY-1' ? 'Ayer' : v === 'TODAY' ? 'Hoy' : v === 'TODAY+1' ? 'Mañana' : v.slice(5).split('-').reverse().join('/');
    if (f.dateFrom) chips.push('Desde ' + dateLabel(f.dateFrom));
    if (f.dateTo)   chips.push('Hasta ' + dateLabel(f.dateTo));
    if (!chips.length) chips.push('Todos');
    const isAct = _activeByeCard === card.id;
    return `<div class="card card-click${isAct ? ' act-card' : ''}" style="position:relative" onclick="applyByeCard('${card.id}')">
      <button class="card-del-btn" title="Eliminar tarjeta" onclick="event.stopPropagation();deleteByeCard('${card.id}')">×</button>
      <div class="clbl">${card.icon} ${card.name}</div>
      <div class="cval" style="color:var(--mu)">${count}</div>
      <div class="csub">${chips.join(' · ')}</div>
    </div>`;
  }).join('');

  const addBtn = (CFG.byeCards || []).length < 10
    ? `<div class="card-add" onclick="openAddByeCard()"><div>+</div><div style="font-size:11px;margin-top:3px">Nueva tarjeta</div></div>`
    : '';
  document.getElementById('byeCards').innerHTML = cards + addBtn;
}

function openAddByeCard() {
  const current = { almacen: byeAlmacen, stock: byeStock, pv: byePV, dateFrom: byeDateFrom, dateTo: byeDateTo };
  const dup = (CFG.byeCards || []).find(c =>
    c.filters.almacen   === current.almacen  &&
    c.filters.stock     === current.stock    &&
    c.filters.pv        === current.pv       &&
    c.filters.dateFrom  === current.dateFrom &&
    c.filters.dateTo    === current.dateTo
  );
  if (dup) { showToast(`Ya existe una tarjeta con estos filtros: "${dup.icon} ${dup.name}"`); return; }
  _cardMode  = 'bye';
  _lcardIcon = _LCARD_ICONS[0];
  document.getElementById('lcardName').value = '';
  document.getElementById('lcardIcons').innerHTML = _LCARD_ICONS.map(ic =>
    `<button class="lcard-icon-btn${ic === _lcardIcon ? ' sel' : ''}" onclick="selectLcardIcon('${ic}')">${ic}</button>`
  ).join('');
  document.getElementById('libreCardModal').style.display = 'flex';
  setTimeout(() => document.getElementById('lcardName').focus(), 50);
}

function deleteByeCard(id) {
  const card = (CFG.byeCards || []).find(c => c.id === id);
  if (!card) return;
  showConfirm(
    `Se eliminará "${card.icon} ${card.name}". Esta acción no se puede deshacer.`,
    () => {
      CFG.byeCards = (CFG.byeCards || []).filter(c => c.id !== id);
      if (_activeByeCard === id) _activeByeCard = null;
      savePreferences(selectedStore, 'bye', CFG);
      renderByeCards();
    }
  );
}

function applyByeCard(id) {
  const card = (CFG.byeCards || []).find(c => c.id === id);
  if (!card) return;
  const f      = card.filters;
  byeAlmacen   = f.almacen  || '';
  byeStock     = f.stock    || '';
  byePV        = f.pv       || '';
  byeDateFrom  = f.dateFrom || '';
  byeDateTo    = f.dateTo   || '';
  _activeByeCard = id;
  setCselValue('byeAlmacenSel', byeAlmacen);
  setCselValue('byeStockSel',   byeStock);
  setCselValue('byePVSel',      byePV);
  ['From','To'].forEach(which => {
    const val = which === 'From' ? byeDateFrom : byeDateTo;
    if (val === 'TODAY-1' || val === 'TODAY+1') {
      _showSentinelLabel(which, val);
    } else {
      const input = document.getElementById('bye' + which + 'Input');
      const lbl   = document.getElementById('bye' + which + 'Label');
      if (input) { input.style.display = ''; input.value = val || ''; }
      if (lbl)   lbl.style.display = 'none';
    }
  });
  _updateByeDateBtns();
  renderBye();
}

function renderBye() {
  renderByeCards();
  if (!document.getElementById('byeSearchInput')) {
    document.getElementById('byeToolbar').innerHTML = `
      <input class="sbox" id="byeSearchInput" type="text"
        placeholder="Buscar artículo, código, localización..."
        oninput="filterBye(this.value)">
      <span class="rowcnt-lbl" id="byeCount"></span>
      <button class="btn-exp" onclick="exportBye()">↓ CSV</button>`;
  }
  renderByeTable();
}

function renderByeTable() {
  let base = computeBye(byeAlmacen, byeStock, byePV, byeDateFrom, byeDateTo);

  const filtered = byeSearch
    ? base.filter(b => matchTerms(byeSearch, [b.i, b.d, b.loc]))
    : base;

  const cnt = document.getElementById('byeCount');
  if (cnt) cnt.textContent = filtered.length.toLocaleString() + ' registros';

  const sorted = sortArrBy(filtered, sortStates.bye.k, sortStates.bye.d);

  const rows = sorted.map(b => {
    const tieneStock = b.st > 0 || b.pv > 0;
    return `<tr class="row-clickable" onclick="openArtDetail('${b.i}')">
    <td style="color:${b.almacen === 'AUXILIAR1' ? 'var(--aux-lbl)' : 'var(--b2)'};font-weight:600">${b.loc}</td>
    <td><span class="badge ${b.almacen === 'AUXILIAR1' ? 'b-pu' : 'b-bl'}">${b.almacen === 'AUXILIAR1' ? 'Aux1' : 'Central'}</span></td>
    <td>${b.i}</td>
    <td style="max-width:170px;overflow:hidden;text-overflow:ellipsis">${b.d}</td>
    <td>${b.mx ?? '—'}</td>
    <td>${b.mn ?? '—'}</td>
    <td style="color:${b.s >= CFG.rotacion ? 'var(--gn)' : 'var(--tx)'}">${b.s}</td>
    <td style="color:${b.pe > CFG.pesado ? 'var(--or)' : 'var(--tx)'}">${b.pe > 0 ? b.pe + ' kg' : '—'}</td>
    <td style="font-weight:600;color:${b.st > 0 ? 'var(--b2)' : 'var(--mu)'}">${b.st > 0 ? b.st.toLocaleString() : '—'}</td>
    <td style="font-weight:600;color:${b.pv > 0 ? 'var(--or)' : 'var(--mu)'}">${b.pv > 0 ? b.pv.toLocaleString() : '—'}</td>
    <td style="color:var(--mu)">${fmtDate(b.startsale)}</td>
    <td style="font-weight:600;color:${b.endsale ? 'var(--or)' : 'var(--mu)'}">${fmtDate(b.endsale)}</td>
    <td>${tieneStock
      ? '<span class="badge b-or">Mantener</span>'
      : '<span class="badge b-gy">Liberar</span>'}</td>
  </tr>`;
  }).join('');

  document.getElementById('byeTbl').innerHTML = `<table>
    <thead><tr>
      ${th('bye','loc','Localización')}${th('bye','almacen','Almacén')}${th('bye','i','Artículo')}
      ${th('bye','d','Descripción')}${th('bye','mx','Max')}${th('bye','mn','Min')}
      ${th('bye','s','Vta/mes')}${th('bye','pe','Peso')}
      ${th('bye','st','Stock')}${th('bye','pv','PV')}
      ${th('bye','startsale','Inicio venta')}${th('bye','endsale','Fin venta')}<th>Acción</th>
    </tr></thead>
    <tbody>${rows || '<tr><td colspan="13" style="text-align:center;color:var(--gn);padding:28px">✓ Sin artículos NS con localización asignada</td></tr>'}</tbody>
  </table>`;
}


// ── EXPORTACIÓN CSV ───────────────────────────────────────────────

function csvDownload(filename, hdr, rows) {
  const csv  = [hdr, ...rows].map(r =>
    r.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(';')
  ).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = filename + '_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
}

function exportPesados() {
  let base = computePesados(pesadosAlmacen, pesadosPesoMin, pesadosRotMin);

  const hdr  = ['Localización','Almacén','Tipo','Artículo','Descripción','Peso kg','Vta/mes'];
  const rows = sortArrBy(base, sortStates.pesados.k, sortStates.pesados.d)
    .map(b => [b.loc, b.almacen, b.lt, b.i, b.d, b.pe, b.s]);
  csvDownload('wms_revisar', hdr, rows);
}

function exportLibre() {
  let base = computeLibre(freeThreshold, freeAlmacen, freeType);
  if (libreCardFilter === 'picking-c')    base = base.filter(f => f.lt === 'picking' && f.almacen === 'CENTRAL');
  if (libreCardFilter === 'suelo-c')      base = base.filter(f => f.lt === 'suelo'   && f.almacen === 'CENTRAL');
  if (libreCardFilter === 'picking-a')    base = base.filter(f => f.lt === 'picking' && f.almacen === 'AUXILIAR1');
  if (libreCardFilter === 'suelo-a')      base = base.filter(f => f.lt === 'suelo'   && f.almacen === 'AUXILIAR1');
  if (libreCardFilter === 'pallet-libre') base = base.filter(f => f.lt === 'suelo' && f.palletsFree > 0);

  const hdr  = ['Localización','Almacén','Pasillo','Estantería','Tipo','Cap. (dm³)','Vol. ocupado (dm³)','% Ocupado','% Libre','Pallets libres'];
  const rows = sortArrBy(base, sortStates.libre.k, sortStates.libre.d).map(f => {
    const pctU = f.pctUsado !== null && isFinite(f.pctUsado) ? Math.round(f.pctUsado) : '';
    const pctL = pctU !== '' ? 100 - pctU : '';
    return [f.c, f.almacen, f.p, f.e, f.lt,
            f.capDm3  ? Math.round(f.capDm3)  : '',
            f.volOcup ? Math.round(f.volOcup) : '',
            pctU, pctL,
            f.lt === 'suelo' && f.palletsFree !== null ? f.palletsFree + '/' + PALLETS_POR_SUELO : ''];
  });
  csvDownload('wms_libre', hdr, rows);
}

function exportBye() {
  let base = computeBye(byeAlmacen, byeStock, byePV, byeDateFrom, byeDateTo);

  const hdr  = ['Localización','Almacén','Artículo','Descripción','Max','Min','Vta/mes','Peso kg','Stock','PV','Fin venta'];
  const rows = sortArrBy(base, sortStates.bye.k, sortStates.bye.d)
    .map(b => [b.loc, b.almacen, b.i, b.d, b.mx, b.mn, b.s, b.pe, b.st, b.pv, fmtDate(b.endsale)]);
  csvDownload('wms_byebye', hdr, rows);
}
