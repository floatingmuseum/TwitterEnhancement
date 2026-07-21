import type {
  HiddenRepostDisplayMode,
  ListRepostPreferenceListener,
  ListRepostPreferenceRepository,
} from '../src/features/list-reposts/list-repost-preference';
import {
  createXListRepostManager,
  findXListRepostTarget,
  getXListId,
} from '../src/platform/x/list-repost-manager';

class FakeListRepostPreferenceRepository
  implements ListRepostPreferenceRepository
{
  readonly listeners = new Set<ListRepostPreferenceListener>();

  constructor(
    public showReposts = false,
    public hiddenRepostDisplayMode: HiddenRepostDisplayMode = 'hidden',
  ) {}

  async getPreferences() {
    return {
      showReposts: this.showReposts,
      hiddenRepostDisplayMode: this.hiddenRepostDisplayMode,
    };
  }

  async setShowReposts(showReposts: boolean): Promise<void> {
    this.showReposts = showReposts;
    for (const listener of this.listeners) {
      listener({ showReposts });
    }
  }

  async setHiddenRepostDisplayMode(
    hiddenRepostDisplayMode: HiddenRepostDisplayMode,
  ): Promise<void> {
    this.hiddenRepostDisplayMode = hiddenRepostDisplayMode;
    for (const listener of this.listeners) {
      listener({ hiddenRepostDisplayMode });
    }
  }

  subscribe(listener: ListRepostPreferenceListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

function renderListPage() {
  document.body.innerHTML = `
    <main role="main">
      <div data-testid="primaryColumn">
        <section role="region">
          <div class="timeline">
            <div data-testid="cellInnerDiv" class="list-header-cell">
              <div>
                <div class="list-profile">
                  <div>crypto</div>
                  <div><a href="/floatingmuseum">@floatingmuseum</a></div>
                  <div class="stats">
                    <div><a href="/i/lists/1440581055191269380/members">41 成员</a></div>
                    <div><a href="/i/lists/1440581055191269380/followers">0 关注者</a></div>
                  </div>
                  <a href="/i/lists/1440581055191269380/info">编辑列表</a>
                </div>
              </div>
            </div>
            <div data-testid="cellInnerDiv">
              <article id="plain-repost" style="display: grid">
                <div data-testid="socialContext">alice 已转帖</div>
                <a href="/source/status/123"><time>1小时</time></a>
                <div data-testid="tweetText">被转贴的原文</div>
              </article>
            </div>
            <div data-testid="cellInnerDiv">
              <article id="original"><div data-testid="tweetText">原创内容</div></article>
            </div>
            <div data-testid="cellInnerDiv">
              <article id="quote">
                <div data-testid="tweetText">引用者附言</div>
                <div role="link"><div data-testid="tweetText">被引用内容</div></div>
              </article>
            </div>
          </div>
        </section>
      </div>
    </main>
  `;
}

describe('X list repost manager', () => {
  const listUrl = new URL('https://x.com/i/lists/1440581055191269380');

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('recognizes list timelines without matching their subpages', () => {
    expect(getXListId(listUrl)).toBe('1440581055191269380');
    expect(getXListId(new URL('https://x.com/alice/lists/42'))).toBe('42');
    expect(getXListId(new URL('https://x.com/i/user/7/list/42'))).toBe('42');
    expect(getXListId(new URL('https://x.com/i/lists/42/members'))).toBeNull();
    expect(getXListId(new URL('https://x.com/home?list=42'))).toBeNull();
  });

  it('finds the list profile control slot from canonical members and followers links', () => {
    renderListPage();

    const target = findXListRepostTarget(document, listUrl);

    expect(target?.anchor).toHaveClass('list-profile');
    expect(target?.timeline).toHaveClass('timeline');
  });

  it('hides only plain reposts and restores their prior display style', async () => {
    renderListPage();
    const repository = new FakeListRepostPreferenceRepository(false);
    const destroy = vi.fn();
    const manager = createXListRepostManager(
      () => ({ updateAppearance: vi.fn(), destroy }),
      repository,
    );

    manager.sync(document, listUrl);

    const plainRepost = document.querySelector<HTMLElement>('#plain-repost');
    const original = document.querySelector<HTMLElement>('#original');
    const quote = document.querySelector<HTMLElement>('#quote');
    expect(plainRepost?.style.getPropertyValue('display')).toBe('none');
    expect(plainRepost?.style.getPropertyPriority('display')).toBe('important');
    expect(plainRepost).toHaveAttribute('data-twitter-enhancement-hidden-plain-repost');
    expect(original?.style.display).toBe('');
    expect(quote?.style.display).toBe('');

    await repository.setShowReposts(true);

    expect(plainRepost?.style.getPropertyValue('display')).toBe('grid');
    expect(plainRepost).not.toHaveAttribute(
      'data-twitter-enhancement-hidden-plain-repost',
    );

    manager.destroy();
  });

  it('filters newly loaded reposts and restores them after SPA navigation', () => {
    renderListPage();
    const repository = new FakeListRepostPreferenceRepository(false);
    const destroy = vi.fn();
    const manager = createXListRepostManager(
      () => ({ updateAppearance: vi.fn(), destroy }),
      repository,
    );
    manager.sync(document, listUrl);

    const timeline = document.querySelector<HTMLElement>('.timeline');
    timeline?.insertAdjacentHTML(
      'beforeend',
      '<div data-testid="cellInnerDiv"><article id="lazy-repost"><div data-testid="socialContext">bob Reposted</div></article></div>',
    );
    manager.sync(document, listUrl);

    const lazyRepost = document.querySelector<HTMLElement>('#lazy-repost');
    expect(lazyRepost?.style.display).toBe('none');

    manager.sync(document, new URL('https://x.com/home'));

    expect(document.querySelector<HTMLElement>('#plain-repost')?.style.display).toBe('grid');
    expect(lazyRepost?.style.display).toBe('');
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('keeps filtering when X virtualizes the list header out of the DOM', () => {
    renderListPage();
    const repository = new FakeListRepostPreferenceRepository(false);
    const manager = createXListRepostManager(
      () => ({ updateAppearance: vi.fn(), destroy: vi.fn() }),
      repository,
    );
    manager.sync(document, listUrl);

    document.querySelector('.list-header-cell')?.remove();
    manager.sync(document, listUrl);

    expect(document.querySelector<HTMLElement>('#plain-repost')?.style.display).toBe(
      'none',
    );
  });

  it('filters a scroll-restored list even when the header was never mounted', () => {
    renderListPage();
    document.querySelector('.list-header-cell')?.remove();
    const repository = new FakeListRepostPreferenceRepository(false);
    const mount = vi.fn(() => ({ updateAppearance: vi.fn(), destroy: vi.fn() }));
    const manager = createXListRepostManager(mount, repository);

    manager.sync(document, listUrl);

    expect(document.querySelector<HTMLElement>('#plain-repost')?.style.display).toBe(
      'none',
    );
    expect(mount).not.toHaveBeenCalled();
  });

  it('renders a hover divider that temporarily expands one repost until refresh', async () => {
    renderListPage();
    const repository = new FakeListRepostPreferenceRepository(false, 'divider');
    const manager = createXListRepostManager(
      () => ({ updateAppearance: vi.fn(), destroy: vi.fn() }),
      repository,
    );
    await Promise.resolve();
    manager.sync(document, listUrl);

    const placeholder = document.querySelector<HTMLElement>(
      '[data-twitter-enhancement-repost-placeholder="divider"]',
    );
    const revealButton = placeholder?.shadowRoot?.querySelector('button');
    expect(revealButton).toHaveAccessibleName(
      'alice 已转帖。点击临时显示完整转贴',
    );
    expect(document.querySelector<HTMLElement>('#plain-repost')?.style.display).toBe(
      'none',
    );

    revealButton?.click();
    manager.sync(document, listUrl);

    expect(document.querySelector<HTMLElement>('#plain-repost')?.style.display).toBe(
      'grid',
    );
    expect(placeholder?.isConnected).toBe(false);

    manager.destroy();
    const refreshedManager = createXListRepostManager(
      () => ({ updateAppearance: vi.fn(), destroy: vi.fn() }),
      repository,
    );
    await Promise.resolve();
    refreshedManager.sync(document, listUrl);

    expect(document.querySelector<HTMLElement>('#plain-repost')?.style.display).toBe(
      'none',
    );
    expect(
      document.querySelector(
        '[data-twitter-enhancement-repost-placeholder="divider"]',
      ),
    ).toBeInTheDocument();
    refreshedManager.destroy();
  });

  it('keeps the repost source visible in social-context mode', async () => {
    renderListPage();
    const repository = new FakeListRepostPreferenceRepository(
      false,
      'social-context',
    );
    const manager = createXListRepostManager(
      () => ({ updateAppearance: vi.fn(), destroy: vi.fn() }),
      repository,
    );
    await Promise.resolve();
    manager.sync(document, listUrl);

    const placeholder = document.querySelector<HTMLElement>(
      '[data-twitter-enhancement-repost-placeholder="social-context"]',
    );
    expect(
      placeholder?.shadowRoot?.querySelector('.te-repost-placeholder__label'),
    ).toHaveTextContent('alice 已转帖');
    expect(
      placeholder?.shadowRoot?.querySelector('button'),
    ).toHaveClass('te-repost-placeholder--context');
    expect(document.querySelector<HTMLElement>('#plain-repost')?.style.display).toBe(
      'none',
    );

    manager.destroy();
  });

  it('refreshes placeholder copy when X reuses an article node', async () => {
    renderListPage();
    const repository = new FakeListRepostPreferenceRepository(
      false,
      'social-context',
    );
    const manager = createXListRepostManager(
      () => ({ updateAppearance: vi.fn(), destroy: vi.fn() }),
      repository,
    );
    await Promise.resolve();
    manager.sync(document, listUrl);

    const article = document.querySelector<HTMLElement>('#plain-repost');
    const socialContext = article?.querySelector<HTMLElement>(
      '[data-testid="socialContext"]',
    );
    const statusLink = article?.querySelector<HTMLAnchorElement>('a[href]');
    if (socialContext) {
      socialContext.textContent = 'bob 已转帖';
    }
    statusLink?.setAttribute('href', '/source/status/124');

    manager.sync(document, listUrl);

    const placeholder = document.querySelector<HTMLElement>(
      '[data-twitter-enhancement-repost-placeholder="social-context"]',
    );
    expect(
      placeholder?.shadowRoot?.querySelector('.te-repost-placeholder__label'),
    ).toHaveTextContent('bob 已转帖');
    expect(placeholder?.shadowRoot?.querySelector('button')).toHaveAccessibleName(
      'bob 已转帖。点击临时显示完整转贴',
    );

    manager.destroy();
  });
});
