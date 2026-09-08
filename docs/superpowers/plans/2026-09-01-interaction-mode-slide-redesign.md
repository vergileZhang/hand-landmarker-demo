# Interaction Mode Slide Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将阶段汇报第 5 页改为“三类交互逻辑承载四种实现方式”，并为每种方式补充可直接讲解的应用场景。

**Architecture:** 以现有 PPTX 为唯一视觉与结构来源，通过模板跟随流程复制全部 8 页，仅重写第 5 页已有文本对象，不新增覆盖层。输出更新版副本，保留原始 PPTX；完成逐页渲染、越界、备注来源和压缩包完整性检查。

**Tech Stack:** `@oai/artifact-tool`、PowerPoint PPTX、Presentation skill template-following scripts、Python QA helpers

---

### Task 1: 建立一对一模板编辑工作区

**Files:**
- Create: `/Users/zwj/Documents/手部识别/.ppt-build/slide5-edit/template-audit.txt`
- Create: `/Users/zwj/Documents/手部识别/.ppt-build/slide5-edit/template-frame-map.json`
- Create: `/Users/zwj/Documents/手部识别/.ppt-build/slide5-edit/deviation-log.txt`
- Create: `/Users/zwj/Documents/手部识别/.ppt-build/slide5-edit/template-starter.pptx`

- [ ] **Step 1: 记录模板审计结论**

写明源文件包含 8 页、使用 PingFang SC、深蓝背景、青绿色强调色；第 5 页由标题、副标题、五列表头、四行文本单元和底部建议组成，无继承占位符。

- [ ] **Step 2: 创建完整页映射**

将输出第 1–8 页分别映射到源第 1–8 页。第 5 页的 `editTargets` 明确列出要重写的文本对象：

```text
sh/dgbulwnm sh/cf2tcr61 sh/l4bupwny sh/k7mxovud
sh/i54fmlc7 sh/sb6xsvu9 sh/hgrmpwj2 sh/fe94nm1w sh/pkr6tgjy
sh/3i94r61s sh/5o7mhcju sh/atcjidg7 sh/wve1knyx sh/ihw3mxg3
sh/kjelony9 sh/e1sjatgz sh/fid07u98 sh/1kvi94re sh/3md0bu94
sh/povid4ra sh/bqx0fe9g sh/8f6hcj6t sh/mdoza9o3 sh/0r6h8z6x
sh/yp4z69or
```

- [ ] **Step 3: 创建模板 starter**

运行：

```bash
"$RUNTIME_NODE" "$SKILL_DIR/template_following_scripts/prepare_template_starter_deck.mjs" \
  --workspace /Users/zwj/Documents/手部识别/.ppt-build/slide5-edit \
  --pptx /Users/zwj/Documents/手部识别/手势识别与MCP触发_阶段进展汇报.pptx \
  --map /Users/zwj/Documents/手部识别/.ppt-build/slide5-edit/template-frame-map.json \
  --out /Users/zwj/Documents/手部识别/.ppt-build/slide5-edit/template-starter.pptx \
  --preview-dir /Users/zwj/Documents/手部识别/.ppt-build/slide5-edit/template-starter-preview \
  --layout-dir /Users/zwj/Documents/手部识别/.ppt-build/slide5-edit/template-starter-layout \
  --contact-sheet /Users/zwj/Documents/手部识别/.ppt-build/slide5-edit/template-starter-contact-sheet.png
```

Expected: starter 含 8 页，页面顺序和源文件一致。

### Task 2: 重写第 5 页既有文本对象

**Files:**
- Create: `/Users/zwj/Documents/手部识别/.ppt-build/slide5-edit/edit_slide5.mjs`
- Create: `/Users/zwj/Documents/手部识别/手势识别与MCP触发_阶段进展汇报_更新版.pptx`

- [ ] **Step 1: 导入 starter 并解析第 5 页对象**

使用：

```javascript
import { FileBlob, PresentationFile } from "@oai/artifact-tool";
const deck = await PresentationFile.importPptx(
  await FileBlob.load("/Users/zwj/Documents/手部识别/.ppt-build/slide5-edit/template-starter.pptx")
);
const slide = deck.slides.items[4];
```

- [ ] **Step 2: 写入三类交互逻辑和四种方式**

按已检查的稳定 anchor id 重写以下内容：

```javascript
const replacements = {
  "sh/dgbulwnm": "三类交互逻辑，承载四种手势输入方式",
  "sh/cf2tcr61": "先看谁发起，再比较响应速度、资源占用、误触发与应用场景",
  "sh/l4bupwny": "类别 / 方式",
  "sh/k7mxovud": "可能应用场景",

  "sh/i54fmlc7": "被动响应型\n单次触发",
  "sh/sb6xsvu9": "电脑 / AI 发起请求\n用户做一次手势",
  "sh/hgrmpwj2": "意图明确、资源最低",
  "sh/fe94nm1w": "只能回答当前请求",
  "sh/pkr6tgjy": "AI“确认 / 取消”\n授权或执行前确认",

  "sh/3i94r61s": "持续监听型\n实时检测",
  "sh/5o7mhcju": "摄像头持续监听\n连续输出手势",
  "sh/atcjidg7": "响应最快、支持连续操作",
  "sh/wve1knyx": "资源与误触发风险最高",
  "sh/ihw3mxg3": "连续翻页 / 媒体控制\n无障碍连续交互",

  "sh/kjelony9": "用户唤醒型\n文字 / 按钮",
  "sh/e1sjatgz": "用户明确开启\n一段手势会话",
  "sh/fid07u98": "意图清楚、隐私友好",
  "sh/1kvi94re": "需要额外一次操作",
  "sh/3md0bu94": "办公 / 会议助手\n明确开启控制会话",

  "sh/povid4ra": "用户唤醒型\nThumb Up",
  "sh/bqx0fe9g": "低频检测 Thumb Up\n唤醒后切换实时",
  "sh/8f6hcj6t": "兼顾响应速度与资源",
  "sh/mdoza9o3": "存在唤醒误触发风险",
  "sh/0r6h8z6x": "远距无接触唤醒\n演示 / 快捷控制",

  "sh/yp4z69or": "建议：默认用被动响应型处理确认任务；用户唤醒型负责主动控制；持续监听型只用于明确需要连续操作的场景。"
};
for (const [id, value] of Object.entries(replacements)) {
  deck.resolve(id).text = value;
}
```

- [ ] **Step 3: 更新第 5 页演讲者备注并导出**

在原备注后追加分类说明和 `[Sources]` 本地设计文档路径，随后导出：

```javascript
const out = await PresentationFile.exportPptx(deck);
await out.save("/Users/zwj/Documents/手部识别/手势识别与MCP触发_阶段进展汇报_更新版.pptx");
```

Expected: 输出文件存在且非空，源文件保持不变。

### Task 3: 渲染、修正与交付验证

**Files:**
- Create: `/Users/zwj/Documents/手部识别/.ppt-build/slide5-edit/final-render/`
- Create: `/Users/zwj/Documents/手部识别/.ppt-build/slide5-edit/final-montage.png`

- [ ] **Step 1: 渲染全部 8 页并重点检查第 5 页**

运行 `render_slides.py` 和 `create_montage.py`。Expected: 第 5 页标题单行显示；四行场景均为可读的两行文本；其余 7 页与源文件一致。

- [ ] **Step 2: 检测越界和模板一致性**

运行：

```bash
python3 "$SKILL_DIR/container_tools/slides_test.py" "/Users/zwj/Documents/手部识别/手势识别与MCP触发_阶段进展汇报_更新版.pptx"
"$RUNTIME_NODE" "$SKILL_DIR/template_following_scripts/check_template_fidelity.mjs" \
  --workspace /Users/zwj/Documents/手部识别/.ppt-build/slide5-edit \
  --starter-pptx /Users/zwj/Documents/手部识别/.ppt-build/slide5-edit/template-starter.pptx \
  --final-pptx /Users/zwj/Documents/手部识别/手势识别与MCP触发_阶段进展汇报_更新版.pptx \
  --map /Users/zwj/Documents/手部识别/.ppt-build/slide5-edit/template-frame-map.json \
  --starter-layout-dir /Users/zwj/Documents/手部识别/.ppt-build/slide5-edit/template-starter-layout \
  --final-layout-dir /Users/zwj/Documents/手部识别/.ppt-build/slide5-edit/final-layout \
  --edit-dir /Users/zwj/Documents/手部识别/.ppt-build/slide5-edit
```

Expected: 无页面越界；只报告映射中允许的第 5 页文本变化。

- [ ] **Step 3: 验证 PPTX 压缩包和页数**

运行 `unzip -t`，并断言 `slides=8`、`notes=8`、`source_blocks=8`。Expected: 无压缩错误，全部断言通过。
