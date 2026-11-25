# RPC 与 Property Inspector 子窗口

本页以新版 `templates/src/web/front/action1.vue`、`front/sub.vue` 和
`src/node/index.ts` 为准。涉及 RPC 或子窗口时读取本页。

## RPC：PI 调用当前 Action 后端方法

把可调用方法定义为当前 Node/Web `Action` 类的公开方法。SDK 会把 RPC 路由到当前
`context` 对应的 Action 实例，因此方法可直接访问 `this.settings`、`this.context` 等。

```typescript
// src/node/index.ts
import { Plugin, Action, log } from "mirabox-plugin-sdk/node";
import fs from "fs";

class Action1 extends Action {
    readFileText(path: string): string {
        log.info("读取", path);
        return fs.readFileSync(path, "utf-8");
    }
}

Plugin.getInstance().regActionClass("action1", Action1);
Plugin.startPlugin();
```

PI 必须等 `property.willAppear` 后再发起依赖连接的调用。直接调用可用
`callPlugin(method, ...args)`；连续或多次调用推荐复用 Proxy，并设置有限超时。

```typescript
// src/web/front/action1.vue
import { Property } from "mirabox-plugin-sdk/property";

const property = Property.getReactiveInstance();
let plugin: any;

property.willAppear = () => {
    plugin = property.getPluginProxy(3000);
};

async function loadText() {
    try {
        const text = await plugin.readFileText("C:\\Temp\\example.txt");
        console.log(text);
        // 等价：await property.callPlugin("readFileText", path)
    } catch (error) {
        console.error("RPC 调用失败或超时", error);
    }
}
```

- RPC 参数和返回值应可通过消息通道传输；优先使用 JSON 可序列化数据。
- 后端方法可同步返回，也可返回 Promise；异常会令 PI 端 Promise reject。
- `getPluginProxy(timeout)` 的 `timeout` 单位是毫秒；不传则没有超时。用户操作触发的
  RPC 应设置合理的有限超时并用 `try/catch` 反馈失败。
- RPC 协议消息由 SDK 消费，不要同时在普通 `sendToPlugin` 处理器中重复解析。
- 单向通知、不需要返回值时使用 `sendToPlugin` / `sendToPropertyInspector`，不要滥用 RPC。

## 子窗口（仅 StreamDock）

> **Craft (`5.*`) 宿主不支持 PI 子窗口。** 调用 `openSubWindows` 前必须判断
> `property.isStreamDock`；Craft 下需要承载更多设置时，改用同一 PI 内的
> `MiSection` 分区 / 条件渲染，不要弹窗。宿主能力差异见 `craft-support.md`。

```typescript
if (!property.isStreamDock) return; // Craft 不支持子窗口
const info = property.openSubWindows("sub", 600, 600);
```

`openSubWindows(name, ...)` 会通过同一个 `index.html` 加载
`src/web/front/<name>.vue`。因此 `openSubWindows("sub", 600, 600)` 要求存在
`src/web/front/sub.vue`。`name` 只能来自插件内受控的组件名，不要把用户输入直接当作
组件名。

```typescript
const info = property.openSubWindows("sub", 600, 600);
console.log(info.id, info.name, info.openedAt);

property.closeSubWindow(info.id);       // 精确关闭一个
property.closeSubWindowsByName("sub"); // 关闭所有同名窗口
property.getSubWindow(info.id);         // 单个状态快照
property.getSubWindows();               // 全部状态快照
```

可选的 `left`、`top` 用于指定位置；省略时居中。SDK 会结合
`window.devicePixelRatio` 计算弹窗尺寸。

## 主窗口与子窗口共享状态

子窗口调用 `Property.getReactiveInstance()` 时会代理到主窗口的同一个响应式
`property`。因此 settings、自定义字段和挂载在 `property` 上的函数可跨窗口共享。

```typescript
// 主窗口 action1.vue
property.submessage = "来自主窗口";
property.onChildReady = () => console.log("子窗口已启动");

// 子窗口 sub.vue
const property = Property.getReactiveInstance();
property.onChildReady?.();
console.log(property.submessage);
console.log(property.currentSubWindowId);
property.closeSubWindow(property.currentSubWindowId);
```

- 子窗口的 `property.currentSubWindowId` 是自身唯一 ID；主窗口值为 `"main"`。
- `v-model="property.settings.xxx"` 在主、子窗口间共享并继续自动持久化。
- 在主窗口上先声明子窗口要调用的字段/函数，避免打开时序造成 `undefined`。
- 主窗口销毁或 PI 关闭时不要假定弹窗仍可用；调用共享函数前做存在性检查。
