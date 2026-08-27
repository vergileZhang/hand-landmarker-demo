# Hand Landmarker 本地演示设计

## 目标

在 `/Users/zwj/Documents/project/hand-landmarker-demo` 内部署一个完全独立的电脑摄像头手部识别演示。浏览器在本机完成推理，展示摄像头画面、手部骨架、21 个关键点、左右手和基础手势，不向远端上传视频。

## 技术方案

- 使用纯 HTML、CSS 和 JavaScript，避免依赖本机未安装的 Node.js。
- 使用 Python 3 标准库 `http.server` 提供 localhost 静态服务。
- 将 MediaPipe Tasks Vision JavaScript 包、WASM 运行文件和 `hand_landmarker.task` 模型全部保存在项目的 `vendor/` 与 `models/` 目录。
- 浏览器通过 `getUserMedia` 读取摄像头，并使用 Hand Landmarker 的 `VIDEO` 模式逐帧推理。
- 上层使用确定性的关键点几何特征识别 `张开`、`握拳/聚合`、`OK`、`指向` 和 `未知`。

## 目录边界

项目的所有新增文件只放在：

```text
/Users/zwj/Documents/project/hand-landmarker-demo/
```

目录职责：

```text
hand-landmarker-demo/
├── index.html                 # 页面结构
├── src/
│   ├── app.js                 # 摄像头、模型和渲染流程
│   └── gesture-classifier.js  # 可测试的关键点几何分类
├── styles/app.css             # 简洁响应式界面
├── models/                    # 本地 MediaPipe 模型
├── vendor/                    # 本地 JS 与 WASM 运行依赖
├── tests/                     # Python 标准库驱动的 JS 行为测试
├── scripts/
│   └── serve.py               # 本地服务启动器
├── README.md                  # 安装、启动和使用说明
└── docs/superpowers/          # 设计与实施计划
```

## 页面与交互

- 页面顶部显示项目名称和本地运行状态。
- 主区域显示镜像摄像头画面，Canvas 叠加手框、21 个关键点和骨架连线。
- 状态面板显示模型状态、摄像头状态、检测到的手数、左右手、当前手势和置信度。
- 提供“启动摄像头”和“停止”按钮。
- 未授权摄像头、模型加载失败、浏览器不支持摄像头时，页面显示可理解的错误信息。
- 停止摄像头时必须释放媒体轨道并停止动画循环。

## 手势分类

分类器只依赖归一化的 21 点坐标：

- `张开`：至少四根手指呈伸展状态。
- `握拳/聚合`：至少四根手指呈弯曲状态。
- `OK`：拇指尖与食指尖距离相对掌宽足够小，同时中指、无名指和小指多数伸展。
- `指向`：食指伸展，其余三根非拇指手指弯曲。
- `未知`：不满足以上稳定条件。

分类结果按优先级 `OK → 指向 → 张开 → 握拳/聚合 → 未知` 判断，避免 OK 被误判为张开。连续视频结果使用短窗口多数投票降低抖动。

## 数据流

```text
摄像头帧
  → MediaPipe VIDEO 推理
  → handedness + 21 landmarks
  → 几何分类器
  → 短窗口平滑
  → Canvas 骨架和状态面板
```

## 测试与验收

- 使用固定的合成关键点样本测试张开、握拳、OK、指向和未知分类。
- 测试归一化尺度不影响分类结果。
- 检查项目中不包含远程 CDN 引用，确保运行依赖确实在本地。
- 启动静态服务器后验证首页、模型、JS 和 WASM 资源均返回 HTTP 200。
- 使用真实浏览器打开页面，授权电脑摄像头，确认视频、关键点覆盖层、启动/停止流程和错误提示。

## 范围限制

- 第一版不训练自定义神经网络。
- 第一版不识别挥手、滑动等长时序动作。
- 第一版不把 MediaPipe 的相对深度解释为真实物理距离。
- 手势阈值面向演示用途，后续应根据实际摄像头和使用者数据标定。
