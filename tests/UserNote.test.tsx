import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserNote } from '../src/features/user-notes/UserNote';
import type {
  Unsubscribe,
  UserNoteListener,
  UserNoteRepository,
  UserNoteV1,
} from '../src/features/user-notes/note-model';

class FakeUserNoteRepository implements UserNoteRepository {
  note: UserNoteV1 | null = null;
  failSave = false;
  failDelete = false;
  readonly listeners = new Set<UserNoteListener>();

  async get(): Promise<UserNoteV1 | null> {
    return this.note;
  }

  async save(handle: string, text: string, displayName?: string): Promise<UserNoteV1> {
    if (this.failSave) {
      throw new Error('storage unavailable');
    }

    this.note = {
      version: 1,
      handle,
      ...(displayName ? { displayName } : {}),
      text: text.trim(),
      updatedAt: 1,
    };
    this.emit();
    return this.note;
  }

  async delete(): Promise<void> {
    if (this.failDelete) {
      throw new Error('storage unavailable');
    }

    this.note = null;
    this.emit();
  }

  subscribe(_handle: string, listener: UserNoteListener): Unsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit() {
    for (const listener of this.listeners) {
      listener(this.note);
    }
  }
}

async function getReadyDisplayButton() {
  const button = screen.getByRole('button', { name: '编辑 @alice 的备注' });
  await waitFor(() => expect(button).toBeEnabled());
  return button;
}

describe('UserNote', () => {
  it('creates an empty note and saves it with Ctrl+Enter', async () => {
    const user = userEvent.setup();
    const repository = new FakeUserNoteRepository();
    render(
      <UserNote
        handle="alice"
        displayName="Alice"
        surface="profile"
        repository={repository}
      />,
    );

    const displayButton = await getReadyDisplayButton();
    expect(screen.getByText('无备注')).toBeInTheDocument();
    await user.click(displayButton);

    const textarea = screen.getByRole('textbox', { name: '编辑 @alice 的备注' });
    await user.type(textarea, '因为她持续分享浏览器安全研究');
    await user.keyboard('{Control>}{Enter}{/Control}');

    expect(await screen.findByText('因为她持续分享浏览器安全研究')).toBeInTheDocument();
    expect(repository.note?.text).toBe('因为她持续分享浏览器安全研究');
    expect(repository.note?.displayName).toBe('Alice');
  });

  it('cancels with Escape and restores focus without changing the note', async () => {
    const user = userEvent.setup();
    const repository = new FakeUserNoteRepository();
    repository.note = {
      version: 1,
      handle: 'alice',
      text: '原备注',
      updatedAt: 1,
    };
    render(<UserNote handle="alice" surface="hover-card" repository={repository} />);

    const displayButton = await getReadyDisplayButton();
    await user.click(displayButton);
    const textarea = screen.getByRole('textbox', { name: '编辑 @alice 的备注' });
    await user.clear(textarea);
    await user.type(textarea, '未保存内容');
    await user.keyboard('{Escape}');

    expect(screen.getByText('原备注')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '编辑 @alice 的备注' })).toHaveFocus();
    expect(repository.note?.text).toBe('原备注');
  });

  it('deletes an existing note from the editor', async () => {
    const user = userEvent.setup();
    const repository = new FakeUserNoteRepository();
    repository.note = {
      version: 1,
      handle: 'alice',
      text: '准备删除',
      updatedAt: 1,
    };
    render(<UserNote handle="alice" surface="profile" repository={repository} />);

    await user.click(await getReadyDisplayButton());
    await user.click(screen.getByRole('button', { name: '删除' }));

    expect(await screen.findByText('无备注')).toBeInTheDocument();
    expect(repository.note).toBeNull();
  });

  it('keeps the draft visible when storage fails', async () => {
    const user = userEvent.setup();
    const repository = new FakeUserNoteRepository();
    repository.failSave = true;
    render(<UserNote handle="alice" surface="profile" repository={repository} />);

    await user.click(await getReadyDisplayButton());
    const textarea = screen.getByRole('textbox', { name: '编辑 @alice 的备注' });
    await user.type(textarea, '不能丢失的草稿');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('保存失败，请重试');
    expect(textarea).toHaveValue('不能丢失的草稿');
  });
});
