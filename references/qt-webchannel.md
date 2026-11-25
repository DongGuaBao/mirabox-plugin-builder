# Craft QtWebChannel 适配（仅 Craft 宿主可用）

> **StreamDock (`3.*` / `4.*`) 宿主没有 `window.qt`**,本文件描述的 API 在普通
> StreamDock PI 里全部不可用。用 `MiCoordinate` / `MiPathPicker` 组件时它们已内部
> 自动降级,你不需要判断宿主;**手写底层 Qt 调用时必须判空或判 `property.isCraft`**。
> 跨宿主能力矩阵见 `craft-support.md`。

QtWebChannel 已融合进 `mirabox-plugin-sdk/property`,提供:

- 坐标交互:`channelqtObject.sigDidReceiveCoordinate` / `uDidReceiveCoordinate(x, y)`
- 文件选择:`openFileSelector(context, multiple, limit)` + `qmlMessage(key, filePath)` 回传

**绝大多数需求无需直接接触 QtWebChannel**:

- 坐标用 `MiCoordinate` 组件(自动绑定、方向键微调、内部消化)
- 文件 / 路径用 `MiPathPicker` 组件(自动调用 `openFileSelector`、异步回传)
- 只有在不规则场景(自定义 UI 调坐标、多个选择通道并存)才用底层 API

## 为什么 SDK 不在导入时立即初始化

QWebChannel 会独占 `transport.onmessage`。旧实现 `new QWebChannel(...)` 写在模块顶层,
会在普通 StreamDock PI、浏览器调试页和 Node 后端抛错;**新 SDK 用单例 + 惰性探测**:

```typescript
import { getCraftQtChannel, hasCraftQtChannel, resetCraftQtChannel } from "mirabox-plugin-sdk/property";

if (hasCraftQtChannel()) {
    const qt = getCraftQtChannel(); // 首次调用自动创建,后续复用同一实例
    await qt.waitUtilInit();
    // 任何地方再调用 getCraftQtChannel() 拿到的都是同一个 store
}
```

- 仅在 `window.qt.webChannelTransport` 存在时才真正构造 QWebChannel;
- 同一页面多次 `getCraftQtChannel()` 永远返回同一实例(避免 `onmessage` 互相覆盖);
- `resetCraftQtChannel()` 仅供测试使用。

## 直接使用 QtWebChannelStore

**优先用 `MiCoordinate`**(直接 `<MiCoordinate />`,不用传 v-model,坐标由 SDK 内部
维护并直接读写 settings)。只有在 UI 无法套 `MiCoordinate` 时(例如要在 `<svg>` 里
实时跟随坐标)才手动用 store:

```typescript
import { getCraftQtChannel } from "mirabox-plugin-sdk/property";

const property = Property.getReactiveInstance();
let qt: QtWebChannelStore | null = null;

property.willAppear = (data) => {
    if (!property.isCraft) return;
    qt = getCraftQtChannel();
    const settings = data.payload.settings as any;
    qt?.setLocalCoordinate(Math.round(Number(settings.x) || 0), Math.round(Number(settings.y) || 0));
};

function moveTo(x: number, y: number) {
    qt?.setCoordinate(x, y);
}
```

## 文件选择 (openFileSelector)

```typescript
const qt = getCraftQtChannel();
const off = qt!.onFileSelected((selection) => {
    // selection.context  ← 与打开时传入的 context 匹配,避免串按键
    // selection.paths    ← 解析后的绝对路径数组(JSON 解析失败时退化为 [raw])
    // selection.raw      ← Craft 回传的原始字符串
});
property.willAppear = () => {
    if (!qt) return;
    qt.openFileSelector(window.argv[1], false, 1); // 单选
    // 或 qt.openFileSelector(window.argv[1], true, 10); 多选上限 10
};
onBeforeUnmount(off);
```

`setCoordinate` / `openFileSelector` / `deleteFile` 都会在 qtObject 未就绪时
安全返回 `false`/`null`,不会出现 `Cannot read property of undefined`。
