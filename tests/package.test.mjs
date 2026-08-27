import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const requiredAssets = [
  'vendor/mediapipe/vision_bundle.mjs',
  'vendor/mediapipe/wasm/vision_wasm_internal.js',
  'vendor/mediapipe/wasm/vision_wasm_internal.wasm',
  'vendor/mediapipe/wasm/vision_wasm_module_internal.js',
  'vendor/mediapipe/wasm/vision_wasm_module_internal.wasm',
  'vendor/mediapipe/wasm/vision_wasm_nosimd_internal.js',
  'vendor/mediapipe/wasm/vision_wasm_nosimd_internal.wasm',
  'models/hand_landmarker.task',
];

test('all MediaPipe runtime assets are stored locally', async () => {
  for (const relativePath of requiredAssets) {
    const info = await stat(resolve(ROOT, relativePath));
    assert.ok(info.isFile(), `${relativePath} must be a file`);
    assert.ok(info.size > 1_000, `${relativePath} is unexpectedly small`);
  }
});

test('application source has no remote runtime imports', async () => {
  const candidates = ['index.html', 'src/app.js', 'src/gesture-classifier.js'];
  const forbidden = /(?:https?:)?\/\/(?:cdn\.jsdelivr\.net|unpkg\.com|storage\.googleapis\.com)/i;
  for (const relativePath of candidates) {
    try {
      const source = await readFile(resolve(ROOT, relativePath), 'utf8');
      assert.doesNotMatch(source, forbidden, `${relativePath} references a remote runtime`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
});

test('page exposes the camera demo contract', async () => {
  const html = await readFile(resolve(ROOT, 'index.html'), 'utf8');
  for (const id of [
    'camera',
    'overlay',
    'start-camera',
    'stop-camera',
    'model-status',
    'camera-status',
    'hand-count',
    'handedness',
    'gesture-label',
    'gesture-confidence',
    'error-message',
  ]) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `missing #${id}`);
  }
  assert.match(html, /<script[^>]+type=["']module["'][^>]+src=["']\.\/src\/app\.js["']/);
});

test('frontend entrypoint uses local MediaPipe runtime and model', async () => {
  const source = await readFile(resolve(ROOT, 'src/app.js'), 'utf8');
  assert.match(source, /\.\.\/vendor\/mediapipe\/vision_bundle\.mjs/);
  assert.match(source, /\.\/vendor\/mediapipe\/wasm/);
  assert.match(source, /\.\/models\/hand_landmarker\.task/);
  assert.match(source, /runningMode:\s*['"]VIDEO['"]/);
  assert.match(source, /getUserMedia/);
  assert.match(source, /getTracks\(\)/);
});

test('local server and README document the exact start flow', async () => {
  const server = await readFile(resolve(ROOT, 'scripts/serve.py'), 'utf8');
  const readme = await readFile(resolve(ROOT, 'README.md'), 'utf8');
  assert.match(server, /127\.0\.0\.1/);
  assert.match(server, /application\/wasm/);
  assert.match(server, /Cache-Control/);
  assert.match(readme, /python3 scripts\/serve\.py/);
  assert.match(readme, /http:\/\/127\.0\.0\.1:8000/);
});
