# Craft：统一新版模板的附加规则

## 宿主能力矩阵（先读这张表）

两个宿主的 PI 能力**不是超集关系**，各有对方没有的能力：

| 能力                                   | StreamDock (`3.*` / `4.*`) | Craft (`5.*`)                 |
| -------------------------------------- | -------------------------- | ----------------------------- |
| PI 子窗口 `openSubWindows`             | 支持                       | **不支持**                    |
| QtWebChannel（坐标 / 原生文件选择）    | **不支持**                 | 支持                          |
| 实体按键 / 旋钮事件                    | 支持                       | **不支持**                    |
| `setImage` 绘制                        | 支持（按控件/型号尺寸）    | 支持（插件决定输出尺寸） |
| RPC / settings / globalSettings / i18n | 支持                       | 支持                          |

因此**任何跨宿主插件都必须做能力分支**，不能假定一个宿主的写法在另一个能跑：

```typescript
const property = Property.getReactiveInstance();

if (property.isStreamDock) {
    property.openSubWindows("sub", 600, 600); // Craft 下不要走这条路
}
```

- 子窗口：Craft 下 `openSubWindows` 不可用，需要"更多设置"时改为在同一 PI 内用
  分区 / 折叠 / 条件渲染承载，不要弹窗。
- QtWebChannel：StreamDock 下 `window.qt` 不存在，`getCraftQtChannel()` 会返回
  `null`。使用 `MiCoordinate` / `MiPathPicker` 时组件已自动降级，不需要你判断；
  手写底层调用时必须判空。
- 判定用 `property.isCraft` / `property.isStreamDock`（或后端 `plugin.isCraft`），
  **不要用 `window.qt` 是否存在来推断宿主** —— 那只能说明 Qt bridge 是否就绪。

## Action 能力

- `Controllers` 使用 `["SecondaryScreen"]`。
- Craft 没有实体按键、旋钮输入，不实现 `keyDown`、`keyUp`、`dialDown`、
  `dialUp`、`dialRotate`、`touchTap`。
- 使用 `willAppear` 初始化并绘制，使用 `didReceiveSettings` 响应 PI 修改和副屏缩放，
  使用 `willDisappear` 清理定时器和实例资源。
- 用 `setImage` 输出完整画面，已编码图片使用 `setImageBlob`，RGBA8 像素使用 `setImageRGBA`。屏幕灯光告警使用 `plugin.lightControl`。参数见 sdk-api.md。
- RPC、PI 子窗口、全局设置等沿用新版 SDK，不再受旧 Craft 模板限制。**但 Craft
  宿主不支持 PI 子窗口**(见下方能力矩阵),仅 StreamDock 可用。
- 使用 `plugin.isCraft` / `property.isCraft` 进入 Craft 分支；SDK 根据启动参数
  `application.version` 判断，`5.*` 为 Craft、`3.*` 为 StreamDock。

## ActionGeometry

`ActionGeometry` 不是普通用户设置，而是 Craft 宿主直接注入、维护并自动持久化的特殊
settings。它的 `width/height` **始终与后端最后一次 `setImage` 输出图片的实际宽高保持
一致**。输出尺寸由插件决定，宿主负责将图片实际宽高回填到该字段并持久化；它用于恢复上次尺寸，不是限制插件只能输出旧尺寸。

**打包给 Craft 时，manifest 里每一个 action 的 `Settings` 都必须包含 `ActionGeometry`**
（决定拖到画布上的默认尺寸；漏写的动作尺寸不可预期）：

```json
{
    "Controllers": ["SecondaryScreen"],
    "Settings": {
        "ActionGeometry": { "width": 680, "height": 460 }
    }
}
```

StreamDock 会忽略该字段，双宿主共用一份 manifest 时照写即可。字段写法细节见
`manifest.md` 的 ActionGeometry 一节。

StreamDock 的控件/型号尺寸规则见 `sdk-api.md`。Craft 恢复上次尺寸时可读取：

```typescript
type CraftSettings = {
    ActionGeometry?: { width: number; height: number };
};

function sizeOf(settings: CraftSettings) {
    return {
        width: Math.max(1, Number(settings.ActionGeometry?.width) || 680),
        height: Math.max(1, Number(settings.ActionGeometry?.height) || 460),
    };
}
```

用户在副屏缩放组件后，Craft 通过 `didReceiveSettings` 发送新的 `ActionGeometry`；收到
后按新尺寸重绘。

### 从 PI 修改尺寸的唯一正确流程

PI 不能直接写 `property.settings.ActionGeometry`，也不能调用 `setSettings` 修改它。
PI 的 settings watch 最终同样会发送 `setSettings`，因此也不能把尺寸输入框直接
`v-model` 到 `ActionGeometry.width/height`。

完整闭环必须是：

```text
PI 输入目标宽高
  → property.sendToPlugin({ type: "resize", width, height })
  → 当前 context 对应的 Node Action 收到 sendToPlugin
  → 后端按目标宽高生成 PNG/SVG/Canvas 图片
  → this.setImage(image)
  → Craft 从图片实际尺寸更新并自动持久化 ActionGeometry
  → Craft 发送 didReceiveSettings
  → 后端和 PI 以宿主回传的 ActionGeometry 为最终值
```

PI 示例，不把输入框绑定到 `ActionGeometry`：

```typescript
const property = Property.getReactiveInstance();
let targetWidth = 680;
let targetHeight = 460;

function requestResize() {
    property.sendToPlugin({
        type: "resize",
        width: Math.max(1, Math.round(targetWidth)),
        height: Math.max(1, Math.round(targetHeight)),
    });
}

property.didReceiveSettings = (data) => {
    const geometry = (data.payload.settings as any).ActionGeometry;
    targetWidth = geometry.width;
    targetHeight = geometry.height;
};
```

Node Action 示例：

```typescript
class CraftAction extends Action {
    sendToPlugin(data: StreamDockEvents.SendToPlugin) {
        if (data.payload.type !== "resize") return;
        const width = Math.max(1, Math.round(Number(data.payload.width)));
        const height = Math.max(1, Math.round(Number(data.payload.height)));
        this.setImage(renderImage(width, height));
        // 不调用 setSettings({ ActionGeometry: ... })。
        // 等 Craft 自动持久化并通过 didReceiveSettings 回传最终尺寸。
    }
}
```

`renderImage(width, height)` 输出的数据必须真的具有这个像素尺寸；只修改 SVG/CSS 的
显示样式或只在 payload 里声称尺寸不会生效。收到 `didReceiveSettings` 前，目标宽高
只是请求值，不能提前当作已经持久化成功。

每个 context 独立保存尺寸、定时器和缓存；不得用最后一次打开 PI 的全局 context
回复消息。

## Node 运行时

### 新版 Craft（默认）

新版 Craft 自带 Node。manifest 使用：

```json
"CodePath": "plugin/index.js",
"Nodejs": { "Version": "20" }
```

后端依赖仍需通过正式 build 打包；软件自带 Node 不代表软件自带 npm dependencies。

### 旧版 Craft（仅按需兼容）

旧版 Craft 没有内置 Node，需要外置 `node.exe` 启动后端。兼容发布必须同时落实：

1. 确定目标旧 Craft 版本接受的 `CodePath` 和启动器形式。
2. 随包提供经许可分发的 Node runtime，或使用明确且可验证的安装路径；不能假定用户
   机器 PATH 中存在 Node。
3. 启动器将 Craft 原始 argv 不丢失地转发给 `plugin/index.js`，并设置正确 cwd。
4. 构建产物、安装目录和卸载范围包含外置 runtime，并在干净机器真实验证。

当前模板的 `script/dev.cjs` 使用本机 `node.exe` 拉起开发产物，只能证明开发流程使用
外置 Node，不能证明旧版 Craft 发布兼容。未完成真实旧版测试时标记为 pending。

## 安装目录与后缀

Craft 使用 `.mPanelPlugin` 和 MiraBox Craft 插件目录，StreamDock 使用 `.sdPlugin`
和 StreamDock 插件目录。构建脚本必须按目标宿主派生后缀和安装位置，不能只修改
`Controllers` 后仍安装到另一个宿主。

模板已内置：`script/target.cjs` 统一解析宿主，`npm run build` 装 StreamDock，
`npm run build:craft` 装 Craft（`dev` / `dev:craft` 同理）。两个宿主产物内容一致，
只是后缀与目录不同。详见 `build-and-debug.md` 第四节。发布前从实际目标版本验证目录。

## PI 与坐标 / 文件选择

PI 初始化仍以 `property.willAppear` 为准。普通 settings、RPC、全局设置沿用统一新版 SDK。**子窗口仅 StreamDock 可用**，Craft 不要调用 `openSubWindows`。需要在 PI 中调整副屏组件 X/Y 或打开原生文件选择时，使用 `MiCoordinate` / `MiPathPicker`（已在组件内部按宿主能力自动降级）；手写 Qt 调用时再加载 `qt-webchannel.md`。Qt bridge 是 Craft 宿主能力，**不要在 StreamDock 端依赖** `window.qt`，也**不要在 Craft 端调子窗口**。
