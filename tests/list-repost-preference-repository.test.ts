import {
  HIDDEN_REPOST_DISPLAY_MODE_STORAGE_KEY,
  LocalListRepostPreferenceRepository,
  SHOW_LIST_REPOSTS_STORAGE_KEY,
} from '../src/shared/storage/list-repost-preference-repository';
import { FakeExtensionLocalStorage } from './fakes/fake-storage';

describe('LocalListRepostPreferenceRepository', () => {
  it('defaults to hiding reposts when no valid preference exists', async () => {
    const storage = new FakeExtensionLocalStorage();
    const repository = new LocalListRepostPreferenceRepository(storage);

    expect(await repository.getPreferences()).toEqual({
      showReposts: false,
      hiddenRepostDisplayMode: 'hidden',
    });

    storage.values.set(SHOW_LIST_REPOSTS_STORAGE_KEY, 'true');
    storage.values.set(HIDDEN_REPOST_DISPLAY_MODE_STORAGE_KEY, 'unknown');
    expect(await repository.getPreferences()).toEqual({
      showReposts: false,
      hiddenRepostDisplayMode: 'hidden',
    });
  });

  it('persists and publishes preference changes', async () => {
    const storage = new FakeExtensionLocalStorage();
    const repository = new LocalListRepostPreferenceRepository(storage);
    const listener = vi.fn();
    const unsubscribe = repository.subscribe(listener);

    await repository.setShowReposts(true);

    expect(storage.values.get(SHOW_LIST_REPOSTS_STORAGE_KEY)).toBe(true);
    expect(listener).toHaveBeenCalledWith({ showReposts: true });

    await repository.setHiddenRepostDisplayMode('divider');
    expect(storage.values.get(HIDDEN_REPOST_DISPLAY_MODE_STORAGE_KEY)).toBe(
      'divider',
    );
    expect(listener).toHaveBeenLastCalledWith({
      hiddenRepostDisplayMode: 'divider',
    });

    unsubscribe();
    await repository.setShowReposts(false);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
