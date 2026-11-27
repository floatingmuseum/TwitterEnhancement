import { POST_FRAME_SELECTOR } from './post-frame';

const HOME_TIMELINE_LIST = 'main section[aria-labelledby] [id^="urt:home:"] > ul';
const HOME_ROW = `${HOME_TIMELINE_LIST} > li[data-index]`;
const HOME_POST = `${HOME_ROW} article`;
const HOME_POST_FRAME = `${HOME_ROW} ${POST_FRAME_SELECTOR}`;

export function findHomeTimelineList(root: ParentNode): HTMLElement | null {
  const lists = root.querySelectorAll<HTMLElement>(HOME_TIMELINE_LIST);
  return Array.from(lists).find(list => !list.closest('[hidden], [aria-hidden="true"]')) ?? null;
}

// Catch new rows, replacement articles, and frames recycled for another post.
// Inserting an extension control inside an existing post does not change its identity.
export function hasNewHomeTimelinePosts(records: MutationRecord[]): boolean {
  return records.some(({ attributeName, target, addedNodes }) => {
    if (attributeName === 'data-href') {
      return target instanceof Element && target.matches(HOME_POST_FRAME);
    }
    return Array.from(addedNodes).some(node =>
      node instanceof Element && (node.matches(HOME_POST) || node.querySelector(HOME_POST) !== null),
    );
  });
}
