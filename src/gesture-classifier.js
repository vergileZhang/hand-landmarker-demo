const FINGER_JOINTS = [
  { name: 'index', mcp: 5, pip: 6, dip: 7, tip: 8 },
  { name: 'middle', mcp: 9, pip: 10, dip: 11, tip: 12 },
  { name: 'ring', mcp: 13, pip: 14, dip: 15, tip: 16 },
  { name: 'pinky', mcp: 17, pip: 18, dip: 19, tip: 20 },
];

const UNKNOWN = Object.freeze({ label: '未知', confidence: 0 });

const OFFICIAL_GESTURE_LABELS = Object.freeze({
  Closed_Fist: '握拳',
  Open_Palm: '张开',
  Pointing_Up: '向上指',
  Thumb_Down: '拇指向下',
  Thumb_Up: '拇指向上',
  Victory: '胜利/V',
  ILoveYou: '我爱你',
});

export function distance(a, b) {
  return Math.hypot(
    (a?.x ?? 0) - (b?.x ?? 0),
    (a?.y ?? 0) - (b?.y ?? 0),
    (a?.z ?? 0) - (b?.z ?? 0),
  );
}

function angleDegrees(a, vertex, c) {
  const first = {
    x: a.x - vertex.x,
    y: a.y - vertex.y,
    z: (a.z ?? 0) - (vertex.z ?? 0),
  };
  const second = {
    x: c.x - vertex.x,
    y: c.y - vertex.y,
    z: (c.z ?? 0) - (vertex.z ?? 0),
  };
  const denominator = Math.hypot(first.x, first.y, first.z)
    * Math.hypot(second.x, second.y, second.z);
  if (denominator < Number.EPSILON) return 0;
  const cosine = Math.max(-1, Math.min(1,
    (first.x * second.x + first.y * second.y + first.z * second.z)
      / denominator,
  ));
  return Math.acos(cosine) * 180 / Math.PI;
}

function fingerState(landmarks, finger) {
  const wrist = landmarks[0];
  const mcp = landmarks[finger.mcp];
  const pip = landmarks[finger.pip];
  const dip = landmarks[finger.dip];
  const tip = landmarks[finger.tip];
  const pipAngle = angleDegrees(mcp, pip, dip);
  const dipAngle = angleDegrees(pip, dip, tip);
  const tipReach = distance(wrist, tip) / Math.max(distance(wrist, pip), 1e-6);

  return {
    extended: pipAngle > 150 && dipAngle > 145 && tipReach > 1.12,
    bent: pipAngle < 135 || dipAngle < 135 || tipReach < 1.04,
    straightness: Math.min(1, Math.max(0, (Math.min(pipAngle, dipAngle) - 110) / 65)),
  };
}

function roundedConfidence(value) {
  return Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
}

export function mapOfficialGesture(category) {
  const label = OFFICIAL_GESTURE_LABELS[category?.categoryName] ?? '未知';
  return {
    label,
    confidence: roundedConfidence(Number(category?.score) || 0),
  };
}

export function classifyGesture(landmarks) {
  if (!Array.isArray(landmarks) || landmarks.length !== 21
      || landmarks.some((landmark) => !Number.isFinite(landmark?.x)
        || !Number.isFinite(landmark?.y))) {
    return { ...UNKNOWN };
  }

  const palmWidth = distance(landmarks[5], landmarks[17]);
  if (palmWidth < 1e-6) return { ...UNKNOWN };

  const states = Object.fromEntries(FINGER_JOINTS.map((finger) => [
    finger.name,
    fingerState(landmarks, finger),
  ]));
  const extendedCount = Object.values(states).filter((state) => state.extended).length;
  const bentCount = Object.values(states).filter((state) => state.bent).length;
  const thumbIndexGap = distance(landmarks[4], landmarks[8]) / palmWidth;
  const outerExtended = ['middle', 'ring', 'pinky']
    .filter((name) => states[name].extended).length;

  if (thumbIndexGap < 0.28 && outerExtended >= 2) {
    return {
      label: 'OK',
      confidence: roundedConfidence(0.72 + (0.28 - thumbIndexGap) * 0.8
        + outerExtended * 0.04),
    };
  }

  const foldedOthers = ['middle', 'ring', 'pinky']
    .filter((name) => states[name].bent).length;
  if (states.index.extended && foldedOthers === 3) {
    return {
      label: '指向',
      confidence: roundedConfidence(0.72 + states.index.straightness * 0.2),
    };
  }

  if (extendedCount === 4) {
    const averageStraightness = Object.values(states)
      .reduce((sum, state) => sum + state.straightness, 0) / 4;
    return {
      label: '张开',
      confidence: roundedConfidence(0.72 + averageStraightness * 0.24),
    };
  }

  if (bentCount === 4) {
    return {
      label: '握拳/聚合',
      confidence: roundedConfidence(0.76 + bentCount * 0.04),
    };
  }

  return { label: '未知', confidence: 0.35 };
}

export function resolveGesture(landmarks, officialCategory) {
  const custom = classifyGesture(landmarks);
  if (custom.label === 'OK') return custom;
  return mapOfficialGesture(officialCategory);
}

export class GestureSmoother {
  constructor(windowSize = 5) {
    if (!Number.isInteger(windowSize) || windowSize < 1) {
      throw new RangeError('windowSize must be a positive integer');
    }
    this.windowSize = windowSize;
    this.history = [];
  }

  push(result) {
    const safeResult = result && typeof result.label === 'string'
      ? { label: result.label, confidence: Number(result.confidence) || 0 }
      : { ...UNKNOWN };
    this.history.push(safeResult);
    if (this.history.length > this.windowSize) this.history.shift();

    const groups = new Map();
    for (const item of this.history) {
      const group = groups.get(item.label) ?? { count: 0, total: 0, last: item };
      group.count += 1;
      group.total += item.confidence;
      group.last = item;
      groups.set(item.label, group);
    }
    const winner = [...groups.entries()].sort((left, right) =>
      right[1].count - left[1].count
      || right[1].total - left[1].total
      || this.history.lastIndexOf(right[1].last) - this.history.lastIndexOf(left[1].last))[0];

    return {
      label: winner[0],
      confidence: roundedConfidence(winner[1].total / winner[1].count),
    };
  }

  reset() {
    this.history.length = 0;
  }
}
