import { browser } from 'wxt/browser';
import {
  isDownloadTwitterVideoMessage,
  type DownloadTwitterVideoResponse,
} from '../src/features/video-download/download-message';

export default defineBackground(() => {
  browser.action.onClicked.addListener(() => {
    void browser.runtime.openOptionsPage();
  });

  browser.runtime.onMessage.addListener((message: unknown) => {
    if (!isDownloadTwitterVideoMessage(message)) {
      return undefined;
    }

    return browser.downloads
      .download({
        url: message.url,
        filename: message.filename,
        conflictAction: 'uniquify',
        saveAs: false,
      })
      .then((): DownloadTwitterVideoResponse => ({ ok: true }))
      .catch(
        (error: unknown): DownloadTwitterVideoResponse => ({
          ok: false,
          error: error instanceof Error ? error.message : 'Download failed',
        }),
      );
  });
});
