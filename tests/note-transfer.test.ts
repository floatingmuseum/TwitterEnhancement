import {
  NOTE_EXPORT_FORMAT,
  NoteImportFileError,
  createNoteExport,
  parseNoteImport,
} from '../src/features/user-notes/note-transfer';

const aliceNote = {
  version: 1 as const,
  handle: 'alice',
  text: '产品设计',
  updatedAt: 100,
};

describe('note transfer', () => {
  it('creates and parses a versioned export file', () => {
    const file = createNoteExport([aliceNote], new Date('2026-07-21T00:00:00.000Z'));

    expect(file).toEqual({
      format: NOTE_EXPORT_FORMAT,
      version: 1,
      exportedAt: '2026-07-21T00:00:00.000Z',
      notes: [aliceNote],
    });
    expect(parseNoteImport(JSON.stringify(file))).toEqual([aliceNote]);
  });

  it('deduplicates handles using the last occurrence', () => {
    const file = createNoteExport([
      aliceNote,
      { ...aliceNote, text: '更新后的备注', updatedAt: 200 },
    ]);

    expect(parseNoteImport(JSON.stringify(file))).toEqual([
      { ...aliceNote, text: '更新后的备注', updatedAt: 200 },
    ]);
  });

  it('rejects malformed, unknown, and invalid note data', () => {
    expect(() => parseNoteImport('{')).toThrow(NoteImportFileError);
    expect(() => parseNoteImport(JSON.stringify({ notes: [] }))).toThrow(
      '文件格式或版本不受支持',
    );
    expect(() =>
      parseNoteImport(
        JSON.stringify({
          format: NOTE_EXPORT_FORMAT,
          version: 1,
          notes: [{ ...aliceNote, handle: 'not-valid!' }],
        }),
      ),
    ).toThrow('第 1 条备注无效');
  });
});
