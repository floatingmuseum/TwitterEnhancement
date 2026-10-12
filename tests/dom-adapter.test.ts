import {
  extractDisplayNameFromElement,
  extractHandleFromElement,
  findXNoteSurfaceTargets,
} from '../src/platform/x/dom-adapter';

describe('X DOM adapter', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('finds a profile identity block on profile routes', () => {
    document.body.innerHTML = `
      <main role="main">
        <section data-testid="primaryColumn">
          <div class="profile-header">
            <div data-testid="UserName">
              <a href="/Alice"><span>Alice</span></a>
              <div><span>@Alice</span></div>
            </div>
            <div data-testid="UserDescription">简介</div>
          </div>
        </section>
      </main>
    `;

    const targets = findXNoteSurfaceTargets(document, new URL('https://x.com/Alice'));
    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({
      handle: 'alice',
      displayName: 'Alice',
      surface: 'profile',
    });
    expect(targets[0]?.anchor).toHaveAttribute('data-testid', 'UserName');
  });

  it('does not mistake status or reserved routes for profiles', () => {
    document.body.innerHTML = `
      <main role="main"><section data-testid="primaryColumn">
        <div data-testid="UserName"><span>@Alice</span></div>
      </section></main>
    `;

    expect(
      findXNoteSurfaceTargets(document, new URL('https://x.com/Alice/status/1')),
    ).toHaveLength(0);
    expect(
      findXNoteSurfaceTargets(document, new URL('https://x.com/explore')),
    ).toHaveLength(0);
  });

  it('does not mistake a tweet identity for the profile header on a profile route', () => {
    document.body.innerHTML = `
      <main role="main"><section data-testid="primaryColumn">
        <article data-testid="tweet">
          <div data-testid="UserName">
            <a href="/Alice">Alice</a><a href="/Alice">@Alice</a>
            <a href="/Alice/status/123"><time>32 分钟</time></a>
          </div>
        </article>
      </section></main>
    `;

    const targets = findXNoteSurfaceTargets(document, new URL('https://x.com/Alice'));
    expect(targets).toHaveLength(1);
    expect(targets[0]?.surface).toBe('tweet');

    document.querySelector('[data-testid="primaryColumn"]')!.insertAdjacentHTML('beforeend', `
      <div id="profile-identity" data-testid="UserName">
        <a href="/Alice">Alice</a><span>@Alice</span>
      </div>
    `);
    expect(findXNoteSurfaceTargets(document, new URL('https://x.com/Alice')))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          surface: 'profile',
          anchor: document.getElementById('profile-identity'),
        }),
      ]));
  });

  it('finds hover cards independently of the current route', () => {
    document.body.innerHTML = `
      <div id="layers">
        <div data-testid="HoverCard">
          <div data-testid="UserName">
            <a href="/Bob"><span>Bob</span></a>
            <a href="/Bob"><span>@Bob</span></a>
          </div>
          <div data-testid="UserDescription">简介里提到 @someone</div>
        </div>
      </div>
    `;

    const targets = findXNoteSurfaceTargets(document, new URL('https://x.com/home'));
    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({
      handle: 'bob',
      displayName: 'Bob',
      surface: 'hover-card',
    });
  });

  it.each([
    ['User-Name', 'https://x.com/home', '/Alice/status/123'],
    ['UserName', 'https://x.com/i/lists/456', 'https://twitter.com/Alice/status/123?s=20'],
    ['User-Name', 'https://x.com/Alice', '/Alice/status/123'],
    ['User-Name', 'https://x.com/Bob/status/456', '/Alice/status/123'],
  ])('finds the tweet author and time anchor in %s on %s', (testId, route, statusUrl) => {
    document.body.innerHTML = `
      <article data-testid="tweet">
        <div data-testid="socialContext"><a href="/Reposter">Reposter 转帖</a></div>
        <div data-testid="${testId}">
          <div><a href="/Alice" role="link"><span>Alice</span><img alt="🌙"></a></div>
          <div>
            <div><a href="/Alice" role="link"><span>@Alice</span></a></div>
            <div>·</div>
            <div><a id="author-time" href="${statusUrl}" role="link"><time>32 分钟</time></a></div>
          </div>
        </div>
        <div data-testid="tweetText">回复 <a href="/Bob">@Bob</a></div>
        <div data-testid="quoteTweet">
          <div data-testid="User-Name">
            <a href="/Quoted">Quoted</a>
            <a id="quoted-time" href="/Quoted/status/789"><time>1 小时</time></a>
          </div>
        </div>
        <div role="group"><a href="/Other/status/999">更多</a></div>
      </article>
    `;

    const targets = findXNoteSurfaceTargets(document, new URL(route));
    expect(targets).toHaveLength(2);
    expect(targets[0]).toMatchObject({
      handle: 'alice',
      displayName: 'Alice🌙',
      surface: 'tweet',
      anchor: document.getElementById('author-time'),
    });
    expect(targets[1]).toMatchObject({
      handle: 'quoted',
      surface: 'tweet',
      anchor: document.getElementById('quoted-time'),
    });
  });

  it('does not use a timestamp as a missing author display name', () => {
    document.body.innerHTML = `
      <article data-testid="tweet">
        <div data-testid="User-Name">
          <a href="/Alice">@Alice</a>
          <a href="/Alice/status/123"><time>32 分钟</time></a>
        </div>
      </article>
    `;

    expect(findXNoteSurfaceTargets(document, new URL('https://x.com/home'))[0])
      .toMatchObject({ handle: 'alice', displayName: null, surface: 'tweet' });
  });

  it.each([
    '/Bob/status/123',
    'https://example.com/Alice/status/123',
    'http://x.com/Alice/status/123',
    '/Alice/status/not-a-tweet',
    '/Alice/status/123/photo/1',
    '/Alice',
    'https://[',
  ])('ignores a mismatched or invalid author timestamp URL: %s', (statusUrl) => {
    document.body.innerHTML = `
      <article data-testid="tweet">
        <div data-testid="User-Name">
          <a href="/Alice">Alice</a>
          <a href="${statusUrl}"><time>32 分钟</time></a>
        </div>
      </article>
    `;

    expect(findXNoteSurfaceTargets(document, new URL('https://x.com/home'))).toEqual([]);
  });

  it.each(['https://example.com/Alice', '/Alice/with_replies', '/home', ''])
    ('requires a canonical author profile link: %s', (profileUrl) => {
      document.body.innerHTML = `
        <article data-testid="tweet">
          <div data-testid="User-Name">
            <a href="${profileUrl}">@Alice</a>
            <a href="/Alice/status/123"><time>32 分钟</time></a>
          </div>
        </article>
      `;

      expect(findXNoteSurfaceTargets(document, new URL('https://x.com/home'))).toEqual([]);
    });

  it('anchors a detail author without inline time to its own handle', () => {
    document.body.innerHTML = `
      <article data-testid="tweet">
        <div data-testid="User-Name"><a href="/Alice">Alice</a><span id="detail-handle">@Alice</span></div>
        <div data-testid="tweetText">正文</div>
        <div data-testid="User-Name">
          <a href="/Quoted">Quoted</a>
          <a href="/Quoted/status/789"><time>1 小时</time></a>
        </div>
        <a href="/Alice/status/123"><time>详情时间</time></a>
      </article>
    `;

    expect(findXNoteSurfaceTargets(document, new URL('https://x.com/Alice/status/123')))
      .toEqual([expect.objectContaining({
        handle: 'alice',
        surface: 'tweet',
        anchor: document.getElementById('detail-handle'),
      })]);
  });

  it.each(['data-testid="quoteTweet"', 'role="link" tabindex="0"'])(
    'finds a linkless quoted identity inside %s independently of the detail author', (attributes) => {
      document.body.innerHTML = `
        <article data-testid="tweet">
          <div data-testid="User-Name">
            <div><a href="/dotey">宝玉</a></div>
            <div id="detail-row"><div><a id="detail-handle" href="/dotey">@dotey</a></div></div>
          </div>
          <p data-testid="tweetText">REA 背后的大佬，推荐关注 <a href="/Someone">@Someone</a></p>
          <div ${attributes}>
            <div data-testid="User-Name">
              <div><div><span>morluto</span></div></div>
              <div><div><div tabindex="-1"><span>@morluto</span></div></div>
                <span aria-hidden="true">·</span>
                <div><div aria-label="12 小时前"><time id="quote-time" datetime="2026-10-11T19:54:32.000Z">12小时</time></div></div>
              </div>
            </div>
            <p data-testid="tweetText">正文里提到 @Someone</p>
          </div>
          <a href="/dotey/status/123"><time>下午3:33</time></a>
        </article>
      `;

      const targets = findXNoteSurfaceTargets(document, new URL('https://x.com/dotey/status/123'));
      expect(targets).toHaveLength(2);
      expect(targets[0]).toMatchObject({
        handle: 'dotey',
        anchor: document.getElementById('detail-handle'),
        inlineContainer: document.getElementById('detail-row'),
      });
      expect(targets[1]).toMatchObject({ handle: 'morluto', anchor: document.getElementById('quote-time') });
    },
  );

  it.each(['/Alice/status/456', '/Bob/status/123', 'https://example.com/Alice/status/123', null])(
    'does not use an unrelated detail permalink as evidence: %s', (permalink) => {
      document.body.innerHTML = `
        <article data-testid="tweet">
          <div data-testid="User-Name"><a href="/Alice">Alice</a><a href="/Alice">@Alice</a></div>
          ${permalink ? `<a href="${permalink}"><time>详情时间</time></a>` : ''}
          <div role="link"><div data-testid="User-Name"><span>Bob</span><span>@Bob</span><time>1小时</time></div></div>
        </article>
      `;
      expect(findXNoteSurfaceTargets(document, new URL('https://x.com/Alice/status/123')).map(target => target.handle))
        .toEqual(['bob']);
      expect(findXNoteSurfaceTargets(document, new URL('https://x.com/home')).map(target => target.handle))
        .toEqual(['bob']);
    },
  );

  it('keeps nested quotations separate without duplicating an enclosing quote wrapper', () => {
    document.body.innerHTML = `
      <article data-testid="tweet">
        <div data-testid="quoteTweet"><div role="link">
          <div data-testid="User-Name"><span>Bob</span><span>@Bob</span><time id="bob-time">1小时</time></div>
          <div role="link">
            <div data-testid="User-Name"><span>Carol</span><span>@Carol</span><time id="carol-time">2小时</time></div>
          </div>
        </div></div>
      </article>
    `;
    expect(findXNoteSurfaceTargets(document, new URL('https://x.com/home')).map(target => [target.handle, target.anchor.id]))
      .toEqual([['bob', 'bob-time'], ['carol', 'carol-time']]);
  });

  it.each([
    '<span>Bob @Bob</span><time>1小时</time>',
    '<span>@Bob</span><span>@Carol</span><time>1小时</time>',
    '<span>@Bob</span>',
    '<a href="https://example.com/Bob">Bob</a><span>@Bob</span><time>1小时</time>',
    '<a href="/home">@Bob</a><time>1小时</time>',
    '<a href="/Bob">Bob</a><span>@Bob</span><a href="/Carol/status/1"><time>1小时</time></a>',
    '<span>@Bob</span><a href="https://example.com/Bob/status/1"><time>1小时</time></a>',
  ])('skips ambiguous or mismatched quoted identities: %s', (identity) => {
    document.body.innerHTML = `<article data-testid="tweet"><div role="link"><div data-testid="User-Name">${identity}</div></div></article>`;
    expect(findXNoteSurfaceTargets(document, new URL('https://x.com/home'))).toEqual([]);
  });

  it.each([
    'data-testid="socialContext"',
    'data-testid="tweetText"',
    'data-testid="card.wrapper"',
    'data-testid="tweetPhoto"',
    'data-testid="videoPlayer"',
    'role="menu"',
    'role="dialog"',
    'hidden',
    'aria-hidden="true"',
  ])('ignores author-shaped content inside %s', (attributes) => {
    document.body.innerHTML = `
      <article data-testid="tweet">
        <div ${attributes}>
          <div role="link"><div data-testid="User-Name">
            <a href="/Alice">Alice</a>
            <a href="/Alice/status/123"><time>32 分钟</time></a>
          </div></div>
        </div>
      </article>
    `;

    expect(findXNoteSurfaceTargets(document, new URL('https://x.com/home'))).toEqual([]);
  });

  it('ignores nested articles instead of identifying their authors as the outer author', () => {
    document.body.innerHTML = `
      <article data-testid="tweet">
        <article data-testid="tweet">
          <div data-testid="User-Name">
            <a href="/Alice">Alice</a>
            <a href="/Alice/status/123"><time>32 分钟</time></a>
          </div>
        </article>
      </article>
    `;

    expect(findXNoteSurfaceTargets(document, new URL('https://x.com/home'))).toEqual([]);
  });

  it('extracts a handle from an exact nested text node', () => {
    const element = document.createElement('div');
    element.innerHTML = '<span>Display name</span><div><span>@CaseSensitive</span></div>';
    expect(extractHandleFromElement(element)).toBe('casesensitive');
  });

  it('extracts the display name from the profile link instead of the handle', () => {
    const element = document.createElement('div');
    element.innerHTML = `
      <a href="/Alice"><span>Alice New Name</span></a>
      <a href="/Alice"><span>@Alice</span></a>
    `;

    expect(extractDisplayNameFromElement(element, 'alice')).toBe('Alice New Name');
  });

  it('extracts a display name from the linkless identity structure used by X profiles', () => {
    const element = document.createElement('div');
    element.innerHTML = `
      <div>
        <div>
          <div>
            <span>
              <span>むとうあやか</span><img alt="❣️"><span>本垢です。</span>
            </span>
          </div>
          <div><span>@mutoayaka12</span></div>
        </div>
      </div>
    `;

    expect(extractDisplayNameFromElement(element, 'mutoayaka12')).toBe(
      'むとうあやか❣️本垢です。',
    );
  });
});
