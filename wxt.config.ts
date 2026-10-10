import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  outDir: 'dist',
  outDirTemplate: '.',
  manifest: {
    name: 'Twitter Enhancement',
    description: '为 X / Twitter 提供本地私人备注、时间线过滤、媒体连续浏览、原图和视频下载。',
    permissions: ['storage', 'downloads'],
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      96: 'icon/96.png',
      128: 'icon/128.png',
    },
    action: {
      default_title: '管理本地备注',
      default_icon: {
        16: 'icon/16.png',
        32: 'icon/32.png',
      },
    },
  },
});
