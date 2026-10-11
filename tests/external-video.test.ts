import {
  parseExternalPlayerPageUrl,
  parseExternalVideoUrl,
} from '../src/features/external-video/external-video';

describe('external video links', () => {
  it.each([
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42&list=PLexample',
    'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ?t=42',
    'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    'https://www.youtube.com/live/dQw4w9WgXcQ?feature=share',
  ])('keeps YouTube video page parameters in %s', (url) => {
    expect(parseExternalVideoUrl(url)).toEqual({ url, provider: 'YouTube' });
  });

  it('turns YouTube embeds into watch pages with their start time and playlist', () => {
    const video = parseExternalVideoUrl(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=42&list=PLexample',
    );
    expect(video?.provider).toBe('YouTube');
    const url = new URL(video!.url);
    expect(`${url.origin}${url.pathname}`).toBe('https://www.youtube.com/watch');
    expect(url.searchParams.get('v')).toBe('dQw4w9WgXcQ');
    expect(url.searchParams.get('t')).toBe('42');
    expect(url.searchParams.get('list')).toBe('PLexample');
    expect(url.searchParams.has('start')).toBe(false);
  });

  it('keeps an explicit time when an embed also supplies a start time', () => {
    const video = parseExternalVideoUrl(
      'https://www.youtube.com/embed/dQw4w9WgXcQ?start=42&t=90',
    );
    expect(new URL(video!.url).searchParams.get('t')).toBe('90');
  });

  it('drops embedded-player flags when opening the standalone YouTube page', () => {
    expect(parseExternalVideoUrl('https://www.youtube.com/embed/bGKkHF02w0M?autoplay=1&auto_play=true&enablejsapi=1&origin=https%3A%2F%2Fx.com'))
      .toEqual({ url: 'https://www.youtube.com/watch?v=bGKkHF02w0M', provider: 'YouTube' });
  });

  it.each([
    ['https://vimeo.com/123456789?share=copy', 'Vimeo'],
    ['https://vimeo.com/123456789/abcdef1234', 'Vimeo'],
    ['https://www.dailymotion.com/video/x123abc', 'Dailymotion'],
    ['https://dai.ly/x123abc', 'Dailymotion'],
    ['https://www.bilibili.com/video/BV1xx411c7mD?p=2', '哔哩哔哩'],
    ['https://m.bilibili.com/video/av12345', '哔哩哔哩'],
    ['https://www.twitch.tv/videos/123456789?t=0h1m2s', 'Twitch'],
    ['https://clips.twitch.tv/ExampleClip-SomeId', 'Twitch'],
    ['https://www.twitch.tv/example/clip/ExampleClip-SomeId', 'Twitch'],
  ])('recognizes a specific video page at %s', (url, provider) => {
    expect(parseExternalVideoUrl(url)).toEqual({ url, provider });
  });

  it.each([
    ['https://player.vimeo.com/video/123456789?h=abc', 'https://vimeo.com/123456789?h=abc', 'Vimeo'],
    ['https://www.dailymotion.com/embed/video/x123abc?start=42', 'https://www.dailymotion.com/video/x123abc?start=42', 'Dailymotion'],
  ])('converts a known player URL %s into a video page', (input, url, provider) => {
    expect(parseExternalVideoUrl(input)).toEqual({ url, provider });
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,example',
    'ftp://youtube.com/watch?v=dQw4w9WgXcQ',
    '/watch?v=dQw4w9WgXcQ',
    'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ',
    'https://evil.example/youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com@evil.example/watch?v=dQw4w9WgXcQ',
    'https://user:password@www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/',
    'https://www.youtube.com/@example',
    'https://www.youtube.com/watch',
    'https://www.youtube.com/watch?v=bad',
    'https://www.youtube.com/embed/videoseries?list=PLexample',
    'https://www.youtube.com/redirect?q=https://example.com',
    'https://vimeo.com/channels/example',
    'https://www.dailymotion.com/example',
    'https://www.bilibili.com/',
    'https://b23.tv/unknown',
    'https://www.twitch.tv/example',
    'https://clips.twitch.tv/embed?clip=ExampleClip',
    'https://example.com/video/123',
    'https://video.twimg.com/example.mp4',
  ])('does not infer a video from %s', (url) => {
    expect(parseExternalVideoUrl(url)).toBeNull();
  });
});

describe('confirmed external player page links', () => {
  it('keeps canonical URL parameters for a provider that is not explicitly supported', () => {
    const url = 'https://www.example.com/watch/123?episode=2&t=42#chapter';
    expect(parseExternalPlayerPageUrl(url)).toEqual({ url, provider: 'example.com' });
  });

  it('uses a known provider name and preserves a video page URL', () => {
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42&list=PLexample';
    expect(parseExternalPlayerPageUrl(url)).toEqual({ url, provider: 'YouTube' });
  });

  it.each([
    'https://x.com/example/status/123',
    'https://mobile.twitter.com/example/status/123',
    'https://twitter.com./example/status/123',
    'https://t.co/example',
    'https://video.twimg.com/example.mp4',
    'https://pbs.twimg.com/example.jpg',
    'https://www.youtube.com/@example',
    'https://example.com/video.mp4',
    'https://example.com/stream.m3u8',
    'https://example.com/embed/123',
    'https://example.com/iframe/123',
    'https://example.com/player/123',
    'https://user:password@example.com/watch/123',
    'javascript:alert(1)',
    '//example.com/watch/123',
  ])('rejects internal links and non-page targets at %s', (url) => {
    expect(parseExternalPlayerPageUrl(url)).toBeNull();
  });
});
