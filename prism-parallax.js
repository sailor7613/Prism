// ============================================================
// prism-parallax.js — Parallax overlay, orbit engine, toggle board, panel swipe
// Extracted from index-v54.html → index-v55.html
// ============================================================

// ── DOM refs & header positions (shared with main) ──
const beamHeader = document.getElementById('beamHeader');
const beamHeaderImg = document.getElementById('beamHeaderImg');
const phone = document.getElementById('phone');
const panelsEl = document.getElementById('panels');

const HEADER_POSITIONS = [9, -101, -210]; // px offsets: Beam / Prism / Refraction

// ── Parallax state ──
let shadeOpen = false;
let touchIntent = null; // null | 'horizontal' | 'vertical'
let touchStartX = 0;
let touchStartY = 0;
let headerStartTop = 0;
let currentPPanel = 0;
const parallaxOverlay = document.getElementById('parallaxOverlay');

// ── Parallelogram toggle state (presentational only — never writes to aggregate) ──
const plgQuadrants = { A: true, B: true, C: true, D: true };
let plgViewMode = 'scatter';
let densityMode = 'pulse'; // 'pulse' | 'cluster'

// ── Orbit state (3.2.3 — presentational only, never writes to aggregate) ──
let orbitAngle   = 0;          // elevation degrees 0–60 (Z-slider)
let orbitAzimuth = 0;          // yaw degrees 0–360 (animated)
let orbitFocus   = { x: 0.5, y: 0.5 }; // current orbit pivot point
let orbitBeat    = 0;          // 0=idle, 1=beat1, 2=beat2, 3=drift, 4=beat3
let orbitAnimId  = null;
let orbitBeatStart = 0;
let orbitDriftProgress = 0;
let orbitDriftStart = null;
let orbitDriftEnd   = null;
let orbitDriftInterrupted = false;
let orbitDriftInterruptFrac = null;
let orbitUserPin  = null;
let orbitCentroid = null;
let orbitDelayTimer = null;
const ORBIT_DELAY_MS = 6000;

// ── Toggle board state ──
// Each active toggle: { word, axisLoads: [{axis, weight}] }
const activeToggles = new Map(); // word → { axisLoads }

// Persistent layer — cross-event encoding vocabulary with axis signatures
const PERSISTENT_TERMS = [
  { word: 'institutional',  axisLoads: [{ axis: 'y+', weight: 0.75 }] },
  { word: 'populist',       axisLoads: [{ axis: 'y-', weight: 0.75 }] },
  { word: 'collective',     axisLoads: [{ axis: 'x-', weight: 0.70 }] },
  { word: 'individual',     axisLoads: [{ axis: 'x+', weight: 0.70 }] },
  { word: 'structural',     axisLoads: [{ axis: 'x-', weight: 0.65 }, { axis: 'y-', weight: 0.40 }] },
  { word: 'market',         axisLoads: [{ axis: 'x+', weight: 0.65 }] },
  { word: 'procedural',     axisLoads: [{ axis: 'y+', weight: 0.60 }] },
  { word: 'sovereignty',    axisLoads: [{ axis: 'x+', weight: 0.80 }, { axis: 'y+', weight: 0.35 }] },
  { word: 'performative',   axisLoads: [{ axis: 'y+', weight: 0.50 }] },
  { word: 'principled',     axisLoads: [{ axis: 'y+', weight: 0.45 }] },
  { word: 'strategic',      axisLoads: [{ axis: 'y-', weight: 0.40 }] },
  { word: 'sincere',        axisLoads: [{ axis: 'y+', weight: 0.35 }] },
];

// Quadrant axis signatures for displacement scoring
// A = upper-left (-X, +Y), B = upper-right (+X, +Y), C = lower-left (-X, -Y), D = lower-right (+X, -Y)
const QUAD_SIGNATURES = {
  A: { 'x+': -1, 'x-': +1, 'y+': +1, 'y-': -1 },
  B: { 'x+': +1, 'x-': -1, 'y+': +1, 'y-': -1 },
  C: { 'x+': -1, 'x-': +1, 'y+': -1, 'y-': +1 },
  D: { 'x+': +1, 'x-': -1, 'y+': -1, 'y-': +1 },
};

// Compute a relevance score [0,1] for a quadrant given all active toggles
function quadRelevance(quad) {
  if (activeToggles.size === 0) return 1.0;
  let score = 0, total = 0;
  const sig = QUAD_SIGNATURES[quad] || {};
  activeToggles.forEach(({ axisLoads }) => {
    axisLoads.forEach(({ axis, weight }) => {
      score += (sig[axis] || 0) * weight;
      total += weight;
    });
  });
  if (total === 0) return 1.0;
  // Normalize: score/total ranges from -1 to +1 → map to 0.15..1.0
  const norm = score / total; // -1..+1
  return 0.15 + 0.85 * ((norm + 1) / 2);
}

function initToggleBoard() {
  // Build persistent layer
  const pEl = document.getElementById('tbPersistentChips');
  if (pEl) {
    pEl.innerHTML = PERSISTENT_TERMS.map(t =>
      `<button class="tb-chip" data-word="${t.word}" onclick="toggleTbChip(this,'persistent')">${t.word}</button>`
    ).join('');
  }

  // Build event layer from active event's nominated words
  const evt = PrismDB.getActiveEvent();
  const eEl = document.getElementById('tbEventChips');
  if (!eEl) return;

  if (!evt) {
    eEl.innerHTML = '<span class="tb-empty">No active event.</span>';
    return;
  }

  // Collect all toggleNom words from all four quadrant responses
  const nominated = [];
  const seen = new Set();
  ['A','B','C','D'].forEach(q => {
    const words = evt.responses?.[q]?.words || [];
    words.forEach(w => {
      if (!w.toggleNom || !w.w) return;
      const clean = w.t.trim();
      if (!clean || seen.has(clean.toLowerCase())) return;
      seen.add(clean.toLowerCase());
      nominated.push({
        word: clean,
        axisLoads: [{ axis: w.w, weight: w.weight || 0.65 }]
      });
    });
  });

  if (nominated.length === 0) {
    eEl.innerHTML = '<span class="tb-empty">No terms nominated for this event yet.</span>';
    return;
  }

  eEl.innerHTML = nominated.map(t =>
    `<button class="tb-chip event-chip" data-word="${t.word}" data-axis='${JSON.stringify(t.axisLoads)}' onclick="toggleTbChip(this,'event')">${t.word}</button>`
  ).join('');
}

function toggleTbChip(btn, layer) {
  const word = btn.dataset.word;
  if (activeToggles.has(word)) {
    activeToggles.delete(word);
    btn.classList.remove('on');
  } else {
    // Get axis loads: event chips carry data-axis, persistent chips looked up
    let axisLoads;
    if (layer === 'event') {
      axisLoads = JSON.parse(btn.dataset.axis || '[]');
    } else {
      const term = PERSISTENT_TERMS.find(t => t.word === word);
      axisLoads = term ? term.axisLoads : [];
    }
    activeToggles.set(word, { axisLoads });
    btn.classList.add('on');
  }
  renderParallaxAggregate();
}

function clearAllToggles() {
  activeToggles.clear();
  document.querySelectorAll('.tb-chip.on').forEach(c => c.classList.remove('on'));
  document.getElementById('pxFeedback').textContent = '';
  document.getElementById('pxFeedback').className = 'px-feedback';
  renderParallaxAggregate();
}

// ============================================================
// PARALLAX DRAWER — collapse/expand controls below Z slider
// ============================================================
function toggleParallaxDrawer() {
  const drawer = document.getElementById('pfDrawer');
  const chevron = document.getElementById('pfDrawerChevron');
  const isOpen = drawer.classList.toggle('open');
  chevron.classList.toggle('open', isOpen);
}

function togglePlgQuad(btn) {
  const q = btn.dataset.q;
  plgQuadrants[q] = !plgQuadrants[q];
  btn.classList.toggle('on', plgQuadrants[q]);
  // 2D aggregate: re-render with quadrant filter
  renderParallaxAggregate();
  // 3D graphmap: toggle word cloud visibility
  if (graphmapInst) {
    graphmapInst.showQuadrantWords(q, plgQuadrants[q]);
  }
}

function togglePlgView(btn) {
  plgViewMode = btn.dataset.v;
  document.querySelectorAll('.plg-view-btn:not(.plg-density-btn)').forEach(b => b.classList.toggle('on', b.dataset.v === plgViewMode));
  renderParallaxAggregate();
}

function toggleDensityMode(btn) {
  densityMode = btn.dataset.d;
  document.querySelectorAll('.plg-density-btn').forEach(b => b.classList.toggle('on', b.dataset.d === densityMode));
  // Re-run proximity with new mode
  if (veilState === 'graphmap-lock') {
    graphmapInst.computeProximity(0.55, densityMode);
  }
}

// ── Parallax Input — Operation A / B routing ──
function submitParallaxInput() {
  const input = document.getElementById('pxInput').value.trim();
  const feedback = document.getElementById('pxFeedback');
  if (!input) return;

  // Route by length
  if (input.length > 60) {
    // Operation B — long text
    feedback.className = 'px-feedback long';
    feedback.textContent = '↗ Long text: paste into Statement Scorer in the admin portal for full X / Y / Z / Diatribe scoring.';
    return;
  }

  // Operation A — word / short phrase
  const evt = PrismDB.getActiveEvent();
  if (!evt) {
    feedback.className = 'px-feedback nomatch';
    feedback.textContent = 'No active event to match against.';
    return;
  }

  // Collect all word tags across all quadrant responses
  const allTags = [];
  ['A','B','C','D'].forEach(q => {
    const words = evt.responses?.[q]?.words || [];
    words.forEach(w => {
      if (w.w) allTags.push({ ...w, quad: q });
    });
  });

  // Tokenize input and match
  const inputTokens = input.toLowerCase().split(/\s+/);
  const matched = [];
  const activatedWords = new Set();

  allTags.forEach(tag => {
    const tagClean = tag.t.trim().toLowerCase().replace(/[^a-z0-9 ]/g, '');
    const tagTokens = tagClean.split(/\s+/);
    const hits = tagTokens.filter(tt => inputTokens.some(it => tt.includes(it) || it.includes(tt)));
    if (hits.length > 0 && !activatedWords.has(tagClean)) {
      activatedWords.add(tagClean);
      matched.push(tag);
    }
  });

  if (matched.length === 0) {
    feedback.className = 'px-feedback nomatch';
    feedback.textContent = `"${input}" — no tags found in this event. Unmatched terms logged for tagging review.`;
    // Log unmatched term
    console.info('[Prism Parallax] Unmatched input term:', input, '— event:', evt.id);
    return;
  }

  // Build aggregate axis loads from matched tags
  const combinedLoads = new Map(); // axis → total weight
  matched.forEach(tag => {
    const existing = combinedLoads.get(tag.w) || 0;
    combinedLoads.set(tag.w, existing + (tag.weight || 0.65));
  });

  // Normalise and add to activeToggles
  const maxLoad = Math.max(...combinedLoads.values());
  const axisLoads = [];
  combinedLoads.forEach((w, axis) => {
    axisLoads.push({ axis, weight: w / maxLoad });
  });

  activeToggles.set(input, { axisLoads });

  // Show matched chip in event layer or highlight existing chip
  const existing = document.querySelector(`.tb-chip[data-word="${input}"]`);
  if (existing) {
    existing.classList.add('on');
  }

  const axisNames = axisLoads.map(l => `${l.axis} ${(l.weight).toFixed(2)}`).join(', ');
  feedback.className = 'px-feedback match';
  feedback.textContent = `"${input}" — matched ${matched.length} tag${matched.length > 1 ? 's' : ''} · ${axisNames}`;

  renderParallaxAggregate();
}

function headerOpenTop() {
  return phone.clientHeight - 72;
}

function setHeaderPosition(px, animated) {
  if (paraIsMirrored) return; // Don't move prism while Parallelogram is active
  beamHeaderImg.style.transition = animated
    ? 'left 0.55s cubic-bezier(0.4,0,0.2,1), filter 0.8s ease, transform 0.6s cubic-bezier(0.22,1,0.36,1)'
    : 'none';
  beamHeaderImg.style.left = `${px}px`;
}

function resizeBeam() {
  setHeaderPosition(HEADER_POSITIONS[currentPanel], false);
  if (shadeOpen) {
    beamHeader.style.top = headerOpenTop() + 'px';
  }
}

function openParallax() {
  shadeOpen = true;
  beamHeader.classList.add('shade-animating');
  beamHeader.style.top = headerOpenTop() + 'px';
  parallaxOverlay.classList.add('open');
  // Post-submit → Parallax tab; pre-submit → Diatribe tab
  gotoParallaxPanel(submitted ? 1 : 0);
  document.getElementById('panel0').classList.add('parallax-push');
  document.getElementById('panel1').scrollTo({ top: 0, behavior: 'smooth' });
  document.getElementById('panel2').scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(renderParallaxAggregate, 520);
  setTimeout(() => beamHeader.classList.remove('shade-animating'), 520);
}

function closeParallax() {
  shadeOpen = false;
  beamHeader.classList.add('shade-animating');
  beamHeader.style.top = '0px';
  parallaxOverlay.classList.remove('open');
  parallaxOverlay.classList.remove('graph-mode');
  // Veil system: clean up graphmap view
  exitGraphmapView();
  // Remove parallax-active from quadrant and parallax-mode from panel
  const quadrant = document.getElementById('quadrant');
  if (quadrant) quadrant.classList.remove('parallax-active');
  const panel1 = document.getElementById('panel1');
  if (panel1) panel1.classList.remove('parallax-mode');
  // Sync Z-slider to current pin Z (don't reset to 0)
  const zSlider = document.getElementById('zOrbitSlider');
  if (zSlider) {
    const sliderVal = Math.round(currentPinZ * 60);
    zSlider.value = sliderVal;
    handleZSlider(sliderVal);
  }
  // Restore Beam content
  document.getElementById('panel0').classList.remove('parallax-push');
  setTimeout(() => beamHeader.classList.remove('shade-animating'), 520);
  // If aperture wasn't committed, reveal cards anyway (user dismissed overlay)
  if (!apertureCommitted && !submitted) {
    apertureCommitted = true;
    apertureBand = currentBand; // Snapshot even on dismiss
    setTimeout(() => {
      const grid = document.getElementById('answersGrid');
      if (grid) {
        grid.classList.remove('aperture-hidden');
        grid.classList.add('aperture-reveal');
      }
    }, 350);
  }
  // Transform submit button to "Next Event" after parallax closes (only if more events exist)
    if (submitted && currentEventIndex + 1 < PrismDB.getEvents().length) {
      const btn = document.getElementById('submitBtn');
      if (btn) {
        btn.textContent = 'Next Event →';
        btn.classList.remove('done');
        btn.disabled = false;
        btn.onclick = advanceEvent;
      }
    }
}

function gotoParallaxPanel(idx) {
  currentPPanel = idx;
  document.querySelectorAll('.parallax-nav-btn').forEach((b, i) => b.classList.toggle('active', i === idx));
  document.querySelectorAll('.p-panel').forEach((p, i) => p.classList.toggle('active', i === idx));
  
  const overlay = document.getElementById('parallaxOverlay');
  const panel1 = document.getElementById('panel1');
  const quadrant = document.getElementById('quadrant');

  if (idx === 1) {
    // Parallax tab: overlay goes transparent, main panel enters parallax-mode
    overlay.classList.add('graph-mode');
    if (panel1) panel1.classList.add('parallax-mode');
    if (quadrant) quadrant.classList.add('parallax-active');
    // Scroll to show quadrant at top
    if (panel1) {
      const qSection = document.getElementById('quadrantSection');
      if (qSection) panel1.scrollTo({ top: qSection.offsetTop - 8, behavior: 'smooth' });
    }
    initToggleBoard();
    setTimeout(renderParallaxAggregate, 50);
    // Veil system: swap CSS graph for Three.js graphmap
    setTimeout(enterGraphmapView, 100);
  } else {
    // Diatribe or Comparison: overlay is normal dark, main panel returns to normal
    overlay.classList.remove('graph-mode');
    if (panel1) panel1.classList.remove('parallax-mode');
    if (quadrant) quadrant.classList.remove('parallax-active');
    // Veil system: exit graphmap view
    exitGraphmapView();
  }
}

function renderParallaxAggregate() {
  const c = document.getElementById('pAggCanvas');
  if (!c) return;
  const ctx = c.getContext('2d');
  // Canvas is now inside #quadrant — parentElement is the quadrant
  const w = c.parentElement.clientWidth;
  const h = c.parentElement.clientHeight;
  if (w === 0 || h === 0) return;
  c.width = w * 2; c.height = h * 2;
  c.style.width = w + 'px'; c.style.height = h + 'px';
  ctx.scale(2, 2);
  ctx.clearRect(0, 0, w, h);

  // Z-axis red line — only drawn when slider is active or orbit is running
  const zSliderEl = document.getElementById('zOrbitSlider');
  const zSliderVal = zSliderEl ? parseInt(zSliderEl.value, 10) : 0;
  const zAbs = Math.abs(zSliderVal);
  const zT = zAbs / 60;

  if (zAbs > 2 || (orbitBeat > 0 && orbitAngle > 0)) {
    const effectiveAngle = orbitBeat > 0 ? orbitAngle : zT * zT * 25;
    const rotRad = effectiveAngle * Math.PI / 180;
    const zFrac = Math.min(Math.tan(rotRad), 1.0);
    const zHalf = w * 0.4 * zFrac;
    const alpha = 0.2 + Math.min(zT, 1) * 0.45;
    ctx.strokeStyle = `rgba(212, 85, 85, ${alpha.toFixed(2)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(w/2 - zHalf, h/2); ctx.lineTo(w/2 + zHalf, h/2); ctx.stroke();
    // "Z" label
    const labelX = zSliderVal >= 0 ? w/2 + zHalf + 3 : w/2 - zHalf - 10;
    ctx.fillStyle = `rgba(212, 85, 85, ${(alpha * 0.75).toFixed(2)})`;
    ctx.font = '8px "DM Mono"';
    ctx.textAlign = zSliderVal >= 0 ? 'left' : 'right';
    ctx.fillText('Z', labelX, h/2 + 3);
    ctx.textAlign = 'start';
    ctx.lineWidth = 1;
  }

  // Gate: require response before showing aggregate
  const togglesEl = document.getElementById('plgToggles');
  if (!submitted) {
    if (togglesEl) { togglesEl.style.opacity = '0.3'; togglesEl.style.pointerEvents = 'none'; }
    return;
  }
  if (togglesEl) { togglesEl.style.opacity = '1'; togglesEl.style.pointerEvents = ''; }

  // Compute per-quadrant relevance from active toggles
  const relevance = {
    A: quadRelevance('A'), B: quadRelevance('B'),
    C: quadRelevance('C'), D: quadRelevance('D'),
  };

  const C_MAP = { A:'rgba(201,64,64,', B:'rgba(58,90,140,', C:'rgba(74,140,90,', D:'rgba(200,122,48,' };
  const evt = PrismDB.getActiveEvent();
  const agg = evt ? PrismDB.getAggregateForEvent(evt.id) : [];
  const filtered = agg.filter(p => plgQuadrants[p.quadrant]);

  if (plgViewMode === 'scatter') {
    // Draw aggregate dots as sphere-like radial gradients
    filtered.forEach(d => {
      const rel = relevance[d.quadrant] ?? 1.0;
      const sx = d.x * w;
      const sy = d.y * h;
      const dotR = Math.max(2.5, 6 * (0.5 + rel * 0.5));
      // Radial gradient for 3D sphere look
      const grad = ctx.createRadialGradient(sx - dotR*0.25, sy - dotR*0.3, dotR*0.1, sx, sy, dotR);
      const baseColor = C_MAP[d.quadrant] || 'rgba(245,240,232,';
      grad.addColorStop(0, baseColor + (0.85 * rel).toFixed(2) + ')');
      grad.addColorStop(0.6, baseColor + (0.55 * rel).toFixed(2) + ')');
      grad.addColorStop(1, baseColor + (0.15 * rel).toFixed(2) + ')');
      ctx.beginPath();
      ctx.arc(sx, sy, dotR, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      // Subtle shadow below
      if (rel > 0.3) {
        ctx.beginPath();
        ctx.ellipse(sx, sy + dotR * 0.7, dotR * 0.7, dotR * 0.25, 0, 0, Math.PI * 2);
        ctx.fillStyle = getCanvasPalette().dotShadow;
        ctx.fill();
      }
    });
  } else {
    // Heat map mode
    const r = 40, dens = new Float32Array(r * r); let mx = 0;
    filtered.forEach(p => {
      const gi = Math.floor(p.x * r), gj = Math.floor(p.y * r);
      const rel = relevance[p.quadrant] ?? 1.0;
      for (let di = -2; di <= 2; di++) for (let dj = -2; dj <= 2; dj++) {
        const ni = gi + di, nj = gj + dj;
        if (ni >= 0 && ni < r && nj >= 0 && nj < r) {
          const v = dens[nj * r + ni] += Math.exp(-(di * di + dj * dj) / 2) * rel;
          if (v > mx) mx = v;
        }
      }
    });
    if (mx > 0) {
      const cw = w / r, ch = h / r;
      for (let j = 0; j < r; j++) for (let i = 0; i < r; i++) {
        const val = dens[j * r + i] / mx; if (val < 0.05) continue;
        const qx = i / r > 0.5 ? 'r' : 'l', qy = j / r < 0.5 ? 't' : 'b';
        ctx.fillStyle = qy === 't' && qx === 'r' ? `rgba(212,85,85,${val * 0.65})`
                      : qy === 't' && qx === 'l' ? `rgba(90,130,184,${val * 0.65})`
                      : qy === 'b' && qx === 'l' ? `rgba(94,168,114,${val * 0.65})`
                      :                            `rgba(212,146,69,${val * 0.65})`;
        ctx.fillRect(i * cw, j * ch, cw + 1, ch + 1);
      }
    }
  }

  // Orbit markers
  if (orbitBeat > 0) {
    if (orbitUserPin) {
      const upx = orbitUserPin.x * w, upy = orbitUserPin.y * h;
      ctx.beginPath(); ctx.arc(upx, upy, 9, 0, Math.PI * 2);
      ctx.strokeStyle = getCanvasPalette().orbitPin; ctx.lineWidth = 1.5; ctx.stroke();
    }
    if (orbitCentroid) {
      const cpx = orbitCentroid.x * w, cpy = orbitCentroid.y * h;
      ctx.beginPath(); ctx.arc(cpx, cpy, 8, 0, Math.PI * 2);
      ctx.strokeStyle = getCanvasPalette().orbitCenter; ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = getCanvasPalette().orbitCross; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(cpx - 12, cpy); ctx.lineTo(cpx + 12, cpy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cpx, cpy - 12); ctx.lineTo(cpx, cpy + 12); ctx.stroke();
    }
  }
}

/* positionParallaxPin removed — user's real pin on #quadrant is used directly */

function togglePfChip(btn) {
  const active = document.querySelectorAll('.pf-chip.on');
  if (!btn.classList.contains('on') && active.length >= 4) return;
  btn.classList.toggle('on');
  renderParallaxAggregate();
}

// ============================================================
// ORBIT ENGINE — 3.2.3
// Presentational only. Never writes to aggregate data.
// ============================================================

/** 3D projection: maps normalized canvas coords to screen pixels.
 *  At orbitAngle=0, azimuth=0 → identity (flat 2D view).
 *  Returns { sx, sy, scale, depth }
 */
function project3D(px, py, canvasW, canvasH) {
  if (orbitAngle === 0 && orbitAzimuth === 0) {
    return { sx: px * canvasW, sy: py * canvasH, scale: 1, depth: 0 };
  }
  const θ = orbitAngle * Math.PI / 180;   // elevation
  const φ = orbitAzimuth * Math.PI / 180; // azimuth/yaw
  const fx = orbitFocus.x;
  const fy = orbitFocus.y;
  const aspect = canvasW / canvasH;

  // Offset from focus (aspect-corrected horizontal)
  const dx = (px - fx) * aspect;
  const dy = py - fy;

  // Yaw rotation (around vertical axis)
  const Xr =  dx * Math.cos(φ) + dy * Math.sin(φ);
  const Zr = -dx * Math.sin(φ) + dy * Math.cos(φ);

  // Pitch elevation
  const X3 = Xr;
  const Y3 = -Zr * Math.sin(θ);  // vertical displacement from elevation
  const Z3 =  Zr * Math.cos(θ);  // depth

  // Perspective divide
  const focal  = 2.2;
  const depth  = focal + Z3 * 0.25;
  const pScale = focal / Math.max(depth, 0.15);

  return {
    sx: (fx + X3 * pScale / aspect) * canvasW,
    sy: (fy + Y3 * pScale) * canvasH,
    scale: pScale,
    depth: Z3
  };
}

/** Weighted centroid of all pins for the active event.
 *  Weight = intensity * quadrant relevance from active toggles.
 */
function computeWeightedCentroid(pins) {
  if (!pins || pins.length === 0) return { x: 0.5, y: 0.5 };
  const relevance = {
    A: quadRelevance('A'), B: quadRelevance('B'),
    C: quadRelevance('C'), D: quadRelevance('D'),
  };
  let wx = 0, wy = 0, totalW = 0;
  pins.forEach(p => {
    const iw = (p.intensity || 50) / 100;  // normalise 0-1
    const qr = relevance[p.quadrant] || 1.0;
    const w  = Math.max(0.1, iw * qr);
    wx += p.x * w; wy += p.y * w; totalW += w;
  });
  return totalW > 0 ? { x: wx / totalW, y: wy / totalW } : { x: 0.5, y: 0.5 };
}

function easeInOutOrbit(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function setBeatDisplay(text) {
  const el = document.getElementById('zBeatDisplay');
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('visible', text !== '');
}

function stopOrbitAnimation() {
  if (orbitAnimId) {
    cancelAnimationFrame(orbitAnimId);
    orbitAnimId = null;
  }
}

// Beat durations (ms)
const ORBIT_BEAT1_DUR  = 3200;   // fast orbit around user pin
const ORBIT_BEAT2_DUR  = 5500;   // slow "seeing" orbit
const ORBIT_DRIFT_DUR  = 4500;   // documentary pan to centroid
const ORBIT_B1_SPEED   = 360 / ORBIT_BEAT1_DUR;  // deg/ms
const ORBIT_B2_SPEED   = 360 / ORBIT_BEAT2_DUR;
const ORBIT_B3_SPEED   = 360 / 7000;  // slow continuous orbit of centroid

function handleZSlider(val) {
  const raw = parseInt(val, 10);
  const absRaw = Math.abs(raw);

  // ── If orbit is running, kill it immediately and return to CSS slider control ──
  if (orbitBeat > 0) {
    stopOrbitAnimation();
    orbitBeat    = 0;
    orbitAzimuth = 0;
    orbitAngle   = 0;
    orbitFocus   = { x: 0.5, y: 0.5 };
    // Restore CSS transition and transform-origin on the real graph
    const _wrap = document.getElementById('q3dWrap');
    if (_wrap) {
      _wrap.style.transition = 'transform 0.15s ease-out';
      _wrap.style.transformOrigin = '50% 50%';
    }
    renderParallaxAggregate();
  }

  // ── Always reset the 6-second timer on any slider input ──
  if (orbitDelayTimer) {
    clearTimeout(orbitDelayTimer);
    orbitDelayTimer = null;
  }

  // Update fill bar — grows from center outward
  const fill = document.getElementById('zOrbitFill');
  if (fill) {
    const pct = (absRaw / 60 * 50).toFixed(1);
    if (raw >= 0) {
      fill.style.left = '50%';
      fill.style.width = pct + '%';
    } else {
      fill.style.left = (50 - parseFloat(pct)) + '%';
      fill.style.width = pct + '%';
    }
  }

  const slider = document.getElementById('zOrbitSlider');
  if (slider) slider.classList.toggle('active', raw !== 0);

  // ── 3D rotation around Y-axis — turntable reveal ──
  // Quadratic easing: ±15° for 3D graphmap (subtle depth hint), ±25° for CSS fallback
  const t = absRaw / 60;
  const rotDeg3D = t * t * 15 * (raw >= 0 ? 1 : -1);
  const rotDegCSS = t * t * 25 * (raw >= 0 ? 1 : -1);
  const rotRad = rotDeg3D * Math.PI / 180;

  // Branch: if graphmap view is active, only update pin Z — don't touch orbit
  if (veilState === 'graphmap-lock') {
    if (pinPlaced && finalQuadrant) {
      currentPinZ = raw / 60;
      graphmapInst.setPin(pinX, pinY, finalQuadrant, currentPinZ);
    }
  } else {
    const q3dWrap = document.getElementById('q3dWrap');
    if (q3dWrap) {
      q3dWrap.style.transform = `rotateY(${rotDegCSS.toFixed(1)}deg)`;
    }
  }

  // Update Z value display
  const zValEl = document.getElementById('zValDisplay');
  if (zValEl) zValEl.textContent = raw !== 0 ? (raw > 0 ? '+' : '') + raw : '0';

  // Re-render canvas so Z-axis line updates with rotation
  renderParallaxAggregate();

  // Beat display
  if (raw !== 0) {
    setBeatDisplay(raw > 0 ? 'back' : 'over');
  } else {
    setBeatDisplay('');
  }

  // Compute anchors for later orbit
  if (raw !== 0 && !orbitUserPin) {
    orbitUserPin = (submitted && typeof pinX !== 'undefined')
      ? { x: pinX, y: pinY }
      : { x: 0.5, y: 0.5 };
    const evt = PrismDB.getActiveEvent();
    orbitCentroid = computeWeightedCentroid(
      evt ? PrismDB.getAggregateForEvent(evt.id) : []
    );
  }

  // ── 6-second static hold → orbit (CSS orbit only — skip in graphmap view) ──
  if (raw !== 0 && veilState !== 'graphmap-lock') {
    orbitDelayTimer = setTimeout(() => {
      orbitDelayTimer = null;
      const curSlider = document.getElementById('zOrbitSlider');
      const curVal = curSlider ? parseInt(curSlider.value, 10) : 0;
      if (curVal !== 0) {
        startOrbitSequence();
      }
    }, ORBIT_DELAY_MS);
  }

  // Reset on return to center
  if (raw === 0) {
    orbitAngle   = 0;
    orbitAzimuth = 0;
    orbitFocus   = { x: 0.5, y: 0.5 };
    orbitUserPin = null;
    const _wrap = document.getElementById('q3dWrap');
    if (_wrap) {
      _wrap.style.transition = 'transform 0.15s ease-out';
      _wrap.style.transformOrigin = '50% 50%';
    }
    renderParallaxAggregate();
  }
}

function startOrbitSequence() {
  const evt = PrismDB.getActiveEvent();
  const agg = evt ? PrismDB.getAggregateForEvent(evt.id) : [];

  // User pin — use pinX/pinY from main graph if submitted
  orbitUserPin = (submitted && typeof pinX !== 'undefined')
    ? { x: pinX, y: pinY }
    : { x: 0.5, y: 0.5 };

  orbitCentroid = computeWeightedCentroid(agg);

  // Enter directly at Beat 2: slow "seeing" orbit around user's pin.
  orbitFocus    = { x: orbitUserPin.x, y: orbitUserPin.y };
  orbitBeat     = 2;
  orbitAzimuth  = 0;
  orbitBeatStart = performance.now();
  setBeatDisplay('seeing orbit');

  // Disable CSS transition for smooth rAF control
  const q3dWrap = document.getElementById('q3dWrap');
  if (q3dWrap) q3dWrap.style.transition = 'none';

  // Set transform-origin to user's pin position
  if (q3dWrap) {
    q3dWrap.style.transformOrigin = `${(orbitUserPin.x * 100).toFixed(1)}% ${(orbitUserPin.y * 100).toFixed(1)}%`;
  }

  // Get starting angle from current slider value
  const sliderEl = document.getElementById('zOrbitSlider');
  const curVal = sliderEl ? parseInt(sliderEl.value, 10) : 0;
  const ct = Math.abs(curVal) / 60;
  orbitAngle = ct * ct * 25;  // base Y rotation from slider (quadratic easing)
  orbitAzimuth = curVal >= 0 ? 0 : 180;

  stopOrbitAnimation();
  renderParallaxAggregate();
  orbitAnimId = requestAnimationFrame(tickOrbit);
}

function tickOrbit(timestamp) {
  const elapsed = timestamp - orbitBeatStart;
  const q3dWrap = document.getElementById('q3dWrap');

  switch (orbitBeat) {
    case 2: {  // Slow orbit around user pin
      // Gentle yaw oscillation: swing ±(orbitAngle + 8°) over time
      const swingRange = orbitAngle + 8;
      orbitAzimuth = swingRange * Math.sin(elapsed * 0.0004);
      
      if (elapsed >= ORBIT_BEAT2_DUR) {
        orbitBeat           = 3;
        orbitBeatStart      = timestamp;
        orbitDriftProgress  = 0;
        orbitDriftStart     = { x: orbitFocus.x, y: orbitFocus.y };
        orbitDriftEnd       = { x: orbitCentroid.x, y: orbitCentroid.y };
        orbitDriftInterrupted = false;
        orbitDriftInterruptFrac = null;
        setBeatDisplay('drift');
      }
      break;
    }
    case 3: {  // Documentary pan to centroid
      orbitDriftProgress = Math.min(elapsed / ORBIT_DRIFT_DUR, 1);
      const t = easeInOutOrbit(orbitDriftProgress);
      orbitFocus = {
        x: orbitDriftStart.x + (orbitDriftEnd.x - orbitDriftStart.x) * t,
        y: orbitDriftStart.y + (orbitDriftEnd.y - orbitDriftStart.y) * t,
      };

      // Slow oscillation during drift
      const swingRange = orbitAngle + 8;
      orbitAzimuth = swingRange * Math.sin(elapsed * 0.0003);

      // Update transform-origin as focus drifts
      if (q3dWrap) {
        q3dWrap.style.transformOrigin = `${(orbitFocus.x * 100).toFixed(1)}% ${(orbitFocus.y * 100).toFixed(1)}%`;
      }

      if (orbitDriftProgress >= 1) {
        orbitFocus     = { x: orbitCentroid.x, y: orbitCentroid.y };
        orbitBeat      = 4;
        orbitBeatStart = timestamp;
        setBeatDisplay('center of mass');
      }
      break;
    }
    case 4: {  // Orbit centroid — continuous slow rotation
      const swingRange = orbitAngle + 10;
      orbitAzimuth = swingRange * Math.sin(elapsed * 0.00025);
      break;
    }
  }

  // Apply CSS transform — rotateY for yaw, subtle rotateX for elevation
  if (q3dWrap) {
    const elevate = 6 * Math.sin(performance.now() * 0.0002); // gentle pitch breathing
    q3dWrap.style.transform = `rotateY(${orbitAzimuth.toFixed(1)}deg) rotateX(${elevate.toFixed(1)}deg)`;
  }

  renderParallaxAggregate();

  if (orbitBeat > 0) {
    orbitAnimId = requestAnimationFrame(tickOrbit);
  }
}

/** Interrupt the drift when user taps canvas during Beat 3 pan.
 *  Logs how far the user allowed the drift before stopping.
 */
function interruptOrbitDrift() {
  if (orbitBeat !== 3 || orbitDriftInterrupted) return;
  orbitDriftInterrupted   = true;
  orbitDriftInterruptFrac = orbitDriftProgress;
  // Session-only metadata log (future: pipe to Beam panel longitudinal view)
  console.info('[Prism Orbit] Drift interrupted at fraction:', orbitDriftInterruptFrac.toFixed(3));
  // Freeze focus, transition to Beat 3 orbit from current position
  orbitDriftEnd  = { x: orbitFocus.x, y: orbitFocus.y };
  orbitCentroid  = { x: orbitFocus.x, y: orbitFocus.y };
  orbitBeat      = 4;
  orbitBeatStart = performance.now();
  setBeatDisplay('Beat 3 (paused)');
}

// Wire canvas tap to drift interrupt
(function wireOrbitCanvasInterrupt() {
  const canvas = document.getElementById('pAggCanvas');
  if (!canvas) return;
  canvas.parentElement.addEventListener('pointerdown', () => {
    if (orbitBeat === 3) interruptOrbitDrift();
  });
})();

// ── Panel swipe — but NOT when touch starts on the quadrant ──
let swipeStartX = 0;
let swipeTouchStartedOnQuadrant = false;
panelsEl.addEventListener('touchstart', e => {
  swipeStartX = e.touches[0].clientX;
  // Detect if touch origin is inside the quadrant element
  swipeTouchStartedOnQuadrant = !!e.target.closest('#quadrant');
}, { passive: true });
panelsEl.addEventListener('touchend', e => {
  if (swipeTouchStartedOnQuadrant) return; // ignore — user was pinning
  const dx = e.changedTouches[0].clientX - swipeStartX;
  if (Math.abs(dx) > 50) {
    if (dx < 0 && currentPanel < 2) goToPanel(currentPanel + 1);
    if (dx > 0 && currentPanel > 0) goToPanel(currentPanel - 1);
  }
}, { passive: true });

function goToPanel(idx) {
  currentPanel=idx;
  panelsEl.style.transition='transform 0.38s cubic-bezier(0.4,0,0.2,1)';
  panelsEl.style.transform=`translateX(${-idx*phone.clientWidth}px)`;
  setTimeout(()=>{ panelsEl.style.transition='none'; },400);
  document.querySelectorAll('.pdot').forEach((d,i)=>d.classList.toggle('active',i===idx));
  setHeaderPosition(HEADER_POSITIONS[idx], true);
  // Sync parallax panels when shade is open
  if (shadeOpen) {
    gotoParallaxPanel(idx);
  }
}
