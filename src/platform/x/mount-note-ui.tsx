import ReactDOM from 'react-dom/client';
import noteStyles from '../../../entrypoints/twitter.content/style.css?inline';
import { UserNote } from '../../features/user-notes/UserNote';
import { userNoteRepository } from '../../shared/storage/browser-user-note-repository';
import type { XNoteSurfaceTarget } from './dom-adapter';
import type { MountedXNoteSurface } from './surface-mount-manager';

function parseVisibleRgb(color: string): [number, number, number] | null {
  const match = color.match(
    /rgba?\(\s*(\d+)\D+(\d+)\D+(\d+)(?:\s*[,/]\s*([\d.]+%?))?/i,
  );
  if (!match?.[1] || !match[2] || !match[3]) {
    return null;
  }

  const alphaText = match[4];
  const alpha = alphaText?.endsWith('%')
    ? Number(alphaText.slice(0, -1)) / 100
    : Number(alphaText ?? 1);
  if (!Number.isFinite(alpha) || alpha <= 0.05) {
    return null;
  }

  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function isDarkPage(): boolean {
  const colorScheme = getComputedStyle(document.documentElement).colorScheme;
  if (colorScheme.includes('dark') && !colorScheme.includes('light')) {
    return true;
  }

  const candidates = [document.body, document.documentElement];
  for (const element of candidates) {
    const rgb = parseVisibleRgb(getComputedStyle(element).backgroundColor);
    if (!rgb) {
      continue;
    }

    const [red, green, blue] = rgb;
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    return luminance < 128;
  }

  return matchMedia('(prefers-color-scheme: dark)').matches;
}

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
    host.dataset.teTheme = isDarkPage() ? 'dark' : 'light';
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
