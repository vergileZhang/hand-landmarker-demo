# Three Interaction Demo Scenarios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有本地摄像头手势识别页面中加入被动响应型、用户唤醒型、持续监听型三套可独立演示的业务场景。

**Architecture:** MediaPipe 推理与关键点绘制继续由 `src/app.js` 负责；新增纯逻辑的手势触发门控与场景状态机，避免识别结果直接执行动作。场景动作仅作用于浏览器内的会议摘要、直播间和文档模拟器，事件记录采用 MCP 工具/事件命名，真实跨应用控制留给后续本地桥接层。

**Tech Stack:** 原生 HTML/CSS/JavaScript、MediaPipe Gesture Recognizer、Node.js `node:test`、本地 Python 静态服务器

---

## 文件结构

- Create: `src/gesture-trigger.js` — 连续帧确认、置信度门槛、上升沿、重新武装和冷却。
- Create: `src/scenario-engine.js` — 三类场景状态机和手势到动作的纯逻辑映射。
- Create: `src/demo-view.js` — 浏览器内场景渲染、动作反馈和事件日志。
- Create: `tests/gesture-trigger.test.mjs` — 触发门控单元测试。
- Create: `tests/scenario-engine.test.mjs` — 三类场景状态迁移和超时测试。
- Modify: `src/app.js` — 将识别结果接入门控、状态机和视图层。
- Modify: `index.html` — 三场景选择器、模拟操作区、状态与事件日志。
- Modify: `styles/app.css` — 新增场景卡片、模拟器和响应式布局。
- Modify: `tests/package.test.mjs` — 验证新增模块、DOM 合同和本地资源约束。
- Modify: `README.md` — 增加三套演示步骤、手势映射和浏览器能力边界。

### Task 1: 实现防重复触发门控

**Files:**
- Create: `src/gesture-trigger.js`
- Create: `tests/gesture-trigger.test.mjs`

- [ ] **Step 1: 编写失败测试**

在 `tests/gesture-trigger.test.mjs` 覆盖以下行为：

```javascript
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

test('supports a minimum hold duration for wake gestures', () => {
  const gate = new GestureTrigger({ stableFrames: 2, confidenceThreshold: 0.7, cooldownMs: 0, minimumHoldMs: 800 });
  gate.update({ label: '拇指向上', confidence: 0.9 }, 0);
  assert.equal(gate.update({ label: '拇指向上', confidence: 0.9 }, 400), null);
  assert.equal(gate.update({ label: '拇指向上', confidence: 0.9 }, 799), null);
  assert.equal(gate.update({ label: '拇指向上', confidence: 0.9 }, 800)?.label, '拇指向上');
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
/Users/zwj/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/gesture-trigger.test.mjs
```

Expected: FAIL，提示 `src/gesture-trigger.js` 不存在。

- [ ] **Step 3: 实现最小门控类**

`src/gesture-trigger.js` 导出：

```javascript
export class GestureTrigger {
  constructor({ stableFrames = 5, confidenceThreshold = 0.7, cooldownMs = 800, minimumHoldMs = 0 } = {})
  update(result, timestamp)
  reset()
}
```

`update` 将 `未知`、低置信度或空结果视为 neutral；相同手势连续达到 `stableFrames` 后仅触发一次，等待 neutral 重新武装，并拒绝冷却期内的新动作。

- [ ] **Step 4: 运行测试确认通过**

Run: 与 Step 2 相同。

Expected: 4 tests passed, 0 failed。

- [ ] **Step 5: 提交门控逻辑**

```bash
git add hand-landmarker-demo/src/gesture-trigger.js hand-landmarker-demo/tests/gesture-trigger.test.mjs
git commit -m "feat: add gesture action trigger gate"
```

### Task 2: 实现三类场景状态机

**Files:**
- Create: `src/scenario-engine.js`
- Create: `tests/scenario-engine.test.mjs`

- [ ] **Step 1: 编写失败测试**

测试必须覆盖：

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { ScenarioEngine } from '../src/scenario-engine.js';

test('passive confirmation consumes one response and closes', () => {
  const engine = new ScenarioEngine();
  engine.start('passive', 0);
  assert.equal(engine.handleGesture('拇指向上', 100).type, 'summary.save');
  assert.equal(engine.state, 'inactive');
  assert.equal(engine.handleGesture('拇指向下', 200), null);
});

test('passive confirmation times out', () => {
  const engine = new ScenarioEngine({ passiveTimeoutMs: 8000 });
  engine.start('passive', 0);
  assert.equal(engine.tick(8001).type, 'confirmation.timeout');
  assert.equal(engine.state, 'inactive');
});

test('wake mode requires thumb up before live controls', () => {
  const engine = new ScenarioEngine();
  engine.start('wake', 0);
  assert.equal(engine.handleGesture('胜利/V', 100), null);
  assert.equal(engine.handleGesture('拇指向上', 200).type, 'live.session.started');
  assert.equal(engine.handleGesture('胜利/V', 300).type, 'live.scene.next');
  assert.equal(engine.handleGesture('OK', 400).type, 'live.product.show');
  assert.equal(engine.handleGesture('握拳', 500).type, 'live.session.standby');
});

test('wake mode returns to standby after idle timeout', () => {
  const engine = new ScenarioEngine({ wakeIdleTimeoutMs: 15000 });
  engine.start('wake', 0);
  engine.handleGesture('拇指向上', 10);
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
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
/Users/zwj/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/scenario-engine.test.mjs
```

Expected: FAIL，提示 `src/scenario-engine.js` 不存在。

- [ ] **Step 3: 实现场景引擎**

`ScenarioEngine` 提供：

```javascript
export class ScenarioEngine {
  constructor({ passiveTimeoutMs = 8000, wakeIdleTimeoutMs = 15000 } = {})
  start(mode, timestamp)
  stop(reason = 'manual')
  handleGesture(label, timestamp)
  tick(timestamp)
  getSnapshot()
}
```

合法状态固定为 `inactive`、`passive-waiting`、`wake-standby`、`wake-active`、`continuous-active`、`continuous-paused`。动作对象统一为 `{ type, mode, timestamp, payload }`，手势映射严格采用已批准设计文档。

- [ ] **Step 4: 运行测试确认通过**

Run: 与 Step 2 相同。

Expected: 5 tests passed, 0 failed。

- [ ] **Step 5: 提交状态机**

```bash
git add hand-landmarker-demo/src/scenario-engine.js hand-landmarker-demo/tests/scenario-engine.test.mjs
git commit -m "feat: add three gesture scenario state machines"
```

### Task 3: 建立三场景前端结构

**Files:**
- Modify: `index.html`
- Modify: `styles/app.css`
- Modify: `tests/package.test.mjs`

- [ ] **Step 1: 扩展失败的 DOM 合同测试**

将以下 ID 加入 `page exposes the camera demo contract`：

```javascript
'scenario-passive', 'scenario-wake', 'scenario-continuous',
'scenario-title', 'scenario-state', 'scenario-stage',
'start-scenario', 'stop-scenario', 'event-log'
```

再断言页面含有“被动响应型”“用户唤醒型”“持续监听型”，并检查 `src/app.js` 引用了 `gesture-trigger.js`、`scenario-engine.js`、`demo-view.js`。

- [ ] **Step 2: 运行合同测试确认失败**

Run:

```bash
/Users/zwj/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/package.test.mjs
```

Expected: FAIL，首先报告缺少 `#scenario-passive`。

- [ ] **Step 3: 修改 HTML**

在 hero 与现有 workspace 之间加入三枚场景按钮；在识别结果侧栏下方加入 `scenario-state`；在页面底部加入 `scenario-stage` 和 `event-log`。三个场景舞台都保留在 DOM 中，通过 `hidden` 属性切换：

```html
<section class="scenario-switcher" aria-label="Demo 场景">
  <button id="scenario-passive" data-scenario="passive">被动响应型</button>
  <button id="scenario-wake" data-scenario="wake">用户唤醒型</button>
  <button id="scenario-continuous" data-scenario="continuous">持续监听型</button>
</section>
```

被动响应舞台显示会议摘要确认卡；用户唤醒舞台显示直播画面、当前素材、商品卡片和关注提示；持续监听舞台显示 4 页可切换的模拟文档。

- [ ] **Step 4: 添加样式**

保持现有深蓝、青绿视觉系统。桌面端使用摄像头区与场景舞台双栏布局；820px 以下改为单栏。所有状态变化同时使用文本和颜色表达，按钮保留清晰 focus 样式。

- [ ] **Step 5: 运行合同测试确认通过**

Expected: package tests 全部通过。

- [ ] **Step 6: 提交页面骨架**

```bash
git add hand-landmarker-demo/index.html hand-landmarker-demo/styles/app.css hand-landmarker-demo/tests/package.test.mjs
git commit -m "feat: add three-scenario demo workspace"
```

### Task 4: 实现场景动作视图层

**Files:**
- Create: `src/demo-view.js`
- Modify: `tests/package.test.mjs`

- [ ] **Step 1: 为视图模块增加静态合同测试**

断言 `src/demo-view.js` 导出 `DemoView`，并包含动作类型：

```text
summary.save summary.cancel summary.defer
live.scene.next live.product.show live.follow.show live.overlay.hide
document.page.next document.page.previous document.control.paused
```

- [ ] **Step 2: 运行测试确认失败**

Expected: FAIL，提示 `src/demo-view.js` 不存在。

- [ ] **Step 3: 实现 `DemoView`**

提供以下接口：

```javascript
export class DemoView {
  constructor(elements)
  selectScenario(mode)
  renderState(snapshot)
  applyAction(action)
  appendEvent(action)
  reset(mode)
}
```

`applyAction` 只操作浏览器内模拟器：保存会议摘要、切换三种直播素材、显示/隐藏商品卡与关注提示、切换四页文档。事件日志显示时间、手势、动作类型与中文结果，不执行文件删除、消息发送或系统快捷键。

- [ ] **Step 4: 运行合同测试确认通过并提交**

```bash
git add hand-landmarker-demo/src/demo-view.js hand-landmarker-demo/tests/package.test.mjs
git commit -m "feat: render gesture scenario actions"
```

### Task 5: 将实时识别接入三场景

**Files:**
- Modify: `src/app.js`
- Modify: `tests/package.test.mjs`

- [ ] **Step 1: 增加失败的集成合同测试**

断言 `src/app.js` 导入 `GestureTrigger`、`ScenarioEngine`、`DemoView`，并在渲染第一只手的平滑结果后调用门控；断言 `stopCamera` 同时重置门控和场景。

- [ ] **Step 2: 运行测试确认失败**

Expected: FAIL，报告缺少 `GestureTrigger` 导入。

- [ ] **Step 3: 集成模块**

在 `app.js` 中：

1. 初始化动作门控 `GestureTrigger({ stableFrames: 5, confidenceThreshold: 0.7, cooldownMs: 800 })`。
2. 初始化唤醒门控 `GestureTrigger({ stableFrames: 5, confidenceThreshold: 0.7, cooldownMs: 800, minimumHoldMs: 800 })`。
3. 初始化 `ScenarioEngine` 与 `DemoView`。
4. 场景按钮只切换选择，不自动启动摄像头。
5. “启动场景”先启动摄像头，再调用 `engine.start(mode, performance.now())`。
6. 每帧仅将第一只手的平滑识别结果传给门控；`wake-standby` 使用唤醒门控，其余状态使用动作门控。
7. 门控触发后调用 `engine.handleGesture`，将返回动作交给 `view.applyAction` 并刷新状态。
8. `requestAnimationFrame` 循环中调用 `engine.tick` 处理 8 秒确认超时与 15 秒直播空闲超时。
9. 被动确认结束时停止摄像头；用户唤醒超时只返回守候；持续监听握拳后停止摄像头。
10. 停止按钮清理摄像头、两个门控、状态机和场景视图。

- [ ] **Step 4: 运行全部 Node 测试**

```bash
/Users/zwj/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/*.test.mjs
```

Expected: 全部测试通过，0 failed。

- [ ] **Step 5: 提交集成**

```bash
git add hand-landmarker-demo/src/app.js hand-landmarker-demo/tests/package.test.mjs
git commit -m "feat: connect gesture recognition to demo scenarios"
```

### Task 6: 文档、浏览器验收与最终回归

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 更新 README**

写明三套场景的演示顺序、手势映射、启动方式和边界：当前浏览器版只控制页面内模拟器；真实 PowerPoint、PDF 阅读器或直播软件控制需要本地桥接层及系统辅助功能权限。

- [ ] **Step 2: 运行完整测试**

```bash
/Users/zwj/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/*.test.mjs
```

Expected: 0 failed。

- [ ] **Step 3: 启动本地服务器**

```bash
python3 scripts/serve.py
```

打开 `http://127.0.0.1:8000/`，确认模型就绪、摄像头权限正常、三场景按钮可切换。

- [ ] **Step 4: 逐场景验收**

- 被动响应型：拇指向上保存，拇指向下取消，张开暂不处理，超时自动结束。
- 用户唤醒型：未唤醒时忽略控制手势；拇指向上唤醒；V、OK、向上指、张开和握拳动作正确。
- 持续监听型：上下页、暂停/恢复、结束均正确，同一手势持续保持不重复动作。
- 摄像头停止后轨道释放，重新启动仍可识别。

- [ ] **Step 5: 检查控制台和响应式布局**

桌面与窄屏均无横向溢出；浏览器控制台无异常；界面持续显示摄像头和场景状态。

- [ ] **Step 6: 提交文档**

```bash
git add hand-landmarker-demo/README.md
git commit -m "docs: document three gesture demo scenarios"
```
