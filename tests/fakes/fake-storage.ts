import type {
  ExtensionLocalStorage,
  StorageChange,
  StorageChangeListener,
} from '../../src/shared/storage/user-note-repository';

export class FakeExtensionLocalStorage implements ExtensionLocalStorage {
  readonly values = new Map<string, unknown>();
  readonly listeners = new Set<StorageChangeListener>();

  async get(key: string | null): Promise<Record<string, unknown>> {
    if (key === null) {
      return Object.fromEntries(this.values);
    }

    return this.values.has(key) ? { [key]: this.values.get(key) } : {};
  }

  async set(items: Record<string, unknown>): Promise<void> {
    const changes: Record<string, StorageChange> = {};

    for (const [key, value] of Object.entries(items)) {
      changes[key] = { oldValue: this.values.get(key), newValue: value };
      this.values.set(key, value);
    }

    this.emit(changes);
  }

  async remove(key: string | string[]): Promise<void> {
    const keys = Array.isArray(key) ? key : [key];
    const changes: Record<string, StorageChange> = {};

    for (const storageKey of keys) {
      const oldValue = this.values.get(storageKey);
      this.values.delete(storageKey);
      changes[storageKey] = { oldValue };
    }

    this.emit(changes);
  }

  addChangeListener(listener: StorageChangeListener): void {
    this.listeners.add(listener);
  }

  removeChangeListener(listener: StorageChangeListener): void {
    this.listeners.delete(listener);
  }

  emit(changes: Record<string, StorageChange>, areaName = 'local'): void {
    for (const listener of this.listeners) {
      listener(changes, areaName);
    }
  }
}
