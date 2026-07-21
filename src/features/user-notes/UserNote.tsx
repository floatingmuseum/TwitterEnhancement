import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import {
  countCharacters,
  normalizeNoteText,
  truncateCharacters,
  type UserNoteRepository,
} from './note-model';
import { useUserNote } from './use-user-note';

export type NoteSurface = 'profile' | 'hover-card';

interface UserNoteProps {
  handle: string;
  displayName?: string;
  surface: NoteSurface;
  repository: UserNoteRepository;
}

export function UserNote({ handle, displayName, surface, repository }: UserNoteProps) {
  const { note, loadError, reload } = useUserNote(repository, handle, displayName);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState('');
  const [saveError, setSaveError] = useState(false);
  const displayButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef(false);

  useEffect(() => {
    if (!isEditing && restoreFocusRef.current) {
      restoreFocusRef.current = false;
      displayButtonRef.current?.focus();
    }
  }, [isEditing]);

  function stopPropagation(event: MouseEvent<HTMLElement>) {
    event.stopPropagation();
  }

  function beginEditing() {
    if (note === undefined) {
      return;
    }

    if (loadError) {
      reload();
      return;
    }

    setDraft(note?.text ?? '');
    setSaveError(false);
    setIsEditing(true);
  }

  function finishEditing() {
    restoreFocusRef.current = true;
    setIsEditing(false);
    setSaveError(false);
  }

  async function saveDraft() {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setSaveError(false);

    try {
      const text = normalizeNoteText(draft);
      if (text.length === 0) {
        await repository.delete(handle);
      } else {
        await repository.save(handle, text, displayName);
      }
      finishEditing();
    } catch {
      setSaveError(true);
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteNote() {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setSaveError(false);

    try {
      await repository.delete(handle);
      finishEditing();
    } catch {
      setSaveError(true);
    } finally {
      setIsSaving(false);
    }
  }

  function handleEditorKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      finishEditing();
      return;
    }

    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      event.stopPropagation();
      void saveDraft();
    }
  }

  const characterCount = countCharacters(draft);
  const displayText = loadError
    ? '备注读取失败，点击重试'
    : note === undefined
      ? '正在读取备注…'
      : note?.text ?? '无备注';

  return (
    <section
      className="te-note"
      data-surface={surface}
      onClick={stopPropagation}
      aria-label={`@${handle} 的私人备注`}
    >
      {isEditing ? (
        <div className="te-note__editor">
          <label className="te-note__editor-label" htmlFor={`te-note-${surface}-${handle}`}>
            编辑 @{handle} 的备注
          </label>
          <textarea
            id={`te-note-${surface}-${handle}`}
            className="te-note__textarea"
            autoFocus
            value={draft}
            disabled={isSaving}
            onChange={(event) => setDraft(truncateCharacters(event.target.value))}
            onKeyDown={handleEditorKeyDown}
            aria-describedby={`te-note-help-${surface}-${handle}`}
          />
          <div className="te-note__toolbar">
            <span
              id={`te-note-help-${surface}-${handle}`}
              className="te-note__counter"
            >
              {characterCount} / 500
            </span>
            {note ? (
              <button
                type="button"
                className="te-note__action te-note__action--delete"
                disabled={isSaving}
                onClick={() => void deleteNote()}
              >
                删除
              </button>
            ) : null}
            <button
              type="button"
              className="te-note__action te-note__action--cancel"
              disabled={isSaving}
              onClick={finishEditing}
            >
              取消
            </button>
            <button
              type="button"
              className="te-note__action te-note__action--save"
              disabled={isSaving}
              onClick={() => void saveDraft()}
            >
              {isSaving ? '保存中…' : '保存'}
            </button>
          </div>
          {saveError ? (
            <p className="te-note__error" role="alert">
              保存失败，请重试
            </p>
          ) : null}
        </div>
      ) : (
        <button
          ref={displayButtonRef}
          type="button"
          className="te-note__display"
          disabled={note === undefined}
          onClick={beginEditing}
          aria-label={loadError ? `重新读取 @${handle} 的备注` : `编辑 @${handle} 的备注`}
        >
          <span className="te-note__label">备注</span>
          <span
            className={`te-note__text${note ? '' : ' te-note__text--empty'}`}
            title={note?.text}
          >
            {displayText}
          </span>
          {note !== undefined && !loadError ? (
            <svg
              className="te-note__edit-icon"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M16.86 3.49a2.1 2.1 0 0 1 2.97 0l.68.68a2.1 2.1 0 0 1 0 2.97L9.16 18.49l-4.12.47.47-4.12L16.86 3.49Zm1.48 1.48L7.43 15.88l-.1.79.79-.1L19.03 5.66a.25.25 0 0 0 0-.35l-.34-.34a.25.25 0 0 0-.35 0Z" />
            </svg>
          ) : null}
        </button>
      )}
    </section>
  );
}
