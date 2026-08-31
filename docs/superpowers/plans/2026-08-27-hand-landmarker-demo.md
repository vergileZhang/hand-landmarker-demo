# Hand Landmarker Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-contained localhost web demo that reads the computer camera, runs MediaPipe Hand Landmarker locally, draws 21 landmarks, and labels five basic hand states.

**Architecture:** A static browser application imports a vendored MediaPipe Tasks Vision ES module and loads a local `.task` model plus local WASM files. A pure JavaScript gesture module classifies normalized landmarks and smooths video results; a Python standard-library server hosts the package without backend inference.

**Tech Stack:** HTML5, CSS, JavaScript ES modules, MediaPipe Tasks Vision 1.0.1, Node.js built-in test runner, Python 3 `http.server`.

---

## File map

- `index.html`: accessible page structure and controls.
- `styles/app.css`: responsive dark interface and video overlay styling.
- `src/gesture-classifier.js`: pure geometry, gesture classification, and temporal voting.
- `src/app.js`: model loading, camera lifecycle, inference loop, canvas rendering, and UI state.
- `tests/gesture-classifier.test.mjs`: synthetic landmark behavior tests.
- `tests/package.test.mjs`: offline-resource and page-contract tests.
- `scripts/download-assets.py`: reproducible download/extraction of pinned model, JS, and WASM assets.
- `scripts/serve.py`: localhost server with correct WASM MIME type and disabled caching.
- `README.md`: startup and troubleshooting instructions.

### Task 1: Gesture classifier

**Files:**
- Create: `tests/gesture-classifier.test.mjs`
- Create: `src/gesture-classifier.js`

- [ ] **Step 1: Write failing tests**

Create synthetic 21-point fixtures for open palm, fist, OK, pointing, and unknown. Assert `classifyGesture()` returns `{label, confidence}` and `GestureSmoother` selects the majority of a five-item window.

- [ ] **Step 2: Verify RED**

Run:

```bash
node --test tests/gesture-classifier.test.mjs
```

Expected: failure because `src/gesture-classifier.js` does not exist.

- [ ] **Step 3: Implement the pure classifier**

Implement these exported functions/classes:

```js
export function distance(a, b) {}
export function classifyGesture(landmarks) {}
export class GestureSmoother {
  constructor(windowSize = 5) {}
  push(result) {}
  reset() {}
}
```

Use palm-width-normalized distances, fingertip-to-PIP geometry, and the fixed priority `OK → 指向 → 张开 → 握拳/聚合 → 未知`.

- [ ] **Step 4: Verify GREEN**

Run the same Node test command and expect all tests to pass.

### Task 2: Local asset installer

**Files:**
- Create: `scripts/download-assets.py`
- Create/download: `vendor/mediapipe/vision_bundle.mjs`
- Create/download: `vendor/mediapipe/wasm/*`
- Create/download: `models/hand_landmarker.task`

- [ ] **Step 1: Write failing package tests**

Assert that all required local asset paths exist, have non-zero sizes, and no application HTML/JS references `cdn.jsdelivr.net`, `unpkg.com`, `storage.googleapis.com`, or another HTTP import.

- [ ] **Step 2: Verify RED**

Run:

```bash
node --test tests/package.test.mjs
```

Expected: failure listing missing local assets.

- [ ] **Step 3: Implement and run the downloader**

Pin Tasks Vision to npm package `1.0.1`, download its registry tarball, safely extract `vision_bundle.mjs` and the `wasm/` directory, then download the official float16 Hand Landmarker task bundle. Use temporary files and atomic replacement so interrupted downloads do not leave partial assets.

- [ ] **Step 4: Verify asset checks**

Run the package test and confirm the local dependency assertions pass.

### Task 3: Static frontend and camera pipeline

**Files:**
- Create: `index.html`
- Create: `styles/app.css`
- Create: `src/app.js`
- Modify: `tests/package.test.mjs`

- [ ] **Step 1: Add failing page-contract tests**

Assert that the HTML contains the video, overlay canvas, start/stop controls, model/camera status elements, hand count, handedness, gesture label, confidence, error message, and local module entrypoint.

- [ ] **Step 2: Verify RED**

Run the package test and expect failures for the missing page contract.

- [ ] **Step 3: Build the interface and application flow**

Use `FilesetResolver.forVisionTasks('./vendor/mediapipe/wasm')` and `HandLandmarker.createFromOptions()` with:

```js
{
  baseOptions: { modelAssetPath: './models/hand_landmarker.task' },
  runningMode: 'VIDEO',
  numHands: 2,
  minHandDetectionConfidence: 0.55,
  minHandPresenceConfidence: 0.55,
  minTrackingConfidence: 0.5
}
```

Mirror both video and canvas, resize the canvas to video dimensions, run one inference per new video timestamp, draw MediaPipe hand connections, smooth each detected hand's gesture, and release every media track on stop or page unload.

- [ ] **Step 4: Verify page contract and classifier suite**

Run:

```bash
node --test tests/*.test.mjs
```

Expected: all tests pass.

### Task 4: Local server and documentation

**Files:**
- Create: `scripts/serve.py`
- Create: `README.md`
- Modify: `tests/package.test.mjs`

- [ ] **Step 1: Add failing server/documentation checks**

Assert the two files exist and README contains the exact start command and localhost URL.

- [ ] **Step 2: Verify RED**

Run the package tests and expect missing-file failures.

- [ ] **Step 3: Implement server and usage guide**

Serve only the project directory on `127.0.0.1:8000`, set `.wasm` to `application/wasm`, disable browser caching during development, and document camera permissions plus common failure recovery.

- [ ] **Step 4: Verify full automated suite**

Run all Node tests and `python3 -m py_compile scripts/*.py`.

### Task 5: End-to-end verification

**Files:**
- No production changes unless verification exposes a defect.

- [ ] **Step 1: Start the local server**

Run `python3 scripts/serve.py` and retain the process for HTTP/browser checks.

- [ ] **Step 2: Verify local resources**

Use `curl` to confirm HTTP 200 for `/`, `/src/app.js`, `/models/hand_landmarker.task`, `/vendor/mediapipe/vision_bundle.mjs`, and a WASM file. Confirm the model response is non-empty and WASM has `Content-Type: application/wasm`.

- [ ] **Step 3: Browser smoke test**

Open `http://127.0.0.1:8000`, check there are no initial JavaScript errors, start the camera, verify live video and landmark overlay, then stop and verify the stream tracks are released. If camera permission requires user interaction, leave the server running and report the exact action needed.

- [ ] **Step 4: Final repository audit**

Run tests again, inspect `git status`, and confirm every new file is under `hand-landmarker-demo/`.
