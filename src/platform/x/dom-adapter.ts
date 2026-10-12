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
  /** A compact author row; otherwise tweet notes use the whole identity block. */
  inlineContainer?: HTMLElement;
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
const QUOTED_TWEET_SELECTOR = '[data-testid="quoteTweet"], [role="link"]:not(a)';
const TWEET_CONTENT_EXCLUDED_SELECTOR = [
  '[data-testid="socialContext"]',
  '[data-testid="tweetText"]',
  '[data-testid="card.wrapper"]',
  '[data-testid="tweetPhoto"]',
  '[data-testid="videoPlayer"]',
  '[data-testid="HoverCard"]',
  '[role="menu"]',
  '[role="dialog"]',
].join(', ');
const TWEET_EXCLUDED_SELECTOR = `${TWEET_CONTENT_EXCLUDED_SELECTOR}, ${QUOTED_TWEET_SELECTOR}`;

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

function belongsToTweetHeader(element: Element, scope: HTMLElement): boolean {
  if (element.closest('article') !== scope.closest('article')) {
    return false;
  }

  for (
    let cursor: Element | null = element;
    cursor && cursor !== scope;
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

function hasDetailPermalink(article: HTMLElement, handle: string, url: URL): boolean {
  if (!/^\/[a-z0-9_]{1,15}\/status\/\d+\/?$/i.test(url.pathname)) {
    return false;
  }

  const detailPath = url.pathname.replace(/\/$/, '').toLowerCase();
  return Array.from(article.querySelectorAll('time')).some((time) => {
    const link = time.closest('a[href]');
    return link instanceof HTMLAnchorElement &&
      !time.closest(TWEET_IDENTITY_SELECTOR) &&
      belongsToTweetHeader(time, article) &&
      tweetLinkHandle(link, 'status') === handle &&
      new URL(link.getAttribute('href') ?? '', 'https://x.com').pathname.replace(/\/$/, '').toLowerCase() === detailPath;
  });
}

function findTweetIdentityTarget(
  scope: HTMLElement,
  url: URL,
  quoted: boolean,
): XNoteSurfaceTarget | null {
  const identity = Array.from(scope.querySelectorAll<HTMLElement>(TWEET_IDENTITY_SELECTOR))
    .find((candidate) => belongsToTweetHeader(candidate, scope));
  if (!identity) {
    return null;
  }

  const belongsToIdentity = (element: Element) =>
    element.closest(TWEET_IDENTITY_SELECTOR) === identity && belongsToTweetHeader(element, scope);
  const links = Array.from(identity.querySelectorAll<HTMLAnchorElement>('a[href]')).filter(belongsToIdentity);
  const profileLinks = links.filter((link) => tweetLinkHandle(link, 'profile') !== null);
  const handleElements = Array.from(identity.querySelectorAll<HTMLElement>('a, span, div'))
    .filter((element) => belongsToIdentity(element) && handleFromExactText(element) !== null);
  const textHandles = new Set(handleElements.map(handleFromExactText));
  const authorLink = profileLinks[0];
  const textHandleElement = handleElements[0];
  if (!authorLink && links.some((link) => !link.querySelector('time'))) {
    return null;
  }
  // X renders quoted authors as plain text inside a clickable card.
  // Only accept one exact @handle from that card's own identity block.
  const handle = authorLink
    ? tweetLinkHandle(authorLink, 'profile')
    : quoted && textHandles.size === 1 && textHandleElement ? handleFromExactText(textHandleElement) : null;
  if (!handle ||
    profileLinks.some((link) => tweetLinkHandle(link, 'profile') !== handle) ||
    (textHandles.size > 0 && (textHandles.size !== 1 || !textHandles.has(handle)))) {
    return null;
  }

  const nameLink = profileLinks.find((link) => handleFromExactText(link) !== handle);
  let displayName: string | null = null;
  if (nameLink) {
    try {
      displayName = normalizeDisplayName(identityText(nameLink));
    } catch {
      // An unreadable display name does not invalidate the canonical author handle.
    }
  }

  const times = Array.from(identity.querySelectorAll('time')).filter(belongsToIdentity);
  for (const time of times) {
    const link = time.closest('a[href]');
    if (link && (!(link instanceof HTMLAnchorElement) || !identity.contains(link) || tweetLinkHandle(link, 'status') !== handle)) {
      continue;
    }
    if (!link && !quoted) {
      continue;
    }
    return {
      anchor: link instanceof HTMLAnchorElement ? link : time,
      handle,
      displayName,
      surface: 'tweet',
      ...(quoted ? { inlineContainer: identity } : {}),
    };
  }

  // Only the main detail tweet may fall back to its handle. Require its own
  // footer permalink, so an incomplete reply or a quoted timestamp cannot qualify.
  const handleElement = profileLinks.find((link) => handleFromExactText(link) === handle) ?? handleElements[0];
  if (quoted || times.length > 0 || !handleElement || !hasDetailPermalink(scope, handle, url)) {
    return null;
  }
  let handleRow = handleElement;
  while (handleRow.parentElement && handleRow.parentElement !== identity) {
    handleRow = handleRow.parentElement;
  }
  return {
    anchor: handleElement,
    handle,
    displayName,
    surface: 'tweet',
    inlineContainer: handleRow === handleElement ? identity : handleRow,
  };
}

function isQuotedTweetScope(scope: HTMLElement, article: HTMLElement): boolean {
  if (scope.closest('article') !== article) {
    return false;
  }
  for (let cursor: Element | null = scope; cursor && cursor !== article; cursor = cursor.parentElement) {
    if (cursor.matches(TWEET_CONTENT_EXCLUDED_SELECTOR) ||
      cursor.hasAttribute('hidden') || cursor.getAttribute('aria-hidden') === 'true') {
      return false;
    }
  }
  return true;
}

function findTweetTargets(root: ParentNode, url: URL): XNoteSurfaceTarget[] {
  const targets: XNoteSurfaceTarget[] = [];
  for (const article of root.querySelectorAll<HTMLElement>('article[data-testid="tweet"]')) {
    if (article.parentElement?.closest('article')) {
      continue;
    }
    const mainTarget = findTweetIdentityTarget(article, url, false);
    if (mainTarget) {
      targets.push(mainTarget);
    }
    for (const quote of article.querySelectorAll<HTMLElement>(QUOTED_TWEET_SELECTOR)) {
      if (!isQuotedTweetScope(quote, article)) {
        continue;
      }
      const quotedTarget = findTweetIdentityTarget(quote, url, true);
      if (quotedTarget) {
        targets.push(quotedTarget);
      }
    }
  }

  return targets;
}

export function findXNoteSurfaceTargets(
  root: ParentNode = document,
  url: URL = new URL(window.location.href),
): XNoteSurfaceTarget[] {
  const targets = [...findHoverCardTargets(root), ...findTweetTargets(root, url)];
  const profileTarget = findProfileTarget(root, url);

  if (profileTarget) {
    targets.unshift(profileTarget);
  }

  return targets;
}
