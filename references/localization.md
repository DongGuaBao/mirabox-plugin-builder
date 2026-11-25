# 本地化（语言文件与 i18n）

插件的宿主列表文案、Action 文案和 PI 文案共用 `language/<语言代码>.json`，但读取位置不同。
需要新增或修改用户可见文本时，先维护 `zh_CN.json` 和 `en.json`，再补齐其他语言。

## 语言文件结构

```json
{
    "Localization": {
        "基础设置": "Basic settings",
        "刷新失败：{0}": "Refresh failed: {0}"
    },
    "Name": "Example plugin",
    "Description": "Example plugin description",
    "Category": "Examples",
    "com.mirabox.streamdock.example.refresh": {
        "Name": "Refresh",
        "Tooltip": "Refresh data"
    }
}
```

三类字段的用途：

| 位置                                 | 用途                                 |
| ------------------------------------ | ------------------------------------ |
| `Localization`                       | PI、子窗口及代码中的用户可见文案     |
| 顶层 `Name / Description / Category` | 宿主插件列表中的插件名称、描述、分类 |
| `<action UUID>.Name / Tooltip`       | 宿主动作列表中的动作名称和提示       |

Action 对象的 key 必须等于 `manifest.json` 中完整的 Action UUID；重命名 Action 时要同步修改所有语言文件。

## PI 与子窗口中使用

通过 SDK 获取当前语言的 `Localization` 映射

```vue
<script setup lang="ts">
    import { Property } from "mirabox-plugin-sdk/property";

    const i18n = Property.getI18n();
</script>

<template>
    <div>{{ i18n["基础设置"] }}</div>
</template>
```

所有 `label`、`hint`、placeholder、按钮、空状态、
错误消息和 toast 等用户可见文案都要使用 `i18n["key"]`，不要在 Vue 模板或脚本中写死中文。

子窗口会继承父 PI 的 `window.i18n`，用法相同。语言由宿主启动参数
`application.language` 决定；PI 初始化仍以 `property.willAppear` 为准，获取 i18n 本身不替代连接生命周期。

## Node 后端中使用

`Localization` Proxy：

```ts
import { Plugin } from "mirabox-plugin-sdk/node";

const i18n = Plugin.getI18n();
const text = i18n["刷新失败：{0}"];
```

- Node 使用 `Plugin.getI18n()`。
- 两者都直接写 `i18n["key"]`；key 不存在或语言文件无法读取时返回 key 本身，不抛异常。

如果后端文本最终会显示给用户，也必须本地化；纯日志、协议字段和 settings key 不要翻译。

## 增量翻译脚本

模板提供：

```bash
npm run translate:check
npm run translate
```

推荐流程：

1. 在 `language/zh_CN.json` 和 `language/en.json` 中添加同一组字段和 key。
2. 先运行 `npm run translate:check`，只报告缺失项，不联网、不写文件。
3. 配置 `.env` 或环境变量后运行 `npm run translate`：

```dotenv
OPENAI_API_KEY=...
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

`OPENAI_BASE_URL` 和 `OPENAI_MODEL` 可省略。脚本以中文为首选源、英文为补充源，只翻译各目标
语言缺少的条目，保留已有译文，并校验 `{0}`、`{1}` 等占位符。自动翻译结果必须人工检查产品名、
术语、快捷键和短按钮文案。

## 添加或删除语言

当前模板支持 `zh_CN`、`zh_HK`、`en`、`de`、`el`、`es`、`fr`、`ja`、`ko`、`it`、
`pt`、`pl`、`ru`、`ar`。若要改变语言集合，要同时修改 `script/translate.cjs` 的
`target_language` 和 `language/` 中对应文件；不要只创建文件而忘记加入翻译目标列表。

## 验证

- 所有 JSON 均可解析，且没有空字符串或 `(translation failed)`。
- 每个语言文件均包含正确的完整 Action UUID。
- `zh_CN` 与 `en` 的字段/key 集合一致，再运行 `npm run translate:check` 确认其他语言无缺项。
- 至少分别用中文和英文宿主打开动作列表、主 PI 与子窗口，检查文本、插值占位符和窄面板布局。
