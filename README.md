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
models/gesture_recognizer.task    本地 MediaPipe 模型
vendor/mediapipe/                 本地 JavaScript 和 WASM 运行库
scripts/download-assets.py        重新下载固定版本资源
scripts/serve.py                  本地静态服务器
tests/                             自动化测试
```

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
