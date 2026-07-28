import {
  mergeOrderedMediaEntries,
  parseXMediaRoute,
  type XMediaEntry,
  type XMediaRoute,
} from '../../features/media-navigation/media-navigation';

export type XMediaNavigationDirection = 'newer' | 'older';
export type XMediaNavigationResult = 'navigated' | 'unavailable';

export interface XMediaNavigationTarget {
  anchor: HTMLElement;
  route: XMediaRoute;
  showNewer: boolean;
  showOlder: boolean;
}

export interface MountedXMediaNavigation {
  update(target: XMediaNavigationTarget): void;
  destroy(): void;
}

export type NavigateXMedia = (
  direction: XMediaNavigationDirection,
) => Promise<XMediaNavigationResult>;

export type MountXMediaNavigation = (
  target: XMediaNavigationTarget,
  navigate: NavigateXMedia,
) => MountedXMediaNavigation;

export interface XMediaNavigationManager {
  sync(root?: ParentNode, url?: URL): void;
  destroy(): void;
}

export interface XMediaNavigationManagerOptions {
  loadMore?: (direction: XMediaNavigationDirection) => void;
  loadTimeoutMs?: number;
}

interface MountedEntry {
  anchor: HTMLElement;
  mounted: MountedXMediaNavigation;
}

interface PendingNavigation {
  direction: XMediaNavigationDirection;
  currentTweetId: string;
  resolve(result: XMediaNavigationResult): void;
  timeoutId: number;
  intervalId: number;
}

const MEDIA_PROFILE_ROUTE_PATTERN = /^\/([a-z0-9_]{1,15})\/media\/?$/i;

function mediaProfileHandle(url: URL): string | null {
  return MEDIA_PROFILE_ROUTE_PATTERN.exec(url.pathname)?.[1]?.toLowerCase() ?? null;
}

function readMediaBatch(
  root: ParentNode,
  handle: string,
): { entries: XMediaEntry[]; links: Map<string, HTMLAnchorElement> } {
  const entries: XMediaEntry[] = [];
  const links = new Map<string, HTMLAnchorElement>();
  const timeline =
    root.querySelector<HTMLElement>('[data-testid="primaryColumn"]') ?? root;

  for (const link of timeline.querySelectorAll<HTMLAnchorElement>(
    'a[href*="/status/"]',
  )) {
    if (link.closest('article') || !link.closest('[role="listitem"]')) {
      continue;
    }

    const route = parseXMediaRoute(link.getAttribute('href') ?? '');
    if (!route || route.handle !== handle) {
      continue;
    }

    entries.push({
      handle: route.handle,
      tweetId: route.tweetId,
      kind: route.kind,
      href: route.href,
    });
    links.set(route.tweetId, link);
  }

  return { entries, links };
}

function findInnermostDialog(root: ParentNode): HTMLElement | null {
  return (
    Array.from(root.querySelectorAll<HTMLElement>('[role="dialog"]')).find(
      (dialog) => !dialog.querySelector('[role="dialog"]'),
    ) ?? null
  );
}

function containsDisplayedMedia(element: HTMLElement): boolean {
  return Array.from(
    element.querySelectorAll<HTMLElement>(
      'img[src*="pbs.twimg.com/media/"], img[src*="pbs.twimg.com/tweet_video_thumb/"], img[src*="pbs.twimg.com/amplify_video_thumb/"], img[src*="pbs.twimg.com/ext_tw_video_thumb/"], video, [data-testid="videoPlayer"], [data-testid="playButton"]',
    ),
  ).some((media) => !media.closest('article'));
}

function findVisibleMediaAnchor(dialog: HTMLElement): HTMLElement | null {
  const candidates = Array.from(
    dialog.querySelectorAll<HTMLElement>('[data-testid="swipe-to-dismiss"]'),
  ).filter(containsDisplayedMedia);

  if (candidates.length === 1) {
    return candidates[0] ?? null;
  }

  let visibleCandidate: HTMLElement | null = null;
  let largestVisibleArea = 0;

  for (const candidate of candidates) {
    const rect = candidate.getBoundingClientRect();
    const visibleWidth = Math.max(
      0,
      Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0),
    );
    const visibleHeight = Math.max(
      0,
      Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0),
    );
    const visibleArea = visibleWidth * visibleHeight;
    if (visibleArea > largestVisibleArea) {
      largestVisibleArea = visibleArea;
      visibleCandidate = candidate;
    }
  }

  return visibleCandidate;
}

function scrollMediaTimeline(direction: XMediaNavigationDirection) {
  const distance = Math.max(window.innerHeight * 0.85, 600);
  window.scrollBy({
    top: direction === 'older' ? distance : -distance,
    behavior: 'auto',
  });
}

export function createXMediaNavigationManager(
  mount: MountXMediaNavigation,
  options: XMediaNavigationManagerOptions = {},
): XMediaNavigationManager {
  const loadMore = options.loadMore ?? scrollMediaTimeline;
  const loadTimeoutMs = options.loadTimeoutMs ?? 5_000;
  let activeHandle: string | null = null;
  let entries: XMediaEntry[] = [];
  const links = new Map<string, HTMLAnchorElement>();
  let mountedEntry: MountedEntry | null = null;
  let currentRoute: XMediaRoute | null = null;
  let pendingNavigation: PendingNavigation | null = null;

  function destroyMounted() {
    mountedEntry?.mounted.destroy();
    mountedEntry = null;
  }

  function finishPending(result: XMediaNavigationResult) {
    if (!pendingNavigation) {
      return;
    }

    window.clearTimeout(pendingNavigation.timeoutId);
    window.clearInterval(pendingNavigation.intervalId);
    const resolve = pendingNavigation.resolve;
    pendingNavigation = null;
    resolve(result);
  }

  function clearContext() {
    finishPending('unavailable');
    destroyMounted();
    activeHandle = null;
    entries = [];
    links.clear();
    currentRoute = null;
  }

  function collect(root: ParentNode) {
    if (!activeHandle) {
      return;
    }

    for (const [tweetId, link] of links) {
      if (!link.isConnected) {
        links.delete(tweetId);
      }
    }

    const batch = readMediaBatch(root, activeHandle);
    entries = mergeOrderedMediaEntries(entries, batch.entries);
    for (const [tweetId, link] of batch.links) {
      links.set(tweetId, link);
    }
  }

  function adjacentEntry(
    direction: XMediaNavigationDirection,
  ): XMediaEntry | null {
    if (!currentRoute) {
      return null;
    }

    const currentIndex = entries.findIndex(
      (entry) => entry.tweetId === currentRoute?.tweetId,
    );
    const targetIndex = direction === 'newer' ? currentIndex - 1 : currentIndex + 1;
    return targetIndex >= 0 ? (entries[targetIndex] ?? null) : null;
  }

  function openAdjacent(direction: XMediaNavigationDirection): boolean {
    const targetEntry = adjacentEntry(direction);
    const targetLink = targetEntry ? links.get(targetEntry.tweetId) : undefined;

    if (!targetEntry || !targetLink?.isConnected) {
      return false;
    }

    targetLink.click();
    return true;
  }

  async function navigate(
    direction: XMediaNavigationDirection,
  ): Promise<XMediaNavigationResult> {
    if (!currentRoute || pendingNavigation) {
      return 'unavailable';
    }

    if (openAdjacent(direction)) {
      return 'navigated';
    }

    const currentTweetId = currentRoute.tweetId;
    return new Promise<XMediaNavigationResult>((resolve) => {
      const timeoutId = window.setTimeout(() => {
        finishPending('unavailable');
      }, loadTimeoutMs);
      const intervalId = window.setInterval(() => {
        loadMore(direction);
      }, 600);
      pendingNavigation = {
        direction,
        currentTweetId,
        resolve,
        timeoutId,
        intervalId,
      };
      loadMore(direction);
    });
  }

  function sync(
    root: ParentNode = document,
    url: URL = new URL(window.location.href),
  ) {
    const profileHandle = mediaProfileHandle(url);
    if (profileHandle) {
      currentRoute = null;
      finishPending('unavailable');
      if (activeHandle !== profileHandle) {
        clearContext();
        activeHandle = profileHandle;
      }
      collect(root);
      destroyMounted();
      return;
    }

    const route = parseXMediaRoute(url);
    if (!route || route.handle !== activeHandle) {
      clearContext();
      return;
    }

    if (
      pendingNavigation &&
      pendingNavigation.currentTweetId !== route.tweetId
    ) {
      finishPending('unavailable');
    }
    currentRoute = route;
    collect(root);
    if (
      pendingNavigation &&
      pendingNavigation.currentTweetId === route.tweetId &&
      openAdjacent(pendingNavigation.direction)
    ) {
      finishPending('navigated');
    }
    const currentIndex = entries.findIndex(
      (entry) => entry.tweetId === route.tweetId,
    );
    const dialog = findInnermostDialog(root);
    const anchor = dialog ? findVisibleMediaAnchor(dialog) : null;
    if (currentIndex < 0 || !dialog || !anchor) {
      destroyMounted();
      return;
    }

    const target: XMediaNavigationTarget = {
      anchor,
      route,
      showNewer:
        currentIndex > 0 &&
        dialog.querySelector('[data-testid="Carousel-NavLeft"]') === null,
      showOlder:
        dialog.querySelector('[data-testid="Carousel-NavRight"]') === null,
    };

    if (mountedEntry?.anchor === anchor) {
      mountedEntry.mounted.update(target);
      return;
    }

    destroyMounted();
    mountedEntry = {
      anchor,
      mounted: mount(target, navigate),
    };
  }

  function destroy() {
    clearContext();
  }

  return { sync, destroy };
}
