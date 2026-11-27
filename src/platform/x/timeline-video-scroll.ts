import { parseXMediaRoute } from '../../features/media-navigation/media-navigation';
import { frameIdentity, POST_FRAME_SELECTOR } from './post-frame';
import { saveVideoReturn, takeVideoReturn, type TimelineVideoPosition } from './timeline-video-history';
import { findVirtualTimelineList } from './virtual-timeline';

const ROW = 'li[data-index], [data-testid="cellInnerDiv"]';
const PLAYER = 'video, [data-testid="videoPlayer"], [data-testid="videoComponent"], [data-testid="playButton"], [data-icon="icon-player-play"]';
const PREVIEW = PLAYER + ', img[src*="_video_thumb/"], img[srcset*="_video_thumb/"]';
const LOADING = '[role="progressbar"], [aria-busy="true"]';
const OVERLAY = 'dialog[open], [role="dialog"], [aria-modal="true"], [data-base-ui-portal]';
const HIDDEN = '[hidden], [aria-hidden="true"], [data-closed], dialog:not([open])';

function postId(row: Element) {
  return frameIdentity(row.querySelector(POST_FRAME_SELECTOR))?.tweetId ??
    row.querySelector('article time')?.closest<HTMLAnchorElement>('a[href]')?.pathname.match(/\/status\/(\d+)\/?$/)?.[1];
}

function scrollContainer(row: Element, includeEmpty = false) {
  for (let parent = row.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
    if ((includeEmpty || parent.scrollHeight > parent.clientHeight) && /^(auto|scroll)$/.test(getComputedStyle(parent).overflowY)) {
      return parent;
    }
  }
  return null;
}

function documentScrollLocked() {
  const body = getComputedStyle(document.body);
  return body.position === 'fixed' || body.overflowY === 'hidden' || getComputedStyle(document.documentElement).overflowY === 'hidden';
}

function isVideoPath(path: string) {
  return parseXMediaRoute(path)?.kind === 'video' || /^\/i\/videos?(?:\/|$)/.test(path);
}

interface VideoOrigin extends TimelineVideoPosition {
  row: Element | null;
  list: Element | null;
  port: HTMLElement | null;
  wasLocked: boolean;
}

// X focuses the video overlay and later restores the virtualized feed using an
// estimated scroll offset. Keep a post-relative anchor across both operations.
export function createTimelineVideoScrollManager() {
  let origin: VideoOrigin | null = null;
  let phase: 'pending' | 'viewing' | 'returning' = 'pending';
  let frame: number | undefined;
  let timeout: number | undefined;
  let settled: number | undefined;
  let retry: number | undefined;
  let lockedBody: CSSStyleSheet | undefined;
  const listeners = new AbortController();
  const capture = { capture: true, passive: true, signal: listeners.signal };
  const lockObserver = new MutationObserver(() => sync());

  function releaseBody() {
    if (!lockedBody) return;
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(sheet => sheet !== lockedBody);
    lockedBody = undefined;
  }

  function clear() {
    lockObserver.disconnect();
    if (frame !== undefined) cancelAnimationFrame(frame);
    clearTimeout(timeout);
    clearTimeout(settled);
    clearTimeout(retry);
    retry = undefined;
    settled = undefined;
    frame = undefined;
    origin = null;
    phase = 'pending';
    releaseBody();
  }

  function remember(event: MouseEvent) {
    if (event.button || event.ctrlKey || event.shiftKey || event.metaKey || event.altKey) return;
    const target = event.target;
    if (!(target instanceof Element) || target.closest(OVERLAY) || phase === 'viewing') return;
    // A fullscreen loading view can replace the feed before its close button
    // gets a click, even when X hasn't mounted a video or a dialog element.
    if (origin && !origin.list?.isConnected && !findSourceList(origin)) return;
    const link = target.closest<HTMLAnchorElement>('a[href*="/video/"]');
    const videoLink = link?.origin === location.origin && isVideoPath(link.pathname);
    const control = videoLink ? link : target.closest(`[data-press-control], [data-testid="tweetPhoto"], ${PLAYER}`);
    const row = control?.closest(ROW);
    const attachment = control?.closest('[style*="aspect-ratio"], [data-testid="videoComponent"]') ?? control;
    if (!row?.parentElement || !control?.closest('article') || !row.closest('main, [data-testid="primaryColumn"]') ||
        !(videoLink || control.matches(PLAYER) || attachment?.querySelector(PREVIEW))) {
      clear();
      return;
    }
    // Pointer focus may have already moved the page by the time click fires.
    if (event.type === 'click' && origin?.row === row && phase === 'pending') return;
    clear();
    const port = scrollContainer(row);
    origin = {
      row, list: row.parentElement, id: postId(row), path: location.pathname + location.search,
      port, scroll: port?.scrollTop ?? window.scrollY, top: row.getBoundingClientRect().top,
      feedId: row.closest('[id^="urt:"]')?.id, nested: Boolean(port), wasLocked: documentScrollLocked(),
    };
    lockObserver.observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });
    lockObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
    timeout = window.setTimeout(clear, 1500); // An inline play or a drag never opened a viewer.
    schedule();
  }

  function hasViewer({ list, row }: VideoOrigin) {
    if (document.fullscreenElement?.querySelector(PLAYER) || document.fullscreenElement?.matches(PLAYER)) return true;
    if (Array.from(document.querySelectorAll(OVERLAY)).some(overlay => !overlay.contains(list) &&
      Array.from(overlay.querySelectorAll(`${PLAYER}, ${LOADING}`))
        .some(player => !player.closest(HIDDEN) && player.checkVisibility?.() !== false),
    )) return true;
    // Some players use a viewport-sized fixed layer without dialog semantics.
    for (const media of document.querySelectorAll<HTMLElement>(`video, ${LOADING}`)) {
      if ((list?.contains(media) && !row?.contains(media)) || media.closest(HIDDEN)) continue;
      for (let layer: HTMLElement | null = media; layer && layer !== document.body; layer = layer.parentElement) {
        if (layer.contains(list)) break;
        if (getComputedStyle(layer).position !== 'fixed') continue;
        const box = layer.getBoundingClientRect();
        if (box.width >= document.documentElement.clientWidth && box.height >= window.innerHeight) return true;
      }
    }
    return false;
  }

  function findSourceList(saved: VideoOrigin) {
    if (saved.list?.isConnected) return saved.list;
    const list = findVirtualTimelineList(document, location) ??
      document.querySelector('main [data-testid="cellInnerDiv"], [data-testid="primaryColumn"] [data-testid="cellInnerDiv"]')?.parentElement;
    const feedId = list?.closest('[id^="urt:"]')?.id;
    return saved.feedId && feedId && saved.feedId !== feedId ? null : list ?? null;
  }

  function restore(saved: VideoOrigin): boolean {
    const list = findSourceList(saved);
    if (!list) return false;
    if (list !== saved.list || (saved.port && !saved.port.isConnected)) {
      saved.list = list;
      saved.port = scrollContainer(list, saved.nested);
    }
    let row = saved.row;
    if (!row || row.parentElement !== list || postId(row) !== saved.id) {
      row = saved.id ? Array.from(list.children).find(child => child.matches(ROW) && postId(child) === saved.id) ?? null : null;
      saved.row = row;
    }
    const rect = row?.getBoundingClientRect();
    const current = saved.port?.scrollTop ?? window.scrollY;
    // A hidden or unmounted background must not scroll the foreground player.
    if (!rect?.height && phase !== 'returning') return false;
    const delta = rect?.height ? rect.top - saved.top : saved.scroll - current;
    if (Math.abs(delta) < 1) return Boolean(rect?.height) || !saved.id;
    if (!saved.port && rect?.height) {
      const body = getComputedStyle(document.body);
      if (body.position === 'fixed') {
        // A fixed body cannot be scrolled. Offset the background without changing
        // the inline styles X reads back when it unlocks the document.
        if (!lockedBody) {
          lockedBody = new CSSStyleSheet();
          document.adoptedStyleSheets = [...document.adoptedStyleSheets, lockedBody];
        }
        const top = (Number.parseFloat(body.top) || 0) - delta;
        lockedBody.replaceSync(`body { top: ${top}px !important; }`);
        return false;
      }
    }
    const options = { top: current + delta, behavior: 'instant' } as const;
    if (saved.port) saved.port.scrollTo(options);
    else window.scrollTo(options);
    return false;
  }

  function beginReturn() {
    clearTimeout(timeout);
    phase = 'returning';
    // The returning feed may initially contain just the first few posts. Recheck
    // after its scroll range grows, even if that resize has no DOM mutation.
    timeout = window.setTimeout(clear, 10000);
    schedule();
  }

  function schedule() {
    if (!origin || frame !== undefined) return;
    frame = requestAnimationFrame(() => { frame = undefined; sync(); });
  }

  function sync(): boolean {
    if (!origin) return false;
    if (lockedBody && getComputedStyle(document.body).position !== 'fixed') releaseBody();
    const atSource = origin.path === location.pathname + location.search;
    const open = hasViewer(origin) || (!atSource && isVideoPath(location.pathname));
    if (open) {
      clearTimeout(timeout);
      clearTimeout(settled);
      settled = undefined;
      phase = 'viewing';
      if (!origin.list?.isConnected) return true;
    } else {
      if (!atSource) {
        clear();
        return false;
      }
      // The scroll lock may precede the player or outlive its closing animation.
      if (origin.list?.isConnected && (origin.list.closest('[aria-hidden="true"], [inert]') ||
          (!origin.wasLocked && documentScrollLocked()))) {
        restore(origin);
        return true;
      }
      if (phase === 'viewing' || (phase === 'pending' && !origin.list?.isConnected)) beginReturn();
      if (phase === 'pending') return false;
    }
    const aligned = restore(origin);
    if (phase === 'returning') {
      if (aligned && settled === undefined) settled = window.setTimeout(clear, 700);
      if (!aligned) {
        clearTimeout(settled);
        settled = undefined;
        if (retry === undefined) retry = window.setTimeout(() => { retry = undefined; schedule(); }, 100);
      }
    }
    return open;
  }

  function onScroll(event: Event) {
    if (phase !== 'pending' && (event.target === document || event.target === origin?.port)) schedule();
  }

  function onUserScroll() {
    if (phase !== 'viewing' && origin) clear();
  }

  window.navigation?.addEventListener('navigate', event => {
    if (!origin || event.destination.sameDocument || origin.path !== location.pathname + location.search) return;
    const url = new URL(event.destination.url);
    if (url.origin === location.origin && isVideoPath(url.pathname)) saveVideoReturn(origin, url.href);
  }, capture);
  function resumeFromHistory() {
    const position = takeVideoReturn();
    if (!position) return;
    origin = { ...position, row: null, list: null, port: null, wasLocked: documentScrollLocked() };
    beginReturn();
  }
  window.addEventListener('pageshow', event => { if (event.persisted) resumeFromHistory(); }, capture);
  resumeFromHistory();
  window.addEventListener('pointerdown', remember, capture);
  window.addEventListener('click', remember, capture);
  window.addEventListener('scroll', onScroll, capture);
  window.addEventListener('wheel', onUserScroll, capture);
  window.addEventListener('touchmove', onUserScroll, capture);
  window.addEventListener('keydown', onUserScroll, capture);
  return { sync, destroy() { listeners.abort(); clear(); } };
}
