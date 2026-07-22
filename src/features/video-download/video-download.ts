export interface TwitterMediaIdentity {
  family: string;
  id: string;
}

const TWITTER_MEDIA_HOSTS = new Set(['pbs.twimg.com', 'video.twimg.com']);
const VIDEO_FAMILIES = new Set([
  'amplify_video',
  'ext_tw_video',
  'tweet_video',
]);

function stripExtension(value: string): string {
  return value.replace(/\.[a-z0-9]+$/i, '');
}

export function parseTwitterMediaIdentity(
  value: string,
): TwitterMediaIdentity | null {
  try {
    const url = new URL(value, 'https://x.com');
    if (!TWITTER_MEDIA_HOSTS.has(url.hostname.toLowerCase())) {
      return null;
    }

    const segments = url.pathname.split('/').filter(Boolean);
    const rawFamily = segments[0]?.toLowerCase();
    const rawId = segments[1];
    if (!rawFamily || !rawId) {
      return null;
    }

    const family = rawFamily.replace(/_thumb$/, '');
    if (!VIDEO_FAMILIES.has(family)) {
      return null;
    }

    return { family, id: stripExtension(rawId) };
  } catch {
    return null;
  }
}

export function twitterMediaIdentityKey(identity: TwitterMediaIdentity): string {
  return `${identity.family}:${identity.id}`;
}

export function isDownloadableTwitterVideoUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname.toLowerCase() === 'video.twimg.com' &&
      /\.mp4$/i.test(url.pathname) &&
      parseTwitterMediaIdentity(value) !== null
    );
  } catch {
    return false;
  }
}

function videoQualityScore(value: string): number {
  try {
    const pathname = new URL(value).pathname;
    const resolution = pathname.match(/\/(\d+)x(\d+)\//);
    if (!resolution?.[1] || !resolution[2]) {
      return 0;
    }
    return Number(resolution[1]) * Number(resolution[2]);
  } catch {
    return -1;
  }
}

export function findBestTwitterVideoUrls(
  identities: readonly TwitterMediaIdentity[],
  candidates: Iterable<string>,
): string[] {
  const wantedKeys = new Set(identities.map(twitterMediaIdentityKey));
  const bestByIdentity = new Map<string, { url: string; score: number }>();

  for (const candidate of candidates) {
    if (!isDownloadableTwitterVideoUrl(candidate)) {
      continue;
    }

    const identity = parseTwitterMediaIdentity(candidate);
    if (!identity) {
      continue;
    }

    const key = twitterMediaIdentityKey(identity);
    if (!wantedKeys.has(key)) {
      continue;
    }

    const score = videoQualityScore(candidate);
    const existing = bestByIdentity.get(key);
    if (!existing || score > existing.score) {
      bestByIdentity.set(key, { url: candidate, score });
    }
  }

  return identities.flatMap((identity) => {
    const match = bestByIdentity.get(twitterMediaIdentityKey(identity));
    return match ? [match.url] : [];
  });
}

export function createTwitterVideoFilename(
  handle: string | null,
  tweetId: string | null,
  index: number,
  total: number,
): string {
  const identity = [handle, tweetId].filter(Boolean).join('-') || 'video';
  const suffix = total > 1 ? `-${index + 1}` : '';
  return `twitter-${identity}${suffix}.mp4`;
}
