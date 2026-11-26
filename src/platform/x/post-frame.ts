// X's semantic timeline wraps each post (including embedded quotes) in
// a link frame. Repost attribution and the original can be nested articles
// inside the same frame.
export const POST_FRAME_SELECTOR = '[role="link"][data-href*="/status/"]';

export function frameIdentity(frame: Element | null) {
  const match = /^\/([a-z0-9_]{1,15})\/status\/(\d+)\/?$/i.exec(frame?.getAttribute('data-href') ?? '');
  return match?.[1] && match[2] ? { handle: match[1].toLowerCase(), tweetId: match[2] } : null;
}
