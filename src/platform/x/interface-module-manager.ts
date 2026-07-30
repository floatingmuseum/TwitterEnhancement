import type {
  InterfaceModuleKey,
  InterfaceModuleVisibility,
  InterfaceModuleVisibilityChange,
  InterfaceModuleVisibilityRepository,
} from '../../features/interface-modules/interface-module-visibility';
import { DEFAULT_INTERFACE_MODULE_VISIBILITY } from '../../features/interface-modules/interface-module-visibility';

export interface XInterfaceModuleTarget {
  element: HTMLElement;
  module: InterfaceModuleKey;
}

interface HiddenModuleState {
  module: InterfaceModuleKey;
  displayValue: string;
  displayPriority: string;
}

const FOLLOW_HEADING_PATTERN =
  /(?:who to follow|关注推荐|推荐关注|おすすめ(?:の)?ユーザー)/iu;
const TREND_HEADING_PATTERN =
  /(?:what'?s happening|trending now|有什么新鲜事|正在发生|趋势|トレンド)/iu;
const PREMIUM_HEADING_PATTERN =
  /(?:subscribe\s+(?:to\s+)?premium|订阅\s*premium|premium\s*订阅)/iu;

function linkPath(link: HTMLAnchorElement): string | null {
  try {
    return new URL(link.getAttribute('href') ?? '', 'https://x.com').pathname;
  } catch {
    return null;
  }
}

function findLinkByPath(root: ParentNode, path: string): HTMLAnchorElement | null {
  for (const link of root.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    if (linkPath(link) === path) {
      return link;
    }
  }
  return null;
}

function headingText(element: Element): string {
  return Array.from(
    element.querySelectorAll<HTMLElement>('h1, h2, h3, [role="heading"]'),
  )
    .map((heading) => heading.textContent?.trim() ?? '')
    .join(' ');
}

function hasCardBoundary(element: HTMLElement): boolean {
  const view = element.ownerDocument.defaultView;
  if (!view) {
    return false;
  }

  const style = view.getComputedStyle(element);
  const visibleBorderSides = [
    [style.borderTopWidth, style.borderTopStyle],
    [style.borderRightWidth, style.borderRightStyle],
    [style.borderBottomWidth, style.borderBottomStyle],
    [style.borderLeftWidth, style.borderLeftStyle],
  ].filter(
    ([width, borderStyle]) =>
      Number.parseFloat(width ?? '') > 0 && borderStyle !== 'none',
  ).length;
  const hasCardBorder = visibleBorderSides >= 3;
  const hasShadow = style.boxShadow !== '' && style.boxShadow !== 'none';
  const hasRoundedCorner = Number.parseFloat(style.borderTopLeftRadius) > 0;
  return hasCardBorder || (hasRoundedCorner && hasShadow);
}

function completeSidebarCard(
  element: HTMLElement,
  sidebar: HTMLElement,
): HTMLElement {
  let current: HTMLElement | null = element;
  let cardBoundary: HTMLElement | null = null;

  while (current && current !== sidebar) {
    if (hasCardBoundary(current)) {
      cardBoundary = current;
    }
    current = current.parentElement;
  }

  return cardBoundary ?? element;
}

function closestSidebarModule(
  marker: HTMLElement,
  sidebar: HTMLElement,
): HTMLElement {
  const aside = marker.closest<HTMLElement>('aside');
  if (aside && sidebar.contains(aside)) {
    return aside;
  }

  const region = marker.closest<HTMLElement>('[role="region"]');
  if (region && region !== sidebar && sidebar.contains(region)) {
    return region;
  }

  let current: HTMLElement | null = marker;
  while (current && current !== sidebar) {
    if (headingText(current)) {
      return current;
    }
    current = current.parentElement;
  }

  return marker;
}

function addTarget(
  targets: XInterfaceModuleTarget[],
  seen: Set<HTMLElement>,
  module: InterfaceModuleKey,
  element: HTMLElement | null,
) {
  if (!element || seen.has(element)) {
    return;
  }

  seen.add(element);
  targets.push({ element, module });
}

function findSearchTarget(sidebar: HTMLElement): HTMLElement | null {
  const input = sidebar.querySelector<HTMLElement>(
    '[data-testid="SearchBox_Search_Input"]',
  );
  return input?.closest<HTMLElement>('form, [role="search"]') ?? input;
}

function findPremiumTarget(sidebar: HTMLElement): HTMLElement | null {
  const stableMarker =
    sidebar.querySelector<HTMLElement>('[data-testid="premium-signup-tab"]') ??
    findLinkByPath(sidebar, '/i/premium_sign_up');
  if (stableMarker) {
    return completeSidebarCard(
      closestSidebarModule(stableMarker, sidebar),
      sidebar,
    );
  }

  for (const candidate of sidebar.querySelectorAll<HTMLElement>('aside, [role="region"]')) {
    if (PREMIUM_HEADING_PATTERN.test(headingText(candidate))) {
      return completeSidebarCard(candidate, sidebar);
    }
  }
  return null;
}

function findTrendTarget(sidebar: HTMLElement): HTMLElement | null {
  for (const candidate of sidebar.querySelectorAll<HTMLElement>(
    'aside[aria-label], section[aria-label], [role="region"][aria-label]',
  )) {
    if (TREND_HEADING_PATTERN.test(candidate.getAttribute('aria-label') ?? '')) {
      return completeSidebarCard(candidate, sidebar);
    }
  }

  const stableMarker =
    findLinkByPath(sidebar, '/explore/tabs/for-you') ??
    findLinkByPath(sidebar, '/explore');
  if (stableMarker) {
    const target = closestSidebarModule(stableMarker, sidebar);
    if (TREND_HEADING_PATTERN.test(headingText(target))) {
      return completeSidebarCard(target, sidebar);
    }
  }
  return null;
}

function findSidebarFollowTarget(sidebar: HTMLElement): HTMLElement | null {
  const stableMarker = findLinkByPath(sidebar, '/i/connect_people');
  if (stableMarker) {
    return completeSidebarCard(
      closestSidebarModule(stableMarker, sidebar),
      sidebar,
    );
  }

  for (const aside of sidebar.querySelectorAll<HTMLElement>('aside')) {
    if (
      aside.querySelector('[data-testid="UserCell"]') &&
      FOLLOW_HEADING_PATTERN.test(headingText(aside))
    ) {
      return completeSidebarCard(aside, sidebar);
    }
  }
  return null;
}

function findTimelineFollowTargets(
  root: ParentNode,
  sidebar: HTMLElement | null,
): HTMLElement[] {
  const targets: HTMLElement[] = [];
  for (const cell of root.querySelectorAll<HTMLElement>(
    '[data-testid="cellInnerDiv"]',
  )) {
    if (sidebar?.contains(cell) || cell.querySelector('article')) {
      continue;
    }

    const hasUserCells = cell.querySelector('[data-testid="UserCell"]');
    const hasConnectPeopleLink = findLinkByPath(cell, '/i/connect_people');
    const hasFollowHeading = FOLLOW_HEADING_PATTERN.test(headingText(cell));
    if (hasUserCells && (hasConnectPeopleLink || hasFollowHeading)) {
      targets.push(cell);
    }
  }
  return targets;
}

export function findXInterfaceModuleTargets(
  root: ParentNode = document,
): XInterfaceModuleTarget[] {
  const targets: XInterfaceModuleTarget[] = [];
  const seen = new Set<HTMLElement>();
  const sidebar = root.querySelector<HTMLElement>('[data-testid="sidebarColumn"]');

  if (sidebar) {
    addTarget(targets, seen, 'sidebarSearch', findSearchTarget(sidebar));
    addTarget(targets, seen, 'premiumSubscription', findPremiumTarget(sidebar));
    addTarget(targets, seen, 'trends', findTrendTarget(sidebar));
    addTarget(
      targets,
      seen,
      'followRecommendations',
      findSidebarFollowTarget(sidebar),
    );
  }

  for (const element of findTimelineFollowTargets(root, sidebar)) {
    addTarget(targets, seen, 'followRecommendations', element);
  }

  return targets;
}

export interface XInterfaceModuleManager {
  sync(root?: ParentNode): void;
  destroy(): void;
}

export function createXInterfaceModuleManager(
  repository: InterfaceModuleVisibilityRepository,
): XInterfaceModuleManager {
  const hiddenElements = new Map<HTMLElement, HiddenModuleState>();
  let visibility: InterfaceModuleVisibility = {
    ...DEFAULT_INTERFACE_MODULE_VISIBILITY,
  };
  let destroyed = false;
  let visibilityRevision = 0;

  function restore(element: HTMLElement) {
    const state = hiddenElements.get(element);
    if (!state) {
      return;
    }

    element.style.removeProperty('display');
    if (state.displayValue) {
      element.style.setProperty(
        'display',
        state.displayValue,
        state.displayPriority,
      );
    }
    delete element.dataset.twitterEnhancementHiddenModule;
    hiddenElements.delete(element);
  }

  function hide(target: XInterfaceModuleTarget) {
    if (!hiddenElements.has(target.element)) {
      hiddenElements.set(target.element, {
        module: target.module,
        displayValue: target.element.style.getPropertyValue('display'),
        displayPriority: target.element.style.getPropertyPriority('display'),
      });
    }

    target.element.dataset.twitterEnhancementHiddenModule = target.module;
    target.element.style.setProperty('display', 'none', 'important');
  }

  function sync(root: ParentNode = document) {
    if (destroyed) {
      return;
    }

    const targets = findXInterfaceModuleTargets(root);
    const currentTargets = new Map(
      targets.map((target) => [target.element, target.module]),
    );

    for (const [element, state] of [...hiddenElements]) {
      if (
        visibility[state.module] ||
        currentTargets.get(element) !== state.module ||
        !element.isConnected
      ) {
        restore(element);
      }
    }

    for (const target of targets) {
      if (!visibility[target.module]) {
        hide(target);
      }
    }
  }

  function applyVisibility(change: InterfaceModuleVisibilityChange) {
    visibility = { ...visibility, ...change };
    sync();
  }

  const unsubscribe = repository.subscribe((change) => {
    visibilityRevision += 1;
    applyVisibility(change);
  });
  const loadRevision = visibilityRevision;
  void repository
    .getVisibility()
    .then((storedVisibility) => {
      if (!destroyed && visibilityRevision === loadRevision) {
        applyVisibility(storedVisibility);
      }
    })
    .catch(() => {
      // Keep X's default visible modules when storage is unavailable.
    });

  function destroy() {
    destroyed = true;
    unsubscribe();
    for (const element of [...hiddenElements.keys()]) {
      restore(element);
    }
  }

  return { sync, destroy };
}
