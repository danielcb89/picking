// ════════════════════════════════════════════════════════════════
// shelf.js — Panel detalle de estantería (SVG ultra-realista)
// Postes con perforaciones, protecciones amarillas, vigas naranja,
// cajas IKEA con etiqueta real, pallets de madera en suelo
// ════════════════════════════════════════════════════════════════

const SV = {
  W:          866,           // ancho del viewBox — incluye guard del poste trasero derecho sin recorte
  LABEL_W:    82,            // etiqueta izquierda ligeramente más compacta
  POST_W:     16,
  // Azul marino para postes (igual que la foto)
  POST_COL:   '#1a2e5a',   // azul marino
  POST_SHADE: '#0f1e3d',   // azul marino oscuro
  POST_HOLE:  '#0a1428',   // perforaciones oscuras
  POST_HILIT: '#2a4a8a',   // reflejo azul claro
  // Diagonal metálica
  DIAG_COL:   '#c0c8d0',   // metálico plateado
  DIAG_SHADE: '#8090a0',   // sombra metálica
  // Perspectiva 3D — profundidad lateral visible
  PERSP_DX:   38,          // desplazamiento horizontal hacia el fondo
  PERSP_DY:   22,          // desplazamiento vertical hacia el fondo
  BEAM_H:     16,
  BEAM_COL:   '#e06010',
  BEAM_SHADE: '#b04000',
  GUARD_H:    80,           // altura protección amarilla — doble de alta
  GUARD_COL:  '#cc5500',   // naranja óxido
  GUARD_STR:  '#993d00',   // naranja óxido oscuro (borde)
  FLOOR_H:    160,
  PICK_H:     140,
  BOX_GAP:    18,
  BOX_MARGIN: 20,
  PALLET_H:   28,
  PALLET_COL: '#a86c28',   // marrón intermedio entre caja suelo y tacos
  PALLET_SLAT:'#8a5418',   // tono ligeramente más oscuro para bordes/laterales
  PALLET_DARK:'#5a3a08',   // tacos oscuros
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

// ── OPEN / CLOSE — efecto zoom+flip desde la celda ───────────────

function openShelfDetail(el) {
  const p   = el.getAttribute('data-p');
  const est = el.getAttribute('data-e');
  const alm = el.getAttribute('data-alm');
  if (!p || !est || !alm) return;

  // Renderizar contenido
  document.getElementById('shelfTitle').textContent = `Pasillo ${p} · Estantería ${est}`;
  document.getElementById('shelfSub').textContent   = alm === 'AUXILIAR1' ? '🟢 Almacén Auxiliar1' : '🔵 Almacén Central';
  document.getElementById('shelfBody').innerHTML    = renderShelfSVG(p, est, alm);
  bindShelfTooltips();

  // Posición y tamaño de la celda origen
  const rect  = el.getBoundingClientRect();
  const cellCX = rect.left + rect.width  / 2;
  const cellCY = rect.top  + rect.height / 2;

  // Destino: panel centrado en pantalla
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const targetW = Math.min(vw * 0.82, 960);
  const targetH = Math.min(vh * 0.94, 940);
  const targetX = (vw - targetW) / 2;
  const targetY = (vh - targetH) / 2;

  const panel = document.getElementById('shelfPanel');
  const ov    = document.getElementById('shelfOverlay');

  // Estado inicial: tamaño y posición de la celda, girado 90° (de canto)
  const sx = rect.width  / targetW;
  const sy = rect.height / targetH;
  const tx = cellCX - (targetX + targetW / 2);
  const ty = cellCY - (targetY + targetH / 2);

  // Fijar tamaño destino del panel
  panel.style.width    = `${targetW}px`;
  panel.style.height   = `${targetH}px`;
  panel.style.top      = `${targetY}px`;
  panel.style.left     = `${targetX}px`;
  panel.style.right    = 'auto';
  panel.style.transition = 'none';
  panel.style.transform  = `translate(${tx}px, ${ty}px) scale(${sx}, ${sy}) rotateY(90deg)`;
  panel.style.opacity    = '0';
  panel.style.borderRadius = '4px';

  ov.style.display = 'flex';
  ov.style.alignItems = 'center';
  ov.style.justifyContent = 'center';
  ov.style.background = 'rgba(10,20,40,0)';
  ov.style.transition = 'none';

  requestAnimationFrame(() => requestAnimationFrame(() => {
    // Fase 1: zoom + flip hasta posición final
    panel.style.transition = 'transform .38s cubic-bezier(.22,.8,.32,1), opacity .2s ease, border-radius .38s';
    panel.style.transform  = 'translate(0,0) scale(1) rotateY(0deg)';
    panel.style.opacity    = '1';
    panel.style.borderRadius = '6px';

    ov.style.transition = 'background .3s ease';
    ov.style.background = 'rgba(10,20,40,.45)';

    // Ajustar altura del scroll tras animación
    setTimeout(() => {
      const scrollEl = document.getElementById('shelfScroll');
      const svgEl    = document.getElementById('shelfSvg');
      if (!scrollEl || !svgEl) return;
      const svgW        = parseFloat(scrollEl.dataset.svgw);
      const svgH        = parseFloat(scrollEl.dataset.svgh);
      const viewH       = parseFloat(scrollEl.dataset.viewh);
      const needsScroll = scrollEl.dataset.needsScroll === 'true';
      const renderedW   = svgEl.clientWidth || scrollEl.clientWidth || svgW;
      const scale       = renderedW / svgW;
      const heightPx    = needsScroll ? viewH * scale : svgH * scale;
      scrollEl.style.height = `${Math.round(heightPx)}px`;
      if (needsScroll) setTimeout(() => {
        scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior: 'smooth' });
      }, 420);
    }, 400);
  }));
}

function closeShelfDetail() {
  const panel = document.getElementById('shelfPanel');
  const ov    = document.getElementById('shelfOverlay');

  // Flip de salida: encoge y gira de vuelta
  panel.style.transition = 'transform .28s cubic-bezier(.55,0,.7,.4), opacity .2s ease .05s, border-radius .28s';
  panel.style.transform  = 'scale(0.05) rotateY(-90deg)';
  panel.style.opacity    = '0';
  panel.style.borderRadius = '50%';

  ov.style.transition = 'background .25s ease';
  ov.style.background = 'rgba(10,20,40,0)';

  hideShelfTT();
  setTimeout(() => {
    ov.style.display = 'none';
    panel.style.transition = 'none';
    panel.style.transform  = '';
    panel.style.opacity    = '';
    panel.style.borderRadius = '';
  }, 300);
}

// ── PANEL LATERAL con diagonales metálicas en X ───────────────────
function svgSidePanel(xFront, yFront, xBack, yBack, h, dy) {
  const x1 = xFront + SV.POST_W;
  const x2 = xBack;
  const y1  = yFront;
  let out = '';

  // Fondo oscuro del panel lateral
  out += `<polygon
    points="${x1},${y1} ${x2},${yBack} ${x2},${yBack+h} ${x1},${y1+h}"
    fill="rgba(10,20,50,0.18)" stroke="none"/>`;

  // Diagonales metálicas en X
  const sections = Math.max(2, Math.round(h / 120));
  const secH = h / sections;

  for (let s = 0; s < sections; s++) {
    const sy1f = y1  + s * secH;
    const sy2f = y1  + (s + 1) * secH;
    const sy1b = yBack + s * secH;
    const sy2b = yBack + (s + 1) * secH;
    // diagonal \
    out += `<line x1="${x1}" y1="${sy1f}" x2="${x2}" y2="${sy2b}"
      stroke="${SV.DIAG_COL}" stroke-width="3.5" stroke-linecap="round" opacity="0.9"/>`;
    out += `<line x1="${x1}" y1="${sy1f}" x2="${x2}" y2="${sy2b}"
      stroke="rgba(255,255,255,0.25)" stroke-width="1" stroke-linecap="round"/>`;
    // diagonal /
    out += `<line x1="${x1}" y1="${sy2f}" x2="${x2}" y2="${sy1b}"
      stroke="${SV.DIAG_COL}" stroke-width="3.5" stroke-linecap="round" opacity="0.9"/>`;
    out += `<line x1="${x1}" y1="${sy2f}" x2="${x2}" y2="${sy1b}"
      stroke="rgba(255,255,255,0.25)" stroke-width="1" stroke-linecap="round"/>`;
  }
  return out;
}

// ── SVG PRINCIPAL ────────────────────────────────────────────────

// Altura que ocupa un nivel de picking + su viga, y un nivel de suelo
const LEVEL_UNIT_H = () => SV.PICK_H + SV.BEAM_H;

// Altura ideal visible = 4 niveles de picking (sin suelo, lo más común)
// Misma fórmula que svgH con exactamente IDEAL_LEVELS niveles de picking
const IDEAL_LEVELS  = 4;
const IDEAL_VIEW_H  = () => SV.PERSP_DY + 20 + IDEAL_LEVELS * LEVEL_UNIT_H() + 20;

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
  const nTotal = nPick + nFloor;

  // Altura real del contenido (sin margen inferior — lo controlamos nosotros)
  const contentH = nPick  * (SV.PICK_H + SV.BEAM_H)
                 + (nFloor > 0 ? SV.FLOOR_H : 0);
  // svgH: PERSP_DY arriba (para postes traseros) + 20 de padding top + contenido + 20 padding bottom
  const PAD_TOP = 20;
  const PAD_BOT = 20;
  const svgH = SV.PERSP_DY + PAD_TOP + contentH + PAD_BOT;

  const dx = SV.PERSP_DX, dy = SV.PERSP_DY;

  // Coordenadas frontales
  const innerX  = SV.LABEL_W + SV.POST_W;
  const innerW  = SV.W - SV.LABEL_W - SV.POST_W * 2 - 4 - dx;
  const postX1  = SV.LABEL_W;
  const postX2  = SV.W - SV.POST_W - 4 - dx;

  // Coordenadas postes traseros
  const postX1b = postX1 + dx;
  const postX2b = postX2 + dx;
  const postYf  = dy;
  const postHf  = svgH - dy - 20;

  // ── Decidir si necesitamos scroll ────────────────────────────────
  const needsScroll = nTotal > IDEAL_LEVELS;

  // El SVG tiene dimensiones fijas en px (SV.W × svgH).
  // El wrapper escala el SVG para que encaje en el ancho disponible
  // y limita la altura visible a 4 niveles cuando hay scroll.
  // La escala y el height en px se calculan en openShelfDetail() una vez
  // que el DOM está disponible y conocemos el ancho real del contenedor.

  // ── Wrapper y SVG ────────────────────────────────────────────────
  // El SVG usa width=100% — el navegador lo escala al ancho disponible.
  // La altura la fijamos en JS tras renderizar, midiendo el ancho real
  // y derivando la altura proporcional. Si hay scroll, limitamos a 4 niveles.

  const svgTotalW = SV.W + 4;   // +4 para incluir guard del poste trasero derecho

  const wrapper = `<div id="shelfScroll" data-svgw="${svgTotalW}" data-svgh="${svgH}"
    data-viewh="${IDEAL_VIEW_H()}" data-needs-scroll="${needsScroll}"
    style="overflow-x:hidden;overflow-y:${needsScroll ? 'scroll' : 'hidden'};">`;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" id="shelfSvg"
    width="100%" viewBox="0 0 ${svgTotalW} ${svgH}"
    preserveAspectRatio="xMinYMin meet"
    style="display:block;">`;

  // ── Postes traseros ───────────────────────────────────────────────
  const postYbReal = postYf - dy;
  const postHbReal = postHf;

  svg += svgPost(postX1b, postYbReal, postHbReal, svgH, true);
  svg += svgPost(postX2b, postYbReal, postHbReal, svgH, true);

  const guardYb = postYbReal + postHbReal - SV.GUARD_H;
  svg += svgGuard(postX1b, guardYb, true);
  svg += svgGuard(postX2b, guardYb, true);

  svg += svgSidePanel(postX1, postYf, postX1b, postYbReal, postHf, dy);
  svg += svgSidePanel(postX2, postYf, postX2b, postYbReal, postHf, dy);

  // ── Pasada 1: fondos de nivel + vigas ────────────────────────────
  let curY = dy + 20;

  levels.forEach((lv) => {
    const isFloor = lv.isFloor;
    const levelH  = isFloor ? SV.FLOOR_H : SV.PICK_H;

    svg += `<rect x="${innerX}" y="${curY}" width="${innerW}" height="${levelH}"
      fill="${isFloor ? 'rgba(200,175,140,0.12)' : 'rgba(230,240,252,0.22)'}"/>`;

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

    curY += levelH;

    if (!isFloor) {
      svg += svgBeamPerspective(innerX, curY, innerW, dx, dy);
      curY += SV.BEAM_H;
    }
  });

  // ── Pasada 2: artículos encima (por delante de la bandeja) ───────
  let curY2 = dy + 20;
  levels.forEach((lv) => {
    const isFloor = lv.isFloor;
    const levelH  = isFloor ? SV.FLOOR_H : SV.PICK_H;
    const arts    = (lv.ld && lv.ld.arts) || [];

    if (!arts.length) {
      svg += `<rect x="${innerX+10}" y="${curY2+10}" width="${innerW-20}" height="${levelH-20}"
        fill="${SV.EMPTY_FILL}" stroke="${SV.EMPTY_STR}" stroke-width="1.5"
        stroke-dasharray="6 4" rx="4"/>`;
      svg += `<text x="${innerX+innerW/2}" y="${curY2+levelH/2+5}" text-anchor="middle"
        font-size="13" fill="${SV.CAP_COL}">Vacío</text>`;
    } else if (isFloor) {
      svg += drawFloorBoxes(arts, innerX, curY2, innerW, levelH);
    } else {
      svg += drawPickingBoxes(arts, innerX, curY2, innerW, levelH);
    }

    curY2 += levelH;
    if (!isFloor) curY2 += SV.BEAM_H;
  });

  // ── Postes frontales (encima de todo) ────────────────────────────
  svg += svgPost(postX1, postYf, postHf, svgH, false);
  svg += svgPost(postX2, postYf, postHf, svgH, false);

  const guardY = postYf + postHf - SV.GUARD_H;
  svg += svgGuard(postX1, guardY, false);
  svg += svgGuard(postX2, guardY, false);

  svg += `</svg>`;
  return wrapper + svg + `</div>`;
}

// ── POSTE AZUL MARINO CON PERFORACIONES ──────────────────────────
function svgPost(x, y, h, svgH, isBack) {
  let out = '';
  const col   = isBack ? '#152448' : SV.POST_COL;   // traseros más oscuros
  const shade = isBack ? '#0a1428' : SV.POST_SHADE;
  const hilit = isBack ? '#1e3060' : SV.POST_HILIT;
  const alpha = isBack ? 0.75 : 1;

  // Cuerpo principal azul marino
  out += `<rect x="${x}" y="${y}" width="${SV.POST_W}" height="${h}"
    fill="${col}" rx="2" opacity="${alpha}"/>`;
  // Franja lateral izquierda más oscura (perfil en C)
  out += `<rect x="${x}" y="${y}" width="4" height="${h}"
    fill="${shade}" opacity="${alpha * 0.8}"/>`;
  // Franja lateral derecha más oscura
  out += `<rect x="${x + SV.POST_W - 4}" y="${y}" width="4" height="${h}"
    fill="${shade}" opacity="${alpha * 0.8}"/>`;
  // Reflejo central (brillo metálico)
  out += `<rect x="${x + 5}" y="${y}" width="4" height="${h}"
    fill="${hilit}" opacity="${alpha * 0.5}"/>`;

  // Perforaciones ovaladas cada 18px (en todos los postes, más tenues en traseros)
  const holeSpacing = 18;
  const holeW = 5, holeH = 9;
  for (let hy = y + 12; hy < y + h - 12; hy += holeSpacing) {
    out += `<ellipse cx="${x + SV.POST_W/2}" cy="${hy}"
      rx="${holeW/2}" ry="${holeH/2}"
      fill="${SV.POST_HOLE}" stroke="#0a1428" stroke-width="0.5" opacity="${isBack ? 0.5 : 1}"/>`;
  }
  return out;
}

// ── VIGA NARANJA + BANDEJA METÁLICA EN PERSPECTIVA ───────────────
// La viga (naranja) es la estructura; la bandeja (plateada) es la superficie
// donde descansan los productos — se dibuja encima de la viga.
function svgBeamPerspective(x, y, w, dx, dy) {
  const bh  = SV.BEAM_H;          // altura viga naranja
  const shH = 6;                   // altura visible de la bandeja metálica plateada
  let out = '';

  // — VIGA TRASERA: solo el trozo lateral visible a la derecha —
  // Se dibuja PRIMERO para quedar detrás de la viga delantera.
  // Coordenadas: desplazada dx/dy respecto a la delantera.
  // Solo se ve el fragmento entre x+w (fin viga front) y x+w+dx (fin viga back).
  const bx  = x + w;          // inicio del trozo lateral visible (borde der viga front)
  const bxe = x + w + dx;     // fin del trozo lateral (borde der viga trasera)
  // Cara frontal del trozo lateral de la viga trasera
  out += `<rect x="${bx}" y="${y-dy}" width="${dx}" height="${bh}"
    fill="${SV.BEAM_COL}" opacity="0.7" rx="0"/>`;
  // Cara superior del trozo lateral (pequeño trapecio — aquí es plano, solo dy de alto)
  out += `<polygon
    points="${bx},${y-dy} ${bxe},${y-dy} ${bxe},${y-dy} ${bx},${y-dy}"
    fill="#f08030" opacity="0.6"/>`;
  // Sombra inferior del trozo lateral
  out += `<rect x="${bx}" y="${y-dy+bh-3}" width="${dx}" height="3"
    fill="${SV.BEAM_SHADE}" opacity="0.4"/>`;
  // (bandeja trasera lateral eliminada — quedaba visible por encima de la delantera)

  // — VIGA DELANTERA: cara superior + frontal —
  // Cara superior del beam en perspectiva (trapecio naranja)
  out += `<polygon
    points="${x},${y} ${x+dx},${y-dy} ${x+w+dx},${y-dy} ${x+w},${y}"
    fill="#f08030" opacity="0.85"/>`;
  // Cara frontal naranja
  out += `<rect x="${x}" y="${y}" width="${w}" height="${bh}"
    fill="${SV.BEAM_COL}" rx="1"/>`;
  // Sombra inferior
  out += `<rect x="${x}" y="${y+bh-3}" width="${w}" height="3"
    fill="${SV.BEAM_SHADE}" opacity="0.5"/>`;
  // Tornillos en ambos extremos
  [x + 18, x + w - 18].forEach(bx => {
    out += `<circle cx="${bx}" cy="${y+bh/2}" r="5" fill="#c04000" stroke="#802000" stroke-width="0.8"/>`;
    out += `<line x1="${bx-3}" y1="${y+bh/2}" x2="${bx+3}" y2="${y+bh/2}"
      stroke="#601000" stroke-width="1.5"/>`;
    out += `<line x1="${bx}" y1="${y+bh/2-3}" x2="${bx}" y2="${y+bh/2+3}"
      stroke="#601000" stroke-width="1.5"/>`;
  });

  // — BANDEJA METÁLICA PLATEADA DELANTERA —
  const sy = y - shH;
  // Cara superior de la bandeja (trapecio plateado, en perspectiva)
  out += `<polygon
    points="${x},${sy+shH} ${x+dx},${sy+shH-dy} ${x+w+dx},${sy+shH-dy} ${x+w},${sy+shH}"
    fill="#d8dfe8" stroke="#b0bac5" stroke-width="0.5" opacity="0.95"/>`;
  // Cara frontal de la bandeja (plateada, fina)
  out += `<rect x="${x}" y="${sy}" width="${w}" height="${shH}"
    fill="#c8d0d8" stroke="#a0aab5" stroke-width="0.5" rx="0"/>`;
  // Brillo
  out += `<rect x="${x+2}" y="${sy+1}" width="${w-4}" height="2"
    fill="rgba(255,255,255,0.4)" rx="1"/>`;

  return out;
}

// ── PROTECCIÓN AMARILLA DE POSTE ──────────────────────────────────
function svgGuard(x, y, isBack) {
  const w  = SV.POST_W + 8;
  const h  = SV.GUARD_H;
  const gx = x - 4;
  const alpha = isBack ? 0.65 : 1;
  let out = '';
  // Cuerpo liso amarillo, sin franjas
  out += `<rect x="${gx}" y="${y}" width="${w}" height="${h}"
    fill="${SV.GUARD_COL}" stroke="${SV.GUARD_STR}" stroke-width="1.5" rx="3" opacity="${alpha}"/>`;
  // Tornillo central
  out += `<circle cx="${gx+w/2}" cy="${y+h/2}" r="4"
    fill="#c8a000" stroke="#906000" stroke-width="1" opacity="${alpha}"/>`;
  return out;
}

// ── CAJA IKEA ────────────────────────────────────────────────────
function svgBox(a, x, y, w, h, isFloor, overridePW, overridePH) {
  const r       = 3;
  const artData = encodeURIComponent(JSON.stringify({ i:a.i, d:a.d, s:a.s, pe:a.pe, vo:a.vo, mx:a.mx, mn:a.mn }));
  const code    = ikeaCode(a.i);
  const desc1   = (a.d || '').split(' ')[0];
  let out = '';

  // Sombra
  out += `<rect x="${x+5}" y="${y+5}" width="${w}" height="${h}"
    fill="rgba(0,0,0,0.15)" rx="${r}"/>`;

  const bodyCol = '#c8933a';
  const sideCol = '#a07020';
  const topCol  = isFloor ? '#c8933a' : '#c8933a';
  const darkCol = '#7a5418';
  const pw = overridePW !== undefined ? overridePW : Math.max(5, Math.round(w * 0.07));
  const ph = overridePH !== undefined ? overridePH : Math.max(4, Math.round(h * 0.05));

  // Cara frontal
  out += `<rect x="${x}" y="${y}" width="${w}" height="${h}"
    fill="${bodyCol}" stroke="${sideCol}" stroke-width="1.5" rx="${r}"/>`;

  // (franja amarilla eliminada — se ve más color azul)

  // Cara superior (va detrás de la lateral para z-order correcto)
  out += `<polygon points="${x},${y} ${x+pw},${y-ph} ${x+w+pw},${y-ph} ${x+w},${y}"
    fill="${topCol}" opacity="0.9"/>`;
  // Cara lateral derecha — vértices conectan exactamente con la superior
  out += `<polygon points="${x+w},${y} ${x+w+pw},${y-ph} ${x+w+pw},${y+h-ph} ${x+w},${y+h}"
    fill="${darkCol}" opacity="0.95"/>`;

  // ── Etiqueta (igual para suelo y picking) ────────────────────
  if (w >= 40 && h >= 30) {
    const pad = 4;
    const lx  = x + pad;
    const ly  = y + pad;
    const lw  = w - pad * 2;

    // Alturas de zonas
    const nameH = Math.max(14, Math.round(h * 0.28));
    const cdH   = Math.max(14, Math.round(h * 0.22));
    const lh    = nameH + cdH + 2;

    // Fondo blanco etiqueta
    out += `<rect x="${lx}" y="${ly}" width="${lw}" height="${lh}"
      fill="white" stroke="#bbb" stroke-width="0.5" rx="2"/>`;

    // Zona superior: nombre del artículo en negro
    const fs      = Math.min(11, Math.max(5, Math.round(lw / Math.max(desc1.length, 3) * 0.85)));
    const maxC    = Math.floor(lw / (fs * 0.62));
    const nameStr = desc1.length > maxC ? desc1.slice(0, maxC-1)+'…' : desc1;
    out += `<text x="${lx + lw/2}" y="${ly + nameH/2}"
      text-anchor="middle" dominant-baseline="middle"
      font-size="${fs}" font-weight="700" fill="#111"
      font-family="Arial,sans-serif">${nameStr}</text>`;

    // Línea divisoria horizontal
    out += `<line x1="${lx+2}" y1="${ly+nameH}" x2="${lx+lw-2}" y2="${ly+nameH}"
      stroke="#ddd" stroke-width="0.8"/>`;

    // Zona inferior: rectángulo negro con código IKEA en blanco
    const cdY = ly + nameH + 2;
    out += `<rect x="${lx}" y="${cdY}" width="${lw}" height="${cdH}"
      fill="#111" rx="0 0 2 2"/>`;
    const cfs = Math.min(10, Math.max(5, Math.round(cdH * 0.52)));
    out += `<text x="${lx + lw/2}" y="${cdY + cdH/2}"
      text-anchor="middle" dominant-baseline="middle"
      font-family="Courier New,monospace" font-size="${cfs}"
      font-weight="700" fill="white" letter-spacing="1">${code}</text>`;

  } else {
    // Caja muy pequeña — solo últimos 4 dígitos
    out += `<text x="${x+w/2}" y="${y+h/2+4}" text-anchor="middle"
      font-size="7" font-weight="700" fill="white" opacity="0.9">${String(a.i).slice(-4)}</text>`;
  }

  // ── Rect transparente encima de TODA la caja para el tooltip ─
  // Cubre cara frontal + lateral + superior para que el hover
  // funcione en cualquier punto de la caja
  out += `<rect x="${x}" y="${y-ph}" width="${w+pw}" height="${h+ph}"
    fill="transparent" class="shelf-svg-box" data-art="${artData}"
    style="cursor:pointer"/>`;

  return out;
}

// ── CAJAS DE SUELO (pallets) ──────────────────────────────────────
function drawFloorBoxes(arts, x0, y0, w, h) {
  const n      = arts.length;
  // Con <=3 artículos duplicar separación entre elementos, pero boxW se calcula
  // con el gap normal para que los pallets no se hagan más anchos
  const gap     = n <= 3 ? SV.BOX_GAP * 2 : SV.BOX_GAP;
  const boxW    = Math.min(160, Math.floor((w - SV.BOX_MARGIN*2 - SV.BOX_GAP*(n-1)) / n));
  const totalW  = boxW*n + gap*(n-1);
  const startX  = x0 + (w - totalW) / 2;
  const pdx     = Math.round(SV.PERSP_DX * 1.4 * 0.85);
  const pdy     = SV.PERSP_DY;

  // Profundidad lateral de cajas de suelo +25%
  const pw = Math.round(Math.max(5, Math.round(boxW * 0.07)) * 1.25);
  const ph = Math.round(Math.max(4, Math.round(h   * 0.05)) * 1.25);

  const FLOOR_Y = y0 + h;
  const palletY = FLOOR_Y - SV.PALLET_H;
  const boxH    = Math.min(h - SV.PALLET_H - 16, h * 0.72);
  const by0     = palletY - boxH;

  let pallets = '';
  let boxes   = '';
  arts.forEach((a, i) => {
    const bx = startX + i*(boxW + gap);
    pallets += svgPallet(bx - 4, palletY, boxW + 8, pdx, pdy);
    boxes   += svgBox(a, bx, by0, boxW, boxH, true, pw, ph);
  });
  return pallets + boxes;
}

// ── CAJAS DE PICKING (por volumen) ────────────────────────────────
function drawPickingBoxes(arts, x0, y0, w, h) {
  const n = arts.length;

  // Gap y margen dinámicos: se reducen cuando hay muchos artículos
  const gap    = n <= 4 ? SV.BOX_GAP    : Math.max(4,  Math.round(SV.BOX_GAP    * (4 / n)));
  const margin = n <= 4 ? SV.BOX_MARGIN : Math.max(6,  Math.round(SV.BOX_MARGIN * (4 / n)));

  const MIN_BOX_W = 55;
  const boxW   = Math.min(130, Math.max(MIN_BOX_W, Math.floor((w - margin*2 - gap*(n-1)) / n)));
  const totalW = boxW*n + gap*(n-1);
  const startX = x0 + (w - totalW) / 2;
  const minH   = Math.round(h * 0.38);
  const maxH   = Math.round(h * 0.82);
  let out = '';
  arts.forEach((a, i) => {
    const bh = boxHeightFromVol(a.vo, minH, maxH);
    const bx = startX + i*(boxW + gap);
    const by = y0 + h - bh - 8;
    out += svgBox(a, bx, by, boxW, bh, false);
  });
  return out;
}

// ── PALLET DE MADERA EN PERSPECTIVA ──────────────────────────────
// Proporción real: 0.8m ancho × 1.2m fondo → ratio fondo/ancho = 1.5
// La profundidad visual se escala: pdx = PERSP_DX * 1.5, pdy = PERSP_DY * 1.5
function svgPallet(x, y, w, pdx, pdy) {
  const h   = SV.PALLET_H;
  const lw  = Math.max(6, Math.floor(w / 5));   // ancho de cada pata
  const ts  = 5;                                  // grosor tablón
  const gap = 7;                                  // separación entre tablones superiores
  let out = '';

  // Orden de dibujo: cara lateral derecha → cara superior → cara frontal
  // para que el z-order sea correcto (frontal siempre encima)

  // ── Cara lateral derecha (perfil del pallet visto desde la perspectiva) ──
  // Es un trapecio desde el borde derecho frontal hasta el borde derecho trasero
  // Tablones laterales (3 franjas de madera de costado)
  [0, gap, gap*2].forEach(dy_off => {
    // Cara lateral del tablón superior
    out += `<polygon
      points="${x+w},${y+dy_off} ${x+w+pdx},${y+dy_off-pdy} ${x+w+pdx},${y+dy_off-pdy+ts} ${x+w},${y+dy_off+ts}"
      fill="${SV.PALLET_SLAT}" opacity="0.9"/>`;
  });
  // Cara lateral de las patas (bloques de costado)
  const pataH = h - gap*2 - ts;
  const pataY = y + gap*2 + ts;
  [0, Math.floor((w-lw)/2), w-lw].forEach(lx_off => {
    out += `<polygon
      points="${x+lx_off+lw},${pataY} ${x+lx_off+lw+pdx},${pataY-pdy} ${x+lx_off+lw+pdx},${pataY-pdy+pataH} ${x+lx_off+lw},${pataY+pataH}"
      fill="${SV.PALLET_DARK}" opacity="0.8"/>`;
  });
  // (sin tablón inferior lateral — coherente con cara frontal)

  // ── Cara superior del pallet (plataforma vista desde arriba en perspectiva) ──
  // Tablones superiores vistos desde arriba: trapecios
  [0, gap, gap*2].forEach(dy_off => {
    out += `<polygon
      points="${x},${y+dy_off+ts} ${x+pdx},${y+dy_off+ts-pdy} ${x+w+pdx},${y+dy_off+ts-pdy} ${x+w},${y+dy_off+ts}"
      fill="${SV.PALLET_COL}" stroke="${SV.PALLET_SLAT}" stroke-width="0.3" opacity="0.85"/>`;
  });

  // ── Cara frontal del pallet ──
  // Tablones superiores frontales (3 listones horizontales)
  [0, gap, gap*2].forEach(dy_off => {
    out += `<rect x="${x}" y="${y+dy_off}" width="${w}" height="${ts}"
      fill="${SV.PALLET_COL}" stroke="${SV.PALLET_SLAT}" stroke-width="0.5" rx="1"/>`;
  });
  // Patas frontales (3 bloques verticales)
  [0, Math.floor((w-lw)/2), w-lw].forEach(lx_off => {
    out += `<rect x="${x+lx_off}" y="${pataY}" width="${lw}" height="${pataH}"
      fill="${SV.PALLET_DARK}" rx="1"/>`;
  });
  // (sin tablón inferior frontal — solo hueco entre patas)

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
  h += `<div class="tt-r"><span class="tt-k">Vta/mes</span>
    <span class="tt-v" style="color:${a.s >= CFG.rotacion ? 'var(--gn)' : 'var(--tx)'}">${a.s}</span></div>`;
  h += `<div class="tt-r"><span class="tt-k">Peso</span>
    <span class="tt-v" style="color:${a.pe > CFG.pesado ? 'var(--or)' : 'var(--tx)'}">
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
