import {
  normalizeDisplayName,
  normalizeHandle,
} from '../../features/user-notes/note-model';
import type { NoteSurface } from '../../features/user-notes/UserNote';

export interface XNoteSurfaceTarget {
  anchor: HTMLElement;
  handle: string;
  displayName: string | null;
  surface: NoteSurface;
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

  const userName = scope.querySelector<HTMLElement>('[data-testid="UserName"]');
  if (!userName || userName.closest('[data-testid="HoverCard"]')) {
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

export function findXNoteSurfaceTargets(
  root: ParentNode = document,
  url: URL = new URL(window.location.href),
): XNoteSurfaceTarget[] {
  const targets = findHoverCardTargets(root);
  const profileTarget = findProfileTarget(root, url);

  if (profileTarget) {
    targets.unshift(profileTarget);
  }

  return targets;
}
