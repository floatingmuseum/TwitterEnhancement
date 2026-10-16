import {
  createTwitterVideoFilename,
  findBestTwitterVideoUrls,
  isDownloadableTwitterVideoUrl,
  parseTwitterMediaIdentity,
} from '../src/features/video-download/video-download';

describe('Twitter video download model', () => {
  it('matches a poster thumbnail to its real video family and id', () => {
    expect(
      parseTwitterMediaIdentity(
        'https://pbs.twimg.com/ext_tw_video_thumb/190123456789/pu/img/cover.jpg',
      ),
    ).toEqual({ family: 'ext_tw_video', id: '190123456789' });

    expect(
      parseTwitterMediaIdentity(
        'https://pbs.twimg.com/tweet_video_thumb/ExampleClip.jpg',
      ),
    ).toEqual({ family: 'tweet_video', id: 'ExampleClip' });
  });

  it('chooses the highest-resolution loaded MP4 for each media item', () => {
    const identity = { family: 'ext_tw_video', id: '190123456789' };
    const low =
      'https://video.twimg.com/ext_tw_video/190123456789/pu/vid/320x180/clip.mp4?tag=12';
    const high =
      'https://video.twimg.com/ext_tw_video/190123456789/pu/vid/1280x720/clip.mp4?tag=12';

    expect(
      findBestTwitterVideoUrls([identity], [
        low,
        'https://video.twimg.com/ext_tw_video/999/pu/vid/1920x1080/other.mp4',
        high,
      ]),
    ).toEqual([high]);
  });

  it('rejects non-Twitter, non-HTTPS, and non-MP4 download URLs', () => {
    expect(
      isDownloadableTwitterVideoUrl(
        'https://video.twimg.com/amplify_video/123/vid/720x720/clip.mp4',
      ),
    ).toBe(true);
    expect(
      isDownloadableTwitterVideoUrl(
        'https://example.com/amplify_video/123/vid/720x720/clip.mp4',
      ),
    ).toBe(false);
    expect(
      isDownloadableTwitterVideoUrl(
        'http://video.twimg.com/amplify_video/123/vid/720x720/clip.mp4',
      ),
    ).toBe(false);
    expect(
      isDownloadableTwitterVideoUrl(
        'https://video.twimg.com/amplify_video/123/pl/playlist.m3u8',
      ),
    ).toBe(false);
    expect(
      isDownloadableTwitterVideoUrl(
        'https://video.twimg.com/ext_tw_video/123/pu/vid/avc1/0/0/1280x720/init.mp4',
      ),
    ).toBe(false);
    expect(
      isDownloadableTwitterVideoUrl(
        'https://video.twimg.com/amplify_video/123/vid/avc1/0/0/1280x720/init.mp4',
      ),
    ).toBe(false);
    expect(
      isDownloadableTwitterVideoUrl(
        'https://video.twimg.com/ext_tw_video/123/pu/aud/mp4a/0/0/128000/audio.mp4',
      ),
    ).toBe(false);
    expect(
      isDownloadableTwitterVideoUrl(
        'https://video.twimg.com/amplify_video/123/pl/avc1/720x1280/init.mp4',
      ),
    ).toBe(false);
    expect(
      isDownloadableTwitterVideoUrl(
        'https://video.twimg.com/amplify_video/123/vid/720x720/clip.mp4?container=fmp4',
      ),
    ).toBe(false);
    expect(
      isDownloadableTwitterVideoUrl(
        'https://video.twimg.com/tweet_video/ExampleClip.mp4',
      ),
    ).toBe(true);
  });

  it('builds stable filenames and numbers multi-video tweets', () => {
    expect(createTwitterVideoFilename('Alice', '42', 0, 1)).toBe(
      'twitter-Alice-42.mp4',
    );
    expect(createTwitterVideoFilename('alice', '42', 1, 2)).toBe(
      'twitter-alice-42-2.mp4',
    );
  });
});
