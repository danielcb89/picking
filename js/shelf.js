// ════════════════════════════════════════════════════════════════
// shelf.js — Panel detalle de estantería (SVG ultra-realista)
// Postes con perforaciones, protecciones amarillas, vigas naranja,
// cajas IKEA con etiqueta real, pallets de madera en suelo
// ════════════════════════════════════════════════════════════════

const SV = {
  W:          900,
  LABEL_W:    95,
  POST_W:     16,
  POST_COL:   '#b0b8c0',   // gris metálico claro
  POST_SHADE: '#8090a0',
  POST_HOLE:  '#6a7a88',   // perforaciones ovaladas
  BEAM_H:     16,
  BEAM_COL:   '#e06010',
  BEAM_SHADE: '#b04000',
  GUARD_H:    80,           // altura protección amarilla — doble de alta
  GUARD_COL:  '#f5c800',
  GUARD_STR:  '#c8a000',
  FLOOR_H:    160,
  PICK_H:     140,
  BOX_GAP:    18,
  BOX_MARGIN: 20,
  PALLET_H:   28,
  PALLET_COL: '#c8973a',
  PALLET_SLAT:'#a07020',
  PALLET_DARK:'#7a5010',
  // Caja IKEA — cartón azul oscuro con franja
  BOX_BODY:   '#1a6bbf',   // azul IKEA
  BOX_SIDE:   '#145090',
  BOX_TOP:    '#1e80d8',
  BOX_STRIPE: '#f5c800',   // franja amarilla IKEA
  EMPTY_FILL: 'rgba(180,200,220,0.15)',
  EMPTY_STR:  '#a0b8cc',
  CAP_COL:    '#6a7a8a',
};

// ── Helpers ──────────────────────────────────────────────────────

// Formatea código al estilo IKEA: 3 grupos separados por puntos
// Ej: 20559148 → 205.591.48  |  559149 → 055.914.9 (rellena con 0 a 8 dígitos)
function ikeaCode(raw) {
  const s = String(raw).replace(/\D/g, '').padStart(8, '0');
  return s.slice(0,3) + '.' + s.slice(3,6) + '.' + s.slice(6);
}

// Altura de caja de picking proporcional al volumen (dm³), entre minH y maxH
function boxHeightFromVol(vo, minH, maxH) {
  if (!vo || vo <= 0) return Math.round((minH + maxH) / 2);
  // Rango típico de volumen: 1 dm³ → minH, 100+ dm³ → maxH
  const norm = Math.min(1, Math.max(0, (Math.log(vo) - Math.log(1)) / (Math.log(100) - Math.log(1))));
  return Math.round(minH + norm * (maxH - minH));
}

// ── OPEN / CLOSE ─────────────────────────────────────────────────

function openShelfDetail(el) {
  const p   = el.getAttribute('data-p');
  const est = el.getAttribute('data-e');
  const alm = el.getAttribute('data-alm');
  if (!p || !est || !alm) return;

  document.getElementById('shelfTitle').textContent = `Pasillo ${p} · Estantería ${est}`;
  document.getElementById('shelfSub').textContent   = alm === 'AUXILIAR1' ? '🟢 Almacén Auxiliar1' : '🔵 Almacén Central';
  document.getElementById('shelfBody').innerHTML    = renderShelfSVG(p, est, alm);
  bindShelfTooltips();

  const ov = document.getElementById('shelfOverlay');
  ov.style.display = 'block';
  requestAnimationFrame(() => requestAnimationFrame(() => ov.classList.add('open')));
}

function closeShelfDetail() {
  const ov = document.getElementById('shelfOverlay');
  ov.classList.remove('open');
  hideShelfTT();
  setTimeout(() => { ov.style.display = 'none'; }, 250);
}

// ── SVG PRINCIPAL ────────────────────────────────────────────────

function renderShelfSVG(p, e, alm) {
  const MAP = alm === 'AUXILIAR1' ? MAP_A : MAP_C;
  const est = MAP[p] && MAP[p][e];
  if (!est || (!est.pk.length && !est.s.length))
    return `<div class="shelf-empty-msg">Esta estantería no tiene posiciones registradas.</div>`;

  const pkDesc = [...est.pk].reverse();
  const levels = [
    ...pkDesc.map(entry => ({ code: entry.c, ld: LOC_DATA[entry.c], isFloor: false })),
    ...est.s.map(entry  => ({ code: entry.c, ld: LOC_DATA[entry.c], isFloor: true  })),
  ];

  const nPick  = pkDesc.length;
  const nFloor = est.s.length;
  const svgH   = 20
    + nPick  * (SV.PICK_H + SV.BEAM_H)
    + (nFloor > 0 ? SV.FLOOR_H : 0)
    + 20;

  const innerX = SV.LABEL_W + SV.POST_W;
  const innerW = SV.W - SV.LABEL_W - SV.POST_W * 2 - 4;
  const postX1 = SV.LABEL_W;
  const postX2 = SV.W - SV.POST_W - 4;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%"
    viewBox="0 0 ${SV.W} ${svgH}" style="display:block;max-width:100%" id="shelfSvg">`;

  // ── Postes metálicos con perforaciones ──────────────────────────
  svg += svgPost(postX1, 10, svgH - 20, svgH);
  svg += svgPost(postX2, 10, svgH - 20, svgH);

  // ── Niveles ──────────────────────────────────────────────────────
  let curY = 20;

  levels.forEach((lv, idx) => {
    const isFloor = lv.isFloor;
    const levelH  = isFloor ? SV.FLOOR_H : SV.PICK_H;
    const arts    = (lv.ld && lv.ld.arts) || [];

    // Fondo de nivel
    svg += `<rect x="${innerX}" y="${curY}" width="${innerW}" height="${levelH}"
      fill="${isFloor ? 'rgba(200,175,140,0.12)' : 'rgba(230,240,252,0.22)'}"/>`;

    // Etiqueta izquierda
    const hasCap = !!(lv.ld && lv.ld.capDm3 > 0 && isFinite(lv.ld.pctUsado));
    const midY   = curY + levelH / 2;
    svg += `<text x="${SV.LABEL_W - 10}" y="${midY - 7}" text-anchor="end"
      font-size="11" font-weight="700" fill="#2a4a6a">${lv.code}</text>`;
    if (hasCap) {
      svg += `<text x="${SV.LABEL_W - 10}" y="${midY + 7}" text-anchor="end"
        font-size="8" fill="${SV.CAP_COL}">${Math.round(lv.ld.capDm3)} dm³</text>`;
      svg += `<text x="${SV.LABEL_W - 10}" y="${midY + 18}" text-anchor="end"
        font-size="8" fill="${SV.CAP_COL}">${Math.round(lv.ld.pctUsado)}% ocup.</text>`;
    }

    // Contenido
    if (!arts.length) {
      svg += `<rect x="${innerX+10}" y="${curY+10}" width="${innerW-20}" height="${levelH-20}"
        fill="${SV.EMPTY_FILL}" stroke="${SV.EMPTY_STR}" stroke-width="1.5"
        stroke-dasharray="6 4" rx="4"/>`;
      svg += `<text x="${innerX+innerW/2}" y="${curY+levelH/2+5}" text-anchor="middle"
        font-size="13" fill="${SV.CAP_COL}">Vacío</text>`;
    } else if (isFloor) {
      svg += drawFloorBoxes(arts, innerX, curY, innerW, levelH);
    } else {
      svg += drawPickingBoxes(arts, innerX, curY, innerW, levelH);
    }

    curY += levelH;

    // Viga naranja bajo cada nivel de picking
    if (!isFloor) {
      svg += svgBeam(innerX, curY, innerW);
      curY += SV.BEAM_H;
    }
  });

  // Protecciones amarillas en la base de cada poste (sobre el suelo)
  const guardY = svgH - 20 - SV.GUARD_H;
  svg += svgGuard(postX1, guardY);
  svg += svgGuard(postX2, guardY);

  svg += '</svg>';
  return svg;
}

// ── POSTE CON PERFORACIONES OVALADAS ─────────────────────────────
function svgPost(x, y, h, svgH) {
  let out = '';
  // Cuerpo principal — perfil metálico con gradiente simulado
  out += `<rect x="${x}" y="${y}" width="${SV.POST_W}" height="${h}"
    fill="${SV.POST_COL}" rx="2"/>`;
  // Franja central más oscura (profundidad del perfil en C)
  out += `<rect x="${x+5}" y="${y}" width="${SV.POST_W-10}" height="${h}"
    fill="${SV.POST_SHADE}" opacity="0.6"/>`;
  // Perforaciones ovaladas cada 18px
  const holeSpacing = 18;
  const holeW = 5, holeH = 9;
  for (let hy = y + 12; hy < y + h - 12; hy += holeSpacing) {
    out += `<ellipse cx="${x + SV.POST_W/2}" cy="${hy}"
      rx="${holeW/2}" ry="${holeH/2}"
      fill="${SV.POST_HOLE}" stroke="#506070" stroke-width="0.5"/>`;
  }
  return out;
}

// ── VIGA NARANJA CON TORNILLOS ────────────────────────────────────
function svgBeam(x, y, w) {
  let out = '';
  out += `<rect x="${x}" y="${y}" width="${w}" height="${SV.BEAM_H}"
    fill="${SV.BEAM_COL}" rx="1"/>`;
  // Sombra inferior
  out += `<rect x="${x}" y="${y+SV.BEAM_H-3}" width="${w}" height="3"
    fill="${SV.BEAM_SHADE}" opacity="0.5"/>`;
  // Tornillos en ambos extremos
  [x + 18, x + w - 18].forEach(bx => {
    out += `<circle cx="${bx}" cy="${y+SV.BEAM_H/2}" r="5" fill="#c04000" stroke="#802000" stroke-width="0.8"/>`;
    out += `<line x1="${bx-3}" y1="${y+SV.BEAM_H/2}" x2="${bx+3}" y2="${y+SV.BEAM_H/2}"
      stroke="#601000" stroke-width="1.5"/>`;
    out += `<line x1="${bx}" y1="${y+SV.BEAM_H/2-3}" x2="${bx}" y2="${y+SV.BEAM_H/2+3}"
      stroke="#601000" stroke-width="1.5"/>`;
  });
  return out;
}

// ── PROTECCIÓN AMARILLA DE POSTE ──────────────────────────────────
function svgGuard(x, y) {
  const w  = SV.POST_W + 8;
  const h  = SV.GUARD_H;
  const gx = x - 4;
  let out = '';
  // Cuerpo liso amarillo, sin franjas
  out += `<rect x="${gx}" y="${y}" width="${w}" height="${h}"
    fill="${SV.GUARD_COL}" stroke="${SV.GUARD_STR}" stroke-width="1.5" rx="3"/>`;
  // Tornillo central
  out += `<circle cx="${gx+w/2}" cy="${y+h/2}" r="4"
    fill="#c8a000" stroke="#906000" stroke-width="1"/>`;
  return out;
}

// ── CAJA IKEA ────────────────────────────────────────────────────
function svgBox(a, x, y, w, h, isFloor) {
  const r       = 3;
  const artData = encodeURIComponent(JSON.stringify({ i:a.i, d:a.d, s:a.s, pe:a.pe, vo:a.vo, mx:a.mx, mn:a.mn }));
  const code    = ikeaCode(a.i);
  const desc1   = (a.d || '').split(' ')[0];
  let out = '';

  // Sombra
  out += `<rect x="${x+5}" y="${y+5}" width="${w}" height="${h}"
    fill="rgba(0,0,0,0.15)" rx="${r}"/>`;

  const bodyCol = isFloor ? '#c8933a' : SV.BOX_BODY;
  const sideCol = isFloor ? '#a07020' : SV.BOX_SIDE;
  const topCol  = isFloor ? '#daa850' : SV.BOX_TOP;
  const pw      = Math.max(5, Math.round(w * 0.07));
  const ph      = Math.max(4, Math.round(h * 0.05));

  // Cara frontal
  out += `<rect x="${x}" y="${y}" width="${w}" height="${h}"
    fill="${bodyCol}" stroke="${sideCol}" stroke-width="1.5"
    rx="${r}" class="shelf-svg-box" data-art="${artData}" style="cursor:pointer"/>`;

  // Franja amarilla inferior (solo picking)
  if (!isFloor) {
    const stripeH = Math.max(8, Math.round(h * 0.12));
    out += `<rect x="${x+1}" y="${y+h-stripeH-1}" width="${w-2}" height="${stripeH}"
      fill="${SV.BOX_STRIPE}" rx="0"/>`;
  }

  // Cara lateral y superior
  out += `<polygon points="${x+w},${y+3} ${x+w+pw},${y} ${x+w+pw},${y+h-3} ${x+w},${y+h}"
    fill="${sideCol}" opacity="0.85"/>`;
  out += `<polygon points="${x},${y} ${x+pw},${y-ph} ${x+w+pw},${y-ph} ${x+w},${y}"
    fill="${topCol}" opacity="0.9"/>`;

  // ── Etiqueta ─────────────────────────────────────────────────
  if (w >= 40 && h >= 20) {
    const pad  = 4;
    const lx   = x + pad;
    const ly   = y + pad;
    const lw   = w - pad * 2;

    // Altura FIJA y compacta: barcode + código negro
    const bcH  = 14;   // barcode
    const cdH  = 16;   // rectángulo negro con código
    const gap  = 2;    // espacio entre barcode y código
    const padV = 4;    // padding vertical interno
    const lh   = h < 35
      ? Math.round(h * 0.80)                  // caja muy pequeña → 80%
      : bcH + cdH + gap + padV * 2;           // compacto: ~40px máximo

    // Etiqueta blanca — solo parte superior de la caja
    out += `<rect x="${lx}" y="${ly}" width="${lw}" height="${lh}"
      fill="white" stroke="#bbb" stroke-width="0.5" rx="2"/>`;

    // Zona izquierda: nombre centrado verticalmente en la etiqueta
    const nameW  = Math.round(lw * 0.36);
    const rightX = lx + nameW + 3;
    const rightW = lw - nameW - 5;
    const fs     = Math.min(11, Math.max(5, Math.round(nameW / Math.max(desc1.length, 3) * 1.3)));
    const maxC   = Math.floor(nameW / (fs * 0.60));
    const nameS  = desc1.length > maxC ? desc1.slice(0, maxC-1)+'…' : desc1;

    out += `<text x="${lx + nameW/2}" y="${ly + lh/2}"
      text-anchor="middle" dominant-baseline="middle"
      font-size="${fs}" font-weight="700" fill="#111"
      font-family="Arial,sans-serif">${nameS}</text>`;

    // Línea divisoria vertical
    out += `<line x1="${lx+nameW+1}" y1="${ly+3}" x2="${lx+nameW+1}" y2="${ly+lh-3}"
      stroke="#ddd" stroke-width="0.8"/>`;

// Barcode arriba derecha
const bcY = ly + padV;

// Calculamos el ancho exacto de cada una de las 24 columnas
const colW = rightW / 24; 

// El ancho de la barra negra (85% de la columna para dejar separación)
const bw = colW * 0.85; 

// Array original restaurado correctamente
[1,0,1,1,0,1,0,1,1,0,1,0,1,0,0,1,1,0,1,0,1,1,0,1].forEach((f, index) => {
  // Posición X exacta para cada elemento
  const currentX = rightX + (index * colW);
  
  if (f) {
    out += `<rect x="${currentX}" y="${bcY}" width="${bw}" height="${bcH}" fill="#111"/>`;
  }
});

    // Rectángulo negro + código debajo del barcode
    const cdY = bcY + bcH + gap;
    out += `<rect x="${rightX}" y="${cdY}" width="${rightW}" height="${cdH}"
      fill="#111" rx="2"/>`;
    const cfs = Math.min(9, Math.max(5, Math.round(cdH * 0.52)));
    out += `<text x="${rightX + rightW/2}" y="${cdY + cdH/2}"
      text-anchor="middle" dominant-baseline="middle"
      font-family="Courier New,monospace" font-size="${cfs}"
      font-weight="700" fill="white" letter-spacing="0.5">${code}</text>`;

  } else {
    // Caja muy pequeña — solo últimos 4 dígitos
    out += `<text x="${x+w/2}" y="${y+h/2+4}" text-anchor="middle"
      font-size="7" font-weight="700" fill="white" opacity="0.9">${String(a.i).slice(-4)}</text>`;
  }

  return out;
}

// ── CAJAS DE SUELO (pallets) ──────────────────────────────────────
function drawFloorBoxes(arts, x0, y0, w, h) {
  const n      = arts.length;
  const boxW   = Math.min(160, Math.floor((w - SV.BOX_MARGIN*2 - SV.BOX_GAP*(n-1)) / n));
  const totalW = boxW*n + SV.BOX_GAP*(n-1);
  const startX = x0 + (w - totalW) / 2;
  const boxH   = h - SV.PALLET_H - 28;
  let out = '';
  arts.forEach((a, i) => {
    const bx = startX + i*(boxW + SV.BOX_GAP);
    const by = y0 + 12;
    out += svgBox(a, bx, by, boxW, boxH, true);
    out += svgPallet(bx - 4, by + boxH + 4, boxW + 8);
  });
  return out;
}

// ── CAJAS DE PICKING (por volumen) ────────────────────────────────
function drawPickingBoxes(arts, x0, y0, w, h) {
  const n      = arts.length;
  const boxW   = Math.min(130, Math.floor((w - SV.BOX_MARGIN*2 - SV.BOX_GAP*(n-1)) / n));
  const totalW = boxW*n + SV.BOX_GAP*(n-1);
  const startX = x0 + (w - totalW) / 2;
  const minH   = Math.round(h * 0.38);
  const maxH   = Math.round(h * 0.82);
  let out = '';
  arts.forEach((a, i) => {
    const bh = boxHeightFromVol(a.vo, minH, maxH);
    const bx = startX + i*(boxW + SV.BOX_GAP);
    const by = y0 + h - bh - 8;
    out += svgBox(a, bx, by, boxW, bh, false);
  });
  return out;
}

// ── PALLET DE MADERA ─────────────────────────────────────────────
function svgPallet(x, y, w) {
  const h   = SV.PALLET_H;
  const lw  = Math.max(8, Math.floor(w / 5));
  let out = '';
  // Tablones superiores (3 listones)
  [0, 7, 14].forEach(dy => {
    out += `<rect x="${x}" y="${y+dy}" width="${w}" height="5"
      fill="${SV.PALLET_COL}" stroke="${SV.PALLET_SLAT}" stroke-width="0.5" rx="1"/>`;
  });
  // Patas (3 bloques)
  [0, 1, 2].forEach(li => {
    const lx = x + li * Math.floor((w - lw) / 2);
    out += `<rect x="${lx}" y="${y+18}" width="${lw}" height="${h-18}"
      fill="${SV.PALLET_DARK}" rx="1"/>`;
  });
  // Tablón inferior
  out += `<rect x="${x}" y="${y+h-4}" width="${w}" height="4"
    fill="${SV.PALLET_COL}" stroke="${SV.PALLET_SLAT}" stroke-width="0.5" rx="1"/>`;
  return out;
}

// ── TOOLTIPS ──────────────────────────────────────────────────────
function bindShelfTooltips() {
  requestAnimationFrame(() => {
    document.querySelectorAll('.shelf-svg-box').forEach(el => {
      el.addEventListener('mouseenter', e => {
        try {
          const a = JSON.parse(decodeURIComponent(el.getAttribute('data-art')));
          showShelfTT(e, a);
        } catch (_) {}
      });
      el.addEventListener('mouseleave', hideShelfTT);
    });
  });
}

const shelfTtEl = document.getElementById('shelfTt');

function showShelfTT(e, a) {
  let h = `<div class="tt-an" style="font-size:12px;margin-bottom:6px;color:#1460b0">
    ${ikeaCode(a.i)} · ${firstWords(a.d, 5)}</div>`;
  h += `<div class="tt-r"><span class="tt-k">Descripción</span><span class="tt-v">${a.d || '—'}</span></div>`;
  h += `<div class="tt-r"><span class="tt-k">Vta/sem</span>
    <span class="tt-v" style="color:${a.s >= 5 ? 'var(--gn)' : 'var(--tx)'}">${a.s}</span></div>`;
  h += `<div class="tt-r"><span class="tt-k">Peso</span>
    <span class="tt-v" style="color:${a.pe > 20 ? 'var(--or)' : 'var(--tx)'}">
    ${a.pe > 0 ? a.pe + ' kg' : '—'}</span></div>`;
  h += `<div class="tt-r"><span class="tt-k">Vol. unit.</span>
    <span class="tt-v">${a.vo > 0 ? a.vo + ' dm³' : '—'}</span></div>`;
  h += `<div class="tt-r"><span class="tt-k">Max/Min</span>
    <span class="tt-v">${a.mx}/${a.mn}</span></div>`;

  shelfTtEl.innerHTML = h;
  shelfTtEl.style.display = 'block';
  moveShelfTT(e);
}

function moveShelfTT(e) {
  let x = e.clientX + 14, y = e.clientY + 14;
  if (x + 250 > window.innerWidth)  x = e.clientX - 255;
  if (y + 200 > window.innerHeight) y = e.clientY - 205;
  shelfTtEl.style.left = x + 'px';
  shelfTtEl.style.top  = y + 'px';
}

function hideShelfTT() { shelfTtEl.style.display = 'none'; }

document.addEventListener('mousemove', e => {
  if (shelfTtEl.style.display !== 'none') moveShelfTT(e);
});
