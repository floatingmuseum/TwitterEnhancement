import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NoteSettingsPage } from '../src/features/user-notes/NoteSettingsPage';
import { LocalUserNoteRepository } from '../src/shared/storage/user-note-repository';
import { FakeExtensionLocalStorage } from './fakes/fake-storage';

describe('NoteSettingsPage', () => {
  it('lists local notes and searches display names, handles, and note text', async () => {
    const user = userEvent.setup();
    const repository = new LocalUserNoteRepository(new FakeExtensionLocalStorage());
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

    render(<NoteSettingsPage repository={repository} />);

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
});
