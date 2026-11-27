import { INTERFACE_LAYOUT_STORAGE_KEYS } from '../src/shared/storage/interface-layout-preference-repository';

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

it('sizes media and filters returning Following rows before the virtual list measures the frame', async () => {
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
  history.replaceState(null, '', '/home');
  document.body.innerHTML = `<div style="display:grid"><main><section aria-labelledby="following">
    <div id="urt:home:following:latest"><ul><li data-index="8"><article>Visible post</article></li></ul></div>
    </section></main><aside></aside></div>`;
  const list = document.querySelector('ul')!;
  vi.spyOn(document.querySelector('main')!, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 600, 800));
  try {
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

    // The virtualizer may also keep the same frame and article for another post.
    post.dataset.href = '/Carol/status/9';
    post.querySelector('article')!.textContent = 'Original post';
    await Promise.resolve();
    expect(post.style.display).toBe('grid');
  } finally {
    cleanup.forEach(fn => fn());
    history.replaceState(null, '', originalUrl);
    vi.unstubAllGlobals();
  }
});
