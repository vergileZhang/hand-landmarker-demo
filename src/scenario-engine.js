const INITIAL_SNAPSHOT = Object.freeze({
  mode: null,
  state: 'inactive',
  startedAt: null,
  lastActivityAt: null,
  stopReason: null,
});

const START_STATES = Object.freeze({
  passive: 'passive-waiting',
  wake: 'wake-standby',
  continuous: 'continuous-active',
});

const PASSIVE_ACTIONS = Object.freeze({
  拇指向上: 'summary.save',
  OK: 'summary.save',
  拇指向下: 'summary.cancel',
  张开: 'summary.defer',
});

const WAKE_ACTIONS = Object.freeze({
  '胜利/V': 'live.scene.next',
  OK: 'live.product.show',
  向上指: 'live.follow.show',
  张开: 'live.overlay.hide',
});

const CONTINUOUS_ACTIONS = Object.freeze({
  拇指向上: 'document.page.next',
  拇指向下: 'document.page.previous',
});

function safeTimestamp(timestamp) {
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export class ScenarioEngine {
  constructor({ passiveTimeoutMs = 8000, wakeIdleTimeoutMs = 15000 } = {}) {
    this.passiveTimeoutMs = passiveTimeoutMs;
    this.wakeIdleTimeoutMs = wakeIdleTimeoutMs;
    Object.assign(this, INITIAL_SNAPSHOT);
  }

  start(mode, timestamp = 0) {
    if (!Object.hasOwn(START_STATES, mode)) {
      throw new RangeError(`Unsupported scenario mode: ${mode}`);
    }

    const startedAt = safeTimestamp(timestamp);
    this.mode = mode;
    this.state = START_STATES[mode];
    this.startedAt = startedAt;
    this.lastActivityAt = startedAt;
    this.stopReason = null;
    return this.getSnapshot();
  }

  stop(reason = 'manual') {
    if (this.state === 'inactive') return null;

    const mode = this.mode;
    const timestamp = this.lastActivityAt ?? 0;
    this.mode = null;
    this.state = 'inactive';
    this.startedAt = null;
    this.lastActivityAt = null;
    this.stopReason = reason;
    return this.#action('scenario.stopped', mode, timestamp, { reason });
  }

  handleGesture(label, timestamp = 0) {
    if (this.state === 'inactive') return null;

    const eventTimestamp = safeTimestamp(timestamp);
    if (this.state === 'passive-waiting') {
      const type = PASSIVE_ACTIONS[label];
      if (!type) return null;
      return this.#close(type, eventTimestamp, { gesture: label });
    }

    if (this.state === 'wake-standby') {
      if (label !== '拇指向上') return null;
      this.state = 'wake-active';
      this.lastActivityAt = eventTimestamp;
      return this.#action('live.session.started', 'wake', eventTimestamp, { gesture: label });
    }

    if (this.state === 'wake-active') {
      if (label === '握拳' || label === '握拳/聚合') {
        this.state = 'wake-standby';
        this.lastActivityAt = eventTimestamp;
        return this.#action('live.session.standby', 'wake', eventTimestamp, { gesture: label });
      }

      const type = WAKE_ACTIONS[label];
      if (!type) return null;
      this.lastActivityAt = eventTimestamp;
      return this.#action(type, 'wake', eventTimestamp, { gesture: label });
    }

    if (this.state === 'continuous-paused') {
      if (label !== '张开') return null;
      this.state = 'continuous-active';
      this.lastActivityAt = eventTimestamp;
      return this.#action('document.control.resumed', 'continuous', eventTimestamp, {
        gesture: label,
      });
    }

    if (label === '握拳' || label === '握拳/聚合') {
      return this.#close('document.control.stopped', eventTimestamp, { gesture: label });
    }

    if (label === '张开') {
      this.state = 'continuous-paused';
      this.lastActivityAt = eventTimestamp;
      return this.#action('document.control.paused', 'continuous', eventTimestamp, {
        gesture: label,
      });
    }

    const type = CONTINUOUS_ACTIONS[label];
    if (!type) return null;
    this.lastActivityAt = eventTimestamp;
    return this.#action(type, 'continuous', eventTimestamp, { gesture: label });
  }

  tick(timestamp = 0) {
    const eventTimestamp = safeTimestamp(timestamp);
    if (this.state === 'passive-waiting'
      && eventTimestamp - this.startedAt > this.passiveTimeoutMs) {
      return this.#close('confirmation.timeout', eventTimestamp);
    }

    if (this.state === 'wake-active'
      && eventTimestamp - this.lastActivityAt > this.wakeIdleTimeoutMs) {
      this.state = 'wake-standby';
      this.lastActivityAt = eventTimestamp;
      return this.#action('live.session.timeout', 'wake', eventTimestamp);
    }

    return null;
  }

  getSnapshot() {
    return {
      mode: this.mode,
      state: this.state,
      startedAt: this.startedAt,
      lastActivityAt: this.lastActivityAt,
      stopReason: this.stopReason,
    };
  }

  #close(type, timestamp, payload = {}) {
    const mode = this.mode;
    const action = this.#action(type, mode, timestamp, payload);
    this.mode = null;
    this.state = 'inactive';
    this.startedAt = null;
    this.lastActivityAt = null;
    this.stopReason = type;
    return action;
  }

  #action(type, mode, timestamp, payload = {}) {
    return { type, mode, timestamp, payload };
  }
}
