import userEvent from '@testing-library/user-event';
import { mountXMediaNavigationUi } from '../src/platform/x/mount-media-navigation-ui';
import type { XMediaNavigationTarget } from '../src/platform/x/media-navigation-manager';

function target(
  anchor: HTMLElement,
  showNewer = true,
  showOlder = true,
): XMediaNavigationTarget {
  return {
    anchor,
    route: {
      handle: 'alice',
      tweetId: '200',
      kind: 'photo',
      index: 1,
      href: '/alice/status/200/photo/1',
    },
    showNewer,
    showOlder,
  };
}

describe('X media navigation control', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('shows explicit cross-post labels and reports a retryable load failure', async () => {
    const user = userEvent.setup();
    const anchor = document.createElement('div');
    document.body.append(anchor);
    const navigate = vi.fn().mockResolvedValue('unavailable');
    const mounted = mountXMediaNavigationUi(target(anchor), navigate);
    const host = anchor.querySelector<HTMLElement>(
      '[data-twitter-enhancement-media-navigation]',
    );
    const newer = host?.shadowRoot?.querySelector<HTMLButtonElement>(
      'button[data-direction="newer"]',
    );
    const older = host?.shadowRoot?.querySelector<HTMLButtonElement>(
      'button[data-direction="older"]',
    );

    expect(newer).toHaveAccessibleName('查看较新帖子');
    expect(newer).toHaveTextContent('较新帖子');
    expect(older).toHaveAccessibleName('查看较旧帖子');
    expect(older).toHaveTextContent('较旧帖子');

    await user.click(older as HTMLButtonElement);

    expect(navigate).toHaveBeenCalledWith('older');
    expect(
      host?.shadowRoot?.querySelector('[role="status"]'),
    ).toHaveTextContent('暂时无法加载更多帖子，请重试');
    expect(newer).toBeEnabled();
    expect(older).toBeEnabled();

    mounted.update(target(anchor, false, true));
    expect(newer).not.toBeVisible();
    expect(older).toBeVisible();

    mounted.destroy();
    expect(host).not.toBeInTheDocument();
  });
});
