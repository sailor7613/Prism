// ============================================================
// ZAXIS.JS — Z axis detection, trigger logic, and 3D reveal
// ============================================================

const Z_RULES = [
  { pattern: /moral|ought|should|justice|right|wrong|obligation/i,  valence: +1, label: 'moral framing' },
  { pattern: /will|won't|going to|predict|expect|inevitable|china|beijing/i, valence: -1, label: 'strategic prediction' },
  { pattern: /but|however|yet|though|although|ambivalent|conflicted/i, valence: -1, label: 'internal tension' },
  { pattern: /people|civilian|human|suffer|cost|innocent/i,          valence: +1, label: 'ethical weight' },
  { pattern: /power|leverage|signal|deterrence|escalat/i,            valence: -1, label: 'realpolitik' },
];

function analyzeZLocal(text, chosenKey) {
  if (text.length < 40) return null;
  let score = 0;
  let reasons = [];
  Z_RULES.forEach(r => {
    if (r.pattern.test(text)) { score += r.valence; reasons.push(r.label); }
  });
  const interventionist = ['A','B'].includes(chosenKey);
  const hasAntiText = /reckless|risk|wrong|danger|provocation|mistake/i.test(text);
  const hasProText  = /necessary|must|defend|protect|deterrence|obligation/i.test(text);
  if (interventionist && hasAntiText) score -= 2;
  if (!interventionist && hasProText) score += 2;
  return { z: Math.min(100, Math.max(-100, score * 22)), reason: reasons.slice(0,2).join(' + ') || 'position detected' };
}

function onResponseInput() {
  const text = document.getElementById('responseText').value;
  const len = text.length;
  const cc = document.getElementById('charCount');
  cc.textContent = len + ' / 180';
  cc.className = 'char-count' + (len >= 180 ? ' at-limit' : len >= 150 ? ' near-limit' : '');
  if (zTimer) clearTimeout(zTimer);
  if (len < 40) return;
  document.getElementById('zAnalyzing').classList.add('visible');
  zTimer = setTimeout(() => runZAnalysis(text), 1200);
}

function runZAnalysis(text) {
  const result = analyzeZLocal(text, initialChoice);
  document.getElementById('zAnalyzing').classList.remove('visible');
  if (!result) return;
  zValue = result.z;
  if (Math.abs(zValue) >= 15 && !zRevealed) revealZ(result.reason);
}

function revealZ(reason) {
  zRevealed = true;
  document.getElementById('quadrant').classList.add('z-revealed');
  const a = Math.abs(zValue);
  if (a >= 60) userPin.style.boxShadow = '0 8px 24px rgba(0,0,0,0.38),0 2px 6px rgba(0,0,0,0.18)';
  else if (a >= 30) userPin.style.boxShadow = '0 4px 12px rgba(0,0,0,0.22)';
  document.getElementById('zHint').classList.add('visible');
  const badge = document.getElementById('zBadge');
  document.getElementById('zBadgeText').textContent = reason || 'depth gap detected';
  badge.classList.add('visible');
}
