import { noteStorageKey } from '../src/features/user-notes/note-model';
import { LocalUserNoteRepository } from '../src/shared/storage/user-note-repository';
import { FakeExtensionLocalStorage } from './fakes/fake-storage';

describe('LocalUserNoteRepository', () => {
  it('saves, reads, and deletes one note per normalized handle', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_234);
    const storage = new FakeExtensionLocalStorage();
    const repository = new LocalUserNoteRepository(storage);

    await expect(repository.save('@Alice', '  关注原因  ')).resolves.toEqual({
      version: 1,
      handle: 'alice',
      text: '关注原因',
      updatedAt: 1_234,
    });
    await expect(repository.get('ALICE')).resolves.toMatchObject({ text: '关注原因' });

    await repository.delete('alice');
    await expect(repository.get('alice')).resolves.toBeNull();
  });

  it('publishes local storage changes and removes the shared listener when unused', async () => {
    const storage = new FakeExtensionLocalStorage();
    const repository = new LocalUserNoteRepository(storage);
    const aliceListener = vi.fn();
    const bobListener = vi.fn();

    const unsubscribeAlice = repository.subscribe('alice', aliceListener);
    const unsubscribeBob = repository.subscribe('bob', bobListener);
    expect(storage.listeners).toHaveLength(1);

    await repository.save('alice', '跨标签同步');
    expect(aliceListener).toHaveBeenCalledWith(
      expect.objectContaining({ handle: 'alice', text: '跨标签同步' }),
    );
    expect(bobListener).not.toHaveBeenCalled();

    storage.emit(
      { [noteStorageKey('alice')]: { newValue: { version: 99 } } },
      'sync',
    );
    expect(aliceListener).toHaveBeenCalledTimes(1);

    unsubscribeAlice();
    unsubscribeBob();
    expect(storage.listeners).toHaveLength(0);
  });
});
