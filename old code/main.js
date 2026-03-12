// ============================================================
// MAIN.JS — App state, splash, beam canvas, navigation, submit, aggregate
// ============================================================

// ── STATE ────────────────────────────────────────────────────
let currentPanel  = 1;
let initialChoice = null;
let finalQuadrant = null;
let pinX = 0.5, pinY = 0.5;
let pinPlaced  = false;
let submitted  = false;
let aggView    = 'scatter';
let zValue     = 0;
let zRevealed  = false;
let zTimer     = null;
let swipeStartX = 0;
let appEntered  = false;

// ── SPLASH ───────────────────────────────────────────────────
function enterApp() {
  if (appEntered) return;
  appEntered = true;
  document.getElementById('splash').classList.add('out');
  if (window._stopSplashBeam) window._stopSplashBeam();
  setTimeout(() => { document.getElementById('splash').style.display = 'none'; }, 950);
}

// ── BEAM CANVAS ──────────────────────────────────────────────
const beamCanvas = document.getElementById('beamCanvas');
const bCtx       = beamCanvas.getContext('2d');
const phone      = document.getElementById('phone');
const panelsEl   = document.getElementById('panels');
let beamX = 0.5, isDraggingBeam = false, dragStartX = 0, dragStartBeamX = 0;

function resizeBeam() {
  beamCanvas.width  = phone.clientWidth;
  beamCanvas.height = 88;
  drawBeam();
}

function drawBeam() {
  const W = beamCanvas.width, H = 88;
  bCtx.clearRect(0, 0, W, H);
  bCtx.fillStyle = 'rgba(250,247,242,0.97)';
  bCtx.fillRect(0, 0, W, H);
  bCtx.fillStyle = 'rgba(26,26,46,0.1)';
  bCtx.fillRect(0, H - 1, W, 1);

  const px = beamX * W, py = 60, ts = 16;
  const ptop = {x: px,          y: py - ts};
  const pbl  = {x: px - ts * 0.95, y: py + ts * 0.55};
  const pbr  = {x: px + ts * 0.95, y: py + ts * 0.55};
  const ex   = (ptop.x + pbl.x) / 2, ey = (ptop.y + pbl.y) / 2;
  const rx   = (ptop.x + pbr.x) / 2, ry = (ptop.y + pbr.y) / 2;

  // Incoming beam
  bCtx.beginPath(); bCtx.moveTo(0, ey); bCtx.lineTo(ex, ey);
  bCtx.strokeStyle = 'rgba(200,175,110,0.7)'; bCtx.lineWidth = 1.8; bCtx.stroke();
  bCtx.beginPath(); bCtx.moveTo(0, ey - 1); bCtx.lineTo(ex, ey - 1);
  bCtx.strokeStyle = 'rgba(255,255,255,0.4)'; bCtx.lineWidth = 0.7; bCtx.stroke();

  // Spectral rays
  [{c:'#c94040',a:-0.32},{c:'#c87a30',a:-0.19},{c:'#c8c030',a:-0.06},
   {c:'#4a8c5a',a:+0.07},{c:'#3a5a8c',a:+0.20},{c:'#7a4a9c',a:+0.33}
  ].forEach(({c, a}) => {
    const steps = Math.ceil((W - rx) / 2);
    bCtx.beginPath();
    for (let s = 1; s <= steps; s++) {
      const d = s * 2;
      const wx = rx + d * Math.cos(a);
      const wy = ry + d * Math.sin(a) + Math.sin(d * 0.035 * Math.PI * 2) * 2.5;
      s === 1 ? bCtx.moveTo(wx, wy) : bCtx.lineTo(wx, wy);
    }
    bCtx.strokeStyle = c; bCtx.lineWidth = 1.2; bCtx.globalAlpha = 0.6; bCtx.stroke(); bCtx.globalAlpha = 1;
  });

  // Prism triangle
  bCtx.beginPath(); bCtx.moveTo(ptop.x, ptop.y); bCtx.lineTo(pbl.x, pbl.y); bCtx.lineTo(pbr.x, pbr.y); bCtx.closePath();
  bCtx.fillStyle = 'rgba(240,236,224,0.75)'; bCtx.fill();
  bCtx.strokeStyle = 'rgba(26,26,46,0.65)'; bCtx.lineWidth = 1.3; bCtx.stroke();

  // Nav dots + labels
  [{f:0.22, l:'THE BEAM'},{f:0.5, l:'THE PRISM'},{f:0.78, l:'REFRACTION'}].forEach(({f, l}, i) => {
    const dx = f * W, active = i === currentPanel;
    bCtx.beginPath(); bCtx.arc(dx, 16, active ? 3.5 : 2, 0, Math.PI * 2);
    bCtx.fillStyle = active ? 'rgba(26,26,46,0.72)' : 'rgba(26,26,46,0.18)'; bCtx.fill();
    bCtx.fillStyle = active ? 'rgba(26,26,46,0.65)' : 'rgba(26,26,46,0.22)';
    bCtx.font = '400 6.5px "DM Mono"'; bCtx.textAlign = 'center'; bCtx.fillText(l, dx, 30);
  });
}

// Beam drag events
beamCanvas.addEventListener('mousedown', e => { isDraggingBeam = true; dragStartX = e.clientX; dragStartBeamX = beamX; });
beamCanvas.addEventListener('touchstart', e => { isDraggingBeam = true; dragStartX = e.touches[0].clientX; dragStartBeamX = beamX; }, {passive:true});
window.addEventListener('mousemove', e => { if (isDraggingBeam) moveBeam(e.clientX); });
window.addEventListener('touchmove', e => { if (isDraggingBeam) moveBeam(e.touches[0].clientX); }, {passive:true});
window.addEventListener('mouseup',  endBeamDrag);
window.addEventListener('touchend', endBeamDrag);

function moveBeam(cx) {
  beamX = Math.max(0.06, Math.min(0.94, dragStartBeamX + (cx - dragStartX) / phone.clientWidth));
  drawBeam();
  const t = beamX < 0.33 ? 0 : beamX < 0.66 ? 1 : 2;
  if (t !== currentPanel) goToPanel(t);
}
function endBeamDrag() {
  if (!isDraggingBeam) return;
  isDraggingBeam = false;
  beamX = [0.22, 0.5, 0.78][currentPanel];
  drawBeam();
}
beamCanvas.addEventListener('click', e => {
  const x = e.clientX / phone.clientWidth;
  [{f:0.22,i:0},{f:0.5,i:1},{f:0.78,i:2}].forEach(({f, i}) => {
    if (Math.abs(x - f) < 0.13) goToPanel(i);
  });
});

// ── SWIPE ────────────────────────────────────────────────────
panelsEl.addEventListener('touchstart', e => { swipeStartX = e.touches[0].clientX; }, {passive:true});
panelsEl.addEventListener('touchend',   e => {
  const dx = e.changedTouches[0].clientX - swipeStartX;
  if (Math.abs(dx) > 50) {
    if (dx < 0 && currentPanel < 2) goToPanel(currentPanel + 1);
    if (dx > 0 && currentPanel > 0) goToPanel(currentPanel - 1);
  }
}, {passive:true});

// ── PANEL NAVIGATION ─────────────────────────────────────────
function goToPanel(idx) {
  currentPanel = idx;
  panelsEl.style.transition = 'transform 0.38s cubic-bezier(0.4,0,0.2,1)';
  panelsEl.style.transform  = `translateX(${-idx * phone.clientWidth}px)`;
  setTimeout(() => { panelsEl.style.transition = 'none'; }, 400);
  document.querySelectorAll('.pdot').forEach((d, i) => d.classList.toggle('active', i === idx));
  beamX = [0.22, 0.5, 0.78][idx];
  drawBeam();
  if (idx === 2 && submitted) setTimeout(renderAggregate, 80);
}

// ── SUBMIT ───────────────────────────────────────────────────
function submitResponse() {
  if (!pinPlaced) {
    quadrantEl.style.transition = 'transform 0.12s';
    quadrantEl.style.transform  = 'scale(1.02)';
    setTimeout(() => { quadrantEl.style.transform = ''; quadrantEl.style.transition = ''; }, 140);
    return;
  }
  const diverged = finalQuadrant !== initialChoice;
  console.log('PRISM RESPONSE', {
    initialChoice, finalQuadrant, diverged,
    x: Math.round(pinX * 200 - 100), y: Math.round((1 - pinY) * 200 - 100),
    zValue, text: document.getElementById('responseText').value
  });
  submitted = true;
  const btn = document.getElementById('submitBtn');
  btn.textContent = 'Position Recorded ✓';
  btn.classList.add('done'); btn.disabled = true;

  const locked = document.getElementById('aggLocked');
  locked.style.opacity = '0';
  setTimeout(() => { locked.style.display = 'none'; }, 650);

  const yp = document.getElementById('yourPin');
  yp.style.left = (pinX * 100) + '%'; yp.style.top = (pinY * 100) + '%'; yp.style.display = 'block';

  setTimeout(() => {
    document.getElementById('distA').style.width = '38%';
    document.getElementById('distB').style.width = '22%';
    document.getElementById('distC').style.width = '27%';
    document.getElementById('distD').style.width = '13%';
  }, 200);

  setTimeout(renderVoices, 900);
  setTimeout(() => goToPanel(2), 700);
}

// ── AGGREGATE CANVAS ─────────────────────────────────────────
function renderAggregate() {
  const canvas = document.getElementById('aggCanvas');
  const quad   = document.getElementById('aggQuad');
  const W = quad.clientWidth, H = quad.clientHeight;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  const C = {A:'#c94040', B:'#3a5a8c', C:'#4a8c5a', D:'#c87a30'};

  if (aggView === 'scatter') {
    MOCK.forEach(p => {
      ctx.beginPath(); ctx.arc(p.x * W, p.y * H, 2 + (p.v / 100) * 1.8, 0, Math.PI * 2);
      ctx.fillStyle = C[p.q]; ctx.globalAlpha = 0.3 + (p.v / 100) * 0.35; ctx.fill();
    }); ctx.globalAlpha = 1;
  } else {
    const r = 40, dens = new Float32Array(r * r); let mx = 0;
    MOCK.forEach(p => {
      const gi = Math.floor(p.x * r), gj = Math.floor(p.y * r);
      for (let di = -2; di <= 2; di++) for (let dj = -2; dj <= 2; dj++) {
        const ni = gi + di, nj = gj + dj;
        if (ni >= 0 && ni < r && nj >= 0 && nj < r) {
          const v = dens[nj * r + ni] += Math.exp(-(di * di + dj * dj) / 2);
          if (v > mx) mx = v;
        }
      }
    });
    const cw = W / r, ch = H / r;
    for (let j = 0; j < r; j++) for (let i = 0; i < r; i++) {
      const val = dens[j * r + i] / mx; if (val < 0.05) continue;
      const qx = i / r > 0.5 ? 'r' : 'l', qy = j / r < 0.5 ? 't' : 'b';
      ctx.fillStyle = qy==='t'&&qx==='r' ? `rgba(201,64,64,${val*0.65})`
                    : qy==='t'&&qx==='l' ? `rgba(58,90,140,${val*0.65})`
                    : qy==='b'&&qx==='l' ? `rgba(74,140,90,${val*0.65})`
                    :                      `rgba(200,122,48,${val*0.65})`;
      ctx.fillRect(i * cw, j * ch, cw + 1, ch + 1);
    }
  }
}

function setView(v) {
  aggView = v;
  document.getElementById('togScatter').classList.toggle('active', v === 'scatter');
  document.getElementById('togHeat').classList.toggle('active',    v === 'heat');
  if (submitted) renderAggregate();
}

// ── OTHER VOICES ─────────────────────────────────────────────
function renderVoices() {
  document.getElementById('otherVoices').innerHTML = VOICES.map(v => `
    <div class="voice-card">
      <div class="voice-avatar${v.zd ? ' z-deep' : ''}" style="background:${v.bg};">${v.i}</div>
      <div class="voice-info">
        <div class="voice-name">${v.name}</div>
        <div class="voice-meta">${v.meta}</div>
        <div class="voice-quote">${v.q}</div>
        <div class="voice-coords">${v.c}</div>
      </div>
    </div>`).join('');
}

// ── INIT ─────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  resizeBeam();
  panelsEl.style.transform = `translateX(${-currentPanel * phone.clientWidth}px)`;
});

buildAnswerButtons();
buildCornerLabels();
resizeBeam();

requestAnimationFrame(() => {
  panelsEl.style.transform  = `translateX(${-1 * phone.clientWidth}px)`;
  panelsEl.style.transition = 'none';
  currentPanel = 1;
  document.querySelectorAll('.pdot').forEach((d, i) => d.classList.toggle('active', i === 1));
  beamX = 0.5;
  drawBeam();
});
