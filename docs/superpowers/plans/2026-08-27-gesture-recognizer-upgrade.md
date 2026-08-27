# Gesture Recognizer 八手势升级实施计划

1. 先扩充分类器测试，覆盖官方七类标签映射、未知结果和 OK 覆盖，运行测试并确认新增用例失败。
2. 实现官方结果映射与融合函数，使只有 OK 几何规则能够覆盖官方分类，并运行分类器测试。
3. 修改资源包装测试，要求本地 Gesture Recognizer 模型及对应前端 API，运行并确认旧实现不满足测试。
4. 更新下载脚本，下载官方 `gesture_recognizer.task`；确认新模型完整后移除旧模型。
5. 将应用入口从 `HandLandmarker.detectForVideo` 切换为 `GestureRecognizer.recognizeForVideo`，接入每只手的官方手势结果和融合分类。
6. 更新页面八手势图例、标题和 README，运行全部自动化测试。
7. 启动本地服务，在浏览器验证模型加载、摄像头启停、关键点覆盖层和无远程运行时依赖。
