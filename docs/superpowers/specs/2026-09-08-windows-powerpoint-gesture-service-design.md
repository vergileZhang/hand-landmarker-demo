# Windows PowerPoint 手势后台服务设计

日期：2026-09-08

## 1. 目标

将现有浏览器手势识别 Demo 改造成 Windows 11 后台托盘程序。程序只服务 Microsoft 365 PowerPoint 桌面版，在幻灯片放映期间通过单手静态手势触发键盘快捷键。

第一版重点验证第三类“持续监听型”场景，不提供网页展示，不实现鼠标、激光点或连续轨迹控制，也不接入 WPS、在线 PPT 或其他操作系统。

## 2. 已确认范围

- 操作系统：Windows 11。
- 演示软件：Microsoft 365 PowerPoint 桌面版。
- 运行形态：用户登录后启动的后台托盘程序，不使用 Windows Service。
- 生效范围：仅在 PowerPoint 处于放映状态时工作。
- 输入方式：电脑摄像头与单手静态手势。
- 动作方式：通过 Win32 `SendInput` 模拟 PowerPoint 快捷键。
- 交互方式：低频待机、手势唤醒、实时控制、手势关闭、返回低频待机。
- 第一版只做离散动作，不实现光标移动、手指轨迹或动态挥动手势。

## 3. 用户流程

1. 用户登录 Windows，托盘程序自动启动。
2. 未检测到 PowerPoint 放映窗口时，程序不打开摄像头。
3. 检测到 PowerPoint 开始放映后，程序打开摄像头并以约 5 FPS 进入低频待机。
4. 用户保持“拇指向上”约 1 秒，程序播放唤醒提示音并进入约 30 FPS 实时控制状态。
5. 用户先放下手或让手势回到中性状态，再执行 PowerPoint 控制动作。
6. 用户保持“握拳”约 1 秒，程序播放关闭提示音并返回低频待机。
7. PowerPoint 结束放映或关闭后，程序停止摄像头并回到未放映状态。

## 4. 第一版手势映射

| 程序状态 | 手势 | 快捷键 | PowerPoint 行为 |
|---|---|---|---|
| 低频待机 | 拇指向上，保持约 1 秒 | 无 | 唤醒实时控制 |
| 实时控制 | 拇指向上 | 右方向键 | 播放下一动画，动画结束后进入下一页 |
| 实时控制 | 拇指向下 | 左方向键 | 返回上一动画或上一页 |
| 实时控制 | 张开手掌 | `B` | 切换黑屏或恢复放映 |
| 实时控制 | OK | `Alt+P` | 播放或暂停当前幻灯片中的媒体 |
| 实时控制 | 握拳，保持约 1 秒 | 无 | 关闭实时控制并返回低频待机 |

握拳不映射到 `Esc`，避免误结束 PowerPoint 放映。向上指、胜利/V 和我爱你在第一版中不触发动作。

## 5. 状态机

### 5.1 状态

- `NO_SLIDESHOW`：未检测到 PowerPoint 放映，摄像头关闭。
- `STANDBY`：检测到放映，摄像头低频运行，只接受唤醒手势。
- `ACTIVE_WAIT_NEUTRAL`：唤醒成功，等待用户放下手，防止同一个拇指向上继续触发翻页。
- `ACTIVE`：实时识别并允许触发 PowerPoint 动作。
- `SUSPENDED`：用户通过托盘暂停，摄像头关闭。
- `ERROR`：摄像头、PowerPoint 连接或输入发送异常，禁止触发动作。

### 5.2 关键转换

- `NO_SLIDESHOW` 到 `STANDBY`：PowerPoint `SlideShowWindows.Count` 从 0 变为大于 0。
- `STANDBY` 到 `ACTIVE_WAIT_NEUTRAL`：拇指向上达到置信度、稳定帧和保持时间要求。
- `ACTIVE_WAIT_NEUTRAL` 到 `ACTIVE`：未检测到手、结果为未知或置信度低于阈值。
- `ACTIVE` 到 `STANDBY`：握拳保持约 1 秒。
- 任意运行状态到 `NO_SLIDESHOW`：PowerPoint 放映结束或 PowerPoint 退出。
- 任意运行状态到 `SUSPENDED`：用户在托盘菜单选择暂停。
- 摄像头或输入执行失败时进入 `ERROR`，恢复后返回与 PowerPoint 状态一致的安全状态。

## 6. 模块设计

### 6.1 PowerPointMonitor

通过 `pywin32` 连接 PowerPoint COM，读取 `Application.SlideShowWindows.Count` 判断是否存在放映窗口。模块只负责状态探测，不启动或结束放映。

输出：

- `slideshow_active`
- PowerPoint 进程与放映窗口信息
- 连接错误和重连状态

### 6.2 CameraWorker

通过 OpenCV 打开默认摄像头，按状态机要求切换采样频率：

- `STANDBY`：目标约 5 FPS。
- `ACTIVE_WAIT_NEUTRAL` 和 `ACTIVE`：目标约 30 FPS。
- 其他状态：释放摄像头。

摄像头读取与主状态机分线程运行，通过有界队列只保留最新帧，避免积压导致延迟。

### 6.3 GestureRecognizer

使用 MediaPipe Gesture Recognizer 的视频模式处理摄像头帧，输出：

- 手势标签
- 置信度
- 左右手信息
- 21 个关键点

保留现有七种官方手势，并移植基于关键点几何关系的 OK 判断。

### 6.4 TriggerGate

负责将逐帧分类结果转换为一次性动作事件：

- 普通动作：置信度不低于 0.70，连续 5 帧保持同一手势。
- 唤醒与关闭：除连续帧外，还需保持约 1 秒。
- 动作冷却：默认 800 ms。
- 重新武装：动作触发后，必须先回到中性状态才能再次触发。
- 状态切换时清空历史候选，防止旧结果进入新状态。

阈值写入本地配置文件，第一版不制作设置界面。

### 6.5 ShortcutDispatcher

使用 Win32 `SendInput` 发送按键，发送前执行以下检查：

1. 当前存在 PowerPoint 放映窗口。
2. 前台窗口属于 `POWERPNT.EXE`。
3. 托盘程序与 PowerPoint 处于相同完整性级别。
4. 当前状态为 `ACTIVE`。
5. 该手势在第一版映射白名单内。

程序不主动抢占窗口焦点。若 PowerPoint 不在前台，忽略动作并记录原因。

### 6.6 TrayController

托盘程序不显示主窗口。图标和菜单提供：

- 当前状态：未放映、低频待机、实时控制、已暂停、异常。
- 暂停或继续手势控制。
- 开机自启开关。
- 打开日志目录。
- 退出程序。

唤醒成功和返回待机使用两种简短提示音，不显示遮挡幻灯片的弹窗。

### 6.7 EventLogger

采用滚动日志记录：

- 时间、状态转换和 PowerPoint 放映状态。
- 手势标签、置信度与最终动作。
- 被过滤动作的原因。
- 摄像头、COM 和 `SendInput` 错误。

日志不保存原始图像、视频帧或可还原画面的关键点序列。

## 7. 技术路线

第一版采用 Python 后台托盘程序：

- Python 3.11
- OpenCV
- MediaPipe Tasks
- pywin32
- Win32 `SendInput`
- pystray
- PyInstaller

正式开发前在 Windows 11 目标机上锁定经过验证的依赖版本。程序以普通用户权限运行，PowerPoint 也应以普通用户权限运行。

## 8. 异常与安全处理

- 摄像头不存在、被占用或读取失败：进入异常状态，停止动作并有限次数重试。
- PowerPoint COM 未启动或暂时断开：按退避策略重连，不启动 PowerPoint。
- 放映在识别过程中结束：立即清空触发器、释放摄像头并停止发键。
- PowerPoint 不在前台：继续识别，但不发送快捷键。
- `SendInput` 返回失败：记录错误，不自动重复发送，避免动作执行两次。
- 程序退出：停止线程、释放摄像头并删除托盘图标。
- 休眠或摄像头设备变化：恢复后重新枚举设备与 PowerPoint 状态。

## 9. 测试与验收

### 9.1 自动化测试

- 状态机转换测试。
- 唤醒后等待中性状态测试。
- 手势与快捷键映射测试。
- 连续帧、置信度、保持时间、冷却和重新武装测试。
- PowerPoint 不在前台时拒绝发键测试。
- 放映结束后停止识别测试。
- 摄像头和 COM 异常恢复测试。

### 9.2 Windows 集成测试

- Windows 11 与 Microsoft 365 PowerPoint。
- 单屏普通放映。
- 双屏演讲者视图。
- 包含动画的幻灯片，验证右方向键顺序播放动画和翻页。
- 包含本地视频的幻灯片，验证 `Alt+P` 播放与暂停。
- 黑屏与恢复放映。
- PowerPoint 切换到后台时不误发键。
- 普通权限与管理员权限差异。

### 9.3 稳定性与性能

- 后台连续运行至少 30 分钟。
- 分别记录 `NO_SLIDESHOW`、`STANDBY` 和 `ACTIVE` 的 CPU 与内存。
- 测量从稳定手势成立到 PowerPoint 接收按键的动作延迟。
- 测试弱光、侧手、距离变化、运动模糊和短暂遮挡。
- 单独统计误触发、漏触发和识别成功率，不以单次演示结果代替指标。

## 10. 第一版交付物

- 可运行的 Windows 11 托盘程序。
- 可选开机自启的安装包或便携版 `.exe`。
- 默认配置文件与提示音资源。
- 自动化测试与 Windows 手工测试记录。
- CPU、内存、动作延迟、误触发与漏触发测试结果。
- 安装、使用、暂停、退出和故障排查说明。

## 11. 暂不包含

- WPS、PowerPoint 网页版和 Windows 10。
- macOS 与 Linux。
- 鼠标移动、激光点位置、画笔轨迹和动态挥手。
- 双手组合手势。
- 通过手势结束 PowerPoint 放映。
- MCP Server 和大模型工具调用。
- 图形化配置界面。

## 12. 参考资料

- Microsoft PowerPoint 放映快捷键：<https://support.microsoft.com/en-us/accessibility/powerpoint/use-keyboard-shortcuts-to-deliver-powerpoint-presentations>
- PowerPoint `Application.SlideShowWindows`：<https://learn.microsoft.com/en-us/office/vba/api/powerpoint.application.slideshowwindows>
- Windows `SendInput`：<https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendinput>
- Windows 通知区域设计：<https://learn.microsoft.com/en-us/windows/win32/uxguide/winenv-notification>
