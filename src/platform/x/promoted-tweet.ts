const PROMOTED_MARKER_SELECTOR = '[data-testid="promotedIndicator"]';
const IDENTITY_SELECTOR = '[data-testid="User-Name"], [data-testid="UserName"], [data-anchor-to-hovered-child]';
const CONTENT_SELECTOR = [
  '[data-testid="tweetText"]',
  '[data-testid="card.wrapper"]',
  '[data-testid="quoteTweet"]',
  '[data-slot="embedded-tweet-frame"]',
  '[data-testid="tweetPhoto"]',
  '[data-testid="videoPlayer"]',
].join(', ');
const EXCLUDED_SELECTOR = [
  CONTENT_SELECTOR,
  '[role="link"]',
  '[role="menu"]',
  '[role="menuitem"]',
  '[role="dialog"]',
  '[data-testid="HoverCard"]',
].join(', ');
const AD_LABEL_PATTERN = /^(?:广告|廣告|已推广|已推廣|Ad|Promoted)$/iu;

function belongsToArticle(element: Element, article: HTMLElement): boolean {
  if (element.closest('article') !== article) {
    return false;
  }

  for (
    let cursor: Element | null = element;
    cursor && cursor !== article;
    cursor = cursor.parentElement
  ) {
    if (
      cursor.matches(EXCLUDED_SELECTOR) ||
      cursor.hasAttribute('hidden') ||
      cursor.getAttribute('aria-hidden') === 'true'
    ) {
      return false;
    }
  }

  return true;
}

function isLabelCandidate(element: HTMLElement, article: HTMLElement): boolean {
  return (
    belongsToArticle(element, article) &&
    !element.closest(`${IDENTITY_SELECTOR}, [data-testid="caret"]`)
  );
}

function hasTrackedMediaCard(article: HTMLElement): boolean {
  // X attaches the click ID to the card's own footer, including a video CTA.
  // A pasted tracking link or a quote belongs to a different surface.
  for (const footer of article.querySelectorAll<HTMLAnchorElement>('a[target="_blank"][href*="twclid="]')) {
    const media = footer.previousElementSibling;
    if (!media || !belongsToArticle(footer, article) ||
        !/^https?:$/.test(footer.protocol) || !new URLSearchParams(footer.search).get('twclid')) continue;

    if (media instanceof HTMLAnchorElement && media.target === '_blank' &&
        media.href === footer.href && media.querySelector(':scope > [style*="aspect-ratio"]')) return true;

    if (media.matches('[style*="aspect-ratio"]') &&
        media.querySelector('video, [data-press-control], img[src*="_video_thumb/"]')) return true;
  }
  return false;
}

function hasPromotedBannerBefore(header: HTMLElement, article: HTMLElement): boolean {
  for (
    let body: HTMLElement | null = header;
    body && body !== article;
    body = body.parentElement
  ) {
    const banner = body.previousElementSibling;
    if (
      !(banner instanceof HTMLElement) ||
      !isLabelCandidate(banner, article) ||
      !AD_LABEL_PATTERN.test(banner.textContent?.trim() ?? '') ||
      banner.matches('a, button') ||
      banner.querySelector(
        `${EXCLUDED_SELECTOR}, ${IDENTITY_SELECTOR}, [data-testid="caret"], article, a, button`,
      )
    ) {
      continue;
    }

    // The live promoted banner is a standalone sibling before the tweet body.
    // Trust its label only when it is visible and has no embedded content.
    const candidates = [banner, ...banner.querySelectorAll<HTMLElement>('span, div')];
    if (candidates.some((candidate) =>
      candidate.children.length === 0 &&
      isLabelCandidate(candidate, article) &&
      AD_LABEL_PATTERN.test(candidate.textContent?.trim() ?? ''),
    )) {
      return true;
    }
  }

  return false;
}

/**
 * Text alone is only trusted in the tweet's identity / more-button header,
 * or in a standalone promoted banner immediately before its body container.
 * These structural fallbacks intentionally skip unknown layouts instead of
 * treating a mention of advertising in tweet or quoted content as an ad.
 */
export function isPromotedTweetArticle(article: HTMLElement): boolean {
  if (!article.matches('article')) {
    return false;
  }

  if (
    Array.from(article.querySelectorAll<HTMLElement>(PROMOTED_MARKER_SELECTOR)).some(
      (marker) => isLabelCandidate(marker, article),
    )
  ) {
    return true;
  }

  const identities = Array.from(article.querySelectorAll<HTMLElement>(IDENTITY_SELECTOR))
    .filter((identity) => belongsToArticle(identity, article));

  for (const identity of identities) {
    if (!identity.hasAttribute('data-anchor-to-hovered-child')) continue;
    const row = identity.parentElement;
    const header = row?.parentElement;
    const controls = row?.nextElementSibling;
    if (
      !row || !header || header === article ||
      !controls?.querySelector(':scope > button[data-slot="xds-menu-trigger"]')
    ) continue;
    // Some promoted headers replace the timestamp with a disclosure linking
    // to the advertiser's profile beside the menu.
    const disclosure = controls.querySelector<HTMLAnchorElement>(':scope > a[href]');
    if (
      disclosure && /^\/[a-z0-9_]{1,15}\/?$/i.test(disclosure.getAttribute('href') ?? '') &&
      isLabelCandidate(disclosure, article) &&
      AD_LABEL_PATTERN.test(disclosure.textContent?.trim() ?? '') &&
      Array.from(identity.querySelectorAll<HTMLAnchorElement>('a[href]'))
        .some(link => link.pathname === disclosure.pathname && link.origin === disclosure.origin)
    ) return true;
    if (!identity.nextElementSibling?.querySelector('a[href*="/status/"]')) {
      if (hasTrackedMediaCard(article)) return true;
      continue;
    }
    if (hasPromotedBannerBefore(header, article)) return true;
    for (const part of [row, controls]) {
      for (const label of part.querySelectorAll<HTMLElement>('span, div')) {
        if (
          label.childElementCount === 0 && !label.closest('a, button, [role="button"]') &&
          isLabelCandidate(label, article) && AD_LABEL_PATTERN.test(label.textContent?.trim() ?? '')
        ) return true;
      }
    }
  }

  for (const caret of article.querySelectorAll<HTMLElement>('[data-testid="caret"]')) {
    if (!belongsToArticle(caret, article)) {
      continue;
    }

    let header = caret.parentElement;
    while (
      header &&
      header !== article &&
      !identities.some((identity) => header?.contains(identity))
    ) {
      header = header.parentElement;
    }

    if (header && header !== article && hasPromotedBannerBefore(header, article)) {
      return true;
    }

    // A common ancestor that also includes the tweet body is too broad.
    if (
      !header ||
      header === article ||
      header.querySelector(`${CONTENT_SELECTOR}, article`)
    ) {
      continue;
    }

    for (const candidate of header.querySelectorAll<HTMLElement>('span, div')) {
      if (
        candidate.children.length === 0 &&
        isLabelCandidate(candidate, article) &&
        AD_LABEL_PATTERN.test(candidate.textContent?.trim() ?? '')
      ) {
        return true;
      }
    }
  }

  return false;
}
