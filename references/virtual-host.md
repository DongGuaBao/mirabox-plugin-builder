# 虚拟宿主机

当前虚拟宿主由 C++ 启动器、CEF 和 Qt 引擎组成。它读取构建后的插件目录，其中包含 manifest、后端入口和使用到的 PI 与资源文件。

在包含 `bin/`、`web/` 和 `ui/` 的宿主源码目录执行：

```powershell
.\bin\mirabox-host.exe --doctor
.\bin\mirabox-host-cef.exe --plugin="<构建后的 .sdPlugin 目录>" --web-root=web
.\bin\mirabox-host-qt.exe --plugin="<构建后的 .mPanelPlugin 目录>" --web-root=web
npm.cmd run verify -- "<构建后的插件目录>"
```

也可以打开启动器，再从控制台添加插件。CEF 对应 StreamDock，Qt 对应 Craft。安装、构建和引擎路径配置见宿主的 README。

- 从左侧选择 Action，将它添加到设备槽位或 Craft 画布。每个实例有独立的 context、settings 和 PI。删除时会发送 `willDisappear`。
- StreamDock 可选择 N4Pro Control Bar、Mira75 Card 预览或通用触摸 Card。SDKVersion 3 插件收到所处槽位的绘图宽高。Mira75 用 tap，通用触摸 Card 可发出拖动或取消序列。模拟槽位尺寸用于测试协议。
- Craft 创建实例时使用 manifest 默认设置，启动事件带画布宽高和型号。可预览 `setImage`、`setImageBlob` 和 `setImageRGBA`，图片像素尺寸会更新 `ActionGeometry`。屏幕级 `lightControl` 状态可在 `/api/state` 检查。
- 使用 `npm.cmd test` 跑状态机测试。运行 `npm.cmd run verify -- "<插件目录>"` 检查后端注册与 PI 加载。真机验收可单独确认屏幕效果和硬件事件。
