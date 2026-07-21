import { findXNoteSurfaceTargets } from '../../src/platform/x/dom-adapter';
import { mountXNoteUi } from '../../src/platform/x/mount-note-ui';
import { createXSurfaceMountManager } from '../../src/platform/x/surface-mount-manager';

export default defineContentScript({
  matches: ['https://x.com/*', 'https://twitter.com/*'],
  runAt: 'document_idle',
  main(ctx) {
    const manager = createXSurfaceMountManager(mountXNoteUi);
    let animationFrame: number | null = null;

    const scan = () => {
      animationFrame = null;
      if (!ctx.isValid) {
        return;
      }
      manager.sync(findXNoteSurfaceTargets());
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
    };

    window.addEventListener('pagehide', cleanup, { once: true });
    scheduleScan();
  },
});
