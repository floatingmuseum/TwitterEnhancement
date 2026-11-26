const mocks = vi.hoisted(() => ({
  download: vi.fn(),
  insertCSS: vi.fn(),
  addMessageListener: vi.fn(),
  addActionListener: vi.fn(),
  addInstalledListener: vi.fn(),
  addStartupListener: vi.fn(),
  addStorageListener: vi.fn(),
  getStorage: vi.fn(),
  getRegistered: vi.fn(),
  register: vi.fn(),
  unregister: vi.fn(),
}));
vi.mock('wxt/browser', () => ({ browser: {
  action: { onClicked: { addListener: mocks.addActionListener } },
  runtime: {
    onMessage: { addListener: mocks.addMessageListener }, openOptionsPage: vi.fn(),
    onInstalled: { addListener: mocks.addInstalledListener }, onStartup: { addListener: mocks.addStartupListener },
  },
  downloads: { download: mocks.download },
  storage: { local: { get: mocks.getStorage }, onChanged: { addListener: mocks.addStorageListener } },
  scripting: {
    insertCSS: mocks.insertCSS, getRegisteredContentScripts: mocks.getRegistered,
    registerContentScripts: mocks.register, unregisterContentScripts: mocks.unregister,
  },
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

  it('registers the wide start only for two collapsed sidebars and reconciles it after a preference change', async () => {
    const { INTERFACE_LAYOUT_STORAGE_KEYS: keys } = await import('../src/shared/storage/interface-layout-preference-repository');
    const values = { [keys.leftNavigationExpanded]: false, [keys.rightSidebarVisible]: false };
    const script = {
      id: 'te-initial-wide-layout', matches: ['https://x.com/*', 'https://twitter.com/*'],
      js: ['initial-wide-layout.js'], runAt: 'document_start', persistAcrossSessions: true,
    };
    const registered = new Set<string>();
    mocks.getStorage.mockImplementation(async () => values);
    mocks.getRegistered.mockImplementation(async () => [...registered].map(id => ({ id })));
    mocks.register.mockImplementation(async () => { registered.add(script.id); });
    mocks.unregister.mockImplementation(async () => { registered.delete(script.id); });
    const startup = mocks.addStartupListener.mock.calls[0]![0];
    const change = mocks.addStorageListener.mock.calls[0]![0];
    await mocks.addInstalledListener.mock.calls[0]![0]();
    await startup();
    expect(mocks.register).toHaveBeenCalledExactlyOnceWith([script]);
    values[keys.leftNavigationExpanded] = true;
    change({ [keys.leftNavigationExpanded]: { newValue: true } }, 'local');
    await vi.waitFor(() => expect(mocks.unregister).toHaveBeenCalledExactlyOnceWith({ ids: [script.id] }));
    values[keys.leftNavigationExpanded] = false;
    values[keys.rightSidebarVisible] = true;
    await startup();
    expect(registered.size).toBe(0);
  });

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

  it('installs only the fixed row rule in the requesting X top-level document', async () => {
    const { INSTALL_TIMELINE_ROW_STYLE } = await import('../src/platform/x/timeline-style-message');
    const listener = mocks.addMessageListener.mock.calls[0]![0];
    const sender = { frameId: 0, documentId: 'home', tab: { id: 7 }, url: 'https://x.com/home' };
    mocks.insertCSS.mockResolvedValue(undefined);
    for (const change of [{ frameId: 2 }, { documentId: undefined }, { url: 'https://x.com.example/home' }]) {
      expect(listener(INSTALL_TIMELINE_ROW_STYLE, { ...sender, ...change })).toBeUndefined();
    }
    expect(mocks.insertCSS).not.toHaveBeenCalled();
    await listener(INSTALL_TIMELINE_ROW_STYLE, sender);
    expect(mocks.insertCSS).toHaveBeenCalledExactlyOnceWith({
      target: { tabId: 7, documentIds: ['home'] },
      origin: 'USER', files: ['hidden-timeline-rows.css'],
    });
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
