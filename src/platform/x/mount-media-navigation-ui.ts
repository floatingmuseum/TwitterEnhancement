import mediaNavigationStyles from '../../../entrypoints/twitter.content/media-navigation.css?inline';
import type {
  MountedXMediaNavigation,
  NavigateXMedia,
  XMediaNavigationDirection,
  XMediaNavigationTarget,
} from './media-navigation-manager';

interface NavigationButton {
  button: HTMLButtonElement;
  label: HTMLSpanElement;
}

function createNavigationButton(
  direction: XMediaNavigationDirection,
): NavigationButton {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'te-media-navigation__button';
  button.dataset.direction = direction;

  const labelText = direction === 'newer' ? '较新帖子' : '较旧帖子';
  button.setAttribute('aria-label', `查看${labelText}`);
  button.title = `查看${labelText}`;

  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('class', 'te-media-navigation__icon');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute(
    'd',
    direction === 'newer'
      ? 'M5 4h2v16H5V4Zm14.7 3.3L15 12l4.7 4.7-1.4 1.4-6.1-6.1 6.1-6.1 1.4 1.4Z'
      : 'M17 4h2v16h-2V4ZM4.3 7.3l1.4-1.4 6.1 6.1-6.1 6.1-1.4-1.4L9 12 4.3 7.3Z',
  );
  icon.append(path);

  const label = document.createElement('span');
  label.textContent = labelText;
  if (direction === 'newer') {
    button.append(icon, label);
  } else {
    button.append(label, icon);
  }

  return { button, label };
}

export function mountXMediaNavigationUi(
  target: XMediaNavigationTarget,
  navigate: NavigateXMedia,
): MountedXMediaNavigation {
  const host = document.createElement('div');
  host.dataset.twitterEnhancementMediaNavigation = '';
  host.style.position = 'absolute';
  host.style.inset = '0';
  host.style.zIndex = '3';
  host.style.pointerEvents = 'none';

  const shadowRoot = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = mediaNavigationStyles;
  const container = document.createElement('div');
  container.className = 'te-media-navigation';
  const newer = createNavigationButton('newer');
  const older = createNavigationButton('older');
  const status = document.createElement('div');
  status.className = 'te-media-navigation__status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  container.append(newer.button, older.button, status);
  shadowRoot.append(style, container);
  target.anchor.append(host);

  let active = true;
  let busy = false;

  function update(nextTarget: XMediaNavigationTarget) {
    newer.button.hidden = !nextTarget.showNewer;
    older.button.hidden = !nextTarget.showOlder;
  }

  function setBusy(direction: XMediaNavigationDirection, value: boolean) {
    busy = value;
    newer.button.disabled = value;
    older.button.disabled = value;
    if (value) {
      status.textContent = `正在加载${direction === 'newer' ? '较新' : '较旧'}帖子`;
    }
  }

  async function handleNavigation(direction: XMediaNavigationDirection) {
    if (busy) {
      return;
    }

    status.textContent = '';
    setBusy(direction, true);
    const result = await navigate(direction);
    if (!active) {
      return;
    }

    setBusy(direction, false);
    status.textContent =
      result === 'unavailable' ? '暂时无法加载更多帖子，请重试' : '';
  }

  const newerClick = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    void handleNavigation('newer');
  };
  const olderClick = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    void handleNavigation('older');
  };
  newer.button.addEventListener('click', newerClick);
  older.button.addEventListener('click', olderClick);
  update(target);

  return {
    update,
    destroy() {
      active = false;
      newer.button.removeEventListener('click', newerClick);
      older.button.removeEventListener('click', olderClick);
      host.remove();
    },
  };
}
