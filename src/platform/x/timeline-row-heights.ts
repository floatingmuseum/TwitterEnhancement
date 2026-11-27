import { findVirtualTimelineList } from './virtual-timeline';
import { frameIdentity, POST_FRAME_SELECTOR } from './post-frame';

const FEED = 'data-te-measured-feed';
const READY = 'data-te-measured-post';
const MAX_ROWS = 256;

interface ObservedPost {
  frame: Element;
  href: string;
  index: string;
  id: string;
}

// X can synchronously measure a remounted li in the same call that inserts it,
// before either content script's MutationObserver gets to size or filter it.
export function createTimelineRowHeights() {
  const sheet = new CSSStyleSheet();
  const rules = new Map<string, string>();
  const observed = new Map<Element, ObservedPost>();
  let list: HTMLElement | null = null;
  let pathname: string | undefined;
  let width: number | undefined;

  const observer = new ResizeObserver(entries => {
    const listSize = entries.find(entry => entry.target === list)?.borderBoxSize[0];
    let changed = false;
    if (listSize && listSize.inlineSize !== width) {
      width = listSize.inlineSize;
      changed = rules.size > 0;
      rules.clear();
    }
    for (const entry of entries) {
      const post = observed.get(entry.target);
      const size = entry.borderBoxSize[0];
      if (!post || !size || size.blockSize <= 0 || entry.target.parentElement !== list ||
          !entry.target.contains(post.frame) || post.frame.getAttribute('data-href') !== post.href ||
          entry.target.getAttribute('data-index') !== post.index) continue;

      // The frame marker releases the reservation as soon as the new post has
      // been processed. Live rows can grow on playback, expansion or translation.
      const row = `[${FEED}] > li[data-index="${post.index}"]`;
      const link = `[role="link"][data-href="${post.href}"]`;
      const fresh = `${row}:not(:has([${READY}])):has(${link}:not(${POST_FRAME_SELECTOR} *))`;
      const recycled = `${row}:has(${link}[${READY}]:not([${READY}="${post.id}"]))`;
      const rule = `${fresh}, ${recycled} { box-sizing: border-box !important; height: ${size.blockSize}px !important; }`;
      if (rules.get(post.index) === rule) continue;
      rules.delete(post.index);
      rules.set(post.index, rule);
      if (rules.size > MAX_ROWS) rules.delete(rules.keys().next().value!);
      changed = true;
    }
    if (changed) sheet.replaceSync([...rules.values()].join('\n'));
  });

  function reset() {
    observer.disconnect();
    for (const post of observed.values()) post.frame.removeAttribute(READY);
    observed.clear();
    rules.clear();
    sheet.replaceSync('');
    list?.removeAttribute(FEED);
    list = null;
    pathname = undefined;
    width = undefined;
  }

  function sync() {
    const next = findVirtualTimelineList(document, location);
    if (next !== list || pathname !== location.pathname) {
      reset();
      pathname = location.pathname;
      list = next;
      if (list) {
        list.setAttribute(FEED, '');
        observer.observe(list, { box: 'border-box' });
      }
    }
    if (!list) return;
    for (const [row, post] of observed) {
      if (row.parentElement === list && row.querySelector(POST_FRAME_SELECTOR) === post.frame &&
          row.getAttribute('data-index') === post.index && post.frame.getAttribute('data-href') === post.href) continue;
      observer.unobserve(row);
      post.frame.removeAttribute(READY);
      observed.delete(row);
    }
    for (const row of list.children) {
      if (observed.has(row) || !row.matches('li[data-index]')) continue;
      const index = row.getAttribute('data-index')!;
      const frame = row.querySelector(POST_FRAME_SELECTOR);
      const identity = frameIdentity(frame);
      if (!frame || !identity || !/^\d+$/.test(index)) continue;
      const href = frame.getAttribute('data-href')!;
      frame.setAttribute(READY, identity.tweetId);
      observed.set(row, { frame, href, index, id: identity.tweetId });
      observer.observe(row, { box: 'border-box' });
    }
  }

  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  return {
    sync,
    reset,
    destroy() {
      reset();
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter(s => s !== sheet);
    },
  };
}
