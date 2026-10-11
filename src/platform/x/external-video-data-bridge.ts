export const EXTERNAL_VIDEO_DATA_STORE_ATTRIBUTE =
  'data-twitter-enhancement-external-video-data';
export const EXTERNAL_VIDEO_DATA_EVENT = 'twitter-enhancement:external-video-data';

const MAX_CAPTURED_CARDS = 300;

export interface CapturedExternalVideoCard {
  tweetId: string;
  cardUrl: string;
  url: string;
  playerUrl: string | null;
  isPlayer: boolean;
  imageUrls: string[];
}

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function cardKey(card: CapturedExternalVideoCard): string {
  return `${card.tweetId}\u0000${card.cardUrl}`;
}

function readBindings(card: JsonRecord): Map<string, JsonRecord> {
  const bindings = new Map<string, JsonRecord>();
  if (Array.isArray(card.binding_values)) {
    for (const item of card.binding_values) {
      const entry = record(item);
      const value = record(entry?.value);
      if (typeof entry?.key === 'string' && value) {
        bindings.set(entry.key, value);
      }
    }
  } else {
    for (const [key, value] of Object.entries(record(card.binding_values) ?? {})) {
      const binding = record(value);
      if (binding) {
        bindings.set(key, binding);
      }
    }
  }
  return bindings;
}

function ownUrlExpansions(tweet: JsonRecord): Map<string, string> {
  const expansions = new Map<string, string>();
  const legacy = record(tweet.legacy);
  const note = record(record(record(tweet.note_tweet)?.note_tweet_results)?.result);
  const entitySets = [record(legacy?.entities), record(tweet.entities), record(note?.entity_set)];
  for (const entities of entitySets) {
    if (!Array.isArray(entities?.urls)) {
      continue;
    }
    for (const value of entities.urls) {
      const entity = record(value);
      if (!entity) {
        continue;
      }
      const original = safeUrl(entity.url);
      const expanded = safeUrl(entity.expanded_url);
      const unwound = safeUrl(entity.unwound_url) ?? safeUrl(record(entity.unwound)?.url);
      const destination = unwound ?? expanded;
      if (original && destination) {
        expansions.set(original, destination);
      }
      if (expanded && unwound) {
        expansions.set(expanded, unwound);
      }
    }
  }
  return expansions;
}

function extractCard(tweet: JsonRecord): CapturedExternalVideoCard | null {
  const legacy = record(tweet.legacy);
  const tweetId = tweet.rest_id ?? tweet.id_str ?? legacy?.id_str;
  const rawCard = record(tweet.card);
  const card = record(rawCard?.legacy) ?? rawCard;
  if (typeof tweetId !== 'string' || !/^\d+$/.test(tweetId) || !card) {
    return null;
  }

  const bindings = readBindings(card);
  const bindingUrl = safeUrl(bindings.get('card_url')?.string_value);
  const originalUrl = safeUrl(card.url);
  const playerUrl = safeUrl(bindings.get('player_url')?.string_value);
  const expansions = ownUrlExpansions(tweet);
  const expanded = (url: string | null) => {
    if (!url || !expansions.has(url)) {
      return null;
    }
    const visited = new Set<string>();
    let current = url;
    while (expansions.has(current) && !visited.has(current)) {
      visited.add(current);
      current = expansions.get(current) ?? current;
    }
    return current;
  };
  const directBindingUrl = bindingUrl && new URL(bindingUrl).hostname !== 't.co'
    ? bindingUrl
    : null;
  const directOriginalUrl = originalUrl && new URL(originalUrl).hostname !== 't.co'
    ? originalUrl
    : null;
  const url = expanded(bindingUrl) ?? directBindingUrl ?? expanded(originalUrl)
    ?? directOriginalUrl ?? playerUrl ?? bindingUrl ?? originalUrl;
  const cardUrl = originalUrl ?? bindingUrl ?? playerUrl;
  if (!url || !cardUrl) {
    return null;
  }

  const imageUrls = new Set<string>();
  for (const value of bindings.values()) {
    const imageUrl = safeUrl(record(value.image_value)?.url);
    if (imageUrl) {
      imageUrls.add(imageUrl);
    }
  }
  return {
    tweetId,
    cardUrl,
    url,
    playerUrl,
    isPlayer: Boolean(playerUrl) || (typeof card.name === 'string' && /(?:^|:)player$/i.test(card.name)),
    imageUrls: [...imageUrls],
  };
}

export function extractExternalVideoCards(payload: unknown): CapturedExternalVideoCard[] {
  const captures = new Map<string, CapturedExternalVideoCard>();
  const stack = [payload];
  const visited = new Set<object>();
  while (stack.length > 0) {
    const value = stack.pop();
    if (!value || typeof value !== 'object' || visited.has(value)) {
      continue;
    }
    visited.add(value);
    if (Array.isArray(value)) {
      for (const child of value) {
        stack.push(child);
      }
      continue;
    }
    const current = value as JsonRecord;
    const capture = extractCard(current);
    if (capture) {
      captures.set(cardKey(capture), capture);
    }
    for (const child of Object.values(current)) {
      stack.push(child);
    }
  }
  return [...captures.values()];
}

function validateCapture(value: unknown): CapturedExternalVideoCard | null {
  const item = record(value);
  const cardUrl = safeUrl(item?.cardUrl);
  const url = safeUrl(item?.url);
  if (typeof item?.tweetId !== 'string' || !/^\d+$/.test(item.tweetId) || !cardUrl || !url) {
    return null;
  }
  return {
    tweetId: item.tweetId,
    cardUrl,
    url,
    playerUrl: safeUrl(item.playerUrl),
    isPlayer: item.isPlayer === true,
    imageUrls: Array.isArray(item.imageUrls)
      ? [...new Set(item.imageUrls.flatMap((image) => safeUrl(image) ?? []))]
      : [],
  };
}

export function readCapturedExternalVideoCards(documentRoot: Document): CapturedExternalVideoCard[] {
  const store = documentRoot.querySelector(`[${EXTERNAL_VIDEO_DATA_STORE_ATTRIBUTE}]`);
  try {
    const parsed: unknown = JSON.parse(store?.textContent ?? '[]');
    return Array.isArray(parsed)
      ? parsed.flatMap((value) => validateCapture(value) ?? []).slice(-MAX_CAPTURED_CARDS)
      : [];
  } catch {
    return [];
  }
}

export function ensureExternalVideoDataStore(documentRoot: Document): void {
  if (documentRoot.querySelector(`[${EXTERNAL_VIDEO_DATA_STORE_ATTRIBUTE}]`)) {
    return;
  }
  const store = documentRoot.createElement('script');
  store.hidden = true;
  store.type = 'application/json';
  store.setAttribute(EXTERNAL_VIDEO_DATA_STORE_ATTRIBUTE, '');
  store.textContent = '[]';
  (documentRoot.head ?? documentRoot.documentElement).append(store);
}

export function publishExternalVideoCards(
  documentRoot: Document,
  additions: readonly CapturedExternalVideoCard[],
): void {
  if (additions.length === 0) {
    return;
  }
  const captures = new Map(readCapturedExternalVideoCards(documentRoot).map((item) => [cardKey(item), item]));
  for (const addition of additions) {
    const validated = validateCapture(addition);
    if (validated) {
      captures.set(cardKey(validated), validated);
    }
  }
  const contents = JSON.stringify([...captures.values()].slice(-MAX_CAPTURED_CARDS));
  ensureExternalVideoDataStore(documentRoot);
  const store = documentRoot.querySelector(`[${EXTERNAL_VIDEO_DATA_STORE_ATTRIBUTE}]`);
  if (!store || store.textContent === contents) {
    return;
  }
  store.textContent = contents;
  const event = documentRoot.createEvent('Event');
  event.initEvent(EXTERNAL_VIDEO_DATA_EVENT, false, false);
  documentRoot.dispatchEvent(event);
}
