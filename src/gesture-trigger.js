const UNKNOWN_LABEL = '未知';

function isNeutral(result, confidenceThreshold) {
  if (!result || typeof result.label !== 'string' || result.label.trim() === '') {
    return true;
  }

  const confidence = Number(result.confidence);
  return result.label === UNKNOWN_LABEL
    || !Number.isFinite(confidence)
    || confidence < confidenceThreshold;
}

export class GestureTrigger {
  constructor({
    stableFrames = 5,
    confidenceThreshold = 0.7,
    cooldownMs = 800,
    minimumHoldMs = 0,
  } = {}) {
    if (!Number.isInteger(stableFrames) || stableFrames < 1) {
      throw new RangeError('stableFrames must be a positive integer');
    }
    if (!Number.isFinite(confidenceThreshold) || confidenceThreshold < 0) {
      throw new RangeError('confidenceThreshold must be a non-negative number');
    }
    if (!Number.isFinite(cooldownMs) || cooldownMs < 0) {
      throw new RangeError('cooldownMs must be a non-negative number');
    }
    if (!Number.isFinite(minimumHoldMs) || minimumHoldMs < 0) {
      throw new RangeError('minimumHoldMs must be a non-negative number');
    }

    this.stableFrames = stableFrames;
    this.confidenceThreshold = confidenceThreshold;
    this.cooldownMs = cooldownMs;
    this.minimumHoldMs = minimumHoldMs;
    this.reset();
  }

  update(result, timestamp = 0) {
    const eventTimestamp = Number.isFinite(timestamp) ? timestamp : 0;
    if (isNeutral(result, this.confidenceThreshold)) {
      this.currentLabel = null;
      this.stableCount = 0;
      this.holdStartedAt = null;
      this.armed = true;
      return null;
    }

    const confidence = Number(result.confidence);
    if (result.label !== this.currentLabel) {
      this.currentLabel = result.label;
      this.stableCount = 1;
      this.holdStartedAt = eventTimestamp;
    } else {
      this.stableCount += 1;
    }

    if (!this.armed || this.stableCount < this.stableFrames) return null;
    if (eventTimestamp - this.holdStartedAt < this.minimumHoldMs) return null;
    if (this.lastTriggeredAt !== null
      && eventTimestamp - this.lastTriggeredAt < this.cooldownMs) {
      // A candidate that reaches the trigger threshold during cooldown must
      // not become actionable merely because the cooldown later expires.
      this.armed = false;
      this.stableCount = 0;
      this.holdStartedAt = null;
      return null;
    }

    this.armed = false;
    this.lastTriggeredAt = eventTimestamp;
    return {
      label: result.label,
      confidence,
      timestamp: eventTimestamp,
    };
  }

  reset() {
    this.currentLabel = null;
    this.stableCount = 0;
    this.holdStartedAt = null;
    this.lastTriggeredAt = null;
    this.armed = true;
  }
}
