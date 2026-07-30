import type {
  InterfaceLayoutChange,
  InterfaceLayoutKey,
  InterfaceLayoutListener,
  InterfaceLayoutPreference,
  InterfaceLayoutPreferenceRepository,
} from '../../features/interface-modules/interface-layout-preference';
import {
  DEFAULT_INTERFACE_LAYOUT_PREFERENCE,
  INTERFACE_LAYOUT_KEYS,
} from '../../features/interface-modules/interface-layout-preference';
import { INTERFACE_MODULE_VISIBILITY_STORAGE_KEYS } from './interface-module-visibility-repository';
import type {
  ExtensionLocalStorage,
  StorageChangeListener,
} from './user-note-repository';

export const INTERFACE_LAYOUT_STORAGE_KEYS = {
  leftNavigationExpanded:
    'twitter-enhancement:interface:layout:left-navigation-expanded:v1',
  rightSidebarVisible:
    'twitter-enhancement:interface:layout:right-sidebar-visible:v1',
} satisfies Record<InterfaceLayoutKey, string>;

function parsePreference(key: InterfaceLayoutKey, value: unknown): boolean {
  return typeof value === 'boolean'
    ? value
    : DEFAULT_INTERFACE_LAYOUT_PREFERENCE[key];
}

function migratedRightSidebarVisibility(
  values: Record<string, unknown>,
): boolean {
  const storedValue =
    values[INTERFACE_LAYOUT_STORAGE_KEYS.rightSidebarVisible];
  if (typeof storedValue === 'boolean') {
    return storedValue;
  }

  const legacyValues = Object.values(
    INTERFACE_MODULE_VISIBILITY_STORAGE_KEYS,
  ).map((storageKey) => values[storageKey]);
  return !legacyValues.every((value) => value === false);
}

export class LocalInterfaceLayoutPreferenceRepository
  implements InterfaceLayoutPreferenceRepository
{
  private readonly listeners = new Set<InterfaceLayoutListener>();
  private isListening = false;

  private readonly handleStorageChange: StorageChangeListener = (
    changes,
    areaName,
  ) => {
    if (areaName !== 'local') {
      return;
    }

    const change: InterfaceLayoutChange = {};
    for (const key of INTERFACE_LAYOUT_KEYS) {
      const storageKey = INTERFACE_LAYOUT_STORAGE_KEYS[key];
      if (storageKey in changes) {
        change[key] = parsePreference(key, changes[storageKey]?.newValue);
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

  async getPreference(): Promise<InterfaceLayoutPreference> {
    const values = await this.storage.get(null);
    const rightSidebarVisible = migratedRightSidebarVisibility(values);
    if (
      typeof values[INTERFACE_LAYOUT_STORAGE_KEYS.rightSidebarVisible] !==
        'boolean' &&
      !rightSidebarVisible
    ) {
      await this.storage.set({
        [INTERFACE_LAYOUT_STORAGE_KEYS.rightSidebarVisible]: false,
      });
    }
    return {
      leftNavigationExpanded: parsePreference(
        'leftNavigationExpanded',
        values[INTERFACE_LAYOUT_STORAGE_KEYS.leftNavigationExpanded],
      ),
      rightSidebarVisible,
    };
  }

  async setPreference(
    key: InterfaceLayoutKey,
    value: boolean,
  ): Promise<void> {
    await this.storage.set({ [INTERFACE_LAYOUT_STORAGE_KEYS[key]]: value });
  }

  subscribe(listener: InterfaceLayoutListener): () => void {
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
