import repostPlaceholderStyles from '../../../entrypoints/twitter.content/repost-placeholder.css?inline';
import {
  DEFAULT_LIST_REPOST_PREFERENCES,
  type HiddenRepostDisplayMode,
  type ListRepostPreferenceChange,
  type ListRepostPreferenceRepository,
  type ListRepostPreferences,
} from '../../features/list-reposts/list-repost-preference';
import { isDarkXPage } from './theme';

export type XRepostTimelineSurface = 'home' | 'list' | 'profile';
export type XRepostTimelineControlPlacement = 'append' | 'before';

export interface XRepostTimelineTarget {
  controlAnchor: HTMLElement | null;
  controlPlacement: XRepostTimelineControlPlacement;
  timeline: HTMLElement;
  routeKey: string;
  surface: XRepostTimelineSurface;
}

export interface MountedXRepostTimelineControl {
  updateAppearance(): void;
  isConnected?(): boolean;
  destroy(): void;
}

export type MountXRepostTimelineControl = (
  target: XRepostTimelineTarget,
) => MountedXRepostTimelineControl | null;

interface InlineDisplayState {
  value: string;
  priority: string;
}

interface HiddenArticleState extends InlineDisplayState {
  mode: HiddenRepostDisplayMode;
  placeholderHost: HTMLElement | null;
}

const LIST_ROUTE_PATTERNS = [
  /^\/i\/lists\/(\d+)\/?$/,
  /^\/[a-z0-9_]+\/lists\/(\d+)\/?$/i,
  /^\/i\/user\/\d+\/list\/(\d+)\/?$/,
];

const PROFILE_HANDLE_PATTERN = /^[a-z0-9_]{1,15}$/i;

export function getXListId(url: URL): string | null {
  for (const pattern of LIST_ROUTE_PATTERNS) {
    const match = pattern.exec(url.pathname);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function linkTargetsListSubroute(
  link: HTMLAnchorElement,
  listId: string,
  subroute: 'members' | 'followers',
): boolean {
  try {
    const pathname = new URL(link.getAttribute('href') ?? '', 'https://x.com').pathname;
    return (
      pathname.endsWith(`/lists/${listId}/${subroute}`) ||
      pathname.endsWith(`/list/${listId}/${subroute}`)
    );
  } catch {
    return false;
  }
}

function lowestCommonAncestor(
  left: HTMLElement,
  right: HTMLElement,
): HTMLElement | null {
  const rightAncestors = new Set<HTMLElement>();
  let cursor: HTMLElement | null = right;
  while (cursor) {
    rightAncestors.add(cursor);
    cursor = cursor.parentElement;
  }

  cursor = left;
  while (cursor) {
    if (rightAncestors.has(cursor)) {
      return cursor;
    }
    cursor = cursor.parentElement;
  }

  return null;
}

function findXListHeaderControlAnchor(
  primaryColumn: HTMLElement,
  listId: string,
): HTMLElement | null {
  const links = Array.from(primaryColumn.querySelectorAll<HTMLAnchorElement>('a[href]'));
  const membersLink = links.find((link) =>
    linkTargetsListSubroute(link, listId, 'members'),
  );
  const followersLink = links.find((link) =>
    linkTargetsListSubroute(link, listId, 'followers'),
  );
  if (!membersLink || !followersLink) {
    return null;
  }

  return lowestCommonAncestor(membersLink, followersLink)?.parentElement ?? null;
}

interface XRepostTimelineRoute {
  key: string;
  profileHandle?: string;
  surface: XRepostTimelineSurface;
}

function getXRepostTimelineRoute(url: URL): XRepostTimelineRoute | null {
  if (/^\/home\/?$/i.test(url.pathname)) {
    return { key: 'home', surface: 'home' };
  }

  const listId = getXListId(url);
  if (listId) {
    return { key: `list:${listId}`, surface: 'list' };
  }

  const segments = url.pathname.split('/').filter(Boolean);
  const profileHandle = segments.length === 1 ? segments[0] : undefined;
  if (profileHandle && PROFILE_HANDLE_PATTERN.test(profileHandle)) {
    return {
      key: `profile:${profileHandle.toLowerCase()}`,
      profileHandle,
      surface: 'profile',
    };
  }

  return null;
}

function profileIdentityMatches(
  primaryColumn: HTMLElement,
  expectedHandle: string,
): boolean {
  const userName = primaryColumn.querySelector<HTMLElement>(
    '[data-testid="UserName"]',
  );
  if (!userName || userName.closest('[data-testid="HoverCard"]')) {
    return false;
  }

  const normalizedHandle = `@${expectedHandle.toLowerCase()}`;
  return Array.from(userName.querySelectorAll<HTMLElement>('a, div, span')).some(
    (element) => element.textContent?.trim().toLowerCase() === normalizedHandle,
  );
}

export function findXRepostTimelineTarget(
  root: ParentNode = document,
  url: URL = new URL(window.location.href),
): XRepostTimelineTarget | null {
  const route = getXRepostTimelineRoute(url);
  if (!route) {
    return null;
  }

  const primaryColumn = root.querySelector<HTMLElement>('[data-testid="primaryColumn"]');
  if (!primaryColumn) {
    return null;
  }

  if (
    route.surface === 'profile' &&
    (!route.profileHandle || !profileIdentityMatches(primaryColumn, route.profileHandle))
  ) {
    return null;
  }

  const article = primaryColumn.querySelector<HTMLElement>('article');
  const articleCell = article?.closest<HTMLElement>('[data-testid="cellInnerDiv"]');
  const timeline = articleCell?.parentElement;

  if (!articleCell || !timeline) {
    return null;
  }

  const listId = route.surface === 'list' ? getXListId(url) : null;
  const timelineRegion = timeline.closest<HTMLElement>('[role="region"]');
  const controlAnchor = listId
    ? findXListHeaderControlAnchor(primaryColumn, listId)
    : timelineRegion;
  const controlPlacement: XRepostTimelineControlPlacement = listId
    ? 'append'
    : 'before';

  return {
    controlAnchor,
    controlPlacement,
    timeline,
    routeKey: route.key,
    surface: route.surface,
  };
}

export function isPlainRepostArticle(article: HTMLElement): boolean {
  if (!article.matches('article')) {
    return false;
  }

  const socialContext = article
    .querySelector('[data-testid="socialContext"]')
    ?.textContent?.trim();
  return socialContext
    ? /(?:\bReposted\b|(?:已)?转(?:帖|贴)(?:了)?)/iu.test(socialContext)
    : false;
}

class PlainRepostVisibilityController {
  private readonly hiddenArticles = new Map<HTMLElement, HiddenArticleState>();
  private readonly expandedTweetIds = new Set<string>();
  private expandedArticles = new WeakSet<HTMLElement>();

  sync(timeline: HTMLElement, preferences: ListRepostPreferences): void {
    for (const article of [...this.hiddenArticles.keys()]) {
      if (
        preferences.showReposts ||
        !article.isConnected ||
        !timeline.contains(article) ||
        !isPlainRepostArticle(article) ||
        this.isTemporarilyExpanded(article)
      ) {
        this.restore(article);
      }
    }

    if (preferences.showReposts) {
      return;
    }

    for (const article of timeline.querySelectorAll<HTMLElement>('article')) {
      if (
        !isPlainRepostArticle(article) ||
        this.isTemporarilyExpanded(article)
      ) {
        continue;
      }

      this.hide(article, preferences.hiddenRepostDisplayMode);
    }
  }

  restoreAll(): void {
    for (const article of [...this.hiddenArticles.keys()]) {
      this.restore(article);
    }
  }

  resetSession(): void {
    this.restoreAll();
    this.expandedTweetIds.clear();
    this.expandedArticles = new WeakSet<HTMLElement>();
  }

  private hide(article: HTMLElement, mode: HiddenRepostDisplayMode): void {
    let state = this.hiddenArticles.get(article);
    if (!state) {
      state = {
        value: article.style.getPropertyValue('display'),
        priority: article.style.getPropertyPriority('display'),
        mode,
        placeholderHost: null,
      };
      this.hiddenArticles.set(article, state);
    }

    if (state.mode !== mode) {
      state.placeholderHost?.remove();
      state.placeholderHost = null;
      state.mode = mode;
    }

    if (mode !== 'hidden' && !state.placeholderHost) {
      state.placeholderHost = this.createPlaceholder(article, mode);
    }
    if (state.placeholderHost) {
      state.placeholderHost.dataset.teTheme = isDarkXPage() ? 'dark' : 'light';
      this.updatePlaceholderLabel(state.placeholderHost, article);
    }

    article.dataset.twitterEnhancementHiddenPlainRepost = mode;
    article.style.setProperty('display', 'none', 'important');
  }

  private createPlaceholder(
    article: HTMLElement,
    mode: Exclude<HiddenRepostDisplayMode, 'hidden'>,
  ): HTMLElement | null {
    if (!article.parentElement) {
      return null;
    }

    const label = getPlainRepostLabel(article);
    const host = document.createElement('div');
    host.dataset.twitterEnhancementRepostPlaceholder = mode;
    host.dataset.teTheme = isDarkXPage() ? 'dark' : 'light';
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = repostPlaceholderStyles;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `te-repost-placeholder te-repost-placeholder--${
      mode === 'divider' ? 'divider' : 'context'
    }`;
    button.setAttribute('aria-label', label);
    button.title = '点击可还原';

    const content = document.createElement('span');
    content.className = 'te-repost-placeholder__content';
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('class', 'te-repost-placeholder__icon');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('aria-hidden', 'true');
    const iconPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    iconPath.setAttribute(
      'd',
      'M4.75 3.79 9.353 8.09 8.33 9.186 5.5 6.546V15A2.5 2.5 0 0 0 8 17.5h3V19H8a4 4 0 0 1-4-4V6.546L1.169 9.186.147 8.09 4.75 3.79Zm14.5 16.42-4.603-4.3 1.022-1.096 2.831 2.64V9A2.5 2.5 0 0 0 16 6.5h-3V5h3a4 4 0 0 1 4 4v8.454l2.831-2.64 1.022 1.096-4.603 4.3Z',
    );
    icon.append(iconPath);
    const labelElement = document.createElement('span');
    labelElement.className = 'te-repost-placeholder__label';
    labelElement.textContent = label;
    content.append(icon, labelElement);
    button.append(content);
    shadowRoot.append(style, button);

    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.rememberTemporaryExpansion(article);
      this.restore(article);
    });

    article.insertAdjacentElement('beforebegin', host);
    return host;
  }

  private updatePlaceholderLabel(host: HTMLElement, article: HTMLElement): void {
    const label = getPlainRepostLabel(article);
    const button = host.shadowRoot?.querySelector<HTMLButtonElement>('button');
    const labelElement = host.shadowRoot?.querySelector<HTMLElement>(
      '.te-repost-placeholder__label',
    );
    if (button) {
      button.setAttribute('aria-label', label);
    }
    if (labelElement) {
      labelElement.textContent = label;
    }
  }

  private rememberTemporaryExpansion(article: HTMLElement): void {
    const tweetId = extractTweetId(article);
    if (tweetId) {
      this.expandedTweetIds.add(tweetId);
    } else {
      this.expandedArticles.add(article);
    }
  }

  private isTemporarilyExpanded(article: HTMLElement): boolean {
    const tweetId = extractTweetId(article);
    return tweetId
      ? this.expandedTweetIds.has(tweetId)
      : this.expandedArticles.has(article);
  }

  private restore(article: HTMLElement): void {
    const previous = this.hiddenArticles.get(article);
    if (!previous) {
      return;
    }

    previous.placeholderHost?.remove();
    article.style.removeProperty('display');
    if (previous.value) {
      article.style.setProperty('display', previous.value, previous.priority);
    }
    delete article.dataset.twitterEnhancementHiddenPlainRepost;
    this.hiddenArticles.delete(article);
  }
}

function getPlainRepostLabel(article: HTMLElement): string {
  const socialContext = article
    .querySelector('[data-testid="socialContext"]')
    ?.textContent?.trim();
  const source = socialContext
    ?.replace(/\s*(?:Reposted|(?:已)?转(?:帖|贴)(?:了)?)\s*$/iu, '')
    .trim() || '某用户';
  return `一条来自 ${source} 的转贴已被收起，点击可还原`;
}

function extractTweetId(article: HTMLElement): string | null {
  for (const link of article.querySelectorAll<HTMLAnchorElement>('a[href*="/status/"]')) {
    try {
      const match = new URL(link.getAttribute('href') ?? '', 'https://x.com').pathname.match(
        /^\/[a-z0-9_]+\/status\/(\d+)/i,
      );
      if (match?.[1]) {
        return match[1];
      }
    } catch {
      // Keep looking for another canonical status link.
    }
  }
  return null;
}

export interface XRepostTimelineManager {
  sync(root?: ParentNode, url?: URL): void;
  destroy(): void;
}

export function createXRepostTimelineManager(
  mount: MountXRepostTimelineControl,
  repository: ListRepostPreferenceRepository,
): XRepostTimelineManager {
  const visibility = new PlainRepostVisibilityController();
  let currentTimeline: HTMLElement | null = null;
  let currentRouteKey: string | null = null;
  let mounted: MountedXRepostTimelineControl | null = null;
  let preferences: ListRepostPreferences = {
    ...DEFAULT_LIST_REPOST_PREFERENCES,
  };
  let destroyed = false;
  let preferenceRevision = 0;

  const applyPreference = (change: ListRepostPreferenceChange) => {
    preferences = { ...preferences, ...change };
    if (currentTimeline) {
      visibility.sync(currentTimeline, preferences);
    }
  };

  const unsubscribe = repository.subscribe((change) => {
    preferenceRevision += 1;
    applyPreference(change);
  });
  const loadRevision = preferenceRevision;
  void repository
    .getPreferences()
    .then((storedPreferences) => {
      if (!destroyed && preferenceRevision === loadRevision) {
        applyPreference(storedPreferences);
      }
    })
    .catch(() => {
      // Keep the privacy-oriented default when storage is temporarily unavailable.
    });

  function sync(
    root: ParentNode = document,
    url: URL = new URL(window.location.href),
  ) {
    const route = getXRepostTimelineRoute(url);
    if (!route) {
      mounted?.destroy();
      mounted = null;
      currentTimeline = null;
      currentRouteKey = null;
      visibility.resetSession();
      return;
    }

    if (currentRouteKey !== null && currentRouteKey !== route.key) {
      mounted?.destroy();
      mounted = null;
      currentTimeline = null;
      visibility.resetSession();
    }
    currentRouteKey = route.key;

    const target = findXRepostTimelineTarget(root, url);
    if (target) {
      const timelineChanged =
        currentTimeline !== null && currentTimeline !== target.timeline;
      if (timelineChanged) {
        mounted?.destroy();
        mounted = null;
        visibility.resetSession();
      }

      if (mounted?.isConnected?.() === false) {
        mounted?.destroy();
        mounted = null;
      }

      if (!mounted && target.controlAnchor) {
        mounted = mount(target);
      } else if (mounted) {
        mounted.updateAppearance();
      }

      currentTimeline = target.timeline;
      visibility.sync(target.timeline, preferences);
      return;
    }

    if (mounted?.isConnected?.() === false) {
      mounted?.destroy();
      mounted = null;
    }

    if (currentTimeline && !currentTimeline.isConnected) {
      currentTimeline = null;
      visibility.restoreAll();
    }

    if (currentTimeline) {
      visibility.sync(currentTimeline, preferences);
    }
  }

  function destroy() {
    destroyed = true;
    unsubscribe();
    mounted?.destroy();
    mounted = null;
    currentTimeline = null;
    currentRouteKey = null;
    visibility.resetSession();
  }

  return { sync, destroy };
}
