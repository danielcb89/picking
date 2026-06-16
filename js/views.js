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
  } else if (name === 'peso') {
    renderPesoTable();
  } else {
    renderLibreTable();
  }
}


// ── ARTÍCULOS ────────────────────────────────────────────────────

function filterArts() {
  const q     = (document.getElementById('sbox')   || { value: '' }).value.toLowerCase();
  const vmin  = parseFloat((document.getElementById('fVmin')  || { value: 0 }).value) || 0;
  const fpe   = (document.getElementById('fPeso')  || { value: '' }).value;
  const floc  = (document.getElementById('fLoc2')  || { value: '' }).value;
  const fsurt = (document.getElementById('fSurt')  || { value: '' }).value;
  const fv    = (document.getElementById('fVista') || { value: '' }).value;

  filteredArts = ARTS.filter(a => {
    if (a.s < vmin)                                    return false;
    if (fpe   && a.wc !== fpe)                         return false;
    if (floc === 'con'     && !a.lc && !a.la)          return false;
    if (floc === 'sin'     && (a.lc || a.la))          return false;
    if (floc === 'central' && (!a.lc || a.la))         return false;
    if (floc === 'aux'     && (!a.la || a.lc))         return false;
    if (floc === 'ambos'   && !(a.lc && a.la))         return false;
    if (fsurt  && a.a !== fsurt)                       return false;
    if (fv === 'prio'   && !['CRÍTICA','ALTA'].includes(a.pr)) return false;
    if (fv === 'mm0'    && !(a.lc && a.mx === 0) && !(a.la && a.mxa === 0)) return false;
    if (fv === 'sinmdq' && a.md > 0)                   return false;
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

  const rows = slice.map(a => {
    const locC = a.lc
      ? `<span style="color:var(--b2)">${a.lc}</span> <span style="font-size:9px;color:var(--mu)">${a.mx || '—'}/${a.mn || '—'}</span>`
      : `<span style="color:var(--mu);font-style:italic">—</span>`;
    const locA = a.la
      ? `<span style="color:var(--aux-lbl)">${a.la}</span> <span style="font-size:9px;color:var(--mu)">${a.mxa || '—'}/${a.mna || '—'}</span>`
      : `<span style="color:var(--mu);font-style:italic">—</span>`;
    return `<tr>
      <td style="color:var(--b2);font-weight:600">${a.i}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis">${a.d}</td>
      <td><span class="badge ${a.a === 'S' ? 'b-gn' : a.a === 'NS' ? 'b-gy' : 'b-bl'}">${a.a || '—'}</span></td>
      <td style="font-weight:700;color:${a.s >= 5 ? 'var(--gn)' : a.s > 0 ? 'var(--tx)' : 'var(--mu)'}">${a.s}</td>
      <td>${a.pl}</td>
      <td><span class="badge ${wcls(a.wc)}">${a.wc}</span></td>
      <td style="color:${a.pe > 20 ? 'var(--or)' : 'var(--tx)'}">${a.pe > 0 ? a.pe + ' kg' : '—'}</td>
      <td>${a.vo > 0 ? a.vo + ' dm³' : '—'}</td>
      <td>${a.md || '<span style="color:var(--rd)">⚠ 0</span>'}</td>
      <td>${locC}</td>
      <td>${locA}</td>
      <td><span class="badge ${pcls(a.pr)}">${a.pr}</span></td>
    </tr>`;
  }).join('');

  document.getElementById('artsTbl').innerHTML = `<table>
    <thead><tr>
      ${th('arts','i','Código')}${th('arts','d','Descripción')}${th('arts','a','Surtido')}${th('arts','s','Vta/sem')}
      ${th('arts','pl','Pallet')}${th('arts','wc','Tipo')}${th('arts','pe','Peso')}${th('arts','vo','Vol')}${th('arts','md','MDQ')}
      ${th('arts','lc','Loc Central (max/min)')}${th('arts','la','Loc Aux1 (max/min)')}${th('arts','pr','Prioridad')}
    </tr></thead>
    <tbody>${rows || '<tr><td colspan="12" style="text-align:center;color:var(--mu);padding:28px">Sin resultados</td></tr>'}</tbody>
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
  ['fVmin', 'fPeso', 'fLoc2', 'fSurt', 'fVista', 'sbox'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = id === 'fVmin' ? '0' : '';
  });
  filteredArts = [...ARTS];
  sortArtsData();
  curPage = 1;
  renderArtsTable();
}

function exportArts() {
  const hdr  = ['Código','Descripción','Surtido','Vta/sem','Pallet','Tipo peso','Peso kg','Vol dm3',
                 'MDQ','Loc Central','Max Central','Min Central','Loc Aux1','Max Aux1','Min Aux1','Prioridad'];
  const rows = filteredArts.map(a => [a.i, a.d, a.a, a.s, a.pl, a.wc, a.pe, a.vo, a.md,
                                       a.lc, a.mx, a.mn, a.la, a.mxa, a.mna, a.pr]);
  csvDownload('wms_articulos', hdr, rows);
}


// ── REVISAR LOCALIZACIÓN ─────────────────────────────────────────

function filterPeso(q) {
  pesoSearch = (q || '').trim().toLowerCase();
  renderPesoTable(); // solo actualiza tabla y contador, sin tocar el input
}

function renderPeso() {
  const pk = BAD.filter(b => b.lt === 'picking').length;
  const bc = BAD.filter(b => b.almacen === 'CENTRAL').length;
  const ba = BAD.filter(b => b.almacen === 'AUXILIAR1').length;

  document.getElementById('pesoCards').innerHTML = `
    <div class="card">
      <div class="clbl">Total a revisar</div>
      <div class="cval" style="color:var(--or)">${BAD.length}</div>
      <div class="csub">peso >20kg + ≥5/sem + sin suelo en ningún almacén</div>
    </div>
    <div class="card">
      <div class="clbl">En picking</div>
      <div class="cval" style="color:var(--yw)">${pk}</div>
      <div class="csub">nivel de balda</div>
    </div>
    <div class="card">
      <div class="clbl">Central / Aux1</div>
      <div class="cval" style="color:var(--mu);font-size:16px;margin-top:4px">${bc} / ${ba}</div>
      <div class="csub">por almacén</div>
    </div>`;

  // Toolbar: se inicializa solo la primera vez, luego solo actualiza contador
  if (!document.getElementById('pesoSearchInput')) {
    document.getElementById('pesoToolbar').innerHTML = `
      <input class="sbox" id="pesoSearchInput" type="text"
        placeholder="Buscar artículo, código, localización..."
        oninput="filterPeso(this.value)">
      <span class="rowcnt-lbl" id="pesoCount"></span>
      <button class="btn-exp" onclick="exportPeso()">↓ CSV</button>`;
  }

  renderPesoTable();
}

function renderPesoTable() {
  const filtered = pesoSearch
    ? sortArrBy(BAD, sortStates.peso.k, sortStates.peso.d)
        .filter(b => b.i.toLowerCase().includes(pesoSearch)
                  || b.d.toLowerCase().includes(pesoSearch)
                  || b.loc.toLowerCase().includes(pesoSearch))
    : sortArrBy(BAD, sortStates.peso.k, sortStates.peso.d);

  const cnt = document.getElementById('pesoCount');
  if (cnt) cnt.textContent = filtered.length.toLocaleString() + ' registros';

  const rows = filtered.map(b => `<tr>
    <td style="color:${b.almacen === 'AUXILIAR1' ? 'var(--aux-lbl)' : 'var(--b2)'};font-weight:600">${b.loc}</td>
    <td><span class="badge ${b.almacen === 'AUXILIAR1' ? 'b-pu' : 'b-bl'}">${b.almacen === 'AUXILIAR1' ? 'Aux1' : 'Central'}</span></td>
    <td><span class="badge ${b.lt === 'picking' ? 'b-yw' : 'b-or'}">${b.lt}</span></td>
    <td>${b.i}</td>
    <td style="max-width:190px;overflow:hidden;text-overflow:ellipsis">${b.d}</td>
    <td style="color:var(--or);font-weight:700">${b.pe} kg</td>
    <td style="color:${b.s >= 5 ? 'var(--gn)' : 'var(--tx)'};font-weight:700">${b.s}</td>
    <td><span class="badge b-or">Mover a .0.0</span></td>
  </tr>`).join('');

  document.getElementById('pesoTbl').innerHTML = `<table>
    <thead><tr>
      ${th('peso','loc','Localización')}${th('peso','almacen','Almacén')}${th('peso','lt','Tipo')}${th('peso','i','Artículo')}
      ${th('peso','d','Descripción')}${th('peso','pe','Peso')}${th('peso','s','Vta/sem')}<th>Acción</th>
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
  renderLibreTable(); // solo actualiza tabla y contador, sin tocar el input
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

  document.getElementById('libreCards').innerHTML = `
    <div class="card">
      <div class="clbl">Total con ≥${freeThreshold}% libre</div>
      <div class="cval" style="color:var(--gn)">${list.length}</div>
      <div class="csub">${vacios} vacías + ${infra} infrautilizadas</div>
    </div>
    <div class="card">
      <div class="clbl">Picking Central</div>
      <div class="cval" style="color:var(--gn)">${pkC}</div>
      <div class="csub">baldas con espacio</div>
    </div>
    <div class="card">
      <div class="clbl">Suelo Central</div>
      <div class="cval" style="color:var(--b2)">${sfC}</div>
      <div class="csub">posiciones con espacio</div>
    </div>
    <div class="card">
      <div class="clbl">Picking Aux1</div>
      <div class="cval" style="color:var(--aux-lbl)">${pkA}</div>
      <div class="csub">baldas con espacio</div>
    </div>
    <div class="card">
      <div class="clbl">Suelo Aux1</div>
      <div class="cval" style="color:var(--aux-lbl)">${sfA}</div>
      <div class="csub">posiciones con espacio</div>
    </div>`;

  // Toolbar: se inicializa solo la primera vez, luego solo actualiza contador
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
  const filtered    = libreSearch
    ? withDerived.filter(f => f.c.toLowerCase().includes(libreSearch)
                            || f.almacen.toLowerCase().includes(libreSearch)
                            || f.lt.toLowerCase().includes(libreSearch))
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
        <td>${estado}</td>
      </tr>`;
    }).join('');

  document.getElementById('libreTbl').innerHTML = `<table>
    <thead><tr>
      ${th('libre','c','Localización')}${th('libre','almacen','Almacén')}${th('libre','p','Pasillo')}${th('libre','e','Estantería')}
      ${th('libre','lt','Tipo')}${th('libre','capDm3','Cap. (dm³)')}${th('libre','volOcup','Vol. ocupado (máx repos.)')}
      ${th('libre','pctUsado','% Ocupado')}${th('libre','pctLibre','% Libre')}<th>Estado</th>
    </tr></thead>
    <tbody>${rows || '<tr><td colspan="10" style="text-align:center;color:var(--mu);padding:28px">Sin ubicaciones con espacio disponible para este umbral</td></tr>'}</tbody>
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

function exportPeso() {
  const hdr  = ['Localización','Almacén','Tipo','Artículo','Descripción','Peso kg','Vta/sem'];
  const rows = sortArrBy(BAD, sortStates.peso.k, sortStates.peso.d)
    .map(b => [b.loc, b.almacen, b.lt, b.i, b.d, b.pe, b.s]);
  csvDownload('wms_revisar', hdr, rows);
}

function exportLibre() {
  const list = computeLibre(freeThreshold, freeAlmacen);
  const hdr  = ['Localización','Almacén','Pasillo','Estantería','Tipo','Cap. (dm³)','Vol. ocupado (dm³)','% Ocupado','% Libre'];
  const rows = sortArrBy(list, sortStates.libre.k, sortStates.libre.d).map(f => {
    const pctU = f.pctUsado !== null && isFinite(f.pctUsado) ? Math.round(f.pctUsado) : '';
    const pctL = pctU !== '' ? 100 - pctU : '';
    return [f.c, f.almacen, f.p, f.e, f.lt,
            f.capDm3  ? Math.round(f.capDm3)  : '',
            f.volOcup ? Math.round(f.volOcup) : '',
            pctU, pctL];
  });
  csvDownload('wms_libre', hdr, rows);
}
