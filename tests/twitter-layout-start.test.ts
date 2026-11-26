import { vi } from 'vitest';

vi.mock('../src/shared/storage/browser-interface-layout-preference-repository', () => ({
  interfaceLayoutPreferenceRepository: {
    getPreference: () => new Promise(() => {}),
    subscribe: () => () => {},
  },
}));

it('widens newly mounted columns before another animation frame or the storage read', async () => {
  const onInvalidated = vi.fn<(cleanup: () => void) => void>();
  const context = { onInvalidated, isValid: true, addEventListener: vi.fn() };
  vi.stubGlobal('defineContentScript', (entry: { main: (ctx: typeof context) => void }) => {
    entry.main(context);
    return entry;
  });
  vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  try {
    await import('../entrypoints/twitter-layout.content');
    document.documentElement.setAttribute('data-te-initial-wide-layout', '');
    document.body.innerHTML = `<div style="display:grid">
      <main style="max-width:600px"><section><div id="urt:bookmarks"><ul></ul></div></section></main>
      <aside></aside></div>`;
    await Promise.resolve(); // Deliver the DOM mutation, without running a frame.
    expect(document.querySelector('main')!.style.maxWidth).toBe('none');
    expect(document.getElementById('urt:bookmarks')!.style.width).toBe('100%');
    expect(document.querySelector('aside')!.style.width).toBe('0px');
  } finally {
    onInvalidated.mock.calls[0]?.[0]();
    vi.unstubAllGlobals();
  }
});
