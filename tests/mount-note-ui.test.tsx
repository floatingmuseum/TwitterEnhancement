import { act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { findXNoteSurfaceTargets } from '../src/platform/x/dom-adapter';
import { mountXNoteUi } from '../src/platform/x/mount-note-ui';
import { createXSurfaceMountManager } from '../src/platform/x/surface-mount-manager';
import { LocalUserNoteRepository } from '../src/shared/storage/user-note-repository';
import { FakeExtensionLocalStorage } from './fakes/fake-storage';

function tweetFixture() {
  document.body.innerHTML = `
    <article data-testid="tweet">
      <header>
        <div data-testid="User-Name" style="display: flex">
          <div><a id="name" href="/Alice">Alice</a></div>
          <div id="metadata"><div>
            <a id="handle" href="/Alice">@Alice</a><span>·</span>
            <div style="flex-shrink: 0"><a id="time" href="/Alice/status/123"><time>32分钟</time></a></div>
          </div></div>
        </div>
        <button aria-label="Grok 操作">Grok</button>
      </header>
      <p data-testid="tweetText">正文</p>
    </article>
  `;
}

function findTargets(route = 'https://x.com/home') {
  return findXNoteSurfaceTargets(document, new URL(route));
}

function getHost() {
  return document.querySelector<HTMLElement>('[data-twitter-enhancement-note]')!;
}

describe('tweet note mounting', () => {
  it.each([false, true])('mounts separate author notes in a tweet and its linkless quote (detail: %s)', async (detail) => {
    document.body.innerHTML = `
      <article data-testid="tweet">
        <div id="main-identity" data-testid="User-Name" style="display:flex;flex-direction:${detail ? 'column' : 'row'}">
          <div><a href="/Alice">Alice</a></div>
          <div id="handle-row" style="display:flex"><div id="handle-branch"><a href="/Alice">@Alice</a></div>
            ${detail ? '' : '<div><a href="/Alice/status/123"><time>1小时</time></a></div>'}
          </div>
        </div>
        <p data-testid="tweetText">正文</p>
        <div id="quote" role="link" tabindex="0">
          <div id="quote-identity" data-testid="User-Name" style="display:flex">
            <div><span>Bob</span></div>
            <div id="quote-metadata"><span id="quoted-handle">@Bob</span><div><time>2小时</time></div></div>
          </div>
          <p data-testid="tweetText">引用正文</p>
        </div>
        ${detail ? '<a href="/Alice/status/123"><time>详情时间</time></a>' : ''}
      </article>
    `;
    const route = detail ? 'https://x.com/Alice/status/123' : 'https://x.com/home';
    const storage = new FakeExtensionLocalStorage();
    const repository = new LocalUserNoteRepository(storage);
    await repository.save('alice', '主作者备注');
    await repository.save('bob', '引用作者备注');
    const manager = createXSurfaceMountManager(target => mountXNoteUi(target, repository));
    const mainIdentity = document.getElementById('main-identity')!;
    const originalStyle = mainIdentity.getAttribute('style');
    await act(async () => manager.sync(findTargets(route)));
    const mainHost = mainIdentity.querySelector<HTMLElement>('[data-twitter-enhancement-note]')!;
    const quoteIdentity = document.getElementById('quote-identity')!;
    const quoteHost = quoteIdentity.querySelector<HTMLElement>('[data-twitter-enhancement-note]')!;
    expect(mainHost?.shadowRoot?.querySelector('button')).toHaveTextContent('主作者备注');
    expect(quoteHost?.shadowRoot?.querySelector('button')).toHaveTextContent('引用作者备注');
    expect(mainHost.parentElement).toBe(detail ? document.getElementById('handle-row') : mainIdentity);
    expect(mainHost.previousElementSibling?.id).toBe(detail ? 'handle-branch' : 'handle-row');
    expect(quoteHost.previousElementSibling?.id).toBe('quote-metadata');

    const navigate = vi.fn();
    document.getElementById('quote')!.addEventListener('click', navigate);
    await userEvent.setup().click(quoteHost.shadowRoot!.querySelector('button')!);
    expect(navigate).not.toHaveBeenCalled();
    expect(quoteHost.shadowRoot?.querySelector('[role="tooltip"]')).toHaveTextContent('引用作者备注');

    quoteHost.remove();
    await act(async () => manager.sync(findTargets(route)));
    expect(quoteIdentity.querySelector('[data-twitter-enhancement-note]')).toBe(quoteHost);
    expect(document.querySelectorAll('[data-twitter-enhancement-note]')).toHaveLength(2);
    await act(() => repository.save('bob', '更新后的引用备注'));
    expect(quoteHost.shadowRoot?.querySelector('button')).toHaveTextContent('更新后的引用备注');
    expect(mainHost.shadowRoot?.querySelector('button')).toHaveTextContent('主作者备注');
    await act(() => repository.delete('bob'));
    expect(quoteHost.style.display).toBe('none');
    expect(mainHost.style.display).toBe('inline-flex');

    // X reuses quoted cards independently of the outer tweet.
    document.getElementById('quoted-handle')!.textContent = '@Alice';
    await act(async () => manager.sync(findTargets(route)));
    expect(quoteHost.isConnected).toBe(false);
    expect(quoteIdentity.querySelector('[data-twitter-enhancement-note]')?.shadowRoot?.querySelector('button'))
      .toHaveTextContent('主作者备注');
    expect(mainIdentity.querySelector('[data-twitter-enhancement-note]')).toBe(mainHost);
    expect(mainIdentity.getAttribute('style')).toBe(originalStyle);
    await act(async () => manager.destroyAll());
    expect(storage.listeners.size).toBe(0);
    expect(document.querySelector('[data-twitter-enhancement-note]')).toBeNull();
  });

  it('mounts after the time branch, hides empty notes, and synchronizes edits without changing X styles', async () => {
    tweetFixture();
    const storage = new FakeExtensionLocalStorage();
    const repository = new LocalUserNoteRepository(storage);
    const manager = createXSurfaceMountManager((target) => mountXNoteUi(target, repository));
    const identity = document.querySelector('[data-testid="User-Name"]')!;
    const originalStyle = identity.getAttribute('style');
    await act(async () => manager.sync(findTargets()));
    const host = getHost();

    expect(host.parentElement).toBe(identity);
    expect(host.previousElementSibling?.id).toBe('metadata');
    expect(host.style.display).toBe('none');
    expect(host.shadowRoot?.querySelector('button')).toBeNull();

    await act(() => repository.save('alice', 'V2EX.Founder'));
    expect(host.style.display).toBe('inline-flex');
    expect(host.shadowRoot?.querySelector('button')).toHaveTextContent('V2EX.Founder');
    await act(() => repository.save('alice', '第一行\n第二行'));
    expect(host.shadowRoot?.querySelector('button')?.textContent).toBe('第一行 第二行');
    await act(() => repository.delete('alice'));
    expect(host.style.display).toBe('none');
    expect(identity.getAttribute('style')).toBe(originalStyle);

    await act(async () => manager.destroyAll());
    expect(document.querySelector('[data-twitter-enhancement-note]')).toBeNull();
    expect(storage.listeners.size).toBe(0);
  });

  it('restores a host removed by X and remounts when a virtualized tweet changes author', async () => {
    tweetFixture();
    const storage = new FakeExtensionLocalStorage();
    const repository = new LocalUserNoteRepository(storage);
    await repository.save('alice', 'Alice 的身份');
    await repository.save('bob', 'Bob 的身份');
    const manager = createXSurfaceMountManager((target) => mountXNoteUi(target, repository));
    await act(async () => manager.sync(findTargets()));
    const oldHost = getHost();
    oldHost.remove();
    await act(async () => manager.sync(findTargets()));
    expect(getHost()).toBe(oldHost);

    document.getElementById('name')!.setAttribute('href', '/Bob');
    document.getElementById('name')!.textContent = 'Bob';
    document.getElementById('handle')!.setAttribute('href', '/Bob');
    document.getElementById('handle')!.textContent = '@Bob';
    document.getElementById('time')!.setAttribute('href', '/Bob/status/456');
    await act(async () => manager.sync(findTargets()));
    expect(oldHost.isConnected).toBe(false);
    await waitFor(() => expect(getHost().shadowRoot?.querySelector('button')).toHaveTextContent('Bob 的身份'));

    document.querySelector('article')!.remove();
    await act(async () => manager.sync(findTargets()));
    expect(storage.listeners.size).toBe(0);
  });

  it('retains profile and hover-card editors alongside the read-only tweet surface', async () => {
    tweetFixture();
    document.body.insertAdjacentHTML('beforeend', `
      <main role="main"><div data-testid="UserName"><span>Alice</span><span>@Alice</span></div></main>
      <div data-testid="HoverCard"><div data-testid="UserName"><a href="/Alice">@Alice</a></div></div>
    `);
    const repository = new LocalUserNoteRepository(new FakeExtensionLocalStorage());
    await repository.save('alice', '本地身份');
    const manager = createXSurfaceMountManager((target) => mountXNoteUi(target, repository));
    await act(async () => manager.sync(findXNoteSurfaceTargets(document, new URL('https://x.com/Alice'))));

    for (const surface of ['profile', 'hover-card']) {
      const editorHost = document.querySelector(`[data-te-surface="${surface}"]`)!;
      expect(editorHost.shadowRoot?.querySelector('button')).toHaveAttribute('aria-label', '编辑 @alice 的备注');
    }
    expect(document.querySelector('[data-te-surface="tweet"]')?.shadowRoot?.querySelector('button'))
      .toHaveAttribute('aria-label', '查看 @alice 的私人备注');
    await act(async () => manager.destroyAll());
  });
});
