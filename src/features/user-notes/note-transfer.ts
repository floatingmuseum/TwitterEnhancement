import {
  NOTE_SCHEMA_VERSION,
  normalizeHandle,
  parseStoredNote,
  type UserNoteV1,
} from './note-model';

export const NOTE_EXPORT_FORMAT = 'twitter-enhancement-notes' as const;
export const NOTE_EXPORT_VERSION = 1 as const;

export interface NoteExportFileV1 {
  format: typeof NOTE_EXPORT_FORMAT;
  version: typeof NOTE_EXPORT_VERSION;
  exportedAt: string;
  notes: UserNoteV1[];
}

export class NoteImportFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NoteImportFileError';
  }
}

export function createNoteExport(
  notes: readonly UserNoteV1[],
  exportedAt = new Date(),
): NoteExportFileV1 {
  return {
    format: NOTE_EXPORT_FORMAT,
    version: NOTE_EXPORT_VERSION,
    exportedAt: exportedAt.toISOString(),
    notes: [...notes],
  };
}

export function serializeNoteExport(notes: readonly UserNoteV1[]): string {
  return `${JSON.stringify(createNoteExport(notes), null, 2)}\n`;
}

export function parseNoteImport(source: string): UserNoteV1[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new NoteImportFileError('文件不是有效的 JSON');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new NoteImportFileError('文件内容不是备注列表');
  }

  const file = parsed as Partial<NoteExportFileV1>;
  if (
    file.format !== NOTE_EXPORT_FORMAT ||
    file.version !== NOTE_EXPORT_VERSION ||
    !Array.isArray(file.notes)
  ) {
    throw new NoteImportFileError('文件格式或版本不受支持');
  }

  const notesByHandle = new Map<string, UserNoteV1>();
  for (const [index, value] of file.notes.entries()) {
    const note = parseImportNote(value);
    if (!note) {
      throw new NoteImportFileError(`第 ${index + 1} 条备注无效`);
    }
    const current = notesByHandle.get(note.handle);
    if (!current || note.updatedAt > current.updatedAt) {
      notesByHandle.set(note.handle, note);
    }
  }

  return [...notesByHandle.values()];
}

function parseImportNote(value: unknown): UserNoteV1 | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const candidate = value as Partial<UserNoteV1>;
  if (
    candidate.version !== NOTE_SCHEMA_VERSION ||
    typeof candidate.handle !== 'string'
  ) {
    return null;
  }

  try {
    const handle = normalizeHandle(candidate.handle);
    return parseStoredNote(candidate, handle);
  } catch {
    return null;
  }
}
