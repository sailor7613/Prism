// ted-poses.js — pose presets for ted-rig.js. Each fn(T, t, opts) sets joints
// from rest. Desk numbers assume a seat at y .44 and a desktop at y .70 whose
// near edge is at z .18 (Ted faces +z). `live` poses are re-evaluated every frame.
(function (g) {
  const DESK = .70, TOP = .735;              // desktop, and forearm height resting on it
  function seated(T, lean, twist, o) {
    T.hips(0, .50 + ((o && o.lift) || 0), -.06);
    T.rot('hips', -6, 0, 0);
    T.rot('spine', 10 + (lean || 0), (twist || 0) * .4, 0);
    T.rot('chest', 6, (twist || 0) * .6, 0);
    T.rot('hipL', -84, 0, 5); T.rot('kneeL', 86, 0, 0);
    T.rot('hipR', -84, 0, -5); T.rot('kneeR', 86, 0, 0);
    T.orientPaw('ankleL', T.v3([0, -1, 0]), T.v3([.08, 0, 1]));
    T.orientPaw('ankleR', T.v3([0, -1, 0]), T.v3([-.08, 0, 1]));
    // tail out through the gap under the chair back, then hanging down
    T.rot('tail0', 30, 0, 0); T.rot('tail1', -55, 0, 0); T.rot('tail2', -25, 0, 0);
  }
  const guestOf = o => o.guest || [-1.4, .95, .9];
  const restL = (T, w, e) => T.armIK('L', w || [.06, TOP, .36], e || [.30, TOP, .26], [-.75, 0, .66], [0, -1, 0]);
  const restR = (T, w, e) => T.armIK('R', w || [-.05, TOP + .016, .33], e || [-.30, TOP, .26], [.8, 0, .6], [0, -1, 0]);

  g.TedPoses = {
    deskListen: {
      label: 'Desk, listening', desk: true, talk: false,
      fn(T, t, o) {
        seated(T, 0, -6, o);
        restL(T); restR(T);
        T.shapes.curlL = .35; T.shapes.curlR = .45;
        T.look(guestOf(o), 1, 7);
        T.addRot('earL', -6, 0, 0); T.addRot('earR', -6, 0, 0);
      }
    },
    deskPoint: {
      label: 'Desk, making a point', desk: true, talk: true, live: true,
      fn(T, t, o) {
        seated(T, 2, -12, o);
        const sw = Math.sin(t * 2.1), sw2 = Math.sin(t * 1.3 + 1);
        T.armIK('R', [-.28 + sw2 * .02, .89 + sw * .025, .45], [-.25, TOP, .24], [-.15 + sw2 * .1, .95, .25], [-.55, .1, .85]);
        T.shapes.curlR = .25 + Math.max(0, sw) * .25; T.shapes.thumbR = .1;
        restL(T, [.05, TOP, .42]);
        T.shapes.curlL = .4;
        T.look(guestOf(o), 1, -4);
      }
    },
    deskGlass: {
      label: 'Desk, reaching for his glass', desk: true, talk: false,
      fn(T, t, o) {
        seated(T, 3, 6, o);
        const gl = o.glass || [.24, DESK, .44];
        T.armIK('L', [gl[0] - .052, DESK + .065, gl[2] - .005], [.27, TOP, .19], [.08, .3, 1], [1, 0, -.1]);
        T.shapes.curlL = .6; T.shapes.thumbL = .75;
        restR(T, [-.03, TOP, .40]);
        T.shapes.curlR = .4;
        T.look([gl[0], DESK + .1, gl[2]], 1, 0);
      }
    },
    deskThink: {
      label: 'Desk, chin on paw', desk: true, talk: false,
      fn(T, t, o) {
        seated(T, 14, -4, o);
        T.look(guestOf(o), .7, 12);
        T.addRot('head', 6, 0, 0);
        const chin = T.J.jaw.localToWorld(T.v3([0, -.03, .08]));
        const w = chin.clone().add(T.v3([0, -.085, -.01]));
        T.armIK('R', w, [-.05, TOP - .02, .34], [0, 1, -.15], [0, .1, -1]);
        T.shapes.curlR = .9; T.shapes.thumbR = .6;
        T.armIK('L', [-.06, TOP, .31], [.21, TOP, .22], [-.92, 0, .3], [0, -1, 0]);
        T.shapes.curlL = .35;
        T.shapes.lids = .4;
        T.addRot('earR', 0, 0, -10);
      }
    },
    stand: {
      label: 'Standing', desk: false, talk: false,
      fn(T, t, o) {
        T.hips(0, .585, 0); T.rot('hips', 0, 0, 2);
        T.rot('spine', -2, 0, -1); T.rot('chest', -4, 0, -1);
        T.legIK('L', [.11, .05, .03], [.13, .3, .4]);
        T.legIK('R', [-.10, .05, -.03], [-.12, .3, .4]);
        T.orientPaw('ankleL', T.v3([0, -1, 0]), T.v3([.15, 0, 1]));
        T.orientPaw('ankleR', T.v3([0, -1, 0]), T.v3([-.15, 0, 1]));
        T.rot('shoulderL', 5, 0, 7); T.rot('elbowL', -16, 0, 0); T.rot('wristL', 0, -80, 0);
        T.rot('shoulderR', 5, 0, -7); T.rot('elbowR', -16, 0, 0); T.rot('wristR', 0, 80, 0);
        T.shapes.curlL = .4; T.shapes.curlR = .4;
        T.look(o.cam || [0, 1.25, 3], .8, 4);
      }
    },
    walk: {
      label: 'Walking', desk: false, talk: false, live: true,
      fn(T, t, o) {
        const ph = t * Math.PI * 2 * .85, s = Math.sin(ph), c = Math.cos(ph);
        const a = t * .32, R = .85;
        T.root(Math.sin(a) * R, 0, Math.cos(a) * R, Math.atan2(Math.cos(a), -Math.sin(a)));
        T.hips(0, .575 + .018 * Math.cos(2 * ph), 0);
        T.rot('hips', 0, 7 * s, 2 * s);
        T.rot('spine', 2, -4 * s, 0); T.rot('chest', -5, -5 * s, -1.5 * s); T.rot('neck', -6, 0, 0);
        [['L', 1], ['R', -1]].forEach(([k, sg]) => {
          const ss = s * sg, cc = c * sg;
          const th = -24 * ss, kn = 6 + 42 * Math.max(0, cc);
          T.rot('hip' + k, th, 0, sg * 2); T.rot('knee' + k, kn, 0, 0); T.rot('ankle' + k, -(th + kn) * .8, 0, 0);
          T.rot('shoulder' + k, 22 * ss, 0, sg * 6); T.rot('elbow' + k, -18 - 10 * Math.max(0, -ss), 0, 0); T.rot('wrist' + k, 0, -sg * 80, 0);
        });
        T.shapes.curlL = .45; T.shapes.curlR = .45;
      }
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
