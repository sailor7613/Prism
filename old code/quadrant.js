// ============================================================
// QUADRANT.JS — Quadrant interaction, pin placement, word weights
// ============================================================

const quadrantEl = document.getElementById('quadrant');
const userPin    = document.getElementById('userPin');

function buildAnswerButtons() {
  const grid = document.getElementById('answersGrid');
  const order = ['A','B','C','D'].sort(() => Math.random() - 0.5);
  grid.innerHTML = order.map(k => `
    <button class="answer-btn" id="btn-${k}" onclick="selectAnswer('${k}')">${ANSWERS[k].text}</button>
  `).join('');
}

function buildCornerLabels() {
  ['A','B','C','D'].forEach(k => {
    document.getElementById('ql-' + k).innerHTML =
      ANSWERS[k].words.map(({t, w}) =>
        `<span class="word" data-weight="${w || ''}">${t}</span>`
      ).join('');
  });
}

function selectAnswer(k) {
  if (initialChoice !== null) return;
  initialChoice = k;
  document.getElementById('btn-' + k).classList.add('chosen');
  setTimeout(() => {
    document.getElementById('answersGrid').classList.add('dissolving');
    setTimeout(() => {
      document.getElementById('answersGrid').style.display = 'none';
      revealQuadrant(k);
    }, 320);
  }, 160);
}

function revealQuadrant(chosenKey) {
  const section = document.getElementById('quadrantSection');
  section.classList.add('revealed');
  ['A','B','C','D'].forEach(k => document.getElementById('shade-' + k).classList.add('lit'));
  [{k:'A',d:60},{k:'B',d:160},{k:'C',d:240},{k:'D',d:320}].forEach(({k,d}) => {
    setTimeout(() => scatterLabel(k), d);
  });
  const pos = {A:[0.72,0.28], B:[0.28,0.28], C:[0.28,0.72], D:[0.72,0.72]};
  const [px, py] = pos[chosenKey];
  pinX = px; pinY = py;
  const ring  = document.getElementById('pinRing');
  const pulse = document.getElementById('pinPulse');
  const color = COLORS[chosenKey];
  userPin.style.background    = color;
  ring.style.borderColor      = color;
  pulse.style.borderColor     = color;
  userPin.style.left = (px * 100) + '%';
  userPin.style.top  = (py * 100) + '%';
  setTimeout(() => {
    userPin.classList.add('visible');
    pinPlaced     = true;
    finalQuadrant = chosenKey;
    updateCoordsDisplay();
    updateWordWeights();
  }, 480);
  setTimeout(() => {
    document.getElementById('panel1').scrollTo({top: 130, behavior: 'smooth'});
  }, 200);
}

function scatterLabel(k) {
  const el = document.getElementById('ql-' + k);
  el.style.transition = 'none';
  el.style.opacity    = '0';
  el.style.transform  = 'scale(0.55)';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.style.transition = 'opacity 0.6s ease, transform 0.6s cubic-bezier(0.18,1.2,0.4,1)';
    el.style.opacity    = '1';
    el.style.transform  = 'scale(1)';
  }));
}

function updatePin(cx, cy) {
  const rect = quadrantEl.getBoundingClientRect();
  pinX = Math.max(0.02, Math.min(0.98, (cx - rect.left) / rect.width));
  pinY = Math.max(0.02, Math.min(0.98, (cy - rect.top)  / rect.height));
  pinPlaced = true;
  userPin.style.left = (pinX * 100) + '%';
  userPin.style.top  = (pinY * 100) + '%';
  userPin.classList.add('visible');
  const newQ = pinX >= 0.5 && pinY < 0.5 ? 'A'
             : pinX <  0.5 && pinY < 0.5 ? 'B'
             : pinX <  0.5 && pinY >= 0.5 ? 'C' : 'D';
  if (newQ !== finalQuadrant) {
    finalQuadrant = newQ;
    const color = COLORS[newQ];
    userPin.style.background               = color;
    document.getElementById('pinRing').style.borderColor  = color;
    document.getElementById('pinPulse').style.borderColor = color;
  }
  updateCoordsDisplay();
  updateWordWeights();
}

function updateCoordsDisplay() {
  const xRaw = Math.round((pinX - 0.5) * 200);
  const yRaw = Math.round((0.5 - pinY) * 200);
  document.getElementById('coordsDisplay').textContent =
    `x ${xRaw >= 0 ? '+' : ''}${xRaw}  ·  y ${yRaw >= 0 ? '+' : ''}${yRaw}`;
}

function updateWordWeights() {
  const xVal = (pinX - 0.5) * 2;
  const yVal = (0.5 - pinY) * 2;
  document.querySelectorAll('.q-corner-label .word').forEach(span => {
    const w = span.dataset.weight;
    if (!w) { span.classList.remove('boost','dim'); return; }
    let relevance = 0;
    if (w === 'x+') relevance =  xVal;
    if (w === 'x-') relevance = -xVal;
    if (w === 'y+') relevance =  yVal;
    if (w === 'y-') relevance = -yVal;
    if (relevance > 0.28)       { span.classList.add('boost'); span.classList.remove('dim'); }
    else if (relevance < -0.22) { span.classList.add('dim');   span.classList.remove('boost'); }
    else                        { span.classList.remove('boost','dim'); }
  });
}

// Quadrant mouse/touch events
quadrantEl.addEventListener('mousedown', e => { e.preventDefault(); updatePin(e.clientX, e.clientY); });
quadrantEl.addEventListener('mousemove', e => { if (e.buttons === 1) updatePin(e.clientX, e.clientY); });
quadrantEl.addEventListener('touchstart', e => { e.stopPropagation(); updatePin(e.touches[0].clientX, e.touches[0].clientY); }, {passive:true});
quadrantEl.addEventListener('touchmove',  e => { e.stopPropagation(); updatePin(e.touches[0].clientX, e.touches[0].clientY); }, {passive:true});
