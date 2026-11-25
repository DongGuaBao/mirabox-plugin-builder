# SDK API 参考（mirabox-plugin-sdk）

新版 SDK 以 npm 包 `mirabox-plugin-sdk` 提供，三个入口分别对应不同运行环境。

---

## 一、SDK 三入口

| 入口        | 导入路径                           | 使用场景                                                                   |
| ----------- | ---------------------------------- | -------------------------------------------------------------------------- |
| `/node`     | `mirabox-plugin-sdk/node`     | Node 后端（`src/node/index.ts`），可访问 fs、ws、child_process 等 Node API |
| `/web`      | `mirabox-plugin-sdk/web`      | Web 前端 Plugin（`src/web/`），浏览器环境                                  |
| `/property` | `mirabox-plugin-sdk/property` | Property Inspector（`src/web/`），浏览器环境，Vue 组件                     |

### 宿主环境识别

Node、Web Plugin 入口都导出 `detectHostEnvironment`、`isCraft`、`isStreamDock`；Plugin
实例在 `onStart` 前已设置好 `plugin.environment`、`plugin.isCraft`、
`plugin.isStreamDock`。识别依据是启动参数 `application.version`：主版本 4 及以下按 StreamDock 处理，5 及以上按 Craft 处理。版本缺失或无法解析时按 StreamDock 3 处理。

```typescript
import { Plugin, isCraft } from "mirabox-plugin-sdk/node";

const plugin = Plugin.getInstance();
if (plugin.isCraft) {
    // Craft / SecondaryScreen 逻辑
}

// 在 onStart(argv) 等已有启动参数的位置也可直接判断
if (isCraft(argv)) {
}
```

`plugin.environment` 同时提供 `kind`、`version`、`majorVersion`、`isCraft`、
`isStreamDock`，便于未知新版宿主降级和日志记录。

Craft 的 `ActionGeometry` 由宿主注入并保持为最后一次 `setImage` 图片的实际尺寸。
它不能通过 `setSettings` 修改。PI 改尺寸时使用 `property.sendToPlugin` 请求当前 Node
Action 输出目标尺寸图片；宿主随后自动持久化并用 `didReceiveSettings` 回传最终值。
完整示例见 `craft-support.md`。

---

## 二、Node 端 API

```typescript
import { Plugin, Action, log } from "mirabox-plugin-sdk/node";
```

### Plugin 类（单例）

获取实例：

```typescript
let plugin = Plugin.getInstance();
```

**发送方法**（第一个参数多为 `context`。在 Action 子类中推荐使用 `this.xxx()` 替代，见下方 Action 类文档）：

| 方法                                       | 作用                                                                    |
| ------------------------------------------ | ----------------------------------------------------------------------- |
| `Plugin.startPlugin()`                     | 启动插件，连接 WebSocket                                                |
| `Plugin.getI18n()`                         | 获取 import SDK 时初始化的 `Localization` Proxy；缺失 key 返回 key 本身 |
| `Plugin.enableDeviceModelDiscovery()`      | 开启 StreamDock 设备型号探查；必须在 `startPlugin()` 前调用             |
| `plugin.getDeviceModel(device)`            | 按宿主 device ID 获取探查到的型号；未开启或未匹配时返回 `undefined`     |
| `plugin.setTitle(context, title)`          | 设置按键标题                                                            |
| `plugin.setImage(context, url)`            | 设置按键图片（url 为 base64 或 SVG dataURL）                            |
| `plugin.setState(context, state)`          | 切换多状态动作的状态（0 起始整数）                                      |
| `plugin.setSettings(context, settings)`    | 持久化该按键实例的数据                                                  |
| `plugin.getSettings(context)`              | 请求该按键实例的数据（结果走 `didReceiveSettings`）                     |
| `plugin.setGlobalSettings(settings)`       | 持久化全局数据                                                          |
| `plugin.getGlobalSettings()`               | 请求全局数据（结果走 `didReceiveGlobalSettings`）                       |
| `plugin.sendToPropertyInspector(payload)`  | 给当前打开的 PI 发送数据                                                |
| `plugin.openUrl(url)`                      | 默认浏览器打开网址                                                      |
| `plugin.showAlert(context)`                | 按键上显示临时警告图标                                                  |
| `plugin.showOk(context)`                   | 按键上显示临时 OK 图标                                                  |
| `plugin.regActionClass(name, ActionClass)` | 注册 Action 类                                                          |

### Action 类

代表一种动作（一类按键）。**挂在 `plugin.action` 上的 key 必须等于 action UUID 的最后一段。**

#### 可选设备型号探查（StreamDock Node / Web Plugin）

宿主的 `willAppear.device` 是 `md5(型号名 + 序列号)`，默认无法直接知道硬件型号。需要按型号
适配布局或能力时，在 `startPlugin()` 前显式开启：

```typescript
Plugin.enableDeviceModelDiscovery();

class MyAction extends Action {
    willAppear(data: StreamDockEvents.WillAppear): void {
        console.log(this.deviceModel); // 例如 "H1Pro"，无法识别时为 undefined
        console.log(data.deviceModel); // 同一个结果
    }
}

Plugin.startPlugin();
```

Node SDK 启动时读取 `%APPDATA%/HotSpot/StreamDock/config/StreamDockConfig.ini`；Web Plugin
使用宿主定制 CEF 的本地文件访问能力，在连接前执行
`fetch("../../config/StreamDockConfig.ini")`。两者都解析文件中的
`[StreamDockCurrentDevice]` section，只解析 `<型号>\\SerialNumber=<序列号>`，以 UTF-8
计算小写 MD5 并建立映射。读取失败、section 不存在或 device 未匹配都不会阻止插件启动。
便携版或测试可传 `{ configPath }` 覆盖 Node 文件路径或 Web 相对 URL。未调用启用方法时不会读取文件。

两种注册方式：

```typescript
// 方式一：属性赋值（简洁，适合匿名类）
plugin.action["action1"] = class extends Action {
    willAppear(data: StreamDockEvents.WillAppear): void {
        // 按键出现时初始化
    }
};

// 方式二：方法注册（适合命名类，可复用）
class MyAction extends Action {
    willAppear(data: StreamDockEvents.WillAppear): void {
        log.info("action appeared");
    }
    keyUp(data: StreamDockEvents.KeyUp): void {
        // 用户点击按键，使用 this.setImage() 等方法操作当前按键
        this.setTitle("Hello");
    }
}
plugin.regActionClass("action1", MyAction);
```

**生命周期钩子**（全部可选，按需声明）：

| 钩子                                  | 触发时机                                          |
| ------------------------------------- | ------------------------------------------------- |
| `willAppear(data)`                    | 按键实例出现在设备上                              |
| `willDisappear(data)`                 | 按键实例从设备上移除                              |
| `keyDown(data)`                       | 用户按下按键                                      |
| `keyUp(data)`                         | 用户释放按键（"点击"通常用这个）                  |
| `dialRotate(data)`                    | 旋转旋钮（`data.payload.ticks` 正=顺时针）        |
| `dialDown(data)`                      | 按下旋钮                                          |
| `dialUp(data)`                        | 松开旋钮                                          |
| `touchTap(data)`                      | 点触旋钮上方小屏                                  |
| `didReceiveSettings(data)`            | settings 变更后收到通知                           |
| `touchEvent(data)` | Card 触点的按下、移动、抬起或取消 |
| `titleParametersDidChange(data)` | 用户调整标题或标题样式 |
| `sendToPlugin(data)`                  | PI 发来数据（非 RPC）                             |
| `propertyInspectorDidAppear(data)`    | 用户打开了 PI 配置页                              |
| `propertyInspectorDidDisappear(data)` | PI 配置页关闭                                     |

**重要：** SDK 内部用 `_` 前缀方法（`_willAppear`、`_keyDown` 等）做拦截转发。
业务代码**直接声明不带 `_` 前缀的同名方法**即可，不要触碰 `_` 前缀方法。

**Action 实例方法**（自动处理 context，无需手动传入）：

| 方法                                    | 等价于                                    |
| --------------------------------------- | ----------------------------------------- |
| `this.setTitle(str)`                    | `plugin.setTitle(this.context, str)`      |
| `this.setImage(url)`                    | `plugin.setImage(this.context, url)`      |
| `this.setState(state)`                  | `plugin.setState(this.context, state)`    |
| `this.setSettings(obj)`                 | `plugin.setSettings(this.context, obj)`   |
| `this.saveSettings()`                   | `this.setSettings(this.settings)`         |
| `this.showAlert()`                      | `plugin.showAlert(this.context)`          |
| `this.showOk()`                         | `plugin.showOk(this.context)`             |
| `this.sendToPropertyInspector(payload)` | 向本实例的 action UUID 和 context 发送，适用于异步回复 |

> **推荐在 Action 子类中使用 `this.xxx()`**，更简洁且不易写错 context。
> 全局设置的回调写在 Plugin 的 `didReceiveGlobalSettings` 或 PI 的 `property.didReceiveGlobalSettings` 上。
>
> 插件级 API（`openUrl`、`setGlobalSettings`、`getGlobalSettings`）仍通过 `plugin.xxx()` 调用。

**Action 实例属性：**

| 属性            | 含义                                                        |
| --------------- | ----------------------------------------------------------- |
| `this.settings` | 当前按键实例的持久化设置（`didReceiveSettings` 后自动更新） |
| `this.context`  | 当前按键实例的唯一标识符                                    |
| `this.device`   | 设备标识符                                                  |

### Control Bar / Card
业务代码统一读取 `this.actionType`：Control Bar 为 `touchBar`，卡片为 `Card`，普通按键为 `Keypad`，旋钮为 `Knob`。不要读取或缓存 `payload.controller` 来分类；SDK 在公开 `willAppear` 前已完成分类。

Node 和 Web 后端从 `mirabox-plugin-sdk/node`、`mirabox-plugin-sdk/web` 导入 Action 和 ActionSettings。SDKVersion 3 的绘图尺寸取自事件的 `payload.width` 和 `payload.height`。在尺寸发生变化时重绘。Mira75 的 Card 处理 `touchTap` 的 `tapPos`、`hold`；其他支持触摸的 Card 处理 `touchEvent` 的 `phase`、`position`、`startPosition`、`delta` 和 `touchId`。

仅当旧宿主未下发实际尺寸时，才使用旧设备的尺寸约定：Keypad 和普通 Knob 为 144×144，N4 系列 Knob 为 176×112，Control Bar 为 `settings.touchbarWidth × 66`，Card 使用已有的 `settings.touchbarWidth × settings.touchbarHeight`。Card 缺少有效尺寸时等待宿主通知。

StreamDock 后端提供 `plugin.switchToProfile(device, profile?, page?)`、`action.triggerKey(keyList)`；PI 和后端均可用 `getSettings()` 与 `logMessage(text)`。Craft 画布使用 `settings.ActionGeometry`，支持 `await action.setImageBlob(bytesOrBlob, mime?)`、原始像素 `action.setImageRGBA(imageData, width, height)` 与屏幕级 `plugin.lightControl(options)`。RGBA 输入使用逐行排列的 Uint8Array 或 Uint8ClampedArray，字节数等于 width × height × 4。Node Buffer 也可直接传入。Action 的 `sendToPropertyInspector` 始终回复该实例。

### log

SDK 内置文件日志器，写到 `plugin/log/<日期>.log`：

```typescript
log.info("msg", obj);
log.error("err", e);
log.warn("msg");
```

---

## 三、Web 端 Plugin API

```typescript
import { Plugin, Action } from "mirabox-plugin-sdk/web";
```

API 与 Node 端一致（同 `BasePlugin` / `Action` 基类），区别在于：

- 运行在浏览器环境，不能使用 Node API
- 通过 `Plugin.startPlugin()` 启动

---

## 四、Property Inspector API

```typescript
import { Property } from "mirabox-plugin-sdk/property";
```

### 启动与实例

| 方法/属性                              | 作用                                                            |
| -------------------------------------- | --------------------------------------------------------------- |
| `Property.startProperty(VueComponent)` | 启动 Property Inspector，注册 Vue 根组件（在 `main.ts` 中调用） |
| `Property.getReactiveInstance()`       | 获取响应式 PI 实例（在 `<script setup>` 中调用）                |

响应式 `property` 同样提供 `environment`、`isCraft`、`isStreamDock`。这些值在
`property.willAppear` 前已经根据启动参数完成设置。

### 数据绑定

| 属性                      | 类型    | 说明                                                     |
| ------------------------- | ------- | -------------------------------------------------------- |
| `property.settings`       | 响应式对象 | 当前按键设置，**`v-model` 绑定即自动持久化**             |
| `property.globalSettings` | 响应式对象 | 全局设置，**`v-model` 绑定即自动持久化**，跨所有按键共享 |

### 与 Plugin 通信

| 方法                                     | 说明                                              |
| ---------------------------------------- | ------------------------------------------------- |
| `property.callPlugin('method', ...args)` | RPC 调用 Plugin 端方法，返回 Promise              |
| `property.getPluginProxy(timeout?)`      | Plugin 端 RPC Proxy；可选的毫秒超时应用于每次调用 |
| `property.sendToPlugin(data)`            | 发送自定义消息到 Plugin（非 RPC）                 |

### 事件接收

在 Vue 组件中直接赋值处理函数：

```typescript
property.didReceiveSettings = function (data: StreamDockEvents.DidReceiveSettings) {
    // settings 变更回调
};
property.sendToPropertyInspector = (data) => {
    // Plugin 发来的数据
};
```

### 其他

| 方法                                                        | 说明                                       |
| ----------------------------------------------------------- | ------------------------------------------ |
| `Property.getCurrentActionName()`                           | 返回当前 action 名称（UUID 最后一段）      |
| `property.openSubWindows(name, width, height, left?, top?)` | 打开 `front/<name>.vue` 子窗口             |
| `property.closeSubWindow(idOrName)`                         | 按唯一 ID 关闭；找不到 ID 时按名称批量关闭 |
| `property.closeSubWindowsByName(name)`                      | 关闭指定名称的全部子窗口                   |
| `property.getSubWindow(id)` / `getSubWindows()`             | 读取子窗口状态快照                         |

PI 的连接初始化必须使用 `property.willAppear`，不能使用 Vue `onMounted` 代替。
RPC 与子窗口的完整示例见 `rpc-and-subwindows.md`。

Craft PI 坐标与文件选择推荐直接用 `MiCoordinate` / `MiPathPicker` 组件（见
`property-inspector.md`）。需要底层通道时从同一入口导入单例：

```typescript
import { Property, getCraftQtChannel } from "mirabox-plugin-sdk/property";

const property = Property.getReactiveInstance();
property.willAppear = () => {
    if (!property.isCraft) return;
    const qt = getCraftQtChannel(); // 自动检测 + 单例复用，无 Qt transport 时返回 null
};
```

---

## 四点五、Property Inspector UI 组件库

```typescript
import { MiPanel, MiField, MiTextInput, useToast } from "mirabox-plugin-sdk/ui";
```

布局 `MiPanel` `MiSection` `MiGrid` `MiField` `MiHint` `MiButtonGroup`；
控件 `MiTextInput` `MiTextarea` `MiNumberInput` `MiSelect` `MiSlider`
`MiSwitch` `MiCheckbox` `MiColorInput` `MiCoordinate` `MiPathPicker`
`MiFilePicker` `MiButton`；反馈 `MiToastHost` + `useToast()` / `copyText()`。

**PI 一律使用这些组件，不要手写原生 `<input>` / `<select>` / `<textarea>`。**
完整 props 与用法见 `property-inspector.md`。

---

## 五、通用类型

```typescript
import type {} from "mirabox-plugin-sdk/types";
```

此 import 扩展全局类型：

- `Window` 接口：`window.i18n`（i18n Proxy）、`window.argv`（启动参数）
- `StreamDockEvents` 命名空间：`WillAppear`、`KeyUp`、`DidReceiveSettings` 等事件类型
