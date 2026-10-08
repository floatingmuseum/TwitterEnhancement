import ReactDOM from 'react-dom/client';
import '../entrypoints/options/style.css';
import type {
  InterfaceModuleKey,
  InterfaceModuleVisibility,
  InterfaceModuleVisibilityListener,
  InterfaceModuleVisibilityRepository,
} from '../src/features/interface-modules/interface-module-visibility';
import { DEFAULT_INTERFACE_MODULE_VISIBILITY } from '../src/features/interface-modules/interface-module-visibility';
import type {
  HiddenRepostDisplayMode,
  ListRepostPreferenceListener,
  ListRepostPreferenceRepository,
} from '../src/features/list-reposts/list-repost-preference';
import type {
  NoteImportMode,
  NoteImportResult,
  Unsubscribe,
  UserNoteCollectionRepository,
  UserNoteListener,
  UserNoteV1,
} from '../src/features/user-notes/note-model';
import { NoteSettingsPage } from '../src/features/user-notes/NoteSettingsPage';

class PreviewInterfaceModuleRepository
  implements InterfaceModuleVisibilityRepository
{
  private visibility: InterfaceModuleVisibility = {
    ...DEFAULT_INTERFACE_MODULE_VISIBILITY,
  };
  private readonly listeners = new Set<InterfaceModuleVisibilityListener>();

  async getVisibility() {
    return { ...this.visibility };
  }

  async setModuleVisibility(
    module: InterfaceModuleKey,
    visible: boolean,
  ): Promise<void> {
    this.visibility = { ...this.visibility, [module]: visible };
    for (const listener of this.listeners) {
      listener({ [module]: visible });
    }
  }

  subscribe(listener: InterfaceModuleVisibilityListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

class PreviewListRepostRepository implements ListRepostPreferenceRepository {
  private mode: HiddenRepostDisplayMode = 'hidden';
  private hideAds = true;
  private readonly listeners = new Set<ListRepostPreferenceListener>();

  async getPreferences() {
    return { showReposts: false, hideAds: this.hideAds, hiddenRepostDisplayMode: this.mode };
  }

  async setShowReposts(): Promise<void> {}

  async setHideAds(hideAds: boolean): Promise<void> {
    this.hideAds = hideAds;
    for (const listener of this.listeners) {
      listener({ hideAds });
    }
  }

  async setHiddenRepostDisplayMode(mode: HiddenRepostDisplayMode): Promise<void> {
    this.mode = mode;
    for (const listener of this.listeners) {
      listener({ hiddenRepostDisplayMode: mode });
    }
  }

  subscribe(listener: ListRepostPreferenceListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

class PreviewNoteRepository implements UserNoteCollectionRepository {
  private notes: UserNoteV1[] = [
    {
      version: 1,
      handle: 'alice',
      displayName: 'Alice Chen',
      text: '浏览器安全与扩展开发',
      updatedAt: Date.now() - 3_600_000,
    },
    {
      version: 1,
      handle: 'bob',
      displayName: 'Bob Li',
      text: '关注本地优先工具',
      updatedAt: Date.now() - 86_400_000,
    },
  ];
  private readonly listeners = new Map<string, Set<UserNoteListener>>();

  async get(handle: string): Promise<UserNoteV1 | null> {
    return this.notes.find((note) => note.handle === handle) ?? null;
  }

  async getAll(): Promise<UserNoteV1[]> {
    return [...this.notes];
  }

  async save(handle: string, text: string): Promise<UserNoteV1> {
    const note: UserNoteV1 = { version: 1, handle, text, updatedAt: Date.now() };
    this.notes = [note, ...this.notes.filter((item) => item.handle !== handle)];
    return note;
  }

  async delete(handle: string): Promise<void> {
    this.notes = this.notes.filter((note) => note.handle !== handle);
  }

  subscribe(handle: string, listener: UserNoteListener): Unsubscribe {
    const listeners = this.listeners.get(handle) ?? new Set<UserNoteListener>();
    listeners.add(listener);
    this.listeners.set(handle, listeners);
    return () => listeners.delete(listener);
  }

  async importNotes(
    notes: readonly UserNoteV1[],
    _mode: NoteImportMode,
  ): Promise<NoteImportResult> {
    this.notes = [...notes];
    return { imported: notes.length, skipped: 0 };
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <NoteSettingsPage
    repository={new PreviewNoteRepository()}
    interfaceModuleRepository={new PreviewInterfaceModuleRepository()}
    listRepostRepository={new PreviewListRepostRepository()}
  />,
);
