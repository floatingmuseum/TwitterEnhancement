# Twitter Enhancement

一个只在本地保存数据的 Chromium 扩展。目前提供 X / Twitter 用户备注：

- 在用户个人主页的 `@用户名` 下方显示备注。
- 在头像、昵称或用户名触发的悬浮卡片中显示备注。
- 点击备注即可原地创建、修改或删除。
- 点击扩展图标打开本地备注管理页，可搜索全部备注。
- 支持将备注导出为 JSON；导入时可选择完全替换或仅增补不存在的备注。
- 数据保存在浏览器扩展的 `storage.local`，不会发送到网络。

## 开发

需要 Node.js 20.12 或更高版本。

```powershell
pnpm install
pnpm dev
```

常用检查：

```powershell
pnpm typecheck
pnpm test
pnpm build
```

## 在 Chrome / Edge 中加载

1. 执行 `pnpm build`。
2. 打开 `chrome://extensions` 或 `edge://extensions`。
3. 开启“开发者模式”。
4. 选择“加载已解压的扩展程序”。
5. 选择项目根目录下的 `dist` 目录。

扩展内容脚本仅在 `https://x.com/*` 和 `https://twitter.com/*` 运行，只申请 `storage` 权限。设置页中的用户名链接会在新标签页打开对应的 X 主页。

## 当前限制

- 备注按规范化后的 `@用户名` 查询；用户改名后旧备注不会自动跟随。
- 不包含云同步；导入导出文件需要由用户自行保管。
- X 页面结构变化时，只需要更新 `src/platform/x` 中的适配层。
