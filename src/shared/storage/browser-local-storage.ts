import { browser } from 'wxt/browser';
import type { ExtensionLocalStorage } from './user-note-repository';

export const browserLocalStorage: ExtensionLocalStorage = {
  async get(key) {
    return (await browser.storage.local.get(key)) as Record<string, unknown>;
  },
  async set(items) {
    await browser.storage.local.set(items);
  },
  async remove(key) {
    await browser.storage.local.remove(key);
  },
  addChangeListener(listener) {
    browser.storage.onChanged.addListener(listener);
  },
  removeChangeListener(listener) {
    browser.storage.onChanged.removeListener(listener);
  },
};
