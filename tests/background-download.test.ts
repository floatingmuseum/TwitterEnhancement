const mocks = vi.hoisted(() => ({
  download: vi.fn(),
  addMessageListener: vi.fn(),
  addActionListener: vi.fn(),
}));
vi.mock('wxt/browser', () => ({ browser: {
  action: { onClicked: { addListener: mocks.addActionListener } },
  runtime: { onMessage: { addListener: mocks.addMessageListener }, openOptionsPage: vi.fn() },
  downloads: { download: mocks.download },
} }));

describe('background media download dispatch', () => {
  let dispatch: (message: unknown) => Promise<{ ok: boolean; error?: string }> | undefined;
  const image = {
    type: 'twitter-enhancement:download-image',
    url: 'https://pbs.twimg.com/media/One?format=png&name=orig',
    filename: 'twitter-alice-123-1-orig.png',
  };
  const video = {
    type: 'twitter-enhancement:download-video',
    url: 'https://video.twimg.com/ext_tw_video/123/pu/vid/640x360/clip.mp4',
    filename: 'twitter-alice-123.mp4',
  };

  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal('defineBackground', (run: () => void) => run());
    mocks.download.mockResolvedValue(42);
    await import('../entrypoints/background');
    dispatch = mocks.addMessageListener.mock.calls[0]![0];
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it.each([image, video])('downloads accepted media through the existing browser channel: $type', async (message) => {
    expect(await dispatch(message)).toEqual({ ok: true });
    expect(mocks.download).toHaveBeenCalledExactlyOnceWith({
      url: message.url, filename: message.filename, conflictAction: 'uniquify', saveAs: false,
    });
  });

  it('returns a failure when Chrome rejects the download', async () => {
    mocks.download.mockRejectedValueOnce(new Error('Download blocked'));
    expect(await dispatch(image)).toEqual({ ok: false, error: 'Download blocked' });
  });

  it('does not dispatch unsupported URLs, preview sizes, or unsafe filenames', () => {
    for (const change of [
      { url: image.url.replace('pbs.twimg.com', 'example.com') },
      { url: image.url.replace('orig', 'small') },
      { filename: '../image.png' },
      { type: 'other' },
    ]) {
      expect(dispatch({ ...image, ...change })).toBeUndefined();
    }
    expect(mocks.download).not.toHaveBeenCalled();
  });
});
