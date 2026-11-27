import { saveVideoReturn, takeVideoReturn } from '../src/platform/x/timeline-video-history';

const position = { path: location.pathname + location.search, feedId: 'urt:home:following', id: '42', nested: false, scroll: 6000, top: 120 };
const viewerUrl = new URL('/Ballislife/status/42/video/1', location.href).href;
afterEach(() => vi.unstubAllGlobals());

function mockEntry(initial: unknown) {
  let state = initial;
  const nav = {
    currentEntry: { getState: () => state },
    activation: { navigationType: 'traverse', from: { url: viewerUrl } },
    updateCurrentEntry: ({ state: next }: { state: unknown }) => {
      if (next === undefined) throw new TypeError('NavigationUpdateCurrentEntryOptions requires state');
      state = next;
    },
  };
  vi.stubGlobal('navigation', nav);
  return nav;
}

it.each([null, undefined, { tab: 'following' }])('consumes a video return once and restores the existing history state %j', initial => {
  const nav = mockEntry(initial);
  saveVideoReturn(position, viewerUrl);
  expect(takeVideoReturn()).toEqual(position);
  expect(takeVideoReturn()).toBeNull();
  expect(nav.currentEntry.getState()).toEqual(initial ?? null);
});

it('skips a fresh visit, another feed, and history state owned by a different data type', () => {
  const nav = mockEntry({ tab: 'following' });
  saveVideoReturn(position, viewerUrl);
  nav.activation.navigationType = 'reload';
  expect(takeVideoReturn()).toBeNull();
  nav.activation.navigationType = 'traverse';
  saveVideoReturn({ ...position, path: '/i/lists/123' }, viewerUrl);
  expect(takeVideoReturn()).toBeNull();
  const array = mockEntry(['following']);
  saveVideoReturn(position, viewerUrl);
  expect(array.currentEntry.getState()).toEqual(['following']);
});

it.each(['replace', 'push'])('restores a fresh feed entry only when the recorded video led directly back via %s', navigationType => {
  const source = mockEntry(null);
  saveVideoReturn(position, viewerUrl);
  const entries = [{ ...source.currentEntry, url: location.href }, { url: viewerUrl }];
  const activation = { navigationType, from: { url: viewerUrl } };
  vi.stubGlobal('navigation', {
    currentEntry: { index: navigationType === 'replace' ? 1 : 2, getState: () => null },
    entries: () => entries, activation,
  });
  expect(takeVideoReturn()).toEqual(position);
  activation.from.url = new URL('/home', location.href).href;
  expect(takeVideoReturn()).toBeNull();
});
