import { browser } from 'wxt/browser';
import { isDownloadTwitterImageMessage } from '../src/features/image-download/download-message';
import { isDownloadTwitterVideoMessage } from '../src/features/video-download/download-message';
import { INSTALL_TIMELINE_ROW_STYLE } from '../src/platform/x/timeline-style-message';
import { interfaceLayoutPreferenceRepository } from '../src/shared/storage/browser-interface-layout-preference-repository';

export default defineBackground(() => {
  const wideLayoutId = 'te-initial-wide-layout';
  let pendingRegistration = Promise.resolve();
  function syncInitialLayout() {
    // Serialize storage changes so an older registration cannot finish last.
    pendingRegistration = pendingRegistration.then(async () => {
      const { leftNavigationExpanded, rightSidebarVisible } = await interfaceLayoutPreferenceRepository.getPreference();
      const [registered] = await browser.scripting.getRegisteredContentScripts({ ids: [wideLayoutId] });
      if (!leftNavigationExpanded && !rightSidebarVisible) {
        if (!registered) {
          await browser.scripting.registerContentScripts([{
            id: wideLayoutId,
            matches: ['https://x.com/*', 'https://twitter.com/*'],
            js: ['initial-wide-layout.js'],
            runAt: 'document_start',
            persistAcrossSessions: true,
          }]);
        }
      } else if (registered) {
        await browser.scripting.unregisterContentScripts({ ids: [wideLayoutId] });
      }
    }).catch((error) => console.warn('Could not update the initial X layout', error));
    return pendingRegistration;
  }
  browser.runtime.onInstalled.addListener(syncInitialLayout);
  browser.runtime.onStartup.addListener(syncInitialLayout);
  interfaceLayoutPreferenceRepository.subscribe(syncInitialLayout);

  browser.action.onClicked.addListener(() => {
    void browser.runtime.openOptionsPage();
  });

  browser.runtime.onMessage.addListener((message: unknown, sender) => {
    if (message === INSTALL_TIMELINE_ROW_STYLE) {
      if (sender.frameId !== 0 || !sender.documentId || sender.tab?.id === undefined ||
        !/^https:\/\/(?:x|twitter)\.com\//.test(sender.url ?? '')) return undefined;
      // A cosmetic filter can hide the list item at user origin. Its contents
      // stay hidden; only the empty measuring box must win the cascade.
      return browser.scripting.insertCSS({
        target: { tabId: sender.tab.id, documentIds: [sender.documentId] },
        files: ['hidden-timeline-rows.css'],
        origin: 'USER',
      }).then(() => true);
    }
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
