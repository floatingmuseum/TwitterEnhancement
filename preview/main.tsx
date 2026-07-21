import ReactDOM from 'react-dom/client';
import noteStyles from '../entrypoints/twitter.content/style.css?inline';
import { UserNote, type NoteSurface } from '../src/features/user-notes/UserNote';
import type {
  Unsubscribe,
  UserNoteListener,
  UserNoteRepository,
  UserNoteV1,
} from '../src/features/user-notes/note-model';

class PreviewNoteRepository implements UserNoteRepository {
  private note: UserNoteV1 | null = null;
  private readonly listeners = new Set<UserNoteListener>();

  async get(): Promise<UserNoteV1 | null> {
    return this.note;
  }

  async save(handle: string, text: string, displayName?: string): Promise<UserNoteV1> {
    this.note = {
      version: 1,
      handle,
      ...(displayName ? { displayName } : {}),
      text: text.trim(),
      updatedAt: Date.now(),
    };
    this.publish();
    return this.note;
  }

  async delete(): Promise<void> {
    this.note = null;
    this.publish();
  }

  subscribe(_handle: string, listener: UserNoteListener): Unsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private publish() {
    for (const listener of this.listeners) {
      listener(this.note);
    }
  }
}

const repository = new PreviewNoteRepository();
const hosts: HTMLElement[] = [];

function mountPreview(id: string, surface: NoteSurface) {
  const host = document.getElementById(id);
  if (!host) {
    throw new Error(`Missing preview host: ${id}`);
  }

  host.dataset.teSurface = surface;
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = noteStyles;
  const container = document.createElement('div');
  shadow.append(style, container);
  ReactDOM.createRoot(container).render(
    <UserNote
      handle="alice"
      displayName="Alice"
      surface={surface}
      repository={repository}
    />,
  );
  hosts.push(host);
}

function applyTheme(theme: 'dark' | 'light') {
  document.body.dataset.theme = theme;
  for (const host of hosts) {
    host.dataset.teTheme = theme;
  }
}

mountPreview('profile-note', 'profile');
mountPreview('hover-note', 'hover-card');
applyTheme('dark');

document.getElementById('theme-toggle')?.addEventListener('click', () => {
  applyTheme(document.body.dataset.theme === 'dark' ? 'light' : 'dark');
});
