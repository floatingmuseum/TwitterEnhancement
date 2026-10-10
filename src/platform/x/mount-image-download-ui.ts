import { browser } from 'wxt/browser';
import imageDownloadStyles from '../../../entrypoints/twitter.content/image-download.css?inline';
import {
  DOWNLOAD_TWITTER_IMAGE_MESSAGE,
  type DownloadTwitterImageMessage,
  type DownloadTwitterImageResponse,
} from '../../features/image-download/download-message';
import { createTwitterImageFilename } from '../../features/image-download/image-download';
import type {
  MountedXImageDownloadControl,
  XImageDownloadTarget,
} from './image-download-manager';

type DownloadImage = (
  message: DownloadTwitterImageMessage,
) => Promise<DownloadTwitterImageResponse>;

export function mountXImageDownloadUi(
  target: XImageDownloadTarget,
  resolveTarget: () => XImageDownloadTarget | null,
  download: DownloadImage = (message) => browser.runtime.sendMessage(message),
): MountedXImageDownloadControl {
  const { anchor } = target;
  const originalPosition = anchor.style.getPropertyValue('position');
  const originalPriority = anchor.style.getPropertyPriority('position');
  const needsPosition = ['', 'static'].includes(getComputedStyle(anchor).position);
  if (needsPosition) {
    anchor.style.setProperty('position', 'relative');
  }

  const host = document.createElement('div');
  host.dataset.twitterEnhancementImageDownload = '';
  const shadowRoot = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = imageDownloadStyles;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'te-image-download';
  button.setAttribute('aria-label', '下载原图');
  button.setAttribute('aria-describedby', 'te-image-download-status');
  button.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M11 3h2v10.17l3.59-3.58L18 11l-6 6-6-6 1.41-1.41L11 13.17V3ZM3 19h18v2H3v-2Z" />
    </svg>
  `;
  const status = document.createElement('span');
  status.id = 'te-image-download-status';
  status.className = 'te-image-download__status';
  status.setAttribute('role', 'status');
  shadowRoot.append(style, button, status);
  anchor.append(host);

  let active = true;
  let busy = false;
  let resetTimer: number | null = null;

  function clearReset() {
    if (resetTimer !== null) {
      window.clearTimeout(resetTimer);
      resetTimer = null;
    }
  }

  function setState(state: 'idle' | 'busy' | 'success' | 'error', text = '') {
    host.dataset.state = state;
    busy = state === 'busy';
    button.setAttribute('aria-disabled', String(busy));
    button.title = text || '下载原图';
    status.textContent = text;
  }

  function resetLater() {
    clearReset();
    resetTimer = window.setTimeout(() => {
      resetTimer = null;
      setState('idle');
    }, 3000);
  }

  async function handleClick(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!active || busy) {
      return;
    }
    clearReset();
    // Read again on click: a virtualized timeline may have recycled this node.
    const current = resolveTarget();
    if (!current) {
      setState('error', '图片已变化，请稍后重试');
      resetLater();
      return;
    }
    setState('busy', '正在请求原图下载');
    try {
      const response = await download({
        type: DOWNLOAD_TWITTER_IMAGE_MESSAGE,
        url: current.original.url,
        filename: createTwitterImageFilename(
          current.original,
          current.handle,
          current.tweetId,
          current.photoIndex,
        ),
      });
      if (!active) {
        return;
      }
      if (!response?.ok) {
        throw new Error('Download rejected');
      }
      setState('success', '已开始下载原图');
    } catch {
      if (!active) {
        return;
      }
      setState('error', '原图下载失败，点击重试');
    }
    resetLater();
  }

  const enter = () => { host.dataset.hovered = 'true'; };
  const leave = () => { delete host.dataset.hovered; };
  const stopPropagation = (event: Event) => { event.stopPropagation(); };
  const stopActivation = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
  };
  const stopKey = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.stopPropagation();
    }
  };
  const pointerEvents = ['pointerdown', 'pointerup', 'mousedown', 'mouseup'];
  for (const type of pointerEvents) {
    host.addEventListener(type, stopPropagation);
  }
  host.addEventListener('dblclick', stopActivation);
  host.addEventListener('auxclick', stopActivation);
  host.addEventListener('keydown', stopKey);
  host.addEventListener('keyup', stopKey);
  button.addEventListener('click', handleClick);
  anchor.addEventListener('pointerenter', enter);
  anchor.addEventListener('pointerleave', leave);
  if (anchor.matches(':hover')) {
    enter();
  }
  setState('idle');

  return {
    isConnected: () => host.parentElement === anchor && host.isConnected,
    destroy() {
      active = false;
      clearReset();
      button.removeEventListener('click', handleClick);
      anchor.removeEventListener('pointerenter', enter);
      anchor.removeEventListener('pointerleave', leave);
      for (const type of pointerEvents) {
        host.removeEventListener(type, stopPropagation);
      }
      host.removeEventListener('dblclick', stopActivation);
      host.removeEventListener('auxclick', stopActivation);
      host.removeEventListener('keydown', stopKey);
      host.removeEventListener('keyup', stopKey);
      host.remove();
      if (needsPosition && anchor.style.position === 'relative') {
        if (originalPosition) {
          anchor.style.setProperty('position', originalPosition, originalPriority);
        } else {
          anchor.style.removeProperty('position');
        }
      }
    },
  };
}
