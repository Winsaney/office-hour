# YC Office Hours 🚀

这是一个本地单文件 HTML 应用，扮演 YC 风格合伙人的角色来考验你的创业想法。它通过 AI（支持 Claude 或如 DeepSeek 这样兼容 OpenAI 的模型）向你提出 6 个关键问题，帮助你验证切入点、目标用户和核心问题。

![YC Office Hours 预览](/Users/nick/.gemini/antigravity/brain/5e5df16f-c18a-4455-b43c-0d70f19dbfb8/welcome_screen_clean_1774159001635.png)

## ✨ 特性

- **纯本地运行，无需后端**：只需在浏览器中打开 `office-hours.html` 即可运行全部功能。
- **两种模式**：
  - **创业模式 (Startup Mode)**：通过六个核心问题，让你面对现实，找到最小切入点。
  - **创作者模式 (Builder Mode)**：专为个人项目和黑客松设计，帮助你找到想法中最令人兴奋的版本。
- **多 AI 服务商支持**：内置支持 Anthropic 的 Claude API，以及任何兼容 OpenAI 格式的 API（如 DeepSeek、Together/Groq 提供的 Llama 模型等）。
- **中英双语支持**：完整的中文/英文界面切换，AI 也会根据你的界面语言自动使用对应语言回复。
- **本地 CORS 代理**：包含一个轻量级的 Node.js 代理，用于绕过浏览器直接调用 DeepSeek API 等服务时遇到的严格跨域（CORS）限制。
- **生成设计文档**：对话结束后，系统会自动总结交流过程，输出一份可直接复制的、具体的产品特性和设计文档草案。
- **隐私优先**：所有的 API Key 都只会保存在浏览器的 `localStorage` 中，并直接发送给 AI 服务商。

## 🚀 快速开始

### 1. 基础用法 (使用 Claude API)
如果你只需要使用 Anthropic 的 Claude API：
1. 双击在浏览器中打开 `office-hours.html`。
2. 点击右上角的 **⚙ 设置** 按钮。
3. 选择 "Claude (Anthropic)" 并输入你的 API Key。
4. 关闭设置悬浮窗，输入你的想法，点击开始！

### 2. 使用兼容 OpenAI 的 API (如 DeepSeek 等)
部分服务商（如 DeepSeek）由于安全策略限制，具有严格的 CORS 跨域限制，不允许浏览器端的 JavaScript 直接发起请求。本项目包含了一个本地代理来解决这个问题：

1. 确保你的电脑上安装了 [Node.js](https://nodejs.org)。
2. 在项目根目录下打开终端，运行代理服务器：
   ```bash
   node proxy.js
   ```
   *控制台会提示 "CORS Proxy running on http://localhost:3456"*
3. 在浏览器中打开 `office-hours.html`。
4. 点击右上角的 **⚙ 设置** 按钮，选择 **OpenAI Compatible**。
5. 填入你的参数：
   - **API Key**: 你的服务商密钥，例如 `sk-...`
   - **API Endpoint**: 填写带有 `/v1/chat/completions` 的完整地址，例如 `https://api.deepseek.com/v1/chat/completions`
   - **Model**: 你要使用的模型，例如 `deepseek-chat`
6. **勾选这个选项：** `[x] Use Local CORS Proxy (localhost:3456)`
7. 关闭设置，开始测试你的想法！

## ⚙️ 工作原理

- **`office-hours.html`**: 包含完整的 UI、样式和应用逻辑，负责管理状态、对话历史与发起请求。
- **`proxy.js`**: 一个极简的 Node.js http 服务器，负责将浏览器的请求透明地转发给你选择的 API Endpoint，并加上所有必需的 `Access-Control-Allow-Origin` 跨域处理头，防止浏览器拦截返回结果。

## 🎨 UI/UX 设计

应用采用了高级的暗黑模式设计美学：
- 毛玻璃（Glassmorphism）叠加层与模糊背景效果
- 响应式动态排版布局，内置了展示历史记录的侧边栏
- 优美的 CSS 动画过渡效果（打字指示器、弹窗切换等）
- 对 AI 输出的内容自动提供带有语法高亮的 Markdown 渲染

## 🔒 安全说明

你的 API Key 直接且仅存储在你本地浏览器的 `localStorage` 之中。这对于本地工具非常方便，但请确保你不要共享浏览器配置目录，或在公共电脑上使用本项目。

---
*Built to help founders build what people want.*
