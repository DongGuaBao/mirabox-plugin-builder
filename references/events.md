# 事件参考

普通事件使用 JSON；Craft 的 setImageBlob 和 setImageRGBA 使用带 JSON 头部的二进制帧。两个方向：**收到的事件**（软件 → 插件/PI）和
**发送的事件**（插件/PI → 软件）。

---

## 一、插件后端收到的事件

所有事件公共字段：`event`、多数还有 `action`、`context`。
Node/Web 端在 Action 子类中声明同名方法即可接收；PI 端在 Vue 组件中赋值处理函数。
发送事件使用 SDK 封装的方法（`plugin.setImage()` 等），通常不需要手动拼 JSON。

### 生命周期

| 事件                       | 触发时机               | payload 关键字段                                     |
| -------------------------- | ---------------------- | ---------------------------------------------------- |
| `willAppear`               | 动作实例出现在设备上   | `settings`、`coordinates {column,row}`、`controller` |
| `willDisappear`            | 动作实例从设备上移除   | 同上                                                 |
| `titleParametersDidChange` | 用户改了标题或标题样式 | `title`、`titleParameters`                           |

### 输入 — 普通按键

| 事件      | 触发时机                     | payload 关键字段                                       |
| --------- | ---------------------------- | ------------------------------------------------------ |
| `keyDown` | 按下按键                     | `settings`、`coordinates`、`state`、`userDesiredState` |
| `keyUp`   | 松开按键（"点击"通常用这个） | 同上                                                   |

普通按键事件也适用于 Control Bar（`Keypad`），但不适用于 `Card`。

### 输入 — StreamDock 卡片（Card）

| 事件       | 触发时机 | payload 关键字段                                                                                                                          |
| ---------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `touchTap` | Mira75 Card 点击或长按 | `tapPos`、`hold`、`width`、`height` |
| `touchEvent` | 其他 Card 的触点变化 | `phase`、`position`、`startPosition`、`delta`、`touchId`、`width`、`height` |

### 输入 — 旋钮 / 触摸屏（Knob/Encoder）

| 事件         | 触发时机         | payload 关键字段                                             |
| ------------ | ---------------- | ------------------------------------------------------------ |
| `dialDown`   | 按下旋钮         | `settings`、`controller`                                     |
| `dialUp`     | 松开旋钮         | 同上                                                         |
| `dialRotate` | 旋转旋钮         | `ticks`（正=顺时针，负=逆时针）、`pressed`（旋转时是否按住） |
| `touchTap`   | 点触旋钮上方小屏 | `tapPos [x,y]`、`hold`（是否长按）                           |

### 设置

| 事件                       | 触发时机                                           | payload 关键字段          |
| -------------------------- | -------------------------------------------------- | ------------------------- |
| `didReceiveSettings`       | 该动作实例的 settings 变化后                       | `settings`、`coordinates` |
| `didReceiveGlobalSettings` | 全局 settings 变化后 / 主动 `getGlobalSettings` 后 | `settings`                |

SDKVersion 3 使用事件 payload.width / height，按每个实例的最新尺寸重绘。旧版本的 Control Bar 和 Card 可能通过 settings.touchbarWidth / touchbarHeight 下发尺寸。

### Property Inspector 相关

| 事件                            | 触发时机                        | payload     |
| ------------------------------- | ------------------------------- | ----------- |
| `propertyInspectorDidAppear`    | 用户打开了某动作的配置页        | —           |
| `propertyInspectorDidDisappear` | 配置页关闭                      | —           |
| `sendToPlugin`                  | PI 调用 `sendToPlugin` 发来数据 | 自定义 JSON |

### 设备 / 系统

| 事件                      | 触发时机         | payload 关键字段              |
| ------------------------- | ---------------- | ----------------------------- |
| `deviceDidConnect`        | 接入设备         | `deviceInfo {name,type,size}` |
| `deviceDidDisconnect`     | 移除设备         | —                             |
| `applicationDidLaunch`    | 被监听的应用启动 | `payload.application`         |
| `applicationDidTerminate` | 被监听的应用退出 | `payload.application`         |
| `systemDidWakeUp`         | 电脑唤醒         | —                             |

---

## 二、插件后端发送的事件

模板的 `Plugins` 实例已封装成方法（见 `sdk-api.md`），下面给出底层 JSON。

| 事件                      | 作用                   | JSON                                           |
| ------------------------- | ---------------------- | ---------------------------------------------- |
| `setTitle`                | 改按键标题             | `{event,context,payload:{title,target,state}}` |
| `setImage`                | 改按键图标             | `{event,context,payload:{image,target,state}}` |
| `setState`                | 切换多状态动作的状态   | `{event,context,payload:{state}}`              |
| `showAlert`               | 按键上闪「⚠」          | `{event,context}`                              |
| `showOk`                  | 按键上闪「✓」          | `{event,context}`                              |
| `setSettings`             | 持久化该动作实例的数据 | `{event,context,payload:{...}}`                |
| `getSettings`             | 请求该动作实例的数据   | `{event,context}`                              |
| `switchToProfile` | StreamDock 切换配置 | `plugin.switchToProfile(device, profile?, page?)` |
| `triggerKey` | StreamDock 超级热键 | `action.triggerKey(keyList)` |
| `setImageBlob` | Craft 已编码图片 | `await action.setImageBlob(blobOrBytes, mime?)`，二进制帧头的 event 为 setImage |
| `setImageRGBA` | Craft 原始 RGBA8 图像 | `action.setImageRGBA(bytes, width, height)` |
| `lightControl` | Craft 全屏告警 | `plugin.lightControl({ active: false })` 关闭告警 |
| `setGlobalSettings`       | 持久化全局数据         | `{event,context,payload:{...}}`                |
| `getGlobalSettings`       | 请求全局数据           | `{event,context}`                              |
| `sendToPropertyInspector` | 给 PI 发数据           | `{event,action,context,payload:{...}}`         |
| `openUrl`                 | 默认浏览器打开网址     | `{event,payload:{url}}`                        |
| `logMessage`              | 写一条调试日志         | `{event,payload:{message}}`                    |

---

StreamDock 全局设置命令携带 context，Craft 的 `setGlobalSettings` 和 `getGlobalSettings` 省略 context。

## 三、Property Inspector 收发的事件

**PI 收到**（在 Vue 组件中赋值处理函数）：

| 事件                       | 处理方式                                           |
| -------------------------- | -------------------------------------------------- |
| `didReceiveSettings`       | `property.didReceiveSettings = (data) => {}`       |
| `didReceiveGlobalSettings` | `property.didReceiveGlobalSettings = (data) => {}` |
| `sendToPropertyInspector`  | `property.sendToPropertyInspector = (data) => {}`  |

**PI 发送**（使用 SDK 封装方法，不需要手动拼 JSON）：

| 事件                                      | 方法                                                         |
| ----------------------------------------- | ------------------------------------------------------------ |
| `getSettings` / `logMessage` | StreamDock 使用 `property.getSettings()`、`property.logMessage(text)` |
| `setSettings`                             | `v-model="property.settings.xxx"` 自动触发，无需手动调用     |
| `setGlobalSettings` / `getGlobalSettings` | `property.setGlobalSettings(data)`、`property.getGlobalSettings()`，响应式修改也会保存 |
| `sendToPlugin`                            | `property.sendToPlugin(data)`                                |
| `openUrl`                                 | `property.openUrl(url)` |

---

## 图像格式说明

`setImage` 的 `image` 接受：

- Base64 dataURL：`data:image/png;base64,...`
- SVG dataURL：`data:image/svg+xml;charset=utf8,${svg}` （推荐，省去打包图片）

优先使用 SDKVersion 3 事件中的实际尺寸。以下是旧版回退：StreamDock 普通按键为 144×144；Knob 默认 144×144，开启设备探查且 `deviceModel?.includes("N4")` 时为 176×112。Control Bar 为 `touchbarWidth × 66`，Card 为 `touchbarWidth × touchbarHeight`。
Craft 输出尺寸由插件决定，宿主将最后输出图片的实际宽高回填到 `ActionGeometry`。读取该值恢复尺寸；改尺寸通过后端输出目标尺寸图片，不直接 setSettings 修改它。
