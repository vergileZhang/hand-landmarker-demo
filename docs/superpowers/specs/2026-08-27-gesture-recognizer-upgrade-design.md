# Gesture Recognizer 八手势升级设计

## 目标

将当前基于 Hand Landmarker 和四类几何规则的演示，升级为 MediaPipe 官方 Gesture Recognizer 驱动的本地视频识别。界面继续显示每只手的 21 个关键点、左右手和置信度，并支持八种中文手势结果。

## 手势集合

官方模型提供七种 canned gestures：

- `Closed_Fist` → 握拳
- `Open_Palm` → 张开
- `Pointing_Up` → 向上指
- `Thumb_Down` → 拇指向下
- `Thumb_Up` → 拇指向上
- `Victory` → 胜利/V
- `ILoveYou` → 我爱你

MediaPipe 官方模型不包含 OK。前端保留基于 21 个关键点的 OK 几何判断；当该判断达到阈值时，OK 优先于官方分类结果。因此用户可实际使用八种手势，其他姿态显示为“未知”。

## 推理与融合

浏览器从本地加载 `gesture_recognizer.task`、MediaPipe JavaScript 和 WASM，不依赖 CDN。摄像头视频帧通过 `recognizeForVideo` 推理，结果中的 `landmarks` 和 `handedness` 直接用于绘制与左右手显示。

每只手的最终分类按以下顺序确定：

1. 用关键点计算拇指尖与食指尖的归一化距离，并检查中指、无名指、小指的伸展状态；满足条件时输出 OK。
2. 否则读取官方 canned gesture 的最高分结果，并映射为中文标签。
3. 官方结果为空、为 `None` 或不在支持列表时输出“未知”。
4. 对每只手独立执行短窗口多数投票，减少逐帧抖动。

## 界面与兼容性

保持当前单页布局、摄像头启停流程和本机 HTTP 服务。右侧“支持的手势”扩展到八项。模型状态、异常提示和停止摄像头后的资源释放逻辑保持不变。

## 资源与测试

- 下载脚本固定安装 MediaPipe Tasks Vision `1.0.1` 和官方 float16 Gesture Recognizer 模型。
- 删除不再使用的 `hand_landmarker.task`，避免误导和重复占用空间。
- 单元测试覆盖七类官方标签的中文映射、未知结果和 OK 优先级。
- 包装测试确认模型与运行库均在本地，并确认入口使用 `GestureRecognizer`、`recognizeForVideo` 和新模型路径。
- 最终通过本地 HTTP 页面进行摄像头冒烟验证。
