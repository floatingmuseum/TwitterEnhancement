import ReactDOM from 'react-dom/client';
import noteStyles from '../../../entrypoints/twitter.content/style.css?inline';
import { UserNote } from '../../features/user-notes/UserNote';
import { userNoteRepository } from '../../shared/storage/browser-user-note-repository';
import type { XNoteSurfaceTarget } from './dom-adapter';
import type { MountedXNoteSurface } from './surface-mount-manager';
import { isDarkXPage } from './theme';

export function mountXNoteUi(target: XNoteSurfaceTarget): MountedXNoteSurface {
  const host = document.createElement('div');
  host.dataset.twitterEnhancementNote = '';
  host.dataset.teSurface = target.surface;
  host.style.display = 'block';
  host.style.width = '100%';
  host.style.minWidth = '0';

  const shadowRoot = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = noteStyles;
  const reactContainer = document.createElement('div');
  shadowRoot.append(style, reactContainer);

  target.anchor.insertAdjacentElement('afterend', host);

  const root = ReactDOM.createRoot(reactContainer);
  root.render(
    <UserNote
      handle={target.handle}
      displayName={target.displayName ?? undefined}
      surface={target.surface}
      repository={userNoteRepository}
    />,
  );

  function updateAppearance() {
    host.dataset.teTheme = isDarkXPage() ? 'dark' : 'light';
  }

  updateAppearance();

  return {
    updateAppearance,
    destroy() {
      root.unmount();
      host.remove();
    },
  };
}
