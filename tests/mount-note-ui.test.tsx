import { act, waitFor } from '@testing-library/react';
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

function findTargets() {
  return findXNoteSurfaceTargets(document, new URL('https://x.com/home'));
}

function getHost() {
  return document.querySelector<HTMLElement>('[data-twitter-enhancement-note]')!;
}

describe('tweet note mounting', () => {
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
