import { FilesetResolver, HandLandmarker } from '../vendor/mediapipe/vision_bundle.mjs';
import { GestureSmoother, classifyGesture } from './gesture-classifier.js';

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
].map((id) => [id, document.getElementById(id)]));

const context = elements.overlay.getContext('2d');
const smoothers = [new GestureSmoother(5), new GestureSmoother(5)];
let handLandmarker = null;
let mediaStream = null;
let animationFrame = null;
let lastVideoTime = -1;

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
    return;
  }

  const labels = [];
  const gestures = [];
  hands.forEach((landmarks, index) => {
    drawHand(landmarks, index);
    const handedness = results.handedness?.[index]?.[0];
    labels.push(localizeHandedness(handedness?.categoryName));
    gestures.push(smoothers[index]?.push(classifyGesture(landmarks))
      ?? classifyGesture(landmarks));
  });

  elements.handedness.textContent = labels.join('、');
  const primary = gestures[0];
  const suffix = gestures.length > 1 ? ` · ${gestures[1].label}` : '';
  elements['gesture-label'].textContent = `${primary.label}${suffix}`;
  const confidence = Math.round(primary.confidence * 100);
  elements['gesture-confidence'].textContent = `${confidence}%`;
  elements['confidence-fill'].style.width = `${confidence}%`;
}

function predictFrame() {
  if (!mediaStream || elements.camera.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    animationFrame = requestAnimationFrame(predictFrame);
    return;
  }

  if (elements.camera.currentTime !== lastVideoTime) {
    lastVideoTime = elements.camera.currentTime;
    try {
      renderResults(handLandmarker.detectForVideo(elements.camera, performance.now()));
    } catch (error) {
      setError(`识别运行失败：${error.message}`);
      stopCamera();
      return;
    }
  }
  animationFrame = requestAnimationFrame(predictFrame);
}

async function startCamera() {
  if (!handLandmarker || mediaStream) return;
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
    animationFrame = requestAnimationFrame(predictFrame);
  } catch (error) {
    mediaStream = null;
    elements['start-camera'].disabled = false;
    setCameraStatus('启动失败');
    const message = error.name === 'NotAllowedError'
      ? '摄像头权限被拒绝，请在浏览器地址栏中允许访问后重试。'
      : `无法启动摄像头：${error.message}`;
    setError(message);
  }
}

function stopCamera() {
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
  elements['start-camera'].disabled = !handLandmarker;
  elements['stop-camera'].disabled = true;
  setCameraStatus('已停止');
  resetResult();
}

async function loadModel() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setModelStatus('浏览器不支持', 'error');
    setError('当前浏览器不支持摄像头 API，请使用最新版 Chrome、Edge 或 Safari。');
    return;
  }

  try {
    const vision = await FilesetResolver.forVisionTasks('./vendor/mediapipe/wasm');
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: './models/hand_landmarker.task' },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.55,
      minTrackingConfidence: 0.5,
    });
    setModelStatus('已就绪', 'ready');
    elements['start-camera'].disabled = false;
  } catch (error) {
    setModelStatus('加载失败', 'error');
    setError(`模型加载失败：${error.message}`);
  }
}

elements['start-camera'].addEventListener('click', startCamera);
elements['stop-camera'].addEventListener('click', stopCamera);
window.addEventListener('beforeunload', stopCamera);
window.addEventListener('resize', resizeCanvas);

loadModel();
