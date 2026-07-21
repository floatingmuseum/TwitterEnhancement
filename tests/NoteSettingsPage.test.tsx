import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NoteSettingsPage } from '../src/features/user-notes/NoteSettingsPage';
import {
  HIDDEN_REPOST_DISPLAY_MODE_STORAGE_KEY,
  LocalListRepostPreferenceRepository,
} from '../src/shared/storage/list-repost-preference-repository';
import { LocalUserNoteRepository } from '../src/shared/storage/user-note-repository';
import { FakeExtensionLocalStorage } from './fakes/fake-storage';

describe('NoteSettingsPage', () => {
  it('lists local notes and searches display names, handles, and note text', async () => {
    const user = userEvent.setup();
    const storage = new FakeExtensionLocalStorage();
    const repository = new LocalUserNoteRepository(storage);
    const listRepostRepository = new LocalListRepostPreferenceRepository(storage);
    await repository.importNotes(
      [
        {
          version: 1,
          handle: 'alice',
          displayName: 'Alice Zhang',
          text: '产品设计',
          updatedAt: 200,
        },
        {
          version: 1,
          handle: 'bob',
          displayName: 'Bob Li',
          text: '安全研究',
          updatedAt: 100,
        },
      ],
      'replace',
    );

    render(
      <NoteSettingsPage
        repository={repository}
        listRepostRepository={listRepostRepository}
      />,
    );

    expect(await screen.findByText('@alice')).toBeInTheDocument();
    expect(screen.getByText('@bob')).toBeInTheDocument();
    expect(screen.getByText('Alice Zhang')).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: '搜索备注' }), '安全');
    expect(screen.queryByText('@alice')).not.toBeInTheDocument();
    expect(screen.getByText('@bob')).toBeInTheDocument();
    expect(screen.getByText('显示 1 / 2 条')).toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox', { name: '搜索备注' }));
    await user.type(screen.getByRole('searchbox', { name: '搜索备注' }), 'alice');
    expect(screen.getByText('@alice')).toBeInTheDocument();
    expect(screen.queryByText('@bob')).not.toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox', { name: '搜索备注' }));
    await user.type(screen.getByRole('searchbox', { name: '搜索备注' }), 'Bob Li');
    expect(screen.queryByText('@alice')).not.toBeInTheDocument();
    expect(screen.getByText('@bob')).toBeInTheDocument();
  });

  it('selects and persists the hidden repost display mode', async () => {
    const user = userEvent.setup();
    const storage = new FakeExtensionLocalStorage();
    const repository = new LocalUserNoteRepository(storage);
    const listRepostRepository = new LocalListRepostPreferenceRepository(storage);

    render(
      <NoteSettingsPage
        repository={repository}
        listRepostRepository={listRepostRepository}
      />,
    );

    const hiddenMode = await screen.findByRole('radio', { name: /完全隐藏/ });
    const dividerMode = screen.getByRole('radio', { name: /灰线提示/ });
    expect(hiddenMode).toBeChecked();

    await user.click(dividerMode);

    expect(dividerMode).toBeChecked();
    expect(storage.values.get(HIDDEN_REPOST_DISPLAY_MODE_STORAGE_KEY)).toBe(
      'divider',
    );
  });
});
