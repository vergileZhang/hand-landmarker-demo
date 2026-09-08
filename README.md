# Gesture Recognizer 本地演示

项目需求、方案决策与部署过程见 [CONVERSATION.md](./CONVERSATION.md)。

这是一个完全在本机浏览器运行的电脑摄像头手部识别 Demo。它使用 MediaPipe Gesture Recognizer 输出 21 个关键点，并识别以下八种手势：

- 张开
- 握拳
- OK
- 向上指
- 拇指向上
- 拇指向下
- 胜利/V
- 我爱你
- 未知

其中七种来自 MediaPipe 官方 canned gesture 模型；OK 由关键点几何规则补充，并优先于官方分类结果。

摄像头画面不会上传到服务器；Python 进程只负责提供本地静态文件。

## 启动

系统需要 Python 3，项目不需要安装 Node.js 或其他 Python 依赖。

```bash
cd hand-landmarker-demo
python3 scripts/serve.py
```

然后使用 Chrome、Edge 或 Safari 打开：

[http://127.0.0.1:8000](http://127.0.0.1:8000)

点击“启动摄像头”，并在浏览器提示时允许摄像头权限。按 `Ctrl+C` 可以停止本地服务器。

## 三类交互场景

页面上方可切换三套可直接展示的浏览器内 Demo，选择后点击“启动当前场景”：

1. **被动响应型 · AI 确认**：AI 询问是否保存会议摘要。👍 或 👌 保存，👎 取消，✋ 稍后处理；8 秒无操作自动超时并关闭摄像头。
2. **用户唤醒型 · 直播控制**：待机时持续保持 👍 约 1 秒进入控制状态；✌️ 切换直播素材，👌 显示商品卡，☝️ 显示关注提示，✋ 隐藏浮层，✊ 返回待机；唤醒后 15 秒无操作也会回到待机。
3. **持续监听型 · 文档翻页**：👍 下一页，👎 上一页，✋ 暂停或恢复，✊ 退出并关闭摄像头。

普通操作需要连续 5 帧稳定识别且置信度达到 70%，每次动作后需先松手或回到未知姿态再执行下一次，从而降低连续误触。事件日志采用 `summary.save`、`live.scene.next`、`document.page.next` 等工具事件命名，便于后续对接 MCP 服务。

### 当前能力边界

当前版本只操作页面内的会议摘要、直播画面和文档模拟器，不会直接控制 PowerPoint、PDF 阅读器或直播软件。要控制其他桌面应用，需要增加一个本地桥接服务，将页面产生的动作事件转换为系统快捷键或目标软件 API；macOS 上还需要用户授予该桥接程序“辅助功能”权限。

“用户唤醒型”的待机状态将识别频率限制为约 5 FPS，以降低浏览器计算负载；这只是演示级低负载策略，不代表硬件级低功耗保证。

## 可选参数

如果 8000 端口已被占用，可以更换端口：

```bash
python3 scripts/serve.py --port 8080
```

## 项目结构

```text
index.html                         页面结构
styles/app.css                    页面样式
src/app.js                        摄像头、推理和关键点绘制
src/gesture-classifier.js         官方标签映射、OK 补充与视频平滑
src/gesture-trigger.js            稳定帧、置信度、冷却与防重复触发
src/scenario-engine.js            三类交互状态机及动作映射
src/demo-view.js                  场景模拟器与工具事件日志
models/gesture_recognizer.task    本地 MediaPipe 模型
vendor/mediapipe/                 本地 JavaScript 和 WASM 运行库
scripts/download-assets.py        重新下载固定版本资源
scripts/serve.py                  本地静态服务器
tests/                             自动化测试
docs/presentations/                阶段进展与三场景周报 PPT
```

## 汇报材料

`docs/presentations/` 包含阶段进展汇报和五页版三场景周报，可直接用于项目展示。

## 常见问题

### 摄像头权限被拒绝

点击浏览器地址栏左侧的站点设置，将摄像头权限改为“允许”，刷新页面后重试。

### 页面不能直接双击打开

浏览器对 `file://` 页面加载 WASM 和 ES Module 有安全限制。请使用 `python3 scripts/serve.py` 启动，不要直接双击 `index.html`。

### 没有显示关键点

- 让完整手掌进入画面；
- 保持环境光线充足；
- 手掌尽量正对摄像头；
- 避免手离摄像头过近或快速移动造成模糊。

### 重新下载模型和运行库

当前资源已经随项目保存，无需首次联网。只有在资源损坏或需要重新部署时才运行：

```bash
python3 scripts/download-assets.py
```

该脚本固定下载 MediaPipe Tasks Vision `1.0.1` 和官方 float16 Gesture Recognizer 模型。

## 测试

项目测试使用 Node.js 内置测试器。若本机安装了 Node.js，可以运行：

```bash
node --test tests/*.test.mjs
```

官方七类手势使用 MediaPipe 预训练模型；OK 是演示级几何规则。不同手型、拍摄角度和遮挡可能需要进一步调整 OK 阈值。
