import type {
  HiddenRepostDisplayMode,
  ListRepostPreferenceListener,
  ListRepostPreferenceRepository,
  ListRepostPreferences,
} from '../src/features/list-reposts/list-repost-preference';
import {
  createXRepostTimelineManager,
  findXRepostTimelineTarget,
  getXListId,
  isPlainRepostArticle,
} from '../src/platform/x/list-repost-manager';

class FakeListRepostPreferenceRepository
  implements ListRepostPreferenceRepository
{
  readonly listeners = new Set<ListRepostPreferenceListener>();

  constructor(
    public showReposts = false,
    public hiddenRepostDisplayMode: HiddenRepostDisplayMode = 'hidden',
    public hideAds = true,
  ) {}

  async getPreferences() {
    return {
      showReposts: this.showReposts,
      hiddenRepostDisplayMode: this.hiddenRepostDisplayMode,
      hideAds: this.hideAds,
    };
  }

  async setShowReposts(showReposts: boolean): Promise<void> {
    this.showReposts = showReposts;
    for (const listener of this.listeners) {
      listener({ showReposts });
    }
  }

  async setHideAds(hideAds: boolean): Promise<void> {
    this.hideAds = hideAds;
    for (const listener of this.listeners) {
      listener({ hideAds });
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
            <div data-testid="cellInnerDiv" class="post-cell">
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

function renderHomePage() {
  document.body.innerHTML = `
    <main role="main">
      <div data-testid="primaryColumn">
        <nav role="tablist"><button role="tab">为你推荐</button></nav>
        <section role="region">
          <div class="timeline">
            <div data-testid="cellInnerDiv" class="composer">有什么新鲜事？</div>
            <div data-testid="cellInnerDiv" class="post-cell">
              <article id="home-repost">
                <div data-testid="socialContext">alice 已转帖</div>
                <a href="/source/status/321"><time>1小时</time></a>
              </article>
            </div>
          </div>
        </section>
      </div>
    </main>
  `;
}

function renderProfilePage() {
  document.body.innerHTML = `
    <main role="main">
      <div data-testid="primaryColumn">
        <div data-testid="cellInnerDiv" class="profile-header">
          <div data-testid="UserName"><span>Alice</span><span>@alice</span></div>
        </div>
        <div class="profile-tabs">
          <nav role="navigation" aria-label="个人资料时间线">
            <div role="tablist"><button role="tab">帖子</button></div>
          </nav>
        </div>
        <section role="region">
          <div class="timeline">
            <div data-testid="cellInnerDiv" class="post-cell">
              <article id="profile-repost">
                <div data-testid="socialContext">bob Reposted</div>
                <a href="/source/status/456"><time>2小时</time></a>
              </article>
            </div>
            <div data-testid="cellInnerDiv">
              <article id="pinned-post">
                <div data-testid="socialContext">Pinned</div>
                <div data-testid="tweetText">置顶原创内容</div>
              </article>
            </div>
          </div>
        </section>
      </div>
    </main>
  `;
}

function appendPromotedTweet(id = 'promoted-tweet', tweetId = '987'): HTMLElement {
  const timeline = document.querySelector('.timeline');
  if (!timeline) {
    throw new Error('Expected a rendered timeline');
  }

  const cell = document.createElement('div');
  cell.dataset.testid = 'cellInnerDiv';
  const article = document.createElement('article');
  article.id = id;
  article.style.setProperty('display', 'flex', 'important');
  article.innerHTML = `
    <div class="tweet-header">
      <div data-testid="User-Name">
        <a href="/advertiser"><span>Advertiser</span><span>@advertiser</span></a>
      </div>
      <div><span class="ad-label">广告</span><button data-testid="caret">更多</button></div>
    </div>
    <a href="/advertiser/status/${tweetId}"><time>1小时</time></a>
    <div data-testid="tweetText">新品介绍</div>
  `;
  cell.append(article);
  timeline.append(cell);
  return article;
}

describe('X repost timeline manager', () => {
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

  it('places the list control immediately before the first post', () => {
    renderListPage();

    const target = findXRepostTimelineTarget(document, listUrl);

    expect(target?.controlAnchor).toHaveClass('list-profile');
    expect(target?.controlPlacement).toBe('append');
    expect(target?.timeline).toHaveClass('timeline');
    expect(target?.surface).toBe('list');
  });

  it('recognizes home feeds and only the main posts tab on profile pages', () => {
    renderHomePage();
    expect(
      findXRepostTimelineTarget(document, new URL('https://x.com/home'))?.surface,
    ).toBe('home');

    renderProfilePage();
    expect(
      findXRepostTimelineTarget(document, new URL('https://x.com/alice'))?.surface,
    ).toBe('profile');
    expect(
      findXRepostTimelineTarget(document, new URL('https://x.com/alice'))
        ?.controlAnchor,
    ).toHaveAttribute('role', 'region');
    expect(
      findXRepostTimelineTarget(document, new URL('https://x.com/alice'))
        ?.controlPlacement,
    ).toBe('before');
    expect(
      findXRepostTimelineTarget(
        document,
        new URL('https://x.com/alice/with_replies'),
      ),
    ).toBeNull();
    expect(
      findXRepostTimelineTarget(document, new URL('https://x.com/bob')),
    ).toBeNull();
  });

  it('filters home and profile reposts without hiding pinned profile posts', () => {
    const repository = new FakeListRepostPreferenceRepository(false);
    const manager = createXRepostTimelineManager(
      () => ({ updateAppearance: vi.fn(), destroy: vi.fn() }),
      repository,
    );

    renderHomePage();
    manager.sync(document, new URL('https://x.com/home'));
    expect(document.querySelector<HTMLElement>('#home-repost')?.style.display).toBe(
      'none',
    );

    renderProfilePage();
    manager.sync(document, new URL('https://x.com/alice'));
    const profileRepost = document.querySelector<HTMLElement>('#profile-repost');
    const pinnedPost = document.querySelector<HTMLElement>('#pinned-post');
    expect(profileRepost?.style.display).toBe('none');
    expect(pinnedPost?.style.display).toBe('');
    expect(isPlainRepostArticle(pinnedPost as HTMLElement)).toBe(false);

    manager.destroy();
  });

  it('hides only plain reposts and restores their prior display style', async () => {
    renderListPage();
    const repository = new FakeListRepostPreferenceRepository(false);
    const destroy = vi.fn();
    const manager = createXRepostTimelineManager(
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
    const manager = createXRepostTimelineManager(
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

    manager.sync(document, new URL('https://x.com/explore'));

    expect(document.querySelector<HTMLElement>('#plain-repost')?.style.display).toBe('grid');
    expect(lazyRepost?.style.display).toBe('');
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('keeps filtering when X virtualizes the list header out of the DOM', () => {
    renderListPage();
    const repository = new FakeListRepostPreferenceRepository(false);
    const manager = createXRepostTimelineManager(
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

  it('filters without mounting when a scroll-restored list has no profile header', () => {
    renderListPage();
    document.querySelector('.list-header-cell')?.remove();
    const repository = new FakeListRepostPreferenceRepository(false);
    const mount = vi.fn(() => ({ updateAppearance: vi.fn(), destroy: vi.fn() }));
    const manager = createXRepostTimelineManager(mount, repository);

    manager.sync(document, listUrl);

    expect(document.querySelector<HTMLElement>('#plain-repost')?.style.display).toBe(
      'none',
    );
    expect(mount).not.toHaveBeenCalled();
  });

  it('renders a hover divider that temporarily expands one repost until refresh', async () => {
    renderListPage();
    const repository = new FakeListRepostPreferenceRepository(false, 'divider');
    const manager = createXRepostTimelineManager(
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
      '一条来自 alice 的转贴已被收起，点击可还原',
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
    const refreshedManager = createXRepostTimelineManager(
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
    const manager = createXRepostTimelineManager(
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
    ).toHaveTextContent('一条来自 alice 的转贴已被收起，点击可还原');
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
    const manager = createXRepostTimelineManager(
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
    ).toHaveTextContent('一条来自 bob 的转贴已被收起，点击可还原');
    expect(placeholder?.shadowRoot?.querySelector('button')).toHaveAccessibleName(
      '一条来自 bob 的转贴已被收起，点击可还原',
    );

    manager.destroy();
  });

  it.each([
    { render: renderHomePage, url: 'https://x.com/home', mode: 'hidden' },
    {
      render: renderListPage,
      url: 'https://x.com/i/lists/1440581055191269380',
      mode: 'divider',
    },
    {
      render: renderProfilePage,
      url: 'https://x.com/alice',
      mode: 'social-context',
    },
  ] as const)('hides ads without a placeholder regardless of $mode mode on $url', async ({ render, url, mode }) => {
    render();
    const article = appendPromotedTweet();
    const repository = new FakeListRepostPreferenceRepository(false, mode);
    const manager = createXRepostTimelineManager(
      () => ({ updateAppearance: vi.fn(), destroy: vi.fn() }),
      repository,
    );
    await Promise.resolve();
    manager.sync(document, new URL(url));

    expect(article.style.getPropertyValue('display')).toBe('none');
    expect(article.style.getPropertyPriority('display')).toBe('important');
    expect(article).toHaveAttribute('data-twitter-enhancement-hidden-promoted-tweet', 'hidden');
    expect(article).not.toHaveAttribute('data-twitter-enhancement-hidden-plain-repost');
    expect(article.parentElement?.querySelector('[data-twitter-enhancement-repost-placeholder]'))
      .toBeNull();
    manager.destroy();
  });

  it.each([
    { showReposts: false, hideAds: true },
    { showReposts: true, hideAds: true },
    { showReposts: false, hideAds: false },
    { showReposts: true, hideAds: false },
  ])('applies independent stored preferences $showReposts / $hideAds', async ({ showReposts, hideAds }) => {
    renderHomePage();
    const article = appendPromotedTweet();
    const repository = new FakeListRepostPreferenceRepository(showReposts, 'divider', hideAds);
    const manager = createXRepostTimelineManager(
      () => ({ updateAppearance: vi.fn(), destroy: vi.fn() }),
      repository,
    );
    await Promise.resolve();
    manager.sync(document, new URL('https://x.com/home'));

    expect(article.style.display).toBe(hideAds ? 'none' : 'flex');
    expect(document.querySelector<HTMLElement>('#home-repost')?.style.display)
      .toBe(showReposts ? '' : 'none');
    expect(article.parentElement?.querySelector('[data-twitter-enhancement-repost-placeholder]'))
      .toBeNull();
    manager.destroy();
  });

  it('keeps live ad and repost preference changes independent', async () => {
    renderHomePage();
    const article = appendPromotedTweet();
    const repost = document.querySelector<HTMLElement>('#home-repost')!;
    const repository = new FakeListRepostPreferenceRepository(false, 'divider');
    const manager = createXRepostTimelineManager(
      () => ({ updateAppearance: vi.fn(), destroy: vi.fn() }),
      repository,
    );
    await Promise.resolve();
    manager.sync(document, new URL('https://x.com/home'));
    const repostPlaceholder = repost.previousElementSibling;

    await repository.setHideAds(false);
    expect(article.style.getPropertyValue('display')).toBe('flex');
    expect(article.style.getPropertyPriority('display')).toBe('important');
    expect(article).not.toHaveAttribute('data-twitter-enhancement-hidden-promoted-tweet');
    expect(repost.style.display).toBe('none');
    expect(repost.previousElementSibling).toBe(repostPlaceholder);

    await repository.setHideAds(true);
    await repository.setShowReposts(true);
    expect(repost.style.display).toBe('');
    expect(repostPlaceholder?.isConnected).toBe(false);
    expect(article.style.display).toBe('none');
    const newAd = appendPromotedTweet('new-ad', '988');
    manager.sync(document, new URL('https://x.com/home'));
    expect(newAd.style.display).toBe('none');

    await repository.setShowReposts(false);
    await repository.setHiddenRepostDisplayMode('social-context');
    expect(repost.previousElementSibling).toHaveAttribute(
      'data-twitter-enhancement-repost-placeholder', 'social-context',
    );
    expect(article.style.display).toBe('none');
    expect(article.parentElement?.querySelector('[data-twitter-enhancement-repost-placeholder]'))
      .toBeNull();
    manager.destroy();
  });

  it('merges an early ad setting change without losing stored repost preferences', async () => {
    renderHomePage();
    const article = appendPromotedTweet();
    const repository = new FakeListRepostPreferenceRepository();
    let resolvePreferences: ((value: ListRepostPreferences) => void) | undefined;
    vi.spyOn(repository, 'getPreferences').mockImplementation(() => new Promise((resolve) => {
      resolvePreferences = resolve;
    }));
    const manager = createXRepostTimelineManager(
      () => ({ updateAppearance: vi.fn(), destroy: vi.fn() }),
      repository,
    );
    manager.sync(document, new URL('https://x.com/home'));
    await repository.setHideAds(false);
    resolvePreferences?.({ showReposts: true, hiddenRepostDisplayMode: 'social-context', hideAds: true });
    await Promise.resolve();

    expect(article.style.display).toBe('flex');
    const repost = document.querySelector<HTMLElement>('#home-repost')!;
    expect(repost.style.display).toBe('');
    await repository.setShowReposts(false);
    expect(repost.previousElementSibling).toHaveAttribute(
      'data-twitter-enhancement-repost-placeholder', 'social-context',
    );
    expect(article.style.display).toBe('flex');
    manager.destroy();
  });

  it('never temporarily expands an ad when the same tweet was expanded as a repost', async () => {
    renderHomePage();
    const ad = appendPromotedTweet('ad-of-reposted-tweet', '321');
    const repost = document.querySelector<HTMLElement>('#home-repost')!;
    const repository = new FakeListRepostPreferenceRepository(false, 'divider');
    const manager = createXRepostTimelineManager(
      () => ({ updateAppearance: vi.fn(), destroy: vi.fn() }),
      repository,
    );
    await Promise.resolve();
    manager.sync(document, new URL('https://x.com/home'));

    repost.previousElementSibling?.shadowRoot?.querySelector('button')?.click();
    manager.sync(document, new URL('https://x.com/home'));
    expect(repost.style.display).toBe('');
    expect(ad.style.display).toBe('none');
    expect(ad.parentElement?.querySelector('[data-twitter-enhancement-repost-placeholder]'))
      .toBeNull();

    await repository.setHideAds(false);
    expect(ad.style.display).toBe('flex');
    await repository.setHideAds(true);
    expect(ad.style.display).toBe('none');
    expect(repost.style.display).toBe('');
    manager.destroy();
  });

  it('filters newly loaded ads and restores an article recycled into an ordinary tweet', async () => {
    renderListPage();
    const repository = new FakeListRepostPreferenceRepository(false, 'social-context');
    const manager = createXRepostTimelineManager(
      () => ({ updateAppearance: vi.fn(), destroy: vi.fn() }),
      repository,
    );
    await Promise.resolve();
    manager.sync(document, listUrl);

    const article = appendPromotedTweet();
    manager.sync(document, listUrl);
    expect(article.style.display).toBe('none');
    expect(article.parentElement?.querySelector('[data-twitter-enhancement-repost-placeholder]'))
      .toBeNull();

    article.querySelector('.ad-label')?.remove();
    article.querySelector('a[href*="/status/"]')?.setAttribute('href', '/advertiser/status/989');
    manager.sync(document, listUrl);

    expect(article.style.getPropertyValue('display')).toBe('flex');
    expect(article.style.getPropertyPriority('display')).toBe('important');
    expect(article).not.toHaveAttribute('data-twitter-enhancement-hidden-promoted-tweet');
    manager.destroy();
  });

  it('keeps expansion scoped to a repost instead of its quoted tweet', async () => {
    renderListPage();
    const firstRepost = appendPromotedTweet('first-quote-repost', '987');
    const secondRepost = appendPromotedTweet('second-quote-repost', '988');
    for (const article of [firstRepost, secondRepost]) {
      article.querySelector('.ad-label')?.remove();
      article.insertAdjacentHTML('afterbegin', '<div data-testid="socialContext">alice 已转帖</div>');
      const statusLink = article.querySelector('a[href*="/status/"]');
      const href = statusLink?.getAttribute('href');
      statusLink?.remove();
      article.insertAdjacentHTML('beforeend', `
        <div role="link">
          <a role="link" href="/source/status/123"><time>昨天</time></a>
          <div data-testid="tweetText">引用内容</div>
        </div>
        <div role="group"><a role="link" href="${href}/analytics">查看分析</a></div>
      `);
    }
    const repository = new FakeListRepostPreferenceRepository(false, 'divider');
    const manager = createXRepostTimelineManager(
      () => ({ updateAppearance: vi.fn(), destroy: vi.fn() }),
      repository,
    );
    await Promise.resolve();
    manager.sync(document, listUrl);

    firstRepost.previousElementSibling?.shadowRoot?.querySelector('button')?.click();
    manager.sync(document, listUrl);
    expect(firstRepost.style.display).toBe('flex');
    expect(secondRepost.style.display).toBe('none');
    expect(document.querySelector<HTMLElement>('#plain-repost')?.style.display).toBe('none');

    const replacement = firstRepost.cloneNode(true) as HTMLElement;
    firstRepost.replaceWith(replacement);
    manager.sync(document, listUrl);
    expect(replacement.style.display).toBe('flex');
    manager.destroy();
  });

  it('removes the repost placeholder when an article becomes an ad', async () => {
    renderHomePage();
    const article = appendPromotedTweet();
    const repository = new FakeListRepostPreferenceRepository(false, 'social-context');
    const manager = createXRepostTimelineManager(
      () => ({ updateAppearance: vi.fn(), destroy: vi.fn() }),
      repository,
    );
    await Promise.resolve();
    manager.sync(document, new URL('https://x.com/home'));
    const adContents = article.innerHTML;
    article.innerHTML = '<div data-testid="socialContext">alice 已转帖</div>';
    manager.sync(document, new URL('https://x.com/home'));

    expect(article).not.toHaveAttribute('data-twitter-enhancement-hidden-promoted-tweet');
    expect(article).toHaveAttribute('data-twitter-enhancement-hidden-plain-repost');
    const repostPlaceholder = article.previousElementSibling;
    expect(repostPlaceholder?.shadowRoot?.querySelector('button')).toHaveAccessibleName(
      '一条来自 alice 的转贴已被收起，点击可还原',
    );

    article.innerHTML = adContents;
    manager.sync(document, new URL('https://x.com/home'));

    expect(repostPlaceholder?.isConnected).toBe(false);
    expect(article).not.toHaveAttribute('data-twitter-enhancement-hidden-plain-repost');
    expect(article).toHaveAttribute('data-twitter-enhancement-hidden-promoted-tweet');
    expect(article.parentElement?.querySelectorAll('[data-twitter-enhancement-repost-placeholder]'))
      .toHaveLength(0);
    manager.destroy();
    expect(article.style.getPropertyValue('display')).toBe('flex');
    expect(article.style.getPropertyPriority('display')).toBe('important');
  });

  it.each(['route exit', 'destroy'] as const)(
    'restores ad display and priority on %s',
    async (cleanup) => {
      renderProfilePage();
      const article = appendPromotedTweet();
      const repository = new FakeListRepostPreferenceRepository(false, 'social-context');
      const destroy = vi.fn();
      const manager = createXRepostTimelineManager(
        () => ({ updateAppearance: vi.fn(), destroy }),
        repository,
      );
      await Promise.resolve();
      manager.sync(document, new URL('https://x.com/alice'));
      expect(article.style.display).toBe('none');
      expect(article.parentElement?.querySelector('[data-twitter-enhancement-repost-placeholder]'))
        .toBeNull();

      if (cleanup === 'route exit') {
        manager.sync(document, new URL('https://x.com/alice/status/654'));
      } else {
        manager.destroy();
      }

      expect(article.style.getPropertyValue('display')).toBe('flex');
      expect(article.style.getPropertyPriority('display')).toBe('important');
      expect(article).not.toHaveAttribute('data-twitter-enhancement-hidden-promoted-tweet');
      expect(destroy).toHaveBeenCalledOnce();
      manager.destroy();
    },
  );
});
