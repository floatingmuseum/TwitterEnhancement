import {
  HIDDEN_REPOST_DISPLAY_MODE_STORAGE_KEY,
  HIDE_ADS_STORAGE_KEY,
  LocalListRepostPreferenceRepository,
  SHOW_LIST_REPOSTS_STORAGE_KEY,
} from '../src/shared/storage/list-repost-preference-repository';
import { FakeExtensionLocalStorage } from './fakes/fake-storage';

describe('LocalListRepostPreferenceRepository', () => {
  it('defaults to hiding reposts and ads when no valid preference exists', async () => {
    const storage = new FakeExtensionLocalStorage();
    const repository = new LocalListRepostPreferenceRepository(storage);

    expect(await repository.getPreferences()).toEqual({
      showReposts: false,
      hideAds: true,
      hiddenRepostDisplayMode: 'hidden',
    });

    storage.values.set(SHOW_LIST_REPOSTS_STORAGE_KEY, 'true');
    storage.values.set(HIDDEN_REPOST_DISPLAY_MODE_STORAGE_KEY, 'unknown');
    expect(await repository.getPreferences()).toEqual({
      showReposts: false,
      hideAds: true,
      hiddenRepostDisplayMode: 'hidden',
    });
  });

  it.each(['false', null, undefined, 0, {}])(
    'defaults to hiding ads when the saved value is invalid: %j',
    async (value) => {
      const storage = new FakeExtensionLocalStorage();
      storage.values.set(HIDE_ADS_STORAGE_KEY, value);
      const repository = new LocalListRepostPreferenceRepository(storage);

      expect((await repository.getPreferences()).hideAds).toBe(true);
    },
  );

  it('preserves existing repost preferences when the ad preference is missing', async () => {
    const storage = new FakeExtensionLocalStorage();
    storage.values.set(SHOW_LIST_REPOSTS_STORAGE_KEY, true);
    storage.values.set(HIDDEN_REPOST_DISPLAY_MODE_STORAGE_KEY, 'social-context');
    const repository = new LocalListRepostPreferenceRepository(storage);

    expect(await repository.getPreferences()).toEqual({
      showReposts: true,
      hideAds: true,
      hiddenRepostDisplayMode: 'social-context',
    });
    expect(Object.fromEntries(storage.values)).toEqual({
      [SHOW_LIST_REPOSTS_STORAGE_KEY]: true,
      [HIDDEN_REPOST_DISPLAY_MODE_STORAGE_KEY]: 'social-context',
    });
  });

  it('persists ad visibility independently of repost visibility and display mode', async () => {
    const storage = new FakeExtensionLocalStorage();
    const repository = new LocalListRepostPreferenceRepository(storage);

    await repository.setShowReposts(true);
    await repository.setHiddenRepostDisplayMode('divider');
    await repository.setHideAds(false);
    expect(await repository.getPreferences()).toEqual({
      showReposts: true,
      hideAds: false,
      hiddenRepostDisplayMode: 'divider',
    });
    expect(storage.values.get(HIDE_ADS_STORAGE_KEY)).toBe(false);

    await repository.setShowReposts(false);
    await repository.setHiddenRepostDisplayMode('social-context');
    expect((await repository.getPreferences()).hideAds).toBe(false);

    await repository.setHideAds(true);
    expect(await repository.getPreferences()).toEqual({
      showReposts: false,
      hideAds: true,
      hiddenRepostDisplayMode: 'social-context',
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

    await repository.setHideAds(false);
    expect(listener).toHaveBeenLastCalledWith({ hideAds: false });

    unsubscribe();
    await repository.setShowReposts(false);
    await repository.setHideAds(true);
    expect(listener).toHaveBeenCalledTimes(3);
    expect(storage.listeners.size).toBe(0);
  });

  it('publishes the safe ad default when its stored value becomes invalid or is removed', async () => {
    const storage = new FakeExtensionLocalStorage();
    const repository = new LocalListRepostPreferenceRepository(storage);
    const listener = vi.fn();
    const unsubscribe = repository.subscribe(listener);

    await repository.setHideAds(false);
    await storage.set({ [HIDE_ADS_STORAGE_KEY]: 'false' });
    expect(listener).toHaveBeenLastCalledWith({ hideAds: true });

    await repository.setHideAds(false);
    await storage.remove(HIDE_ADS_STORAGE_KEY);
    expect(listener).toHaveBeenLastCalledWith({ hideAds: true });
    expect((await repository.getPreferences()).hideAds).toBe(true);

    unsubscribe();
  });

  it('ignores ad preference events from another storage area or unrelated keys', () => {
    const storage = new FakeExtensionLocalStorage();
    const repository = new LocalListRepostPreferenceRepository(storage);
    const listener = vi.fn();
    const unsubscribe = repository.subscribe(listener);

    storage.emit({ [HIDE_ADS_STORAGE_KEY]: { newValue: false } }, 'sync');
    storage.emit({ unrelated: { newValue: false } });

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});
