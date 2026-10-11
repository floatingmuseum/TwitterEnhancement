import externalVideoStyles from '../../../entrypoints/twitter.content/external-video.css?inline';
import type {
  MountedXExternalVideoControl,
  XExternalVideoTarget,
} from './external-video-manager';
import { isDarkXPage } from './theme';

export function mountXExternalVideoUi(
  target: XExternalVideoTarget,
  resolveTarget: () => XExternalVideoTarget | null,
): MountedXExternalVideoControl {
  const host = document.createElement('div');
  host.dataset.twitterEnhancementExternalVideo = '';
  const shadowRoot = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = externalVideoStyles;
  const link = document.createElement('a');
  link.className = 'te-external-video';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  shadowRoot.append(style, link);
  target.anchor.after(host);

  let active = true;

  function updateLink(nextTarget: XExternalVideoTarget) {
    link.href = nextTarget.link.url;
    link.textContent = `在 ${nextTarget.link.provider} 打开 ↗`;
    const label = `在新标签页打开 ${nextTarget.link.provider} 视频`;
    link.title = label;
    link.setAttribute('aria-label', label);
    link.removeAttribute('aria-disabled');
  }

  function isAttached() {
    return active && target.anchor.isConnected && host.isConnected &&
      target.anchor.nextElementSibling === host;
  }

  function handleActivation(event: MouseEvent) {
    event.stopPropagation();
    let nextTarget: XExternalVideoTarget | null = null;
    if (isAttached()) {
      try {
        nextTarget = resolveTarget();
      } catch {
        // X may replace the card while resolving its current destination.
      }
    }
    if (!nextTarget || nextTarget.anchor !== target.anchor) {
      event.preventDefault();
      link.removeAttribute('href');
      link.setAttribute('aria-disabled', 'true');
      link.title = '视频链接已失效';
      link.setAttribute('aria-label', '视频链接已失效');
      return;
    }
    updateLink(nextTarget);
  }

  function stopPropagation(event: Event) {
    event.stopPropagation();
  }

  const isolatedEvents = [
    'pointerdown', 'pointerup', 'mousedown', 'mouseup',
    'touchstart', 'touchend', 'keydown', 'keyup', 'keypress',
  ];
  for (const eventName of isolatedEvents) {
    host.addEventListener(eventName, stopPropagation);
  }
  link.addEventListener('click', handleActivation);
  link.addEventListener('auxclick', handleActivation);

  function updateAppearance() {
    const theme = isDarkXPage() ? 'dark' : 'light';
    if (host.dataset.teTheme !== theme) {
      host.dataset.teTheme = theme;
    }
  }

  updateLink(target);
  updateAppearance();

  return {
    isConnected: () => isAttached() && link.hasAttribute('href'),
    updateAppearance,
    destroy() {
      if (!active) {
        return;
      }
      active = false;
      link.removeEventListener('click', handleActivation);
      link.removeEventListener('auxclick', handleActivation);
      for (const eventName of isolatedEvents) {
        host.removeEventListener(eventName, stopPropagation);
      }
      link.removeAttribute('href');
      host.remove();
    },
  };
}
