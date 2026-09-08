import test from 'node:test';
import assert from 'node:assert/strict';

import { ScenarioEngine } from '../src/scenario-engine.js';

test('passive confirmation consumes one response and closes', () => {
  const engine = new ScenarioEngine();
  engine.start('passive', 0);

  const action = engine.handleGesture('拇指向上', 100);
  assert.deepEqual(action, {
    type: 'summary.save',
    mode: 'passive',
    timestamp: 100,
    payload: { gesture: '拇指向上' },
  });
  assert.equal(engine.state, 'inactive');
  assert.equal(engine.handleGesture('拇指向下', 200), null);
});

test('passive confirmation supports cancel, defer, and OK save', () => {
  const engine = new ScenarioEngine();

  engine.start('passive', 0);
  assert.equal(engine.handleGesture('拇指向下', 100).type, 'summary.cancel');

  engine.start('passive', 200);
  assert.equal(engine.handleGesture('张开', 300).type, 'summary.defer');

  engine.start('passive', 400);
  assert.equal(engine.handleGesture('OK', 500).type, 'summary.save');
});

test('passive confirmation times out', () => {
  const engine = new ScenarioEngine({ passiveTimeoutMs: 8000 });
  engine.start('passive', 0);

  assert.equal(engine.tick(8000), null);
  assert.deepEqual(engine.tick(8001), {
    type: 'confirmation.timeout',
    mode: 'passive',
    timestamp: 8001,
    payload: {},
  });
  assert.equal(engine.state, 'inactive');
});

test('wake mode requires thumb up before live controls', () => {
  const engine = new ScenarioEngine();
  engine.start('wake', 0);

  assert.equal(engine.handleGesture('胜利/V', 100), null);
  assert.equal(engine.handleGesture('拇指向上', 200).type, 'live.session.started');
  assert.equal(engine.handleGesture('胜利/V', 300).type, 'live.scene.next');
  assert.equal(engine.handleGesture('OK', 400).type, 'live.product.show');
  assert.equal(engine.handleGesture('向上指', 450).type, 'live.follow.show');
  assert.equal(engine.handleGesture('张开', 475).type, 'live.overlay.hide');
  assert.equal(engine.handleGesture('握拳', 500).type, 'live.session.standby');
  assert.equal(engine.state, 'wake-standby');
});

test('wake mode returns to standby after idle timeout', () => {
  const engine = new ScenarioEngine({ wakeIdleTimeoutMs: 15000 });
  engine.start('wake', 0);
  engine.handleGesture('拇指向上', 10);

  assert.equal(engine.tick(15010), null);
  assert.equal(engine.tick(15011).type, 'live.session.timeout');
  assert.equal(engine.state, 'wake-standby');
});

test('continuous mode maps page actions and pause state', () => {
  const engine = new ScenarioEngine();
  engine.start('continuous', 0);

  assert.equal(engine.handleGesture('拇指向上', 100).type, 'document.page.next');
  assert.equal(engine.handleGesture('拇指向下', 200).type, 'document.page.previous');
  assert.equal(engine.handleGesture('张开', 300).type, 'document.control.paused');
  assert.equal(engine.handleGesture('拇指向上', 400), null);
  assert.equal(engine.handleGesture('张开', 500).type, 'document.control.resumed');
  assert.equal(engine.handleGesture('握拳', 600).type, 'document.control.stopped');
  assert.equal(engine.state, 'inactive');
});

test('start, stop, and snapshots expose deterministic session state', () => {
  const engine = new ScenarioEngine();

  assert.deepEqual(engine.getSnapshot(), {
    mode: null,
    state: 'inactive',
    startedAt: null,
    lastActivityAt: null,
    stopReason: null,
  });

  engine.start('continuous', 25);
  assert.deepEqual(engine.getSnapshot(), {
    mode: 'continuous',
    state: 'continuous-active',
    startedAt: 25,
    lastActivityAt: 25,
    stopReason: null,
  });

  const action = engine.stop('button');
  assert.equal(action.type, 'scenario.stopped');
  assert.equal(action.mode, 'continuous');
  assert.equal(action.payload.reason, 'button');
  assert.equal(engine.state, 'inactive');
});

test('rejects unsupported scenario modes', () => {
  const engine = new ScenarioEngine();
  assert.throws(() => engine.start('unsupported', 0), /Unsupported scenario mode/);
});
