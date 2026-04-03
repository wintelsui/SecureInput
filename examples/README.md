# Examples

本目录提供两个示例：

- `vue3-vite`：Vue3 + Vite 本地开发示例
- `vue2-cdn`：Vue2 CDN 零构建示例

## 1) Vue3 + Vite 示例

```bash
cd examples/vue3-vite
npm install
npm run dev
```

启动后在浏览器打开终端输出的本地地址。

## 2) Vue2 CDN 示例

推荐使用一个静态服务器启动项目根目录（不要直接双击 html）：

```bash
cd /Users/suiwentao/Documents/WorkSpace.localized/AiProjects/SecureInput
python3 -m http.server 5174
```

然后打开：

`http://localhost:5174/examples/vue2-cdn/index.html`
