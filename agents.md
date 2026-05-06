# YC Office Hours 项目信息分析

本文档是对 `YC Office Hours` 项目的全局架构、技术选型及核心逻辑的详细总结，旨在为后续开发或 AI 代理维护提供清晰的上下文。

## 1. 项目概况

**YC Office Hours** 是一个模拟 Y Combinator 办公时间（Office Hours）的 Web 应用。它的核心价值在于扮演一个“不留情面”的 YC 合伙人，通过提出尖锐问题来对用户的创业想法或副业项目进行压力测试，并最终生成结构化的设计文档（Design Doc）。

## 2. 技术栈与架构特色

*   **纯前端架构 (Vanilla Web)**: 摒弃了复杂的构建工具（如 Webpack/Vite）和重型框架（如 React/Vue）。直接采用原生 HTML, CSS, JavaScript 开发。
*   **本地优先 (Local-first)**: 默认情况下的所有数据交互（会话历史、配置信息）均存储在浏览器的 `localStorage` 中。即使离线或未登录也能完整使用。
*   **云端同步 (Cloud Sync) - Supabase**: 引入 Supabase 作为 BaaS。提供基于 OAuth (Google/GitHub) 的账号系统。用户登录后，本地数据会自动与云端 PostgreSQL 数据库同步（`sessions` 和 `user_preferences` 表）。
*   **PWA 支持**: 包含 `manifest.json` 和 `sw.js` (Service Worker)，支持静态资源缓存，允许用户将其作为独立应用“添加到主屏幕”。
*   **API 直接调用**: 前端直接通过 Fetch API 与大模型（Claude 或 OpenAI 兼容 API）建立连接，并处理 Server-Sent Events (SSE) 流式输出。

## 3. 文件结构解析

最近项目进行了一次重要的重构，将原本超过 2000 行的单文件拆分成了职责更清晰的多文件结构：

*   **`index.html`**: 骨架与 UI 结构。包含了欢迎屏、聊天界面、侧边栏、历史记录/设置模态框等 HTML 标签。引入了 Supabase SDK 和 marked.js。
*   **`app.js`**: 核心交互逻辑与业务逻辑。包含：
    *   状态管理 (Mode, History, User 等)。
    *   Supabase Auth 事件监听与数据同步逻辑 (`mergeLocalToCloud`, `saveSessionState`, `getHistoryList` 等)。
    *   API 请求与流式处理 (`callAPI`)。
    *   System Prompt 的定义（根据 Startup / Builder 模式返回极具引导性的提示词）。
    *   UI 交互响应与 Markdown 渲染。
*   **`styles.css`**: 全局样式与响应式设计。使用 CSS Variables 统一管理暗黑主题的色彩系统（如 `--bg`, `--gold`, `--surface` 等），并针对移动端（`@media (max-width: 768px)`）进行了大量的布局适配。
*   **`proxy.js`**: 辅助工具脚本。一个基于 Node.js 的本地 CORS 代理服务器。因为浏览器前端直接请求部分第三方 API 会遇到跨域拦截，运行此脚本可以绕过限制。
*   **`supabase_schema.sql`**: 数据库部署文件。包含了 `sessions` 和 `user_preferences` 两张表的结构定义，以及关键的 Row Level Security (RLS) 权限控制策略。
*   **`sw.js` & `manifest.json`**: PWA 相关配置，实现静态资源缓存与应用清单定义。

## 4. 核心功能逻辑

### 4.1 双模式驱动 (Modes)
*   **Startup Mode (创业模式)**: 关注商业可行性。通过 6 个核心问题（需求现实、现状、目标人物、最小切入点、观察、未来契合度）进行逼问。
*   **Builder Mode (创作者模式)**: 关注创造力与趣味性。引导经历：理解问题、挑战预设、探讨替代方案。

### 4.2 智能对话与阶段检测 (Phase Detection)
*   系统通过 `detectPhase` 函数（目前主要基于文本包含的关键词）自动判断当前的讨论阶段，并高亮左侧（或移动端底部 Drawer）的进度条和对应的 YC 核心原则。

### 4.3 认证与数据流转
1.  **未登录状态**: API Key, 会话历史, UI 语言等全量写入 `localStorage`。
2.  **登录触发**: 用户点击 `Auth` 并完成 OAuth 授权，Supabase 的 `onAuthStateChange` 捕获 `SIGNED_IN`。
3.  **数据合并 (`mergeLocalToCloud`)**: 将本地未上传的会话历史批量 `insert` 到 Supabase。
4.  **偏好拉取 (`loadPrefsFromCloud`)**: 从云端拉取用户之前保存的服务商、模型等配置。
5.  **日常交互**: 每一次对话（`saveSessionState`），不仅更新本地，同时尝试通过 `upsert` 同步到云端。

## 5. 潜在优化空间（已在计划中）

项目中已经梳理了 15 项优化计划，其中目前存在的主要痛点与高优改进包括：
1.  **改进阶段检测 (Phase Detection)**: 当前的关键词匹配机制在中文对话中容易失效，计划改为让 AI 在返回的文本末尾附加显式标记（如 `[PHASE:q1]`）。
2.  **流式渲染优化**: 当前每次收到流式区块都会全量解析并重新渲染 Markdown，造成频繁的 DOM 重绘，需引入节流（Throttle）机制。
3.  **中断恢复机制**: 当流式输出因为网络或刷新意外中断时，提供更好的恢复与续写体验。
4.  **API 密钥管理**: 目前 API Key 不上云是处于安全考量。若未来需要跨设备同步，需引入客户端侧加解密方案。
