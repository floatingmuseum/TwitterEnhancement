import type {
  InterfaceLayoutChange,
  InterfaceLayoutPreference,
  InterfaceLayoutPreferenceRepository,
} from '../../features/interface-modules/interface-layout-preference';
import { DEFAULT_INTERFACE_LAYOUT_PREFERENCE } from '../../features/interface-modules/interface-layout-preference';
import { POST_FRAME_SELECTOR } from './post-frame';
import './interface-layout.css';

interface InlineStyleValue {
  priority: string;
  value: string;
}

interface StyledElementState {
  markerValue: string | null;
  styles: Map<string, InlineStyleValue>;
}

interface NormalDesktopLayoutMeasurement {
  headerWidth: number;
  viewportWidth: number;
}

interface MediaCarouselSize {
  height: number;
  paddingBottom: string;
}

const LAYOUT_MARKER = 'data-twitter-enhancement-layout';
export const INITIAL_WIDE_LAYOUT_ATTRIBUTE = 'data-te-initial-wide-layout';
const LEFT_NAVIGATION_COLLAPSED = 'data-te-left-navigation-collapsed';
const LEFT_CONTROL_HOST = 'data-twitter-enhancement-left-layout-control';
const RIGHT_CONTROL_HOST = 'data-twitter-enhancement-right-layout-control';
// X's 55px floating buttons sit 20px from the viewport edge.
const RIGHT_CONTROL_RAIL_WIDTH = 80;

const CHEVRON_LEFT_PATH =
  'M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z';
const CHEVRON_RIGHT_PATH =
  'M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z';
const COMPOSE_PATHS = [
  'M10.938 4.5H9.9c-1.136 0-1.929 0-2.546.05-.605.05-.953.143-1.216.277-.564.288-1.023.747-1.31 1.31-.135.264-.228.612-.277 1.218C4.5 7.97 4.5 8.765 4.5 9.9v4.2c0 1.136 0 1.929.05 2.546.05.605.143.953.277 1.216.288.565.747 1.023 1.31 1.31.264.135.612.228 1.217.277.617.05 1.41.051 2.546.051h4.2c1.136 0 1.929 0 2.545-.05.606-.05.954-.143 1.217-.277.565-.288 1.023-.746 1.31-1.31.135-.264.228-.612.277-1.217.05-.617.051-1.41.051-2.546v-1.037h2V14.1c0 1.103.001 1.992-.058 2.709-.06.728-.185 1.368-.487 1.96-.48.941-1.245 1.707-2.185 2.186-.593.302-1.233.428-1.961.488-.718.058-1.606.057-2.71.057H9.9c-1.103 0-1.991.001-2.709-.058-.728-.06-1.368-.185-1.96-.487-.941-.48-1.707-1.245-2.186-2.185-.302-.593-.428-1.233-.487-1.961-.059-.718-.058-1.606-.058-2.71V9.9c0-1.103-.001-1.991.058-2.709.06-.728.185-1.368.487-1.96.48-.941 1.245-1.707 2.185-2.186.593-.302 1.233-.428 1.961-.487.718-.059 1.606-.058 2.71-.058h1.037v2z',
  'M16.293 3.293c1.219-1.219 3.195-1.219 4.414 0 1.219 1.219 1.219 3.195 0 4.414l-5.491 5.491c-.533.533-.89.896-1.31 1.179-.356.24-.742.433-1.148.574-.478.167-.983.234-1.729.341l-2.708.387.387-2.708c.107-.746.174-1.25.34-1.729.142-.405.335-.792.575-1.148.283-.42.646-.777 1.179-1.31l5.491-5.491zm3 1.414c-.438-.438-1.148-.438-1.586 0l-5.491 5.491c-.587.587-.784.79-.934 1.013-.144.214-.26.445-.345.688-.088.254-.131.533-.248 1.354l-.01.067.068-.008c.82-.118 1.1-.161 1.354-.25.243-.084.474-.2.688-.344.223-.15.426-.347 1.013-.934l5.491-5.491c.438-.438.438-1.148 0-1.586z',
] as const;

const PRIMARY_EXPANDED_STYLES = {
  flex: '1 1 auto',
  'max-width': 'none',
  'min-width': '0px',
  width: 'auto',
} as const;
const COLUMN_EXPANDED_STYLES = {
  flex: '1 1 auto',
  'max-width': 'none',
  'min-width': '0px',
  width: '100%',
} as const;
const TIMELINE_EXPANDED_STYLES = {
  flex: '1 1 auto',
  'max-width': 'none',
  'min-width': '0px',
  width: '100%',
} as const;
const SIDEBAR_HIDDEN_STYLES = {
  flex: '0 0 0px',
  'max-width': '0px',
  'min-width': '0px',
  overflow: 'hidden',
  'pointer-events': 'none',
  visibility: 'hidden',
  width: '0px',
} as const;

const LEGACY_MEDIA_SELECTOR =
  '[data-testid="tweetPhoto"], [data-testid="videoPlayer"], [data-testid="videoComponent"], [data-testid="card.wrapper"], [data-testid="article-cover-image"], video';
const SEMANTIC_MEDIA_SELECTOR =
  'a[data-engagement-action="media"], [data-press-control], a[class~="group/article-card"], a[target="_blank"]:has(> [style*="aspect-ratio"]), [style*="aspect-ratio"]:has(+ a[target="_blank"])';
const SEMANTIC_TIMELINE = 'section [id^="urt:"]';
const POST_IMAGE_SELECTOR = 'img[src*="/card_img/"], img[src*="_video_thumb/"], img[src*="pbs.twimg.com/media/"]';
const CAROUSEL_GROUP = '[class~="group/carousel"]';
const CAROUSEL_LIST = `[data-testid="ScrollSnap-List"], ${CAROUSEL_GROUP} .snap-x`;
const FULL_SIZE_MEDIA_CONTEXT = '[role="dialog"], [data-testid="twitterArticleReadView"], [data-article-part="cover"], [data-article-part="body"]';
const CAROUSEL_SLIDE_MEDIA_SELECTOR =
  '[data-testid="tweetPhoto"], [data-testid="videoPlayer"], [data-testid="videoComponent"], [data-testid="playButton"], video, a[data-engagement-action="media"], [data-press-control], img[src*="_video_thumb/"]';

function isExternalMediaBoundary(
  boundary: Element,
  target: HTMLElement,
): boolean {
  if (target.contains(boundary)) {
    return false;
  }
  if (
    boundary.getAttribute('role') === 'group' &&
    boundary.closest(
      '[data-testid="videoPlayer"], [data-testid="videoComponent"], [data-testid="ScrollSnap-List"]',
    )
  ) {
    return false;
  }
  return true;
}

function findSemanticMediaTarget(media: HTMLElement, article: HTMLElement): HTMLElement | null {
  const carousel = media.closest<HTMLElement>(CAROUSEL_GROUP);
  if (carousel && article.contains(carousel)) {
    const spacer = carousel.closest<HTMLElement>('[style*="padding-bottom"]');
    return spacer && article.contains(spacer) ? spacer : carousel;
  }

  const link = media.closest<HTMLElement>('a[target="_blank"], a[class~="group/article-card"]');
  // Playing videos have a second ratio box inside the outer attachment.
  const player = media.closest<HTMLElement>('[data-press-control]');
  let ratio = player?.parentElement?.closest<HTMLElement>('[style*="aspect-ratio"]')
    ?? media.closest<HTMLElement>('[style*="aspect-ratio"]');
  // GIFs wrap the player in a second ratio box that reserves the tweet's space.
  const frame = ratio?.parentElement;
  if (ratio?.style.aspectRatio && frame && frame !== article && frame.childElementCount === 1 &&
      frame.style.aspectRatio === ratio.style.aspectRatio) {
    ratio = frame;
  }
  const visual = link ?? ratio ?? player ?? (media.matches('video') ? media : null);
  if (!visual || !article.contains(visual)) return null;

  // A sponsored image or player and its separate call-to-action form one card.
  const caption = visual.nextElementSibling;
  const card = visual.parentElement;
  if (card && card !== article && card.childElementCount === 2 &&
      caption?.matches('a[target="_blank"][href]') &&
      (!link || link.getAttribute('href') === caption.getAttribute('href') || caption.querySelector('[data-slot="xds-button"]'))) {
    return card;
  }
  return visual;
}

function findTweetMediaTargets(primary: HTMLElement): HTMLElement[] {
  const targets = new Set<HTMLElement>();
  const selector = `article :is(${LEGACY_MEDIA_SELECTOR}, ${SEMANTIC_MEDIA_SELECTOR}, ${POST_IMAGE_SELECTOR})`;
  for (const media of primary.querySelectorAll<HTMLElement>(selector)) {
    const article = media.closest('article');
    if (!article || media.closest(FULL_SIZE_MEDIA_CONTEXT)) continue;
    // The focused post in a conversation has no clickable status frame.
    if (media.closest(`${POST_FRAME_SELECTOR}, ${SEMANTIC_TIMELINE}`) || media.matches(SEMANTIC_MEDIA_SELECTOR) ||
        media.matches('img[src*="/card_img/"]')) {
      const target = findSemanticMediaTarget(media, article);
      if (target) {
        targets.add(target);
        continue;
      }
    }
    if (!media.matches(LEGACY_MEDIA_SELECTOR)) continue;
    let target = media;
    // Constrain the whole attachment, including grids and aspect-ratio spacers.
    // Stop before the tweet body (or a quoted tweet's body), so text can expand.
    while (target.parentElement && target.parentElement !== article) {
      const parent = target.parentElement;
      if (
        Array.from(
          parent.querySelectorAll(
            '[data-testid="tweetText"], [data-testid="User-Name"], [role="group"], article',
          ),
        ).some((boundary) => isExternalMediaBoundary(boundary, target))
      ) {
        break;
      }
      target = parent;
    }
    targets.add(target);
  }
  return [...targets];
}

function isCarouselMediaSlide(slide: Element): boolean {
  return (
    slide.matches(CAROUSEL_SLIDE_MEDIA_SELECTOR) ||
    slide.querySelector(CAROUSEL_SLIDE_MEDIA_SELECTOR) !== null
  );
}

function findMediaCarouselSpacer(target: HTMLElement): HTMLElement | null {
  const lists = target.querySelectorAll<HTMLElement>(CAROUSEL_LIST);
  const list = lists.item(0);
  if (
    lists.length !== 1 ||
    !list ||
    list.closest('[data-testid="card.wrapper"]') ||
    list.querySelector('[data-testid="card.wrapper"]') ||
    Array.from(list.children).filter(isCarouselMediaSlide).length < 2
  ) {
    return null;
  }
  // X sizes its horizontal media strips with a percentage-padding spacer.
  // Keep that native height while allowing the scrollport to fill the column.
  let spacer = list.parentElement;
  while (spacer && target.contains(spacer)) {
    if (spacer.style.paddingBottom.includes('%')) {
      return spacer;
    }
    spacer = spacer.parentElement;
  }
  return null;
}

function findTimelineContentTargets(primary: HTMLElement): HTMLElement[] {
  // Home, history, profiles and conversations share the same capped list wrapper.
  const targets = new Set(primary.querySelectorAll<HTMLElement>(
    `${SEMANTIC_TIMELINE}:has(> ul):not(article *, aside *, [role="dialog"] *)`,
  ));
  for (const cell of primary.querySelectorAll<HTMLElement>(
    '[data-testid="cellInnerDiv"]',
  )) {
    const section = cell.closest<HTMLElement>('section');
    const content = section?.parentElement;
    if (section && content && content !== primary && primary.contains(content)) {
      targets.add(content);
    }
  }
  return [...targets];
}

function findColumnExpansionTargets(primary: HTMLElement): HTMLElement[] {
  const targets: HTMLElement[] = [];
  const pageMain = primary.closest('main');
  if (!pageMain || pageMain === primary) {
    return targets;
  }
  let current = primary.parentElement;
  while (current && current !== pageMain) {
    targets.push(current);
    current = current.parentElement;
  }
  return targets;
}

interface NavigationControlTarget {
  control: HTMLElement;
  label: HTMLElement;
  pill: HTMLElement;
}

function findNavigationControlTargets(
  navigation: HTMLElement,
): NavigationControlTarget[] {
  const targets: NavigationControlTarget[] = [];
  for (const control of navigation.querySelectorAll<HTMLElement>(
    'a[href], button',
  )) {
    if (control.parentElement?.closest('a[href], button')) {
      continue;
    }
    const pill = control.firstElementChild;
    const icon = pill?.children.item(0);
    const label = pill?.children.item(1);
    if (
      pill instanceof HTMLElement &&
      icon?.querySelector('svg') &&
      label instanceof HTMLElement &&
      (label.textContent?.trim() ?? '') !== ''
    ) {
      targets.push({ control, label, pill });
    }
  }
  return targets;
}

function findHeaderAncestors(
  navigation: HTMLElement,
  header: HTMLElement,
): HTMLElement[] {
  const ancestors: HTMLElement[] = [];
  let current = navigation.parentElement;
  while (current && current !== header) {
    ancestors.push(current);
    current = current.parentElement;
  }
  return ancestors;
}

function isDarkDocument(document: Document): boolean {
  const theme = document.documentElement.dataset.theme;
  if (theme === 'dark' || theme === 'light') return theme === 'dark';
  const color = document.defaultView
    ?.getComputedStyle(document.body)
    .backgroundColor.match(/[\d.]+/gu)
    ?.slice(0, 3)
    .map(Number);
  if (!color || color.length < 3) {
    return false;
  }
  const [red = 255, green = 255, blue = 255] = color;
  return red * 0.299 + green * 0.587 + blue * 0.114 < 128;
}

function chevronIcon(pointsLeft: boolean): string {
  const path = pointsLeft ? CHEVRON_LEFT_PATH : CHEVRON_RIGHT_PATH;
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}" /></svg>`;
}

function composeIcon(): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${COMPOSE_PATHS[0]}"/><path fill-rule="evenodd" clip-rule="evenodd" d="${COMPOSE_PATHS[1]}"/></svg>`;
}

function controlStyles(): string {
  return `
    :host { color: var(--te-control-color, currentColor); }
    .stack { align-items: center; display: flex; flex-direction: column; gap: 8px; }
    button, a {
      align-items: center; border: 0; border-radius: 9999px; box-sizing: border-box;
      color: inherit; cursor: pointer; display: flex; height: 44px; justify-content: center;
      padding: 0; text-decoration: none; width: 44px;
    }
    button { background: transparent; }
    button:hover { background: color-mix(in srgb, currentColor 10%, transparent); }
    button:focus-visible, a:focus-visible { outline: 2px solid rgb(29, 155, 240); outline-offset: 2px; }
    a.compose { background: var(--te-compose-bg); color: var(--te-compose-color); height: 52px; width: 52px; }
    a.compose:hover { filter: brightness(.92); }
    svg { fill: currentColor; height: 24px; width: 24px; }
  `;
}

export interface XInterfaceLayoutManager {
  sync(root?: ParentNode): void;
  destroy(): void;
}

export function createXInterfaceLayoutManager(
  repository: InterfaceLayoutPreferenceRepository,
): XInterfaceLayoutManager {
  const leftStyledElements = new Map<HTMLElement, StyledElementState>();
  const rightStyledElements = new Map<HTMLElement, StyledElementState>();
  let preference: InterfaceLayoutPreference = {
    ...DEFAULT_INTERFACE_LAYOUT_PREFERENCE,
  };
  let leftHost: HTMLElement | null = null;
  let rightHost: HTMLElement | null = null;
  let normalDesktopLayout: NormalDesktopLayoutMeasurement | null = null;
  let normalPrimaryWidth: number | null = null;
  let mediaWidths = new WeakMap<HTMLElement, number>();
  let carouselSizes = new WeakMap<HTMLElement, MediaCarouselSize>();
  let destroyed = false;
  let changesBeforeLoad: InterfaceLayoutChange | null = {};

  function restoreElement(
    states: Map<HTMLElement, StyledElementState>,
    element: HTMLElement,
  ) {
    const state = states.get(element);
    if (!state) {
      return;
    }
    for (const [property, style] of state.styles) {
      element.style.removeProperty(property);
      if (style.value) {
        element.style.setProperty(property, style.value, style.priority);
      }
    }
    if (state.markerValue === null) {
      element.removeAttribute(LAYOUT_MARKER);
    } else {
      element.setAttribute(LAYOUT_MARKER, state.markerValue);
    }
    states.delete(element);
  }

  function restoreAll(states: Map<HTMLElement, StyledElementState>) {
    for (const element of [...states.keys()]) {
      restoreElement(states, element);
    }
  }

  function applyStyles(
    states: Map<HTMLElement, StyledElementState>,
    element: HTMLElement,
    role: string,
    styles: Readonly<Record<string, string>>,
  ) {
    let state = states.get(element);
    if (!state) {
      state = {
        markerValue: element.getAttribute(LAYOUT_MARKER),
        styles: new Map(),
      };
      states.set(element, state);
    }
    for (const property of Object.keys(styles)) {
      if (!state.styles.has(property)) {
        state.styles.set(property, {
          priority: element.style.getPropertyPriority(property),
          value: element.style.getPropertyValue(property),
        });
      }
    }
    element.setAttribute(LAYOUT_MARKER, role);
    for (const [property, value] of Object.entries(styles)) {
      element.style.setProperty(property, value, 'important');
    }
  }

  function restoreStale(
    states: Map<HTMLElement, StyledElementState>,
    current: Set<HTMLElement>,
  ) {
    for (const element of [...states.keys()]) {
      if (!current.has(element) || !element.isConnected) {
        restoreElement(states, element);
      }
    }
  }

  function removeHost(host: HTMLElement | null): null {
    host?.remove();
    return null;
  }

  function captureNormalDesktopLayout(root: ParentNode) {
    if (leftStyledElements.size > 0 || rightStyledElements.size > 0) {
      return;
    }
    const header = root.querySelector<HTMLElement>('header[role="banner"]');
    const navigation = header?.querySelector<HTMLElement>(
      'nav[role="navigation"]',
    );
    const sidebar = root.querySelector<HTMLElement>(
      '[data-testid="sidebarColumn"]',
    );
    const document = header?.ownerDocument;
    const view = document?.defaultView;
    if (
      !header ||
      !navigation ||
      findNavigationControlTargets(navigation).length === 0 ||
      !sidebar ||
      !document ||
      !view ||
      view.getComputedStyle(sidebar).display === 'none'
    ) {
      return;
    }

    const measuredWidth = header.getBoundingClientRect().width;
    const computedWidth = Number.parseFloat(view.getComputedStyle(header).width);
    const headerWidth = measuredWidth > 0 ? measuredWidth : computedWidth;
    if (!Number.isFinite(headerWidth) || headerWidth <= 0) {
      return;
    }
    normalDesktopLayout = {
      headerWidth,
      viewportWidth:
        document.documentElement.clientWidth || view.innerWidth || 0,
    };
  }

  function expandedHeaderWidth(document: Document): number | null {
    if (!normalDesktopLayout) {
      return null;
    }
    const currentViewportWidth =
      document.documentElement.clientWidth ||
      document.defaultView?.innerWidth ||
      normalDesktopLayout.viewportWidth;
    return Math.max(
      0,
      normalDesktopLayout.headerWidth +
        currentViewportWidth -
        normalDesktopLayout.viewportWidth,
    );
  }

  function updateHostTheme(host: HTMLElement, document: Document) {
    const dark = isDarkDocument(document);
    host.style.setProperty(
      '--te-control-color',
      document.defaultView?.getComputedStyle(document.body).color ??
        'currentColor',
    );
    host.style.setProperty(
      '--te-compose-bg',
      dark ? 'rgb(239, 243, 244)' : 'rgb(15, 20, 25)',
    );
    host.style.setProperty(
      '--te-compose-color',
      dark ? 'rgb(15, 20, 25)' : 'rgb(255, 255, 255)',
    );
    host.style.setProperty(
      '--te-floating-bg',
      dark ? 'rgba(0, 0, 0, .84)' : 'rgba(255, 255, 255, .84)',
    );
  }

  function renderLeftControl(navigation: HTMLElement, compact: boolean, nativeRail = false) {
    const document = navigation.ownerDocument;
    if (document.readyState === 'loading') return;
    if (!leftHost?.isConnected) {
      leftHost = document.createElement('div');
      leftHost.setAttribute(LEFT_CONTROL_HOST, '');
      leftHost.attachShadow({ mode: 'open' });
    }
    if (navigation.nextElementSibling !== leftHost) navigation.insertAdjacentElement('afterend', leftHost);
    const label = compact ? '展开左侧导航' : '收起左侧导航';
    leftHost.style.width = nativeRail ? '100%' : compact ? '72px' : '233px';
    leftHost.style.margin = '4px 0';
    updateHostTheme(leftHost, document);
    const shadow = leftHost.shadowRoot;
    const state = `${nativeRail ? 'rail-' : ''}${compact ? 'compact' : 'expanded'}`;
    if (!shadow || leftHost.dataset.state === state) {
      return;
    }
    leftHost.dataset.state = state;
    shadow.innerHTML = `
      <style>${controlStyles()}</style>
      <div class="stack">
        <button type="button" aria-label="${label}" title="${label}">
          ${chevronIcon(!compact)}
        </button>
        ${
          compact && !nativeRail
            ? `<a class="compose" href="/compose/post" aria-label="发帖" title="发帖">${composeIcon()}</a>`
            : ''
        }
      </div>
    `;
    shadow.querySelector('button')?.addEventListener('click', () => {
      void repository.setPreference('leftNavigationExpanded', compact);
    });
  }

  function renderRightControl(sidebar: HTMLElement) {
    const document = sidebar.ownerDocument;
    if (document.readyState === 'loading') return;
    const columns = sidebar.parentElement;
    if (!columns) {
      rightHost = removeHost(rightHost);
      return;
    }
    if (!rightHost) {
      rightHost = document.createElement('div');
      rightHost.setAttribute(RIGHT_CONTROL_HOST, '');
      rightHost.attachShadow({ mode: 'open' });
    }
    const visible = preference.rightSidebarVisible;
    const label = visible ? '隐藏右侧栏' : '显示右侧栏';
    const railButton = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-testid="GrokDrawerHeader"], [data-testid="chat-drawer-main"]',
      ),
    ).find((button) => button.getBoundingClientRect().width > 0);
    if (railButton || sidebar.matches('main + aside')) {
      if (rightHost.parentElement !== document.body) {
        document.body.append(rightHost);
      }
      const railRect = railButton?.getBoundingClientRect();
      rightHost.style.cssText = [
        'position: fixed',
        railRect ? `left: ${railRect.left + railRect.width / 2 - 22}px` : 'right: 25.5px',
        'top: 92px',
        'z-index: 2147483000',
        'width: 44px',
        'height: 44px',
      ].join(';');
    } else {
      if (rightHost.parentElement !== columns) {
        columns.append(rightHost);
      }
      rightHost.style.cssText = [
        'position: absolute',
        'right: 25.5px',
        'top: 92px',
        'z-index: 2147483000',
        'width: 44px',
        'height: 44px',
      ].join(';');
    }
    updateHostTheme(rightHost, document);
    const shadow = rightHost.shadowRoot;
    const state = visible ? 'visible' : 'hidden';
    if (!shadow || rightHost.dataset.state === state) {
      return;
    }
    rightHost.dataset.state = state;
    shadow.innerHTML = `
      <style>
        ${controlStyles()}
        button { backdrop-filter: blur(12px); background: var(--te-floating-bg); box-shadow: 0 0 14px color-mix(in srgb, currentColor 22%, transparent); }
      </style>
      <button type="button" aria-label="${label}" title="${label}">
        ${chevronIcon(!visible)}
      </button>
    `;
    shadow.querySelector('button')?.addEventListener('click', () => {
      void repository.setPreference('rightSidebarVisible', !visible);
    });
  }

  function syncLeft(root: ParentNode) {
    const railNavigation = root.querySelector<HTMLElement>('[data-rail-overflow] > nav');
    if (railNavigation?.querySelector('a[href="/home"]')) {
      restoreAll(leftStyledElements);
      renderLeftControl(railNavigation, !preference.leftNavigationExpanded, true);
      return;
    }
    const header = root.querySelector<HTMLElement>('header[role="banner"]');
    const navigation = header?.querySelector<HTMLElement>('nav[role="navigation"]');
    if (!header || !navigation) {
      restoreAll(leftStyledElements);
      leftHost = removeHost(leftHost);
      return;
    }

    const navigationTargets = findNavigationControlTargets(navigation);
    if (navigationTargets.length === 0) {
      restoreAll(leftStyledElements);
      leftHost = removeHost(leftHost);
      return;
    }

    const compact = !preference.leftNavigationExpanded;
    renderLeftControl(navigation, compact);
    if (!compact) {
      restoreAll(leftStyledElements);
      if (!preference.rightSidebarVisible) {
        const headerWidth = expandedHeaderWidth(header.ownerDocument);
        if (headerWidth !== null) {
          const width = `${headerWidth}px`;
          applyStyles(
            leftStyledElements,
            header,
            'right-expanded-header',
            {
              flex: `0 0 ${width}`,
              'max-width': width,
              'min-width': width,
              width,
            },
          );
        }
      }
      return;
    }

    const current = new Set<HTMLElement>();
    const style = (
      element: HTMLElement,
      role: string,
      styles: Readonly<Record<string, string>>,
    ) => {
      current.add(element);
      applyStyles(leftStyledElements, element, role, styles);
    };

    style(header, 'left-header', {
      flex: '0 0 88px',
      'max-width': '88px',
      'min-width': '88px',
      width: '88px',
    });
    for (const ancestor of findHeaderAncestors(navigation, header)) {
      style(ancestor, 'left-ancestor', {
        'max-width': '88px',
        'min-width': '88px',
        width: '88px',
      });
    }
    style(navigation, 'left-navigation', {
      'max-width': '72px',
      'min-width': '72px',
      width: '72px',
    });
    for (const { control, label, pill } of navigationTargets) {
      style(label, 'left-label', { display: 'none' });
      style(control, 'left-navigation-item', {
        'align-items': 'center',
        'justify-content': 'center',
        'max-width': '72px',
        'min-width': '72px',
        width: '72px',
      });
      style(pill, 'left-navigation-pill', {
        'align-self': 'center',
      });
    }

    const logo = header.querySelector<HTMLElement>('a[aria-label="X"]');
    if (logo?.querySelector('svg')) {
      style(logo, 'left-logo', {
        'justify-content': 'center',
        'max-width': '72px',
        'min-width': '72px',
        width: '72px',
      });
    }

    const post = header.querySelector<HTMLElement>(
      '[data-testid="SideNav_NewTweet_Button"]',
    );
    if (post) {
      style(post, 'left-native-post', { display: 'none' });
    }
    const account = header.querySelector<HTMLElement>(
      '[data-testid="SideNav_AccountSwitcher_Button"]',
    );
    if (account) {
      style(account, 'left-account', {
        'justify-content': 'center',
        'max-width': '72px',
        'min-width': '72px',
        width: '72px',
      });
      for (const child of Array.from(account.children).slice(1)) {
        if (child instanceof HTMLElement) {
          style(child, 'left-account-detail', { display: 'none' });
        }
      }
    }
    restoreStale(leftStyledElements, current);
  }

  function expandDesktopGrid(grid: HTMLElement, current: Set<HTMLElement>) {
    const { leftNavigationExpanded, rightSidebarVisible } = preference;
    const page = grid.parentElement?.parentElement;
    let outerGutter = 0;
    let controlRailWidth = 0;
    // The capped page wraps a row containing the navigation and main/aside grid.
    if (page?.parentElement && page !== grid.ownerDocument.body &&
        grid.previousElementSibling?.querySelector('[data-rail-overflow]')) {
      const maxWidth = getComputedStyle(page).maxWidth;
      if (maxWidth.endsWith('px')) {
        outerGutter = Math.max(0, (page.parentElement.clientWidth - parseFloat(maxWidth)) / 2);
      }
      const keepGutter = leftNavigationExpanded || rightSidebarVisible;
      current.add(page);
      // Raising the minimum keeps X's responsive max-width readable on resize.
      applyStyles(rightStyledElements, page, 'desktop-page', {
        'min-width': keepGutter ? `calc(100% - ${outerGutter}px)` : '100%',
        'margin-inline-start': leftNavigationExpanded ? 'auto' : '0px',
        'margin-inline-end': rightSidebarVisible ? 'auto' : '0px',
      });
      controlRailWidth = RIGHT_CONTROL_RAIL_WIDTH;
    }
    current.add(grid);
    applyStyles(rightStyledElements, grid, 'right-column-wrapper', {
      // A visible sidebar keeps its native width. Its neighbor receives both
      // the outer gutter and the 184px released by collapsing a wide rail.
      'grid-template-columns': rightSidebarVisible
        ? `calc(var(--x-main-column-width) + 184px * var(--x-sidebar-wide, 0) + ${outerGutter}px) minmax(0, 1fr)`
        : `minmax(0, 1fr) ${controlRailWidth}px`,
    });
  }

  function syncRight(root: ParentNode) {
    const sidebar = root.querySelector<HTMLElement>(
      '[data-testid="sidebarColumn"], main + aside',
    );
    const gridMain = sidebar?.previousElementSibling;
    const semanticGrid = gridMain instanceof HTMLElement && gridMain.matches('main');
    const primary = semanticGrid ? gridMain : root.querySelector<HTMLElement>('[data-testid="primaryColumn"]');
    const view = sidebar?.ownerDocument.defaultView;
    // At document_start the markup can precede X's render-blocking CSS.
    // Measuring a plain block here would cache viewport-wide media sizes.
    const grid = primary?.parentElement;
    if (
      !primary ||
      !sidebar ||
      !grid ||
      grid !== sidebar.parentElement ||
      !view ||
      (semanticGrid && !view.getComputedStyle(grid).display.endsWith('grid')) ||
      view.getComputedStyle(sidebar).display === 'none'
    ) {
      restoreAll(rightStyledElements);
      normalPrimaryWidth = null;
      mediaWidths = new WeakMap();
      carouselSizes = new WeakMap();
      rightHost = removeHost(rightHost);
      return;
    }

    renderRightControl(sidebar);
    const current = new Set<HTMLElement>();
    const shouldExpandTimeline =
      !preference.leftNavigationExpanded || !preference.rightSidebarVisible;
    if (shouldExpandTimeline) {
      if (semanticGrid) {
        expandDesktopGrid(grid, current);
      }
      if (normalPrimaryWidth === null) {
        // A hidden column may have had no measurable native width last time.
        restoreElement(rightStyledElements, primary);
      }
      if (!rightStyledElements.has(primary)) {
        const width = primary.getBoundingClientRect().width;
        normalPrimaryWidth = width > 0 && Number.isFinite(width) ? width : null;
        mediaWidths = new WeakMap();
        carouselSizes = new WeakMap();
      }
      const timelineContents = findTimelineContentTargets(primary);
      const mediaTargets = findTweetMediaTargets(primary);
      const carouselSpacers = new Map(
        mediaTargets.map((target) => [target, findMediaCarouselSpacer(target)]),
      );
      const unmeasuredTargets = mediaTargets.filter(
        (target) => {
          const spacer = carouselSpacers.get(target);
          return !mediaWidths.has(target) || (spacer && !carouselSizes.has(spacer));
        },
      );
      if (normalPrimaryWidth !== null && unmeasuredTargets.length > 0) {
        // Lazy-loaded tweets arrive after the column has expanded. Measure all
        // new attachments in one native-width layout, then restore before paint.
        for (const content of timelineContents) {
          restoreElement(rightStyledElements, content);
        }
        const originalStyle = primary.getAttribute('style');
        try {
          const width = `${normalPrimaryWidth}px`;
          primary.style.setProperty('flex', `0 0 ${width}`, 'important');
          primary.style.setProperty('width', width, 'important');
          primary.style.setProperty('min-width', '0px', 'important');
          primary.style.setProperty('max-width', width, 'important');
          for (const target of unmeasuredTargets) {
            const mediaWidth = target.getBoundingClientRect().width;
            if (mediaWidth > 0 && Number.isFinite(mediaWidth)) {
              mediaWidths.set(target, mediaWidth);
            }
            const spacer = carouselSpacers.get(target);
            if (spacer && !carouselSizes.has(spacer)) {
              const height = spacer.getBoundingClientRect().height;
              if (height > 0 && Number.isFinite(height)) {
                carouselSizes.set(spacer, {
                  height,
                  paddingBottom: spacer.style.paddingBottom,
                });
              }
            }
          }
        } finally {
          if (originalStyle === null) {
            primary.removeAttribute('style');
          } else {
            primary.setAttribute('style', originalStyle);
          }
        }
      }
      for (const target of mediaTargets) {
        const spacer = carouselSpacers.get(target);
        const carouselSize = spacer ? carouselSizes.get(spacer) : undefined;
        if (spacer && carouselSize) {
          current.add(target);
          applyStyles(rightStyledElements, target, 'tweet-media-carousel', {
            'box-sizing': 'border-box',
            'max-width': 'none',
          });
          current.add(spacer);
          applyStyles(rightStyledElements, spacer, 'tweet-media-carousel-height', {
            // Retain the percentage for narrower layouts, but cap growth at
            // the height measured with the native column width.
            'padding-bottom': `calc(min(${carouselSize.paddingBottom}, ${carouselSize.height}px))`,
          });
          continue;
        }
        const width = mediaWidths.get(target);
        if (width !== undefined) {
          current.add(target);
          applyStyles(rightStyledElements, target, 'tweet-media', {
            'box-sizing': 'border-box',
            'max-width': `min(100%, ${width}px)`,
          });
        }
      }
      current.add(primary);
      applyStyles(
        rightStyledElements,
        primary,
        'right-primary',
        // X centers the grid item with auto inline margins. An auto width
        // would shrink to its contents instead of filling the assigned track.
        semanticGrid ? COLUMN_EXPANDED_STYLES : PRIMARY_EXPANDED_STYLES,
      );
      for (const [index, column] of findColumnExpansionTargets(
        primary,
      ).entries()) {
        current.add(column);
        applyStyles(
          rightStyledElements,
          column,
          'right-column-wrapper',
          index === 0
            ? {
                ...COLUMN_EXPANDED_STYLES,
                'column-gap': preference.rightSidebarVisible
                  ? '30px'
                  : '0px',
              }
            : COLUMN_EXPANDED_STYLES,
        );
      }
      for (const content of timelineContents) {
        current.add(content);
        applyStyles(
          rightStyledElements,
          content,
          'right-timeline-content',
          TIMELINE_EXPANDED_STYLES,
        );
      }
    } else {
      normalPrimaryWidth = null;
      mediaWidths = new WeakMap();
      carouselSizes = new WeakMap();
    }
    if (!preference.rightSidebarVisible) {
      current.add(sidebar);
      applyStyles(
        rightStyledElements,
        sidebar,
        'right-sidebar',
        SIDEBAR_HIDDEN_STYLES,
      );
    }
    restoreStale(rightStyledElements, current);
  }

  function sync(root: ParentNode = document) {
    if (destroyed) {
      return;
    }
    const html = document.documentElement;
    if (html.hasAttribute(INITIAL_WIDE_LAYOUT_ATTRIBUTE)) {
      if (changesBeforeLoad) {
        preference = { leftNavigationExpanded: false, rightSidebarVisible: false, ...changesBeforeLoad };
      }
      html.removeAttribute(INITIAL_WIDE_LAYOUT_ATTRIBUTE);
    }
    html.toggleAttribute(LEFT_NAVIGATION_COLLAPSED, !preference.leftNavigationExpanded);
    captureNormalDesktopLayout(root);
    syncLeft(root);
    syncRight(root);
  }

  function applyPreference(change: InterfaceLayoutChange) {
    preference = { ...preference, ...change };
    sync();
  }

  const unsubscribe = repository.subscribe((change) => {
    if (changesBeforeLoad) Object.assign(changesBeforeLoad, change);
    applyPreference(change);
  });
  void repository
    .getPreference()
    .then((storedPreference) => {
      if (!destroyed) {
        const currentPreference = { ...storedPreference, ...changesBeforeLoad };
        changesBeforeLoad = null;
        applyPreference(currentPreference);
      }
    })
    .catch(() => {
      // Keep the document's startup layout when storage is unavailable.
    });

  function destroy() {
    destroyed = true;
    unsubscribe();
    document.documentElement.removeAttribute(INITIAL_WIDE_LAYOUT_ATTRIBUTE);
    document.documentElement.removeAttribute(LEFT_NAVIGATION_COLLAPSED);
    restoreAll(leftStyledElements);
    restoreAll(rightStyledElements);
    leftHost = removeHost(leftHost);
    rightHost = removeHost(rightHost);
  }

  return { sync, destroy };
}
