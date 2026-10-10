import {
  parseTwitterOriginalImage,
  type TwitterOriginalImage,
} from '../../features/image-download/image-download';
import { parseXMediaRoute } from '../../features/media-navigation/media-navigation';

export interface XImageDownloadTarget {
  anchor: HTMLElement;
  image: HTMLImageElement;
  original: TwitterOriginalImage;
  handle: string | null;
  tweetId: string | null;
  photoIndex: number | null;
}

export interface MountedXImageDownloadControl {
  isConnected(): boolean;
  destroy(): void;
}

export type MountXImageDownloadControl = (
  target: XImageDownloadTarget,
  resolveTarget: () => XImageDownloadTarget | null,
) => MountedXImageDownloadControl;

export function readXImageDownloadTarget(
  anchor: HTMLElement,
  pageUrl: URL = new URL(window.location.href),
): XImageDownloadTarget | null {
  if (
    !anchor.matches('[data-testid="tweetPhoto"]') ||
    anchor.closest('[data-testid="videoPlayer"]') ||
    anchor.querySelector(
      'video, [data-testid="videoPlayer"], [data-testid="playButton"]',
    )
  ) {
    return null;
  }

  const image = anchor.querySelector<HTMLImageElement>('img');
  // X can reuse an img before currentSrc catches up with its new src.
  const source = image?.getAttribute('srcset')
    ? image.currentSrc || image.src
    : image?.src;
  const original = source ? parseTwitterOriginalImage(source) : null;
  if (!image || !original) {
    return null;
  }

  const photoLink = anchor.closest<HTMLAnchorElement>('a[href]');
  let route = photoLink ? parseXMediaRoute(photoLink.href) : null;
  if (route?.kind !== 'photo') {
    route = null;
  }
  if (!route && anchor.closest('[role="dialog"]') && !anchor.closest('article')) {
    const viewerRoute = parseXMediaRoute(pageUrl);
    route = viewerRoute?.kind === 'photo' ? viewerRoute : null;
  }
  if (!route && !anchor.closest('article')) {
    return null;
  }

  return {
    anchor,
    image,
    original,
    handle: route?.handle ?? null,
    tweetId: route?.tweetId ?? null,
    photoIndex: route?.index ?? null,
  };
}

export function findXImageDownloadTargets(
  root: ParentNode = document,
  pageUrl: URL = new URL(window.location.href),
): XImageDownloadTarget[] {
  return Array.from(root.querySelectorAll<HTMLElement>('[data-testid="tweetPhoto"]'))
    .flatMap((anchor) => {
      const target = readXImageDownloadTarget(anchor, pageUrl);
      return target ? [target] : [];
    });
}

export function createXImageDownloadManager(mount: MountXImageDownloadControl) {
  const entries = new Map<HTMLElement, {
    image: HTMLImageElement;
    signature: string;
    mounted: MountedXImageDownloadControl;
  }>();

  function sync(root: ParentNode = document, pageUrl = new URL(window.location.href)) {
    const anchors = new Set<HTMLElement>();
    for (const target of findXImageDownloadTargets(root, pageUrl)) {
      anchors.add(target.anchor);
      const signature = [
        target.original.url, target.handle, target.tweetId, target.photoIndex,
      ].join('|');
      const existing = entries.get(target.anchor);
      if (
        existing?.signature === signature &&
        existing.image === target.image &&
        existing.mounted.isConnected()
      ) {
        continue;
      }
      existing?.mounted.destroy();
      entries.set(target.anchor, {
        image: target.image,
        signature,
        mounted: mount(target, () =>
          target.anchor.isConnected
            ? readXImageDownloadTarget(target.anchor)
            : null,
        ),
      });
    }

    for (const [anchor, entry] of entries) {
      if (!anchors.has(anchor) || !anchor.isConnected) {
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
