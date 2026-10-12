# AGENTS.md

本文件给参与本仓库工作的代理使用。修改代码前先读本文件和相关源码，优先沿用现有架构与测试风格。

## 项目概览

Twitter Enhancement 是一个 WXT 驱动的 Chromium 扩展，使用 React、TypeScript 和 Vitest。扩展只在本地保存数据，目前围绕 X / Twitter 提供三类能力：

- 用户私人备注：在个人主页和悬浮卡片中显示、编辑、删除备注；推文及引用推文头部的时间后分别只读显示对应作者的备注，详情页主作者没有同行时间时显示在 `@用户名` 后，支持省略与全文提示。
- 时间线过滤：在首页、列表页和用户主页“帖子”提供转贴开关及收起效果；广告由设置页独立开关控制，默认直接隐藏，不提供展开占位。
- 视频下载：从 X 页面和捕获到的推文媒体数据中选择可下载的 MP4。

扩展内容脚本只匹配 `https://x.com/*` 和 `https://twitter.com/*`。数据存储在浏览器扩展的 `storage.local`，不要引入远端同步、埋点或网络上传，除非用户明确要求。

## 技术栈与命令

使用 Node.js 20.12+ 和 pnpm。`packageManager` 固定为 `pnpm@11.1.3`。

常用命令：

```powershell
pnpm install
pnpm dev
pnpm typecheck
pnpm test
pnpm build
pnpm preview:ui
```

`pnpm dev` 启动 WXT 开发流程，`pnpm build` 输出到 `dist`。`pnpm preview:ui` 只用于本地预览页面，不代表真实 X DOM 环境。

## 目录职责

- `entrypoints/`：WXT 入口。内容脚本、后台脚本、选项页入口都在这里。
- `src/features/`：业务功能层，包含用户备注、列表转贴偏好、视频下载等纯领域逻辑和 React 组件。
- `src/platform/x/`：X / Twitter 页面适配层，负责解析 DOM、管理挂载生命周期、桥接真实页面结构。
- `src/shared/storage/`：浏览器 storage 抽象和 repository 实现。
- `tests/`：Vitest 测试，包含 DOM adapter、repository、React 组件和管理器测试。
- `preview/`：本地预览应用。
- `.wxt/`、`dist/`、`node_modules/`：生成或依赖目录，不要手动编辑。

## 编码约定

- TypeScript 严格模式开启，并启用了 `noUncheckedIndexedAccess`。新增代码要显式处理 `undefined` 和失败路径。
- 保持模块边界清晰：可测试的规则放在 `src/features/`，依赖 X 页面结构的选择器和启发式逻辑放在 `src/platform/x/`。
- 优先通过接口注入 repository、mount 函数或资源解析函数，避免在领域逻辑中直接依赖浏览器全局对象。
- 页面挂载代码必须提供 `destroy()` 或等价清理逻辑，移除事件监听、React root、Shadow DOM 或内联样式恢复状态。
- 处理 X DOM 时要防御性编程。选择器、URL、文本解析都可能失败，失败时应跳过当前目标，而不是让内容脚本抛出未捕获异常。
- 用户可见文案当前以中文为主；新增同类文案保持中文，并注意无障碍属性如 `aria-label`、按钮文本和错误状态。
- 不要把 `storage.local` 中的 schema key 随意改名。涉及持久化格式变更时，新增版本化常量和迁移/兼容测试。
- 样式尽量使用已有 `te-` 前缀类名和 data attribute。注入 X 页面时避免污染宿主页全局样式；需要隔离时沿用 Shadow DOM 或内联 CSS 导入模式。

## 测试要求

默认在完成代码修改后运行：

```powershell
pnpm typecheck
pnpm test
```

涉及构建配置、WXT entrypoint、manifest、CSS 导入或打包输出时，再运行：

```powershell
pnpm build
```

新增或修改行为时，同步补充聚焦测试：

- 纯规则、解析、schema：放在对应 `*.test.ts`。
- React 交互：使用 Testing Library 和 `userEvent`。
- X DOM 适配：用 `document.body.innerHTML` 构造最小 DOM，断言解析结果和挂载目标。
- storage 行为：使用 `tests/fakes/fake-storage.ts` 或局部 fake repository。

Vitest 配置使用 `jsdom`、全局断言和 `fileParallelism: false`。不要让测试依赖真实网络、真实浏览器扩展 API 或测试顺序。

## 修改 X / Twitter 适配层时

X 页面结构经常变化。修改 `src/platform/x/` 时要特别注意：

- 保留现有路由过滤，避免把 `/home`、`/explore`、`/status/...` 等页面误判为用户主页。
- DOM 识别应尽量从稳定语义开始，例如 `data-testid`、`role`、URL path，再回退到文本。
- 对 hover card、profile、list timeline、article action bar 分别加测试，不要只覆盖当前页面截图中的一种结构。
- 转贴和广告隐藏会改写宿主 article 的 `display`，必须保存并恢复原始 inline style。广告文字识别限定在推文头部，避免将正文、用户名或引用内容误判为广告；广告偏好独立于转贴开关、收起效果及临时展开状态。
- 视频下载目标要同时考虑未播放视频、已播放视频、poster、resource timing 和数据桥回填。

## Git 与产物

- 不要提交 `node_modules/`、`.wxt/` 或 `dist/`，除非用户明确要求交付构建产物。
- 不要顺手格式化无关文件或重写已有中文文案。
- 如果工作区已有未提交改动，先确认是否与当前任务相关；不要回滚用户改动。

