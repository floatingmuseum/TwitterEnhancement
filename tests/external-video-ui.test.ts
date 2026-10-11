import userEvent from '@testing-library/user-event';
import { mountXExternalVideoUi } from '../src/platform/x/mount-external-video-ui';
import type { XExternalVideoTarget } from '../src/platform/x/external-video-manager';

function fixture() {
  document.body.innerHTML = `
    <article data-testid="tweet">
      <div id="card" role="button" tabindex="0" style="display: flex">
        <span>在推文内播放视频</span>
      </div>
    </article>
  `;
  const article = document.querySelector('article')!;
  const anchor = document.getElementById('card')!;
  const target: XExternalVideoTarget = {
    anchor,
    link: { url: 'https://www.youtube.com/watch?v=example1234', provider: 'YouTube' },
  };
  return { article, anchor, target };
}

function getHost() {
  return document.querySelector<HTMLElement>('[data-twitter-enhancement-external-video]')!;
}

function getLink() {
  return getHost().shadowRoot!.querySelector('a')!;
}

describe('X external video link', () => {
  afterEach(() => {
    document.documentElement.style.colorScheme = '';
    document.body.innerHTML = '';
  });

  it('adds a native new-tab link beside the card and keeps inline playback working', async () => {
    const user = userEvent.setup();
    const { article, anchor, target } = fixture();
    const originalMarkup = anchor.outerHTML;
    const play = vi.fn();
    const openTweet = vi.fn();
    anchor.addEventListener('click', play);
    article.addEventListener('click', openTweet);
    const mounted = mountXExternalVideoUi(target, () => target);
    const link = getLink();

    expect(anchor.nextElementSibling).toBe(getHost());
    expect(anchor.outerHTML).toBe(originalMarkup);
    expect(link).toHaveTextContent('在 YouTube 打开 ↗');
    expect(link).toHaveAccessibleName('在新标签页打开 YouTube 视频');
    expect(link).toHaveAttribute('title', '在新标签页打开 YouTube 视频');
    expect(link).toHaveAttribute('href', target.link.url);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.relList.contains('noopener')).toBe(true);
    expect(link.relList.contains('noreferrer')).toBe(true);

    await user.click(link);
    expect(play).not.toHaveBeenCalled();
    expect(openTweet).not.toHaveBeenCalled();
    await user.click(anchor);
    expect(play).toHaveBeenCalledOnce();
    expect(openTweet).toHaveBeenCalledOnce();
    mounted.destroy();
    expect(anchor.outerHTML).toBe(originalMarkup);
  });

  it('isolates pointer and keyboard events while preserving native activation defaults', async () => {
    const user = userEvent.setup();
    const { article, target } = fixture();
    const events = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'auxclick', 'keydown', 'keyup'];
    const articleEvent = vi.fn();
    for (const eventName of events) {
      article.addEventListener(eventName, articleEvent);
    }
    const resolveTarget = vi.fn(() => target);
    const mounted = mountXExternalVideoUi(target, resolveTarget);
    const link = getLink();
    const activations: Event[] = [];
    link.addEventListener('click', (event) => activations.push(event));
    link.addEventListener('auxclick', (event) => activations.push(event));
    await user.click(link);
    await user.pointer({ target: link, keys: '[MouseMiddle]' });
    link.focus();
    await user.keyboard('{Enter}');

    expect(activations).toHaveLength(3);
    expect(activations.map((event) => event.type)).toEqual(['click', 'auxclick', 'click']);
    expect(activations.every((event) => !event.defaultPrevented)).toBe(true);
    expect(resolveTarget).toHaveBeenCalledTimes(3);
    expect(articleEvent).not.toHaveBeenCalled();
    mounted.destroy();
  });

  it('refreshes the destination and provider before activation', () => {
    const { target } = fixture();
    const nextTarget = {
      ...target,
      link: { url: 'https://vimeo.com/123456', provider: 'Vimeo' },
    };
    const mounted = mountXExternalVideoUi(target, () => nextTarget);
    const link = getLink();
    const event = new MouseEvent('auxclick', { bubbles: true, composed: true, cancelable: true, button: 1 });
    link.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(link).toHaveAttribute('href', nextTarget.link.url);
    expect(link).toHaveTextContent('在 Vimeo 打开 ↗');
    expect(link).toHaveAccessibleName('在新标签页打开 Vimeo 视频');
    mounted.destroy();
  });

  it.each(['click', 'auxclick'])('cancels %s if the current card no longer has a destination', (eventName) => {
    const { target } = fixture();
    const mounted = mountXExternalVideoUi(target, () => null);
    const link = getLink();
    const event = new MouseEvent(eventName, { bubbles: true, composed: true, cancelable: true });
    link.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(link).not.toHaveAttribute('href');
    expect(link).toHaveAttribute('aria-disabled', 'true');
    expect(link).toHaveAccessibleName('视频链接已失效');
    expect(mounted.isConnected()).toBe(false);
    mounted.destroy();
  });

  it('cancels activation if resolving fails or returns another card', () => {
    const { target } = fixture();
    const resolveTarget = vi.fn<() => XExternalVideoTarget | null>()
      .mockImplementationOnce(() => { throw new Error('Card replaced'); })
      .mockReturnValueOnce({ ...target, anchor: document.createElement('div') });
    const mounted = mountXExternalVideoUi(target, resolveTarget);
    const link = getLink();
    for (let index = 0; index < 2; index++) {
      const event = new MouseEvent('click', { cancelable: true });
      link.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      expect(link).not.toHaveAttribute('href');
    }
    mounted.destroy();
  });

  it('detects moved cards and removed hosts so the manager can remount safely', () => {
    const { article, anchor, target } = fixture();
    const mounted = mountXExternalVideoUi(target, () => target);
    const host = getHost();
    const link = getLink();
    expect(mounted.isConnected()).toBe(true);
    article.append(anchor);
    expect(mounted.isConnected()).toBe(false);
    const event = new MouseEvent('click', { cancelable: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);

    anchor.after(host);
    expect(mounted.isConnected()).toBe(false);
    const retry = new MouseEvent('click', { cancelable: true });
    link.dispatchEvent(retry);
    expect(retry.defaultPrevented).toBe(false);
    expect(mounted.isConnected()).toBe(true);
    host.remove();
    expect(mounted.isConnected()).toBe(false);
    mounted.destroy();
  });

  it('updates the theme and removes listeners and the host on repeated cleanup', () => {
    const { anchor, target } = fixture();
    const resolveTarget = vi.fn(() => target);
    document.documentElement.style.colorScheme = 'light';
    const mounted = mountXExternalVideoUi(target, resolveTarget);
    const host = getHost();
    const link = getLink();
    expect(host.dataset.teTheme).toBe('light');
    const observer = new MutationObserver(() => {});
    observer.observe(host, { attributes: true });
    mounted.updateAppearance();
    expect(observer.takeRecords()).toHaveLength(0);
    document.documentElement.style.colorScheme = 'dark';
    mounted.updateAppearance();
    expect(host.dataset.teTheme).toBe('dark');
    expect(observer.takeRecords()).toHaveLength(1);
    observer.disconnect();
    mounted.destroy();
    mounted.destroy();

    expect(host.isConnected).toBe(false);
    expect(mounted.isConnected()).toBe(false);
    expect(anchor.isConnected).toBe(true);
    expect(link).not.toHaveAttribute('href');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(resolveTarget).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    const pointer = new Event('pointerdown', { bubbles: true });
    const afterCleanup = vi.fn();
    const container = document.createElement('div');
    container.append(host);
    container.addEventListener('pointerdown', afterCleanup);
    host.dispatchEvent(pointer);
    expect(afterCleanup).toHaveBeenCalledOnce();
  });
});
