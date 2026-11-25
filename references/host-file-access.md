# 宿主增强的本地文件能力

StreamDock 与 MiraBox Craft 使用经过修改的 CEF。以下能力不是标准浏览器能力，只能在宿主加载的插件页面中使用；普通浏览器或独立 Vite 预览不能作为兼容性依据。

## SVG 引用磁盘图片

宿主 SVG 渲染器允许 `<image>` 通过 `xlink:href` 读取本机绝对路径。SVG 必须声明 `xmlns:xlink`，Windows 路径优先使用正斜杠，并对 XML 特殊字符转义：

```xml
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="144" height="144" viewBox="0 0 144 144">
  <image x="0" y="0" width="144" height="144"
         xlink:href="C:/Users/example/Pictures/cover.png" />
</svg>
```

SVG 作为 data URL 传给 `setImage` 时仍可保留该绝对路径，不必先把图片转成 base64。其他 SVG Tiny 1.2 限制仍然适用。

## Web Plugin 读取磁盘文件

两种宿主接口不同，不要互换。

StreamDock 使用修改过的 `fetch`：

```ts
const response = await fetch("C:/Temp/data/config.json");
if (!response.ok) throw new Error(`HTTP ${response.status}`);
const text = await response.text();
```

Craft 使用修改过的 `XMLHttpRequest`：

```ts
const text = await new Promise<string>((resolve, reject) => {
  const xhr = new XMLHttpRequest();
  xhr.open("GET", "C:/Temp/data/config.json");
  xhr.onload = () => xhr.status === 200 || xhr.status === 0
    ? resolve(xhr.responseText)
    : reject(new Error(`HTTP ${xhr.status}`));
  xhr.onerror = () => reject(new Error("Local file read failed"));
  xhr.send();
});
```

二进制分别使用 `response.arrayBuffer()` 与 `xhr.responseType = "arraybuffer"`。相对路径从插件页面目录解析；例如 StreamDock 插件目录中的 `../../config/StreamDockConfig.ini` 指向宿主配置。读取失败要正常降级，不能中断插件连接或生命周期。
