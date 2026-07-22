import { isDownloadableTwitterVideoUrl } from './video-download';

export const DOWNLOAD_TWITTER_VIDEO_MESSAGE =
  'twitter-enhancement:download-video' as const;

export interface DownloadTwitterVideoMessage {
  type: typeof DOWNLOAD_TWITTER_VIDEO_MESSAGE;
  url: string;
  filename: string;
}

export interface DownloadTwitterVideoResponse {
  ok: boolean;
  error?: string;
}

export function isDownloadTwitterVideoMessage(
  value: unknown,
): value is DownloadTwitterVideoMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const message = value as Partial<DownloadTwitterVideoMessage>;
  return (
    message.type === DOWNLOAD_TWITTER_VIDEO_MESSAGE &&
    typeof message.url === 'string' &&
    isDownloadableTwitterVideoUrl(message.url) &&
    typeof message.filename === 'string' &&
    /^twitter-[a-z0-9_-]+\.mp4$/i.test(message.filename)
  );
}
