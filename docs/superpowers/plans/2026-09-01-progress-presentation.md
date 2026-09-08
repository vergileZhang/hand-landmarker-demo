# 手势识别阶段汇报 PPT Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 生成一份面向非技术管理者的 8 页中文 PowerPoint，准确展示当前手势识别效果、能力边界、四种交互方案和一周实验安排。

**Architecture:** 使用现有本地 Demo 作为事实来源，在本机浏览器测量单帧推理耗时并采集真实界面截图；使用 `@oai/artifact-tool` 生成 16:9 可编辑 PPTX，随后渲染全部页面并执行溢出与视觉检查。最终文件保存到 `/Users/zwj/Documents/手部识别/手势识别与MCP触发_阶段进展汇报.pptx`。

**Tech Stack:** MediaPipe Tasks Vision 1.0.1、浏览器 Performance API、`@oai/artifact-tool`、PowerPoint PPTX、LibreOffice 渲染工具。

---

## File map

- Create: `/Users/zwj/Documents/手部识别/.ppt-build/progress-report/build_deck.mjs` — PPT 构建脚本。
- Create: `/Users/zwj/Documents/手部识别/.ppt-build/progress-report/source-notes.txt` — 数据口径与本地资产来源。
- Create: `/Users/zwj/Documents/手部识别/.ppt-build/progress-report/demo.png` — 真实 Demo 截图。
- Create: `/Users/zwj/Documents/手部识别/手势识别与MCP触发_阶段进展汇报.pptx` — 最终可编辑演示文稿。

### Task 1: Collect verified metrics and screenshot

**Files:**
- Read: `src/app.js`
- Read: `src/gesture-classifier.js`
- Create: `/Users/zwj/Documents/手部识别/.ppt-build/progress-report/source-notes.txt`
- Create: `/Users/zwj/Documents/手部识别/.ppt-build/progress-report/demo.png`

- [ ] **Step 1: Confirm implemented capability**

Read the recognizer options and label map. Record exactly 8 effective gestures, 21 landmarks per hand, `numHands: 2`, local model execution, confidence output and five-frame smoothing.

- [ ] **Step 2: Measure inference latency**

Open `http://127.0.0.1:8000/`, start the camera, warm up the recognizer, measure at least 50 synchronous `recognizeForVideo` calls with `performance.now()`, and calculate mean, P50 and P95. Label the result as a local-browser measurement rather than a universal guarantee.

- [ ] **Step 3: Capture evidence screenshot**

Capture the local Demo at 16:9-compatible dimensions with model status and eight-gesture legend visible. Save it as `demo.png` and verify it is readable at full slide size.

### Task 2: Build the eight-slide deck

**Files:**
- Create: `/Users/zwj/Documents/手部识别/.ppt-build/progress-report/build_deck.mjs`
- Create: `/Users/zwj/Documents/手部识别/手势识别与MCP触发_阶段进展汇报.pptx`

- [ ] **Step 1: Establish visual system**

Use a dark navy background, teal primary accent and restrained blue/orange semantic colors. Use 50pt or larger on the cover, at least 35pt slide titles, 24pt section callouts and 16pt or larger body text.

- [ ] **Step 2: Create slides 1–4**

Create the cover, executive conclusion, current capability/effect slide, and implemented-versus-current-boundaries slide. The boundary slide must include: hand-front/back changes and extreme in-plane rotation, more than two hands, missing up/down/left/right direction semantics, missing dynamic gestures, missing two-hand compound semantics, and degradation under occlusion/weak light/motion blur.

- [ ] **Step 3: Create slides 5–8**

Create the four-mode interaction comparison, recommended session/wake state flow, engineering risks and mitigations, and five-day experiment schedule with acceptance criteria.

- [ ] **Step 4: Add speaker notes sources**

Add `[Sources]` notes for the local code paths, local benchmark record and local screenshot on every slide that uses them.

### Task 3: Render and quality-check

**Files:**
- Read: `/Users/zwj/Documents/手部识别/手势识别与MCP触发_阶段进展汇报.pptx`
- Create: `/Users/zwj/Documents/手部识别/.ppt-build/progress-report/rendered/slide-*.png`
- Create: `/Users/zwj/Documents/手部识别/.ppt-build/progress-report/montage.png`

- [ ] **Step 1: Render all slides**

Run `render_slides.py` on the exported PPTX and verify that eight PNG slides are produced.

- [ ] **Step 2: Inspect deck flow and each slide**

Create a montage for narrative rhythm, then inspect every rendered slide at full size for title wrapping, text clipping, illegible labels, broken crops and unintended overlap.

- [ ] **Step 3: Run automated overflow QA**

Run `slides_test.py` on the PPTX. Expected result: no elements overflow the slide canvas.

- [ ] **Step 4: Correct and re-verify**

Fix every unintended overlap or clipping issue in `build_deck.mjs`, export again, rerender all slides and repeat the automated test until clean.
