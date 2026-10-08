import { isPromotedTweetArticle } from '../src/platform/x/promoted-tweet';

function renderArticle(headerExtra = '', body = '', displayName = 'Nordace'): HTMLElement {
  document.body.innerHTML = `
    <article id="tweet">
      <div class="header">
        <div data-testid="User-Name"><a href="/NordaceOfficial"><span>${displayName}</span></a></div>
        <div class="header-actions">${headerExtra}<button data-testid="caret" aria-label="更多"></button></div>
      </div>
      ${body}
    </article>
  `;
  return document.querySelector<HTMLElement>('#tweet')!;
}

function renderArticleWithLeadingBanner(banner: string): HTMLElement {
  document.body.innerHTML = `
    <article id="tweet"><div><div>
      ${banner}
      <div class="tweet-body">
        <div class="header">
          <div data-testid="User-Name"><a href="/NordaceOfficial"><span>Nordace</span></a></div>
          <div><button data-testid="caret" aria-label="更多"></button></div>
        </div>
        <div data-testid="tweetText">背包介绍</div>
      </div>
    </div></div></article>
  `;
  return document.querySelector<HTMLElement>('#tweet')!;
}

describe('promoted tweet detection', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it.each(['广告', '廣告', '已推广', '已推廣', 'Ad', 'Promoted', ' ad '])(
    'recognizes an independent %s label beside the more button',
    (label) => {
      const article = renderArticle(`<div><span>${label}</span></div>`, '<div data-testid="tweetText">背包介绍</div>');

      expect(isPromotedTweetArticle(article)).toBe(true);
    },
  );

  it.each(['已推广', '已推廣', 'Promoted'])(
    'recognizes a standalone %s banner immediately before the tweet body',
    (label) => {
      const article = renderArticleWithLeadingBanner(`
        <div><div><div><div><div></div><div><div dir="ltr"><span>${label}</span></div></div></div></div></div>
      `);

      expect(isPromotedTweetArticle(article)).toBe(true);
    },
  );

  it.each([
    '<div data-testid="tweetText"><span>已推广</span></div>',
    '<div><div data-testid="tweetText"><span>已推广</span></div></div>',
    '<div data-testid="quoteTweet"><span>已推广</span></div>',
    '<div><div role="link"><span>已推广</span></div></div>',
    '<article><span>已推广</span></article>',
    '<div><div data-testid="card.wrapper"><span>已推广</span></div></div>',
    '<div><div role="menu"><span>已推广</span></div></div>',
    '<div><a href="/sponsor"><span>已推广</span></a></div>',
    '<div><span aria-hidden="true">已推广</span></div>',
    '<div hidden><span>已推广</span></div>',
    '<div><span>这条内容已推广</span></div>',
  ])('ignores content placed before the header: %s', (banner) => {
    expect(isPromotedTweetArticle(renderArticleWithLeadingBanner(banner))).toBe(false);
  });

  it('requires the promoted banner to be immediately adjacent to the body', () => {
    const article = renderArticleWithLeadingBanner('<div><span>已推广</span></div><div>其他内容</div>');

    expect(isPromotedTweetArticle(article)).toBe(false);
  });

  it('does not use a following label as a leading promoted banner', () => {
    const article = renderArticleWithLeadingBanner('');
    const body = article.querySelector<HTMLElement>('.tweet-body')!;
    body.insertAdjacentHTML('afterend', '<div><span>已推广</span></div>');

    expect(isPromotedTweetArticle(article)).toBe(false);
  });

  it('recognizes an explicit promoted indicator without a text header fallback', () => {
    document.body.innerHTML = '<article><div data-testid="promotedIndicator">未知语言标签</div></article>';

    expect(isPromotedTweetArticle(document.querySelector('article')!)).toBe(true);
  });

  it('keeps recognizing an article hidden by the visibility controller', () => {
    const article = renderArticle('<span>广告</span>');
    article.style.setProperty('display', 'none', 'important');

    expect(isPromotedTweetArticle(article)).toBe(true);
  });

  it.each(['广告', 'Ad', 'Promoted'])('does not classify a display name %s as an ad', (name) => {
    expect(isPromotedTweetArticle(renderArticle('', '', name))).toBe(false);
  });

  it.each([
    '<div data-testid="tweetText">广告</div>',
    '<div data-testid="tweetText"><span>Ad</span></div>',
    '<div data-testid="tweetText">这篇广告介绍很有意思</div>',
    '<div data-testid="card.wrapper"><span>广告</span></div>',
    '<div data-testid="quoteTweet"><span>广告</span></div>',
    '<div role="link"><span>广告</span></div>',
    '<a role="link" href="/quoted/status/1"><span data-testid="promotedIndicator">广告</span></a>',
    '<div role="menu"><div role="menuitem"><span>广告</span></div></div>',
    '<div data-testid="tweetText"><span data-testid="promotedIndicator">广告</span></div>',
  ])('ignores ad wording inside content: %s', (body) => {
    expect(isPromotedTweetArticle(renderArticle('', body))).toBe(false);
  });

  it.each([
    '<div role="menu"><span>广告</span></div>',
    '<div role="menuitem"><span data-testid="promotedIndicator">广告</span></div>',
    '<div hidden><span>广告</span></div>',
    '<span aria-hidden="true">广告</span>',
    '<span>关于广告</span>',
    '<span>Ad choices</span>',
  ])('ignores non-label or hidden header text: %s', (headerExtra) => {
    expect(isPromotedTweetArticle(renderArticle(headerExtra))).toBe(false);
  });

  it('ignores promoted markers and headers inside quoted content', () => {
    const quote = `
      <div role="link">
        <div data-testid="User-Name"><span>引用作者</span></div>
        <span data-testid="promotedIndicator">广告</span>
        <button data-testid="caret"></button>
      </div>
    `;

    expect(isPromotedTweetArticle(renderArticle('', quote))).toBe(false);
  });

  it('does not propagate a nested article ad label to its parent', () => {
    const nestedArticle = `
      <article id="nested">
        <div>
          <div data-testid="User-Name"><span>广告作者</span></div>
          <span data-testid="promotedIndicator">广告</span>
          <button data-testid="caret"></button>
        </div>
      </article>
    `;
    const article = renderArticle('', nestedArticle);

    expect(isPromotedTweetArticle(article)).toBe(false);
    expect(isPromotedTweetArticle(document.querySelector<HTMLElement>('#nested')!)).toBe(true);
  });

  it('does not search the whole article when the header boundary is ambiguous', () => {
    document.body.innerHTML = `
      <article><div>
        <div data-testid="User-Name"><span>普通作者</span></div>
        <div data-testid="tweetText"><span>广告</span></div>
        <button data-testid="caret"></button>
      </div></article>
    `;

    expect(isPromotedTweetArticle(document.querySelector('article')!)).toBe(false);
  });

  it('requires an identity and a more button for the text fallback', () => {
    document.body.innerHTML = '<article><div><span>广告</span><button data-testid="caret"></button></div></article>';
    expect(isPromotedTweetArticle(document.querySelector('article')!)).toBe(false);

    document.body.innerHTML = '<article><div data-testid="User-Name">普通作者</div><span>广告</span></article>';
    expect(isPromotedTweetArticle(document.querySelector('article')!)).toBe(false);
  });

  it('rejects a container that is not an article', () => {
    const article = renderArticle('<span>广告</span>');

    expect(isPromotedTweetArticle(article.parentElement!)).toBe(false);
  });
});
