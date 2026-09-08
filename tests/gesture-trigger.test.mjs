import test from 'node:test';
import assert from 'node:assert/strict';

import { GestureTrigger } from '../src/gesture-trigger.js';

test('fires after five stable confident frames', () => {
  const gate = new GestureTrigger({ stableFrames: 5, confidenceThreshold: 0.7, cooldownMs: 800 });
  assert.equal(gate.update({ label: '拇指向上', confidence: 0.9 }, 0), null);
  assert.equal(gate.update({ label: '拇指向上', confidence: 0.9 }, 16), null);
  assert.equal(gate.update({ label: '拇指向上', confidence: 0.9 }, 32), null);
  assert.equal(gate.update({ label: '拇指向上', confidence: 0.9 }, 48), null);
  assert.deepEqual(gate.update({ label: '拇指向上', confidence: 0.9 }, 64), {
    label: '拇指向上', confidence: 0.9, timestamp: 64,
  });
});

test('does not repeat until neutral re-arms the gate', () => {
  const gate = new GestureTrigger({ stableFrames: 2, confidenceThreshold: 0.7, cooldownMs: 100 });
  gate.update({ label: '拇指向上', confidence: 0.9 }, 0);
  gate.update({ label: '拇指向上', confidence: 0.9 }, 10);
  assert.equal(gate.update({ label: '拇指向上', confidence: 0.9 }, 200), null);
  gate.update({ label: '未知', confidence: 0 }, 210);
  gate.update({ label: '拇指向上', confidence: 0.9 }, 220);
  assert.equal(gate.update({ label: '拇指向上', confidence: 0.9 }, 230)?.label, '拇指向上');
});

test('rejects low-confidence and cooldown triggers', () => {
  const gate = new GestureTrigger({ stableFrames: 2, confidenceThreshold: 0.7, cooldownMs: 800 });
  assert.equal(gate.update({ label: 'OK', confidence: 0.5 }, 0), null);
  assert.equal(gate.update({ label: 'OK', confidence: 0.5 }, 16), null);
  gate.update({ label: 'OK', confidence: 0.9 }, 100);
  assert.equal(gate.update({ label: 'OK', confidence: 0.9 }, 116)?.label, 'OK');
  gate.update({ label: '未知', confidence: 0 }, 130);
  gate.update({ label: 'OK', confidence: 0.9 }, 200);
  assert.equal(gate.update({ label: 'OK', confidence: 0.9 }, 216), null);
});

test('requires a fresh neutral re-arm after cooldown blocks a candidate', () => {
  const gate = new GestureTrigger({ stableFrames: 2, confidenceThreshold: 0.7, cooldownMs: 800 });
  gate.update({ label: 'OK', confidence: 0.9 }, 0);
  assert.equal(gate.update({ label: 'OK', confidence: 0.9 }, 10)?.label, 'OK');

  gate.update({ label: '未知', confidence: 0 }, 20);
  gate.update({ label: 'OK', confidence: 0.9 }, 100);
  assert.equal(gate.update({ label: 'OK', confidence: 0.9 }, 110), null);
  assert.equal(gate.update({ label: 'OK', confidence: 0.9 }, 810), null);

  gate.update({ label: '未知', confidence: 0 }, 820);
  gate.update({ label: 'OK', confidence: 0.9 }, 830);
  assert.equal(gate.update({ label: 'OK', confidence: 0.9 }, 840)?.label, 'OK');
});

test('supports a minimum hold duration for wake gestures', () => {
  const gate = new GestureTrigger({ stableFrames: 2, confidenceThreshold: 0.7, cooldownMs: 0, minimumHoldMs: 800 });
  gate.update({ label: '拇指向上', confidence: 0.9 }, 0);
  assert.equal(gate.update({ label: '拇指向上', confidence: 0.9 }, 400), null);
  assert.equal(gate.update({ label: '拇指向上', confidence: 0.9 }, 799), null);
  assert.equal(gate.update({ label: '拇指向上', confidence: 0.9 }, 800)?.label, '拇指向上');
});
