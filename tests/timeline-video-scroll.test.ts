import { createTimelineVideoScrollManager } from '../src/platform/x/timeline-video-scroll';

const originalUrl = location.href;
const legacyRow = '<div data-testid="cellInnerDiv"><article><a href="/Alice/status/42"><time></time></a><div data-testid="videoPlayer"><video></video></div></article></div>';

afterEach(() => {
  history.replaceState(null, '', originalUrl);
});

it('restores a remounted bookmark by post ID inside its own scroll container', () => {
  history.replaceState(null, '', '/i/bookmarks');
  document.body.innerHTML = `<main style="overflow-y:auto"><section>${legacyRow}</section></main>`;
  const port = document.querySelector('main')!;
  Object.defineProperty(port, 'scrollHeight', { value: 3000 });
  Object.defineProperty(port, 'clientHeight', { value: 500 });
  port.scrollTop = 1200;
  port.scrollTo = (options?: ScrollToOptions | number, top?: number) => {
    port.scrollTop = typeof options === 'object' ? options.top ?? port.scrollTop : top ?? port.scrollTop;
  };
  const scrollWindow = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const manager = createTimelineVideoScrollManager();
  const row = document.querySelector('[data-testid="cellInnerDiv"]')!;
  vi.spyOn(row, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, 1300 - port.scrollTop, 400, 200));
  try {
    row.querySelector('video')!.click();
    document.body.insertAdjacentHTML('beforeend', '<div role="dialog"><video></video></div>');
    expect(manager.sync()).toBe(true);
    const list = document.querySelector('section')!;
    list.innerHTML = legacyRow.replace('/42', '/43') + legacyRow;
    document.querySelector('[role="dialog"]')!.remove();
    port.scrollTop = 800;
    vi.spyOn(list.lastElementChild!, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, 1450 - port.scrollTop, 400, 200));
    expect(manager.sync()).toBe(false);
    expect(port.scrollTop).toBe(1350);
    expect(scrollWindow).not.toHaveBeenCalled();
  } finally {
    manager.destroy();
  }
});

it('ignores inline playback and closed players and discards the anchor on navigation to another list', () => {
  history.replaceState(null, '', '/i/lists/42');
  document.body.innerHTML = `<main>${legacyRow}</main><div data-base-ui-portal><dialog><video></video></dialog></div>`;
  const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const manager = createTimelineVideoScrollManager();
  try {
    document.querySelector('main video')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(manager.sync()).toBe(false);
    const dialog = document.querySelector('dialog')!;
    dialog.open = true;
    expect(manager.sync()).toBe(true);
    dialog.open = false;
    history.replaceState(null, '', '/i/lists/43');
    expect(manager.sync()).toBe(false);
    history.replaceState(null, '', '/i/lists/42');
    expect(manager.sync()).toBe(false);
    expect(scroll).not.toHaveBeenCalled();
  } finally {
    manager.destroy();
  }
});

it.each([
  '<div data-press-control><button><svg data-icon="icon-player-play"></svg></button></div>',
  '<div style="aspect-ratio:1"><img src="/ext_video_thumb/poster"><button data-press-control></button></div>',
  '<a href="/Ballislife/status/42/video/1"><span></span></a>',
])('returns from a loading viewer to a rebuilt feed after clicking %s', preview => {
  vi.useFakeTimers();
  history.replaceState(null, '', '/home');
  const feed = (rows: string) => `<main><section aria-labelledby="following"><div id="urt:home:following"><ul>${rows}</ul></div></section></main>`;
  const post = `<li data-index="38"><div role="link" data-href="/Ballislife/status/42"><article>${preview}</article></div></li>`;
  const first = '<li data-index="0"><article>First post</article></li>';
  document.body.innerHTML = feed(post);
  function scrollPort(limit: number) {
    const port = document.querySelector('main')!;
    port.style.overflowY = 'auto';
    Object.defineProperties(port, { clientHeight: { value: 800 }, scrollHeight: { get: () => 800 + limit } });
    port.scrollTo = (options?: ScrollToOptions | number) => {
      if (typeof options === 'object') port.scrollTop = Math.min(limit, options.top ?? 0);
    };
    return (next: number) => { limit = next; };
  }
  scrollPort(12000);
  document.querySelector('main')!.scrollTop = 6400;
  vi.spyOn(document.querySelector('li')!, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 180, 600, 500));
  const manager = createTimelineVideoScrollManager();
  try {
    const trigger = document.querySelector<HTMLElement>('article button, article a')!;
    trigger.addEventListener('click', event => event.preventDefault());
    trigger.click();
    document.body.innerHTML = '<div role="dialog"><button aria-label="关闭">×</button><div role="progressbar"></div></div>';
    manager.sync();
    document.querySelector('button')!.click();
    document.body.innerHTML = feed(first);
    const grow = scrollPort(0);
    manager.sync();
    vi.advanceTimersByTime(1800);
    grow(14000);
    manager.sync();
    const port = document.querySelector('main')!;
    expect(port.scrollTop).toBe(6400);
    document.querySelector('ul')!.insertAdjacentHTML('beforeend', post);
    vi.spyOn(document.querySelector('li:last-child')!, 'getBoundingClientRect').mockImplementation(
      () => new DOMRect(0, 6700 - port.scrollTop, 600, 500),
    );
    manager.sync();
    expect(port.scrollTop).toBe(6520);
  } finally {
    manager.destroy();
    vi.useRealTimers();
  }
});
