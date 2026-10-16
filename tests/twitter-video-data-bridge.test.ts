import {
  captureTwitterVideoUrl,
  extractTwitterVideoVariants,
  publishTwitterVideoVariants,
  readCapturedTwitterVideoUrls,
} from '../src/platform/x/twitter-video-data-bridge';

describe('X video data bridge', () => {
  it('extracts downloadable MP4 variants from a tweet GraphQL response', () => {
    const result = extractTwitterVideoVariants({
      data: {
        threaded_conversation_with_injections_v2: {
          instructions: [
            {
              entries: [
                {
                  content: {
                    itemContent: {
                      tweet_results: {
                        result: {
                          __typename: 'Tweet',
                          rest_id: '123',
                          legacy: {
                            extended_entities: {
                              media: [
                                {
                                  id_str: '987',
                                  type: 'video',
                                  video_info: {
                                    variants: [
                                      {
                                        content_type: 'application/x-mpegURL',
                                        url: 'https://video.twimg.com/amplify_video/987/pl/master.m3u8',
                                      },
                                      {
                                        bitrate: 832000,
                                        content_type: 'video/mp4',
                                        url: 'https://video.twimg.com/amplify_video/987/vid/640x360/clip.mp4?tag=14',
                                      },
                                      {
                                        bitrate: 2176000,
                                        content_type: 'video/mp4',
                                        url: 'https://video.twimg.com/amplify_video/987/vid/1280x720/clip.mp4?tag=14',
                                      },
                                    ],
                                  },
                                },
                              ],
                            },
                          },
                        },
                      },
                    },
                  },
                },
              ],
            },
          ],
        },
      },
    });

    expect(result).toEqual([
      {
        tweetId: '123',
        mediaKeys: ['amplify_video:987'],
        urls: [
          'https://video.twimg.com/amplify_video/987/vid/640x360/clip.mp4?tag=14',
          'https://video.twimg.com/amplify_video/987/vid/1280x720/clip.mp4?tag=14',
        ],
      },
    ]);
  });

  it('extracts variants when X moves media outside legacy.extended_entities', () => {
    const url =
      'https://video.twimg.com/amplify_video/987/vid/1280x720/clip.mp4?tag=14';

    expect(
      extractTwitterVideoVariants({
        data: {
          tweetResult: {
            rest_id: '123',
            mediaDetails: [
              {
                variants: [{ contentType: 'video/mp4', src: url }],
              },
            ],
          },
        },
      }),
    ).toEqual([
      {
        tweetId: '123',
        mediaKeys: ['amplify_video:987'],
        urls: [url],
      },
    ]);
  });

  it('shares captured variants with the isolated content script by tweet id', () => {
    const low =
      'https://video.twimg.com/amplify_video/987/vid/640x360/clip.mp4?tag=14';
    const high =
      'https://video.twimg.com/amplify_video/987/vid/1280x720/clip.mp4?tag=14';

    publishTwitterVideoVariants(document, [
      {
        tweetId: '123',
        mediaKeys: ['amplify_video:987'],
        urls: [low, high],
      },
    ]);

    expect(readCapturedTwitterVideoUrls(document, '123', [])).toEqual([
      low,
      high,
    ]);
    expect(readCapturedTwitterVideoUrls(document, '456', [])).toEqual([]);
  });

  it('captures a direct player MP4 request without GraphQL tweet context', () => {
    const url =
      'https://video.twimg.com/ext_tw_video/654/pu/vid/1920x1080/clip.mp4?tag=12';

    expect(captureTwitterVideoUrl(url)).toEqual({
      tweetId: '',
      mediaKeys: ['ext_tw_video:654'],
      urls: [url],
    });
    expect(
      captureTwitterVideoUrl(
        'https://video.twimg.com/ext_tw_video/654/pl/master.m3u8',
      ),
    ).toBeNull();
    expect(
      captureTwitterVideoUrl(
        'https://video.twimg.com/ext_tw_video/654/pu/vid/avc1/0/0/1920x1080/init.mp4',
      ),
    ).toBeNull();
  });

  it('does not leak unrelated direct video captures with empty tweetId', () => {
    const firstUrl =
      'https://video.twimg.com/ext_tw_video/111/pu/vid/1280x720/first.mp4?tag=12';
    const secondUrl =
      'https://video.twimg.com/ext_tw_video/222/pu/vid/1280x720/second.mp4?tag=12';

    const firstCapture = captureTwitterVideoUrl(firstUrl);
    const secondCapture = captureTwitterVideoUrl(secondUrl);
    expect(firstCapture).not.toBeNull();
    expect(secondCapture).not.toBeNull();

    publishTwitterVideoVariants(document, [firstCapture!, secondCapture!]);

    expect(
      readCapturedTwitterVideoUrls(document, '999', [
        { family: 'ext_tw_video', id: '111' },
      ]),
    ).toEqual([firstUrl]);
  });
});
