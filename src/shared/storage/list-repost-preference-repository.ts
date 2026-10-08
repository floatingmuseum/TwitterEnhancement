import type {
  HiddenRepostDisplayMode,
  ListRepostPreferenceListener,
  ListRepostPreferenceRepository,
} from '../../features/list-reposts/list-repost-preference';
import {
  DEFAULT_LIST_REPOST_PREFERENCES,
  HIDDEN_REPOST_DISPLAY_MODES,
} from '../../features/list-reposts/list-repost-preference';
import type { ExtensionLocalStorage, StorageChangeListener } from './user-note-repository';

export const SHOW_LIST_REPOSTS_STORAGE_KEY = 'twitter-enhancement:list:show-reposts';
export const HIDE_ADS_STORAGE_KEY = 'twitter-enhancement:timeline:hide-ads:v1';
export const HIDDEN_REPOST_DISPLAY_MODE_STORAGE_KEY =
  'twitter-enhancement:list:hidden-repost-display-mode';

function parseHiddenRepostDisplayMode(value: unknown): HiddenRepostDisplayMode {
  return HIDDEN_REPOST_DISPLAY_MODES.find((mode) => mode === value) ??
    DEFAULT_LIST_REPOST_PREFERENCES.hiddenRepostDisplayMode;
}

function parseHideAds(value: unknown): boolean {
  return typeof value === 'boolean' ? value : DEFAULT_LIST_REPOST_PREFERENCES.hideAds;
}

export class LocalListRepostPreferenceRepository
  implements ListRepostPreferenceRepository
{
  private readonly listeners = new Set<ListRepostPreferenceListener>();
  private isListening = false;

  private readonly handleStorageChange: StorageChangeListener = (changes, areaName) => {
    if (areaName !== 'local') {
      return;
    }

    const change: Parameters<ListRepostPreferenceListener>[0] = {};
    if (SHOW_LIST_REPOSTS_STORAGE_KEY in changes) {
      change.showReposts =
        changes[SHOW_LIST_REPOSTS_STORAGE_KEY]?.newValue === true;
    }
    if (HIDE_ADS_STORAGE_KEY in changes) {
      change.hideAds = parseHideAds(changes[HIDE_ADS_STORAGE_KEY]?.newValue);
    }
    if (HIDDEN_REPOST_DISPLAY_MODE_STORAGE_KEY in changes) {
      change.hiddenRepostDisplayMode = parseHiddenRepostDisplayMode(
        changes[HIDDEN_REPOST_DISPLAY_MODE_STORAGE_KEY]?.newValue,
      );
    }
    if (Object.keys(change).length === 0) {
      return;
    }

    for (const listener of this.listeners) {
      listener(change);
    }
  };

  constructor(private readonly storage: ExtensionLocalStorage) {}

  async getPreferences() {
    const values = await this.storage.get(null);
    return {
      showReposts: values[SHOW_LIST_REPOSTS_STORAGE_KEY] === true,
      hideAds: parseHideAds(values[HIDE_ADS_STORAGE_KEY]),
      hiddenRepostDisplayMode: parseHiddenRepostDisplayMode(
        values[HIDDEN_REPOST_DISPLAY_MODE_STORAGE_KEY],
      ),
    };
  }

  async setShowReposts(showReposts: boolean): Promise<void> {
    await this.storage.set({ [SHOW_LIST_REPOSTS_STORAGE_KEY]: showReposts });
  }

  async setHideAds(hideAds: boolean): Promise<void> {
    await this.storage.set({ [HIDE_ADS_STORAGE_KEY]: hideAds });
  }

  async setHiddenRepostDisplayMode(mode: HiddenRepostDisplayMode): Promise<void> {
    await this.storage.set({ [HIDDEN_REPOST_DISPLAY_MODE_STORAGE_KEY]: mode });
  }

  subscribe(listener: ListRepostPreferenceListener): () => void {
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
