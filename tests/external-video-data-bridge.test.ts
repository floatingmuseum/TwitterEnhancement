import {
  ensureExternalVideoDataStore,
  EXTERNAL_VIDEO_DATA_EVENT,
  EXTERNAL_VIDEO_DATA_STORE_ATTRIBUTE,
  extractExternalVideoCards,
  publishExternalVideoCards,
  readCapturedExternalVideoCards,
  type CapturedExternalVideoCard,
} from '../src/platform/x/external-video-data-bridge';

const watchUrl = 'https://www.youtube.com/watch?v=abc123';
const playerUrl = 'https://www.youtube.com/embed/abc123';
const imageUrl = 'https://i.ytimg.com/vi/abc123/hqdefault.jpg';

function tweet(tweetId = '123', url = watchUrl) {
  return {
    __typename: 'Tweet',
    rest_id: tweetId,
    legacy: {
      entities: { urls: [{ url: `https://t.co/${tweetId}`, expanded_url: url }] },
    },
    card: {
      legacy: {
        name: 'player',
        url: `https://t.co/${tweetId}`,
        binding_values: [
          { key: 'card_url', value: { string_value: `https://t.co/${tweetId}` } },
          { key: 'player_url', value: { string_value: playerUrl } },
          { key: 'player_image', value: { image_value: { url: imageUrl } } },
        ],
      },
    },
  };
}

function capture(tweetId = '123'): CapturedExternalVideoCard {
  return {
    tweetId,
    cardUrl: `https://t.co/${tweetId}`,
    url: watchUrl,
    playerUrl,
    isPlayer: true,
    imageUrls: [imageUrl],
  };
}

describe('external video data bridge', () => {
  beforeEach(() => {
    document.querySelectorAll(`[${EXTERNAL_VIDEO_DATA_STORE_ATTRIBUTE}]`).forEach((store) => store.remove());
  });

  it('matches the card shortened URL to its expanded destination and thumbnail', () => {
    const value = tweet();
    value.legacy.entities.urls.unshift({ url: 'https://t.co/other', expanded_url: 'https://example.com/unrelated' });

    expect(extractExternalVideoCards({ data: { result: value } })).toEqual([capture()]);
  });

  it('prefers a card URL over an unrelated entity and supports object bindings', () => {
    expect(extractExternalVideoCards({
      rest_id: '123',
      legacy: { entities: { urls: [{ url: 'https://t.co/unrelated', expanded_url: 'https://example.com' }] } },
      card: {
        legacy: {
          name: 'player',
          binding_values: {
            card_url: { string_value: watchUrl },
            player_url: { string_value: playerUrl },
          },
        },
      },
    })).toEqual([{ ...capture(), cardUrl: watchUrl, imageUrls: [] }]);
  });

  it('uses unwound destinations and does not inspect card title text', () => {
    const value = tweet();
    Object.assign(value.legacy.entities.urls[0]!, { unwound_url: 'https://youtu.be/abc123?t=60' });
    value.card.legacy.binding_values.push({ key: 'title', value: { string_value: 'https://malicious.example/video' } });

    expect(extractExternalVideoCards(value)[0]?.url).toBe('https://youtu.be/abc123?t=60');
  });

  it('keeps quoted tweet cards and user IDs separate from the outer tweet', () => {
    const parent = tweet('123');
    const quoted = tweet('456', 'https://vimeo.com/987');
    const payload = {
      ...parent,
      core: { user_results: { result: { rest_id: '999', legacy: { url: 'https://example.com' } } } },
      quoted_status_result: { result: quoted },
    };
    expect(extractExternalVideoCards(payload)).toEqual([
      capture(),
      { ...capture('456'), url: 'https://vimeo.com/987' },
    ]);
  });

  it('does not infer a card from an entity URL alone or inherit parent entities', () => {
    const parent = tweet();
    const child = tweet('456');
    child.legacy.entities.urls = [];
    expect(extractExternalVideoCards({
      rest_id: '123',
      legacy: parent.legacy,
      quoted_status_result: { result: child },
    })).toEqual([{ ...capture('456'), url: playerUrl }]);
  });

  it('preserves non-player card metadata so the DOM layer can classify the destination', () => {
    expect(extractExternalVideoCards({
      rest_id: '123',
      card: { name: 'summary_large_image', url: watchUrl },
    })).toEqual([{ ...capture(), cardUrl: watchUrl, playerUrl: null, isPlayer: false, imageUrls: [] }]);
  });

  it('prefers the original full card destination over its embedded player URL', () => {
    expect(extractExternalVideoCards({
      rest_id: '123',
      card: { url: watchUrl, binding_values: { player_url: { string_value: playerUrl } } },
    })).toEqual([{ ...capture(), cardUrl: watchUrl, imageUrls: [] }]);
  });

  it('skips malformed and unsafe addresses and tolerates cyclic payloads', () => {
    const payload: Record<string, unknown> = {
      rest_id: '123',
      card: {
        url: 'javascript:alert(1)',
        binding_values: {
          card_url: { string_value: 'https://user:secret@youtube.com/watch?v=123' },
          player_url: { string_value: '/embed/123' },
          player_image: { image_value: { url: 'data:image/png;base64,AAAA' } },
        },
      },
    };
    payload.self = payload;
    expect(extractExternalVideoCards([null, 42, 'https://youtube.com', payload])).toEqual([]);
  });

  it('creates an idempotent empty store and publishes only changed contents', () => {
    const changed = vi.fn();
    document.addEventListener(EXTERNAL_VIDEO_DATA_EVENT, changed);
    try {
      ensureExternalVideoDataStore(document);
      ensureExternalVideoDataStore(document);
      expect(document.querySelectorAll(`[${EXTERNAL_VIDEO_DATA_STORE_ATTRIBUTE}]`)).toHaveLength(1);
      expect(changed).not.toHaveBeenCalled();

      publishExternalVideoCards(document, [capture()]);
      publishExternalVideoCards(document, [capture()]);
      expect(changed).toHaveBeenCalledTimes(1);
      publishExternalVideoCards(document, [{ ...capture(), url: 'https://youtu.be/updated' }]);
      expect(changed).toHaveBeenCalledTimes(2);
      expect(readCapturedExternalVideoCards(document)).toEqual([{ ...capture(), url: 'https://youtu.be/updated' }]);
    } finally {
      document.removeEventListener(EXTERNAL_VIDEO_DATA_EVENT, changed);
    }
  });

  it('keeps up to 300 distinct tweet/card pairs', () => {
    const additions = Array.from({ length: 301 }, (_, index) => capture(String(index + 1)));
    publishExternalVideoCards(document, additions);
    expect(readCapturedExternalVideoCards(document)).toHaveLength(300);
    expect(readCapturedExternalVideoCards(document)[0]?.tweetId).toBe('2');
    publishExternalVideoCards(document, [{ ...capture('301'), cardUrl: 'https://t.co/second' }]);
    expect(readCapturedExternalVideoCards(document).filter((item) => item.tweetId === '301')).toHaveLength(2);
  });

  it('validates store contents rather than trusting arbitrary page JSON', () => {
    ensureExternalVideoDataStore(document);
    const store = document.querySelector(`[${EXTERNAL_VIDEO_DATA_STORE_ATTRIBUTE}]`)!;
    store.textContent = JSON.stringify([null, { ...capture(), url: 'javascript:alert(1)' }, { ...capture(), imageUrls: [imageUrl, false] }]);
    expect(readCapturedExternalVideoCards(document)).toEqual([capture()]);
    store.textContent = '{broken';
    expect(readCapturedExternalVideoCards(document)).toEqual([]);
    store.textContent = '{}';
    expect(readCapturedExternalVideoCards(document)).toEqual([]);
  });
});
