import { POST_FRAME_SELECTOR } from './post-frame';

const HOME_TIMELINE_LIST = 'main section[aria-labelledby] [id^="urt:home:"] > ul';
const OUTSIDE_FEED = 'article, aside, nav, [role="dialog"], [hidden], [aria-hidden="true"]';
const LIST_ROUTE_PATTERNS = [
  /^\/i\/lists\/(\d+)\/?$/,
  /^\/[a-z0-9_]+\/lists\/(\d+)\/?$/i,
  /^\/i\/user\/\d+\/list\/(\d+)\/?$/,
];

export function getXListId(url: Pick<URL, 'pathname'>): string | null {
  for (const pattern of LIST_ROUTE_PATTERNS) {
    const match = pattern.exec(url.pathname);
    if (match?.[1]) return match[1];
  }
  return null;
}

export function findVirtualTimelineList(root: ParentNode, url: Pick<URL, 'pathname'>): HTMLElement | null {
  function visibleList(selector: string) {
    return Array.from(root.querySelectorAll<HTMLElement>(selector)).find(list => !list.closest(OUTSIDE_FEED));
  }
  if (/^\/home\/?$/i.test(url.pathname)) return visibleList(HOME_TIMELINE_LIST) ?? null;
  const id = getXListId(url);
  if (!id) return null;
  // The identified list stays mounted even when the virtualizer removes its last row.
  return visibleList(`main [id="urt:list:${id}"] > ul`)
    ?? visibleList('main ul:has(> li[data-index] article)')
    ?? null;
}

export function hasNewTimelinePosts(records: MutationRecord[]): boolean {
  let list: HTMLElement | null | undefined;
  function belongsToTimeline(element: Element) {
    const row = element.closest('li[data-index]');
    if (!row?.parentElement) return false;
    if (list === undefined) list = findVirtualTimelineList(document, location);
    return row.parentElement === list;
  }
  return records.some(({ attributeName, target, addedNodes }) => {
    if (attributeName === 'data-href') {
      return target instanceof Element && target.matches(POST_FRAME_SELECTOR) && belongsToTimeline(target);
    }
    // Extension controls inserted inside an existing article do not remount the post.
    return Array.from(addedNodes).some(node => {
      if (!(node instanceof Element)) return false;
      if (node.matches('article')) return belongsToTimeline(node);
      return Array.from(node.querySelectorAll('article')).some(belongsToTimeline);
    });
  });
}
