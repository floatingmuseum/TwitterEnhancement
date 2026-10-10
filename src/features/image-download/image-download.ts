export interface TwitterOriginalImage {
  id: string;
  format: string;
  url: string;
}

const IMAGE_PATH =
  /^\/media\/([a-z0-9_-]+)(?:\.(jpg|jpeg|png|webp|gif))?(?::(?:orig|large|medium|small|thumb))?$/i;
const IMAGE_FORMATS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);

export function parseTwitterOriginalImage(
  value: string,
): TwitterOriginalImage | null {
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'pbs.twimg.com' ||
      url.port ||
      url.username ||
      url.password
    ) {
      return null;
    }

    const match = IMAGE_PATH.exec(url.pathname);
    const id = match?.[1];
    const rawFormat = (
      url.searchParams.get('format') ?? match?.[2] ?? ''
    ).toLowerCase();
    if (!id || !IMAGE_FORMATS.has(rawFormat)) {
      return null;
    }

    const format = rawFormat === 'jpeg' ? 'jpg' : rawFormat;
    return {
      id,
      format,
      url: `https://pbs.twimg.com/media/${id}?format=${format}&name=orig`,
    };
  } catch {
    return null;
  }
}

export function createTwitterImageFilename(
  image: TwitterOriginalImage,
  handle: string | null,
  tweetId: string | null,
  photoIndex: number | null,
): string {
  const author = handle && /^[a-z0-9_]{1,15}$/i.test(handle)
    ? handle.toLowerCase()
    : null;
  const post = tweetId && /^\d+$/.test(tweetId) ? tweetId : null;
  const index = photoIndex !== null && Number.isSafeInteger(photoIndex) && photoIndex > 0
    ? String(photoIndex)
    : image.id;
  const identity = author && post ? `${author}-${post}-${index}` : image.id;
  return `twitter-${identity}-orig.${image.format}`;
}
