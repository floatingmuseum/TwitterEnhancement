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

  it('lists notes newest first while ignoring unrelated and malformed values', async () => {
    const storage = new FakeExtensionLocalStorage();
    const repository = new LocalUserNoteRepository(storage);
    await storage.set({
      unrelated: 'keep me',
      [noteStorageKey('alice')]: {
        version: 1,
        handle: 'alice',
        text: '较早',
        updatedAt: 100,
      },
      [noteStorageKey('bob')]: {
        version: 1,
        handle: 'bob',
        text: '较新',
        updatedAt: 200,
      },
      'twitter-enhancement:note:v1:not-valid!': { version: 1 },
    });

    await expect(repository.getAll()).resolves.toEqual([
      expect.objectContaining({ handle: 'bob' }),
      expect.objectContaining({ handle: 'alice' }),
    ]);
  });

  it('replaces every stored note without touching unrelated storage', async () => {
    const storage = new FakeExtensionLocalStorage();
    const repository = new LocalUserNoteRepository(storage);
    await repository.save('alice', '旧备注');
    await repository.save('bob', '将被移除');
    await storage.set({ unrelated: 'keep me' });

    await expect(
      repository.importNotes(
        [{ version: 1, handle: 'alice', text: '新备注', updatedAt: 300 }],
        'replace',
      ),
    ).resolves.toEqual({ imported: 1, skipped: 0 });
    await expect(repository.getAll()).resolves.toEqual([
      { version: 1, handle: 'alice', text: '新备注', updatedAt: 300 },
    ]);
    expect(storage.values.get('unrelated')).toBe('keep me');
  });

  it('adds only handles that are missing from the existing list', async () => {
    const storage = new FakeExtensionLocalStorage();
    const repository = new LocalUserNoteRepository(storage);
    await repository.save('alice', '保留原备注');

    await expect(
      repository.importNotes(
        [
          { version: 1, handle: 'alice', text: '不覆盖', updatedAt: 300 },
          { version: 1, handle: 'bob', text: '新增', updatedAt: 400 },
        ],
        'add-missing',
      ),
    ).resolves.toEqual({ imported: 1, skipped: 1 });
    await expect(repository.get('alice')).resolves.toMatchObject({ text: '保留原备注' });
    await expect(repository.get('bob')).resolves.toMatchObject({ text: '新增' });
  });
});
