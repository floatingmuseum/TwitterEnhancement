import {
  createXVideoDownloadManager,
  findXVideoDownloadTargets,
} from '../src/platform/x/video-download-manager';

function renderVideoTweet() {
  document.body.innerHTML = `
    <article id="tweet">
      <a href="/Alice/status/123"><time>刚刚</time></a>
      <div data-testid="videoPlayer">
        <video poster="https://pbs.twimg.com/ext_tw_video_thumb/987/pu/img/cover.jpg"></video>
      </div>
      <div role="group" id="actions">
        <button data-testid="reply">回复</button>
        <button data-testid="retweet">转贴</button>
        <button data-testid="like">喜欢</button>
      </div>
    </article>
  `;
}

function renderUnplayedVideoTweet() {
  document.body.innerHTML = `
    <article id="tweet">
      <a href="/Alice/status/123"><time>刚刚</time></a>
      <div data-testid="tweetPhoto">
        <img
          alt="嵌入式视频"
          src="https://pbs.twimg.com/amplify_video_thumb/987/img/cover?format=jpg&name=medium"
        />
        <button data-testid="playButton" aria-label="播放此视频">播放</button>
      </div>
      <div role="group" id="actions">
        <button data-testid="reply">回复</button>
        <button data-testid="retweet">转贴</button>
        <button data-testid="like">喜欢</button>
      </div>
    </article>
  `;
}

describe('X video download manager', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('finds a video tweet and mounts into its action bar', () => {
    renderVideoTweet();

    const targets = findXVideoDownloadTargets(document);

    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({
      handle: 'alice',
      tweetId: '123',
      identities: [{ family: 'ext_tw_video', id: '987' }],
    });
    expect(targets[0]?.anchor).toHaveAttribute('id', 'actions');
  });

  it('finds an unplayed video tweet before X creates the video element', () => {
    renderUnplayedVideoTweet();

    const targets = findXVideoDownloadTargets(document);

    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({
      handle: 'alice',
      tweetId: '123',
      identities: [{ family: 'amplify_video', id: '987' }],
    });
  });

  it('keeps a tweet-id fallback when a video poster has no media id', () => {
    renderVideoTweet();
    document.querySelector('video')?.setAttribute('poster', 'https://example.com/cover.jpg');

    expect(findXVideoDownloadTargets(document)).toEqual([
      expect.objectContaining({
        tweetId: '123',
        identities: [],
      }),
    ]);
  });

  it('resolves the best matching resource at click time and cleans up removed tweets', () => {
    renderVideoTweet();
    const destroy = vi.fn();
    let resources: string[] = [];
    let resolveMountedUrls: () => string[] = () => [];
    const mount = vi.fn((_target, resolveUrls: () => string[]) => {
      resolveMountedUrls = resolveUrls;
      return { updateAppearance: vi.fn(), destroy };
    });
    const manager = createXVideoDownloadManager(mount, () => resources);

    manager.sync(document);
    resources = [
      'https://video.twimg.com/ext_tw_video/987/pu/vid/640x360/clip.mp4?tag=1',
      'https://video.twimg.com/ext_tw_video/987/pu/vid/1280x720/clip.mp4?tag=1',
      'https://video.twimg.com/ext_tw_video/987/pu/vid/avc1/0/0/1920x1080/init.mp4',
      'https://video.twimg.com/amplify_video/555/vid/1280x720/other-tweet.mp4?tag=14',
      'https://video.twimg.com/amplify_video/666/vid/avc1/0/0/720x1280/other-init.mp4',
    ];

    expect(resolveMountedUrls()).toEqual([resources[1]]);
    document.querySelector('article')?.remove();
    manager.sync(document);
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('does not mount twice across repeated mutation scans', () => {
    renderVideoTweet();
    const updateAppearance = vi.fn();
    const mount = vi.fn(() => ({ updateAppearance, destroy: vi.fn() }));
    const manager = createXVideoDownloadManager(mount, () => []);

    manager.sync(document);
    manager.sync(document);

    expect(mount).toHaveBeenCalledOnce();
    expect(updateAppearance).toHaveBeenCalledOnce();
  });
});
