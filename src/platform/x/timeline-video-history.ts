// This is attached to the originating browser history entry only. A new visit
// to the same URL must not inherit the previous feed's scroll position.
const KEY = '__teVideoReturn';

export interface TimelineVideoPosition {
  path: string;
  id?: string;
  feedId?: string;
  nested: boolean;
  scroll: number;
  top: number;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype;
}

function updateState(nav: Navigation, state: Record<string, unknown> | null) {
  try {
    nav.updateCurrentEntry({ state });
  } catch {
    // Chromium can invalidate the entry while a document is navigating away.
  }
}

export function saveVideoReturn(position: TimelineVideoPosition, viewerUrl: string) {
  const nav = window.navigation;
  if (!nav?.currentEntry) return;
  const state: unknown = nav.currentEntry.getState();
  if (state != null && !record(state)) return;
  const { path, id, feedId, nested, scroll, top } = position;
  updateState(nav, { ...state, [KEY]: { path, id, feedId, nested, scroll, top, viewerUrl, emptyState: state == null } });
}

export function takeVideoReturn(): TimelineVideoPosition | null {
  const nav = window.navigation;
  if (!nav?.currentEntry) return null;
  const state: unknown = nav.currentEntry.getState();
  const activation = nav.activation;
  let saved: unknown;
  if (record(state) && Object.hasOwn(state, KEY)) {
    const { [KEY]: checkpoint, ...rest } = state;
    const wasEmpty = record(checkpoint) && checkpoint.emptyState === true;
    updateState(nav, wasEmpty && !Object.keys(rest).length ? null : rest);
    if (activation?.navigationType !== 'traverse') return null;
    saved = checkpoint;
  } else {
    // The native close button can replace the viewer with a new feed entry.
    // Only follow the adjacent feed → exact viewer → same feed sequence.
    if (!activation?.from?.url || (activation.navigationType !== 'replace' && activation.navigationType !== 'push')) return null;
    const distance = activation.navigationType === 'replace' ? 1 : 2;
    const source = nav.entries()[nav.currentEntry.index - distance];
    if (source?.url !== location.href) return null;
    const prior: unknown = source.getState();
    if (!record(prior)) return null;
    saved = prior[KEY];
  }
  if (!record(saved) || !activation?.from?.url || saved.viewerUrl !== activation.from.url) return null;
  const { path, id, feedId, nested, scroll, top } = saved;
  if (path !== location.pathname + location.search || typeof path !== 'string' ||
      typeof nested !== 'boolean' || typeof scroll !== 'number' || !Number.isFinite(scroll) || scroll < 0 ||
      typeof top !== 'number' || !Number.isFinite(top) ||
      (id !== undefined && (typeof id !== 'string' || !/^\d+$/.test(id))) ||
      (feedId !== undefined && typeof feedId !== 'string')) return null;
  return { path, id, feedId, nested, scroll, top };
}
