import { twitterVideoDurationKey } from '../../features/video-download/video-download';
import { createTwitterVideoDurationReader } from './twitter-video-data-bridge';

const POSTER = 'img[src*="_video_thumb/"], img[srcset*="_video_thumb/"], [data-press-control]:has([data-icon="icon-player-play"]) img[src*="pbs.twimg.com/media/"]';
const ATTACHMENT = '[data-testid="videoComponent"], [data-testid="tweetPhoto"]';

function durationLabel(seconds: number): string {
  const total = Math.max(1, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor(total / 60) % 60;
  const clock = hours ? `${hours}:${String(minutes).padStart(2, '0')}` : String(minutes);
  return `${clock}:${String(total % 60).padStart(2, '0')}`;
}

function previewDuration(player: HTMLElement, durations: ReadonlyMap<string, number>): number | undefined {
  const videos = player.querySelectorAll('video');
  const posters = player.querySelectorAll<HTMLImageElement>(POSTER);
  if (videos.length > 1 || posters.length > 1) return;
  const video = videos[0];
  if (video && (!video.paused || video.duration === Infinity)) return;
  const poster = posters[0];
  for (const url of [video?.poster, poster?.currentSrc || poster?.src, video?.currentSrc || video?.src]) {
    const key = url && twitterVideoDurationKey(url);
    if (!key) continue;
    if (key.startsWith('tweet_video:')) return; // X serves animated GIFs as looping MP4s.
    const captured = durations.get(key);
    if (captured !== undefined) return captured;
  }
  if (video && Number.isFinite(video.duration) && video.duration > 0) return video.duration;
}

function mountBadge(anchor: HTMLElement) {
  const badge = anchor.ownerDocument.createElement('span');
  badge.className = 'te-video-duration';
  badge.setAttribute('role', 'img');
  const originalPosition = anchor.style.position;
  const priority = anchor.style.getPropertyPriority('position');
  const needsPosition = ['', 'static'].includes(getComputedStyle(anchor).position);
  if (needsPosition) anchor.style.setProperty('position', 'relative');
  anchor.append(badge);
  return {
    badge,
    destroy() {
      badge.remove();
      if (needsPosition && anchor.style.position === 'relative') {
        anchor.style.setProperty('position', originalPosition, priority);
      }
    },
  };
}

export function createXVideoDurationManager(root: Document = document) {
  const readDurations = createTwitterVideoDurationReader(root);
  const mounted = new Map<HTMLElement, ReturnType<typeof mountBadge>>();

  function sync() {
    const players = new Set<HTMLElement>();
    for (const media of root.querySelectorAll<HTMLElement>(`article :is(video, ${POSTER})`)) {
      const parent = media.parentElement;
      const player = parent?.closest<HTMLElement>('[data-press-control]') ??
        parent?.closest<HTMLElement>(ATTACHMENT) ??
        parent?.closest<HTMLElement>('[data-testid="videoPlayer"]') ?? parent;
      const article = media.closest('article');
      if (player && article?.contains(player) && player !== article && !player.closest('[role="dialog"]')) {
        players.add(player);
      }
    }
    const durations = players.size ? readDurations() : new Map<string, number>();
    const visible = new Set<HTMLElement>();
    for (const player of players) {
      const seconds = previewDuration(player, durations);
      if (seconds === undefined) continue;
      visible.add(player);
      let entry = mounted.get(player);
      if (!entry) {
        entry = mountBadge(player);
        mounted.set(player, entry);
      } else if (entry.badge.parentElement !== player) {
        player.append(entry.badge);
      }
      const label = durationLabel(seconds);
      if (entry.badge.textContent !== label) {
        entry.badge.textContent = label;
        entry.badge.setAttribute('aria-label', `视频时长 ${label}`);
      }
    }
    for (const [player, entry] of mounted) {
      if (visible.has(player)) continue;
      entry.destroy();
      mounted.delete(player);
    }
  }

  return {
    sync,
    destroy() {
      for (const entry of mounted.values()) entry.destroy();
      mounted.clear();
    },
  };
}
