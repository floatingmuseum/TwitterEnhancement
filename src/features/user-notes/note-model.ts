export const NOTE_SCHEMA_VERSION = 1 as const;
export const NOTE_STORAGE_PREFIX = 'twitter-enhancement:note:v1:';
export const MAX_NOTE_CHARACTERS = 500;

const HANDLE_PATTERN = /^[a-z0-9_]{1,15}$/i;

export interface UserNoteV1 {
  version: typeof NOTE_SCHEMA_VERSION;
  handle: string;
  text: string;
  updatedAt: number;
}

export type NoteImportMode = 'replace' | 'add-missing';

export interface NoteImportResult {
  imported: number;
  skipped: number;
}

export type UserNoteListener = (note: UserNoteV1 | null) => void;
export type Unsubscribe = () => void;

export interface UserNoteRepository {
  get(handle: string): Promise<UserNoteV1 | null>;
  save(handle: string, text: string): Promise<UserNoteV1>;
  delete(handle: string): Promise<void>;
  subscribe(handle: string, listener: UserNoteListener): Unsubscribe;
}

export interface UserNoteCollectionRepository extends UserNoteRepository {
  getAll(): Promise<UserNoteV1[]>;
  importNotes(
    notes: readonly UserNoteV1[],
    mode: NoteImportMode,
  ): Promise<NoteImportResult>;
}

export class NoteValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NoteValidationError';
  }
}

export function normalizeHandle(handle: string): string {
  const normalized = handle.trim().replace(/^@/, '').toLowerCase();

  if (!HANDLE_PATTERN.test(normalized)) {
    throw new NoteValidationError('无效的 X 用户名');
  }

  return normalized;
}

export function noteStorageKey(handle: string): string {
  return `${NOTE_STORAGE_PREFIX}${normalizeHandle(handle)}`;
}

export function countCharacters(value: string): number {
  return Array.from(value).length;
}

export function truncateCharacters(value: string): string {
  const characters = Array.from(value);
  return characters.length <= MAX_NOTE_CHARACTERS
    ? value
    : characters.slice(0, MAX_NOTE_CHARACTERS).join('');
}

export function normalizeNoteText(text: string): string {
  const normalized = text.trim();

  if (countCharacters(normalized) > MAX_NOTE_CHARACTERS) {
    throw new NoteValidationError(`备注不能超过 ${MAX_NOTE_CHARACTERS} 个字符`);
  }

  return normalized;
}

export function parseStoredNote(value: unknown, expectedHandle: string): UserNoteV1 | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const candidate = value as Partial<UserNoteV1>;
  const handle = normalizeHandle(expectedHandle);

  if (
    candidate.version !== NOTE_SCHEMA_VERSION ||
    candidate.handle !== handle ||
    typeof candidate.text !== 'string' ||
    candidate.text.length === 0 ||
    countCharacters(candidate.text) > MAX_NOTE_CHARACTERS ||
    typeof candidate.updatedAt !== 'number' ||
    !Number.isFinite(candidate.updatedAt)
  ) {
    return null;
  }

  return {
    version: NOTE_SCHEMA_VERSION,
    handle,
    text: candidate.text,
    updatedAt: candidate.updatedAt,
  };
}
