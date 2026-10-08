import {
  normalizeDisplayName,
  normalizeHandle,
} from '../../features/user-notes/note-model';
import type { NoteSurface } from '../../features/user-notes/UserNote';

export interface XNoteSurfaceTarget {
  anchor: HTMLElement;
  handle: string;
  displayName: string | null;
  surface: NoteSurface | 'tweet';
}

const RESERVED_ROUTES = new Set([
  'compose',
  'explore',
  'home',
  'i',
  'login',
  'messages',
  'notifications',
  'search',
  'settings',
  'signup',
]);

const PROFILE_SUBROUTES = new Set([
  '',
  'articles',
  'highlights',
  'likes',
  'media',
  'with_replies',
]);

const EXACT_HANDLE_PATTERN = /^@([a-z0-9_]{1,15})$/i;
const ANY_HANDLE_PATTERN = /(?:^|\s)@([a-z0-9_]{1,15})(?:\b|$)/i;
const TWEET_IDENTITY_SELECTOR = '[data-testid="User-Name"], [data-testid="UserName"]';
const TWEET_EXCLUDED_SELECTOR = [
  '[data-testid="socialContext"]',
  '[data-testid="tweetText"]',
  '[data-testid="quoteTweet"]',
  '[data-testid="card.wrapper"]',
  '[data-testid="tweetPhoto"]',
  '[data-testid="videoPlayer"]',
  '[data-testid="HoverCard"]',
  '[role="link"]:not(a)',
  '[role="menu"]',
  '[role="dialog"]',
].join(', ');

function safeNormalizeHandle(value: string): string | null {
  try {
    return normalizeHandle(value);
  } catch {
    return null;
  }
}

function routeHandle(url: URL): string | null {
  const segments = url.pathname.split('/').filter(Boolean);
  const firstSegment = segments[0];

  if (!firstSegment || RESERVED_ROUTES.has(firstSegment.toLowerCase())) {
    return null;
  }

  const subroute = segments[1]?.toLowerCase() ?? '';
  if (segments.length > 2 || !PROFILE_SUBROUTES.has(subroute)) {
    return null;
  }

  return safeNormalizeHandle(firstSegment);
}

function handleFromExactText(element: Element): string | null {
  const text = element.textContent?.trim() ?? '';
  const match = EXACT_HANDLE_PATTERN.exec(text);
  return match?.[1] ? safeNormalizeHandle(match[1]) : null;
}

function linkReferencesHandle(link: HTMLAnchorElement, handle: string): boolean {
  try {
    const url = new URL(link.getAttribute('href') ?? '', 'https://x.com');
    const firstSegment = url.pathname.split('/').filter(Boolean)[0];
    return firstSegment ? safeNormalizeHandle(firstSegment) === handle : false;
  } catch {
    return false;
  }
}

function identityText(element: Element): string {
  let text = '';

  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? '';
    } else if (node instanceof HTMLImageElement) {
      text += node.alt;
    } else if (node instanceof Element) {
      text += identityText(node);
    }
  }

  return text;
}

export function extractDisplayNameFromElement(
  element: Element,
  handle: string,
): string | null {
  const normalizedHandle = safeNormalizeHandle(handle);
  if (!normalizedHandle) {
    return null;
  }

  const links = element.querySelectorAll<HTMLAnchorElement>('a[href]');
  for (const link of links) {
    if (
      !linkReferencesHandle(link, normalizedHandle) ||
      handleFromExactText(link) === normalizedHandle
    ) {
      continue;
    }

    try {
      return normalizeDisplayName(identityText(link));
    } catch {
      // Continue looking for another name link in the identity block.
    }
  }

  const identityElements = element.querySelectorAll<HTMLElement>('div, span');
  for (const handleElement of identityElements) {
    if (handleFromExactText(handleElement) !== normalizedHandle) {
      continue;
    }

    const nameElement = handleElement.previousElementSibling;
    if (!nameElement) {
      continue;
    }

    try {
      return normalizeDisplayName(identityText(nameElement));
    } catch {
      // Continue looking for another handle/name sibling pair.
    }
  }

  return null;
}

export function extractHandleFromElement(element: Element): string | null {
  const links = element.querySelectorAll<HTMLAnchorElement>('a[href]');

  for (const link of links) {
    const exactHandle = handleFromExactText(link);
    if (exactHandle) {
      return exactHandle;
    }
  }

  const textElements = element.querySelectorAll<HTMLElement>('span, div');
  for (const textElement of textElements) {
    const nestedHandle = handleFromExactText(textElement);
    if (nestedHandle) {
      return nestedHandle;
    }
  }

  const exactHandle = handleFromExactText(element);
  if (exactHandle) {
    return exactHandle;
  }

  const match = ANY_HANDLE_PATTERN.exec(element.textContent ?? '');
  return match?.[1] ? safeNormalizeHandle(match[1]) : null;
}

function findProfileTarget(root: ParentNode, url: URL): XNoteSurfaceTarget | null {
  const expectedHandle = routeHandle(url);
  if (!expectedHandle) {
    return null;
  }

  const primaryColumn = root.querySelector<HTMLElement>('[data-testid="primaryColumn"]');
  const scope = primaryColumn ?? root.querySelector<HTMLElement>('main[role="main"]');
  if (!scope) {
    return null;
  }

  const userName = Array.from(scope.querySelectorAll<HTMLElement>('[data-testid="UserName"]'))
    .find((candidate) => !candidate.closest('article, [data-testid="HoverCard"]'));
  if (!userName) {
    return null;
  }

  const visibleHandle = extractHandleFromElement(userName);
  if (visibleHandle !== expectedHandle) {
    return null;
  }

  return {
    anchor: userName,
    handle: expectedHandle,
    displayName: extractDisplayNameFromElement(userName, expectedHandle),
    surface: 'profile',
  };
}

function findHoverCardTargets(root: ParentNode): XNoteSurfaceTarget[] {
  const targets: XNoteSurfaceTarget[] = [];
  const cards = root.querySelectorAll<HTMLElement>('[data-testid="HoverCard"]');

  for (const card of cards) {
    const handle = extractHandleFromElement(card);
    if (!handle) {
      continue;
    }

    const userName = card.querySelector<HTMLElement>('[data-testid="UserName"]');
    const exactHandleLink = Array.from(card.querySelectorAll<HTMLAnchorElement>('a[href]')).find(
      (link) => handleFromExactText(link) === handle,
    );
    const anchor = userName ?? exactHandleLink?.parentElement;

    if (!anchor) {
      continue;
    }

    targets.push({
      anchor,
      handle,
      displayName: extractDisplayNameFromElement(card, handle),
      surface: 'hover-card',
    });
  }

  return targets;
}

function belongsToTweetHeader(element: Element, article: HTMLElement): boolean {
  if (element.closest('article') !== article) {
    return false;
  }

  for (
    let cursor: Element | null = element;
    cursor && cursor !== article;
    cursor = cursor.parentElement
  ) {
    if (
      cursor.matches(TWEET_EXCLUDED_SELECTOR) ||
      cursor.hasAttribute('hidden') ||
      cursor.getAttribute('aria-hidden') === 'true'
    ) {
      return false;
    }
  }

  return true;
}

function tweetLinkHandle(link: HTMLAnchorElement, kind: 'profile' | 'status'): string | null {
  try {
    const url = new URL(link.getAttribute('href') ?? '', 'https://x.com');
    if (url.protocol !== 'https:' || !['x.com', 'twitter.com'].includes(url.hostname)) {
      return null;
    }

    const pattern = kind === 'profile'
      ? /^\/([a-z0-9_]{1,15})\/?$/i
      : /^\/([a-z0-9_]{1,15})\/status\/\d+\/?$/i;
    const handle = pattern.exec(url.pathname)?.[1];
    return handle && !RESERVED_ROUTES.has(handle.toLowerCase())
      ? safeNormalizeHandle(handle)
      : null;
  } catch {
    return null;
  }
}

function findTweetTargets(root: ParentNode): XNoteSurfaceTarget[] {
  const targets: XNoteSurfaceTarget[] = [];

  for (const article of root.querySelectorAll<HTMLElement>('article[data-testid="tweet"]')) {
    if (article.parentElement?.closest('article')) {
      continue;
    }

    const identity = Array.from(article.querySelectorAll<HTMLElement>(TWEET_IDENTITY_SELECTOR))
      .find((candidate) => belongsToTweetHeader(candidate, article));
    if (!identity) {
      continue;
    }

    const profileLinks = Array.from(identity.querySelectorAll<HTMLAnchorElement>('a[href]'))
      .filter((link) =>
        belongsToTweetHeader(link, article) &&
        link.closest(TWEET_IDENTITY_SELECTOR) === identity &&
        tweetLinkHandle(link, 'profile') !== null,
      );
    const authorLink = profileLinks[0];
    const handle = authorLink ? tweetLinkHandle(authorLink, 'profile') : null;
    if (!handle) {
      continue;
    }

    const nameLink = profileLinks.find((link) =>
      tweetLinkHandle(link, 'profile') === handle && handleFromExactText(link) !== handle,
    );
    let displayName: string | null = null;
    if (nameLink) {
      try {
        displayName = normalizeDisplayName(identityText(nameLink));
      } catch {
        // An unreadable display name does not invalidate the canonical author handle.
      }
    }

    // A detail tweet can omit the inline time. Do not fall back to a quoted author.
    for (const time of identity.querySelectorAll('time')) {
      const anchor = time.closest('a[href]');
      if (
        !(anchor instanceof HTMLAnchorElement) ||
        !identity.contains(anchor) ||
        time.closest(TWEET_IDENTITY_SELECTOR) !== identity ||
        !belongsToTweetHeader(time, article) ||
        tweetLinkHandle(anchor, 'status') !== handle
      ) {
        continue;
      }

      targets.push({
        anchor,
        handle,
        displayName,
        surface: 'tweet',
      });
      break;
    }
  }

  return targets;
}

export function findXNoteSurfaceTargets(
  root: ParentNode = document,
  url: URL = new URL(window.location.href),
): XNoteSurfaceTarget[] {
  const targets = [...findHoverCardTargets(root), ...findTweetTargets(root)];
  const profileTarget = findProfileTarget(root, url);

  if (profileTarget) {
    targets.unshift(profileTarget);
  }

  return targets;
}
