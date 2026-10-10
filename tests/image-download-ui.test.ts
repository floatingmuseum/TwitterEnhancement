import userEvent from '@testing-library/user-event';
import { waitFor } from '@testing-library/react';
import { mountXImageDownloadUi } from '../src/platform/x/mount-image-download-ui';
import { readXImageDownloadTarget } from '../src/platform/x/image-download-manager';

vi.mock('wxt/browser', () => ({ browser: { runtime: { sendMessage: vi.fn() } } }));

function fixture(download = vi.fn().mockResolvedValue({ ok: true })) {
  document.body.innerHTML = `<article><a href="/Alice/status/123/photo/2">
    <div data-testid="tweetPhoto" style="position: static !important; color: red;">
      <img src="https://pbs.twimg.com/media/One?format=png&name=small">
    </div></a></article>`;
  const anchor = document.querySelector<HTMLElement>('[data-testid="tweetPhoto"]')!;
  const resolve = () => readXImageDownloadTarget(anchor);
  const mounted = mountXImageDownloadUi(resolve()!, resolve, download);
  const host = anchor.querySelector<HTMLElement>('[data-twitter-enhancement-image-download]')!;
  const button = host.shadowRoot!.querySelector('button')!;
  const status = host.shadowRoot!.querySelector('[role="status"]')!;
  return { anchor, host, button, status, mounted, download };
}

describe('X original image download control', () => {
  afterEach(() => { document.body.innerHTML = ''; vi.useRealTimers(); });

  it('reveals on pointer entry and downloads only the selected original without opening the tweet', async () => {
    const user = userEvent.setup();
    const { anchor, host, button, status, mounted, download } = fixture();
    const articleClick = vi.fn();
    document.querySelector('article')!.addEventListener('click', articleClick);
    expect(button).toHaveAccessibleName('下载原图');
    expect(host).not.toHaveAttribute('data-hovered');
    anchor.dispatchEvent(new Event('pointerenter'));
    expect(host).toHaveAttribute('data-hovered', 'true');
    await user.click(button);
    expect(download).toHaveBeenCalledExactlyOnceWith({
      type: 'twitter-enhancement:download-image',
      url: 'https://pbs.twimg.com/media/One?format=png&name=orig',
      filename: 'twitter-alice-123-2-orig.png',
    });
    expect(articleClick).not.toHaveBeenCalled();
    expect(status).toHaveTextContent('已开始下载原图');
    anchor.dispatchEvent(new Event('pointerleave'));
    expect(host).not.toHaveAttribute('data-hovered');
    mounted.destroy();
    expect(host).not.toBeInTheDocument();
    expect(anchor.style.getPropertyValue('position')).toBe('static');
    expect(anchor.style.getPropertyPriority('position')).toBe('important');
    expect(anchor.style.color).toBe('red');
  });

  it('supports Enter and Space while keeping activation keys away from X', async () => {
    const user = userEvent.setup();
    const { button, mounted, download } = fixture();
    const keydown = vi.fn();
    document.querySelector('article')!.addEventListener('keydown', keydown);
    button.focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(download).toHaveBeenCalledTimes(2);
    expect(keydown).not.toHaveBeenCalled();
    mounted.destroy();
  });

  it('blocks duplicate requests while busy and offers retry after rejection', async () => {
    const user = userEvent.setup();
    let finish: (response: { ok: boolean }) => void = () => {};
    const pending = new Promise<{ ok: boolean }>((resolve) => { finish = resolve; });
    const download = vi.fn().mockReturnValueOnce(pending).mockResolvedValue({ ok: true });
    const { button, status, mounted } = fixture(download);
    await user.click(button);
    await user.click(button);
    expect(download).toHaveBeenCalledOnce();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    finish({ ok: false });
    await waitFor(() => expect(status).toHaveTextContent('原图下载失败，点击重试'));
    await user.click(button);
    expect(download).toHaveBeenCalledTimes(2);
    expect(status).toHaveTextContent('已开始下载原图');
    mounted.destroy();
  });

  it('handles missing media and extension messaging failures without navigating', async () => {
    const user = userEvent.setup();
    const { anchor, button, status, mounted, download } = fixture(vi.fn().mockRejectedValue(new Error('Context invalidated')));
    await user.click(button);
    expect(status).toHaveTextContent('原图下载失败，点击重试');
    anchor.querySelector('img')!.src = 'https://example.com/other.jpg';
    await user.click(button);
    expect(status).toHaveTextContent('图片已变化，请稍后重试');
    expect(download).toHaveBeenCalledOnce();
    mounted.destroy();
  });

  it('does not let an old reset timer clear an active retry or update a destroyed control', async () => {
    vi.useFakeTimers();
    let finish: (response: { ok: boolean }) => void = () => {};
    const pending = new Promise<{ ok: boolean }>((resolve) => { finish = resolve; });
    const download = vi.fn().mockResolvedValueOnce({ ok: true }).mockReturnValueOnce(pending);
    const { host, button, mounted } = fixture(download);
    button.click();
    await Promise.resolve();
    expect(host.dataset.state).toBe('success');
    await vi.advanceTimersByTimeAsync(2000);
    button.click();
    await vi.advanceTimersByTimeAsync(2000);
    expect(host.dataset.state).toBe('busy');
    mounted.destroy();
    finish({ ok: true });
    await Promise.resolve();
    expect(vi.getTimerCount()).toBe(0);
    expect(host.dataset.state).toBe('busy');
  });
});
