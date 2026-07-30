import { DEFAULT_INTERFACE_LAYOUT_PREFERENCE } from '../src/features/interface-modules/interface-layout-preference';
import {
  INTERFACE_LAYOUT_STORAGE_KEYS,
  LocalInterfaceLayoutPreferenceRepository,
} from '../src/shared/storage/interface-layout-preference-repository';
import { INTERFACE_MODULE_VISIBILITY_STORAGE_KEYS } from '../src/shared/storage/interface-module-visibility-repository';
import { FakeExtensionLocalStorage } from './fakes/fake-storage';

describe('LocalInterfaceLayoutPreferenceRepository', () => {
  it('defaults to X desktop layout and ignores invalid values', async () => {
    const storage = new FakeExtensionLocalStorage();
    const repository = new LocalInterfaceLayoutPreferenceRepository(storage);

    expect(await repository.getPreference()).toEqual(
      DEFAULT_INTERFACE_LAYOUT_PREFERENCE,
    );

    storage.values.set(
      INTERFACE_LAYOUT_STORAGE_KEYS.leftNavigationExpanded,
      'false',
    );
    expect((await repository.getPreference()).leftNavigationExpanded).toBe(true);
  });

  it('migrates the previous all-modules-hidden state to a hidden right sidebar', async () => {
    const storage = new FakeExtensionLocalStorage();
    for (const key of Object.values(INTERFACE_MODULE_VISIBILITY_STORAGE_KEYS)) {
      storage.values.set(key, false);
    }
    const repository = new LocalInterfaceLayoutPreferenceRepository(storage);

    expect((await repository.getPreference()).rightSidebarVisible).toBe(false);
    expect(
      storage.values.get(INTERFACE_LAYOUT_STORAGE_KEYS.rightSidebarVisible),
    ).toBe(false);

    storage.values.set(
      INTERFACE_LAYOUT_STORAGE_KEYS.rightSidebarVisible,
      true,
    );
    expect((await repository.getPreference()).rightSidebarVisible).toBe(true);
  });

  it('persists and publishes layout changes', async () => {
    const storage = new FakeExtensionLocalStorage();
    const repository = new LocalInterfaceLayoutPreferenceRepository(storage);
    const listener = vi.fn();
    const unsubscribe = repository.subscribe(listener);

    await repository.setPreference('leftNavigationExpanded', false);

    expect(
      storage.values.get(INTERFACE_LAYOUT_STORAGE_KEYS.leftNavigationExpanded),
    ).toBe(false);
    expect(listener).toHaveBeenCalledWith({ leftNavigationExpanded: false });

    unsubscribe();
    await repository.setPreference('rightSidebarVisible', false);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
