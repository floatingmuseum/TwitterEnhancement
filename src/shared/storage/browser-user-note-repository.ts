import { browserLocalStorage } from './browser-local-storage';
import { LocalUserNoteRepository } from './user-note-repository';

export const userNoteRepository = new LocalUserNoteRepository(browserLocalStorage);
