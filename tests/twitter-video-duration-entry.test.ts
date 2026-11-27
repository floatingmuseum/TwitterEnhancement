import { createXVideoDurationManager } from '../src/platform/x/video-duration-manager';

it('shows a custom-poster video duration from the initial Relay stream and from later timeline requests', async () => {
  const poster = 'https://pbs.twimg.com/media/HYEJKQ3WUAEKb2U';
  const payload = (ms: number) => ({ data: { tweet_result_by_rest_id: { result: {
    rest_id: '2125990574087864744', media_entities2: [{
      type: 'video', media_url_https: `${poster}.jpg`,
      video_info: { duration_millis: ms, variants: [{
        url: 'https://video.twimg.com/amplify_video/2125990492819054592/pl/master.m3u8',
      }] },
    }],
  } } } });
  document.body.innerHTML = `<article>
    <div data-press-control><video poster="${poster}?format=jpg&amp;name=medium"></video>
      <button aria-label="Play"><svg data-icon="icon-player-play"></svg></button>
      <img alt="Video thumbnail" src="${poster}?format=jpg&amp;name=medium">
    </div>
    <a href="/user/status/123/photo/1"><img src="${poster}.jpg"></a>
  </article>`;
  const manager = createXVideoDurationManager();
  const originalJson = Response.prototype.json;
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
  vi.spyOn(Response.prototype, 'url', 'get').mockReturnValue('https://x.com/graphql?operation=timeline');
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(payload(72_000))));
  vi.stubGlobal('defineContentScript', (entry: { main(): void }) => entry.main());
  try {
    await import('../entrypoints/twitter-video-data.content');
    const script = document.createElement('script');
    script.type = 'text/plain';
    const value = JSON.stringify(JSON.stringify(payload(58_517)));
    script.textContent = `($R=>$R[1].next({result:{kind:"Result.Ok",value:${value}}}))($R["tsr"]);document.currentScript.remove()`;
    document.head.append(script);
    script.remove();
    document.dispatchEvent(new Event('DOMContentLoaded'));
    manager.sync();
    const badge = document.querySelector('[data-press-control] .te-video-duration');
    expect(badge).toHaveTextContent('0:58');
    expect(document.querySelectorAll('.te-video-duration')).toHaveLength(1);

    document.querySelector('video')!.remove(); // A timeline preview can still be poster-only.
    const response = await fetch('https://x.com/graphql?operation=timeline');
    await response.text();
    await vi.waitFor(() => {
      manager.sync();
      expect(badge).toHaveTextContent('1:12');
    });
  } finally {
    manager.destroy();
    document.dispatchEvent(new Event('DOMContentLoaded'));
    Response.prototype.json = originalJson;
    XMLHttpRequest.prototype.open = originalOpen;
    XMLHttpRequest.prototype.send = originalSend;
    vi.unstubAllGlobals();
  }
});
