import { parseTwitterOriginalImage } from './image-download';

export const DOWNLOAD_TWITTER_IMAGE_MESSAGE =
  'twitter-enhancement:download-image' as const;

export interface DownloadTwitterImageMessage {
  type: typeof DOWNLOAD_TWITTER_IMAGE_MESSAGE;
  url: string;
  filename: string;
}

export interface DownloadTwitterImageResponse {
  ok: boolean;
  error?: string;
}

export function isDownloadTwitterImageMessage(
  value: unknown,
): value is DownloadTwitterImageMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const message = value as Partial<DownloadTwitterImageMessage>;
  if (
    message.type !== DOWNLOAD_TWITTER_IMAGE_MESSAGE ||
    typeof message.url !== 'string'
  ) {
    return false;
  }
  const image = parseTwitterOriginalImage(message.url);
  return (
    image !== null &&
    image.url === message.url &&
    typeof message.filename === 'string' &&
    /^twitter-[a-z0-9_-]+-orig\.(jpg|png|webp|gif)$/i.test(message.filename) &&
    message.filename.endsWith(`.${image.format}`)
  );
}
