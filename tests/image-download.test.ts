import {
  createTwitterImageFilename,
  parseTwitterOriginalImage,
} from '../src/features/image-download/image-download';
import {
  DOWNLOAD_TWITTER_IMAGE_MESSAGE,
  isDownloadTwitterImageMessage,
} from '../src/features/image-download/download-message';

describe('Twitter original image downloads', () => {
  it.each(['small', 'medium', 'large', '4096x4096', 'orig'])(
    'requests the original instead of the %s preview', (size) => {
      expect(parseTwitterOriginalImage(`https://pbs.twimg.com/media/Photo_1?format=png&name=${size}`))
        .toEqual({ id: 'Photo_1', format: 'png', url: 'https://pbs.twimg.com/media/Photo_1?format=png&name=orig' });
    },
  );

  it.each([
    ['Photo_1.jpg:large', 'jpg'],
    ['Photo_1.png', 'png'],
    ['Photo_1.jpeg:orig', 'jpg'],
    ['Photo_1?format=webp&name=small', 'webp'],
    ['Photo_1.gif', 'gif'],
  ])('supports legacy URLs and preserves the image format: %s', (path, format) => {
    expect(parseTwitterOriginalImage(`https://pbs.twimg.com/media/${path}`)?.url)
      .toBe(`https://pbs.twimg.com/media/Photo_1?format=${format}&name=orig`);
  });

  it.each([
    'http://pbs.twimg.com/media/a.jpg',
    'https://pbs.twimg.com.evil.test/media/a.jpg',
    'https://user:password@pbs.twimg.com/media/a.jpg',
    'https://pbs.twimg.com:123/media/a.jpg',
    'https://pbs.twimg.com/profile_images/123/avatar.jpg',
    'https://pbs.twimg.com/ext_tw_video_thumb/123/pu/img/cover.jpg',
    'https://pbs.twimg.com/tweet_video_thumb/a.jpg',
    'https://pbs.twimg.com/card_img/123/cover.jpg',
    'https://pbs.twimg.com/media/a.svg',
    'https://pbs.twimg.com/media/a',
    'https://pbs.twimg.com/media/a.jpg/extra',
    'data:image/png;base64,AAAA',
    'not a URL',
  ])('rejects unsupported or unrelated resources: %s', (value) => {
    expect(parseTwitterOriginalImage(value)).toBeNull();
  });

  it('names each photo using its own tweet and index, with a safe media-id fallback', () => {
    const image = parseTwitterOriginalImage('https://pbs.twimg.com/media/Photo_1.png')!;
    expect(createTwitterImageFilename(image, 'Alice', '123', 2)).toBe('twitter-alice-123-2-orig.png');
    expect(createTwitterImageFilename(image, null, null, null)).toBe('twitter-Photo_1-orig.png');
    expect(createTwitterImageFilename(image, '../bad', '123', 2)).toBe('twitter-Photo_1-orig.png');
  });

  it('accepts only canonical original URLs and safe matching image filenames in messages', () => {
    const message = {
      type: DOWNLOAD_TWITTER_IMAGE_MESSAGE,
      url: 'https://pbs.twimg.com/media/Photo_1?format=png&name=orig',
      filename: 'twitter-alice-123-1-orig.png',
    };
    expect(isDownloadTwitterImageMessage(message)).toBe(true);
    for (const change of [
      { url: message.url.replace('orig', 'small') },
      { url: message.url.replace('pbs.twimg.com', 'example.com') },
      { url: `${message.url}&extra=value` },
      { filename: '../twitter-alice-orig.png' },
      { filename: 'twitter-alice-orig.jpg' },
      { filename: 'twitter-alice-orig.exe' },
      { type: 'twitter-enhancement:download-video' },
    ]) {
      expect(isDownloadTwitterImageMessage({ ...message, ...change })).toBe(false);
    }
    expect(isDownloadTwitterImageMessage(null)).toBe(false);
    expect(isDownloadTwitterImageMessage({})).toBe(false);
  });
});
