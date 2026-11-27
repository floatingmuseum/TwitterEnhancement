import { createXInterfaceLayoutManager, INITIAL_WIDE_LAYOUT_ATTRIBUTE } from '../src/platform/x/interface-layout-manager';
import { hasNewTimelinePosts } from '../src/platform/x/virtual-timeline';
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

    // X mounts columns and returning posts inside its own animation frame.
    // Apply their geometry before its virtual list measures the new row heights.
    let waitingForColumns = true;
    const observer = new MutationObserver((records) => {
      if (!ctx.isValid) return;
      const mountedColumns = waitingForColumns && document.querySelector('main + aside, [data-testid="sidebarColumn"]');
      if (mountedColumns) waitingForColumns = false;
      if (mountedColumns || hasNewTimelinePosts(records)) {
        if (frame !== null) cancelAnimationFrame(frame);
        frame = null;
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
