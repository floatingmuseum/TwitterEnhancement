import {
  captureTwitterVideoUrl,
  ensureTwitterVideoDataStore,
  extractTwitterVideoVariants,
  publishTwitterVideoVariants,
} from '../src/platform/x/twitter-video-data-bridge';

export default defineContentScript({
  matches: ['https://x.com/*', 'https://twitter.com/*'],
  runAt: 'document_start',
  world: 'MAIN',
  main() {
    ensureTwitterVideoDataStore(document);

    const capturePayload = (payload: unknown) => {
      publishTwitterVideoVariants(
        document,
        extractTwitterVideoVariants(payload),
      );
    };

    const captureUrl = (value: unknown) => {
      const url =
        typeof value === 'string'
          ? value
          : value instanceof URL
            ? value.toString()
            : value instanceof Request
              ? value.url
              : null;
      if (!url) {
        return;
      }

      const capture = captureTwitterVideoUrl(url);
      if (capture) {
        publishTwitterVideoVariants(document, [capture]);
      }
    };

    const isXDataResponse = (url: string) =>
      url.includes('/graphql/') || url.includes('/i/api/');

    const originalResponseJson = Response.prototype.json;
    Response.prototype.json = async function (this: Response) {
      const payload = (await originalResponseJson.call(this)) as unknown;
      if (isXDataResponse(this.url)) {
        capturePayload(payload);
      }
      return payload;
    };

    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
      captureUrl(args[0]);
      const response = await originalFetch(...args);
      captureUrl(response.url);

      if (isXDataResponse(response.url)) {
        void response
          .clone()
          .json()
          .catch(() => {
            // Non-JSON and aborted GraphQL responses do not contain usable variants.
          });
      }

      return response;
    };

    const xhrRequestUrls = new WeakMap<XMLHttpRequest, string>();
    const originalXhrOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (
      this: XMLHttpRequest,
      ...args: Parameters<typeof originalXhrOpen>
    ) {
      const url = String(args[1]);
      xhrRequestUrls.set(this, url);
      captureUrl(url);
      return Reflect.apply(originalXhrOpen, this, args);
    } as typeof originalXhrOpen;

    const originalXhrSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function (
      this: XMLHttpRequest,
      ...args: Parameters<typeof originalXhrSend>
    ) {
      this.addEventListener(
        'load',
        () => {
          captureUrl(this.responseURL || xhrRequestUrls.get(this));
          if (!isXDataResponse(this.responseURL || xhrRequestUrls.get(this) || '')) {
            return;
          }

          try {
            if (this.responseType === 'json') {
              capturePayload(this.response);
            } else if (this.responseType === '' || this.responseType === 'text') {
              capturePayload(JSON.parse(this.responseText) as unknown);
            }
          } catch {
            // Ignore aborted and non-JSON X API responses.
          }
        },
        { once: true },
      );
      return Reflect.apply(originalXhrSend, this, args);
    } as typeof originalXhrSend;
  },
});
