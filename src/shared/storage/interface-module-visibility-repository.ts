import type {
  InterfaceModuleKey,
  InterfaceModuleVisibility,
  InterfaceModuleVisibilityChange,
  InterfaceModuleVisibilityListener,
  InterfaceModuleVisibilityRepository,
} from '../../features/interface-modules/interface-module-visibility';
import {
  DEFAULT_INTERFACE_MODULE_VISIBILITY,
  INTERFACE_MODULE_KEYS,
} from '../../features/interface-modules/interface-module-visibility';
import type { ExtensionLocalStorage, StorageChangeListener } from './user-note-repository';

export const INTERFACE_MODULE_VISIBILITY_STORAGE_KEYS = {
  followRecommendations:
    'twitter-enhancement:interface:show-follow-recommendations',
  trends: 'twitter-enhancement:interface:show-trends',
  premiumSubscription:
    'twitter-enhancement:interface:show-premium-subscription',
  sidebarSearch: 'twitter-enhancement:interface:show-sidebar-search',
} satisfies Record<InterfaceModuleKey, string>;

function parseVisibility(module: InterfaceModuleKey, value: unknown): boolean {
  return typeof value === 'boolean'
    ? value
    : DEFAULT_INTERFACE_MODULE_VISIBILITY[module];
}

export class LocalInterfaceModuleVisibilityRepository
  implements InterfaceModuleVisibilityRepository
{
  private readonly listeners = new Set<InterfaceModuleVisibilityListener>();
  private isListening = false;

  private readonly handleStorageChange: StorageChangeListener = (changes, areaName) => {
    if (areaName !== 'local') {
      return;
    }

    const change: InterfaceModuleVisibilityChange = {};
    for (const module of INTERFACE_MODULE_KEYS) {
      const storageKey = INTERFACE_MODULE_VISIBILITY_STORAGE_KEYS[module];
      if (storageKey in changes) {
        change[module] = parseVisibility(module, changes[storageKey]?.newValue);
      }
    }

    if (Object.keys(change).length === 0) {
      return;
    }

    for (const listener of this.listeners) {
      listener(change);
    }
  };

  constructor(private readonly storage: ExtensionLocalStorage) {}

  async getVisibility() {
    const values = await this.storage.get(null);
    return Object.fromEntries(
      INTERFACE_MODULE_KEYS.map((module) => [
        module,
        parseVisibility(
          module,
          values[INTERFACE_MODULE_VISIBILITY_STORAGE_KEYS[module]],
        ),
      ]),
    ) as InterfaceModuleVisibility;
  }

  async setModuleVisibility(
    module: InterfaceModuleKey,
    visible: boolean,
  ): Promise<void> {
    await this.storage.set({
      [INTERFACE_MODULE_VISIBILITY_STORAGE_KEYS[module]]: visible,
    });
  }

  subscribe(listener: InterfaceModuleVisibilityListener): () => void {
    this.listeners.add(listener);

    if (!this.isListening) {
      this.storage.addChangeListener(this.handleStorageChange);
      this.isListening = true;
    }

    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0 && this.isListening) {
        this.storage.removeChangeListener(this.handleStorageChange);
        this.isListening = false;
      }
    };
  }
}
