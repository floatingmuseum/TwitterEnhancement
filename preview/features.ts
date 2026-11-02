import { createXInterfaceLayoutManager } from '../src/platform/x/interface-layout-manager';
import { mountXMediaNavigationUi } from '../src/platform/x/mount-media-navigation-ui';
import { mountXImageDownloadUi } from '../src/platform/x/mount-image-download-ui';
import { mountXVideoDownloadUi } from '../src/platform/x/mount-video-download-ui';
import { mountXExternalVideoUi } from '../src/platform/x/mount-external-video-ui';
import type { XImageDownloadTarget } from '../src/platform/x/image-download-manager';
import type { XMediaNavigationTarget } from '../src/platform/x/media-navigation-manager';
import type {
  InterfaceLayoutListener,
  InterfaceLayoutPreference,
  InterfaceLayoutPreferenceRepository,
} from '../src/features/interface-modules/interface-layout-preference';

const cleanups: Array<() => void> = [];
const media = '/sample-media.svg';
const author = '<div class="tweet-author"><span class="avatar">A</span><div><strong>Alice Chen</strong><small>@alice · 示例帖子</small></div></div>';
const actions = '<span aria-hidden="true">♡<small>24</small></span><span aria-hidden="true">↻<small>8</small></span><span aria-hidden="true">↗</span>';

function required<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing demo element: ${selector}`);
  return element;
}

function heading(title: string) {
  return `<div class="demo-heading"><h2>${title}</h2><span>本地演示 · 示例内容</span></div>`;
}

function mountLayout(collapsed: boolean) {
  document.body.className = 'layout-demo';
  const icons = ['M3 11 12 3l9 8v10h-6v-7H9v7H3Z', 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5 12 6 6', 'M6 3h12v18l-6-4-6 4Z', 'M4 12h3m4 0h3m4 0h3'];
  document.body.innerHTML = `
    <header role="banner"><nav role="navigation">
      ${['首页', '探索', '书签', '更多'].map((label, index) => `<a href="#" aria-label="${label}"><div><div><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[index] ?? ''}" /></svg></div><div>${label}</div></div></a>`).join('')}
    </nav></header>
    <main><div class="layout-columns">
      <div class="layout-primary" data-testid="primaryColumn">
        <div class="timeline-tabs"><strong>为你推荐</strong><span>正在关注</span></div>
        <div><section><div data-testid="cellInnerDiv"><article class="layout-tweet">
          <div data-testid="User-Name">${author}</div>
          <p class="tweet-copy" data-testid="tweetText">海岸四季。收起侧栏后，可以在同一行看到更多照片。</p>
          <div class="carousel"><div class="carousel-spacer" style="padding-bottom: 34%">
            <div class="carousel-list" data-testid="ScrollSnap-List">
              ${[0, 24, 55, 115].map((hue, index) => `<div><a href="#photo-${index + 1}"><div data-testid="tweetPhoto"><img src="${media}" alt="示例海岸插画 ${index + 1}" style="filter: hue-rotate(${hue}deg)" /></div></a></div>`).join('')}
            </div>
          </div></div>
        </article></div></section></div>
      </div>
      <aside class="layout-sidebar" data-testid="sidebarColumn">
        <div class="sidebar-box"><strong>有什么新鲜事</strong><p>旅行 · 热门<br />海边的周末</p></div>
        <div class="sidebar-box"><strong>推荐关注</strong><p>发现更多创作者</p></div>
      </aside>
    </div></main>`;
  let preference: InterfaceLayoutPreference = {
    leftNavigationExpanded: !collapsed,
    rightSidebarVisible: !collapsed,
  };
  const listeners = new Set<InterfaceLayoutListener>();
  const repository: InterfaceLayoutPreferenceRepository = {
    async getPreference() { return { ...preference }; },
    async setPreference(key, value) {
      preference = { ...preference, [key]: value };
      listeners.forEach((listener) => listener({ [key]: value }));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const manager = createXInterfaceLayoutManager(repository);
  cleanups.push(() => manager.destroy());
}

function mountFeatureDemos() {
  document.body.innerHTML = `
    <header class="demo-intro"><h1>Twitter Enhancement · 功能演示</h1><p>使用实际扩展组件与示例页面。下载仅模拟反馈，不写入文件；外部链接演示不会跳转。</p></header>
    <section id="layout-demo" class="feature-demo" aria-label="侧栏收起效果">
      ${heading('侧栏收起：把宽度留给时间线')}
      <div class="compare-label"><strong>展开</strong><span>左侧导航 + 时间线 + 右侧栏</span></div>
      <div class="layout-window"><iframe src="/features.html?layout=expanded" title="侧栏展开时的页面" loading="eager"></iframe></div>
      <div class="compare-label"><strong>收起两侧后</strong><span>导航保留图标 · 时间线变宽 · 图片高度不变</span></div>
      <div class="layout-window"><iframe src="/features.html?layout=collapsed" title="侧栏收起后的页面" loading="eager"></iframe></div>
      <p class="demo-caption">使用侧边箭头分别收起或展开两侧；横向多图轮播利用释放的空间。</p>
    </section>
    <section id="media-demo" class="feature-demo" aria-label="连续浏览媒体效果">
      ${heading('连续浏览媒体：在大图中切换帖子')}
      <div id="media-viewer" class="media-viewer">
        <img src="${media}" alt="当前媒体帖中的示例海岸插画" />
        <div class="viewer-meta">Alice Chen · 媒体<span class="viewer-count" id="viewer-count">第 2 条媒体帖子 · 单图</span></div>
        <div class="viewer-footer">从用户主页「媒体」页打开 · 直接切换相邻帖子</div>
      </div>
      <p class="demo-caption">在当前帖子的首尾媒体处显示跨帖按钮；单图帖可同时显示「较新帖子」和「较旧帖子」。</p>
    </section>
    <section id="downloads-demo" class="feature-demo" aria-label="图片与视频下载效果">
      ${heading('图片与视频下载：直接从帖子保存')}
      <div class="download-grid">
        <article class="sample-tweet">${author}<p class="tweet-copy">今天的海岸，存一张作壁纸。</p>
          <div id="download-photo" class="sample-photo" data-testid="tweetPhoto"><img src="${media}" alt="用于演示原图下载的海岸插画" /></div>
          <div class="action-bar">${actions}</div>
          <p class="effect-label">图片：悬停后点击右上角下载按钮 ↑</p>
        </article>
        <article id="video-tweet" class="sample-tweet">${author}<p class="tweet-copy">一段海边的短片。</p>
          <div class="sample-video"><img src="${media}" alt="示例视频封面" /><span class="play" aria-hidden="true">▶</span><span class="duration">0:24</span></div>
          <div id="video-actions" class="action-bar" role="group" aria-label="示例视频推文操作">${actions}</div>
          <p class="effect-label">视频：操作栏中直接下载 MP4 ↑</p>
        </article>
      </div>
      <p class="demo-caption">图片逐张保存 X 提供的原图版本；视频无需先播放，选择可获取的最高分辨率 MP4。</p>
    </section>
    <section id="external-demo" class="feature-demo" aria-label="外部视频直达原站效果">
      ${heading('外部视频：一键前往原站')}
      <div class="external-grid">
        <article class="sample-tweet">${author}<p class="tweet-copy">这段视频也可以直接去原站看。</p>
          <button id="external-card" class="external-card" type="button" aria-label="示例：在推文内播放视频">
            <div class="sample-video"><img src="${media}" alt="示例 YouTube 视频封面" /><span class="play" aria-hidden="true">▶</span></div>
            <div class="card-description"><small>youtube.com</small><strong>海岸漫步 · 示例视频</strong></div>
          </button>
        </article>
        <div>
          <p class="guide-item"><strong>点击视频卡片</strong><span>保留 X 原有的推文内播放方式。</span></p>
          <p class="guide-item"><strong>点击下方「在 YouTube 打开 ↗」</strong><span>在新标签页打开原站，继续观看、评论或收藏。</span></p>
          <p class="demo-notice" id="external-notice" role="status">仅在能识别原始地址时显示入口。</p>
        </div>
      </div>
    </section>`;

  let mediaIndex = 1;
  const viewer = required('#media-viewer');
  const mediaTarget = (): XMediaNavigationTarget => ({
    anchor: viewer,
    route: { handle: 'alice', tweetId: String(300 - mediaIndex), kind: 'photo', index: 1, href: `/alice/status/${300 - mediaIndex}/photo/1` },
    showNewer: mediaIndex > 0,
    showOlder: mediaIndex < 2,
  });
  const navigation = mountXMediaNavigationUi(mediaTarget(), async (direction) => {
    mediaIndex = Math.min(2, Math.max(0, mediaIndex + (direction === 'older' ? 1 : -1)));
    required('#viewer-count').textContent = `第 ${mediaIndex + 1} 条媒体帖子 · 单图`;
    required<HTMLImageElement>('#media-viewer > img').style.filter = `hue-rotate(${mediaIndex * 24}deg)`;
    navigation.update(mediaTarget());
    return 'navigated';
  });
  const photo = required('#download-photo');
  const photoTarget: XImageDownloadTarget = {
    anchor: photo,
    image: required<HTMLImageElement>('#download-photo > img'),
    original: { id: 'demo', format: 'png', url: 'https://pbs.twimg.com/media/demo?format=png&name=orig' },
    handle: 'alice', tweetId: '200', photoIndex: 1,
  };
  const imageControl = mountXImageDownloadUi(photoTarget, () => photoTarget, async () => ({ ok: true }));
  const videoControl = mountXVideoDownloadUi({
    anchor: required('#video-actions'), article: required('#video-tweet'),
    handle: 'alice', tweetId: '201', identities: [], directVideoUrls: [],
  }, () => ['https://video.twimg.com/ext_tw_video/201/pu/vid/1280x720/demo.mp4']);
  const card = required<HTMLButtonElement>('#external-card');
  const externalTarget = { anchor: card, link: { url: 'https://www.youtube.com/watch?v=preview-demo', provider: 'YouTube' } };
  const externalControl = mountXExternalVideoUi(externalTarget, () => externalTarget);
  const showInlineDemo = () => { required('#external-notice').textContent = '演示：保留推文内播放。此处没有加载视频。'; };
  const showExternalDemo = (event: Event) => {
    event.preventDefault();
    required('#external-notice').textContent = '演示：正式扩展会在新标签页打开视频原站。';
  };
  card.addEventListener('click', showInlineDemo);
  const externalLink = card.nextElementSibling?.shadowRoot?.querySelector('a');
  externalLink?.addEventListener('click', showExternalDemo);
  externalLink?.addEventListener('auxclick', showExternalDemo);
  cleanups.push(() => {
    navigation.destroy(); imageControl.destroy(); videoControl.destroy(); externalControl.destroy();
    card.removeEventListener('click', showInlineDemo);
    externalLink?.removeEventListener('click', showExternalDemo);
    externalLink?.removeEventListener('auxclick', showExternalDemo);
  });
}

const layout = new URLSearchParams(location.search).get('layout');
if (layout === 'expanded' || layout === 'collapsed') mountLayout(layout === 'collapsed');
else mountFeatureDemos();

function destroyPreview() {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  window.removeEventListener('pagehide', destroyPreview);
}

if (import.meta.hot) import.meta.hot.dispose(destroyPreview);
window.addEventListener('pagehide', destroyPreview, { once: true });
