import { browser } from 'wxt/browser';
import videoDownloadStyles from '../../../entrypoints/twitter.content/video-download.css?inline';
import {
  DOWNLOAD_TWITTER_VIDEO_MESSAGE,
  type DownloadTwitterVideoMessage,
  type DownloadTwitterVideoResponse,
} from '../../features/video-download/download-message';
import { createTwitterVideoFilename } from '../../features/video-download/video-download';
import type {
  MountedXVideoDownloadControl,
  XVideoDownloadTarget,
} from './video-download-manager';
import { isDarkXPage } from './theme';

export function mountXVideoDownloadUi(
  target: XVideoDownloadTarget,
  resolveUrls: () => string[],
): MountedXVideoDownloadControl {
  const host = document.createElement('div');
  host.dataset.twitterEnhancementVideoDownload = '';
  const shadowRoot = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = videoDownloadStyles;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'te-video-download';
  button.title = '下载视频';
  button.setAttribute('aria-label', '下载视频');
  button.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M11 3h2v10.17l3.59-3.58L18 11l-6 6-6-6 1.41-1.41L11 13.17V3ZM3 19h18v2H3v-2Z" />
    </svg>
  `;
  const status = document.createElement('span');
  status.className = 'te-video-download__status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  shadowRoot.append(style, button, status);
  target.anchor.append(host);

  let resettingState: number | null = null;

  function setState(state: 'idle' | 'busy' | 'success' | 'error', title: string) {
    host.dataset.state = state;
    button.disabled = state === 'busy';
    button.title = title;
    button.setAttribute('aria-label', title);
    status.textContent = state === 'idle' ? '' : title;
  }

  function resetLater() {
    if (resettingState !== null) {
      window.clearTimeout(resettingState);
    }
    resettingState = window.setTimeout(() => {
      resettingState = null;
      setState('idle', '下载视频');
    }, 2500);
  }

  button.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();

    const urls = resolveUrls();
    if (urls.length === 0) {
      setState('error', '暂未获取到视频地址，请稍后重试');
      resetLater();
      return;
    }

    setState('busy', '正在下载视频');
    try {
      const responses = await Promise.all(
        urls.map(async (url, index) => {
          const message: DownloadTwitterVideoMessage = {
            type: DOWNLOAD_TWITTER_VIDEO_MESSAGE,
            url,
            filename: createTwitterVideoFilename(
              target.handle,
              target.tweetId,
              index,
              urls.length,
            ),
          };
          return (await browser.runtime.sendMessage(
            message,
          )) as DownloadTwitterVideoResponse;
        }),
      );

      if (responses.some((response) => !response?.ok)) {
        throw new Error('Download rejected');
      }
      setState('success', '已开始下载');
    } catch {
      setState('error', '视频下载失败');
    }
    resetLater();
  });

  function updateAppearance() {
    host.dataset.teTheme = isDarkXPage() ? 'dark' : 'light';
  }

  updateAppearance();

  return {
    updateAppearance,
    destroy() {
      if (resettingState !== null) {
        window.clearTimeout(resettingState);
      }
      host.remove();
    },
  };
}
