export interface ExternalVideoLink {
  url: string;
  provider: string;
}

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
]);
const YOUTUBE_EMBED_HOSTS = new Set([
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);
const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com']);
const DAILYMOTION_HOSTS = new Set(['dailymotion.com', 'www.dailymotion.com']);
const BILIBILI_HOSTS = new Set(['bilibili.com', 'www.bilibili.com', 'm.bilibili.com']);
const TWITCH_HOSTS = new Set(['twitch.tv', 'www.twitch.tv', 'm.twitch.tv']);
const INTERNAL_HOSTS = ['x.com', 'twitter.com', 't.co', 'twimg.com'];

function parseWebUrl(value: string): URL | null {
  try {
    if (!/^https?:\/\//i.test(value.trim())) {
      return null;
    }
    const url = new URL(value);
    return !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

function hostname(url: URL): string {
  return url.hostname.toLowerCase().replace(/\.$/, '');
}

function result(url: URL, provider: string): ExternalVideoLink {
  return { url: url.href, provider };
}

function isYouTubeVideoId(value: string): boolean {
  return /^[\w-]{11}$/.test(value) && value !== 'videoseries';
}

function youtubeWatchUrl(url: URL, id: string): ExternalVideoLink {
  url.hostname = 'www.youtube.com';
  url.pathname = '/watch';
  url.searchParams.set('v', id);
  const start = url.searchParams.get('start');
  if (start && !url.searchParams.has('t')) {
    url.searchParams.set('t', start);
  }
  url.searchParams.delete('start');
  for (const parameter of ['autoplay', 'auto_play', 'enablejsapi', 'origin', 'widget_referrer']) {
    url.searchParams.delete(parameter);
  }
  return result(url, 'YouTube');
}

/** Accept specific video pages and recognized players, never provider homepages. */
export function parseExternalVideoUrl(value: string): ExternalVideoLink | null {
  const url = parseWebUrl(value);
  if (!url) {
    return null;
  }
  const host = hostname(url);
  const path = url.pathname.replace(/\/$/, '');

  if (YOUTUBE_HOSTS.has(host)) {
    if (path === '/watch' && isYouTubeVideoId(url.searchParams.get('v') ?? '')) {
      return result(url, 'YouTube');
    }
    const video = path.match(/^\/(embed|shorts|live)\/([\w-]{11})$/);
    if (video?.[2] && isYouTubeVideoId(video[2])) {
      return video[1] === 'embed'
        ? youtubeWatchUrl(url, video[2])
        : result(url, 'YouTube');
    }
    return null;
  }

  if (YOUTUBE_EMBED_HOSTS.has(host)) {
    const video = path.match(/^\/embed\/([\w-]{11})$/);
    return video?.[1] && isYouTubeVideoId(video[1]) ? youtubeWatchUrl(url, video[1]) : null;
  }

  if (host === 'youtu.be' || host === 'www.youtu.be') {
    return isYouTubeVideoId(path.slice(1)) ? result(url, 'YouTube') : null;
  }

  if (VIMEO_HOSTS.has(host)) {
    if (host === 'player.vimeo.com') {
      const video = path.match(/^\/video\/(\d+)$/);
      if (!video?.[1]) {
        return null;
      }
      url.hostname = 'vimeo.com';
      url.pathname = `/${video[1]}`;
      return result(url, 'Vimeo');
    }
    return /^\/\d+(?:\/[a-zA-Z0-9]+)?$/.test(path) ? result(url, 'Vimeo') : null;
  }

  if (DAILYMOTION_HOSTS.has(host)) {
    const video = path.match(/^\/(embed\/)?video\/([a-zA-Z0-9_-]+)$/);
    if (!video?.[2]) {
      return null;
    }
    if (video[1]) {
      url.pathname = `/video/${video[2]}`;
    }
    return result(url, 'Dailymotion');
  }

  if (host === 'dai.ly' || host === 'www.dai.ly') {
    return /^\/[a-zA-Z0-9]+$/.test(path) ? result(url, 'Dailymotion') : null;
  }

  if (BILIBILI_HOSTS.has(host)) {
    return /^\/video\/(?:BV[a-zA-Z0-9]{10}|av\d+)$/i.test(path)
      ? result(url, '哔哩哔哩')
      : null;
  }

  if (TWITCH_HOSTS.has(host)) {
    return /^\/(?:videos\/\d+|[a-zA-Z0-9_]+\/clip\/[a-zA-Z0-9_-]+)$/.test(path)
      ? result(url, 'Twitch')
      : null;
  }

  if (host === 'clips.twitch.tv') {
    return /^\/[a-zA-Z0-9_-]+$/.test(path) && path !== '/embed'
      ? result(url, 'Twitch')
      : null;
  }

  return null;
}

/** Only call for a confirmed player card's canonical page, never an arbitrary iframe src. */
export function parseExternalPlayerPageUrl(value: string): ExternalVideoLink | null {
  const url = parseWebUrl(value);
  if (!url) {
    return null;
  }
  const host = hostname(url);
  if (INTERNAL_HOSTS.some((internal) => host === internal || host.endsWith(`.${internal}`))) {
    return null;
  }

  const knownVideo = parseExternalVideoUrl(value);
  if (knownVideo) {
    return knownVideo;
  }

  // Known providers must still point to a video, not an account or redirect page.
  if (
    YOUTUBE_HOSTS.has(host) || YOUTUBE_EMBED_HOSTS.has(host) ||
    host === 'youtu.be' || host === 'www.youtu.be' || VIMEO_HOSTS.has(host) ||
    DAILYMOTION_HOSTS.has(host) || host === 'dai.ly' || host === 'www.dai.ly' ||
    BILIBILI_HOSTS.has(host) || TWITCH_HOSTS.has(host) || host === 'clips.twitch.tv' ||
    /\.(?:mp4|webm|mov|m4v|m3u8|mpd|mp3|m4a|jpg|jpeg|png|gif|webp|svg)$/i.test(url.pathname) ||
    /\/(?:embed|iframe|player)(?:\/|$)/i.test(url.pathname)
  ) {
    return null;
  }

  return result(url, host.replace(/^www\./, ''));
}
