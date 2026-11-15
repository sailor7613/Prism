// ════════════════════════════════════════════════════════════════════════════
// THE BINNACLE AND THE FLIGHTS (2026-11-11, Sailor, by voice on a walk)
// ════════════════════════════════════════════════════════════════════════════
// "The nav tool should be a compass binnacle for, say, an autopilot on a
//  sailboat — to reflect the whole cybernetic thing."
//
// TWO THINGS LIVE HERE.
//
// 1. THE FLIGHTS. Every way of going somewhere in the villa used to be a
//    straight line between two points, eased. It is now a curve: the eye
//    swings wide of what it is going to look at, banks a little into the
//    turn, locks onto the destination a little past half way and keeps
//    travelling — so near things slide across far things on the way in —
//    and after it lands it keeps panning slowly for a few seconds.
//    The main file marks a flight with flightMark(); this file plans it
//    (flightPlan) and flies it (flightTick, called from updateCamera).
//    Anything that does NOT call flightMark — a talk's glide, the walk, the
//    G4's voyage, the fly-over — still moves exactly as it did.
//
//    A COURSE is a flight with a drawn path: named points to pass, and
//    things to look at on the way. They are in COURSES below. A place with
//    no drawn path still flies — it gets one arc, worked out from where you
//    are and where it is.
//
// 2. THE BINNACLE. The compass dial's place, bottom-left. A brass drum with
//    a hooded glass dome, a card floating in it, and a one-bit display set
//    into the front. Tap it and the courses open. It does nothing on hover.
//
//    THE ONE CYBERNETIC THING: you can watch it steer. The card turns with
//    your heading. A red marker on the bowl's rim sits at the heading the
//    course is set to. The gap between the marker and the lubber line is
//    the error. The bar at the bottom of the display is the rudder: it
//    swings while the machine is turning you and comes back to the middle
//    as the error closes. Take the view yourself (drag, scroll, a key) and
//    it goes to STBY: the rudder goes slack, the marker stays where it was,
//    and the error is yours.
//
// Three modes, the three keys of a real autopilot:
//    AUTO  — it flies a circuit of the main stops by itself, pausing at each
//    STBY  — standby: you have the helm
//    TACK  — on to the next stop
//
// THE PANEL IS THE WHOLE MENU (2026-11-12, Sailor: "delete whatever doesn't
// make sense any longer, and integrate what remains"). Under the three keys:
// the courses; one link that swaps the courses for every other place; and
// six view keys carried over from the old compass menu — day, orbit,
// pierce, walk, ask Ted, photo. The old rows and the waves are gone.
//
// Loaded by dreamgetty/index.html after the main script. It reads and
// writes the main script's own camera variables (approach, camTarget,
// camTheta …), which are ordinary top-level lets and consts.
// ════════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var HARNESS = (typeof window !== 'undefined') && !!window.__BN_HARNESS;   // the design page: draw only, no villa
  if (!HARNESS && (typeof approach === 'undefined' || typeof THREE === 'undefined')) return;

  // ──────────────────────────────────────────────────────────────────────────
  // THE STOPS. `kind` says how the villa already knows the thing:
  //   place  — a row of PLACE_REGISTRY (goToPlace)
  //   focus  — a focus target (focusOn): the camera locks on it
  //   object — the Object on the pedestal, its light out to the pool
  //   free   — a camera position of its own, written here
  // `via` are points the eye passes through. `looks` are what it looks at on
  // the way. `at` counts the drawn points: 0 is where you set off from, 1 is
  // the first `via`, 2.5 is half way between the second and the third, and so
  // on. Where it starts looking and where it ends up looking are implied.
  // `dur` is the seconds given to the drawn part; getting to the first point
  // from wherever you were is timed by its distance, and is quicker.
  // `under` lets a path go below the floor. `always` flies the whole path
  // even when you are already standing near the end of it.
  // Coordinates: the Object is at (0, 4.3, 0), north (the mountain) is −z,
  // the pool runs from z 13 to z 27, the prism floats near (0, 6.9, 16).
  // ──────────────────────────────────────────────────────────────────────────
  var COURSES = [
    { key: 'object', lcd: 'OBJECT', kind: 'object',
      // in close past the prism, looking up the beam at the Object, then out to the lawn
      via: [[5.5, 8.4, 15.5]],
      looks: [{ at: 0.7, p: [0, 4.3, 0] }, { at: 1.3, p: [0, 4.3, 0] }] },
    { key: 'beam', lcd: 'THE BEAM', kind: 'free', hold: 'Object', object: true, under: true, always: true, dur: 14,
      // Sailor's own flight, 11-11: locked on the Object, back down the beam until the prism passes
      // overhead, then out past the map and under it
      end: [3.2, 0.2, 26.5], look: [0, 2.5, 18],
      via: [[0.6, 4.9, 3.4], [0.5, 5.45, 9.5], [0.3, 5.0, 16.4], [1.5, 3.0, 23]],
      looks: [{ at: 0.55, p: [0, 4.3, 0] }, { at: 3.5, p: [0, 4.3, 0] }, { at: 4.4, p: [0, 4.6, 12] }] },
    { key: 'pool', lcd: 'THE POOL', kind: 'free', object: true,
      // low round the seaward end of the pool, behind the stand that holds its book
      end: [7.2, 4.6, 27.5], look: [0, 2.0, 19.3],
      via: [[-7.5, 2.7, 24], [-2, 2.3, 29.6]] },
    { key: 'venus', lcd: 'VENUS', kind: 'focus', focus: 'Venus de Milo',
      // in past the Object's right side and round behind it: the Object crosses in front of her
      via: [[3.2, 4.4, 5.5], [1.7, 4.0, -1.9]], dur: 6,
      looks: [{ at: 0.9, p: [-6, 2.8, -3] }] },
    { key: 'g4', lcd: 'M3P', kind: 'focus', focus: 'iMac G4', noPan: true,
      via: [[2.2, 3.8, 6.2]] },
    { key: 'galleria', lcd: 'GALLERIA', kind: 'place', place: 'galleria', always: true, dur: 16,
      // the long way round: once round the house outside its walls, the eye held on the pedestal
      via: [[-12, 5.5, 13], [-15.5, 6.5, -2], [-8, 8.5, -14], [7, 9, -15], [15.5, 7, -3], [13, 6.5, 12]],
      looks: [{ at: 0.9, p: [0, 3.6, 0] }, { at: 6.5, p: [0, 3.6, 0] }] },
    { key: 'graphmap', lcd: 'GRAPHMAP', kind: 'focus', focus: 'Graphmap', pedestal: 'graphmap' },   // puts the graphmap on the pedestal first
    { key: 'easel', lcd: 'EASEL', kind: 'focus', focus: 'Easel' },
    { key: 'observatory', lcd: 'OBSERVATORY', kind: 'place', place: 'observatory', dur: 11,
      // over the roof, up behind the house, along the ridge
      via: [[9, 13, -10], [24, 36, -44], [31, 61, -60]],
      looks: [{ at: 1.7, p: [0, 44, -76] }] },
    { key: 'beach', lcd: 'BEACH', kind: 'place', place: 'beach', dur: 9,
      // over the pool, off the cliff's edge, down the valley
      via: [[3, 5.5, 33], [-2, 1.5, 47], [6, -3.5, 56]],
      looks: [{ at: 1.7, p: [0, -6, 72] }] },
  ];
  var CIRCUIT = ['object', 'beam', 'venus', 'galleria', 'pool'];   // what AUTO flies, in order
  var DWELL = 15;                                                   // seconds AUTO waits at a stop
  // what the display calls a thing that was reached some other way (a click on it, Ted taking you)
  var LCD_NAMES = { 'Venus de Milo': 'VENUS', 'iMac G4': 'M3P', 'Object': 'OBJECT', 'Tracker': 'THE GLOBE',
    'Graphmap': 'GRAPHMAP', 'Easel': 'EASEL', 'Ted Turner': 'TED', 'Acacia Tree': 'ACACIA', 'Surfboard': 'SURFBOARD' };

  // ──────────────────────────────────────────────────────────────────────────
  // THE PIXEL FACE — five by seven, drawn here, struck twice for weight.
  // It is not Chicago; it is a chunky face of the same family feeling.
  // ──────────────────────────────────────────────────────────────────────────
  var GLYPHS = {
    'A': '.###.|#...#|#...#|#####|#...#|#...#|#...#', 'B': '####.|#...#|#...#|####.|#...#|#...#|####.',
    'C': '.###.|#...#|#....|#....|#....|#...#|.###.', 'D': '####.|#...#|#...#|#...#|#...#|#...#|####.',
    'E': '#####|#....|#....|####.|#....|#....|#####', 'F': '#####|#....|#....|####.|#....|#....|#....',
    'G': '.###.|#...#|#....|#.###|#...#|#...#|.###.', 'H': '#...#|#...#|#...#|#####|#...#|#...#|#...#',
    'I': '.###.|..#..|..#..|..#..|..#..|..#..|.###.', 'J': '..###|...#.|...#.|...#.|...#.|#..#.|.##..',
    'K': '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#', 'L': '#....|#....|#....|#....|#....|#....|#####',
    'M': '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#', 'N': '#...#|##..#|#.#.#|#..##|#...#|#...#|#...#',
    'O': '.###.|#...#|#...#|#...#|#...#|#...#|.###.', 'P': '####.|#...#|#...#|####.|#....|#....|#....',
    'Q': '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#', 'R': '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
    'S': '.####|#....|#....|.###.|....#|....#|####.', 'T': '#####|..#..|..#..|..#..|..#..|..#..|..#..',
    'U': '#...#|#...#|#...#|#...#|#...#|#...#|.###.', 'V': '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..',
    'W': '#...#|#...#|#...#|#.#.#|#.#.#|##.##|#...#', 'X': '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
    'Y': '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..', 'Z': '#####|....#|...#.|..#..|.#...|#....|#####',
    '0': '.###.|#...#|#...#|#...#|#...#|#...#|.###.', '1': '..#..|.##..|..#..|..#..|..#..|..#..|.###.',
    '2': '.###.|#...#|....#|...#.|..#..|.#...|#####', '3': '####.|....#|....#|.###.|....#|....#|####.',
    '4': '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.', '5': '#####|#....|####.|....#|....#|#...#|.###.',
    '6': '..##.|.#...|#....|####.|#...#|#...#|.###.', '7': '#####|....#|...#.|..#..|.#...|.#...|.#...',
    '8': '.###.|#...#|#...#|.###.|#...#|#...#|.###.', '9': '.###.|#...#|#...#|.####|....#|...#.|.##..',
    ' ': '.....|.....|.....|.....|.....|.....|.....', '-': '.....|.....|.....|#####|.....|.....|.....',
    '.': '.....|.....|.....|.....|.....|.##..|.##..', '\'': '..#..|..#..|.....|.....|.....|.....|.....',
    '>': '#....|##...|###..|####.|###..|##...|#....', '<': '....#|...##|..###|.####|..###|...##|....#',
    '*': '.##..|#..#.|#..#.|.##..|.....|.....|.....',   // the degree ring
  };
  function glyph(ch) { return (GLYPHS[ch] || GLYPHS[' ']).split('|'); }
  // width of a line of text in font pixels (before scaling)
  function textW(s, bold) { return s.length ? s.length * (bold ? 7 : 6) - 1 : 0; }
  // draw text as filled squares; `px` is the size of one font pixel in the context's units
  function drawText(ctx, s, x, y, px, bold) {
    for (var i = 0; i < s.length; i++) {
      var g = glyph(s.charAt(i)), ox = x + i * (bold ? 7 : 6) * px;
      for (var r = 0; r < 7; r++) for (var c = 0; c < 5; c++) {
        if (g[r].charAt(c) !== '#') continue;
        ctx.fillRect(ox + c * px, y + r * px, bold ? px * 2 : px, px);
      }
    }
  }
  // a label as its own small canvas, for the keys in the panel
  function pixLabel(s, bold) {
    var dpr = window.devicePixelRatio || 1, k = Math.max(1, Math.round(1.5 * dpr));
    var w = textW(s, bold) + (bold ? 1 : 0), cv = document.createElement('canvas');
    cv.width = w * k; cv.height = 7 * k;
    cv.style.width = (w * k / dpr) + 'px'; cv.style.height = (7 * k / dpr) + 'px';
    var c = cv.getContext('2d'); c.fillStyle = '#000';
    drawText(c, s, 0, 0, k, bold);
    return cv;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // THE STATE the instrument shows. The villa half fills it; the drawing half
  // only reads it.
  // ──────────────────────────────────────────────────────────────────────────
  var bn = {
    mode: 'stby',        // 'stby' | 'trk' (on a course) | 'auto'
    hdg: 0,              // where the eye points, degrees, 0 = north
    set: null,           // the heading the course is set to, or null
    course: '',          // what the display's middle line says
    rudder: 0,           // −1 … 1, how hard the machine is turning you
    card: 0, cardV: 0,   // the card's own angle and speed: it floats, so it lags and settles
    tilt: 0,             // the card leans in a bank
    key: null,           // the course key in force
  };

  // ──────────────────────────────────────────────────────────────────────────
  // THE DISPLAY — 58 × 38, one bit. Heading on top, the course under it, the
  // mode and the rudder along the bottom.
  // ──────────────────────────────────────────────────────────────────────────
  var LCD_W = 58, LCD_H = 38;
  var lcd = document.createElement('canvas'); lcd.width = LCD_W; lcd.height = LCD_H;
  var lcdKey = '';
  function drawLCD(now) {
    var h = ((Math.round(bn.hdg) % 360) + 360) % 360;
    var name = bn.course || '';
    var long = name.length > 9, off = 0;
    if (long) {                                   // a long name walks across, pausing at each end
      var span = textW(name, false) - (LCD_W - 4), cyc = span + 36;
      var ph = Math.floor(now * 14) % (cyc * 2);
      if (ph >= cyc) ph = cyc * 2 - ph;
      off = Math.max(0, Math.min(span, ph - 18));
    }
    var rud = Math.round(Math.max(-1, Math.min(1, bn.rudder)) * 11);
    var key = h + '|' + name + '|' + off + '|' + bn.mode + '|' + rud;
    if (key === lcdKey) return false;
    lcdKey = key;
    var c = lcd.getContext('2d');
    c.fillStyle = '#f6f4ea'; c.fillRect(0, 0, LCD_W, LCD_H);
    c.fillStyle = '#0b0b0b';
    // the heading, double size
    var hs = (h < 100 ? '0' : '') + (h < 10 ? '0' : '') + h;
    var hx = Math.floor((LCD_W - 46) / 2);
    for (var i = 0; i < 3; i++) drawText(c, hs.charAt(i), hx + i * 14, 2, 2, true);
    drawText(c, '*', hx + 42, 2, 1, false);
    // the course
    if (long) {
      c.save(); c.beginPath(); c.rect(2, 18, LCD_W - 4, 7); c.clip();
      drawText(c, name, 2 - off, 18, 1, false);
      c.restore();
    } else {
      var bold = name.length <= 8;
      drawText(c, name, Math.floor((LCD_W - textW(name, bold) - (bold ? 1 : 0)) / 2), 18, 1, bold);
    }
    // the mode, white on black
    var tag = bn.mode === 'auto' ? 'AUTO' : bn.mode === 'trk' ? 'TRK' : 'STBY';
    var tw = textW(tag, false) + 4;
    c.fillRect(1, 27, tw, 10);
    c.fillStyle = '#f6f4ea'; drawText(c, tag, 3, 28, 1, false);
    c.fillStyle = '#0b0b0b';
    // the rudder
    var x0 = 31, x1 = 55, mid = 43;
    c.fillRect(x0, 35, x1 - x0 + 1, 1);
    c.fillRect(x0, 32, 1, 3); c.fillRect(x1, 32, 1, 3); c.fillRect(mid, 31, 1, 4);
    var px = mid + rud;
    if (bn.mode === 'stby') {                     // slack: an empty box
      c.fillRect(px - 2, 27, 5, 1); c.fillRect(px - 2, 31, 5, 1);
      c.fillRect(px - 2, 27, 1, 5); c.fillRect(px + 2, 27, 1, 5);
    } else c.fillRect(px - 2, 27, 5, 5);
    return true;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // THE BODY — brass, glass, a card in fluid. Drawn in a 116 × 172 box.
  // ──────────────────────────────────────────────────────────────────────────
  var BW = 116, BH = 172, CX = 58, DY = 74;       // DY: the dome's centre line
  function brass(ctx, x0, x1, dark) {
    var g = ctx.createLinearGradient(x0, 0, x1, 0), k = dark ? 0.78 : 1;
    function col(r, gg, b) { return 'rgb(' + Math.round(r * k) + ',' + Math.round(gg * k) + ',' + Math.round(b * k) + ')'; }
    g.addColorStop(0.00, col(74, 49, 14));
    g.addColorStop(0.12, col(150, 108, 38));
    g.addColorStop(0.30, col(236, 206, 128));
    g.addColorStop(0.42, col(250, 232, 170));
    g.addColorStop(0.56, col(196, 150, 62));
    g.addColorStop(0.80, col(128, 88, 28));
    g.addColorStop(1.00, col(62, 40, 10));
    return g;
  }
  function ell(ctx, cx, cy, rx, ry, a0, a1, ccw) { ctx.ellipse(cx, cy, rx, ry, 0, a0, a1, !!ccw); }

  function drawBody(ctx, S, dpr, now) {
    var W = Math.round(BW * S * dpr), H = Math.round(BH * S * dpr), u = S * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.setTransform(u, 0, 0, u, 0, 0);
    ctx.lineJoin = 'round';

    // its shadow on the glass of the screen
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ell(ctx, CX, 168, 56, 4, 0, Math.PI * 2); ctx.fill();

    // the base
    ctx.fillStyle = brass(ctx, 1, 115, true);
    ctx.beginPath(); ctx.moveTo(4, 161); ctx.lineTo(112, 161); ctx.quadraticCurveTo(115, 162, 115, 166);
    ctx.lineTo(115, 168); ctx.quadraticCurveTo(115, 171, 111, 171); ctx.lineTo(5, 171);
    ctx.quadraticCurveTo(1, 171, 1, 168); ctx.lineTo(1, 166); ctx.quadraticCurveTo(1, 162, 4, 161); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,190,0.35)'; ctx.fillRect(5, 162, 106, 1);

    // the drum
    ctx.fillStyle = brass(ctx, 8, 108);
    ctx.beginPath(); ctx.moveTo(7, 92); ctx.lineTo(109, 92); ctx.lineTo(108, 162); ctx.lineTo(8, 162); ctx.closePath(); ctx.fill();
    // two turned lines round it
    ctx.fillStyle = 'rgba(50,30,6,0.45)'; ctx.fillRect(8, 157, 100, 1);
    ctx.fillStyle = 'rgba(255,242,196,0.30)'; ctx.fillRect(8, 158, 100, 1);

    // inside the hood: the back wall, in shadow
    var gi = ctx.createLinearGradient(0, DY - 48, 0, DY);
    gi.addColorStop(0, '#2a1b06'); gi.addColorStop(1, '#0c1418');
    ctx.fillStyle = gi;
    ctx.beginPath(); ctx.arc(CX, DY, 47, Math.PI, 0); ctx.closePath(); ctx.fill();

    // the bowl: fluid
    var gf = ctx.createRadialGradient(CX, DY + 2, 4, CX, DY + 2, 46);
    gf.addColorStop(0, '#23505a'); gf.addColorStop(0.6, '#123440'); gf.addColorStop(1, '#07151c');
    ctx.fillStyle = gf;
    ctx.beginPath(); ell(ctx, CX, DY, 45, 13, 0, Math.PI * 2); ctx.fill();

    // the card
    var cyc = DY + 1 + bn.tilt * 1.2, rx = 35, ry = 10 + bn.tilt * 0.8;
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.beginPath(); ell(ctx, CX, cyc + 2.5, rx, ry, 0, Math.PI * 2); ctx.fill();
    var gc = ctx.createLinearGradient(0, cyc - ry, 0, cyc + ry);
    gc.addColorStop(0, '#cfc8b2'); gc.addColorStop(1, '#f4efdf');
    ctx.fillStyle = gc;
    ctx.beginPath(); ell(ctx, CX, cyc, rx, ry, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(20,16,8,0.55)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ell(ctx, CX, cyc, rx, ry, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ell(ctx, CX, cyc, rx * 0.56, ry * 0.56, 0, Math.PI * 2); ctx.stroke();
    // its marks: `rel` 0 is the far edge, where the lubber line stands
    var card = bn.card * Math.PI / 180;
    function onCard(deg, f) {
      var rel = deg * Math.PI / 180 - card;
      return { x: CX + Math.sin(rel) * rx * f, y: cyc - Math.cos(rel) * ry * f, near: (1 - Math.cos(rel)) / 2 };
    }
    for (var d = 0; d < 360; d += 10) {
      var big = d % 30 === 0, a = onCard(d, 1), b = onCard(d, big ? 0.80 : 0.89);
      ctx.strokeStyle = 'rgba(14,12,8,' + (0.45 + 0.5 * a.near) + ')'; ctx.lineWidth = big ? 1.1 : 0.6;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    [['N', 0], ['E', 90], ['S', 180], ['W', 270]].forEach(function (m) {
      var p = onCard(m[1], 0.66);
      ctx.font = 'bold ' + (5.5 + 3.2 * p.near).toFixed(1) + 'px Georgia, serif';
      ctx.fillStyle = m[0] === 'N' ? 'rgba(178,34,24,' + (0.7 + 0.3 * p.near) + ')' : 'rgba(14,12,8,' + (0.55 + 0.45 * p.near) + ')';
      ctx.fillText(m[0], p.x, p.y + 0.3);
    });
    ctx.fillStyle = '#b08a3a'; ctx.beginPath(); ctx.arc(CX, cyc, 1.6, 0, Math.PI * 2); ctx.fill();

    // the lubber line: a pin at the far edge
    ctx.strokeStyle = '#0d0d0d'; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(CX, cyc - ry + 2.5); ctx.lineTo(CX, cyc - ry - 7); ctx.stroke();
    ctx.fillStyle = '#e9e2cc'; ctx.beginPath(); ctx.arc(CX, cyc - ry - 7.5, 1.3, 0, Math.PI * 2); ctx.fill();

    // the set heading: a red marker riding the rim
    if (bn.set != null) {
      var rb = (bn.set - bn.card) * Math.PI / 180;
      var bx = CX + Math.sin(rb) * 41, by = DY + 1 - Math.cos(rb) * 12.2, far = Math.cos(rb) > 0;
      var ang = Math.atan2((cyc - by) * 3.4, CX - bx);             // points at the pivot
      ctx.save(); ctx.translate(bx, by); ctx.rotate(ang);
      ctx.fillStyle = bn.mode === 'stby' ? 'rgba(214,74,40,0.55)' : '#e8502a';
      ctx.strokeStyle = 'rgba(60,10,0,0.8)'; ctx.lineWidth = 0.5;
      var s = far ? 2.6 : 3.6;
      ctx.beginPath(); ctx.moveTo(s * 1.5, 0); ctx.lineTo(-s * 0.6, -s * 0.8); ctx.lineTo(-s * 0.6, s * 0.8); ctx.closePath();
      ctx.fill(); ctx.stroke(); ctx.restore();
    }

    // the glass
    ctx.save();
    ctx.beginPath(); ctx.arc(CX, DY, 42, Math.PI, 0); ell(ctx, CX, DY, 42, 12, 0, Math.PI); ctx.closePath(); ctx.clip();
    var gg = ctx.createLinearGradient(CX - 42, DY - 42, CX + 30, DY + 10);
    gg.addColorStop(0, 'rgba(210,235,245,0.20)'); gg.addColorStop(0.45, 'rgba(210,235,245,0.03)'); gg.addColorStop(1, 'rgba(255,255,255,0.09)');
    ctx.fillStyle = gg; ctx.fillRect(CX - 44, DY - 44, 88, 60);
    ctx.strokeStyle = 'rgba(255,255,255,0.50)'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(CX, DY, 36, Math.PI * 1.10, Math.PI * 1.27); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(CX, DY, 38, Math.PI * 1.80, Math.PI * 1.93); ctx.stroke();
    ctx.restore();

    // the hood: a visor over the top and back of the dome
    ctx.fillStyle = brass(ctx, CX - 48, CX + 48);
    ctx.beginPath(); ctx.arc(CX, DY, 48, Math.PI, 0);
    ell(ctx, CX, DY, 42, 26, 0, Math.PI, true); ctx.closePath(); ctx.fill();
    var gh = ctx.createLinearGradient(0, DY - 48, 0, DY - 14);
    gh.addColorStop(0, 'rgba(255,246,208,0.34)'); gh.addColorStop(0.5, 'rgba(255,246,208,0)'); gh.addColorStop(1, 'rgba(40,24,4,0.34)');
    ctx.fillStyle = gh;
    ctx.beginPath(); ctx.arc(CX, DY, 48, Math.PI, 0);
    ell(ctx, CX, DY, 42, 26, 0, Math.PI, true); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(46,28,6,0.75)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ell(ctx, CX, DY, 42, 26, Math.PI, 0); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,244,200,0.5)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ell(ctx, CX, DY, 43.2, 27.2, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
    // rivets along the visor's edge
    for (var r = 0; r < 7; r++) {
      var ra = Math.PI * (1.14 + r * 0.12), qx = CX + Math.cos(ra) * 45, qy = DY + Math.sin(ra) * 31;
      ctx.fillStyle = 'rgba(60,38,8,0.75)'; ctx.beginPath(); ctx.arc(qx + 0.3, qy + 0.4, 1.1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f6e3a4'; ctx.beginPath(); ctx.arc(qx, qy, 0.9, 0, Math.PI * 2); ctx.fill();
    }
    // the knob
    ctx.fillStyle = brass(ctx, CX - 3, CX + 3, true); ctx.fillRect(CX - 2, 20, 4, 7);
    var gk = ctx.createRadialGradient(CX - 1.4, 15.4, 0.4, CX, 17, 4.6);
    gk.addColorStop(0, '#fff3c4'); gk.addColorStop(0.45, '#d2a548'); gk.addColorStop(1, '#5a3c10');
    ctx.fillStyle = gk; ctx.beginPath(); ctx.arc(CX, 17, 4.4, 0, Math.PI * 2); ctx.fill();

    // the collar: the bowl's front rim, and the band under it
    ctx.fillStyle = brass(ctx, 4, 112);
    ctx.beginPath(); ctx.moveTo(4, DY); ell(ctx, CX, DY, 54, 16, Math.PI, 0, true);
    ctx.lineTo(112, 93); ctx.quadraticCurveTo(CX, 99, 4, 93); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,246,206,0.75)'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ell(ctx, CX, DY, 53.4, 15.4, Math.PI * 0.94, Math.PI * 0.06, true); ctx.stroke();
    ctx.strokeStyle = 'rgba(40,24,4,0.6)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ell(ctx, CX, DY, 45, 13, Math.PI, 0, true); ctx.stroke();
    ctx.strokeStyle = 'rgba(40,24,4,0.45)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(4, 93); ctx.quadraticCurveTo(CX, 99, 112, 93); ctx.stroke();

    // the display, set into the drum. Its pixels are whole device pixels.
    var k = Math.max(1, Math.round(1.5 * u));
    while (k > 1 && (LCD_W * k + 6 * u) > 98 * u) k--;
    var lw = LCD_W * k, lh = LCD_H * k;
    var lx = Math.round((W - lw) / 2), ly = Math.round(128.5 * u - lh / 2);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    var bz = Math.max(2, Math.round(2.4 * u));
    ctx.fillStyle = 'rgba(30,18,2,0.55)'; rr(ctx, lx - bz - 1, ly - bz - 1, lw + bz * 2 + 2, lh + bz * 2 + 2, bz * 1.6); ctx.fill();
    ctx.fillStyle = '#0d0d0d'; rr(ctx, lx - bz, ly - bz, lw + bz * 2, lh + bz * 2, bz * 1.3); ctx.fill();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(lcd, 0, 0, LCD_W, LCD_H, lx, ly, lw, lh);
    // the screen's corners are round, as they were
    ctx.fillStyle = '#0d0d0d';
    [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(function (q) {
      ctx.fillRect(lx + q[0] * (lw - k), ly + q[1] * (lh - k), k, k);
    });
  }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }

  // the card floats: it is pulled toward the heading by a spring and slowed by the fluid
  var lastStep = 0;
  function stepCard(now) {
    var dt = Math.min(0.05, Math.max(0.001, now - (lastStep || now))); lastStep = now;
    var want = bn.hdg, diff = ((want - bn.card + 540) % 360) - 180;
    bn.cardV += (diff * 26 - bn.cardV * 6.5) * dt;
    bn.card += bn.cardV * dt;
    if (bn.card > 720 || bn.card < -720) bn.card = ((bn.card % 360) + 360) % 360;
    return Math.abs(diff) > 0.02 || Math.abs(bn.cardV) > 0.05;
  }

  var cv = null, cx2 = null, cvS = 1, cvDpr = 1, dirty = true;
  function sizeCanvas() {
    if (!cv) return;
    cvS = (window.innerWidth <= 470) ? 0.85 : 1;
    cvDpr = Math.min(3, window.devicePixelRatio || 1);
    cv.width = Math.round(BW * cvS * cvDpr); cv.height = Math.round(BH * cvS * cvDpr);
    cv.style.width = (BW * cvS) + 'px'; cv.style.height = (BH * cvS) + 'px';
    dirty = true; lcdKey = '';
  }
  function paint(now) {
    var moved = stepCard(now), l = drawLCD(now);
    if (!moved && !l && !dirty) return;
    dirty = false;
    drawBody(cx2, cvS, cvDpr, now);
  }

  if (HARNESS) {      // the design page drives it by hand
    window.BN = { bn: bn, mount: function (canvas) { cv = canvas; cx2 = cv.getContext('2d'); sizeCanvas(); },
      paint: paint, pixLabel: pixLabel, COURSES: COURSES, size: function (s, d) { cvS = s; cvDpr = d;
        cv.width = Math.round(BW * s * d); cv.height = Math.round(BH * s * d); cv.style.width = (BW * s) + 'px'; cv.style.height = (BH * s) + 'px'; dirty = true; lcdKey = ''; } };
    return;
  }

  // ════════════════════════════════════════════════════════════════════════
  // THE FLIGHTS
  // ════════════════════════════════════════════════════════════════════════
  var V3 = THREE.Vector3;
  var flight = {
    plan: null,          // the flight in the air
    pending: null,       // the course the next flightMark belongs to
    roll: 0,             // the bank, radians
    pan: null,           // the slow turn after landing
    look: new V3(), lookAt: -9,   // what the eye was last looking at, and when
    turn: 1,             // which way the last flight was turning when it landed
  };
  var auto = { on: false, i: -1, next: 0, asked: 0 };
  var tmpA = new V3(), tmpB = new V3(), tmpD = new V3();

  function nowT() { return clock.getElapsedTime(); }
  function hdgOf(from, to) {
    var dx = to.x - from.x, dz = to.z - from.z;
    if (dx * dx + dz * dz < 1e-8) return null;
    return ((Math.atan2(dx, -dz) * 180 / Math.PI) + 360) % 360;
  }
  function shortName(label) {
    if (!label) return '';
    if (LCD_NAMES[label]) return LCD_NAMES[label];
    return String(label).replace(/^the /i, '').toUpperCase().replace(/[^A-Z0-9 '\-.]/g, '');
  }

  // Called by the main file the moment it has set approach's ends for a move
  // that should be flown. `name` null marks a flight nobody asked for by name
  // (letting go of a focus): it is flown, but it does not take a course.
  window.flightMark = function (name, extra) {
    var c = null;
    if (name != null) {
      c = flight.pending; flight.pending = null;
      // reached some other way — a click on the thing itself, Ted taking you, the places list —
      // it still takes the drawn course
      if (!c) c = COURSES.find(function (k) {
        return (k.kind === 'focus' && k.focus === name) || (k.kind === 'object' && name === 'Object') ||
               (k.kind === 'place' && extra && extra.place === k.place);
      }) || null;
    }
    approach.fly = { name: name, end: approach.endPos.clone(), course: c, extra: extra || null };
  };

  function flightPlan(fly) {
    var a = approach.startPos.clone(), b = approach.endPos.clone();
    var la = approach.startLook.clone(), lb = approach.endLook.clone();
    // a flight that interrupts a flight starts from where the eye really was
    if (nowT() - flight.lookAt < 0.3) la.copy(flight.look);
    var c = fly.course || {}, d = a.distanceTo(b);
    // LAND SHORT, THEN CLOSE THE GAP. The flight ends a little way round from the view that was asked
    // for, and the slow turn after it brings the eye the rest of the way — so the turn is the machine
    // closing its own error, and it stops exactly on the view the place was given.
    var panOK = !c.noPan && fly.name !== 'iMac G4' && fly.name !== 'Easel' &&
                !(typeof tourState !== 'undefined' && tourState.on) && d > 3;
    var short = 0, bEnd = b;
    if (panOK) {
      var ox = b.x - lb.x, oz = b.z - lb.z, r = Math.sqrt(ox * ox + oz * oz);
      if (r > 0.8) {
        var th = Math.atan2(ox, oz), dl = Math.max(0.14, Math.min(0.36, 5.5 / r));
        var from = (c.via && (c.always || d > 7)) ? new V3(c.via[c.via.length - 1][0], 0, c.via[c.via.length - 1][2]) : a;
        var p1 = new V3(lb.x + r * Math.sin(th + dl), b.y, lb.z + r * Math.cos(th + dl));
        var p2 = new V3(lb.x + r * Math.sin(th - dl), b.y, lb.z + r * Math.cos(th - dl));
        var d1 = (p1.x - from.x) * (p1.x - from.x) + (p1.z - from.z) * (p1.z - from.z);
        var d2 = (p2.x - from.x) * (p2.x - from.x) + (p2.z - from.z) * (p2.z - from.z);
        if (d1 < d2) { bEnd = p1; short = dl; } else { bEnd = p2; short = -dl; }
      }
    }
    var pts = [a], drawn = false;
    if (c.via && (c.always || d > 7)) {
      drawn = true;                                                 // the course's own path is in use
      c.via.forEach(function (p) { pts.push(new V3(p[0], p[1], p[2])); });
    } else if (d > 5) {
      // one point, swung out to the side AWAY from what you are going to look at:
      // the path then wraps round the thing and it stays in the frame
      var mid = a.clone().lerp(b, 0.5), dir = b.clone().sub(a); dir.y = 0;
      var len = dir.length() || 1; dir.multiplyScalar(1 / len);
      var side = new V3(-dir.z, 0, dir.x), toLook = lb.clone().sub(mid); toLook.y = 0;
      var s = side.dot(toLook) > 0 ? -1 : 1;
      mid.addScaledVector(side, s * Math.min(14, Math.max(1.6, d * 0.24)));
      mid.y = (a.y + b.y) / 2 + Math.min(7, d * 0.09);
      pts.push(mid);
    }
    pts.push(bEnd);
    if (!c.under && typeof getTerrainHeight === 'function') {      // nothing in the middle goes into a hillside
      for (var i = 1; i < pts.length - 1; i++) {
        var g = getTerrainHeight(pts[i].x, pts[i].z);
        if (isFinite(g) && pts[i].y < g + 2.2) pts[i].y = g + 2.2;
      }
    }
    var curve = pts.length > 2 ? new THREE.CatmullRomCurve3(pts, false, 'centripetal') : new THREE.LineCurve3(a, bEnd);
    var L = curve.getLength(), fr = pointFractions(curve, pts);
    // time: the lead-in to the first drawn point by its distance, the drawn part by the course's own count
    var T1 = 0, T2, f1 = 0;
    if (drawn) {
      f1 = fr[1];
      T1 = f1 * L < 1.5 ? 0 : Math.min(7, Math.max(1.8, 1.3 + f1 * L * 0.06));
      if (!T1) f1 = 0;
      T2 = c.dur || Math.min(11, Math.max(2.6, 1.7 + (1 - f1) * L * 0.085));
    } else T2 = Math.min(11, Math.max(2.6, 1.7 + L * 0.085));
    if (typeof tourState !== 'undefined' && tourState.on) {          // Ted is talking: keep his timing
      var cap = Math.max(approach.duration || 0, 3.2);
      if (T1 + T2 > cap) { var sc = cap / (T1 + T2); T1 *= sc; T2 *= sc; }
    }
    var tab = timeTable(T1, T2, f1), dur = T1 + T2;
    function atToE(at) {
      var i = Math.max(0, Math.min(fr.length - 2, Math.floor(at)));
      return fr[i] + (fr[i + 1] - fr[i]) * Math.max(0, Math.min(1, at - i));
    }
    var looks = [{ t: 0, p: la }];
    if (c.looks && drawn) c.looks.forEach(function (k) { looks.push({ t: atToE(k.at), p: new V3(k.p[0], k.p[1], k.p[2]) }); });
    else if (pts.length > 2) looks.push({ t: 0.56, p: lb });       // lock on a little past half way, and keep travelling
    looks.push({ t: 1, p: lb });
    var name = fly.name, lcdName = c.lcd || shortName(name);
    return { curve: curve, dur: dur, len: L, tab: tab, looks: looks, end: b, endLook: lb, name: name, lcd: lcdName,
      key: c.key || (fly.extra && fly.extra.place) || null, set: hdgOf(b, lb), short: short, named: name != null };
  }
  // where each drawn point sits along the path, 0–1 by distance
  function pointFractions(curve, pts) {
    var N = 240, fr = [0], j = 0, P = new V3();
    for (var i = 1; i < pts.length - 1; i++) {
      var best = j, bd = Infinity;
      for (var k = j; k <= N; k++) {
        curve.getPointAt(k / N, P);
        var dd = P.distanceToSquared(pts[i]);
        if (dd < bd) { bd = dd; best = k; }
      }
      j = best; fr.push(best / N);
    }
    fr.push(1);
    return fr;
  }
  // how far along the path the eye is at each moment: quick over the lead-in, at the course's own
  // pace over the drawn part, eased in at the start and out at the end, with no stop in between
  function timeTable(T1, T2, f1) {
    var T = T1 + T2, N = 200, tab = [0], acc = 0;
    function sm(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
    var v1 = T1 > 0 ? f1 / T1 : 0, v2 = (1 - f1) / T2;
    for (var i = 1; i <= N; i++) {
      var tau = (i - 0.5) / N * T;
      var m = T1 > 0 ? sm((tau - (T1 - 0.8)) / 1.6) : 1;
      var v = (v1 + (v2 - v1) * m) * (0.02 + 0.98 * sm(tau / Math.min(1.4, T * 0.4))) * (0.02 + 0.98 * sm((T - tau) / Math.min(2.2, T * 0.5)));
      acc += v; tab.push(acc);
    }
    for (var k = 0; k <= N; k++) tab[k] /= acc;
    return tab;
  }
  function lookAtT(p, e, out) {
    var ks = p.looks, i = 0;
    while (i < ks.length - 2 && e > ks[i + 1].t) i++;
    var k0 = ks[i], k1 = ks[i + 1], span = Math.max(1e-4, k1.t - k0.t);
    var u = Math.max(0, Math.min(1, (e - k0.t) / span)); u = u * u * (3 - 2 * u);
    return out.lerpVectors(k0.p, k1.p, u);
  }

  // The camera's place and gaze, handed back to the villa's own orbit.
  function handBack(look) {
    approach.released = true; approach.active = false;
    try { showNavBar(); updateNavBar(); } catch (e) {}
    camTarget.copy(look);
    var dx = camera.position.x - camTarget.x, dy = camera.position.y - camTarget.y, dz = camera.position.z - camTarget.z;
    camRadius = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.01;
    camPhi = Math.acos(Math.max(-1, Math.min(1, dy / camRadius)));
    camTheta = Math.atan2(dx, dz);
    targetTheta = camTheta; targetPhi = camPhi; targetRadius = camRadius;
    autoOrbit = !orbitKilled;
  }

  // Called from updateCamera while approach.active. True = "I flew this frame".
  window.flightTick = function () {
    if (approach.startTime < 0) {
      var f = approach.fly; approach.fly = null;
      flight.plan = (f && f.end && f.end.distanceToSquared(approach.endPos) < 1e-6) ? flightPlan(f) : null;
      flight.pan = null; flight.roll = 0;
      if (flight.plan) { approach.duration = flight.plan.dur; onTakeOff(flight.plan); }
    }
    var p = flight.plan;
    if (!p) return false;
    var now = nowT();
    if (approach.startTime < 0) approach.startTime = now;
    var t = Math.min((now - approach.startTime) / p.dur, 1);
    approach.progress = t;
    var x = t * (p.tab.length - 1), xi = Math.min(p.tab.length - 2, Math.floor(x));
    var e = p.tab[xi] + (p.tab[xi + 1] - p.tab[xi]) * (x - xi);
    p.curve.getPointAt(e, camera.position);
    lookAtT(p, e, flight.look); flight.lookAt = now;
    camera.lookAt(flight.look);
    // the bank: how fast the path is turning here, eased in and out with the flight
    p.curve.getTangentAt(Math.max(0, e - 0.02), tmpA); p.curve.getTangentAt(Math.min(1, e + 0.02), tmpB);
    var turn = tmpA.z * tmpB.x - tmpA.x * tmpB.z;                 // > 0 is a turn to the left
    var pace = (p.tab[xi + 1] - p.tab[xi]) * (p.tab.length - 1) / p.dur * p.len;     // units a second, here
    var want = Math.max(-0.12, Math.min(0.12, turn * 1.15)) * Math.sin(Math.PI * t) * Math.min(1, pace / 7);
    flight.roll += (want - flight.roll) * 0.07;
    if (Math.abs(turn) > 0.002) flight.turn = turn > 0 ? 1 : -1;
    camera.rotateZ(flight.roll);
    if (t >= 1 && !approach.released) {
      flight.plan = null; flight.roll = 0;
      handBack(approach.endLook);
      onLanding(p);
    }
    return true;
  };

  // A hand on the view while it is flying: it stops where it is and the view is yours.
  function flightAbort() {
    if (!flight.plan || !approach.active) return false;
    var look = flight.look.clone();
    flight.plan = null; flight.roll = 0;
    handBack(look);
    return true;
  }

  function onTakeOff(p) {
    if (!p.named && bn.mode !== 'auto') {            // letting go of something is not a course: the helm is yours
      bn.mode = 'stby'; syncPanel(); return;
    }
    if (p.named) {
      bn.course = p.lcd; bn.set = p.set; bn.key = p.key;
      bn.mode = auto.on ? 'auto' : 'trk';
    }
    syncPanel();
  }
  function onLanding(p) {
    if (auto.on) auto.next = nowT() + DWELL;
    if (!p.short) return;
    // the arrival: the slow turn that closes the gap the flight left
    flight.pan = { t0: nowT(), dur: 10, total: -p.short, done: 0 };
  }

  // Called from updateCamera every frame the villa's own orbit has the camera.
  window.villaFlightIdle = function () {
    var now = nowT();
    var pn = flight.pan;
    if (pn) {
      var held = approach.active || (typeof isDragging !== 'undefined' && isDragging) ||
        (typeof parallax !== 'undefined' && parallax.active && !parallax.released) ||
        (typeof g4State !== 'undefined' && g4State.screenLocked);
      if (held) flight.pan = null;
      else {
        var u = Math.min(1, (now - pn.t0) / pn.dur), q = pn.total * (1 - (1 - u) * (1 - u));
        targetTheta += q - pn.done; pn.done = q;
        if (u >= 1) flight.pan = null;
      }
    }
    if (auto.on && !approach.active && now > auto.next) {
      if (villaBusy()) { auto.next = now + 4; return; }
      auto.i = (auto.i + 1) % CIRCUIT.length;
      auto.next = now + 6;                      // if nothing takes off, try the next one
      go(CIRCUIT[auto.i], true);
    }
  };
  function villaBusy() {
    try {
      if (typeof tourState !== 'undefined' && tourState.on) return true;
      if (typeof threshold !== 'undefined' && threshold.showing) return true;
      if (typeof obsState !== 'undefined' && obsState.seated) return true;
      if (typeof g4State !== 'undefined' && g4State.screenLocked) return true;
      if (typeof visitorNav !== 'undefined' && visitorNav.active) return true;
      if (typeof tedPhoto !== 'undefined' && tedPhoto.active) return true;
    } catch (e) {}
    return false;
  }

  // ════════════════════════════════════════════════════════════════════════
  // GOING
  // ════════════════════════════════════════════════════════════════════════
  function closeMenu() {
    var m = document.getElementById('nav-menu');
    if (m && m.classList.contains('open')) toggleNavMenu();
  }
  function focusByName(name) { return focusTargets.find(function (t) { return t.name === name; }); }
  function leaveFocus(except) {
    // what navTo does when it moves from one thing to another: tidy up, without flying home first
    if (!activeFocus || activeFocus === except) return;
    try {
      if (activeFocus.name === 'Easel' && parchState.hoveredIndex !== -1) { parchState.hoveredIndex = -1; redrawParchment(); }
      if (activeFocus.name === 'iMac G4') { g4State.screenLocked = false; hideG4Panel(); g4ClearInspect(); }
    } catch (e) {}
    activeFocus = null;
    try { document.getElementById('info-card').classList.remove('visible'); hideTraceInspect(); } catch (e) {}
  }

  function go(key, fromAuto) {
    var c = COURSES.find(function (k) { return k.key === key; });
    if (!fromAuto) standDownAuto();
    closeMenu();
    try { if (typeof obsState !== 'undefined' && obsState.seated && typeof obsStand === 'function') obsStand(); } catch (e) {}
    if (!c) {                                         // any other place: it flies its own arc
      if (PLACES.some(function (p) { return p.key === key; })) { flight.pending = null; goToPlaceFromRing(key); }
      return;
    }
    flight.pending = c;
    try {
      if (c.kind === 'place') goToPlaceFromRing(c.place);
      else if (c.kind === 'focus') {
        var f = focusByName(c.focus);
        if (c.pedestal) { try { pedestalShow(c.pedestal); } catch (e) {} }
        if (f) { try { stopFollow(); } catch (e) {} leaveFocus(f); focusOn(f); updateNavBar(); }
      } else if (c.kind === 'object') {
        var o = focusByName('Object');
        try { stopFollow(); } catch (e) {}
        if (o && activeFocus === o) { pedestalShow('object'); focusOn(o); } else showObject();
      } else if (c.kind === 'free') {
        if (c.object) pedestalShow('object');
        var h = c.hold ? focusByName(c.hold) : null;
        try { stopFollow(); } catch (e) {}
        leaveFocus(h);
        if (h) { activeFocus = h; try { if (typeof g4Tracker !== 'undefined' && g4Tracker.mode) g4TrackerLeave(); } catch (e) {} }
        approach.active = true; approach.progress = 0; approach.startTime = -1; approach.released = false;
        approach.duration = c.dur || 4;
        approach.startPos.copy(camera.position); approach.startLook.copy(camTarget);
        approach.endPos.set(c.end[0], c.end[1], c.end[2]); approach.endLook.set(c.look[0], c.look[1], c.look[2]);
        autoOrbit = false;
        window.flightMark(c.lcd);
        try { updateNavBar(); } catch (e) {}
      }
    } catch (e) { try { console.warn('[binnacle] course failed', key, e); } catch (x) {} }
    flight.pending = null;
  }
  function standDownAuto() { auto.on = false; }
  function setAuto() {
    closeMenu();
    auto.on = true; bn.mode = 'auto';
    var at = CIRCUIT.indexOf(bn.key); auto.i = at;      // start with the stop after the one you are on
    auto.next = 0;
    syncPanel();
  }
  function setStandby() {
    standDownAuto(); flight.pan = null;
    flightAbort();
    bn.mode = 'stby';
    syncPanel();
  }
  function tack() {
    var i = COURSES.findIndex(function (k) { return k.key === bn.key; });
    go(COURSES[(i + 1) % COURSES.length].key);
  }
  // a hand on the scene takes the helm
  function helmTaken() {
    var flying = flight.plan && approach.active && (nowT() - approach.startTime) > 0.35;
    if (flying) flightAbort();
    if (flight.pan) flight.pan = null;
    if (bn.mode !== 'stby' && (flying || !approach.active)) { standDownAuto(); bn.mode = 'stby'; syncPanel(); }
  }
  container.addEventListener('pointerdown', helmTaken, { passive: true });
  container.addEventListener('wheel', helmTaken, { passive: true });
  window.addEventListener('keydown', function (e) {
    var t = e.target && e.target.tagName;
    if (t === 'INPUT' || t === 'TEXTAREA') return;
    if (/^(Arrow|Key[WASD]$)/.test(e.code || '')) helmTaken();
  });

  // ════════════════════════════════════════════════════════════════════════
  // THE INSTRUMENT ON THE PAGE
  // ════════════════════════════════════════════════════════════════════════
  var css = document.createElement('style');
  css.textContent = [
    '#compass-hud{width:116px;height:172px;border-radius:10px;-webkit-tap-highlight-color:transparent}',
    '#compass-hud.soft{height:172px}#compass-hud.soft::before{display:none}',
    '#compass-dial{display:none}',
    '#binnacle-cv{display:block;transition:transform .25s ease}',
    '#compass-hud:hover #binnacle-cv{transform:translateY(-2px)}',
    '#compass-hud.open #binnacle-cv{transform:translateY(-2px)}',
    '#compass-hud.calling{border-radius:14px}',
    '#nav-menu{bottom:200px;max-height:calc(100vh - 216px)}',
    '@media (max-width:470px){#compass-hud{width:99px;height:147px}#nav-menu{bottom:172px;max-height:calc(100vh - 186px)}}',
    '@media (max-height:500px) and (orientation:landscape){#nav-menu{bottom:8px;left:150px;transform:none;max-height:calc(100vh - 16px)}}',
    '#cmp-root>:not(#bn-panel){display:none!important}',
    // the panel: a one-bit window
    '#nav-menu #cmp-root #bn-panel{transform:none;background:#f6f4ea;border:1px solid #000;border-radius:4px;box-shadow:2px 2px 0 rgba(0,0,0,.85);width:236px;padding-bottom:9px;color:#000;flex-shrink:0}',
    '#bn-title{display:flex;align-items:center;gap:7px;height:19px;padding:0 7px;border-bottom:1px solid #000;margin-bottom:9px}',
    '#bn-title:before,#bn-title:after{content:"";flex:1;height:9px;background:repeating-linear-gradient(#000 0 1px,transparent 1px 2px)}',
    '.bn-row{display:flex;gap:6px;padding:0 8px;margin-bottom:9px}',
    '.bn-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:0 8px}',
    '.bn-key{flex:1;display:flex;align-items:center;justify-content:center;min-height:27px;padding:5px 3px;background:#fff;border:1px solid #000;border-radius:7px;box-shadow:1px 1px 0 #000;cursor:pointer;-webkit-tap-highlight-color:transparent}',
    '.bn-key.mode{border-radius:3px;border-width:2px;min-height:30px}',
    '.bn-key.on,.bn-key:active{background:#000}.bn-key.on canvas,.bn-key:active canvas{filter:invert(1)}',
    '.bn-key canvas,.bn-link canvas,#bn-title canvas,.bn-sub canvas{display:block;image-rendering:pixelated}',
    '.bn-sub{display:flex;justify-content:center;padding:0 8px 7px;opacity:.6}',
    '.bn-links{display:flex;justify-content:center;padding:6px 12px 4px}',
    '.bn-grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;padding:0 8px}',
    '.bn-key.sm{min-height:25px;padding:4px 2px;border-radius:6px}',
    '.bn-rule{height:1px;background:#000;margin:4px 8px 8px;opacity:.35}',
    '[hidden].bn-grid,[hidden].bn-link,[hidden].bn-sub{display:none}',
    '.bn-link{background:none;border:0;padding:5px 2px;cursor:pointer;border-bottom:1px solid transparent}.bn-link:hover{border-bottom-color:#000}',
    '@media (pointer:coarse){.bn-key{min-height:34px}.bn-key.mode{min-height:36px}.bn-key.sm{min-height:32px}}',
  ].join('\n');
  document.head.appendChild(css);

  var hud = document.getElementById('compass-hud');
  if (hud) {
    cv = document.createElement('canvas'); cv.id = 'binnacle-cv';
    hud.insertBefore(cv, hud.firstChild);
    cx2 = cv.getContext('2d');
    hud.setAttribute('aria-label', 'the binnacle — tap for the courses');
    hud.setAttribute('role', 'button');
    sizeCanvas();
    window.addEventListener('resize', sizeCanvas);
    // a tap opens it on the courses, with the old rows folded away
    hud.addEventListener('click', function () {
      setTimeout(function () {
        var m = document.getElementById('nav-menu');
        if (!m || !m.classList.contains('open')) return;
        try { compassShow('root'); } catch (e) {}
        showGrid('courses');
        syncPanel();
      }, 0);
    });
  }

  // the panel
  var panel = document.getElementById('bn-panel'), keys = {};
  function key(label, cls, fn, bold, aria) {
    var b = document.createElement('button'); b.type = 'button'; b.className = cls;
    b.setAttribute('aria-label', aria || label);
    b.appendChild(pixLabel(label, bold));
    b.addEventListener('click', function (e) { e.stopPropagation(); fn(); });
    return b;
  }
  // every place that is not already a course
  var OTHER = PLACES.filter(function (p) {
    return p.key !== 'pool' && !COURSES.some(function (c) { return c.kind === 'place' && c.place === p.key; });
  });
  var later = function (fn) { setTimeout(fn, 0); };
  function showGrid(which) {
    if (!keys.gridCourses) return;
    var places = which === 'places';
    keys.gridCourses.hidden = places; keys.subCourses.hidden = places; keys.toPlaces.hidden = places;
    keys.gridPlaces.hidden = !places; keys.subPlaces.hidden = !places; keys.toCourses.hidden = !places;
  }
  function buildPanel() {
    if (!panel) return;
    panel.innerHTML = '';
    var t = document.createElement('div'); t.id = 'bn-title'; t.appendChild(pixLabel('AUTOPILOT', true)); panel.appendChild(t);
    var r = document.createElement('div'); r.className = 'bn-row';
    keys.auto = key('AUTO', 'bn-key mode', setAuto, true, 'auto: fly round the main stops');
    keys.stby = key('STBY', 'bn-key mode', function () { setStandby(); }, true, 'standby: you have the helm');
    keys.tack = key('TACK >', 'bn-key mode', tack, true, 'tack: on to the next stop');
    r.appendChild(keys.auto); r.appendChild(keys.stby); r.appendChild(keys.tack); panel.appendChild(r);

    // the courses, and behind one link, every other place
    var sub = function (label) { var d = document.createElement('div'); d.className = 'bn-sub'; d.appendChild(pixLabel(label, false)); panel.appendChild(d); return d; };
    keys.subCourses = sub('COURSES'); keys.subPlaces = sub('PLACES');
    var g = document.createElement('div'); g.className = 'bn-grid';
    COURSES.forEach(function (c) {
      keys['c_' + c.key] = key(c.lcd, 'bn-key', function () { go(c.key); }, c.lcd.length <= 9, 'fly to ' + c.lcd.toLowerCase());
      g.appendChild(keys['c_' + c.key]);
    });
    panel.appendChild(g); keys.gridCourses = g;
    var gp = document.createElement('div'); gp.className = 'bn-grid';
    OTHER.forEach(function (p) {
      var name = shortName(p.label);
      keys['p_' + p.key] = key(name, 'bn-key', function () { go(p.key); }, name.length <= 9, 'fly to ' + p.label.toLowerCase());
      gp.appendChild(keys['p_' + p.key]);
    });
    panel.appendChild(gp); keys.gridPlaces = gp;
    var l = document.createElement('div'); l.className = 'bn-links';
    keys.toPlaces = key('ALL PLACES >', 'bn-link', function () { showGrid('places'); }, false, 'every other place in the villa');
    keys.toCourses = key('< COURSES', 'bn-link', function () { showGrid('courses'); }, false, 'back to the courses');
    l.appendChild(keys.toPlaces); l.appendChild(keys.toCourses); panel.appendChild(l);

    // the view: what is left of the old compass menu
    var rule = document.createElement('div'); rule.className = 'bn-rule'; panel.appendChild(rule);
    var v = document.createElement('div'); v.className = 'bn-grid3';
    var vk = function (id, label, aria, fn) { keys[id] = key(label, 'bn-key sm', function () { try { fn(); } catch (e) {} later(syncPanel); }, false, aria); v.appendChild(keys[id]); };
    vk('v_day', 'DAY', 'day or night', function () { toggleMode(); });
    vk('v_orbit', 'ORBIT', 'a slow turn round what you are looking at, when you leave it alone', function () { toggleOrbit(); });
    vk('v_pierce', 'PIERCE', 'the residents show through walls', function () { toggleLivingPierce(); });
    vk('v_walk', 'WALK', 'walk your own body round the villa', function () { standDownAuto(); closeMenu(); toggleVisitor(); });
    vk('v_ted', 'ASK TED', 'ask Ted to show you something', function () { tedDockToggle(); });
    vk('v_photo', 'PHOTO', 'place Ted and frame a photograph', function () { standDownAuto(); closeMenu(); toggleTedPhoto(); });
    panel.appendChild(v);
    showGrid('courses');
  }
  function lit(id, on) { if (keys[id]) keys[id].classList.toggle('on', !!on); }
  function syncPanel() {
    dirty = true;
    if (!keys.auto) return;
    lit('auto', bn.mode === 'auto'); lit('stby', bn.mode === 'stby');
    COURSES.forEach(function (c) { lit('c_' + c.key, bn.mode !== 'stby' && bn.key === c.key); });
    OTHER.forEach(function (p) { lit('p_' + p.key, bn.mode !== 'stby' && bn.key === p.key); });
    try { lit('v_day', !isDarkMode); } catch (e) {}
    try { lit('v_orbit', !orbitKilled); } catch (e) {}
    try { lit('v_pierce', livingPierce.on); } catch (e) {}
    try { lit('v_walk', visitorNav.active); } catch (e) {}
    try { lit('v_ted', tedDockState.open); } catch (e) {}
    try { lit('v_photo', tedPhoto.active); } catch (e) {}
  }
  buildPanel(); syncPanel();

  // the instrument reads the eye, every frame, whoever is moving it
  var lastHdg = null, lastT = 0, whereAt = 0;
  function frame() {
    requestAnimationFrame(frame);
    if (!cv || document.hidden) return;
    var now = performance.now() / 1000;
    camera.getWorldDirection(tmpD);
    if (tmpD.x * tmpD.x + tmpD.z * tmpD.z > 1e-6) bn.hdg = ((Math.atan2(tmpD.x, -tmpD.z) * 180 / Math.PI) + 360) % 360;
    var dt = Math.max(0.001, now - lastT), rate = 0;
    if (lastHdg != null) rate = (((bn.hdg - lastHdg + 540) % 360) - 180) / dt;      // degrees a second
    lastHdg = bn.hdg; lastT = now;
    var steering = (flight.plan && approach.active) || flight.pan;
    var wantR = (steering && bn.mode !== 'stby') ? (rate < 0 ? -1 : 1) * Math.min(1, Math.sqrt(Math.abs(rate) / 30)) : 0;
    bn.rudder += (wantR - bn.rudder) * 0.12;
    if (Math.abs(bn.rudder) < 0.004) bn.rudder = 0;
    bn.tilt += ((flight.roll * 9) - bn.tilt) * 0.1;
    if (bn.mode === 'stby' && now - whereAt > 1.2) {       // in standby the middle line says where you are
      whereAt = now;
      try { var w = shortName(nearestPlace(summonerPoint())); if (w !== bn.course) { bn.course = w; } } catch (e) {}
    }
    paint(now);
  }
  requestAnimationFrame(frame);

  // a link can open the villa on a course:  ?course=venus   ?course=beam   ?auto
  try {
    var q = new URLSearchParams(location.search);
    if (!q.get('arrive') && !q.get('show')) {
      var want = q.get('course');
      if (want) setTimeout(function () { go(want); }, 1400);
      else if (q.has('auto')) setTimeout(setAuto, 1400);
    }
  } catch (e) {}

  window.villaBinnacle = { go: go, auto: setAuto, standby: setStandby, tack: tack, state: bn, flight: flight, courses: COURSES };
})();
