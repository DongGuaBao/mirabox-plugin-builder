# Property Inspector（PI）开发

PI 是用户点击「编辑某个按键」时弹出的设置面板。新版使用 **Vue 3 SFC**，
通过 `mirabox-plugin-sdk/property` 的 `Property` 类接入。

**如果一个动作没有任何可配置项，就不要 PI**：删掉 `manifest.json` 里该动作的
`PropertyInspectorPath`，并删除对应的 `src/web/front/<action>.vue`。

## 模板结构

```
src/web/
├── front.vue              ← PI 外壳，动态加载 front/<action>.vue（不要修改此文件）
├── main.ts                ← 入口，调用 Property.startProperty(PropertyPage)
└── front/
    └── <action>.vue       ← 每个 action 的 PI 页面（你需要写的）
```

`main.ts` 中启动 PI：

```typescript
import PropertyPage from "./front.vue";
import { Property } from "mirabox-plugin-sdk/property";
Property.startProperty(PropertyPage);
```

## front.vue（外壳）

**此文件不要修改。** 它通过 `import.meta.glob('./front/*.vue')` 动态加载对应 action 的
Vue 组件，根据 `Property.getCurrentActionName()` 路由到正确的 PI 页面。

## 写 PI 页面

每个 action 一个 `.vue` 文件，放在 `src/web/front/<action>.vue`。

```vue
<script setup lang="ts">
    import { Property } from "mirabox-plugin-sdk/property";
    const i18n = window.i18n;
    const property = Property.getReactiveInstance();

    // StreamDock WebSocket 建立且当前 action/settings 初始化完成后触发
    property.willAppear = function (data: StreamDockEvents.DidReceiveSettings) {
        console.log(data.payload.settings);
        // 在这里执行依赖 settings、context 或后端 RPC 的初始化
    };

    // 接收 Plugin 端发来的 settings（回显到表单）
    property.didReceiveSettings = function (data: StreamDockEvents.DidReceiveSettings) {};

    // 接收 Plugin 发来的数据
    property.sendToPropertyInspector = (data) => {};
</script>

<template>
    <div>
        <div>{{ i18n["模板文本"] }}</div>
        <input v-model="property.settings.myField" />
    </div>
</template>

<style scoped></style>
```

## 初始化时机：必须使用 willAppear

**不要用 Vue 的 `onMounted` 作为插件初始化成功信号。** `onMounted` 只保证组件 DOM
完成挂载，不保证 StreamDock WebSocket 已连接，也不保证当前 action、`context`、
settings 或 RPC 通道已经就绪。

```typescript
const property = Property.getReactiveInstance();

property.willAppear = (data: StreamDockEvents.DidReceiveSettings) => {
    // 可安全读取 data.payload.settings，并启动依赖插件连接的初始化
};
```

只把测量 DOM、聚焦输入框等纯界面逻辑放进 `onMounted`。需要调用后端、读取当前
settings 或建立基于当前 action 的状态时，一律等待 `property.willAppear`。

PI 首次收到 `didReceiveSettings` 时触发 `willAppear`，回调参数保留原始事件名。后续更新触发 `didReceiveSettings`。

## Settings 自动持久化

`property.settings` 是 响应式对象。SDK 内部通过 `watch(settings, ..., { deep: true })`
自动调用 `setSettings`，因此 **任何 `v-model` 绑定都会自动保存到 Stream Dock**。

```vue
<input v-model="property.settings.url" />
<!-- 自动持久化 -->
<input v-model="property.settings.volume" />
<!-- 自动持久化 -->
```

`property.globalSettings` 同样是 响应式对象，绑定即自动持久化，跨所有按键共享。

**不需要手动调用 setSettings。**

## 与 Plugin 后端通信

| 方向                    | 方法                                               | 说明                                                  |
| ----------------------- | -------------------------------------------------- | ----------------------------------------------------- |
| PI → Plugin (RPC)       | `property.callPlugin('methodName', ...args)`       | 调用 Plugin 端方法，返回 Promise                      |
| PI → Plugin (RPC Proxy) | `property.getPluginProxy(timeout).methodName(...)` | 等价于 `callPlugin`，可设置超时                       |
| PI → Plugin (消息)      | `property.sendToPlugin(data)`                      | 发送自定义数据，Plugin 端通过 `sendToPlugin` 钩子接收 |
| Plugin → PI (消息)      | `plugin.sendToPropertyInspector(payload)`          | Plugin 端发送                                         |
| Plugin → PI (事件)      | `property.sendToPropertyInspector = (data) => {}`  | PI 端接收                                             |

RPC 示例：

```typescript
// PI 端调用 Plugin 端方法
const result = await property.callPlugin("refreshData", { force: true });
// 或使用带超时的 Proxy
const plugin = property.getPluginProxy(3000);
const result2 = await plugin.refreshData({ force: true });
```

完整的后端方法定义、异常/超时处理和子窗口 API 见 `rpc-and-subwindows.md`。

## 国际化（i18n）

- `window.i18n` 是全局 Proxy，`window.i18n['key']` 访问语言文件中 `Localization` 表的翻译
- **key 不存在时返回 key 本身**（不会显示 undefined）
- 语言文件位于 `language/` 目录（如 `en.json`、`zh_CN.json`）

```json
{
    "Localization": {
        "my-text": "My Text"
    }
}
```

```vue
<div>{{ i18n["my-text"] }}</div>
```

语言文件还负责宿主中的插件名、分类和 Action 名称；Node 后端读取到的数据形状也与 PI
不同。完整结构、翻译脚本与验证流程见 [localization.md](localization.md)。

## 内置模板的表单控件：优先使用 `Mi*` 组件库

**使用本技能内置模板时，已有 `Mi*` 组件能满足需求的布局、表单、按钮和提示，优先直接复用；不要为同一能力另写 `<input>` / `<select>` / `<textarea>`、自制开关或控件样式。** 缺少对应能力时再补充自定义组件。这条复用规则不要求非模板项目迁移控件。SDK 通过
`mirabox-plugin-sdk/ui` 提供成套组件，已处理暗色主题、窄面板防溢出、
StreamDock/Craft 双宿主间距自适应和 205px 紧凑模式。

```typescript
import {
    MiPanel,
    MiSection,
    MiGrid,
    MiField,
    MiTextInput,
    MiTextarea,
    MiNumberInput,
    MiSelect,
    MiSlider,
    MiColorInput,
    MiCheckbox,
    MiSwitch,
    MiCoordinate,
    MiPathPicker,
    MiFilePicker,
    MiButton,
    MiButtonGroup,
    MiHint,
    MiToastHost,
    useToast,
    copyText,
} from "mirabox-plugin-sdk/ui";
```

### 布局

| 组件            | 用途                                       | 关键 props                        |
| --------------- | ------------------------------------------ | --------------------------------- |
| `MiPanel`       | 页面根容器（每个 PI 页面必须有且仅有一个） | —                                 |
| `MiSection`     | 分组区块                                   | `title`                           |
| `MiGrid`        | 1 / 2 列栅格                               | `columns`                         |
| `MiField`       | Label + 控件 + hint/error                  | `label` `hint` `error` `required` |
| `MiHint`        | 独立提示文本                               | `danger`                          |
| `MiButtonGroup` | 按钮横向排列容器                           | —                                 |

### 控件

| 参数性质                 | 组件            | 关键 props                                              |
| ------------------------ | --------------- | ------------------------------------------------------- |
| 文本（URL、消息）        | `MiTextInput`   | `placeholder` `disabled`                                |
| 多行文本                 | `MiTextarea`    | `rows` `maxlength` `resize`                             |
| 数字（间隔、阈值）       | `MiNumberInput` | `min` `max` `step` `suffix`                             |
| 多选一（模式、设备）     | `MiSelect`      | `options`（`string[]` 或 `{label,value,disabled}[]`）   |
| 连续数值（音量、透明度） | `MiSlider`      | `min` `max` `step` `suffix`                             |
| 开关（推荐）             | `MiSwitch`      | `label` `disabled`                                      |
| 复选（多项独立勾选）     | `MiCheckbox`    | `label` `disabled`                                      |
| 颜色                     | `MiColorInput`  | `disabled`                                              |
| X / Y 坐标（Craft）      | `MiCoordinate`  | `labels` `min` `max` `step` `sync`                      |
| 系统文件 / 目录路径      | `MiPathPicker`  | `mode` `accept` `limit` `buttonText`                    |
| 浏览器 File 对象         | `MiFilePicker`  | `accept` `multiple`                                     |
| 按钮                     | `MiButton`      | `variant`（`default` / `primary` / `danger` / `ghost`） |

`MiSwitch` 与 `MiCheckbox` 语义不同：**布尔开关用 `MiSwitch`**，多项独立勾选用
`MiCheckbox`。

### 典型页面

```vue
<template>
    <MiPanel>
        <MiSection :title="i18n['基础设置']">
            <MiField :label="i18n['地址']" :hint="i18n['支持 http 与 https']">
                <MiTextInput v-model="property.settings.url" />
            </MiField>
            <MiGrid :columns="2">
                <MiField :label="i18n['间隔']">
                    <MiNumberInput v-model="property.settings.interval" :min="1" :max="3600" suffix="s" />
                </MiField>
                <MiField :label="i18n['模式']">
                    <MiSelect v-model="property.settings.mode" :options="['auto', 'manual']" />
                </MiField>
            </MiGrid>
            <MiSwitch v-model="property.settings.enabled" :label="i18n['启用']" />
        </MiSection>
        <MiToastHost />
    </MiPanel>
</template>
```

### 坐标输入（Craft）

`MiCoordinate` 把 X/Y 坐标**直接读写到 settings**，不需要写 computed 或 hook。
最简用法连 `v-model` 都不用传，组件自动定位到当前 PI 的 `property.settings`：

```vue
<template>
    <MiField :label="i18n['坐标']">
        <MiCoordinate />
    </MiField>
</template>
```

- 默认读写 `settings.x` / `settings.y`；键名不同时用 `x-key` / `y-key` 覆盖，
  或显式 `v-model="property.settings"` 指定别的 settings 对象。
- 宿主在 `didReceiveSettings` 时会把当前 X/Y 写进 settings，组件自动跟随显示 ——
  **宿主始终是坐标的事实来源**，调用方不写任何同步代码。
- Craft 下方向键微调与组件拖动经 QtWebChannel 同步，已内置（输入框聚焦时不拦截）。
- 非 Craft 环境自动退化为普通 X/Y 数字输入。详见 `qt-webchannel.md`。

### 路径选择

`MiPathPicker` 在 Craft 下调用原生 `openFileSelector` 并通过 `qmlMessage` 拿到
**系统绝对路径**；非 Craft 环境降级为浏览器文件选择（`v-model` 得到文件名，
原始 `File` 通过 `@select` 事件给出）。

```vue
<MiPathPicker v-model="property.settings.imagePath" accept="image/*" />
<MiPathPicker v-model="property.settings.images" mode="files" :limit="10" />
```

### 提示与剪贴板

`useToast()` 提供全局提示，`copyText()` 自带 `execCommand` 降级。使用前需要在
`MiPanel` 内放一个 `MiToastHost`。

```typescript
import { useToast, copyText } from "mirabox-plugin-sdk/ui";
const toast = useToast();

async function copy(text: string) {
    (await copyText(text)) ? toast.success(i18n["已复制"]) : toast.error(i18n["复制失败"]);
}
```

**不要用 `window.alert` / `window.confirm`**，PI 面板里体验很差，用 `toast` 或
`MiHint` 代替。

### 国际化注意

所有面向用户的文案（`label` / `hint` / `buttonText` / `emptyText` / toast 消息）
都必须走 `i18n['key']`，不要写死中文。
