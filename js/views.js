// ════════════════════════════════════════════════════════════════
// views.js — Renderizado de las vistas: Artículos, Revisar, Libre
// Depende de: state.js
// ════════════════════════════════════════════════════════════════


// ── HELPERS DE CLASIFICACIÓN ─────────────────────────────────────

function pcls(p) {
  return { CRÍTICA: 'b-rd', ALTA: 'b-rd', MEDIA: 'b-yw', OK: 'b-gn' }[p] || 'b-gy';
}
function wcls(w) {
  return { Voluminoso: 'b-rd', Mediano: 'b-yw', Pequeño: 'b-gn' }[w] || 'b-gy';
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

function setVentaMode(mode) {
  ventaMode = mode;
  // Actualizar label del filtro de venta mínima
  const lbl = document.getElementById('fVminLabel');
  if (lbl) lbl.textContent = VMIN_LABELS[mode] || VMIN_LABELS.mes;
  // Resetear ordenación a ventas descendente
  sortK = 's'; sortD = 'd';
  sortStates.arts = { k: 's', d: 'd' };
  filterArts();
}

function filterArts() {
  const q     = (document.getElementById('sbox')   || { value: '' }).value.toLowerCase();
  const vmin  = parseFloat((document.getElementById('fVmin')  || { value: 0 }).value) || 0;
  const fpe   = (document.getElementById('fPeso')  || { value: '' }).value;
  const floc  = (document.getElementById('fLoc2')  || { value: '' }).value;
  const fsurt = (document.getElementById('fSurt')  || { value: '' }).value;
  const fv    = (document.getElementById('fVista') || { value: '' }).value;

  filteredArts = ARTS.filter(a => {
    if (ventaVal(a) < vmin)                            return false;
    if (fpe   && a.wc !== fpe)                         return false;
    if (floc === 'con'     && !a.lc && !a.la)          return false;
    if (floc === 'sin'     && (a.lc || a.la))          return false;
    if (floc === 'central' && (!a.lc || a.la))         return false;
    if (floc === 'aux'     && (!a.la || a.lc))         return false;
    if (floc === 'ambos'   && !(a.lc && a.la))         return false;
    if (fsurt  && a.a !== fsurt)                       return false;
    if (fv === 'prio'   && !['CRÍTICA','ALTA'].includes(a.pr)) return false;
    if (q && !a.i.toLowerCase().includes(q)
          && !a.d.toLowerCase().includes(q)
          && !(a.lc || '').toLowerCase().includes(q)
          && !(a.la || '').toLowerCase().includes(q))  return false;
    return true;
  });

  sortArtsData();
  curPage = 1;
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

    return `<tr>
      <td style="color:var(--b2);font-weight:600">${a.i}</td>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis">${a.d}</td>
      <td><span class="badge ${a.a === 'S' ? 'b-gn' : a.a === 'NS' ? 'b-gy' : 'b-bl'}">${a.a || '—'}</span></td>
      <td style="font-weight:700;color:${vta >= CFG.rotacion ? 'var(--gn)' : vta > 0 ? 'var(--tx)' : 'var(--mu)'}">${vta}</td>
      <td>${a.pl}</td>
      <td><span class="badge ${wcls(a.wc)}">${a.wc}</span></td>
      <td style="color:${a.pe > CFG.pesado ? 'var(--or)' : 'var(--tx)'}">${a.pe > 0 ? a.pe + ' kg' : '—'}</td>
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
      ${th('arts','i','Código')}${th('arts','d','Descripción')}${th('arts','a','Surtido')}${th('arts','s', vtaLabel)}
      ${th('arts','pl','Pallet')}${th('arts','wc','Tipo')}${th('arts','pe','Peso')}${th('arts','vo','Vol')}${th('arts','md','MDQ')}
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
  ['fVmin', 'fPeso', 'fLoc2', 'fSurt', 'fVista', 'sbox', 'fVentaMode'].forEach(id => {
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
  const hdr  = ['Código','Descripción','Surtido', vtaLabel,'Pallet','Tipo peso','Peso kg','Vol dm3',
                 'MDQ','Loc Central','Max Central','Min Central','Loc Aux1','Max Aux1','Min Aux1','Inicio venta','Fin venta'];
  const rows = filteredArts.map(a => [a.i, a.d, a.a, ventaVal(a), a.pl, a.wc, a.pe, a.vo, a.md,
                                       a.lc, a.mx, a.mn, a.la, a.mxa, a.mna, fmtDate(a.ss), fmtDate(a.es)]);
  csvDownload('wms_articulos', hdr, rows);
}


// ── REVISAR LOCALIZACIÓN ─────────────────────────────────────────

function filterPesados(q) {
  pesadosSearch = (q || '').trim().toLowerCase();
  renderPesadosTable();
}

function setPesadosCardFilter(key) {
  pesadosCardFilter = pesadosCardFilter === key ? '' : key;
  renderPesados();
}

function renderPesados() {
  const pk = HEAVY.filter(b => b.lt === 'picking').length;
  const bc = HEAVY.filter(b => b.almacen === 'CENTRAL').length;
  const ba = HEAVY.filter(b => b.almacen === 'AUXILIAR1').length;

  const cardAct = key => pesadosCardFilter === key ? ' act-card' : '';

  document.getElementById('pesadosCards').innerHTML = `
    <div class="card card-click${cardAct('')}" onclick="setPesadosCardFilter('')">
      <div class="clbl">Total a revisar</div>
      <div class="cval" style="color:var(--or)">${HEAVY.length}</div>
      <div class="csub">peso >${CFG.pesado}kg + ≥${CFG.rotacion}/mes + sin suelo</div>
    </div>
    <div class="card card-click${cardAct('picking')}" onclick="setPesadosCardFilter('picking')">
      <div class="clbl">En picking</div>
      <div class="cval" style="color:var(--yw)">${pk}</div>
      <div class="csub">nivel de balda</div>
    </div>
    <div class="card card-click${cardAct('central')}" onclick="setPesadosCardFilter('central')">
      <div class="clbl">Central</div>
      <div class="cval" style="color:var(--b2)">${bc}</div>
      <div class="csub">localizaciones</div>
    </div>
    <div class="card card-click${cardAct('aux')}" onclick="setPesadosCardFilter('aux')">
      <div class="clbl">Auxiliar1</div>
      <div class="cval" style="color:var(--aux-lbl)">${ba}</div>
      <div class="csub">localizaciones</div>
    </div>`;

  if (!document.getElementById('pesadosSearchInput')) {
    document.getElementById('pesadosToolbar').innerHTML = `
      <input class="sbox" id="pesadosSearchInput" type="text"
        placeholder="Buscar artículo, código, localización..."
        oninput="filterPesados(this.value)">
      <span class="rowcnt-lbl" id="pesadosCount"></span>
      <button class="btn-exp" onclick="exportPeso()">↓ CSV</button>`;
  }

  renderPesadosTable();
}

function renderPesadosTable() {
  let base = HEAVY;
  if (pesadosCardFilter === 'picking') base = base.filter(b => b.lt === 'picking');
  if (pesadosCardFilter === 'central') base = base.filter(b => b.almacen === 'CENTRAL');
  if (pesadosCardFilter === 'aux')     base = base.filter(b => b.almacen === 'AUXILIAR1');

  const filtered = pesadosSearch
    ? sortArrBy(base, sortStates.pesados.k, sortStates.pesados.d)
        .filter(b => b.i.toLowerCase().includes(pesadosSearch)
                  || b.d.toLowerCase().includes(pesadosSearch)
                  || b.loc.toLowerCase().includes(pesadosSearch))
    : sortArrBy(base, sortStates.pesados.k, sortStates.pesados.d);

  const cnt = document.getElementById('pesadosCount');
  if (cnt) cnt.textContent = filtered.length.toLocaleString() + ' registros';

  const rows = filtered.map(b => `<tr>
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

// Filtra LIBRE_ALL según el umbral de "% libre mínimo" elegido.
// threshold=25 → admite hasta 75% ocupado · threshold=50 → hasta 50% ocupado
// threshold=75 → hasta 25% ocupado      · threshold=100 → solo completamente vacío
function computeLibre(threshold, almacen) {
  const maxUsedPct = 100 - threshold;
  return LIBRE_ALL.filter(l => {
    if (almacen && l.almacen !== almacen) return false;
    if (l.pctUsado === null) return !l.arts.length; // sin Cap./Vol: solo vacíos totales
    return l.pctUsado <= maxUsedPct;
  });
}

function setFreeThreshold(val) {
  freeThreshold = parseInt(val);
  renderLibre();
}

function setFreeAlmacen(val) {
  freeAlmacen = val;
  renderLibre();
}

function filterLibre(q) {
  libreSearch = (q || '').trim().toLowerCase();
  renderLibreTable();
}

function setLibreCardFilter(key) {
  libreCardFilter = libreCardFilter === key ? '' : key;
  renderLibreTable();
  // Resaltar tarjeta activa sin tener que re-renderizar todo el bloque de tarjetas
  document.querySelectorAll('#libreCards .card-click').forEach(c =>
    c.classList.toggle('act-card', c.dataset.key === libreCardFilter)
  );
}

function renderLibre() {
  const list = computeLibre(freeThreshold, freeAlmacen);
  const lC  = list.filter(f => f.almacen === 'CENTRAL');
  const lA  = list.filter(f => f.almacen === 'AUXILIAR1');
  const pkC = lC.filter(f => f.lt === 'picking').length;
  const sfC = lC.filter(f => f.lt === 'suelo').length;
  const pkA = lA.filter(f => f.lt === 'picking').length;
  const sfA = lA.filter(f => f.lt === 'suelo').length;
  const vacios = list.filter(f => !f.arts.length).length;
  const infra  = list.length - vacios;
  const palletFreeLocs = list.filter(f => f.lt === 'suelo' && f.palletsFree > 0);
  const palletFreeSum  = palletFreeLocs.reduce((s, f) => s + (f.palletsFree || 0), 0);

  const cardAct = key => libreCardFilter === key ? ' act-card' : '';

  document.getElementById('libreCards').innerHTML = `
    <div class="card card-click${cardAct('')}" data-key="" onclick="setLibreCardFilter('')">
      <div class="clbl">Total con ≥${freeThreshold}% libre</div>
      <div class="cval" style="color:var(--gn)">${list.length}</div>
      <div class="csub">${vacios} vacías + ${infra} infrautilizadas</div>
    </div>
    <div class="card card-click${cardAct('picking-c')}" data-key="picking-c" onclick="setLibreCardFilter('picking-c')">
      <div class="clbl">Picking Central</div>
      <div class="cval" style="color:var(--gn)">${pkC}</div>
      <div class="csub">baldas con espacio</div>
    </div>
    <div class="card card-click${cardAct('suelo-c')}" data-key="suelo-c" onclick="setLibreCardFilter('suelo-c')">
      <div class="clbl">Suelo Central</div>
      <div class="cval" style="color:var(--b2)">${sfC}</div>
      <div class="csub">posiciones con espacio</div>
    </div>
    <div class="card card-click${cardAct('picking-a')}" data-key="picking-a" onclick="setLibreCardFilter('picking-a')">
      <div class="clbl">Picking Aux1</div>
      <div class="cval" style="color:var(--aux-lbl)">${pkA}</div>
      <div class="csub">baldas con espacio</div>
    </div>
    <div class="card card-click${cardAct('suelo-a')}" data-key="suelo-a" onclick="setLibreCardFilter('suelo-a')">
      <div class="clbl">Suelo Aux1</div>
      <div class="cval" style="color:var(--aux-lbl)">${sfA}</div>
      <div class="csub">posiciones con espacio</div>
    </div>
    <div class="card card-click${cardAct('pallet-libre')}" data-key="pallet-libre" onclick="setLibreCardFilter('pallet-libre')">
      <div class="clbl">🟦 Pallet libre en suelo</div>
      <div class="cval" style="color:var(--teal)">${palletFreeLocs.length}</div>
      <div class="csub">${palletFreeSum} pallets · cap. ${PALLETS_POR_SUELO}/suelo</div>
    </div>`;

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

function renderLibreTable() {
  const list        = computeLibre(freeThreshold, freeAlmacen);
  const withDerived = list.map(f => ({ ...f, pctLibre: f.pctUsado === null ? null : 100 - f.pctUsado }));

  let base = withDerived;
  if (libreCardFilter === 'picking-c')   base = base.filter(f => f.lt === 'picking' && f.almacen === 'CENTRAL');
  if (libreCardFilter === 'suelo-c')     base = base.filter(f => f.lt === 'suelo'   && f.almacen === 'CENTRAL');
  if (libreCardFilter === 'picking-a')   base = base.filter(f => f.lt === 'picking' && f.almacen === 'AUXILIAR1');
  if (libreCardFilter === 'suelo-a')     base = base.filter(f => f.lt === 'suelo'   && f.almacen === 'AUXILIAR1');
  if (libreCardFilter === 'pallet-libre') base = base.filter(f => f.lt === 'suelo' && f.palletsFree > 0);

  const filtered = libreSearch
    ? base.filter(f => f.c.toLowerCase().includes(libreSearch)
                     || f.almacen.toLowerCase().includes(libreSearch)
                     || f.lt.toLowerCase().includes(libreSearch))
    : base;

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
      return `<tr>
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

function filterBye(q) {
  byeSearch = (q || '').trim().toLowerCase();
  renderByeTable();
}

function setByeCardFilter(key) {
  byeCardFilter = byeCardFilter === key ? '' : key;
  renderByeTable();
  document.querySelectorAll('#byeCards .card-click').forEach(c =>
    c.classList.toggle('act-card', c.dataset.key === byeCardFilter)
  );
}

function renderBye() {
  const bc       = BYE.filter(b => b.almacen === 'CENTRAL').length;
  const ba       = BYE.filter(b => b.almacen === 'AUXILIAR1').length;
  const conStock = BYE.filter(b => (b.st > 0 || b.pv > 0)).length;
  const sinStock = BYE.filter(b => (b.st <= 0 && b.pv <= 0)).length;

  const cardAct = key => byeCardFilter === key ? ' act-card' : '';

  document.getElementById('byeCards').innerHTML = `
    <div class="card card-click${cardAct('')}" data-key="" onclick="setByeCardFilter('')">
      <div class="clbl">Total NS con localización</div>
      <div class="cval" style="color:var(--mu)">${BYE.length}</div>
      <div class="csub">artículos fuera de surtido aún ubicados</div>
    </div>
    <div class="card card-click${cardAct('central')}" data-key="central" onclick="setByeCardFilter('central')">
      <div class="clbl">Central</div>
      <div class="cval" style="color:var(--b2)">${bc}</div>
      <div class="csub">localizaciones</div>
    </div>
    <div class="card card-click${cardAct('aux')}" data-key="aux" onclick="setByeCardFilter('aux')">
      <div class="clbl">Auxiliar1</div>
      <div class="cval" style="color:var(--aux-lbl)">${ba}</div>
      <div class="csub">localizaciones</div>
    </div>
    <div class="card card-click${cardAct('con-stock')}" data-key="con-stock" onclick="setByeCardFilter('con-stock')">
      <div class="clbl">📦 Con stock o PV</div>
      <div class="cval" style="color:var(--or)">${conStock}</div>
      <div class="csub">mantener ubicación</div>
    </div>
    <div class="card card-click${cardAct('sin-stock')}" data-key="sin-stock" onclick="setByeCardFilter('sin-stock')">
      <div class="clbl">⬜ Sin stock ni PV</div>
      <div class="cval" style="color:var(--gn)">${sinStock}</div>
      <div class="csub">candidatos a liberar</div>
    </div>`;

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
  let base = BYE;
  if (byeCardFilter === 'central')   base = base.filter(b => b.almacen === 'CENTRAL');
  if (byeCardFilter === 'aux')       base = base.filter(b => b.almacen === 'AUXILIAR1');
  if (byeCardFilter === 'con-stock') base = base.filter(b => b.st > 0 || b.pv > 0);
  if (byeCardFilter === 'sin-stock') base = base.filter(b => b.st <= 0 && b.pv <= 0);

  const filtered = byeSearch
    ? base.filter(b => b.i.toLowerCase().includes(byeSearch)
                     || b.d.toLowerCase().includes(byeSearch)
                     || b.loc.toLowerCase().includes(byeSearch))
    : base;

  const cnt = document.getElementById('byeCount');
  if (cnt) cnt.textContent = filtered.length.toLocaleString() + ' registros';

  const sorted = sortArrBy(filtered, sortStates.bye.k, sortStates.bye.d);

  const rows = sorted.map(b => {
    const tieneStock = b.st > 0 || b.pv > 0;
    return `<tr>
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
      ${th('bye','endsale','Fin venta')}<th>Acción</th>
    </tr></thead>
    <tbody>${rows || '<tr><td colspan="12" style="text-align:center;color:var(--gn);padding:28px">✓ Sin artículos NS con localización asignada</td></tr>'}</tbody>
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
  let base = HEAVY;
  if (pesadosCardFilter === 'picking') base = base.filter(b => b.lt === 'picking');
  if (pesadosCardFilter === 'central') base = base.filter(b => b.almacen === 'CENTRAL');
  if (pesadosCardFilter === 'aux')     base = base.filter(b => b.almacen === 'AUXILIAR1');

  const hdr  = ['Localización','Almacén','Tipo','Artículo','Descripción','Peso kg','Vta/mes'];
  const rows = sortArrBy(base, sortStates.pesados.k, sortStates.pesados.d)
    .map(b => [b.loc, b.almacen, b.lt, b.i, b.d, b.pe, b.s]);
  csvDownload('wms_revisar', hdr, rows);
}

function exportLibre() {
  let base = computeLibre(freeThreshold, freeAlmacen);
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
  let base = BYE;
  if (byeCardFilter === 'central')   base = base.filter(b => b.almacen === 'CENTRAL');
  if (byeCardFilter === 'aux')       base = base.filter(b => b.almacen === 'AUXILIAR1');
  if (byeCardFilter === 'con-stock') base = base.filter(b => b.st > 0 || b.pv > 0);
  if (byeCardFilter === 'sin-stock') base = base.filter(b => b.st <= 0 && b.pv <= 0);

  const hdr  = ['Localización','Almacén','Artículo','Descripción','Max','Min','Vta/mes','Peso kg','Stock','PV','Fin venta'];
  const rows = sortArrBy(base, sortStates.bye.k, sortStates.bye.d)
    .map(b => [b.loc, b.almacen, b.i, b.d, b.mx, b.mn, b.s, b.pe, b.st, b.pv, fmtDate(b.endsale)]);
  csvDownload('wms_byebye', hdr, rows);
}
