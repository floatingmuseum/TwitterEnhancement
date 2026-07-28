import {
  mergeOrderedMediaEntries,
  parseXMediaRoute,
  type XMediaEntry,
} from '../src/features/media-navigation/media-navigation';

function entry(tweetId: string, kind: XMediaEntry['kind'] = 'photo'): XMediaEntry {
  return {
    handle: 'alice',
    tweetId,
    kind,
    href: `/alice/status/${tweetId}/${kind}/1`,
  };
}

describe('X media navigation rules', () => {
  it('parses photo and video routes into canonical media identities', () => {
    expect(parseXMediaRoute('https://x.com/Alice/status/123/photo/4')).toEqual({
      handle: 'alice',
      tweetId: '123',
      kind: 'photo',
      index: 4,
      href: '/alice/status/123/photo/1',
    });
    expect(parseXMediaRoute('/Alice/status/456/video/1')).toEqual({
      handle: 'alice',
      tweetId: '456',
      kind: 'video',
      index: 1,
      href: '/alice/status/456/video/1',
    });
    expect(parseXMediaRoute('/Alice/status/123')).toBeNull();
    expect(parseXMediaRoute('/Alice/status/123/photo/0')).toBeNull();
  });

  it('merges overlapping virtualized batches in newest-to-oldest order', () => {
    expect(
      mergeOrderedMediaEntries(
        [entry('200'), entry('190'), entry('180')],
        [entry('190'), entry('180'), entry('170'), entry('160', 'video')],
      ),
    ).toEqual([
      entry('200'),
      entry('190'),
      entry('180'),
      entry('170'),
      entry('160', 'video'),
    ]);

    expect(
      mergeOrderedMediaEntries(
        [entry('190'), entry('180'), entry('170')],
        [entry('210'), entry('200'), entry('190'), entry('180')],
      ),
    ).toEqual([
      entry('210'),
      entry('200'),
      entry('190'),
      entry('180'),
      entry('170'),
    ]);
  });

  it('deduplicates a tweet and rejects a batch with no known overlap', () => {
    expect(
      mergeOrderedMediaEntries([], [entry('200'), entry('200'), entry('190')]),
    ).toEqual([entry('200'), entry('190')]);

    expect(
      mergeOrderedMediaEntries(
        [entry('200'), entry('190')],
        [entry('120'), entry('110')],
      ),
    ).toEqual([entry('200'), entry('190')]);
  });
});
