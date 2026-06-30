// ════════════════════════════════════════════════════════════════
// map.js — Mapa del almacén basado en layout de planta
// Depende de: state.js
// ════════════════════════════════════════════════════════════════


// ── CAPAS DE LEYENDA ACTIVAS ─────────────────────────────────────
// Cada clave corresponde a data-layer en el HTML de la leyenda.
// true = visible en el mapa, false = oculto (cae a color base).
const LEGEND_LAYERS = {
  libre:    true,
  low:      true,
  high:     true,
  pallet:   true,
  ns:       true,
  heatmap:  false,  // mapa de calor — exclusivo con el resto
};

// Estado anterior de layers para restaurar al desactivar el heatmap
let _prevLayers = null;

function toggleLegendLayer(el) {
  const layer = el.getAttribute('data-layer');
  if (!layer || !(layer in LEGEND_LAYERS)) return;

  if (layer === 'heatmap') {
    const activating = !LEGEND_LAYERS.heatmap;
    if (activating) {
      _prevLayers = { ...LEGEND_LAYERS };
      Object.keys(LEGEND_LAYERS).forEach(k => { if (k !== 'heatmap') LEGEND_LAYERS[k] = false; });
      LEGEND_LAYERS.heatmap = true;
      // Difuminar los otros, nunca el propio botón heatmap
      document.querySelectorAll('.leg[data-layer]:not([data-layer="heatmap"])').forEach(e =>
        e.classList.add('leg-off')
      );
      el.classList.add('leg-heat-on');
      document.getElementById('heatCheck')?.classList.add('on');
      el.classList.remove('leg-off');
    } else {
      if (_prevLayers) Object.assign(LEGEND_LAYERS, _prevLayers);
      LEGEND_LAYERS.heatmap = false;
      _prevLayers = null;
      // Restaurar otros según su estado
      document.querySelectorAll('.leg[data-layer]:not([data-layer="heatmap"])').forEach(e => {
        const l = e.getAttribute('data-layer');
        e.classList.toggle('leg-off', !LEGEND_LAYERS[l]);
      });
      el.classList.remove('leg-heat-on');
      document.getElementById('heatCheck')?.classList.remove('on');
      el.classList.remove('leg-off');
    }
  } else {
    if (LEGEND_LAYERS.heatmap) return;
    LEGEND_LAYERS[layer] = !LEGEND_LAYERS[layer];
    el.classList.toggle('leg-off', !LEGEND_LAYERS[layer]);
  }

  if (document.getElementById('p-mapa').classList.contains('act')) {
    renderLayoutMap(currentLayout);
  }
}

// Calcula la venta mensual total de una estantería (suma de todos sus artículos con loc)
function heatValue(p, e, alm) {
  const MAP = alm === 'AUXILIAR1' ? MAP_A : MAP_C;
  const est = MAP[String(p)]?.[String(e)];
  if (!est) return 0;
  let total = 0;
  [...(est.s || []), ...(est.pk || [])].forEach(loc => {
    (loc.arts || []).forEach(a => { total += (a.s || 0); });
  });
  return total;
}

// Precalcula el mapa de calor para el layout activo
function buildHeatmap(layout) {
  const grid = layout.grid;
  const vals = {};

  grid.forEach(row => {
    (row || []).forEach(raw => {
      if (!raw || raw === '__MERGED__') return;
      const v = typeof raw === 'object' ? raw.v : raw;
      const parsed = parseCellCode(v);
      if (!parsed) return;
      const { p, e } = parsed;
      const alm = almacenForCell(p, e);
      if (!alm) return;
      const heat = heatValue(p, e, alm);
      const key = `${p},${e},${alm}`;
      vals[key] = heat;
    });
  });

  // Usar percentil 95 como máximo para que los outliers no desvirtúen
  const sorted = Object.values(vals).filter(v => v > 0).sort((a, b) => a - b);
  const p95idx = Math.floor(sorted.length * 0.90);
  const cap    = sorted[p95idx] || sorted[sorted.length - 1] || 1;

  // Normalizar en [0,1] usando el cap — valores por encima del p95 = 1
  const norm = {};
  Object.entries(vals).forEach(([k, v]) => {
    norm[k] = Math.min(1, v / cap);
  });

  return { vals, norm };
}

function heatColor(norm) {
  // Paleta: azul frío → verde azulado → verde → amarillo/dorado → naranja → rojo
  const stops = [
    [0.00, '#4e9bb5'],  // azul frío
    [0.20, '#4aab8e'],  // verde azulado
    [0.40, '#7bb854'],  // verde
    [0.60, '#d4b84a'],  // amarillo dorado
    [0.80, '#e07c3a'],  // naranja
    [1.00, '#c0392b'],  // rojo
  ];
  // Encontrar los dos stops entre los que cae norm e interpolar
  let i = 0;
  while (i < stops.length - 2 && norm > stops[i + 1][0]) i++;
  const [t0, c0] = stops[i];
  const [t1, c1] = stops[i + 1];
  const f = (norm - t0) / (t1 - t0);
  // Interpolar RGB
  const hex = c => parseInt(c, 16);
  const lerp = (a, b) => Math.round(a + (b - a) * f);
  const r0 = hex(c0.slice(1,3)), g0 = hex(c0.slice(3,5)), b0 = hex(c0.slice(5,7));
  const r1 = hex(c1.slice(1,3)), g1 = hex(c1.slice(3,5)), b1 = hex(c1.slice(5,7));
  const r = lerp(r0,r1), g = lerp(g0,g1), b = lerp(b0,b1);
  return `rgb(${r},${g},${b})`;
}


// ── CONSTRUCCIÓN DE LOOKUPS ──────────────────────────────────────
// MAP_C / MAP_A siguen existiendo para el panel SVG de estantería (shelf.js)

function buildMaps() {
  MAP_C = {}; MAP_A = {}; LOC_DATA = {};

  function addToMap(MAP, loc) {
    LOC_DATA[loc.c] = { cap: loc.cap, lt: loc.lt, arts: loc.arts, almacen: loc.almacen,
                        capDm3: loc.capDm3, volOcup: loc.volOcup, pctUsado: loc.pctUsado,
                        palletsOcup: loc.palletsOcup, palletsFree: loc.palletsFree };
    if (loc.lt === 'altura') return;
    const p = String(loc.p), e = String(loc.e);
    if (!MAP[p])    MAP[p]    = {};
    if (!MAP[p][e]) MAP[p][e] = { s: [], pk: [] };
    const entry = { c: loc.c, cap: loc.cap, pos: loc.pos, arts: loc.arts };
    if (loc.lt === 'suelo') MAP[p][e].s.push(entry);
    else                    MAP[p][e].pk.push(entry);
  }

  LOCS_C.forEach(loc => addToMap(MAP_C, loc));
  LOCS_A.forEach(loc => addToMap(MAP_A, loc));

  for (const M of [MAP_C, MAP_A])
    for (const p in M) for (const e in M[p]) {
      M[p][e].s.sort( (a, b) => a.pos - b.pos);
      M[p][e].pk.sort((a, b) => a.pos - b.pos);
    }
}


// ── RENDERIZADO DEL MAPA POR LAYOUT ─────────────────────────────

// Determina a qué almacén pertenece una celda del grid según su código (P3E5 → CENTRAL o AUXILIAR1)
// Para ello busca el pasillo+estantería en MAP_C primero, luego en MAP_A.
function almacenForCell(p, e) {
  if (MAP_C[String(p)] && MAP_C[String(p)][String(e)]) return 'CENTRAL';
  if (MAP_A[String(p)] && MAP_A[String(p)][String(e)]) return 'AUXILIAR1';
  return null;
}

// Extrae el string de valor de una celda del grid (string o {v,rows,cols})
function cellVal(cell) {
  if (!cell || cell === '__MERGED__') return null;
  return typeof cell === 'object' ? cell.v : cell;
}

// Parsea "P12E18" → {p:12, e:18} o null
function parseCellCode(code) {
  if (!code) return null;
  const m = String(code).match(/^P(\d+)E(\d+)$/);
  if (!m) return null;
  return { p: parseInt(m[1]), e: parseInt(m[2]) };
}

// Zonas especiales conocidas
const SPECIAL_ZONES = new Set(['MUELLE','ENTREGA','ENTRADA','RECEPCION','OFICINA','EXPEDICION',
                                'PARKING','PASILLO','RAMPA','ESCALERA','ASCENSOR']);

function isSpecial(code) {
  if (!code) return false;
  return SPECIAL_ZONES.has(code) || /^(MUELLE|ENTREGA|ENTRADA|RECEP|OFIC|EXPED|ZONA)/.test(code);
}

// Color y clase de una celda de estantería
function cellClass(p, e, alm) {
  const MAP = alm === 'AUXILIAR1' ? MAP_A : MAP_C;
  const est = MAP[String(p)] && MAP[String(p)][String(e)];
  if (!est) return 'cs-f';

  const allLocs = [...(est.s || []), ...(est.pk || [])];
  if (!allLocs.length) return 'cs-f';

  const allCodes = allLocs.map(l => l.c);

  // Prioridad: pallet → low → high → ns
  // ¿Tiene algún suelo con pallet libre?
  if (LEGEND_LAYERS.pallet) {
    const sueloCodes = (est.s || []).map(l => l.c);
    if (sueloCodes.some(c => FLOOR_FREE.has(c))) return 'x-pallet';
  }

  // ¿Está en top N baja rotación?
  if (LEGEND_LAYERS.low) {
    const lowSuelo = alm === 'AUXILIAR1' ? LOW_ROT.asuelo : LOW_ROT.csuelo;
    const lowPick  = alm === 'AUXILIAR1' ? LOW_ROT.apick  : LOW_ROT.cpick;
    if (allCodes.some(c => lowSuelo.has(c) || lowPick.has(c))) return 'x-low';
  }

  // ¿Está en top N alta rotación?
  if (LEGEND_LAYERS.high) {
    const highSuelo = alm === 'AUXILIAR1' ? HIGH_ROT.asuelo : HIGH_ROT.csuelo;
    const highPick  = alm === 'AUXILIAR1' ? HIGH_ROT.apick  : HIGH_ROT.cpick;
    if (allCodes.some(c => highSuelo.has(c) || highPick.has(c))) return 'x-high';
  }

  // ¿Tiene algún artículo fuera de surtido (NS)?
  if (LEGEND_LAYERS.ns) {
    if (allCodes.some(c => NS_LOCS.has(c))) return 'x-ns';
  }

  // ¿Hay alguna localización ocupada?
  const anyOcc = allLocs.some(l => l.arts && l.arts.length);
  if (!anyOcc) return LEGEND_LAYERS.libre ? 'cs-f' : 'cs-o';

  return 'cs-o';
}

// Datos para el tooltip de una celda de layout (agrega todas sus localizaciones)
function locDataForCell(p, e, alm) {
  const MAP = alm === 'AUXILIAR1' ? MAP_A : MAP_C;
  const est = MAP[String(p)] && MAP[String(p)][String(e)];
  if (!est) return null;
  // Devolver la primera localización con datos (suelo preferente, luego picking)
  const all = [...(est.s || []), ...(est.pk || [])];
  return all.length ? all[0].c : null;
}

// Renderiza el layout activo en #mapCont
function renderLayoutMap(layoutIdx) {
  currentLayout = layoutIdx ?? 0;
  const layout  = LAYOUTS[currentLayout];
  if (!layout) {
    document.getElementById('mapCont').innerHTML =
      '<div style="color:var(--mu);padding:20px">No hay layout de planta disponible.</div>';
    return;
  }

  const grid  = layout.grid;
  const nRows = layout.nRows || grid.length;
  const nCols = layout.nCols || Math.max(...grid.map(r => r.length));
  const GAP   = 1;

  // Tamaño de celda: medir el contenedor real tras el primer render
  // Primera pasada: usar estimación. Segunda pasada (rAF): medida real.
  // El panel derecho tiene la altura correcta — usarla como referencia para el mapa
  const mapSideEl     = document.getElementById('mapSidePanel');
  const availH        = mapSideEl ? mapSideEl.getBoundingClientRect().height : (window.innerHeight - 114);
  const spaceForCells = availH - GAP * (nRows - 1);
  const CELL_PX       = Math.min(28, Math.max(5, Math.floor(spaceForCells / nRows)));

  // Grid CSS: cada columna y fila mide exactamente CELL_PX
  const colTemplate = `repeat(${nCols}, ${CELL_PX}px)`;
  const rowTemplate = `repeat(${nRows}, ${CELL_PX}px)`;

  // Precalcular mapa de calor si está activo
  let heatData = null;
  if (LEGEND_LAYERS.heatmap) heatData = buildHeatmap(layout);
  let html = `<div class="layout-grid" style="
    display:grid;
    grid-template-columns:${colTemplate};
    grid-template-rows:${rowTemplate};
    gap:${GAP}px;
    overflow:visible;
  ">`;

  for (let r = 0; r < nRows; r++) {
    for (let c = 0; c < nCols; c++) {
      const raw  = (grid[r] || [])[c];

      // Saltar celdas cubiertas por merge — la origen ya tiene el span
      if (raw === '__MERGED__') continue;

      // Obtener valor y span
      const isObj = raw && typeof raw === 'object';
      const v     = cellVal(raw);
      const spanC = isObj ? (raw.cols || 1) : 1;
      const spanR = isObj ? (raw.rows || 1) : 1;
      const pos   = `grid-column:${c+1}/span ${spanC};grid-row:${r+1}/span ${spanR};`;

      // Celda vacía — no generar ningún div (el grid la deja vacía automáticamente)
      if (!v) continue;

      // Zona especial
      if (isSpecial(v)) {
        html += `<div class="layout-special-region" style="${pos}">${v}</div>`;
        continue;
      }

      const parsed = parseCellCode(v);
      if (!parsed) {
        html += `<div class="layout-cell layout-unknown" style="${pos}" title="${v}">${v.substring(0,6)}</div>`;
        continue;
      }

      const { p, e } = parsed;
      const alm      = almacenForCell(p, e);
      if (!alm) {
        html += `<div class="layout-cell cs-f" style="opacity:.4;${pos}" title="${v}"></div>`;
        continue;
      }

      let styleExtra = '';
      let cls;
      if (heatData) {
        const norm = heatData.norm[`${p},${e},${alm}`] ?? 0;
        // Cuantizar a 8 colores fijos
        const quantNorm = Math.min(7, Math.floor(norm * 8)) / 7;
        const col  = heatColor(quantNorm);

        // Vecino real considerando el span — si hay hueco vacío sigue buscando
        const neighborColor = (dr, dc) => {
          let nr = dr < 0 ? r - 1 : dr > 0 ? r + spanR : r;
          let nc = dc < 0 ? c - 1 : dc > 0 ? c + spanC : c;

          // Buscar hasta encontrar una celda con color (saltando huecos vacíos)
          for (let step = 0; step < 6; step++) {
            if (nr < 0 || nr >= nRows || nc < 0 || nc >= nCols) return null;
            let nraw = (grid[nr] || [])[nc];
            // Si es __MERGED__ buscar la celda origen
            if (nraw === '__MERGED__') {
              for (let sr = nr; sr >= 0; sr--) {
                for (let sc = nc; sc >= 0; sc--) {
                  const t = (grid[sr] || [])[sc];
                  if (t && t !== '__MERGED__') { nraw = t; break; }
                }
                if (nraw !== '__MERGED__') break;
              }
            }
            const nv = cellVal(nraw);
            if (nv) {
              const np = parseCellCode(nv);
              if (!np) return null;
              const nalm = almacenForCell(np.p, np.e);
              if (!nalm) return null;
              const nnorm = heatData.norm[`${np.p},${np.e},${nalm}`];
              if (nnorm === undefined) return null;
              const nquant = Math.min(7, Math.floor(nnorm * 8)) / 7;
              return heatColor(nquant);
            }
            // Celda vacía — seguir buscando en la misma dirección
            nr += dr;
            nc += dc;
          }
          return null;
        };

        const blendRgba = (c1, c2) => {
          if (!c2) return 'transparent'; // sin vecino = no tapar nada
          const m1 = c1.match(/\d+/g), m2 = c2.match(/\d+/g);
          if (!m1 || !m2) return 'transparent';
          const rv = Math.round((+m1[0] + +m2[0]) / 2);
          const gv = Math.round((+m1[1] + +m2[1]) / 2);
          const bv = Math.round((+m1[2] + +m2[2]) / 2);
          return `rgba(${rv},${gv},${bv},0.85)`;
        };
        const cL = blendRgba(col, neighborColor(0, -1));
        const cR = blendRgba(col, neighborColor(0,  1));
        const cT = blendRgba(col, neighborColor(-1, 0));
        const cB = blendRgba(col, neighborColor( 1, 0));

        // Gradiente: centro=col, bordes=color mezclado con vecino
        styleExtra = `background:
          linear-gradient(to right,  ${cL} 0%, transparent 100%),
          linear-gradient(to left,   ${cR} 0%, transparent 100%),
          linear-gradient(to bottom, ${cT} 0%, transparent 100%),
          linear-gradient(to top,    ${cB} 0%, transparent 100%),
          ${col};`;
        cls = 'cs-o';
      } else {
        cls = cellClass(p, e, alm);
      }

      const firstLoc = locDataForCell(p, e, alm);
      html += `<div class="layout-cell loc-cell ${cls}"
        data-loc="${firstLoc || ''}" data-p="${p}" data-e="${e}" data-alm="${alm}"
        title="${v}" style="${pos}${styleExtra}"
        onmouseenter="showTT(event,this)"
        onclick="openShelfDetail(this)"></div>`;
    }
  }

  html += '</div>';
  document.getElementById('mapCont').innerHTML = html;
}


// ── TOOLTIP ──────────────────────────────────────────────────────

const ttEl = document.getElementById('tt');

function firstWords(str, n) {
  return (str || '').split(' ').slice(0, n).join(' ');
}

function showTT(e, el) {
  // Resetear estado del tooltip anterior
  ttEl.style.pointerEvents = 'none';

  const p   = el.getAttribute('data-p');
  const est = el.getAttribute('data-e');
  const alm = el.getAttribute('data-alm');
  if (!p || !est || !alm) return;

  const MAP     = alm === 'AUXILIAR1' ? MAP_A : MAP_C;
  const estData = MAP[String(p)] && MAP[String(p)][String(est)];
  if (!estData) return;

  const isAux = alm === 'AUXILIAR1';
  const suelos = (estData.s  || []);
  const picks  = (estData.pk || []).sort((a,b) => a.pos - b.pos);
  const allPos = [...suelos, ...picks];
  if (!allPos.length) return;

  let h = `<div class="tt-header">
    <span class="tt-code${isAux ? ' aux' : ''}">P${p} · E${est}</span>
    <span class="tt-alm" style="color:${isAux ? 'var(--aux-lbl)' : 'var(--b2)'}">${alm}</span>
  </div>`;

  // Cabecera de columnas
  h += `<div class="tt-row-art tt-col-header">
    <span class="tt-row-code">Código</span>
    <span class="tt-row-desc">Descripción</span>
    <span class="tt-row-stat">Vta/mes</span>
    <span class="tt-row-stat">Peso</span>
    <span class="tt-row-warn"></span>
  </div>`;

  h += `<div class="tt-rows">`;

  allPos.forEach(posEntry => {
    const ld  = LOC_DATA[posEntry.c];
    if (!ld) return;
    const { lt, arts, cap } = ld;
    const isFloor  = lt === 'suelo';
    const posLabel = isFloor ? '0.0 · Suelo' : posEntry.c.split('.').slice(2).join('.');

    const lowSet = isAux
      ? (isFloor ? LOW_ROT.asuelo : LOW_ROT.apick)
      : (isFloor ? LOW_ROT.csuelo : LOW_ROT.cpick);
    const isLow  = lowSet && lowSet.has(posEntry.c);
    const minS   = isLow && arts.length ? Math.min(...arts.map(a => a.s)) : null;

    const highSet = isAux
      ? (isFloor ? HIGH_ROT.asuelo : HIGH_ROT.apick)
      : (isFloor ? HIGH_ROT.csuelo : HIGH_ROT.cpick);
    const isHigh  = highSet && highSet.has(posEntry.c);
    const maxS    = isHigh && arts.length ? Math.max(...arts.map(a => a.s)) : null;

    h += `<div class="tt-row-pos">
      <div class="tt-row-lbl${isFloor ? ' suelo' : ''}">
        <span>${posLabel}</span>
        <span class="tt-row-cap">${cap > 0 ? cap + ' m²' : ''}</span>
      </div>`;

    if (isFloor && ld.palletsFree !== null && ld.palletsFree > 0) {
      h += `<div class="tt-row-pallet">🟦 ${ld.palletsFree}/${PALLETS_POR_SUELO} pallets libres
        <span style="color:var(--mu);font-weight:400">(${ld.palletsOcup} ocupados)</span></div>`;
    }

    if (!arts.length) {
      h += `<div class="tt-row-art tt-row-empty">
        <span class="tt-row-code">—</span>
        <span class="tt-row-desc" style="color:var(--gn)">✓ Libre</span>
        <span class="tt-row-stat"></span>
        <span class="tt-row-stat"></span>
        <span class="tt-row-warn"></span>
      </div>`;
    } else {
      arts.forEach(a => {
        const revisar = a.pe > CFG.pesado && a.s >= CFG.rotacion && !isFloor;
        const lowArt  = isLow && a.s === minS;
        const highArt = isHigh && a.s === maxS;
        const nsArt   = a.a === 'NS';
        h += `<div class="tt-row-art">
          <span class="tt-row-code">${a.i}</span>
          <span class="tt-row-desc">${firstWords(a.d, 4)}</span>
          <span class="tt-row-stat" style="color:${a.s >= CFG.rotacion ? 'var(--gn)' : a.s < 0 ? 'var(--rd)' : 'var(--mu)'}">${a.s}</span>
          <span class="tt-row-stat" style="color:${a.pe > CFG.pesado ? 'var(--or)' : 'var(--mu)'}">${a.pe > 0 ? a.pe + 'kg' : '—'}</span>
          <span class="tt-row-warn">${revisar ? '🟠' : ''}${lowArt ? '🟣' : ''}${highArt ? '🔴' : ''}${nsArt ? '🔘' : ''}</span>
        </div>`;
      });
    }
    h += `</div>`;
  });

  h += `</div>`;

  ttEl.innerHTML = h;
  ttEl.style.pointerEvents = 'auto';
  ttEl.style.display = 'block';

  // Fijar posición junto a la celda
  const ttW = 424;
  const ttH = Math.min(ttEl.scrollHeight || 480, 480);
  let x = e.clientX + 14, y = e.clientY + 14;
  if (x + ttW > window.innerWidth  - 8) x = e.clientX - ttW - 10;
  if (y + ttH > window.innerHeight - 8) y = e.clientY - ttH - 10;
  ttEl.style.left = Math.max(4, x) + 'px';
  ttEl.style.top  = Math.max(4, y) + 'px';
}

function hideTT() {
  ttEl.style.display       = 'none';
  ttEl.style.pointerEvents = 'none';
}

// Lógica única de visibilidad: ocultar solo si el ratón no está
// ni sobre una celda del mapa ni sobre el propio tooltip
document.addEventListener('mousemove', e => {
  if (ttEl.style.display === 'none') return;
  const overTooltip = ttEl.contains(e.target) || ttEl === e.target;
  const overCell    = e.target && e.target.classList && e.target.classList.contains('loc-cell');
  if (!overTooltip && !overCell) hideTT();
});


// ── PANEL LATERAL DE BÚSQUEDA ────────────────────────────────────

// Helper multi-término (mismo que en views.js — duplicado para independencia de módulo)
function _matchTerms(raw, fields) {
  if (!raw) return true;
  const terms = raw.split('*').map(t => t.trim()).filter(Boolean);
  if (!terms.length) return true;
  const haystack = fields.map(f => (f || '').toLowerCase()).join(' ');
  return terms.every(t => haystack.includes(t));
}

function mapSideSearch(q) {
  const term = (q || '').trim().toLowerCase();

  // Limpiar highlights del mapa
  document.querySelectorAll('.loc-cell.map-highlight').forEach(el => el.classList.remove('map-highlight'));
  document.getElementById('mapSearchInfo').textContent = '';

  const cont = document.getElementById('mapSideContent');

  if (!term) {
    cont.innerHTML = '<div class="msp-empty">Escribe para buscar artículos</div>';
    return;
  }

  const matched = ARTS.filter(a =>
    _matchTerms(term, [a.i, a.d, a.lc, a.la])
  ).sort((a, b) => {
    const priA = a.a === 'S' ? 0 : (a.st > 0 || a.pv > 0) ? 1 : 2;
    const priB = b.a === 'S' ? 0 : (b.st > 0 || b.pv > 0) ? 1 : 2;
    if (priA !== priB) return priA - priB;
    // Mismo grupo: S → más ventas primero; NS → más stock+PV primero
    if (priA === 0) return (b.s || 0) - (a.s || 0);
    return ((b.st || 0) + (b.pv || 0)) - ((a.st || 0) + (a.pv || 0));
  }).slice(0, 80);

  if (!matched.length) {
    cont.innerHTML = '<div class="msp-empty">Sin resultados</div>';
    return;
  }

  // Resaltar celdas en el mapa
  const locs = new Set();
  matched.forEach(a => { if (a.lc) locs.add(a.lc); if (a.la) locs.add(a.la); });
  let found = 0;
  document.querySelectorAll('.loc-cell[data-loc]').forEach(el => {
    const locCode = el.getAttribute('data-loc');
    const p = el.getAttribute('data-p'), estEl = el.getAttribute('data-e');
    const alm = el.getAttribute('data-alm');
    let hit = locs.has(locCode);
    if (!hit && p && estEl && alm) {
      const MAP = alm === 'AUXILIAR1' ? MAP_A : MAP_C;
      const est = MAP[p] && MAP[p][estEl];
      if (est) hit = [...(est.s||[]),...(est.pk||[])].some(l => locs.has(l.c));
    }
    if (hit) { el.classList.add('map-highlight'); found++; }
  });

  if (found) {
    const first = document.querySelector('.loc-cell.map-highlight');
    if (first) first.scrollIntoView({ behavior:'smooth', block:'center', inline:'center' });
    document.getElementById('mapSearchInfo').textContent =
      `${matched.length} artículo(s) · ${found} celda(s)`;
  }

  // Renderizar lista de resultados
  const rows = matched.map(a => `
    <div class="msp-row" onclick="showArtCard('${a.i}')">
      <span class="msp-code">${a.i}</span>
      <span class="msp-desc">${a.d}</span>
    </div>`).join('');

  cont.innerHTML = `
    <div class="msp-count">${matched.length} resultado${matched.length!==1?'s':''}</div>
    <div class="msp-list">${rows}</div>`;
}

function mapSideClear() {
  const input = document.getElementById('mapSearch');
  if (input) input.value = '';
  mapSideSearch('');
}

// Alias para compatibilidad (clearMapHighlight se llama desde otros sitios)
function clearMapHighlight() { mapSideClear(); }
function highlightArtOnMap(q) { mapSideSearch(q); }

// ── TARJETA DE ARTÍCULO ──────────────────────────────────────────

function showArtCard(artId) {
  const a = ARTS.find(x => x.i === artId);
  if (!a) return;

  // Resaltar solo las celdas de este artículo — quitar el resto
  const artLocs = new Set([a.lc, a.la].filter(Boolean));
  document.querySelectorAll('.loc-cell.map-highlight').forEach(el => el.classList.remove('map-highlight'));
  document.querySelectorAll('.loc-cell[data-loc]').forEach(el => {
    const locCode = el.getAttribute('data-loc');
    const p = el.getAttribute('data-p'), estEl = el.getAttribute('data-e');
    const alm = el.getAttribute('data-alm');
    let hit = artLocs.has(locCode);
    if (!hit && p && estEl && alm) {
      const MAP = alm === 'AUXILIAR1' ? MAP_A : MAP_C;
      const est = MAP[p] && MAP[p][estEl];
      if (est) hit = [...(est.s||[]),...(est.pk||[])].some(l => artLocs.has(l.c));
    }
    if (hit) el.classList.add('map-highlight');
  });
  const first = document.querySelector('.loc-cell.map-highlight');
  if (first) first.scrollIntoView({ behavior:'smooth', block:'center', inline:'center' });

  const fmt  = d => d ? d.toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit',year:'2-digit'}) : null;
  const val  = v => (v !== null && v !== undefined && v !== 0 && v !== '') ? v : null;
  const row  = (label, value, extra) => value !== null && value !== undefined
    ? `<div class="ac-row"><span class="ac-lbl">${label}</span><span class="ac-val">${value}${extra||''}</span></div>`
    : '';

  const surtBadge = a.a === 'S'  ? '<span class="badge b-gn">En surtido</span>'
                  : a.a === 'NS' ? '<span class="badge b-gy">Fuera de surtido</span>'
                  : `<span class="badge b-bl">${a.a||'—'}</span>`;

  let locC = '';
  if (a.lc) {
    locC = `<div class="ac-loc-block">
      <div class="ac-loc-title" style="color:var(--b2)">📦 Central</div>
      ${row('Ubicación', `<span style="color:var(--b2);font-weight:700">${a.lc}</span>`)}
      ${row('Máximo', val(a.mx), ' uds')}
      ${row('Mínimo', val(a.mn), ' uds')}
    </div>`;
  }

  let locA = '';
  if (a.la) {
    locA = `<div class="ac-loc-block">
      <div class="ac-loc-title" style="color:var(--aux-lbl)">📦 Auxiliar1</div>
      ${row('Ubicación', `<span style="color:var(--aux-lbl);font-weight:700">${a.la}</span>`)}
      ${row('Máximo', val(a.mxa), ' uds')}
      ${row('Mínimo', val(a.mna), ' uds')}
    </div>`;
  }

  const html = `
    <div class="art-card">
      <button class="ac-back" onclick="mapSideBack()">← Volver a resultados</button>
      <div class="ac-photo-placeholder" id="ac-photo-${a.i}">
        <span class="ac-photo-spinner">⏳</span>
      </div>
      <div class="ac-section">
        <div class="ac-section-title">Identificación</div>
        ${row('Código', `<strong>${a.i}</strong>`)}
        ${row('Descripción', a.d)}
        ${row('Surtido', surtBadge)}
        ${a.hfb ? row('HFB', a.hfb) : ''}
        ${a.fam ? row('FAM', a.fam) : ''}
      </div>
      <div class="ac-section">
        <div class="ac-section-title">Físico</div>
        ${row('Uds/pallet', val(a.pl))}
        ${row('Volumen', `<span class="badge ${wcls(a.wc)}" style="font-size:11px">${a.wc}</span> ${val(a.vo)} dm³`)}
        ${row('Peso', `<span class="badge ${pcls_w(a.pc)}" style="font-size:11px">${a.pc}</span> ${val(a.pe)} kg`)}
        ${row('MDQ', val(a.md))}
      </div>
      <div class="ac-section" id="ac-bultos-${a.i}">
        <div class="ac-section-title">Embalaje</div>
        <div class="ac-row"><span class="ac-lbl" style="color:var(--mu)">Cargando...</span></div>
      </div>
      <div class="ac-section">
        <div class="ac-section-title">Ventas</div>
        ${row('Vta/mes', val(a.s), ' uds')}
        ${a.sw != null ? row('Vta/sem', val(a.sw), ' uds') : ''}
        ${a.sa != null ? row('Vta/año', val(a.sa), ' uds') : ''}
        ${row('Inicio venta', fmt(a.ss))}
        ${row('Fin venta', fmt(a.es))}
      </div>
      ${(a.lc || a.la) ? `<div class="ac-section">
        <div class="ac-section-title">Localización</div>
        ${locC}${locA}
      </div>` : ''}
      <div class="ac-section">
        <div class="ac-section-title">Stock</div>
        ${row('Stock total', val(a.st), ' uds')}
        ${row('Pedido en camino', val(a.pv), ' uds')}
      </div>
    </div>`;

  const cont = document.getElementById('mapSideContent');
  cont._listHTML = cont.innerHTML;
  cont.innerHTML = html;

  _loadWtsData(a.i);
}

async function _loadWtsData(artId) {
  const photoEl = document.getElementById(`ac-photo-${artId}`);
  const bultosEl = document.getElementById(`ac-bultos-${artId}`);
  // ponytail: worker CF hace de proxy para ikea.com (CORS), foto via API pública
  const PROXY = 'https://throbbing-poetry-f00b.danielcb89.workers.dev/?url=';

  try {
    // 1. Foto via API pública (sin CORS)
    const srResp = await fetch(`https://sik.search.blue.cdtapps.com/es/es/search-result-page?q=${artId}&size=1`);
    if (srResp.ok) {
      const srData = await srResp.json();
      const item = srData?.searchResultPage?.products?.main?.items?.[0]?.product;
      if (photoEl) {
        if (item?.mainImageUrl) {
          photoEl.innerHTML = `<img src="${item.mainImageUrl}" alt="${item.name || ''}"
            style="width:100%;height:100%;object-fit:contain;border-radius:4px;">`;
        } else {
          photoEl.innerHTML = '<span>📷</span><span>Sin foto</span>';
        }
      }

      // 2. Paquetes y medidas via Worker → pipUrl de ikea.com
      if (item?.pipUrl && bultosEl) {
        const pipResp = await fetch(PROXY + encodeURIComponent(item.pipUrl));
        if (pipResp.ok) {
          const html = await pipResp.text();
          // ponytail: buscar "packaging":{ y extraer el objeto con depth counter
          const pkgIdx = html.indexOf('"packaging":{"numberOfPackages"');
          if (pkgIdx !== -1) {
            try {
              const start = pkgIdx + '"packaging":'.length;
              const chunk = html.slice(start);
              let depth = 0, end = -1;
              for (let ci = 0; ci < chunk.length; ci++) {
                if (chunk[ci] === '{') depth++;
                else if (chunk[ci] === '}') { depth--; if (depth === 0) { end = ci; break; } }
              }
              const pkg = JSON.parse(end !== -1 ? chunk.slice(0, end + 1) : chunk);
              const numBultos = pkg.numberOfPackages;
              const grupos = pkg.packages[0]?.measurementGroups || [];
              const multiGroup = grupos.length > 1;
              let html2 = `<div class="ac-section-title">Embalaje</div>
                <div class="ac-row"><span class="ac-lbl">Bultos</span><span class="ac-val">${numBultos} bulto${numBultos !== 1 ? 's' : ''}</span></div>`;
              grupos.forEach((g, i) => {
                if (multiGroup) {
                  html2 += `<div class="ac-loc-title" style="margin-top:6px;font-weight:600">${g.heading || ('Bulto ' + (i+1) + ' de ' + numBultos)}</div>`;
                }
                g.measurements.forEach(m => {
                  html2 += `<div class="ac-row"><span class="ac-lbl">${m.label}</span><span class="ac-val">${m.text}</span></div>`;
                });
              });
              bultosEl.innerHTML = html2;
            } catch(e) { bultosEl.innerHTML = '<div class="ac-section-title">Embalaje</div><div class="ac-row"><span class="ac-lbl">No disponible</span></div>'; }
          } else {
            bultosEl.innerHTML = '<div class="ac-section-title">Embalaje</div><div class="ac-row"><span class="ac-lbl">No disponible</span></div>';
          }
        }
      }
    }
  } catch (_) {
    if (photoEl) photoEl.innerHTML = '<span>📷</span><span>Sin foto</span>';
  }
}

// ── FICHA DE ARTÍCULO (panel completo, desde tablas) ────────────

let _adpFromView = null;
const VIEWS_ALL = ['mapa','arts','libre','bye','pesados','ajustes','artdetail'];

function openArtDetail(artId) {
  const a = ARTS.find(x => x.i === artId);
  if (!a) return;

  // Detectar la vista activa para poder volver
  _adpFromView = VIEWS_ALL.find(v => v !== 'artdetail' &&
    document.getElementById('p-' + v)?.classList.contains('act')) || 'arts';

  // Activar el panel de detalle igual que gotoView
  VIEWS_ALL.forEach(x => {
    document.getElementById('p-' + x)?.classList.toggle('act', x === 'artdetail');
    document.getElementById('n-' + x)?.classList.toggle('act', x === 'artdetail');
  });
  document.getElementById('sb-arts').style.display  = 'none';
  document.getElementById('sb-libre').style.display = 'none';

  document.getElementById('adpArtId').textContent = a.i;

  const fmt = d => d ? d.toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit',year:'2-digit'}) : null;
  const val = v => (v !== null && v !== undefined && v !== 0 && v !== '') ? v : null;
  const row = (lbl, v, unit) => v !== null && v !== undefined
    ? `<div class="adp-row"><span class="adp-row-lbl">${lbl}</span><span class="adp-row-val">${v}${unit||''}</span></div>`
    : '';
  const metric = (lbl, v, unit, color) => v !== null && v !== undefined && v !== 0 && v !== ''
    ? `<div class="adp-metric">
        <div class="adp-metric-lbl">${lbl}</div>
        <div class="adp-metric-val" ${color ? `style="color:${color}"` : ''}>${v}</div>
        ${unit ? `<div class="adp-metric-unit">${unit}</div>` : ''}
       </div>`
    : '';

  const surtBadge = a.a === 'S'  ? '<span class="badge b-gn" style="font-size:12px;padding:4px 10px">En surtido</span>'
                  : a.a === 'NS' ? '<span class="badge b-gy" style="font-size:12px;padding:4px 10px">Fuera de surtido</span>'
                  : `<span class="badge b-bl" style="font-size:12px;padding:4px 10px">${a.a||'—'}</span>`;
  const tipoBadge = (a.wc ? `<span class="badge ${wcls(a.wc)}" style="font-size:12px;padding:4px 10px">${a.wc}</span>` : '')
                  + (a.pc ? `<span class="badge ${pcls_w(a.pc)}" style="font-size:12px;padding:4px 10px">${a.pc}</span>` : '');

  // Localización
  let locHtml = '';
  if (a.lc || a.la) {
    const locC = a.lc ? `<div class="adp-loc-block">
      <div class="adp-loc-title" style="color:var(--b2)">📦 Central</div>
      <div class="adp-loc-code" style="color:var(--b2)">${a.lc}</div>
      <div class="adp-loc-minmax">Máx ${a.mx||'—'} · Mín ${a.mn||'—'} uds</div>
    </div>` : '';
    const locA = a.la ? `<div class="adp-loc-block aux">
      <div class="adp-loc-title" style="color:var(--aux-lbl)">📦 Auxiliar1</div>
      <div class="adp-loc-code" style="color:var(--aux-lbl)">${a.la}</div>
      <div class="adp-loc-minmax">Máx ${a.mxa||'—'} · Mín ${a.mna||'—'} uds</div>
    </div>` : '';
    locHtml = `<div class="adp-section">
      <div class="adp-section-title">Localización</div>
      <div class="adp-loc-grid">${locC}${locA}</div>
    </div>`;
  }

  const S = {
    row:    'display:flex;justify-content:space-between;align-items:center;padding:8px 16px;border-bottom:1px solid rgba(160,180,200,.18);font-size:12px',
    rowLbl: 'color:var(--mu)',
    rowVal: 'font-weight:600;color:var(--tx)',
  };
  const card  = (title, body) => `<div class="adp-card"><div class="adp-hdr">${title}</div>${body}</div>`;
  const drow  = (lbl, v, unit, color) => v !== null && v !== undefined
    ? `<div style="${S.row}"><span style="${S.rowLbl}">${lbl}</span><span style="${S.rowVal};${color?'color:'+color:''}">${v}${unit||''}</span></div>` : '';

  const metricHtml = (lbl, v, unit, color) => v !== null && v !== undefined && v !== 0 && v !== ''
    ? `<div style="padding:14px 16px;border-right:1px solid var(--win-border-light);border-bottom:1px solid var(--win-border-light);display:flex;flex-direction:column;gap:3px">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--mu)">${lbl}</div>
        <div style="font-size:26px;font-weight:800;line-height:1;color:${color||'var(--tx)'}">${v}</div>
        ${unit ? `<div style="font-size:10px;color:var(--mu)">${unit}</div>` : ''}
       </div>` : '';

  const locBlock = (lbl, code, max, min, color, isAux) =>
    `<div style="padding:14px 16px;${isAux?'background:rgba(0,120,100,.05)':''}border-right:1px solid var(--win-border-light)">
      <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:${color};margin-bottom:6px">${lbl}</div>
      <div style="font-size:24px;font-weight:800;color:${color};margin-bottom:4px">${code}</div>
      <div style="font-size:11px;color:var(--mu)">Máx <strong>${max||'—'}</strong> · Mín <strong>${min||'—'}</strong> uds</div>
    </div>`;

  document.getElementById('adpBody').innerHTML = `
    <div class="adp-card" style="display:grid;grid-template-columns:280px 1fr;gap:0;margin-bottom:16px">
      <div id="adp-photo-${a.i}" class="adp-photo-bg" style="height:220px;border-right:1px solid var(--win-border-dark);display:flex;align-items:center;justify-content:center;overflow:hidden;padding:12px">
        <div style="color:var(--mu);font-size:11px;display:flex;flex-direction:column;align-items:center;gap:6px"><span style="font-size:36px;opacity:.25">📷</span><span>Cargando...</span></div>
      </div>
      <div style="padding:22px 26px;display:flex;flex-direction:column;justify-content:center;gap:10px">
        <div style="font-size:11px;color:var(--mu);font-weight:600;letter-spacing:.5px"># ${a.i}</div>
        <div style="font-size:22px;font-weight:700;color:var(--tx);line-height:1.2">${a.d}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">${surtBadge}${tipoBadge}</div>
        ${(a.hfb || a.fam) ? `<div style="font-size:11px;color:var(--mu);display:flex;gap:16px;margin-top:2px">
          ${a.hfb ? `<span>HFB&nbsp;<strong style="color:var(--tx)">${a.hfb}</strong></span>` : ''}
          ${a.fam ? `<span>FAM&nbsp;<strong style="color:var(--tx)">${a.fam}</strong></span>` : ''}
        </div>` : ''}
      </div>
    </div>

    ${card('Datos físicos y ventas',
      `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr))">
        ${metricHtml('Uds/pallet', val(a.pl), 'uds')}
        ${metricHtml('Peso', val(a.pe), 'kg', a.pe > CFG.pesado ? 'var(--or)' : null)}
        ${metricHtml('Volumen', val(a.vo), 'dm³')}
        ${metricHtml('MDQ', val(a.md), 'uds')}
        ${a.sw != null ? metricHtml('Vta/sem', val(a.sw), 'uds') : ''}
        ${metricHtml('Vta/mes', val(a.s), 'uds', a.s >= CFG.rotacion ? 'var(--gn)' : null)}
        ${a.sa != null ? metricHtml('Vta/año', val(a.sa), 'uds') : ''}
        ${metricHtml('Stock total', val(a.st), 'uds')}
        ${metricHtml('Ped. camino', val(a.pv), 'uds', a.pv > 0 ? 'var(--or)' : null)}
      </div>`
    )}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px;align-items:start">

      <div style="display:flex;flex-direction:column;gap:16px">
        ${(a.lc || a.la) ? card('Localización',
          `<div style="display:grid;grid-template-columns:${a.lc && a.la ? '1fr 1fr' : '1fr'}">
            ${a.lc ? locBlock('📦 Central', a.lc, a.mx, a.mn, 'var(--b2)', false) : ''}
            ${a.la ? locBlock('📦 Auxiliar1', a.la, a.mxa, a.mna, 'var(--aux-lbl)', true) : ''}
          </div>`
        ) : ''}
        ${card('Fechas de venta',
          `<div>${drow('Inicio de venta', fmt(a.ss))}${drow('Fin de venta', fmt(a.es))}</div>`
        )}
      </div>

      <div id="adp-bultos-${a.i}" class="adp-card">
        <div class="adp-hdr">Embalaje</div>
        <div style="${S.row}"><span style="color:var(--mu)">Cargando desde IKEA...</span></div>
      </div>

    </div>`;

  _loadWtsDataDetail(a.i);
}

function closeArtDetail() {
  const back = _adpFromView || 'arts';

  VIEWS_ALL.forEach(x => {
    document.getElementById('p-' + x)?.classList.toggle('act', x === back);
    document.getElementById('n-' + x)?.classList.toggle('act', x === back);
  });
  document.getElementById('sb-arts').style.display  = back === 'arts'  ? 'block' : 'none';
  document.getElementById('sb-libre').style.display = back === 'libre' ? 'block' : 'none';
  if (back === 'arts')    renderArtsTable();
  if (back === 'mapa')    renderLayoutMap(currentLayout);
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.getElementById('p-artdetail')?.classList.contains('act')) closeArtDetail();
});

async function _loadWtsDataDetail(artId) {
  const panel    = document.getElementById('p-artdetail');
  const photoEl  = panel.querySelector(`#adp-photo-${artId}`);
  const bultosEl = panel.querySelector(`#adp-bultos-${artId}`);
  const PROXY    = 'https://throbbing-poetry-f00b.danielcb89.workers.dev/?url=';
  try {
    const srResp = await fetch(`https://sik.search.blue.cdtapps.com/es/es/search-result-page?q=${artId}&size=1`);
    if (!srResp.ok) throw new Error();
    const srData = await srResp.json();
    const item = srData?.searchResultPage?.products?.main?.items?.[0]?.product;
    if (photoEl) {
      if (item?.mainImageUrl) {
        photoEl.innerHTML = `<img src="${item.mainImageUrl}" alt="${item.name||''}" style="width:100%;height:100%;object-fit:contain">`;
      } else {
        photoEl.innerHTML = '<div class="adp-hero-placeholder"><span>📷</span><span>Sin foto disponible</span></div>';
      }
    }
    if (item?.pipUrl && bultosEl) {
      const pipResp = await fetch(PROXY + encodeURIComponent(item.pipUrl));
      if (pipResp.ok) {
        const html = await pipResp.text();
        const pkgIdx = html.indexOf('"packaging":{"numberOfPackages"');
        if (pkgIdx !== -1) {
          try {
            const start = pkgIdx + '"packaging":'.length;
            const chunk = html.slice(start);
            let depth = 0, end = -1;
            for (let ci = 0; ci < chunk.length; ci++) {
              if (chunk[ci] === '{') depth++;
              else if (chunk[ci] === '}') { depth--; if (depth === 0) { end = ci; break; } }
            }
            const pkg = JSON.parse(end !== -1 ? chunk.slice(0, end + 1) : chunk);
            const numBultos = pkg.numberOfPackages;
            const grupos = pkg.packages[0]?.measurementGroups || [];
            const multiGroup = grupos.length > 1;
            const RS = 'display:flex;justify-content:space-between;align-items:center;padding:5px 14px;border-bottom:1px solid rgba(160,180,200,.18);font-size:12px';
            let h = `<div class="adp-hdr">Embalaje · ${numBultos} bulto${numBultos!==1?'s':''}</div>`;
            grupos.forEach((g, i) => {
              if (multiGroup) h += `<div style="${RS};font-weight:700;color:var(--tx)">${g.heading||('Bulto '+(i+1)+' de '+numBultos)}</div>`;
              g.measurements.forEach(m => {
                h += `<div style="${RS}"><span style="color:var(--mu)">${m.label}</span><span style="font-weight:600">${m.text}</span></div>`;
              });
            });
            bultosEl.innerHTML = h;
          } catch { bultosEl.innerHTML = '<div style="padding:12px 16px;color:var(--mu);font-size:12px">No disponible</div>'; }
        } else {
          bultosEl.innerHTML = '<div style="padding:12px 16px;color:var(--mu);font-size:12px">No disponible</div>';
        }
      }
    }
  } catch {
    if (photoEl) photoEl.innerHTML = '<div class="adp-hero-placeholder"><span>📷</span><span>Sin foto disponible</span></div>';
  }
}

function mapSideBack() {
  const cont = document.getElementById('mapSideContent');
  if (cont._listHTML) {
    cont.innerHTML = cont._listHTML;
    // Restaurar highlights de todos los resultados de la búsqueda
    const q = (document.getElementById('mapSearch') || {}).value || '';
    if (q.trim()) mapSideSearch(q);
  }
}
