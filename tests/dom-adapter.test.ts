import {
  extractHandleFromElement,
  findXNoteSurfaceTargets,
} from '../src/platform/x/dom-adapter';

describe('X DOM adapter', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('finds a profile identity block on profile routes', () => {
    document.body.innerHTML = `
      <main role="main">
        <section data-testid="primaryColumn">
          <div class="profile-header">
            <div data-testid="UserName">
              <a href="/Alice"><span>Alice</span></a>
              <div><span>@Alice</span></div>
            </div>
            <div data-testid="UserDescription">简介</div>
          </div>
        </section>
      </main>
    `;

    const targets = findXNoteSurfaceTargets(document, new URL('https://x.com/Alice'));
    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({ handle: 'alice', surface: 'profile' });
    expect(targets[0]?.anchor).toHaveAttribute('data-testid', 'UserName');
  });

  it('does not mistake status or reserved routes for profiles', () => {
    document.body.innerHTML = `
      <main role="main"><section data-testid="primaryColumn">
        <div data-testid="UserName"><span>@Alice</span></div>
      </section></main>
    `;

    expect(
      findXNoteSurfaceTargets(document, new URL('https://x.com/Alice/status/1')),
    ).toHaveLength(0);
    expect(
      findXNoteSurfaceTargets(document, new URL('https://x.com/explore')),
    ).toHaveLength(0);
  });

  it('finds hover cards independently of the current route', () => {
    document.body.innerHTML = `
      <div id="layers">
        <div data-testid="HoverCard">
          <div data-testid="UserName">
            <a href="/Bob"><span>Bob</span></a>
            <a href="/Bob"><span>@Bob</span></a>
          </div>
          <div data-testid="UserDescription">简介里提到 @someone</div>
        </div>
      </div>
    `;

    const targets = findXNoteSurfaceTargets(document, new URL('https://x.com/home'));
    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({ handle: 'bob', surface: 'hover-card' });
  });

  it('extracts a handle from an exact nested text node', () => {
    const element = document.createElement('div');
    element.innerHTML = '<span>Display name</span><div><span>@CaseSensitive</span></div>';
    expect(extractHandleFromElement(element)).toBe('casesensitive');
  });
});
