import {
  createXMediaNavigationManager,
  type MountXMediaNavigation,
  type XMediaNavigationTarget,
} from '../src/platform/x/media-navigation-manager';

function renderMediaTimeline(tweetIds: string[]) {
  document.body.innerHTML = `
    <main data-testid="primaryColumn">
      <section role="region">
        <div id="media-list">
          ${tweetIds
            .map(
              (tweetId) => `
                <div role="listitem">
                  <a href="/alice/status/${tweetId}/photo/1">media ${tweetId}</a>
                </div>
              `,
            )
            .join('')}
        </div>
      </section>
    </main>
  `;
}

function openPhotoDialog(nativeDirections: Array<'newer' | 'older'> = []) {
  document.body.insertAdjacentHTML(
    'beforeend',
    `
      <div role="dialog">
        <div role="dialog" id="media-dialog">
          <div data-testid="swipe-to-dismiss" id="visible-media">
            <img src="https://pbs.twimg.com/media/example.jpg" alt="图像" />
          </div>
          ${
            nativeDirections.includes('newer')
              ? '<div data-testid="Carousel-NavLeft"><button>previous photo</button></div>'
              : ''
          }
          ${
            nativeDirections.includes('older')
              ? '<div data-testid="Carousel-NavRight"><button>next photo</button></div>'
              : ''
          }
        </div>
      </div>
    `,
  );
}

function openTransitioningPhotoDialog() {
  document.body.insertAdjacentHTML(
    'beforeend',
    `
      <div role="dialog">
        <div role="dialog" id="media-dialog">
          <div data-testid="swipe-to-dismiss" id="outgoing-media">
            <img src="https://pbs.twimg.com/media/outgoing.jpg" alt="上一张图像" />
          </div>
          <div data-testid="swipe-to-dismiss" id="incoming-media">
            <img src="https://pbs.twimg.com/media/incoming.jpg" alt="当前图像" />
          </div>
        </div>
      </div>
    `,
  );

  const outgoing = document.querySelector<HTMLElement>('#outgoing-media');
  const incoming = document.querySelector<HTMLElement>('#incoming-media');
  vi.spyOn(outgoing!, 'getBoundingClientRect').mockReturnValue({
    left: -1_000,
    right: 105,
    top: 0,
    bottom: 700,
    width: 1_105,
    height: 700,
    x: -1_000,
    y: 0,
    toJSON: () => ({}),
  });
  vi.spyOn(incoming!, 'getBoundingClientRect').mockReturnValue({
    left: 105,
    right: 1_210,
    top: 0,
    bottom: 700,
    width: 1_105,
    height: 700,
    x: 105,
    y: 0,
    toJSON: () => ({}),
  });
}

describe('X media navigation manager', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('adds cross-post controls only where the native photo carousel reaches an edge', () => {
    renderMediaTimeline(['300', '200', '100']);
    const mountedTargets: XMediaNavigationTarget[] = [];
    const mount: MountXMediaNavigation = vi.fn((target) => {
      mountedTargets.push(target);
      return {
        update(nextTarget: XMediaNavigationTarget) {
          mountedTargets.push(nextTarget);
        },
        destroy: vi.fn(),
      };
    });
    const manager = createXMediaNavigationManager(mount);

    manager.sync(document, new URL('https://x.com/alice/media'));
    openPhotoDialog(['older']);
    manager.sync(
      document,
      new URL('https://x.com/alice/status/200/photo/1'),
    );

    expect(mountedTargets).toEqual([
      expect.objectContaining({
        anchor: document.querySelector('#visible-media'),
        showNewer: true,
        showOlder: false,
      }),
    ]);

    document
      .querySelector('#media-dialog')
      ?.insertAdjacentHTML(
        'beforeend',
        '<div data-testid="Carousel-NavLeft"><button>previous photo</button></div>',
      );
    manager.sync(
      document,
      new URL('https://x.com/alice/status/200/photo/2'),
    );
    expect(mountedTargets.at(-1)).toEqual(
      expect.objectContaining({ showNewer: false, showOlder: false }),
    );

    document.querySelector('[data-testid="Carousel-NavRight"]')?.remove();
    manager.sync(
      document,
      new URL('https://x.com/alice/status/200/photo/4'),
    );
    expect(mountedTargets.at(-1)).toEqual(
      expect.objectContaining({ showNewer: false, showOlder: true }),
    );
    expect(mount).toHaveBeenCalledOnce();
  });

  it('mounts the older-post control on the mostly visible slide during a photo transition', () => {
    renderMediaTimeline(['300', '200', '100']);
    const mountedTargets: XMediaNavigationTarget[] = [];
    const manager = createXMediaNavigationManager((target) => {
      mountedTargets.push(target);
      return { update: vi.fn(), destroy: vi.fn() };
    });

    manager.sync(document, new URL('https://x.com/alice/media'));
    openTransitioningPhotoDialog();
    manager.sync(
      document,
      new URL('https://x.com/alice/status/200/photo/2'),
    );

    expect(mountedTargets.at(-1)).toEqual(
      expect.objectContaining({
        anchor: document.querySelector('#incoming-media'),
        showOlder: true,
      }),
    );
  });

  it('opens the adjacent media entry through the original X timeline link', async () => {
    renderMediaTimeline(['300', '200', '100']);
    const olderLink = document.querySelector<HTMLAnchorElement>(
      'a[href="/alice/status/100/photo/1"]',
    );
    const click = olderLink ? vi.spyOn(olderLink, 'click').mockImplementation(() => {}) : null;
    let navigate: Parameters<MountXMediaNavigation>[1] = async () => 'unavailable';
    const manager = createXMediaNavigationManager((_target, onNavigate) => {
      navigate = onNavigate;
      return { update: vi.fn(), destroy: vi.fn() };
    });

    manager.sync(document, new URL('https://x.com/alice/media'));
    openPhotoDialog(['newer']);
    manager.sync(
      document,
      new URL('https://x.com/alice/status/200/photo/4'),
    );

    await expect(navigate('older')).resolves.toBe('navigated');
    expect(click).toHaveBeenCalledOnce();
  });

  it('loads another virtualized batch before opening an unknown older entry', async () => {
    renderMediaTimeline(['300', '200']);
    let navigate: Parameters<MountXMediaNavigation>[1] = async () => 'unavailable';
    const loadMore = vi.fn();
    const manager = createXMediaNavigationManager(
      (_target, onNavigate) => {
        navigate = onNavigate;
        return { update: vi.fn(), destroy: vi.fn() };
      },
      { loadMore },
    );

    manager.sync(document, new URL('https://x.com/alice/media'));
    openPhotoDialog(['newer']);
    manager.sync(
      document,
      new URL('https://x.com/alice/status/200/photo/3'),
    );

    const navigation = navigate('older');
    expect(loadMore).toHaveBeenCalledWith('older');

    document.querySelector('#media-list')?.insertAdjacentHTML(
      'beforeend',
      `
        <div role="listitem">
          <a href="/alice/status/100/video/1">media 100</a>
        </div>
      `,
    );
    const olderLink = document.querySelector<HTMLAnchorElement>(
      'a[href="/alice/status/100/video/1"]',
    );
    const click = olderLink ? vi.spyOn(olderLink, 'click').mockImplementation(() => {}) : null;
    manager.sync(
      document,
      new URL('https://x.com/alice/status/200/photo/3'),
    );

    await expect(navigation).resolves.toBe('navigated');
    expect(click).toHaveBeenCalledOnce();
  });

  it('does not activate on a direct media URL without a media-page context', () => {
    renderMediaTimeline(['300', '200', '100']);
    openPhotoDialog();
    const mount = vi.fn();
    const manager = createXMediaNavigationManager(mount);

    manager.sync(
      document,
      new URL('https://x.com/alice/status/200/photo/1'),
    );

    expect(mount).not.toHaveBeenCalled();
  });

  it('offers both cross-post directions for a video without native carousel arrows', () => {
    renderMediaTimeline(['300', '200', '100']);
    document
      .querySelector('a[href="/alice/status/200/photo/1"]')
      ?.setAttribute('href', '/alice/status/200/video/1');
    const targets: XMediaNavigationTarget[] = [];
    const manager = createXMediaNavigationManager((navigationTarget) => {
      targets.push(navigationTarget);
      return { update: vi.fn(), destroy: vi.fn() };
    });

    manager.sync(document, new URL('https://x.com/alice/media'));
    openPhotoDialog();
    manager.sync(
      document,
      new URL('https://x.com/alice/status/200/video/1'),
    );

    expect(targets.at(-1)).toEqual(
      expect.objectContaining({ showNewer: true, showOlder: true }),
    );
  });

  it('destroys the mounted control when SPA navigation leaves the media session', () => {
    renderMediaTimeline(['300', '200', '100']);
    const destroy = vi.fn();
    const manager = createXMediaNavigationManager(() => ({
      update: vi.fn(),
      destroy,
    }));

    manager.sync(document, new URL('https://x.com/alice/media'));
    openPhotoDialog();
    manager.sync(
      document,
      new URL('https://x.com/alice/status/200/photo/1'),
    );
    manager.sync(document, new URL('https://x.com/home'));

    expect(destroy).toHaveBeenCalledOnce();
  });

  it('times out without changing the current media and cleans up pending work', async () => {
    vi.useFakeTimers();
    renderMediaTimeline(['300', '200']);
    let navigate: Parameters<MountXMediaNavigation>[1] = async () => 'unavailable';
    const loadMore = vi.fn();
    const destroy = vi.fn();
    const manager = createXMediaNavigationManager(
      (_target, onNavigate) => {
        navigate = onNavigate;
        return { update: vi.fn(), destroy };
      },
      { loadMore, loadTimeoutMs: 5_000 },
    );

    manager.sync(document, new URL('https://x.com/alice/media'));
    openPhotoDialog(['newer']);
    manager.sync(
      document,
      new URL('https://x.com/alice/status/200/photo/2'),
    );
    const navigation = navigate('older');

    await vi.advanceTimersByTimeAsync(5_000);

    await expect(navigation).resolves.toBe('unavailable');
    expect(loadMore).toHaveBeenCalled();
    manager.destroy();
    expect(destroy).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
