import {
  createXImageDownloadManager,
  findXImageDownloadTargets,
  type XImageDownloadTarget,
} from '../src/platform/x/image-download-manager';

function photo(id: string, href = '/Alice/status/123/photo/1', src = `https://pbs.twimg.com/media/${id}?format=jpg&name=small`) {
  return `<a href="${href}"><div data-testid="tweetPhoto" id="${id}"><img src="${src}"></div></a>`;
}

describe('X image download manager', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it.each(['/home', '/i/lists/42', '/Alice', '/Alice/status/123'])(
    'recognizes each photo and its quote identity on %s', (path) => {
      document.body.innerHTML = `<article>
        ${photo('One')}${photo('Two', '/Alice/status/123/photo/2')}
        <div role="link">${photo('Quote', '/Bob/status/456/photo/1')}</div>
      </article>`;
      const targets = findXImageDownloadTargets(document, new URL(path, 'https://x.com'));
      expect(targets.map(({ handle, tweetId, photoIndex }) => ({ handle, tweetId, photoIndex })))
        .toEqual([
          { handle: 'alice', tweetId: '123', photoIndex: 1 },
          { handle: 'alice', tweetId: '123', photoIndex: 2 },
          { handle: 'bob', tweetId: '456', photoIndex: 1 },
        ]);
    },
  );

  it('supports profile media tiles and a photo viewer without wrapping links', () => {
    document.body.innerHTML = `<div role="listitem">${photo('Tile')}</div>
      <div role="dialog"><div data-testid="tweetPhoto"><img src="https://pbs.twimg.com/media/Viewer.png"></div></div>`;
    const targets = findXImageDownloadTargets(document, new URL('https://x.com/Bob/status/456/photo/3'));
    expect(targets).toHaveLength(2);
    expect(targets[1]).toMatchObject({ handle: 'bob', tweetId: '456', photoIndex: 3 });
  });

  it('excludes avatars, hover cards, link previews, video covers, and compose attachments', () => {
    document.body.innerHTML = `
      <div data-testid="HoverCard"><img src="https://pbs.twimg.com/media/Hover.jpg"></div>
      <article>
        <img src="https://pbs.twimg.com/profile_images/123/avatar.jpg">
        <div data-testid="card.wrapper"><img src="https://pbs.twimg.com/media/Card.jpg"></div>
        ${photo('Thumb', '/Alice/status/123/video/1', 'https://pbs.twimg.com/ext_tw_video_thumb/123/cover.jpg')}
        <div data-testid="videoPlayer">${photo('Video')}</div>
        ${photo('OtherHost', '/Alice/status/123/photo/1', 'https://example.com/photo.jpg')}
      </article>
      <div data-testid="tweetPhoto"><img src="https://pbs.twimg.com/media/Compose.jpg"></div>`;
    expect(findXImageDownloadTargets()).toEqual([]);
  });

  it('uses media-id naming when an article photo has no recognized permalink', () => {
    document.body.innerHTML = `<article><div data-testid="tweetPhoto"><img src="https://pbs.twimg.com/media/One.jpg"></div></article>`;
    expect(findXImageDownloadTargets()[0]).toMatchObject({ handle: null, tweetId: null, original: { id: 'One' } });
  });

  it('deduplicates scans and rereads recycled images immediately at click time', () => {
    document.body.innerHTML = `<article>${photo('One')}</article>`;
    const destroy = vi.fn();
    let resolve: () => XImageDownloadTarget | null = () => null;
    const mount = vi.fn((_target, resolveTarget: typeof resolve) => {
      resolve = resolveTarget;
      return { destroy, isConnected: () => true };
    });
    const manager = createXImageDownloadManager(mount);
    manager.sync();
    manager.sync();
    expect(mount).toHaveBeenCalledOnce();

    const image = document.querySelector('img')!;
    Object.defineProperty(image, 'currentSrc', { value: image.src });
    image.src = 'https://pbs.twimg.com/media/Recycled.png';
    document.querySelector('a')!.href = '/Bob/status/999/photo/2';
    expect(resolve()).toMatchObject({ handle: 'bob', tweetId: '999', photoIndex: 2, original: { id: 'Recycled' } });
    manager.sync();
    expect(destroy).toHaveBeenCalledOnce();
    expect(mount).toHaveBeenCalledTimes(2);

    image.src = 'https://pbs.twimg.com/profile_images/123/avatar.jpg';
    expect(resolve()).toBeNull();
    manager.sync();
    expect(destroy).toHaveBeenCalledTimes(2);
    manager.destroy();
  });

  it('remounts after host replacement and cleans up removed nodes and shutdown', () => {
    document.body.innerHTML = `<article>${photo('One')}${photo('Two')}</article>`;
    const destroy = vi.fn();
    let connected = true;
    const mount = vi.fn(() => ({ destroy, isConnected: () => connected }));
    const manager = createXImageDownloadManager(mount);
    manager.sync();
    connected = false;
    manager.sync();
    expect(mount).toHaveBeenCalledTimes(4);
    expect(destroy).toHaveBeenCalledTimes(2);
    connected = true;
    document.getElementById('One')!.remove();
    manager.sync();
    expect(destroy).toHaveBeenCalledTimes(3);
    manager.destroy();
    expect(destroy).toHaveBeenCalledTimes(4);
  });
});
