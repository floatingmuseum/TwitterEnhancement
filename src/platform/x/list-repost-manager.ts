import repostPlaceholderStyles from '../../../entrypoints/twitter.content/repost-placeholder.css?inline';
import {
  DEFAULT_LIST_REPOST_PREFERENCES,
  type HiddenRepostDisplayMode,
  type ListRepostPreferenceChange,
  type ListRepostPreferenceRepository,
  type ListRepostPreferences,
} from '../../features/list-reposts/list-repost-preference';
import { isDarkXPage } from './theme';

export interface XListRepostTarget {
  anchor: HTMLElement;
  timeline: HTMLElement;
}

export interface MountedXListRepostControl {
  updateAppearance(): void;
  destroy(): void;
}

export type MountXListRepostControl = (
  target: XListRepostTarget,
) => MountedXListRepostControl;

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

export function findXListRepostTarget(
  root: ParentNode = document,
  url: URL = new URL(window.location.href),
): XListRepostTarget | null {
  const listId = getXListId(url);
  if (!listId) {
    return null;
  }

  const primaryColumn = root.querySelector<HTMLElement>('[data-testid="primaryColumn"]');
  if (!primaryColumn) {
    return null;
  }

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

  const statsRow = lowestCommonAncestor(membersLink, followersLink);
  const anchor = statsRow?.parentElement;
  const headerCell = anchor?.closest<HTMLElement>('[data-testid="cellInnerDiv"]');
  const timeline = headerCell?.parentElement;

  if (!anchor || !headerCell || !timeline || headerCell.querySelector('article')) {
    return null;
  }

  return { anchor, timeline };
}

export function findXListTimeline(root: ParentNode = document): HTMLElement | null {
  const primaryColumn = root.querySelector<HTMLElement>('[data-testid="primaryColumn"]');
  const article = primaryColumn?.querySelector<HTMLElement>('article');
  const articleCell = article?.closest<HTMLElement>('[data-testid="cellInnerDiv"]');
  return articleCell?.parentElement ?? null;
}

export function isPlainRepostArticle(article: HTMLElement): boolean {
  return article.matches('article') &&
    article.querySelector('[data-testid="socialContext"]') !== null;
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
    ?.replace(/\s*已(?:转帖|转贴)\s*$/u, '')
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

export interface XListRepostManager {
  sync(root?: ParentNode, url?: URL): void;
  destroy(): void;
}

export function createXListRepostManager(
  mount: MountXListRepostControl,
  repository: ListRepostPreferenceRepository,
): XListRepostManager {
  const visibility = new PlainRepostVisibilityController();
  let currentTarget: XListRepostTarget | null = null;
  let currentTimeline: HTMLElement | null = null;
  let currentListId: string | null = null;
  let mounted: MountedXListRepostControl | null = null;
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
    const listId = getXListId(url);
    if (!listId) {
      mounted?.destroy();
      mounted = null;
      currentTarget = null;
      currentTimeline = null;
      currentListId = null;
      visibility.resetSession();
      return;
    }

    if (currentListId !== null && currentListId !== listId) {
      mounted?.destroy();
      mounted = null;
      currentTarget = null;
      currentTimeline = null;
      visibility.resetSession();
    }
    currentListId = listId;

    const target = findXListRepostTarget(root, url);
    if (target) {
      if (currentTarget?.anchor !== target.anchor || !mounted) {
        mounted?.destroy();
        mounted = mount(target);
      } else {
        mounted.updateAppearance();
      }

      currentTarget = target;
      currentTimeline = target.timeline;
      visibility.sync(target.timeline, preferences);
      return;
    }

    if (currentTarget && !currentTarget.anchor.isConnected) {
      mounted?.destroy();
      mounted = null;
      currentTarget = null;
    }

    if (currentTimeline && !currentTimeline.isConnected) {
      currentTimeline = null;
      visibility.restoreAll();
    }

    currentTimeline ??= findXListTimeline(root);
    if (currentTimeline) {
      visibility.sync(currentTimeline, preferences);
    }
  }

  function destroy() {
    destroyed = true;
    unsubscribe();
    mounted?.destroy();
    mounted = null;
    currentTarget = null;
    currentTimeline = null;
    currentListId = null;
    visibility.resetSession();
  }

  return { sync, destroy };
}
