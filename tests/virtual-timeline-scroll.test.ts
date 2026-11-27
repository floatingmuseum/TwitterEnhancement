import { INTERFACE_LAYOUT_STORAGE_KEYS } from '../src/shared/storage/interface-layout-preference-repository';
import { createTimelineRowHeights } from '../src/platform/x/timeline-row-heights';

vi.mock('wxt/browser', () => ({ browser: {
  runtime: { sendMessage: async () => true },
  storage: {
    local: { get: async () => ({
      [INTERFACE_LAYOUT_STORAGE_KEYS.leftNavigationExpanded]: false,
      [INTERFACE_LAYOUT_STORAGE_KEYS.rightSidebarVisible]: false,
    }) },
    onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
  },
} }));

function observeLayout() {
  const watched = new Set<Element>();
  let deliver: (entries: ResizeObserverEntry[]) => void;
  vi.stubGlobal('ResizeObserver', class implements ResizeObserver {
    constructor(callback: ResizeObserverCallback) { deliver = entries => callback(entries, this); }
    observe(target: Element) { watched.add(target); }
    unobserve(target: Element) { watched.delete(target); }
    disconnect() { watched.clear(); }
  });
  document.adoptedStyleSheets = [];
  return (target: Element, height: number, width = 1300) => {
    expect(watched.has(target)).toBe(true);
    const size = [{ inlineSize: width, blockSize: height }];
    deliver([{ target, borderBoxSize: size, contentBoxSize: size, devicePixelContentBoxSize: size,
      contentRect: new DOMRect(0, 0, width, height) }]);
  };
}

function reservedHeight(row: Element) {
  for (const sheet of document.adoptedStyleSheets) {
    for (const rule of sheet.cssRules) {
      if (rule instanceof CSSStyleRule && row.matches(rule.selectorText)) return rule.style.height;
    }
  }
  return undefined;
}

afterEach(() => {
  Reflect.deleteProperty(document, 'adoptedStyleSheets');
  vi.unstubAllGlobals();
});

it.each([
  ['/home', 'urt:home:following:latest'],
  ['/i/lists/196831803', 'urt:list:196831803'],
  ['/alice/lists/42', 'unlabelled-feed'],
])('sizes media and filters returning rows before the virtual list measures the frame on %s', async (path, feedId) => {
  const resize = observeLayout();
  const cleanup: Array<() => void> = [];
  const ctx = { isValid: true, addEventListener: vi.fn(), onInvalidated: (fn: () => void) => cleanup.push(fn) };
  vi.stubGlobal('defineContentScript', (entry: { main: (context: typeof ctx) => void }) => entry.main(ctx));
  const frames = new Map<number, FrameRequestCallback>();
  let frame = 0;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(fn => {
    frames.set(++frame, fn);
    return frame;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id); });
  const runFrame = () => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach(fn => fn(0));
  };
  const originalUrl = location.href;
  history.replaceState(null, '', path);
  document.body.innerHTML = `<div style="display:grid"><main><section aria-labelledby="following">
    <div id="${feedId}"><ul><li data-index="8"><article>Visible post</article></li></ul></div>
    </section></main><aside></aside></div>`;
  const list = document.querySelector('ul')!;
  vi.spyOn(document.querySelector('main')!, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 600, 800));
  try {
    vi.resetModules();
    await import('../entrypoints/twitter-layout.content');
    await import('../entrypoints/twitter.content/index');
    runFrame();
    await Promise.resolve();
    expect(document.querySelector('main')!.style.maxWidth).toBe('none');

    // X inserts rows above the reader inside its animation frame on scroll-back.
    list.insertAdjacentHTML('afterbegin', `<li data-index="6"><div data-href="/Alice/status/6" role="link">
      <article><div style="aspect-ratio:2/1"><div data-press-control></div></div></article></div></li>
      <li data-index="7"><div data-href="/Bob/status/7" role="link" style="display:grid"><article>
      <div data-testid="socialContext">Bob Reposted</div></article></div></li>`);
    const media = list.querySelector<HTMLElement>('[style*="aspect-ratio"]')!;
    vi.spyOn(media, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 574, 287));
    await Promise.resolve(); // Mutation checkpoint, before ResizeObserver and before the next rAF.
    expect.soft(media.style.maxWidth).toBe('min(100%, 574px)');
    const post = list.querySelector<HTMLElement>('[data-href="/Bob/status/7"]')!;
    expect(post).toHaveAttribute('data-te-fully-hidden');
    runFrame();
    const row = media.closest('li')!;
    resize(list, 1200);
    resize(row, 319.5);
    const repostRow = post.closest('li')!;
    resize(repostRow, 1);
    expect(reservedHeight(row)).toBeUndefined();

    row.remove();
    repostRow.remove();
    await Promise.resolve();
    runFrame();
    list.insertAdjacentHTML('afterbegin', '<li data-index="6"><div role="link" data-href="/Alice/status/6"><article>Returning photo post</article></div></li>');
    const returning = list.firstElementChild!;
    // The host reads the row in the same stack as insertion, before any observer.
    expect(reservedHeight(returning)).toBe('319.5px');
    list.insertAdjacentHTML('beforeend', '<li data-index="7"><div role="link" data-href="/Bob/status/7" style="display:grid"><article><div data-testid="socialContext">Bob Reposted</div></article></div></li>');
    const returningRepost = list.lastElementChild!;
    expect(reservedHeight(returningRepost)).toBe('1px');
    await Promise.resolve();
    const returningFrame = returningRepost.firstElementChild as HTMLElement;
    expect(returningFrame).toHaveAttribute('data-te-fully-hidden');
    runFrame();
    expect(reservedHeight(returning)).toBeUndefined();

    // The virtualizer may also keep the same frame and article for another post.
    returningFrame.dataset.href = '/Carol/status/9';
    returningFrame.querySelector('article')!.textContent = 'Original post';
    await Promise.resolve();
    expect(returningFrame.style.display).toBe('grid');
  } finally {
    cleanup.forEach(fn => fn());
    history.replaceState(null, '', originalUrl);
  }
});

it('expires reservations on feed or width changes and only reuses them for the measured post at its own index', () => {
  const resize = observeLayout();
  const originalUrl = location.href;
  history.replaceState(null, '', '/home');
  document.body.innerHTML = '<main><section aria-labelledby="feed"><div id="urt:home:following:latest"><ul></ul></div></section></main>';
  const list = document.querySelector('ul')!;
  const markup = '<li data-index="4"><div role="link" data-href="/Alice/status/4"><article></article></div></li>';
  list.innerHTML = markup;
  const heights = createTimelineRowHeights();
  try {
    heights.sync();
    resize(list, 8000);
    resize(list.firstElementChild!, 240);
    resize(list.firstElementChild!, 312);
    list.innerHTML = markup.replace('/Alice/status/4', '/Bob/status/5');
    const replacement = list.firstElementChild!;
    expect(reservedHeight(replacement)).toBeUndefined();
    replacement.querySelector('article')!.innerHTML = '<div role="link" data-href="/Alice/status/4">Quote</div>';
    expect(reservedHeight(replacement)).toBeUndefined();
    heights.sync();
    replacement.querySelector('[data-href]')!.setAttribute('data-href', '/Alice/status/4');
    expect(reservedHeight(replacement)).toBe('312px');
    heights.sync();
    expect(reservedHeight(replacement)).toBeUndefined();
    list.innerHTML = markup.replace('data-index="4"', 'data-index="5"');
    expect(reservedHeight(list.firstElementChild!)).toBeUndefined();
    list.innerHTML = markup;
    expect(reservedHeight(list.firstElementChild!)).toBe('312px');
    resize(list, 9000);
    expect(reservedHeight(list.firstElementChild!)).toBe('312px');
    resize(list, 0, 0); // The host can hide the background while a viewer is open.
    expect(reservedHeight(list.firstElementChild!)).toBe('312px');
    resize(list, 9000, 800);
    expect(reservedHeight(list.firstElementChild!)).toBeUndefined();
    heights.sync();
    resize(list.firstElementChild!, 220, 800);
    const next = document.createElement('ul');
    next.innerHTML = markup;
    list.replaceWith(next);
    heights.sync();
    next.innerHTML = markup;
    expect(reservedHeight(next.firstElementChild!)).toBeUndefined();
  } finally {
    heights.destroy();
    history.replaceState(null, '', originalUrl);
  }
  expect(document.adoptedStyleSheets).toHaveLength(0);
});

it('keeps list measurements while its rows are unmounted and clears them when navigation reuses the list', () => {
  const originalUrl = location.href;
  const resize = observeLayout();
  const heights = createTimelineRowHeights();
  const markup = '<li data-index="4"><div role="link" data-href="/Alice/status/4"><article></article></div></li>';
  history.replaceState(null, '', '/i/lists/42');
  document.body.innerHTML = `<main><div id="urt:list:42"><ul>${markup}</ul></div></main>`;
  const list = document.querySelector('ul')!;
  try {
    heights.sync();
    resize(list, 800);
    resize(list.firstElementChild!, 240);
    list.replaceChildren();
    heights.sync();
    list.innerHTML = markup;
    expect(reservedHeight(list.firstElementChild!)).toBe('240px');

    history.replaceState(null, '', '/i/lists/43');
    list.parentElement!.id = 'urt:list:43';
    heights.sync();
    list.innerHTML = markup;
    expect(reservedHeight(list.firstElementChild!)).toBeUndefined();
    heights.sync();
    resize(list.firstElementChild!, 320);
    history.replaceState(null, '', '/i/lists/43/members');
    heights.sync();
    list.innerHTML = markup;
    expect(reservedHeight(list.firstElementChild!)).toBeUndefined();
  } finally {
    heights.destroy();
    history.replaceState(null, '', originalUrl);
  }
});

it.each([
  ['/home', 'urt:home:following:latest', '/Alice/status/8/video/1'],
  ['/i/lists/42', 'urt:list:42', '/i/lists/42'],
])('keeps the clicked video at the same viewport offset through an overlay on %s', async (path, feed, viewerPath) => {
  const originalUrl = location.href;
  const resize = observeLayout();
  const cleanup: Array<() => void> = [];
  const ctx = { isValid: true, addEventListener: vi.fn(), onInvalidated: (fn: () => void) => cleanup.push(fn) };
  vi.stubGlobal('defineContentScript', (entry: { main: (context: typeof ctx) => void }) => entry.main(ctx));
  const frames = new Map<number, FrameRequestCallback>();
  let id = 0;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(fn => { frames.set(++id, fn); return id; });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id); });
  const paint = () => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach(fn => fn(0));
  };
  let y = 1800;
  let postY = 1900;
  vi.spyOn(window, 'scrollY', 'get').mockImplementation(() => y);
  vi.spyOn(window, 'scrollTo').mockImplementation((options: ScrollToOptions | number | undefined, top?: number) => {
    y = typeof options === 'object' ? options.top ?? y : top ?? y;
  });
  history.replaceState(null, '', path);
  document.body.innerHTML = `<main><section aria-labelledby="feed"><div id="${feed}"><ul>
    <li data-index="7"><div role="link" data-href="/Bob/status/7"><article><div data-testid="socialContext">Bob Reposted</div></article></div></li>
    <li data-index="8"><div role="link" data-href="/Alice/status/8"><article><div data-press-control><video></video></div></article></div></li>
    </ul></div></section></main>`;
  const list = document.querySelector('ul')!;
  const row = list.lastElementChild!;
  vi.spyOn(row, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, postY - y, 600, 320));
  try {
    vi.resetModules();
    await import('../entrypoints/twitter.content/index');
    paint();
    const repost = list.querySelector('[data-href="/Bob/status/7"]')!;
    expect(repost).toHaveAttribute('data-te-fully-hidden');
    resize(list, 8000);
    resize(row, 320);
    const player = row.querySelector('video')!;
    player.click();
    history.replaceState(null, '', viewerPath);
    document.querySelector('main')!.setAttribute('aria-hidden', 'true');
    y = 0;
    await Promise.resolve();
    paint();
    expect(row.getBoundingClientRect().top).toBe(100);
    document.body.insertAdjacentHTML('beforeend', '<div role="dialog" aria-modal="true"><video></video></div>');
    y = 0;
    await Promise.resolve();
    paint();
    expect.soft(row.getBoundingClientRect().top).toBe(100);
    expect.soft(repost).toHaveAttribute('data-te-fully-hidden');
    expect.soft(list).toHaveAttribute('data-te-measured-feed');

    document.querySelector('[role="dialog"]')!.remove();
    document.querySelector('main')!.removeAttribute('aria-hidden');
    history.replaceState(null, '', path);
    // The host restores an estimated offset, and the heights above the video change.
    y = 1350;
    postY += 125;
    await Promise.resolve();
    paint();
    expect(row.getBoundingClientRect().top).toBe(100);
    y = 1400;
    window.dispatchEvent(new WheelEvent('wheel'));
    paint();
    expect(y).toBe(1400);
  } finally {
    cleanup.forEach(fn => fn());
    history.replaceState(null, '', originalUrl);
  }
});
