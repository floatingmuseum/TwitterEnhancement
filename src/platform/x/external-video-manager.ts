import {
  parseExternalPlayerPageUrl,
  parseExternalVideoUrl,
  type ExternalVideoLink,
} from '../../features/external-video/external-video';
import {
  readCapturedExternalVideoCards,
  type CapturedExternalVideoCard,
} from './external-video-data-bridge';

export interface XExternalVideoTarget {
  anchor: HTMLElement;
  link: ExternalVideoLink;
}

export interface MountedXExternalVideoControl {
  isConnected(): boolean;
  updateAppearance(): void;
  destroy(): void;
}

export type MountXExternalVideoControl = (
  target: XExternalVideoTarget,
  resolveTarget: () => XExternalVideoTarget | null,
) => MountedXExternalVideoControl;

const CARD_SELECTOR = '[data-testid="card.wrapper"]';
const SCOPE_SELECTOR = 'article, [data-testid="quoteTweet"], [role="link"]:not(a)';
const PLAY_SELECTOR = '[data-testid="playButton"], [data-icon="icon-play"], iframe';

function absoluteUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value, 'https://x.com').href;
  } catch {
    return null;
  }
}

function tweetIdFromUrl(value: string | null): string | null {
  const absolute = absoluteUrl(value);
  if (!absolute) return null;
  const url = new URL(absolute);
  return /^(?:www\.)?(?:x|twitter)\.com$/.test(url.hostname)
    ? url.pathname.match(/^\/[a-z0-9_]+\/status\/(\d+)\/?$/i)?.[1] ?? null
    : null;
}

function imageKey(value: string): string | null {
  try {
    const url = new URL(value);
    // X requests different thumbnail sizes and formats for the same card.
    return `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
}

function cardSurfaces(root: ParentNode): HTMLElement[] {
  const cards = new Set(root.querySelectorAll<HTMLElement>(CARD_SELECTOR));
  // The newer public post page uses a semantic button without data-testid.
  for (const button of root.querySelectorAll<HTMLElement>('article button, article [role="button"]')) {
    if (
      !button.closest(CARD_SELECTOR) &&
      button.querySelector('img[src*="/card_img/"]') &&
      button.querySelector(PLAY_SELECTOR)
    ) cards.add(button);
  }
  for (const frame of root.querySelectorAll<HTMLIFrameElement>('article iframe[src]')) {
    if (frame.closest(CARD_SELECTOR)) continue;
    const src = absoluteUrl(frame.getAttribute('src'));
    if (!src) continue;
    const url = new URL(src);
    if (
      parseExternalVideoUrl(src) ||
      (/^(?:www\.)?(?:x|twitter)\.com$/.test(url.hostname) && /^\/i\/cards-frame\/\d+/.test(url.pathname))
    ) cards.add(frame.parentElement?.tagName === 'ARTICLE' ? frame : frame.parentElement ?? frame);
  }
  return [...cards].filter((card) =>
    card.closest('article') && !card.closest('[data-testid="HoverCard"], [role="dialog"][aria-label="Compose"]'),
  );
}

function mountAnchor(card: HTMLElement): HTMLElement {
  let anchor = card;
  // Keep the new link outside the original clickable card, including wrapping anchors.
  while (true) {
    const parentControl = anchor.parentElement?.closest<HTMLElement>('a, button, [role="button"]');
    if (!parentControl || !parentControl.closest('article')) return anchor;
    anchor = parentControl;
  }
}

function ownTweetId(card: HTMLElement, surfaces: readonly HTMLElement[]): string | null {
  const scope = card.parentElement?.closest<HTMLElement>(SCOPE_SELECTOR);
  if (!scope || surfaces.filter((surface) => surface.parentElement?.closest(SCOPE_SELECTOR) === scope).length !== 1) {
    return null;
  }
  const ids = new Set<string>();
  for (const link of scope.querySelectorAll<HTMLAnchorElement>('a[href*="/status/"]')) {
    if (link.parentElement?.closest(SCOPE_SELECTOR) !== scope || link.closest(CARD_SELECTOR)) continue;
    const id = tweetIdFromUrl(link.getAttribute('href'));
    if (id) ids.add(id);
  }
  return ids.size === 1 ? [...ids][0] ?? null : null;
}

function capturedLink(card: CapturedExternalVideoCard): ExternalVideoLink | null {
  return parseExternalVideoUrl(card.url) ??
    (card.isPlayer && card.url !== card.playerUrl ? parseExternalPlayerPageUrl(card.url) : null) ??
    (card.playerUrl ? parseExternalVideoUrl(card.playerUrl) : null);
}

function uniqueLink(links: readonly (ExternalVideoLink | null)[]): ExternalVideoLink | null {
  const unique = new Map(links.flatMap((link) => link ? [[link.url, link] as const] : []));
  return unique.size === 1 ? [...unique.values()][0] ?? null : null;
}

export function findXExternalVideoTargets(
  root: ParentNode = document,
  captures: readonly CapturedExternalVideoCard[] = readCapturedExternalVideoCards(document),
): XExternalVideoTarget[] {
  const surfaces = cardSurfaces(root);
  const targets = new Map<HTMLElement, XExternalVideoTarget>();
  for (const card of surfaces) {
    const anchor = mountAnchor(card);
    const elements = [anchor, card, ...card.querySelectorAll<HTMLElement>('a[href], [data-expanded-url], [title]')];
    const urls = elements.flatMap((element) =>
      ['data-expanded-url', 'href', 'title'].flatMap((name) => {
        const value = element.getAttribute(name);
        // Titles are useful only when they contain a complete URL, not a description.
        if (!value || !/^https?:\/\//i.test(value)) return [];
        const url = absoluteUrl(value);
        return url ? [url] : [];
      }),
    );
    const hasPlayer = card.matches(PLAY_SELECTOR) || Boolean(card.querySelector(PLAY_SELECTOR));
    let link = uniqueLink(urls.map(parseExternalVideoUrl));
    const imageKeys = new Set(Array.from(card.querySelectorAll<HTMLImageElement>('img[src]'))
      .map((img) => imageKey(img.src)).filter((key) => key !== null));
    const exactCaptures = captures.filter((capture) => urls.length > 0
      ? urls.includes(capture.cardUrl) || urls.includes(capture.url)
      : capture.imageUrls.some((url) => {
        const key = imageKey(url);
        return key !== null && imageKeys.has(key);
      }),
    );
    const tweetId = ownTweetId(card, surfaces);
    // A concrete but unmatched card URL must not inherit another card's destination.
    const matchingCaptures = exactCaptures.length > 0 ? exactCaptures :
      urls.length === 0 && tweetId ? captures.filter((capture) =>
        capture.tweetId === tweetId && (imageKeys.size === 0 || capture.imageUrls.length === 0),
      ) : [];
    link ??= uniqueLink(matchingCaptures.map(capturedLink));
    if (!link && hasPlayer) link = uniqueLink(urls.map(parseExternalPlayerPageUrl));
    if (!link) {
      const playerUrls: string[] = [];
      const frames = card instanceof HTMLIFrameElement ? [card] : card.querySelectorAll<HTMLIFrameElement>('iframe[src]');
      for (const frame of frames) {
        const src = absoluteUrl(frame.getAttribute('src'));
        if (src) playerUrls.push(src);
        // X sometimes wraps YouTube in its own same-origin cards-frame.
        try {
          for (const nested of frame.contentDocument?.querySelectorAll<HTMLIFrameElement>('iframe[src]') ?? []) {
            playerUrls.push(nested.src);
          }
        } catch {
          // Cross-origin/sandboxed frames cannot be inspected.
        }
      }
      link = uniqueLink(playerUrls.map(parseExternalVideoUrl));
    }
    if (link) targets.set(anchor, { anchor, link });
  }
  return [...targets.values()];
}

export function createXExternalVideoManager(
  mount: MountXExternalVideoControl,
  readCaptures: () => readonly CapturedExternalVideoCard[] = () => readCapturedExternalVideoCards(document),
) {
  const entries = new Map<HTMLElement, { signature: string; mounted: MountedXExternalVideoControl }>();
  function sync(root: ParentNode = document) {
    const anchors = new Set<HTMLElement>();
    for (const target of findXExternalVideoTargets(root, readCaptures())) {
      anchors.add(target.anchor);
      const signature = `${target.link.provider}|${target.link.url}`;
      const existing = entries.get(target.anchor);
      if (existing?.signature === signature && existing.mounted.isConnected()) {
        existing.mounted.updateAppearance();
        continue;
      }
      existing?.mounted.destroy();
      entries.set(target.anchor, {
        signature,
        mounted: mount(target, () => target.anchor.isConnected
          ? findXExternalVideoTargets(root, readCaptures()).find((current) => current.anchor === target.anchor) ?? null
          : null),
      });
    }
    for (const [anchor, entry] of entries) {
      if (!anchors.has(anchor) || !anchor.isConnected) {
        entry.mounted.destroy();
        entries.delete(anchor);
      }
    }
  }
  function destroy() {
    for (const entry of entries.values()) entry.mounted.destroy();
    entries.clear();
  }
  return { sync, destroy };
}
