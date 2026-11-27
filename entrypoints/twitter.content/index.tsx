import { browser } from 'wxt/browser';
import { findXNoteSurfaceTargets } from '../../src/platform/x/dom-adapter';
import { EXTERNAL_VIDEO_DATA_EVENT } from '../../src/platform/x/external-video-data-bridge';
import { createXExternalVideoManager } from '../../src/platform/x/external-video-manager';
import { createXImageDownloadManager } from '../../src/platform/x/image-download-manager';
import { hasNewTimelinePosts } from '../../src/platform/x/virtual-timeline';
import { createTimelineRowHeights } from '../../src/platform/x/timeline-row-heights';
import { createTimelineVideoScrollManager } from '../../src/platform/x/timeline-video-scroll';
import { createXInterfaceModuleManager } from '../../src/platform/x/interface-module-manager';
import { createXRepostTimelineManager } from '../../src/platform/x/list-repost-manager';
import { INSTALL_TIMELINE_ROW_STYLE } from '../../src/platform/x/timeline-style-message';
import { createXMediaNavigationManager } from '../../src/platform/x/media-navigation-manager';
import { mountXRepostTimelineUi } from '../../src/platform/x/mount-list-repost-ui';
import { mountXImageDownloadUi } from '../../src/platform/x/mount-image-download-ui';
import { mountXExternalVideoUi } from '../../src/platform/x/mount-external-video-ui';
import { mountXMediaNavigationUi } from '../../src/platform/x/mount-media-navigation-ui';
import { mountXNoteUi } from '../../src/platform/x/mount-note-ui';
import { mountXVideoDownloadUi } from '../../src/platform/x/mount-video-download-ui';
import { createXSurfaceMountManager } from '../../src/platform/x/surface-mount-manager';
import { readCapturedTwitterVideoUrls } from '../../src/platform/x/twitter-video-data-bridge';
import { createXVideoDownloadManager } from '../../src/platform/x/video-download-manager';
import { createXVideoDurationManager } from '../../src/platform/x/video-duration-manager';
import './video-duration.css';
import { interfaceModuleVisibilityRepository } from '../../src/shared/storage/browser-interface-module-visibility-repository';
import { listRepostPreferenceRepository } from '../../src/shared/storage/browser-list-repost-preference-repository';
import { userNoteRepository } from '../../src/shared/storage/browser-user-note-repository';

export default defineContentScript({
  matches: ['https://x.com/*', 'https://twitter.com/*'],
  runAt: 'document_idle',
  main(ctx) {
    void browser.runtime.sendMessage(INSTALL_TIMELINE_ROW_STYLE).catch(() => {});
    const manager = createXSurfaceMountManager((target) => mountXNoteUi(target, userNoteRepository));
    const interfaceModuleManager = createXInterfaceModuleManager(
      interfaceModuleVisibilityRepository,
    );
    const repostTimelineManager = createXRepostTimelineManager(
      (target) => mountXRepostTimelineUi(target, listRepostPreferenceRepository),
      listRepostPreferenceRepository,
    );
    const mediaNavigationManager = createXMediaNavigationManager(
      mountXMediaNavigationUi,
    );
    const imageDownloadManager = createXImageDownloadManager(mountXImageDownloadUi);
    const videoDurationManager = createXVideoDurationManager();
    const externalVideoManager = createXExternalVideoManager(mountXExternalVideoUi);
    const videoDownloadManager = createXVideoDownloadManager(
      mountXVideoDownloadUi,
      (target) => [
        ...readCapturedTwitterVideoUrls(
          document,
          target.tweetId,
          target.identities,
        ),
        ...(target.identities.length > 0
          ? performance.getEntriesByType('resource').map((entry) => entry.name)
          : []),
      ],
    );
    let animationFrame: number | null = null;
    let repostsNeedScan = true;
    const rowHeights = createTimelineRowHeights();
    const videoScroll = createTimelineVideoScrollManager();
    const unsubscribeRowHeights = listRepostPreferenceRepository.subscribe(rowHeights.reset);

    const scan = () => {
      animationFrame = null;
      if (!ctx.isValid) {
        return;
      }
      manager.sync(findXNoteSurfaceTargets());
      interfaceModuleManager.sync();
      // The covered feed can be aria-hidden or have a media URL. Keep its
      // filtered rows and measurements in place until the viewer closes.
      const viewingVideo = videoScroll.sync();
      if (repostsNeedScan && !viewingVideo) repostTimelineManager.sync();
      mediaNavigationManager.sync();
      videoDownloadManager.sync();
      videoDurationManager.sync();
      imageDownloadManager.sync();
      externalVideoManager.sync();
      if (!viewingVideo) rowHeights.sync();
    };

    const scheduleScan = () => {
      repostsNeedScan = true;
      if (animationFrame === null) {
        animationFrame = window.requestAnimationFrame(scan);
      }
    };

    const observer = new MutationObserver((records) => {
      scheduleScan();
      if (ctx.isValid && !videoScroll.sync() && hasNewTimelinePosts(records)) {
        // A returning filtered post must have its final height in this frame.
        repostTimelineManager.sync();
        repostsNeedScan = false;
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['href', 'src', 'srcset', 'poster', 'title', 'data-href', 'data-open', 'open', 'hidden', 'aria-hidden', 'data-expanded-url', 'data-theme'],
      characterData: true,
    });

    ctx.addEventListener(window, 'wxt:locationchange', scheduleScan);
    ctx.addEventListener(window, 'pageshow', scheduleScan);
    ctx.addEventListener(window, 'resize', scheduleScan);
    ctx.addEventListener(document, EXTERNAL_VIDEO_DATA_EVENT, scheduleScan);
    for (const type of ['loadedmetadata', 'durationchange', 'play', 'pause', 'emptied'] as const) {
      ctx.addEventListener(document, type, (event) => {
        if (event.target instanceof HTMLVideoElement) scheduleScan();
      }, true);
    }
    ctx.addEventListener(
      document,
      'load',
      (event) => {
        if (event.target instanceof HTMLImageElement || event.target instanceof HTMLIFrameElement) {
          scheduleScan();
        }
      },
      true,
    );

    const cleanup = () => {
      observer.disconnect();
      unsubscribeRowHeights();
      videoScroll.destroy();
      rowHeights.destroy();
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
      manager.destroyAll();
      interfaceModuleManager.destroy();
      repostTimelineManager.destroy();
      mediaNavigationManager.destroy();
      videoDownloadManager.destroy();
      videoDurationManager.destroy();
      imageDownloadManager.destroy();
      externalVideoManager.destroy();
    };

    ctx.addEventListener(window, 'pagehide', event => {
      if (!event.persisted) cleanup();
    });
    ctx.onInvalidated(cleanup);
    scheduleScan();
  },
});
