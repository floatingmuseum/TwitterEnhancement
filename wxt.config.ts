import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  outDir: 'dist',
  outDirTemplate: '.',
  manifest: {
    name: 'Twitter Enhancement',
    description: '为 X / Twitter 提供本地私人备注和列表页纯转贴过滤。',
    permissions: ['storage'],
    action: {
      default_title: '管理本地备注',
    },
  },
});
