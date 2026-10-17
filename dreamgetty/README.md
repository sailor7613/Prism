# Dream Getty

An open-air classical villa on a cliff above the Pacific, built in Three.js.
Home of the Prism graphmap.

**→ https://sailor7613.github.io/dreamgetty/**

Drag to orbit · scroll to zoom · click to focus · click the ground to travel.

## What's in the room

| | |
|---|---|
| **Pedestal + graphmap** | at the centre — the aperture rings, the Diatribe asterisk, the quadrant plane |
| **The easel** | the event card, rendered on parchment |
| **iMac G4** | Inspect · Chat · Notes · Story · Kaleidoscope |
| **Venus de Milo** | a scanned model, CC-attributed — see `venus_de_milo_aphrodite_of_milos/license.txt` |
| **Ted Turner** | the coyote. He patrols. `📷 Ted` freezes him for a portrait; `H` hides the chrome; `Esc` resumes |
| **The grounds** | terrain, ocean, the Saddleback ridge, an acacia, an elephant, a giraffe, a zebra |

`Skylight` toggles day and night. `Orbit` locks the camera.

## Running it locally

Any static server will do — the page needs HTTP, not `file://`, because of the
GLTF and video loads.

```
python3 -m http.server 5500
# then open http://127.0.0.1:5500/
```

## Layout

```
index.html                          the whole villa, one file
art/                                skylight stills + the VHS overlay
venus_de_milo_aphrodite_of_milos/   the scan (gltf + bin + license)
*_trace_data.js                     trace datasets for the Inspect layers
```

Three.js r128 and GLTFLoader load from CDN; there is no build step and there
are no dependencies to install.

## Credits

Venus de Milo scan used under the licence in
`venus_de_milo_aphrodite_of_milos/license.txt`. Everything else is procedural.

---

*Part of Western Diametrica — Prism.*
