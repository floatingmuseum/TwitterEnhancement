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
});
