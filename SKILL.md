---
name: mirabox-plugin-builder
description: 使用统一的新版 mirabox-plugin-sdk Node/Web 模板创建或修改 StreamDock 与 MiraBox Craft 插件。适用于实体按键、旋钮、触摸屏、Control Bar 与 Card 卡片，以及 Craft 副屏需求。
---

# StreamDock / MiraBox Craft 插件开发

使用 `assets/plugin-template/` 中的统一模板开发 Node 或 Web 插件。宿主提供 WebSocket 服务并路由消息；后端负责业务和画面，PI 负责当前 Action 的配置。Node 后端可使用 Node API，Web 后端和 PI 使用浏览器 API 及宿主增强能力。

## 模板入口

Node 后端位于 `src/node/index.ts`，Web 后端位于 `src/web/backend/`，PI 位于 `src/web/front/`，业务共享类型位于 `src/share/`。模板随附与锁文件匹配的 SDK 发行包。维护者可运行 `node scripts/sync-template.mjs <模板目录>` 同步独立模板，加 `--check` 核验一致性。完整目录和开发流程见 `references/development-process.md`。修改已有插件时保留其结构，不重复复制模板。

## 使用内置模板时的复用规则

以下规则仅适用于使用本技能 `assets/plugin-template/` 内置模板的项目，不要求非模板项目迁移结构：

- **组件优先复用**：自带 `mirabox-plugin-sdk/ui` 的 `Mi*` 组件能满足需求时，优先用于 PI 布局、表单、按钮和提示；缺少对应能力时再补充自定义组件，避免另写一套已有控件和样式。具体组件见 `references/property-inspector.md`。
- **构建优先扩展**：优先保留原来的 `script/build.cjs` 及配套 `target.cjs`、npm scripts；特殊打包、资源复制和原生依赖处理优先接入原脚本或由其调用辅助脚本，不直接重写或替换构建入口。确实不能复用时，替代实现必须保留原有全部构建语义，包括版本号生成、`-web` / `-node` / `-native` 的独立及组合选择、默认构建、宿主参数、输出与安装行为。以实际模板脚本为准逐项核对，不能只保留同名参数。细节见 `references/development-process.md` 的 Step 7。

- **固定使用 ncc 打包 Node 后端**：沿用模板的 TypeScript → ncc 流程，优先让 ncc 处理依赖；只有实际确认某项依赖无法由 ncc 正确处理时，才将该项依赖设为 external，并在原构建脚本中补齐必要运行时文件的复制和部署验证。不得未经验证就外置整个依赖，也不得因原生 `.node`、DLL 或动态加载而直接放弃 ncc。严禁使用 esbuild、Rollup、webpack、tsup 等其他工具替代或另行打包 Node 后端；“构建入口无法复用”也不构成更换打包器的例外。模板既有的 Vite 前端构建流程继续保留。

## 关键约定

1. 插件目录的反向域名主体小写，宿主后缀保持准确大小写：StreamDock 为 `.sdPlugin`，Craft 为 `.mPanelPlugin`。Action 注册名必须等于 manifest 中 action UUID 的最后一段。
2. `context` 标识独立 Action 实例。Action 实例方法自动使用当前 context，例如 `this.setImage(image)`；Plugin 方法按签名显式传入，例如 `plugin.setImage(context, image)`。
3. 类型判断读取 SDK 的 `this.actionType`：`Keypad`、`touchBar`、`Card`、`Knob`，不要读取或缓存 `payload.controller`，也不要根据尺寸字段自行分类。事件参数统一使用 `StreamDockEvents.*`；只实现公开钩子，不覆盖 `_` 前缀的 SDK 内部方法。宿主分支用 `isCraft` / `isStreamDock`，不根据 actionType 推断 Craft。
4. StreamDock SDKVersion 3 的绘图尺寸读取事件 payload.width / height，Card 按实例尺寸绘制。Mira75 的 Card 处理 touchTap，其他 Card 处理 touchEvent 的 down、move、up、cancel。旧宿主的尺寸回退见 references/sdk-api.md。

5. Craft 输出尺寸由插件决定。宿主将最后一次输出图片的实际宽高回填并持久化到 `ActionGeometry`；读取它可以恢复上次尺寸。PI 改尺寸通过 `sendToPlugin` 请求后端输出新尺寸图片，不直接修改 `ActionGeometry` 或用 `setSettings` 改它。
6. PI 连接初始化以 `property.willAppear` 为准；它是 SDK 提供的虚拟 ready 钩子。依赖 settings、context、连接或 RPC 的逻辑放在此钩子中，Vue `onMounted` 仅用于 DOM/UI 工作。
7. 业务 Settings 类型放在 `src/share/`，Node/Web Action 用 `declare settings: XxxSettings`，PI 用 `Property.getReactiveInstance<XxxSettings>()`。宿主协议字段使用 SDK 的 `ActionSettings`，不在 share 重复声明。
8. 宿主 SVG 的 `<image>` 支持磁盘绝对路径，使用 `xlink:href` 并声明 `xmlns:xlink`，无需转 base64；仍遵守 SVG Tiny 1.2 限制，颜色使用 `rgb()`/颜色名。
9. StreamDock 的定制 `fetch`、Craft 的定制 `XMLHttpRequest` 可读取磁盘文件；普通浏览器预览不具备这些宿主能力。具体用法见 `references/host-file-access.md`。

## 按任务读取参考文档

新建插件先读 `development-process.md`；修改已有插件只读相关章节，不要求每次读完全部文档。交付前按 `checklist.md` 核对，并区分源码检查、虚拟宿主测试和真实设备验证；构建/安装按用户要求执行。

| 场景 | 参考文档（位于 `references/`） |
| --- | --- |
| 新建、命名、构建与安装 | `development-process.md` |
| manifest 与 Controller 配置 | `manifest.md` |
| 后端 API、Action 类型、控件尺寸 | `sdk-api.md` |
| 生命周期与输入协议 | `events.md` |
| PI 表单和响应式 settings | `property-inspector.md` |
| 多语言 | `localization.md` |
| RPC 和 PI 子窗口 | `rpc-and-subwindows.md` |
| Craft 能力差异、尺寸和 Node 兼容 | `craft-support.md` |
| Craft 坐标与原生文件选择 | `qt-webchannel.md` |
| SVG 图片与磁盘文件读取 | `host-file-access.md` |
| 开发期虚拟宿主验证 | `virtual-host.md` |
| 交付检查 | `checklist.md` |
