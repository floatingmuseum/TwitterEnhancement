import { waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  ListRepostPreferenceListener,
  ListRepostPreferenceRepository,
} from '../src/features/list-reposts/list-repost-preference';
import type {
  XRepostTimelineSurface,
  XRepostTimelineTarget,
} from '../src/platform/x/list-repost-manager';
import { mountXRepostTimelineUi } from '../src/platform/x/mount-list-repost-ui';

class FakeRepostPreferenceRepository
  implements ListRepostPreferenceRepository
{
  private readonly listeners = new Set<ListRepostPreferenceListener>();
  showReposts = false;

  async getPreferences() {
    return { showReposts: this.showReposts, hiddenRepostDisplayMode: 'hidden' as const };
  }

  async setShowReposts(showReposts: boolean): Promise<void> {
    this.showReposts = showReposts;
    for (const listener of this.listeners) {
      listener({ showReposts });
    }
  }

  async setHiddenRepostDisplayMode(): Promise<void> {}

  subscribe(listener: ListRepostPreferenceListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

interface TargetFixture {
  getHost(): HTMLElement;
  target: XRepostTimelineTarget;
}

function createTarget(surface: XRepostTimelineSurface): TargetFixture {
  const container = document.createElement('div');
  const timeline = document.createElement('div');
  const controlAnchor = document.createElement(
    surface === 'list' ? 'div' : 'section',
  );
  controlAnchor.dataset.controlAnchor = surface;
  const articleCell = document.createElement('div');
  articleCell.dataset.testid = 'cellInnerDiv';

  if (surface === 'list') {
    timeline.append(controlAnchor);
    container.append(timeline);
  } else {
    controlAnchor.append(timeline);
    container.append(controlAnchor);
  }
  timeline.append(articleCell);
  document.body.append(container);

  return {
    target: {
      controlAnchor,
      controlPlacement: surface === 'list' ? 'append' : 'before',
      timeline,
      routeKey: surface,
      surface,
    },
    getHost() {
      const host = surface === 'list'
        ? controlAnchor.lastElementChild
        : controlAnchor.previousElementSibling;
      return host as HTMLElement;
    },
  };
}

describe('repost timeline control', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('uses one synchronized control style across every supported timeline', async () => {
    const user = userEvent.setup();
    const repository = new FakeRepostPreferenceRepository();
    const fixtures = (['home', 'list', 'profile'] as const).map(createTarget);
    const mounted = fixtures.map(({ target }) =>
      mountXRepostTimelineUi(target, repository),
    );
    const hosts = fixtures.map(({ getHost }) => getHost());

    expect(hosts.map((host) => host.dataset.teSurface)).toEqual([
      'home',
      'list',
      'profile',
    ]);
    expect(
      fixtures.every(({ target }, index) => {
        const host = hosts[index];
        return target.surface !== 'list'
          ? host?.nextElementSibling === target.controlAnchor
          : host?.parentElement === target.controlAnchor;
      }),
    ).toBe(true);

    const buttons = await waitFor(() => {
      const controls = hosts.map((host) =>
        host.shadowRoot?.querySelector<HTMLButtonElement>(
          'button[role="switch"]',
        ),
      );
      expect(controls.every((control) => control && !control.disabled)).toBe(true);
      return controls as HTMLButtonElement[];
    });

    expect(
      hosts.every((host) =>
        host.shadowRoot?.querySelector('.te-timeline-repost'),
      ),
    ).toBe(true);
    expect(buttons.every((button) => button.getAttribute('aria-checked') === 'false'))
      .toBe(true);

    await user.click(buttons[0] as HTMLButtonElement);

    await waitFor(() => {
      expect(
        buttons.every((button) => button.getAttribute('aria-checked') === 'true'),
      ).toBe(true);
      expect(
        hosts.every(
          (host) =>
            host.shadowRoot?.querySelector('.te-timeline-repost__state')
              ?.textContent === '显示',
        ),
      ).toBe(true);
    });

    for (const control of mounted) {
      control.destroy();
    }
  });
});
