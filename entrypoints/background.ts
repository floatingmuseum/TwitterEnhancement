import { browser } from 'wxt/browser';
import { isDownloadTwitterImageMessage } from '../src/features/image-download/download-message';
import { isDownloadTwitterVideoMessage } from '../src/features/video-download/download-message';

export default defineBackground(() => {
  browser.action.onClicked.addListener(() => {
    void browser.runtime.openOptionsPage();
  });

  browser.runtime.onMessage.addListener((message: unknown) => {
    if (
      !isDownloadTwitterVideoMessage(message) &&
      !isDownloadTwitterImageMessage(message)
    ) {
      return undefined;
    }

    return (async () => {
      try {
        await browser.downloads.download({
          url: message.url,
          filename: message.filename,
          conflictAction: 'uniquify',
          saveAs: false,
        });
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : 'Download failed',
        };
      }
    })();
  });
});
