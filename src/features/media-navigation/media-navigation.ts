export type XMediaKind = 'photo' | 'video';

export interface XMediaEntry {
  handle: string;
  tweetId: string;
  kind: XMediaKind;
  href: string;
}

export interface XMediaRoute extends XMediaEntry {
  index: number;
}

const X_MEDIA_ROUTE_PATTERN =
  /^\/([a-z0-9_]{1,15})\/status\/(\d+)\/(photo|video)\/(\d+)\/?$/i;

export function parseXMediaRoute(value: string | URL): XMediaRoute | null {
  try {
    const url = value instanceof URL ? value : new URL(value, 'https://x.com');
    const match = X_MEDIA_ROUTE_PATTERN.exec(url.pathname);
    const handle = match?.[1]?.toLowerCase();
    const tweetId = match?.[2];
    const kind = match?.[3]?.toLowerCase() as XMediaKind | undefined;
    const indexText = match?.[4];
    const index = indexText ? Number.parseInt(indexText, 10) : 0;

    if (!handle || !tweetId || !kind || index < 1) {
      return null;
    }

    return {
      handle,
      tweetId,
      kind,
      index,
      href: `/${handle}/status/${tweetId}/${kind}/1`,
    };
  } catch {
    return null;
  }
}

function deduplicate(entries: readonly XMediaEntry[]): XMediaEntry[] {
  const seenTweetIds = new Set<string>();
  const result: XMediaEntry[] = [];

  for (const entry of entries) {
    if (seenTweetIds.has(entry.tweetId)) {
      continue;
    }
    seenTweetIds.add(entry.tweetId);
    result.push(entry);
  }

  return result;
}

interface BatchAlignment {
  offset: number;
  overlap: number;
}

function findBatchAlignment(
  current: readonly XMediaEntry[],
  batch: readonly XMediaEntry[],
): BatchAlignment | null {
  let best: BatchAlignment | null = null;

  for (let currentIndex = 0; currentIndex < current.length; currentIndex += 1) {
    for (let batchIndex = 0; batchIndex < batch.length; batchIndex += 1) {
      if (current[currentIndex]?.tweetId !== batch[batchIndex]?.tweetId) {
        continue;
      }

      const offset = currentIndex - batchIndex;
      const start = Math.max(0, offset);
      const end = Math.min(current.length, offset + batch.length);
      let valid = true;
      let overlap = 0;

      for (let index = start; index < end; index += 1) {
        const batchEntry = batch[index - offset];
        if (!batchEntry || current[index]?.tweetId !== batchEntry.tweetId) {
          valid = false;
          break;
        }
        overlap += 1;
      }

      if (valid && overlap > 0 && (!best || overlap > best.overlap)) {
        best = { offset, overlap };
      }
    }
  }

  return best;
}

export function mergeOrderedMediaEntries(
  currentEntries: readonly XMediaEntry[],
  batchEntries: readonly XMediaEntry[],
): XMediaEntry[] {
  const current = deduplicate(currentEntries);
  const batch = deduplicate(batchEntries);

  if (current.length === 0) {
    return batch;
  }
  if (batch.length === 0) {
    return current;
  }

  const alignment = findBatchAlignment(current, batch);
  if (!alignment) {
    return current;
  }

  const start = Math.min(0, alignment.offset);
  const end = Math.max(current.length, alignment.offset + batch.length);
  const merged: XMediaEntry[] = [];

  for (let position = start; position < end; position += 1) {
    const currentEntry = current[position];
    const batchEntry = batch[position - alignment.offset];
    const entry = currentEntry ?? batchEntry;
    if (entry) {
      merged.push(entry);
    }
  }

  return deduplicate(merged);
}
