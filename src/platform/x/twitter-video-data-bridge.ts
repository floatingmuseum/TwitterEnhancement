import {
  isDownloadableTwitterVideoUrl,
  parseTwitterMediaIdentity,
  twitterMediaIdentityKey,
  type TwitterMediaIdentity,
} from '../../features/video-download/video-download';

export const TWITTER_VIDEO_DATA_STORE_ATTRIBUTE =
  'data-twitter-enhancement-video-data';

const MAX_CAPTURED_TWEETS = 300;

export interface CapturedTwitterVideoVariants {
  tweetId: string;
  mediaKeys: string[];
  urls: string[];
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function extractTwitterVideoVariants(
  payload: unknown,
): CapturedTwitterVideoVariants[] {
  const captures = new Map<string, CapturedTwitterVideoVariants>();
  const stack: Array<{ value: unknown; tweetId: string }> = [
    { value: payload, tweetId: '' },
  ];
  const visited = new Set<object>();

  function captureUrl(tweetId: string, url: string) {
    const identity = parseTwitterMediaIdentity(url);
    if (!identity || !isDownloadableTwitterVideoUrl(url)) {
      return;
    }

    const existing = captures.get(tweetId);
    captures.set(tweetId, {
      tweetId,
      mediaKeys: [
        ...new Set([
          ...(existing?.mediaKeys ?? []),
          twitterMediaIdentityKey(identity),
        ]),
      ],
      urls: [...new Set([...(existing?.urls ?? []), url])],
    });
  }

  while (stack.length > 0) {
    const entry = stack.pop();
    if (!entry) {
      continue;
    }

    const { value, tweetId } = entry;
    if (typeof value === 'string') {
      captureUrl(tweetId, value);
      continue;
    }

    if (!value || typeof value !== 'object' || visited.has(value)) {
      continue;
    }
    visited.add(value);

    if (Array.isArray(value)) {
      for (let index = value.length - 1; index >= 0; index -= 1) {
        stack.push({ value: value[index], tweetId });
      }
      continue;
    }

    const record = value as JsonRecord;
    const nestedTweetId =
      typeof record.rest_id === 'string' && /^\d+$/.test(record.rest_id)
        ? record.rest_id
        : tweetId;
    const values = Object.values(record);
    for (let index = values.length - 1; index >= 0; index -= 1) {
      stack.push({ value: values[index], tweetId: nestedTweetId });
    }
  }

  return [...captures.values()];
}

export function captureTwitterVideoUrl(
  value: string,
): CapturedTwitterVideoVariants | null {
  const identity = parseTwitterMediaIdentity(value);
  if (!identity || !isDownloadableTwitterVideoUrl(value)) {
    return null;
  }

  return {
    tweetId: '',
    mediaKeys: [twitterMediaIdentityKey(identity)],
    urls: [value],
  };
}

function readStore(documentRoot: Document): CapturedTwitterVideoVariants[] {
  const store = documentRoot.querySelector<HTMLElement>(
    `[${TWITTER_VIDEO_DATA_STORE_ATTRIBUTE}]`,
  );
  if (!store?.textContent) {
    return [];
  }

  try {
    const value = JSON.parse(store.textContent) as unknown;
    return Array.isArray(value) ? (value as CapturedTwitterVideoVariants[]) : [];
  } catch {
    return [];
  }
}

export function publishTwitterVideoVariants(
  documentRoot: Document,
  additions: readonly CapturedTwitterVideoVariants[],
): void {
  if (additions.length === 0) {
    return;
  }

  const captures = new Map(readStore(documentRoot).map((item) => [item.tweetId, item]));
  for (const addition of additions) {
    const existing = captures.get(addition.tweetId);
    captures.delete(addition.tweetId);
    captures.set(addition.tweetId, {
      tweetId: addition.tweetId,
      mediaKeys: [...new Set([...(existing?.mediaKeys ?? []), ...addition.mediaKeys])],
      urls: [...new Set([...(existing?.urls ?? []), ...addition.urls])],
    });
  }

  while (captures.size > MAX_CAPTURED_TWEETS) {
    const oldestTweetId = captures.keys().next().value as string | undefined;
    if (!oldestTweetId) {
      break;
    }
    captures.delete(oldestTweetId);
  }

  let store = documentRoot.querySelector<HTMLElement>(
    `[${TWITTER_VIDEO_DATA_STORE_ATTRIBUTE}]`,
  );
  if (!store) {
    store = documentRoot.createElement('script');
    store.hidden = true;
    store.setAttribute('type', 'application/json');
    store.setAttribute(TWITTER_VIDEO_DATA_STORE_ATTRIBUTE, '');
    (documentRoot.head ?? documentRoot.documentElement).append(store);
  }
  store.textContent = JSON.stringify([...captures.values()]);
}

export function ensureTwitterVideoDataStore(documentRoot: Document): void {
  if (
    documentRoot.querySelector(`[${TWITTER_VIDEO_DATA_STORE_ATTRIBUTE}]`)
  ) {
    return;
  }

  const store = documentRoot.createElement('script');
  store.hidden = true;
  store.setAttribute('type', 'application/json');
  store.setAttribute(TWITTER_VIDEO_DATA_STORE_ATTRIBUTE, '');
  store.textContent = '[]';
  (documentRoot.head ?? documentRoot.documentElement).append(store);
}

export function readCapturedTwitterVideoUrls(
  documentRoot: Document,
  tweetId: string | null,
  identities: readonly TwitterMediaIdentity[],
): string[] {
  const wantedMediaKeys = new Set(identities.map(twitterMediaIdentityKey));
  const urls = new Set<string>();

  for (const capture of readStore(documentRoot)) {
    const tweetMatches = Boolean(tweetId) && capture.tweetId === tweetId;
    const mediaMatches = capture.mediaKeys.some((key) => wantedMediaKeys.has(key));
    if (tweetMatches || mediaMatches) {
      for (const url of capture.urls) {
        if (isDownloadableTwitterVideoUrl(url)) {
          urls.add(url);
        }
      }
    }
  }

  return [...urls];
}
