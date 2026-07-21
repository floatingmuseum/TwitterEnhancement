import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  NoteImportMode,
  UserNoteCollectionRepository,
  UserNoteV1,
} from './note-model';
import { parseNoteImport, serializeNoteExport } from './note-transfer';

interface PendingImport {
  fileName: string;
  notes: UserNoteV1[];
}

interface Notice {
  kind: 'success' | 'error';
  message: string;
}

interface NoteSettingsPageProps {
  repository: UserNoteCollectionRepository;
}

export function NoteSettingsPage({ repository }: NoteSettingsPageProps) {
  const [notes, setNotes] = useState<UserNoteV1[] | undefined>();
  const [query, setQuery] = useState('');
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadNotes = useCallback(async () => {
    try {
      setNotes(await repository.getAll());
    } catch {
      setNotes([]);
      setNotice({ kind: 'error', message: '备注列表读取失败，请刷新页面重试。' });
    }
  }, [repository]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  useEffect(() => {
    if (!pendingImport) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isImporting) {
        setPendingImport(null);
      }
    }

    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isImporting, pendingImport]);

  const filteredNotes = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) {
      return notes ?? [];
    }

    return (notes ?? []).filter(
      (note) =>
        note.handle.includes(normalizedQuery) ||
        note.text.toLocaleLowerCase().includes(normalizedQuery),
    );
  }, [notes, query]);

  const pendingNewCount = useMemo(() => {
    if (!pendingImport) {
      return 0;
    }

    const existingHandles = new Set((notes ?? []).map((note) => note.handle));
    return pendingImport.notes.filter((note) => !existingHandles.has(note.handle)).length;
  }, [notes, pendingImport]);

  async function selectImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setNotice(null);
    try {
      const importedNotes = parseNoteImport(await file.text());
      setPendingImport({ fileName: file.name, notes: importedNotes });
    } catch (error) {
      setNotice({
        kind: 'error',
        message: error instanceof Error ? error.message : '导入文件读取失败。',
      });
    } finally {
      event.target.value = '';
    }
  }

  async function importPendingNotes(mode: NoteImportMode) {
    if (!pendingImport || isImporting) {
      return;
    }

    setIsImporting(true);
    setNotice(null);
    try {
      const result = await repository.importNotes(pendingImport.notes, mode);
      await loadNotes();
      setPendingImport(null);
      setNotice({
        kind: 'success',
        message:
          mode === 'replace'
            ? `已用 ${result.imported} 条备注替换本地列表。`
            : `已新增 ${result.imported} 条备注，跳过 ${result.skipped} 条已有备注。`,
      });
    } catch {
      setNotice({ kind: 'error', message: '导入失败，本地备注未能完成更新。' });
    } finally {
      setIsImporting(false);
    }
  }

  function exportNotes() {
    if (!notes) {
      return;
    }

    const blob = new Blob([serializeNoteExport(notes)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `twitter-enhancement-notes-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice({ kind: 'success', message: `已导出 ${notes.length} 条本地备注。` });
  }

  function openFilePicker() {
    setNotice(null);
    fileInputRef.current?.click();
  }

  const isLoading = notes === undefined;
  const hasQuery = query.trim().length > 0;

  return (
    <main className="settings-shell">
      <header className="settings-header">
        <div className="brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="settings-title-group">
          <p className="settings-eyebrow">Twitter Enhancement</p>
          <h1>本地备注</h1>
          <p className="settings-subtitle">检索、备份和迁移你为 X 用户保存的私人备注。</p>
        </div>
        <div className="privacy-badge">
          <span className="privacy-badge__dot" aria-hidden="true" />
          仅保存在此浏览器
        </div>
      </header>

      <section className="note-ledger" aria-labelledby="note-list-heading">
        <aside className="ledger-summary">
          <div>
            <span className="summary-label">备注总数</span>
            <strong>{isLoading ? '—' : notes.length}</strong>
          </div>
          <p>导出的 JSON 文件包含完整备注，可用于备份或迁移到另一浏览器。</p>
          <div className="summary-actions">
            <button type="button" className="button button--primary" onClick={openFilePicker}>
              导入备注
            </button>
            <button
              type="button"
              className="button button--secondary"
              disabled={isLoading}
              onClick={exportNotes}
            >
              导出备注
            </button>
          </div>
          <input
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            accept="application/json,.json"
            onChange={(event) => void selectImportFile(event)}
            tabIndex={-1}
          />
        </aside>

        <div className="ledger-content">
          <div className="list-toolbar">
            <div>
              <h2 id="note-list-heading">备注列表</h2>
              <p>{isLoading ? '正在读取本地数据' : `显示 ${filteredNotes.length} / ${notes.length} 条`}</p>
            </div>
            <label className="search-field">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="10.8" cy="10.8" r="6.3" />
                <path d="m15.5 15.5 4 4" />
              </svg>
              <span className="visually-hidden">搜索备注</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索用户名或备注内容"
              />
            </label>
          </div>

          {notice ? (
            <div
              className={`notice notice--${notice.kind}`}
              role={notice.kind === 'error' ? 'alert' : 'status'}
            >
              {notice.message}
              <button type="button" onClick={() => setNotice(null)} aria-label="关闭提示">
                ×
              </button>
            </div>
          ) : null}

          {isLoading ? (
            <div className="list-state" aria-live="polite">
              <span className="loading-line" />
              <span className="loading-line" />
              <span className="loading-line" />
            </div>
          ) : filteredNotes.length > 0 ? (
            <ol className="note-list">
              {filteredNotes.map((note) => (
                <li key={note.handle} className="note-row">
                  <div className="note-handle">
                    <span className="avatar-letter" aria-hidden="true">
                      {note.handle.charAt(0).toUpperCase()}
                    </span>
                    <a href={`https://x.com/${note.handle}`} target="_blank" rel="noreferrer">
                      @{note.handle}
                    </a>
                  </div>
                  <p>{note.text}</p>
                  <time dateTime={new Date(note.updatedAt).toISOString()}>
                    {formatUpdatedAt(note.updatedAt)}
                  </time>
                </li>
              ))}
            </ol>
          ) : (
            <div className="list-state list-state--empty">
              <div className="empty-glyph" aria-hidden="true">@</div>
              <h3>{hasQuery ? '没有匹配的备注' : '还没有本地备注'}</h3>
              <p>
                {hasQuery
                  ? '换一个用户名或备注关键词再试。'
                  : '在 X 用户主页或悬浮卡片中点击“无备注”即可开始记录。'}
              </p>
              {hasQuery ? (
                <button type="button" className="text-button" onClick={() => setQuery('')}>
                  清除搜索
                </button>
              ) : null}
            </div>
          )}
        </div>
      </section>

      {pendingImport ? (
        <div
          className="dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isImporting) {
              setPendingImport(null);
            }
          }}
        >
          <section
            className="import-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-dialog-title"
          >
            <p className="dialog-kicker">选择导入方式</p>
            <h2 id="import-dialog-title">如何处理现有备注？</h2>
            <p className="dialog-file">
              <strong>{pendingImport.fileName}</strong>
              <span>{pendingImport.notes.length} 条备注</span>
            </p>

            <div className="import-choices">
              <button
                type="button"
                className="import-choice import-choice--safe"
                autoFocus
                disabled={isImporting}
                onClick={() => void importPendingNotes('add-missing')}
              >
                <span className="choice-title">增补导入</span>
                <span className="choice-description">保留已有备注，只加入列表中不存在的用户。</span>
                <span className="choice-result">预计新增 {pendingNewCount} 条</span>
              </button>
              <button
                type="button"
                className="import-choice import-choice--replace"
                disabled={isImporting}
                onClick={() => void importPendingNotes('replace')}
              >
                <span className="choice-title">完全替换</span>
                <span className="choice-description">清除当前备注列表，再写入导入文件中的全部备注。</span>
                <span className="choice-result">替换当前 {notes?.length ?? 0} 条</span>
              </button>
            </div>

            <div className="dialog-footer">
              <p>{isImporting ? '正在更新本地备注…' : '此操作不会上传任何数据。'}</p>
              <button
                type="button"
                className="button button--secondary"
                disabled={isImporting}
                onClick={() => setPendingImport(null)}
              >
                取消
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function formatUpdatedAt(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(timestamp);
}
