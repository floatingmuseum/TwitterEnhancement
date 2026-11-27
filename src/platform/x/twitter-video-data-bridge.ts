import {
  isDownloadableTwitterVideoUrl,
  parseTwitterMediaIdentity,
  twitterMediaIdentityKey,
  twitterVideoDurationKey,
  type TwitterMediaIdentity,
} from '../../features/video-download/video-download';

export const TWITTER_VIDEO_DATA_STORE_ATTRIBUTE =
  'data-twitter-enhancement-video-data';

const MAX_CAPTURED_TWEETS = 300;

export interface CapturedTwitterVideoVariants {
  tweetId: string;
  mediaKeys: string[];
  urls: string[];
  durationMsByMediaKey?: Record<string, number>;
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

  function captureMedia(tweetId: string, mediaKey: string) {
    const storeKey = tweetId ? `tweet:${tweetId}` : `media:${mediaKey}`;
    let capture = captures.get(storeKey);
    if (!capture) {
      capture = { tweetId, mediaKeys: [], urls: [] };
      captures.set(storeKey, capture);
    }
    if (!capture.mediaKeys.includes(mediaKey)) capture.mediaKeys.push(mediaKey);
    return capture;
  }

  function captureDuration(tweetId: string, record: JsonRecord) {
    const info = record.video_info ?? record.videoInfo ?? record;
    if (!isRecord(info)) return;
    const ms = info.duration_millis ?? info.durationMillis ?? info.duration_ms ?? info.durationMs;
    if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return;

    // Match only the poster and variants of this attachment, never its siblings.
    const sources = [record.media_url_https, record.mediaUrlHttps, record.preview_image_url];
    if (Array.isArray(info.variants)) {
      for (const variant of info.variants) {
        if (isRecord(variant)) sources.push(variant.url ?? variant.src);
      }
    }
    for (const source of sources) {
      const key = typeof source === 'string' && twitterVideoDurationKey(source);
      if (!key || key.startsWith('tweet_video:') || record.type === 'animated_gif') continue;
      const capture = captureMedia(tweetId, key);
      const durations = capture.durationMsByMediaKey ??= {};
      durations[key] = ms;
    }
  }

  while (stack.length > 0) {
    const entry = stack.pop();
    if (!entry) {
      continue;
    }

    const { value, tweetId } = entry;
    if (typeof value === 'string') {
      const identity = parseTwitterMediaIdentity(value);
      if (identity && isDownloadableTwitterVideoUrl(value)) {
        const capture = captureMedia(tweetId, twitterMediaIdentityKey(identity));
        if (!capture.urls.includes(value)) capture.urls.push(value);
      }
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
    captureDuration(nestedTweetId, record);
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

/** X streams the first Relay results as JSON strings inside self-removing scripts. */
export function captureInitialTwitterVideoData(root: Document): void {
  function readScript(script: HTMLScriptElement) {
    if (script.hasAttribute('src')) return;
    const source = script.textContent ?? '';
    if (!source.includes('duration_millis') && !source.includes('durationMillis') &&
        !source.includes('duration_ms') && !source.includes('durationMs')) return;
    const results = /\bkind:\s*"Result\.Ok"\s*,\s*value:\s*("(?:[^"\\]|\\.)*")/g;
    for (const match of source.matchAll(results)) {
      try {
        // Decode only the serialized result. The surrounding page script is executable JS.
        const payload: unknown = JSON.parse(JSON.parse(match[1]!));
        publishTwitterVideoVariants(root, extractTwitterVideoVariants(payload));
      } catch {
        // The parser can deliver a partially written script in an earlier batch.
      }
    }
  }

  function readAddedScripts(records: MutationRecord[]) {
    const scripts = new Set<HTMLScriptElement>();
    for (const record of records) {
      if (record.target instanceof HTMLScriptElement) scripts.add(record.target);
      for (const node of record.addedNodes) {
        if (node instanceof HTMLScriptElement) scripts.add(node);
      }
    }
    for (const script of scripts) readScript(script);
  }

  if (root.readyState === 'loading') {
    const observer = new MutationObserver(readAddedScripts);
    observer.observe(root, { childList: true, subtree: true });
    root.addEventListener('DOMContentLoaded', () => {
      readAddedScripts(observer.takeRecords());
      observer.disconnect();
    }, { once: true });
  }
  for (const script of Array.from(root.scripts)) readScript(script);
}

function captureStoreKey(item: CapturedTwitterVideoVariants): string {
  return item.tweetId
    ? `tweet:${item.tweetId}`
    : `media:${item.mediaKeys.join('|')}`;
}

function readStoreText(documentRoot: Document): string {
  return documentRoot.querySelector(
    `[${TWITTER_VIDEO_DATA_STORE_ATTRIBUTE}]`,
  )?.textContent ?? '';
}

function parseStore(text: string): CapturedTwitterVideoVariants[] {
  if (!text) {
    return [];
  }

  try {
    const value: unknown = JSON.parse(text);
    return Array.isArray(value) ? value.filter(item =>
      isRecord(item) && Array.isArray(item.mediaKeys) && Array.isArray(item.urls),
    ) : [];
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

  const captures = new Map(
    parseStore(readStoreText(documentRoot)).map((item) => [captureStoreKey(item), item]),
  );
  for (const addition of additions) {
    const key = captureStoreKey(addition);
    const existing = captures.get(key);
    captures.delete(key);
    captures.set(key, {
      tweetId: addition.tweetId,
      mediaKeys: [...new Set([...(existing?.mediaKeys ?? []), ...addition.mediaKeys])],
      urls: [...new Set([...(existing?.urls ?? []), ...addition.urls])],
      durationMsByMediaKey: existing?.durationMsByMediaKey || addition.durationMsByMediaKey
        ? { ...existing?.durationMsByMediaKey, ...addition.durationMsByMediaKey }
        : undefined,
    });
  }

  while (captures.size > MAX_CAPTURED_TWEETS) {
    const oldestKey = captures.keys().next().value as string | undefined;
    if (!oldestKey) {
      break;
    }
    captures.delete(oldestKey);
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

  for (const capture of parseStore(readStoreText(documentRoot))) {
    const tweetMatches = Boolean(tweetId) && capture.tweetId === tweetId;
    const mediaMatches = capture.mediaKeys.some((key) => wantedMediaKeys.has(key));
    if (!tweetMatches && !mediaMatches) {
      continue;
    }

    for (const url of capture.urls) {
      if (!isDownloadableTwitterVideoUrl(url)) {
        continue;
      }
      if (wantedMediaKeys.size > 0) {
        const identity = parseTwitterMediaIdentity(url);
        if (!identity || !wantedMediaKeys.has(twitterMediaIdentityKey(identity))) {
          continue;
        }
      }
      urls.add(url);
    }
  }

  return [...urls];
}

// Timeline scans are frequent; rebuild the media index only when X publishes data.
export function createTwitterVideoDurationReader(documentRoot: Document) {
  let previousText = '';
  const durations = new Map<string, number>();
  return (): ReadonlyMap<string, number> => {
    const text = readStoreText(documentRoot);
    if (text !== previousText) {
      previousText = text;
      durations.clear();
      for (const capture of parseStore(text)) {
        for (const [key, ms] of Object.entries(capture.durationMsByMediaKey ?? {})) {
          if (Number.isFinite(ms) && ms > 0) durations.set(key, ms / 1000);
        }
      }
    }
    return durations;
  };
}
