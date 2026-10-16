import {
  findBestTwitterVideoUrls,
  parseTwitterMediaIdentity,
  twitterMediaIdentityKey,
  type TwitterMediaIdentity,
} from '../../features/video-download/video-download';

export interface XVideoDownloadTarget {
  anchor: HTMLElement;
  article: HTMLElement;
  handle: string | null;
  tweetId: string | null;
  identities: TwitterMediaIdentity[];
  directVideoUrls: string[];
}

export interface MountedXVideoDownloadControl {
  updateAppearance(): void;
  destroy(): void;
}

export type MountXVideoDownloadControl = (
  target: XVideoDownloadTarget,
  resolveUrls: () => string[],
) => MountedXVideoDownloadControl;

export type GetXVideoResourceUrls = (
  target: XVideoDownloadTarget,
) => Iterable<string>;

export interface XVideoDownloadManager {
  sync(root?: ParentNode): void;
  destroy(): void;
}

interface TweetIdentity {
  handle: string | null;
  tweetId: string | null;
}

interface MountedEntry {
  signature: string;
  mounted: MountedXVideoDownloadControl;
}

function extractTweetIdentity(article: HTMLElement): TweetIdentity {
  const links = Array.from(
    article.querySelectorAll<HTMLAnchorElement>('a[href*="/status/"]'),
  );
  const canonicalLink = links.find((link) => link.querySelector('time')) ?? links[0];
  if (!canonicalLink) {
    return { handle: null, tweetId: null };
  }

  try {
    const pathname = new URL(
      canonicalLink.getAttribute('href') ?? '',
      'https://x.com',
    ).pathname;
    const match = pathname.match(/^\/([a-z0-9_]+)\/status\/(\d+)/i);
    return {
      handle: match?.[1]?.toLowerCase() ?? null,
      tweetId: match?.[2] ?? null,
    };
  } catch {
    return { handle: null, tweetId: null };
  }
}

function findActionBar(article: HTMLElement): HTMLElement | null {
  for (const group of article.querySelectorAll<HTMLElement>('[role="group"]')) {
    if (
      group.querySelector(
        '[data-testid="reply"], [data-testid="retweet"], [data-testid="unretweet"], [data-testid="like"], [data-testid="unlike"]',
      )
    ) {
      return group;
    }
  }
  return null;
}

function videoUrl(video: HTMLVideoElement): string | null {
  const value = video.currentSrc || video.src;
  return value && !value.startsWith('blob:') ? value : null;
}

export function findXVideoDownloadTargets(
  root: ParentNode = document,
): XVideoDownloadTarget[] {
  const targets: XVideoDownloadTarget[] = [];

  for (const article of root.querySelectorAll<HTMLElement>('article')) {
    const videos = Array.from(article.querySelectorAll<HTMLVideoElement>('video'));
    const hasVideoSurface =
      videos.length > 0 ||
      article.querySelector(
        '[data-testid="videoPlayer"], [data-testid="playButton"]',
      ) !== null;
    if (!hasVideoSurface) {
      continue;
    }

    const anchor = findActionBar(article);
    if (!anchor) {
      continue;
    }

    const identities = new Map<string, TwitterMediaIdentity>();
    const directVideoUrls = new Set<string>();
    for (const video of videos) {
      const sourceUrl = videoUrl(video);
      if (sourceUrl) {
        directVideoUrls.add(sourceUrl);
      }

      for (const value of [video.poster, sourceUrl]) {
        if (!value) {
          continue;
        }
        const identity = parseTwitterMediaIdentity(value);
        if (identity) {
          identities.set(twitterMediaIdentityKey(identity), identity);
        }
      }
    }

    for (const image of article.querySelectorAll<HTMLImageElement>('img[src]')) {
      const identity = parseTwitterMediaIdentity(image.currentSrc || image.src);
      if (identity) {
        identities.set(twitterMediaIdentityKey(identity), identity);
      }
    }

    const tweetIdentity = extractTweetIdentity(article);
    if (identities.size === 0 && !tweetIdentity.tweetId) {
      continue;
    }

    targets.push({
      anchor,
      article,
      ...tweetIdentity,
      identities: [...identities.values()],
      directVideoUrls: [...directVideoUrls],
    });
  }

  return targets;
}

function targetSignature(target: XVideoDownloadTarget): string {
  return [
    target.handle,
    target.tweetId,
    ...target.identities.map(twitterMediaIdentityKey),
  ].join('|');
}

export function createXVideoDownloadManager(
  mount: MountXVideoDownloadControl,
  getResourceUrls: GetXVideoResourceUrls = () =>
    performance.getEntriesByType('resource').map((entry) => entry.name),
): XVideoDownloadManager {
  const entries = new Map<HTMLElement, MountedEntry>();

  function sync(root: ParentNode = document) {
    const targets = findXVideoDownloadTargets(root);
    const visibleAnchors = new Set<HTMLElement>();

    for (const target of targets) {
      visibleAnchors.add(target.anchor);
      const signature = targetSignature(target);
      const existing = entries.get(target.anchor);

      if (existing?.signature === signature) {
        existing.mounted.updateAppearance();
        continue;
      }

      existing?.mounted.destroy();
      const resolveUrls = () => {
        const candidates = [
          ...target.directVideoUrls,
          ...getResourceUrls(target),
        ];
        const identities = new Map(
          target.identities.map((identity) => [
            twitterMediaIdentityKey(identity),
            identity,
          ]),
        );
        if (identities.size === 0) {
          for (const candidate of candidates) {
            const identity = parseTwitterMediaIdentity(candidate);
            if (identity) {
              identities.set(twitterMediaIdentityKey(identity), identity);
            }
          }
        }
        return findBestTwitterVideoUrls([...identities.values()], candidates);
      };
      entries.set(target.anchor, {
        signature,
        mounted: mount(target, resolveUrls),
      });
    }

    for (const [anchor, entry] of entries) {
      if (!visibleAnchors.has(anchor) || !anchor.isConnected) {
        entry.mounted.destroy();
        entries.delete(anchor);
      }
    }
  }

  function destroy() {
    for (const entry of entries.values()) {
      entry.mounted.destroy();
    }
    entries.clear();
  }

  return { sync, destroy };
}
