// ════════════════════════════════════════════════════════════════
// data.js — Lectura de ficheros y procesamiento de datos
// Depende de: state.js
// ════════════════════════════════════════════════════════════════


// ── CARGA DE FICHEROS ────────────────────────────────────────────

// Fichero de artículos — carga manual (card1)
function onFile(n, input) {
  const f = input.files[0];
  if (!f) return;
  rawFile1 = f;
  document.getElementById('card1').classList.add('loaded');
  document.getElementById('st1').textContent = '✓ ' + f.name;
  checkReadyToStart();
}

// Drag & drop — solo card1 (artículos)
const card1El = document.getElementById('card1');
card1El.addEventListener('dragover',  e => { e.preventDefault(); card1El.classList.add('drag'); });
card1El.addEventListener('dragleave', ()  => card1El.classList.remove('drag'));
card1El.addEventListener('drop', e => {
  e.preventDefault();
  card1El.classList.remove('drag');
  const f = e.dataTransfer.files[0];
  if (!f) return;
  rawFile1 = f;
  card1El.classList.add('loaded');
  document.getElementById('st1').textContent = '✓ ' + f.name;
  checkReadyToStart();
});

// Selector de tienda — ubicaciones desde servidor (card2)
function onStoreSelect(sel) {
  const code = sel.value;
  if (!code) {
    selectedStore = null;
    document.getElementById('card2').classList.remove('loaded');
    document.getElementById('st2').textContent = '';
    checkReadyToStart();
    return;
  }
  selectedStore = code;
  const store = STORE_FILES[code];
  document.getElementById('card2').classList.add('loaded');
  document.getElementById('st2').textContent = '✓ ' + store.archivo.split('/').pop();
  checkReadyToStart();
}

// Habilitar botón solo cuando ambos están listos
function checkReadyToStart() {
  document.getElementById('startBtn').disabled = !(rawFile1 && selectedStore);
}

// Leer fichero de ubicaciones desde el servidor via fetch.
// - Pestaña "ubicaciones" → datos de localizaciones (primera pestaña, nombre fijo)
// - Resto de pestañas → layouts de planta (nombre de pestaña = título del layout)
async function fetchStoreFile() {
  const store  = STORE_FILES[selectedStore];
  const resp   = await fetch(store.archivo);
  if (!resp.ok) throw new Error(`No se pudo cargar ${store.archivo} (HTTP ${resp.status})`);
  const buffer = await resp.arrayBuffer();
  const wb     = XLSX.read(buffer, { type: 'array' });

  // Primera pestaña siempre = ubicaciones
  const ubSheet = wb.Sheets[wb.SheetNames[0]];
  const ubRows  = XLSX.utils.sheet_to_json(ubSheet, { defval: '' });

  // Resto de pestañas = layouts de planta
  LAYOUTS = wb.SheetNames.slice(1).map(nombre => {
    const ws   = wb.Sheets[nombre];
    const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
    // Normalizar: null y celdas vacías → null, strings en mayúsculas sin espacios
    const normalized = grid
      .filter(row => row.some(c => c !== null && c !== ''))
      .map(row => row.map(c => {
        if (c === null || c === '') return null;
        const s = String(c).trim().toUpperCase();
        return s === '_' ? null : s; // '_' = espacio vacío = null
      }));
    return { nombre, grid: normalized };
  });

  return ubRows;
}


// ── LECTURA ──────────────────────────────────────────────────────

function readFile(file) {
  return new Promise((res, rej) => {
    const ext    = file.name.split('.').pop().toLowerCase();
    const reader = new FileReader();
    reader.onerror = rej;
    reader.onload  = e => {
      try {
        let rows;
        if (ext === 'csv') {
          rows = parseCSV(e.target.result);
        } else {
          const wb = XLSX.read(e.target.result, { type: 'array' });
          const sn = wb.SheetNames.find(s => s.toLowerCase() === 'todos') || wb.SheetNames[0];
          rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: '' });
        }
        res(rows);
      } catch (err) { rej(err); }
    };
    if (ext === 'csv') reader.readAsText(file, 'UTF-8');
    else               reader.readAsArrayBuffer(file);
  });
}

function parseCSV(text) {
  const sep   = text.includes(';') ? ';' : ',';
  const lines = text.split('\n').filter(l => l.trim());
  const hdr   = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const vals = line.split(sep);
    const obj  = {};
    hdr.forEach((h, i) => obj[h] = (vals[i] || '').trim().replace(/^"|"$/g, ''));
    return obj;
  }).filter(r => Object.values(r).some(v => v !== ''));
}


// ── UTILIDADES ───────────────────────────────────────────────────

function findCol(row, candidates) {
  const keys = Object.keys(row).map(k => k.toLowerCase().trim());
  for (const c of candidates) {
    const idx = keys.indexOf(c.toLowerCase());
    if (idx >= 0) return Object.keys(row)[idx];
  }
  return null;
}

function safeNum(v, def = 0) {
  const n = parseFloat(String(v || '').replace(',', '.'));
  return isNaN(n) ? def : n;
}

function safeStr(v) {
  const s = String(v || '').trim().replace(/^[()]+|[()]+$/g, '');
  return s === 'nan' || s === 'None' ? '' : s;
}


// ── PROCESADO DE ARTÍCULOS ───────────────────────────────────────

function processArticles(rows) {
  if (!rows.length) throw new Error('Archivo de artículos vacío');
  const s = rows[0];
  const C = {
    artcod:     findCol(s, ['artcod','codigo','cod','article','item']),
    descr:      findCol(s, ['descr','description','descripcion','desc','nombre']),
    assortment: findCol(s, ['assortment','surtido']),
    semuds:     findCol(s, ['semuds','sem_uds','ventas_sem']),
    pall:       findCol(s, ['pall','pallet']),
    mdq:        findCol(s, ['mdq','min_div']),
    peso:       findCol(s, ['peso','weight','kg']),
    vol:        findCol(s, ['vol','volumen','volume','dm3','vol(dm3)','vol dm3','vol_dm3']),
    loc:        findCol(s, ['loc','localizacion','ubicacion','location']),
    maxpick:    findCol(s, ['maxpick','max_pick','max pick']),
    minpick:    findCol(s, ['minpick','min_pick','min pick']),
    locaux:     findCol(s, ['locaux','loc_aux','locaux1']),
    maxpickaux: findCol(s, ['maxpickaux','max_pick_aux','max pick aux','maxpickaux1']),
    minpickaux: findCol(s, ['minpickaux','min_pick_aux','min pick aux']),
    entrega:    findCol(s, ['entrega','delivery','tipo entrega','tipo_entrega',
                             'tipo de entrega','tipoventa','tipo venta','tipo_venta']),
    hfb:        findCol(s, ['hfb']),
    fam:        findCol(s, ['fam','familia']),
    socktotal:  findCol(s, ['socktotal','stocktotal','stock_total','sock_total']),
  };
  if (!C.artcod || !C.descr)
    throw new Error(`No se encontró artcod/descr. Columnas: ${Object.keys(s).join(', ')}`);

  // Auto-detección de columna entrega por valores si no se encontró por nombre
  if (!C.entrega) {
    for (const col of Object.keys(s)) {
      const vals = rows.slice(0, 20).map(r => String(r[col] || '').toLowerCase());
      if (vals.some(v => v.includes('almac') || v.includes('direct'))) {
        C.entrega = col;
        break;
      }
    }
  }

  // ── REGLAS DE EXCLUSIÓN ─────────────────────────────────────────
  // Añadir aquí cualquier nueva regla de exclusión de artículos.
  // Devuelve true si el artículo debe ignorarse en todos los listados.
  function shouldExclude(r) {
    const artcod = parseInt(safeStr(r[C.artcod]), 10);
    const hfb    = safeStr(r[C.hfb]);
    const fam    = safeStr(r[C.fam]);
    const pall   = safeNum(r[C.pall]);
    const sock   = safeNum(r[C.socktotal]);
    const entrega = C.entrega ? String(r[C.entrega] || '').toLowerCase().trim() : '';

    // 1. Entrega directa — artículos que no pasan por el almacén
    if (entrega.includes('direct')) return true;

    // 2. Consumibles locales — código de artículo ≤ 9999
    if (!isNaN(artcod) && artcod <= 9999) return true;

    // 3. Artículos de venta de servicios — HFB 97 o HFB 95
    if (hfb === '97' || hfb === '95') return true;

    // 4. Encimeras a medida — FAM 741 + HFB 7 + Pall 1 + SockTotal 0
    if (fam === '741' && hfb === '7' && pall === 1 && sock === 0) return true;

    return false;
  }
  // ───────────────────────────────────────────────────────────────

  ARTS = rows.map(r => {
    if (shouldExclude(r)) return null;

    const loc    = safeStr(r[C.loc]    || '');
    const locaux = safeStr(r[C.locaux] || '');
    const semuds = safeNum(r[C.semuds]);
    const pall   = safeNum(r[C.pall]);
    const peso   = safeNum(r[C.peso]);
    const mdq    = safeNum(r[C.mdq]);
    const hasAnyLoc = !!(loc || locaux);

    return {
      i:   safeStr(r[C.artcod]),
      d:   String(r[C.descr] || '').trim().substring(0, 55),
      a:   safeStr(r[C.assortment] || ''),
      s:   semuds, pl: pall, md: mdq, pe: peso, vo: safeNum(r[C.vol]),
      lc:  loc,    mx:  safeNum(r[C.maxpick]),    mn:  safeNum(r[C.minpick]),
      la:  locaux, mxa: safeNum(r[C.maxpickaux]), mna: safeNum(r[C.minpickaux]),
      wc:  pall <= 0 ? '?' : pall <= 30 ? 'Voluminoso' : pall <= 200 ? 'Mediano' : 'Pequeño',
      pr:  calcPri(hasAnyLoc, semuds, pall),
    };
  }).filter(a => a && a.i);
}

function calcPri(hasAny, s, pl) {
  if (!hasAny && s >= 5 && pl > 0 && pl <= 30)  return 'CRÍTICA';
  if (!hasAny && s >= 5)                        return 'ALTA';
  if (!hasAny && s > 0)                         return 'MEDIA';
  if ( hasAny && s >= 5)                        return 'OK';
  return 'BAJA';
}


// ── PROCESADO DE UBICACIONES ─────────────────────────────────────

function processUbicaciones(rows) {
  if (!rows.length) throw new Error('Archivo de ubicaciones vacío');
  const s = rows[0];
  const C = {
    almacen: findCol(s, ['almacen','warehouse','almacén','alm']),
    code:    findCol(s, ['codigo loc.','codigo loc','loc','code','codigo',
                          'location code','cod loc','código loc.']),
    subtipo: findCol(s, ['subtipo','subtype','tipo','type']),
    cap:     findCol(s, ['cap. total','cap total','capacidad','capacity','cap','m2']),
  };
  if (!C.almacen || !C.code)
    throw new Error(`Columnas no encontradas en ubicaciones. Disponibles: ${Object.keys(s).join(', ')}`);

  // Lookup artículo -> localizaciones
  const artByLoc = {}, artByLa = {};
  ARTS.forEach(a => {
    if (a.lc) artByLoc[a.lc] = (artByLoc[a.lc] || []).concat(a);
    if (a.la) artByLa[a.la]  = (artByLa[a.la]  || []).concat(a);
  });

  function parseLoc(code) {
    const p = String(code).trim().split('.');
    if (p.length === 4) {
      const n = p.map(Number);
      if (n.every(x => !isNaN(x))) return n;
    }
    return null;
  }
  function lt(h, pos) {
    return h === 0 && pos === 0 ? 'suelo' : h === 0 && pos > 0 ? 'picking' : 'altura';
  }

  LOCS_C = []; LOCS_A = [];
  rows.forEach(r => {
    const alm   = String(r[C.almacen] || '').trim().toUpperCase();
    const code  = String(r[C.code]    || '').trim();
    const parts = parseLoc(code);
    if (!parts) return;
    const [p, e, h, pos] = parts;
    const cap    = C.cap ? safeNum(r[C.cap]) : 0;
    const type   = lt(h, pos);
    const isCen  = alm === 'CENTRAL';
    const arts   = (isCen ? artByLoc : artByLa)[code] || [];
    const artSnap = arts.map(a => isCen
      ? { i: a.i, d: a.d, s: a.s, pl: a.pl, pe: a.pe, vo: a.vo, mx: a.mx,  mn: a.mn,  la: a.la, lc: a.lc }
      : { i: a.i, d: a.d, s: a.s, pl: a.pl, pe: a.pe, vo: a.vo, mx: a.mxa, mn: a.mna, la: a.la, lc: a.lc }
    );

    // Volumen ocupado si se repone al máximo, y % de capacidad usada (solo picking/suelo)
    let capDm3 = null, volOcup = null, pctUsado = null;
    if (type === 'picking' || type === 'suelo') {
      capDm3  = cap * 1000; // m³ -> dm³
      volOcup = artSnap.reduce((sum, a) => sum + (a.vo || 0) * (a.mx || 0), 0);
      pctUsado = capDm3 > 0 ? (volOcup / capDm3 * 100) : null;
    }

    const loc = { c: code, p, e, h, pos, cap, lt: type, almacen: isCen ? 'CENTRAL' : 'AUXILIAR1',
                   arts: artSnap, capDm3, volOcup, pctUsado };
    if (isCen) LOCS_C.push(loc); else LOCS_A.push(loc);
  });
}


// ── CÁLCULO DE ALERTAS ───────────────────────────────────────────

function calcAlerts() {
  // Detectar qué artículos tienen suelo en cada almacén
  const artFloor = {};
  LOCS_C.forEach(loc => {
    if (loc.lt === 'suelo') loc.arts.forEach(a => {
      if (!artFloor[a.i]) artFloor[a.i] = { c: false, a: false };
      artFloor[a.i].c = true;
    });
  });
  LOCS_A.forEach(loc => {
    if (loc.lt === 'suelo') loc.arts.forEach(a => {
      if (!artFloor[a.i]) artFloor[a.i] = { c: false, a: false };
      artFloor[a.i].a = true;
    });
  });

  // BAD: artículos pesados y de alta rotación sin posición de suelo en ningún almacén
  BAD = [];
  [...LOCS_C, ...LOCS_A].forEach(loc => {
    if (loc.lt === 'suelo') return;
    loc.arts.forEach(a => {
      if (a.pe <= 20 || a.s < 5) return;
      const floors = artFloor[a.i] || { c: false, a: false };
      if (floors.c || floors.a) return;
      BAD.push({ loc: loc.c, lt: loc.lt, almacen: loc.almacen, i: a.i, d: a.d, pe: a.pe, pl: a.pl, s: a.s });
    });
  });

  // LIBRE_ALL: todas las posiciones de picking y suelo, con sus datos de volumen
  // (la clasificación "libre / espacio disponible" se filtra luego según freeThreshold)
  LIBRE_ALL = [...LOCS_C, ...LOCS_A].filter(l => l.lt === 'picking' || l.lt === 'suelo');

  // LOW_ROT: top 5 localizaciones de menor venta/sem, por almacén y tipo (suelo/picking)
  function top5LowSales(locsArr, lt) {
    return locsArr
      .filter(l => l.lt === lt && l.arts.length)
      .map(l => ({ c: l.c, s: Math.min(...l.arts.map(a => a.s)) }))
      .sort((a, b) => a.s - b.s)
      .slice(0, 5)
      .map(l => l.c);
  }
  LOW_ROT = {
    csuelo: new Set(top5LowSales(LOCS_C, 'suelo')),
    cpick:  new Set(top5LowSales(LOCS_C, 'picking')),
    asuelo: new Set(top5LowSales(LOCS_A, 'suelo')),
    apick:  new Set(top5LowSales(LOCS_A, 'picking')),
  };

  STATS = {
    total_locs_c:  LOCS_C.length,
    total_locs_a:  LOCS_A.length,
    total_arts:    ARTS.length,
    arts_with_loc: ARTS.filter(a => a.lc || a.la).length,
    bad_weight:    BAD.length,
    no_loc_high:   ARTS.filter(a => !a.lc && !a.la && a.s >= 5).length,
  };
}
