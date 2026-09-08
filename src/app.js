import { FilesetResolver, GestureRecognizer } from '../vendor/mediapipe/vision_bundle.mjs';
import { GestureSmoother, resolveGesture } from './gesture-classifier.js';
import { GestureTrigger } from './gesture-trigger.js';
import { ScenarioEngine } from './scenario-engine.js';
import { DemoView } from './demo-view.js';

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

const elements = Object.fromEntries([
  'camera', 'overlay', 'viewer', 'empty-state', 'start-camera', 'stop-camera',
  'model-status', 'camera-status', 'hand-count', 'handedness', 'gesture-label',
  'gesture-confidence', 'confidence-fill', 'error-message',
  'scenario-passive', 'scenario-wake', 'scenario-continuous', 'scenario-title',
  'scenario-state', 'scenario-stage', 'start-scenario', 'stop-scenario', 'event-log',
  'passive-stage', 'passive-result', 'wake-stage', 'live-scene', 'live-product',
  'live-follow', 'continuous-stage', 'document-page', 'document-page-label',
].map((id) => [id, document.getElementById(id)]));

const context = elements.overlay.getContext('2d');
const smoothers = [new GestureSmoother(5), new GestureSmoother(5)];
const actionGate = new GestureTrigger({
  stableFrames: 5, confidenceThreshold: 0.7, cooldownMs: 800,
});
const wakeGate = new GestureTrigger({
  stableFrames: 5, confidenceThreshold: 0.7, cooldownMs: 800, minimumHoldMs: 800,
});
const scenarioEngine = new ScenarioEngine();
const demoView = new DemoView(elements);
let gestureRecognizer = null;
let mediaStream = null;
let animationFrame = null;
let lastVideoTime = -1;
let lastRecognitionAt = -Infinity;
let selectedScenario = 'passive';

function setModelStatus(label, state = '') {
  elements['model-status'].textContent = label;
  const pill = elements['model-status'].closest('.model-pill');
  pill.classList.remove('ready', 'error');
  if (state) pill.classList.add(state);
}

function setCameraStatus(label, running = false) {
  elements['camera-status'].textContent = label;
  elements['camera-status'].classList.toggle('running', running);
}

function setError(message = '') {
  elements['error-message'].textContent = message;
}

function resetResult(label = '等待启动') {
  elements['hand-count'].textContent = '0';
  elements.handedness.textContent = '—';
  elements['gesture-label'].textContent = label;
  elements['gesture-confidence'].textContent = '0%';
  elements['confidence-fill'].style.width = '0%';
  smoothers.forEach((smoother) => smoother.reset());
}

function localizeHandedness(categoryName) {
  if (categoryName === 'Left') return '左手';
  if (categoryName === 'Right') return '右手';
  return categoryName || '未知';
}

function resizeCanvas() {
  const { videoWidth, videoHeight } = elements.camera;
  if (!videoWidth || !videoHeight) return;
  if (elements.overlay.width !== videoWidth || elements.overlay.height !== videoHeight) {
    elements.overlay.width = videoWidth;
    elements.overlay.height = videoHeight;
  }
}

function drawHand(landmarks, index) {
  const width = elements.overlay.width;
  const height = elements.overlay.height;
  const colors = index === 0
    ? { line: '#4ee5bd', point: '#effffb' }
    : { line: '#4b91ff', point: '#f0f6ff' };

  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.strokeStyle = colors.line;
  context.lineWidth = Math.max(2, width / 320);
  for (const [from, to] of HAND_CONNECTIONS) {
    context.beginPath();
    context.moveTo(landmarks[from].x * width, landmarks[from].y * height);
    context.lineTo(landmarks[to].x * width, landmarks[to].y * height);
    context.stroke();
  }

  for (const landmark of landmarks) {
    context.beginPath();
    context.arc(
      landmark.x * width,
      landmark.y * height,
      Math.max(3, width / 190),
      0,
      Math.PI * 2,
    );
    context.fillStyle = colors.point;
    context.fill();
    context.strokeStyle = colors.line;
    context.lineWidth = Math.max(1, width / 640);
    context.stroke();
  }
}

function renderResults(results) {
  resizeCanvas();
  context.clearRect(0, 0, elements.overlay.width, elements.overlay.height);
  const hands = results?.landmarks ?? [];
  elements['hand-count'].textContent = String(hands.length);

  if (hands.length === 0) {
    elements.handedness.textContent = '—';
    elements['gesture-label'].textContent = '未检测到手';
    elements['gesture-confidence'].textContent = '0%';
    elements['confidence-fill'].style.width = '0%';
    return { label: '未知', confidence: 0 };
  }

  const labels = [];
  const gestures = [];
  hands.forEach((landmarks, index) => {
    drawHand(landmarks, index);
    const handedness = results.handedness?.[index]?.[0];
    labels.push(localizeHandedness(handedness?.categoryName));
    const officialGesture = results.gestures?.[index]?.[0];
    const resolvedGesture = resolveGesture(landmarks, officialGesture);
    gestures.push(smoothers[index]?.push(resolvedGesture) ?? resolvedGesture);
  });

  elements.handedness.textContent = labels.join('、');
  const primary = gestures[0];
  const suffix = gestures.length > 1 ? ` · ${gestures[1].label}` : '';
  elements['gesture-label'].textContent = `${primary.label}${suffix}`;
  const confidence = Math.round(primary.confidence * 100);
  elements['gesture-confidence'].textContent = `${confidence}%`;
  elements['confidence-fill'].style.width = `${confidence}%`;
  return primary;
}

function applyScenarioAction(action) {
  if (!action) return;
  demoView.applyAction(action);
  demoView.renderState(scenarioEngine.getSnapshot());
  if (['summary.save', 'summary.cancel', 'summary.defer', 'confirmation.timeout',
    'document.control.stopped'].includes(action.type)) {
    stopCamera({ preserveScenarioState: true });
    demoView.renderState(scenarioEngine.getSnapshot());
  }
}

function predictFrame() {
  if (!mediaStream || elements.camera.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    animationFrame = requestAnimationFrame(predictFrame);
    return;
  }

  const now = performance.now();
  const isWakeStandby = scenarioEngine.state === 'wake-standby';
  const minimumInterval = isWakeStandby ? 200 : 0;
  if (elements.camera.currentTime !== lastVideoTime && now - lastRecognitionAt >= minimumInterval) {
    lastVideoTime = elements.camera.currentTime;
    lastRecognitionAt = now;
    try {
      const primary = renderResults(gestureRecognizer.recognizeForVideo(elements.camera, now));
      const gate = isWakeStandby ? wakeGate : actionGate;
      const trigger = gate.update(primary, now);
      if (trigger) applyScenarioAction(scenarioEngine.handleGesture(trigger.label, now));
      applyScenarioAction(scenarioEngine.tick(now));
    } catch (error) {
      setError(`识别运行失败：${error.message}`);
      stopCamera({ preserveScenarioState: true });
      return;
    }
  }
  animationFrame = requestAnimationFrame(predictFrame);
}

async function startCamera() {
  if (!gestureRecognizer) return false;
  if (mediaStream) return true;
  setError();
  elements['start-camera'].disabled = true;
  setCameraStatus('正在请求权限');

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user',
      },
    });
    elements.camera.srcObject = mediaStream;
    await elements.camera.play();
    resizeCanvas();
    elements['empty-state'].classList.add('hidden');
    elements['stop-camera'].disabled = false;
    setCameraStatus('识别中', true);
    resetResult('正在识别');
    lastVideoTime = -1;
    lastRecognitionAt = -Infinity;
    animationFrame = requestAnimationFrame(predictFrame);
    return true;
  } catch (error) {
    mediaStream = null;
    elements['start-camera'].disabled = false;
    setCameraStatus('启动失败');
    const message = error.name === 'NotAllowedError'
      ? '摄像头权限被拒绝，请在浏览器地址栏中允许访问后重试。'
      : `无法启动摄像头：${error.message}`;
    setError(message);
    return false;
  }
}

function stopCamera({ preserveScenarioState = false } = {}) {
  if (animationFrame !== null) {
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }
  elements.camera.pause();
  elements.camera.srcObject = null;
  context.clearRect(0, 0, elements.overlay.width, elements.overlay.height);
  elements['empty-state'].classList.remove('hidden');
  elements['start-camera'].disabled = !gestureRecognizer;
  elements['stop-camera'].disabled = true;
  setCameraStatus('已停止');
  resetResult();
  actionGate.reset();
  wakeGate.reset();
  if (!preserveScenarioState && scenarioEngine.state !== 'inactive') {
    const action = scenarioEngine.stop('camera-stopped');
    demoView.applyAction(action);
    demoView.renderState(scenarioEngine.getSnapshot());
  }
}

async function startScenario() {
  const started = await startCamera();
  if (!started) return;
  actionGate.reset();
  wakeGate.reset();
  demoView.reset(selectedScenario);
  scenarioEngine.start(selectedScenario, performance.now());
  demoView.renderState(scenarioEngine.getSnapshot());
}

function stopScenario() {
  const action = scenarioEngine.stop('user');
  if (action) demoView.applyAction(action);
  stopCamera({ preserveScenarioState: true });
  demoView.renderState(scenarioEngine.getSnapshot());
}

function selectScenario(mode) {
  if (scenarioEngine.state !== 'inactive') stopScenario();
  selectedScenario = mode;
  demoView.reset(mode);
  demoView.renderState(scenarioEngine.getSnapshot());
}

async function loadModel() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setModelStatus('浏览器不支持', 'error');
    setError('当前浏览器不支持摄像头 API，请使用最新版 Chrome、Edge 或 Safari。');
    return;
  }

  try {
    const vision = await FilesetResolver.forVisionTasks('./vendor/mediapipe/wasm');
    gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
      baseOptions: { modelAssetPath: './models/gesture_recognizer.task' },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.55,
      minTrackingConfidence: 0.5,
      cannedGesturesClassifierOptions: {
        scoreThreshold: 0.5,
      },
    });
    setModelStatus('已就绪', 'ready');
    elements['start-camera'].disabled = false;
    demoView.renderState(scenarioEngine.getSnapshot());
  } catch (error) {
    setModelStatus('加载失败', 'error');
    setError(`模型加载失败：${error.message}`);
  }
}

elements['start-camera'].addEventListener('click', startCamera);
elements['stop-camera'].addEventListener('click', () => stopCamera());
elements['start-scenario'].addEventListener('click', startScenario);
elements['stop-scenario'].addEventListener('click', stopScenario);
for (const mode of ['passive', 'wake', 'continuous']) {
  elements[`scenario-${mode}`].addEventListener('click', () => selectScenario(mode));
}
window.addEventListener('beforeunload', stopCamera);
window.addEventListener('resize', resizeCanvas);

loadModel();
