import { DEFAULT_INTERFACE_MODULE_VISIBILITY } from '../src/features/interface-modules/interface-module-visibility';
import {
  INTERFACE_MODULE_VISIBILITY_STORAGE_KEYS,
  LocalInterfaceModuleVisibilityRepository,
} from '../src/shared/storage/interface-module-visibility-repository';
import { FakeExtensionLocalStorage } from './fakes/fake-storage';

describe('LocalInterfaceModuleVisibilityRepository', () => {
  it('defaults every module to visible and ignores invalid stored values', async () => {
    const storage = new FakeExtensionLocalStorage();
    const repository = new LocalInterfaceModuleVisibilityRepository(storage);

    expect(await repository.getVisibility()).toEqual(
      DEFAULT_INTERFACE_MODULE_VISIBILITY,
    );

    storage.values.set(
      INTERFACE_MODULE_VISIBILITY_STORAGE_KEYS.followRecommendations,
      'false',
    );
    expect((await repository.getVisibility()).followRecommendations).toBe(true);
  });

  it('persists and publishes one module change without changing the others', async () => {
    const storage = new FakeExtensionLocalStorage();
    const repository = new LocalInterfaceModuleVisibilityRepository(storage);
    const listener = vi.fn();
    const unsubscribe = repository.subscribe(listener);

    await repository.setModuleVisibility('sidebarSearch', false);

    expect(
      storage.values.get(INTERFACE_MODULE_VISIBILITY_STORAGE_KEYS.sidebarSearch),
    ).toBe(false);
    expect(listener).toHaveBeenCalledWith({ sidebarSearch: false });
    expect((await repository.getVisibility()).trends).toBe(true);

    unsubscribe();
    await repository.setModuleVisibility('sidebarSearch', true);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
