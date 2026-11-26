import { createXInterfaceLayoutManager, INITIAL_WIDE_LAYOUT_ATTRIBUTE } from '../src/platform/x/interface-layout-manager';
import { interfaceLayoutPreferenceRepository } from '../src/shared/storage/browser-interface-layout-preference-repository';

export default defineContentScript({
  matches: ['https://x.com/*', 'https://twitter.com/*'],
  runAt: 'document_start',
  main(ctx) {
    const layout = createXInterfaceLayoutManager(interfaceLayoutPreferenceRepository);
    let frame: number | null = null;
    function scheduleLayout() {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        if (ctx.isValid) layout.sync();
      });
    }

    // X can mount the first columns inside its own animation frame. Apply the
    // saved geometry in that mutation checkpoint, before the same frame paints.
    let waitingForColumns = true;
    const observer = new MutationObserver(() => {
      if (waitingForColumns && document.querySelector('main + aside, [data-testid="sidebarColumn"]')) {
        waitingForColumns = false;
        layout.sync();
      } else {
        scheduleLayout();
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [INITIAL_WIDE_LAYOUT_ATTRIBUTE, 'data-theme', 'href', 'data-href', 'src', 'srcset', 'poster'],
      characterData: true,
    });
    ctx.addEventListener(window, 'resize', scheduleLayout);
    ctx.addEventListener(window, 'wxt:locationchange', scheduleLayout);
    ctx.addEventListener(window, 'pageshow', scheduleLayout);
    ctx.addEventListener(document, 'DOMContentLoaded', scheduleLayout);
    ctx.addEventListener(document, 'load', scheduleLayout, true);
    ctx.onInvalidated(() => {
      observer.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
      layout.destroy();
    });
    scheduleLayout();
  },
});
