## 模板结构

```
com.mirabox.streamdock.templates.sdPlugin/
├── manifest.json
├── language/
│   └── en.json, zh_CN.json, ...
├── public/                        # 图标等静态资源
├── script/
│   ├── build.cjs                  # 构建 + 自动安装脚本
│   ├── target.cjs                 # 宿主解析（StreamDock / Craft 后缀与路径）
│   ├── dev.cjs                    # 开发模式脚本
│   └── translate.cjs              # 语言本地化脚本
├── src/
│   ├── node/
│   │   └── index.ts               # Node 后端入口
│   ├── share/                     # 共享的typescript类型文件
│   └── web/
│       ├── index.html             # 前端入口 HTML
│       ├── main.ts                # Vue 入口（Property/Plugin 启动）
│       ├── front.vue              # PI 动态组件外壳（勿改）
│       ├── backend/
│       │   └── action1.ts         # Web后端的Action 类定义和实现
│       └── front/
│           └── action1.vue        # 单个 action 的 PI 配置页面
├── tsconfig.json / tsconfig.node.json / tsconfig.web.json / tsconfig.ncc.json
└── vite.config.ts
```

## 开发流程

新建插件按下列流程进行；修改已有插件只执行相关步骤，构建与安装遵循用户要求。

### Step 1 — 厘清需求

按下表核对相关需求；信息不足且影响实现时才向用户提问，能合理默认的就默认并说明：

| 问题                                                   | 影响                                       |
| ------------------------------------------------------ | ------------------------------------------ |
| 触发的硬件是什么？普通按键 / 旋钮(Knob) / 触摸屏       | `manifest` 的 `Controllers`、用哪些事件    |
| 按下后做什么？运行程序 / 命令 / HTTP / 快捷键 / 开网页 | 后端 `keyUp` 逻辑                          |
| 按键上要显示什么？静态图标 / 动态数字 / 动态图         | 是否用 `setImage`/`setTitle`、是否要定时器 |
| 用户需要配置什么？（会变成 Property Inspector 的表单） | PI 的表单项 + `settings` 字段              |
| 需要几个 action（按键类型）？                          | `manifest.Actions` 数组长度                |
| 要不要多语言、要不要轮询/定时刷新？                    | 语言文件、`setInterval`                    |
| 是否为 Craft、默认画布多大、是否允许缩放？             | `SecondaryScreen`、`ActionGeometry`        |
| 是否兼容没有内置 Node 的旧版 Craft？                   | 内置 Node 或外置 `node.exe` 启动方式       |

### Step 2 — 复制模板并命名

1. 复制本 Skill 的 `assets/plugin-template/` 到项目目录，保留 `vendor/` 中的 SDK 发行包和 package-lock.json。使用翻译功能时，可从 .env.example 创建本地 .env
2. 按目标宿主重命名目录：StreamDock 用 `.sdPlugin`，Craft 用 `.mPanelPlugin`；反向域名主体小写，后缀大小写保持准确。
3. 模板里需要**同步改名**的耦合点（漏改会导致 action 不工作）：
    - `manifest.json`：`Name / Description / Category / Author / URL`、
      每个 action 的 `UUID / Name / Tooltip`、`PropertyInspectorPath`
    - `src/node/index.ts`：`plugin.action["action1"]` 或 `plugin.regActionClass("action1", ...)`
      → 改成新 UUID 的最后一段
    - `src/web/front/action1.vue` 文件名 → 改成同一个最后一段.vue
    - `src/web/backend/action1.ts` 文件名 → 改成同一个最后一段.ts
    - 所有 `<lang>.json`：把 action key 改成新 UUID

### Step 3 — 写 manifest.json

按需求增删 `Actions`、设 `Controllers`、`States`、`Settings` 默认值、
`Software.MinimumVersion`、`Nodejs.Version`。字段全集见 `references/manifest.md`。

模板源 manifest 填 StreamDock 的 Controllers，Craft 构建会将每个 action 的 Controllers 设为 `["SecondaryScreen"]`。打包给 Craft 时，manifest 里
每一个 action 的 `Settings` 都必须提供 `ActionGeometry: { width, height }`
它是动作拖到画布上时的默认尺寸，逐个 action 都要写，漏写的动作尺寸不可预期；StreamDock 会
忽略该字段，双宿主共用一份 manifest 时照写即可。
`ActionGeometry` 是 Craft 宿主注入并维护的特殊 settings，永远与后端最后一次
`setImage` 输出的图片宽高一致。PI 不得直接修改它，也不得用 `setSettings` 改尺寸；
PI 要通过 `sendToPlugin` 把目标宽高发给当前 Action，后端按目标尺寸生成完整图片并
调用 `setImage`。Craft 随后自动持久化新 geometry，并通过 `didReceiveSettings` 回传。

### Step 4 — 选择后端

默认使用 Node 入口 `plugin/index.js`。使用 Web 后端时，将 manifest 的 `CodePath` 改为 `index.html`，移除 `Nodejs`，在 `src/web/main.ts` 启用已注释的 Web Action 导入和 `Plugin.startPlugin()`，并保留 `Property.startProperty(PropertyPage)`。同一 HTML 根据宿主注册参数启动后端或 PI。StreamDock 运行 `npm run build -- -web`，Craft 运行 `npm run build:craft -- -web`。

#### Node 后端 `src/node/index.ts`

为每个 action 写一个 class（继承 `Action`），实现需要的事件处理器，然后通过
`plugin.action["name"]` 或 `plugin.regActionClass("name", Class)` 注册。
可用 API（`setImage / setTitle / setState / setSettings / showOk / showAlert / openUrl ...`）
见 `references/sdk-api.md`，事件与 payload 见 `references/events.md`。
Action 有自定义 Settings 时，从 `src/share/<action>.ts` 导入类型并在 class 内声明
`declare settings: XxxSettings`，直接类型安全地访问 `this.settings`。

Control Bar / StreamDock 卡片的尺寸选择、缩放重绘和输入示例见
`sdk-api.md` 的 Control Bar / Card 一节。使用公开 `willAppear` / `didReceiveSettings`，
不要照搬旧 SDK 的 `_` 前缀钩子或 `this.data[context]`。
Action 类型分支统一读取 SDK 的 `this.actionType`：`Keypad`、`touchBar`、`Card`、`Knob`；不要读取或缓存 `payload.controller` 自行分类，也不要通过尺寸字段判断类型。SDK 在公开 `willAppear` 前已完成分类。

Craft action 在 `willAppear` 中读取最新 `ActionGeometry` 并重绘，
在 `willDisappear` 中清理定时器；不要固定成 144×144，也不要依赖按键事件。
StreamDock Node/Web Plugin 只有在业务确实依赖具体硬件型号时，才在 `startPlugin()` 前调用
`Plugin.enableDeviceModelDiscovery()`；随后在 Action `willAppear` 中读取
`this.deviceModel` 或 `data.deviceModel`，并始终处理无法识别时的 `undefined`。Web Plugin
依赖宿主定制 CEF 从插件目录相对 fetch `../../config/StreamDockConfig.ini` 的能力。

### Step 5 — 写 Property Inspector

在 `src/web/front/<action>.vue` 放 Vue SFC 表单，从 `src/share/<action>.ts` 导入同一
Settings 类型，使用 `Property.getReactiveInstance<XxxSettings>()` 获取响应式实例，
用 `v-model="property.settings.xxx"` 绑定数据（自动持久化）。
用 `property.willAppear` 执行依赖插件连接或 settings 的初始化，禁止把 `onMounted`
当作插件初始化成功。需要 PI 调后端并取返回值、或打开独立配置窗口时，读取
`references/rpc-and-subwindows.md`，按模板的 `getPluginProxy` / `callPlugin` 与
`openSubWindows` 模式实现。
Craft PI 若需要修改副屏组件坐标，使用 `references/qt-webchannel.md` 的可选适配器；
只在检测到 `window.qt.webChannelTransport` 后惰性初始化。
**没有配置项就可以删掉 PI**：去掉 manifest 里的 `PropertyInspectorPath`，
删除对应的 `.vue` 文件。

### Step 6 — 多语言（可选）

软件按宿主启动参数 `application.language` 读取 `<lang>.json`。语言文件同时承载宿主中的
插件/Action 名称和 PI 文案；所有用户可见文案都要走 i18n，不要写死中文。先维护
`zh_CN.json` 与 `en.json`，运行 `npm run translate:check` 检查缺项，需要自动补译时再运行
`npm run translate`。Node 后端在 import SDK 时即可通过 `Plugin.getI18n()` 获取与 PI
`Property.getI18n()` 同形状的 `Localization` Proxy，缺失 key 返回 key 本身。JSON 结构、
脚本配置与验证方法见
`references/localization.md`。

### Step 7 — 安装依赖、构建、安装

**以下构建复用要求仅针对使用本技能内置模板的项目。** 优先保留 `script/build.cjs`、`script/target.cjs` 和原 npm 构建入口。项目特有的资源复制、原生依赖分发、归档等行为，优先加入原构建流程，或由原脚本调用辅助脚本；不要仅为新增打包步骤另起一套替代构建脚本。

Node 后端固定沿用 TypeScript → ncc，严禁改用 esbuild、Rollup、webpack、tsup 等其他打包器，或额外引入另一套后端打包流程。优先让 ncc 打包依赖；仅在实际验证 ncc 无法正确处理某项依赖后，对该项使用 ncc 的 external，记录具体原因，在原 `build.cjs` 中复制必需的 `.node`、DLL、运行时入口或其他文件，并从最终安装目录验证加载。不要仅因依赖含原生模块或动态路径就预先 external；不能以 external 为由更换打包器。模板原有的 Vite 前端构建不变。

确实无法复用构建入口时，也必须继续使用 ncc；先读取实际模板脚本，再逐项保留其全部语义并验证行为：

- 版本号处理：`manifest.Version` 中 `auto` 的日期展开、时区与产物版本一致性，沿用 `target.cjs` 的逻辑。
- 构建选择：`-web`、`-node`、`-native` 的独立选择和组合选择；不传目标参数时的默认行为；源码或 native 目录不存在时的处理。宿主参数不能被误认为构建目标参数。
- 宿主选择：原有 Craft / StreamDock 参数与别名、冲突处理、插件后缀和安装目录。
- 输出与安装：原有输出布局、manifest 和语言/静态资源处理、npm scripts 参数透传、自动安装及错误处理行为。不能仅保留参数名而改变其效果。

验证至少覆盖版本号展开、默认构建、单目标及组合目标和宿主参数；针对实际修改检查未选择的目标是否被意外构建或覆盖。非模板项目沿用自身构建约定。

```bash
cd <插件文件夹>
npm ci
npm run build       # 构建 + 自动安装到 StreamDock（默认）
npm run build:craft # 构建 + 自动安装到 MiraBox Craft
```

`npm run build` 做四件事：

1. Vite 把 `src/web/` 打包成单个 HTML 文件（含 JS/CSS inline）；
2. tsc 把 `src/node/*.ts` 编译为 JS；
3. ncc 把编译结果和所有依赖打包成单个 `build/ncc_build/index.js`；
4. `script/build.cjs` 把整个插件文件夹复制到目标上位机的插件目录。

**同一份源码支持双宿主**：代码层面用 `isCraft` / `isStreamDock` 分支，构建层面
只差目录后缀与安装路径，由 `script/target.cjs` 解析：

|              | 默认                                    | 传 `-craft`                                |
| ------------ | --------------------------------------- | ------------------------------------------ |
| 后缀         | `.sdPlugin`                             | `.mPanelPlugin`                            |
| Windows 目录 | `%APPDATA%\HotSpot\StreamDock\plugins\` | `%APPDATA%\HotSpot\MiraBox Craft\plugins\` |

要同时装两个宿主就跑 `npm run build && npm run build:craft`。

交付前对照 `references/checklist.md` 自查。
