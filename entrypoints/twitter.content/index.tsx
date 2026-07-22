import { findXNoteSurfaceTargets } from '../../src/platform/x/dom-adapter';
import { createXListRepostManager } from '../../src/platform/x/list-repost-manager';
import { mountXListRepostUi } from '../../src/platform/x/mount-list-repost-ui';
import { mountXNoteUi } from '../../src/platform/x/mount-note-ui';
import { mountXVideoDownloadUi } from '../../src/platform/x/mount-video-download-ui';
import { createXSurfaceMountManager } from '../../src/platform/x/surface-mount-manager';
import { readCapturedTwitterVideoUrls } from '../../src/platform/x/twitter-video-data-bridge';
import { createXVideoDownloadManager } from '../../src/platform/x/video-download-manager';
import { listRepostPreferenceRepository } from '../../src/shared/storage/browser-list-repost-preference-repository';

export default defineContentScript({
  matches: ['https://x.com/*', 'https://twitter.com/*'],
  runAt: 'document_idle',
  main(ctx) {
    const manager = createXSurfaceMountManager(mountXNoteUi);
    const listRepostManager = createXListRepostManager(
      (target) => mountXListRepostUi(target, listRepostPreferenceRepository),
      listRepostPreferenceRepository,
    );
    const videoDownloadManager = createXVideoDownloadManager(
      mountXVideoDownloadUi,
      (target) => [
        ...readCapturedTwitterVideoUrls(
          document,
          target.tweetId,
          target.identities,
        ),
        ...performance.getEntriesByType('resource').map((entry) => entry.name),
      ],
    );
    let animationFrame: number | null = null;

    const scan = () => {
      animationFrame = null;
      if (!ctx.isValid) {
        return;
      }
      manager.sync(findXNoteSurfaceTargets());
      listRepostManager.sync();
      videoDownloadManager.sync();
    };

    const scheduleScan = () => {
      if (animationFrame === null) {
        animationFrame = window.requestAnimationFrame(scan);
      }
    };

    const observer = new MutationObserver(scheduleScan);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    ctx.addEventListener(window, 'wxt:locationchange', scheduleScan);

    const cleanup = () => {
      observer.disconnect();
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
      manager.destroyAll();
      listRepostManager.destroy();
      videoDownloadManager.destroy();
    };

    window.addEventListener('pagehide', cleanup, { once: true });
    scheduleScan();
  },
});
