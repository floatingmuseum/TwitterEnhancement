import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  outDir: 'dist',
  outDirTemplate: '.',
  manifest: {
    name: 'Twitter Enhancement',
    description: '在 X / Twitter 用户主页和悬浮卡片中保存本地私人备注。',
    permissions: ['storage'],
  },
});
