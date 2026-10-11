import {
  createXExternalVideoManager,
  findXExternalVideoTargets,
  type XExternalVideoTarget,
} from '../src/platform/x/external-video-manager';
import type { CapturedExternalVideoCard } from '../src/platform/x/external-video-data-bridge';

const youtube = 'https://www.youtube.com/watch?v=bGKkHF02w0M';
const thumbnail = 'https://pbs.twimg.com/card_img/2109093129978531841/t0Kf_Jha';
function capture(overrides: Partial<CapturedExternalVideoCard> = {}): CapturedExternalVideoCard {
  return { tweetId: '123', cardUrl: 'https://t.co/video', url: youtube,
    playerUrl: 'https://www.youtube.com/embed/bGKkHF02w0M', isPlayer: true,
    imageUrls: [`${thumbnail}?format=jpg&name=large`], ...overrides };
}
function card(href = youtube) {
  return `<div data-testid="card.wrapper"><a href="${href}"><img src="${thumbnail}?format=webp&name=small">youtube.com</a></div>`;
}
function tweet(content: string, id = '123') {
  return `<article><a href="/Alice/status/${id}"><time>1h</time></a>${content}<div role="group"><button data-testid="like">Like</button></div></article>`;
}

describe('X external video cards', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('adds targets for card links, leaving body links, ordinary cards and native videos alone', () => {
    document.body.innerHTML = tweet(`${card()}${card('https://example.com/story')}
      <div data-testid="tweetText"><a href="${youtube}">video</a></div>
      <div data-testid="videoPlayer"><button data-testid="playButton">Play</button><video></video></div>`);
    expect(findXExternalVideoTargets(document, []).map((target) => target.link))
      .toEqual([{ url: youtube, provider: 'YouTube' }]);
  });

  it('reads a complete expanded link and does not guess from visible domain text', () => {
    document.body.innerHTML = tweet(`<div data-testid="card.wrapper"><a href="https://t.co/video" title="${youtube}">youtube.com</a></div>`);
    expect(findXExternalVideoTargets(document, [])[0]?.link.url).toBe(youtube);
    document.querySelector('[title]')!.removeAttribute('title');
    expect(findXExternalVideoTargets(document, [])).toEqual([]);
  });

  it('resolves an exact shortened card URL even when its thumbnail is absent', () => {
    document.body.innerHTML = tweet(`<div data-testid="card.wrapper"><a href="https://t.co/video">youtube.com</a></div>`);
    expect(findXExternalVideoTargets(document, [capture()])[0]?.link.url).toBe(youtube);
  });

  it('reads URL attributes on the card itself inside a wrapping link', () => {
    document.body.innerHTML = tweet(`<a href="https://t.co/video"><div data-testid="card.wrapper" title="${youtube}">youtube.com</div></a>`);
    expect(findXExternalVideoTargets(document, [])[0]?.link.url).toBe(youtube);
  });

  it('uses exact URLs before thumbnails and rejects stale thumbnails on recycled cards', () => {
    document.body.innerHTML = tweet(card('https://t.co/new'));
    expect(findXExternalVideoTargets(document, [capture()])).toEqual([]);
    const current = capture({ cardUrl: 'https://t.co/new', url: 'https://vimeo.com/1234' });
    expect(findXExternalVideoTargets(document, [capture(), current])[0]?.link.provider).toBe('Vimeo');
  });

  it('does not fall back to stale tweet data when a button thumbnail changes', () => {
    document.body.innerHTML = tweet(`<button><img src="https://pbs.twimg.com/card_img/new/other"><svg data-icon="icon-play"></svg>youtube.com</button>`);
    expect(findXExternalVideoTargets(document, [capture()])).toEqual([]);
  });

  it('recognizes the supplied public post button using its captured thumbnail', () => {
    document.body.innerHTML = tweet(`<button aria-label="Play 断更的一个多月到底发生了什么？">
      <img src="${thumbnail}?format=webp&name=medium"><svg data-icon="icon-play"></svg>youtube.com
    </button>`, '2109093127042605088');
    expect(findXExternalVideoTargets(document, [capture()])[0]?.link.url).toBe(youtube);
    expect(findXExternalVideoTargets(document, [])[0]).toBeUndefined();
  });

  it('falls back to an unambiguous owning tweet for a legacy player card', () => {
    document.body.innerHTML = tweet('<div data-testid="card.wrapper"><div role="button">youtube.com</div></div>');
    expect(findXExternalVideoTargets(document, [capture()])[0]?.link.url).toBe(youtube);
  });

  it('does not inherit the parent tweet URL for a quote with no reliable match', () => {
    document.body.innerHTML = tweet(`<div role="link"><a href="/Bob/status/456"><time>2h</time></a>
      <div data-testid="card.wrapper"><div role="button">youtube.com</div></div></div>`);
    expect(findXExternalVideoTargets(document, [capture()])).toEqual([]);
    expect(findXExternalVideoTargets(document, [capture({ tweetId: '456' })])[0]?.link.url).toBe(youtube);
  });

  it('does not assign an unrelated body URL or conflicting captured destination', () => {
    document.body.innerHTML = tweet('<div data-testid="card.wrapper"><a href="https://t.co/other">youtube.com</a></div>');
    expect(findXExternalVideoTargets(document, [capture()])).toEqual([]);
    document.body.innerHTML = tweet(card('https://t.co/video'));
    expect(findXExternalVideoTargets(document, [capture(), capture({ url: 'https://vimeo.com/1234' })])).toEqual([]);
  });

  it('supports known external iframe players and places the target outside wrapping links', () => {
    document.body.innerHTML = tweet(`<a id="wrapper" href="https://t.co/video"><div data-testid="card.wrapper">
      <iframe src="https://www.youtube.com/embed/bGKkHF02w0M?autoplay=1"></iframe></div></a>`);
    const target = findXExternalVideoTargets(document, [])[0]!;
    expect(target.anchor.id).toBe('wrapper');
    expect(target.link.url).toBe(youtube);
  });

  it('handles the same-origin X cards-frame without requiring cross-origin access', () => {
    document.body.innerHTML = tweet('<div><iframe src="https://x.com/i/cards-frame/123"></iframe></div>');
    expect(findXExternalVideoTargets(document, [capture()])[0]?.link.url).toBe(youtube);
  });

  it('keeps a bare iframe target inside its article', () => {
    document.body.innerHTML = tweet('<iframe src="https://www.youtube.com/embed/bGKkHF02w0M"></iframe>');
    const target = findXExternalVideoTargets(document, [])[0]!;
    expect(target.anchor.tagName).toBe('IFRAME');
    expect(target.link.url).toBe(youtube);
  });

  it('supports other confirmed player cards with canonical URLs, but not unknown embeds', () => {
    document.body.innerHTML = tweet('<div data-testid="card.wrapper"><a href="https://t.co/video">Video</a></div>');
    const other = capture({ url: 'https://video.example/watch/123', playerUrl: 'https://video.example/embed/123' });
    expect(findXExternalVideoTargets(document, [other])[0]?.link)
      .toEqual({ url: 'https://video.example/watch/123', provider: 'video.example' });
    expect(findXExternalVideoTargets(document, [{ ...other, isPlayer: false }])).toEqual([]);
    expect(findXExternalVideoTargets(document, [{ ...other, url: other.playerUrl! }])).toEqual([]);
  });

  it('does not add controls to hover cards, profile biographies or action bar links', () => {
    document.body.innerHTML = `<div data-testid="HoverCard">${card()}</div><div data-testid="UserDescription">${card()}</div>
      <article><div role="group"><a href="${youtube}">YouTube</a></div></article>`;
    expect(findXExternalVideoTargets(document, [])).toEqual([]);
  });

  it('refreshes recycled URLs before activation and deduplicates repeated scans', () => {
    document.body.innerHTML = tweet(card());
    const destroy = vi.fn();
    const updateAppearance = vi.fn();
    let resolve: () => XExternalVideoTarget | null = () => null;
    const mount = vi.fn((_target, resolveTarget: typeof resolve) => {
      resolve = resolveTarget;
      return { destroy, updateAppearance, isConnected: () => true };
    });
    const manager = createXExternalVideoManager(mount, () => []);
    manager.sync(); manager.sync();
    expect(mount).toHaveBeenCalledOnce();
    expect(updateAppearance).toHaveBeenCalledOnce();
    document.querySelector<HTMLAnchorElement>('[data-testid="card.wrapper"] a')!.href = 'https://vimeo.com/1234';
    expect(resolve()?.link).toEqual({ url: 'https://vimeo.com/1234', provider: 'Vimeo' });
    manager.sync();
    expect(mount).toHaveBeenCalledTimes(2);
    expect(destroy).toHaveBeenCalledOnce();
    document.querySelector('[data-testid="card.wrapper"]')!.remove();
    expect(resolve()).toBeNull();
    manager.sync(); manager.destroy();
    expect(destroy).toHaveBeenCalledTimes(2);
  });

  it('mounts after data arrives, restores removed controls and cleans up on destroy', () => {
    document.body.innerHTML = tweet(card('https://t.co/video'));
    let captures: CapturedExternalVideoCard[] = [];
    let connected = true;
    const destroy = vi.fn();
    const mount = vi.fn(() => ({ destroy, updateAppearance: vi.fn(), isConnected: () => connected }));
    const manager = createXExternalVideoManager(mount, () => captures);
    manager.sync(); expect(mount).not.toHaveBeenCalled();
    captures = [capture()];
    manager.sync(); expect(mount).toHaveBeenCalledOnce();
    connected = false;
    manager.sync(); expect(mount).toHaveBeenCalledTimes(2);
    manager.destroy(); manager.destroy();
    expect(destroy).toHaveBeenCalledTimes(2);
  });
});
