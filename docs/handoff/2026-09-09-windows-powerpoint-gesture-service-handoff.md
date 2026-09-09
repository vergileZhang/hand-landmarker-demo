# Windows PowerPoint 手势服务开发交接

更新时间：2026-09-09

## 1. 当前结论

下一阶段不再继续扩展网页展示，开发重点调整为 Windows 11 后台托盘程序：通过摄像头持续识别单手静态手势，并在 Microsoft 365 PowerPoint 放映时发送键盘快捷键。

目前只完成了需求确认、技术调研和详细设计，**Windows 版本尚未开始编码**。现有浏览器 Demo 保留为算法与交互逻辑参考。

正式设计文档：

- `docs/superpowers/specs/2026-09-08-windows-powerpoint-gesture-service-design.md`

## 2. 已确认需求

- 操作系统只支持 Windows 11。
- 演示软件只支持 Microsoft 365 PowerPoint 桌面版。
- 不做网页界面，程序以后台托盘应用形式运行。
- 不使用真正的 Windows Service，避免系统服务会话无法直接访问用户摄像头和当前桌面。
- 只在 PowerPoint 放映期间工作，编辑模式不响应手势。
- 没有 PowerPoint 放映时关闭摄像头。
- 检测到放映后进入约 5 FPS 低频待机。
- 用户通过手势唤醒实时识别，再通过手势关闭实时识别。
- 关闭实时识别后回到低频待机，继续等待下一次唤醒。
- 只支持单手静态手势。
- 只触发离散快捷键，不实现鼠标、激光点和手指轨迹控制。
- 唤醒和关闭成功后播放不同的轻提示音，不弹出窗口。

## 3. 确认的交互流程

```text
没有 PowerPoint 放映
    ↓ 检测到放映窗口
低频待机，约 5 FPS
    ↓ 👍 保持约 1 秒
播放唤醒提示音
    ↓ 等待用户放下手
实时控制，约 30 FPS
    ↓ ✊ 保持约 1 秒
播放关闭提示音
    ↓
返回低频待机
```

PowerPoint 放映结束后，程序立即释放摄像头并停止发送快捷键。

## 4. 第一版手势映射

| 状态 | 手势 | 快捷键 | 行为 |
|---|---|---|---|
| 低频待机 | 👍 保持约 1 秒 | 无 | 唤醒实时控制 |
| 实时控制 | 👍 | 右方向键 | 播放下一动画，动画结束后进入下一页 |
| 实时控制 | 👎 | 左方向键 | 返回上一动画或上一页 |
| 实时控制 | ✋ | `B` | 切换黑屏或恢复放映 |
| 实时控制 | 👌 | `Alt+P` | 播放或暂停当前幻灯片中的媒体 |
| 实时控制 | ✊ 保持约 1 秒 | 无 | 返回低频待机 |

重要规则：

- 👍 唤醒后必须先放下手或回到未知姿态，之后的 👍 才能触发下一步。
- ✊ 不发送 `Esc`，避免误结束整个 PowerPoint 放映。
- 向上指、胜利/V 和我爱你在第一版不触发动作。
- “下一页”采用 PowerPoint 原生右方向键行为，会先播放当前页动画，再进入下一页。

## 5. 推荐技术路线

第一版采用 Python 后台托盘程序：

- Python 3.11
- OpenCV：摄像头读取
- MediaPipe Tasks：手势与 21 个关键点识别
- pywin32：PowerPoint COM 与前台窗口检查
- Win32 `SendInput`：键盘快捷键注入
- pystray：托盘图标与菜单
- PyInstaller：生成 Windows 可执行程序

推荐模块：

```text
windows_app/
├── pyproject.toml
├── gesture_ppt/
│   ├── config.py
│   ├── types.py
│   ├── trigger_gate.py
│   ├── state_machine.py
│   ├── powerpoint_monitor.py
│   ├── shortcut_dispatcher.py
│   ├── camera_worker.py
│   ├── recognizer.py
│   ├── audio_feedback.py
│   ├── tray_controller.py
│   ├── service.py
│   └── main.py
├── assets/
├── packaging/
└── tests/
```

## 6. 核心状态机

- `NO_SLIDESHOW`：未检测到放映，摄像头关闭。
- `STANDBY`：放映已开始，摄像头低频运行，只接受 👍 唤醒。
- `ACTIVE_WAIT_NEUTRAL`：唤醒成功，等待手势回到中性状态，避免立即翻页。
- `ACTIVE`：实时识别并允许发送快捷键。
- `SUSPENDED`：用户从托盘暂停，摄像头关闭。
- `ERROR`：摄像头、PowerPoint COM 或快捷键发送异常，禁止执行动作。

## 7. 触发规则

现有网页 Demo 已验证以下防误触逻辑，Windows 版本应复用其行为：

- 普通动作置信度不低于 0.70。
- 普通动作连续 5 帧保持同一手势。
- 唤醒和关闭手势额外要求保持约 1 秒。
- 动作后冷却 800 ms。
- 动作触发后必须回到中性状态，才能再次触发。
- 状态切换时清空历史候选。

相关现有代码：

- `src/gesture-trigger.js`
- `src/scenario-engine.js`
- `src/gesture-classifier.js`

## 8. Windows 集成注意事项

### PowerPoint 放映检测

使用 PowerPoint COM：

```text
Application.SlideShowWindows.Count > 0
```

该条件表示当前存在放映窗口。程序不主动启动或结束 PowerPoint 放映。

### 快捷键发送

使用 Win32 `SendInput`，发送前必须确认：

1. PowerPoint 正在放映。
2. 当前前台窗口属于 `POWERPNT.EXE`。
3. 程序处于 `ACTIVE` 状态。
4. 手势存在于第一版动作白名单。
5. PowerPoint 与后台程序使用相同权限级别。

程序不得主动抢夺窗口焦点。若 PowerPoint 不在前台，应忽略动作并记录日志。

`SendInput` 受 Windows UIPI 限制。如果 PowerPoint 以管理员身份运行，而手势程序以普通用户运行，快捷键可能发送失败。

### 摄像头生命周期

- `NO_SLIDESHOW` 和 `SUSPENDED` 状态释放摄像头。
- `STANDBY` 降低送入识别器的帧率，而不是让摄像头硬件进入真正低功耗模式。
- `ACTIVE` 只处理最新帧，使用有界队列防止积压造成高延迟。

## 9. 隐私与日志

- 摄像头数据只在本地处理。
- 不保存视频帧和截图。
- 不把关键点序列写入持久日志。
- 日志只记录状态变化、手势标签、置信度、动作、过滤原因和错误。
- 日志采用滚动文件，防止长期运行无限增长。

## 10. 已有项目状态

现有浏览器 Demo 位于仓库根目录，已具备：

- MediaPipe 本地模型和 WASM 运行库。
- 每只手 21 个关键点。
- 七种官方手势与自定义 OK，共八种有效手势。
- 最多两只手检测。
- 三类网页交互场景。
- 连续帧、置信度、冷却与中性状态重新武装。
- 38 项 Node.js 自动化测试。

浏览器 Demo 的用户唤醒场景仍使用 15 秒空闲超时。之前讨论过改成 30 秒，但尚未修改；Windows 新方案采用 ✊ 主动关闭，不依赖短空闲超时。

## 11. Windows 机器上的建议开发顺序

1. 克隆 GitHub 仓库并确认模型文件完整。
2. 安装 Python 3.11，创建虚拟环境。
3. 验证 OpenCV 能打开内置摄像头。
4. 验证 MediaPipe Python 可以加载 `models/gesture_recognizer.task`。
5. 先移植并测试 `TriggerGate` 与状态机。
6. 实现 PowerPoint COM 放映检测。
7. 实现前台窗口检查与 `SendInput`。
8. 接入摄像头与 MediaPipe 识别循环。
9. 接入提示音、托盘菜单和日志。
10. 测试单屏、双屏与演讲者视图。
11. 使用 PyInstaller 打包，最后配置用户登录自启。

建议始终按测试驱动方式开发：先写失败测试，再实现最小代码，然后运行全部测试并提交。

## 12. 第一版验收项目

- Win11 + Microsoft 365 PowerPoint 可运行。
- 普通放映和演讲者视图都能识别放映状态。
- 没有放映时不占用摄像头。
- 👍 可从低频待机唤醒，且不会顺带翻页。
- 👍、👎、✋、👌 正确触发对应快捷键。
- ✊ 返回待机但不结束 PowerPoint 放映。
- PowerPoint 不在前台时不发送快捷键。
- 单屏与双屏均验证。
- 后台连续运行至少 30 分钟。
- 分别记录待机和实时状态的 CPU、内存与动作延迟。
- 统计误触发、漏触发和识别成功率。

## 13. 尚未完成

- `windows_app` 代码尚未创建。
- 尚未在 Windows 11 上验证 MediaPipe Python 依赖版本。
- 尚未实现 PowerPoint COM 监控。
- 尚未实现 Win32 快捷键注入。
- 尚未实现托盘、提示音、开机自启和 PyInstaller 打包。
- 尚未完成 Windows 实机性能与准确性测试。
- 当前阶段不包含 MCP Server。

## 14. 参考资料

- PowerPoint 放映快捷键：<https://support.microsoft.com/en-us/accessibility/powerpoint/use-keyboard-shortcuts-to-deliver-powerpoint-presentations>
- PowerPoint `Application.SlideShowWindows`：<https://learn.microsoft.com/en-us/office/vba/api/powerpoint.application.slideshowwindows>
- Windows `SendInput`：<https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendinput>
- Windows 通知区域：<https://learn.microsoft.com/en-us/windows/win32/uxguide/winenv-notification>

## 15. Git 信息

- GitHub：<https://github.com/vergileZhang/hand-landmarker-demo>
- 本地开发目录：`/Users/zwj/Documents/project/hand-landmarker-demo`
- 三场景远程版本：`81018c4 feat: publish three gesture interaction demos`
- Windows 设计文档本地提交：`2804716 docs: design Windows PowerPoint gesture service`

切换机器后，以 GitHub `main` 上最新提交为准。
