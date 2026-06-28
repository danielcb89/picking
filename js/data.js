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
    const ws = wb.Sheets[nombre];

    // 1. Calcular dimensiones reales usando !ref + merges
    const ref   = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : { s:{r:0,c:0}, e:{r:0,c:0} };
    const merges = ws['!merges'] || [];
    const maxMR  = merges.length ? Math.max(...merges.map(m => m.e.r)) : 0;
    const maxMC  = merges.length ? Math.max(...merges.map(m => m.e.c)) : 0;
    const nRows  = Math.max(ref.e.r, maxMR) + 1;
    const nCols  = Math.max(ref.e.c, maxMC) + 1;

    // 2. Grid inicializado a null
    const grid = Array.from({ length: nRows }, () => new Array(nCols).fill(null));

    // 3. Rellenar celdas normales — solo claves que sean direcciones de celda válidas (ej: A1, B3)
    Object.keys(ws).filter(k => /^[A-Z]+\d+$/.test(k)).forEach(addr => {
      const cell = ws[addr];
      if (!cell || cell.v === undefined || cell.v === null) return;
      const { r, c } = XLSX.utils.decode_cell(addr);
      if (r >= nRows || c >= nCols) return;
      const s = String(cell.v).trim().toUpperCase();
      grid[r][c] = (s === '' || s === '_') ? null : s;
    });

    // 4. Leer celdas fusionadas: guardar {v, rows, cols} en top-left,
    //    marcar el resto como '__MERGED__' para no renderizarlas
    merges.forEach(m => {
      const addr = XLSX.utils.encode_cell({ r: m.s.r, c: m.s.c });
      const cell = ws[addr];
      const raw  = cell ? String(cell.v || '').trim().toUpperCase() : '';
      const val  = (raw === '' || raw === '_') ? null : raw;
      const spanR = m.e.r - m.s.r + 1;
      const spanC = m.e.c - m.s.c + 1;
      // Celda origen: objeto con valor y span
      grid[m.s.r][m.s.c] = val ? { v: val, rows: spanR, cols: spanC } : null;
      // Celdas cubiertas: marcadas para ignorar al renderizar
      for (let r = m.s.r; r <= m.e.r; r++) {
        for (let c = m.s.c; c <= m.e.c; c++) {
          if (r === m.s.r && c === m.s.c) continue;
          grid[r][c] = '__MERGED__';
        }
      }
    });

    return { nombre, grid, nRows, nCols };
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

// Convierte un valor de fecha (serial Excel o string) a objeto Date, o null si no es válido
function parseExcelDate(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') {
    // Serial de fecha de Excel (días desde 1899-12-30)
    return new Date(Math.round((v - 25569) * 86400 * 1000));
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}


// ── PROCESADO DE ARTÍCULOS ───────────────────────────────────────

function processArticles(rows) {
  if (!rows.length) throw new Error('Archivo de artículos vacío');
  const s = rows[0];
  const C = {
    artcod:     findCol(s, ['artcod','codigo','cod','article','item']),
    descr:      findCol(s, ['descr','description','descripcion','desc','nombre']),
    assortment: findCol(s, ['assortment','surtido']),
    semuds:     findCol(s, ['antuds','ant_uds','ventas_mes']),
    semuds_sem: findCol(s, ['semuds','sem_uds','ventas_sem']),
    anouds:     findCol(s, ['anouds','ano_uds','ventas_ano','ventas_año']),
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
    pv:         findCol(s, ['pv','pendiente','pending','qty_pending','qty_incoming']),
    endsale:    findCol(s, ['endsaledate','end_sale_date','end sale date','fecha fin venta','fechafinventa']),
    startsale:  findCol(s, ['startsaledate','start_sale_date','start sale date','fecha inicio venta','fechainicioventa']),
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
      s:   semuds,
      sw:  C.semuds_sem ? safeNum(r[C.semuds_sem]) : null,
      sa:  C.anouds     ? safeNum(r[C.anouds])     : null,
      pl: pall, md: mdq, pe: peso, vo: safeNum(r[C.vol]),
      lc:  loc,    mx:  safeNum(r[C.maxpick]),    mn:  safeNum(r[C.minpick]),
      la:  locaux, mxa: safeNum(r[C.maxpickaux]), mna: safeNum(r[C.minpickaux]),
      wc:  pall <= 0 ? '?' : pall <= 30 ? 'Voluminoso' : pall <= 200 ? 'Mediano' : 'Pequeño',
      es:  C.endsale   ? parseExcelDate(r[C.endsale])   : null,
      ss:  C.startsale ? parseExcelDate(r[C.startsale]) : null,
      st:  C.socktotal ? safeNum(r[C.socktotal]) : 0,
      pv:  C.pv        ? safeNum(r[C.pv])        : 0,
      pr:  calcPri(hasAnyLoc, semuds, pall),
    };
  }).filter(a => a && a.i);
}

function calcPri(hasAny, s, pl) {
  if (!hasAny && s >= CFG.rotacion && pl > 0 && pl <= 30) return 'CRÍTICA';
  if (!hasAny && s >= CFG.rotacion)                       return 'ALTA';
  if (!hasAny && s > 0)                                   return 'MEDIA';
  if ( hasAny && s >= CFG.rotacion)                       return 'OK';
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
      ? { i: a.i, d: a.d, s: a.s, pl: a.pl, pe: a.pe, vo: a.vo, mx: a.mx,  mn: a.mn,  la: a.la, lc: a.lc, a: a.a }
      : { i: a.i, d: a.d, s: a.s, pl: a.pl, pe: a.pe, vo: a.vo, mx: a.mxa, mn: a.mna, la: a.la, lc: a.lc, a: a.a }
    );

    // Volumen ocupado si se repone al máximo, y % de capacidad usada (solo picking/suelo)
    let capDm3 = null, volOcup = null, pctUsado = null;
    if (type === 'picking' || type === 'suelo') {
      capDm3  = cap * 1000; // m³ -> dm³
      volOcup = artSnap.reduce((sum, a) => sum + (a.vo || 0) * (a.mx || 0), 0);
      pctUsado = capDm3 > 0 ? (volOcup / capDm3 * 100) : null;
    }

    // Pallets ocupados/libres — solo aplica a suelo (.0.0), capacidad fija de 3 pallets.
    // Por cada artículo: pallets = ceil(max_reposición_uds / uds_por_pallet)
    let palletsOcup = null, palletsFree = null;
    if (type === 'suelo') {
      palletsOcup = artSnap.reduce((sum, a) => {
        if (!a.pl || a.pl <= 0 || !a.mx || a.mx <= 0) return sum;
        return sum + Math.ceil(a.mx / a.pl);
      }, 0);
      palletsFree = Math.max(0, PALLETS_POR_SUELO - palletsOcup);
    }

    const loc = { c: code, p, e, h, pos, cap, lt: type, almacen: isCen ? 'CENTRAL' : 'AUXILIAR1',
                   arts: artSnap, capDm3, volOcup, pctUsado, palletsOcup, palletsFree };
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

  // HEAVY: artículos pesados y de alta rotación sin posición de suelo en ningún almacén
  HEAVY = [];
  [...LOCS_C, ...LOCS_A].forEach(loc => {
    if (loc.lt === 'suelo') return;
    loc.arts.forEach(a => {
      if (a.pe <= CFG.pesado || a.s < CFG.rotacion) return;
      const floors = artFloor[a.i] || { c: false, a: false };
      if (floors.c || floors.a) return;
      HEAVY.push({ loc: loc.c, lt: loc.lt, almacen: loc.almacen, i: a.i, d: a.d, pe: a.pe, pl: a.pl, s: a.s });
    });
  });

  // BYE: artículos fuera de surtido (NS) que aún tienen localización asignada
  // — un registro por cada localización que ocupan (puede estar en Central y/o Aux1)
  BYE = [];
  ARTS.filter(a => a.a === 'NS' && (a.lc || a.la)).forEach(a => {
    if (a.lc) BYE.push({
      i: a.i, d: a.d, loc: a.lc, almacen: 'CENTRAL',
      mx: a.mx, mn: a.mn, s: a.s, pe: a.pe, md: a.md, endsale: a.es,
      st: a.st, pv: a.pv,
    });
    if (a.la) BYE.push({
      i: a.i, d: a.d, loc: a.la, almacen: 'AUXILIAR1',
      mx: a.mxa, mn: a.mna, s: a.s, pe: a.pe, md: a.md, endsale: a.es,
      st: a.st, pv: a.pv,
    });
  });
  // NS_LOCS: lookup rápido de códigos de localización con algún artículo NS (para color en mapa)
  NS_LOCS = new Set(BYE.map(b => b.loc));

  // LIBRE_ALL: todas las posiciones de picking y suelo, con sus datos de volumen
  // (la clasificación "libre / espacio disponible" se filtra luego según freeThreshold)
  LIBRE_ALL = [...LOCS_C, ...LOCS_A].filter(l => l.lt === 'picking' || l.lt === 'suelo');

  // FLOOR_FREE: códigos de suelo con al menos 1 pallet libre (capacidad fija 3 pallets/suelo)
  FLOOR_FREE = new Set(
    LIBRE_ALL.filter(l => l.lt === 'suelo' && l.palletsFree > 0).map(l => l.c)
  );

  // LOW_ROT: top N localizaciones de menor venta/sem, por almacén y tipo (suelo/picking)
  function top5LowSales(locsArr, lt) {
    return locsArr
      .filter(l => l.lt === lt && l.arts.length)
      .map(l => ({ c: l.c, s: Math.min(...l.arts.map(a => a.s)) }))
      .sort((a, b) => a.s - b.s)
      .slice(0, CFG.topN)
      .map(l => l.c);
  }
  LOW_ROT = {
    csuelo: new Set(top5LowSales(LOCS_C, 'suelo')),
    cpick:  new Set(top5LowSales(LOCS_C, 'picking')),
    asuelo: new Set(top5LowSales(LOCS_A, 'suelo')),
    apick:  new Set(top5LowSales(LOCS_A, 'picking')),
  };

  // HIGH_ROT: top N localizaciones de mayor venta/sem, por almacén y tipo (suelo/picking)
  function top5HighSales(locsArr, lt) {
    return locsArr
      .filter(l => l.lt === lt && l.arts.length)
      .map(l => ({ c: l.c, s: Math.max(...l.arts.map(a => a.s)) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, CFG.topNHigh)
      .map(l => l.c);
  }
  HIGH_ROT = {
    csuelo: new Set(top5HighSales(LOCS_C, 'suelo')),
    cpick:  new Set(top5HighSales(LOCS_C, 'picking')),
    asuelo: new Set(top5HighSales(LOCS_A, 'suelo')),
    apick:  new Set(top5HighSales(LOCS_A, 'picking')),
  };

  STATS = {
    total_locs_c:  LOCS_C.length,
    total_locs_a:  LOCS_A.length,
    total_arts:    ARTS.length,
    arts_with_loc: ARTS.filter(a => a.lc || a.la).length,
    heavy_count:    HEAVY.length,
    no_loc_high:   ARTS.filter(a => !a.lc && !a.la && a.s >= CFG.rotacion).length,
  };
}
