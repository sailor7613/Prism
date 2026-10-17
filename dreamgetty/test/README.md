# The session suites — 2026-08-09

Nine Playwright suites (271 checks) written against the canon during the
2026-08-09 session, plus `extract.js` (pulls every inline <script> block for
`node --check`). To run them in a fresh cloud sandbox:

    mkdir -p /home/claude/dg && cd /home/claude/dg
    npm init -y && npm install three@0.128.0 playwright
    mkdir site && cp <repo>/index.html <repo>/*_trace_data.js site/
    cp node_modules/three/build/three.min.js node_modules/three/examples/js/loaders/GLTFLoader.js site/
    # swap the two CDN <script src> lines in site/index.html for the local files
    mkdir site/feed && echo '{"entries":[]}' > site/feed/manifest.json
    cp <repo>/test/* .
    (cd site && python3 -m http.server 8899 &)
    node test_address.js   # …and the other eight

Chromium: launch with executablePath /opt/pw-browsers/chromium-*/chrome-linux/chrome
(chromium_headless_shell paths in the sandbox don't match playwright's default).
The sandbox renders ~1fps on software GL — the suites crank the frame clock by
hand where motion matters (assert state, not motion).

suites: address (talks/series/gating/cues) · pose (the rear, joints, euler)
· stage (seating, procession, fly-over, parallax, camera-during-talk)
· compass · waves (soft ring + the feed + hint) · profile · sunset
· notebook · g4 (desktop, BloomBurger, default trace, Adlib notice)
