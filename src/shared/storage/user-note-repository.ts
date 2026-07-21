import {
  NOTE_SCHEMA_VERSION,
  normalizeDisplayName,
  normalizeHandle,
  normalizeNoteText,
  noteStorageKey,
  parseStoredNote,
  NOTE_STORAGE_PREFIX,
  type NoteImportMode,
  type NoteImportResult,
  type Unsubscribe,
  type UserNoteListener,
  type UserNoteCollectionRepository,
  type UserNoteV1,
} from '../../features/user-notes/note-model';

export interface StorageChange {
  oldValue?: unknown;
  newValue?: unknown;
}

export type StorageChangeListener = (
  changes: Record<string, StorageChange>,
  areaName: string,
) => void;

export interface ExtensionLocalStorage {
  get(key: string | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string | string[]): Promise<void>;
  addChangeListener(listener: StorageChangeListener): void;
  removeChangeListener(listener: StorageChangeListener): void;
}

export class LocalUserNoteRepository implements UserNoteCollectionRepository {
  private readonly listeners = new Map<string, Set<UserNoteListener>>();
  private isListening = false;

  private readonly handleStorageChange: StorageChangeListener = (changes, areaName) => {
    if (areaName !== 'local') {
      return;
    }

    for (const [key, change] of Object.entries(changes)) {
      const listeners = this.listeners.get(key);
      if (!listeners || listeners.size === 0) {
        continue;
      }

      const handle = key.slice(key.lastIndexOf(':') + 1);
      const note = parseStoredNote(change.newValue, handle);
      for (const listener of listeners) {
        listener(note);
      }
    }
  };

  constructor(private readonly storage: ExtensionLocalStorage) {}

  async get(handle: string, observedDisplayName?: string): Promise<UserNoteV1 | null> {
    const normalizedHandle = normalizeHandle(handle);
    const key = noteStorageKey(normalizedHandle);
    const values = await this.storage.get(key);
    const note = parseStoredNote(values[key], normalizedHandle);
    const displayName = safeNormalizeDisplayName(observedDisplayName);

    if (!note || !displayName || note.displayName === displayName) {
      return note;
    }

    const updatedNote: UserNoteV1 = {
      ...note,
      displayName,
      updatedAt: nextUpdatedAt(note.updatedAt),
    };
    await this.storage.set({ [key]: updatedNote });
    return updatedNote;
  }

  async getAll(): Promise<UserNoteV1[]> {
    const values = await this.storage.get(null);
    return readStoredNotes(values);
  }

  async save(handle: string, text: string, displayName?: string): Promise<UserNoteV1> {
    const normalizedHandle = normalizeHandle(handle);
    const normalizedText = normalizeNoteText(text);

    if (normalizedText.length === 0) {
      throw new Error('空备注应通过 delete 删除');
    }

    const currentNote = await this.get(normalizedHandle);
    const normalizedDisplayName =
      safeNormalizeDisplayName(displayName) ?? currentNote?.displayName;
    const note: UserNoteV1 = {
      version: NOTE_SCHEMA_VERSION,
      handle: normalizedHandle,
      ...(normalizedDisplayName ? { displayName: normalizedDisplayName } : {}),
      text: normalizedText,
      updatedAt: nextUpdatedAt(currentNote?.updatedAt),
    };

    await this.storage.set({ [noteStorageKey(normalizedHandle)]: note });
    return note;
  }

  async delete(handle: string): Promise<void> {
    await this.storage.remove(noteStorageKey(handle));
  }

  async importNotes(
    notes: readonly UserNoteV1[],
    mode: NoteImportMode,
  ): Promise<NoteImportResult> {
    const values = await this.storage.get(null);
    const existingNotes = readStoredNotes(values);
    const existingByHandle = new Map(existingNotes.map((note) => [note.handle, note]));
    const incomingByHandle = selectNewestNotes(notes);
    const notesToImport =
      mode === 'replace'
        ? [...incomingByHandle.values()]
        : [...incomingByHandle.values()].filter(
            (note) => {
              const existingNote = existingByHandle.get(note.handle);
              return !existingNote || note.updatedAt > existingNote.updatedAt;
            },
          );

    if (notesToImport.length > 0) {
      await this.storage.set(
        Object.fromEntries(
          notesToImport.map((note) => [noteStorageKey(note.handle), note]),
        ),
      );
    }

    if (mode === 'replace') {
      const importedKeys = new Set(
        notesToImport.map((note) => noteStorageKey(note.handle)),
      );
      const obsoleteKeys = Object.keys(values).filter(
        (key) => key.startsWith(NOTE_STORAGE_PREFIX) && !importedKeys.has(key),
      );
      if (obsoleteKeys.length > 0) {
        await this.storage.remove(obsoleteKeys);
      }
    }

    return {
      imported: notesToImport.length,
      skipped: incomingByHandle.size - notesToImport.length,
    };
  }

  subscribe(handle: string, listener: UserNoteListener): Unsubscribe {
    const key = noteStorageKey(handle);
    const keyListeners = this.listeners.get(key) ?? new Set<UserNoteListener>();
    keyListeners.add(listener);
    this.listeners.set(key, keyListeners);

    if (!this.isListening) {
      this.storage.addChangeListener(this.handleStorageChange);
      this.isListening = true;
    }

    return () => {
      const listeners = this.listeners.get(key);
      listeners?.delete(listener);
      if (listeners?.size === 0) {
        this.listeners.delete(key);
      }

      if (this.listeners.size === 0 && this.isListening) {
        this.storage.removeChangeListener(this.handleStorageChange);
        this.isListening = false;
      }
    };
  }
}

function safeNormalizeDisplayName(displayName?: string): string | undefined {
  if (!displayName) {
    return undefined;
  }

  try {
    return normalizeDisplayName(displayName);
  } catch {
    return undefined;
  }
}

function nextUpdatedAt(previousUpdatedAt?: number): number {
  return Math.max(Date.now(), (previousUpdatedAt ?? -1) + 1);
}

function selectNewestNotes(notes: readonly UserNoteV1[]): Map<string, UserNoteV1> {
  const newestByHandle = new Map<string, UserNoteV1>();

  for (const note of notes) {
    const current = newestByHandle.get(note.handle);
    if (!current || note.updatedAt > current.updatedAt) {
      newestByHandle.set(note.handle, note);
    }
  }

  return newestByHandle;
}

function readStoredNotes(values: Record<string, unknown>): UserNoteV1[] {
  const notes: UserNoteV1[] = [];

  for (const [key, value] of Object.entries(values)) {
    if (!key.startsWith(NOTE_STORAGE_PREFIX)) {
      continue;
    }

    const handle = key.slice(NOTE_STORAGE_PREFIX.length);
    try {
      const note = parseStoredNote(value, handle);
      if (note) {
        notes.push(note);
      }
    } catch {
      // Ignore unrelated or malformed keys under the versioned prefix.
    }
  }

  return notes.sort((left, right) => right.updatedAt - left.updatedAt);
}
