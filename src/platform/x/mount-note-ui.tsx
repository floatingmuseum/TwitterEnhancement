import ReactDOM from 'react-dom/client';
import noteStyles from '../../../entrypoints/twitter.content/style.css?inline';
import { UserNote } from '../../features/user-notes/UserNote';
import { TweetUserNote } from '../../features/user-notes/TweetUserNote';
import type { UserNoteRepository } from '../../features/user-notes/note-model';
import type { XNoteSurfaceTarget } from './dom-adapter';
import type { MountedXNoteSurface } from './surface-mount-manager';
import { isDarkXPage } from './theme';

export function mountXNoteUi(
  target: XNoteSurfaceTarget,
  repository: UserNoteRepository,
): MountedXNoteSurface {
  const isTweet = target.surface === 'tweet';
  const host = document.createElement('div');
  host.dataset.twitterEnhancementNote = '';
  host.dataset.teSurface = target.surface;
  if (isTweet) {
    host.style.display = 'none';
    if (target.inlineContainer) {
      // Detail handles and quoted identities can size themselves to their content.
      host.style.flex = '0 1 auto';
    }
  }

  const shadowRoot = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = noteStyles;
  const reactContainer = document.createElement('div');
  reactContainer.className = 'te-note-root';
  shadowRoot.append(style, reactContainer);

  function placeHost() {
    let insertionAnchor = target.anchor;
    if (isTweet) {
      const identity = target.inlineContainer ?? target.anchor.closest('[data-testid="User-Name"], [data-testid="UserName"]');
      // X wraps its time link in a non-shrinking flex item. Keep our label
      // beside that branch so it can shrink before the author's identity.
      while (identity && insertionAnchor.parentElement && insertionAnchor.parentElement !== identity) {
        insertionAnchor = insertionAnchor.parentElement;
      }
    }
    if (insertionAnchor.nextElementSibling !== host) {
      insertionAnchor.insertAdjacentElement('afterend', host);
    }
  }

  placeHost();

  const root = ReactDOM.createRoot(reactContainer);
  root.render(
    target.surface === 'tweet' ? (
      <TweetUserNote
        handle={target.handle}
        repository={repository}
        onVisibilityChange={(visible) => {
          host.style.display = visible ? 'inline-flex' : 'none';
        }}
      />
    ) : (
      <UserNote
        handle={target.handle}
        displayName={target.displayName ?? undefined}
        surface={target.surface}
        repository={repository}
      />
    ),
  );

  function updateAppearance() {
    host.dataset.teTheme = isDarkXPage() ? 'dark' : 'light';
    placeHost();
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
