import { findXNoteSurfaceTargets } from '../src/platform/x/dom-adapter';
import { findXImageDownloadTargets } from '../src/platform/x/image-download-manager';
import { createXInterfaceLayoutManager } from '../src/platform/x/interface-layout-manager';
import type { InterfaceLayoutListener, InterfaceLayoutPreference } from '../src/features/interface-modules/interface-layout-preference';
import { findXInterfaceModuleTargets } from '../src/platform/x/interface-module-manager';
import { createXRepostTimelineManager, findXRepostTimelineTarget } from '../src/platform/x/list-repost-manager';
import { isPromotedTweetArticle } from '../src/platform/x/promoted-tweet';
import { findXVideoDownloadTargets } from '../src/platform/x/video-download-manager';
import { LocalInterfaceLayoutPreferenceRepository } from '../src/shared/storage/interface-layout-preference-repository';
import { LocalListRepostPreferenceRepository } from '../src/shared/storage/list-repost-preference-repository';
import { FakeExtensionLocalStorage } from './fakes/fake-storage';

const home = new URL('https://x.com/home');

function authorRow(name: string, id: number) {
  return `<div><div data-anchor-to-hovered-child>
    <a href="/${name}"><img alt="@${name}"></a><a href="/${name}">${name}</a>
    <a href="/${name}">@${name}</a></div><span><a href="/${name}/status/${id}">1分钟</a></span></div>`;
}

// The new home uses absolutely positioned list items. A repost has an extra
// outer article for its attribution; a quote has a separate status link frame.
beforeEach(() => {
  document.body.innerHTML = `
    <div id="page" style="max-width: 1280px; margin-inline: auto"><div id="page-row"><div id="rail"><div data-rail-overflow><nav aria-label="主要">
      <a href="/home">主页</a></nav><a id="sidebar-compose-post" href="/compose/post">帖子</a>
    </div></div>
    <div id="columns" style="display:grid"><main style="margin-inline: auto; width: 100%; max-width: 600px"><section aria-labelledby="feed-title"><h2 id="feed-title">你的主页时间线</h2>
      <div id="urt:home:following:latest"><ul>
      <li data-index="0"><div role="link" data-href="/Alice/status/101"><article>
        ${authorRow('Alice', 101)}<div>#ad</div>
        <div data-press-control><img src="https://pbs.twimg.com/amplify_video_thumb/111/img/cover"></div>
        <div data-slot="embedded-tweet-frame" role="link" data-href="/Bob/status/202">
          <article>${authorRow('Bob', 202)}<a data-engagement-action="media" href="/Bob/status/202/photo/1">
            <img src="https://pbs.twimg.com/media/photo?format=jpg&amp;name=small"></a></article>
        </div>
        <div role="group" id="actions"><div data-engagement-action="reply"><a href="/compose/post?in_reply_to=101">回复</a></div></div>
      </article></div></li>
      <li data-index="1"><div role="link" id="repost" data-href="/Carol/status/303" style="display:grid">
        <article><div><span><svg data-icon="icon-repost-fill"></svg></span><div><a href="/source">Source 已转帖</a></div></div>
        <article>${authorRow('Carol', 303)}</article></article>
      </div></li></ul></div>
    </section></main><aside>
      <form role="search"><input data-testid="SearchBox_Search_Input"></form>
      <div role="complementary" id="premium"><a href="/i/premium_sign_up?offer=1">订阅</a></div>
      <section id="trends"><h2>有什么新鲜事</h2><section aria-labelledby="trend-title"><h2 id="trend-title">当前趋势</h2></section><a href="/explore">显示更多</a></section>
      <section id="sports"><h2>NBA</h2></section>
      <section id="follow"><h2>推荐关注</h2><a href="/i/connect_people?user_id=1">显示更多</a></section>
    </aside></div></div></div>`;
});

it('mounts before the home feed and collapses only the repost frame in its virtual row', async () => {
  const repository = new LocalListRepostPreferenceRepository(new FakeExtensionLocalStorage());
  const mount = vi.fn(() => ({ updateAppearance: vi.fn(), destroy: vi.fn() }));
  const manager = createXRepostTimelineManager(mount, repository);
  await repository.setHiddenRepostDisplayMode('social-context');
  manager.sync(document, home);
  expect(mount).toHaveBeenCalledWith(expect.objectContaining({
    controlAnchor: document.querySelector('main section'), controlPlacement: 'before',
  }));
  const frame = document.querySelector<HTMLElement>('#repost')!;
  expect(frame.style.display).toBe('none');
  const button = frame.previousElementSibling?.shadowRoot?.querySelector('button');
  expect(button?.textContent).toContain('Source');
  button?.click();
  manager.sync(document, home);
  expect(frame.style.display).toBe('grid');
  expect(document.querySelectorAll('[data-twitter-enhancement-repost-placeholder]')).toHaveLength(0);
  expect(findXRepostTimelineTarget(document, new URL('https://x.com/explore'))).toBeNull();
  manager.destroy();
});

it('binds timestamp notes to the main, quoted and reposted authors', () => {
  const notes = findXNoteSurfaceTargets(document, home);
  expect(notes.map(n => [n.handle, n.anchor.getAttribute('href'), n.displayName])).toEqual([
    ['alice', '/Alice/status/101', 'Alice'], ['bob', '/Bob/status/202', 'Bob'],
    ['carol', '/Carol/status/303', 'Carol'],
  ]);
});

it('restores a recycled post frame and moves the control when home feeds switch', () => {
  const unmount = vi.fn();
  const mount = vi.fn(() => ({ updateAppearance: vi.fn(), destroy: unmount }));
  const repository = new LocalListRepostPreferenceRepository(new FakeExtensionLocalStorage());
  const manager = createXRepostTimelineManager(mount, repository);
  manager.sync(document, home);
  const frame = document.querySelector<HTMLElement>('#repost')!;
  expect(frame.style.display).toBe('none');
  frame.setAttribute('data-href', '/Other/status/404');
  frame.innerHTML = `<article>${authorRow('Other', 404)}</article>`;
  manager.sync(document, home);
  expect(frame.style.display).toBe('grid');
  const section = document.querySelector('main section')!;
  section.outerHTML = '<section aria-labelledby="for-you"><h2 id="for-you">为你推荐</h2><div id="urt:home:for-you"><ul></ul></div></section>';
  manager.sync(document, home);
  expect(unmount).toHaveBeenCalledOnce();
  expect(mount).toHaveBeenLastCalledWith(expect.objectContaining({ controlAnchor: document.querySelector('main section') }));
  manager.destroy();
});

it('finds the author preview in an open portal and skips unrelated popups', () => {
  document.body.insertAdjacentHTML('beforeend', `<div data-base-ui-portal>
    <div data-open data-base-ui-focusable><a href="/Alice"><img alt="@Alice"></a>
      <a href="/Alice">Alice</a><span><a href="/Alice">@Alice</a></span>
      <a href="/Alice/following">正在关注</a></div>
    <div data-open data-base-ui-focusable><a href="/Other">@Other</a></div>
  </div>`);
  expect(findXNoteSurfaceTargets(document, home).filter(n => n.surface === 'hover-card'))
    .toMatchObject([{ handle: 'alice', displayName: 'Alice' }]);
});

it('recognizes a standalone ad label in the semantic header, ignoring usernames, hashtags and body labels', () => {
  const article = document.querySelector('article')!;
  article.innerHTML = `<div>${authorRow('Ad', 101)}<div id="tools"><button data-slot="xds-menu-trigger">更多</button></div></div>
    <div><span>广告</span><a href="/hashtag/ad">#ad</a></div>`;
  expect(isPromotedTweetArticle(article)).toBe(false);
  article.querySelector('#tools')?.insertAdjacentHTML('afterbegin', '<span>广告</span>');
  expect(isPromotedTweetArticle(article)).toBe(true);
});

it('measures a fully filtered ad separately from the preceding collapsed repost', async () => {
  const repository = new LocalListRepostPreferenceRepository(new FakeExtensionLocalStorage());
  const manager = createXRepostTimelineManager(() => null, repository);
  await repository.setHiddenRepostDisplayMode('social-context');
  const repost = document.querySelector<HTMLElement>('#repost')!;
  const adRow = document.createElement('li');
  adRow.dataset.index = '2';
  adRow.innerHTML = `<div role="link" data-href="/Sponsor/status/404" style="display:flex!important">
    <article><div><div><div data-anchor-to-hovered-child><a href="/Sponsor">Sponsor</a></div></div>
    <div><a href="/Sponsor">广告</a><button data-slot="xds-menu-trigger">更多</button></div></div></article></div>`;
  repost.parentElement!.after(adRow);
  const frame = adRow.firstElementChild as HTMLElement;
  manager.sync(document, home);
  expect(frame).toHaveAttribute('data-te-fully-hidden');
  expect(frame.style.display).toBe('none');
  expect(repost).not.toHaveAttribute('data-te-fully-hidden');
  repost.previousElementSibling!.shadowRoot!.querySelector('button')!.click();
  expect(repost.style.display).toBe('grid');
  expect(frame).toHaveAttribute('data-te-fully-hidden');
  await repository.setHideAds(false);
  expect(frame).not.toHaveAttribute('data-te-fully-hidden');
  expect(frame.style.display).toBe('flex');
  expect(frame.style.getPropertyPriority('display')).toBe('important');
  await repository.setHideAds(true);
  frame.querySelector('article')!.innerHTML = authorRow('Next', 405);
  manager.sync(document, home);
  expect(frame).not.toHaveAttribute('data-te-fully-hidden');
  expect(frame.style.display).toBe('flex');
  manager.destroy();
});

it('only accepts an advertiser profile disclosure beside the menu of the owning article', () => {
  const article = document.querySelector('article')!;
  article.innerHTML = `<div><div><div data-anchor-to-hovered-child><a href="/Ad">Ad</a></div></div>
    <div><a id="label" href="/other">广告</a><button data-slot="xds-menu-trigger">更多</button></div></div>
    <a href="/Ad">广告</a><article><div data-testid="promotedIndicator"></div></article>`;
  expect(isPromotedTweetArticle(article)).toBe(false);
  const label = article.querySelector('#label')!;
  label.setAttribute('href', '/Ad');
  label.setAttribute('aria-hidden', 'true');
  expect(isPromotedTweetArticle(article)).toBe(false);
  label.removeAttribute('aria-hidden');
  expect(isPromotedTweetArticle(article)).toBe(true);
});

it('releases the virtual row when a fully hidden repost gains a divider or is unmounted', async () => {
  const frame = document.querySelector<HTMLElement>('#repost')!;
  const repository = new LocalListRepostPreferenceRepository(new FakeExtensionLocalStorage());
  const manager = createXRepostTimelineManager(() => null, repository);
  manager.sync(document, home);
  expect(frame).toHaveAttribute('data-te-fully-hidden');
  await repository.setHiddenRepostDisplayMode('divider');
  expect(frame).not.toHaveAttribute('data-te-fully-hidden');
  expect(frame.previousElementSibling).toHaveAttribute('data-twitter-enhancement-repost-placeholder', 'divider');
  await repository.setHiddenRepostDisplayMode('hidden');
  expect(frame).toHaveAttribute('data-te-fully-hidden');
  manager.destroy();
  expect(frame).not.toHaveAttribute('data-te-fully-hidden');
  expect(frame.style.display).toBe('grid');
});

it('finds the native video poster and quoted original photo before playback', () => {
  expect(findXVideoDownloadTargets()).toMatchObject([{
    anchor: document.querySelector('#actions'), handle: 'alice', tweetId: '101',
    identities: [{ family: 'amplify_video', id: '111' }],
  }]);
  expect(findXImageDownloadTargets()).toMatchObject([{ handle: 'bob', tweetId: '202', photoIndex: 1 }]);
});

it('resolves a quoted video against its own tweet and never mixes it with the main video', () => {
  const quote = document.querySelector('[data-slot="embedded-tweet-frame"] article')!;
  quote.insertAdjacentHTML('beforeend', '<img src="https://pbs.twimg.com/ext_tw_video_thumb/222/img/cover">');
  expect(findXVideoDownloadTargets()).toMatchObject([{
    tweetId: '101', identities: [{ family: 'amplify_video', id: '111' }],
  }]);
  document.querySelector('[data-press-control]')?.remove();
  expect(findXVideoDownloadTargets()).toMatchObject([{
    tweetId: '202', handle: 'bob', identities: [{ family: 'ext_tw_video', id: '222' }],
  }]);
});

it('identifies each right sidebar card without selecting its enclosing aside or the sports card', () => {
  expect(findXInterfaceModuleTargets().map(t => [t.module, t.element.id || t.element.tagName])).toEqual([
    ['sidebarSearch', 'FORM'], ['premiumSubscription', 'premium'], ['trends', 'trends'], ['followRecommendations', 'follow'],
  ]);
});

// The ad footer is a separate link. An article preview links to a status and
// its cover uses the same image CDN as an ordinary photo.
const semanticCards = `
  <p id="post-text">Post text</p>
  <div id="video-ad"><div style="aspect-ratio: 1 / 1"><button><img src="https://pbs.twimg.com/amplify_video_thumb/40/img/poster"></button></div>
    <a target="_blank" href="https://example.com/game"><span data-slot="xds-button">了解更多</span></a></div>
  <div id="image-ad"><a target="_blank" href="https://example.com/server"><div style="aspect-ratio: 1 / 1"><img src="https://pbs.twimg.com/media/server"></div></a>
    <a target="_blank" href="https://example.com/server">来自 example.com 的广告</a></div>
  <div data-slot="embedded-tweet-frame" role="link" data-href="/Bob/status/202"><article><header>Bob</header>
    <div><a id="article-card" class="group/article-card" href="/Bob/status/202"><div><img src="https://pbs.twimg.com/media/cover"></div><h2>文章标题</h2></a></div>
  </article></div>`;

const semanticCarousel = `
  <div id="carousel-spacer" style="height: 0; padding-bottom: calc(74.8503% - 2.994px)">
    <div class="absolute"><div class="group/carousel"><div><div class="snap-x">
      <div class="slide" style="aspect-ratio: 0.8 / 1"><a data-engagement-action="media" href="/Alice/status/101/photo/1"><img src="https://pbs.twimg.com/media/one"></a></div>
      <div class="slide" style="aspect-ratio: 0.8 / 1"><a data-engagement-action="media" href="/Alice/status/101/photo/2"><img src="https://pbs.twimg.com/media/two"></a></div>
      <div class="slide" style="aspect-ratio: 0.8 / 1"><div data-press-control><video></video></div></div>
    </div></div></div></div>
  </div>`;

it('caps complete semantic ad and article cards when loaded into a wide home feed', async () => {
  const main = document.querySelector('main')!;
  const post = main.querySelector('article')!;
  vi.spyOn(main, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 600, 800));
  const repository = new LocalInterfaceLayoutPreferenceRepository(new FakeExtensionLocalStorage());
  const manager = createXInterfaceLayoutManager(repository);
  await repository.setPreference('rightSidebarVisible', false);
  post.innerHTML = semanticCards;
  const cards = Array.from(post.querySelectorAll<HTMLElement>('#video-ad, #image-ad, #article-card'));
  for (const card of cards) {
    vi.spyOn(card, 'getBoundingClientRect').mockImplementation(() =>
      new DOMRect(0, 0, main.style.width === '600px' ? 518 : 1351, 300));
  }
  const poster = post.querySelector<HTMLImageElement>('#video-ad img')!;
  poster.removeAttribute('src');
  manager.sync();
  for (const card of cards) expect(card.style.maxWidth).toBe('min(100%, 518px)');
  poster.src = 'https://pbs.twimg.com/amplify_video_thumb/40/img/poster';
  manager.sync();
  post.querySelector('#video-ad button')!.outerHTML = '<div><video></video></div>';
  manager.sync();
  expect(post.querySelector('#video-ad')).toHaveStyle({ maxWidth: 'min(100%, 518px)' });
  for (const element of post.querySelectorAll<HTMLElement>('#post-text, header, h2, video, [data-slot="embedded-tweet-frame"]')) {
    expect(element.style.maxWidth).toBe('');
  }
  for (const part of ['cover', 'body']) {
    post.setAttribute('data-article-part', part);
    manager.sync();
    for (const card of cards) expect(card.style.maxWidth).toBe('');
    post.removeAttribute('data-article-part');
    manager.sync();
    for (const card of cards) expect(card.style.maxWidth).toBe('min(100%, 518px)');
  }
  manager.destroy();
});

it('caps the native height of a semantic carousel while letting the strip and slides use the available space', async () => {
  const main = document.querySelector('main')!;
  const post = main.querySelector('article')!;
  post.innerHTML = semanticCarousel;
  const spacer = post.querySelector<HTMLElement>('#carousel-spacer')!;
  const original = spacer.style.cssText;
  vi.spyOn(main, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 600, 800));
  vi.spyOn(spacer, 'getBoundingClientRect').mockImplementation(() =>
    new DOMRect(0, 0, 518, main.style.width === '600px' ? 385 : 1008));
  const repository = new LocalInterfaceLayoutPreferenceRepository(new FakeExtensionLocalStorage());
  const manager = createXInterfaceLayoutManager(repository);
  await repository.setPreference('leftNavigationExpanded', false);
  expect(spacer.style.paddingBottom).toContain('385px');
  expect(spacer.style.maxWidth).toBe('none');
  for (const slide of spacer.querySelectorAll<HTMLElement>('.slide')) expect(slide.style.maxWidth).toBe('');
  manager.sync();
  await repository.setPreference('leftNavigationExpanded', true);
  expect(spacer.style.cssText).toBe(original);
  manager.destroy();
});

it('fills the centered grid track for each collapsed sidebar combination and restores native sizing', async () => {
  const repository = new LocalInterfaceLayoutPreferenceRepository(new FakeExtensionLocalStorage());
  const manager = createXInterfaceLayoutManager(repository);
  vi.spyOn(document.body, 'clientWidth', 'get').mockReturnValue(1585);
  const page = document.querySelector<HTMLElement>('#page')!;
  const columns = document.querySelector<HTMLElement>('#columns')!;
  const main = columns.querySelector('main')!;
  function expectExpandedMain() {
    expect(main.style.width).toBe('100%');
    expect(main.style.maxWidth).toBe('none');
    expect(main.style.marginInline).toBe('auto');
  }
  manager.sync();
  expect(main.style.maxWidth).toBe('600px');
  expect(page.style.minWidth).toBe('');
  await repository.setPreference('leftNavigationExpanded', false);
  expectExpandedMain();
  expect(page.style.minWidth).toBe('calc(100% - 152.5px)');
  expect(page.style.marginInlineStart).toBe('0px');
  expect(page.style.marginInlineEnd).toBe('auto');
  expect(columns.style.gridTemplateColumns).toContain('152.5px');
  await repository.setPreference('rightSidebarVisible', false);
  expectExpandedMain();
  expect(page.style.minWidth).toBe('100%');
  expect(document.documentElement).toHaveAttribute('data-te-left-navigation-collapsed');
  expect(columns.style.gridTemplateColumns).toBe('minmax(0, 1fr) 80px');
  expect(document.querySelector('[data-twitter-enhancement-left-layout-control]')?.shadowRoot?.querySelector('button')).toHaveAccessibleName('展开左侧导航');
  const rightControl = document.querySelector<HTMLElement>('[data-twitter-enhancement-right-layout-control]')!;
  expect(rightControl.parentElement).toBe(document.body);
  expect(rightControl.style.position).toBe('fixed');
  expect(rightControl.shadowRoot?.querySelector('button')).toHaveAccessibleName('显示右侧栏');
  await repository.setPreference('leftNavigationExpanded', true);
  expectExpandedMain();
  expect(page.style.minWidth).toBe('calc(100% - 152.5px)');
  expect(page.style.marginInlineStart).toBe('auto');
  expect(page.style.marginInlineEnd).toBe('0px');
  await repository.setPreference('rightSidebarVisible', true);
  expect(page.style.minWidth).toBe('');
  expect(page.style.marginInline).toBe('auto');
  expect(document.documentElement).not.toHaveAttribute('data-te-left-navigation-collapsed');
  expect(columns.style.gridTemplateColumns).toBe('');
  expect(main.style.maxWidth).toBe('600px');
  expect(main.style.getPropertyPriority('width')).toBe('');
  await repository.setPreference('rightSidebarVisible', false);
  manager.destroy();
  expect(main.style.width).toBe('100%');
  expect(main.style.maxWidth).toBe('600px');
  expect(columns.style.gridTemplateColumns).toBe('');
  expect(page.style.minWidth).toBe('');
});

it('uses the saved wide start while storage is pending and merges changes received during that read', async () => {
  const read = Promise.withResolvers<InterfaceLayoutPreference>();
  const subscribe = vi.fn((_listener: InterfaceLayoutListener) => () => {});
  const manager = createXInterfaceLayoutManager({
    getPreference: () => read.promise, setPreference: vi.fn(), subscribe,
  });
  const html = document.documentElement;
  const main = document.querySelector('main')!;
  const sidebar = document.querySelector('aside')!;
  try {
    html.setAttribute('data-te-initial-wide-layout', '');
    manager.sync();
    expect(html).toHaveAttribute('data-te-left-navigation-collapsed');
    expect(main.style.maxWidth).toBe('none');
    expect(sidebar.style.width).toBe('0px');
    expect(html).not.toHaveAttribute('data-te-initial-wide-layout');

    subscribe.mock.calls[0]![0]({ leftNavigationExpanded: true });
    read.resolve({ leftNavigationExpanded: false, rightSidebarVisible: true });
    await read.promise;
    expect(html).not.toHaveAttribute('data-te-left-navigation-collapsed');
    expect(sidebar.style.width).toBe('');
    // A stale registration cannot override settings that have already loaded.
    html.setAttribute('data-te-initial-wide-layout', '');
    manager.sync();
    expect(html).not.toHaveAttribute('data-te-left-navigation-collapsed');
  } finally {
    manager.destroy();
  }
});

it('waits for the native grid stylesheet before measuring first-frame media', async () => {
  const grid = document.getElementById('columns')!;
  grid.style.display = 'block';
  const main = grid.querySelector('main')!;
  const post = main.querySelector('article')!;
  post.innerHTML = semanticCards;
  const card = document.getElementById('article-card')!;
  vi.spyOn(main, 'getBoundingClientRect').mockImplementation(() =>
    new DOMRect(0, 0, grid.style.display === 'grid' ? 600 : 1443, 800));
  const measure = vi.spyOn(card, 'getBoundingClientRect').mockImplementation(() =>
    new DOMRect(0, 0, main.style.width === '600px' ? 518 : 1409, 300));
  const repository = new LocalInterfaceLayoutPreferenceRepository(new FakeExtensionLocalStorage());
  const manager = createXInterfaceLayoutManager(repository);
  try {
    await repository.setPreference('rightSidebarVisible', false);
    expect(measure).not.toHaveBeenCalled();
    grid.style.display = 'grid';
    manager.sync();
    expect(main.style.maxWidth).toBe('none');
    expect(card.style.maxWidth).toBe('min(100%, 518px)');
  } finally {
    manager.destroy();
  }
});

it('keeps a replacement rail collapsed before the next scan and releases it on expand or destroy', async () => {
  const stylesheet = document.createElement('style');
  stylesheet.textContent = '#rail { --x-sidebar-open: 1; }';
  document.head.append(stylesheet);
  const repository = new LocalInterfaceLayoutPreferenceRepository(new FakeExtensionLocalStorage());
  await repository.setPreference('leftNavigationExpanded', false);
  const manager = createXInterfaceLayoutManager(repository);
  const root = document.documentElement;
  const currentRailState = () => getComputedStyle(document.getElementById('rail')!).getPropertyValue('--x-sidebar-open').trim();
  try {
    await vi.waitFor(() => expect(root).toHaveAttribute('data-te-left-navigation-collapsed'));
    expect(currentRailState()).toBe('0');
    const row = document.getElementById('page-row')!;
    document.getElementById('rail')!.remove();
    manager.sync();
    row.insertAdjacentHTML('afterbegin', '<div id="rail"><div data-rail-overflow></div></div>');
    expect(currentRailState()).toBe('0');
    manager.sync();
    expect(document.getElementById('page')!.style.minWidth).not.toBe('');
    const overflow = row.querySelector('[data-rail-overflow]')!;
    overflow.innerHTML = '<nav><a href="/home">主页</a></nav>';
    manager.sync();
    expect(overflow.querySelector('[data-twitter-enhancement-left-layout-control]')?.shadowRoot?.querySelector('button')).toHaveAccessibleName('展开左侧导航');
    await repository.setPreference('leftNavigationExpanded', true);
    expect(currentRailState()).toBe('1');
    await repository.setPreference('leftNavigationExpanded', false);
  } finally {
    manager.destroy();
    stylesheet.remove();
  }
  expect(root).not.toHaveAttribute('data-te-left-navigation-collapsed');
});

it('widens the replacement timeline on navigation between bookmarks, likes, profiles and conversations', async () => {
  const repository = new LocalInterfaceLayoutPreferenceRepository(new FakeExtensionLocalStorage());
  const manager = createXInterfaceLayoutManager(repository);
  const section = document.querySelector('main section')!;
  let previous = section.querySelector<HTMLElement>('[id^="urt:"]')!;
  await repository.setPreference('rightSidebarVisible', false);
  try {
    for (const id of ['urt:bookmarks', 'urt:likes:123', 'urt:profile:Alice', 'urt:conversation:101']) {
      section.innerHTML = `<div style="display:contents"><div id="${id}" style="max-width:600px!important"><ul>
        <li data-index="0"><div><article>Post<div id="urt:embedded"><ul></ul></div></article></div></li>
        <li data-index="1"><div role="link" data-href="/Bob/status/202"><article>Reply</article></div></li>
      </ul></div></div>`;
      manager.sync();
      const feed = document.getElementById(id)!;
      expect(feed.style.maxWidth).toBe('none');
      expect(feed.style.width).toBe('100%');
      expect(document.getElementById('urt:embedded')!.style.width).toBe('');
      expect(previous).not.toHaveAttribute('data-twitter-enhancement-layout');
      previous = feed;
    }
    await repository.setPreference('rightSidebarVisible', true);
    expect(previous.style.maxWidth).toBe('600px');
    expect(previous.style.getPropertyPriority('max-width')).toBe('important');
    expect(previous.style.width).toBe('');
  } finally {
    manager.destroy();
  }
});

it('limits the focused post video without narrowing its author, text or metadata', async () => {
  const main = document.querySelector('main')!;
  main.querySelector('section')!.innerHTML = `<div id="urt:conversation:101"><ul><li data-index="0">
    <div><article><div><div id="post-body"><header>Alice</header><p>Post</p>
      <div><div id="attachment" style="aspect-ratio:4 / 3">
        <div data-press-control style="aspect-ratio:4 / 3"><video></video></div>
      </div></div><time>Today</time></div><div role="group"><button>Reply</button></div></div></article></div>
  </li></ul></div>`;
  const attachment = document.getElementById('attachment')!;
  const body = document.getElementById('post-body')!;
  vi.spyOn(main, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 600, 800));
  for (const element of [body, attachment]) {
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 566, 400));
  }
  const repository = new LocalInterfaceLayoutPreferenceRepository(new FakeExtensionLocalStorage());
  const manager = createXInterfaceLayoutManager(repository);
  try {
    await repository.setPreference('rightSidebarVisible', false);
    expect(attachment.style.maxWidth).toBe('min(100%, 566px)');
    expect(body.style.maxWidth).toBe('');
  } finally {
    manager.destroy();
  }
});

it('uses the current desktop cap on resize and releases the page when X switches to mobile', async () => {
  const repository = new LocalInterfaceLayoutPreferenceRepository(new FakeExtensionLocalStorage());
  const manager = createXInterfaceLayoutManager(repository);
  const viewport = vi.spyOn(document.body, 'clientWidth', 'get').mockReturnValue(1585);
  const page = document.querySelector<HTMLElement>('#page')!;
  const columns = document.querySelector<HTMLElement>('#columns')!;
  const sidebar = columns.querySelector('aside')!;
  manager.sync();
  await repository.setPreference('leftNavigationExpanded', false);
  viewport.mockReturnValue(1100);
  page.style.maxWidth = '1024px';
  manager.sync();
  expect(page.style.minWidth).toBe('calc(100% - 38px)');
  expect(columns.style.gridTemplateColumns).toContain('38px');
  sidebar.style.display = 'none';
  manager.sync();
  expect(page.style.minWidth).toBe('');
  expect(page.style.maxWidth).toBe('1024px');
  expect(columns.style.gridTemplateColumns).toBe('');
  expect(document.querySelector('[data-twitter-enhancement-right-layout-control]')).toBeNull();
  manager.destroy();
});
