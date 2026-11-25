# 交付前自查清单

完成插件后逐项核对。

## 命名与结构

- [ ] 插件目录的反向域名主体小写；StreamDock 后缀为 `.sdPlugin`，Craft 为 `.mPanelPlugin`，后缀大小写准确
- [ ] 每个 action 的 `UUID` 唯一，且以插件 ID 为前缀
- [ ] 每个 `plugin.action["x"]` 或 `plugin.regActionClass("x", ...)` 的 `x` = 对应 action UUID 的最后一段
- [ ] 每个有 PI 的 action：`PropertyInspectorPath` 指向真实存在的 HTML（通常为 `"index.html"`）
- [ ] `src/web/front/<action>.vue` 文件名与 UUID 最后一段一致
- [ ] `public/images/` 里的图标文件真实存在，`manifest` 路径都能对上

## manifest

- [ ] `CodePathWin` / `CodePathMac`（或 `CodePath`）指向 `plugin/index.js`
- [ ] 用内置 Node 则有 `Nodejs: { "Version": "20" }`
- [ ] 每个 action 至少 1 个 `States`
- [ ] **打包给 Craft 时：每个 action 的 `Settings` 都含 `ActionGeometry: { width, height }`**（拖出时的默认尺寸，逐个 action 都要写；StreamDock 忽略此字段）

## 后端 plugin/index.js

- [ ] Action 类直接声明 `willAppear`/`keyUp` 等钩子（不要用 `_` 前缀——那是 SDK 内部方法）
- [ ] 若依赖具体 StreamDock 型号，在 `startPlugin()` 前调用 `Plugin.enableDeviceModelDiscovery()`，并处理 `deviceModel` 为 `undefined`
- [ ] 改了普通 settings 的地方调用了 `plugin.setSettings(context, this.settings)` 持久化；Craft `ActionGeometry` 除外
- [ ] 异常有 `try/catch` 或错误回调，失败时 `plugin.showAlert(context)`
- [ ] 用 SVG 时只用 SVG Tiny 1.2 支持的特性；颜色用 `rgb()`/颜色名，不用 `#`
- [ ] SDKVersion 3 优先使用事件中的实际宽高；旧版普通 Keypad 为 144×144；Knob 默认 144×144，开启设备探查且 `deviceModel?.includes("N4")` 时为 176×112；Control Bar / Card 按各自尺寸规则绘制
- [ ] Craft action 使用 `SecondaryScreen`，每次按最新 `ActionGeometry` 渲染，没有固定 144×144
- [ ] Craft 输出尺寸由插件决定；`ActionGeometry` 采用宿主回填值，并与最后输出图片实际宽高一致
- [ ] PI 改尺寸使用 `sendToPlugin`，Node Action 输出目标尺寸图片，再等待宿主 `didReceiveSettings` 确认自动持久化结果

- [ ] Control Bar / Card 在公开 `willAppear` 与 `didReceiveSettings` 中按 touchbar 宽高重绘整图
- [ ] Control Bar 高度为 66；类型判断使用 `this.actionType` 的 `Keypad` / `touchBar` / `Card` / `Knob`，不读取 controller 或通过尺寸字段推断
- [ ] StreamDock 卡片 Controller 写为 `Card`，Mira75 处理 `touchTap`，其他触摸卡片处理 `touchEvent`，不实现 `keyDown/keyUp`
- [ ] Card 的 `tapPos/hold/resources` 按可选字段处理，未使用 Craft ActionGeometry 作为卡片尺寸

## Property Inspector

- [ ] 使用内置模板时，已有能力优先使用 SDK 的 `Mi*` 布局和控件；仅为组件库未覆盖的需求补充自定义组件，不要求非模板项目迁移

- [ ] `Property.getReactiveInstance()` 正确获取响应式实例
- [ ] 依赖连接、settings、context 或 RPC 的初始化使用 `property.willAppear`，没有把 Vue `onMounted` 当作插件初始化成功
- [ ] 普通表单控件使用 `v-model="property.settings.xxx"` 绑定（自动持久化）；Craft 尺寸输入除外
- [ ] PI ↔ 后端通信使用 `property.callPlugin()` / `property.sendToPlugin()` / `property.sendToPropertyInspector`
- [ ] RPC 使用 `try/catch`，需要时通过 `getPluginProxy(timeout)` 设置有限超时
- [ ] 子窗口文件位于 `src/web/front/<name>.vue`，并验证按 ID/名称关闭及共享状态符合预期
- [ ] Craft 坐标功能只在 `window.qt?.webChannelTransport` 可用时初始化

## 语言文件

- [ ] `zh_CN.json` 与 `en.json` 均存在，三类字段（`Localization`、顶层插件字段、Action 字段）已填写
- [ ] 每个语言文件里的 action key = 真实 action UUID
- [ ] PI、子窗口和后端中所有用户可见文案均通过 i18n 获取，没有写死中文

## 构建与运行

- [ ] 使用内置模板时，特殊打包行为优先扩展原 `script/build.cjs` 及配套入口；若确实替换，已按实际模板核对版本号、默认构建、`-web` / `-node` / `-native` 及组合、宿主参数、输出与安装等全部语义并验证；本项不要求非模板项目改造

- [ ] `npm install` 成功
- [ ] 使用内置模板时，Node 后端仍由 TypeScript → ncc 打包，未引入其他后端打包器；每个 external 都有实际无法由 ncc 正确处理的依据，必要文件已随包复制，并在最终安装目录验证加载；原有 Vite 前端构建保留
- [ ] `npm run build` 成功，生成了 `build/vite_build/` + `build/ncc_build/`
- [ ] `plugin/log/` 里没有未处理异常
