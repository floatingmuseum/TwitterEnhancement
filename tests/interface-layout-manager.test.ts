import { createXInterfaceLayoutManager } from '../src/platform/x/interface-layout-manager';
import {
  INTERFACE_LAYOUT_STORAGE_KEYS,
  LocalInterfaceLayoutPreferenceRepository,
} from '../src/shared/storage/interface-layout-preference-repository';
import { FakeExtensionLocalStorage } from './fakes/fake-storage';

function navItem(testId: string, label: string): string {
  return `
    <a data-testid="${testId}" href="/${label}" style="display: flex; flex-direction: column">
      <div><div><svg viewBox="0 0 24 24"><path /></svg></div><div>${label}</div></div>
    </a>
  `;
}

function navItemWithoutAppTabBarTestId(
  href: string,
  label: string,
  testId?: string,
): string {
  return `
    <a ${testId ? `data-testid="${testId}"` : ''} aria-label="${label}" href="${href}" style="display: flex; flex-direction: column">
      <div><div><svg viewBox="0 0 24 24"><path /></svg></div><div>${label}</div></div>
    </a>
  `;
}

function renderDesktopXLayout() {
  document.body.innerHTML = `
    <header role="banner" style="width: 275px">
      <div id="left-fixed"><div id="left-scroll"><div id="left-inner">
        <a aria-label="X" href="/home" style="display: flex"><svg viewBox="0 0 24 24"><path /></svg></a>
        <nav role="navigation" style="width: 259px">
          ${navItem('AppTabBar_Home_Link', '主页')}
          ${navItem('AppTabBar_Explore_Link', '探索')}
          ${navItemWithoutAppTabBarTestId('/i/grok', 'Grok')}
          ${navItemWithoutAppTabBarTestId('/i/bookmarks', '书签')}
          ${navItemWithoutAppTabBarTestId('/i/jf/creators/studio', '创作者工作室')}
          ${navItemWithoutAppTabBarTestId('/i/premium_sign_up', 'Premium', 'premium-signup-tab')}
          ${navItem('AppTabBar_More_Menu', '更多')}
        </nav>
        <a data-testid="SideNav_NewTweet_Button" href="/compose/post">发帖</a>
        <button data-testid="SideNav_AccountSwitcher_Button">
          <span id="account-avatar">Avatar</span>
          <span id="account-detail">floatingmuseum</span>
          <span id="account-more">...</span>
        </button>
      </div></div></div>
    </header>
    <main id="page-main">
      <div id="column-scroll" style="width: 1050px">
        <div id="column-shell" style="width: 1050px">
          <div id="columns" style="display: flex; position: relative; width: 1050px">
            <div data-testid="primaryColumn" style="max-width: 600px; width: 600px">
              <div id="timeline-content" style="max-width: 600px; width: 600px">
                <section><div data-testid="cellInnerDiv"><article>Post</article></div></section>
              </div>
            </div>
            <aside data-testid="sidebarColumn" style="margin-right: 70px; width: 350px">
              <section>Sidebar</section>
              <nav aria-label="Footer"><a href="/tos">Terms</a><a href="/privacy">Privacy</a></nav>
            </aside>
          </div>
        </div>
      </div>
    </main>
    <button data-testid="GrokDrawerHeader" aria-label="Grok">Grok</button>
  `;
  const railButton = document.querySelector<HTMLElement>(
    '[data-testid="GrokDrawerHeader"]',
  );
  if (railButton) {
    railButton.getBoundingClientRect = () =>
      ({
        bottom: 55,
        height: 55,
        left: 900,
        right: 955,
        top: 0,
        width: 55,
        x: 900,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
  }
}

function shadowButton(hostSelector: string): HTMLButtonElement | null {
  return document
    .querySelector<HTMLElement>(hostSelector)
    ?.shadowRoot?.querySelector<HTMLButtonElement>('button') ?? null;
}

function requiredElement(selector: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) {
    throw new Error(`Missing test element: ${selector}`);
  }
  return element;
}

function rectWithWidth(width: number): DOMRect {
  return {
    bottom: 200,
    height: 200,
    left: 0,
    right: width,
    top: 0,
    width,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect;
}

function mockMediaWidth(element: HTMLElement, nativeWidth = 518) {
  const primary = requiredElement('[data-testid="primaryColumn"]');
  vi.spyOn(element, 'getBoundingClientRect').mockImplementation(() =>
    rectWithWidth(
      primary.style.width === '600px' || nativeWidth === 180
        ? nativeWidth
        : nativeWidth + 600,
    ),
  );
}

function renderDesktopTweetMedia() {
  renderDesktopXLayout();
  const primary = requiredElement('[data-testid="primaryColumn"]');
  vi.spyOn(primary, 'getBoundingClientRect').mockImplementation(() =>
    rectWithWidth(primary.style.maxWidth === 'none' ? 1200 : 600),
  );
  requiredElement('article').innerHTML = `
    <div id="tweet-avatar"><img src="https://pbs.twimg.com/profile_images/avatar.jpg" /></div>
    <div id="tweet-body">
      <div data-testid="User-Name">Alice</div>
      <div data-testid="tweetText">Tweet text keeps the expanded column width.</div>
      <div id="single-media" style="max-width: 90% !important; box-sizing: content-box" data-twitter-enhancement-layout="original-media">
        <div><a href="/Alice/status/1/photo/1"><div data-testid="tweetPhoto"><img /></div></a></div>
      </div>
      <div id="multi-media">
        <div style="display: flex">
          <a href="/Alice/status/2/photo/1"><div data-testid="tweetPhoto"><img /></div></a>
          <a href="/Alice/status/2/photo/2"><div data-testid="tweetPhoto"><img /></div></a>
        </div>
      </div>
      <div id="pending-video"><div data-testid="tweetPhoto"><img /><button data-testid="playButton">Play</button></div></div>
      <div id="played-video"><div data-testid="videoPlayer"><video></video><div role="group"><button>Pause</button><button>Volume</button></div></div></div>
      <div id="component-video"><div data-testid="videoComponent"><video></video></div></div>
      <div id="direct-video"><video></video></div>
      <div id="link-card"><div data-testid="card.wrapper"><a href="https://example.com"><img /><span>Link title</span></a></div></div>
      <div id="narrow-media" style="width: 180px"><div data-testid="tweetPhoto"><img /></div></div>
      <div role="group"><button data-testid="reply">Reply</button></div>
    </div>
  `;
  for (const id of [
    'single-media',
    'multi-media',
    'pending-video',
    'played-video',
    'component-video',
    'direct-video',
    'link-card',
  ]) {
    mockMediaWidth(requiredElement(`#${id}`));
  }
  mockMediaWidth(requiredElement('#narrow-media'), 180);
  primary.insertAdjacentHTML(
    'beforeend',
    '<div id="profile-media-grid"><div data-testid="tweetPhoto"><img /></div></div><div role="dialog"><article><div id="dialog-media"><div data-testid="tweetPhoto"><img /></div></div></article></div>',
  );
  requiredElement('[data-testid="sidebarColumn"]').insertAdjacentHTML(
    'beforeend',
    '<article><div id="sidebar-media"><div data-testid="tweetPhoto"><img /></div></div></article>',
  );
  document.body.insertAdjacentHTML(
    'beforeend',
    '<article><div id="outside-media"><div data-testid="tweetPhoto"><img /></div></div></article>',
  );
  return primary;
}

async function collapseDesktopMedia(
  leftNavigationExpanded = false,
  rightSidebarVisible = false,
) {
  const primary = renderDesktopTweetMedia();
  const storage = new FakeExtensionLocalStorage();
  storage.values.set(
    INTERFACE_LAYOUT_STORAGE_KEYS.leftNavigationExpanded,
    leftNavigationExpanded,
  );
  storage.values.set(
    INTERFACE_LAYOUT_STORAGE_KEYS.rightSidebarVisible,
    rightSidebarVisible,
  );
  const repository = new LocalInterfaceLayoutPreferenceRepository(storage);
  const manager = createXInterfaceLayoutManager(repository);
  await vi.waitFor(() => {
    expect(primary).toHaveStyle({ width: 'auto' });
  });
  return { manager, primary, repository };
}

function appendPhotoCarousel(
  parent: HTMLElement,
  paddingBottom = '66%',
  nativeHeight = 324,
) {
  parent.insertAdjacentHTML('beforeend', `
    <div id="photo-carousel" style="max-width: 95% !important">
      <div id="carousel-padding" style="padding-bottom: ${paddingBottom}">
        <nav role="navigation" style="position: absolute; inset: 0">
          <button aria-label="Previous">Previous</button>
          <div data-testid="ScrollSnap-SwipeableList">
            <div data-testid="ScrollSnap-List" role="tablist" style="overflow-x: auto">
              ${[1, 2, 3, 4].map((index) => `
                <div role="presentation" style="flex-shrink: 0">
                  <div style="aspect-ratio: 0.5625 / 1">
                    <a href="/Alice/status/3/photo/${index}"><div data-testid="tweetPhoto"><img /></div></a>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
          <button aria-label="Next">Next</button>
        </nav>
      </div>
    </div>
  `);
  const target = requiredElement('#photo-carousel');
  const spacer = requiredElement('#carousel-padding');
  const list = requiredElement('#photo-carousel [data-testid="ScrollSnap-List"]');
  const primary = requiredElement('[data-testid="primaryColumn"]');
  mockMediaWidth(target);
  const measure = vi.spyOn(spacer, 'getBoundingClientRect').mockImplementation(() => ({
    ...rectWithWidth(492),
    height: primary.style.width === '600px' ? nativeHeight : nativeHeight + 600,
  }));
  return { target, spacer, list, measure };
}

describe('X interface layout manager', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('collapses and restores the left navigation from its inline control', async () => {
    renderDesktopXLayout();
    const storage = new FakeExtensionLocalStorage();
    storage.values.set(
      INTERFACE_LAYOUT_STORAGE_KEYS.leftNavigationExpanded,
      false,
    );
    const repository = new LocalInterfaceLayoutPreferenceRepository(storage);
    const manager = createXInterfaceLayoutManager(repository);

    await vi.waitFor(() => {
      expect(document.querySelector('header')).toHaveStyle({ width: '88px' });
    });
    expect(document.querySelector('nav[role="navigation"]')).toHaveStyle({
      width: '72px',
    });
    expect(
      document.querySelector('[data-testid="AppTabBar_Home_Link"]'),
    ).toHaveStyle({ alignItems: 'center', justifyContent: 'center' });
    expect(
      document.querySelector(
        '[data-testid="AppTabBar_Home_Link"] > div',
      ),
    ).toHaveStyle({ alignSelf: 'center' });
    for (const href of [
      '/i/grok',
      '/i/bookmarks',
      '/i/jf/creators/studio',
      '/i/premium_sign_up',
    ]) {
      expect(document.querySelector(`a[href="${href}"]`)).toHaveStyle({
        alignItems: 'center',
        justifyContent: 'center',
      });
      expect(document.querySelector(`a[href="${href}"] > div`)).toHaveStyle({
        alignSelf: 'center',
      });
    }
    expect(document.querySelector('[data-testid="premium-signup-tab"]')).toHaveStyle({
      alignItems: 'center',
      justifyContent: 'center',
    });
    expect(document.querySelector('a[aria-label="X"]')).toHaveStyle({
      justifyContent: 'center',
      width: '72px',
    });
    expect(
      document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]'),
    ).toHaveStyle({ justifyContent: 'center', width: '72px' });
    expect(document.getElementById('columns')).toHaveStyle({
      columnGap: '30px',
      width: '100%',
    });
    expect(document.getElementById('column-shell')).toHaveStyle({
      width: '100%',
    });
    expect(document.getElementById('column-scroll')).toHaveStyle({
      width: '100%',
    });
    expect(document.querySelector('[data-testid="primaryColumn"]')).toHaveStyle({
      maxWidth: 'none',
      width: 'auto',
    });
    expect(
      document.querySelector('[data-testid="AppTabBar_Home_Link"] > div > div:last-child'),
    ).toHaveStyle({ display: 'none' });
    expect(
      document.querySelector('[data-testid="SideNav_NewTweet_Button"]'),
    ).toHaveStyle({ display: 'none' });
    expect(document.getElementById('account-detail')).toHaveStyle({
      display: 'none',
    });
    const host = document.querySelector<HTMLElement>(
      '[data-twitter-enhancement-left-layout-control]',
    );
    expect(host?.shadowRoot?.querySelector('a[href="/compose/post"]')).not.toBeNull();
    const button = shadowButton(
      '[data-twitter-enhancement-left-layout-control]',
    );
    expect(button).toHaveAttribute('aria-label', '展开左侧导航');

    button?.click();
    await vi.waitFor(() => {
      expect(document.querySelector('header')).toHaveStyle({ width: '275px' });
    });
    expect(
      document.querySelector('[data-testid="AppTabBar_Home_Link"] > div > div:last-child'),
    ).not.toHaveStyle({ display: 'none' });
    expect(
      document.querySelector('[data-testid="SideNav_NewTweet_Button"]'),
    ).not.toHaveStyle({ display: 'none' });
    expect(
      storage.values.get(INTERFACE_LAYOUT_STORAGE_KEYS.leftNavigationExpanded),
    ).toBe(true);
    expect(document.getElementById('columns')).toHaveStyle({ width: '1050px' });
    expect(document.querySelector('[data-testid="primaryColumn"]')).toHaveStyle({
      maxWidth: '600px',
      width: '600px',
    });

    manager.destroy();
    expect(
      document.querySelector('[data-twitter-enhancement-left-layout-control]'),
    ).toBeNull();
  });

  it('hides the complete right sidebar and lets timeline content fill its space', async () => {
    renderDesktopXLayout();
    const storage = new FakeExtensionLocalStorage();
    storage.values.set(
      INTERFACE_LAYOUT_STORAGE_KEYS.rightSidebarVisible,
      false,
    );
    const repository = new LocalInterfaceLayoutPreferenceRepository(storage);
    const manager = createXInterfaceLayoutManager(repository);

    const primary = document.querySelector<HTMLElement>(
      '[data-testid="primaryColumn"]',
    );
    const sidebar = document.querySelector<HTMLElement>(
      '[data-testid="sidebarColumn"]',
    );
    await vi.waitFor(() => {
      expect(sidebar).toHaveStyle({ width: '0px', visibility: 'hidden' });
    });
    expect(sidebar).toHaveStyle({ marginRight: '70px', overflow: 'hidden' });
    expect(primary).toHaveStyle({ maxWidth: 'none', width: 'auto' });
    expect(document.getElementById('timeline-content')).toHaveStyle({
      maxWidth: 'none',
      width: '100%',
    });
    expect(document.getElementById('columns')).toHaveStyle({ width: '100%' });
    expect(document.getElementById('columns')).toHaveStyle({ columnGap: '0px' });
    expect(document.getElementById('column-shell')).toHaveStyle({
      width: '100%',
    });
    expect(document.querySelector('header')).toHaveStyle({
      flex: '0 0 275px',
      width: '275px',
    });
    const button = shadowButton(
      '[data-twitter-enhancement-right-layout-control]',
    );
    expect(button).toHaveAttribute('aria-label', '显示右侧栏');
    const rightHost = document.querySelector<HTMLElement>(
      '[data-twitter-enhancement-right-layout-control]',
    );
    expect(rightHost?.parentElement).toBe(document.body);
    expect(rightHost).toHaveStyle({ left: '905.5px', position: 'fixed' });

    button?.click();
    await vi.waitFor(() => {
      expect(sidebar).toHaveStyle({ width: '350px' });
    });
    expect(sidebar).toHaveStyle({ marginRight: '70px' });
    expect(primary).toHaveStyle({ maxWidth: '600px', width: '600px' });
    expect(document.getElementById('timeline-content')).toHaveStyle({
      maxWidth: '600px',
      width: '600px',
    });
    expect(document.getElementById('columns')).toHaveStyle({ width: '1050px' });

    shadowButton('[data-twitter-enhancement-right-layout-control]')?.click();
    await vi.waitFor(() => {
      expect(sidebar).toHaveStyle({ width: '0px' });
    });
    manager.destroy();
    expect(sidebar).toHaveStyle({ marginRight: '70px', width: '350px' });
    expect(primary).toHaveStyle({ maxWidth: '600px', width: '600px' });
    expect(
      document.querySelector('[data-twitter-enhancement-right-layout-control]'),
    ).toBeNull();
  });

  it('expands every column wrapper when both side areas are collapsed', async () => {
    renderDesktopXLayout();
    const storage = new FakeExtensionLocalStorage();
    storage.values.set(
      INTERFACE_LAYOUT_STORAGE_KEYS.leftNavigationExpanded,
      false,
    );
    storage.values.set(
      INTERFACE_LAYOUT_STORAGE_KEYS.rightSidebarVisible,
      false,
    );
    const repository = new LocalInterfaceLayoutPreferenceRepository(storage);
    const manager = createXInterfaceLayoutManager(repository);

    await vi.waitFor(() => {
      expect(
        document.querySelector('[data-testid="sidebarColumn"]'),
      ).toHaveStyle({ width: '0px' });
    });
    for (const id of ['columns', 'column-shell', 'column-scroll']) {
      expect(document.getElementById(id)).toHaveStyle({ width: '100%' });
    }
    expect(document.getElementById('columns')).toHaveStyle({ columnGap: '0px' });
    expect(document.querySelector('[data-testid="primaryColumn"]')).toHaveStyle({
      maxWidth: 'none',
      width: 'auto',
    });
    expect(document.getElementById('timeline-content')).toHaveStyle({
      maxWidth: 'none',
      width: '100%',
    });

    shadowButton('[data-twitter-enhancement-left-layout-control]')?.click();
    await vi.waitFor(() => {
      expect(document.querySelector('header')).toHaveStyle({
        flex: '0 0 275px',
        width: '275px',
      });
    });
    expect(document.getElementById('columns')).toHaveStyle({
      columnGap: '0px',
      width: '100%',
    });

    manager.destroy();
  });

  it('leaves X native responsive layout untouched when desktop nodes are absent', async () => {
    renderDesktopXLayout();
    for (const label of document.querySelectorAll(
      'nav[role="navigation"] > a > div > div:last-child',
    )) {
      label.remove();
    }
    document.querySelector('[data-testid="sidebarColumn"]')?.remove();
    const storage = new FakeExtensionLocalStorage();
    storage.values.set(
      INTERFACE_LAYOUT_STORAGE_KEYS.leftNavigationExpanded,
      false,
    );
    storage.values.set(
      INTERFACE_LAYOUT_STORAGE_KEYS.rightSidebarVisible,
      false,
    );
    const repository = new LocalInterfaceLayoutPreferenceRepository(storage);
    const manager = createXInterfaceLayoutManager(repository);

    await Promise.resolve();
    manager.sync();

    expect(document.querySelector('header')).toHaveStyle({ width: '275px' });
    expect(
      document.querySelector('[data-twitter-enhancement-left-layout-control]'),
    ).toBeNull();
    expect(
      document.querySelector('[data-twitter-enhancement-right-layout-control]'),
    ).toBeNull();
    manager.destroy();
  });

  it.each([
    { leftNavigationExpanded: false, rightSidebarVisible: false },
    { leftNavigationExpanded: false, rightSidebarVisible: true },
    { leftNavigationExpanded: true, rightSidebarVisible: false },
  ])('keeps media groups at native width when side areas collapse: %j', async (preference) => {
    const { manager, primary } = await collapseDesktopMedia(
      preference.leftNavigationExpanded,
      preference.rightSidebarVisible,
    );

    try {
      for (const id of [
        'single-media',
        'multi-media',
        'pending-video',
        'played-video',
        'component-video',
        'direct-video',
        'link-card',
      ]) {
        expect(requiredElement(`#${id}`)).toHaveStyle({
          maxWidth: 'min(100%, 518px)',
          boxSizing: 'border-box',
        });
      }
      expect(requiredElement('#narrow-media')).toHaveStyle({
        maxWidth: 'min(100%, 180px)',
        width: '180px',
      });
      expect(primary).toHaveStyle({ maxWidth: 'none', width: 'auto' });
      expect(requiredElement('#timeline-content')).toHaveStyle({ width: '100%' });
      for (const selector of [
        '#tweet-body',
        '[data-testid="tweetText"]',
        '#tweet-avatar',
        '#profile-media-grid',
        '#dialog-media',
        '#sidebar-media',
        '#outside-media',
        '#multi-media [data-testid="tweetPhoto"]',
      ]) {
        expect(requiredElement(selector).style.maxWidth).toBe('');
      }
    } finally {
      manager.destroy();
    }
  });

  it('measures lazy-loaded and replaced media against the native column width', async () => {
    const { manager, primary } = await collapseDesktopMedia();
    try {
      requiredElement('section').insertAdjacentHTML(
        'beforeend',
        '<div data-testid="cellInnerDiv"><article><div data-testid="tweetText">New tweet</div><div id="lazy-media"><div data-testid="tweetPhoto"><img /></div></div><div role="group"><button data-testid="reply">Reply</button></div></article></div>',
      );
      const lazyMedia = requiredElement('#lazy-media');
      mockMediaWidth(lazyMedia);
      const pendingVideo = requiredElement('#pending-video');
      pendingVideo.outerHTML = '<div id="replacement-video"><div data-testid="videoPlayer"><video></video></div></div>';
      const replacementVideo = requiredElement('#replacement-video');
      mockMediaWidth(replacementVideo);

      manager.sync();
      manager.sync();

      expect(lazyMedia).toHaveStyle({ maxWidth: 'min(100%, 518px)' });
      expect(replacementVideo).toHaveStyle({ maxWidth: 'min(100%, 518px)' });
      expect(requiredElement('#single-media')).toHaveStyle({
        maxWidth: 'min(100%, 518px)',
      });
      expect(pendingVideo.style.maxWidth).toBe('');
      expect(primary).toHaveStyle({ maxWidth: 'none', width: 'auto' });
      expect(requiredElement('#timeline-content')).toHaveStyle({ width: '100%' });
    } finally {
      manager.destroy();
    }
  });

  it.each([
    { quoted: true, padding: '66%', height: 324 },
    { quoted: false, padding: 'calc(106.454% - 4.258px)', height: 598 },
  ])('expands a photo carousel without enlarging its slides: %j', async ({ quoted, padding, height }) => {
    const { manager } = await collapseDesktopMedia();
    try {
      const body = requiredElement('#tweet-body');
      body.insertAdjacentHTML('beforeend', quoted
        ? '<div id="carousel-body" role="link"><div data-testid="tweetText">Quoted tweet</div></div>'
        : '<div id="carousel-body"><div data-testid="tweetText">Detail tweet</div></div>');
      const { target, spacer, list, measure } = appendPhotoCarousel(requiredElement('#carousel-body'), padding, height);
      const links = Array.from(list.querySelectorAll('a'));

      manager.sync();
      manager.sync();

      expect(target.style.maxWidth).toBe('none');
      expect(spacer).toHaveStyle({ paddingBottom: `calc(min(${padding}, ${height}px))` });
      expect(measure).toHaveBeenCalledTimes(1);
      expect(Array.from(list.querySelectorAll('a'))).toEqual(links);
      expect(list.style.overflowX).toBe('auto');
      expect(requiredElement('#carousel-body').style.maxWidth).toBe('');
      expect(requiredElement('#single-media').style.maxWidth).toBe('min(100%, 518px)');
      expect(requiredElement('#multi-media').style.maxWidth).toBe('min(100%, 518px)');
    } finally {
      manager.destroy();
    }
  });

  it.each([
    { leftNavigationExpanded: false, rightSidebarVisible: false },
    { leftNavigationExpanded: false, rightSidebarVisible: true },
    { leftNavigationExpanded: true, rightSidebarVisible: false },
  ])('expands initially present photo carousels for either collapsed sidebar: %j', async (preference) => {
    renderDesktopTweetMedia();
    const { target, spacer } = appendPhotoCarousel(requiredElement('#tweet-body'));
    const storage = new FakeExtensionLocalStorage();
    storage.values.set(INTERFACE_LAYOUT_STORAGE_KEYS.leftNavigationExpanded, preference.leftNavigationExpanded);
    storage.values.set(INTERFACE_LAYOUT_STORAGE_KEYS.rightSidebarVisible, preference.rightSidebarVisible);
    const manager = createXInterfaceLayoutManager(new LocalInterfaceLayoutPreferenceRepository(storage));
    try {
      await vi.waitFor(() => expect(target.style.maxWidth).toBe('none'));
      expect(spacer).toHaveStyle({ paddingBottom: 'calc(min(66%, 324px))' });
    } finally {
      manager.destroy();
    }
  });

  it.each(['single-slide', 'mixed-video', 'unknown-spacer'])(
    'keeps the native media limit when a carousel is unsupported: %s',
    async (variant) => {
      const { manager } = await collapseDesktopMedia();
      try {
        const { target, spacer, list } = appendPhotoCarousel(requiredElement('#tweet-body'));
        if (variant === 'single-slide') {
          Array.from(list.children).slice(1).forEach((slide) => slide.remove());
        } else if (variant === 'mixed-video') {
          list.firstElementChild?.insertAdjacentHTML('beforeend', '<div data-testid="videoPlayer"><video></video></div>');
        } else {
          spacer.style.removeProperty('padding-bottom');
        }
        manager.sync();
        expect(target.style.maxWidth).toBe('min(100%, 518px)');
        expect(spacer.style.getPropertyPriority('padding-bottom')).toBe('');
      } finally {
        manager.destroy();
      }
    },
  );

  it('retries an unmeasurable carousel and restores its styles when both sidebars reopen', async () => {
    const { manager, repository } = await collapseDesktopMedia();
    const { target, spacer, measure } = appendPhotoCarousel(requiredElement('#tweet-body'));
    spacer.style.setProperty('padding-bottom', '66%', 'important');
    spacer.setAttribute('data-twitter-enhancement-layout', 'original-spacer');
    const originalTarget = target.style.cssText;
    const originalSpacer = spacer.style.cssText;
    measure.mockReturnValueOnce({ ...rectWithWidth(0), height: 0 });
    try {
      manager.sync();
      expect(target.style.maxWidth).toBe('min(100%, 518px)');
      expect(spacer.style.paddingBottom).toBe('66%');
      manager.sync();
      expect(target.style.maxWidth).toBe('none');
      expect(spacer).toHaveStyle({ paddingBottom: 'calc(min(66%, 324px))' });

      await repository.setPreference('leftNavigationExpanded', true);
      expect(target.style.maxWidth).toBe('none');
      await repository.setPreference('rightSidebarVisible', true);
      expect(target.style.cssText).toBe(originalTarget);
      expect(spacer.style.cssText).toBe(originalSpacer);
      expect(spacer.getAttribute('data-twitter-enhancement-layout')).toBe('original-spacer');
    } finally {
      manager.destroy();
    }
  });

  it.each(['read-view', 'dialog', 'detached', 'single-slide', 'sidebar-removed', 'destroy'])(
    'restores expanded carousel styles after its context changes: %s',
    async (change) => {
      const { manager } = await collapseDesktopMedia();
      const { target, spacer, list } = appendPhotoCarousel(requiredElement('#tweet-body'));
      try {
        manager.sync();
        expect(target.style.maxWidth).toBe('none');
        if (change === 'read-view' || change === 'dialog') {
          const wrapper = document.createElement(change === 'read-view' ? 'article' : 'div');
          wrapper.setAttribute(change === 'read-view' ? 'data-testid' : 'role', change === 'read-view' ? 'twitterArticleReadView' : 'dialog');
          requiredElement('#tweet-body').append(wrapper);
          wrapper.append(target);
        } else if (change === 'detached') {
          target.remove();
        } else if (change === 'single-slide') {
          Array.from(list.children).slice(1).forEach((slide) => slide.remove());
        } else if (change === 'sidebar-removed') {
          requiredElement('[data-testid="sidebarColumn"]').remove();
        } else {
          manager.destroy();
        }
        manager.sync();
        expect(spacer.style.paddingBottom).toBe('66%');
        expect(spacer).not.toHaveAttribute('data-twitter-enhancement-layout');
        expect(target.style.maxWidth).toBe(change === 'single-slide' ? 'min(100%, 518px)' : '95%');
      } finally {
        manager.destroy();
      }
    },
  );

  it('restores original media styles and markers when both side areas reopen', async () => {
    const { manager, repository } = await collapseDesktopMedia();
    const singleMedia = requiredElement('#single-media');
    try {
      expect(singleMedia.style.maxWidth).toBe('min(100%, 518px)');
      await repository.setPreference('leftNavigationExpanded', true);
      expect(singleMedia.style.maxWidth).toBe('min(100%, 518px)');
      await repository.setPreference('rightSidebarVisible', true);

      expect(singleMedia).toHaveStyle({ maxWidth: '90%', boxSizing: 'content-box' });
      expect(singleMedia.style.getPropertyPriority('max-width')).toBe('important');
      expect(singleMedia).toHaveAttribute('data-twitter-enhancement-layout', 'original-media');
      expect(requiredElement('#multi-media').style.maxWidth).toBe('');
      expect(requiredElement('#multi-media').style.boxSizing).toBe('');
      expect(requiredElement('#multi-media')).not.toHaveAttribute('data-twitter-enhancement-layout');
    } finally {
      manager.destroy();
    }
  });

  it('retries native media measurement when the initial column has no visible width', async () => {
    const primary = renderDesktopTweetMedia();
    let visible = false;
    vi.mocked(primary.getBoundingClientRect).mockImplementation(() =>
      rectWithWidth(visible ? (primary.style.maxWidth === 'none' ? 1200 : 600) : 0),
    );
    const storage = new FakeExtensionLocalStorage();
    storage.values.set(INTERFACE_LAYOUT_STORAGE_KEYS.leftNavigationExpanded, false);
    storage.values.set(INTERFACE_LAYOUT_STORAGE_KEYS.rightSidebarVisible, false);
    const repository = new LocalInterfaceLayoutPreferenceRepository(storage);
    const manager = createXInterfaceLayoutManager(repository);
    try {
      await vi.waitFor(() => {
        expect(requiredElement('[data-testid="sidebarColumn"]')).toHaveStyle({
          visibility: 'hidden',
        });
      });
      visible = true;
      manager.sync();

      expect(requiredElement('#single-media')).toHaveStyle({
        maxWidth: 'min(100%, 518px)',
      });
      expect(primary).toHaveStyle({ maxWidth: 'none', width: 'auto' });
    } finally {
      manager.destroy();
    }
  });

  it('restores media constraints when desktop sidebar nodes disappear', async () => {
    const { manager } = await collapseDesktopMedia();
    try {
      const media = requiredElement('#played-video');
      expect(media.style.maxWidth).toBe('min(100%, 518px)');
      requiredElement('[data-testid="sidebarColumn"]').remove();
      manager.sync();
      expect(media.style.maxWidth).toBe('');
      expect(media.style.boxSizing).toBe('');
      expect(requiredElement('#single-media').style.maxWidth).toBe('90%');
    } finally {
      manager.destroy();
    }
  });

  it('keeps the entire article preview card at native width, including its title and summary', async () => {
    const { manager, primary } = await collapseDesktopMedia();
    try {
      requiredElement('#tweet-body').insertAdjacentHTML(
        'beforeend',
        `<div id="article-preview-card">
          <div data-testid="article-cover-image"><img /></div>
          <h2 id="article-preview-title">An article title</h2>
          <div id="article-preview-summary">An article summary</div>
        </div>`,
      );
      const preview = requiredElement('#article-preview-card');
      mockMediaWidth(preview);

      manager.sync();

      expect(preview).toHaveStyle({
        maxWidth: 'min(100%, 518px)',
        boxSizing: 'border-box',
      });
      expect(requiredElement('[data-testid="article-cover-image"]').style.maxWidth).toBe('');
      expect(requiredElement('#article-preview-title').style.maxWidth).toBe('');
      expect(requiredElement('#article-preview-summary').style.maxWidth).toBe('');
      expect(requiredElement('#tweet-body').style.maxWidth).toBe('');
      expect(primary).toHaveStyle({ maxWidth: 'none', width: 'auto' });
    } finally {
      manager.destroy();
    }
  });

  it('leaves article read view media unrestricted while preserving limits on reply media', async () => {
    const { manager, primary } = await collapseDesktopMedia();
    try {
      requiredElement('#timeline-content section').insertAdjacentHTML(
        'beforeend',
        `<div data-testid="cellInnerDiv">
          <article>
            <div data-testid="User-Name">Article author</div>
            <article data-testid="twitterArticleReadView">
              <div id="article-read-cover"><div data-testid="article-cover-image"><img /></div></div>
              <div data-testid="twitterArticleRichTextView">
                <h1>Full article title</h1><p>Full article body</p>
                <div id="article-read-photo"><div data-testid="tweetPhoto"><img /></div></div>
                <div id="article-read-video"><div data-testid="videoPlayer"><video></video></div></div>
                <div id="article-read-link"><div data-testid="card.wrapper"><a href="https://example.com"><img /></a></div></div>
              </div>
            </article>
            <div role="group"><button data-testid="reply">Reply</button></div>
          </article>
        </div>
        <div data-testid="cellInnerDiv">
          <article>
            <div data-testid="User-Name">Reply author</div>
            <div data-testid="tweetText">An ordinary reply</div>
            <div id="article-reply-media"><div data-testid="tweetPhoto"><img /></div></div>
            <div role="group"><button data-testid="reply">Reply</button></div>
          </article>
        </div>`,
      );
      const readView = requiredElement('[data-testid="twitterArticleReadView"]');
      for (const element of [readView, ...readView.querySelectorAll<HTMLElement>('div')]) {
        mockMediaWidth(element, 566);
      }
      const replyMedia = requiredElement('#article-reply-media');
      mockMediaWidth(replyMedia);

      manager.sync();

      expect(readView.querySelector('[data-twitter-enhancement-layout="tweet-media"]')).toBeNull();
      expect(readView.style.maxWidth).toBe('');
      for (const element of readView.querySelectorAll<HTMLElement>('div')) {
        expect(element.style.maxWidth).toBe('');
        expect(element.style.boxSizing).toBe('');
      }
      expect(replyMedia).toHaveStyle({ maxWidth: 'min(100%, 518px)' });
      expect(primary).toHaveStyle({ maxWidth: 'none', width: 'auto' });
      expect(requiredElement('#timeline-content')).toHaveStyle({ width: '100%' });
    } finally {
      manager.destroy();
    }
  });

  it('restores and reapplies article media styles when the same node enters and leaves read view', async () => {
    const { manager } = await collapseDesktopMedia();
    try {
      const media = requiredElement('#single-media');
      const tweetBody = requiredElement('#tweet-body');
      expect(media).toHaveStyle({ maxWidth: 'min(100%, 518px)' });
      const readView = document.createElement('article');
      readView.dataset.testid = 'twitterArticleReadView';
      tweetBody.append(readView);
      readView.append(media);

      manager.sync();

      expect(media).toHaveStyle({ maxWidth: '90%', boxSizing: 'content-box' });
      expect(media.style.getPropertyPriority('max-width')).toBe('important');
      expect(media).toHaveAttribute('data-twitter-enhancement-layout', 'original-media');

      tweetBody.append(media);
      readView.remove();
      manager.sync();
      manager.sync();

      expect(media).toHaveStyle({
        maxWidth: 'min(100%, 518px)',
        boxSizing: 'border-box',
      });
    } finally {
      manager.destroy();
    }
  });

  it('cleans up detached media and restores remaining media on destroy', async () => {
    const { manager } = await collapseDesktopMedia();
    const removedMedia = requiredElement('#single-media');
    const remainingMedia = requiredElement('#link-card');
    expect(removedMedia.style.maxWidth).toBe('min(100%, 518px)');
    expect(remainingMedia.style.maxWidth).toBe('min(100%, 518px)');

    removedMedia.remove();
    manager.sync();
    expect(removedMedia).toHaveStyle({ maxWidth: '90%', boxSizing: 'content-box' });
    expect(removedMedia.style.getPropertyPriority('max-width')).toBe('important');
    expect(removedMedia).toHaveAttribute('data-twitter-enhancement-layout', 'original-media');

    manager.destroy();
    expect(remainingMedia.style.maxWidth).toBe('');
    expect(remainingMedia.style.boxSizing).toBe('');
    expect(remainingMedia).not.toHaveAttribute('data-twitter-enhancement-layout');
  });
});
