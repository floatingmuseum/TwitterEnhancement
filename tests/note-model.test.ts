import {
  MAX_NOTE_CHARACTERS,
  NoteValidationError,
  countCharacters,
  normalizeDisplayName,
  normalizeHandle,
  normalizeNoteText,
  noteStorageKey,
  parseStoredNote,
  truncateCharacters,
} from '../src/features/user-notes/note-model';

describe('note model', () => {
  it('normalizes handles and builds a versioned key', () => {
    expect(normalizeHandle('  @Alice_01 ')).toBe('alice_01');
    expect(noteStorageKey('@Alice_01')).toBe(
      'twitter-enhancement:note:v1:alice_01',
    );
  });

  it('rejects invalid handles', () => {
    expect(() => normalizeHandle('@not-valid!')).toThrow(NoteValidationError);
    expect(() => normalizeHandle('')).toThrow(NoteValidationError);
  });

  it('counts and truncates Unicode code points instead of UTF-16 units', () => {
    expect(countCharacters('A😀B')).toBe(3);
    const oversized = '😀'.repeat(MAX_NOTE_CHARACTERS + 1);
    expect(countCharacters(truncateCharacters(oversized))).toBe(MAX_NOTE_CHARACTERS);
  });

  it('trims the note while preserving internal line breaks', () => {
    expect(normalizeNoteText('  第一行\n第二行  ')).toBe('第一行\n第二行');
    expect(normalizeDisplayName('  Alice 😀  ')).toBe('Alice 😀');
  });

  it('rejects text over the limit and ignores malformed stored data', () => {
    expect(() => normalizeNoteText('x'.repeat(MAX_NOTE_CHARACTERS + 1))).toThrow(
      NoteValidationError,
    );
    expect(parseStoredNote({ version: 2 }, 'alice')).toBeNull();
    expect(
      parseStoredNote(
        {
          version: 1,
          handle: 'alice',
          displayName: 'Alice',
          text: '原因',
          updatedAt: 42,
        },
        'alice',
      ),
    ).toEqual({
      version: 1,
      handle: 'alice',
      displayName: 'Alice',
      text: '原因',
      updatedAt: 42,
    });
  });

  it('keeps legacy notes without a display name readable', () => {
    expect(
      parseStoredNote(
        { version: 1, handle: 'alice', text: '旧数据', updatedAt: 42 },
        'alice',
      ),
    ).toEqual({ version: 1, handle: 'alice', text: '旧数据', updatedAt: 42 });
  });
});
