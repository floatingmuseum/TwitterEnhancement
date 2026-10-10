import { findXNoteSurfaceTargets } from '../../src/platform/x/dom-adapter';
import { createXImageDownloadManager } from '../../src/platform/x/image-download-manager';
import { createXInterfaceLayoutManager } from '../../src/platform/x/interface-layout-manager';
import { createXInterfaceModuleManager } from '../../src/platform/x/interface-module-manager';
import { createXRepostTimelineManager } from '../../src/platform/x/list-repost-manager';
import { createXMediaNavigationManager } from '../../src/platform/x/media-navigation-manager';
import { mountXRepostTimelineUi } from '../../src/platform/x/mount-list-repost-ui';
import { mountXImageDownloadUi } from '../../src/platform/x/mount-image-download-ui';
import { mountXMediaNavigationUi } from '../../src/platform/x/mount-media-navigation-ui';
import { mountXNoteUi } from '../../src/platform/x/mount-note-ui';
import { mountXVideoDownloadUi } from '../../src/platform/x/mount-video-download-ui';
import { createXSurfaceMountManager } from '../../src/platform/x/surface-mount-manager';
import { readCapturedTwitterVideoUrls } from '../../src/platform/x/twitter-video-data-bridge';
import { createXVideoDownloadManager } from '../../src/platform/x/video-download-manager';
import { interfaceLayoutPreferenceRepository } from '../../src/shared/storage/browser-interface-layout-preference-repository';
import { interfaceModuleVisibilityRepository } from '../../src/shared/storage/browser-interface-module-visibility-repository';
import { listRepostPreferenceRepository } from '../../src/shared/storage/browser-list-repost-preference-repository';
import { userNoteRepository } from '../../src/shared/storage/browser-user-note-repository';

export default defineContentScript({
  matches: ['https://x.com/*', 'https://twitter.com/*'],
  runAt: 'document_idle',
  main(ctx) {
    const manager = createXSurfaceMountManager((target) => mountXNoteUi(target, userNoteRepository));
    const interfaceModuleManager = createXInterfaceModuleManager(
      interfaceModuleVisibilityRepository,
    );
    const interfaceLayoutManager = createXInterfaceLayoutManager(
      interfaceLayoutPreferenceRepository,
    );
    const repostTimelineManager = createXRepostTimelineManager(
      (target) => mountXRepostTimelineUi(target, listRepostPreferenceRepository),
      listRepostPreferenceRepository,
    );
    const mediaNavigationManager = createXMediaNavigationManager(
      mountXMediaNavigationUi,
    );
    const imageDownloadManager = createXImageDownloadManager(mountXImageDownloadUi);
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
      interfaceModuleManager.sync();
      interfaceLayoutManager.sync();
      repostTimelineManager.sync();
      mediaNavigationManager.sync();
      videoDownloadManager.sync();
      imageDownloadManager.sync();
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
      attributes: true,
      attributeFilter: ['href', 'src', 'srcset'],
      characterData: true,
    });

    ctx.addEventListener(window, 'wxt:locationchange', scheduleScan);
    ctx.addEventListener(window, 'resize', scheduleScan);
    ctx.addEventListener(
      document,
      'load',
      (event) => {
        if (event.target instanceof HTMLImageElement) {
          scheduleScan();
        }
      },
      true,
    );

    const cleanup = () => {
      observer.disconnect();
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
      manager.destroyAll();
      interfaceModuleManager.destroy();
      interfaceLayoutManager.destroy();
      repostTimelineManager.destroy();
      mediaNavigationManager.destroy();
      videoDownloadManager.destroy();
      imageDownloadManager.destroy();
    };

    window.addEventListener('pagehide', cleanup, { once: true });
    ctx.onInvalidated(cleanup);
    scheduleScan();
  },
});
