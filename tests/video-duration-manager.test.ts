import { readFileSync } from 'node:fs';
import {
  extractTwitterVideoVariants, publishTwitterVideoVariants, TWITTER_VIDEO_DATA_STORE_ATTRIBUTE,
} from '../src/platform/x/twitter-video-data-bridge';
import { createXVideoDurationManager } from '../src/platform/x/video-duration-manager';

const poster = (id: number) => `https://pbs.twimg.com/ext_tw_video_thumb/${id}/pu/img/cover.jpg`;
const stream = (id: number) => `https://video.twimg.com/ext_tw_video/${id}/pl/master.m3u8`;
const badges = () => [...document.querySelectorAll('.te-video-duration')].map(node => node.textContent);

beforeEach(() => {
  document.querySelector(`[${TWITTER_VIDEO_DATA_STORE_ATTRIBUTE}]`)?.remove();
  document.body.replaceChildren();
});

it('labels each unplayed attachment and quote from its own media data, including HLS-only videos', () => {
  document.body.innerHTML = `<article>
    <div data-testid="tweetPhoto">
      <div data-press-control><img src="${poster(10)}"><button>播放</button></div>
      <div data-press-control><img src="${poster(20)}"></div>
    </div>
    <div data-slot="embedded-tweet-frame"><article>
      <div data-testid="tweetPhoto"><img src="${poster(30)}"><button data-testid="playButton"></button></div>
    </article></div>
    <div data-press-control><img src="${poster(40)}"></div>
    <img src="https://pbs.twimg.com/media/photo.jpg">
  </article>`;
  const manager = createXVideoDurationManager();
  try {
    manager.sync();
    expect(badges()).toEqual([]);
    publishTwitterVideoVariants(document, extractTwitterVideoVariants({
      rest_id: '1', media: [
        { media_url_https: poster(10), video_info: { duration_millis: 65_450 } },
        { videoInfo: { durationMillis: 3_723_000, variants: [{ src: stream(20) }] } },
      ],
      quote: { rest_id: '2', media: [{ preview_image_url: poster(30), duration_ms: 8_000 }] },
    }));
    // Later downloads for the same tweet must preserve the captured lengths.
    publishTwitterVideoVariants(document, extractTwitterVideoVariants({
      rest_id: '1', url: 'https://video.twimg.com/ext_tw_video/10/pu/vid/640x360/clip.mp4',
    }));
    manager.sync();
    expect(badges()).toEqual(['1:05', '1:02:03', '0:08']);
    const first = document.querySelector('.te-video-duration')!;
    manager.sync();
    expect(document.querySelector('.te-video-duration')).toBe(first);
    first.remove();
    manager.sync();
    expect(first.isConnected).toBe(true);

    const recycled = document.querySelector('img')!;
    recycled.src = poster(99);
    document.querySelector('[data-slot="embedded-tweet-frame"]')!.remove();
    manager.sync();
    expect(badges()).toEqual(['1:02:03']);
    expect(recycled.parentElement!.style.position).toBe('');
  } finally {
    manager.destroy();
  }
  expect(badges()).toEqual([]);
});

it('uses native metadata when available, clears the badge during playback and restores host styles', () => {
  document.body.innerHTML = `<article>
    <div data-testid="videoComponent" style="position:static!important">
      <img src="${poster(11)}"><div data-testid="videoPlayer"><video></video></div>
    </div>
  </article>`;
  const player = document.querySelector<HTMLElement>('[data-testid="videoComponent"]')!;
  const video = player.querySelector('video')!;
  const duration = vi.spyOn(video, 'duration', 'get').mockReturnValue(NaN);
  const paused = vi.spyOn(video, 'paused', 'get').mockReturnValue(true);
  const style = document.createElement('style');
  style.textContent = readFileSync('entrypoints/twitter.content/video-duration.css', 'utf8');
  document.head.append(style);
  const manager = createXVideoDurationManager();
  try {
    manager.sync();
    expect(badges()).toEqual([]);
    duration.mockReturnValue(13.7);
    manager.sync();
    expect(badges()).toEqual(['0:13']);
    const badge = player.querySelector('.te-video-duration')!;
    const css = getComputedStyle(badge);
    expect([css.position, css.right, css.bottom, css.pointerEvents]).toEqual(['absolute', '8px', '8px', 'none']);
    expect(badge).toHaveAccessibleName('视频时长 0:13');
    paused.mockReturnValue(false);
    manager.sync();
    expect(badges()).toEqual([]);
    paused.mockReturnValue(true);
    duration.mockReturnValue(Infinity);
    manager.sync();
    expect(badges()).toEqual([]);
    duration.mockReturnValue(22);
    manager.sync();
    expect(badges()).toEqual(['0:22']);
  } finally {
    manager.destroy();
    style.remove();
  }
  expect(player.style.position).toBe('static');
  expect(player.style.getPropertyPriority('position')).toBe('important');
  expect(badges()).toEqual([]);
});
