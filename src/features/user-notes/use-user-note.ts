import { useCallback, useEffect, useState } from 'react';
import type { UserNoteRepository, UserNoteV1 } from './note-model';

interface UserNoteState {
  note: UserNoteV1 | null | undefined;
  loadError: boolean;
  reload: () => void;
}

export function useUserNote(
  repository: UserNoteRepository,
  handle: string,
  displayName?: string,
): UserNoteState {
  const [note, setNote] = useState<UserNoteV1 | null | undefined>(undefined);
  const [loadError, setLoadError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => {
    setReloadToken((current) => current + 1);
  }, []);

  useEffect(() => {
    let active = true;
    setNote(undefined);
    setLoadError(false);

    const unsubscribe = repository.subscribe(handle, (nextNote) => {
      if (active) {
        setNote(nextNote);
        setLoadError(false);
      }
    });

    void repository
      .get(handle, displayName)
      .then((nextNote) => {
        if (active) {
          setNote(nextNote);
        }
      })
      .catch(() => {
        if (active) {
          setNote(null);
          setLoadError(true);
        }
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [displayName, handle, reloadToken, repository]);

  return { note, loadError, reload };
}
