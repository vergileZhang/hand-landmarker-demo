import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GestureSmoother,
  classifyGesture,
  distance,
} from '../src/gesture-classifier.js';

const point = (x, y, z = 0) => ({ x, y, z });

function openPalm() {
  return [
    point(0.50, 0.88),
    point(0.40, 0.72), point(0.32, 0.61), point(0.25, 0.50), point(0.18, 0.41),
    point(0.42, 0.62), point(0.40, 0.47), point(0.39, 0.32), point(0.38, 0.18),
    point(0.50, 0.60), point(0.50, 0.43), point(0.50, 0.27), point(0.50, 0.12),
    point(0.58, 0.62), point(0.60, 0.47), point(0.61, 0.33), point(0.62, 0.20),
    point(0.66, 0.66), point(0.69, 0.54), point(0.71, 0.43), point(0.73, 0.33),
  ];
}

function fist() {
  const hand = openPalm();
  hand[3] = point(0.34, 0.64); hand[4] = point(0.43, 0.66);
  hand[6] = point(0.42, 0.51); hand[7] = point(0.47, 0.55); hand[8] = point(0.45, 0.63);
  hand[10] = point(0.50, 0.49); hand[11] = point(0.55, 0.53); hand[12] = point(0.53, 0.62);
  hand[14] = point(0.58, 0.51); hand[15] = point(0.63, 0.55); hand[16] = point(0.60, 0.64);
  hand[18] = point(0.65, 0.55); hand[19] = point(0.69, 0.59); hand[20] = point(0.65, 0.68);
  return hand;
}

function okGesture() {
  const hand = openPalm();
  hand[3] = point(0.31, 0.43);
  hand[4] = point(0.37, 0.35);
  hand[7] = point(0.39, 0.32);
  hand[8] = point(0.375, 0.345);
  return hand;
}

function pointingGesture() {
  const hand = fist();
  hand[6] = point(0.40, 0.47);
  hand[7] = point(0.39, 0.32);
  hand[8] = point(0.38, 0.18);
  return hand;
}

function unknownGesture() {
  const hand = fist();
  hand[10] = point(0.50, 0.43);
  hand[11] = point(0.50, 0.27);
  hand[12] = point(0.50, 0.12);
  return hand;
}

test('distance uses all three landmark axes', () => {
  assert.equal(distance(point(0, 0, 0), point(2, 3, 6)), 7);
});

for (const [name, fixture, expected] of [
  ['open palm', openPalm, '张开'],
  ['fist', fist, '握拳/聚合'],
  ['OK', okGesture, 'OK'],
  ['pointing', pointingGesture, '指向'],
  ['ambiguous pose', unknownGesture, '未知'],
]) {
  test(`classifies ${name}`, () => {
    const result = classifyGesture(fixture());
    assert.equal(result.label, expected);
    assert.ok(result.confidence >= 0 && result.confidence <= 1);
  });
}

test('classification is invariant to translation and scale', () => {
  const transformed = okGesture().map(({ x, y, z }) => ({
    x: x * 1.8 + 0.3,
    y: y * 1.8 - 0.2,
    z: z * 1.8 + 0.1,
  }));
  assert.equal(classifyGesture(transformed).label, 'OK');
});

test('invalid landmarks return unknown without throwing', () => {
  assert.deepEqual(classifyGesture([]), { label: '未知', confidence: 0 });
  assert.deepEqual(classifyGesture(null), { label: '未知', confidence: 0 });
});

test('gesture smoother returns the majority result in its window', () => {
  const smoother = new GestureSmoother(5);
  smoother.push({ label: '张开', confidence: 0.7 });
  smoother.push({ label: '张开', confidence: 0.8 });
  smoother.push({ label: '未知', confidence: 0.4 });
  smoother.push({ label: '张开', confidence: 0.9 });
  const result = smoother.push({ label: '握拳/聚合', confidence: 0.6 });
  assert.equal(result.label, '张开');
  assert.equal(result.confidence, 0.8);
});

test('gesture smoother reset removes prior votes', () => {
  const smoother = new GestureSmoother(3);
  smoother.push({ label: 'OK', confidence: 0.9 });
  smoother.reset();
  assert.deepEqual(smoother.push({ label: '未知', confidence: 0.2 }), {
    label: '未知',
    confidence: 0.2,
  });
});
