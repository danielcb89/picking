// ════════════════════════════════════════════════════════════════
// map.js — Mapa del almacén basado en layout de planta
// Depende de: state.js
// ════════════════════════════════════════════════════════════════


// ── CONSTRUCCIÓN DE LOOKUPS ──────────────────────────────────────
// MAP_C / MAP_A siguen existiendo para el panel SVG de estantería (shelf.js)

function buildMaps() {
  MAP_C = {}; MAP_A = {}; LOC_DATA = {};

  function addToMap(MAP, loc) {
    LOC_DATA[loc.c] = { cap: loc.cap, lt: loc.lt, arts: loc.arts, almacen: loc.almacen,
                        capDm3: loc.capDm3, volOcup: loc.volOcup, pctUsado: loc.pctUsado };
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

// Parsea una celda del grid tipo "P12E18" → {p:12, e:18} o null si no es válida
function parseCellCode(code) {
  if (!code) return null;
  const m = code.match(/^P(\d+)E(\d+)$/);
  if (!m) return null;
  return { p: parseInt(m[1]), e: parseInt(m[2]) };
}

// Zonas especiales conocidas — se renderizan como rectángulos etiquetados
const SPECIAL_ZONES = new Set(['MUELLE','ENTREGA','RECEPCION','OFICINA','EXPEDICION',
                                'PARKING','PASILLO','RAMPA','ESCALERA','ASCENSOR']);

function isSpecial(code) {
  if (!code) return false;
  return SPECIAL_ZONES.has(code) || /^(MUELLE|ENTREGA|RECEP|OFIC|EXPED|ZONA)/.test(code);
}

// Color y clase de una celda de estantería
function cellClass(p, e, alm) {
  const MAP = alm === 'AUXILIAR1' ? MAP_A : MAP_C;
  const est = MAP[String(p)] && MAP[String(p)][String(e)];
  if (!est) return 'cs-f'; // en el layout pero sin datos → libre

  const allLocs = [...(est.s || []), ...(est.pk || [])];
  if (!allLocs.length) return 'cs-f';

  // ¿Alguna localización tiene artículo a revisar?
  const hasRevisar = allLocs.some(l =>
    (l.arts || []).some(a => a.pe > 20 && a.s >= 5) &&
    !est.s.some(sl => sl.arts && sl.arts.length) // sin suelo ocupado
  );
  if (hasRevisar) return 'cp-rev';

  // ¿Está en top5 baja rotación?
  const lowSuelo = alm === 'AUXILIAR1' ? LOW_ROT.asuelo : LOW_ROT.csuelo;
  const lowPick  = alm === 'AUXILIAR1' ? LOW_ROT.apick  : LOW_ROT.cpick;
  const allCodes = allLocs.map(l => l.c);
  if (allCodes.some(c => lowSuelo.has(c) || lowPick.has(c))) return 'x-low';

  // ¿Hay alguna localización ocupada?
  const anyOcc = allLocs.some(l => l.arts && l.arts.length);
  if (!anyOcc) return 'cs-f';

  // ¿Subutilizado? (suelo con mezcla ocupado/libre)
  const sArr = est.s || [];
  const sOcc = sArr.filter(l => l.arts && l.arts.length).length;
  if (sArr.length > 1 && sOcc > 0 && sOcc < sArr.length) return 'cs-u';

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

  const grid    = layout.grid;
  const nCols   = Math.max(...grid.map(r => r.length));
  const CELL_W  = 22;
  const CELL_H  = 22;
  const GAP     = 2;

  // ── Detectar regiones especiales contiguas (flood fill) ──────────
  const nRows  = grid.length;
  const visited = Array.from({ length: nRows }, () => new Array(nCols).fill(false));

  function floodFill(startR, startC, code) {
    const queue = [[startR, startC]], cells = [];
    while (queue.length) {
      const [r, c] = queue.pop();
      if (r < 0 || r >= nRows || c < 0 || c >= nCols) continue;
      if (visited[r][c]) continue;
      const val = (grid[r] || [])[c] || null;
      if (val !== code) continue;
      visited[r][c] = true;
      cells.push([r, c]);
      queue.push([r+1,c],[r-1,c],[r,c+1],[r,c-1]);
    }
    return cells;
  }

  // Mapa: "row,col" → { regionCode, spanR, spanC, isOrigin }
  const regionMap = {};
  grid.forEach((row, r) => {
    (row || []).forEach((cell, c) => {
      if (!cell || !isSpecial(cell) || visited[r][c]) return;
      const cells = floodFill(r, c, cell);
      if (!cells.length) return;
      const minR = Math.min(...cells.map(([rr]) => rr));
      const maxR = Math.max(...cells.map(([rr]) => rr));
      const minC = Math.min(...cells.map(([,cc]) => cc));
      const maxC = Math.max(...cells.map(([,cc]) => cc));
      // Solo la celda top-left de la región renderiza el div real
      cells.forEach(([rr, cc]) => {
        regionMap[`${rr},${cc}`] = {
          code: cell,
          isOrigin: rr === minR && cc === minC,
          spanR: maxR - minR + 1,
          spanC: maxC - minC + 1,
        };
      });
    });
  });

  // ── Construir grid CSS ───────────────────────────────────────────
  let html = `<div class="layout-grid" style="
    display:grid;
    grid-template-columns:repeat(${nCols},${CELL_W}px);
    grid-template-rows:repeat(${nRows},${CELL_H}px);
    gap:${GAP}px;
    padding:10px;
    overflow:visible;
  ">`;

  for (let r = 0; r < nRows; r++) {
    for (let c = 0; c < nCols; c++) {
      const cell = (grid[r] || [])[c] || null;
      const key  = `${r},${c}`;
      const reg  = regionMap[key];

      if (reg) {
        if (!reg.isOrigin) continue; // las celdas no-origen no generan HTML
        // Región especial — un único div con span
        html += `<div class="layout-special-region" style="
          grid-column:${c+1}/span ${reg.spanC};
          grid-row:${r+1}/span ${reg.spanR};
        ">${reg.code}</div>`;
        continue;
      }

      if (!cell) {
        html += `<div class="layout-empty"></div>`;
        continue;
      }

      const parsed = parseCellCode(cell);
      if (!parsed) {
        html += `<div class="layout-cell layout-unknown" title="${cell}">${cell.substring(0,4)}</div>`;
        continue;
      }

      const { p, e } = parsed;
      const alm      = almacenForCell(p, e);
      if (!alm) {
        html += `<div class="layout-cell cs-f" style="opacity:.4" title="${cell}"></div>`;
        continue;
      }
      const cls      = cellClass(p, e, alm);
      const firstLoc = locDataForCell(p, e, alm);
      html += `<div class="layout-cell loc-cell ${cls}"
        data-loc="${firstLoc || ''}"
        data-p="${p}" data-e="${e}" data-alm="${alm}"
        title="${cell}"
        onmouseenter="showTT(event,this)"
        onclick="openShelfDetail(this)"></div>`;
    }
  }

  html += '</div>';
  document.getElementById('mapCont').innerHTML = html;
}

// Alias para compatibilidad con app.js que llama renderWarehouseMap()
function renderWarehouseMap() {
  renderLayoutMap(currentLayout);
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
    <span class="tt-row-stat">Vta/s</span>
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

    h += `<div class="tt-row-pos">
      <div class="tt-row-lbl${isFloor ? ' suelo' : ''}">
        <span>${posLabel}</span>
        <span class="tt-row-cap">${cap > 0 ? cap + ' m²' : ''}</span>
      </div>`;

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
        const revisar = a.pe > 20 && a.s >= 5 && !isFloor;
        const lowArt  = isLow && a.s === minS;
        h += `<div class="tt-row-art">
          <span class="tt-row-code">${a.i}</span>
          <span class="tt-row-desc">${firstWords(a.d, 4)}</span>
          <span class="tt-row-stat" style="color:${a.s >= 5 ? 'var(--gn)' : a.s < 0 ? 'var(--rd)' : 'var(--mu)'}">${a.s}</span>
          <span class="tt-row-stat" style="color:${a.pe > 20 ? 'var(--or)' : 'var(--mu)'}">${a.pe > 0 ? a.pe + 'kg' : '—'}</span>
          <span class="tt-row-warn">${revisar ? '🟠' : ''}${lowArt ? '🟣' : ''}</span>
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


// ── BÚSQUEDA DE ARTÍCULO EN EL MAPA ─────────────────────────────

function highlightArtOnMap(q) {
  document.querySelectorAll('.loc-cell.map-highlight').forEach(el => el.classList.remove('map-highlight'));
  const info = document.getElementById('mapSearchInfo');

  const term = (q || '').trim().toLowerCase();
  if (!term) { info.textContent = ''; return; }

  const matched = ARTS.filter(a =>
    a.i.toLowerCase().includes(term) || a.d.toLowerCase().includes(term)
  );
  if (!matched.length) { info.textContent = 'Sin resultados.'; return; }

  const locs = new Set();
  matched.forEach(a => {
    if (a.lc) locs.add(a.lc);
    if (a.la) locs.add(a.la);
  });
  if (!locs.size) {
    info.textContent = `${matched.length} artículo(s) encontrado(s) — sin localización asignada.`;
    return;
  }

  // En el nuevo mapa las celdas tienen data-p y data-e; buscamos por data-loc también
  let found = 0;
  document.querySelectorAll('.loc-cell[data-loc]').forEach(el => {
    const locCode = el.getAttribute('data-loc');
    // También comprobar todas las locs de esa estantería
    const p = el.getAttribute('data-p'), estEl = el.getAttribute('data-e');
    const alm = el.getAttribute('data-alm');
    let hit = locs.has(locCode);
    if (!hit && p && estEl && alm) {
      const MAP = alm === 'AUXILIAR1' ? MAP_A : MAP_C;
      const est = MAP[p] && MAP[p][estEl];
      if (est) {
        const all = [...(est.s || []), ...(est.pk || [])];
        hit = all.some(l => locs.has(l.c));
      }
    }
    if (hit) { el.classList.add('map-highlight'); found++; }
  });

  info.textContent = `${matched.length} artículo(s) · ${found} celda(s) resaltada(s)`;
  const first = document.querySelector('.loc-cell.map-highlight');
  if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
}

function clearMapHighlight() {
  document.querySelectorAll('.loc-cell.map-highlight').forEach(el => el.classList.remove('map-highlight'));
  const input = document.getElementById('mapSearch');
  if (input) input.value = '';
  const info = document.getElementById('mapSearchInfo');
  if (info) info.textContent = '';
}
