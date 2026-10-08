import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TweetUserNote } from '../src/features/user-notes/TweetUserNote';
import type {
  UserNoteListener,
  UserNoteRepository,
  UserNoteV1,
} from '../src/features/user-notes/note-model';

function note(text: string): UserNoteV1 {
  return { version: 1, handle: 'alice', text, updatedAt: 1 };
}

class FakeUserNoteRepository implements UserNoteRepository {
  readonly listeners = new Set<UserNoteListener>();
  get = vi.fn<UserNoteRepository['get']>().mockResolvedValue(null);

  async save(handle: string, text: string): Promise<UserNoteV1> {
    const nextNote = { ...note(text), handle };
    this.emit(nextNote);
    return nextNote;
  }

  async delete(): Promise<void> {
    this.emit(null);
  }

  subscribe(_handle: string, listener: UserNoteListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(nextNote: UserNoteV1 | null) {
    for (const listener of this.listeners) {
      listener(nextNote);
    }
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('TweetUserNote', () => {
  const originalShowPopover = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'showPopover');
  const originalHidePopover = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'hidePopover');

  beforeAll(() => {
    // jsdom applies the popover UA stylesheet but does not implement the API.
    Object.defineProperty(HTMLElement.prototype, 'showPopover', {
      configurable: true,
      value(this: HTMLElement) { this.style.display = 'block'; },
    });
    Object.defineProperty(HTMLElement.prototype, 'hidePopover', {
      configurable: true,
      value(this: HTMLElement) { this.style.display = 'none'; },
    });
  });

  afterAll(() => {
    for (const [key, descriptor] of [
      ['showPopover', originalShowPopover],
      ['hidePopover', originalHidePopover],
    ] as const) {
      if (descriptor) {
        Object.defineProperty(HTMLElement.prototype, key, descriptor);
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, key);
      }
    }
  });

  it.each(['empty', 'failed'] as const)('renders no placeholder while loading or %s', async (result) => {
    const repository = new FakeUserNoteRepository();
    const read = deferred<UserNoteV1 | null>();
    repository.get.mockReturnValue(read.promise);
    const onVisibilityChange = vi.fn();
    const { container } = render(
      <TweetUserNote handle="alice" repository={repository} onVisibilityChange={onVisibilityChange} />,
    );

    expect(container).toBeEmptyDOMElement();
    await act(async () => {
      if (result === 'failed') {
        read.reject(new Error('storage unavailable'));
      } else {
        read.resolve(null);
      }
    });

    expect(container).toBeEmptyDOMElement();
    expect(onVisibilityChange).toHaveBeenLastCalledWith(false);
    expect(repository.get).toHaveBeenCalledWith('alice', undefined);
  });

  it('collapses the label whitespace and exposes the complete note on hover or keyboard focus', async () => {
    const user = userEvent.setup();
    const repository = new FakeUserNoteRepository();
    const fullText = 'V2EX.Founder\n第二行  的详细身份\t介绍';
    repository.get.mockResolvedValue(note(fullText));
    render(<TweetUserNote handle="alice" repository={repository} />);

    const button = await screen.findByRole('button', { name: '查看 @alice 的私人备注' });
    expect(button.textContent).toBe('V2EX.Founder 第二行 的详细身份 介绍');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(button).not.toHaveAttribute('title');

    await user.hover(button);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.textContent).toBe(fullText);
    expect(button).toHaveAttribute('aria-describedby', tooltip.id);
    await user.unhover(button);
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());

    await user.tab();
    expect(button).toHaveFocus();
    expect(screen.getByRole('tooltip').textContent).toBe(fullText);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it('keeps the full text open while the pointer crosses into it or the label has keyboard focus', async () => {
    const user = userEvent.setup();
    const repository = new FakeUserNoteRepository();
    repository.get.mockResolvedValue(note('可以滚动查看的详细身份\n'.repeat(20)));
    render(<TweetUserNote handle="alice" repository={repository} />);
    const button = await screen.findByRole('button');

    await user.hover(button);
    const tooltip = screen.getByRole('tooltip');
    await user.hover(tooltip);
    await act(() => new Promise((resolve) => setTimeout(resolve, 150)));
    expect(tooltip).toBeVisible();
    fireEvent.scroll(tooltip);
    expect(tooltip).toBeVisible();
    await user.unhover(tooltip);
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());

    await user.tab();
    await user.hover(button);
    await user.unhover(button);
    await act(() => new Promise((resolve) => setTimeout(resolve, 150)));
    expect(tooltip).toBeVisible();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('reflects saves, edits and deletion without leaving empty space, and releases its subscription', async () => {
    const repository = new FakeUserNoteRepository();
    const onVisibilityChange = vi.fn();
    const { container, unmount } = render(
      <TweetUserNote handle="alice" repository={repository} onVisibilityChange={onVisibilityChange} />,
    );
    await waitFor(() => expect(repository.get).toHaveBeenCalledOnce());

    await act(() => repository.save('alice', '第一版身份'));
    expect(screen.getByRole('button')).toHaveTextContent('第一版身份');
    expect(onVisibilityChange).toHaveBeenLastCalledWith(true);
    await act(() => repository.save('alice', '更新后的身份'));
    expect(screen.getByRole('button')).toHaveTextContent('更新后的身份');
    await act(() => repository.delete());
    expect(container).toBeEmptyDOMElement();
    expect(onVisibilityChange).toHaveBeenLastCalledWith(false);
    unmount();
    expect(repository.listeners.size).toBe(0);
  });

  it('does not forward pointer, click or keyboard activation to the host tweet', async () => {
    const user = userEvent.setup();
    const repository = new FakeUserNoteRepository();
    repository.get.mockResolvedValue(note('身份'));
    const onHostClick = vi.fn();
    const onHostKeyDown = vi.fn();
    const onHostPointerDown = vi.fn();
    render(
      <div onClick={onHostClick} onKeyDown={onHostKeyDown} onPointerDown={onHostPointerDown}>
        <TweetUserNote handle="alice" repository={repository} />
      </div>,
    );

    const button = await screen.findByRole('button');
    await user.click(button);
    expect(screen.getByRole('tooltip')).toBeVisible();
    await user.keyboard('{Escape}{Enter} ');
    expect(onHostClick).not.toHaveBeenCalled();
    expect(onHostKeyDown).not.toHaveBeenCalled();
    expect(onHostPointerDown).not.toHaveBeenCalled();
    fireEvent.blur(button);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('uses a top-layer popover within the viewport and closes it when the page moves', async () => {
    const user = userEvent.setup();
    const repository = new FakeUserNoteRepository();
    repository.get.mockResolvedValue(note('详细身份'));
    const { unmount } = render(<TweetUserNote handle="alice" repository={repository} />);
    const button = await screen.findByRole('button');
    const tooltip = screen.getByRole('tooltip', { hidden: true });
    const showPopover = vi.spyOn(tooltip, 'showPopover');
    const hidePopover = vi.spyOn(tooltip, 'hidePopover');
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({
      left: window.innerWidth - 40,
      top: window.innerHeight - 40,
      bottom: window.innerHeight - 20,
    } as DOMRect);
    vi.spyOn(tooltip, 'getBoundingClientRect').mockReturnValue({ width: 300, height: 80 } as DOMRect);

    await user.hover(button);
    expect(tooltip).toHaveAttribute('popover', 'manual');
    expect(showPopover).toHaveBeenCalledOnce();
    expect(tooltip.style.left).toBe(`${window.innerWidth - 308}px`);
    expect(tooltip.style.top).toBe(`${window.innerHeight - 128}px`);
    fireEvent.scroll(window);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(hidePopover).toHaveBeenCalledOnce();

    fireEvent.focus(button);
    expect(showPopover).toHaveBeenCalledTimes(2);
    fireEvent.resize(window);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.focus(button);
    unmount();
    expect(hidePopover).toHaveBeenCalledTimes(3);
  });

  it.each(['stale-read', 'failed-read'] as const)('keeps newer subscription updates after a %s', async (result) => {
    const repository = new FakeUserNoteRepository();
    const read = deferred<UserNoteV1 | null>();
    repository.get.mockReturnValue(read.promise);
    render(<TweetUserNote handle="alice" repository={repository} />);

    await act(() => repository.save('alice', '刚更新的身份'));
    await act(async () => {
      if (result === 'failed-read') {
        read.reject(new Error('late read failure'));
      } else {
        read.resolve(note('过期身份'));
      }
    });
    expect(screen.getByRole('button')).toHaveTextContent('刚更新的身份');
  });
});
